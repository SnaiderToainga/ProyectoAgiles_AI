import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import clienteAxios from '../api/clienteAxios'
import type { MateriaDto, ResumenAcademicoEstudianteDto } from '../types/academico'

const STORAGE_KEY_ABIERTO = 'edumonitor_chat_abierto_v1'

interface DatosContextoChat {
  materias?: MateriaDto[]
  materiaId?: number | null
  estudiantes?: ResumenAcademicoEstudianteDto[]
  rendimientosPorMateria?: Record<number, ResumenAcademicoEstudianteDto[]>
  esModoFallback?: boolean
}

interface ChatIaContextType {
  abierto: boolean
  setAbierto: (valor: boolean) => void
  toggleChat: () => void
  materias: MateriaDto[]
  materiaActivaId: number | null
  estudiantes: ResumenAcademicoEstudianteDto[]
  rendimientosPorMateria: Record<number, ResumenAcademicoEstudianteDto[]>
  estudiantePreseleccionado: ResumenAcademicoEstudianteDto | null
  esModoFallback: boolean
  actualizarContextoChat: (datos: DatosContextoChat) => void
  abrirChatConEstudiante: (est: ResumenAcademicoEstudianteDto, materiaId?: number) => void
  cambiarMateriaEnChat: (materiaId: number) => void
  limpiarPreseleccion: () => void
}

const ChatIaContext = createContext<ChatIaContextType | undefined>(undefined)

export function ChatIaProvider({ children }: { children: ReactNode }) {
  const [abierto, setAbiertoState] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEY_ABIERTO) === '1'
    } catch {
      return false
    }
  })
  const [materias, setMaterias] = useState<MateriaDto[]>([])
  const [materiaActivaId, setMateriaActivaId] = useState<number | null>(null)
  const [estudiantes, setEstudiantes] = useState<ResumenAcademicoEstudianteDto[]>([])
  const [rendimientosPorMateria, setRendimientosPorMateria] = useState<
    Record<number, ResumenAcademicoEstudianteDto[]>
  >({})
  const [estudiantePreseleccionado, setEstudiantePreseleccionado] =
    useState<ResumenAcademicoEstudianteDto | null>(null)
  const [esModoFallback, setEsModoFallback] = useState(false)

  const setAbierto = useCallback((valor: boolean) => {
    setAbiertoState(valor)
    try {
      sessionStorage.setItem(STORAGE_KEY_ABIERTO, valor ? '1' : '0')
    } catch {
      // Ignorar si sessionStorage no está disponible
    }
  }, [])

  const toggleChat = useCallback(() => {
    setAbiertoState((prev) => {
      const next = !prev
      try {
        sessionStorage.setItem(STORAGE_KEY_ABIERTO, next ? '1' : '0')
      } catch {
        // Ignorar
      }
      return next
    })
  }, [])

  const actualizarContextoChat = useCallback((datos: DatosContextoChat) => {
    if (datos.materias !== undefined) setMaterias(datos.materias)
    if (datos.materiaId !== undefined) setMateriaActivaId(datos.materiaId)
    if (datos.estudiantes !== undefined) setEstudiantes(datos.estudiantes)
    if (datos.rendimientosPorMateria !== undefined) {
      setRendimientosPorMateria((prev) => ({ ...prev, ...datos.rendimientosPorMateria }))
    } else if (datos.materiaId && datos.estudiantes && datos.estudiantes.length > 0) {
      const mId = datos.materiaId
      const ests = datos.estudiantes
      setRendimientosPorMateria((prev) => ({ ...prev, [mId]: ests }))
    }
    if (datos.esModoFallback !== undefined) setEsModoFallback(datos.esModoFallback)
  }, [])

  const abrirChatConEstudiante = useCallback(
    (est: ResumenAcademicoEstudianteDto, materiaId?: number) => {
      if (materiaId !== undefined) {
        setMateriaActivaId(materiaId)
      }
      setEstudiantePreseleccionado(est)
      setAbierto(true)
    },
    [setAbierto]
  )

  const limpiarPreseleccion = useCallback(() => {
    setEstudiantePreseleccionado(null)
  }, [])

  const cambiarMateriaEnChat = useCallback(
    async (nuevoMateriaId: number) => {
      setMateriaActivaId(nuevoMateriaId)
      const mat = materias.find((m) => m.id === nuevoMateriaId)
      const parcial = mat?.parciales.find((p) => p.numero === 1) || mat?.parciales[0]
      if (!mat || !parcial) return
      try {
        const { data: listaEst } = await clienteAxios.get<ResumenAcademicoEstudianteDto[]>(
          `/academico/materias/${mat.id}/parciales/${parcial.id}/rendimiento`
        )
        setEstudiantes(listaEst)
      } catch {
        // Ignorar si falla en modo demo
      }
    },
    [materias]
  )

  // Precarga en segundo plano las materias y el rendimiento del primer parcial si aún faltan,
  // para que la IA deduzca cualquier asignatura mencionada aunque el usuario no esté en ella.
  useEffect(() => {
    let vigente = true

    async function precargarContexto() {
      try {
        let listaMaterias = materias
        if (listaMaterias.length === 0) {
          const { data } = await clienteAxios.get<MateriaDto[]>('/academico/materias')
          if (!vigente || data.length === 0) return
          listaMaterias = data
          setMaterias(data)
          setMateriaActivaId((prev) => prev ?? data[0].id)
        }

        const faltantes = listaMaterias.filter((m) => !rendimientosPorMateria[m.id])
        if (faltantes.length === 0) return

        const pares = await Promise.all(
          faltantes.map(async (m) => {
            const parcial = m.parciales.find((p) => p.numero === 1) || m.parciales[0]
            if (!parcial) return [m.id, []] as const
            try {
              const { data } = await clienteAxios.get<ResumenAcademicoEstudianteDto[]>(
                `/academico/materias/${m.id}/parciales/${parcial.id}/rendimiento`
              )
              return [m.id, data] as const
            } catch {
              return [m.id, []] as const
            }
          })
        )
        if (!vigente) return
        setRendimientosPorMateria((prev) => {
          const next = { ...prev }
          for (const [id, lista] of pares) {
            if (lista.length > 0 || !next[id]) next[id] = [...lista]
          }
          return next
        })
        const primera = listaMaterias[0]
        const listaPrimera = pares.find(([id]) => id === primera.id)?.[1]
        if (listaPrimera && listaPrimera.length > 0) {
          setEstudiantes((prev) => (prev.length > 0 ? prev : [...listaPrimera]))
        }
      } catch {
        // Ignorar; las páginas académicas manejarán sus propios avisos
      }
    }

    precargarContexto()
    return () => {
      vigente = false
    }
  }, [materias, rendimientosPorMateria])

  return (
    <ChatIaContext.Provider
      value={{
        abierto,
        setAbierto,
        toggleChat,
        materias,
        materiaActivaId,
        estudiantes,
        rendimientosPorMateria,
        estudiantePreseleccionado,
        esModoFallback,
        actualizarContextoChat,
        abrirChatConEstudiante,
        cambiarMateriaEnChat,
        limpiarPreseleccion,
      }}
    >
      {children}
    </ChatIaContext.Provider>
  )
}

export function useChatIa() {
  const ctx = useContext(ChatIaContext)
  if (!ctx) {
    throw new Error('useChatIa debe usarse dentro de un ChatIaProvider')
  }
  return ctx
}
