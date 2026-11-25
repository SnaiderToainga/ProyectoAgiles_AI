import autoTable from 'jspdf-autotable'
import {
  NOMBRE_COMPONENTE,
  type ReporteConsolidadoCursoDto,
  type ReporteIndividualTutoriaDto,
} from '../types/academico'
import {
  ANCHO_UTIL_A4_MM,
  COLOR_BORDE_SUAVE,
  COLOR_FONDO_SUAVE,
  COLOR_TEXTO_MEDIO,
  COLOR_TEXTO_OSCURO,
  COLOR_UTA_CRIMSON,
  COLOR_UTA_CRIMSON_OSCURO,
  MARGEN_HORIZONTAL_MM,
  MARGEN_INFERIOR_PIE_MM,
  aplicarBloqueFirmaYPieUta,
  crearDocumentoPdfUta,
  descargarPdfSeguro,
  normalizarTextoPdf,
  obtenerFinalYTabla,
} from './pdfPlantillaUta'

function asegurarEspacioVertical(
  doc: ReturnType<typeof crearDocumentoPdfUta> extends Promise<infer T>
    ? T extends { doc: infer D }
      ? D
      : never
    : never,
  yActual: number,
  requeridoMm: number
): number {
  if (yActual + requeridoMm > 274) {
    doc.addPage()
    return 20
  }
  return yActual
}

/**
 * Exporta el informe oficial individual de rendimiento y tutoría en PDF (T-11.2 / CA-05.2).
 */
