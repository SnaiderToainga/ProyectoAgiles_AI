import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import clienteAxios from '../api/clienteAxios'
import { RendimientoBarChart } from '../components/RendimientoBarChart'
import { ChatIaWidget } from '../components/ChatIaWidget'
import { Sparkles, GraduationCap, MessageSquareCode } from 'lucide-react'
import type { MateriaDto, ResumenAcademicoEstudianteDto } from '../types/academico'

interface ResumenMateria {
  materia: MateriaDto
  totalEstudiantes: number
  promedio: number
  enRiesgo: number
  estudiantes: ResumenAcademicoEstudianteDto[]
}

// Datos de contingencia local para asignaturas piloto (en caso de que el backend .NET no esté encendido)
const MATERIAS_PILOTO_FALLBACK: ResumenMateria[] = [
  {
    materia: {
      id: 1,
      codigo: 'SOF-401',
      nombre: 'Metodologías Ágiles',
      semestre: 'Cuarto B',
      parciales: [{ id: 1, numero: 1, unidades: [] }],
    },
    totalEstudiantes: 12,
    promedio: 7.28,
    enRiesgo: 4,
    estudiantes: [
      {
        estudianteId: 1,
        nombres: 'Cesar Steven',
        apellidos: 'Carrasco Manotoa',
        correo: 'ccarrasco@uta.edu.ec',
        cursoId: 1,
        parcialId: 1,
        notaFinalParcial: 5.40,
        enRiesgo: true,
        componentes: [],
        temasDeficientes: [{ temaId: 104, nombreTema: 'Historias de Usuario e INVEST', evaluacionOrigen: 'Tarea 2', notaObtenida: 5.0 }],
      },
      {
        estudianteId: 2,
        nombres: 'Cristian Fernando',
        apellidos: 'Sivinta Lasluisa',
        correo: 'csivinta@uta.edu.ec',
        cursoId: 1,
        parcialId: 1,
        notaFinalParcial: 6.80,
        enRiesgo: true,
        componentes: [],
        temasDeficientes: [{ temaId: 105, nombreTema: 'Estimación con Planning Poker', evaluacionOrigen: 'APE 1', notaObtenida: 6.0 }],
      },
      {
        estudianteId: 3,
        nombres: 'Kevin Ariel',
        apellidos: 'Vargas Solís',
        correo: 'kvargas@uta.edu.ec',
        cursoId: 1,
        parcialId: 1,
        notaFinalParcial: 3.50,
        enRiesgo: true,
        componentes: [],
        temasDeficientes: [{ temaId: 101, nombreTema: 'Fundamentos y Roles Scrum', evaluacionOrigen: 'Examen Parcial', notaObtenida: 3.0 }],
      },
      {
        estudianteId: 4,
        nombres: 'Diego Alejandro',
        apellidos: 'Morales Silva',
        correo: 'dmorales@uta.edu.ec',
        cursoId: 1,
        parcialId: 1,
        notaFinalParcial: 5.90,
        enRiesgo: true,
        componentes: [],
        temasDeficientes: [{ temaId: 104, nombreTema: 'Criterios de Aceptación Gherkin', evaluacionOrigen: 'Tarea 3', notaObtenida: 5.5 }],
      },
      {
        estudianteId: 5,
        nombres: 'Estiven Sebastian',
        apellidos: 'Chiluisa Vasquez',
        correo: 'echiluisa@uta.edu.ec',
        cursoId: 1,
        parcialId: 1,
        notaFinalParcial: 9.10,
        enRiesgo: false,
        componentes: [],
        temasDeficientes: [],
      },
      {
        estudianteId: 6,
        nombres: 'Snaider Alexander',
        apellidos: 'Toainga Toapanta',
        correo: 'stoainga@uta.edu.ec',
        cursoId: 1,
        parcialId: 1,
        notaFinalParcial: 8.75,
        enRiesgo: false,
        componentes: [],
        temasDeficientes: [],
      },
      {
        estudianteId: 7,
        nombres: 'Andrea Nicole',
        apellidos: 'Gómez Salazar',
        correo: 'agomez@uta.edu.ec',
        cursoId: 1,
        parcialId: 1,
        notaFinalParcial: 9.50,
        enRiesgo: false,
        componentes: [],
        temasDeficientes: [],
      },
      {
        estudianteId: 8,
        nombres: 'Mateo Francisco',
        apellidos: 'Lopez Herrera',
        correo: 'mlopez@uta.edu.ec',
        cursoId: 1,
        parcialId: 1,
        notaFinalParcial: 7.20,
        enRiesgo: false,
        componentes: [],
        temasDeficientes: [],
      },
      {
        estudianteId: 9,
        nombres: 'Javier Enrique',
        apellidos: 'Ruiz Ortiz',
        correo: 'jruiz@uta.edu.ec',
        cursoId: 1,
        parcialId: 1,
        notaFinalParcial: 7.60,
        enRiesgo: false,
        componentes: [],
        temasDeficientes: [],
      },
      {
        estudianteId: 10,
        nombres: 'Valeria Sofia',
        apellidos: 'Pérez Cárdenas',
        correo: 'vperez@uta.edu.ec',
        cursoId: 1,
        parcialId: 1,
        notaFinalParcial: 8.10,
        enRiesgo: false,
        componentes: [],
        temasDeficientes: [],
      },
      {
        estudianteId: 11,
        nombres: 'Carlos Daniel',
        apellidos: 'Mendoza Alvarez',
        correo: 'cmendoza@uta.edu.ec',
        cursoId: 1,
        parcialId: 1,
        notaFinalParcial: 7.90,
        enRiesgo: false,
        componentes: [],
        temasDeficientes: [],
      },
      {
        estudianteId: 12,
        nombres: 'Camila Belén',
        apellidos: 'Flores Ramos',
        correo: 'cflores@uta.edu.ec',
        cursoId: 1,
        parcialId: 1,
        notaFinalParcial: 8.30,
        enRiesgo: false,
        componentes: [],
        temasDeficientes: [],
      },
    ],
  },
  {
    materia: {
      id: 2,
      codigo: 'SOF-402',
      nombre: 'Estructuras de Datos',
      semestre: 'Cuarto B',
      parciales: [{ id: 2, numero: 1, unidades: [] }],
    },
    totalEstudiantes: 12,
    promedio: 7.05,
    enRiesgo: 3,
    estudiantes: [
      {
        estudianteId: 1,
        nombres: 'Cesar Steven',
        apellidos: 'Carrasco Manotoa',
        correo: 'ccarrasco@uta.edu.ec',
        cursoId: 2,
        parcialId: 2,
        notaFinalParcial: 6.20,
        enRiesgo: true,
        componentes: [],
        temasDeficientes: [{ temaId: 201, nombreTema: 'Árboles Binarios de Búsqueda', evaluacionOrigen: 'APE 2', notaObtenida: 5.0 }],
      },
      {
        estudianteId: 2,
        nombres: 'Cristian Fernando',
        apellidos: 'Sivinta Lasluisa',
        correo: 'csivinta@uta.edu.ec',
        cursoId: 2,
        parcialId: 2,
        notaFinalParcial: 5.80,
        enRiesgo: true,
        componentes: [],
        temasDeficientes: [{ temaId: 202, nombreTema: 'Grafos y Algoritmo de Dijkstra', evaluacionOrigen: 'Examen', notaObtenida: 4.5 }],
      },
      {
        estudianteId: 3,
        nombres: 'Kevin Ariel',
        apellidos: 'Vargas Solís',
        correo: 'kvargas@uta.edu.ec',
        cursoId: 2,
        parcialId: 2,
        notaFinalParcial: 3.80,
        enRiesgo: true,
        componentes: [],
        temasDeficientes: [{ temaId: 200, nombreTema: 'Listas Enlazadas Dobles', evaluacionOrigen: 'Tarea 1', notaObtenida: 3.5 }],
      },
      {
        estudianteId: 5,
        nombres: 'Estiven Sebastian',
        apellidos: 'Chiluisa Vasquez',
        correo: 'echiluisa@uta.edu.ec',
        cursoId: 2,
        parcialId: 2,
        notaFinalParcial: 8.80,
        enRiesgo: false,
        componentes: [],
        temasDeficientes: [],
      },
      {
        estudianteId: 6,
        nombres: 'Snaider Alexander',
        apellidos: 'Toainga Toapanta',
        correo: 'stoainga@uta.edu.ec',
        cursoId: 2,
        parcialId: 2,
        notaFinalParcial: 8.40,
        enRiesgo: false,
        componentes: [],
        temasDeficientes: [],
      },
      {
        estudianteId: 7,
        nombres: 'Andrea Nicole',
        apellidos: 'Gómez Salazar',
        correo: 'agomez@uta.edu.ec',
        cursoId: 2,
        parcialId: 2,
        notaFinalParcial: 9.20,
        enRiesgo: false,
        componentes: [],
        temasDeficientes: [],
      },
      {
        estudianteId: 8,
        nombres: 'Mateo Francisco',
        apellidos: 'Lopez Herrera',
        correo: 'mlopez@uta.edu.ec',
        cursoId: 2,
        parcialId: 2,
        notaFinalParcial: 7.50,
        enRiesgo: false,
        componentes: [],
        temasDeficientes: [],
      },
      {
        estudianteId: 9,
        nombres: 'Javier Enrique',
        apellidos: 'Ruiz Ortiz',
        correo: 'jruiz@uta.edu.ec',
        cursoId: 2,
        parcialId: 2,
        notaFinalParcial: 7.10,
        enRiesgo: false,
        componentes: [],
        temasDeficientes: [],
      },
      {
        estudianteId: 10,
        nombres: 'Valeria Sofia',
        apellidos: 'Pérez Cárdenas',
        correo: 'vperez@uta.edu.ec',
        cursoId: 2,
        parcialId: 2,
        notaFinalParcial: 7.90,
        enRiesgo: false,
        componentes: [],
        temasDeficientes: [],
      },
      {
        estudianteId: 11,
        nombres: 'Carlos Daniel',
        apellidos: 'Mendoza Alvarez',
        correo: 'cmendoza@uta.edu.ec',
        cursoId: 2,
        parcialId: 2,
        notaFinalParcial: 7.40,
        enRiesgo: false,
        componentes: [],
        temasDeficientes: [],
      },
      {
        estudianteId: 12,
        nombres: 'Camila Belén',
        apellidos: 'Flores Ramos',
        correo: 'cflores@uta.edu.ec',
        cursoId: 2,
        parcialId: 2,
        notaFinalParcial: 8.10,
        enRiesgo: false,
        componentes: [],
        temasDeficientes: [],
      },
      {
        estudianteId: 4,
        nombres: 'Diego Alejandro',
        apellidos: 'Morales Silva',
        correo: 'dmorales@uta.edu.ec',
        cursoId: 2,
        parcialId: 2,
        notaFinalParcial: 7.30,
        enRiesgo: false,
        componentes: [],
        temasDeficientes: [],
      },
    ],
  },
]

