import logging
import re
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
            sugerencias = self._generar_sugerencias_contextuales(solicitud, datos_contexto)
            duracion_ms = int((time.time() - inicio) * 1000)
            return RespuestaChat(
                respuesta=texto_fallback,
                advertenciaEtica=AVISO_ETICO_RNF08,
                modo=solicitud.modo,
                esFallback=True,
                toolsEjecutadas=tools_ejecutadas,
                sugerenciasSeguimiento=sugerencias,
                tiempoRespuestaMs=duracion_ms,
            )

        # 3. Llamar a Gemini con el System Prompt ético (T-13.6) e inyección de datos deterministas
        datos_para_gemini = dict(datos_contexto)
        if solicitud.modo == "estudiante" and solicitud.estudiantesCurso:
            datos_para_gemini.setdefault(
                "resumen_curso_referencia",
                ChatTools.tool_resumen_curso(solicitud.contextoCurso, solicitud.estudiantesCurso),
            )
        elif solicitud.modo == "curso" and solicitud.estudiantesCurso:
            datos_para_gemini.setdefault(
                "estudiantes_riesgo",
                ChatTools.tool_estudiantes_en_riesgo(solicitud.estudiantesCurso),
            )
            datos_para_gemini.setdefault(
                "analisis_componentes",
                ChatTools.tool_analisis_componentes(solicitud.contextoCurso, solicitud.estudiantesCurso),
            )
            datos_para_gemini.setdefault(
                "analisis_temas",
                ChatTools.tool_analisis_temas(solicitud.estudiantesCurso),
            )
            # Detección unificada: si el docente menciona un estudiante (ej. EST-001) en el chat general,
            # inyectar su diagnóstico detallado sin obligarlo a cambiar de pestaña.
            texto_busqueda = solicitud.mensaje + " " + " ".join(m.contenido for m in solicitud.historial[-3:])
            codigos_mencionados = set(re.findall(r"\bEST-\d+\b", texto_busqueda, flags=re.IGNORECASE))
            if codigos_mencionados:
                por_codigo = {e.codigo.upper(): e for e in solicitud.estudiantesCurso}
                diags_mencionados = [
                    ChatTools.tool_diagnostico_estudiante(por_codigo[c.upper()])
                    for c in sorted(codigos_mencionados)
                    if c.upper() in por_codigo
                ]
                if diags_mencionados:
                    datos_para_gemini["estudiantes_mencionados"] = diags_mencionados

        historial_str = ""
        for m in solicitud.historial[-6:]:  # Últimas 6 interacciones para mantener contexto fluido
            historial_str += f"- {m.rol}: {m.contenido}\n"

        # La pregunta y el historial se delimitan como datos para que no actúen como instrucciones.
        prompt = f"""
Modo actual: {solicitud.modo}

<datos_verificados>
{datos_para_gemini}
</datos_verificados>

<historial>
{historial_str}</historial>

<pregunta_docente>
{solicitud.mensaje}
</pregunta_docente>

Instrucción:
Adapta el estilo de tu respuesta a la intención real de la pregunta del docente:
- Si solicita un diagnóstico, auditoría de calificaciones o análisis de riesgo, organiza la respuesta en "{SECCION_HECHOS}", "{SECCION_INFERENCIAS}" y "{SECCION_RECOMENDACIONES}".
- Si hace una pregunta abierta, conversacional, de seguimiento, o pide ideas didácticas, actividades de refuerzo, estrategias o explicaciones, responde de forma abierta, natural, fluida y variada usando Markdown limpio (párrafos y viñetas), sin forzar encabezados repetitivos.
Si mencionas estudiantes en riesgo, usa únicamente códigos anónimos (ej. EST-001), nota exacta y temas débiles; nunca menciones nombres.
Si la pregunta contiene `[ESTUDIANTE]`, advierte amablemente que existe más de un estudiante con ese nombre/apellido en la asignatura (o en otra cátedra) y pide indicar nombre y apellido completo antes de atribuirle calificaciones individuales.
Si en <datos_verificados> hay actividades específicas o análisis por tema (`actividadesDeficientes`, `detallePorTema`, `analisis_temas`), cita exactamente el nombre de la actividad y del tema con sus notas cuando sea relevante.
Si la pregunta requiere un dato que no está en <datos_verificados>, indícalo explícitamente en lugar de suponerlo.
Al final de tu respuesta, en una línea aparte con el formato exacto `SUGERENCIAS: pregunta 1 | pregunta 2`, propón 2 preguntas o acciones cortas de seguimiento coherentes con lo que acabas de responder (sin nombres personales).
"""

        # 4.2 y 4.3: Presupuesto ágil de 20s (respeta el límite global <= 28s)
        PRESUPUESTO_TOTAL_S = 20.0
        TIEMPO_MINIMO_LLAMADA_S = 3.0

        modelos_a_probar = [settings.GEMINI_MODEL]
        for respaldo in ("gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"):
            if respaldo not in modelos_a_probar:
                modelos_a_probar.append(respaldo)

        for mod in modelos_a_probar:
            max_intentos = 2 if mod == settings.GEMINI_MODEL else 1
            for intento in range(max_intentos):
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
                    config_kwargs = {
                        "system_instruction": SYSTEM_PROMPT_CHAT,
                        "temperature": TEMPERATURA_CHAT,
                        "max_output_tokens": 2048,
                    }
                    # Los modelos '-lite' de Gemini rechazan thinking_budget=0 con 400 INVALID_ARGUMENT
                    if "lite" not in mod.lower():
                        config_kwargs["thinking_config"] = types.ThinkingConfig(thinking_budget=0)

                    resp = self.client.models.generate_content(
                        model=mod,
                        contents=prompt,
                        config=types.GenerateContentConfig(**config_kwargs),
                    )
                    if resp and resp.text:
                        respuesta_limpia, sugerencias = self._extraer_sugerencias(resp.text.strip())
                        if not sugerencias:
                            sugerencias = self._generar_sugerencias_contextuales(solicitud, datos_para_gemini)
                        duracion_ms = int((time.time() - inicio) * 1000)
                        return RespuestaChat(
                            respuesta=respuesta_limpia,
                            advertenciaEtica=AVISO_ETICO_RNF08,
                            modo=solicitud.modo,
                            esFallback=False,
                            toolsEjecutadas=tools_ejecutadas,
                            sugerenciasSeguimiento=sugerencias,
                            tiempoRespuestaMs=duracion_ms,
                        )
                except Exception as e:
                    err_txt = str(e)
                    es_503 = "503" in err_txt or "UNAVAILABLE" in err_txt
                    if es_503 and intento + 1 < max_intentos and (PRESUPUESTO_TOTAL_S - (time.time() - inicio)) > 5.0:
                        logger.warning(f"Pico temporal 503 en {mod}; reintentando brevemente...")
                        time.sleep(0.4)
                        continue
                    logger.warning(f"Error llamando a modelo {mod} en chat: {e}. Probando alternativa...")
                    break

        # 4. Fallback si Gemini falló
        logger.warning("Fallo al consultar Gemini. Activando fallback determinista de chat.")
        texto_fallback = self._generar_respuesta_local(solicitud, datos_contexto)
        sugerencias = self._generar_sugerencias_contextuales(solicitud, datos_para_gemini)
        duracion_ms = int((time.time() - inicio) * 1000)
        return RespuestaChat(
            respuesta=texto_fallback,
            advertenciaEtica=AVISO_ETICO_RNF08,
            modo=solicitud.modo,
            esFallback=True,
            toolsEjecutadas=tools_ejecutadas,
            sugerenciasSeguimiento=sugerencias,
            tiempoRespuestaMs=duracion_ms,
        )

    @staticmethod
    def _extraer_sugerencias(texto: str) -> tuple[str, List[str]]:
        """Separa y limpia la línea final `SUGERENCIAS: ... | ...` generada por Gemini."""
        lineas = texto.splitlines()
        sugerencias: List[str] = []
        limpias: List[str] = []
        for linea in lineas:
            coincidencia = re.match(r"^\s*(?:\*\*?)?SUGERENCIAS(?:\*\*?)?\s*:\s*(.+)$", linea, flags=re.IGNORECASE)
            if coincidencia:
                partes = [p.strip(" -•\"'") for p in coincidencia.group(1).split("|")]
                sugerencias = [p for p in partes if len(p) > 4][:3]
            else:
                limpias.append(linea)
        return "\n".join(limpias).strip(), sugerencias

    @staticmethod
    def _generar_sugerencias_contextuales(solicitud: SolicitudChat, datos: dict) -> List[str]:
        """Genera preguntas de seguimiento coherentes con el contexto real de la conversación."""
        diag = datos.get("diagnostico_estudiante") or (
            (datos.get("estudiantes_mencionados") or [None])[0]
        )
        if diag:
            temas = diag.get("temasDeficientes") or []
            codigo = diag.get("codigo", "este estudiante")
            if temas:
                return [
                    f"Diseña 2 ejercicios prácticos paso a paso sobre {temas[0]} para {codigo}",
                    f"¿Cómo estructurar la sesión de tutoría semanal con {codigo}?",
                ]
            return [
                f"¿Qué actividades de profundización recomiendas para {codigo}?",
                "Comparar este desempeño con el promedio general del curso",
            ]

        temas_info = datos.get("analisis_temas") or {}
        tema_critico = temas_info.get("temaCritico")
        riesgo_info = datos.get("estudiantes_riesgo") or {}
        if tema_critico:
            return [
                f"Propón una dinámica práctica de 15 minutos para reforzar «{tema_critico}»",
                "¿Qué estudiantes presentan el mayor rezago en este tema?",
            ]
        if riesgo_info.get("totalEnRiesgo", 0) > 0:
            return [
                "¿En qué tema específico se concentra la dificultad del grupo?",
                "Sugiere una estrategia de nivelación grupal previa al examen",
            ]
        return [
            "¿Cuál es el componente de evaluación con mayor oportunidad de mejora?",
            "Sugiere una actividad práctica motivadora para la próxima clase",
        ]

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

        if "[ESTUDIANTE]" in solicitud.mensaje and solicitud.modo == "curso":
            return self._formatear_secciones(
                [
                    f"Asignatura: {materia}. Existen múltiples estudiantes que coinciden con el nombre consultado, "
                    "por lo que se protegió la identidad como [ESTUDIANTE] (RNF-02).",
                    f"Promedio general del curso: {prom:.2f} / 10.00 pts ({en_riesgo} en riesgo).",
                ],
                [
                    "No es posible atribuir calificaciones individuales sin confirmar a cuál estudiante corresponde "
                    "(confianza alta en evitar falsa atribución)."
                ],
                [
                    "Escribir el nombre y apellido completo en la consulta para identificar con certeza al estudiante.",
                    "Estas sugerencias son orientativas; la decisión corresponde al docente.",
                ],
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
