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
  ultimaSincronizacion?: string | null
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
  /** 0 sin dato, 1 entregado (con nota), 2 sin entrega, 3 pendiente de calificar, 4 por entregar. */
  estado?: number
}

export interface ComponentePonderadoDto {
  tipo: TipoItemEvaluacion
  ponderacion: number
  promedioComponente: number
  aporteFinal: number
  esDeficiente: boolean
  evaluaciones: EvaluacionDetalleDto[]
  /** false si no hay actividades evaluadas en este componente (no cuenta como 0). */
  evaluado?: boolean
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
  fotoUrl?: string | null
  /** Sin ninguna actividad evaluada: la nota no es 0 ni implica riesgo. */
  sinEvaluaciones?: boolean
  /** Calculada solo con parte de la ponderación 30/30/40. */
  calculoProvisional?: boolean
  ponderacionEvaluada?: number
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

export interface ActualizarDetallePlanRequest {
  id: number
  actividadSugerida: string
  prioridad: string
  tiempoEstimadoHoras: number
  recursoRecomendado: string
}

export interface ActualizarPlanRefuerzoRequest {
  diagnosticoGeneral: string
  nivelRiesgo?: string
  detalles?: ActualizarDetallePlanRequest[]
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

export interface MembreteInstitucionalDto {
  universidad: string
  facultad: string
  carrera: string
  sistema: string
  tituloReporte: string
  materiaCodigo: string
  materiaNombre: string
  periodoLectivo: string
  parcialId: number
  parcialNumero: number
  docenteTitular: string
  docenteCorreo: string
  fechaEmisionUtc: string
  ultimaSincronizacionUtc?: string | null
}

export interface FirmaDocenteDto {
  nombreDocente: string
  correoDocente: string
  cargo: string
  etiquetaCasillero: string
  leyendaConformidad: string
  lineaFirma: string
}

export interface PiePaginaReporteDto {
  textoInstitucional: string
  plantillaNumeracion: string
  numeracionInicial: string
  totalPaginasEstimadas: number
  registrosPorPagina: number
  paginas: string[]
  codigoDocumento: string
  fechaEmisionUtc: string
}

export interface ResumenEstadisticoReporteDto {
  totalEstudiantes: number
  totalAprobados: number
  totalEnRiesgo: number
  porcentajeAprobados: number
  porcentajeEnRiesgo: number
  promedioGeneralCurso: number
  promedioTareasCurso: number
  aporteTareasCurso: number
  promedioApeCurso: number
  aporteApeCurso: number
  promedioExamenCurso: number
  aporteExamenCurso: number
  umbralAprobacion: number
}

export interface FilaMatrizConsolidadaDto {
  numeroOrden: number
  estudianteId: number
  nombres: string
  apellidos: string
  nombreCompleto: string
  correo: string
  fotoUrl?: string | null
  promedioTareas: number
  aporteTareas: number
  promedioApe: number
  aporteApe: number
  promedioExamen: number
  aporteExamen: number
  notaFinalParcial: number
  enRiesgo: boolean
  estadoAcademico: string
  componentes: ComponentePonderadoDto[]
  temasDeficientes: TemaCriticoDto[]
  planRefuerzoVigente: PlanRefuerzoDto | null
  sinEvaluaciones?: boolean
  calculoProvisional?: boolean
}

export interface ReporteConsolidadoCursoDto {
  cursoId: number
  parcialId: number
  parcialNumero: number
  membrete: MembreteInstitucionalDto
  resumenEstadistico: ResumenEstadisticoReporteDto
  estudiantes: FilaMatrizConsolidadaDto[]
  bloqueFirma: FirmaDocenteDto
  piePagina: PiePaginaReporteDto
}

export interface ReporteIndividualTutoriaDto {
  cursoId: number
  parcialId: number
  parcialNumero: number
  membrete: MembreteInstitucionalDto
  estudiante: FilaMatrizConsolidadaDto
  causaPrincipalRendimiento: string
  planRefuerzo: PlanRefuerzoDto | null
  bloqueFirma: FirmaDocenteDto
  piePagina: PiePaginaReporteDto
}

export interface EstadoMoodleDto {
  enLinea: boolean
  baseUrl: string
  tokenConfigurado: boolean
  sitio: string | null
  version: string | null
  cuentaServicio: string | null
  codigoError: string | null
  error: string | null
  cursosVinculados: number
  docentesVinculados: number
  ultimaSincronizacionExitosa: string | null
  consultadoEn: string
}

export interface LogSincronizacionDto {
  id: number
  fecha: string
  operacion: string
  estado: string
  exitoso: boolean
  totalRegistros: number
  curso: string | null
  docente: string | null
  mensajeError: string | null
}

export interface PasoTrazaAgenteDto {
  herramienta: string
  parametros: string | null
  resultado: string | null
  exito: boolean
  error: string | null
  duracionMs: number
}

export interface TrazaAgenteDto {
  id: number
  fecha: string
  usuarioId: number
  usuario: string | null
  curso: string | null
  modo: string
  consulta: string
  modelo: string | null
  esFallback: boolean
  exitoso: boolean
  error: string | null
  duracionMs: number
  pasos: PasoTrazaAgenteDto[]
}

export interface ConfiguracionAlertasDto {
  rendimientoActivo: boolean
  rendimientoUmbral: number
  descensoActivo: boolean
  descensoUltimas: number
  descensoPuntos: number
  atrasosActivo: boolean
  atrasosMinimo: number
  finalizacionActivo: boolean
  finalizacionMinimaPct: number
}

export interface IndicadoresProgresoDto {
  totalActividades: number
  calificadas: number
  sinEntrega: number
  pendientesCalificar: number
  pendientesEntrega: number
  sinDato: number
  completadas: number
  exigibles: number
  porcentajeFinalizacion: number | null
}

export interface AlertaAcademicaDto {
  regla: 'rendimiento' | 'descenso' | 'atrasos' | 'finalizacion' | string
  titulo: string
  evidencia: string
  actividades: string[]
}

export interface AlertasEstudianteDto {
  estudianteId: number
  nombres: string
  apellidos: string
  notaFinalParcial: number
  sinEvaluaciones: boolean
  indicadores: IndicadoresProgresoDto
  alertas: AlertaAcademicaDto[]
}

export interface AlertasCursoDto {
  cursoId: number
  parcialId: number
  configuracion: ConfiguracionAlertasDto
  configuracionPersonalizada: boolean
  progresoCurso: IndicadoresProgresoDto
  estudiantesConAlertas: number
  estudiantes: AlertasEstudianteDto[]
}
