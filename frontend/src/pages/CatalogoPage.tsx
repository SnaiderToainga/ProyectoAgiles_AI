import { useState, useEffect, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import clienteAxios from '../api/clienteAxios'

interface Tema {
  id: number
  nombre: string
  descripcion: string
}

interface Unidad {
  numero: number
  nombre: string
  temas: Tema[]
}

interface Parcial {
  numero: number
  unidades: Unidad[]
}

interface Materia {
  id: number
  codigo: string
  nombre: string
  semestre: string
  parciales: Parcial[]
}

const MATERIAS_BASE: Materia[] = [
  {
    id: 1,
    codigo: 'SOF-401',
    nombre: 'Metodologías Ágiles',
    semestre: 'Cuarto Nivel B',
    parciales: [
      {
        numero: 1,
        unidades: [
          {
            numero: 1,
            nombre: 'Marco General de Metodologías Ágiles y Scrum',
            temas: [
              { id: 101, nombre: 'Manifiesto Ágil y Principios Fundamentales', descripcion: 'Valores y principios del desarrollo ágil.' },
              { id: 102, nombre: 'Roles y Responsabilidades en Scrum', descripcion: 'Product Owner, Scrum Master y Developers.' },
              { id: 103, nombre: 'Eventos y Artefactos del Sprint', descripcion: 'Sprint Planning, Daily, Review, Retrospective y Backlogs.' }
            ]
          },
          {
            numero: 2,
            nombre: 'Planificación, Estimación y Gestión del Backlog',
            temas: [
              { id: 104, nombre: 'Historias de Usuario y Criterios de Aceptación', descripcion: 'Estructura INVEST y escenarios Given-When-Then.' },
              { id: 105, nombre: 'Técnicas de Estimación Ágil', descripcion: 'Story Points, Planning Poker y Fibonacci.' },
              { id: 106, nombre: 'Cálculo de Capacidad del Equipo y Burndown', descripcion: 'Velocidad del equipo y seguimiento del Sprint.' }
            ]
          }
        ]
      },
      {
        numero: 2,
        unidades: [
          {
            numero: 1,
            nombre: 'Métricas Ágiles y Escalado',
            temas: [
              { id: 107, nombre: 'Velocidad, Lead Time y Cycle Time', descripcion: 'Indicadores de flujo y predictibilidad de entregas.' },
              { id: 108, nombre: 'Integración Continua y DevOps Ágil', descripcion: 'Automatización de pruebas y despliegue continuo.' }
            ]
          },
          {
            numero: 2,
            nombre: 'Calidad de Software y Mejora Continua',
            temas: [
              { id: 109, nombre: 'Desarrollo Guiado por Pruebas (TDD)', descripcion: 'Ciclo Red-Green-Refactor y pruebas unitarias.' },
              { id: 110, nombre: 'Retrospectivas Efectivas y Deuda Técnica', descripcion: 'Acciones de mejora e inspección del proceso.' }
            ]
          }
        ]
      }
    ]
  },
  {
    id: 2,
    codigo: 'SOF-402',
    nombre: 'Estructuras de Datos',
    semestre: 'Cuarto Nivel A',
    parciales: [
      {
        numero: 1,
        unidades: [
          {
            numero: 1,
            nombre: 'Estructuras Lineales y Complejidad Algorítmica',
            temas: [
              { id: 201, nombre: 'Análisis Asintótico y Notación Big-O', descripcion: 'Complejidad temporal y espacial de algoritmos.' },
              { id: 202, nombre: 'Listas Enlazadas Simples y Dobles', descripcion: 'Nodos, apuntadores e inserción/eliminación.' },
              { id: 203, nombre: 'Pilas y Colas (LIFO / FIFO)', descripcion: 'Operaciones push, pop, enqueue y dequeue.' }
            ]
          },
          {
            numero: 2,
            nombre: 'Estructuras No Lineales',
            temas: [
              { id: 204, nombre: 'Árboles Binarios de Búsqueda (BST)', descripcion: 'Recorridos preorden, inorden y postorden.' },
              { id: 205, nombre: 'Grafos y Representación en Memoria', descripcion: 'Matrices y listas de adyacencia.' }
            ]
          }
        ]
      },
      {
        numero: 2,
        unidades: [
          {
            numero: 1,
            nombre: 'Árboles Balanceados y Tablas Hash',
            temas: [
              { id: 206, nombre: 'Árboles AVL y Rotaciones', descripcion: 'Factor de equilibrio y rotaciones simples y dobles.' },
              { id: 207, nombre: 'Tablas Hash y Manejo de Colisiones', descripcion: 'Funciones de dispersión y encadenamiento.' }
            ]
          },
          {
            numero: 2,
            nombre: 'Algoritmos sobre Grafos',
            temas: [
              { id: 208, nombre: 'Búsqueda en Anchura (BFS) y Profundidad (DFS)', descripcion: 'Exploración de vértices y componentes conexas.' },
              { id: 209, nombre: 'Caminos Mínimos (Dijkstra)', descripcion: 'Optimización de rutas en grafos ponderados.' }
            ]
          }
        ]
      }
    ]
  }
]

export function CatalogoPage() {
  const [searchParams] = useSearchParams()
  const [materias, setMaterias] = useState<Materia[]>(MATERIAS_BASE)
  const [materiaId, setMateriaId] = useState(1)
  const [parcialNum, setParcialNum] = useState(1)
  const [abiertas, setAbiertas] = useState<number[]>([1, 2])
  const [modalAbierto, setModalAbierto] = useState(false)
  const [unidadForm, setUnidadForm] = useState(1)
  const [nombreTema, setNombreTema] = useState('')
  const [descTema, setDescTema] = useState('')
  const [alertaModal, setAlertaModal] = useState<string | null>(null)

  useEffect(() => {
    const c = Number(searchParams.get('curso'))
    if (c === 1 || c === 2) setMateriaId(c)
  }, [searchParams])

  useEffect(() => {
    clienteAxios
      .get<Materia[]>('/academico/materias')
      .then((res) => {
        if (Array.isArray(res.data) && res.data.length > 0) {
          setMaterias(res.data)
        }
      })
      .catch(() => {})
  }, [])

  const materiaActual = materias.find((m) => m.id === materiaId) || materias[0]
  const parcialActual =
    materiaActual.parciales.find((p) => p.numero === parcialNum) || materiaActual.parciales[0]

  const toggleUnidad = (n: number) =>
    setAbiertas((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]))

  const abrirModal = (unidadNum = 1) => {
    setUnidadForm(unidadNum)
    setNombreTema('')
    setDescTema('')
    setAlertaModal(null)
    setModalAbierto(true)
  }

  const guardarTema = async (e: FormEvent) => {
    e.preventDefault()
    if (!nombreTema.trim() || !descTema.trim()) {
      setAlertaModal('Operación rechazada: no se permiten campos vacíos. Complete el nombre y la descripción del tema.')
      return
    }

    const nuevo: Tema = {
      id: Date.now(),
      nombre: nombreTema.trim(),
      descripcion: descTema.trim()
    }

    try {
      await clienteAxios.post('/academico/temas', {
        materiaId: materiaActual.id,
        parcialNumero: parcialActual.numero,
        unidadNumero: unidadForm,
        nombre: nuevo.nombre,
        descripcion: nuevo.descripcion
      })
    } catch {
      void 0
    }

    setMaterias((prev) =>
      prev.map((m) =>
        m.id !== materiaActual.id
          ? m
          : {
              ...m,
              parciales: m.parciales.map((p) =>
                p.numero !== parcialActual.numero
                  ? p
                  : {
                      ...p,
                      unidades: p.unidades.map((u) =>
                        u.numero !== unidadForm ? u : { ...u, temas: [...u.temas, nuevo] }
                      )
                    }
              )
            }
      )
    )

    if (!abiertas.includes(unidadForm)) setAbiertas((prev) => [...prev, unidadForm])
    setModalAbierto(false)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-[#18181b]">Catálogo Curricular</h1>
        <button
          onClick={() => abrirModal(1)}
          className="px-4 py-2 bg-[#8B151A] hover:bg-[#6E1014] text-white rounded text-xs font-semibold transition cursor-pointer"
        >
          + Agregar Tema
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e4e4e7] pb-3">
        <div className="flex gap-2">
          {materias.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                setMateriaId(m.id)
                setParcialNum(1)
              }}
              className={`py-2 px-4 rounded text-xs font-semibold transition cursor-pointer ${
                materiaActual.id === m.id
                  ? 'bg-[#8B151A] text-white'
                  : 'bg-white text-[#18181b] border border-[#d4d4d8] hover:border-[#8B151A]'
              }`}
            >
              {m.nombre} ({m.codigo})
            </button>
          ))}
        </div>

        <div className="flex gap-1.5">
          {materiaActual.parciales.map((p) => (
            <button
              key={p.numero}
              onClick={() => setParcialNum(p.numero)}
              className={`py-1.5 px-3 rounded text-xs font-semibold transition cursor-pointer ${
                parcialActual.numero === p.numero
                  ? 'bg-[#18181b] text-white'
                  : 'bg-white text-[#52525b] border border-[#d4d4d8] hover:text-[#18181b]'
              }`}
            >
              Parcial {p.numero}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-md border border-[#e4e4e7] p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-[#e4e4e7] pb-3.5">
          <div>
            <h2 className="text-base font-bold text-[#18181b]">{materiaActual.nombre}</h2>
            <p className="text-xs text-[#52525b]">
              {materiaActual.codigo} • {materiaActual.semestre}
            </p>
          </div>
          <span className="text-xs font-semibold text-[#8B151A]">
            Parcial {parcialActual.numero}
          </span>
        </div>

        <div className="space-y-3">
          {parcialActual.unidades.map((u) => {
            const abierta = abiertas.includes(u.numero)
            return (
              <div key={u.numero} className="border border-[#e4e4e7] rounded-md overflow-hidden">
                <button
                  onClick={() => toggleUnidad(u.numero)}
                  className="w-full bg-[#f4f4f5] hover:bg-[#e4e4e7]/60 px-4 py-3 flex items-center justify-between text-left transition cursor-pointer"
                >
                  <span className="font-bold text-xs text-[#18181b]">
                    Unidad {u.numero}: {u.nombre}
                  </span>
                  <span className="text-xs font-semibold text-[#8B151A]">
                    {abierta ? 'Ocultar' : 'Mostrar'}
                  </span>
                </button>

                {abierta && (
                  <div className="p-4 bg-white divide-y divide-[#e4e4e7]">
                    {u.temas.map((t) => (
                      <div key={t.id} className="py-2.5 first:pt-0 last:pb-0">
                        <p className="text-xs font-semibold text-[#18181b]">{t.nombre}</p>
                        <p className="text-xs text-[#52525b] mt-0.5">{t.descripcion}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {modalAbierto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-md border border-[#e4e4e7] w-full max-w-md overflow-hidden">
            <div className="bg-[#8B151A] px-5 py-3.5 flex items-center justify-between text-white">
              <h3 className="text-sm font-bold">Agregar Tema — Parcial {parcialActual.numero}</h3>
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                className="text-xs font-semibold text-white/80 hover:text-white cursor-pointer"
              >
                Cerrar
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
                    <option key={u.numero} value={u.numero}>
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
                  placeholder="Ej. Planificación de Release"
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
                  placeholder="Contenido del tema..."
                  className="w-full px-3 py-2 rounded border border-[#d4d4d8] text-xs text-[#18181b] focus:outline-none focus:border-[#8B151A]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  className="px-4 py-2 rounded border border-[#d4d4d8] text-xs font-semibold text-[#18181b] hover:bg-[#f4f4f5] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-[#8B151A] hover:bg-[#6E1014] text-white text-xs font-semibold cursor-pointer"
                >
                  Guardar Tema
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
