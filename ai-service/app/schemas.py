from typing import Dict, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field
from app.prompts import AVISO_ETICO_RNF08


# ---------------------------------------------------------------------------
# Schemas para Generación de Planes de Refuerzo (HU-04B)
# ---------------------------------------------------------------------------

class ComponenteDeficiente(BaseModel):
    componente: str = Field(..., min_length=1, description="Nombre del componente, ej. Tareas, APE, Examen")
    promedio: float = Field(..., ge=0.0, le=10.0, description="Calificación obtenida sobre 10")
    ponderacion: float = Field(..., ge=0.0, le=1.0, description="Ponderación sobre el total, ej. 0.30")


class TemaCritico(BaseModel):
    id: int = Field(..., ge=1, description="Identificador del tema en AcademicoDB")
    nombre: str = Field(..., min_length=1, description="Título del tema a reforzar")
    unidad: str = Field(..., min_length=1, description="Código o nombre de unidad académica, ej. U2")


class SolicitudPlan(BaseModel):
    materia: str = Field(..., min_length=1)
    codigo: str = Field(..., min_length=1)
    parcial: int = Field(..., ge=1, le=2)
    promedioPonderado: float = Field(..., ge=0.0, le=10.0)
    componentesDeficientes: List[ComponenteDeficiente] = Field(default_factory=list)
    temasCriticos: List[TemaCritico] = Field(..., min_length=1)

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
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
        }
    )


class DetallePlan(BaseModel):
    temaId: int = Field(..., ge=1)
    actividadSugerida: str = Field(..., min_length=1, max_length=1000)
    prioridad: Literal["Alta", "Media", "Baja"]
    tiempoEstimadoHoras: int = Field(..., ge=1, le=40)
    recursoRecomendado: str = Field(..., max_length=500)


class RespuestaPlan(BaseModel):
    nivelRiesgo: Literal["Crítico", "Alto", "Medio", "Bajo"]
    diagnosticoGeneral: str = Field(..., min_length=1, max_length=2000)
    esFallback: bool = False
    detalles: List[DetallePlan] = Field(..., min_length=1)


# ---------------------------------------------------------------------------
# Schemas para Asistente Conversacional y Chat IA (HU-07 / T-13.4 / T-13.5)
# ---------------------------------------------------------------------------

class MensajeChat(BaseModel):
    rol: Literal["user", "assistant", "system"]
    contenido: str


class ContextoCursoChat(BaseModel):
    materia: str = Field(..., min_length=1)
    codigo: str = Field(..., min_length=1)
    semestre: Optional[str] = "Cuarto B"
    promedioGeneral: float = Field(0.0, ge=0.0, le=10.0)
    totalEstudiantes: int = Field(0, ge=0)
    estudiantesEnRiesgo: int = Field(0, ge=0)
    aprobados: int = Field(0, ge=0)
    componentesPromedios: Optional[Dict[str, float]] = None


class EstudianteChatDto(BaseModel):
    model_config = ConfigDict(extra="forbid")

    codigo: str = Field(..., min_length=1, description="Código anónimo del estudiante, ej. EST-001")
    notaFinal: float = Field(..., ge=0.0, le=10.0)
    enRiesgo: bool = False
    componentes: Optional[Dict[str, float]] = None
    temasDeficientes: List[str] = Field(default_factory=list)


class SolicitudChat(BaseModel):
    modo: Literal["curso", "estudiante"] = Field("curso", description="Contexto del chat: curso general o estudiante particular")
    mensaje: str = Field(..., min_length=1, description="Pregunta formulada por el docente")
    historial: List[MensajeChat] = Field(default_factory=list, description="Historial de mensajes previos para diálogo continuo")
    contextoCurso: Optional[ContextoCursoChat] = None
    estudianteSeleccionado: Optional[EstudianteChatDto] = None
    estudiantesCurso: List[EstudianteChatDto] = Field(default_factory=list)

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "modo": "curso",
                "mensaje": "¿Cuáles estudiantes tienen promedio menor a 7.00?",
                "historial": [],
                "contextoCurso": {
                    "materia": "Metodologias Agiles",
                    "codigo": "SOF-401",
                    "promedioGeneral": 7.42,
                    "totalEstudiantes": 12,
                    "estudiantesEnRiesgo": 3,
                    "aprobados": 9,
                },
                "estudiantesCurso": [
                    {
                        "codigo": "EST-001",
                        "notaFinal": 5.40,
                        "enRiesgo": True,
                        "temasDeficientes": ["Historias de Usuario"],
                    }
                ],
            }
        }
    )


class RespuestaChat(BaseModel):
    respuesta: str = Field(..., min_length=1, description="Respuesta analítica y pedagógica generada por el asistente")
    advertenciaEtica: str = Field(
        default=AVISO_ETICO_RNF08,
        description="Aviso ético de incertidumbre pedagógica conforme a RNF-08",
    )
    modo: Literal["curso", "estudiante"]
    esFallback: bool = False
    toolsEjecutadas: List[str] = Field(default_factory=list)
    tiempoRespuestaMs: int = Field(0, ge=0)
