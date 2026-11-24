from types import SimpleNamespace
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from app.main import app
from app.schemas import (
    ContextoCursoChat,
    EstudianteChatDto,
    MensajeChat,
    SolicitudChat,
)
from app.services.chat_service import ChatService
from app.services.chat_tools import ChatTools

client = TestClient(app)

ESTUDIANTES_PRUEBA = [
    EstudianteChatDto(
        codigo="EST-001",
        notaFinal=5.40,
        enRiesgo=True,
        componentes={"Tareas": 6.0, "APE": 4.5, "Examen": 5.75},
        temasDeficientes=["Historias de Usuario e INVEST"],
    ),
    EstudianteChatDto(
        codigo="EST-002",
        notaFinal=8.90,
        enRiesgo=False,
        componentes={"Tareas": 9.0, "APE": 8.5, "Examen": 9.2},
        temasDeficientes=[],
    ),
    EstudianteChatDto(
        codigo="EST-003",
        notaFinal=6.80,
        enRiesgo=True,
        componentes={"Tareas": 7.0, "APE": 6.5, "Examen": 7.0},
        temasDeficientes=["Diagramas de Secuencia"],
    ),
    EstudianteChatDto(
        codigo="EST-004",
        notaFinal=7.50,
        enRiesgo=False,
        componentes={"Tareas": 8.0, "APE": 7.0, "Examen": 7.5},
        temasDeficientes=[],
    ),
]

CONTEXTO_PRUEBA = ContextoCursoChat(
    materia="Metodologias Agiles",
    codigo="SOF-401",
    semestre="Cuarto B",
    promedioGeneral=7.15,
    totalEstudiantes=4,
    estudiantesEnRiesgo=2,
    aprobados=2,
    componentesPromedios={"Tareas": 7.50, "APE": 6.62, "Examen": 7.36},
)


def test_tool_resumen_curso():
    resumen = ChatTools.tool_resumen_curso(CONTEXTO_PRUEBA, ESTUDIANTES_PRUEBA)
    assert resumen["totalEstudiantes"] == 4
    assert resumen["estudiantesEnRiesgo"] == 2
    assert resumen["aprobados"] == 2
    assert resumen["tasaAprobacionPct"] == 50.0

    rangos = resumen["distribucionRangos"]
    assert rangos["critico"]["cantidad"] == 0
    assert rangos["enRiesgo"]["cantidad"] == 2
    assert rangos["regular"]["cantidad"] == 1
    assert rangos["sobresaliente"]["cantidad"] == 1


def test_tool_estudiantes_en_riesgo():
    resultado = ChatTools.tool_estudiantes_en_riesgo(ESTUDIANTES_PRUEBA, umbral=7.0)
    assert resultado["totalEnRiesgo"] == 2
    # Debe ordenar de menor a mayor: primero 5.40 y luego 6.80
    assert resultado["estudiantes"][0]["notaFinal"] == 5.40
    assert resultado["estudiantes"][0]["codigo"] == "EST-001"
    assert resultado["estudiantes"][1]["notaFinal"] == 6.80
    assert resultado["estudiantes"][1]["codigo"] == "EST-003"


def test_tool_diagnostico_estudiante():
    diag = ChatTools.tool_diagnostico_estudiante(ESTUDIANTES_PRUEBA[0])
    assert diag["codigo"] == "EST-001"
    assert diag["nivelRiesgo"] == "Alto"
    assert diag["horasTutoriaSugeridas"] == 4
    assert "Historias de Usuario e INVEST" in diag["temasDeficientes"]


