import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { EVALUACIONES_BASE_SOF401, EVALUACIONES_BASE_SOF402, type Evaluacion } from './EvaluacionesPage'

export function DashboardPage() {
  const { user } = useAuth()
  const esEstudiante = user?.rol === 'Estudiante'

  // Evaluaciones independientes de cada materia
  const [evaluacionesSof401, setEvaluacionesSof401] = useState<Evaluacion[]>(() => {
    try {
      const stored = localStorage.getItem('evaluaciones_materia_1') || localStorage.getItem('evaluaciones_sof401')
      return stored ? JSON.parse(stored) : EVALUACIONES_BASE_SOF401
    } catch {
      return EVALUACIONES_BASE_SOF401
    }
  })

  const [evaluacionesSof402, setEvaluacionesSof402] = useState<Evaluacion[]>(() => {
    try {
      const stored = localStorage.getItem('evaluaciones_materia_2') || localStorage.getItem('evaluaciones_sof402')
      return stored ? JSON.parse(stored) : EVALUACIONES_BASE_SOF402
    } catch {
      return EVALUACIONES_BASE_SOF402
    }
  })

  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const stored1 = localStorage.getItem('evaluaciones_materia_1') || localStorage.getItem('evaluaciones_sof401')
        if (stored1) setEvaluacionesSof401(JSON.parse(stored1))
        const stored2 = localStorage.getItem('evaluaciones_materia_2') || localStorage.getItem('evaluaciones_sof402')
        if (stored2) setEvaluacionesSof402(JSON.parse(stored2))
      } catch {
        // mantener estado actual si hay error
      }
    }
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  // Cálculo ponderado para Metodologías Ágiles (SOF-401)
  const metricasSof401 = useMemo(() => {
    const tareas = evaluacionesSof401.filter(e => e.componente === 'Tareas')
    const ape = evaluacionesSof401.filter(e => e.componente === 'APE')
    const examen = evaluacionesSof401.filter(e => e.componente === 'Examen')

    const promTareas = tareas.length > 0 ? tareas.reduce((acc, curr) => acc + curr.notaPromedio, 0) / tareas.length : 0
    const promApe = ape.length > 0 ? ape.reduce((acc, curr) => acc + curr.notaPromedio, 0) / ape.length : 0
    const promExamen = examen.length > 0 ? examen.reduce((acc, curr) => acc + curr.notaPromedio, 0) / examen.length : 0

    const notaFinal = (promTareas * 0.30) + (promApe * 0.30) + (promExamen * 0.40)
    return {
      promedio: Number(notaFinal.toFixed(2)),
      enRiesgo: notaFinal < 7.00
    }
  }, [evaluacionesSof401])

  // Cálculo ponderado para Estructuras de Datos (SOF-402)
  const metricasSof402 = useMemo(() => {
    const tareas = evaluacionesSof402.filter(e => e.componente === 'Tareas')
    const ape = evaluacionesSof402.filter(e => e.componente === 'APE')
    const examen = evaluacionesSof402.filter(e => e.componente === 'Examen')

    const promTareas = tareas.length > 0 ? tareas.reduce((acc, curr) => acc + curr.notaPromedio, 0) / tareas.length : 0
    const promApe = ape.length > 0 ? ape.reduce((acc, curr) => acc + curr.notaPromedio, 0) / ape.length : 0
    const promExamen = examen.length > 0 ? examen.reduce((acc, curr) => acc + curr.notaPromedio, 0) / examen.length : 0

    const notaFinal = (promTareas * 0.30) + (promApe * 0.30) + (promExamen * 0.40)
    return {
      promedio: Number(notaFinal.toFixed(2)),
      enRiesgo: notaFinal < 7.00
    }
  }, [evaluacionesSof402])

  // Promedio General y Alumnos en Riesgo sumando ambas materias
  const promedioGeneral = ((metricasSof401.promedio + metricasSof402.promedio) / 2).toFixed(2)
  const alumnosRiesgoSof401 = metricasSof401.enRiesgo ? 8 : 4
  const alumnosRiesgoSof402 = metricasSof402.enRiesgo ? 6 : 2
  const alumnosRiesgoTotal = alumnosRiesgoSof401 + alumnosRiesgoSof402

  return (
    <div className="space-y-6">
      {/* Encabezado Docente */}
      <div className="bg-white border border-[#e4e4e7] border-l-4 border-l-[#8B151A] rounded-md p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-[#18181b]">
            Bienvenido, {user?.nombreCompleto || 'Ing. Carlos Mendoza'}
          </h1>
          <p className="text-xs text-[#52525b] mt-0.5">
            Período Académico: Octubre 2026 – Febrero 2027 | Carrera: Ingeniería en Software
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/catalogo"
            className="px-3.5 py-2 border border-[#8B151A] text-[#8B151A] hover:bg-[#8B151A]/5 rounded text-xs font-semibold transition"
          >
            Catálogo Curricular
          </Link>
          <Link
            to="/evaluaciones"
            className="px-4 py-2 bg-[#8B151A] hover:bg-[#6E1014] text-white rounded text-xs font-semibold transition"
          >
            Evaluaciones
          </Link>
        </div>
      </div>

      {/* Tarjetas de Resumen General del Sprint 1 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-md p-5 border border-[#e4e4e7]">
          <p className="text-xs font-semibold text-[#52525b]">
            {esEstudiante ? 'Mis Asignaturas' : 'Total Estudiantes'}
          </p>
          <p className="text-2xl font-bold text-[#18181b] mt-1">
            {esEstudiante ? '2' : '64'}
          </p>
          <p className="text-[11px] text-[#71717a] mt-1">2 asignaturas registradas</p>
        </div>

        <div className="bg-white rounded-md p-5 border border-[#e4e4e7]">
          <p className="text-xs font-semibold text-[#52525b]">
            {esEstudiante ? 'Promedio Parcial' : 'Promedio General'}
          </p>
          <p className="text-2xl font-bold text-[#18181b] mt-1">
            {esEstudiante ? '8.40' : promedioGeneral}{' '}
            <span className="text-xs font-normal text-[#71717a]">/ 10.00 pts</span>
          </p>
          <p className="text-[11px] text-[#71717a] mt-1">Cálculo oficial sobre 10 puntos</p>
        </div>

        <div className={`bg-white rounded-md p-5 border ${alumnosRiesgoTotal > 0 ? 'border-red-400 bg-red-50/20' : 'border-[#8B151A]'}`}>
          <p className="text-xs font-semibold text-[#8B151A]">
            En Riesgo Académico (&lt; 7.00)
          </p>
          <p className="text-2xl font-bold text-[#8B151A] mt-1">
            {esEstudiante ? '0' : alumnosRiesgoTotal}
          </p>
          <p className="text-[11px] text-[#71717a] mt-1">Estudiantes con promedio menor a 7.00</p>
        </div>
      </div>

      {/* Tabla de Asignaturas del Sprint 1 */}
      <div className="bg-white rounded-md border border-[#e4e4e7] overflow-hidden">
        <div className="p-4 border-b border-[#e4e4e7] flex items-center justify-between">
          <h2 className="font-bold text-sm text-[#18181b]">
            Asignaturas
          </h2>
          <span className="text-xs text-[#71717a]">Octubre 2026 – Febrero 2027</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f4f4f5] text-[#52525b] border-b border-[#e4e4e7]">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Asignatura</th>
                <th className="py-2.5 px-4 font-semibold">Código</th>
                <th className="py-2.5 px-4 font-semibold">Nivel / Paralelo</th>
                <th className="py-2.5 px-4 font-semibold text-center">Estudiantes</th>
                <th className="py-2.5 px-4 font-semibold text-right">Promedio</th>
                <th className="py-2.5 px-4 font-semibold text-center">En Riesgo</th>
                <th className="py-2.5 px-4 font-semibold text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e4e4e7]">
              <tr className="hover:bg-[#fafafa] transition">
                <td className="py-3 px-4 font-medium text-[#18181b]">
                  Metodologías Ágiles
                </td>
                <td className="py-3 px-4 text-[#52525b]">SOF-401</td>
                <td className="py-3 px-4 text-[#52525b]">Cuarto - B</td>
                <td className="py-3 px-4 text-center font-medium">32</td>
                <td className="py-3 px-4 text-right font-bold text-[#18181b]">
                  {metricasSof401.promedio.toFixed(2)}
                </td>
                <td className="py-3 px-4 text-center">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                      metricasSof401.enRiesgo ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {alumnosRiesgoSof401} estudiantes
                  </span>
                </td>
                <td className="py-3 px-4 text-center">
                  <Link
                    to="/evaluaciones?materia=1"
                    className="text-xs font-semibold text-[#8B151A] hover:underline"
                  >
                    Ver Evaluaciones →
                  </Link>
                </td>
              </tr>

              <tr className="hover:bg-[#fafafa] transition">
                <td className="py-3 px-4 font-medium text-[#18181b]">
                  Estructuras de Datos y Algoritmos
                </td>
                <td className="py-3 px-4 text-[#52525b]">SOF-402</td>
                <td className="py-3 px-4 text-[#52525b]">Cuarto - B</td>
                <td className="py-3 px-4 text-center font-medium">32</td>
                <td className="py-3 px-4 text-right font-bold text-[#18181b]">
                  {metricasSof402.promedio.toFixed(2)}
                </td>
                <td className="py-3 px-4 text-center">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                      metricasSof402.enRiesgo ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {alumnosRiesgoSof402} estudiantes
                  </span>
                </td>
                <td className="py-3 px-4 text-center">
                  <Link
                    to="/evaluaciones?materia=2"
                    className="text-xs font-semibold text-[#8B151A] hover:underline"
                  >
                    Ver Evaluaciones →
                  </Link>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage
