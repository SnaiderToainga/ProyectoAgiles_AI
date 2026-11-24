import logging
import time
from typing import List, Optional
from google import genai
from google.genai import types
from app.config import settings
from app.schemas import RespuestaChat, SolicitudChat
from app.services.chat_tools import ChatTools

logger = logging.getLogger(__name__)

AVISO_ETICO_RNF08 = (
    "Aviso Pedagógico (RNF-08): Las respuestas y recomendaciones de este asistente "
    "tienen carácter orientativo como apoyo a la toma de decisiones docentes. La evaluación "
    "definitiva y la asignación de calificaciones corresponden con exclusividad al docente titular."
)


class ChatService:
    """
    Servicio de Asistencia Conversacional Pedagógica (HU-07 / T-13.4 y T-13.5).
    Combina Tools deterministas (para evitar alucinaciones numéricas) con Gemini API,
    y provee un motor local de contingencia (Fallback) ante pérdida de conexión.
    """

    def __init__(self) -> None:
        self.api_key = settings.GEMINI_API_KEY.strip()
        self.client: Optional[genai.Client] = None
        if self.api_key:
            try:
                # Presupuesto estricto de máximo 28 segundos para respetar el límite global
                timeout_ms = min(max(int(settings.GEMINI_TIMEOUT_SECONDS * 1000), 10000), 28000)
                self.client = genai.Client(
                    api_key=self.api_key,
                    http_options=types.HttpOptions(timeout=timeout_ms),
                )
            except Exception as exc:
                logger.error(f"Error inicializando cliente de Gemini para Chat: {exc}")

    def procesar_chat(self, solicitud: SolicitudChat) -> RespuestaChat:
        inicio = time.time()
        tools_ejecutadas: List[str] = []

        # 1. Ejecutar las Tools deterministas según el modo y contenido de la pregunta
        msg_lower = solicitud.mensaje.lower()
        datos_contexto = {}

        if solicitud.modo == "estudiante" and solicitud.estudianteSeleccionado:
            tools_ejecutadas.append("tool_diagnostico_estudiante")
            datos_contexto["diagnostico_estudiante"] = ChatTools.tool_diagnostico_estudiante(
                solicitud.estudianteSeleccionado
            )
        else:
            # Modo Curso
            tools_ejecutadas.append("tool_resumen_curso")
            datos_contexto["resumen_curso"] = ChatTools.tool_resumen_curso(
                solicitud.contextoCurso, solicitud.estudiantesCurso
            )

            if any(k in msg_lower for k in ["riesgo", "reprobado", "menor", "debajo", "recuper"]):
                tools_ejecutadas.append("tool_estudiantes_en_riesgo")
                datos_contexto["estudiantes_riesgo"] = ChatTools.tool_estudiantes_en_riesgo(
                    solicitud.estudiantesCurso
                )

            if any(k in msg_lower for k in ["componente", "tarea", "ape", "examen", "dificultad", "bajo"]):
                tools_ejecutadas.append("tool_analisis_componentes")
                datos_contexto["analisis_componentes"] = ChatTools.tool_analisis_componentes(
                    solicitud.contextoCurso, solicitud.estudiantesCurso
                )

        # 2. Si no hay cliente Gemini configurado o falla, usar Fallback Determinista
        if not self.client or not self.api_key:
            logger.info("Gemini no configurado para chat. Usando respuesta determinista local.")
            texto_fallback = self._generar_respuesta_local(solicitud, datos_contexto)
            duracion_ms = int((time.time() - inicio) * 1000)
            return RespuestaChat(
                respuesta=texto_fallback,
                advertenciaEtica=AVISO_ETICO_RNF08,
                modo=solicitud.modo,
                esFallback=True,
                toolsEjecutadas=tools_ejecutadas,
                tiempoRespuestaMs=duracion_ms,
            )

        # 3. Llamar a Gemini con System Prompt e inyección de datos deterministas
        system_instruction = (
            "Eres el Asistente Pedagógico de EduMonitor AI para la Universidad Técnica de Ambato (UTA), "
            "Facultad de Ingeniería en Sistemas, Electrónica e Industrial (FISEI). "
            "Tu objetivo es ayudar al docente a interpretar calificaciones, identificar vacíos formativos "
            "y sugerir estrategias de refuerzo escolar.\n"
            "DIRECTRICES OBLIGATORIAS:\n"
            "1. Utiliza estrictamente los datos verificados que se te proporcionan en el contexto. No inventes notas ni nombres.\n"
            "2. El modelo de calificación UTA es: 30% Tareas, 30% APE, 40% Examen. La nota mínima de aprobación es 7.00/10.00.\n"
            "3. Mantén un tono formal, académico, constructivo y conciso.\n"
            "4. Respeta el principio de privacidad (RNF-02): trabaja exclusivamente con códigos de estudiante anónimos (ej. EST-001) y nunca menciones nombres personales.\n"
            "5. Recuerda siempre que tu función es consultiva y orientativa."
        )

        historial_str = ""
        for m in solicitud.historial[-4:]:  # Últimas 4 interacciones para mantener contexto
            historial_str += f"- {m.rol}: {m.contenido}\n"

        prompt = f"""
Pregunta del Docente: "{solicitud.mensaje}"
Modo actual: {solicitud.modo}

Datos Académicos Verificados por el Sistema:
{datos_contexto}

Historial de la conversación reciente:
{historial_str}

Instrucción:
Responde de forma clara y directa a la pregunta del docente, estructurando los puntos clave con viñetas si es necesario.
Si se consultó por estudiantes en riesgo, enumera códigos de estudiante (ej. EST-001), nota exacta y temas débiles. No menciones nombres.
"""

        # 4.2 y 4.3: Presupuesto global estricto de 28s y modelo de respaldo unificado con gemini_service.py
        PRESUPUESTO_TOTAL_S = 28.0
        TIEMPO_MINIMO_LLAMADA_S = 3.0

        modelos_a_probar = [settings.GEMINI_MODEL]
        if "gemini-3.1-flash-lite" not in modelos_a_probar:
            modelos_a_probar.append("gemini-3.1-flash-lite")

        for mod in modelos_a_probar:
            tiempo_transcurrido = time.time() - inicio
            tiempo_restante_s = PRESUPUESTO_TOTAL_S - tiempo_transcurrido

            # Si ya no existe tiempo suficiente para una llamada útil, conmutar directamente a fallback
            if tiempo_restante_s < TIEMPO_MINIMO_LLAMADA_S:
                logger.warning(
                    f"Presupuesto de tiempo agotado ({tiempo_transcurrido:.2f}s de {PRESUPUESTO_TOTAL_S}s). "
                    "Activando inmediatamente fallback local determinista."
                )
                break

            try:
                resp = self.client.models.generate_content(
                    model=mod,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        temperature=0.3,
                        max_output_tokens=1000,
                    ),
                )
                if resp and resp.text:
                    duracion_ms = int((time.time() - inicio) * 1000)
                    return RespuestaChat(
                        respuesta=resp.text.strip(),
                        advertenciaEtica=AVISO_ETICO_RNF08,
                        modo=solicitud.modo,
                        esFallback=False,
                        toolsEjecutadas=tools_ejecutadas,
                        tiempoRespuestaMs=duracion_ms,
                    )
            except Exception as e:
                logger.warning(f"Error llamando a modelo {mod} en chat: {e}. Probando alternativa...")

        # 4. Fallback si Gemini falló
        logger.warning("Fallo al consultar Gemini. Activando fallback determinista de chat.")
        texto_fallback = self._generar_respuesta_local(solicitud, datos_contexto)
        duracion_ms = int((time.time() - inicio) * 1000)
        return RespuestaChat(
            respuesta=texto_fallback,
            advertenciaEtica=AVISO_ETICO_RNF08,
            modo=solicitud.modo,
            esFallback=True,
            toolsEjecutadas=tools_ejecutadas,
            tiempoRespuestaMs=duracion_ms,
        )

    def _generar_respuesta_local(self, solicitud: SolicitudChat, datos: dict) -> str:
        """Genera una respuesta determinista en lenguaje natural utilizando los datos de las Tools."""
        if solicitud.modo == "estudiante" and "diagnostico_estudiante" in datos:
            diag = datos["diagnostico_estudiante"]
            nota = diag["notaFinal"]
            estado = "en riesgo académico (< 7.00)" if diag["enRiesgo"] else "aprobado"
            temas = ", ".join(diag["temasDeficientes"]) if diag["temasDeficientes"] else "ninguno con reporte crítico"

            return (
                f"Diagnóstico para el estudiante {diag['codigo']}:\n\n"
                f"• Calificación actual: {nota:.2f} / 10.00 pts (Estado: {estado}).\n"
                f"• Nivel de atención sugerido: {diag['nivelRiesgo']}.\n"
                f"• Temas que requieren refuerzo: {temas}.\n"
                f"• Recomendación pedagógica: {diag['enfoquePedagogico']}, con una dedicación estimada "
                f"de {diag['horasTutoriaSugeridas']} horas semanales de tutoría."
            )

        resumen = datos.get("resumen_curso", {})
        total = resumen.get("totalEstudiantes", 0)
        prom = resumen.get("promedioGeneral", 0.0)
        en_riesgo = resumen.get("estudiantesEnRiesgo", 0)
        aprobados = resumen.get("aprobados", 0)
        tasa = resumen.get("tasaAprobacionPct", 0.0)
        materia = resumen.get("materia", "la asignatura")

        msg = (
            f"Resumen académico de {materia}:\n\n"
            f"• Total estudiantes: {total}\n"
            f"• Promedio general del curso: {prom:.2f} / 10.00 pts\n"
            f"• Estudiantes aprobados: {aprobados} ({tasa}%)\n"
            f"• Estudiantes en riesgo (< 7.00): {en_riesgo} ({100 - tasa:.1f}%)\n\n"
        )

        if "estudiantes_riesgo" in datos and datos["estudiantes_riesgo"]["estudiantes"]:
            lista = datos["estudiantes_riesgo"]["estudiantes"]
            msg += "Estudiantes con necesidad de tutoría y plan de refuerzo:\n"
            for est in lista:
                temas_str = f" [Temas: {', '.join(est['temasDeficientes'])}]" if est['temasDeficientes'] else ""
                msg += f"  - {est['codigo']}: {est['notaFinal']:.2f} pts{temas_str}\n"

        if "analisis_componentes" in datos:
            comp_info = datos["analisis_componentes"]
            if comp_info.get("disponible"):
                msg += (
                    f"\nComponente con mayor dificultad: {comp_info['componenteCritico']} "
                    f"(promedio: {comp_info['promedioComponenteCritico']:.2f})."
                )
            else:
                msg += f"\n{comp_info.get('motivo', 'No hay notas por componente registradas.')}"

        return msg
