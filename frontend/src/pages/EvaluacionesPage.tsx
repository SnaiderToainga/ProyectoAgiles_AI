import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MATERIAS_BASE, type Materia } from './CatalogoPage'

export type ComponenteEvaluacion = 'Tareas' | 'APE' | 'Examen'

export interface Evaluacion {
  id: number
  actividad: string
  componente: ComponenteEvaluacion
  notaPromedio: number
  temasIds: number[]
}

export const EVALUACIONES_BASE_SOF401: Evaluacion[] = [
  {
    id: 1,
    actividad: 'Tarea 1: Estimación con Planning Poker',
    componente: 'Tareas',
    notaPromedio: 8.50,
    temasIds: [102, 103]
  },
  {
    id: 2,
    actividad: 'Tarea 2: Redacción de Historias de Usuario',
    componente: 'Tareas',
    notaPromedio: 8.50,
    temasIds: [101, 102]
  },
  {
    id: 3,
    actividad: 'APE 1: Planificación de Sprint en Jira',
    componente: 'APE',
    notaPromedio: 7.80,
    temasIds: [103, 104]
  },
  {
    id: 4,
    actividad: 'APE 2: Gestión de Daily y Tablero Burndown',
    componente: 'APE',
    notaPromedio: 7.80,
    temasIds: [104]
  },
  {
    id: 5,
    actividad: 'Examen Teórico-Práctico Parcial 1',
    componente: 'Examen',
    notaPromedio: 8.00,
    temasIds: [101, 102, 103, 104]
  }
]

export const EVALUACIONES_BASE_SOF402: Evaluacion[] = [
  {
    id: 11,
    actividad: 'Taller 1: Análisis Asintótico y Big-O',
    componente: 'Tareas',
    notaPromedio: 8.20,
    temasIds: [201]
  },
  {
    id: 12,
    actividad: 'Práctica 1: Listas Enlazadas Simples y Dobles',
    componente: 'APE',
    notaPromedio: 7.60,
    temasIds: [202]
  },
  {
    id: 13,
    actividad: 'Examen Teórico-Práctico Parcial 1',
    componente: 'Examen',
    notaPromedio: 7.90,
    temasIds: [201, 202, 203]
  }
]

