import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import clienteAxios from '../api/clienteAxios'
import type { MateriaDto, ResumenAcademicoEstudianteDto } from '../types/academico'

interface ResumenMateria {
  materia: MateriaDto
  totalEstudiantes: number
  promedio: number
  enRiesgo: number
}

export function DashboardPage() {
  const { user } = useAuth()
  const [resumenes, setResumenes] = useState<ResumenMateria[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true

    async function cargarDashboard() {
      try {
        const { data: materias } = await clienteAxios.get<MateriaDto[]>('/academico/materias')

        const resultados = await Promise.all(
          materias.map(async (materia) => {
            const parcial = materia.parciales.find((p) => p.numero === 1) || materia.parciales[0]
            if (!parcial) {
              return { materia, totalEstudiantes: 0, promedio: 0, enRiesgo: 0 }
            }

            try {
              const { data: estudiantes } = await clienteAxios.get<ResumenAcademicoEstudianteDto[]>(
                `/academico/materias/${materia.id}/parciales/${parcial.id}/rendimiento`
              )
              const totalEstudiantes = estudiantes.length
              const promedio =
                totalEstudiantes > 0
                  ? estudiantes.reduce((acc, e) => acc + e.notaFinalParcial, 0) / totalEstudiantes
                  : 0
              const enRiesgo = estudiantes.filter((e) => e.enRiesgo).length
              return { materia, totalEstudiantes, promedio, enRiesgo }
            } catch {
              return { materia, totalEstudiantes: 0, promedio: 0, enRiesgo: 0 }
            }
          })
        )

        if (vigente) setResumenes(resultados)
      } catch {
        if (vigente) {
          setErrorCarga('No se pudo cargar el resumen académico desde el servidor.')
        }
      } finally {
        if (vigente) setCargando(false)
      }
    }

    cargarDashboard()
    return () => {
      vigente = false
    }
  }, [])

  const kpis = useMemo(() => {
    const totalEstudiantes = resumenes.reduce((acc, r) => acc + r.totalEstudiantes, 0)
    const materiasConNotas = resumenes.filter((r) => r.totalEstudiantes > 0)
    const promedioGeneral =
      materiasConNotas.length > 0
        ? materiasConNotas.reduce((acc, r) => acc + r.promedio, 0) / materiasConNotas.length
        : 0
    const totalEnRiesgo = resumenes.reduce((acc, r) => acc + r.enRiesgo, 0)

    return {
      totalEstudiantes,
      promedioGeneral: promedioGeneral.toFixed(2),
      totalEnRiesgo,
    }
  }, [resumenes])

  return (
    <div className="space-y-6">
      {/* Encabezado Docente */}
      <div className="bg-white border border-[#e4e4e7] border-l-4 border-l-[#8B151A] rounded-md p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-[#18181b]">
            Bienvenido, {user?.nombreCompleto || 'Docente'}
          </h1>
          <p className="text-xs text-[#52525b] mt-0.5">
            Período Académico: Octubre 2026 – Febrero 2027 | Carrera: Ingeniería en Software
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
          <Link
            to="/tutoria"
            className="px-3.5 py-2 border border-[#d4d4d8] hover:bg-[#f4f4f5] text-[#18181b] rounded text-xs font-semibold transition"
          >
            Tutoría IA
          </Link>
        </div>
      </div>

      {errorCarga && (
        <div role="alert" className="p-3.5 bg-red-50 border-l-4 border-red-600 rounded text-xs text-red-800">
          {errorCarga}
        </div>
      )}

      {/* Tarjetas de Resumen General */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-md p-5 border border-[#e4e4e7]">
          <p className="text-xs font-semibold text-[#52525b]">Total Estudiantes</p>
          <p className="text-2xl font-bold text-[#18181b] mt-1">
            {cargando ? '...' : kpis.totalEstudiantes}
          </p>
          <p className="text-[11px] text-[#71717a] mt-1">
            {resumenes.length} asignatura(s) registrada(s)
          </p>
        </div>

        <div className="bg-white rounded-md p-5 border border-[#e4e4e7]">
          <p className="text-xs font-semibold text-[#52525b]">Promedio General</p>
          <p className="text-2xl font-bold text-[#18181b] mt-1">
            {cargando ? '...' : kpis.promedioGeneral}{' '}
            <span className="text-xs font-normal text-[#71717a]">/ 10.00 pts</span>
          </p>
          <p className="text-[11px] text-[#71717a] mt-1">Cálculo oficial 30 / 30 / 40</p>
        </div>

        <div
          className={`bg-white rounded-md p-5 border ${
            kpis.totalEnRiesgo > 0 ? 'border-red-400 bg-red-50/20' : 'border-[#8B151A]'
          }`}
        >
          <p className="text-xs font-semibold text-[#8B151A]">En Riesgo Académico (&lt; 7.00)</p>
          <p className="text-2xl font-bold text-[#8B151A] mt-1">
            {cargando ? '...' : kpis.totalEnRiesgo}
          </p>
          <p className="text-[11px] text-[#71717a] mt-1">
            Estudiantes que requieren refuerzo pedagógico
          </p>
          {kpis.totalEnRiesgo > 0 && (
            <Link
              to="/tutoria"
              className="inline-block mt-2.5 text-xs font-semibold text-[#8B151A] hover:underline"
            >
              Ver estudiantes y generar planes con IA →
            </Link>
          )}
        </div>
      </div>

      {/* Tabla de Asignaturas Conectada a AcademicoDB */}
      <div className="bg-white rounded-md border border-[#e4e4e7] overflow-hidden">
        <div className="p-4 border-b border-[#e4e4e7] flex items-center justify-between">
          <h2 className="font-bold text-sm text-[#18181b]">Asignaturas</h2>
          <span className="text-xs text-[#71717a]">Datos reales en vivo</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f4f4f5] text-[#52525b] border-b border-[#e4e4e7]">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Asignatura</th>
                <th className="py-2.5 px-4 font-semibold">Código</th>
                <th className="py-2.5 px-4 font-semibold">Período</th>
                <th className="py-2.5 px-4 font-semibold text-center">Estudiantes</th>
                <th className="py-2.5 px-4 font-semibold text-right">Promedio</th>
                <th className="py-2.5 px-4 font-semibold text-center">En Riesgo</th>
                <th className="py-2.5 px-4 font-semibold text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e4e4e7]">
              {cargando ? (
                <tr>
                  <td colSpan={7} className="py-6 px-4 text-center text-[#71717a]">
                    Cargando asignaturas...
                  </td>
                </tr>
              ) : resumenes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 px-4 text-center text-[#71717a]">
                    No existen asignaturas asignadas a este docente.
                  </td>
                </tr>
              ) : (
                resumenes.map(({ materia, totalEstudiantes, promedio, enRiesgo }) => (
                  <tr key={materia.id} className="hover:bg-[#fafafa] transition">
                    <td className="py-3 px-4 font-medium text-[#18181b]">{materia.nombre}</td>
                    <td className="py-3 px-4 text-[#52525b]">{materia.codigo}</td>
                    <td className="py-3 px-4 text-[#52525b]">{materia.semestre}</td>
                    <td className="py-3 px-4 text-center font-medium">{totalEstudiantes}</td>
                    <td className="py-3 px-4 text-right font-bold text-[#18181b]">
                      {promedio.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                          enRiesgo > 0
                            ? 'bg-red-100 text-red-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {enRiesgo} estudiante(s)
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <Link
                          to={`/evaluaciones?materia=${materia.id}`}
                          className="text-xs font-semibold text-[#8B151A] hover:underline"
                        >
                          Evaluaciones →
                        </Link>
                        {enRiesgo > 0 && (
                          <Link
                            to={`/tutoria?materia=${materia.id}`}
                            className="text-xs font-semibold text-[#52525b] hover:text-[#18181b] hover:underline"
                          >
                            Tutoría IA →
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage
