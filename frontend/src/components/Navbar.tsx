import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import logo from '../assets/logo.png'

export function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const getLinkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3.5 py-1.5 rounded text-xs font-medium transition ${
      isActive
        ? 'bg-white text-[#8B151A] font-semibold'
        : 'text-white/90 hover:text-white hover:bg-black/20'
    }`

  return (
    <header className="bg-[#8B151A] text-white border-b border-black/20 sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-white p-1 rounded flex items-center justify-center">
            <img src={logo} alt="EduMonitor" className="h-6 w-auto object-contain" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-tight text-white">EduMonitor</span>
            <span className="text-white/40 hidden sm:inline">|</span>
            <span className="hidden sm:inline text-xs text-white/85 font-medium">
              FISEI • UTA
            </span>
          </div>
        </div>

        <nav className="flex items-center gap-1.5">
          <NavLink to="/dashboard" className={getLinkClass}>
            Inicio
          </NavLink>
          <NavLink to="/catalogo" className={getLinkClass}>
            Catálogo Curricular
          </NavLink>
          <NavLink to="/evaluaciones" className={getLinkClass}>
            Evaluaciones
          </NavLink>
        </nav>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-semibold text-white leading-tight">
              {user?.nombreCompleto || 'Ing. Carlos Mendoza'}
            </p>
            <p className="text-[11px] text-white/75">
              {user?.rol || 'Docente'}
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="px-3 py-1 bg-black/25 hover:bg-black/45 text-white border border-white/25 rounded text-xs font-medium transition cursor-pointer"
          >
            Salir
          </button>
        </div>
      </div>
    </header>
  )
}

export default Navbar
