import { useLocation } from 'react-router-dom'
import { useChatIa } from '../context/ChatIaContext'

interface NavbarProps {
  onToggleMobileMenu?: () => void
}

export function Navbar({ onToggleMobileMenu }: NavbarProps) {
  const { materias, materiaActivaId } = useChatIa()
  const location = useLocation()

  const materiaActiva = materias.find((m) => m.id === materiaActivaId) || materias[0]

  const getBreadcrumb = () => {
    const path = location.pathname
    if (path.startsWith('/admin/usuarios')) return 'Gestión de Usuarios'
    if (path.startsWith('/admin/auditoria')) return 'Auditoría de Accesos'
    if (path.startsWith('/admin/moodle')) return 'Configuración Moodle'
    if (path.startsWith('/evaluaciones')) return 'Evaluaciones (30/30/40)'
    if (path.startsWith('/catalogo')) return 'Catálogo Curricular'
    if (path.startsWith('/tutoria')) return 'Tutoría y Refuerzo IA'
    return 'Inicio'
  }

  const vista = getBreadcrumb()

  return (
    <header className="bg-white border-b border-[#e5e7eb] h-13 px-4 sm:px-7 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-3">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="md:hidden p-1.5 text-black hover:bg-[#f4f5f7] transition cursor-pointer"
            aria-label="Abrir menú de navegación"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}

        <nav aria-label="Migas de pan" className="flex items-center gap-2 text-[13px]">
          <span className="text-black font-medium hidden sm:inline">EduMonitor</span>
          <span className="text-black hidden sm:inline">/</span>
          <span className="text-black font-semibold">{vista}</span>
        </nav>
      </div>

      <div className="flex items-center gap-3">
        {materiaActiva && (
          <div className="hidden md:flex items-center gap-2 text-[12.5px] font-medium text-black">
            <span className="w-2 h-2 rounded-full bg-[#18181b]" style={{ borderRadius: '50%' }} />
            <span className="font-semibold">
              {materiaActiva.codigo} · {materiaActiva.nombre}
            </span>
            <span>{materiaActiva.semestre}</span>
          </div>
        )}
      </div>
    </header>
  )
}

export default Navbar
