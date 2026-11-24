import logging
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.schemas import RespuestaChat, RespuestaPlan, SolicitudChat, SolicitudPlan
from app.services.chat_service import ChatService
from app.services.gemini_service import GeminiService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai-service")

app = FastAPI(
    title="SISRA - EduMonitor AI Service",
    description="Microservicio de diagnóstico, planes de refuerzo y asistente conversacional pedagógico asistidos por Gemini API",
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

gemini_service = GeminiService()
chat_service = ChatService()


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


@app.post(
    "/api/agent/chat",
    response_model=RespuestaChat,
    status_code=status.HTTP_200_OK,
    tags=["Pedagogical Agent - Chat"],
)
def chat_asistente_pedagogico(solicitud: SolicitudChat):
    """
    Endpoint de Asistencia Conversacional con IA (HU-07 / T-13.4 y T-13.5).
    Responde consultas del docente a nivel general de curso o individual por estudiante,
    integrando Tools deterministas y advertencias éticas de incertidumbre pedagógica (RNF-08).
    """
    logger.info(f"Petición de chat recibida - Modo: {solicitud.modo} | Longitud mensaje: {len(solicitud.mensaje)} chars")
    return chat_service.procesar_chat(solicitud)
