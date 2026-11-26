import logging
import re
import time
from typing import Any, Dict, List, Optional, Tuple
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
from app.services.agent_tools import DECLARACIONES, HerramientasAgente
from app.services.backend_client import BackendAcademico, BackendError

logger = logging.getLogger(__name__)

# Temperatura conservadora acordada en el diseño del agente (Sprint 2, sección 2.6.4)
TEMPERATURA_CHAT = 0.2

# Presupuesto total del chat (el navegador espera hasta 35 s) y límites del bucle de herramientas.
PRESUPUESTO_TOTAL_S = 24.0
TIEMPO_MINIMO_LLAMADA_S = 3.0
MAX_RONDAS_HERRAMIENTAS = 3
MAX_LLAMADAS_POR_RONDA = 4
MODELOS_RESPALDO = ("gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite")


class ChatService:
    """
    Servicio de Asistencia Conversacional Pedagógica (HU-07 / T-13.4 y T-13.5).
    El modelo elige y usa herramientas que consultan la API académica (function calling); las cifras
    salen siempre de cálculos deterministas. Sin modelo, un motor local usa las mismas herramientas.
    """

    def __init__(self) -> None:
        self.api_key = settings.GEMINI_API_KEY.strip()
        self.client: Optional[genai.Client] = None
        if self.api_key:
            try:
                # Límite por llamada de máximo 14s para respuestas ágiles y conmutación rápida ante saturación
                timeout_ms = min(max(int(settings.GEMINI_TIMEOUT_SECONDS * 1000), 10000), 14000)
                self.client = genai.Client(
                    api_key=self.api_key,
                    http_options=types.HttpOptions(timeout=timeout_ms),
                )
            except Exception as exc:
                logger.error(f"Error inicializando cliente de Gemini para Chat: {exc}")

    def procesar_chat(self, solicitud: SolicitudChat, backend: BackendAcademico) -> RespuestaChat:
        """
        Atiende una consulta del docente. El modelo decide qué herramientas invocar contra la API
        académica; si el modelo no está disponible, el motor local usa esas mismas herramientas.
        Toda la ejecución se registra como traza (sección 7 / RF-12). Si la API académica falla,
        se lanza BackendError: nunca se responde con datos inventados.
        """
        inicio = time.time()
        herramientas = HerramientasAgente(backend, solicitud.cursoId, solicitud.parcialId)
        modelo_usado: Optional[str] = None
        try:
            respuesta_modelo: Optional[Tuple[str, str]] = None
            if self.client and self.api_key:
                respuesta_modelo = self._responder_con_modelo(solicitud, herramientas, inicio)
            if respuesta_modelo:
                texto, modelo_usado = respuesta_modelo
                respuesta, sugerencias = self._extraer_sugerencias(texto)
                es_fallback = False
                datos = self._datos_ejecutados(herramientas)
            else:
                logger.info("Modelo no disponible para el chat; se usa el motor local con las mismas herramientas.")
                datos = self._ejecutar_herramientas_basicas(solicitud, herramientas)
                respuesta = self._generar_respuesta_local(solicitud, datos)
                sugerencias = []
                es_fallback = True
        except BackendError as exc:
            self._registrar_traza(backend, solicitud, herramientas, inicio, None, False, False, exc.mensaje)
            raise

        if not sugerencias:
            sugerencias = self._generar_sugerencias_contextuales(solicitud, datos)
        traza_id = self._registrar_traza(backend, solicitud, herramientas, inicio, modelo_usado, es_fallback, True, None)
        return RespuestaChat(
            respuesta=respuesta,
            advertenciaEtica=AVISO_ETICO_RNF08,
            modo=solicitud.modo,
            esFallback=es_fallback,
            toolsEjecutadas=herramientas.ejecutadas,
            sugerenciasSeguimiento=sugerencias,
            tiempoRespuestaMs=int((time.time() - inicio) * 1000),
            modelo=modelo_usado,
            trazaId=traza_id,
        )

    # -- Modelo con function calling -------------------------------------------------------------

    def _responder_con_modelo(
        self, solicitud: SolicitudChat, herramientas: HerramientasAgente, inicio: float
    ) -> Optional[Tuple[str, str]]:
        """Bucle de function calling. Devuelve (texto, modelo) o None si el modelo no respondió."""
        contenidos: List[types.Content] = [
            types.Content(role="user", parts=[types.Part(text=self._construir_prompt(solicitud))])
        ]
        herramienta_gemini = types.Tool(function_declarations=DECLARACIONES)
        modelos = self._modelos_a_probar()

        for ronda in range(MAX_RONDAS_HERRAMIENTAS + 1):
            # En la primera ronda el modelo debe consultar datos reales antes de responder.
            modo_llamada = "ANY" if ronda == 0 else ("AUTO" if ronda < MAX_RONDAS_HERRAMIENTAS else "NONE")
            config_kwargs: Dict[str, Any] = {
                "system_instruction": SYSTEM_PROMPT_CHAT,
                "temperature": TEMPERATURA_CHAT,
                "max_output_tokens": 2048,
                "tools": [herramienta_gemini],
                "automatic_function_calling": types.AutomaticFunctionCallingConfig(disable=True),
                "tool_config": types.ToolConfig(
                    function_calling_config=types.FunctionCallingConfig(mode=modo_llamada)
                ),
            }
            resultado = self._llamar_modelo(modelos, contenidos, config_kwargs, inicio)
            if resultado is None:
                return None
            resp, modelo = resultado
            modelos = [modelo]  # Se mantiene el modelo que respondió durante toda la conversación.

            llamadas = list(getattr(resp, "function_calls", None) or [])
            if llamadas and ronda < MAX_RONDAS_HERRAMIENTAS:
                contenido_modelo = resp.candidates[0].content if getattr(resp, "candidates", None) else None
                if contenido_modelo is not None:
                    contenidos.append(contenido_modelo)
                partes = []
                for llamada in llamadas[:MAX_LLAMADAS_POR_RONDA]:
                    salida = herramientas.ejecutar(llamada.name, dict(llamada.args or {}))
                    partes.append(types.Part.from_function_response(name=llamada.name, response={"resultado": salida}))
                contenidos.append(types.Content(role="user", parts=partes))
                continue

            texto = (getattr(resp, "text", None) or "").strip()
            return (texto, modelo) if texto else None
        return None

    def _llamar_modelo(
        self, modelos: List[str], contenidos: List[types.Content], config_kwargs: Dict[str, Any], inicio: float
    ) -> Optional[Tuple[Any, str]]:
        for modelo in modelos:
            max_intentos = 2 if modelo == settings.GEMINI_MODEL else 1
            for intento in range(max_intentos):
                restante = PRESUPUESTO_TOTAL_S - (time.time() - inicio)
                if restante < TIEMPO_MINIMO_LLAMADA_S:
                    logger.warning("Presupuesto de tiempo del chat agotado; se usa el motor local.")
                    return None
                kwargs = dict(config_kwargs)
                # Los modelos '-lite' de Gemini rechazan thinking_budget=0 con 400 INVALID_ARGUMENT
                if "lite" not in modelo.lower():
                    kwargs["thinking_config"] = types.ThinkingConfig(thinking_budget=0)
                try:
                    resp = self.client.models.generate_content(
                        model=modelo,
                        contents=contenidos,
                        config=types.GenerateContentConfig(**kwargs),
                    )
                    return resp, modelo
                except BackendError:
                    raise
                except Exception as exc:
                    texto_error = str(exc)
                    es_503 = "503" in texto_error or "UNAVAILABLE" in texto_error
                    if es_503 and intento + 1 < max_intentos and restante > 5.0:
                        logger.warning(f"Pico temporal 503 en {modelo}; reintentando brevemente...")
                        time.sleep(0.4)
                        continue
                    logger.warning(f"Error llamando a modelo {modelo} en chat: {exc}. Probando alternativa...")
                    break
        return None

    @staticmethod
    def _modelos_a_probar() -> List[str]:
        modelos = [settings.GEMINI_MODEL]
        for respaldo in MODELOS_RESPALDO:
            if respaldo not in modelos:
                modelos.append(respaldo)
        return modelos

    @staticmethod
    def _construir_prompt(solicitud: SolicitudChat) -> str:
        historial = "".join(f"- {m.rol}: {m.contenido}\n" for m in solicitud.historial[-6:])
        seleccionado = solicitud.estudianteCodigo or "ninguno"
        # La pregunta y el historial se delimitan como datos para que no actúen como instrucciones.
        return f"""
Modo actual: {solicitud.modo}
Estudiante seleccionado por el docente: {seleccionado}
El curso y el parcial ya están fijados por el sistema; las herramientas consultan solo esos datos.

<historial>
{historial}</historial>

<pregunta_docente>
{solicitud.mensaje}
</pregunta_docente>

Instrucción:
Antes de responder, invoca las herramientas necesarias para obtener los datos reales del curso. Usa
únicamente las cifras que devuelvan las herramientas; si una herramienta no devuelve un dato, dilo.
Si hay un estudiante seleccionado o la pregunta menciona un código EST-###, usa diagnosticar_estudiante.
Adapta el estilo de tu respuesta a la intención real de la pregunta del docente:
- Si solicita un diagnóstico, auditoría de calificaciones o análisis de riesgo, organiza la respuesta en "{SECCION_HECHOS}", "{SECCION_INFERENCIAS}" y "{SECCION_RECOMENDACIONES}".
- Si hace una pregunta abierta, conversacional, de seguimiento, o pide ideas didácticas, actividades de refuerzo, estrategias o explicaciones, responde de forma abierta, natural, fluida y variada usando Markdown limpio (párrafos y viñetas), sin forzar encabezados repetitivos.
Si mencionas estudiantes, usa únicamente códigos anónimos (ej. EST-001), nota exacta y temas débiles; nunca menciones nombres.
Si la pregunta contiene `[ESTUDIANTE]`, advierte amablemente que existe más de un estudiante con ese nombre/apellido y pide indicar nombre y apellido completo antes de atribuirle calificaciones individuales.
Si un cálculo es provisional (faltan componentes por evaluar), indícalo.
Al final de tu respuesta, en una línea aparte con el formato exacto `SUGERENCIAS: pregunta 1 | pregunta 2`, propón 2 preguntas o acciones cortas de seguimiento coherentes con lo que acabas de responder (sin nombres personales).
"""

    # -- Motor local (sin modelo) ----------------------------------------------------------------

    def _ejecutar_herramientas_basicas(self, solicitud: SolicitudChat, herramientas: HerramientasAgente) -> Dict[str, Any]:
        """Sin modelo, se eligen las herramientas por reglas fijas, pero los datos siguen siendo reales."""
        codigos = self._codigos_mencionados(solicitud)
        diagnostico = None
        if solicitud.modo == "estudiante" and solicitud.estudianteCodigo:
            diagnostico = herramientas.ejecutar("diagnosticar_estudiante", {"codigo": solicitud.estudianteCodigo})
        if diagnostico is None or "error" in diagnostico:
            herramientas.ejecutar("consultar_resumen_curso")
            herramientas.ejecutar("listar_estudiantes_en_riesgo")
            herramientas.ejecutar("analizar_temas_y_actividades")
            if len(codigos) == 1:
                herramientas.ejecutar("diagnosticar_estudiante", {"codigo": codigos[0]})
        return self._datos_ejecutados(herramientas)

    @staticmethod
    def _codigos_mencionados(solicitud: SolicitudChat) -> List[str]:
        texto = solicitud.mensaje + " " + " ".join(m.contenido for m in solicitud.historial[-3:])
        return sorted({c.upper() for c in re.findall(r"\bEST-\d+\b", texto, flags=re.IGNORECASE)})

    @staticmethod
    def _datos_ejecutados(herramientas: HerramientasAgente) -> Dict[str, Any]:
        """Reúne los resultados válidos de las herramientas con las claves que usa el motor local."""
        datos: Dict[str, Any] = {}
        for (nombre, _), resultado in herramientas._cache.items():
            if not isinstance(resultado, dict) or "error" in resultado:
                continue
            if nombre == "consultar_resumen_curso":
                datos["resumen_curso"] = resultado["resumen"]
                datos["analisis_componentes"] = resultado["componentes"]
            elif nombre == "listar_estudiantes_en_riesgo":
                datos["estudiantes_riesgo"] = resultado
            elif nombre == "analizar_temas_y_actividades":
                datos["analisis_temas"] = resultado
            elif nombre == "diagnosticar_estudiante":
                datos.setdefault("diagnostico_estudiante", resultado)
        return datos

    # -- Traza ------------------------------------------------------------------------------------

    @staticmethod
    def _registrar_traza(
        backend: BackendAcademico,
        solicitud: SolicitudChat,
        herramientas: HerramientasAgente,
        inicio: float,
        modelo: Optional[str],
        es_fallback: bool,
        exitoso: bool,
        error: Optional[str],
    ) -> Optional[int]:
        traza = {
            "cursoId": solicitud.cursoId,
            "parcialId": solicitud.parcialId,
            "modo": solicitud.modo,
            # La consulta ya llega anonimizada desde el navegador (RNF-02).
            "consulta": solicitud.mensaje[:2000],
            "modelo": modelo,
            "esFallback": es_fallback,
            "exitoso": exitoso,
            "error": (error or "")[:500] or None,
            "duracionMs": int((time.time() - inicio) * 1000),
            "pasos": [p.como_dict() for p in herramientas.pasos[:20]],
        }
        try:
            return backend.registrar_traza(traza)
        except BackendError as exc:
            logger.warning(f"No se pudo registrar la traza del agente: {exc.mensaje}")
            return None

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
