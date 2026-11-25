import { useState, useEffect, useMemo, useCallback, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import axios from 'axios'
import {
  Search,
  CalendarCheck,
  FileText,
  Sparkles,
  Edit3,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import clienteAxios from '../api/clienteAxios'
import { useAuth } from '../context/AuthContext'
import { useChatIa } from '../context/ChatIaContext'
import { AvatarEstudiante } from '../components/AvatarEstudiante'
import { exportarPdfReporteIndividual } from '../utils/pdfReportesAcademicos'
import {
  NOMBRE_COMPONENTE,
  type ActualizarPlanRefuerzoRequest,
  type CrearPlanRefuerzoRequest,
  type DetallePlanRefuerzoDto,
  type MateriaDto,
  type PlanRefuerzoDto,
  type ReporteIndividualTutoriaDto,
  type RespuestaPlanIa,
  type ResumenAcademicoEstudianteDto,
  type SolicitudPlanIa,
} from '../types/academico'
import { PrimeraSincronizacionMoodle } from '../components/PrimeraSincronizacionMoodle'

interface CitaTutoriaLocal {
  modalidad: string
  fecha: string
  confirmadaEn: string
}

const STORAGE_KEY_CITAS = 'edumonitor_citas_tutoria_v1'

function cargarCitasGuardadas(): Record<string, CitaTutoriaLocal> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_CITAS)
    return raw ? (JSON.parse(raw) as Record<string, CitaTutoriaLocal>) : {}
  } catch {
    return {}
  }
}

function extraerMensajeErrorApi(error: unknown): string | undefined {
  if (!axios.isAxiosError(error)) return undefined
  const data = error.response?.data
  if (!data || typeof data !== 'object') return undefined
  const payload = data as { detail?: string; title?: string; mensaje?: string }
  return payload.detail || payload.title || payload.mensaje
}

