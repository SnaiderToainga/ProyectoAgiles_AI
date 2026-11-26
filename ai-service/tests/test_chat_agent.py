"""Agente conversacional: herramientas reales contra la API académica, function calling y traza (sección 7)."""
import json
from unittest.mock import MagicMock

import httpx
import pytest
from fastapi.testclient import TestClient

import app.main as main
from app.schemas import ContextoCursoChat, EstudianteChatDto, SolicitudChat
from app.services.backend_client import BackendAcademico, BackendError
from app.services.chat_service import ChatService
from app.services.chat_tools import ChatTools
from tests.fakes import CONTEXTO, ESTUDIANTES, BackendFalso, respuesta_llamadas, respuesta_texto

client = TestClient(main.app)
CABECERA = {"Authorization": "Bearer token-docente"}


def _solicitud(**kwargs) -> SolicitudChat:
    datos = {"modo": "curso", "mensaje": "¿Quiénes están en riesgo?", "cursoId": 1, "parcialId": 10}
    datos.update(kwargs)
    return SolicitudChat(**datos)


def _servicio_local() -> ChatService:
    service = ChatService()
    service.client = None
    service.api_key = ""
    return service


def _servicio_con_modelo(*respuestas) -> tuple:
    service = ChatService()
    service.api_key = "fake-key"
    fake_client = MagicMock()
    fake_client.models.generate_content.side_effect = list(respuestas)
    service.client = fake_client
    return service, fake_client


@pytest.fixture
def backend_en_endpoint(monkeypatch):
    """Sustituye el cliente HTTP del endpoint por la API en memoria y fuerza el motor local."""
    backend = BackendFalso()
    tokens = []

    def fabrica(token, *args, **kwargs):
        tokens.append(token)
        return backend

    monkeypatch.setattr(main, "BackendAcademico", fabrica)
    monkeypatch.setattr(main.chat_service, "client", None)
    monkeypatch.setattr(main.chat_service, "api_key", "")
    backend.tokens = tokens
    return backend


# -- Cálculos deterministas ------------------------------------------------------------------------

def test_tool_resumen_curso():
    estudiantes = [EstudianteChatDto(**e) for e in ESTUDIANTES]
    resumen = ChatTools.tool_resumen_curso(ContextoCursoChat(**CONTEXTO), estudiantes)
    assert resumen["totalEstudiantes"] == 4
    assert resumen["estudiantesEnRiesgo"] == 2
    assert resumen["tasaAprobacionPct"] == 50.0
    assert resumen["distribucionRangos"]["sobresaliente"]["cantidad"] == 1


def test_tool_estudiantes_en_riesgo_ordena_de_menor_a_mayor():
    resultado = ChatTools.tool_estudiantes_en_riesgo([EstudianteChatDto(**e) for e in ESTUDIANTES])
    assert [e["codigo"] for e in resultado["estudiantes"]] == ["EST-001", "EST-003"]


def test_tool_diagnostico_estudiante_incluye_actividad_sin_entrega():
    diag = ChatTools.tool_diagnostico_estudiante(EstudianteChatDto(**ESTUDIANTES[0]))
    assert diag["nivelRiesgo"] == "Alto"
    assert {"nombre": "APE 1", "componente": "APE", "nota": 0.0, "temas": ["Planning Poker"]} in diag["actividadesDeficientes"]


# -- Contrato del endpoint -------------------------------------------------------------------------

def test_endpoint_sin_token_responde_401():
    respuesta = client.post("/api/agent/chat", json={"mensaje": "Hola", "cursoId": 1, "parcialId": 10})
    assert respuesta.status_code == 401


def test_endpoint_rechaza_notas_o_nombres_enviados_desde_el_navegador():
    payload = {
        "mensaje": "Resumen",
        "cursoId": 1,
        "parcialId": 10,
        "estudiantesCurso": [{"codigo": "EST-001", "notaFinal": 5.0, "nombres": "Juan", "apellidos": "Pérez"}],
    }
    assert client.post("/api/agent/chat", json=payload, headers=CABECERA).status_code == 422


def test_endpoint_rechaza_codigo_de_estudiante_mal_formado():
    payload = {"mensaje": "Diagnóstico", "cursoId": 1, "parcialId": 10, "estudianteCodigo": "Juan Pérez"}
    assert client.post("/api/agent/chat", json=payload, headers=CABECERA).status_code == 422


