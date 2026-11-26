import { useState, useRef, useEffect, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X,
  Send,
  Sparkles,
  Bot,
  User,
  GraduationCap,
  AlertCircle,
  RotateCcw,
  CheckCircle2,
  Lightbulb,
  Compass,
  ArrowRight,
  FileText,
  Copy,
  Check,
} from 'lucide-react'
import axios from 'axios'
import clienteAxios from '../api/clienteAxios'
import { useAuth } from '../context/AuthContext'
import { crearAnonimizador } from '../utils/anonimizador'
import { type MateriaDto, type ResumenAcademicoEstudianteDto } from '../types/academico'
import { estaEvaluado } from '../utils/estadoCalificacion'

// Código seudónimo estable: el mismo que usa la API académica para el agente (EST-<id interno>).
const codigoEstudiante = (estudianteId: number) => `EST-${String(estudianteId).padStart(3, '0')}`

const NOMBRE_HERRAMIENTA: Record<string, string> = {
  consultar_resumen_curso: 'resumen del curso',
  listar_estudiantes_en_riesgo: 'estudiantes en riesgo',
  analizar_temas_y_actividades: 'temas y actividades',
  diagnosticar_estudiante: 'diagnóstico individual',
}

function mensajeErrorChat(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.code === 'ECONNABORTED') return 'El asistente tardó demasiado en responder.'
    const detalle = (error.response?.data as { detail?: unknown } | undefined)?.detail
    if (typeof detalle === 'string' && detalle.trim()) return detalle
    if (error.response?.status === 401) return 'La sesión expiró; vuelve a iniciar sesión.'
    if (!error.response) return 'No hay conexión con el servicio de IA.'
    return `El servicio de IA respondió con un error (HTTP ${error.response.status}).`
  }
  return 'Error inesperado al consultar el asistente.'
}

export interface MensajeChatUi {
  id: string
  rol: 'user' | 'assistant'
  texto: string
  hora: string
  esFallback?: boolean
  // La consulta falló: el mensaje explica el motivo y no contiene ningún análisis.
  esError?: boolean
  herramientas?: string[]
  tiempoMs?: number
  modoMensaje?: 'curso' | 'estudiante'
  estudianteIdMensaje?: number | null
  materiaIdMensaje?: number | null
  sugerencias?: string[]
}

interface ChatIaWidgetProps {
  materias: MateriaDto[]
  materiaSeleccionadaId?: number
  estudiantes?: ResumenAcademicoEstudianteDto[]
  rendimientosPorMateria?: Record<number, ResumenAcademicoEstudianteDto[]>
  estudiantePreseleccionado?: ResumenAcademicoEstudianteDto | null
  abiertoExterno?: boolean
  desactivado?: boolean
  modoPanelLateral?: boolean
  dockGlobal?: boolean
  onCerrar?: () => void
  onAbrir?: () => void
  onLimpiarPreseleccion?: () => void
}

interface SeccionRespuesta {
  titulo: string
  tipo: 'hechos' | 'inferencias' | 'recomendaciones' | 'general'
  lineas: string[]
}

function renderInlineMarkdown(texto: string): ReactNode[] {
  const partes = texto.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g)
  return partes.map((parte, idx) => {
    if (parte.startsWith('**') && parte.endsWith('**') && parte.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-[#18181b]">
          {parte.slice(2, -2)}
        </strong>
      )
    }
    if (parte.startsWith('*') && parte.endsWith('*') && parte.length > 2) {
      return (
        <em key={idx} className="italic text-[#27272a]">
          {parte.slice(1, -1)}
        </em>
      )
    }
    if (parte.startsWith('`') && parte.endsWith('`') && parte.length > 2) {
      return (
        <code key={idx} className="px-1 py-0.2 rounded bg-zinc-100 text-[#8B151A] font-mono text-[11px]">
          {parte.slice(1, -1)}
        </code>
      )
    }
    return <span key={idx}>{parte}</span>
  })
}

