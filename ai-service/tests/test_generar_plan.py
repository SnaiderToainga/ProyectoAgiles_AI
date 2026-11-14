from types import SimpleNamespace
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from app.main import app
from app.schemas import SolicitudPlan
from app.services.fallback_service import FallbackService
from app.services.gemini_service import GeminiService

client = TestClient(app)

PAYLOAD_VALIDO = {
    "materia": "Metodologias Agiles",
    "codigo": "SOF-401",
    "parcial": 1,
    "promedioPonderado": 5.10,
    "componentesDeficientes": [
        {"componente": "Tareas", "promedio": 5.00, "ponderacion": 0.30},
        {"componente": "Examen", "promedio": 4.50, "ponderacion": 0.40},
    ],
    "temasCriticos": [
        {"id": 104, "nombre": "Historias de Usuario e INVEST", "unidad": "U2"},
        {"id": 105, "nombre": "Estimacion Agil y Planning Poker", "unidad": "U2"},
    ],
}


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "online"


def test_fallback_determinista_unitario():
    solicitud = SolicitudPlan(**PAYLOAD_VALIDO)
    plan = FallbackService.generar_plan_contingencia(solicitud)

    assert plan.esFallback is True
    assert plan.nivelRiesgo == "Alto"
    assert len(plan.detalles) == 2
    assert [d.temaId for d in plan.detalles] == [104, 105]


def test_endpoint_generar_plan_contrato_json():
    response = client.post("/api/agent/generar-plan", json=PAYLOAD_VALIDO)
    assert response.status_code == 200

    data = response.json()
    assert data["nivelRiesgo"] in ["Crítico", "Alto", "Medio", "Bajo"]
    assert isinstance(data["diagnosticoGeneral"], str) and len(data["diagnosticoGeneral"]) > 0
    assert isinstance(data["esFallback"], bool)
    assert [d["temaId"] for d in data["detalles"]] == [104, 105]


def test_validacion_pydantic_error_payload_incompleto():
    response = client.post("/api/agent/generar-plan", json={"materia": "Metodologias Agiles"})
    assert response.status_code == 422


def test_gemini_respuesta_valida_es_respetada():
    service = GeminiService()
    service.api_key = "fake-key"
    fake_client = MagicMock()
    fake_client.models.generate_content.return_value = SimpleNamespace(
        text="""{
            "nivelRiesgo": "Alto",
            "diagnosticoGeneral": "Brecha en formulacion de historias y estimacion.",
            "esFallback": false,
            "detalles": [
                {
                    "temaId": 104,
                    "actividadSugerida": "Taller practico de criterios Given-When-Then.",
                    "prioridad": "Alta",
                    "tiempoEstimadoHoras": 3,
                    "recursoRecomendado": "Guia Scrum UTA"
                },
                {
                    "temaId": 105,
                    "actividadSugerida": "Sesion de Planning Poker con Fibonacci.",
                    "prioridad": "Alta",
                    "tiempoEstimadoHoras": 2,
                    "recursoRecomendado": "Manual FISEI"
                }
            ]
        }"""
    )
    service.client = fake_client

    plan = service.generar_plan(SolicitudPlan(**PAYLOAD_VALIDO))
    assert plan.esFallback is False
    assert plan.nivelRiesgo == "Alto"
    assert [d.temaId for d in plan.detalles] == [104, 105]


def test_gemini_alucina_tema_id_activa_fallback():
    service = GeminiService()
    service.api_key = "fake-key"
    fake_client = MagicMock()
    fake_client.models.generate_content.return_value = SimpleNamespace(
        text="""{
            "nivelRiesgo": "Alto",
            "diagnosticoGeneral": "Diagnostico de prueba",
            "esFallback": false,
            "detalles": [{
                "temaId": 9999,
                "actividadSugerida": "Tema inventado",
                "prioridad": "Alta",
                "tiempoEstimadoHoras": 3,
                "recursoRecomendado": "Guia"
            }]
        }"""
    )
    service.client = fake_client

    plan = service.generar_plan(SolicitudPlan(**PAYLOAD_VALIDO))
    assert plan.esFallback is True
    assert [d.temaId for d in plan.detalles] == [104, 105]
