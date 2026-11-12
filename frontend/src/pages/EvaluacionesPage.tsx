import { Fragment, useState, useEffect, useMemo, useCallback, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import clienteAxios from '../api/clienteAxios'
import {
  NOMBRE_COMPONENTE,
  PONDERACION_COMPONENTE,
  type EvaluacionDto,
  type MateriaDto,
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

  const temasDisponibles = useMemo(() => {
    if (!parcialActual) return []
    return parcialActual.unidades.flatMap((u) =>
      u.temas.map((t) => ({
        id: t.id,
        codigo: `U${u.numero}`,
        nombre: t.nombre,
      }))
    )
  }, [parcialActual])

  const evaluacionesVisibles = useMemo(() => {
    if (!parcialActual) return []
    return evaluaciones.filter(
      (ev) => ev.parcialId === parcialActual.id || ev.parcialId === null
    )
  }, [evaluaciones, parcialActual])

  const metricasCurso = useMemo(() => {
    if (rendimiento.length === 0) {
      return {
        promTareas: '0.00',
        aporteTareas: '0.00',
        promApe: '0.00',
        aporteApe: '0.00',
        promExamen: '0.00',
        aporteExamen: '0.00',
        promedioCurso: '0.00',
        totalEnRiesgo: 0,
      }
    }

    const avgComp = (tipo: TipoItemEvaluacion) => {
      const total = rendimiento.reduce((acc, est) => {
        const comp = est.componentes.find((c) => c.tipo === tipo)
        return acc + (comp ? comp.promedioComponente : 0)
      }, 0)
      return total / rendimiento.length
    }

    const promTareas = avgComp(1)
    const promApe = avgComp(2)
    const promExamen = avgComp(3)
    const promedioCurso =
      rendimiento.reduce((acc, est) => acc + est.notaFinalParcial, 0) / rendimiento.length
    const totalEnRiesgo = rendimiento.filter((est) => est.enRiesgo).length

    return {
      promTareas: promTareas.toFixed(2),
      aporteTareas: (promTareas * 0.3).toFixed(2),
      promApe: promApe.toFixed(2),
      aporteApe: (promApe * 0.3).toFixed(2),
      promExamen: promExamen.toFixed(2),
      aporteExamen: (promExamen * 0.4).toFixed(2),
      promedioCurso: promedioCurso.toFixed(2),
      totalEnRiesgo,
    }
  }, [rendimiento])

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
          'No se pudo conectar con Moodle Docker en este momento. Se mantienen las últimas calificaciones guardadas en SQL Server.',
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
            onClick={abrirModalNueva}
            className="px-4 py-2 bg-[#8B151A] hover:bg-[#6E1014] text-white rounded text-xs font-semibold transition cursor-pointer"
          >
            + Nueva Evaluación
          </button>
        </div>
      </div>

      {/* Notificación de Sincronización Moodle */}
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

      {/* Tarjetas de Ponderación Oficial (30% Tareas, 30% APE, 40% Examen) */}
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
            <span className="text-xs font-semibold text-[#8B151A]">Promedio del Curso</span>
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
            Estudiantes evaluados: <strong className="text-[#18181b]">{rendimiento.length}</strong>
          </p>
        </div>
      </div>

      {/* Tabla Dinámica de Calificaciones Reales por Estudiante */}
      <div className="bg-white rounded-md border border-[#e4e4e7] overflow-hidden">
        <div className="p-4 border-b border-[#e4e4e7] flex items-center justify-between">
          <div>
            <h2 className="font-bold text-sm text-[#18181b]">
              Calificaciones Reales por Estudiante — Parcial {parcialActual.numero}
            </h2>
            <p className="text-[11px] text-[#71717a]">
              Cálculo ponderado en vivo (30% Tareas • 30% APE • 40% Examen)
            </p>
          </div>
          <span className="text-xs text-[#71717a]">
            {cargandoDatos ? 'Actualizando...' : `${rendimiento.length} estudiante(s)`}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f4f4f5] text-[#52525b] border-b border-[#e4e4e7]">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Estudiante</th>
                <th className="py-2.5 px-4 font-semibold text-right">Tareas (30%)</th>
                <th className="py-2.5 px-4 font-semibold text-right">APE (30%)</th>
                <th className="py-2.5 px-4 font-semibold text-right">Examen (40%)</th>
                <th className="py-2.5 px-4 font-semibold text-right">Promedio</th>
                <th className="py-2.5 px-4 font-semibold text-center">Estado</th>
                <th className="py-2.5 px-4 font-semibold text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e4e4e7]">
              {rendimiento.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 px-4 text-center text-[#71717a]">
                    No hay estudiantes matriculados o sincronizados en esta asignatura. Presiona &quot;Sincronizar con Moodle&quot; para importar calificaciones reales.
                  </td>
                </tr>
              ) : (
                rendimiento.map((est) => {
                  const compTareas = est.componentes.find((c) => c.tipo === 1)
                  const compApe = est.componentes.find((c) => c.tipo === 2)
                  const compExamen = est.componentes.find((c) => c.tipo === 3)
                  const expandido = estudianteExpandidoId === est.estudianteId

                  return (
                    <Fragment key={est.estudianteId}>
                      <tr className="hover:bg-[#fafafa] transition">
                        <td className="py-3 px-4">
                          <p className="font-semibold text-[#18181b]">
                            {est.apellidos} {est.nombres}
                          </p>
                          <p className="text-[11px] text-[#71717a]">{est.correo}</p>
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-[#18181b]">
                          {(compTareas?.promedioComponente ?? 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-[#18181b]">
                          {(compApe?.promedioComponente ?? 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-[#18181b]">
                          {(compExamen?.promedioComponente ?? 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-[#18181b]">
                          {est.notaFinalParcial.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                              est.enRiesgo
                                ? 'bg-red-100 text-red-700'
                                : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {est.enRiesgo ? 'En Riesgo' : 'Aprobado'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-3">
                            <button
                              type="button"
                              onClick={() =>
                                setEstudianteExpandidoId(expandido ? null : est.estudianteId)
                              }
                              className="text-[11px] font-semibold text-[#52525b] hover:text-[#18181b] cursor-pointer"
                            >
                              {expandido ? 'Ocultar' : 'Detalle'}
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
                          <td colSpan={7} className="px-4 py-3">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              {est.componentes.map((comp) => (
                                <div
                                  key={comp.tipo}
                                  className="bg-white border border-[#e4e4e7] rounded p-3 space-y-1.5"
                                >
                                  <p className="text-[11px] font-bold text-[#18181b]">
                                    {NOMBRE_COMPONENTE[comp.tipo]} ({PONDERACION_COMPONENTE[comp.tipo]})
                                  </p>
                                  {comp.evaluaciones.length === 0 ? (
                                    <p className="text-[11px] text-[#71717a] italic">
                                      Sin actividades clasificadas.
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
      </div>

      {/* Tabla de Actividades Académicas Registradas / Importadas */}
      <div className="bg-white rounded-md border border-[#e4e4e7] overflow-hidden">
        <div className="p-4 border-b border-[#e4e4e7] flex items-center justify-between">
          <h2 className="font-bold text-sm text-[#18181b]">
            Actividades de Evaluación — {materiaActual.nombre}
          </h2>
          <span className="text-xs text-[#71717a]">
            {evaluacionesVisibles.length} actividad(es)
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
              {evaluacionesVisibles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-5 px-4 text-center text-[#71717a]">
                    No existen actividades registradas para este parcial.
                  </td>
                </tr>
              ) : (
                evaluacionesVisibles.map((ev) => {
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