export function DashboardPage() {
  const { user } = useAuth()
  const [resumenes, setResumenes] = useState<ResumenMateria[]>([])
  const [materiasOriginales, setMateriasOriginales] = useState<MateriaDto[]>([])
  const [materiaActivaId, setMateriaActivaId] = useState<number | null>(null)
  const [estudianteParaChat, setEstudianteParaChat] = useState<ResumenAcademicoEstudianteDto | null>(null)
  const [chatAbierto, setChatAbierto] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [esModoFallback, setEsModoFallback] = useState(false)

  useEffect(() => {
    let vigente = true

    async function cargarDashboard() {
      try {
        const { data: materias } = await clienteAxios.get<MateriaDto[]>('/academico/materias')
        if (vigente) setMateriasOriginales(materias)

        const resultados = await Promise.all(
          materias.map(async (materia) => {
            const parcial = materia.parciales.find((p) => p.numero === 1) || materia.parciales[0]
            if (!parcial) {
              return { materia, totalEstudiantes: 0, promedio: 0, enRiesgo: 0, estudiantes: [] }
            }

            try {
              const { data: estudiantes } = await clienteAxios.get<ResumenAcademicoEstudianteDto[]>(
                `/academico/materias/${materia.id}/parciales/${parcial.id}/rendimiento`
              )
              const totalEstudiantes = estudiantes.length
              const promedio =
                totalEstudiantes > 0
                  ? estudiantes.reduce((acc, e) => acc + e.notaFinalParcial, 0) / totalEstudiantes
                  : 0
              const enRiesgo = estudiantes.filter((e) => e.enRiesgo).length
              return { materia, totalEstudiantes, promedio, enRiesgo, estudiantes }
            } catch {
              return { materia, totalEstudiantes: 0, promedio: 0, enRiesgo: 0, estudiantes: [] }
            }
          })
        )

        if (vigente) {
          if (resultados.length > 0 && resultados.some((r) => r.totalEstudiantes > 0)) {
            setResumenes(resultados)
            setMateriaActivaId(resultados[0].materia.id)
            setEsModoFallback(false)
          } else {
            // Usar datos piloto para demostración inmediata
            setResumenes(MATERIAS_PILOTO_FALLBACK)
            setMateriasOriginales(MATERIAS_PILOTO_FALLBACK.map((r) => r.materia))
            setMateriaActivaId(MATERIAS_PILOTO_FALLBACK[0].materia.id)
            setEsModoFallback(true)
          }
        }
      } catch {
        if (vigente) {
          // Si el backend no responde, activar datos piloto para visualización inmediata
          setResumenes(MATERIAS_PILOTO_FALLBACK)
          setMateriasOriginales(MATERIAS_PILOTO_FALLBACK.map((r) => r.materia))
          setMateriaActivaId(MATERIAS_PILOTO_FALLBACK[0].materia.id)
          setEsModoFallback(true)
        }
      } finally {
        if (vigente) setCargando(false)
      }
    }

    cargarDashboard()
    return () => {
      vigente = false
    }
  }, [])

  const kpis = useMemo(() => {
    const totalEstudiantes = resumenes.reduce((acc, r) => acc + r.totalEstudiantes, 0)
    const materiasConNotas = resumenes.filter((r) => r.totalEstudiantes > 0)
    const promedioGeneral =
      materiasConNotas.length > 0
        ? materiasConNotas.reduce((acc, r) => acc + r.promedio, 0) / materiasConNotas.length
        : 0
    const totalEnRiesgo = resumenes.reduce((acc, r) => acc + r.enRiesgo, 0)

    return {
      totalEstudiantes,
      promedioGeneral: promedioGeneral.toFixed(2),
      totalEnRiesgo,
    }
  }, [resumenes])

  const resumenSeleccionado = useMemo(() => {
    if (!materiaActivaId && resumenes.length > 0) return resumenes[0]
    return resumenes.find((r) => r.materia.id === materiaActivaId) || resumenes[0] || null
  }, [resumenes, materiaActivaId])

  const estudiantesParaGrafico = useMemo(() => {
    if (!resumenSeleccionado) return []
    return resumenSeleccionado.estudiantes
  }, [resumenSeleccionado])

  return (
    <div className="space-y-6">
      {/* Encabezado Docente con Acceso Directo al Tutor IA */}
      <div className="bg-white border border-[#e4e4e7] border-l-4 border-l-[#8B151A] rounded-md p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <h1 className="text-lg font-bold text-[#18181b]">
            Bienvenido, {user?.nombreCompleto || 'Docente'}
          </h1>
          <p className="text-xs text-[#52525b] mt-0.5">
            Período Académico: Octubre 2026 – Febrero 2027 | Carrera: Ingeniería en Software (FISEI UTA)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/catalogo"
            className="px-3.5 py-2 border border-[#8B151A] text-[#8B151A] hover:bg-[#8B151A]/5 rounded text-xs font-semibold transition"
          >
            Catálogo Curricular
          </Link>
          <Link
            to="/evaluaciones"
            className="px-4 py-2 bg-[#8B151A] hover:bg-[#6E1014] text-white rounded text-xs font-semibold transition"
          >
            Evaluaciones
          </Link>
          <Link
            to="/tutoria"
            className="px-3.5 py-2 border border-[#d4d4d8] hover:bg-[#f4f4f5] text-[#18181b] rounded text-xs font-semibold transition"
          >
            Tutoría IA
          </Link>
          <button
            onClick={() => setChatAbierto(true)}
            className="px-3.5 py-2 bg-gradient-to-r from-[#8B151A] to-[#6E1014] text-white rounded text-xs font-semibold shadow-sm hover:shadow transition flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
            Asistente Tutor IA
          </button>
        </div>
      </div>

      {esModoFallback && (
        <div role="status" className="p-3 bg-amber-50 border-l-4 border-amber-500 rounded text-xs text-amber-800 flex items-center justify-between">
          <span>
            ℹ️ <b>Datos demostrativos cargados:</b> Mostrando las calificaciones de las 2 asignaturas piloto (12 estudiantes). Inicia el backend (.NET en puerto :5000) para sincronización directa con Moodle.
          </span>
          <span className="text-[11px] font-semibold text-amber-900 bg-amber-100 px-2 py-0.5 rounded">
            Piloto UTA Activo
          </span>
        </div>
      )}

      {/* Tarjetas de Resumen General (KPIs) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-md p-5 border border-[#e4e4e7] shadow-xs">
          <p className="text-xs font-semibold text-[#52525b]">Total Estudiantes Evaluados</p>
          <p className="text-2xl font-bold text-[#18181b] mt-1">
            {cargando ? '...' : kpis.totalEstudiantes}
          </p>
          <p className="text-[11px] text-[#71717a] mt-1">
            {resumenes.length} asignatura(s) con calificaciones registradas
          </p>
        </div>

        <div className="bg-white rounded-md p-5 border border-[#e4e4e7] shadow-xs">
          <p className="text-xs font-semibold text-[#52525b]">Promedio Ponderado General</p>
          <p className="text-2xl font-bold text-[#18181b] mt-1">
            {cargando ? '...' : kpis.promedioGeneral}{' '}
            <span className="text-xs font-normal text-[#71717a]">/ 10.00 pts</span>
          </p>
          <p className="text-[11px] text-[#71717a] mt-1">Modelo oficial FISEI (30% Tareas + 30% APE + 40% Examen)</p>
        </div>

        <div
          className={`bg-white rounded-md p-5 border shadow-xs ${
            kpis.totalEnRiesgo > 0 ? 'border-red-400 bg-red-50/20' : 'border-[#8B151A]'
          }`}
        >
          <p className="text-xs font-semibold text-[#8B151A]">En Riesgo Académico (&lt; 7.00)</p>
          <p className="text-2xl font-bold text-[#8B151A] mt-1">
            {cargando ? '...' : kpis.totalEnRiesgo}
          </p>
          <p className="text-[11px] text-[#71717a] mt-1">
            Estudiantes que requieren plan de refuerzo prioritario
          </p>
          {kpis.totalEnRiesgo > 0 && (
            <Link
              to="/tutoria"
              className="inline-block mt-2.5 text-xs font-semibold text-[#8B151A] hover:underline"
            >
              Ver estudiantes y generar planes con IA →
            </Link>
          )}
        </div>
      </div>

      {/* Selector de Asignatura para el Gráfico */}
      {resumenes.length > 1 && (
        <div className="bg-white p-3 rounded-md border border-[#e4e4e7] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs shadow-xs">
          <span className="font-semibold text-[#52525b] flex items-center gap-1.5">
            <GraduationCap className="w-4 h-4 text-[#8B151A]" />
            Seleccionar asignatura para visualizar análisis en gráfico:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {resumenes.map((r) => (
              <button
                key={r.materia.id}
                onClick={() => setMateriaActivaId(r.materia.id)}
                className={`px-3 py-1.5 rounded text-xs font-semibold transition cursor-pointer ${
                  materiaActivaId === r.materia.id
                    ? 'bg-[#8B151A] text-white shadow-xs'
                    : 'bg-[#f4f4f5] text-[#52525b] hover:bg-[#e4e4e7]'
                }`}
              >
                {r.materia.codigo} ({r.materia.nombre})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Gráfico Interactivo de Rendimiento en 4 Rangos (T-13.1 / T-13.2 / CA-07.1) */}
      <RendimientoBarChart
        estudiantes={estudiantesParaGrafico}
        materiaNombre={
          resumenSeleccionado
            ? `${resumenSeleccionado.materia.codigo} - ${resumenSeleccionado.materia.nombre}`
            : 'Asignatura'
        }
        cargando={cargando}
        onSeleccionarEstudiante={(est) => {
          setEstudianteParaChat(est)
          setChatAbierto(true)
        }}
      />

      {/* Tabla Resumen de Asignaturas */}
      <div className="bg-white rounded-md border border-[#e4e4e7] overflow-hidden shadow-xs">
        <div className="p-4 border-b border-[#e4e4e7] flex items-center justify-between">
          <h2 className="font-bold text-sm text-[#18181b]">Resumen por Asignatura</h2>
          <button
            onClick={() => setChatAbierto(true)}
            className="text-xs font-semibold text-[#8B151A] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <MessageSquareCode className="w-3.5 h-3.5" />
            Preguntar al Asistente IA sobre estas notas →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f4f4f5] text-[#52525b] border-b border-[#e4e4e7]">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Asignatura</th>
                <th className="py-2.5 px-4 font-semibold">Código</th>
                <th className="py-2.5 px-4 font-semibold">Período</th>
                <th className="py-2.5 px-4 font-semibold text-center">Estudiantes</th>
                <th className="py-2.5 px-4 font-semibold text-right">Promedio</th>
                <th className="py-2.5 px-4 font-semibold text-center">En Riesgo</th>
                <th className="py-2.5 px-4 font-semibold text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e4e4e7]">
              {cargando ? (
                <tr>
                  <td colSpan={7} className="py-6 px-4 text-center text-[#71717a]">
                    Cargando asignaturas...
                  </td>
                </tr>
              ) : resumenes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 px-4 text-center text-[#71717a]">
                    No existen asignaturas registradas.
                  </td>
                </tr>
              ) : (
                resumenes.map(({ materia, totalEstudiantes, promedio, enRiesgo }) => (
                  <tr key={materia.id} className="hover:bg-[#fafafa] transition">
                    <td className="py-3 px-4 font-medium text-[#18181b]">{materia.nombre}</td>
                    <td className="py-3 px-4 text-[#52525b]">{materia.codigo}</td>
                    <td className="py-3 px-4 text-[#52525b]">{materia.semestre}</td>
                    <td className="py-3 px-4 text-center font-medium">{totalEstudiantes}</td>
                    <td className="py-3 px-4 text-right font-bold text-[#18181b]">
                      {promedio.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                          enRiesgo > 0
                            ? 'bg-red-100 text-red-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {enRiesgo} estudiante(s)
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <Link
                          to={`/evaluaciones?materia=${materia.id}`}
                          className="text-xs font-semibold text-[#8B151A] hover:underline"
                        >
                          Evaluaciones →
                        </Link>
                        {enRiesgo > 0 && (
                          <Link
                            to={`/tutoria?materia=${materia.id}`}
                            className="text-xs font-semibold text-[#52525b] hover:text-[#18181b] hover:underline"
                          >
                            Tutoría IA →
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Widget Flotante del Asistente Conversacional de IA (T-13.3 / CA-07.2 / CA-07.3 / CA-07.6) */}
      <ChatIaWidget
        materias={materiasOriginales}
        materiaSeleccionadaId={materiaActivaId || undefined}
        estudiantes={estudiantesParaGrafico}
        estudiantePreseleccionado={estudianteParaChat}
        abiertoExterno={chatAbierto}
        onCerrar={() => setChatAbierto(false)}
      />
    </div>
  )
}

export default DashboardPage