export function EvaluacionesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const materiaQuery = searchParams.get('materia')

  // Obtener catálogo para vincular materias y temas en tiempo real
  const [materias] = useState<Materia[]>(() => {
    try {
      const stored = localStorage.getItem('catalogo_materias')
      return stored ? JSON.parse(stored) : MATERIAS_BASE
    } catch {
      return MATERIAS_BASE
    }
  })

  const [materiaActivaId, setMateriaActivaId] = useState<number>(
    materiaQuery ? Number(materiaQuery) : 1
  )

  useEffect(() => {
    if (materiaQuery) {
      setMateriaActivaId(Number(materiaQuery))
    }
  }, [materiaQuery])

  // Obtener la materia actual del catálogo
  const materiaActual = materias.find((m) => m.id === materiaActivaId) || materias[0]

  // Extraer todos los temas del Parcial 1 de la materia actual (incluyendo temas nuevos creados en Catálogo)
  const temasDisponibles = useMemo(() => {
    const parcial1 = materiaActual.parciales.find((p) => p.numero === 1)
    if (!parcial1) return []
    return parcial1.unidades.flatMap((u) =>
      u.temas.map((t) => ({
        id: t.id,
        codigo: `U${u.numero}`,
        nombre: t.nombre
      }))
    )
  }, [materiaActual])

  // Cargar evaluaciones específicas de esta materia desde localStorage
  const storageKey = `evaluaciones_materia_${materiaActual.id}`
  const evaluacionesBase = materiaActual.id === 2 ? EVALUACIONES_BASE_SOF402 : EVALUACIONES_BASE_SOF401

  const [evaluaciones, setEvaluaciones] = useState<Evaluacion[]>(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      return stored ? JSON.parse(stored) : evaluacionesBase
    } catch {
      return evaluacionesBase
    }
  })

  // Al cambiar de materia, cargar las evaluaciones correspondientes a esa materia
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      setEvaluaciones(stored ? JSON.parse(stored) : evaluacionesBase)
    } catch {
      setEvaluaciones(evaluacionesBase)
    }
  }, [storageKey])

  // Guardar permanentemente en localStorage
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(evaluaciones))
    if (materiaActual.id === 1) {
      localStorage.setItem('evaluaciones_sof401', JSON.stringify(evaluaciones))
    } else if (materiaActual.id === 2) {
      localStorage.setItem('evaluaciones_sof402', JSON.stringify(evaluaciones))
    }
  }, [evaluaciones, storageKey, materiaActual.id])

  const [mostrarModal, setMostrarModal] = useState(false)
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null)
  const [sincronizando, setSincronizando] = useState(false)

  // Campos del modal
  const [actividad, setActividad] = useState('')
  const [componente, setComponente] = useState<ComponenteEvaluacion>('Tareas')
  const [notaPromedio, setNotaPromedio] = useState<string>('8.00')
  const [temasSeleccionados, setTemasSeleccionados] = useState<number[]>([])

  // Cálculo de ponderación oficial FISEI (30% Tareas, 30% APE, 40% Examen)
  const metricas = useMemo(() => {
    const tareas = evaluaciones.filter((e) => e.componente === 'Tareas')
    const ape = evaluaciones.filter((e) => e.componente === 'APE')
    const examen = evaluaciones.filter((e) => e.componente === 'Examen')

    const promTareas = tareas.length > 0
      ? tareas.reduce((acc, curr) => acc + curr.notaPromedio, 0) / tareas.length
      : 0
    const promApe = ape.length > 0
      ? ape.reduce((acc, curr) => acc + curr.notaPromedio, 0) / ape.length
      : 0
    const promExamen = examen.length > 0
      ? examen.reduce((acc, curr) => acc + curr.notaPromedio, 0) / examen.length
      : 0

    const aporteTareas = promTareas * 0.30
    const aporteApe = promApe * 0.30
    const aporteExamen = promExamen * 0.40

    const notaFinal = aporteTareas + aporteApe + aporteExamen
    const enRiesgo = notaFinal < 7.00

    return {
      promTareas: promTareas.toFixed(2),
      aporteTareas: aporteTareas.toFixed(2),
      promApe: promApe.toFixed(2),
      aporteApe: aporteApe.toFixed(2),
      promExamen: promExamen.toFixed(2),
      aporteExamen: aporteExamen.toFixed(2),
      notaFinal: notaFinal.toFixed(2),
      enRiesgo
    }
  }, [evaluaciones])

  const toggleTema = (id: number) => {
    setTemasSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    )
  }

  const handleGuardar = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorValidacion(null)

    if (!actividad.trim()) {
      setErrorValidacion('Por favor ingrese el nombre de la actividad académica.')
      return
    }

    const valorNota = parseFloat(notaPromedio)
    if (isNaN(valorNota) || valorNota < 0 || valorNota > 10) {
      setErrorValidacion('La nota promedio debe ser un valor entre 0.00 y 10.00.')
      return
    }

    if (temasSeleccionados.length === 0) {
      setErrorValidacion('Debe seleccionar al menos un tema asociado a la actividad.')
      return
    }

    const nuevaEvaluacion: Evaluacion = {
      id: Date.now(),
      actividad: actividad.trim(),
      componente,
      notaPromedio: parseFloat(valorNota.toFixed(2)),
      temasIds: [...temasSeleccionados]
    }

    setEvaluaciones((prev) => [...prev, nuevaEvaluacion])

    setActividad('')
    setNotaPromedio('8.00')
    setTemasSeleccionados([])
    setErrorValidacion(null)
    setMostrarModal(false)
  }

  const eliminarEvaluacion = (id: number) => {
    setEvaluaciones((prev) => prev.filter((e) => e.id !== id))
  }

  const simularSincronizacionMoodle = () => {
    setSincronizando(true)
    setTimeout(() => {
      setEvaluaciones(evaluacionesBase)
      setSincronizando(false)
    }, 600)
  }

  return (
    <div className="space-y-6">
      {/* Selector de Asignatura para separar evaluaciones */}
      <div className="flex flex-wrap gap-2 border-b border-[#e4e4e7] pb-3">
        {materias.map((m) => {
          const activa = m.id === materiaActual.id
          return (
            <button
              key={m.id}
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

      {/* Encabezado Principal */}
      <div className="bg-white border border-[#e4e4e7] border-l-4 border-l-[#8B151A] rounded-md p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-[#18181b]">
            Evaluaciones y Ponderación Institucional
          </h1>
          <p className="text-xs text-[#52525b] mt-0.5">
            {materiaActual.nombre} ({materiaActual.codigo}) • Parcial 1
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={simularSincronizacionMoodle}
            disabled={sincronizando}
            className="px-3.5 py-2 border border-[#d4d4d8] hover:bg-[#f4f4f5] text-[#27272a] rounded text-xs font-semibold transition cursor-pointer"
          >
            {sincronizando ? 'Sincronizando Moodle...' : 'Sincronizar con Moodle'}
          </button>

          <button
            onClick={() => {
              setErrorValidacion(null)
              setTemasSeleccionados([])
              setMostrarModal(true)
            }}
            className="px-4 py-2 bg-[#8B151A] hover:bg-[#6E1014] text-white rounded text-xs font-semibold transition cursor-pointer"
          >
            + Nueva Evaluación
          </button>
        </div>
      </div>

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
            {metricas.promTareas}{' '}
            <span className="text-xs font-normal text-[#71717a]">/ 10</span>
          </p>
          <p className="text-[11px] text-[#52525b] mt-1">
            Aporte al Parcial: <strong className="text-[#18181b]">{metricas.aporteTareas} pts</strong>
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
            {metricas.promApe}{' '}
            <span className="text-xs font-normal text-[#71717a]">/ 10</span>
          </p>
          <p className="text-[11px] text-[#52525b] mt-1">
            Aporte al Parcial: <strong className="text-[#18181b]">{metricas.aporteApe} pts</strong>
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
            {metricas.promExamen}{' '}
            <span className="text-xs font-normal text-[#71717a]">/ 10</span>
          </p>
          <p className="text-[11px] text-[#52525b] mt-1">
            Aporte al Parcial: <strong className="text-[#18181b]">{metricas.aporteExamen} pts</strong>
          </p>
        </div>

        <div className={`bg-white rounded-md p-4 border ${metricas.enRiesgo ? 'border-red-400 bg-red-50/20' : 'border-[#8B151A]'}`}>
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-[#8B151A]">Nota Final Parcial 1</span>
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                metricas.enRiesgo ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {metricas.enRiesgo ? 'En Riesgo (< 7.00)' : 'Aprobado (>= 7.00)'}
            </span>
          </div>
          <p className="text-2xl font-bold text-[#8B151A] mt-2">
            {metricas.notaFinal}{' '}
            <span className="text-xs font-normal text-[#71717a]">/ 10.00 pts</span>
          </p>
          <p className="text-[11px] text-[#52525b] mt-1">
            Estado: <strong className="text-[#18181b]">{metricas.enRiesgo ? 'Requiere Refuerzo' : 'Satisfactorio'}</strong>
          </p>
        </div>
      </div>

      {/* Tabla Oficial de Evaluaciones */}
      <div className="bg-white rounded-md border border-[#e4e4e7] overflow-hidden">
        <div className="p-4 border-b border-[#e4e4e7] flex items-center justify-between">
          <h2 className="font-bold text-sm text-[#18181b]">
            Registro de Actividades — {materiaActual.nombre}
          </h2>
          <span className="text-xs text-[#71717a]">
            {evaluaciones.length} actividad(es)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f4f4f5] text-[#52525b] border-b border-[#e4e4e7]">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Actividad Académica</th>
                <th className="py-2.5 px-4 font-semibold">Componente</th>
                <th className="py-2.5 px-4 font-semibold">Ponderación</th>
                <th className="py-2.5 px-4 font-semibold text-right">Nota Promedio</th>
                <th className="py-2.5 px-4 font-semibold">Temas Vinculados</th>
                <th className="py-2.5 px-4 font-semibold text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e4e4e7]">
              {evaluaciones.map((ev) => {
                const temas = temasDisponibles.filter((t) => ev.temasIds.includes(t.id))

                return (
                  <tr key={ev.id} className="hover:bg-[#fafafa] transition">
                    <td className="py-3 px-4 font-medium text-[#18181b]">
                      {ev.actividad}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                          ev.componente === 'Tareas'
                            ? 'bg-blue-100 text-blue-800'
                            : ev.componente === 'APE'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {ev.componente}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-[#52525b]">
                      {ev.componente === 'Examen' ? '40%' : '30%'}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-[#18181b]">
                      {ev.notaPromedio.toFixed(2)} / 10
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {temas.length === 0 ? (
                          <span className="text-[11px] text-[#a1a1aa] italic">
                            Tema del plan
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
                        onClick={() => eliminarEvaluacion(ev.id)}
                        className="text-[#a1a1aa] hover:text-red-600 transition cursor-pointer text-xs"
                        title="Eliminar actividad"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Registro de Evaluación */}
      {mostrarModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-5 border border-[#e4e4e7]">
            <div className="flex justify-between items-center pb-3 border-b border-[#e4e4e7]">
              <div>
                <h3 className="font-bold text-sm text-[#18181b]">
                  Registrar Nueva Evaluación
                </h3>
                <p className="text-[11px] text-[#52525b]">
                  {materiaActual.nombre} • Parcial 1
                </p>
              </div>
              <button
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
                  onChange={(e) => setActividad(e.target.value)}
                  placeholder="Ej: Taller 2: Diagramas de Casos de Uso"
                  className="w-full text-xs p-2 border border-[#d4d4d8] rounded focus:outline-none focus:border-[#8B151A]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#27272a] mb-1">
                    Componente Oficial
                  </label>
                  <select
                    value={componente}
                    onChange={(e) => setComponente(e.target.value as ComponenteEvaluacion)}
                    className="w-full text-xs p-2 border border-[#d4d4d8] rounded focus:outline-none focus:border-[#8B151A]"
                  >
                    <option value="Tareas">Tareas (30%)</option>
                    <option value="APE">APE (30%)</option>
                    <option value="Examen">Examen (40%)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#27272a] mb-1">
                    Nota Promedio (/ 10)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="10"
                    value={notaPromedio}
                    onChange={(e) => setNotaPromedio(e.target.value)}
                    className="w-full text-xs p-2 border border-[#d4d4d8] rounded focus:outline-none focus:border-[#8B151A]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#27272a] mb-1">
                  Temas del Parcial Asociados ({materiaActual.nombre})
                </label>
                <div className="border border-[#d4d4d8] rounded p-2 max-h-44 overflow-y-auto space-y-1.5 bg-[#fafafa]">
                  {temasDisponibles.length === 0 ? (
                    <p className="text-xs text-[#71717a] p-2">
                      No hay temas registrados en el catálogo para esta materia.
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
                  onClick={() => setMostrarModal(false)}
                  className="px-3 py-1.5 text-xs text-[#52525b] hover:bg-[#f4f4f5] rounded transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-[#8B151A] hover:bg-[#6E1014] text-white font-semibold rounded transition cursor-pointer"
                >
                  Guardar Evaluación
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
