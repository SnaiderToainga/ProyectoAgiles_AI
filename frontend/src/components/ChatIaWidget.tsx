import { useState, useRef, useEffect, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X,
  Send,
  Sparkles,
  Bot,
  User,
  GraduationCap,
  BookOpen,
  AlertCircle,
  RotateCcw,
  CheckCircle2,
  Lightbulb,
  Compass,
  ArrowRight,
  FileText,
} from 'lucide-react'
import clienteAxios from '../api/clienteAxios'
import { crearAnonimizador } from '../utils/anonimizador'
import {
  NOMBRE_COMPONENTE,
  type MateriaDto,
  type ResumenAcademicoEstudianteDto,
} from '../types/academico'

export interface MensajeChatUi {
  id: string
  rol: 'user' | 'assistant'
  texto: string
  hora: string
  esFallback?: boolean
  tiempoMs?: number
  modoMensaje?: 'curso' | 'estudiante'
  estudianteIdMensaje?: number | null
}

interface ChatIaWidgetProps {
  materias: MateriaDto[]
  materiaSeleccionadaId?: number
  estudiantes?: ResumenAcademicoEstudianteDto[]
  estudiantePreseleccionado?: ResumenAcademicoEstudianteDto | null
  abiertoExterno?: boolean
  desactivado?: boolean
  onCerrar?: () => void
  onAbrir?: () => void
}

interface SeccionRespuesta {
  titulo: string
  tipo: 'hechos' | 'inferencias' | 'recomendaciones' | 'general'
  lineas: string[]
}