export async function exportarPdfReporteIndividual(
  reporte: ReporteIndividualTutoriaDto,
  diagnosticoOverride?: string
): Promise<void> {
  const { doc, contentStartY } = await crearDocumentoPdfUta(
    reporte.membrete,
    reporte.piePagina.codigoDocumento
  )

  const est = reporte.estudiante
  const plan = reporte.planRefuerzo
  const diagnosticoTexto =
    (diagnosticoOverride && diagnosticoOverride.trim()) ||
    plan?.diagnosticoGeneral ||
    reporte.causaPrincipalRendimiento

  // 1. Resumen Ponderado 30/30/40 del Estudiante
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(...COLOR_UTA_CRIMSON)
  doc.text('1. RESUMEN DE RENDIMIENTO ACADÉMICO (MODELO 30/30/40)', MARGEN_HORIZONTAL_MM, contentStartY)

  autoTable(doc, {
    startY: contentStartY + 3,
    margin: { left: MARGEN_HORIZONTAL_MM, right: MARGEN_HORIZONTAL_MM, bottom: MARGEN_INFERIOR_PIE_MM },
    theme: 'grid',
    headStyles: {
      fillColor: COLOR_UTA_CRIMSON,
      textColor: [255, 255, 255],
      fontSize: 7.8,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 7.8,
      textColor: COLOR_TEXTO_OSCURO,
    },
    head: [['Estudiante', 'Correo Institucional', 'Tareas (30%)', 'APE (30%)', 'Examen (40%)', 'Nota Final', 'Estado']],
    body: [
      [
        normalizarTextoPdf(est.nombreCompleto),
        normalizarTextoPdf(est.correo),
        `${est.promedioTareas.toFixed(2)} (${est.aporteTareas.toFixed(2)})`,
        `${est.promedioApe.toFixed(2)} (${est.aporteApe.toFixed(2)})`,
        `${est.promedioExamen.toFixed(2)} (${est.aporteExamen.toFixed(2)})`,
        `${est.notaFinalParcial.toFixed(2)} / 10`,
        est.enRiesgo ? 'EN RIESGO' : 'APROBADO',
      ],
    ],
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 6) {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.textColor = est.enRiesgo ? COLOR_UTA_CRIMSON : [21, 128, 61]
      }
    },
  })

  let cursorY = obtenerFinalYTabla(doc, contentStartY + 26) + 7

  // 2. Causa Principal y Diagnóstico Pedagógico Cualitativo (CA-05.2)
  cursorY = asegurarEspacioVertical(doc, cursorY, 44)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(...COLOR_UTA_CRIMSON)
  doc.text('2. CAUSA PRINCIPAL Y DIAGNÓSTICO PEDAGÓGICO CUALITATIVO', MARGEN_HORIZONTAL_MM, cursorY)
  cursorY += 3

  const anchoTexto = ANCHO_UTIL_A4_MM - 8
  const lineasCausa = doc.splitTextToSize(
    normalizarTextoPdf(`Causa principal: ${reporte.causaPrincipalRendimiento}`),
    anchoTexto
  ) as string[]
  const lineasDiag = doc.splitTextToSize(
    normalizarTextoPdf(`Diagnóstico IA: ${diagnosticoTexto}`),
    anchoTexto
  ) as string[]
  const altoCaja = Math.max(24, (lineasCausa.length + lineasDiag.length) * 4.4 + 12)

  cursorY = asegurarEspacioVertical(doc, cursorY, altoCaja + 4)
  doc.setFillColor(...COLOR_FONDO_SUAVE)
  doc.setDrawColor(...COLOR_BORDE_SUAVE)
  doc.roundedRect(MARGEN_HORIZONTAL_MM, cursorY, ANCHO_UTIL_A4_MM, altoCaja, 1.5, 1.5, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.8)
  doc.setTextColor(...COLOR_TEXTO_OSCURO)
  doc.text(
    normalizarTextoPdf(
      `Nivel de riesgo: ${plan?.nivelRiesgo || (est.enRiesgo ? 'En Riesgo' : 'Bajo')}${
        plan?.esFallback ? ' (Motor de contingencia local)' : ''
      }`
    ),
    MARGEN_HORIZONTAL_MM + 4,
    cursorY + 5.5
  )

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...COLOR_TEXTO_OSCURO)
  let textoY = cursorY + 10.5
  doc.text(lineasCausa, MARGEN_HORIZONTAL_MM + 4, textoY)
  textoY += lineasCausa.length * 4.4 + 2
  doc.text(lineasDiag, MARGEN_HORIZONTAL_MM + 4, textoY)

  cursorY += altoCaja + 7

  // 3. Tabla de Plan de Actividades de Refuerzo (CA-05.2)
  cursorY = asegurarEspacioVertical(doc, cursorY, 30)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(...COLOR_UTA_CRIMSON)
  doc.text('3. PLAN DE ACTIVIDADES DE REFUERZO ACADÉMICO', MARGEN_HORIZONTAL_MM, cursorY)

  const filasPlan =
    plan && plan.detalles.length > 0
      ? plan.detalles.map((d) => [
          normalizarTextoPdf(d.temaNombre),
          normalizarTextoPdf(d.actividadSugerida),
          normalizarTextoPdf(d.prioridad),
          `${d.tiempoEstimadoHoras} h`,
          normalizarTextoPdf(d.recursoRecomendado || 'Material docente FISEI'),
        ])
      : [['Sin plan guardado', 'No registra plan remedial persistido para el estudiante en este curso.', '-', '-', '-']]

  autoTable(doc, {
    startY: cursorY + 3,
    margin: { left: MARGEN_HORIZONTAL_MM, right: MARGEN_HORIZONTAL_MM, bottom: MARGEN_INFERIOR_PIE_MM },
    theme: 'striped',
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    headStyles: {
      fillColor: COLOR_UTA_CRIMSON_OSCURO,
      textColor: [255, 255, 255],
      fontSize: 7.6,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: COLOR_TEXTO_OSCURO,
    },
    columnStyles: {
      0: { cellWidth: 34, fontStyle: 'bold' },
      1: { cellWidth: 68 },
      2: { cellWidth: 18, halign: 'center' },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 44 },
    },
    head: [['Tema Crítico', 'Actividad Sugerida', 'Prioridad', 'Dedicación', 'Recurso Recomendado']],
    body: filasPlan,
  })

  cursorY = obtenerFinalYTabla(doc, cursorY + 25) + 7

  // 4. Desglose de Evaluaciones del Estudiante en el Parcial
  const filasEvals = est.componentes.flatMap((comp) =>
    comp.evaluaciones.map((ev) => [
      normalizarTextoPdf(NOMBRE_COMPONENTE[comp.tipo]),
      normalizarTextoPdf(ev.nombre),
      ev.nota !== null ? `${ev.nota.toFixed(2)} / 10` : 'Sin calificar',
      ev.nota === null ? 'Pendiente' : ev.esDeficiente ? 'Deficiente (< 7.00)' : 'Satisfactorio',
    ])
  )

  if (filasEvals.length > 0) {
    cursorY = asegurarEspacioVertical(doc, cursorY, 28)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(...COLOR_UTA_CRIMSON)
    doc.text('4. DETALLE DE CALIFICACIONES POR ACTIVIDAD EVALUATIVA', MARGEN_HORIZONTAL_MM, cursorY)

    autoTable(doc, {
      startY: cursorY + 3,
      margin: { left: MARGEN_HORIZONTAL_MM, right: MARGEN_HORIZONTAL_MM, bottom: MARGEN_INFERIOR_PIE_MM },
      theme: 'grid',
      showHead: 'everyPage',
      rowPageBreak: 'avoid',
      headStyles: {
        fillColor: [63, 63, 70],
        textColor: [255, 255, 255],
        fontSize: 7.6,
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: COLOR_TEXTO_OSCURO,
      },
      head: [['Componente', 'Actividad Evaluativa', 'Nota', 'Observación']],
      body: filasEvals,
    })

    cursorY = obtenerFinalYTabla(doc, cursorY + 20)
  }

  aplicarBloqueFirmaYPieUta(doc, cursorY, reporte.bloqueFirma, reporte.piePagina)

  descargarPdfSeguro(
    doc,
    `Informe_Tutoria_${reporte.membrete.materiaCodigo}_P${reporte.parcialNumero}_${est.apellidos}_${est.nombres}.pdf`
  )
}

