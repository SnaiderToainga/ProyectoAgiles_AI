import logging
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.schemas import RespuestaPlan, SolicitudPlan
from app.services.gemini_service import GeminiService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai-service")

app = FastAPI(
    title="SISRA - EduMonitor AI Service",
    description="Microservicio de diagnóstico y generación de planes de refuerzo asistidos por Gemini API",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

gemini_service = GeminiService()


@app.get("/health", status_code=status.HTTP_200_OK, tags=["Health"])
def health_check():
    """Verifica disponibilidad del microservicio y si existe API key configurada."""
    return {
        "status": "online",
        "service": "ai-service",
        "gemini_configured": bool(settings.GEMINI_API_KEY.strip()),
    }


@app.post(
    "/api/agent/generar-plan",
    response_model=RespuestaPlan,
    status_code=status.HTTP_200_OK,
    tags=["Pedagogical Agent"],
)
def generar_plan_remedial(solicitud: SolicitudPlan):
    """
    Endpoint consumido por React vía API Gateway YARP (:5000 -> :8000).
    Recibe vacíos formativos anonimizados y devuelve el plan remedial en JSON estricto.
    """
    logger.info(
        f"Generando plan para {solicitud.materia} ({solicitud.codigo}) - "
        f"Promedio: {solicitud.promedioPonderado:.2f}"
    )
    return gemini_service.generar_plan(solicitud)
