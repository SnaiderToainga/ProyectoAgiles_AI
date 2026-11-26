import type {
  ComponentePonderadoDto,
  EvaluacionDetalleDto,
  EvaluacionDto,
  ParcialDto,
  ResumenAcademicoEstudianteDto,
  TipoItemEvaluacion,
} from '../types/academico'
import type { EstadoFiltroAcademico } from '../components/FiltrosCascada'
import { ESTADO_CALIFICACION, valorPromediable } from './estadoCalificacion'

export interface FilaRendimientoFiltrada {
  estudiante: ResumenAcademicoEstudianteDto
  componentesFiltrados: ComponentePonderadoDto[]
  notaFiltrada: number
  notaActividadAislada: number | null
  /** Estado de la actividad aislada (sin entrega, pendiente de calificar...), para mostrarlo en la tabla. */
  estadoActividadAislada: number | null
  /** Sin actividades evaluadas en el alcance: no se muestra 0.00 ni se marca en riesgo. */
  sinEvaluaciones: boolean
  entregoActividad: boolean
  enRiesgoFiltrado: boolean
  esCriticoFiltrado: boolean
  notaReferencia: number | null
}

export interface MetricasGrupoFiltrado {
  promTareas: string
  aporteTareas: string
  promApe: string
  aporteApe: string
  promExamen: string
  aporteExamen: string
  promedioCurso: string
  totalEnRiesgo: number
  porcentajeAprobados: string
  actividadAislada: {
    id: number
    nombre: string
    tipo: TipoItemEvaluacion
    promedioActividad: string
    entregados: number
    totalEstudiantes: number
    tasaEntregaPorcentaje: string
  } | null
}

const PESOS_COMPONENTE: Record<1 | 2 | 3, number> = {
  1: 0.3,
  2: 0.3,
  3: 0.4,
}

function redondear2(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100
}

/**
 * Filtra las actividades evaluativas siguiendo la cascada Parcial -> Unidad -> Tema -> Actividad (T-12.7 / CA-06.4).
 */
export function obtenerEvaluacionesEnAlcance(
  evaluacionesParcial: EvaluacionDto[],
  parcialActual: ParcialDto | undefined,
  unidadId: number | null,
  temaId: number | null,
  actividadId: number | null
): EvaluacionDto[] {
  let temaIdsUnidad: Set<number> | null = null
  if (unidadId !== null && parcialActual) {
    const unidad = parcialActual.unidades.find((u) => u.id === unidadId)
    temaIdsUnidad = new Set(unidad ? unidad.temas.map((t) => t.id) : [])
  }

  return evaluacionesParcial.filter((ev) => {
    if (temaIdsUnidad && !ev.temaIds.some((tid) => temaIdsUnidad.has(tid))) {
      return false
    }
    if (temaId !== null && !ev.temaIds.includes(temaId)) {
      return false
    }
    if (actividadId !== null && ev.id !== actividadId) {
      return false
    }
    return true
  })
}

/**
 * Calcula en vivo las calificaciones y promedios ponderados 30/30/40
 * según el subconjunto de actividades filtradas o la actividad aislada (T-12.7, T-12.8 / CA-06.5).
 */