export function TutoriaPage() {
  const { user } = useAuth()
  const { actualizarContextoChat } = useChatIa()
  const [searchParams, setSearchParams] = useSearchParams()
  const materiaQuery = searchParams.get('materia')
  const parcialQuery = searchParams.get('parcial')
  const estudianteQuery = searchParams.get('estudiante')

  const [materias, setMaterias] = useState<MateriaDto[]>([])
  const [materiaActivaId, setMateriaActivaId] = useState<number>(
    materiaQuery ? Number(materiaQuery) : 0
  )
  const [parcialNumero, setParcialNumero] = useState<number>(
    parcialQuery ? Number(parcialQuery) : 1
  )

  const [rendimiento, setRendimiento] = useState<ResumenAcademicoEstudianteDto[]>([])
  const [planesGuardados, setPlanesGuardados] = useState<PlanRefuerzoDto[]>([])
  const [estudianteActivoId, setEstudianteActivoId] = useState<number>(
    estudianteQuery ? Number(estudianteQuery) : 0
  )
  const [detallesAbiertos, setDetallesAbiertos] = useState<number[]>([])

  // Filtros interactivos de estudiantes en riesgo
  const [busquedaAlumno, setBusquedaAlumno] = useState('')
  const [filtroEstadoPlan, setFiltroEstadoPlan] = useState<'todos' | 'con_plan' | 'sin_plan'>('todos')

  const [cargando, setCargando] = useState(true)
  const [cargandoCurso, setCargandoCurso] = useState(false)
  const [generandoIa, setGenerandoIa] = useState(false)
  const [exportandoPdf, setExportandoPdf] = useState(false)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [alertaPlan, setAlertaPlan] = useState<string | null>(null)
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)

  // Modal Editor Tipo Acta PDF con persistencia real en SQL Server
  const [modalEditar, setModalEditar] = useState(false)
  const [diagnosticoEditado, setDiagnosticoEditado] = useState('')
  const [nivelRiesgoEditado, setNivelRiesgoEditado] = useState('Alto')
  const [detallesEditados, setDetallesEditados] = useState<DetallePlanRefuerzoDto[]>([])
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)

  // Modal Agendar Tutoría con persistencia en sesión
  const [modalAgendar, setModalAgendar] = useState(false)
  const [fechaTutoria, setFechaTutoria] = useState('')
  const [modalidadTutoria, setModalidadTutoria] = useState('Presencial (Laboratorios FISEI)')
  const [citasAgendadas, setCitasAgendadas] = useState<Record<string, CitaTutoriaLocal>>(
    cargarCitasGuardadas
  )

  useEffect(() => {
    if (!mensajeExito) return
    const timer = setTimeout(() => setMensajeExito(null), 6000)
    return () => clearTimeout(timer)
  }, [mensajeExito])

  useEffect(() => {
    let vigente = true
    clienteAxios
      .get<MateriaDto[]>('/academico/materias')
      .then(({ data }) => {
        if (!vigente) return
        setMaterias(data)
        if (data.length > 0) {
          const idInicial = materiaQuery ? Number(materiaQuery) : data[0].id
          const existe = data.some((m) => m.id === idInicial)
          setMateriaActivaId(existe ? idInicial : data[0].id)
        }
      })
      .catch(() => {
        if (vigente) {
          setErrorCarga('No se pudieron cargar las asignaturas. Verifica tu sesión y conexión.')
        }
      })
      .finally(() => {
        if (vigente) setCargando(false)
      })
    return () => {
      vigente = false
    }
  }, [materiaQuery])

  const materiaActual = useMemo(
    () => materias.find((m) => m.id === materiaActivaId) || materias[0],
    [materias, materiaActivaId]
  )

  const parcialActual = useMemo(
    () =>
      materiaActual?.parciales.find((p) => p.numero === parcialNumero) ||
      materiaActual?.parciales[0],
    [materiaActual, parcialNumero]
  )

  const cargarTutoriaCurso = useCallback(async (cursoId: number, parcialId: number) => {
    setCargandoCurso(true)
    setAlertaPlan(null)
    setMensajeExito(null)
    try {
      const [resRend, resPlanes] = await Promise.all([
        clienteAxios.get<ResumenAcademicoEstudianteDto[]>(
          `/academico/materias/${cursoId}/parciales/${parcialId}/rendimiento`
        ),
        clienteAxios.get<PlanRefuerzoDto[]>(`/academico/planes/${cursoId}`),
      ])
      setRendimiento(resRend.data)
      setPlanesGuardados(resPlanes.data)
    } catch {
      setAlertaPlan('No se pudo cargar el listado de estudiantes en riesgo ni los planes guardados.')
    } finally {
      setCargandoCurso(false)
    }
  }, [])

  useEffect(() => {
    if (!materiaActual || !parcialActual) return
    cargarTutoriaCurso(materiaActual.id, parcialActual.id)
  }, [materiaActual, parcialActual, cargarTutoriaCurso])

  useEffect(() => {
    if (materias.length === 0) return
    actualizarContextoChat({
      materias,
      materiaId: materiaActual?.id ?? null,
      estudiantes: rendimiento,
      esModoFallback: false,
    })
  }, [materias, materiaActual?.id, rendimiento, actualizarContextoChat])

  const estudiantesEnRiesgo = useMemo(
    () => rendimiento.filter((e) => e.enRiesgo).sort((a, b) => a.notaFinalParcial - b.notaFinalParcial),
    [rendimiento]
  )

  const estudiantesFiltrados = useMemo(() => {
    const q = busquedaAlumno.trim().toLowerCase()
    return estudiantesEnRiesgo.filter((est) => {
      const tienePlan = planesGuardados.some((p) => p.estudianteId === est.estudianteId)
      if (filtroEstadoPlan === 'con_plan' && !tienePlan) return false
      if (filtroEstadoPlan === 'sin_plan' && tienePlan) return false
      if (!q) return true
      return `${est.apellidos} ${est.nombres} ${est.correo}`.toLowerCase().includes(q)
    })
  }, [estudiantesEnRiesgo, planesGuardados, filtroEstadoPlan, busquedaAlumno])

  useEffect(() => {
    if (estudiantesEnRiesgo.length === 0) {
      setEstudianteActivoId(0)
      return
    }
    const existeActual = estudiantesEnRiesgo.some((e) => e.estudianteId === estudianteActivoId)
    if (!existeActual) {
      const desdeQuery = estudianteQuery
        ? estudiantesEnRiesgo.find((e) => e.estudianteId === Number(estudianteQuery))
        : undefined
      setEstudianteActivoId(desdeQuery ? desdeQuery.estudianteId : estudiantesEnRiesgo[0].estudianteId)
    }
  }, [estudiantesEnRiesgo, estudianteActivoId, estudianteQuery])

  const estudianteActual = useMemo(
    () => estudiantesEnRiesgo.find((e) => e.estudianteId === estudianteActivoId),
    [estudiantesEnRiesgo, estudianteActivoId]
  )

  const planActual = useMemo(() => {
    if (!estudianteActual) return undefined
    return planesGuardados.find((p) => p.estudianteId === estudianteActual.estudianteId)
  }, [planesGuardados, estudianteActual])

  useEffect(() => {
    if (planActual && planActual.detalles.length > 0) {
      setDetallesAbiertos(planActual.detalles.map((d) => d.id))
    } else {
      setDetallesAbiertos([])
    }
  }, [planActual])

  const toggleDetalle = (id: number) => {
    setDetallesAbiertos((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const actividadesDeficientesEstudiante = useMemo(() => {
    if (!estudianteActual) return []
    return estudianteActual.componentes
      .flatMap((c) =>
        (c.evaluaciones || [])
          .filter((ev) => ev.nota !== null && ev.nota < 7)
          .map((ev) => ({
            ...ev,
            componenteNombre: NOMBRE_COMPONENTE[c.tipo],
          }))
      )
      .sort((a, b) => (a.nota ?? 0) - (b.nota ?? 0))
  }, [estudianteActual])

  const citaKeyActual =
    materiaActual && parcialActual && estudianteActual
      ? `${materiaActual.id}-${parcialActual.id}-${estudianteActual.estudianteId}`
      : ''
  const citaActual = citaKeyActual ? citasAgendadas[citaKeyActual] : undefined

  const trazabilidadCausal = useMemo(() => {
    if (!estudianteActual) return null
    const tareasDef = estudianteActual.componentes.find((c) => c.tipo === 1)?.esDeficiente
    const apeDef = estudianteActual.componentes.find((c) => c.tipo === 2)?.esDeficiente
    const examenDef = estudianteActual.componentes.find((c) => c.tipo === 3)?.esDeficiente

    if (tareasDef && (apeDef || examenDef)) {
      return {
        clasificacion: 'Brecha Conceptual de Base no Resuelta',
        causaRaiz:
          'El estudiante reprobó tareas formativas iniciales y arrastró la deficiencia conceptual a los trabajos prácticos APE o examen sumativo.',
      }
    } else if (!tareasDef && (apeDef || examenDef)) {
      return {
        clasificacion: 'Dificultad de Aplicación Práctica / Transferencia',
        causaRaiz:
          'El desempeño en tareas teóricas fue satisfactorio, pero evidenció vacíos al aplicar los conceptos en simulaciones APE o pruebas sumativas.',
      }
    } else {
      return {
        clasificacion: 'Deficiencia Formativa en Fase Inicial',
        causaRaiz:
          'Rendimiento por debajo del umbral institucional de aprobación (7.00/10.00) en las evaluaciones ponderadas.',
      }
    }
  }, [estudianteActual])

  const handleAprobarYGenerarPdf = async (diagnosticoPersonalizado?: string) => {
    if (!materiaActual || !parcialActual || !estudianteActual || exportandoPdf) return
    setExportandoPdf(true)
    setAlertaPlan(null)
    try {
      const { data } = await clienteAxios.get<ReporteIndividualTutoriaDto>(
        `/academico/materias/${materiaActual.id}/estudiantes/${estudianteActual.estudianteId}/reporte-tutoria`,
        { params: { parcialId: parcialActual.id } }
      )
      await exportarPdfReporteIndividual(data, diagnosticoPersonalizado ?? planActual?.diagnosticoGeneral)
      setMensajeExito(
        `Informe oficial PDF de tutoría generado para ${estudianteActual.apellidos} ${estudianteActual.nombres}.`
      )
    } catch (error) {
      const detalle = extraerMensajeErrorApi(error)
      setAlertaPlan(detalle || 'No se pudo generar el informe oficial de tutoría en PDF.')
    } finally {
      setExportandoPdf(false)
    }
  }

  const handleAbrirEditar = () => {
    if (!planActual) return
    setDiagnosticoEditado(planActual.diagnosticoGeneral)
    setNivelRiesgoEditado(planActual.nivelRiesgo || 'Alto')
    setDetallesEditados(planActual.detalles.map((d) => ({ ...d })))
    setModalEditar(true)
  }

  const actualizarDetalleEditado = (
    id: number,
    campo: keyof DetallePlanRefuerzoDto,
    valor: string | number
  ) => {
    setDetallesEditados((prev) =>
      prev.map((d) => (d.id === id ? { ...d, [campo]: valor } : d))
    )
  }

  const guardarEdicionEnServidor = async (exportarDespues: boolean) => {
    if (!planActual || guardandoEdicion) return
    setGuardandoEdicion(true)
    setAlertaPlan(null)
    try {
      const payload: ActualizarPlanRefuerzoRequest = {
        diagnosticoGeneral: diagnosticoEditado.trim(),
        nivelRiesgo: nivelRiesgoEditado,
        detalles: detallesEditados.map((d) => ({
          id: d.id,
          actividadSugerida: d.actividadSugerida.trim(),
          prioridad: d.prioridad,
          tiempoEstimadoHoras: Math.max(1, Number(d.tiempoEstimadoHoras) || 2),
          recursoRecomendado: (d.recursoRecomendado || '').trim(),
        })),
      }
      const { data: planActualizado } = await clienteAxios.put<PlanRefuerzoDto>(
        `/academico/planes/${planActual.id}`,
        payload
      )
      setPlanesGuardados((prev) =>
        prev.map((p) => (p.id === planActualizado.id ? planActualizado : p))
      )
      setModalEditar(false)
      setMensajeExito('Cambios guardados en la base de datos y sincronizados con el acta PDF.')
      if (exportarDespues) {
        await handleAprobarYGenerarPdf(planActualizado.diagnosticoGeneral)
      }
    } catch (error) {
      const detalle = extraerMensajeErrorApi(error)
      setAlertaPlan(detalle || 'No se pudieron guardar los cambios del plan en el servidor.')
    } finally {
      setGuardandoEdicion(false)
    }
  }

  const handleGuardarEdicion = async (e: FormEvent) => {
    e.preventDefault()
    await guardarEdicionEnServidor(false)
  }

  const handleAgendarTutoria = (e: FormEvent) => {
    e.preventDefault()
    if (citaKeyActual) {
      const nuevaCita: CitaTutoriaLocal = {
        modalidad: modalidadTutoria,
        fecha: fechaTutoria || 'Horario por confirmar',
        confirmadaEn: new Date().toLocaleString('es-EC'),
      }
      const actualizadas = { ...citasAgendadas, [citaKeyActual]: nuevaCita }
      setCitasAgendadas(actualizadas)
      try {
        sessionStorage.setItem(STORAGE_KEY_CITAS, JSON.stringify(actualizadas))
      } catch {
        // Ignorar limite
      }
    }
    setModalAgendar(false)
    setMensajeExito(
      `Tutoría agendada para ${estudianteActual?.apellidos} ${estudianteActual?.nombres} (${modalidadTutoria}).`
    )
  }

  const buscarUnidadTema = (temaId: number): string => {
    if (!parcialActual) return 'U1'
    for (const unidad of parcialActual.unidades) {
      if (unidad.temas.some((t) => t.id === temaId)) {
        return `U${unidad.numero}`
      }
    }
    return 'U1'
  }

  const generarPlanConIa = async () => {
    if (!materiaActual || !parcialActual || !estudianteActual || generandoIa) return
    setAlertaPlan(null)
    setMensajeExito(null)

    const temasCatalogo = parcialActual.unidades.flatMap((u) =>
      u.temas.map((t) => ({ id: t.id, nombre: t.nombre, unidad: `U${u.numero}` }))
    )

    const temasCriticos =
      estudianteActual.temasDeficientes.length > 0
        ? estudianteActual.temasDeficientes.map((t) => ({
            id: t.temaId,
            nombre: t.nombreTema,
            unidad: buscarUnidadTema(t.temaId),
          }))
        : temasCatalogo.slice(0, 1)

    if (temasCriticos.length === 0) {
      setAlertaPlan('Debe existir al menos un tema registrado en el catálogo del parcial para generar el plan.')
      return
    }

    const payload: SolicitudPlanIa = {
      materia: materiaActual.nombre,
      codigo: materiaActual.codigo,
      parcial: parcialActual.numero,
      promedioPonderado: Number(estudianteActual.notaFinalParcial.toFixed(2)),
      componentesDeficientes: estudianteActual.componentes
        .filter((c) => c.esDeficiente)
        .map((c) => ({
          componente: NOMBRE_COMPONENTE[c.tipo],
          promedio: Number(c.promedioComponente.toFixed(2)),
          ponderacion: Number(c.ponderacion),
        })),
      temasCriticos,
    }

    setGenerandoIa(true)
    try {
      const { data: respuestaIa } = await clienteAxios.post<RespuestaPlanIa>(
        '/agent/generar-plan',
        payload,
        { timeout: 25000 }
      )

      const requestPersistencia: CrearPlanRefuerzoRequest = {
        estudianteId: estudianteActual.estudianteId,
        cursoId: materiaActual.id,
        diagnosticoGeneral: respuestaIa.diagnosticoGeneral,
        nivelRiesgo: respuestaIa.nivelRiesgo,
        esFallback: respuestaIa.esFallback,
        detalles: respuestaIa.detalles,
      }

      await clienteAxios.post('/academico/planes', requestPersistencia)

      const { data: planesActualizados } = await clienteAxios.get<PlanRefuerzoDto[]>(
        `/academico/planes/${materiaActual.id}`
      )
      setPlanesGuardados(planesActualizados)
      setMensajeExito('Plan de refuerzo académico generado y guardado en base de datos.')
    } catch (error) {
      const detalle = extraerMensajeErrorApi(error)
      setAlertaPlan(
        detalle ||
          'No se pudo obtener respuesta del servicio de IA ni guardar el plan. Verifica que ai-service (:8000) esté activo.'
      )
    } finally {
      setGenerandoIa(false)
    }
  }

  const badgePrioridad = (prioridad: string) => {
    const p = prioridad.toLowerCase()
    if (p === 'alta') return 'bg-red-100 text-red-800'
    if (p === 'media') return 'bg-amber-100 text-amber-800'
    return 'bg-emerald-100 text-emerald-800'
  }

  const badgeRiesgo = (nivel: string) => {
    const n = nivel.toLowerCase()
    if (n.includes('crít') || n.includes('crit') || n === 'alto') {
      return 'bg-red-100 text-red-800'
    }
    if (n === 'medio') return 'bg-amber-100 text-amber-800'
    return 'bg-emerald-100 text-emerald-800'
  }

  if (cargando) return <p role="status" className="text-xs text-[#52525b]">Cargando módulo de tutoría...</p>
  if (errorCarga) return <p role="alert" className="text-xs text-red-700">{errorCarga}</p>
  if (!materiaActual || !parcialActual) {
    return materias.length === 0 ? (
      <PrimeraSincronizacionMoodle />
    ) : (
      <p className="text-xs text-[#52525b]">No hay asignaturas disponibles para tutoría.</p>
    )
  }

  const conPlanCount = estudiantesEnRiesgo.filter((e) =>
    planesGuardados.some((p) => p.estudianteId === e.estudianteId)
  ).length
  const sinPlanCount = estudiantesEnRiesgo.length - conPlanCount

  return (
    <div className="space-y-5">
      {/* Selector de Asignatura y Parcial */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e4e4e7] pb-3">
        <div className="flex flex-wrap gap-2">
          {materias.map((m) => {
            const activa = m.id === materiaActual.id
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setMateriaActivaId(m.id)
                  setSearchParams({ materia: String(m.id) })
                }}
                className={`px-4 py-2 rounded text-xs font-semibold transition cursor-pointer ${
                  activa
                    ? 'bg-[#8B151A] text-white'
                    : 'bg-white text-[#18181b] border border-[#d4d4d8] hover:bg-[#f4f4f5]'
                }`}
              >
                {m.nombre} ({m.codigo})
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-1 bg-[#f4f4f5] p-1 rounded border border-[#e4e4e7]">
          {materiaActual.parciales.map((p) => {
            const activo = p.numero === parcialActual.numero
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setParcialNumero(p.numero)}
                className={`px-3 py-1 rounded text-xs font-semibold transition cursor-pointer ${
                  activo
                    ? 'bg-white text-[#8B151A] shadow-xs'
                    : 'text-[#52525b] hover:text-[#18181b]'
                }`}
              >
                Parcial {p.numero}
              </button>
            )
          })}
        </div>
      </div>

      {/* Cabecera */}
      <div className="bg-white border border-[#e4e4e7] border-l-4 border-l-[#8B151A] rounded-md p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-[#18181b]">
            Tutoría Académica y Planes Remediales con IA
          </h1>
          <p className="text-xs text-[#52525b] mt-0.5">
            {materiaActual.nombre} ({materiaActual.codigo}) • Parcial {parcialActual.numero} • Seguimiento personalizado (&lt; 7.00)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="px-2.5 py-1 rounded bg-red-50 border border-red-200 font-semibold text-red-800">
            {estudiantesEnRiesgo.length} en riesgo
          </span>
          <span className="px-2.5 py-1 rounded bg-emerald-50 border border-emerald-200 font-semibold text-emerald-800">
            {conPlanCount} con plan
          </span>
          {sinPlanCount > 0 && (
            <span className="px-2.5 py-1 rounded bg-amber-50 border border-amber-200 font-semibold text-amber-800">
              {sinPlanCount} pendiente(s)
            </span>
          )}
        </div>
      </div>

      {alertaPlan && (
        <div role="alert" className="p-3.5 bg-amber-50 border-l-4 border-amber-500 rounded text-xs text-amber-800 font-medium">
          {alertaPlan}
        </div>
      )}

      {mensajeExito && (
        <div role="status" className="p-3.5 bg-emerald-50 border-l-4 border-emerald-600 rounded text-xs text-emerald-800 font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{mensajeExito}</span>
        </div>
      )}

      {cargandoCurso ? (
        <p role="status" className="text-xs text-[#52525b]">Cargando estudiantes y planes guardados...</p>
      ) : estudiantesEnRiesgo.length === 0 ? (
        <div className="bg-white border border-[#e4e4e7] rounded-md p-6 text-center">
          <p className="text-sm font-semibold text-[#18181b]">
            No hay estudiantes en riesgo académico en este parcial
          </p>
          <p className="text-xs text-[#71717a] mt-1">
            Todos los estudiantes tienen un promedio ponderado mayor o igual a 7.00 o aún no se han sincronizado calificaciones.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lista Interactiva de Estudiantes en Riesgo */}
          <div className="bg-white border border-[#e4e4e7] rounded-md overflow-hidden self-start">
            <div className="p-3.5 border-b border-[#e4e4e7] bg-[#f4f4f5] space-y-2.5">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-[#18181b]">Estudiantes en Riesgo</h2>
                <span className="text-[11px] text-[#71717a]">
                  {estudiantesFiltrados.length} de {estudiantesEnRiesgo.length}
                </span>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#71717a] absolute left-2.5 top-2" />
                <input
                  type="text"
                  value={busquedaAlumno}
                  onChange={(e) => setBusquedaAlumno(e.target.value)}
                  placeholder="Buscar estudiante..."
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border border-[#d4d4d8] rounded focus:outline-none focus:border-[#8B151A]"
                />
              </div>

              <div className="grid grid-cols-3 gap-1 bg-[#e4e4e7] p-0.5 rounded text-[10px] font-semibold">
                <button
                  type="button"
                  onClick={() => setFiltroEstadoPlan('todos')}
                  className={`py-1 rounded cursor-pointer transition ${
                    filtroEstadoPlan === 'todos' ? 'bg-white text-[#8B151A]' : 'text-[#52525b]'
                  }`}
                >
                  Todos ({estudiantesEnRiesgo.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroEstadoPlan('sin_plan')}
                  className={`py-1 rounded cursor-pointer transition ${
                    filtroEstadoPlan === 'sin_plan' ? 'bg-white text-[#8B151A]' : 'text-[#52525b]'
                  }`}
                >
                  Sin plan ({sinPlanCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroEstadoPlan('con_plan')}
                  className={`py-1 rounded cursor-pointer transition ${
                    filtroEstadoPlan === 'con_plan' ? 'bg-white text-[#8B151A]' : 'text-[#52525b]'
                  }`}
                >
                  Con plan ({conPlanCount})
                </button>
              </div>
            </div>

            <div className="divide-y divide-[#e4e4e7] max-h-[540px] overflow-y-auto">
              {estudiantesFiltrados.length === 0 ? (
                <p className="p-4 text-xs text-center text-[#71717a]">
                  No hay coincidencias con el filtro actual.
                </p>
              ) : (
                estudiantesFiltrados.map((est) => {
                  const seleccionado = est.estudianteId === estudianteActual?.estudianteId
                  const tienePlan = planesGuardados.some((p) => p.estudianteId === est.estudianteId)
                  const citaKey = `${materiaActual.id}-${parcialActual.id}-${est.estudianteId}`
                  const tieneCita = Boolean(citasAgendadas[citaKey])
                  return (
                    <button
                      key={est.estudianteId}
                      type="button"
                      onClick={() => setEstudianteActivoId(est.estudianteId)}
                      className={`w-full text-left p-3.5 transition cursor-pointer ${
                        seleccionado ? 'bg-[#fef2f2] border-l-4 border-l-[#8B151A]' : 'hover:bg-[#fafafa]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <AvatarEstudiante
                            nombres={est.nombres}
                            apellidos={est.apellidos}
                            fotoUrl={est.fotoUrl}
                            enRiesgo={est.enRiesgo}
                            size="sm"
                          />
                          <span className="text-xs font-bold text-[#18181b] truncate">
                            {est.apellidos} {est.nombres}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 text-[11px] font-bold shrink-0">
                          {est.notaFinalParcial.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-1 mt-1.5">
                        <span className="text-[11px] text-[#71717a]">
                          {est.temasDeficientes.length} tema(s) crítico(s)
                        </span>
                        <div className="flex items-center gap-1">
                          {tieneCita && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-sky-100 text-sky-800">
                              Cita
                            </span>
                          )}
                          {tienePlan ? (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                              Plan guardado
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                              Pendiente
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* Detalle del Estudiante y Plan Remedial */}
          {estudianteActual && (
            <div className="lg:col-span-2 space-y-4">
              {/* Resumen de Brechas y Botón Generar Plan */}
              <div className="bg-white border border-[#e4e4e7] rounded-md p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <AvatarEstudiante
                      nombres={estudianteActual.nombres}
                      apellidos={estudianteActual.apellidos}
                      fotoUrl={estudianteActual.fotoUrl}
                      enRiesgo={estudianteActual.enRiesgo}
                      size="lg"
                    />
                    <div>
                      <h2 className="text-sm font-bold text-[#18181b]">
                        {estudianteActual.apellidos} {estudianteActual.nombres}
                      </h2>
                      <p className="text-xs text-[#52525b]">
                        Promedio Parcial {parcialActual.numero}:{' '}
                        <strong className="text-red-700">
                          {estudianteActual.notaFinalParcial.toFixed(2)} / 10.00
                        </strong>{' '}
                        • Brecha vs aprobación:{' '}
                        <strong className="text-[#18181b]">
                          -{(7.0 - estudianteActual.notaFinalParcial).toFixed(2)} pts
                        </strong>
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={generarPlanConIa}
                    disabled={generandoIa}
                    className="px-4 py-2 bg-[#8B151A] hover:bg-[#6E1014] disabled:opacity-60 text-white rounded text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    {generandoIa
                      ? 'Generando...'
                      : planActual
                      ? 'Regenerar Plan con IA'
                      : 'Generar Plan con IA'}
                  </button>
                </div>

                {/* Cita de Tutoría Confirmada (si existe) */}
                {citaActual && (
                  <div className="p-3 bg-sky-50 border border-sky-200 rounded-md flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 text-sky-900">
                      <CalendarCheck className="w-4 h-4 text-sky-700 shrink-0" />
                      <span>
                        <strong>Tutoría programada:</strong> {citaActual.modalidad} —{' '}
                        {citaActual.fecha.replace('T', ' ')}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setModalAgendar(true)}
                      className="text-[11px] font-semibold text-sky-800 hover:underline cursor-pointer"
                    >
                      Reprogramar
                    </button>
                  </div>
                )}

                {/* Componentes 30/30/40 con barra visual */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-[#e4e4e7]">
                  {estudianteActual.componentes.map((comp) => {
                    const pct = Math.min(100, Math.max(0, (comp.promedioComponente / 10) * 100))
                    return (
                      <div
                        key={comp.tipo}
                        className={`p-3 rounded border text-xs space-y-1.5 ${
                          comp.esDeficiente
                            ? 'bg-red-50/40 border-red-200'
                            : 'bg-emerald-50/30 border-emerald-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-[#52525b]">
                            {NOMBRE_COMPONENTE[comp.tipo]} ({Math.round(comp.ponderacion * 100)}%)
                          </span>
                          <span className="font-bold text-xs text-[#18181b]">
                            {comp.promedioComponente.toFixed(2)} / 10
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-white rounded-full overflow-hidden border border-[#e4e4e7]">
                          <div
                            className={`h-full rounded-full ${
                              comp.esDeficiente ? 'bg-red-600' : 'bg-emerald-600'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Actividades específicas con nota < 7.00 */}
                {actividadesDeficientesEstudiante.length > 0 && (
                  <div className="pt-1 space-y-1.5">
                    <p className="text-[11px] font-semibold text-[#52525b]">
                      Actividades específicas por debajo de 7.00 ({actividadesDeficientesEstudiante.length}):
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {actividadesDeficientesEstudiante.map((act) => (
                        <div
                          key={act.itemEvaluacionId}
                          className="p-2 rounded bg-[#fafafa] border border-[#e4e4e7] flex items-center justify-between gap-2 text-[11px]"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-[#18181b] truncate">{act.nombre}</p>
                            <p className="text-[10px] text-[#71717a] truncate">
                              {act.componenteNombre}
                              {act.temas && act.temas.length > 0
                                ? ` · ${act.temas.map((t) => t.nombre).join(', ')}`
                                : ''}
                            </p>
                          </div>
                          <span className="font-mono font-bold text-red-700 bg-red-50 px-1.5 py-0.5 rounded shrink-0">
                            {(act.nota ?? 0).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Trazabilidad Causal del Agente */}
                {trazabilidadCausal && (
                  <div className="p-3.5 bg-red-50/60 border border-red-200 rounded-md text-xs space-y-1.5 mt-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#8B151A] flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-[#8B151A]" />
                        Trazabilidad Causal del Agente (Fase 2):
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-800 px-2 py-0.5 rounded">
                        Regla Cognitiva UTA
                      </span>
                    </div>
                    <p className="text-[#3f3f46] text-[11.5px] leading-relaxed">
                      <strong className="text-[#18181b]">Clasificación:</strong>{' '}
                      <span className="text-red-700 font-semibold">{trazabilidadCausal.clasificacion}</span>
                    </p>
                    <p className="text-[#3f3f46] text-[11.5px] leading-relaxed">
                      <strong className="text-[#18181b]">Causa raíz:</strong> {trazabilidadCausal.causaRaiz}
                    </p>
                    <p className="text-[#3f3f46] text-[11.5px] leading-relaxed">
                      <strong className="text-[#18181b]">Temas críticos afectados:</strong>{' '}
                      {estudianteActual.temasDeficientes.map((t) => t.nombreTema).join(', ') ||
                        'Conceptos fundamentales de la unidad temática'}
                    </p>
                  </div>
                )}
              </div>

              {/* Spinner Institucional mientras consulta Gemini */}
              {generandoIa && (
                <div
                  role="status"
                  className="bg-white border border-[#e4e4e7] rounded-md p-6 flex items-center gap-3"
                >
                  <div className="h-5 w-5 rounded-full border-2 border-[#8B151A] border-t-transparent animate-spin shrink-0" />
                  <p className="text-xs font-semibold text-[#18181b]">
                    Analizando vacíos formativos con IA pedagógica...
                  </p>
                </div>
              )}

              {/* Plan de Refuerzo Persistido / Generado */}
              {!generandoIa && !planActual && (
                <div className="bg-white border border-dashed border-[#d4d4d8] rounded-md p-6 text-center space-y-2">
                  <p className="text-xs font-semibold text-[#18181b]">
                    Este estudiante aún no tiene un plan remedial guardado.
                  </p>
                  <p className="text-[11px] text-[#71717a]">
                    Haz clic en &quot;Generar Plan con IA&quot; para diagnosticar los temas críticos y habilitar la edición tipo acta y exportación PDF.
                  </p>
                </div>
              )}

              {!generandoIa && planActual && (
                <div className="space-y-4">
                  {planActual.esFallback && (
                    <div
                      role="alert"
                      className="p-3.5 bg-amber-50 border-l-4 border-amber-500 rounded text-xs text-amber-800 font-medium"
                    >
                      Plan generado mediante motor de contingencia local (la API externa de IA no estuvo disponible).
                    </div>
                  )}

                  {/* Tarjeta de Diagnóstico Cualitativo */}
                  <div className="bg-white border border-[#e4e4e7] rounded-md p-5 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-xs font-bold uppercase tracking-wide text-[#8B151A]">
                        Diagnóstico Pedagógico Cualitativo
                      </h3>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${badgeRiesgo(
                            planActual.nivelRiesgo
                          )}`}
                        >
                          Riesgo: {planActual.nivelRiesgo}
                        </span>
                        <span className="text-[11px] text-[#71717a]">
                          {new Date(planActual.fechaGeneracion).toLocaleDateString()}
                        </span>
                        <button
                          type="button"
                          onClick={handleAbrirEditar}
                          className="text-[11px] font-semibold text-[#8B151A] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          Editar Acta
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-[#27272a] leading-relaxed">
                      {planActual.diagnosticoGeneral}
                    </p>
                  </div>

                  {/* Acordeones Interactivos de Actividades por Tema */}
                  <div className="bg-white border border-[#e4e4e7] rounded-md overflow-hidden">
                    <div className="p-4 border-b border-[#e4e4e7] flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-[#18181b]">
                        Plan de Acción por Tema ({planActual.detalles.length})
                      </h3>
                      <div className="flex items-center gap-2 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setDetallesAbiertos(planActual.detalles.map((d) => d.id))}
                          className="font-semibold text-[#52525b] hover:text-[#18181b] cursor-pointer"
                        >
                          Expandir todos
                        </button>
                        <span className="text-[#d4d4d8]">|</span>
                        <button
                          type="button"
                          onClick={() => setDetallesAbiertos([])}
                          className="font-semibold text-[#52525b] hover:text-[#18181b] cursor-pointer"
                        >
                          Colapsar todos
                        </button>
                      </div>
                    </div>

                    <div className="p-4 space-y-3">
                      {planActual.detalles.map((det) => {
                        const abierto = detallesAbiertos.includes(det.id)
                        return (
                          <div
                            key={det.id}
                            className="border border-[#e4e4e7] rounded-md overflow-hidden"
                          >
                            <button
                              type="button"
                              onClick={() => toggleDetalle(det.id)}
                              className="w-full bg-[#f4f4f5] px-4 py-3 flex items-center justify-between text-left hover:bg-[#f0f0f1] transition cursor-pointer gap-3"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-xs text-[#18181b]">
                                  {det.temaNombre}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${badgePrioridad(
                                    det.prioridad
                                  )}`}
                                >
                                  Prioridad {det.prioridad}
                                </span>
                                <span className="text-[10px] text-[#52525b] flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {det.tiempoEstimadoHoras} h
                                </span>
                              </div>
                              <span className="text-xs font-semibold text-[#71717a] shrink-0 flex items-center gap-1">
                                {abierto ? (
                                  <>
                                    Ocultar <ChevronUp className="w-3.5 h-3.5" />
                                  </>
                                ) : (
                                  <>
                                    Mostrar <ChevronDown className="w-3.5 h-3.5" />
                                  </>
                                )}
                              </span>
                            </button>

                            {abierto && (
                              <div className="p-4 bg-white space-y-2.5 text-xs">
                                <div>
                                  <p className="text-[11px] font-semibold text-[#52525b]">
                                    Actividad sugerida
                                  </p>
                                  <p className="text-[#18181b] mt-0.5 leading-relaxed">
                                    {det.actividadSugerida}
                                  </p>
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#f4f4f5]">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="px-2 py-0.5 rounded bg-[#f4f4f5] border border-[#e4e4e7] text-[11px] font-semibold text-[#18181b]">
                                      Tiempo estimado: {det.tiempoEstimadoHoras} h
                                    </span>
                                    {det.recursoRecomendado && (
                                      <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-100 text-[11px] font-medium text-blue-800">
                                        Recurso: {det.recursoRecomendado}
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={handleAbrirEditar}
                                    className="text-[11px] font-semibold text-[#8B151A] hover:underline cursor-pointer"
                                  >
                                    Editar actividad
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Barra de Acciones del Mockup Oficial */}
                  <div className="bg-white border border-[#e4e4e7] rounded-md p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => handleAprobarYGenerarPdf()}
                        disabled={exportandoPdf}
                        className="px-4 py-2 bg-[#8B151A] hover:bg-[#6E1014] disabled:opacity-60 text-white rounded text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                      >
                        <FileText className="w-4 h-4" />
                        {exportandoPdf ? 'Generando PDF...' : 'Aprobar y Generar PDF'}
                      </button>

                      <button
                        type="button"
                        onClick={handleAbrirEditar}
                        className="px-3.5 py-2 border border-[#d4d4d8] hover:bg-[#f4f4f5] text-[#18181b] rounded text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Editar Plan (Vista Acta)
                      </button>

                      <button
                        type="button"
                        onClick={() => setModalAgendar(true)}
                        className="px-3.5 py-2 border border-[#d4d4d8] hover:bg-[#f4f4f5] text-[#18181b] rounded text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                      >
                        <CalendarCheck className="w-3.5 h-3.5" />
                        {citaActual ? 'Reprogramar Tutoría' : 'Agendar Tutoría'}
                      </button>
                    </div>

                    <span className="text-[11px] text-[#71717a]">
                      Estado: <strong className="text-emerald-700">Persistido en SQL</strong>
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal Editor Tipo Acta Oficial PDF (Reemplaza el modal básico y persiste vía PUT) */}
      {modalEditar && planActual && estudianteActual && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-6">
          <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-[#d4d4d8]">
            {/* Banda superior institucional replica exacta del membrete PDF */}
            <div className="bg-[#8B151A] text-white px-6 py-4 border-b-4 border-b-[#B4862C] flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold tracking-wider uppercase text-amber-200">
                  UNIVERSIDAD TÉCNICA DE AMBATO — FISEI (VISTA PREVIA Y EDICIÓN DE ACTA PDF)
                </p>
                <h3 className="text-sm sm:text-base font-bold mt-0.5">
                  INFORME OFICIAL INDIVIDUAL DE TUTORÍA Y REFUERZO ACADÉMICO
                </h3>
                <p className="text-[11px] text-white/85 mt-0.5">
                  {materiaActual.nombre} ({materiaActual.codigo}) · Parcial {parcialActual.numero} · Docente: {user?.nombreCompleto || 'Docente Titular'}
                </p>
              </div>
              <button
                type="button"
                disabled={guardandoEdicion}
                onClick={() => setModalEditar(false)}
                className="text-white/80 hover:text-white text-base cursor-pointer shrink-0"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGuardarEdicion} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 bg-[#fafafa]">
              {/* Sección 1: Resumen del Estudiante */}
              <div className="bg-white border border-[#e4e4e7] rounded-md p-4 space-y-2">
                <p className="text-[11px] font-bold text-[#8B151A] uppercase">
                  1. Resumen de Rendimiento Académico (Modelo 30/30/40)
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border border-[#e4e4e7]">
                    <thead className="bg-[#8B151A] text-white">
                      <tr>
                        <th className="py-1.5 px-2.5">Estudiante</th>
                        <th className="py-1.5 px-2.5">Tareas (30%)</th>
                        <th className="py-1.5 px-2.5">APE (30%)</th>
                        <th className="py-1.5 px-2.5">Examen (40%)</th>
                        <th className="py-1.5 px-2.5">Nota Final</th>
                        <th className="py-1.5 px-2.5">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="bg-white">
                        <td className="py-2 px-2.5 font-semibold text-[#18181b]">
                          {estudianteActual.apellidos} {estudianteActual.nombres}
                        </td>
                        {([1, 2, 3] as const).map((tipo) => {
                          const c = estudianteActual.componentes.find((x) => x.tipo === tipo)
                          return (
                            <td key={tipo} className="py-2 px-2.5">
                              {(c?.promedioComponente ?? 0).toFixed(2)} ({(c?.aporteFinal ?? 0).toFixed(2)})
                            </td>
                          )
                        })}
                        <td className="py-2 px-2.5 font-bold">{estudianteActual.notaFinalParcial.toFixed(2)} / 10</td>
                        <td className="py-2 px-2.5 font-bold text-[#8B151A]">EN RIESGO</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Sección 2: Diagnóstico Cualitativo y Nivel de Riesgo Editables */}
              <div className="bg-white border border-[#e4e4e7] rounded-md p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] font-bold text-[#8B151A] uppercase">
                    2. Causa Principal y Diagnóstico Pedagógico Cualitativo (Editable)
                  </p>
                  <div className="flex items-center gap-2 text-xs">
                    <label htmlFor="nivel-riesgo-select" className="font-semibold text-[#52525b]">
                      Nivel de riesgo:
                    </label>
                    <select
                      id="nivel-riesgo-select"
                      value={nivelRiesgoEditado}
                      onChange={(e) => setNivelRiesgoEditado(e.target.value)}
                      className="border border-[#d4d4d8] rounded px-2 py-1 text-xs font-semibold text-[#18181b] bg-white focus:outline-none focus:border-[#8B151A]"
                    >
                      <option value="Crítico">Crítico</option>
                      <option value="Alto">Alto</option>
                      <option value="Medio">Medio</option>
                      <option value="Bajo">Bajo</option>
                    </select>
                  </div>
                </div>

                <textarea
                  rows={4}
                  value={diagnosticoEditado}
                  onChange={(e) => setDiagnosticoEditado(e.target.value)}
                  className="w-full p-3 border border-[#d4d4d8] rounded text-xs text-[#18181b] leading-relaxed focus:outline-none focus:ring-1 focus:ring-[#8B151A]"
                  placeholder="Redacta el diagnóstico cualitativo que figurará en el informe oficial..."
                  required
                />
              </div>

              {/* Sección 3: Tabla Editable de Actividades de Refuerzo por Tema */}
              <div className="bg-white border border-[#e4e4e7] rounded-md p-4 space-y-3">
                <p className="text-[11px] font-bold text-[#8B151A] uppercase">
                  3. Plan de Actividades de Refuerzo Académico (Editable por Tema)
                </p>

                <div className="space-y-3">
                  {detallesEditados.map((det) => (
                    <div
                      key={det.id}
                      className="p-3.5 rounded border border-[#e4e4e7] bg-[#fafafa] space-y-2.5 text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-[#18181b]">{det.temaNombre}</span>
                        <div className="flex items-center gap-2">
                          <select
                            aria-label={`Prioridad para ${det.temaNombre}`}
                            value={det.prioridad}
                            onChange={(e) => actualizarDetalleEditado(det.id, 'prioridad', e.target.value)}
                            className="border border-[#d4d4d8] rounded px-2 py-1 text-[11px] bg-white"
                          >
                            <option value="Alta">Prioridad Alta</option>
                            <option value="Media">Prioridad Media</option>
                            <option value="Baja">Prioridad Baja</option>
                          </select>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={1}
                              max={40}
                              aria-label={`Horas estimadas para ${det.temaNombre}`}
                              value={det.tiempoEstimadoHoras}
                              onChange={(e) =>
                                actualizarDetalleEditado(det.id, 'tiempoEstimadoHoras', Number(e.target.value))
                              }
                              className="w-14 border border-[#d4d4d8] rounded px-2 py-1 text-[11px] bg-white text-center"
                            />
                            <span className="text-[11px] text-[#52525b]">h</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-[#52525b] mb-1">
                          Actividad sugerida:
                        </label>
                        <textarea
                          rows={2}
                          value={det.actividadSugerida}
                          onChange={(e) =>
                            actualizarDetalleEditado(det.id, 'actividadSugerida', e.target.value)
                          }
                          className="w-full p-2 border border-[#d4d4d8] rounded text-xs bg-white focus:outline-none focus:border-[#8B151A]"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-[#52525b] mb-1">
                          Recurso recomendado:
                        </label>
                        <input
                          type="text"
                          value={det.recursoRecomendado}
                          onChange={(e) =>
                            actualizarDetalleEditado(det.id, 'recursoRecomendado', e.target.value)
                          }
                          className="w-full p-2 border border-[#d4d4d8] rounded text-xs bg-white focus:outline-none focus:border-[#8B151A]"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sección 4: Bloque de Firma Institucional (Vista previa del pie de acta) */}
              <div className="bg-white border border-[#e4e4e7] rounded-md p-4 text-[11px] text-[#52525b] space-y-3">
                <p className="italic">
                  Certifico que las calificaciones ponderadas bajo el modelo 30/30/40 y los planes de seguimiento pedagógico consignados en este documento corresponden a los registros oficiales de la asignatura.
                </p>
                <div className="grid grid-cols-2 gap-6 pt-4 text-center">
                  <div className="border-t border-[#a1a1aa] pt-1.5">
                    <p className="font-bold text-[#18181b]">{user?.nombreCompleto || 'Docente Titular'}</p>
                    <p className="text-[10px]">Firma y Rúbrica del Docente Titular</p>
                  </div>
                  <div className="border-t border-[#a1a1aa] pt-1.5">
                    <p className="font-bold text-[#18181b]">Coordinación Académica FISEI</p>
                    <p className="text-[10px]">Visto Bueno / Seguimiento SISRA</p>
                  </div>
                </div>
              </div>

              {/* Barra inferior fija de acciones del Editor */}
              <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-[#e4e4e7]">
                <button
                  type="button"
                  disabled={guardandoEdicion}
                  onClick={() => setModalEditar(false)}
                  className="px-3.5 py-2 border border-[#d4d4d8] bg-white rounded text-xs font-medium text-[#52525b] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoEdicion}
                  className="px-4 py-2 border border-[#8B151A] text-[#8B151A] bg-white hover:bg-[#8B151A]/5 rounded text-xs font-semibold cursor-pointer disabled:opacity-60"
                >
                  {guardandoEdicion ? 'Guardando...' : 'Guardar Cambios'}
                </button>
                <button
                  type="button"
                  disabled={guardandoEdicion}
                  onClick={() => guardarEdicionEnServidor(true)}
                  className="px-4 py-2 bg-[#8B151A] hover:bg-[#6E1014] text-white rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  <FileText className="w-3.5 h-3.5" />
                  {guardandoEdicion ? 'Guardando...' : 'Guardar y Exportar PDF'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Agendar Tutoría */}
      {modalAgendar && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#e4e4e7] pb-3">
              <h3 className="text-sm font-bold text-[#18181b]">
                Agendar Tutoría de Refuerzo FISEI
              </h3>
              <button
                type="button"
                onClick={() => setModalAgendar(false)}
                className="text-[#71717a] hover:text-[#18181b] text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAgendarTutoria} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#52525b] mb-1">Estudiante:</label>
                <p className="font-bold text-[#18181b] bg-[#f4f4f5] p-2 rounded">
                  {estudianteActual?.apellidos} {estudianteActual?.nombres} ({estudianteActual?.correo})
                </p>
              </div>

              <div>
                <label className="block font-semibold text-[#52525b] mb-1">Modalidad:</label>
                <select
                  value={modalidadTutoria}
                  onChange={(e) => setModalidadTutoria(e.target.value)}
                  className="w-full p-2 border border-[#d4d4d8] rounded text-[#18181b]"
                >
                  <option value="Presencial (Laboratorios FISEI)">Presencial (Laboratorios FISEI)</option>
                  <option value="Virtual (Microsoft Teams UTA)">Virtual (Microsoft Teams UTA)</option>
                  <option value="Cubículo de Docente">Cubículo de Docente</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#52525b] mb-1">Fecha y Hora Propuesta:</label>
                <input
                  type="datetime-local"
                  value={fechaTutoria}
                  onChange={(e) => setFechaTutoria(e.target.value)}
                  className="w-full p-2 border border-[#d4d4d8] rounded text-[#18181b]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setModalAgendar(false)}
                  className="px-3 py-1.5 border border-[#d4d4d8] rounded font-medium text-[#52525b] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#8B151A] hover:bg-[#6E1014] text-white rounded font-semibold cursor-pointer"
                >
                  Confirmar Tutoría
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default TutoriaPage
