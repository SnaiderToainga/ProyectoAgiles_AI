import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ChatIaProvider, useChatIa } from '../context/ChatIaContext'
import { ChatIaWidget } from './ChatIaWidget'
import { Navbar } from './Navbar'
import logo from '../assets/logo.png'

export function AppLayout() {
  return (
    <ChatIaProvider>
      <AppLayoutShell />
    </ChatIaProvider>
  )
}

function AppLayoutShell() {
  const { user, logout } = useAuth()
  const {
    abierto,
    setAbierto,
    materias,
    materiaActivaId,
    estudiantes,
    rendimientosPorMateria,
    estudiantePreseleccionado,
    esModoFallback,
    cambiarMateriaEnChat,
    limpiarPreseleccion,
  } = useChatIa()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const esAdmin = Boolean(user?.rol?.toLowerCase().includes('admin'))

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Generación de iniciales para el avatar del perfil (ignorando títulos como Ing., Dr., etc.)
  const getInitials = (name?: string) => {
    if (!name) return 'EM'
    const parts = name
      .trim()
      .split(/\s+/)
      .filter((p) => !/^(ing|lic|dr|dra|mg|msc|sr|sra)\.?$/i.test(p))
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    }
    return (parts[0] || name).slice(0, 2).toUpperCase()
  }

  const getNavLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center justify-between px-2.5 py-2 text-[13px] transition group ${
      isActive
        ? 'bg-[#f1f2f4] text-black font-semibold'
        : 'text-black font-medium hover:bg-[#f4f5f7]'
    }`

  const renderNavContent = (isMobile = false) => (
    <div className="flex flex-col h-full justify-between overflow-hidden">
      <div className="space-y-5">
        <div className="flex items-center gap-2.5 px-1.5 pt-1">
          <img src={logo} alt="EduMonitor" className="h-8 w-8 object-contain shrink-0" />
          <div className={isMobile ? 'block' : 'hidden group-hover/sidebar:block min-w-0'}>
            <h1 className="text-[14px] font-bold text-black tracking-tight leading-tight whitespace-nowrap">
              EduMonitor AI
            </h1>
            <p className="text-[11px] font-medium text-black whitespace-nowrap">
              FISEI · UTA
            </p>
          </div>
        </div>

        <div>
          <p className={`text-[10.5px] font-semibold text-black uppercase tracking-wider px-2.5 mb-1.5 ${isMobile ? 'block' : 'hidden group-hover/sidebar:block'}`}>
            Módulos
          </p>
          <nav className="space-y-0.5">
            <NavLink to="/dashboard" onClick={() => setMobileMenuOpen(false)} className={getNavLinkClass} title="Inicio">
              <div className="flex items-center gap-2.5 min-w-0">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5.5v-6h-5v6H4a1 1 0 0 1-1-1v-9.5z" />
                </svg>
                <span className={`truncate ${isMobile ? 'inline' : 'hidden group-hover/sidebar:inline'}`}>Inicio</span>
              </div>
            </NavLink>

            <NavLink to="/catalogo" onClick={() => setMobileMenuOpen(false)} className={getNavLinkClass} title="Catálogo Curricular">
              <div className="flex items-center gap-2.5 min-w-0">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                </svg>
                <span className={`truncate ${isMobile ? 'inline' : 'hidden group-hover/sidebar:inline'}`}>Catálogo Curricular</span>
              </div>
            </NavLink>

            <NavLink to="/evaluaciones" onClick={() => setMobileMenuOpen(false)} className={getNavLinkClass} title="Evaluaciones">
              <div className="flex items-center gap-2.5 min-w-0">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <path d="M9 11l3 3L22 4" />
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
                <span className={`truncate ${isMobile ? 'inline' : 'hidden group-hover/sidebar:inline'}`}>Evaluaciones</span>
              </div>
            </NavLink>

            <NavLink to="/tutoria" onClick={() => setMobileMenuOpen(false)} className={getNavLinkClass} title="Tutoría y Refuerzo">
              <div className="flex items-center gap-2.5 min-w-0">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                  <path d="M6 12v5c3 3 9 3 12 0v-5" />
                </svg>
                <span className={`truncate ${isMobile ? 'inline' : 'hidden group-hover/sidebar:inline'}`}>Tutoría y Refuerzo</span>
              </div>
            </NavLink>
          </nav>
        </div>

        {materias.length > 0 && (
          <div className={isMobile ? 'block' : 'hidden group-hover/sidebar:block'}>
            <p className="text-[10.5px] font-semibold text-black uppercase tracking-wider px-2.5 mb-1.5">
              Asignaturas
            </p>
            <div className="space-y-0.5">
              {materias.map((m, idx) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    cambiarMateriaEnChat(m.id)
                    setMobileMenuOpen(false)
                  }}
                  className={`w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 cursor-pointer transition ${
                    m.id === materiaActivaId ? 'bg-[#f1f2f4]' : 'hover:bg-[#f4f5f7]'
                  }`}
                >
                  <span
                    className="w-2 h-2 shrink-0"
                    style={{ borderRadius: '50%', background: idx === 0 ? '#18181b' : '#15803d' }}
                  />
                  <div className="min-w-0 leading-tight">
                    <div className="text-[12.5px] font-semibold text-black truncate">{m.nombre}</div>
                    <div className="text-[11px] text-black truncate">{m.codigo} · {m.semestre}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {esAdmin && (
          <div className="pt-1">
            <div className={`flex items-center justify-between px-2.5 mb-1.5 ${isMobile ? 'flex' : 'hidden group-hover/sidebar:flex'}`}>
              <p className="text-[10.5px] font-semibold text-black uppercase tracking-wider">
                Administración
              </p>
              <span className="bg-[#8B151A] text-white text-[9px] px-1.5 py-0.5 font-bold tracking-wider">
                ADMIN
              </span>
            </div>
            <nav className="space-y-0.5">
              <NavLink to="/admin/usuarios" onClick={() => setMobileMenuOpen(false)} className={getNavLinkClass} title="Gestión de Usuarios">
                <div className="flex items-center gap-2.5 min-w-0">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  </svg>
                  <span className={`truncate ${isMobile ? 'inline' : 'hidden group-hover/sidebar:inline'}`}>Gestión de Usuarios</span>
                </div>
              </NavLink>

              <NavLink to="/admin/auditoria" onClick={() => setMobileMenuOpen(false)} className={getNavLinkClass} title="Auditoría de Accesos">
                <div className="flex items-center gap-2.5 min-w-0">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  <span className={`truncate ${isMobile ? 'inline' : 'hidden group-hover/sidebar:inline'}`}>Auditoría de Accesos</span>
                </div>
              </NavLink>

              <NavLink to="/admin/moodle" onClick={() => setMobileMenuOpen(false)} className={getNavLinkClass} title="Configuración Moodle">
                <div className="flex items-center gap-2.5 min-w-0">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                    <rect x="2" y="3" width="20" height="7" />
                    <rect x="2" y="14" width="20" height="7" />
                  </svg>
                  <span className={`truncate ${isMobile ? 'inline' : 'hidden group-hover/sidebar:inline'}`}>Configuración Moodle</span>
                </div>
              </NavLink>
            </nav>
          </div>
        )}
      </div>

      <div className="pt-3 border-t border-[#e5e7eb]">
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-8 h-8 bg-[#18181b] text-white font-semibold text-[11px] flex items-center justify-center shrink-0"
              style={{ borderRadius: '50%' }}
            >
              {getInitials(user?.nombreCompleto)}
            </div>
            <div className={`min-w-0 ${isMobile ? 'block' : 'hidden group-hover/sidebar:block'}`}>
              <p className="text-xs font-semibold text-black truncate leading-tight">
                {user?.nombreCompleto || 'Usuario'}
              </p>
              <p className="text-[11px] text-black truncate mt-0.5">
                {user?.rol || 'Docente'}
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            title="Cerrar sesión institucional"
            className={`p-1.5 text-black hover:bg-[#fef2f2] hover:text-[#8B151A] transition shrink-0 cursor-pointer ${isMobile ? 'inline-flex' : 'hidden group-hover/sidebar:inline-flex'}`}
            aria-label="Cerrar sesión"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-white text-black flex">
      {/* Sidebar hover-expandable acoplado al flujo (empuja el contenido sin taparlo) */}
      <aside className="hidden md:flex md:w-16 hover:md:w-64 transition-all duration-200 flex-col sticky top-0 h-screen shrink-0 bg-white border-r border-[#e5e7eb] z-30 px-3 py-4 group/sidebar overflow-y-auto overflow-x-hidden">
        {renderNavContent(false)}
      </aside>

      {/* Menú Lateral Móvil */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative flex-1 flex flex-col max-w-xs w-full bg-white border-r border-[#e5e7eb] p-4 z-10">
            <div className="flex justify-end pb-2">
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 text-black hover:bg-[#f4f5f7]"
                aria-label="Cerrar menú"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {renderNavContent(true)}
          </aside>
        </div>
      )}

      {/* Área Principal de Contenido + SISRA IA acoplado */}
      <div className="flex-1 flex min-w-0 bg-white">
        <div className="flex-1 flex flex-col min-w-0 bg-white">
          <Navbar onToggleMobileMenu={() => setMobileMenuOpen(true)} />

          <main className="flex-1 px-[18px] pt-4 pb-20 w-full">
            <Outlet />
          </main>
        </div>

        {/* Panel lateral derecho fijo (docked) en desktop cuando el Copiloto está abierto */}
        <aside
          className={
            abierto && !esModoFallback
              ? 'lg:w-[390px] xl:w-[420px] lg:shrink-0 lg:h-screen lg:sticky lg:top-0 lg:z-30'
              : ''
          }
        >
          <ChatIaWidget
            materias={materias}
            materiaSeleccionadaId={materiaActivaId ?? undefined}
            estudiantes={estudiantes}
            rendimientosPorMateria={rendimientosPorMateria}
            estudiantePreseleccionado={estudiantePreseleccionado}
            abiertoExterno={abierto && !esModoFallback}
            desactivado={esModoFallback}
            dockGlobal={true}
            onAbrir={() => setAbierto(true)}
            onCerrar={() => setAbierto(false)}
            onLimpiarPreseleccion={limpiarPreseleccion}
          />
        </aside>
      </div>
    </div>
  )
}

export default AppLayout
