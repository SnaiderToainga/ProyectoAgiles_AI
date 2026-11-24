import { useState, useRef, useEffect } from 'react'
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
  const [abiertoInterno, setAbiertoInterno] = useState(false)
  const abierto = abiertoExterno !== undefined ? abiertoExterno : abiertoInterno

  const setAbierto = (val: boolean) => {
    setAbiertoInterno(val)
    if (val && onAbrir) onAbrir()
    if (!val && onCerrar) onCerrar()
  }

  const [modo, setModo] = useState<'curso' | 'estudiante'>('curso')
  const [materiaId, setMateriaId] = useState<number>(
    materiaSeleccionadaId || materias[0]?.id || 1
  )
  const [estudianteId, setEstudianteId] = useState<number | null>(
    estudiantePreseleccionado?.estudianteId || null
  )
  const [mensajeInput, setMensajeInput] = useState('')
  const [cargando, setCargando] = useState(false)
  const [mensajes, setMensajes] = useState<MensajeChatUi[]>([
    {
      id: 'bienvenida',
      rol: 'assistant',
      texto:
        '¡Hola, estimado docente! Soy el Asistente Pedagógico de EduMonitor AI. Puedo ayudarte a analizar el rendimiento global del curso o formular planes de tutoría específicos para cada estudiante.',
      hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ])

  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (materiaSeleccionadaId) {
      setMateriaId(materiaSeleccionadaId)
    }
  }, [materiaSeleccionadaId])

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

  const preguntasSugeridas =
    modo === 'curso'
      ? [
          '¿Qué estudiantes están en riesgo académico (< 7.00)?',
          '¿Cuál es el componente de evaluación más deficiente en el curso?',
          'Resumen de aprobación y notas generales del curso.',
          '¿Qué temas requieren una clase de refuerzo urgente?',
        ]
      : [
          '¿Cuál es el diagnóstico pedagógico y de refuerzo de este estudiante?',
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

  async function enviarMensaje(textoAEnviar?: string) {
    const texto = (textoAEnviar || mensajeInput).trim()
    if (!texto || cargando) return

    const nuevoMensajeUsuario: MensajeChatUi = {
      id: String(Date.now()),
      rol: 'user',
      texto,
      hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    setMensajes((prev) => [...prev, nuevoMensajeUsuario])
    setMensajeInput('')
    setCargando(true)

    // Preparar contexto para la IA
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

    const estudianteDto = estudianteActual
      ? {
          codigo: mapaEstudianteIdACodigo.get(estudianteActual.estudianteId) || 'EST-001',
          notaFinal: estudianteActual.notaFinalParcial,
          enRiesgo: estudianteActual.enRiesgo,
          componentes: componentesReales(estudianteActual),
          temasDeficientes: estudianteActual.temasDeficientes.map((t) => t.nombreTema),
        }
      : null

    const payload = {
      modo,
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
      }
      setMensajes((prev) => [...prev, respuestaIa])
    } catch {
      // Fallback local determinista si la API no está en línea
      let respuestaLocal = ''
      if (modo === 'curso') {
        const enRiesgo = estudiantes.filter((e) => e.enRiesgo)
        respuestaLocal = `Actualmente en ${materiaActual?.nombre || 'el curso'}, hay ${enRiesgo.length} estudiante(s) en riesgo de un total de ${estudiantes.length}. `
        if (enRiesgo.length > 0) {
          respuestaLocal += `Los estudiantes con promedio menor a 7.00 son:\n`
          enRiesgo.forEach((e) => {
            const temas = e.temasDeficientes.map((t) => t.nombreTema).join(', ')
            respuestaLocal += `• ${e.apellidos} ${e.nombres}: ${e.notaFinalParcial.toFixed(2)} pts${
              temas ? ` (Temas: ${temas})` : ''
            }\n`
          })
        } else {
          respuestaLocal += 'Todos los estudiantes registrados tienen promedio aprobatorio (≥ 7.00).'
        }
      } else if (estudianteActual) {
        respuestaLocal = `Diagnóstico de ${estudianteActual.apellidos} ${estudianteActual.nombres}:\n`
        respuestaLocal += `• Nota actual: ${estudianteActual.notaFinalParcial.toFixed(2)} / 10.00 pts (${
          estudianteActual.enRiesgo ? 'En Riesgo Académico' : 'Aprobado'
        }).\n`
        if (estudianteActual.temasDeficientes.length > 0) {
          respuestaLocal += `• Temas críticos donde reprobó: ${estudianteActual.temasDeficientes
            .map((t) => t.nombreTema)
            .join(', ')}.\n`
          respuestaLocal += `• Recomendación: Programar 4 horas de tutoría práctica enfocada en estos contenidos.`
        } else {
          respuestaLocal += '• No registra temas con deficiencias críticas identificadas.'
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
      }
      setMensajes((prev) => [...prev, respuestaFallback])
    } finally {
      setCargando(false)
    }
  }

  return (
    <>
      {/* Botón Flotante para Abrir Chat (Superpuesto garantizado con fixed y z-[9999]) */}
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
          <span className="text-xs font-bold tracking-wide pr-1">
            Tutor IA
          </span>
        </button>
      )}

      {/* Ventana Flotante del Chat */}
      {abierto && (
        <div
          style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999 }}
          className="w-[95vw] sm:w-[430px] h-[600px] max-h-[85vh] bg-white rounded-xl shadow-2xl border border-[#e4e4e7] flex flex-col overflow-hidden"
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
                onClick={() =>
                  setMensajes([
                    {
                      id: 'reinicio',
                      rol: 'assistant',
                      texto: 'Conversación reiniciada. ¿En qué puedo asistirte ahora?',
                      hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    },
                  ])
                }
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

          {/* Selector de Modo y Filtros de Contexto */}
          <div className="p-2.5 bg-[#f4f4f5] border-b border-[#e4e4e7] flex flex-col gap-2 text-xs">
            {/* Toggle de Modo: Curso vs Estudiante */}
            <div className="grid grid-cols-2 bg-[#e4e4e7] p-0.5 rounded-md">
              <button
                onClick={() => setModo('curso')}
                className={`py-1 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
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
                className={`py-1 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                  modo === 'estudiante'
                    ? 'bg-white text-[#8B151A] shadow-xs'
                    : 'text-[#71717a] hover:text-[#18181b]'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                Por Estudiante
              </button>
            </div>

            {/* Selectores según modo */}
            {modo === 'estudiante' ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-[#71717a] font-medium whitespace-nowrap">
                  Alumno:
                </span>
                <select
                  value={estudianteId || ''}
                  onChange={(e) => setEstudianteId(Number(e.target.value))}
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
            ) : (
              <div className="flex items-center justify-between text-[11px] text-[#71717a]">
                <span>
                  Contexto: <b>{estudiantes.length}</b> alumnos cargados
                </span>
                <span className="text-red-700 font-semibold">
                  {estudiantes.filter((e) => e.enRiesgo).length} en riesgo
                </span>
              </div>
            )}
          </div>

          {/* Área de Mensajes */}
          <div ref={scrollRef} className="flex-1 p-3.5 overflow-y-auto space-y-3 bg-[#fafafa] text-xs">
            {mensajes.map((m) => (
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
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
                    m.rol === 'user'
                      ? 'bg-[#8B151A] text-white rounded-br-none shadow-xs'
                      : 'bg-white text-[#18181b] border border-[#e4e4e7] rounded-bl-none shadow-xs'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.texto}</p>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    {m.esFallback && (
                      <span className="text-[9px] text-amber-700 bg-amber-50 px-1 rounded border border-amber-200">
                        Motor de Reglas Local
                      </span>
                    )}
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
            ))}

            {cargando && (
              <div className="flex gap-2 items-center text-[#71717a] text-xs py-1">
                <div className="w-6 h-6 rounded-full bg-[#8B151A]/10 text-[#8B151A] flex items-center justify-center">
                  <Bot className="w-3.5 h-3.5 animate-spin" />
                </div>
                <span className="italic animate-pulse">Analizando vacíos formativos con IA pedagógica...</span>
              </div>
            )}
          </div>

          {/* Preguntas Sugeridas (Quick Prompts) */}
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
                    ? 'Pregunta sobre notas, componentes o riesgo...'
                    : 'Pregunta sobre el refuerzo del estudiante...'
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

            {/* Aviso Ético RNF-08 / RNF-02 */}
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
