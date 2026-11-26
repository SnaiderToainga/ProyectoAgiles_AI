import logging
from typing import Optional
from fastapi import FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.schemas import RespuestaChat, RespuestaPlan, SolicitudChat, SolicitudPlan
from app.services.backend_client import BackendAcademico, BackendError
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


def _token_bearer(authorization: Optional[str]) -> str:
    """El chat actúa en nombre del docente: sin su JWT no puede consultar la API académica."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Falta el token de sesión del docente.")
    token = authorization[7:].strip()
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Falta el token de sesión del docente.")
    return token


@app.post(
    "/api/agent/chat",
    response_model=RespuestaChat,
    status_code=status.HTTP_200_OK,
    tags=["Pedagogical Agent - Chat"],
)
def chat_asistente_pedagogico(solicitud: SolicitudChat, authorization: Optional[str] = Header(default=None)):
    """
    Endpoint de Asistencia Conversacional con IA (HU-07 / T-13.4 y T-13.5).
    El agente decide qué herramientas invocar contra la API académica, con el JWT del docente,
    y registra la traza de la ejecución (sección 7 / RF-12). Si la API académica falla, responde
    con un error explícito en lugar de improvisar datos.
    """
    token = _token_bearer(authorization)
    logger.info(f"Petición de chat recibida - Modo: {solicitud.modo} | Longitud mensaje: {len(solicitud.mensaje)} chars")
    with BackendAcademico(token) as backend:
        try:
            return chat_service.procesar_chat(solicitud, backend)
        except BackendError as exc:
            status_http = exc.status if exc.status in (401, 403, 404) else status.HTTP_502_BAD_GATEWAY
            raise HTTPException(status_code=status_http, detail=exc.mensaje) from exc
