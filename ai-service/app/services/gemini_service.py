import json
import logging
from google import genai
from google.genai import types
from app.config import settings
from app.prompts import SYSTEM_PROMPT_PLAN
from app.schemas import RespuestaPlan, SolicitudPlan
from app.services.fallback_service import FallbackService

logger = logging.getLogger(__name__)


class GeminiService:
    """Cliente de inferencia pedagógica con Google Gemini y fallback determinista."""

    def __init__(self) -> None:
        self.api_key = settings.GEMINI_API_KEY.strip()
        self.client = None
        if self.api_key:
            try:
                # Google GenAI exige un deadline mínimo de 10 segundos (10000 ms); tope de 14s para evitar esperas largas
                timeout_ms = min(max(int(settings.GEMINI_TIMEOUT_SECONDS * 1000), 10000), 14000)
                self.client = genai.Client(
                    api_key=self.api_key,
                    http_options=types.HttpOptions(timeout=timeout_ms),
                )
            except Exception as exc:
                logger.error(f"Error inicializando cliente de Gemini: {exc}")

    def generar_plan(self, solicitud: SolicitudPlan) -> RespuestaPlan:
        if not self.client or not self.api_key:
            logger.warning("Gemini API Key no configurada. Activando motor Fallback.")
            return FallbackService.generar_plan_contingencia(solicitud)

        system_instruction = SYSTEM_PROMPT_PLAN

        ids_esperados = [t.id for t in solicitud.temasCriticos]
        prompt = f"""
Genera un plan de refuerzo pedagógico basado en esta información académica:
- Asignatura: {solicitud.materia} ({solicitud.codigo})
- Parcial: {solicitud.parcial}
- Promedio Ponderado Actual: {solicitud.promedioPonderado:.2f} / 10.00
- Componentes Deficientes: {[c.model_dump() for c in solicitud.componentesDeficientes]}
- Temas Críticos a Reforzar: {[t.model_dump() for t in solicitud.temasCriticos]}

Reglas obligatorias:
1. 'nivelRiesgo' debe ser exactamente: 'Crítico', 'Alto', 'Medio' o 'Bajo'.
2. 'esFallback' debe ser false.
3. En 'detalles', debes generar exactamente un elemento por cada temaId en {ids_esperados}, usando exactamente esos mismos valores numéricos de 'temaId'.
4. 'prioridad' debe ser 'Alta', 'Media' o 'Baja'.
5. 'tiempoEstimadoHoras' debe ser un entero entre 2 y 6.
"""

        modelos_a_probar = [settings.GEMINI_MODEL]
        for respaldo in ("gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"):
            if respaldo not in modelos_a_probar:
                modelos_a_probar.append(respaldo)

        for modelo in modelos_a_probar:
            try:
                config_kwargs = {
                    "system_instruction": system_instruction,
                    "response_mime_type": "application/json",
                    "response_schema": RespuestaPlan,
                    "temperature": 0.2,
                }
                if "lite" not in modelo.lower():
                    config_kwargs["thinking_config"] = types.ThinkingConfig(thinking_budget=0)

                response = self.client.models.generate_content(
                    model=modelo,
                    contents=prompt,
                    config=types.GenerateContentConfig(**config_kwargs),
                )

                contenido = (response.text or "").strip()
                data_dict = json.loads(contenido)
                plan = RespuestaPlan(**data_dict)
                plan.esFallback = False

                # Garantiza integridad referencial con AcademicoDB (evita 400 en POST /api/academico/planes)
                ids_recibidos = {d.temaId for d in plan.detalles}
                if ids_recibidos != set(ids_esperados):
                    raise ValueError(
                        f"Los temaId devueltos por Gemini ({ids_recibidos}) no coinciden con los solicitados ({set(ids_esperados)})."
                    )

                return plan

            except Exception as exc:
                logger.warning(f"Error temporal o indisponibilidad en Gemini ({modelo}): {exc}. Intentando modelo alterno...")

        logger.error("Todos los modelos de Gemini fallaron o no estuvieron disponibles. Ejecutando fallback determinista.")
        return FallbackService.generar_plan_contingencia(solicitud)
