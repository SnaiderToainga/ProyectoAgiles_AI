import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useChatIa } from '../context/ChatIaContext'
import clienteAxios from '../api/clienteAxios'
import { RendimientoBarChart } from '../components/RendimientoBarChart'
import { AvatarEstudiante } from '../components/AvatarEstudiante'
import {
  Sparkles,
  BookOpen,
  AlertTriangle,
  Award,
  ArrowRight,
  Users,
  MessageSquareCode,
} from 'lucide-react'
import type { MateriaDto, ResumenAcademicoEstudianteDto } from '../types/academico'
import { PrimeraSincronizacionMoodle } from '../components/PrimeraSincronizacionMoodle'

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
  const {
    abierto: chatAbierto,
    setAbierto: setChatAbierto,
    toggleChat,
    actualizarContextoChat,
    abrirChatConEstudiante,
  } = useChatIa()
  const [resumenes, setResumenes] = useState<ResumenMateria[]>([])
  const [materiasOriginales, setMateriasOriginales] = useState<MateriaDto[]>([])
  const [materiaActivaId, setMateriaActivaId] = useState<number | null>(null)
  const [tabPrioridad, setTabPrioridad] = useState<'riesgo' | 'temas'>('riesgo')
  const [cargando, setCargando] = useState(true)
  const [esModoFallback, setEsModoFallback] = useState(false)
  // Docente recién creado: aún no tiene materias importadas desde Moodle.
  const [sinMaterias, setSinMaterias] = useState(false)

  useEffect(() => {
    let vigente = true

    async function cargarDashboard() {
      try {
        const { data: materias } = await clienteAxios.get<MateriaDto[]>('/academico/materias')
        if (vigente) setMateriasOriginales(materias)
        if (materias.length === 0) {
          // Sin materias no se muestran datos de demostración: se ofrece la primera sincronización.
          if (vigente) {
            setResumenes([])
            setEsModoFallback(false)
            setSinMaterias(true)
          }
          return
        }

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

  useEffect(() => {
    if (cargando) return
    const mapaRendimientos: Record<number, ResumenAcademicoEstudianteDto[]> = {}
    for (const r of resumenes) {
      mapaRendimientos[r.materia.id] = r.estudiantes
    }
    actualizarContextoChat({
      materias: materiasOriginales,
      materiaId: materiaActivaId,
      estudiantes: estudiantesParaGrafico,
      rendimientosPorMateria: mapaRendimientos,
      esModoFallback,
    })
  }, [
    cargando,
    resumenes,
    materiasOriginales,
    materiaActivaId,
    estudiantesParaGrafico,
    esModoFallback,
    actualizarContextoChat,
  ])

  const estudiantesEnRiesgoLista = useMemo(
    () =>
      [...estudiantesParaGrafico]
        .filter((e) => e.enRiesgo || e.notaFinalParcial < 7.0)
        .sort((a, b) => a.notaFinalParcial - b.notaFinalParcial),
    [estudiantesParaGrafico]
  )

  const temasCriticosLista = useMemo(() => {
    const mapa = new Map<string, { nombre: string; cantidad: number; peorNota: number }>()
    for (const est of estudiantesParaGrafico) {
      for (const t of est.temasDeficientes) {
        const nota = t.notaObtenida ?? est.notaFinalParcial
        const prev = mapa.get(t.nombreTema)
        if (prev) {
          prev.cantidad += 1
          if (nota < prev.peorNota) prev.peorNota = nota
        } else {
          mapa.set(t.nombreTema, { nombre: t.nombreTema, cantidad: 1, peorNota: nota })
        }
      }
    }
    return [...mapa.values()].sort((a, b) => b.cantidad - a.cantidad || a.peorNota - b.peorNota)
  }, [estudiantesParaGrafico])

  if (!cargando && sinMaterias) {
    return (
      <div className="space-y-5 min-w-0">
        <div className="bg-white border border-[#e4e4e7] border-l-4 border-l-[#8B151A] rounded-lg p-4 sm:p-5 shadow-xs">
          <h1 className="text-lg font-bold text-[#18181b]">Bienvenido, {user?.nombreCompleto || 'Docente'}</h1>
          <p className="text-xs text-[#52525b] mt-0.5">
            Período Académico: Octubre 2026 - Febrero 2027 | Ingeniería en Software (FISEI UTA)
          </p>
        </div>
        <PrimeraSincronizacionMoodle />
      </div>
    )
  }

  return (
    <div className="space-y-5 min-w-0">
      <div className="space-y-5 min-w-0">
        {/* Encabezado Docente */}
        <div className="bg-white border border-[#e4e4e7] border-l-4 border-l-[#8B151A] rounded-lg p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xs">
          <div>
            <h1 className="text-lg font-bold text-[#18181b]">
              Bienvenido, {user?.nombreCompleto || 'Docente'}
            </h1>
            <p className="text-xs text-[#52525b] mt-0.5">
              Período Académico: Octubre 2026 - Febrero 2027 | Ingeniería en Software (FISEI UTA)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/catalogo"
              className="px-3 py-1.5 border border-[#e4e4e7] hover:border-[#8B151A] text-[#18181b] hover:text-[#8B151A] rounded text-xs font-semibold transition"
            >
              Catálogo Curricular
            </Link>
            <Link
              to="/evaluaciones"
              className="px-3.5 py-1.5 bg-[#8B151A] hover:bg-[#6E1014] text-white rounded text-xs font-semibold transition"
            >
              Evaluaciones
            </Link>
            <Link
              to="/tutoria"
              className="px-3 py-1.5 border border-[#e4e4e7] hover:bg-[#f4f4f5] text-[#18181b] rounded text-xs font-semibold transition"
            >
              Tutoría IA
            </Link>
            <button
              type="button"
              onClick={() => {
                if (esModoFallback) return
                toggleChat()
              }}
              disabled={esModoFallback}
              className={`px-3.5 py-1.5 rounded text-xs font-semibold shadow-sm transition flex items-center gap-1.5 ${
                esModoFallback
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : chatAbierto
                  ? 'bg-[#18181b] text-white cursor-pointer'
                  : 'bg-gradient-to-r from-[#8B151A] to-[#6E1014] text-white hover:shadow cursor-pointer'
              }`}
              title={
                esModoFallback
                  ? 'Asistente IA deshabilitado con datos demostrativos'
                  : chatAbierto
                  ? 'Ocultar panel de Asistente IA'
                  : 'Abrir Asistente Tutor IA'
              }
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              {chatAbierto && !esModoFallback ? 'Ocultar IA' : 'Asistente Tutor IA'}
            </button>
          </div>
        </div>

        {esModoFallback && (
          <div
            role="status"
            className="p-3 bg-amber-50 border-l-4 border-amber-500 rounded text-xs text-amber-800 flex items-center justify-between"
          >
            <span>
              <b>Datos demostrativos cargados:</b> Mostrando las calificaciones de las 2 asignaturas piloto (12 estudiantes). Inicia el backend (.NET en puerto :5000) para sincronización directa con Moodle.
            </span>
            <span className="text-[11px] font-semibold text-amber-900 bg-amber-100 px-2 py-0.5 rounded shrink-0 ml-2">
              Piloto UTA Activo
            </span>
          </div>
        )}

        {/* KPIs Globales Compactos */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg p-4 border border-[#e4e4e7] shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-[#52525b]">Total Estudiantes Evaluados</p>
              <p className="text-2xl font-bold text-[#18181b] mt-0.5">
                {cargando ? '...' : kpis.totalEstudiantes}
              </p>
              <p className="text-[11px] text-[#71717a] mt-0.5">
                {resumenes.length} asignatura(s) activas
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-[#f4f4f5] text-[#52525b]">
              <Users className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 border border-[#e4e4e7] shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-[#52525b]">Promedio Ponderado General</p>
              <p className="text-2xl font-bold text-[#18181b] mt-0.5">
                {cargando ? '...' : kpis.promedioGeneral}{' '}
                <span className="text-xs font-normal text-[#71717a]">/ 10.00</span>
              </p>
              <p className="text-[11px] text-[#71717a] mt-0.5">Modelo 30% Tareas · 30% APE · 40% Examen</p>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-700">
              <Award className="w-5 h-5" />
            </div>
          </div>

          <div
            className={`bg-white rounded-lg p-4 border shadow-xs flex items-center justify-between ${
              kpis.totalEnRiesgo > 0 ? 'border-red-300 bg-red-50/20' : 'border-[#e4e4e7]'
            }`}
          >
            <div>
              <p className="text-[11px] font-semibold text-[#8B151A]">En Riesgo Académico (&lt; 7.00)</p>
              <p className="text-2xl font-bold text-[#8B151A] mt-0.5">
                {cargando ? '...' : kpis.totalEnRiesgo}
              </p>
              {kpis.totalEnRiesgo > 0 ? (
                <Link
                  to="/tutoria"
                  className="inline-flex items-center gap-1 mt-0.5 text-[11px] font-semibold text-[#8B151A] hover:underline"
                >
                  Gestionar planes IA <ArrowRight className="w-3 h-3" />
                </Link>
              ) : (
                <p className="text-[11px] text-[#71717a] mt-0.5">Sin alertas activas</p>
              )}
            </div>
            <div className="p-2.5 rounded-lg bg-red-100 text-[#8B151A]">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Fila Superior estilo "Active Courses": Selección rápida de Asignatura Activa */}
        {resumenes.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#52525b]">
                Asignaturas Activas (Selecciona para analizar)
              </h2>
              <Link to="/evaluaciones" className="text-xs font-semibold text-[#8B151A] hover:underline">
                Ver evaluaciones →
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {resumenes.map((r) => {
                const activa = r.materia.id === resumenSeleccionado?.materia.id
                const aprobados = Math.max(0, r.totalEstudiantes - r.enRiesgo)
                const tasaPct =
                  r.totalEstudiantes > 0 ? Math.round((aprobados / r.totalEstudiantes) * 100) : 0
                return (
                  <button
                    key={r.materia.id}
                    type="button"
                    onClick={() => setMateriaActivaId(r.materia.id)}
                    className={`text-left bg-white rounded-lg p-4 border transition cursor-pointer shadow-xs space-y-3 ${
                      activa
                        ? 'border-[#8B151A] ring-1 ring-[#8B151A]/30'
                        : 'border-[#e4e4e7] hover:border-[#a1a1aa]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`p-2 rounded-md shrink-0 ${
                            activa ? 'bg-[#8B151A] text-white' : 'bg-[#f4f4f5] text-[#52525b]'
                          }`}
                        >
                          <BookOpen className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-[#18181b] truncate">
                            {r.materia.nombre}
                          </h3>
                          <p className="text-[11px] text-[#71717a]">
                            {r.materia.codigo} · {r.totalEstudiantes} estudiante(s)
                          </p>
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[#f4f4f5] border border-[#e4e4e7] text-[#18181b] shrink-0">
                        Prom: {r.promedio.toFixed(2)}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#52525b]">Tasa de aprobación</span>
                        <span className="font-bold text-[#18181b]">
                          {tasaPct}% ({r.enRiesgo} en riesgo)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-[#f4f4f5] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            tasaPct >= 75 ? 'bg-emerald-600' : tasaPct >= 50 ? 'bg-blue-600' : 'bg-amber-500'
                          }`}
                          style={{ width: `${tasaPct}%` }}
                        />
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Fila Central 2 Columnas: Gráficos de Rendimiento + Lista Prioritaria (estilo Uxera) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-7">
            <RendimientoBarChart
              estudiantes={estudiantesParaGrafico}
              materiaNombre={
                resumenSeleccionado
                  ? `${resumenSeleccionado.materia.codigo} - ${resumenSeleccionado.materia.nombre}`
                  : 'Asignatura'
              }
              cargando={cargando}
              onSeleccionarEstudiante={(est) => {
                abrirChatConEstudiante(est, resumenSeleccionado?.materia.id)
              }}
            />
          </div>

          {/* Tarjeta "Seguimiento Prioritario" con pestañas En Riesgo / Temas Críticos */}
          <div className="lg:col-span-5 bg-white rounded-lg border border-[#e4e4e7] overflow-hidden shadow-xs">
            <div className="p-4 border-b border-[#e4e4e7] space-y-2.5">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-sm text-[#18181b]">Seguimiento Prioritario</h2>
                <span className="text-[11px] font-semibold text-[#8B151A]">
                  {resumenSeleccionado?.materia.codigo || 'Curso'}
                </span>
              </div>

              <div className="grid grid-cols-2 bg-[#f4f4f5] p-0.5 rounded-md text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setTabPrioridad('riesgo')}
                  className={`py-1 rounded transition cursor-pointer ${
                    tabPrioridad === 'riesgo'
                      ? 'bg-white text-[#8B151A] shadow-xs'
                      : 'text-[#71717a] hover:text-[#18181b]'
                  }`}
                >
                  En Riesgo ({estudiantesEnRiesgoLista.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTabPrioridad('temas')}
                  className={`py-1 rounded transition cursor-pointer ${
                    tabPrioridad === 'temas'
                      ? 'bg-white text-[#8B151A] shadow-xs'
                      : 'text-[#71717a] hover:text-[#18181b]'
                  }`}
                >
                  Temas Críticos ({temasCriticosLista.length})
                </button>
              </div>
            </div>

            <div className="divide-y divide-[#e4e4e7] max-h-[410px] overflow-y-auto">
              {tabPrioridad === 'riesgo' ? (
                estudiantesEnRiesgoLista.length === 0 ? (
                  <p className="p-6 text-center text-xs text-[#71717a]">
                    No hay estudiantes por debajo de 7.00 en esta asignatura.
                  </p>
                ) : (
                  estudiantesEnRiesgoLista.map((est) => (
                    <div key={est.estudianteId} className="p-3.5 hover:bg-[#fafafa] transition space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <AvatarEstudiante
                            nombres={est.nombres}
                            apellidos={est.apellidos}
                            fotoUrl={est.fotoUrl}
                            enRiesgo={true}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[#18181b] truncate">
                              {est.apellidos} {est.nombres}
                            </p>
                            <p className="text-[10px] text-[#71717a] truncate">
                              {est.temasDeficientes.length > 0
                                ? est.temasDeficientes.map((t) => t.nombreTema).join(', ')
                                : 'Sin temas vinculados'}
                            </p>
                          </div>
                        </div>
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-red-100 text-red-800 shrink-0">
                          {est.notaFinalParcial.toFixed(2)}
                        </span>
                      </div>

                      <div className="flex items-center justify-end gap-3 text-[11px] font-semibold">
                        <button
                          type="button"
                          onClick={() => {
                            abrirChatConEstudiante(est, resumenSeleccionado?.materia.id)
                          }}
                          disabled={esModoFallback}
                          className="text-[#52525b] hover:text-[#18181b] cursor-pointer disabled:opacity-50"
                        >
                          Consultar IA
                        </button>
                        <Link
                          to={`/tutoria?materia=${resumenSeleccionado?.materia.id || 1}&estudiante=${est.estudianteId}`}
                          className="text-[#8B151A] hover:underline"
                        >
                          Plan Tutoría →
                        </Link>
                      </div>
                    </div>
                  ))
                )
              ) : temasCriticosLista.length === 0 ? (
                <p className="p-6 text-center text-xs text-[#71717a]">
                  Sin temas con notas deficientes registradas.
                </p>
              ) : (
                temasCriticosLista.map((tema) => (
                  <div key={tema.nombre} className="p-3.5 flex items-center justify-between gap-3 hover:bg-[#fafafa]">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#18181b] truncate">{tema.nombre}</p>
                      <p className="text-[10px] text-[#71717a]">
                        Menor nota observada: <strong className="text-red-700">{tema.peorNota.toFixed(2)}</strong>
                      </p>
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 shrink-0">
                      {tema.cantidad} alumno(s)
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Tabla Inferior estilo "My Courses List": Avatares apilados, barra segmentada y promedio */}
        <div className="bg-white rounded-lg border border-[#e4e4e7] overflow-hidden shadow-xs">
          <div className="p-4 border-b border-[#e4e4e7] flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold text-sm text-[#18181b]">Resumen por Asignatura</h2>
            <button
              type="button"
              onClick={() => setChatAbierto(true)}
              disabled={esModoFallback}
              className="text-xs font-semibold text-[#8B151A] hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
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
                  <th className="py-2.5 px-4 font-semibold">Participantes</th>
                  <th className="py-2.5 px-4 font-semibold">Aprobación</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Promedio</th>
                  <th className="py-2.5 px-4 font-semibold text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e4e4e7]">
                {cargando ? (
                  <tr>
                    <td colSpan={5} className="py-6 px-4 text-center text-[#71717a]">
                      Cargando asignaturas...
                    </td>
                  </tr>
                ) : resumenes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 px-4 text-center text-[#71717a]">
                      No existen asignaturas registradas.
                    </td>
                  </tr>
                ) : (
                  resumenes.map(({ materia, totalEstudiantes, promedio, enRiesgo, estudiantes }) => {
                    const aprobados = Math.max(0, totalEstudiantes - enRiesgo)
                    const pctAprob =
                      totalEstudiantes > 0 ? Math.round((aprobados / totalEstudiantes) * 100) : 0
                    const bloquesLlenos = Math.round(pctAprob / 10)
                    const inicialesMat = materia.codigo.slice(0, 3).toUpperCase()

                    return (
                      <tr key={materia.id} className="hover:bg-[#fafafa] transition">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <span className="w-8 h-8 rounded-md bg-[#8B151A]/10 text-[#8B151A] font-bold text-[10px] flex items-center justify-center shrink-0">
                              {inicialesMat}
                            </span>
                            <div>
                              <p className="font-semibold text-[#18181b]">{materia.nombre}</p>
                              <p className="text-[11px] text-[#71717a]">
                                {materia.codigo} · {materia.semestre}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center -space-x-2">
                            {estudiantes.slice(0, 4).map((est) => (
                              <div key={est.estudianteId} className="ring-2 ring-white rounded-full">
                                <AvatarEstudiante
                                  nombres={est.nombres}
                                  apellidos={est.apellidos}
                                  fotoUrl={est.fotoUrl}
                                  size="sm"
                                />
                              </div>
                            ))}
                            {totalEstudiantes > 4 && (
                              <span className="w-8 h-8 rounded-full bg-[#f4f4f5] border border-[#e4e4e7] text-[10px] font-bold text-[#52525b] flex items-center justify-center ring-2 ring-white">
                                +{totalEstudiantes - 4}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="flex gap-0.5" aria-label={`Aprobación ${pctAprob}%`}>
                              {Array.from({ length: 10 }).map((_, idx) => (
                                <span
                                  key={idx}
                                  className={`w-1.5 h-3.5 rounded-xs ${
                                    idx < bloquesLlenos ? 'bg-[#8B151A]' : 'bg-[#e4e4e7]'
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="font-semibold text-[#18181b]">{pctAprob}%</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-[#18181b]">
                          {promedio.toFixed(2)} / 10
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
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage
