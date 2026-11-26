"""Herramientas del agente pedagógico (sección 7 de la especificación).

El modelo decide cuáles invocar mediante function calling. Cada herramienta consulta la API académica
con el JWT del docente y aplica los cálculos deterministas de `ChatTools`, de modo que las cifras nunca
las inventa el modelo. Cada invocación queda registrada como un paso de la traza (RF-12).
"""
import json
import re
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Tuple

from google.genai import types

from app.schemas import ContextoCursoChat, EstudianteChatDto
from app.services.backend_client import BackendAcademico, BackendError
from app.services.chat_tools import ChatTools

PATRON_CODIGO = re.compile(r"^EST-\d{1,9}$", re.IGNORECASE)
MAX_TEXTO_TRAZA = 1000


@dataclass
class PasoTraza:
    herramienta: str
    parametros: Dict[str, Any]
    exito: bool
    duracion_ms: int
    resultado: Optional[str] = None
    error: Optional[str] = None

    def como_dict(self) -> Dict[str, Any]:
        return {
            "herramienta": self.herramienta,
            "parametros": json.dumps(self.parametros, ensure_ascii=False)[:MAX_TEXTO_TRAZA],
            "resultado": (self.resultado or "")[:MAX_TEXTO_TRAZA] or None,
            "exito": self.exito,
            "error": (self.error or "")[:500] or None,
            "duracionMs": self.duracion_ms,
        }


DECLARACIONES = [
    types.FunctionDeclaration(
        name="consultar_resumen_curso",
        description=(
            "Obtiene de la API académica el resumen del curso y parcial actuales: número de estudiantes "
            "evaluados, promedio general, aprobados, en riesgo, distribución por rangos, promedio por "
            "componente (Tareas, APE, Examen), estudiantes sin evaluaciones y fecha de la última "
            "sincronización con Moodle."
        ),
    ),
    types.FunctionDeclaration(
        name="listar_estudiantes_en_riesgo",
        description=(
            "Obtiene de la API académica los estudiantes con nota menor a 7.00 en el parcial actual, "
            "ordenados de menor a mayor nota, con sus códigos anónimos, componentes y temas deficientes."
        ),
    ),
    types.FunctionDeclaration(
        name="analizar_temas_y_actividades",
        description=(
            "Obtiene de la API académica el rendimiento por tema curricular y actividad del parcial "
            "actual, para identificar en qué temas se concentra la dificultad del grupo."
        ),
    ),
    types.FunctionDeclaration(
        name="diagnosticar_estudiante",
        description=(
            "Obtiene de la API académica el detalle de un estudiante (por su código anónimo EST-###): "
            "nota, componentes, actividades deficientes y rendimiento por tema, con un nivel de atención "
            "orientativo."
        ),
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "codigo": types.Schema(type=types.Type.STRING, description="Código anónimo, por ejemplo EST-001"),
            },
            required=["codigo"],
        ),
    ),
]
NOMBRES_HERRAMIENTAS = [d.name for d in DECLARACIONES]


class HerramientasAgente:
    """Ejecuta las herramientas para un curso y parcial fijados por el sistema (no por el modelo)."""

    def __init__(self, backend: BackendAcademico, curso_id: int, parcial_id: int) -> None:
        self.backend = backend
        self.curso_id = curso_id
        self.parcial_id = parcial_id
        self.pasos: List[PasoTraza] = []
        self._cache: Dict[Tuple[str, str], Dict[str, Any]] = {}
        self._registro: Dict[str, Callable[[Dict[str, Any]], Dict[str, Any]]] = {
            "consultar_resumen_curso": self._resumen_curso,
            "listar_estudiantes_en_riesgo": self._en_riesgo,
            "analizar_temas_y_actividades": self._temas,
            "diagnosticar_estudiante": self._diagnostico,
        }

    @property
    def ejecutadas(self) -> List[str]:
        vistos: List[str] = []
        for paso in self.pasos:
            if paso.herramienta not in vistos:
                vistos.append(paso.herramienta)
        return vistos

    def ejecutar(self, nombre: str, argumentos: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Ejecuta una herramienta y registra el paso. Lanza BackendError si el fallo no es recuperable."""
        argumentos = dict(argumentos or {})
        clave = (nombre, json.dumps(argumentos, sort_keys=True))
        if clave in self._cache:
            return self._cache[clave]

        parametros = {"cursoId": self.curso_id, "parcialId": self.parcial_id, **argumentos}
        inicio = time.perf_counter()
        funcion = self._registro.get(nombre)
        try:
            if funcion is None:
                raise BackendError(f"Herramienta desconocida: {nombre}.", 400, recuperable=True)
            resultado = funcion(argumentos)
        except BackendError as exc:
            self.pasos.append(PasoTraza(nombre, parametros, False, _ms(inicio), error=exc.mensaje))
            if not exc.recuperable:
                raise
            resultado = {"error": exc.mensaje}
            self._cache[clave] = resultado
            return resultado

        self.pasos.append(
            PasoTraza(nombre, parametros, True, _ms(inicio), resultado=json.dumps(resultado, ensure_ascii=False, default=str))
        )
        self._cache[clave] = resultado
        return resultado

    # -- Herramientas -------------------------------------------------------------------------

    def _datos(self) -> Tuple[ContextoCursoChat, List[EstudianteChatDto], Dict[str, Any]]:
        datos = self.backend.datos_curso(self.curso_id, self.parcial_id)
        contexto_json = datos.get("contexto") or {}
        contexto = ContextoCursoChat(**contexto_json)
        estudiantes = [EstudianteChatDto(**e) for e in datos.get("estudiantes") or []]
        return contexto, estudiantes, contexto_json

    def _resumen_curso(self, _: Dict[str, Any]) -> Dict[str, Any]:
        contexto, estudiantes, crudo = self._datos()
        return {
            "resumen": ChatTools.tool_resumen_curso(contexto, estudiantes),
            "componentes": ChatTools.tool_analisis_componentes(contexto, estudiantes),
            "estudiantesSinEvaluaciones": crudo.get("sinEvaluaciones", 0),
            "parcial": crudo.get("parcialNumero"),
            "ultimaSincronizacionUtc": crudo.get("ultimaSincronizacionUtc"),
        }

    def _en_riesgo(self, _: Dict[str, Any]) -> Dict[str, Any]:
        _, estudiantes, _ = self._datos()
        return ChatTools.tool_estudiantes_en_riesgo(estudiantes)

    def _temas(self, _: Dict[str, Any]) -> Dict[str, Any]:
        _, estudiantes, _ = self._datos()
        return ChatTools.tool_analisis_temas(estudiantes)

    def _diagnostico(self, argumentos: Dict[str, Any]) -> Dict[str, Any]:
        codigo = str(argumentos.get("codigo", "")).strip().upper()
        if not PATRON_CODIGO.match(codigo):
            raise BackendError("Código de estudiante inválido; use el formato EST-001.", 400, recuperable=True)
        estudiante = EstudianteChatDto(**self.backend.estudiante(self.curso_id, self.parcial_id, codigo))
        return ChatTools.tool_diagnostico_estudiante(estudiante)


def _ms(inicio: float) -> int:
    return int((time.perf_counter() - inicio) * 1000)