def test_endpoint_chat_modo_curso():
    payload = {
        "modo": "curso",
        "mensaje": "¿Cuáles son los estudiantes que tienen promedio menor a 7.00?",
        "historial": [],
        "contextoCurso": CONTEXTO_PRUEBA.model_dump(),
        "estudiantesCurso": [e.model_dump() for e in ESTUDIANTES_PRUEBA],
    }

    response = client.post("/api/agent/chat", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert "respuesta" in data and len(data["respuesta"]) > 0
    assert "advertenciaEtica" in data
    assert "RNF-08" in data["advertenciaEtica"]
    assert data["modo"] == "curso"
    assert isinstance(data["toolsEjecutadas"], list)


def test_endpoint_chat_modo_estudiante():
    payload = {
        "modo": "estudiante",
        "mensaje": "¿Qué plan de refuerzo recomiendas para este alumno?",
        "historial": [],
        "contextoCurso": CONTEXTO_PRUEBA.model_dump(),
        "estudianteSeleccionado": ESTUDIANTES_PRUEBA[0].model_dump(),
        "estudiantesCurso": [e.model_dump() for e in ESTUDIANTES_PRUEBA],
    }

    response = client.post("/api/agent/chat", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert data["modo"] == "estudiante"
    # Debe responder con el código del alumno y su calificación real (sin nombres personales)
    assert "EST-001" in data["respuesta"]
    assert "5.40" in data["respuesta"]


def test_gemini_chat_con_mock():
    service = ChatService()
    service.api_key = "fake-key"
    fake_client = MagicMock()
    fake_client.models.generate_content.return_value = SimpleNamespace(
        text="Resumen pedagógico oficial: 2 estudiantes requieren tutoría prioritaria."
    )
    service.client = fake_client

    solicitud = SolicitudChat(
        modo="curso",
        mensaje="Dame un resumen general",
        contextoCurso=CONTEXTO_PRUEBA,
        estudiantesCurso=ESTUDIANTES_PRUEBA,
    )

    respuesta = service.procesar_chat(solicitud)
    assert respuesta.esFallback is False
    assert "2 estudiantes" in respuesta.respuesta
    assert "RNF-08" in respuesta.advertenciaEtica


# ---------------------------------------------------------------------------
# Pruebas Nuevas Exigidas por el DoD / Code Review de Privacidad y Calidad
# ---------------------------------------------------------------------------

def test_sin_componentes_no_inventa_notas():
    """Verifica que sin componentes reales no devuelva valores quemados (como 5.80 en APE)."""
    estudiantes_sin_comp = [
        EstudianteChatDto(codigo="EST-010", notaFinal=6.0, enRiesgo=True, componentes={}),
    ]
    res = ChatTools.tool_analisis_componentes(None, estudiantes_sin_comp)
    assert res["disponible"] is False
    assert res["componentes"] == {}
    assert res["componenteCritico"] is None
    assert res["promedioComponenteCritico"] is None
    assert "No hay notas" in res["motivo"]

    # En el servicio determinista / fallback, no debe contener '5.80' ni 'APE' inventado
    service = ChatService()
    service.client = None
    service.api_key = ""
    solicitud = SolicitudChat(
        modo="curso",
        mensaje="¿Cuál es el componente más bajo?",
        estudiantesCurso=estudiantes_sin_comp,
    )
    resp = service.procesar_chat(solicitud)
    assert "5.80" not in resp.respuesta
    assert "no hay notas por componente" in resp.respuesta.lower()


def test_con_componentes_reales_detecta_mas_bajo():
    """Verifica que con componentes reales detecte el componente con promedio más bajo."""
    estudiantes = [
        EstudianteChatDto(
            codigo="EST-001",
            notaFinal=6.5,
            componentes={"Tareas": 8.0, "APE": 5.0, "Examen": 7.0},
        ),
        EstudianteChatDto(
            codigo="EST-002",
            notaFinal=7.5,
            componentes={"Tareas": 8.5, "APE": 5.5, "Examen": 8.0},
        ),
    ]
    res = ChatTools.tool_analisis_componentes(None, estudiantes)
    assert res["disponible"] is True
    assert res["componenteCritico"] == "APE"
    assert res["promedioComponenteCritico"] == 5.25


def test_componente_sin_notas_no_cuenta_como_cero():
    """Un estudiante sin componentes o componente sin notas no penaliza a 0."""
    estudiantes = [
        EstudianteChatDto(
            codigo="EST-001",
            notaFinal=8.0,
            componentes={"Tareas": 8.0, "APE": 7.0},
        ),
        EstudianteChatDto(
            codigo="EST-002",
            notaFinal=8.0,
            componentes=None,
        ),
    ]
    res = ChatTools.tool_analisis_componentes(None, estudiantes)
    assert res["disponible"] is True
    assert res["componentes"]["Tareas"] == 8.0
    assert res["componentes"]["APE"] == 7.0


def test_gemini_mock_no_contiene_datos_personales():
    """Valida que el prompt generado para Gemini no contenga nombres, apellidos ni emails."""
    service = ChatService()
    service.api_key = "fake-key"
    fake_client = MagicMock()
    fake_client.models.generate_content.return_value = SimpleNamespace(
        text="Respuesta válida del modelo."
    )
    service.client = fake_client

    solicitud = SolicitudChat(
        modo="curso",
        mensaje="¿Qué estudiantes necesitan refuerzo?",
        contextoCurso=CONTEXTO_PRUEBA,
        estudiantesCurso=ESTUDIANTES_PRUEBA,
    )

    service.procesar_chat(solicitud)
    assert fake_client.models.generate_content.called
    call_args = fake_client.models.generate_content.call_args
    prompt_enviado = call_args.kwargs.get("contents", "")

    # Verificar que NO viajen datos personales de los integrantes
    for nombre_prohibido in ["Carrasco", "Chiluisa", "Sivinta", "Toainga", "carlos.docente", "@uta.edu.ec"]:
        assert nombre_prohibido not in prompt_enviado

    # Verificar que viaje el código anónimo
    assert "EST-001" in prompt_enviado


def test_peticion_con_nombres_devuelve_422():
    """Garantiza el cumplimiento de RNF-02 mediante Pydantic extra='forbid': rechaza nombres/apellidos."""
    payload_invalido = {
        "modo": "curso",
        "mensaje": "Consulta general",
        "estudiantesCurso": [
            {
                "codigo": "EST-001",
                "nombres": "Cesar",
                "apellidos": "Carrasco",
                "notaFinal": 5.4,
            }
        ],
    }

    response = client.post("/api/agent/chat", json=payload_invalido)
    assert response.status_code == 422
    # El error de validación debe indicar que los campos adicionales están prohibidos
    errores = response.json()["detail"]
    assert any("extra_forbidden" in str(err) for err in errores)


def test_anonimizacion_texto_libre_e_historial_sin_fugas():
    """
    RNF-02: Valida que ninguna variante de nombres ('Cesar', 'Carrasco', 'Cesar Steven Carrasco Manotoa')
    aparezca en el mensaje ni en el historial enviado a Gemini.
    """
    service = ChatService()
    service.api_key = "fake-key"
    fake_client = MagicMock()
    fake_client.models.generate_content.return_value = SimpleNamespace(
        text="Diagnóstico orientado para los alumnos en consulta."
    )
    service.client = fake_client

    # Simulación de mensaje e historial enviados por el frontend tras anonimización
    # "¿Cómo va Cesar? ¿Y Carrasco? ¿Qué tal Cesar Steven Carrasco Manotoa?" -> "¿Cómo va EST-001? ¿Y EST-001? ¿Qué tal EST-001?"
    solicitud = SolicitudChat(
        modo="curso",
        mensaje="¿Cómo va EST-001? ¿Y EST-001? ¿Qué tal EST-001?",
        historial=[
            MensajeChat(rol="user", contenido="¿Qué componentes debe recuperar EST-001?"),
            MensajeChat(rol="assistant", contenido="EST-001 debe reforzar el componente APE."),
        ],
        contextoCurso=CONTEXTO_PRUEBA,
        estudiantesCurso=ESTUDIANTES_PRUEBA,
    )

    service.procesar_chat(solicitud)
    assert fake_client.models.generate_content.called
    call_args = fake_client.models.generate_content.call_args
    prompt_enviado = call_args.kwargs.get("contents", "")

    # Afirmar categóricamente que ni 'Cesar', ni 'Carrasco', ni la combinación completa figuren en el prompt
    for fuga in ["Cesar", "Carrasco", "Cesar Steven Carrasco Manotoa", "Steven", "Manotoa"]:
        assert fuga not in prompt_enviado

    assert "EST-001" in prompt_enviado
