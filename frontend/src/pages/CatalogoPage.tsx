import { useState } from 'react'
import { BookOpen, ChevronDown, ChevronRight, Layers, FileText, CheckCircle } from 'lucide-react'

// Datos curriculares piloto del Sprint 1 (HU-02)
const MATERIAS_PILOTO = [
  {
    id: 1,
    codigo: 'SOFT-401',
    nombre: 'Metodologías Ágiles',
    semestre: 'Cuarto - B',
    parciales: [
      {
        numero: 1,
        unidades: [
          {
            numero: 1,
            nombre: 'Marco General de Metodologías Ágiles y Scrum',
            temas: [
              { id: 101, nombre: 'Manifiesto Ágil y Principios Fundamentales', descripcion: 'Los 4 valores y 12 principios rectores.' },
              { id: 102, nombre: 'Roles y Responsabilidades en Scrum', descripcion: 'Product Owner, Scrum Master y Developers.' },
              { id: 103, nombre: 'Eventos y Artefactos del Sprint', descripcion: 'Sprint Planning, Daily, Review, Retrospective y Backlogs.' }
            ]
          },
          {
            numero: 2,
            nombre: 'Planificación, Estimación y Gestión del Backlog',
            temas: [
              { id: 104, nombre: 'Historias de Usuario y Criterios de Aceptación', descripcion: 'Formato INVEST y escenarios Given-When-Then.' },
              { id: 105, nombre: 'Técnicas de Estimación Ágil', descripcion: 'Story Points, Planning Poker y Fibonacci.' },
              { id: 106, nombre: 'Cálculo de Capacidad del Equipo y Burndown', descripcion: 'Horas nominales, factor de enfoque y velocidad.' }
            ]
          }
        ]
      }
    ]
  },
  {
    id: 2,
    codigo: 'SOFT-302',
    nombre: 'Estructuras de Datos',
    semestre: 'Tercer - A',
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
      }
    ]
  }
]

export function CatalogoPage() {
  const [materiaSeleccionada, setMateriaSeleccionada] = useState(MATERIAS_PILOTO[0])
  const [unidadesAbiertas, setUnidadesAbiertas] = useState<number[]>([1, 2])

  const toggleUnidad = (num: number) => {
    setUnidadesAbiertas(prev =>
      prev.includes(num) ? prev.filter(n => n !== num) : [...prev, num]
    )
  }

  return (
    <div className="space-y-6">
      
      {/* Encabezado */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Catálogo Curricular Institucional</h1>
        <p className="text-xs text-slate-500 mt-1">
          Estructura académica de las asignaturas piloto desglosadas por unidades y temas atómicos (HU-02).
        </p>
      </div>

      {/* Selector de Materias (Pestañas) */}
      <div className="flex gap-3 border-b border-slate-200 pb-2">
        {MATERIAS_PILOTO.map(materia => (
          <button
            key={materia.id}
            onClick={() => setMateriaSeleccionada(materia)}
            className={`flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-semibold transition cursor-pointer ${
              materiaSeleccionada.id === materia.id
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>{materia.nombre} ({materia.codigo})</span>
          </button>
        ))}
      </div>

      {/* Contenido de la Materia Seleccionada */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
        
        <div className="flex justify-between items-center border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{materiaSeleccionada.nombre}</h2>
            <p className="text-xs text-slate-500">Parcial 1 • Nivel: {materiaSeleccionada.semestre}</p>
          </div>
          <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-semibold flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Sincronizado con Moodle</span>
          </span>
        </div>

        {/* Desglose de Unidades y Temas */}
        <div className="space-y-4">
          {materiaSeleccionada.parciales[0].unidades.map(unidad => {
            const estaAbierta = unidadesAbiertas.includes(unidad.numero)
            return (
              <div key={unidad.numero} className="border border-slate-200 rounded-xl overflow-hidden">
                
                {/* Cabecera de la Unidad */}
                <button
                  onClick={() => toggleUnidad(unidad.numero)}
                  className="w-full bg-slate-50 hover:bg-slate-100 p-4 flex items-center justify-between text-left transition cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">
                        Unidad {unidad.numero}: {unidad.nombre}
                      </h3>
                      <p className="text-[11px] text-slate-500">{unidad.temas.length} temas específicos de evaluación</p>
                    </div>
                  </div>
                  {estaAbierta ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                </button>

                {/* Lista de Temas Atómicos */}
                {estaAbierta && (
                  <div className="p-4 bg-white divide-y divide-slate-100">
                    {unidad.temas.map(tema => (
                      <div key={tema.id} className="py-3 flex items-start gap-3 first:pt-0 last:pb-0">
                        <FileText className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-xs font-semibold text-slate-800">{tema.nombre}</h4>
                          <p className="text-[11px] text-slate-500 mt-0.5">{tema.descripcion}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              </div>
            )
          })}
        </div>

      </div>

    </div>
  )
}

export default CatalogoPage
