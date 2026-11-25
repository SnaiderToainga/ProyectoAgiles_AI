import { useState } from 'react'
import clienteAxios from '../api/clienteAxios'
import { mensajeDeError } from '../api/usuariosService'
import { useAuth } from '../context/AuthContext'
import type { MateriaDto, SincronizacionDto } from '../types/academico'

interface Props {
  /** Se ejecuta al terminar con al menos una materia; por defecto recarga la página. */
  onSincronizado?: () => void
}

interface Resultado {
  tipo: 'error' | 'advertencia'
  texto: string
}

/**
 * Estado vacío para un docente sin materias en SISRA: trae sus cursos desde Moodle
 * (los del período donde es profesor) y después sus estudiantes, actividades y notas.
 */
export function PrimeraSincronizacionMoodle({ onSincronizado }: Props) {
  const { user } = useAuth()
  const [sincronizando, setSincronizando] = useState(false)
  const [progreso, setProgreso] = useState<string | null>(null)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const esDocente = (user?.rol ?? '').toLowerCase() === 'docente'

  const sincronizar = async () => {
    setSincronizando(true)
    setResultado(null)
    try {
      setProgreso('Consultando tus cursos en Moodle...')
      await clienteAxios.post<SincronizacionDto>('/moodle/sync-cursos', null, { timeout: 60000 })
      const { data: materias } = await clienteAxios.get<MateriaDto[]>('/academico/materias')

      if (materias.length === 0) {
        setResultado({
          tipo: 'advertencia',
          texto:
            'Moodle no muestra cursos del período donde seas profesor. Pide al administrador que te matricule con rol Profesor en un curso de «Octubre 2026 – Febrero 2027».',
        })
        return
      }

      const fallidas: string[] = []
      for (const [indice, materia] of materias.entries()) {
        setProgreso(`Sincronizando ${materia.codigo} (${indice + 1} de ${materias.length})...`)
        try {
          await clienteAxios.post<SincronizacionDto>(`/moodle/sync-notas/${materia.id}`, null, { timeout: 120000 })
        } catch (error) {
          fallidas.push(`${materia.codigo}: ${mensajeDeError(error, 'no se pudo sincronizar')}`)
        }
      }

      if (fallidas.length > 0) {
        setResultado({
          tipo: 'advertencia',
          texto: `Se importaron tus cursos, pero algunas notas no se sincronizaron. ${fallidas.join(' · ')}`,
        })
        return
      }

      if (onSincronizado) onSincronizado()
      else window.location.reload()
    } catch (error) {
      setResultado({ tipo: 'error', texto: mensajeDeError(error, 'No se pudo conectar con Moodle en este momento.') })
    } finally {
      setSincronizando(false)
      setProgreso(null)
    }
  }

  if (!esDocente) {
    return (
      <div className="bg-white border border-[#e4e4e7] rounded-md p-6 text-xs text-[#52525b]">
        Las cuentas de administrador no tienen materias asignadas. Los docentes sincronizan sus propios cursos desde Moodle.
      </div>
    )
  }

  return (
    <div className="bg-white border border-[#e4e4e7] border-l-4 border-l-[#1F3B73] rounded-md p-6 space-y-3 shadow-xs">
      <h2 className="text-sm font-bold text-[#18181b]">Todavía no tienes materias en SISRA</h2>
      <p className="text-xs text-[#52525b] leading-relaxed">
        Tus materias vienen de Moodle: SISRA importa los cursos del período donde estás matriculado como profesor, con sus
        estudiantes, actividades y calificaciones. Después podrás clasificar las actividades en Evaluaciones.
      </p>

      {resultado && (
        <p
          role="alert"
          className={`p-2.5 rounded border text-xs ${
            resultado.tipo === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}
        >
          {resultado.texto}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void sincronizar()}
          disabled={sincronizando}
          className="px-4 py-2 bg-[#8B151A] hover:bg-[#6E1014] disabled:opacity-60 text-white rounded text-xs font-semibold shadow-xs transition cursor-pointer"
        >
          {sincronizando ? 'Sincronizando...' : 'Sincronizar mis cursos desde Moodle'}
        </button>
        {progreso && (
          <span role="status" className="text-xs text-[#52525b]">
            {progreso}
          </span>
        )}
        {resultado?.tipo === 'advertencia' && !sincronizando && (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="text-xs text-[#1F3B73] hover:underline cursor-pointer"
          >
            Ver mis materias
          </button>
        )}
      </div>
    </div>
  )
}

export default PrimeraSincronizacionMoodle