def test_endpoint_usa_el_jwt_del_docente_y_registra_la_traza(backend_en_endpoint):
    respuesta = client.post(
        "/api/agent/chat",
        json={"mensaje": "¿Quiénes están en riesgo?", "cursoId": 1, "parcialId": 10},
        headers=CABECERA,
    )
    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert backend_en_endpoint.tokens == ["token-docente"]
    assert cuerpo["esFallback"] is True
    assert cuerpo["trazaId"] == 1
    # Mínimo tres herramientas reales invocadas contra la API académica (sección 7).
    assert len(cuerpo["toolsEjecutadas"]) >= 3
    assert backend_en_endpoint.llamadas.count("datos:1:10") >= 3

    traza = backend_en_endpoint.trazas[0]
    assert traza["exitoso"] is True and traza["consulta"] == "¿Quiénes están en riesgo?"
    assert [p["herramienta"] for p in traza["pasos"]] == cuerpo["toolsEjecutadas"]
    assert json.loads(traza["pasos"][0]["parametros"]) == {"cursoId": 1, "parcialId": 10}
    assert all(p["exito"] for p in traza["pasos"])


def test_endpoint_si_la_api_falla_devuelve_error_explicito_sin_inventar(backend_en_endpoint):
    backend_en_endpoint.fallo = BackendError("No se pudo conectar con la API académica.", 503)
    respuesta = client.post(
        "/api/agent/chat", json={"mensaje": "Resumen", "cursoId": 1, "parcialId": 10}, headers=CABECERA
    )
    assert respuesta.status_code == 502
    assert respuesta.json()["detail"] == "No se pudo conectar con la API académica."
    traza = backend_en_endpoint.trazas[-1]
    assert traza["exitoso"] is False
    assert traza["pasos"][0]["exito"] is False and traza["pasos"][0]["error"]


def test_endpoint_propaga_permiso_denegado(backend_en_endpoint):
    backend_en_endpoint.fallo = BackendError("Sin permiso.", 403)
    respuesta = client.post(
        "/api/agent/chat", json={"mensaje": "Resumen", "cursoId": 99, "parcialId": 10}, headers=CABECERA
    )
    assert respuesta.status_code == 403


# -- Function calling ------------------------------------------------------------------------------

def test_el_modelo_decide_las_herramientas_y_recibe_sus_resultados():
    service, fake = _servicio_con_modelo(
        respuesta_llamadas(("listar_estudiantes_en_riesgo", {})),
        respuesta_texto("Hechos verificados:\n• EST-001: 5.40\nSUGERENCIAS: ¿Qué tema reforzar? | Plan grupal"),
    )
    backend = BackendFalso()
    resp = service.procesar_chat(_solicitud(), backend)

    assert resp.esFallback is False
    assert resp.toolsEjecutadas == ["listar_estudiantes_en_riesgo"]
    assert resp.sugerenciasSeguimiento == ["¿Qué tema reforzar?", "Plan grupal"]
    assert backend.llamadas == ["datos:1:10"]

    primera, segunda = fake.models.generate_content.call_args_list
    cfg = primera.kwargs["config"]
    assert [d.name for d in cfg.tools[0].function_declarations] == [
        "consultar_resumen_curso",
        "listar_estudiantes_en_riesgo",
        "analizar_temas_y_actividades",
        "diagnosticar_estudiante",
    ]
    assert cfg.tool_config.function_calling_config.mode == "ANY"
    assert cfg.automatic_function_calling.disable is True
    devuelto = segunda.kwargs["contents"][-1].parts[0].function_response
    assert devuelto.name == "listar_estudiantes_en_riesgo"
    assert devuelto.response["resultado"]["totalEnRiesgo"] == 2
    assert backend.trazas[0]["modelo"] == resp.modelo


def test_codigo_inexistente_se_informa_al_modelo_y_queda_en_la_traza():
    service, fake = _servicio_con_modelo(
        respuesta_llamadas(("diagnosticar_estudiante", {"codigo": "EST-999"})),
        respuesta_texto("No dispongo de ese dato para EST-999."),
    )
    backend = BackendFalso()
    resp = service.procesar_chat(_solicitud(mensaje="¿Cómo va EST-999?"), backend)

    assert resp.respuesta.startswith("No dispongo")
    devuelto = fake.models.generate_content.call_args_list[1].kwargs["contents"][-1].parts[0].function_response
    assert "error" in devuelto.response["resultado"]
    paso = backend.trazas[0]["pasos"][0]
    assert paso["herramienta"] == "diagnosticar_estudiante" and paso["exito"] is False


