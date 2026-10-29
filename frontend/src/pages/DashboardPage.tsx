import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function DashboardPage() {
  const { user } = useAuth()
  const esEstudiante = user?.rol === 'Estudiante'

  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#e4e4e7] border-l-4 border-l-[#8B151A] rounded-md p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-[#18181b]">
            {user?.nombreCompleto || 'Ing. Carlos Mendoza'}
          </h1>
          <p className="text-xs text-[#52525b] mt-0.5">
            Período Académico Octubre 2026 – Febrero 2027
          </p>
        </div>

        <Link
          to="/catalogo"
          className="px-4 py-2 bg-[#8B151A] hover:bg-[#6E1014] text-white rounded text-xs font-semibold transition self-start sm:self-auto"
        >
          Catálogo Curricular
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-md p-5 border border-[#e4e4e7]">
          <p className="text-xs font-semibold text-[#52525b]">
            {esEstudiante ? 'Mis Asignaturas' : 'Total Alumnos'}
          </p>
          <p className="text-2xl font-bold text-[#18181b] mt-1">
            {esEstudiante ? '2' : '48'}
          </p>
        </div>

        <div className="bg-white rounded-md p-5 border border-[#e4e4e7]">
          <p className="text-xs font-semibold text-[#52525b]">
            {esEstudiante ? 'Promedio Parcial' : 'Promedio General'}
          </p>
          <p className="text-2xl font-bold text-[#18181b] mt-1">
            {esEstudiante ? '8.40' : '7.85'}{' '}
            <span className="text-xs font-normal text-[#52525b]">/ 10</span>
          </p>
        </div>

        <div className="bg-white rounded-md p-5 border border-[#8B151A]">
          <p className="text-xs font-semibold text-[#8B151A]">
            {esEstudiante ? 'Estado Académico' : 'En Riesgo Académico'}
          </p>
          <p className="text-2xl font-bold text-[#8B151A] mt-1">
            {esEstudiante ? 'Aprobado' : '5'}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-md p-5 border border-[#e4e4e7]">
        <h2 className="font-bold text-sm text-[#18181b] mb-4">
          Asignaturas
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            to="/catalogo?curso=1"
            className="border border-[#e4e4e7] hover:border-[#8B151A] bg-[#fafafa] rounded-md p-4 flex justify-between items-center transition"
          >
            <div>
              <h3 className="font-bold text-sm text-[#18181b]">Metodologías Ágiles</h3>
              <p className="text-xs text-[#52525b] mt-0.5">SOF-401 • Cuarto Nivel B</p>
            </div>
            <span className="text-xs font-semibold text-[#8B151A]">
              2 Unidades →
            </span>
          </Link>

          <Link
            to="/catalogo?curso=2"
            className="border border-[#e4e4e7] hover:border-[#8B151A] bg-[#fafafa] rounded-md p-4 flex justify-between items-center transition"
          >
            <div>
              <h3 className="font-bold text-sm text-[#18181b]">Estructuras de Datos</h3>
              <p className="text-xs text-[#52525b] mt-0.5">SOF-402 • Cuarto Nivel A</p>
            </div>
            <span className="text-xs font-semibold text-[#8B151A]">
              2 Unidades →
            </span>
          </Link>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage
