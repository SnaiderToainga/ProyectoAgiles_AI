import { useState, useEffect, useMemo, useCallback, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { Plus, RefreshCw, ChevronDown } from 'lucide-react'
import clienteAxios from '../api/clienteAxios'
import { NOMBRE_COMPONENTE, type EvaluacionDto } from '../types/academico'
import { PrimeraSincronizacionMoodle } from '../components/PrimeraSincronizacionMoodle'
import { SearchAutocompleteInput } from '../components/SearchAutocompleteInput'
import { useChatIa } from '../context/ChatIaContext'

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

function limpiarTituloUnidad(numero: number, nombre: string): string {
  const limpio = nombre.trim()
  const prefijo = new RegExp(`^unidad\\s*${numero}\\s*[:.-]?\\s*`, 'i')
  const sinPrefijo = limpio.replace(prefijo, '').trim()
  return sinPrefijo || limpio
}

export function CatalogoPage() {
  const [searchParams] = useSearchParams()
  const cursoParam = searchParams.get('curso')
  const { materiaActivaId: materiaContextoId } = useChatIa()

  const [materias, setMaterias] = useState<MateriaApi[]>([])
  const [evaluacionesCurso, setEvaluacionesCurso] = useState<EvaluacionDto[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)
  const [alertaSync, setAlertaSync] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)

  const [materiaSeleccionadaId, setMateriaSeleccionadaId] = useState<number>(
    cursoParam ? Number(cursoParam) : 1
  )
  const [parcialSeleccionado, setParcialSeleccionado] = useState<number>(1)
  const [unidadesAbiertas, setUnidadesAbiertas] = useState<number[]>([1, 2, 3, 4])
  const [busquedaTema, setBusquedaTema] = useState('')

  // Estado del modal "+ Agregar Tema" (CA-02.3 y CA-02.4)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [unidadForm, setUnidadForm] = useState<number>(0)
  const [nombreTema, setNombreTema] = useState('')
  const [descTema, setDescTema] = useState('')
  const [alertaModal, setAlertaModal] = useState<string | null>(null)

  const cargarMaterias = useCallback(async () => {
    const { data } = await clienteAxios.get<MateriaApi[]>('/academico/materias')
    setMaterias(data)
    return data
  }, [])

  useEffect(() => {
    let vigente = true
    cargarMaterias()
      .catch(() => {
        if (vigente) {
          setErrorCarga('No se pudo cargar el catálogo. Comprueba la sesión y la conexión con la API.')
        }
      })
      .finally(() => {
        if (vigente) setCargando(false)
      })
    return () => {
      vigente = false
    }
  }, [cargarMaterias])

  useEffect(() => {
    if (cursoParam) {
      setMateriaSeleccionadaId(Number(cursoParam))
    } else if (materiaContextoId) {
      setMateriaSeleccionadaId(materiaContextoId)
    }
  }, [cursoParam, materiaContextoId])

  const materiaActual = useMemo(
    () => materias.find((m) => m.id === materiaSeleccionadaId) || materias[0],
    [materias, materiaSeleccionadaId]
  )

  const parcialActual = useMemo(
    () =>
      materiaActual?.parciales.find((p) => p.numero === parcialSeleccionado) ||
      materiaActual?.parciales[0],
    [materiaActual, parcialSeleccionado]
  )

  const cargarEvaluacionesCurso = useCallback(async (cursoId: number) => {
    try {
      const { data } = await clienteAxios.get<EvaluacionDto[]>(
        `/academico/materias/${cursoId}/evaluaciones`
      )
      setEvaluacionesCurso(data)
    } catch {
      setEvaluacionesCurso([])
    }
  }, [])

  useEffect(() => {
    if (!materiaActual) return
    cargarEvaluacionesCurso(materiaActual.id)
  }, [materiaActual, cargarEvaluacionesCurso])

  useEffect(() => {
    if (!parcialActual) return
    setUnidadesAbiertas(parcialActual.unidades.map((u) => u.numero))
  }, [parcialActual])

  useEffect(() => {
    if (!alertaSync) return
    const t = setTimeout(() => setAlertaSync(null), 6000)
    return () => clearTimeout(t)
  }, [alertaSync])

  const evaluacionesPorTema = useMemo(() => {
    const mapa = new Map<number, EvaluacionDto[]>()
    for (const ev of evaluacionesCurso) {
      if (parcialActual && ev.parcialId !== null && ev.parcialId !== parcialActual.id) continue
      for (const temaId of ev.temaIds) {
        const lista = mapa.get(temaId) || []
        lista.push(ev)
        mapa.set(temaId, lista)
      }
    }
    return mapa
  }, [evaluacionesCurso, parcialActual])

  const unidadesFiltradas = useMemo(() => {
    if (!parcialActual) return []
    const q = busquedaTema.trim().toLowerCase()
    if (!q) return parcialActual.unidades
    return parcialActual.unidades
      .map((u) => ({
        ...u,
        temas: u.temas.filter((t) => {
          const evs = evaluacionesPorTema.get(t.id) || []
          return (
            t.nombre.toLowerCase().includes(q) ||
            (t.descripcion || '').toLowerCase().includes(q) ||
            evs.some((ev) => ev.nombre.toLowerCase().includes(q))
          )
        }),
      }))
      .filter((u) => u.temas.length > 0 || u.nombre.toLowerCase().includes(q))
  }, [parcialActual, busquedaTema, evaluacionesPorTema])

  const toggleUnidad = (num: number) => {
    setUnidadesAbiertas((prev) =>
      prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num]
    )
  }

  const abrirModalAgregarTema = (unidadIdPreseleccionada?: number) => {
    if (!parcialActual) return
    setUnidadForm(unidadIdPreseleccionada ?? parcialActual.unidades[0]?.id ?? 0)
    setNombreTema('')
    setDescTema('')
    setAlertaModal(null)
    setModalAbierto(true)
  }

  const sincronizarDesdeMoodle = async () => {
    if (!materiaActual || sincronizando) return
    setSincronizando(true)
    setAlertaSync(null)
    try {
      await clienteAxios.post('/moodle/sync-cursos')
      await clienteAxios.post(`/moodle/sync-notas/${materiaActual.id}`)
      await Promise.all([cargarMaterias(), cargarEvaluacionesCurso(materiaActual.id)])
      setAlertaSync({
        tipo: 'exito',
        texto: `Catálogo de ${materiaActual.codigo} actualizado desde Moodle (cursos, unidades, temas vacíos y actividades).`,
      })
    } catch {
      setAlertaSync({
        tipo: 'error',
        texto: 'No se pudo sincronizar con Moodle en este momento. Verifica que el contenedor de Moodle esté activo.',
      })
    } finally {
      setSincronizando(false)
    }
  }

  const guardarTema = async (e: FormEvent) => {
    e.preventDefault()
    if (guardando || !materiaActual || !parcialActual) return
    if (!nombreTema.trim()) {
      setAlertaModal('El nombre del tema es obligatorio.')
      return
    }
    const unidad = parcialActual.unidades.find((u) => u.id === unidadForm)
    if (!unidad) {
      setAlertaModal('Seleccione una unidad válida.')
      return
    }
    setGuardando(true)
    setAlertaModal(null)
    try {
      const { data: nuevoTema } = await clienteAxios.post<Tema>('/academico/temas', {
        unidadId: unidad.id,
        nombre: nombreTema.trim(),
        descripcion: descTema.trim(),
      })
      setMaterias((prev) =>
        prev.map((m) => ({
          ...m,
          parciales: m.parciales.map((p) => ({
            ...p,
            unidades: p.unidades.map((u) =>
              u.id === unidad.id ? { ...u, temas: [...u.temas, nuevoTema] } : u
            ),
          })),
        }))
      )
      setUnidadesAbiertas((prev) =>
        prev.includes(unidad.numero) ? prev : [...prev, unidad.numero]
      )
      setModalAbierto(false)
      setAlertaSync({
        tipo: 'exito',
        texto: `Tema "${nuevoTema.nombre}" agregado en Unidad ${unidad.numero} (disponible en Evaluaciones y Tutoría IA).`,
      })
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined
      setAlertaModal(
        status === 409
          ? 'Ese tema ya existe en la unidad.'
          : status === 400
          ? 'Revisa el nombre y los datos del tema.'
          : status === 403
          ? 'No tienes permiso para modificar esta unidad.'
          : 'No se pudo confirmar el guardado. Recarga el catálogo para comprobarlo antes de reintentar.'
      )
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) return <p role="status" className="text-xs text-[#52525b]">Cargando catálogo...</p>
  if (errorCarga) return <p role="alert" className="text-xs text-red-700">{errorCarga}</p>
  if (!materiaActual || !parcialActual) {
    return materias.length === 0 ? (
      <PrimeraSincronizacionMoodle />
    ) : (
      <p className="text-xs text-[#52525b]">
        No hay materias con parciales disponibles para este usuario.
      </p>
    )
  }

  const todosLosTemas = parcialActual.unidades.flatMap((u) => u.temas.map((t) => t.nombre))

  return (
    <div className="space-y-4">
      <div className="cadence-header">
        <div className="toolbar-group">
          <div className="parcial-tabs">
            {materiaActual.parciales.map((p) => (
              <button
                key={p.numero}
                type="button"
                className={`parcial-tab ${p.numero === parcialActual.numero ? 'active' : ''}`}
                onClick={() => setParcialSeleccionado(p.numero)}
              >
                Parcial {p.numero}
              </button>
            ))}
          </div>
          <SearchAutocompleteInput
            value={busquedaTema}
            onSearch={setBusquedaTema}
            suggestions={todosLosTemas}
            placeholder="Buscar tema o actividad..."
            className="w-[260px]"
          />
          <button
            type="button"
            className="link-btn"
            onClick={() => setUnidadesAbiertas(parcialActual.unidades.map((u) => u.numero))}
          >
            Expandir
          </button>
          <button type="button" className="link-btn" onClick={() => setUnidadesAbiertas([])}>
            Colapsar
          </button>
        </div>

        <div className="toolbar-group">
          <button
            type="button"
            className="btn-secondary"
            onClick={sincronizarDesdeMoodle}
            disabled={sincronizando}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${sincronizando ? 'animate-spin' : ''}`} />
            {sincronizando ? 'Sincronizando...' : 'Sincronizar Moodle'}
          </button>
          <button type="button" className="btn-primary" onClick={() => abrirModalAgregarTema()}>
            <Plus className="w-3.5 h-3.5" />
            Agregar Tema
          </button>
        </div>
      </div>

      {alertaSync && (
        <div
          role={alertaSync.tipo === 'exito' ? 'status' : 'alert'}
          className="px-3.5 py-2.5 bg-[#f8f9fb] border border-[#e5e7eb] text-xs text-black"
          style={{ borderLeft: `3px solid ${alertaSync.tipo === 'exito' ? 'var(--green)' : 'var(--uta)'}` }}
        >
          {alertaSync.texto}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {unidadesFiltradas.length === 0 ? (
          <div className="table-card p-8 text-center text-xs text-black">
            No se encontraron unidades o temas que coincidan con &quot;{busquedaTema}&quot;.
          </div>
        ) : (
          unidadesFiltradas.map((u) => {
            const abierta = unidadesAbiertas.includes(u.numero) || busquedaTema.trim().length > 0
            const tituloUnidad = limpiarTituloUnidad(u.numero, u.nombre)
            return (
              <div key={u.id} className="table-card">
                <div
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-[#f8f9fb] cursor-pointer"
                  onClick={() => toggleUnidad(u.numero)}
                >
                  <span className="font-semibold text-[13.5px] text-black">
                    Unidad {u.numero}: {tituloUnidad}
                  </span>
                  <span className="flex items-center gap-3 text-xs text-black">
                    <button
                      type="button"
                      className="link-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        abrirModalAgregarTema(u.id)
                      }}
                    >
                      + Tema aquí
                    </button>
                    <span className="tabular-nums">{u.temas.length} temas</span>
                    <ChevronDown
                      className="w-3.5 h-3.5"
                      style={{ transform: abierta ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}
                    />
                  </span>
                </div>

                {abierta && (
                  <div>
                    {u.temas.length === 0 ? (
                      <div className="px-4 py-3 text-xs text-black flex items-center justify-between border-t border-[#eef0f3]">
                        <span>No hay temas registrados en esta unidad.</span>
                        <button type="button" className="link-btn" onClick={() => abrirModalAgregarTema(u.id)}>
                          + Crear primer tema
                        </button>
                      </div>
                    ) : (
                      u.temas.map((t, idx) => {
                        const evsTema = evaluacionesPorTema.get(t.id) || []
                        const descLimpia =
                          t.descripcion &&
                          !t.descripcion.includes('Sprint') &&
                          t.descripcion !== 'Contenido curricular correspondiente a la unidad académica.'
                            ? t.descripcion
                            : null
                        return (
                          <div
                            key={t.id}
                            className="px-4 py-3 border-t border-[#eef0f3] flex flex-wrap items-start justify-between gap-3"
                          >
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="text-[13px] font-semibold text-black">
                                <span className="tabular-nums text-[11px] mr-2">
                                  T{u.numero}.{idx + 1}
                                </span>
                                {t.nombre}
                              </div>
                              {descLimpia && <div className="text-[12px] text-black">{descLimpia}</div>}
                              {evsTema.length === 0 ? (
                                <div className="text-[11.5px] text-black italic">
                                  Sin actividades evaluativas vinculadas aún en este tema.
                                </div>
                              ) : (
                                <div className="flex flex-wrap gap-1.5 pt-0.5">
                                  {evsTema.map((ev) => (
                                    <span
                                      key={ev.id}
                                      className="text-[11px] px-2 py-0.5 border border-[#e5e7eb] bg-white text-black"
                                    >
                                      <strong>{NOMBRE_COMPONENTE[ev.tipo]}</strong> · {ev.nombre}
                                      {!ev.publicado && ' (Pendiente)'}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="badge-clean neutral tabular-nums">{evsTema.length} eval.</span>
                              <Link to={`/evaluaciones?materia=${materiaActual.id}`} className="link-btn">
                                Ver notas →
                              </Link>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Modal para Agregar Tema (CA-02.3 y CA-02.4) */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-md border border-[#e4e4e7] w-full max-w-md overflow-hidden shadow-xl">
            <div className="border-b border-[#e5e7eb] px-5 py-3.5 flex items-center justify-between text-black">
              <h3 className="text-sm font-bold">
                Agregar Tema — Parcial {parcialActual.numero}
              </h3>
              <button
                type="button"
                disabled={guardando}
                onClick={() => setModalAbierto(false)}
                className="text-xs font-semibold text-black hover:text-[#8B151A] cursor-pointer"
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
                      Unidad {u.numero}: {limpiarTituloUnidad(u.numero, u.nombre)}
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
                  Descripción / Resultados de Aprendizaje
                </label>
                <textarea
                  rows={3}
                  value={descTema}
                  onChange={(e) => setDescTema(e.target.value)}
                  placeholder="Detalle breve del contenido que abarca el tema..."
                  className="w-full px-3 py-2 rounded border border-[#d4d4d8] text-xs text-[#18181b] focus:outline-none focus:border-[#8B151A]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={guardando}
                  onClick={() => setModalAbierto(false)}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="btn-primary"
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
