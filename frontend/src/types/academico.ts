export type TipoItemEvaluacion = 0 | 1 | 2 | 3

export interface TemaDto {
  id: number
  nombre: string
  descripcion: string
}

export interface UnidadDto {
  id: number
  numero: number
  nombre: string
  temas: TemaDto[]
}

export interface ParcialDto {
  id: number
  numero: number
  unidades: UnidadDto[]
}

export interface MateriaDto {
  id: number
  codigo: string
  nombre: string
  semestre: string
  parciales: ParcialDto[]
}

export interface EvaluacionDto {
  id: number
  parcialId: number | null
  nombre: string
  tipo: TipoItemEvaluacion
  ponderacion: number
  publicado: boolean
  temaIds: number[]
}

export interface TemaReferenciaDto {
  temaId: number
  nombre: string
}

export interface EvaluacionDetalleDto {
  itemEvaluacionId: number
  nombre: string
  tipo: TipoItemEvaluacion
  nota: number | null
  esDeficiente: boolean
  temas: TemaReferenciaDto[]
}

export interface ComponentePonderadoDto {
  tipo: TipoItemEvaluacion
  ponderacion: number
  promedioComponente: number
  aporteFinal: number
  esDeficiente: boolean
  evaluaciones: EvaluacionDetalleDto[]
}

export interface TemaCriticoDto {
  temaId: number
  nombreTema: string
  evaluacionOrigen: string
  notaObtenida: number | null
}

export interface ResumenAcademicoEstudianteDto {
  estudianteId: number
  nombres: string
  apellidos: string
  correo: string
  cursoId: number
  parcialId: number
  notaFinalParcial: number
  enRiesgo: boolean
  componentes: ComponentePonderadoDto[]
  temasDeficientes: TemaCriticoDto[]
}

export interface SincronizacionDto {
  logId: number
  operacion: string
  cursos: number
  estudiantes: number
  items: number
  calificaciones: number
  estadosNoDeterminados: number
  fechaUtc: string
}

export interface ComponenteDeficientePayload {
  componente: string
  promedio: number
  ponderacion: number
}

export interface TemaCriticoPayload {
  id: number
  nombre: string
  unidad: string
}

export interface SolicitudPlanIa {
  materia: string
  codigo: string
  parcial: number
  promedioPonderado: number
  componentesDeficientes: ComponenteDeficientePayload[]
  temasCriticos: TemaCriticoPayload[]
}

export interface DetallePlanIa {
  temaId: number
  actividadSugerida: string
  prioridad: 'Alta' | 'Media' | 'Baja' | string
  tiempoEstimadoHoras: number
  recursoRecomendado: string
}

export interface RespuestaPlanIa {
  nivelRiesgo: string
  diagnosticoGeneral: string
  esFallback: boolean
  detalles: DetallePlanIa[]
}

export interface DetallePlanRefuerzoDto {
  id: number
  temaId: number
  temaNombre: string
  actividadSugerida: string
  prioridad: string
  tiempoEstimadoHoras: number
  recursoRecomendado: string
}

export interface PlanRefuerzoDto {
  id: number
  estudianteId: number
  estudianteNombre: string
  cursoId: number
  diagnosticoGeneral: string
  nivelRiesgo: string
  esFallback: boolean
  fechaGeneracion: string
  detalles: DetallePlanRefuerzoDto[]
}

export interface CrearPlanRefuerzoRequest {
  estudianteId: number
  cursoId: number
  diagnosticoGeneral: string
  nivelRiesgo: string
  esFallback: boolean
  detalles: DetallePlanIa[]
}

export const NOMBRE_COMPONENTE: Record<TipoItemEvaluacion, string> = {
  0: 'Sin clasificar',
  1: 'Tareas',
  2: 'APE',
  3: 'Examen',
}

export const PONDERACION_COMPONENTE: Record<TipoItemEvaluacion, string> = {
  0: '—',
  1: '30%',
  2: '30%',
  3: '40%',
}
