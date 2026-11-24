import logging
import time
from typing import List, Optional
from google import genai
from google.genai import types
from app.config import settings
from app.prompts import (
    AVISO_ETICO_RNF08,
    SECCION_HECHOS,
    SECCION_INFERENCIAS,
    SECCION_RECOMENDACIONES,
    SYSTEM_PROMPT_CHAT,
)
from app.schemas import RespuestaChat, SolicitudChat
from app.services.chat_tools import ChatTools

logger = logging.getLogger(__name__)

# Temperatura conservadora acordada en el diseño del agente (Sprint 2, sección 2.6.4)
TEMPERATURA_CHAT = 0.2


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
                # Límite por llamada de máximo 14s para respuestas ágiles y fallback rápido ante saturación
                timeout_ms = min(max(int(settings.GEMINI_TIMEOUT_SECONDS * 1000), 10000), 14000)
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

            if any(k in msg_lower for k in ["tema", "unidad", "actividad", "evaluacion", "evaluación", "mal", "fall", "refuerz", "resumen"]):
                tools_ejecutadas.append("tool_analisis_temas")
                datos_contexto["analisis_temas"] = ChatTools.tool_analisis_temas(
                    solicitud.estudiantesCurso
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

        # 3. Llamar a Gemini con el System Prompt ético (T-13.6) e inyección de datos deterministas
        historial_str = ""
        for m in solicitud.historial[-4:]:  # Últimas 4 interacciones para mantener contexto
            historial_str += f"- {m.rol}: {m.contenido}\n"

        # La pregunta y el historial se delimitan como datos para que no actúen como instrucciones.
        prompt = f"""
Modo actual: {solicitud.modo}

<datos_verificados>
{datos_contexto}
</datos_verificados>

<historial>
{historial_str}</historial>

<pregunta_docente>
{solicitud.mensaje}
</pregunta_docente>

Instrucción:
Responde a la pregunta del docente usando las secciones "{SECCION_HECHOS}", "{SECCION_INFERENCIAS}" y "{SECCION_RECOMENDACIONES}".
Si se consultó por estudiantes en riesgo, enumera códigos de estudiante (ej. EST-001), nota exacta y temas débiles. No menciones nombres.
Si en <datos_verificados> hay actividades específicas o análisis por tema (`actividadesDeficientes`, `detallePorTema`, `analisis_temas`), detalla exactamente en qué actividad y tema está el rezago con sus notas.
Si la pregunta requiere un dato que no está en <datos_verificados>, indícalo en lugar de suponerlo.
"""

        # 4.2 y 4.3: Presupuesto ágil de 18s (respeta el límite global <= 28s)
        PRESUPUESTO_TOTAL_S = 18.0
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
                        system_instruction=SYSTEM_PROMPT_CHAT,
                        temperature=TEMPERATURA_CHAT,
                        max_output_tokens=2048,
                        thinking_config=types.ThinkingConfig(thinking_budget=0),
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

    @staticmethod
    def _formatear_secciones(hechos: List[str], inferencias: List[str], recomendaciones: List[str]) -> str:
        """Presenta la respuesta separando hechos, inferencias y recomendaciones (RF-09 / RNF-08)."""
        bloques = []
        for titulo, lineas in (
            (SECCION_HECHOS, hechos),
            (SECCION_INFERENCIAS, inferencias),
            (SECCION_RECOMENDACIONES, recomendaciones),
        ):
            bloques.append(f"{titulo}:\n" + "\n".join(f"• {linea}" for linea in lineas))
        return "\n\n".join(bloques)

    def _generar_respuesta_local(self, solicitud: SolicitudChat, datos: dict) -> str:
        """Genera una respuesta determinista con los datos de las Tools, sin intervención del modelo."""
        if solicitud.modo == "estudiante" and "diagnostico_estudiante" in datos:
            diag = datos["diagnostico_estudiante"]
            nota = diag["notaFinal"]
            estado = "en riesgo académico (< 7.00)" if diag["enRiesgo"] else "aprobado (>= 7.00)"
            temas = ", ".join(diag["temasDeficientes"]) if diag["temasDeficientes"] else "ninguno registrado"

            hechos = [
                f"Estudiante {diag['codigo']}: calificación actual {nota:.2f} / 10.00 pts.",
                f"Estado según la regla institucional: {estado}.",
                f"Temas con evaluaciones deficientes: {temas}.",
            ]
            componentes = diag.get("componentes") or {}
            if componentes:
                detalle = ", ".join(f"{k} {v:.2f}" for k, v in componentes.items())
                hechos.append(f"Promedios por componente con notas registradas: {detalle}.")
            actividades_def = diag.get("actividadesDeficientes") or []
            if actividades_def:
                acts_str = "; ".join(
                    f"{a['nombre']} ({a['nota']:.2f} pts" + (f" - {', '.join(a['temas'])}" if a.get("temas") else "") + ")"
                    for a in actividades_def[:4]
                )
                hechos.append(f"Actividades con nota menor a 7.00: {acts_str}.")

            inferencias = [
                f"Nivel de atención estimado: {diag['nivelRiesgo']} (confianza media). Se calcula solo "
                "a partir de la nota ponderada; no considera asistencia, contexto personal ni "
                "evaluaciones aún no registradas.",
            ]
            if not componentes:
                inferencias.append(
                    "No hay notas por componente para identificar qué tipo de evaluación explica el resultado."
                )

            recomendaciones = [
                f"Sugerencia: {diag['enfoquePedagogico'][:1].lower()}{diag['enfoquePedagogico'][1:]}, "
                "con una dedicación orientativa de "
                f"{diag['horasTutoriaSugeridas']} horas semanales de tutoría.",
                "Contrastar con su desempeño en clase antes de definir el plan; la decisión corresponde al docente.",
            ]
            return self._formatear_secciones(hechos, inferencias, recomendaciones)

        resumen = datos.get("resumen_curso", {})
        total = resumen.get("totalEstudiantes", 0)
        prom = resumen.get("promedioGeneral", 0.0)
        en_riesgo = resumen.get("estudiantesEnRiesgo", 0)
        aprobados = resumen.get("aprobados", 0)
        tasa = resumen.get("tasaAprobacionPct", 0.0)
        materia = resumen.get("materia", "la asignatura")

        if total == 0:
            return self._formatear_secciones(
                [f"No hay estudiantes con calificaciones registradas en {materia}."],
                ["No dispongo de datos suficientes para interpretar el rendimiento del curso."],
                ["Sincronizar las calificaciones desde Moodle y repetir la consulta."],
            )

        hechos = [
            f"Asignatura: {materia}. Estudiantes evaluados: {total}.",
            f"Promedio general del curso: {prom:.2f} / 10.00 pts.",
            f"Aprobados (>= 7.00): {aprobados} ({tasa}%). En riesgo (< 7.00): {en_riesgo} ({100 - tasa:.1f}%).",
        ]
        inferencias: List[str] = []
        recomendaciones: List[str] = []

        if "estudiantes_riesgo" in datos:
            lista = datos["estudiantes_riesgo"]["estudiantes"]
            if lista:
                hechos.append("Estudiantes en riesgo, de menor a mayor nota:")
                for est in lista:
                    temas_str = f" [Temas: {', '.join(est['temasDeficientes'])}]" if est["temasDeficientes"] else ""
                    hechos.append(f"{est['codigo']}: {est['notaFinal']:.2f} pts{temas_str}")
                destinatarios = "el estudiante en riesgo" if len(lista) == 1 else f"los {len(lista)} estudiantes en riesgo"
                recomendaciones.append(f"Considerar priorizar tutorías o planes de refuerzo para {destinatarios}.")
            else:
                hechos.append("Ningún estudiante tiene una nota menor a 7.00.")

        if "analisis_componentes" in datos:
            comp_info = datos["analisis_componentes"]
            if comp_info.get("disponible"):
                hechos.append(
                    f"Componente con el promedio más bajo: {comp_info['componenteCritico']} "
                    f"({comp_info['promedioComponenteCritico']:.2f})."
                )
                inferencias.append(
                    f"El componente {comp_info['componenteCritico']} podría concentrar la mayor dificultad "
                    "formativa (confianza media); el promedio no muestra si se debe a pocos casos extremos."
                )
                recomendaciones.append(
                    f"Revisar las actividades de {comp_info['componenteCritico']} con notas más bajas "
                    "antes de planificar el refuerzo."
                )
            else:
                inferencias.append(comp_info.get("motivo", "No hay notas por componente registradas."))

        if "analisis_temas" in datos:
            temas_info = datos["analisis_temas"]
            if temas_info.get("disponible") and temas_info.get("temas"):
                top_temas = ", ".join(
                    f"{t['tema']} (promedio {t['promedioTema']:.2f})"
                    if t.get("promedioTema") is not None
                    else f"{t['tema']} ({t['estudiantesConDeficiencia']} est. con rezago)"
                    for t in temas_info["temas"][:3]
                )
                hechos.append(f"Temas con mayor dificultad observada: {top_temas}.")
                recomendaciones.append(
                    f"Priorizar el repaso del tema «{temas_info['temaCritico']}» en la próxima sesión."
                )

        if en_riesgo > 0:
            inferencias.append(
                f"Un {100 - tasa:.1f}% del curso está bajo el umbral institucional (confianza alta en la cifra); "
                "las causas no pueden determinarse solo con las notas."
            )
        else:
            inferencias.append("El curso no presenta estudiantes en riesgo según las notas registradas.")

        if not recomendaciones:
            recomendaciones.append("Mantener el seguimiento con cada nueva sincronización de notas.")
        recomendaciones.append("Estas sugerencias son orientativas; la decisión corresponde al docente.")

        return self._formatear_secciones(hechos, inferencias, recomendaciones)
