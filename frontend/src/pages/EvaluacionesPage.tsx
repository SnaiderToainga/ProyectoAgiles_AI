import { Fragment, useState, useEffect, useMemo, useCallback, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import clienteAxios from '../api/clienteAxios'
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

interface AlertaEstado {
  tipo: 'exito' | 'advertencia' | 'error'
  mensaje: string
}

export function EvaluacionesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const materiaQuery = searchParams.get('materia')

  const [materias, setMaterias] = useState<MateriaDto[]>([])
  const [materiaActivaId, setMateriaActivaId] = useState<number>(
    materiaQuery ? Number(materiaQuery) : 0
  )
  const [parcialNumero, setParcialNumero] = useState<number>(1)

  const [evaluaciones, setEvaluaciones] = useState<EvaluacionDto[]>([])
  const [rendimiento, setRendimiento] = useState<ResumenAcademicoEstudianteDto[]>([])
  const [cargando, setCargando] = useState(true)
  const [cargandoDatos, setCargandoDatos] = useState(false)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [sincronizando, setSincronizando] = useState(false)
  const [alertaSync, setAlertaSync] = useState<AlertaEstado | null>(null)
  const [estudianteExpandidoId, setEstudianteExpandidoId] = useState<number | null>(null)
  const [exportandoMatrizPdf, setExportandoMatrizPdf] = useState(false)
  const [exportandoEstPdfId, setExportandoEstPdfId] = useState<number | null>(null)

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
          const idInicial = materiaQuery ? Number(materiaQuery) : data[0].id
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

  const actividadesCascada = useMemo(
    () =>
      obtenerEvaluacionesEnAlcance(
        evaluacionesVisibles,
        parcialActual,
        unidadFiltroId,
        temaFiltroId,
        null
      ),
    [evaluacionesVisibles, parcialActual, unidadFiltroId, temaFiltroId]
  )

  const evaluacionesEnAlcance = useMemo(
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
        ? evaluacionesVisibles.find((e) => e.id === actividadFiltroId) ?? null
        : null,
    [evaluacionesVisibles, actividadFiltroId]
  )

  const metricasCurso = useMemo(
    () => calcularMetricasGrupo(filasRendimiento, actividadSeleccionada),
    [filasRendimiento, actividadSeleccionada]
  )

  const totalPaginas = Math.max(1, Math.ceil(filasRendimiento.length / tamanoPagina))
  const paginaSegura = Math.min(paginaActual, totalPaginas)
  const indiceInicio = (paginaSegura - 1) * tamanoPagina
  const filasPaginadas = useMemo(
    () => filasRendimiento.slice(indiceInicio, indiceInicio + tamanoPagina),
    [filasRendimiento, indiceInicio, tamanoPagina]
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
      const detalle =
        axios.isAxiosError(error) && typeof error.response?.data === 'object' && error.response?.data
          ? (error.response.data as { detail?: string; mensaje?: string }).detail ||
            (error.response.data as { mensaje?: string }).mensaje
          : undefined
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
      const detalle =
        axios.isAxiosError(error) && typeof error.response?.data === 'object' && error.response?.data
          ? (error.response.data as { detail?: string; mensaje?: string }).detail ||
            (error.response.data as { mensaje?: string }).mensaje
          : undefined
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
      await cargarDatosCurso(materiaActual.id, parcialActual.id)
      setAlertaSync({
        tipo: 'exito',
        mensaje: `Calificaciones actualizadas desde Moodle (${data.calificaciones} calificaciones y ${data.items} actividades sincronizadas).`,
      })
    } catch (error) {
      const detalle =
        axios.isAxiosError(error) && typeof error.response?.data === 'object' && error.response?.data
          ? (error.response.data as { detail?: string; mensaje?: string }).detail ||
            (error.response.data as { mensaje?: string }).mensaje
          : undefined
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
      const msg =
        axios.isAxiosError(error) && typeof error.response?.data === 'object' && error.response?.data
          ? (error.response.data as { detail?: string; mensaje?: string }).detail ||
            (error.response.data as { mensaje?: string }).mensaje
          : undefined
      setErrorValidacion(msg || 'No se pudo guardar la evaluación en el servidor.')
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) return <p role="status" className="text-xs text-[#52525b]">Cargando evaluaciones...</p>
  if (errorCarga) return <p role="alert" className="text-xs text-red-700">{errorCarga}</p>
  if (!materiaActual || !parcialActual) {
    return <p className="text-xs text-[#52525b]">No existen materias con parciales disponibles.</p>
  }

  return (
    <div className="space-y-6">
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
                  setAlertaSync(null)
                  setUnidadFiltroId(null)
                  setTemaFiltroId(null)
                  setActividadFiltroId(null)
                  setPaginaActual(1)
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
                onClick={() => {
                  setParcialNumero(p.numero)
                  setUnidadFiltroId(null)
                  setTemaFiltroId(null)
                  setActividadFiltroId(null)
                  setPaginaActual(1)
                }}
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

      {/* Encabezado Principal */}
      <div className="bg-white border border-[#e4e4e7] border-l-4 border-l-[#8B151A] rounded-md p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-[#18181b]">
            Evaluaciones y Ponderación Institucional
          </h1>
          <p className="text-xs text-[#52525b] mt-0.5">
            {materiaActual.nombre} ({materiaActual.codigo}) • Parcial {parcialActual.numero}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={sincronizarMoodle}
            disabled={sincronizando}
            className="px-3.5 py-2 border border-[#d4d4d8] hover:bg-[#f4f4f5] disabled:opacity-60 text-[#27272a] rounded text-xs font-semibold transition cursor-pointer"
          >
            {sincronizando ? 'Sincronizando Moodle...' : 'Sincronizar con Moodle'}
          </button>

          <button
            type="button"
            onClick={exportarMatrizPdf}
            disabled={exportandoMatrizPdf || cargandoDatos}
            className="px-3.5 py-2 border border-[#8B151A] text-[#8B151A] hover:bg-red-50 disabled:opacity-60 rounded text-xs font-semibold transition cursor-pointer"
          >
            {exportandoMatrizPdf ? 'Generando PDF...' : 'Exportar Matriz PDF'}
          </button>

          <button
            type="button"
            onClick={abrirModalNueva}
            className="px-4 py-2 bg-[#8B151A] hover:bg-[#6E1014] text-white rounded text-xs font-semibold transition cursor-pointer"
          >
            + Nueva Evaluación
          </button>
        </div>
      </div>

      {/* Notificación de Sincronización Moodle / Exportación PDF */}
      {alertaSync && (
        <div
          role="alert"
          className={`p-3.5 rounded-md border-l-4 text-xs font-medium ${
            alertaSync.tipo === 'exito'
              ? 'bg-emerald-50 border-emerald-600 text-emerald-800'
              : alertaSync.tipo === 'advertencia'
              ? 'bg-amber-50 border-amber-500 text-amber-800'
              : 'bg-red-50 border-red-600 text-red-800'
          }`}
        >
          {alertaSync.mensaje}
        </div>
      )}

      {/* Filtros en Cascada: Parcial -> Unidad -> Tema -> Actividad (T-12.6 / T-12.7) */}
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

      {/* Tarjetas de Ponderación Oficial en Vivo (T-12.8: 30% Tareas, 30% APE, 40% Examen) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-md p-4 border border-[#e4e4e7]">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-[#52525b]">Tareas Formativas</span>
            <span className="text-[11px] font-bold px-2 py-0.5 bg-blue-50 text-blue-700 rounded">
              30%
            </span>
          </div>
          <p className="text-2xl font-bold text-[#18181b] mt-2">
            {metricasCurso.promTareas}{' '}
            <span className="text-xs font-normal text-[#71717a]">/ 10</span>
          </p>
          <p className="text-[11px] text-[#52525b] mt-1">
            Aporte promedio: <strong className="text-[#18181b]">{metricasCurso.aporteTareas} pts</strong>
          </p>
        </div>

        <div className="bg-white rounded-md p-4 border border-[#e4e4e7]">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-[#52525b]">Prácticas APE</span>
            <span className="text-[11px] font-bold px-2 py-0.5 bg-purple-50 text-purple-700 rounded">
              30%
            </span>
          </div>
          <p className="text-2xl font-bold text-[#18181b] mt-2">
            {metricasCurso.promApe}{' '}
            <span className="text-xs font-normal text-[#71717a]">/ 10</span>
          </p>
          <p className="text-[11px] text-[#52525b] mt-1">
            Aporte promedio: <strong className="text-[#18181b]">{metricasCurso.aporteApe} pts</strong>
          </p>
        </div>

        <div className="bg-white rounded-md p-4 border border-[#e4e4e7]">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-[#52525b]">Examen Sumativo</span>
            <span className="text-[11px] font-bold px-2 py-0.5 bg-amber-50 text-amber-700 rounded">
              40%
            </span>
          </div>
          <p className="text-2xl font-bold text-[#18181b] mt-2">
            {metricasCurso.promExamen}{' '}
            <span className="text-xs font-normal text-[#71717a]">/ 10</span>
          </p>
          <p className="text-[11px] text-[#52525b] mt-1">
            Aporte promedio: <strong className="text-[#18181b]">{metricasCurso.aporteExamen} pts</strong>
          </p>
        </div>

        <div
          className={`bg-white rounded-md p-4 border ${
            metricasCurso.totalEnRiesgo > 0 ? 'border-red-400 bg-red-50/20' : 'border-[#8B151A]'
          }`}
        >
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-[#8B151A]">
              {hayFiltroCurricular ? 'Promedio del Alcance' : 'Promedio del Curso'}
            </span>
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                metricasCurso.totalEnRiesgo > 0
                  ? 'bg-red-100 text-red-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {metricasCurso.totalEnRiesgo} en riesgo
            </span>
          </div>
          <p className="text-2xl font-bold text-[#8B151A] mt-2">
            {metricasCurso.promedioCurso}{' '}
            <span className="text-xs font-normal text-[#71717a]">/ 10.00 pts</span>
          </p>
          <p className="text-[11px] text-[#52525b] mt-1">
            Evaluados: <strong className="text-[#18181b]">{filasRendimiento.length}</strong> • Aprobación:{' '}
            <strong className="text-[#18181b]">{metricasCurso.porcentajeAprobados}%</strong>
          </p>
        </div>
      </div>

      {/* Panel de Métricas de Actividad Específica Aislada (CA-06.5) */}
      {metricasCurso.actividadAislada && (
        <div
          role="region"
          aria-label="Resumen de actividad específica seleccionada"
          className="bg-white border border-[#e4e4e7] border-l-4 border-l-[#8B151A] rounded-md p-4 grid grid-cols-1 md:grid-cols-3 gap-4 items-center"
        >
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#8B151A]">
              Actividad Aislada • {NOMBRE_COMPONENTE[metricasCurso.actividadAislada.tipo]} (
              {PONDERACION_COMPONENTE[metricasCurso.actividadAislada.tipo]})
            </span>
            <h2 className="text-sm font-bold text-[#18181b] mt-0.5">
              {metricasCurso.actividadAislada.nombre}
            </h2>
          </div>

          <div className="bg-[#fafafa] border border-[#e4e4e7] rounded p-3">
            <span className="text-[11px] font-semibold text-[#52525b]">
              Promedio del Grupo (Escala 0–10)
            </span>
            <p className="text-xl font-bold text-[#18181b] mt-0.5">
              {metricasCurso.actividadAislada.promedioActividad}{' '}
              <span className="text-xs font-normal text-[#71717a]">/ 10.00</span>
            </p>
          </div>

          <div className="bg-[#fafafa] border border-[#e4e4e7] rounded p-3">
            <span className="text-[11px] font-semibold text-[#52525b]">
              Tasa de Entrega de la Actividad
            </span>
            <p className="text-xl font-bold text-[#8B151A] mt-0.5">
              {metricasCurso.actividadAislada.tasaEntregaPorcentaje}%{' '}
              <span className="text-xs font-normal text-[#52525b]">
                ({metricasCurso.actividadAislada.entregados} de{' '}
                {metricasCurso.actividadAislada.totalEstudiantes} entregaron)
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Tabla Dinámica de Calificaciones Reales por Estudiante con Avatares y Paginación */}
      <div className="bg-white rounded-md border border-[#e4e4e7] overflow-hidden">
        <div className="p-4 border-b border-[#e4e4e7] flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-bold text-sm text-[#18181b]">
              Calificaciones Reales por Estudiante — Parcial {parcialActual.numero}
            </h2>
            <p className="text-[11px] text-[#71717a]">
              {metricasCurso.actividadAislada
                ? `Vista aislada: ${metricasCurso.actividadAislada.nombre} (Escala normalizada 0 a 10)`
                : hayFiltroCurricular
                ? 'Promedios recalculados en vivo según el filtro curricular seleccionado'
                : 'Ponderación institucional: 30% Tareas • 30% APE • 40% Examen'}
            </p>
          </div>
          <span className="text-xs text-[#71717a]">
            {cargandoDatos
              ? 'Actualizando...'
              : `${filasRendimiento.length} de ${rendimiento.length} estudiante(s)`}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f4f4f5] text-[#52525b] border-b border-[#e4e4e7]">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Estudiante</th>
                {metricasCurso.actividadAislada && (
                  <th className="py-2.5 px-4 font-semibold text-right text-[#8B151A]">
                    Nota Actividad (0–10)
                  </th>
                )}
                <th className="py-2.5 px-4 font-semibold text-right">Tareas (30%)</th>
                <th className="py-2.5 px-4 font-semibold text-right">APE (30%)</th>
                <th className="py-2.5 px-4 font-semibold text-right">Examen (40%)</th>
                <th className="py-2.5 px-4 font-semibold text-right">Promedio</th>
                <th className="py-2.5 px-4 font-semibold text-center">Estado</th>
                <th className="py-2.5 px-4 font-semibold text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e4e4e7]">
              {filasPaginadas.length === 0 ? (
                <tr>
                  <td
                    colSpan={metricasCurso.actividadAislada ? 8 : 7}
                    className="py-6 px-4 text-center text-[#71717a]"
                  >
                    {rendimiento.length === 0
                      ? 'No hay estudiantes matriculados o sincronizados en esta asignatura. Presiona "Sincronizar con Moodle" para importar calificaciones reales.'
                      : 'Ningún estudiante coincide con los filtros curriculares o de búsqueda actuales.'}
                  </td>
                </tr>
              ) : (
                filasPaginadas.map((fila) => {
                  const est = fila.estudiante
                  const compTareas = fila.componentesFiltrados.find((c) => c.tipo === 1)
                  const compApe = fila.componentesFiltrados.find((c) => c.tipo === 2)
                  const compExamen = fila.componentesFiltrados.find((c) => c.tipo === 3)
                  const expandido = estudianteExpandidoId === est.estudianteId

                  return (
                    <Fragment key={est.estudianteId}>
                      <tr className="hover:bg-[#fafafa] transition">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <AvatarEstudiante
                              nombres={est.nombres}
                              apellidos={est.apellidos}
                              fotoUrl={est.fotoUrl}
                              enRiesgo={fila.enRiesgoFiltrado}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <p className="font-semibold text-[#18181b] truncate">
                                {est.apellidos} {est.nombres}
                              </p>
                              <p className="text-[11px] text-[#71717a] truncate">{est.correo}</p>
                            </div>
                          </div>
                        </td>
                        {metricasCurso.actividadAislada && (
                          <td className="py-3 px-4 text-right font-bold">
                            {fila.notaActividadAislada !== null ? (
                              <span
                                className={
                                  fila.notaActividadAislada < 7 ? 'text-red-700' : 'text-[#18181b]'
                                }
                              >
                                {fila.notaActividadAislada.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                                Sin entregar
                              </span>
                            )}
                          </td>
                        )}
                        <td className="py-3 px-4 text-right font-medium text-[#18181b]">
                          {compTareas && compTareas.evaluaciones.length > 0
                            ? compTareas.promedioComponente.toFixed(2)
                            : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-[#18181b]">
                          {compApe && compApe.evaluaciones.length > 0
                            ? compApe.promedioComponente.toFixed(2)
                            : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-[#18181b]">
                          {compExamen && compExamen.evaluaciones.length > 0
                            ? compExamen.promedioComponente.toFixed(2)
                            : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-[#18181b]">
                          {fila.notaFiltrada.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                              fila.enRiesgoFiltrado
                                ? 'bg-red-100 text-red-700'
                                : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {metricasCurso.actividadAislada && !fila.entregoActividad
                              ? 'Pendiente'
                              : fila.esCriticoFiltrado
                              ? 'Crítico'
                              : fila.enRiesgoFiltrado
                              ? 'En Riesgo'
                              : 'Aprobado'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-2.5">
                            <button
                              type="button"
                              onClick={() =>
                                setEstudianteExpandidoId(expandido ? null : est.estudianteId)
                              }
                              className="text-[11px] font-semibold text-[#52525b] hover:text-[#18181b] cursor-pointer"
                            >
                              {expandido ? 'Ocultar' : 'Detalle'}
                            </button>
                            <button
                              type="button"
                              onClick={() => exportarIndividualPdf(est.estudianteId)}
                              disabled={exportandoEstPdfId === est.estudianteId}
                              className="text-[11px] font-semibold text-[#18181b] hover:text-[#8B151A] hover:underline disabled:opacity-50 cursor-pointer"
                            >
                              {exportandoEstPdfId === est.estudianteId ? '...' : 'PDF'}
                            </button>
                            {est.enRiesgo && (
                              <Link
                                to={`/tutoria?materia=${materiaActual.id}&parcial=${parcialActual.numero}&estudiante=${est.estudianteId}`}
                                className="text-[11px] font-semibold text-[#8B151A] hover:underline"
                              >
                                Diagnosticar IA →
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expandido && (
                        <tr key={`${est.estudianteId}-detalle`} className="bg-[#fafafa]">
                          <td
                            colSpan={metricasCurso.actividadAislada ? 8 : 7}
                            className="px-4 py-3"
                          >
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              {fila.componentesFiltrados.map((comp) => (
                                <div
                                  key={comp.tipo}
                                  className="bg-white border border-[#e4e4e7] rounded p-3 space-y-1.5"
                                >
                                  <p className="text-[11px] font-bold text-[#18181b]">
                                    {NOMBRE_COMPONENTE[comp.tipo]} ({PONDERACION_COMPONENTE[comp.tipo]})
                                  </p>
                                  {comp.evaluaciones.length === 0 ? (
                                    <p className="text-[11px] text-[#71717a] italic">
                                      Sin actividades en el alcance seleccionado.
                                    </p>
                                  ) : (
                                    comp.evaluaciones.map((ev) => (
                                      <div
                                        key={ev.itemEvaluacionId}
                                        className="flex justify-between items-center text-[11px] border-t border-[#f4f4f5] pt-1"
                                      >
                                        <span className="text-[#3f3f46] truncate pr-2">
                                          {ev.nombre}
                                        </span>
                                        <span
                                          className={`font-semibold shrink-0 ${
                                            ev.nota === null
                                              ? 'text-[#71717a] italic'
                                              : ev.esDeficiente
                                              ? 'text-red-700'
                                              : 'text-[#18181b]'
                                          }`}
                                        >
                                          {ev.nota === null ? 'Sin nota' : `${ev.nota.toFixed(2)} / 10`}
                                        </span>
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

        {/* Controles de Paginación (CA-06.5) */}
        {filasRendimiento.length > 0 && (
          <div className="px-4 py-3 border-t border-[#e4e4e7] bg-[#fafafa] flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-[#52525b]">
              <span>
                Mostrando <strong className="text-[#18181b]">{indiceInicio + 1}</strong>–
                <strong className="text-[#18181b]">
                  {Math.min(indiceInicio + tamanoPagina, filasRendimiento.length)}
                </strong>{' '}
                de <strong className="text-[#18181b]">{filasRendimiento.length}</strong> estudiantes
              </span>
              <select
                aria-label="Estudiantes por página"
                value={tamanoPagina}
                onChange={(e) => {
                  setTamanoPagina(Number(e.target.value))
                  setPaginaActual(1)
                }}
                className="px-2 py-1 border border-[#d4d4d8] rounded bg-white text-[#18181b] text-xs"
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
                disabled={paginaSegura <= 1}
                onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 border border-[#d4d4d8] rounded bg-white text-[#18181b] hover:bg-[#f4f4f5] disabled:opacity-40 cursor-pointer"
              >
                Anterior
              </button>
              {Array.from({ length: totalPaginas }, (_, idx) => idx + 1).map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setPaginaActual(num)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer ${
                    num === paginaSegura
                      ? 'bg-[#8B151A] text-white'
                      : 'border border-[#d4d4d8] bg-white text-[#18181b] hover:bg-[#f4f4f5]'
                  }`}
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                disabled={paginaSegura >= totalPaginas}
                onClick={() => setPaginaActual((p) => Math.min(totalPaginas, p + 1))}
                className="px-2.5 py-1 border border-[#d4d4d8] rounded bg-white text-[#18181b] hover:bg-[#f4f4f5] disabled:opacity-40 cursor-pointer"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tabla de Actividades Académicas Registradas / Importadas en el Alcance */}
      <div className="bg-white rounded-md border border-[#e4e4e7] overflow-hidden">
        <div className="p-4 border-b border-[#e4e4e7] flex items-center justify-between">
          <h2 className="font-bold text-sm text-[#18181b]">
            Actividades de Evaluación — {materiaActual.nombre}
          </h2>
          <span className="text-xs text-[#71717a]">
            {evaluacionesEnAlcance.length} de {evaluacionesVisibles.length} actividad(es)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f4f4f5] text-[#52525b] border-b border-[#e4e4e7]">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Actividad Académica</th>
                <th className="py-2.5 px-4 font-semibold">Componente</th>
                <th className="py-2.5 px-4 font-semibold">Ponderación</th>
                <th className="py-2.5 px-4 font-semibold">Temas Vinculados</th>
                <th className="py-2.5 px-4 font-semibold text-center">Clasificación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e4e4e7]">
              {evaluacionesEnAlcance.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-5 px-4 text-center text-[#71717a]">
                    No existen actividades registradas para este alcance o parcial.
                  </td>
                </tr>
              ) : (
                evaluacionesEnAlcance.map((ev) => {
                  const temas = temasDisponibles.filter((t) => ev.temaIds.includes(t.id))
                  return (
                    <tr key={ev.id} className="hover:bg-[#fafafa] transition">
                      <td className="py-3 px-4 font-medium text-[#18181b]">{ev.nombre}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                            ev.tipo === 1
                              ? 'bg-blue-100 text-blue-800'
                              : ev.tipo === 2
                              ? 'bg-purple-100 text-purple-800'
                              : ev.tipo === 3
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-zinc-100 text-zinc-700'
                          }`}
                        >
                          {NOMBRE_COMPONENTE[ev.tipo]}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-[#52525b]">
                        {PONDERACION_COMPONENTE[ev.tipo]}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {temas.length === 0 ? (
                            <span className="text-[11px] text-[#a1a1aa] italic">
                              Pendiente de vincular
                            </span>
                          ) : (
                            temas.map((t) => (
                              <span
                                key={t.id}
                                title={t.nombre}
                                className="bg-[#f4f4f5] text-[#3f3f46] px-1.5 py-0.5 rounded text-[10px] border border-[#e4e4e7]"
                              >
                                {t.nombre}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => abrirModalClasificar(ev)}
                          className="text-xs font-semibold text-[#8B151A] hover:underline cursor-pointer"
                        >
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
                  className="px-3 py-1.5 text-xs text-[#52525b] hover:bg-[#f4f4f5] rounded transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="px-4 py-1.5 text-xs bg-[#8B151A] hover:bg-[#6E1014] text-white font-semibold rounded transition cursor-pointer"
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
