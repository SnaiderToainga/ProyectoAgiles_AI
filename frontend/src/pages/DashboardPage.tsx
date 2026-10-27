import { useAuth } from '../context/AuthContext'
import { Users, TrendingUp, AlertTriangle, BookOpen, ArrowRight, CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router-dom'

export function DashboardPage() {
  const { user } = useAuth()
  const esEstudiante = user?.rol === 'Estudiante'

  return (
    <div className="space-y-6">
      
      {/* Banner de Bienvenida */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 rounded-2xl p-6 text-white shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-medium border border-blue-400/30 mb-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
              <span>Sesión activa protegida con JWT ({user?.rol || 'Usuario'})</span>
            </div>
            <h1 className="text-2xl font-bold">¡Bienvenido, {user?.nombreCompleto || 'Usuario'}!</h1>
            <p className="text-xs text-slate-300 mt-1">
              {esEstudiante
                ? 'Portal del Estudiante • Seguimiento de progreso académico y tutoría IA'
                : 'Panel Docente de Seguimiento y Refuerzo Académico • Semestre Octubre 2026 - Febrero 2027'}
            </p>
          </div>

          <Link
            to="/catalogo"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-500/20 transition self-start sm:self-auto cursor-pointer"
          >
            <span>Ver Catálogo Curricular</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Tarjetas de Métricas Resumidas Según el Rol */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Métrica 1 */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-100 text-blue-700 rounded-xl">
            {esEstudiante ? <BookOpen className="w-6 h-6" /> : <Users className="w-6 h-6" />}
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {esEstudiante ? 'Mis Asignaturas' : 'Total Alumnos'}
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">
              {esEstudiante ? '2' : '48'}
            </p>
            <p className="text-[11px] text-slate-400">
              {esEstudiante ? 'Matriculado en 4to Nivel B' : 'Distribuidos en 2 asignaturas piloto'}
            </p>
          </div>
        </div>

        {/* Métrica 2 */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {esEstudiante ? 'Mi Promedio Parcial' : 'Promedio General'}
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">
              {esEstudiante ? '8.40' : '7.85'} <span className="text-xs font-normal text-slate-400">/ 10</span>
            </p>
            <p className="text-[11px] text-emerald-600 font-medium">
              {esEstudiante ? 'Estado: Aprobado satisfactorio' : 'Ponderación oficial 30 / 30 / 40'}
            </p>
          </div>
        </div>

        {/* Métrica 3 */}
        <div className={`bg-white rounded-2xl p-5 border shadow-sm flex items-center gap-4 ${
          esEstudiante ? 'border-emerald-200 bg-emerald-50/20' : 'border-amber-200 bg-amber-50/30'
        }`}>
          <div className={`p-3 rounded-xl ${
            esEstudiante ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
          }`}>
            {esEstudiante ? <CheckCircle2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
          </div>
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wider ${
              esEstudiante ? 'text-emerald-800' : 'text-amber-800'
            }`}>
              {esEstudiante ? 'Condición Académica' : 'En Riesgo Académico'}
            </p>
            <p className={`text-2xl font-bold mt-0.5 ${
              esEstudiante ? 'text-emerald-900 text-xl' : 'text-amber-900'
            }`}>
              {esEstudiante ? 'Sin Riesgo' : '5 alumnos'}
            </p>
            <p className={`text-[11px] ${
              esEstudiante ? 'text-emerald-700' : 'text-amber-700'
            }`}>
              {esEstudiante ? 'Cumple con el promedio mínimo (≥ 7.00)' : 'Calificación menor a 7.00 puntos'}
            </p>
          </div>
        </div>

      </div>

      {/* Sección Informativa del Catálogo */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 mb-2 text-slate-800 font-bold text-base">
          <BookOpen className="w-5 h-5 text-blue-600" />
          <h2>Asignaturas Piloto Disponibles para Seguimiento</h2>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Estructura curricular desglosada por parciales, unidades y temas evaluativos conforme al modelo de la FISEI.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="border border-slate-200 rounded-xl p-4 hover:border-blue-400 transition">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Metodologías Ágiles</h3>
                <p className="text-xs text-slate-500 mt-0.5">Código: SOFT-401 • Cuarto Nivel B</p>
              </div>
              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[11px] font-semibold rounded-md border border-blue-200">
                2 Unidades
              </span>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl p-4 hover:border-blue-400 transition">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Estructuras de Datos</h3>
                <p className="text-xs text-slate-500 mt-0.5">Código: SOFT-302 • Tercer Nivel A</p>
              </div>
              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[11px] font-semibold rounded-md border border-blue-200">
                2 Unidades
              </span>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}

export default DashboardPage
