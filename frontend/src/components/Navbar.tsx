import { useLocation } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useChatIa } from '../context/ChatIaContext'

interface NavbarProps {
  onToggleMobileMenu?: () => void
}

export function Navbar({ onToggleMobileMenu }: NavbarProps) {
  const { user } = useAuth()
  const { abierto, toggleChat, esModoFallback } = useChatIa()
  const location = useLocation()

  // Determinar la miga de pan / título según la ruta activa
  const getBreadcrumb = () => {
    const path = location.pathname
    if (path.startsWith('/admin/usuarios')) return { seccion: 'Administración', item: 'Gestión de Usuarios' }
    if (path.startsWith('/admin/auditoria')) return { seccion: 'Administración', item: 'Auditoría de Accesos' }
    if (path.startsWith('/admin/moodle')) return { seccion: 'Administración', item: 'Configuración Moodle' }
    if (path.startsWith('/evaluaciones')) return { seccion: 'Módulos Académicos', item: 'Evaluaciones Ponderadas (30/30/40)' }
    if (path.startsWith('/catalogo')) return { seccion: 'Módulos Académicos', item: 'Catálogo Curricular' }
    if (path.startsWith('/tutoria')) return { seccion: 'Módulos Académicos', item: 'Tutoría y Refuerzo Pedagógico con IA' }
    return { seccion: 'Panel Principal', item: 'Inicio (Dashboard)' }
  }

  const breadcrumb = getBreadcrumb()

  return (
    <header className="bg-white border-b border-zinc-200 h-14 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20">
      {/* Lado izquierdo: Botón móvil + Migas de pan institucionales */}
      <div className="flex items-center gap-3">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="md:hidden p-1.5 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition"
            aria-label="Abrir menú de navegación"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}

        <nav aria-label="Migas de pan" className="flex items-center gap-2 text-xs">
          <span className="text-zinc-400 font-medium hidden sm:inline">EduMonitor</span>
          <span className="text-zinc-300 hidden sm:inline">/</span>
          <span className="text-zinc-500 font-medium">{breadcrumb.seccion}</span>
          <span className="text-zinc-300">/</span>
          <span className="text-zinc-900 font-semibold">{breadcrumb.item}</span>
        </nav>
      </div>

      {/* Lado derecho: Botón Copiloto IA persistente + Rol institucional */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleChat}
          disabled={esModoFallback}
          title={
            esModoFallback
              ? 'Copiloto IA en modo demostración sin backend conectado'
              : abierto
              ? 'Ocultar panel de Copiloto IA'
              : 'Abrir panel lateral de Copiloto IA (permanece abierto al navegar)'
          }
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
            esModoFallback
              ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
              : abierto
              ? 'bg-[#18181b] text-white shadow-xs'
              : 'bg-[#8B151A] hover:bg-[#6E1014] text-white shadow-xs'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          <span className="hidden sm:inline">{abierto ? 'Ocultar Copiloto IA' : 'Copiloto IA'}</span>
          <span className="sm:hidden">IA</span>
        </button>

        <div className="text-right hidden sm:block pl-2 border-l border-zinc-200">
          <p className="text-xs font-semibold text-zinc-800 leading-tight">
            {user?.rol || 'Docente'}
          </p>
          <p className="text-[10px] text-zinc-400 mt-0.5">
            FISEI · Universidad Técnica de Ambato
          </p>
        </div>
      </div>
    </header>
  )
}

export default Navbar