export function calcularRendimientoFiltrado(
  rendimiento: ResumenAcademicoEstudianteDto[],
  evaluacionesEnAlcance: EvaluacionDto[],
  actividadId: number | null,
  hayFiltroCurricular: boolean,
  estadoFiltro: EstadoFiltroAcademico,
  busqueda: string
): FilaRendimientoFiltrada[] {
  const alcanceIds = new Set(evaluacionesEnAlcance.map((e) => e.id))
  const consulta = busqueda.trim().toLowerCase()

  return rendimiento
    .map((est): FilaRendimientoFiltrada => {
      if (!hayFiltroCurricular && actividadId === null) {
        const nota = est.notaFinalParcial
        const sinEvaluaciones = est.sinEvaluaciones === true
        return {
          estudiante: est,
          componentesFiltrados: est.componentes,
          notaFiltrada: nota,
          notaActividadAislada: null,
          estadoActividadAislada: null,
          sinEvaluaciones,
          entregoActividad: true,
          enRiesgoFiltrado: est.enRiesgo,
          esCriticoFiltrado: !sinEvaluaciones && nota < 4.0,
          notaReferencia: sinEvaluaciones ? null : nota,
        }
      }

      let detalleAislado: EvaluacionDetalleDto | undefined
      const componentesFiltrados: ComponentePonderadoDto[] = ([1, 2, 3] as const).map((tipo) => {
        const compOrig = est.componentes.find((c) => c.tipo === tipo)
        const ponderacion = compOrig?.ponderacion ?? PESOS_COMPONENTE[tipo]
        const evalsFiltradas = (compOrig?.evaluaciones ?? []).filter((ev) =>
          alcanceIds.has(ev.itemEvaluacionId)
        )

        if (actividadId !== null && !detalleAislado) {
          detalleAislado = evalsFiltradas.find((ev) => ev.itemEvaluacionId === actividadId)
        }

        // Misma regla que el backend: la entrega vencida cuenta como 0 y lo pendiente no se promedia.
        const valores = evalsFiltradas
          .map((ev) => valorPromediable(ev.nota, ev.estado))
          .filter((v): v is number => v !== null)
        const evaluado = valores.length > 0

        const promedioComponente = evaluado
          ? redondear2(valores.reduce((sum, v) => sum + v, 0) / valores.length)
          : 0
        const aporteFinal = redondear2(promedioComponente * ponderacion)

        return {
          tipo,
          ponderacion,
          promedioComponente,
          aporteFinal,
          esDeficiente: evaluado && promedioComponente < 7.0,
          evaluaciones: evalsFiltradas,
          evaluado,
        }
      })

      let notaFiltrada = est.notaFinalParcial
      let sinEvaluaciones = est.sinEvaluaciones === true
      if (hayFiltroCurricular) {
        let sumaPesosActivos = 0
        let sumaAportes = 0
        for (const comp of componentesFiltrados) {
          if (comp.evaluado) {
            sumaPesosActivos += comp.ponderacion
            sumaAportes += comp.promedioComponente * comp.ponderacion
          }
        }
        sinEvaluaciones = sumaPesosActivos === 0
        notaFiltrada = sumaPesosActivos > 0 ? redondear2(sumaAportes / sumaPesosActivos) : 0
      }

      const notaActividadAislada = actividadId !== null ? (detalleAislado?.nota ?? null) : null
      const estadoActividadAislada =
        actividadId !== null ? (detalleAislado?.estado ?? ESTADO_CALIFICACION.NoDeterminado) : null
      const valorAislado =
        actividadId !== null ? valorPromediable(notaActividadAislada, estadoActividadAislada) : null
      const entregoActividad = actividadId !== null ? notaActividadAislada !== null : true
      const notaReferencia =
        actividadId !== null ? notaActividadAislada : sinEvaluaciones ? null : notaFiltrada
      // Al aislar una actividad, solo la entrega vencida (0) o una nota < 7 implican riesgo;
      // pendiente de calificar o por entregar no son un riesgo todavía.
      const enRiesgoFiltrado =
        actividadId !== null
          ? valorAislado !== null && valorAislado < 7.0
          : !sinEvaluaciones && notaFiltrada < 7.0
      const esCriticoFiltrado =
        actividadId !== null
          ? valorAislado !== null && valorAislado < 4.0
          : !sinEvaluaciones && notaFiltrada < 4.0

      return {
        estudiante: est,
        componentesFiltrados,
        notaFiltrada,
        notaActividadAislada,
        estadoActividadAislada,
        sinEvaluaciones,
        entregoActividad,
        enRiesgoFiltrado,
        esCriticoFiltrado,
        notaReferencia,
      }
    })
    .filter((fila) => {
      if (estadoFiltro === 'riesgo' && !fila.enRiesgoFiltrado) return false
      if (estadoFiltro === 'critico' && !fila.esCriticoFiltrado) return false
      if (estadoFiltro === 'aprobado' && fila.enRiesgoFiltrado) return false
      if (consulta) {
        const texto =
          `${fila.estudiante.apellidos} ${fila.estudiante.nombres} ${fila.estudiante.correo}`.toLowerCase()
        if (!texto.includes(consulta)) return false
      }
      return true
    })
}

