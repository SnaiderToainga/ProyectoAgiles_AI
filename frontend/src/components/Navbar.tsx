import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { GraduationCap, LayoutDashboard, BookOpen, LogOut, Shield } from 'lucide-react'

export function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const linkActivoClase = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
      isActive
        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
        : 'text-slate-300 hover:text-white hover:bg-slate-800'
    }`

  return (
    <nav className="bg-slate-900 text-white shadow-md border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        
        {/* Logo e Identidad Institucional */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-xl shadow-md shadow-blue-500/20">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-bold text-base tracking-tight text-white">EduMonitor AI</span>
            <span className="hidden sm:inline-block ml-2 text-[10px] text-blue-300 bg-slate-800 py-0.5 px-2 rounded-full border border-slate-700">
              FISEI • UTA
            </span>
          </div>
        </div>

        {/* Enlaces de Navegación del Sistema */}
        <div className="flex items-center gap-2">
          <NavLink to="/dashboard" className={linkActivoClase}>
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard</span>
          </NavLink>

          <NavLink to="/catalogo" className={linkActivoClase}>
            <BookOpen className="w-4 h-4" />
            <span>Catálogo Curricular</span>
          </NavLink>
        </div>

        {/* Perfil del Usuario y Cierre de Sesión */}
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-semibold text-white leading-tight">
              {user?.nombreCompleto || 'Docente'}
            </p>
            <div className="flex items-center justify-end gap-1 text-[11px] text-emerald-400 font-medium">
              <Shield className="w-3 h-3" />
              <span>{user?.rol || 'Docente'}</span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 py-1.5 px-3 bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/30 rounded-lg text-xs font-medium cursor-pointer transition"
            title="Cerrar sesión actual"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>

      </div>
    </nav>
  )
}

export default Navbar
