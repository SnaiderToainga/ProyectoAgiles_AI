import type { ResumenAcademicoEstudianteDto } from '../types/academico'

/** Estados de una calificación, iguales al enum EstadoCalificacion del backend (RF-06). */
export const ESTADO_CALIFICACION = {
  NoDeterminado: 0,
  Entregado: 1,
  SinEntrega: 2,
  PendienteCalificar: 3,
  PendienteEntrega: 4,
} as const

export type EstadoCalificacion = (typeof ESTADO_CALIFICACION)[keyof typeof ESTADO_CALIFICACION]

/** Una entrega vencida sin presentar cuenta como 0; el resto de notas vacías son datos ausentes. */
export function cuentaComoCero(nota: number | null, estado?: EstadoCalificacion | number | null): boolean {
  return nota === null && estado === ESTADO_CALIFICACION.SinEntrega
}

/** Valor que entra en los promedios, o null si la actividad aún no tiene dato que promediar. */
export function valorPromediable(nota: number | null, estado?: EstadoCalificacion | number | null): number | null {
  if (nota !== null) return nota
  return cuentaComoCero(nota, estado) ? 0 : null
}

/**
 * Texto de una actividad: distingue nota (incluido el 0), sin entrega, pendiente de calificar,
 * por entregar y sin dato, en lugar de mostrar «Sin nota» para todo.
 */
export function textoCalificacion(nota: number | null, estado?: EstadoCalificacion | number | null, sufijo = ''): string {
  if (nota !== null) return `${nota.toFixed(2)}${sufijo}`
  switch (estado) {
    case ESTADO_CALIFICACION.SinEntrega:
      return 'Sin entrega'
    case ESTADO_CALIFICACION.PendienteCalificar:
      return 'Pendiente de calificar'
    case ESTADO_CALIFICACION.PendienteEntrega:
      return 'Por entregar'
    default:
      return 'Sin dato'
  }
}

/** Indica si el estudiante tiene al menos una actividad evaluada (si no, su nota no es 0 ni riesgo). */
export function estaEvaluado(estudiante: Pick<ResumenAcademicoEstudianteDto, 'sinEvaluaciones'>): boolean {
  return !estudiante.sinEvaluaciones
}

/** Texto de la nota final del parcial, marcando las provisionales y las que aún no tienen evaluaciones. */
export function textoNotaFinal(
  estudiante: Pick<ResumenAcademicoEstudianteDto, 'notaFinalParcial' | 'sinEvaluaciones' | 'calculoProvisional'>
): string {
  if (estudiante.sinEvaluaciones) return 'Sin evaluaciones'
  return `${estudiante.notaFinalParcial.toFixed(2)}${estudiante.calculoProvisional ? '*' : ''}`
}

export const LEYENDA_PROVISIONAL =
  '* Nota provisional: se calcula solo con los componentes (Tareas, APE, Examen) que ya tienen actividades evaluadas.'
