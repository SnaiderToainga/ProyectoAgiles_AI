import { useState, useEffect, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import axios from 'axios'
import clienteAxios from '../api/clienteAxios'

export interface Tema {
  id: number
  nombre: string
  descripcion: string
}

export interface Unidad {
  numero: number
  nombre: string
  temas: Tema[]
}

export interface Parcial {
  numero: number
  unidades: Unidad[]
}

export interface Materia {
  id: number
  codigo: string
  nombre: string
  semestre: string
  parciales: Parcial[]
}

type MateriaApi = Omit<Materia, 'parciales'> & {
  parciales: (Omit<Parcial, 'unidades'> & {
    id: number
    unidades: (Unidad & { id: number })[]
  })[]
}

export function CatalogoPage() {
  const [searchParams] = useSearchParams()
  const cursoParam = searchParams.get('curso')

  const [materias, setMaterias] = useState<MateriaApi[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const [materiaSeleccionadaId, setMateriaSeleccionadaId] = useState<number>(
    cursoParam ? Number(cursoParam) : 1
  )
  const [parcialSeleccionado, setParcialSeleccionado] = useState<number>(1)
  const [unidadesAbiertas, setUnidadesAbiertas] = useState<number[]>([1, 2])

  // Estado del modal "+ Agregar Tema" (CA-02.3 y CA-02.4)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [unidadForm, setUnidadForm] = useState<number>(1)
  const [nombreTema, setNombreTema] = useState('')
  const [descTema, setDescTema] = useState('')
  const [alertaModal, setAlertaModal] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true
    clienteAxios.get<MateriaApi[]>('/academico/materias')
      .then(({ data }) => { if (vigente) setMaterias(data) })
      .catch(() => { if (vigente) setErrorCarga('No se pudo cargar el catálogo. Comprueba la sesión y la conexión con la API.') })
      .finally(() => { if (vigente) setCargando(false) })
    return () => { vigente = false }
  }, [])

  useEffect(() => {
    if (cursoParam) {
      setMateriaSeleccionadaId(Number(cursoParam))
    }
  }, [cursoParam])

  const materiaActual = materias.find((m) => m.id === materiaSeleccionadaId) || materias[0]
  const parcialActual =
    materiaActual?.parciales.find((p) => p.numero === parcialSeleccionado) ||
    materiaActual?.parciales[0]

  const toggleUnidad = (num: number) => {
    setUnidadesAbiertas((prev) =>
      prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num]
    )
  }

  const abrirModalAgregarTema = () => {
    if (!parcialActual) return
    setUnidadForm(parcialActual.unidades[0]?.id || 0)
    setNombreTema('')
    setDescTema('')
    setAlertaModal(null)
    setModalAbierto(true)
  }

  const guardarTema = async (e: FormEvent) => {
    e.preventDefault()
    if (guardando || !materiaActual || !parcialActual) return
    if (!nombreTema.trim()) {
      setAlertaModal('El nombre del tema es obligatorio.')
      return
    }
    const unidad = parcialActual.unidades.find(u => u.id === unidadForm)
    if (!unidad) { setAlertaModal('Seleccione una unidad válida.'); return }
    setGuardando(true)
    setAlertaModal(null)
    try {
      const { data: nuevoTema } = await clienteAxios.post<Tema>('/academico/temas', {
        unidadId: unidad.id,
        nombre: nombreTema.trim(),
        descripcion: descTema.trim()
      })
      setMaterias(prev => prev.map(m => ({
        ...m,
        parciales: m.parciales.map(p => ({
          ...p,
          unidades: p.unidades.map(u => u.id === unidad.id
            ? { ...u, temas: [...u.temas, nuevoTema] } : u)
        }))
      })))
      setUnidadesAbiertas(prev => prev.includes(unidad.numero) ? prev : [...prev, unidad.numero])
      setModalAbierto(false)
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined
      setAlertaModal(status === 409 ? 'Ese tema ya existe en la unidad.'
        : status === 400 ? 'Revisa el nombre y los datos del tema.'
        : status === 403 ? 'No tienes permiso para modificar esta unidad.'
        : 'No se pudo confirmar el guardado. Recarga el catálogo para comprobarlo antes de reintentar.')
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) return <p role="status">Cargando catálogo...</p>
  if (errorCarga) return <p role="alert">{errorCarga}</p>
  if (!materiaActual || !parcialActual) return <p>No hay materias con parciales disponibles para este usuario.</p>

  return (
    <div className="space-y-6">
      {/* Selector de Asignaturas */}
      <div className="flex flex-wrap gap-2 border-b border-[#e4e4e7] pb-3">
        {materias.map((m) => {
          const activa = m.id === materiaActual.id
          return (
            <button
              key={m.id}
              onClick={() => {
                setMateriaSeleccionadaId(m.id)
                setUnidadesAbiertas([1, 2])
              }}
              className={`px-4 py-2 rounded text-xs font-semibold transition cursor-pointer ${
                activa
                  ? 'bg-[#8B151A] text-white'
                  : 'bg-white text-[#18181b] border border-[#d4d4d8] hover:bg-[#f4f4f5]'
              }`}
            >
              {m.nombre} ({m.codigo})
            </button>
          )
        })}
      </div>

      {/* Cabecera del Catálogo Curricular */}
      <div className="bg-white border border-[#e4e4e7] border-l-4 border-l-[#8B151A] rounded-md p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-[#18181b]">
            {materiaActual.nombre}
          </h1>
          <p className="text-xs text-[#52525b] mt-0.5">
            Código: <strong className="text-[#18181b]">{materiaActual.codigo}</strong> • Semestre:{' '}
            <strong className="text-[#18181b]">{materiaActual.semestre}</strong>
          </p>
        </div>

        <button
          onClick={abrirModalAgregarTema}
          className="px-4 py-2 bg-[#8B151A] hover:bg-[#6E1014] text-white rounded text-xs font-semibold transition cursor-pointer self-start sm:self-auto"
        >
          + Agregar Tema
        </button>
      </div>

      {/* Pestañas de Parciales */}
      <div className="bg-white border border-[#e4e4e7] rounded-md overflow-hidden">
        <div className="flex border-b border-[#e4e4e7] bg-[#f4f4f5]">
          {materiaActual.parciales.map((p) => {
            const activo = p.numero === parcialActual.numero
            return (
              <button
                key={p.numero}
                onClick={() => {
                  setParcialSeleccionado(p.numero)
                  setUnidadesAbiertas([1, 2])
                }}
                className={`px-5 py-2.5 text-xs font-semibold transition cursor-pointer border-b-2 ${
                  activo
                    ? 'bg-white text-[#8B151A] border-[#8B151A]'
                    : 'text-[#52525b] border-transparent hover:text-[#18181b]'
                }`}
              >
                Parcial {p.numero}
              </button>
            )
          })}
        </div>

        {/* Árbol de Unidades y Temas */}
        <div className="p-4 space-y-4">
          {parcialActual.unidades.map((u) => {
            const abierta = unidadesAbiertas.includes(u.numero)
            return (
              <div
                key={u.numero}
                className="border border-[#e4e4e7] rounded-md overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggleUnidad(u.numero)}
                  className="w-full bg-[#f4f4f5] px-4 py-3 flex items-center justify-between text-left hover:bg-[#f0f0f1] transition cursor-pointer"
                >
                  <span className="font-bold text-xs text-[#18181b]">
                    Unidad {u.numero}: {u.nombre} ({u.temas.length} temas)
                  </span>

                  <span className="text-xs font-semibold text-[#71717a]">
                    {abierta ? 'Ocultar ▲' : 'Mostrar ▼'}
                  </span>
                </button>

                {abierta && (
                  <div className="p-4 bg-white divide-y divide-[#e4e4e7]">
                    {u.temas.length === 0 ? (
                      <p className="text-xs text-[#71717a] py-2">
                        No hay temas registrados en esta unidad.
                      </p>
                    ) : (
                      u.temas.map((t) => (
                        <div key={t.id} className="py-2.5 first:pt-0 last:pb-0">
                          <p className="text-xs font-semibold text-[#18181b]">
                            {t.nombre}
                          </p>
                          <p className="text-xs text-[#52525b] mt-0.5">
                            {t.descripcion?.includes('Sprint')
                              ? 'Contenido y resultados de aprendizaje planificados para la unidad académica.'
                              : t.descripcion || 'Contenido curricular de la asignatura.'}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Modal para Agregar Tema (CA-02.3 y CA-02.4) */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-md border border-[#e4e4e7] w-full max-w-md overflow-hidden">
            <div className="bg-[#8B151A] px-5 py-3.5 flex items-center justify-between text-white">
              <h3 className="text-sm font-bold">
                Agregar Tema — Parcial {parcialActual.numero}
              </h3>
              <button
                type="button"
                disabled={guardando}
                onClick={() => setModalAbierto(false)}
                className="text-xs font-semibold text-white/80 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={guardarTema} className="p-5 space-y-4">
              {alertaModal && (
                <div className="bg-[#fef2f2] border-l-4 border-[#8B151A] p-3 rounded text-xs text-[#8B151A] font-semibold">
                  {alertaModal}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#18181b] mb-1">
                  Unidad Académica
                </label>
                <select
                  value={unidadForm}
                  onChange={(e) => setUnidadForm(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded border border-[#d4d4d8] text-xs text-[#18181b] bg-white focus:outline-none focus:border-[#8B151A]"
                >
                  {parcialActual.unidades.map((u) => (
                    <option key={u.id} value={u.id}>
                      Unidad {u.numero}: {u.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#18181b] mb-1">
                  Nombre del Tema
                </label>
                <input
                  type="text"
                  value={nombreTema}
                  onChange={(e) => {
                    setNombreTema(e.target.value)
                    if (alertaModal) setAlertaModal(null)
                  }}
                  placeholder="Ej: Planificación de Release y Sprint Backlog"
                  className="w-full px-3 py-2 rounded border border-[#d4d4d8] text-xs text-[#18181b] focus:outline-none focus:border-[#8B151A]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#18181b] mb-1">
                  Descripción
                </label>
                <textarea
                  rows={3}
                  value={descTema}
                  onChange={(e) => {
                    setDescTema(e.target.value)
                    if (alertaModal) setAlertaModal(null)
                  }}
                  placeholder="Descripción del contenido temático..."
                  className="w-full px-3 py-2 rounded border border-[#d4d4d8] text-xs text-[#18181b] focus:outline-none focus:border-[#8B151A]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={guardando}
                onClick={() => setModalAbierto(false)}
                  className="px-4 py-2 rounded border border-[#d4d4d8] text-xs font-semibold text-[#18181b] hover:bg-[#f4f4f5] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="px-4 py-2 rounded bg-[#8B151A] hover:bg-[#6E1014] text-white text-xs font-semibold cursor-pointer"
                >
                  {guardando ? 'Guardando...' : 'Guardar Tema'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default CatalogoPage