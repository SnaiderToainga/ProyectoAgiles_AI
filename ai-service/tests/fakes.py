"""Dobles de prueba: una API académica en memoria y respuestas simuladas de Gemini."""
import copy
from types import SimpleNamespace
from typing import Any, Dict, List, Optional

from google.genai import types

from app.services.backend_client import BackendError

CONTEXTO = {
    "cursoId": 1,
    "parcialId": 10,
    "parcialNumero": 1,
    "materia": "Metodologias Agiles",
    "codigo": "SOF-401",
    "semestre": "2026-2",
    "promedioGeneral": 7.15,
    "totalEstudiantes": 4,
    "estudiantesEnRiesgo": 2,
    "aprobados": 2,
    "sinEvaluaciones": 1,
    "componentesPromedios": {"Tareas": 7.5, "APE": 6.62, "Examen": 7.36},
    "ultimaSincronizacionUtc": "2026-11-20T15:30:00Z",
}

ESTUDIANTES: List[Dict[str, Any]] = [
    {
        "codigo": "EST-001",
        "notaFinal": 5.40,
        "enRiesgo": True,
        "calculoProvisional": False,
        "componentes": {"Tareas": 6.0, "APE": 4.5, "Examen": 5.75},
        "temasDeficientes": ["Historias de Usuario e INVEST"],
        "evaluaciones": [
            {"nombre": "Tarea 2", "componente": "Tareas", "nota": 5.0, "estado": "Calificada", "temas": ["Historias de Usuario e INVEST"]},
            {"nombre": "APE 1", "componente": "APE", "nota": 0.0, "estado": "Sin entrega", "temas": ["Planning Poker"]},
        ],
    },
    {"codigo": "EST-002", "notaFinal": 8.90, "enRiesgo": False, "componentes": {"Tareas": 9.0}, "temasDeficientes": [], "evaluaciones": []},
    {"codigo": "EST-003", "notaFinal": 6.80, "enRiesgo": True, "componentes": {"Tareas": 7.0}, "temasDeficientes": ["Diagramas de Secuencia"], "evaluaciones": []},
    {"codigo": "EST-004", "notaFinal": 7.50, "enRiesgo": False, "componentes": {"Tareas": 8.0}, "temasDeficientes": [], "evaluaciones": []},
]


class BackendFalso:
    """Imita BackendAcademico registrando cada llamada, sin red."""

    def __init__(self, estudiantes: Optional[List[Dict[str, Any]]] = None, fallo: Optional[BackendError] = None) -> None:
        self.estudiantes = copy.deepcopy(ESTUDIANTES if estudiantes is None else estudiantes)
        self.fallo = fallo
        self.llamadas: List[str] = []
        self.trazas: List[Dict[str, Any]] = []

    def datos_curso(self, curso_id: int, parcial_id: int) -> Dict[str, Any]:
        self.llamadas.append(f"datos:{curso_id}:{parcial_id}")
        if self.fallo:
            raise self.fallo
        contexto = dict(CONTEXTO, totalEstudiantes=len(self.estudiantes))
        return {"contexto": contexto, "estudiantes": copy.deepcopy(self.estudiantes)}

    def estudiante(self, curso_id: int, parcial_id: int, codigo: str) -> Dict[str, Any]:
        self.llamadas.append(f"estudiante:{codigo}")
        if self.fallo:
            raise self.fallo
        for e in self.estudiantes:
            if e["codigo"] == codigo:
                return copy.deepcopy(e)
        raise BackendError("No hay un estudiante evaluado con ese código.", 404, recuperable=True)

    def alertas(self, curso_id: int, parcial_id: int) -> Dict[str, Any]:
        self.llamadas.append(f"alertas:{curso_id}:{parcial_id}")
        if self.fallo:
            raise self.fallo
        return {
            "reglas": {"atrasosActivo": True, "atrasosMinimo": 2},
            "progresoCurso": {"completadas": 10, "exigibles": 12, "porcentajeFinalizacion": 83.3},
            "estudiantesConAlertas": 1,
            "estudiantes": [
                {
                    "codigo": "EST-001",
                    "notaFinal": 5.40,
                    "alertas": [
                        {
                            "regla": "atrasos",
                            "titulo": "Actividades vencidas sin entrega",
                            "evidencia": "2 actividades vencieron sin entrega (umbral configurado: 2).",
                            "actividades": ["APE 1", "Tarea 3"],
                        }
                    ],
                }
            ],
        }

    def registrar_traza(self, traza: Dict[str, Any]) -> Optional[int]:
        self.trazas.append(traza)
        return len(self.trazas)

    def close(self) -> None:
        pass

    def __enter__(self) -> "BackendFalso":
        return self

    def __exit__(self, *_: Any) -> None:
        pass


def respuesta_texto(texto: str) -> SimpleNamespace:
    return SimpleNamespace(text=texto, function_calls=None, candidates=[])


def respuesta_llamadas(*llamadas: tuple) -> SimpleNamespace:
    """Respuesta del modelo que pide ejecutar herramientas: llamadas = (nombre, argumentos)."""
    function_calls = [SimpleNamespace(name=n, args=a) for n, a in llamadas]
    contenido = types.Content(
        role="model",
        parts=[types.Part(function_call=types.FunctionCall(name=n, args=a)) for n, a in llamadas],
    )
    return SimpleNamespace(text=None, function_calls=function_calls, candidates=[SimpleNamespace(content=contenido)])