def test_si_el_modelo_falla_se_usa_el_motor_local_con_datos_reales():
    service, _ = _servicio_con_modelo(*[RuntimeError("503 UNAVAILABLE")] * 10)
    backend = BackendFalso()
    resp = service.procesar_chat(_solicitud(), backend)

    assert resp.esFallback is True and resp.modelo is None
    assert "EST-001: 5.40 pts" in resp.respuesta
    assert len(resp.toolsEjecutadas) >= 3


def test_modelos_estandar_desactivan_thinking_y_lite_lo_omiten(monkeypatch):
    for modelo, esperado in (("gemini-3.5-flash", 0), ("gemini-3.5-flash-lite", None)):
        monkeypatch.setattr("app.services.chat_service.settings.GEMINI_MODEL", modelo)
        service, fake = _servicio_con_modelo(respuesta_texto("Respuesta."))
        service.procesar_chat(_solicitud(), BackendFalso())
        cfg = fake.models.generate_content.call_args.kwargs["config"]
        assert cfg.max_output_tokens >= 2048
        presupuesto = cfg.thinking_config.thinking_budget if cfg.thinking_config else None
        assert presupuesto == esperado


# -- Motor local -----------------------------------------------------------------------------------

def test_motor_local_modo_estudiante_usa_el_diagnostico_del_backend():
    backend = BackendFalso()
    resp = _servicio_local().procesar_chat(
        _solicitud(modo="estudiante", mensaje="Diagnóstico", estudianteCodigo="EST-001"), backend
    )
    assert resp.toolsEjecutadas == ["diagnosticar_estudiante"]
    assert backend.llamadas == ["estudiante:EST-001"]
    assert "EST-001" in resp.respuesta and "APE 1" in resp.respuesta


def test_motor_local_detecta_un_codigo_mencionado_en_modo_curso():
    backend = BackendFalso()
    resp = _servicio_local().procesar_chat(_solicitud(mensaje="¿Qué le pasa a EST-003?"), backend)
    assert "diagnosticar_estudiante" in resp.toolsEjecutadas
    assert "estudiante:EST-003" in backend.llamadas


# -- Cliente HTTP ----------------------------------------------------------------------------------

def test_cliente_envia_bearer_y_clasifica_errores():
    vistas = []

    def manejador(request: httpx.Request) -> httpx.Response:
        vistas.append(request)
        if request.url.path.endswith("/EST-404"):
            return httpx.Response(404, json={"title": "No hay un estudiante con ese código."})
        if request.url.path.endswith("/trazas"):
            return httpx.Response(201, json={"id": 7})
        if "/materias/2/" in request.url.path:
            return httpx.Response(403)
        return httpx.Response(200, json={"contexto": CONTEXTO, "estudiantes": []})

    backend = BackendAcademico("abc", base_url="http://api", transport=httpx.MockTransport(manejador))
    assert backend.datos_curso(1, 10)["contexto"]["codigo"] == "SOF-401"
    assert vistas[0].headers["Authorization"] == "Bearer abc"
    assert vistas[0].url.path == "/api/academico/agente/materias/1/parciales/10/estudiantes"

    with pytest.raises(BackendError) as no_encontrado:
        backend.estudiante(1, 10, "EST-404")
    assert no_encontrado.value.recuperable and no_encontrado.value.status == 404

    with pytest.raises(BackendError) as prohibido:
        backend.datos_curso(2, 10)
    assert not prohibido.value.recuperable and prohibido.value.status == 403

    assert backend.registrar_traza({"modo": "curso"}) == 7


def test_cliente_sin_conexion_no_es_recuperable():
    def caido(request):
        raise httpx.ConnectError("sin red", request=request)

    backend = BackendAcademico("abc", base_url="http://api", transport=httpx.MockTransport(caido))
    with pytest.raises(BackendError) as error:
        backend.datos_curso(1, 10)
    assert error.value.status == 503 and not error.value.recuperable