/**
 * Calcula métricas del grupo en vivo (promedios 30/30/40, riesgo y tasa de entrega) (T-12.8 / CA-06.5).
 */
export function calcularMetricasGrupo(
  filas: FilaRendimientoFiltrada[],
  actividadSeleccionada: EvaluacionDto | null
): MetricasGrupoFiltrado {
  if (filas.length === 0) {
    return {
      promTareas: '0.00',
      aporteTareas: '0.00',
      promApe: '0.00',
      aporteApe: '0.00',
      promExamen: '0.00',
      aporteExamen: '0.00',
      promedioCurso: '0.00',
      totalEnRiesgo: 0,
      porcentajeAprobados: '0.0',
      actividadAislada: actividadSeleccionada
        ? {
            id: actividadSeleccionada.id,
            nombre: actividadSeleccionada.nombre,
            tipo: actividadSeleccionada.tipo,
            promedioActividad: '0.00',
            entregados: 0,
            totalEstudiantes: 0,
            tasaEntregaPorcentaje: '0.0',
          }
        : null,
    }
  }

  // Los promedios del grupo solo consideran estudiantes con ese componente evaluado.
  const avgComp = (tipo: 1 | 2 | 3) => {
    const valores = filas
      .map((fila) => fila.componentesFiltrados.find((c) => c.tipo === tipo))
      .filter((comp): comp is ComponentePonderadoDto => comp !== undefined && comp.evaluado !== false)
      .map((comp) => comp.promedioComponente)
    return valores.length > 0 ? valores.reduce((a, b) => a + b, 0) / valores.length : 0
  }
  const filasEvaluadas = filas.filter((f) => !f.sinEvaluaciones)

  const promTareas = avgComp(1)
  const promApe = avgComp(2)
  const promExamen = avgComp(3)

  const totalEnRiesgo = filas.filter((f) => f.enRiesgoFiltrado).length
  const totalAprobados = filasEvaluadas.filter((f) => !f.enRiesgoFiltrado).length
  const porcentajeAprobados = ((totalAprobados / filas.length) * 100).toFixed(1)

  let actividadStats: MetricasGrupoFiltrado['actividadAislada'] = null
  let promedioCursoValor =
    filasEvaluadas.length > 0
      ? filasEvaluadas.reduce((acc, f) => acc + f.notaFiltrada, 0) / filasEvaluadas.length
      : 0

  if (actividadSeleccionada) {
    const conNota = filas.filter(
      (f): f is FilaRendimientoFiltrada & { notaActividadAislada: number } =>
        f.notaActividadAislada !== null
    )
    const promedioAct =
      conNota.length > 0
        ? conNota.reduce((acc, f) => acc + f.notaActividadAislada, 0) / conNota.length
        : 0
    const tasaEntrega = (conNota.length / filas.length) * 100
    promedioCursoValor = promedioAct

    actividadStats = {
      id: actividadSeleccionada.id,
      nombre: actividadSeleccionada.nombre,
      tipo: actividadSeleccionada.tipo,
      promedioActividad: promedioAct.toFixed(2),
      entregados: conNota.length,
      totalEstudiantes: filas.length,
      tasaEntregaPorcentaje: tasaEntrega.toFixed(1),
    }
  }

  return {
    promTareas: promTareas.toFixed(2),
    aporteTareas: (promTareas * 0.3).toFixed(2),
    promApe: promApe.toFixed(2),
    aporteApe: (promApe * 0.3).toFixed(2),
    promExamen: promExamen.toFixed(2),
    aporteExamen: (promExamen * 0.4).toFixed(2),
    promedioCurso: promedioCursoValor.toFixed(2),
    totalEnRiesgo,
    porcentajeAprobados,
    actividadAislada: actividadStats,
  }
}
