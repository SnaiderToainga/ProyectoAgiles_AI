import type { EvaluacionDto, ParcialDto, UnidadDto } from '../types/academico'
import { NOMBRE_COMPONENTE } from '../types/academico'

export type EstadoFiltroAcademico = 'todos' | 'riesgo' | 'critico' | 'aprobado'

export interface TemaCascadaOption {
  id: number
  codigo: string
  nombre: string
  unidadId: number
}

interface FiltrosCascadaProps {
  parciales: ParcialDto[]
  parcialNumero: number
  unidades: UnidadDto[]
  unidadId: number | null
  temas: TemaCascadaOption[]
  temaId: number | null
  actividades: EvaluacionDto[]
  actividadId: number | null
  estadoFiltro: EstadoFiltroAcademico
  busqueda: string
  totalActividadesFiltradas: number
  totalEstudiantesFiltrados: number
  totalEstudiantesCurso: number
  onParcialChange: (parcialNumero: number) => void
  onUnidadChange: (unidadId: number | null) => void
  onTemaChange: (temaId: number | null) => void
  onActividadChange: (actividadId: number | null) => void
  onEstadoChange: (estado: EstadoFiltroAcademico) => void
  onBusquedaChange: (valor: string) => void
  onLimpiarFiltros: () => void
}

/**
 * Selectores combinados en cascada: Parcial -> Unidad -> Tema -> Actividad
 * más búsqueda de estudiantes y filtro por estado (T-12.6 / CA-06.4 y CA-06.5).
 */
export function FiltrosCascada({
  parciales,
  parcialNumero,
  unidades,
  unidadId,
  temas,
  temaId,
  actividades,
  actividadId,
  estadoFiltro,
  busqueda,
  totalActividadesFiltradas,
  totalEstudiantesFiltrados,
  totalEstudiantesCurso,
  onParcialChange,
  onUnidadChange,
  onTemaChange,
  onActividadChange,
  onEstadoChange,
  onBusquedaChange,
  onLimpiarFiltros,
}: FiltrosCascadaProps) {
  const hayFiltrosActivos =
    unidadId !== null ||
    temaId !== null ||
    actividadId !== null ||
    estadoFiltro !== 'todos' ||
    busqueda.trim().length > 0

  return (
    <section
      aria-label="Filtros curriculares en cascada"
      className="bg-white border border-[#e4e4e7] rounded-md p-4 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f4f4f5] pb-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-[#18181b]">
            Filtros Curriculares en Cascada
          </span>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-[#f4f4f5] border border-[#e4e4e7] text-[#52525b]">
            {totalEstudiantesFiltrados} de {totalEstudiantesCurso} estudiante(s)
          </span>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-[#f4f4f5] border border-[#e4e4e7] text-[#52525b]">
            {totalActividadesFiltradas} actividad(es) en alcance
          </span>
        </div>

        {hayFiltrosActivos && (
          <button
            type="button"
            onClick={onLimpiarFiltros}
            className="text-xs font-semibold text-[#8B151A] hover:underline cursor-pointer"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
        <div>
          <label
            htmlFor="filtro-parcial"
            className="block text-[10px] font-bold uppercase tracking-wider text-[#52525b] mb-1"
          >
            1. Parcial
          </label>
          <select
            id="filtro-parcial"
            value={parcialNumero}
            onChange={(e) => onParcialChange(Number(e.target.value))}
            className="w-full text-xs px-2.5 py-2 border border-[#d4d4d8] rounded bg-white text-[#18181b] focus:outline-none focus:border-[#8B151A]"
          >
            {parciales.map((p) => (
              <option key={p.id} value={p.numero}>
                Parcial {p.numero}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="filtro-unidad"
            className="block text-[10px] font-bold uppercase tracking-wider text-[#52525b] mb-1"
          >
            2. Unidad
          </label>
          <select
            id="filtro-unidad"
            value={unidadId ?? ''}
            onChange={(e) => onUnidadChange(e.target.value ? Number(e.target.value) : null)}
            className="w-full text-xs px-2.5 py-2 border border-[#d4d4d8] rounded bg-white text-[#18181b] focus:outline-none focus:border-[#8B151A]"
          >
            <option value="">Todas las unidades ({unidades.length})</option>
            {unidades.map((u) => (
              <option key={u.id} value={u.id}>
                U{u.numero}: {u.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="filtro-tema"
            className="block text-[10px] font-bold uppercase tracking-wider text-[#52525b] mb-1"
          >
            3. Tema
          </label>
          <select
            id="filtro-tema"
            value={temaId ?? ''}
            onChange={(e) => onTemaChange(e.target.value ? Number(e.target.value) : null)}
            className="w-full text-xs px-2.5 py-2 border border-[#d4d4d8] rounded bg-white text-[#18181b] focus:outline-none focus:border-[#8B151A]"
          >
            <option value="">Todos los temas ({temas.length})</option>
            {temas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.codigo} — {t.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="filtro-actividad"
            className="block text-[10px] font-bold uppercase tracking-wider text-[#52525b] mb-1"
          >
            4. Actividad específica
          </label>
          <select
            id="filtro-actividad"
            value={actividadId ?? ''}
            onChange={(e) => onActividadChange(e.target.value ? Number(e.target.value) : null)}
            className="w-full text-xs px-2.5 py-2 border border-[#d4d4d8] rounded bg-white text-[#18181b] focus:outline-none focus:border-[#8B151A]"
          >
            <option value="">Todas ({actividades.length})</option>
            {actividades.map((a) => (
              <option key={a.id} value={a.id}>
                [{NOMBRE_COMPONENTE[a.tipo]}] {a.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="filtro-estado"
            className="block text-[10px] font-bold uppercase tracking-wider text-[#52525b] mb-1"
          >
            Estado académico
          </label>
          <select
            id="filtro-estado"
            value={estadoFiltro}
            onChange={(e) => onEstadoChange(e.target.value as EstadoFiltroAcademico)}
            className="w-full text-xs px-2.5 py-2 border border-[#d4d4d8] rounded bg-white text-[#18181b] focus:outline-none focus:border-[#8B151A]"
          >
            <option value="todos">Todos</option>
            <option value="riesgo">En Riesgo (&lt; 7.00)</option>
            <option value="critico">Críticos (&lt; 4.00)</option>
            <option value="aprobado">Aprobados (≥ 7.00)</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="filtro-busqueda-estudiante"
            className="block text-[10px] font-bold uppercase tracking-wider text-[#52525b] mb-1"
          >
            Buscar estudiante
          </label>
          <input
            id="filtro-busqueda-estudiante"
            type="text"
            value={busqueda}
            onChange={(e) => onBusquedaChange(e.target.value)}
            placeholder="Nombre, apellido o correo..."
            className="w-full text-xs px-2.5 py-2 border border-[#d4d4d8] rounded bg-white text-[#18181b] placeholder-[#a1a1aa] focus:outline-none focus:border-[#8B151A]"
          />
        </div>
      </div>
    </section>
  )
}
