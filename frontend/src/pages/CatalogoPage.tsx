import { useState, useEffect, useMemo, useCallback, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import {
  BookOpen,
  Layers,
  Plus,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  ArrowRight,
  CheckCircle2,
  FolderOpen,
} from 'lucide-react'
import clienteAxios from '../api/clienteAxios'
import { NOMBRE_COMPONENTE, type EvaluacionDto } from '../types/academico'
import { PrimeraSincronizacionMoodle } from '../components/PrimeraSincronizacionMoodle'

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
    }
  }, [cursoParam])

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

  const statsParcial = useMemo(() => {
    if (!parcialActual) return { unidades: 0, temas: 0, actividades: 0 }
    const temas = parcialActual.unidades.reduce((acc, u) => acc + u.temas.length, 0)
    const actividades = evaluacionesCurso.filter(
      (ev) => !parcialActual || ev.parcialId === null || ev.parcialId === parcialActual.id
    ).length
    return {
      unidades: parcialActual.unidades.length,
      temas,
      actividades,
    }
  }, [parcialActual, evaluacionesCurso])

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

  return (
    <div className="space-y-5">
      {/* Selector de Asignaturas estilo Tarjetas Compactas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {materias.map((m) => {
          const activa = m.id === materiaActual.id
          const totalTemasMat = m.parciales.reduce(
            (accP, p) => accP + p.unidades.reduce((accU, u) => accU + u.temas.length, 0),
            0
          )
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setMateriaSeleccionadaId(m.id)}
              className={`text-left p-3.5 rounded-lg border transition cursor-pointer flex items-center justify-between gap-3 ${
                activa
                  ? 'bg-[#8B151A] text-white border-[#8B151A] shadow-xs'
                  : 'bg-white text-[#18181b] border-[#e4e4e7] hover:border-[#8B151A]/50'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`p-2 rounded-md shrink-0 ${
                    activa ? 'bg-white/15 text-white' : 'bg-[#f4f4f5] text-[#8B151A]'
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate">{m.nombre}</p>
                  <p className={`text-[11px] ${activa ? 'text-white/80' : 'text-[#71717a]'}`}>
                    {m.codigo} · {m.semestre}
                  </p>
                </div>
              </div>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded shrink-0 ${
                  activa ? 'bg-white/20 text-white' : 'bg-[#f4f4f5] text-[#52525b]'
                }`}
              >
                {totalTemasMat} temas
              </span>
            </button>
          )
        })}
      </div>

      {/* Cabecera de Asignatura + Acciones */}
      <div className="bg-white border border-[#e4e4e7] border-l-4 border-l-[#8B151A] rounded-lg p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xs">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold text-[#18181b]">{materiaActual.nombre}</h1>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-[#f4f4f5] border border-[#e4e4e7] text-[#52525b]">
              {materiaActual.codigo}
            </span>
          </div>
          <p className="text-xs text-[#52525b]">
            Semestre: <strong className="text-[#18181b]">{materiaActual.semestre}</strong> • Parcial{' '}
            {parcialActual.numero}:{' '}
            <strong className="text-[#18181b]">{statsParcial.unidades}</strong> unidad(es),{' '}
            <strong className="text-[#18181b]">{statsParcial.temas}</strong> tema(s) y{' '}
            <strong className="text-[#18181b]">{statsParcial.actividades}</strong> actividad(es) evaluativa(s)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={sincronizarDesdeMoodle}
            disabled={sincronizando}
            className="px-3.5 py-2 border border-[#d4d4d8] hover:bg-[#f4f4f5] disabled:opacity-60 text-[#18181b] rounded text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${sincronizando ? 'animate-spin' : ''}`} />
            {sincronizando ? 'Sincronizando Moodle...' : 'Sincronizar Moodle'}
          </button>

          <button
            type="button"
            onClick={() => abrirModalAgregarTema()}
            className="px-4 py-2 bg-[#8B151A] hover:bg-[#6E1014] text-white rounded text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Agregar Tema
          </button>
        </div>
      </div>

      {alertaSync && (
        <div
          role={alertaSync.tipo === 'exito' ? 'status' : 'alert'}
          className={`p-3.5 rounded-md border-l-4 text-xs font-medium flex items-center gap-2 ${
            alertaSync.tipo === 'exito'
              ? 'bg-emerald-50 border-emerald-600 text-emerald-800'
              : 'bg-amber-50 border-amber-500 text-amber-800'
          }`}
        >
          {alertaSync.tipo === 'exito' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
          <span>{alertaSync.texto}</span>
        </div>
      )}

      {/* Contenedor de Parciales, Buscador y Unidades */}
      <div className="bg-white border border-[#e4e4e7] rounded-lg overflow-hidden shadow-xs">
        <div className="p-3 sm:px-4 border-b border-[#e4e4e7] bg-[#f4f4f5] flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Pestañas de Parcial */}
          <div className="flex items-center gap-1 bg-[#e4e4e7] p-1 rounded-md self-start">
            {materiaActual.parciales.map((p) => {
              const activo = p.numero === parcialActual.numero
              return (
                <button
                  key={p.numero}
                  type="button"
                  onClick={() => setParcialSeleccionado(p.numero)}
                  className={`px-4 py-1.5 rounded text-xs font-semibold transition cursor-pointer ${
                    activo
                      ? 'bg-white text-[#8B151A] shadow-xs'
                      : 'text-[#52525b] hover:text-[#18181b]'
                  }`}
                >
                  Parcial {p.numero}
                </button>
              )
            })}
          </div>

          {/* Buscador y Controles de Acordeón */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-[#71717a] absolute left-2.5 top-2" />
              <input
                type="text"
                value={busquedaTema}
                onChange={(e) => setBusquedaTema(e.target.value)}
                placeholder="Buscar tema o actividad..."
                className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border border-[#d4d4d8] rounded focus:outline-none focus:border-[#8B151A]"
              />
            </div>

            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#52525b]">
              <button
                type="button"
                onClick={() => setUnidadesAbiertas(parcialActual.unidades.map((u) => u.numero))}
                className="px-2 py-1 hover:text-[#18181b] cursor-pointer"
              >
                Expandir
              </button>
              <span className="text-[#d4d4d8]">|</span>
              <button
                type="button"
                onClick={() => setUnidadesAbiertas([])}
                className="px-2 py-1 hover:text-[#18181b] cursor-pointer"
              >
                Colapsar
              </button>
            </div>
          </div>
        </div>

        {/* Árbol de Unidades, Temas y Actividades Vinculadas */}
        <div className="p-4 space-y-4">
          {unidadesFiltradas.length === 0 ? (
            <div className="py-10 text-center space-y-2 text-xs text-[#71717a]">
              <FolderOpen className="w-6 h-6 mx-auto text-[#a1a1aa]" />
              <p>No se encontraron unidades o temas que coincidan con &quot;{busquedaTema}&quot;.</p>
            </div>
          ) : (
            unidadesFiltradas.map((u) => {
              const abierta = unidadesAbiertas.includes(u.numero) || busquedaTema.trim().length > 0
              const tituloUnidad = limpiarTituloUnidad(u.numero, u.nombre)
              return (
                <div
                  key={u.id}
                  className="border border-[#e4e4e7] rounded-lg overflow-hidden"
                >
                  <div className="bg-[#fafafa] px-4 py-3 flex flex-wrap items-center justify-between gap-2 border-b border-[#e4e4e7]">
                    <button
                      type="button"
                      onClick={() => toggleUnidad(u.numero)}
                      className="flex items-center gap-2 text-left cursor-pointer group flex-1 min-w-0"
                    >
                      <Layers className="w-4 h-4 text-[#8B151A] shrink-0" />
                      <div className="min-w-0">
                        <span className="font-bold text-xs text-[#18181b] group-hover:text-[#8B151A] transition">
                          Unidad {u.numero}: {tituloUnidad}
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white border border-[#e4e4e7] text-[#52525b] shrink-0">
                        {u.temas.length} tema(s)
                      </span>
                    </button>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => abrirModalAgregarTema(u.id)}
                        className="text-[11px] font-semibold text-[#8B151A] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        Tema aquí
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleUnidad(u.numero)}
                        className="text-xs font-semibold text-[#71717a] hover:text-[#18181b] flex items-center gap-1 cursor-pointer"
                      >
                        {abierta ? (
                          <>
                            Ocultar <ChevronUp className="w-3.5 h-3.5" />
                          </>
                        ) : (
                          <>
                            Mostrar <ChevronDown className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {abierta && (
                    <div className="p-4 bg-white divide-y divide-[#f4f4f5]">
                      {u.temas.length === 0 ? (
                        <div className="py-3 flex items-center justify-between text-xs text-[#71717a]">
                          <span>No hay temas registrados en esta unidad.</span>
                          <button
                            type="button"
                            onClick={() => abrirModalAgregarTema(u.id)}
                            className="font-semibold text-[#8B151A] hover:underline cursor-pointer"
                          >
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
                              className="py-3 first:pt-0 last:pb-0 space-y-2"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#8B151A]/10 text-[#8B151A]">
                                      T{u.numero}.{idx + 1}
                                    </span>
                                    <p className="text-xs font-bold text-[#18181b]">{t.nombre}</p>
                                  </div>
                                  {descLimpia && (
                                    <p className="text-[11px] text-[#52525b] pl-9">{descLimpia}</p>
                                  )}
                                </div>

                                <Link
                                  to={`/evaluaciones?materia=${materiaActual.id}`}
                                  className="text-[11px] font-semibold text-[#52525b] hover:text-[#8B151A] flex items-center gap-1 shrink-0"
                                >
                                  Ver notas <ArrowRight className="w-3 h-3" />
                                </Link>
                              </div>

                              {/* Actividades de Moodle vinculadas a este tema */}
                              <div className="pl-9">
                                {evsTema.length === 0 ? (
                                  <span className="text-[10px] text-[#a1a1aa] italic">
                                    Sin actividades evaluativas vinculadas aún en este tema.
                                  </span>
                                ) : (
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-[10px] font-semibold text-[#71717a] flex items-center gap-1 mr-1">
                                      <ClipboardList className="w-3 h-3" />
                                      Actividades ({evsTema.length}):
                                    </span>
                                    {evsTema.map((ev) => (
                                      <span
                                        key={ev.id}
                                        className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border ${
                                          ev.publicado
                                            ? 'bg-[#fafafa] text-[#27272a] border-[#e4e4e7]'
                                            : 'bg-amber-50 text-amber-800 border-amber-200'
                                        }`}
                                      >
                                        <strong className="text-[#8B151A]">
                                          {NOMBRE_COMPONENTE[ev.tipo]}
                                        </strong>
                                        <span>· {ev.nombre}</span>
                                        {!ev.publicado && <span>(Pendiente)</span>}
                                      </span>
                                    ))}
                                  </div>
                                )}
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
      </div>

      {/* Modal para Agregar Tema (CA-02.3 y CA-02.4) */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-md border border-[#e4e4e7] w-full max-w-md overflow-hidden shadow-xl">
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
                  className="px-4 py-2 rounded border border-[#d4d4d8] text-xs font-semibold text-[#52525b] hover:bg-[#f4f4f5] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="px-4 py-2 rounded bg-[#8B151A] hover:bg-[#6E1014] text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
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
