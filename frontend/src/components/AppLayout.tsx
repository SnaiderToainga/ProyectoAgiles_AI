import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Navbar } from './Navbar'
import logo from '../assets/logo.png'

export function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const esAdmin = Boolean(user?.rol?.toLowerCase().includes('admin'))

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Generación de iniciales para el avatar del perfil
  const getInitials = (name?: string) => {
    if (!name) return 'EM'
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    }
    return parts[0].slice(0, 2).toUpperCase()
  }

  const getNavLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition group ${
      isActive
        ? 'bg-[#8B151A] text-white font-semibold shadow-sm'
        : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
    }`

  const renderNavContent = () => (
    <div className="flex flex-col h-full justify-between">
      {/* Parte Superior: Marca Institucional y Enlaces */}
      <div className="space-y-6">
        {/* Identidad Institucional */}
        <div className="flex items-center justify-between px-2 pt-2">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-white border border-zinc-200 rounded-lg p-1 flex items-center justify-center shadow-xs">
              <img src={logo} alt="EduMonitor" className="h-7 w-auto object-contain" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-zinc-900 tracking-tight leading-tight">
                EduMonitor AI
              </h1>
              <p className="text-[10px] font-semibold text-zinc-400 tracking-wider uppercase">
                FISEI • UTA
              </p>
            </div>
          </div>
          <div className="hidden md:flex items-center justify-center w-6 h-6 rounded border border-zinc-200 text-zinc-400 text-xs">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </div>
        </div>

        {/* Módulos Académicos */}
        <div>
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-3 mb-2">
            Módulos del Sistema
          </p>
          <nav className="space-y-1">
            <NavLink
              to="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className={getNavLinkClass}
            >
              <div className="flex items-center gap-2.5">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                <span>Inicio (Dashboard)</span>
              </div>
            </NavLink>

            <NavLink
              to="/catalogo"
              onClick={() => setMobileMenuOpen(false)}
              className={getNavLinkClass}
            >
              <div className="flex items-center gap-2.5">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <span>Catálogo Curricular</span>
              </div>
            </NavLink>

            <NavLink
              to="/evaluaciones"
              onClick={() => setMobileMenuOpen(false)}
              className={getNavLinkClass}
            >
              <div className="flex items-center gap-2.5">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <span>Evaluaciones (30/30/40)</span>
              </div>
            </NavLink>

            <NavLink
              to="/tutoria"
              onClick={() => setMobileMenuOpen(false)}
              className={getNavLinkClass}
            >
              <div className="flex items-center gap-2.5">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Tutoría y Refuerzo IA</span>
              </div>
            </NavLink>
          </nav>
        </div>

        {/* Panel Administrativo (Exclusivo Administrador) */}
        {esAdmin && (
          <div className="pt-2">
            <div className="flex items-center justify-between px-3 mb-2">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                Administración
              </p>
              <span className="bg-[#8B151A] text-white text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wider">
                ADMIN
              </span>
            </div>
            <nav className="space-y-1">
              <NavLink
                to="/admin/usuarios"
                onClick={() => setMobileMenuOpen(false)}
                className={getNavLinkClass}
              >
                <div className="flex items-center gap-2.5">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <span>Gestión de Usuarios</span>
                </div>
              </NavLink>

              <NavLink
                to="/admin/auditoria"
                onClick={() => setMobileMenuOpen(false)}
                className={getNavLinkClass}
              >
                <div className="flex items-center gap-2.5">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span>Auditoría de Accesos</span>
                </div>
              </NavLink>

              <NavLink
                to="/admin/moodle"
                onClick={() => setMobileMenuOpen(false)}
                className={getNavLinkClass}
              >
                <div className="flex items-center gap-2.5">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2 1.5 3 3.5 3h9c2 0 3.5-1 3.5-3V7c0-2-1.5-3-3.5-3h-9C5.5 4 4 5 4 7zm0 5h16M8 8h.01M8 12h.01M8 16h.01" />
                  </svg>
                  <span>Configuración Moodle</span>
                </div>
              </NavLink>
            </nav>
          </div>
        )}
      </div>

      {/* Parte Inferior: Ficha del Usuario Autenticado y Cierre de Sesión */}
      <div className="pt-4 border-t border-zinc-200">
        <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Avatar con Iniciales (Estilo del Mockup de Referencia) */}
            <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center shrink-0 border border-emerald-300">
              {getInitials(user?.nombreCompleto)}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-zinc-800 truncate leading-tight">
                {user?.nombreCompleto || 'Usuario'}
              </p>
              <p className="text-[10px] text-zinc-500 truncate mt-0.5">
                {user?.rol || 'Docente'}
              </p>
            </div>
          </div>

          {/* Botón Salir con Ícono SVG */}
          <button
            onClick={handleLogout}
            title="Cerrar sesión institucional"
            className="p-2 text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition shrink-0 cursor-pointer"
            aria-label="Cerrar sesión"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 flex">
      {/* 1. Barra Lateral de Navegación (Sidebar) Fijo en Escritorio */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-white border-r border-zinc-200 z-30 p-4">
        {renderNavContent()}
      </aside>

      {/* 2. Menú Lateral Móvil (Drawer para pantallas pequeñas) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative flex-1 flex flex-col max-w-xs w-full bg-white border-r border-zinc-200 p-4 z-10">
            <div className="flex justify-end pb-2">
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 text-zinc-500 hover:text-zinc-800 rounded"
                aria-label="Cerrar menú"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {renderNavContent()}
          </aside>
        </div>
      )}

      {/* 3. Área Principal de Contenido (Ajustada con md:pl-64) */}
      <div className="flex-1 md:pl-64 flex flex-col min-w-0">
        <Navbar onToggleMobileMenu={() => setMobileMenuOpen(true)} />

        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AppLayout
