from types import SimpleNamespace
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from app.main import app
from app.schemas import (
    ContextoCursoChat,
    EstudianteChatDto,
    SolicitudChat,
)
from app.services.chat_service import ChatService
from app.services.chat_tools import ChatTools

client = TestClient(app)

ESTUDIANTES_PRUEBA = [
    EstudianteChatDto(
        estudianteId=1,
        nombres="Cesar Steven",
        apellidos="Carrasco",
        notaFinal=5.40,
        enRiesgo=True,
        componentes={"Tareas": 6.0, "APE": 4.5, "Examen": 5.75},
        temasDeficientes=["Historias de Usuario e INVEST"],
    ),
    EstudianteChatDto(
        estudianteId=2,
        nombres="Estiven Sebastian",
        apellidos="Chiluisa",
        notaFinal=8.90,
        enRiesgo=False,
        componentes={"Tareas": 9.0, "APE": 8.5, "Examen": 9.2},
        temasDeficientes=[],
    ),
    EstudianteChatDto(
        estudianteId=3,
        nombres="Cristian Fernando",
        apellidos="Sivinta",
        notaFinal=6.80,
        enRiesgo=True,
        componentes={"Tareas": 7.0, "APE": 6.5, "Examen": 7.0},
        temasDeficientes=["Diagramas de Secuencia"],
    ),
    EstudianteChatDto(
        estudianteId=4,
        nombres="Snaider Alexander",
        apellidos="Toainga",
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
    assert resultado["estudiantes"][1]["notaFinal"] == 6.80


def test_tool_diagnostico_estudiante():
    diag = ChatTools.tool_diagnostico_estudiante(ESTUDIANTES_PRUEBA[0])
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
    assert "Carrasco" in data["respuesta"] or "5.40" in data["respuesta"]


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
