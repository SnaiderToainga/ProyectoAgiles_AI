import { Fragment, useState, useEffect, useMemo, useCallback, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import clienteAxios from '../api/clienteAxios'
import { useChatIa } from '../context/ChatIaContext'
import { AvatarEstudiante } from '../components/AvatarEstudiante'
import {
  FiltrosCascada,
  type EstadoFiltroAcademico,
  type TemaCascadaOption,
} from '../components/FiltrosCascada'
import {
  calcularMetricasGrupo,
  calcularRendimientoFiltrado,
  obtenerEvaluacionesEnAlcance,
} from '../utils/calculoFiltrosAcademicos'
import {
  exportarPdfMatrizConsolidada,
  exportarPdfReporteIndividual,
} from '../utils/pdfReportesAcademicos'
import {
  NOMBRE_COMPONENTE,
  PONDERACION_COMPONENTE,
  type EvaluacionDto,
  type MateriaDto,
  type ReporteConsolidadoCursoDto,
  type ReporteIndividualTutoriaDto,
  type ResumenAcademicoEstudianteDto,
  type SincronizacionDto,
  type TipoItemEvaluacion,
} from '../types/academico'
import { PrimeraSincronizacionMoodle } from '../components/PrimeraSincronizacionMoodle'
import { LEYENDA_PROVISIONAL, textoCalificacion } from '../utils/estadoCalificacion'
import { FechaSincronizacionMoodle } from '../components/FechaSincronizacionMoodle'

interface AlertaEstado {
  tipo: 'exito' | 'advertencia' | 'error'
  mensaje: string
}

function extraerMensajeErrorApi(error: unknown): string | undefined {
  if (!axios.isAxiosError(error)) return undefined
  const data = error.response?.data
  if (!data || typeof data !== 'object') return undefined
  const payload = data as { detail?: string; title?: string; mensaje?: string }
  return payload.detail || payload.title || payload.mensaje
}

export function EvaluacionesPage() {
  const { actualizarContextoChat, abrirChatConEstudiante, materiaActivaId: materiaContextoId } = useChatIa()
  const [searchParams] = useSearchParams()
  const materiaQuery = searchParams.get('materia')

  const [materias, setMaterias] = useState<MateriaDto[]>([])
  const [materiaActivaId, setMateriaActivaId] = useState<number>(
    materiaQuery ? Number(materiaQuery) : materiaContextoId ?? 0
  )
  const [parcialNumero, setParcialNumero] = useState<number>(1)

  const [evaluaciones, setEvaluaciones] = useState<EvaluacionDto[]>([])
  const [rendimiento, setRendimiento] = useState<ResumenAcademicoEstudianteDto[]>([])
  const [cargando, setCargando] = useState(true)
  const [cargandoDatos, setCargandoDatos] = useState(false)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [sincronizando, setSincronizando] = useState(false)
  const [publicandoLote, setPublicandoLote] = useState(false)
  const [alertaSync, setAlertaSync] = useState<AlertaEstado | null>(null)
  const [estudianteExpandidoId, setEstudianteExpandidoId] = useState<number | null>(null)
  const [exportandoMatrizPdf, setExportandoMatrizPdf] = useState(false)
  const [exportandoEstPdfId, setExportandoEstPdfId] = useState<number | null>(null)
  const [evalMode, setEvalMode] = useState<'board' | 'table' | 'activities'>('board')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [sortBy, setSortBy] = useState<'apellidos' | 'nota_asc' | 'nota_desc'>('apellidos')

  // Filtros en cascada y paginación (T-12.6, T-12.7, T-12.8)
  const [unidadFiltroId, setUnidadFiltroId] = useState<number | null>(null)
  const [temaFiltroId, setTemaFiltroId] = useState<number | null>(null)
  const [actividadFiltroId, setActividadFiltroId] = useState<number | null>(null)
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltroAcademico>('todos')
  const [busquedaEstudiante, setBusquedaEstudiante] = useState('')
  const [paginaActual, setPaginaActual] = useState(1)
  const [tamanoPagina, setTamanoPagina] = useState(10)

  // Modal de creación o clasificación de evaluación
  const [mostrarModal, setMostrarModal] = useState(false)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [actividad, setActividad] = useState('')
  const [componente, setComponente] = useState<TipoItemEvaluacion>(1)
  const [temasSeleccionados, setTemasSeleccionados] = useState<number[]>([])
  const [guardando, setGuardando] = useState(false)
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true
    clienteAxios
      .get<MateriaDto[]>('/academico/materias')
      .then(({ data }) => {
        if (!vigente) return
        setMaterias(data)
        if (data.length > 0) {
          const idInicial = materiaQuery ? Number(materiaQuery) : materiaContextoId ?? data[0].id
          const existe = data.some((m) => m.id === idInicial)
          setMateriaActivaId(existe ? idInicial : data[0].id)
        }
      })
      .catch(() => {
        if (vigente) {
          setErrorCarga('No se pudieron cargar las asignaturas. Verifica tu sesión y la conexión con el API Gateway.')
        }
      })
      .finally(() => {
        if (vigente) setCargando(false)
      })
    return () => {
      vigente = false
    }
  }, [materiaQuery])

  useEffect(() => {
    if (materiaContextoId && materias.some((m) => m.id === materiaContextoId)) {
      setMateriaActivaId(materiaContextoId)
    }
  }, [materiaContextoId, materias])

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

  const cargarDatosCurso = useCallback(async (cursoId: number, parcialId: number) => {
    setCargandoDatos(true)
    try {
      const [resEval, resRend] = await Promise.all([
        clienteAxios.get<EvaluacionDto[]>(`/academico/materias/${cursoId}/evaluaciones`),
        clienteAxios.get<ResumenAcademicoEstudianteDto[]>(
          `/academico/materias/${cursoId}/parciales/${parcialId}/rendimiento`
        ),
      ])
      setEvaluaciones(resEval.data)
      setRendimiento(resRend.data)
    } catch {
      setAlertaSync({
        tipo: 'error',
        mensaje: 'No se pudieron obtener las calificaciones reales de esta asignatura.',
      })
    } finally {
      setCargandoDatos(false)
    }
  }, [])

  useEffect(() => {
    if (!materiaActual || !parcialActual) return
    setEstudianteExpandidoId(null)
    cargarDatosCurso(materiaActual.id, parcialActual.id)
  }, [materiaActual, parcialActual, cargarDatosCurso])

  useEffect(() => {
    if (materias.length === 0) return
    actualizarContextoChat({
      materias,
      materiaId: materiaActual?.id ?? null,
      estudiantes: rendimiento,
      esModoFallback: false,
    })
  }, [materias, materiaActual?.id, rendimiento, actualizarContextoChat])

  const temasDisponibles = useMemo<TemaCascadaOption[]>(() => {
    if (!parcialActual) return []
    return parcialActual.unidades.flatMap((u) =>
      u.temas.map((t) => ({
        id: t.id,
        codigo: `U${u.numero}`,
        nombre: t.nombre,
        unidadId: u.id,
      }))
    )
  }, [parcialActual])

  const temasCascada = useMemo(
    () =>
      unidadFiltroId === null
        ? temasDisponibles
        : temasDisponibles.filter((t) => t.unidadId === unidadFiltroId),
    [temasDisponibles, unidadFiltroId]
  )

  const evaluacionesVisibles = useMemo(() => {
    if (!parcialActual) return []
    return evaluaciones.filter(
      (ev) => ev.parcialId === parcialActual.id || ev.parcialId === null
    )
  }, [evaluaciones, parcialActual])

  const evaluacionesPublicadas = useMemo(
    () => evaluacionesVisibles.filter((ev) => ev.publicado && ev.tipo !== 0),
    [evaluacionesVisibles]
  )

  const pendientesPublicar = useMemo(
    () => evaluacionesVisibles.filter((ev) => !ev.publicado),
    [evaluacionesVisibles]
  )

  const aprobablesRapido = useMemo(
    () => pendientesPublicar.filter((ev) => ev.tipo !== 0 && ev.temaIds.length > 0),
    [pendientesPublicar]
  )

  const actividadesCascada = useMemo(
    () =>
      obtenerEvaluacionesEnAlcance(
        evaluacionesPublicadas,
        parcialActual,
        unidadFiltroId,
        temaFiltroId,
        null
      ),
    [evaluacionesPublicadas, parcialActual, unidadFiltroId, temaFiltroId]
  )

  const evaluacionesEnAlcance = useMemo(
    () =>
      obtenerEvaluacionesEnAlcance(
        evaluacionesPublicadas,
        parcialActual,
        unidadFiltroId,
        temaFiltroId,
        actividadFiltroId
      ),
    [evaluacionesPublicadas, parcialActual, unidadFiltroId, temaFiltroId, actividadFiltroId]
  )

  const actividadesTabla = useMemo(
    () =>
      obtenerEvaluacionesEnAlcance(
        evaluacionesVisibles,
        parcialActual,
        unidadFiltroId,
        temaFiltroId,
        actividadFiltroId
      ),
    [evaluacionesVisibles, parcialActual, unidadFiltroId, temaFiltroId, actividadFiltroId]
  )

  const hayFiltroCurricular =
    unidadFiltroId !== null || temaFiltroId !== null || actividadFiltroId !== null

  const filasRendimiento = useMemo(
    () =>
      calcularRendimientoFiltrado(
        rendimiento,
        evaluacionesEnAlcance,
        actividadFiltroId,
        hayFiltroCurricular,
        estadoFiltro,
        busquedaEstudiante
      ),
    [
      rendimiento,
      evaluacionesEnAlcance,
      actividadFiltroId,
      hayFiltroCurricular,
      estadoFiltro,
      busquedaEstudiante,
    ]
  )

  const actividadSeleccionada = useMemo(
    () =>
      actividadFiltroId !== null
        ? evaluacionesPublicadas.find((e) => e.id === actividadFiltroId) ?? null
        : null,
    [evaluacionesPublicadas, actividadFiltroId]
  )

  const metricasCurso = useMemo(
    () => calcularMetricasGrupo(filasRendimiento, actividadSeleccionada),
    [filasRendimiento, actividadSeleccionada]
  )

  const totalPaginas = Math.max(1, Math.ceil(filasRendimiento.length / tamanoPagina))
  const paginaSegura = Math.min(paginaActual, totalPaginas)
  const indiceInicio = (paginaSegura - 1) * tamanoPagina
  const filasOrdenadas = useMemo(() => {
    const copia = [...filasRendimiento]
    const sinNotaAlFinal = (a: { sinEvaluaciones: boolean }, b: { sinEvaluaciones: boolean }) =>
      Number(a.sinEvaluaciones) - Number(b.sinEvaluaciones)
    if (sortBy === 'nota_asc') copia.sort((a, b) => sinNotaAlFinal(a, b) || a.notaFiltrada - b.notaFiltrada)
    else if (sortBy === 'nota_desc') copia.sort((a, b) => sinNotaAlFinal(a, b) || b.notaFiltrada - a.notaFiltrada)
    else
      copia.sort((a, b) =>
        `${a.estudiante.apellidos} ${a.estudiante.nombres}`.localeCompare(
          `${b.estudiante.apellidos} ${b.estudiante.nombres}`
        )
      )
    return copia
  }, [filasRendimiento, sortBy])

  const filasPaginadas = useMemo(
    () => filasOrdenadas.slice(indiceInicio, indiceInicio + tamanoPagina),
    [filasOrdenadas, indiceInicio, tamanoPagina]
  )

  const exportarMatrizPdf = async () => {
    if (!materiaActual || !parcialActual || exportandoMatrizPdf) return
    setExportandoMatrizPdf(true)
    setAlertaSync(null)
    try {
      const { data } = await clienteAxios.get<ReporteConsolidadoCursoDto>(
        `/academico/materias/${materiaActual.id}/parciales/${parcialActual.id}/reporte-consolidado`
      )
      const etiquetasFiltro: string[] = []
      if (unidadFiltroId !== null) {
        const u = parcialActual.unidades.find((x) => x.id === unidadFiltroId)
        if (u) etiquetasFiltro.push(`Unidad ${u.numero}`)
      }
      if (temaFiltroId !== null) {
        const t = temasDisponibles.find((x) => x.id === temaFiltroId)
        if (t) etiquetasFiltro.push(`Tema: ${t.nombre}`)
      }
      if (actividadSeleccionada) {
        etiquetasFiltro.push(`Actividad: ${actividadSeleccionada.nombre}`)
      }
      await exportarPdfMatrizConsolidada(
        data,
        etiquetasFiltro.length > 0 ? etiquetasFiltro.join(' • ') : undefined
      )
      setAlertaSync({
        tipo: 'exito',
        mensaje: `Matriz consolidada PDF de ${materiaActual.codigo} (Parcial ${parcialActual.numero}) descargada correctamente.`,
      })
    } catch (error) {
      const detalle = extraerMensajeErrorApi(error)
      setAlertaSync({
        tipo: 'error',
        mensaje: detalle || 'No se pudo generar la matriz consolidada en PDF.',
      })
    } finally {
      setExportandoMatrizPdf(false)
    }
  }

  const exportarIndividualPdf = async (estudianteId: number) => {
    if (!materiaActual || !parcialActual || exportandoEstPdfId !== null) return
    setExportandoEstPdfId(estudianteId)
    setAlertaSync(null)
    try {
      const { data } = await clienteAxios.get<ReporteIndividualTutoriaDto>(
        `/academico/materias/${materiaActual.id}/estudiantes/${estudianteId}/reporte-tutoria`,
        { params: { parcialId: parcialActual.id } }
      )
      await exportarPdfReporteIndividual(data)
    } catch (error) {
      const detalle = extraerMensajeErrorApi(error)
      setAlertaSync({
        tipo: 'error',
        mensaje: detalle || 'No se pudo generar el reporte individual del estudiante en PDF.',
      })
    } finally {
      setExportandoEstPdfId(null)
    }
  }

  const limpiarFiltrosCascada = () => {
    setUnidadFiltroId(null)
    setTemaFiltroId(null)
    setActividadFiltroId(null)
    setEstadoFiltro('todos')
    setBusquedaEstudiante('')
    setPaginaActual(1)
  }

  const sincronizarMoodle = async () => {
    if (!materiaActual || !parcialActual || sincronizando) return
    setSincronizando(true)
    setAlertaSync(null)

    try {
      const { data } = await clienteAxios.post<SincronizacionDto>(
        `/moodle/sync-notas/${materiaActual.id}`
      )
      const { data: materiasActualizadas } = await clienteAxios.get<MateriaDto[]>(
        '/academico/materias'
      )
      setMaterias(materiasActualizadas)
      const materiaActualizada = materiasActualizadas.find((m) => m.id === materiaActual.id)
      const parcialActualizadoId =
        materiaActualizada?.parciales.find((p) => p.numero === parcialActual.numero)?.id ??
        materiaActualizada?.parciales[0]?.id ??
        parcialActual.id

      setUnidadFiltroId(null)
      setTemaFiltroId(null)
      setActividadFiltroId(null)
      setPaginaActual(1)
      await cargarDatosCurso(materiaActual.id, parcialActualizadoId)
      setAlertaSync({
        tipo: 'exito',
        mensaje: `Calificaciones actualizadas desde Moodle (${data.calificaciones} calificaciones y ${data.items} actividades sincronizadas).`,
      })
    } catch (error) {
      const detalle = extraerMensajeErrorApi(error)
      setAlertaSync({
        tipo: 'advertencia',
        mensaje:
          detalle ||
          'No se pudo conectar con el aula virtual Moodle en este momento. Se mantienen las últimas calificaciones registradas.',
      })
    } finally {
      setSincronizando(false)
    }
  }

  const publicarEvaluacionRapida = async (ev: EvaluacionDto) => {
    if (!materiaActual || !parcialActual || publicandoLote) return
    if (ev.tipo === 0 || ev.temaIds.length === 0) {
      abrirModalClasificar(ev)
      return
    }
    setPublicandoLote(true)
    try {
      await clienteAxios.put(`/academico/evaluaciones/${ev.id}/clasificacion`, {
        parcialId: parcialActual.id,
        tipo: ev.tipo,
        temaIds: ev.temaIds,
      })
      await cargarDatosCurso(materiaActual.id, parcialActual.id)
      setAlertaSync({
        tipo: 'exito',
        mensaje: `Actividad "${ev.nombre}" aprobada y publicada en el cálculo 30/30/40.`,
      })
    } catch {
      setAlertaSync({
        tipo: 'error',
        mensaje: `No se pudo publicar la actividad "${ev.nombre}". Intenta editarla manualmente.`,
      })
    } finally {
      setPublicandoLote(false)
    }
  }

  const publicarTodasPendientes = async () => {
    if (!materiaActual || !parcialActual || publicandoLote || aprobablesRapido.length === 0) return
    setPublicandoLote(true)
    try {
      await Promise.all(
        aprobablesRapido.map((ev) =>
          clienteAxios.put(`/academico/evaluaciones/${ev.id}/clasificacion`, {
            parcialId: parcialActual.id,
            tipo: ev.tipo,
            temaIds: ev.temaIds,
          })
        )
      )
      await cargarDatosCurso(materiaActual.id, parcialActual.id)
      setAlertaSync({
        tipo: 'exito',
        mensaje: `Se aprobaron y publicaron ${aprobablesRapido.length} actividad(es) en el cálculo 30/30/40.`,
      })
    } catch {
      setAlertaSync({
        tipo: 'error',
        mensaje: 'No se pudieron aprobar todas las actividades pendientes. Revisa e intenta nuevamente.',
      })
    } finally {
      setPublicandoLote(false)
    }
  }

  const toggleTema = (id: number) => {
    setTemasSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    )
  }

  const abrirModalNueva = () => {
    setEditandoId(null)
    setActividad('')
    setComponente(1)
    setTemasSeleccionados([])
    setErrorValidacion(null)
    setMostrarModal(true)
  }

  const abrirModalClasificar = (ev: EvaluacionDto) => {
    setEditandoId(ev.id)
    setActividad(ev.nombre)
    setComponente(ev.tipo === 0 ? 1 : ev.tipo)
    setTemasSeleccionados(ev.temaIds)
    setErrorValidacion(null)
    setMostrarModal(true)
  }

  const handleGuardar = async (e: FormEvent) => {
    e.preventDefault()
    if (!materiaActual || !parcialActual || guardando) return
    setErrorValidacion(null)

    if (!editandoId && !actividad.trim()) {
      setErrorValidacion('Por favor ingrese el nombre de la actividad académica.')
      return
    }
    if (temasSeleccionados.length === 0) {
      setErrorValidacion('Debe seleccionar al menos un tema asociado a la actividad.')
      return
    }

    setGuardando(true)
    try {
      if (editandoId) {
        await clienteAxios.put(`/academico/evaluaciones/${editandoId}/clasificacion`, {
          parcialId: parcialActual.id,
          tipo: componente,
          temaIds: temasSeleccionados,
        })
      } else {
        await clienteAxios.post('/academico/evaluaciones', {
          parcialId: parcialActual.id,
          nombre: actividad.trim(),
          tipo: componente,
          temaIds: temasSeleccionados,
        })
      }
      setMostrarModal(false)
      await cargarDatosCurso(materiaActual.id, parcialActual.id)
    } catch (error) {
      const msg = extraerMensajeErrorApi(error)
      setErrorValidacion(msg || 'No se pudo guardar la evaluación en el servidor.')
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) return <p role="status" className="text-xs text-[#52525b]">Cargando evaluaciones...</p>
  if (errorCarga) return <p role="alert" className="text-xs text-red-700">{errorCarga}</p>
  if (!materiaActual || !parcialActual) {
    return materias.length === 0 ? (
      <PrimeraSincronizacionMoodle />
    ) : (
      <p className="text-xs text-[#52525b]">No existen materias con parciales disponibles.</p>
    )
  }

  const SORT_LABEL = { apellidos: 'A–Z', nota_asc: 'Menor nota', nota_desc: 'Mayor nota' } as const
  const cicloSort = () =>
    setSortBy((s) => (s === 'apellidos' ? 'nota_asc' : s === 'nota_asc' ? 'nota_desc' : 'apellidos'))
  const filtrosActivos = [
    unidadFiltroId !== null,
    temaFiltroId !== null,
    actividadFiltroId !== null,
    estadoFiltro !== 'todos',
    busquedaEstudiante.trim() !== '',
  ].filter(Boolean).length

  const columnasKanban = [
    { id: 'riesgo', titulo: 'En Riesgo (< 7.0)', icono: '!', color: '#b91c1c', filas: filasOrdenadas.filter((f) => f.enRiesgoFiltrado) },
    { id: 'regular', titulo: 'Regular (7.0 – 8.4)', icono: '•', color: '#d97706', filas: filasOrdenadas.filter((f) => !f.sinEvaluaciones && !f.enRiesgoFiltrado && f.notaFiltrada < 8.5) },
    { id: 'sobresaliente', titulo: 'Sobresaliente (8.5 – 10)', icono: '✓', color: '#15803d', filas: filasOrdenadas.filter((f) => !f.sinEvaluaciones && !f.enRiesgoFiltrado && f.notaFiltrada >= 8.5) },
    ...(filasOrdenadas.some((f) => f.sinEvaluaciones)
      ? [{ id: 'sin-evaluaciones', titulo: 'Sin evaluaciones calificadas', icono: '–', color: '#71717a', filas: filasOrdenadas.filter((f) => f.sinEvaluaciones) }]
      : []),
  ]

  const renderTarjeta = (fila: (typeof filasOrdenadas)[number]) => {
    const est = fila.estudiante
    const expandido = estudianteExpandidoId === est.estudianteId
    const nota = (tipo: number) => {
      const c = fila.componentesFiltrados.find((x) => x.tipo === tipo)
      return c && c.evaluaciones.length > 0 ? c.promedioComponente.toFixed(1) : '—'
    }
    return (
      <div key={est.estudianteId} className="k-card">
        <div className="k-top">
          <AvatarEstudiante
            nombres={est.nombres}
            apellidos={est.apellidos}
            fotoUrl={est.fotoUrl}
            enRiesgo={fila.enRiesgoFiltrado}
            size="sm"
          />
          <div style={{ minWidth: 0 }}>
            <div className="k-name">
              {est.apellidos} {est.nombres}
            </div>
            <div className="k-sub">{est.correo}</div>
          </div>
        </div>
        <div className="k-mid">
          <span>
            Promedio:{' '}
            <strong className="tabular-nums">
              {fila.sinEvaluaciones ? 'Sin evaluaciones' : fila.notaFiltrada.toFixed(2)}
            </strong>
            {!fila.sinEvaluaciones && ' / 10'}
          </span>
          <button
            type="button"
            className="link-btn"
            onClick={() => setEstudianteExpandidoId(expandido ? null : est.estudianteId)}
          >
            {expandido ? 'Ocultar ▴' : 'Detalle ▾'}
          </button>
        </div>
        {expandido && (
          <div className="k-expand">
            {fila.componentesFiltrados.flatMap((comp) =>
              comp.evaluaciones.map((ev) => (
                <div key={ev.itemEvaluacionId} className="flex justify-between gap-2">
                  <span className="truncate">
                    {NOMBRE_COMPONENTE[comp.tipo]} · {ev.nombre}
                  </span>
                  <strong
                    className="tabular-nums shrink-0"
                    style={{ color: ev.esDeficiente ? 'var(--uta)' : '#000' }}
                  >
                    {textoCalificacion(ev.nota, ev.estado)}
                  </strong>
                </div>
              ))
            )}
          </div>
        )}
        <div className="k-foot">
          <span className="tabular-nums">
            T {nota(1)} · A {nota(2)} · E {nota(3)}
          </span>
          <span style={{ display: 'flex', gap: 10 }}>
            {est.enRiesgo && (
              <Link
                to={`/tutoria?materia=${materiaActual.id}&parcial=${parcialActual.numero}&estudiante=${est.estudianteId}`}
                className="link-btn"
                style={{ color: 'var(--uta)' }}
              >
                Tutoría
              </Link>
            )}
            <button
              type="button"
              className="link-btn"
              onClick={() => abrirChatConEstudiante(est, materiaActual.id)}
            >
              IA
            </button>
            <button
              type="button"
              className="link-btn"
              disabled={exportandoEstPdfId === est.estudianteId}
              onClick={() => exportarIndividualPdf(est.estudianteId)}
            >
              {exportandoEstPdfId === est.estudianteId ? '...' : 'PDF'}
            </button>
          </span>
        </div>
      </div>
    )
  }

  const estadoTexto = (fila: (typeof filasOrdenadas)[number]) =>
    metricasCurso.actividadAislada && !fila.entregoActividad
      ? {
          t: textoCalificacion(null, fila.estadoActividadAislada),
          c: fila.enRiesgoFiltrado ? 'risk' : 'warn',
        }
      : fila.sinEvaluaciones
      ? { t: 'Sin evaluaciones', c: 'warn' }
      : fila.esCriticoFiltrado
      ? { t: 'Crítico', c: 'risk' }
      : fila.enRiesgoFiltrado
      ? { t: 'En Riesgo', c: 'risk' }
      : { t: 'Aprobado', c: 'ok' }

  return (
    <div className="space-y-4">
      <div className="cadence-toolbar">
        <div className="toolbar-group">
          <div className="parcial-tabs">
            <button type="button" className={`parcial-tab ${evalMode === 'board' ? 'active' : ''}`} onClick={() => setEvalMode('board')}>
              Tablero
            </button>
            <button type="button" className={`parcial-tab ${evalMode === 'table' ? 'active' : ''}`} onClick={() => setEvalMode('table')}>
              Matriz
            </button>
            <button type="button" className={`parcial-tab ${evalMode === 'activities' ? 'active' : ''}`} onClick={() => setEvalMode('activities')}>
              Actividades ({actividadesTabla.length})
            </button>
          </div>
          <button
            type="button"
            className={`tool-pill ${filtersOpen ? 'active' : ''}`}
            onClick={() => setFiltersOpen((v) => !v)}
          >
            Filtros{filtrosActivos > 0 ? ` (${filtrosActivos})` : ''}
          </button>
          <button type="button" className="tool-pill" onClick={cicloSort}>
            Orden: {SORT_LABEL[sortBy]}
          </button>
        </div>

        <div className="toolbar-group">
          <div className="parcial-tabs">
            {materiaActual.parciales.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`parcial-tab ${p.numero === parcialActual.numero ? 'active' : ''}`}
                onClick={() => {
                  setParcialNumero(p.numero)
                  setUnidadFiltroId(null)
                  setTemaFiltroId(null)
                  setActividadFiltroId(null)
                  setPaginaActual(1)
                }}
              >
                Parcial {p.numero}
              </button>
            ))}
          </div>
          <button type="button" className="tool-pill" onClick={sincronizarMoodle} disabled={sincronizando}>
            {sincronizando ? 'Sincronizando...' : 'Moodle'}
          </button>
          {materiaActual && <FechaSincronizacionMoodle fecha={materiaActual.ultimaSincronizacion} />}
          <button
            type="button"
            className="tool-pill"
            onClick={exportarMatrizPdf}
            disabled={exportandoMatrizPdf || cargandoDatos}
          >
            {exportandoMatrizPdf ? 'Generando...' : 'PDF'}
          </button>
          <button type="button" className="btn-primary" onClick={abrirModalNueva}>
            + Nueva Evaluación
          </button>
        </div>
      </div>

      {alertaSync && (
        <div
          role="alert"
          className="px-3.5 py-2.5 bg-[#f8f9fb] border border-[#e5e7eb] text-xs text-black"
          style={{
            borderLeft: `3px solid ${
              alertaSync.tipo === 'exito' ? 'var(--green)' : alertaSync.tipo === 'advertencia' ? 'var(--amber)' : 'var(--uta)'
            }`,
          }}
        >
          {alertaSync.mensaje}
        </div>
      )}

      {pendientesPublicar.length > 0 && (
        <div className="table-card px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-black">
            <strong>
              Hay {pendientesPublicar.length} actividad(es) de este parcial pendientes de aprobar para reflejarse en
              el cálculo 30/30/40.
            </strong>{' '}
            Ya traen su clasificación preliminar y temas vinculados desde Moodle.
          </div>
          {aprobablesRapido.length > 0 && (
            <button type="button" className="btn-primary" onClick={publicarTodasPendientes} disabled={publicandoLote}>
              {publicandoLote ? 'Publicando actividades...' : `Aprobar y publicar todas (${aprobablesRapido.length})`}
            </button>
          )}
        </div>
      )}

      {filtersOpen && (
        <FiltrosCascada
          parciales={materiaActual.parciales}
          parcialNumero={parcialActual.numero}
          unidades={parcialActual.unidades}
          unidadId={unidadFiltroId}
          temas={temasCascada}
          temaId={temaFiltroId}
          actividades={actividadesCascada}
          actividadId={actividadFiltroId}
          estadoFiltro={estadoFiltro}
          busqueda={busquedaEstudiante}
          totalActividadesFiltradas={evaluacionesEnAlcance.length}
          totalEstudiantesFiltrados={filasRendimiento.length}
          totalEstudiantesCurso={rendimiento.length}
          onParcialChange={(num) => {
            setParcialNumero(num)
            setUnidadFiltroId(null)
            setTemaFiltroId(null)
            setActividadFiltroId(null)
            setPaginaActual(1)
          }}
          onUnidadChange={(id) => {
            setUnidadFiltroId(id)
            setTemaFiltroId(null)
            setActividadFiltroId(null)
            setPaginaActual(1)
          }}
          onTemaChange={(id) => {
            setTemaFiltroId(id)
            setActividadFiltroId(null)
            setPaginaActual(1)
          }}
          onActividadChange={(id) => {
            setActividadFiltroId(id)
            setPaginaActual(1)
          }}
          onEstadoChange={(est) => {
            setEstadoFiltro(est)
            setPaginaActual(1)
          }}
          onBusquedaChange={(q) => {
            setBusquedaEstudiante(q)
            setPaginaActual(1)
          }}
          onLimpiarFiltros={limpiarFiltrosCascada}
        />
      )}

      {metricasCurso.actividadAislada && evalMode !== 'activities' && (
        <section className="stat-strip" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
          <div className="stat-cell">
            <span className="stat-k">
              Actividad aislada · {NOMBRE_COMPONENTE[metricasCurso.actividadAislada.tipo]} (
              {PONDERACION_COMPONENTE[metricasCurso.actividadAislada.tipo]})
            </span>
            <span className="text-[13.5px] font-semibold text-black">{metricasCurso.actividadAislada.nombre}</span>
          </div>
          <div className="stat-cell">
            <span className="stat-k">Promedio del grupo</span>
            <span className="stat-v">{metricasCurso.actividadAislada.promedioActividad}<span style={{ fontSize: 12 }}>/10</span></span>
          </div>
          <div className="stat-cell">
            <span className="stat-k">Tasa de entrega</span>
            <span className="stat-v">{metricasCurso.actividadAislada.tasaEntregaPorcentaje}%</span>
            <div className="stat-note">
              {metricasCurso.actividadAislada.entregados} de {metricasCurso.actividadAislada.totalEstudiantes} entregaron
            </div>
          </div>
        </section>
      )}

      {evalMode === 'board' && (
        <div className="kanban-board">
          {columnasKanban.map((col) => (
            <div key={col.id} className="kanban-col">
              <div className="kanban-col-head">
                <span className="kanban-col-title">
                  <span className="col-badge-icon" style={{ background: col.color }}>
                    {col.icono}
                  </span>
                  {col.titulo}
                </span>
                <span className="text-xs font-semibold tabular-nums text-black">{col.filas.length}</span>
              </div>
              {col.filas.length === 0 ? (
                <div className="text-[12px] text-black px-1 py-3">Sin estudiantes en este rango.</div>
              ) : (
                col.filas.map((fila) => renderTarjeta(fila))
              )}
            </div>
          ))}
        </div>
      )}

      {evalMode === 'table' && (
        <div className="table-card">
          <div className="table-toolbar">
            <div>
              <span className="card-title">Calificaciones Reales por Estudiante — Parcial {parcialActual.numero}</span>
              <div className="text-[12px] text-black">
                {metricasCurso.actividadAislada
                  ? `Vista aislada: ${metricasCurso.actividadAislada.nombre}`
                  : hayFiltroCurricular
                  ? 'Promedios recalculados en vivo según el filtro curricular'
                  : 'Ponderación institucional: 30% Tareas • 30% APE • 40% Examen'}
              </div>
            </div>
            <span className="text-xs text-black tabular-nums">
              {cargandoDatos ? 'Actualizando...' : `${filasRendimiento.length} de ${rendimiento.length} estudiante(s)`}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="em-table">
              <thead>
                <tr>
                  <th>Estudiante</th>
                  {metricasCurso.actividadAislada && <th className="num-col">Nota Actividad</th>}
                  <th className="num-col">Tareas 30%</th>
                  <th className="num-col">APE 30%</th>
                  <th className="num-col">Examen 40%</th>
                  <th className="num-col">Promedio</th>
                  <th>Estado</th>
                  <th className="num-col">Acción</th>
                </tr>
              </thead>
              <tbody>
                {filasPaginadas.length === 0 ? (
                  <tr>
                    <td colSpan={metricasCurso.actividadAislada ? 8 : 7} style={{ textAlign: 'center' }}>
                      {rendimiento.length === 0
                        ? 'No hay estudiantes sincronizados. Presiona "Moodle" para importar calificaciones reales.'
                        : 'Ningún estudiante coincide con los filtros actuales.'}
                    </td>
                  </tr>
                ) : (
                  filasPaginadas.map((fila) => {
                    const est = fila.estudiante
                    const comp = (tipo: number) => {
                      const c = fila.componentesFiltrados.find((x) => x.tipo === tipo)
                      return c && c.evaluado !== false && c.evaluaciones.length > 0 ? c.promedioComponente.toFixed(2) : '—'
                    }
                    const expandido = estudianteExpandidoId === est.estudianteId
                    const estado = estadoTexto(fila)
                    return (
                      <Fragment key={est.estudianteId}>
                        <tr>
                          <td>
                            <div className="flex items-center gap-2.5">
                              <AvatarEstudiante
                                nombres={est.nombres}
                                apellidos={est.apellidos}
                                fotoUrl={est.fotoUrl}
                                enRiesgo={fila.enRiesgoFiltrado}
                                size="sm"
                              />
                              <div style={{ minWidth: 0 }}>
                                <div className="k-name">
                                  {est.apellidos} {est.nombres}
                                </div>
                                <div className="k-sub">{est.correo}</div>
                              </div>
                            </div>
                          </td>
                          {metricasCurso.actividadAislada && (
                            <td className="num-col tabular-nums">
                              {textoCalificacion(fila.notaActividadAislada, fila.estadoActividadAislada)}
                            </td>
                          )}
                          <td className="num-col tabular-nums">{comp(1)}</td>
                          <td className="num-col tabular-nums">{comp(2)}</td>
                          <td className="num-col tabular-nums">{comp(3)}</td>
                          <td className="num-col tabular-nums" style={{ fontWeight: 700 }}>
                            {fila.sinEvaluaciones
                              ? '—'
                              : `${fila.notaFiltrada.toFixed(2)}${est.calculoProvisional && !metricasCurso.actividadAislada ? '*' : ''}`}
                          </td>
                          <td>
                            <span className={`badge-clean ${estado.c}`}>{estado.t}</span>
                          </td>
                          <td className="num-col">
                            <button
                              type="button"
                              className="link-btn"
                              style={{ marginRight: 10 }}
                              onClick={() => setEstudianteExpandidoId(expandido ? null : est.estudianteId)}
                            >
                              {expandido ? 'Ocultar' : 'Detalle'}
                            </button>
                            <button
                              type="button"
                              className="link-btn"
                              style={{ marginRight: 10 }}
                              disabled={exportandoEstPdfId === est.estudianteId}
                              onClick={() => exportarIndividualPdf(est.estudianteId)}
                            >
                              {exportandoEstPdfId === est.estudianteId ? '...' : 'PDF'}
                            </button>
                            {est.enRiesgo && (
                              <Link
                                to={`/tutoria?materia=${materiaActual.id}&parcial=${parcialActual.numero}&estudiante=${est.estudianteId}`}
                                className="link-btn"
                                style={{ color: 'var(--uta)' }}
                              >
                                Diagnosticar IA →
                              </Link>
                            )}
                          </td>
                        </tr>
                        {expandido && (
                          <tr>
                            <td colSpan={metricasCurso.actividadAislada ? 8 : 7} style={{ background: '#fafafa' }}>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {fila.componentesFiltrados.map((c) => (
                                  <div key={c.tipo} className="bg-white border border-[#e5e7eb] p-3 space-y-1.5">
                                    <p className="text-[11.5px] font-bold text-black">
                                      {NOMBRE_COMPONENTE[c.tipo]} ({PONDERACION_COMPONENTE[c.tipo]})
                                    </p>
                                    {c.evaluaciones.length === 0 ? (
                                      <p className="text-[11px] text-black italic">Sin actividades en el alcance.</p>
                                    ) : (
                                      c.evaluaciones.map((ev) => (
                                        <div
                                          key={ev.itemEvaluacionId}
                                          className="flex justify-between gap-2 text-[11.5px] border-t border-[#eef0f3] pt-1"
                                        >
                                          <span className="truncate">{ev.nombre}</span>
                                          <strong
                                            className="tabular-nums shrink-0"
                                            style={{ color: ev.esDeficiente ? 'var(--uta)' : '#000' }}
                                          >
                                            {textoCalificacion(ev.nota, ev.estado, ' / 10')}
                                          </strong>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {!metricasCurso.actividadAislada && filasRendimiento.some((f) => f.estudiante.calculoProvisional) && (
            <p className="px-4 pt-2 text-[11px] text-[#52525b]">{LEYENDA_PROVISIONAL}</p>
          )}

          {filasRendimiento.length > 0 && (
            <div className="px-4 py-3 border-t border-[#eef0f3] flex flex-wrap items-center justify-between gap-3 text-xs text-black">
              <div className="flex items-center gap-2">
                <span className="tabular-nums">
                  Mostrando <strong>{indiceInicio + 1}</strong>–
                  <strong>{Math.min(indiceInicio + tamanoPagina, filasRendimiento.length)}</strong> de{' '}
                  <strong>{filasRendimiento.length}</strong> estudiantes
                </span>
                <select
                  aria-label="Estudiantes por página"
                  value={tamanoPagina}
                  onChange={(e) => {
                    setTamanoPagina(Number(e.target.value))
                    setPaginaActual(1)
                  }}
                  className="px-2 py-1 border border-[#e5e7eb] bg-white text-black text-xs"
                >
                  <option value={5}>5 / pág.</option>
                  <option value={10}>10 / pág.</option>
                  <option value={15}>15 / pág.</option>
                  <option value={25}>25 / pág.</option>
                </select>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={paginaSegura <= 1}
                  onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </button>
                {Array.from({ length: totalPaginas }, (_, idx) => idx + 1).map((num) => (
                  <button
                    key={num}
                    type="button"
                    className={num === paginaSegura ? 'btn-primary' : 'btn-secondary'}
                    onClick={() => setPaginaActual(num)}
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={paginaSegura >= totalPaginas}
                  onClick={() => setPaginaActual((p) => Math.min(totalPaginas, p + 1))}
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {evalMode === 'activities' && (
        <div className="table-card">
          <div className="table-toolbar">
            <div>
              <span className="card-title">Actividades de Evaluación — {materiaActual.nombre}</span>
              <div className="text-[12px] text-black tabular-nums">
                {actividadesTabla.length} de {evaluacionesVisibles.length} actividad(es) • {pendientesPublicar.length}{' '}
                pendiente(s) de publicar
              </div>
            </div>
            {aprobablesRapido.length > 0 && (
              <button type="button" className="btn-primary" onClick={publicarTodasPendientes} disabled={publicandoLote}>
                {publicandoLote ? 'Publicando...' : `Aprobar pendientes (${aprobablesRapido.length})`}
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="em-table">
              <thead>
                <tr>
                  <th>Actividad Académica</th>
                  <th>Componente</th>
                  <th>Ponderación</th>
                  <th>Temas Vinculados</th>
                  <th className="num-col">Clasificación</th>
                </tr>
              </thead>
              <tbody>
                {actividadesTabla.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center' }}>
                      No existen actividades registradas para este alcance o parcial.
                    </td>
                  </tr>
                ) : (
                  actividadesTabla.map((ev) => {
                    const temas = temasDisponibles.filter((t) => ev.temaIds.includes(t.id))
                    return (
                      <tr key={ev.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{ev.nombre}</div>
                          <span className={`badge-clean ${ev.publicado ? 'ok' : 'warn'}`} style={{ fontSize: 11.5 }}>
                            {ev.publicado ? 'Publicada en cálculo' : 'Pendiente de aprobar'}
                          </span>
                        </td>
                        <td>{NOMBRE_COMPONENTE[ev.tipo]}</td>
                        <td className="tabular-nums">{PONDERACION_COMPONENTE[ev.tipo]}</td>
                        <td>
                          <div className="flex flex-wrap gap-1">
                            {temas.length === 0 ? (
                              <span className="text-[11.5px] italic">Pendiente de vincular</span>
                            ) : (
                              temas.map((t) => (
                                <span
                                  key={t.id}
                                  title={t.nombre}
                                  className="text-[11px] px-1.5 py-0.5 border border-[#e5e7eb] bg-white"
                                >
                                  {t.nombre}
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="num-col">
                          {!ev.publicado && ev.tipo !== 0 && ev.temaIds.length > 0 && (
                            <button
                              type="button"
                              className="link-btn"
                              style={{ marginRight: 10, color: 'var(--green)' }}
                              disabled={publicandoLote}
                              onClick={() => publicarEvaluacionRapida(ev)}
                            >
                              Publicar
                            </button>
                          )}
                          <button type="button" className="link-btn" onClick={() => abrirModalClasificar(ev)}>
                            {ev.tipo === 0 ? 'Clasificar' : 'Editar'}
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Registro o Clasificación de Evaluación */}
      {mostrarModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-5 border border-[#e4e4e7]">
            <div className="flex justify-between items-center pb-3 border-b border-[#e4e4e7]">
              <div>
                <h3 className="font-bold text-sm text-[#18181b]">
                  {editandoId ? 'Clasificar Evaluación' : 'Registrar Nueva Evaluación'}
                </h3>
                <p className="text-[11px] text-[#52525b]">
                  {materiaActual.nombre} • Parcial {parcialActual.numero}
                </p>
              </div>
              <button
                type="button"
                disabled={guardando}
                onClick={() => setMostrarModal(false)}
                className="text-[#71717a] hover:text-[#18181b] text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            {errorValidacion && (
              <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                {errorValidacion}
              </div>
            )}

            <form onSubmit={handleGuardar} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-[#27272a] mb-1">
                  Nombre de la Actividad
                </label>
                <input
                  type="text"
                  value={actividad}
                  disabled={editandoId !== null}
                  onChange={(e) => setActividad(e.target.value)}
                  placeholder="Ej: Taller 2: Diagramas de Casos de Uso"
                  className="w-full text-xs p-2 border border-[#d4d4d8] rounded focus:outline-none focus:border-[#8B151A] disabled:bg-[#f4f4f5]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#27272a] mb-1">
                  Componente Oficial
                </label>
                <select
                  value={componente}
                  onChange={(e) => setComponente(Number(e.target.value) as TipoItemEvaluacion)}
                  className="w-full text-xs p-2 border border-[#d4d4d8] rounded focus:outline-none focus:border-[#8B151A]"
                >
                  <option value={1}>Tareas (30%)</option>
                  <option value={2}>APE (30%)</option>
                  <option value={3}>Examen (40%)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#27272a] mb-1">
                  Temas del Parcial Asociados ({materiaActual.nombre})
                </label>
                <div className="border border-[#d4d4d8] rounded p-2 max-h-44 overflow-y-auto space-y-1.5 bg-[#fafafa]">
                  {temasDisponibles.length === 0 ? (
                    <p className="text-xs text-[#71717a] p-2">
                      No hay temas registrados en el catálogo para este parcial.
                    </p>
                  ) : (
                    temasDisponibles.map((tema) => (
                      <label
                        key={tema.id}
                        className="flex items-center gap-2 text-xs text-[#3f3f46] hover:bg-white p-1.5 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={temasSeleccionados.includes(tema.id)}
                          onChange={() => toggleTema(tema.id)}
                          className="rounded text-[#8B151A] focus:ring-[#8B151A]"
                        />
                        <span>
                          <strong className="text-[#8B151A]">{tema.codigo}</strong> — {tema.nombre}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#e4e4e7]">
                <button
                  type="button"
                  disabled={guardando}
                  onClick={() => setMostrarModal(false)}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="btn-primary"
                >
                  {guardando ? 'Guardando...' : 'Guardar Evaluación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default EvaluacionesPage