function renderInlineMarkdown(texto: string): ReactNode[] {
  const partes = texto.split(/(\*\*[^*]+\*\*)/g)
  return partes.map((parte, idx) => {
    if (parte.startsWith('**') && parte.endsWith('**') && parte.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-[#18181b]">
          {parte.slice(2, -2)}
        </strong>
      )
    }
    return <span key={idx}>{parte}</span>
  })
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

function MensajeAsistenteFormateado({ texto }: { texto: string }) {
  const secciones = parsearSeccionesRespuesta(texto)

  if (secciones.length <= 1 && secciones[0]?.tipo === 'general') {
    return (
      <div className="space-y-1.5 text-xs leading-relaxed text-[#27272a]">
        {secciones[0].lineas.map((linea, i) => {
          const esLista = /^[-*•]\s+/.test(linea)
          const contenido = esLista ? linea.replace(/^[-*•]\s+/, '') : linea
          return esLista ? (
            <div key={i} className="flex items-start gap-1.5 pl-1">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#8B151A] shrink-0" />
              <span>{renderInlineMarkdown(contenido)}</span>
            </div>
          ) : (
            <p key={i}>{renderInlineMarkdown(contenido)}</p>
          )
        })}
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
              {sec.lineas.map((linea, i) => {
                const esLista = /^[-*•]\s+/.test(linea)
                const contenido = esLista ? linea.replace(/^[-*•]\s+/, '') : linea
                return esLista ? (
                  <div key={i} className="flex items-start gap-1.5">
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-current opacity-60 shrink-0" />
                    <span>{renderInlineMarkdown(contenido)}</span>
                  </div>
                ) : (
                  <p key={i}>{renderInlineMarkdown(contenido)}</p>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

const MENSAJE_BIENVENIDA = (): MensajeChatUi => ({
  id: 'bienvenida',
  rol: 'assistant',
  texto:
    'Hola, docente. Puedo analizar el rendimiento del curso por componente y por tema curricular, o profundizar en las actividades específicas donde cada estudiante necesita refuerzo.',
  hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
})

const storageKeyChat = (matId: number) => `edumonitor_chat_v1_${matId}`
const STORAGE_KEY_ABIERTO = 'edumonitor_chat_abierto_v1'

export function ChatIaWidget({
  materias,
  materiaSeleccionadaId,
  estudiantes = [],
  estudiantePreseleccionado = null,
  abiertoExterno,
  desactivado = false,
  onCerrar,
  onAbrir,
}: ChatIaWidgetProps) {
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

  const cargarEstadoGuardado = (matId: number) => {
    try {
      const raw = sessionStorage.getItem(storageKeyChat(matId))
      if (raw) {
        const parsed = JSON.parse(raw) as {
          mensajes?: MensajeChatUi[]
          modo?: 'curso' | 'estudiante'
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

  const guardadoInicial = cargarEstadoGuardado(materiaId)
  const [modo, setModo] = useState<'curso' | 'estudiante'>(guardadoInicial?.modo || 'curso')
  const [estudianteId, setEstudianteId] = useState<number | null>(
    estudiantePreseleccionado?.estudianteId ?? guardadoInicial?.estudianteId ?? null
  )
  const [mensajeInput, setMensajeInput] = useState('')
  const [cargando, setCargando] = useState(false)
  const [mensajes, setMensajes] = useState<MensajeChatUi[]>(
    guardadoInicial?.mensajes || [MENSAJE_BIENVENIDA()]
  )

  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (materiaSeleccionadaId && materiaSeleccionadaId !== materiaId) {
      setMateriaId(materiaSeleccionadaId)
      const prev = cargarEstadoGuardado(materiaSeleccionadaId)
      if (prev) {
        setMensajes(prev.mensajes || [MENSAJE_BIENVENIDA()])
        setModo(prev.modo || 'curso')
        setEstudianteId(prev.estudianteId ?? null)
      } else {
        setMensajes([MENSAJE_BIENVENIDA()])
        setModo('curso')
        setEstudianteId(null)
      }
    }
  }, [materiaSeleccionadaId, materiaId])

  useEffect(() => {
    try {
      sessionStorage.setItem(
        storageKeyChat(materiaId),
        JSON.stringify({
          mensajes: mensajes.slice(-30),
          modo,
          estudianteId,
        })
      )
    } catch {
      // Ignorar limite de cuota
    }
  }, [mensajes, modo, estudianteId, materiaId])

  useEffect(() => {
    if (estudiantePreseleccionado) {
      setEstudianteId(estudiantePreseleccionado.estudianteId)
      setModo('estudiante')
      setAbierto(true)
    }
  }, [estudiantePreseleccionado])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [mensajes, cargando])

  const materiaActual = materias.find((m) => m.id === materiaId) || materias[0]
  const estudianteActual = estudiantes.find((e) => e.estudianteId === estudianteId) || null
  const estudiantesEnRiesgoOrdenados = [...estudiantes]
    .filter((e) => e.enRiesgo || e.notaFinalParcial < 7)
    .sort((a, b) => a.notaFinalParcial - b.notaFinalParcial)

  const preguntasSugeridas =
    modo === 'curso'
      ? [
          '¿Qué estudiantes están en riesgo académico (< 7.00)?',
          '¿En qué tema específico tiene mayor dificultad el curso?',
          '¿Cuál es el componente de evaluación más deficiente?',
          'Resumen de aprobación y notas generales del curso.',
        ]
      : [
          '¿En qué tema y actividad específica está mal este estudiante?',
          '¿Qué componentes debe recuperar prioritariamente?',
          'Sugiere un plan semanal de estudio para este estudiante.',
        ]

  // Extraer componentes evaluativos reales con calificaciones efectivas (excluye ceros de componentes sin evaluar)
  const componentesReales = (e: ResumenAcademicoEstudianteDto): Record<string, number> => {
    if (!e.componentes) return {}
    return Object.fromEntries(
      e.componentes
        .filter((c) => c.evaluaciones && c.evaluaciones.some((ev) => ev.nota !== null))
        .map((c) => [NOMBRE_COMPONENTE[c.tipo] || String(c.tipo), Number(c.promedioComponente.toFixed(2))])
    )
  }

  // Extraer actividades individuales con su nota y temas asociados para análisis granular (RNF-02 sin PII)
  const evaluacionesDetalladas = (e: ResumenAcademicoEstudianteDto) => {
    if (!e.componentes) return []
    return e.componentes.flatMap((c) =>
      (c.evaluaciones || [])
        .filter((ev) => ev.nota !== null)
        .map((ev) => ({
          nombre: ev.nombre,
          componente: NOMBRE_COMPONENTE[c.tipo] || String(c.tipo),
          nota: Number((ev.nota ?? 0).toFixed(2)),
          temas: (ev.temas || []).map((t) => t.nombre),
        }))
    )
  }

  // Anonimizador local robusto exclusivo del navegador (RNF-02)
  const mapaEstudianteIdACodigo = new Map<number, string>()
  const estudiantesParaAnonimizar = estudiantes.map((e, idx) => {
    const cod = `EST-${String(idx + 1).padStart(3, '0')}`
    mapaEstudianteIdACodigo.set(e.estudianteId, cod)
    return {
      nombres: e.nombres,
      apellidos: e.apellidos,
      codigo: cod,
    }
  })

  const { anonimizar: anonimizarTexto, desanonimizar: desanonimizarTexto } =
    crearAnonimizador(estudiantesParaAnonimizar)

  async function enviarMensaje(
    textoAEnviar?: string,
    override?: { modo: 'curso' | 'estudiante'; estudianteObj?: ResumenAcademicoEstudianteDto }
  ) {
    const texto = (textoAEnviar || mensajeInput).trim()
    if (!texto || cargando) return

    const modoEfectivo = override?.modo ?? modo
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

    const contextoCurso = materiaActual
      ? {
          materia: materiaActual.nombre,
          codigo: materiaActual.codigo,
          semestre: materiaActual.semestre,
          promedioGeneral:
            estudiantes.length > 0
              ? Number(
                  (
                    estudiantes.reduce((acc, e) => acc + e.notaFinalParcial, 0) /
                    estudiantes.length
                  ).toFixed(2)
                )
              : 0,
          totalEstudiantes: estudiantes.length,
          estudiantesEnRiesgo: estudiantes.filter((e) => e.enRiesgo).length,
          aprobados: estudiantes.filter((e) => !e.enRiesgo).length,
        }
      : null

    const estudianteDto = estEfectivo
      ? {
          codigo: mapaEstudianteIdACodigo.get(estEfectivo.estudianteId) || 'EST-001',
          notaFinal: estEfectivo.notaFinalParcial,
          enRiesgo: estEfectivo.enRiesgo,
          componentes: componentesReales(estEfectivo),
          temasDeficientes: estEfectivo.temasDeficientes.map((t) => t.nombreTema),
          evaluaciones: evaluacionesDetalladas(estEfectivo),
        }
      : null

    const payload = {
      modo: modoEfectivo,
      mensaje: anonimizarTexto(texto),
      historial: mensajes.map((m) => ({ rol: m.rol, contenido: anonimizarTexto(m.texto) })),
      contextoCurso,
      estudianteSeleccionado: estudianteDto,
      estudiantesCurso: estudiantes.map((e, idx) => ({
        codigo: mapaEstudianteIdACodigo.get(e.estudianteId) || `EST-${String(idx + 1).padStart(3, '0')}`,
        notaFinal: e.notaFinalParcial,
        enRiesgo: e.enRiesgo,
        componentes: componentesReales(e),
        temasDeficientes: e.temasDeficientes.map((t) => t.nombreTema),
        evaluaciones: evaluacionesDetalladas(e),
      })),
    }

    try {
      const { data } = await clienteAxios.post('/agent/chat', payload, { timeout: 35000 })
      const respuestaIa: MensajeChatUi = {
        id: String(Date.now() + 1),
        rol: 'assistant',
        texto: desanonimizarTexto(data.respuesta || 'Análisis completado.'),
        hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        esFallback: data.esFallback,
        tiempoMs: data.tiempoRespuestaMs,
        modoMensaje: modoEfectivo,
        estudianteIdMensaje: estEfectivo?.estudianteId ?? null,
      }
      setMensajes((prev) => [...prev, respuestaIa])
    } catch {
      let respuestaLocal = ''
      if (modoEfectivo === 'curso') {
        const enRiesgo = estudiantes.filter((e) => e.enRiesgo)
        respuestaLocal = `Actualmente en ${materiaActual?.nombre || 'el curso'}, hay ${enRiesgo.length} estudiante(s) en riesgo de un total de ${estudiantes.length}. `
        if (enRiesgo.length > 0) {
          respuestaLocal += `Los estudiantes con promedio menor a 7.00 son:\n`
          enRiesgo.forEach((e) => {
            const temas = e.temasDeficientes.map((t) => t.nombreTema).join(', ')
            respuestaLocal += `- ${e.apellidos} ${e.nombres}: ${e.notaFinalParcial.toFixed(2)} pts${
              temas ? ` (Temas: ${temas})` : ''
            }\n`
          })
        } else {
          respuestaLocal += 'Todos los estudiantes registrados tienen promedio aprobatorio (>= 7.00).'
        }
      } else if (estEfectivo) {
        respuestaLocal = `Diagnóstico de ${estEfectivo.apellidos} ${estEfectivo.nombres}:\n`
        respuestaLocal += `- Nota actual: ${estEfectivo.notaFinalParcial.toFixed(2)} / 10.00 pts (${
          estEfectivo.enRiesgo ? 'En Riesgo Académico' : 'Aprobado'
        }).\n`
        if (estEfectivo.temasDeficientes.length > 0) {
          respuestaLocal += `- Temas críticos: ${estEfectivo.temasDeficientes
            .map((t) => `${t.nombreTema}${t.notaObtenida !== null ? ` (${t.notaObtenida.toFixed(2)})` : ''}`)
            .join(', ')}.\n`
          respuestaLocal += `- Recomendación: Programar 4 horas de tutoría práctica enfocada en estos contenidos.`
        } else {
          respuestaLocal += '- No registra temas con deficiencias críticas identificadas.'
        }
      } else {
        respuestaLocal = 'Por favor selecciona un estudiante del listado superior para ver su diagnóstico individual.'
      }

      const respuestaFallback: MensajeChatUi = {
        id: String(Date.now() + 1),
        rol: 'assistant',
        texto: respuestaLocal,
        hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        esFallback: true,
        modoMensaje: modoEfectivo,
        estudianteIdMensaje: estEfectivo?.estudianteId ?? null,
      }
      setMensajes((prev) => [...prev, respuestaFallback])
    } finally {
      setCargando(false)
    }
  }

  const analizarEstudianteDirecto = (est: ResumenAcademicoEstudianteDto) => {
    setEstudianteId(est.estudianteId)
    setModo('estudiante')
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
          style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999 }}
          className={`${
            desactivado
              ? 'bg-gray-400 opacity-60 cursor-not-allowed'
              : 'bg-[#8B151A] hover:bg-[#6E1014] hover:scale-105 cursor-pointer shadow-2xl'
          } text-white p-3.5 rounded-full transition-all duration-200 flex items-center gap-2 group border-2 border-white`}
          title={
            desactivado
              ? 'Asistente IA deshabilitado: requiere conexión con servidor oficial'
              : 'Abrir Asistente IA SISRA'
          }
        >
          <Sparkles className={`w-5 h-5 ${desactivado ? 'text-gray-200' : 'text-amber-300 animate-pulse'}`} />
          <span className="text-xs font-bold tracking-wide pr-1">Tutor IA</span>
        </button>
      )}

      {abierto && (
        <div
          style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999 }}
          className="w-[95vw] sm:w-[470px] h-[640px] max-h-[88vh] bg-white rounded-xl shadow-2xl border border-[#e4e4e7] flex flex-col overflow-hidden"
        >
          {/* Cabecera */}
          <div className="bg-[#8B151A] text-white p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-white/10 rounded-full">
                <Bot className="w-4 h-4 text-amber-300" />
              </div>
              <div>
                <h3 className="font-bold text-xs tracking-wide flex items-center gap-1.5">
                  Asistente IA EduMonitor
                  <span className="text-[10px] font-normal bg-white/20 px-1.5 py-0.2 rounded">
                    UTA FISEI
                  </span>
                </h3>
                <p className="text-[10px] text-white/80">
                  {materiaActual ? `${materiaActual.codigo} - ${materiaActual.nombre}` : 'Análisis Pedagógico'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  const reinicio: MensajeChatUi[] = [
                    {
                      id: 'reinicio',
                      rol: 'assistant',
                      texto: 'Conversación reiniciada. ¿En qué tema o estudiante deseas enfocarte ahora?',
                      hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    },
                  ]
                  setMensajes(reinicio)
                  try {
                    sessionStorage.removeItem(storageKeyChat(materiaId))
                  } catch {
                    // Ignorar
                  }
                }}
                title="Limpiar conversación"
                className="p-1 text-white/70 hover:text-white rounded hover:bg-white/10 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setAbierto(false)}
                className="p-1 text-white/70 hover:text-white rounded hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Selector de Modo y Contexto */}
          <div className="p-2.5 bg-[#f4f4f5] border-b border-[#e4e4e7] flex flex-col gap-2 text-xs">
            <div className="grid grid-cols-2 bg-[#e4e4e7] p-0.5 rounded-md">
              <button
                onClick={() => setModo('curso')}
                className={`py-1 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  modo === 'curso'
                    ? 'bg-white text-[#8B151A] shadow-xs'
                    : 'text-[#71717a] hover:text-[#18181b]'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                Nivel Curso
              </button>
              <button
                onClick={() => setModo('estudiante')}
                className={`py-1 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  modo === 'estudiante'
                    ? 'bg-white text-[#8B151A] shadow-xs'
                    : 'text-[#71717a] hover:text-[#18181b]'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                Por Estudiante
              </button>
            </div>

            {modo === 'estudiante' ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-[#71717a] font-medium whitespace-nowrap">
                    Alumno:
                  </span>
                  <select
                    value={estudianteId || ''}
                    onChange={(e) => setEstudianteId(Number(e.target.value) || null)}
                    className="w-full bg-white border border-[#d4d4d8] rounded px-2 py-1 text-xs text-[#18181b] focus:outline-none focus:border-[#8B151A]"
                  >
                    <option value="">-- Seleccionar estudiante ({estudiantes.length}) --</option>
                    {estudiantes.map((est) => (
                      <option key={est.estudianteId} value={est.estudianteId}>
                        {est.apellidos} {est.nombres} ({est.notaFinalParcial.toFixed(2)} pts)
                      </option>
                    ))}
                  </select>
                </div>

                {estudianteActual && (
                  <div className="bg-white border border-[#e4e4e7] rounded px-2.5 py-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span
                      className={`font-bold px-1.5 py-0.5 rounded ${
                        estudianteActual.enRiesgo
                          ? 'bg-red-100 text-red-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {estudianteActual.notaFinalParcial.toFixed(2)} / 10
                    </span>
                    {estudianteActual.temasDeficientes.length > 0 ? (
                      <>
                        <span className="text-[#71717a]">Temas críticos:</span>
                        {estudianteActual.temasDeficientes.map((t) => (
                          <span
                            key={t.temaId}
                            className="bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.5 rounded font-medium"
                          >
                            {t.nombreTema}
                            {t.notaObtenida !== null ? ` (${t.notaObtenida.toFixed(2)})` : ''}
                          </span>
                        ))}
                      </>
                    ) : (
                      <span className="text-emerald-700">Sin temas por debajo de 7.00</span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between text-[11px] text-[#71717a]">
                <span>
                  Contexto: <b>{estudiantes.length}</b> alumnos con detalle por actividad y tema
                </span>
                <span className="text-red-700 font-semibold">
                  {estudiantesEnRiesgoOrdenados.length} en riesgo
                </span>
              </div>
            )}
          </div>

          {/* Área de Mensajes */}
          <div ref={scrollRef} className="flex-1 p-3.5 overflow-y-auto space-y-3 bg-[#fafafa] text-xs">
            {mensajes.map((m, idx) => {
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

                    {/* Acciones interactivas contextuales tras la última respuesta */}
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
                            navigate(`/tutoria?materia=${materiaActual?.id || 1}&estudiante=${m.estudianteIdMensaje}`)
                          }}
                          className="inline-flex items-center gap-1 text-[10px] font-semibold bg-[#8B151A]/10 hover:bg-[#8B151A] hover:text-white text-[#8B151A] px-2.5 py-1 rounded transition cursor-pointer"
                        >
                          <FileText className="w-3 h-3" />
                          <span>Generar Plan Oficial y PDF en Tutoría</span>
                        </button>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <span className="text-[9px] text-[#71717a]">
                        {m.rol === 'assistant' && m.id !== 'bienvenida' && m.id !== 'reinicio'
                          ? m.esFallback
                            ? 'Motor Local'
                            : `Gemini${m.tiempoMs ? ` · ${(m.tiempoMs / 1000).toFixed(1)}s` : ''}`
                          : ''}
                      </span>
                      <span
                        className={`text-[9px] block text-right ml-auto ${
                          m.rol === 'user' ? 'text-white/70' : 'text-[#a1a1aa]'
                        }`}
                      >
                        {m.hora}
                      </span>
                    </div>
                  </div>

                  {m.rol === 'user' && (
                    <div className="w-6 h-6 rounded-full bg-[#8B151A] text-white flex items-center justify-center shrink-0 mt-0.5">
                      <User className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              )
            })}

            {cargando && (
              <div className="flex gap-2 items-center text-[#71717a] text-xs py-1">
                <div className="w-6 h-6 rounded-full bg-[#8B151A]/10 text-[#8B151A] flex items-center justify-center">
                  <Bot className="w-3.5 h-3.5 animate-spin" />
                </div>
                <span className="italic animate-pulse">Analizando notas por actividad y tema...</span>
              </div>
            )}
          </div>

          {/* Preguntas Sugeridas */}
          <div className="p-2 bg-white border-t border-[#e4e4e7] overflow-x-auto flex gap-1.5 scrollbar-none">
            {preguntasSugeridas.map((p, idx) => (
              <button
                key={idx}
                onClick={() => enviarMensaje(p)}
                disabled={cargando}
                className="shrink-0 text-[10px] bg-[#f4f4f5] hover:bg-[#8B151A]/10 hover:text-[#8B151A] text-[#52525b] border border-[#e4e4e7] rounded-full px-2.5 py-1 transition cursor-pointer"
              >
                {p}
              </button>
            ))}
          </div>

          {/* Caja de Entrada */}
          <div className="p-2.5 bg-white border-t border-[#e4e4e7]">
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
                placeholder={
                  modo === 'curso'
                    ? 'Pregunta sobre notas, temas o riesgo del curso...'
                    : 'Pregunta en qué tema o actividad reforzar...'
                }
                disabled={cargando}
                className="flex-1 bg-[#f4f4f5] border border-[#d4d4d8] rounded-md px-3 py-1.5 text-xs text-[#18181b] focus:outline-none focus:border-[#8B151A] focus:bg-white transition"
              />
              <button
                type="submit"
                disabled={cargando || !mensajeInput.trim()}
                className="p-2 bg-[#8B151A] hover:bg-[#6E1014] text-white rounded-md disabled:opacity-50 transition cursor-pointer"
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