function normalizarTextoBusqueda(txt: string): string {
  return txt
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function parsearSeccionesRespuesta(texto: string): SeccionRespuesta[] {
  const lineasRaw = texto.split(/\r?\n/)
  const secciones: SeccionRespuesta[] = []
  let actual: SeccionRespuesta = { titulo: '', tipo: 'general', lineas: [] }

  const detectarSeccion = (lineaLimpia: string): SeccionRespuesta['tipo'] | null => {
    const norm = lineaLimpia
      .replace(/^#+\s*/, '')
      .replace(/^[-*•]\s*/, '')
      .replace(/\*\*/g, '')
      .replace(/:$/, '')
      .trim()
      .toLowerCase()
    if (norm === 'hechos verificados') return 'hechos'
    if (norm === 'inferencias') return 'inferencias'
    if (norm === 'recomendaciones') return 'recomendaciones'
    return null
  }

  for (const raw of lineasRaw) {
    const trimmed = raw.trim()
    if (!trimmed) continue

    const tipoDetectado = detectarSeccion(trimmed)
    if (tipoDetectado) {
      if (actual.lineas.length > 0 || actual.titulo) {
        secciones.push(actual)
      }
      const tituloVisible =
        tipoDetectado === 'hechos'
          ? 'Hechos verificados'
          : tipoDetectado === 'inferencias'
          ? 'Inferencias'
          : 'Recomendaciones'
      actual = { titulo: tituloVisible, tipo: tipoDetectado, lineas: [] }
      continue
    }

    actual.lineas.push(trimmed)
  }

  if (actual.lineas.length > 0 || actual.titulo) {
    secciones.push(actual)
  }

  return secciones
}

function renderLineaMarkdown(linea: string, idx: number, variante: 'general' | 'seccion'): ReactNode {
  const matchTitulo = /^(#{1,4})\s+(.+)$/.exec(linea)
  if (matchTitulo) {
    const nivel = matchTitulo[1].length
    return (
      <h5
        key={idx}
        className={`font-bold text-[#18181b] ${
          nivel <= 2 ? 'text-xs pt-1.5' : 'text-[11.5px] pt-1'
        }`}
      >
        {renderInlineMarkdown(matchTitulo[2])}
      </h5>
    )
  }

  const matchNumerada = /^(\d+[.)])\s+(.+)$/.exec(linea)
  if (matchNumerada) {
    return (
      <div key={idx} className="flex items-start gap-1.5 pl-0.5">
        <span className="font-bold text-[#8B151A] shrink-0 min-w-[16px]">
          {matchNumerada[1]}
        </span>
        <span>{renderInlineMarkdown(matchNumerada[2])}</span>
      </div>
    )
  }

  const esLista = /^[-*•]\s+/.test(linea)
  if (esLista) {
    const contenido = linea.replace(/^[-*•]\s+/, '')
    return (
      <div key={idx} className={`flex items-start gap-1.5 ${variante === 'general' ? 'pl-1' : ''}`}>
        <span
          className={`mt-1.5 rounded-full shrink-0 ${
            variante === 'general'
              ? 'w-1.5 h-1.5 bg-[#8B151A]'
              : 'w-1 h-1 bg-current opacity-60'
          }`}
        />
        <span>{renderInlineMarkdown(contenido)}</span>
      </div>
    )
  }

  return <p key={idx}>{renderInlineMarkdown(linea)}</p>
}

function MensajeAsistenteFormateado({ texto }: { texto: string }) {
  const secciones = parsearSeccionesRespuesta(texto)

  if (secciones.length <= 1 && secciones[0]?.tipo === 'general') {
    return (
      <div className="space-y-1.5 text-xs leading-relaxed text-[#27272a]">
        {secciones[0].lineas.map((linea, i) => renderLineaMarkdown(linea, i, 'general'))}
      </div>
    )
  }

  const estilosSeccion: Record<
    SeccionRespuesta['tipo'],
    { contenedor: string; cabecera: string; icono: ReactNode }
  > = {
    hechos: {
      contenedor: 'bg-sky-50/60 border-l-2 border-l-sky-600 border border-sky-100 rounded-md p-2',
      cabecera: 'text-sky-900',
      icono: <CheckCircle2 className="w-3.5 h-3.5 text-sky-700 shrink-0" />,
    },
    inferencias: {
      contenedor: 'bg-amber-50/60 border-l-2 border-l-amber-500 border border-amber-100 rounded-md p-2',
      cabecera: 'text-amber-900',
      icono: <Lightbulb className="w-3.5 h-3.5 text-amber-600 shrink-0" />,
    },
    recomendaciones: {
      contenedor: 'bg-emerald-50/60 border-l-2 border-l-emerald-600 border border-emerald-100 rounded-md p-2',
      cabecera: 'text-emerald-900',
      icono: <Compass className="w-3.5 h-3.5 text-emerald-700 shrink-0" />,
    },
    general: {
      contenedor: 'bg-zinc-50 border border-zinc-200 rounded-md p-2',
      cabecera: 'text-zinc-800',
      icono: <Bot className="w-3.5 h-3.5 text-zinc-600 shrink-0" />,
    },
  }

  return (
    <div className="space-y-2">
      {secciones.map((sec, idx) => {
        const st = estilosSeccion[sec.tipo]
        return (
          <div key={idx} className={st.contenedor}>
            {sec.titulo && (
              <div className={`flex items-center gap-1.5 font-bold text-[11px] mb-1 ${st.cabecera}`}>
                {st.icono}
                <span>{sec.titulo}</span>
              </div>
            )}
            <div className="space-y-1 text-[11.5px] leading-relaxed text-[#27272a]">
              {sec.lineas.map((linea, i) => renderLineaMarkdown(linea, i, 'seccion'))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function obtenerPrimerNombre(nombreCompleto?: string): string {
  if (!nombreCompleto) return 'Docente'
  const sinTitulo = nombreCompleto
    .trim()
    .replace(/^(ing\.?|dr\.?|dra\.?|mg\.?|msc\.?|lic\.?|prof\.?|phd\.?)\s+/i, '')
    .trim()
  const primer = sinTitulo.split(/\s+/)[0]
  return primer || 'Docente'
}

const MENSAJE_BIENVENIDA = (nombre = 'Docente'): MensajeChatUi => ({
  id: 'bienvenida',
  rol: 'assistant',
  texto: `¡Hola, ${nombre}! Pregúntame sobre el rendimiento del curso, los temas críticos o cualquier estudiante por su nombre.`,
  hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
})

const STORAGE_KEY_CHAT_GLOBAL = 'edumonitor_chat_global_v1'
const STORAGE_KEY_ABIERTO = 'edumonitor_chat_abierto_v1'

export function ChatIaWidget({
  materias,
  materiaSeleccionadaId,
  estudiantes = [],
  rendimientosPorMateria = {},
  estudiantePreseleccionado = null,
  abiertoExterno,
  desactivado = false,
  modoPanelLateral = false,
  dockGlobal = false,
  onCerrar,
  onAbrir,
  onLimpiarPreseleccion,
}: ChatIaWidgetProps) {
  const { user } = useAuth()
  const primerNombre = obtenerPrimerNombre(user?.nombreCompleto)
  const navigate = useNavigate()
  const [abiertoInterno, setAbiertoInterno] = useState(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEY_ABIERTO) === '1'
    } catch {
      return false
    }
  })
  const abierto = abiertoExterno !== undefined ? abiertoExterno : abiertoInterno

  const setAbierto = (val: boolean) => {
    setAbiertoInterno(val)
    try {
      if (val) sessionStorage.setItem(STORAGE_KEY_ABIERTO, '1')
      else sessionStorage.removeItem(STORAGE_KEY_ABIERTO)
    } catch {
      // Ignorar si sessionStorage no esta disponible
    }
    if (val && onAbrir) onAbrir()
    if (!val && onCerrar) onCerrar()
  }

  const [materiaId, setMateriaId] = useState<number>(
    materiaSeleccionadaId || materias[0]?.id || 1
  )

  const cargarEstadoGuardado = () => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY_CHAT_GLOBAL)
      if (raw) {
        const parsed = JSON.parse(raw) as {
          mensajes?: MensajeChatUi[]
          estudianteId?: number | null
        }
        if (Array.isArray(parsed.mensajes) && parsed.mensajes.length > 0) {
          return parsed
        }
      }
    } catch {
      // Ignorar JSON corrupto
    }
    return null
  }

  const guardadoInicial = cargarEstadoGuardado()
  const [estudianteId, setEstudianteId] = useState<number | null>(
    estudiantePreseleccionado?.estudianteId ?? guardadoInicial?.estudianteId ?? null
  )
  const [mensajeInput, setMensajeInput] = useState('')
  const [cargando, setCargando] = useState(false)
  const [copiadoId, setCopiadoId] = useState<string | null>(null)
  const [mensajes, setMensajes] = useState<MensajeChatUi[]>(
    guardadoInicial?.mensajes || [MENSAJE_BIENVENIDA(primerNombre)]
  )

  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (materiaSeleccionadaId && materiaSeleccionadaId !== materiaId) {
      setMateriaId(materiaSeleccionadaId)
    }
  }, [materiaSeleccionadaId, materiaId])

  useEffect(() => {
    try {
      sessionStorage.setItem(
        STORAGE_KEY_CHAT_GLOBAL,
        JSON.stringify({
          mensajes: mensajes.slice(-30),
          estudianteId,
        })
      )
    } catch {
      // Ignorar limite de cuota
    }
  }, [mensajes, estudianteId])

  useEffect(() => {
    if (estudiantePreseleccionado) {
      setEstudianteId(estudiantePreseleccionado.estudianteId)
      setAbierto(true)
      onLimpiarPreseleccion?.()
    }
  }, [estudiantePreseleccionado, onLimpiarPreseleccion])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [mensajes, cargando])

  const materiaActual = materias.find((m) => m.id === materiaId) || materias[0]
  const estudianteActual = estudiantes.find((e) => e.estudianteId === estudianteId) || null
  const estudiantesEnRiesgoOrdenados = estudiantes
    .filter(estaEvaluado)
    .filter((e) => e.enRiesgo || e.notaFinalParcial < 7)
    .sort((a, b) => a.notaFinalParcial - b.notaFinalParcial)

  async function enviarMensaje(
    textoAEnviar?: string,
    override?: { modo: 'curso' | 'estudiante'; estudianteObj?: ResumenAcademicoEstudianteDto }
  ) {
    const texto = (textoAEnviar || mensajeInput).trim()
    if (!texto || cargando) return

    // Detectar automáticamente si el docente pregunta por otra asignatura (por código o nombre)
    const consultaNorm = normalizarTextoBusqueda(texto)
    const materiaMencionada = materias.find((m) => {
      const codNorm = normalizarTextoBusqueda(m.codigo)
      const nomNorm = normalizarTextoBusqueda(m.nombre)
      return (
        (codNorm && consultaNorm.includes(codNorm)) ||
        (nomNorm.length >= 4 && consultaNorm.includes(nomNorm))
      )
    })
    const materiaEfectiva = materiaMencionada || materiaActual
    const estudiantesEfectivos =
      materiaMencionada && rendimientosPorMateria[materiaMencionada.id]?.length
        ? rendimientosPorMateria[materiaMencionada.id]
        : estudiantes
    if (materiaMencionada && materiaMencionada.id !== materiaId) {
      setMateriaId(materiaMencionada.id)
    }

    const modoEfectivo = override?.modo ?? (override?.estudianteObj || estudianteActual ? 'estudiante' : 'curso')
    const estEfectivo = override?.estudianteObj ?? estudianteActual

    const nuevoMensajeUsuario: MensajeChatUi = {
      id: String(Date.now()),
      rol: 'user',
      texto,
      hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    setMensajes((prev) => [...prev, nuevoMensajeUsuario])
    setMensajeInput('')
    setCargando(true)

    const mapaEfectivo = new Map<number, string>()
    const listaAnon = estudiantesEfectivos.map((e) => {
      const cod = codigoEstudiante(e.estudianteId)
      mapaEfectivo.set(e.estudianteId, cod)
      return { nombres: e.nombres, apellidos: e.apellidos, codigo: cod }
    })
    // Proteger también nombres de otras asignaturas presentes en el hilo global continuo (RNF-02)
    const idsActivos = new Set(estudiantesEfectivos.map((e) => e.estudianteId))
    const listaAnonGlobal = [...listaAnon]
    for (const listaOtraMat of Object.values(rendimientosPorMateria)) {
      for (const e of listaOtraMat) {
        if (!idsActivos.has(e.estudianteId)) {
          idsActivos.add(e.estudianteId)
          listaAnonGlobal.push({ nombres: e.nombres, apellidos: e.apellidos, codigo: '[ESTUDIANTE]' })
        }
      }
    }
    const { anonimizar: anonMsg, desanonimizar: desanonMsg } = crearAnonimizador(listaAnon)
    const { anonimizar: anonHistorial } = crearAnonimizador(listaAnonGlobal)

    const textoAnonimizado = anonMsg(texto)
    const codigosDetectados = textoAnonimizado.match(/\bEST-\d+\b/g)
    let estMencionadoId: number | null = estEfectivo?.estudianteId ?? null
    if (!estMencionadoId && codigosDetectados && codigosDetectados.length === 1) {
      for (const [idEst, cod] of mapaEfectivo.entries()) {
        if (cod === codigosDetectados[0]) {
          estMencionadoId = idEst
          break
        }
      }
    }

    // El navegador ya no envía notas: el agente las obtiene de la API académica con sus herramientas,
    // usando la sesión del docente. Solo viajan la pregunta anonimizada y qué curso y parcial se consultan.
    const parcialId =
      estudiantesEfectivos[0]?.parcialId ??
      materiaEfectiva?.parciales.find((p) => p.numero === 1)?.id ??
      materiaEfectiva?.parciales[0]?.id
    const momento = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    if (!materiaEfectiva || !parcialId) {
      setMensajes((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          rol: 'assistant',
          texto: 'Selecciona una asignatura con parciales sincronizados para consultar al asistente.',
          hora: momento(),
          esError: true,
        },
      ])
      setCargando(false)
      return
    }

    const payload = {
      modo: modoEfectivo,
      mensaje: textoAnonimizado,
      historial: mensajes
        .filter((m) => !m.esError)
        .slice(-20)
        .map((m) => ({ rol: m.rol, contenido: anonHistorial(m.texto) })),
      cursoId: materiaEfectiva.id,
      parcialId,
      estudianteCodigo: estEfectivo ? codigoEstudiante(estEfectivo.estudianteId) : null,
    }

    try {
      const { data } = await clienteAxios.post('/agent/chat', payload, { timeout: 35000 })
      const sugerencias = Array.isArray(data.sugerenciasSeguimiento)
        ? (data.sugerenciasSeguimiento as string[]).map((s) => desanonMsg(s))
        : []
      const respuestaIa: MensajeChatUi = {
        id: String(Date.now() + 1),
        rol: 'assistant',
        texto: desanonMsg(data.respuesta || 'Análisis completado.'),
        hora: momento(),
        esFallback: data.esFallback,
        herramientas: Array.isArray(data.toolsEjecutadas) ? (data.toolsEjecutadas as string[]) : [],
        tiempoMs: data.tiempoRespuestaMs,
        modoMensaje: estMencionadoId ? 'estudiante' : modoEfectivo,
        estudianteIdMensaje: estMencionadoId,
        materiaIdMensaje: materiaEfectiva.id,
        sugerencias,
      }
      setMensajes((prev) => [...prev, respuestaIa])
    } catch (error) {
      // Sin respuesta del agente no se fabrica un análisis local: se informa el fallo.
      setMensajes((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          rol: 'assistant',
          texto: `No se pudo completar la consulta: ${mensajeErrorChat(error)} No se generó ningún análisis; puedes intentarlo de nuevo.`,
          hora: momento(),
          esError: true,
        },
      ])
    } finally {
      setCargando(false)
    }
  }

  const analizarEstudianteDirecto = (est: ResumenAcademicoEstudianteDto) => {
    setEstudianteId(est.estudianteId)
    enviarMensaje(
      `¿En qué tema y actividad específica está mal ${est.apellidos} ${est.nombres} y qué refuerzo sugieres?`,
      { modo: 'estudiante', estudianteObj: est }
    )
  }

  return (
    <>
      {!abierto && (
        <button
          onClick={() => {
            if (desactivado) return
            setAbierto(true)
          }}
          disabled={desactivado}
          className={`ai-fab-btn ${desactivado ? 'opacity-50 cursor-not-allowed' : ''}`}
          title={
            desactivado
              ? 'Asistente IA deshabilitado: requiere conexión con servidor oficial'
              : 'Abrir Asistente IA SISRA'
          }
        >
          <span className="ai-fab-orb" />
        </button>
      )}

      {abierto && (
        <div
          className={
            dockGlobal
              ? 'fixed inset-y-0 right-0 z-50 w-full sm:w-[384px] h-full shadow-2xl lg:static lg:z-auto lg:w-full lg:h-full lg:shadow-none bg-white border-l border-[#e5e7eb] flex flex-col overflow-hidden'
              : modoPanelLateral
              ? 'fixed bottom-6 right-6 z-50 w-[95vw] sm:w-[440px] h-[640px] max-h-[88vh] shadow-2xl xl:static xl:z-auto xl:w-full xl:h-[calc(100vh-115px)] xl:max-h-none xl:sticky xl:top-4 xl:shadow-xs bg-white border border-[#e5e7eb] flex flex-col overflow-hidden'
              : 'fixed bottom-6 right-6 z-50 w-[95vw] sm:w-[440px] h-[640px] max-h-[88vh] bg-white shadow-2xl border border-[#e5e7eb] flex flex-col overflow-hidden'
          }
        >
          {/* Cabecera limpia SISRA IA */}
          <div className="bg-white text-black px-3.5 py-3 border-b border-[#eef0f3] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="ai-orb" />
              <h3 className="font-semibold text-[13px] tracking-tight text-black font-display">
                SISRA IA
              </h3>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setEstudianteId(null)
                  setMensajes([MENSAJE_BIENVENIDA(primerNombre)])
                  try {
                    sessionStorage.removeItem(STORAGE_KEY_CHAT_GLOBAL)
                  } catch {
                    // Ignorar
                  }
                }}
                title="Nueva conversación"
                className="p-1.5 text-black hover:bg-[#f4f5f7] transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setAbierto(false)}
                title="Cerrar panel"
                className="p-1.5 text-black hover:bg-[#f4f5f7] transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Área de Mensajes */}
          <div ref={scrollRef} className="flex-1 p-4 overflow-y-auto space-y-3 bg-white text-xs">
            {mensajes.length === 1 &&
            (mensajes[0].id === 'bienvenida' || mensajes[0].id === 'reinicio') &&
            !cargando ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-5 py-6 gap-2.5">
                <span className="ai-orb-lg" />
                <div className="text-[15px] font-bold text-black font-display">
                  SISRA IA
                </div>
                <div className="text-[13px] text-black leading-relaxed max-w-[250px]">
                  Hola, {primerNombre}. ¿En qué te ayudo hoy?
                </div>
              </div>
            ) : (
              mensajes.map((m, idx) => {
              const esUltimoAsistente = m.rol === 'assistant' && idx === mensajes.length - 1 && m.id !== 'bienvenida' && m.id !== 'reinicio'
              return (
                <div
                  key={m.id}
                  className={`flex gap-2 ${m.rol === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {m.rol === 'assistant' && (
                    <div className="w-6 h-6 rounded-full bg-[#8B151A]/10 text-[#8B151A] flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-3.5 h-3.5" />
                    </div>
                  )}

                  <div
                    className={`max-w-[90%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
                      m.rol === 'user'
                        ? 'bg-[#8B151A] text-white rounded-br-none shadow-xs'
                        : 'bg-white text-[#18181b] border border-[#e4e4e7] rounded-bl-none shadow-xs space-y-2'
                    }`}
                  >
                    {m.rol === 'user' ? (
                      <p className="whitespace-pre-wrap">{m.texto}</p>
                    ) : (
                      <MensajeAsistenteFormateado texto={m.texto} />
                    )}

                    {/* Acciones y sugerencias contextuales generadas según la respuesta */}
                    {esUltimoAsistente && !cargando && m.sugerencias && m.sugerencias.length > 0 && (
                      <div className="pt-2 border-t border-[#f4f4f5] space-y-1.5">
                        <p className="text-[10px] font-semibold text-[#71717a] flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-[#8B151A]" />
                          Sugerencias según esta consulta:
                        </p>
                        <div className="flex flex-col gap-1">
                          {m.sugerencias.map((sug, sIdx) => (
                            <button
                              key={sIdx}
                              type="button"
                              onClick={() => enviarMensaje(sug)}
                              className="w-full text-left inline-flex items-center justify-between gap-2 text-[10.5px] font-medium bg-[#f4f4f5]/80 hover:bg-[#8B151A]/10 hover:text-[#8B151A] text-[#27272a] px-2.5 py-1.5 rounded-md border border-[#e4e4e7] transition cursor-pointer"
                            >
                              <span className="leading-snug">{sug}</span>
                              <ArrowRight className="w-3 h-3 shrink-0 opacity-60" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {esUltimoAsistente && !cargando && m.modoMensaje === 'curso' && estudiantesEnRiesgoOrdenados.length > 0 && (
                      <div className="pt-1.5 border-t border-[#f4f4f5] space-y-1">
                        <p className="text-[10px] font-semibold text-[#71717a]">
                          Profundizar por tema en un estudiante:
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {estudiantesEnRiesgoOrdenados.slice(0, 4).map((est) => (
                            <button
                              key={est.estudianteId}
                              type="button"
                              onClick={() => analizarEstudianteDirecto(est)}
                              className="inline-flex items-center gap-1 text-[10px] font-medium bg-[#f4f4f5] hover:bg-[#8B151A] hover:text-white text-[#18181b] px-2 py-0.5 rounded border border-[#e4e4e7] transition cursor-pointer"
                            >
                              <span>{est.apellidos.split(' ')[0]} ({est.notaFinalParcial.toFixed(2)})</span>
                              <ArrowRight className="w-2.5 h-2.5" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {esUltimoAsistente && !cargando && m.modoMensaje === 'estudiante' && m.estudianteIdMensaje && (
                      <div className="pt-1.5 border-t border-[#f4f4f5] flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            try {
                              sessionStorage.setItem(STORAGE_KEY_ABIERTO, '1')
                            } catch {
                              // Ignorar
                            }
                            navigate(`/tutoria?materia=${m.materiaIdMensaje || materiaActual?.id || 1}&estudiante=${m.estudianteIdMensaje}`)
                          }}
                          className="inline-flex items-center gap-1 text-[10px] font-semibold bg-[#8B151A]/10 hover:bg-[#8B151A] hover:text-white text-[#8B151A] px-2.5 py-1 rounded transition cursor-pointer"
                        >
                          <FileText className="w-3 h-3" />
                          <span>Generar Plan Oficial y PDF en Tutoría</span>
                        </button>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <span
                        className={`text-[9px] font-medium ${
                          m.rol === 'assistant' && m.id !== 'bienvenida' && m.id !== 'reinicio'
                            ? m.esError
                              ? 'text-[#b91c1c]'
                              : m.esFallback
                                ? 'text-amber-700'
                                : 'text-emerald-700'
                            : 'text-[#71717a]'
                        }`}
                        title={
                          m.herramientas && m.herramientas.length > 0
                            ? `Datos de la API académica: ${m.herramientas.map((h) => NOMBRE_HERRAMIENTA[h] ?? h).join(', ')}`
                            : undefined
                        }
                      >
                        {m.rol === 'assistant' && m.id !== 'bienvenida' && m.id !== 'reinicio'
                          ? m.esError
                            ? 'Sin respuesta del asistente'
                            : `${m.esFallback ? 'Motor local con datos reales' : '✨ Gemini IA'}${
                                m.herramientas && m.herramientas.length > 0
                                  ? ` · ${m.herramientas.length} consulta${m.herramientas.length === 1 ? '' : 's'} a la API`
                                  : ''
                              }${m.tiempoMs ? ` · ${(m.tiempoMs / 1000).toFixed(1)}s` : ''}`
                          : ''}
                      </span>
                      <div className="flex items-center gap-2 ml-auto">
                        {m.rol === 'assistant' && m.id !== 'bienvenida' && m.id !== 'reinicio' && (
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(m.texto).catch(() => {})
                              setCopiadoId(m.id)
                              setTimeout(() => setCopiadoId((prev) => (prev === m.id ? null : prev)), 2000)
                            }}
                            title="Copiar respuesta para Tutoría o Moodle"
                            className="inline-flex items-center gap-1 text-[9.5px] font-medium text-[#71717a] hover:text-[#8B151A] transition cursor-pointer"
                          >
                            {copiadoId === m.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span className="text-emerald-700">Copiado</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copiar</span>
                              </>
                            )}
                          </button>
                        )}
                        <span
                          className={`text-[9px] ${
                            m.rol === 'user' ? 'text-white/70' : 'text-[#a1a1aa]'
                          }`}
                        >
                          {m.hora}
                        </span>
                      </div>
                    </div>
                  </div>

                  {m.rol === 'user' && (
                    <div className="w-6 h-6 rounded-full bg-[#8B151A] text-white flex items-center justify-center shrink-0 mt-0.5">
                      <User className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              )
            })
            )}

            {cargando && (
              <div className="flex gap-2 items-center text-[#71717a] text-xs py-1">
                <div className="w-6 h-6 rounded-full bg-[#8B151A]/10 text-[#8B151A] flex items-center justify-center">
                  <Bot className="w-3.5 h-3.5 animate-spin" />
                </div>
                <span className="italic animate-pulse">Analizando notas por actividad y tema...</span>
              </div>
            )}
          </div>

          {/* Caja de Entrada */}
          <div className="p-2.5 bg-white border-t border-[#e4e4e7] space-y-1.5">
            {estudianteActual && (
              <div className="flex items-center justify-between gap-2 bg-[#8B151A]/5 border border-[#8B151A]/20 rounded-md px-2 py-1 text-[10px]">
                <div className="flex items-center gap-1.5 min-w-0">
                  <GraduationCap className="w-3.5 h-3.5 text-[#8B151A] shrink-0" />
                  <span className="font-semibold text-[#18181b] truncate">
                    {estudianteActual.apellidos} {estudianteActual.nombres}
                  </span>
                  <span
                    className={`font-bold px-1.5 py-0.2 rounded shrink-0 ${
                      estudianteActual.enRiesgo
                        ? 'bg-red-100 text-red-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {estudianteActual.notaFinalParcial.toFixed(2)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setEstudianteId(null)}
                  title="Quitar enfoque de estudiante"
                  className="text-[#71717a] hover:text-[#8B151A] font-bold px-1 cursor-pointer shrink-0"
                >
                  ×
                </button>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault()
                enviarMensaje()
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={mensajeInput}
                onChange={(e) => setMensajeInput(e.target.value)}
                placeholder="Escribe un mensaje..."
                disabled={cargando}
                className="flex-1 bg-[#f4f5f7] border border-[#e5e7eb] px-3 py-2 text-xs text-black focus:outline-none focus:border-[#2563eb] focus:bg-white transition"
              />
              <button
                type="submit"
                disabled={cargando || !mensajeInput.trim()}
                className="p-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white disabled:opacity-50 transition cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>

            <div className="mt-1.5 flex items-start gap-1 text-[9px] text-[#71717a] leading-tight">
              <AlertCircle className="w-3 h-3 text-[#a1a1aa] shrink-0 mt-0.5" />
              <span>
                Orientativo (RNF-08 / RNF-02). Contexto anonimizado. Por privacidad, no ingrese nombres o datos sensibles en el texto libre.
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default ChatIaWidget