/**
 * Exporta la matriz consolidada del curso con resumen 30/30/40 y porcentajes de riesgo (T-11.3 / CA-05.3).
 */
export async function exportarPdfMatrizConsolidada(
  reporte: ReporteConsolidadoCursoDto,
  alcanceDescripcion?: string
): Promise<void> {
  const { doc, contentStartY } = await crearDocumentoPdfUta(
    reporte.membrete,
    reporte.piePagina.codigoDocumento
  )

  const res = reporte.resumenEstadistico

  // 1. Indicadores Estadísticos del Curso (CA-05.3)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(...COLOR_UTA_CRIMSON)
  doc.text('1. RESUMEN ESTADÍSTICO DEL CURSO', MARGEN_HORIZONTAL_MM, contentStartY)

  const boxY = contentStartY + 3
  const boxH = alcanceDescripcion ? 23 : 18
  doc.setFillColor(...COLOR_FONDO_SUAVE)
  doc.setDrawColor(...COLOR_BORDE_SUAVE)
  doc.roundedRect(MARGEN_HORIZONTAL_MM, boxY, ANCHO_UTIL_A4_MM, boxH, 1.5, 1.5, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...COLOR_TEXTO_OSCURO)
  doc.text(`Total estudiantes: ${res.totalEstudiantes}`, MARGEN_HORIZONTAL_MM + 4, boxY + 6)
  doc.text(
    `Promedio del curso: ${res.promedioGeneralCurso.toFixed(2)} / 10`,
    MARGEN_HORIZONTAL_MM + 46,
    boxY + 6
  )

  doc.setTextColor(21, 128, 61)
  doc.text(
    `Aprobados: ${res.totalAprobados} (${res.porcentajeAprobados.toFixed(1)}%)`,
    MARGEN_HORIZONTAL_MM + 96,
    boxY + 6
  )

  doc.setTextColor(...COLOR_UTA_CRIMSON)
  doc.text(
    `En riesgo (< ${res.umbralAprobacion.toFixed(2)}): ${res.totalEnRiesgo} (${res.porcentajeEnRiesgo.toFixed(1)}%)`,
    MARGEN_HORIZONTAL_MM + 136,
    boxY + 6,
    { maxWidth: 42 }
  )

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.6)
  doc.setTextColor(...COLOR_TEXTO_MEDIO)
  doc.text(
    normalizarTextoPdf(
      `Promedios ponderados - Tareas (30%): ${res.promedioTareasCurso.toFixed(2)} (aporte ${res.aporteTareasCurso.toFixed(
        2
      )})  |  APE (30%): ${res.promedioApeCurso.toFixed(2)} (aporte ${res.aporteApeCurso.toFixed(
        2
      )})  |  Examen (40%): ${res.promedioExamenCurso.toFixed(2)} (aporte ${res.aporteExamenCurso.toFixed(2)})`
    ),
    MARGEN_HORIZONTAL_MM + 4,
    boxY + 13,
    { maxWidth: ANCHO_UTIL_A4_MM - 8 }
  )

  if (alcanceDescripcion) {
    doc.setFont('helvetica', 'italic')
    doc.text(
      normalizarTextoPdf(`Alcance visual activo en pantalla: ${alcanceDescripcion}`),
      MARGEN_HORIZONTAL_MM + 4,
      boxY + 19,
      { maxWidth: ANCHO_UTIL_A4_MM - 8 }
    )
  }

  // 2. Matriz Consolidada de Calificaciones
  const tablaY = boxY + boxH + 7
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(...COLOR_UTA_CRIMSON)
  doc.text('2. MATRIZ CONSOLIDADA DE CALIFICACIONES (30/30/40)', MARGEN_HORIZONTAL_MM, tablaY)

  const filasTabla = reporte.estudiantes.map((f) => [
    String(f.numeroOrden),
    normalizarTextoPdf(`${f.nombreCompleto}\n${f.correo}`),
    `${f.promedioTareas.toFixed(2)} (${f.aporteTareas.toFixed(2)})`,
    `${f.promedioApe.toFixed(2)} (${f.aporteApe.toFixed(2)})`,
    `${f.promedioExamen.toFixed(2)} (${f.aporteExamen.toFixed(2)})`,
    `${f.notaFinalParcial.toFixed(2)}`,
    f.enRiesgo ? 'EN RIESGO' : 'APROBADO',
  ])

  autoTable(doc, {
    startY: tablaY + 3,
    margin: { left: MARGEN_HORIZONTAL_MM, right: MARGEN_HORIZONTAL_MM, bottom: MARGEN_INFERIOR_PIE_MM },
    theme: 'grid',
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    headStyles: {
      fillColor: COLOR_UTA_CRIMSON,
      textColor: [255, 255, 255],
      fontSize: 7.6,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 7.4,
      textColor: COLOR_TEXTO_OSCURO,
      valign: 'middle',
    },
    columnStyles: {
      0: { cellWidth: 9, halign: 'center' },
      1: { cellWidth: 62 },
      2: { cellWidth: 24, halign: 'right' },
      3: { cellWidth: 24, halign: 'right' },
      4: { cellWidth: 24, halign: 'right' },
      5: { cellWidth: 18, halign: 'right', fontStyle: 'bold' },
      6: { cellWidth: 21, halign: 'center', fontStyle: 'bold' },
    },
    head: [['#', 'Estudiante / Correo', 'Tareas 30%', 'APE 30%', 'Examen 40%', 'Promedio', 'Estado']],
    body: filasTabla,
    didParseCell: (data) => {
      if (data.section !== 'body') return
      const estFila = reporte.estudiantes[data.row.index]
      if (!estFila) return
      if (estFila.enRiesgo) {
        data.cell.styles.fillColor = [254, 242, 242]
      }
      if (data.column.index === 6) {
        data.cell.styles.textColor = estFila.enRiesgo ? COLOR_UTA_CRIMSON : [21, 128, 61]
      }
    },
  })

  aplicarBloqueFirmaYPieUta(doc, obtenerFinalYTabla(doc, tablaY + 30), reporte.bloqueFirma, reporte.piePagina)

  descargarPdfSeguro(
    doc,
    `Matriz_Consolidada_${reporte.membrete.materiaCodigo}_Parcial${reporte.parcialNumero}.pdf`
  )
}
