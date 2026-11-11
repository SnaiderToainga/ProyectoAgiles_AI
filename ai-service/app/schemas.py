from typing import List, Literal
from pydantic import BaseModel, ConfigDict, Field


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
