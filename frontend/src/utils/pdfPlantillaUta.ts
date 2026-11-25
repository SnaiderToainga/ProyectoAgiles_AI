import { jsPDF } from 'jspdf'
import logoUta from '../assets/logo.png'
import type {
  FirmaDocenteDto,
  MembreteInstitucionalDto,
  PiePaginaReporteDto,
} from '../types/academico'

export const COLOR_UTA_CRIMSON: [number, number, number] = [139, 21, 26]
export const COLOR_UTA_CRIMSON_OSCURO: [number, number, number] = [110, 16, 20]
export const COLOR_UTA_DORADO: [number, number, number] = [180, 134, 44]
export const COLOR_TEXTO_OSCURO: [number, number, number] = [24, 24, 27]
export const COLOR_TEXTO_MEDIO: [number, number, number] = [82, 82, 91]
export const COLOR_FONDO_SUAVE: [number, number, number] = [250, 250, 250]
export const COLOR_BORDE_SUAVE: [number, number, number] = [228, 228, 231]

export const MARGEN_HORIZONTAL_MM = 14
export const MARGEN_INFERIOR_PIE_MM = 24
export const ANCHO_UTIL_A4_MM = 210 - MARGEN_HORIZONTAL_MM * 2

export interface DocumentoPdfBase {
  doc: jsPDF
  contentStartY: number
}

function cargarLogoComoDataUrl(): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth || img.width
        canvas.height = img.naturalHeight || img.height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(null)
          return
        }
        ctx.drawImage(img, 0, 0)
        resolve(canvas.toDataURL('image/png'))
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = logoUta
  })
}

function formatearFechaLocal(isoUtc: string): string {
  const fecha = new Date(isoUtc)
  if (Number.isNaN(fecha.getTime())) {
    return new Date().toLocaleString('es-EC')
  }
  return fecha.toLocaleString('es-EC', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function obtenerFinalYTabla(doc: jsPDF, fallbackY: number): number {
  const conTabla = doc as jsPDF & { lastAutoTable?: { finalY?: number } }
  return conTabla.lastAutoTable?.finalY ?? fallbackY
}

/**
 * Crea la plantilla membretada oficial de la FISEI - UTA (T-11.1 / CA-05.1).
 */
export async function crearDocumentoPdfUta(
  membrete: MembreteInstitucionalDto,
  codigoDocumento: string
): Promise<DocumentoPdfBase> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  // Banda superior institucional UTA carmesí con filete inferior dorado
  doc.setFillColor(...COLOR_UTA_CRIMSON)
  doc.rect(0, 0, 210, 29, 'F')
  doc.setFillColor(...COLOR_UTA_DORADO)
  doc.rect(0, 29, 210, 1.4, 'F')

  // Recuadro de emblema institucional
  doc.setFillColor(255, 255, 255)
  doc.roundedRect(MARGEN_HORIZONTAL_MM, 5, 19, 19, 2, 2, 'F')

  const logoDataUrl = await cargarLogoComoDataUrl()
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'PNG', MARGEN_HORIZONTAL_MM + 1.5, 6.5, 16, 16)
  } else {
    doc.setTextColor(...COLOR_UTA_CRIMSON)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('UTA', MARGEN_HORIZONTAL_MM + 9.5, 13.5, { align: 'center' })
    doc.setFontSize(6.5)
    doc.text('FISEI', MARGEN_HORIZONTAL_MM + 9.5, 18.5, { align: 'center' })
  }

  // Textos del membrete
  const textX = MARGEN_HORIZONTAL_MM + 23
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text((membrete.universidad || 'UNIVERSIDAD TÉCNICA DE AMBATO').toUpperCase(), textX, 10.5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(`${membrete.facultad} — ${membrete.carrera}`, textX, 15.2)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.8)
  doc.setTextColor(253, 230, 138)
  doc.text(membrete.tituloReporte.toUpperCase(), textX, 20.8, {
    maxWidth: 210 - textX - MARGEN_HORIZONTAL_MM,
  })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.2)
  doc.setTextColor(244, 244, 245)
  doc.text(`${membrete.sistema} | Código: ${codigoDocumento}`, textX, 25.5)

  // Caja de metadatos académicos de cátedra
  const boxY = 34
  const boxH = 22
  doc.setFillColor(...COLOR_FONDO_SUAVE)
  doc.setDrawColor(...COLOR_BORDE_SUAVE)
  doc.roundedRect(MARGEN_HORIZONTAL_MM, boxY, ANCHO_UTIL_A4_MM, boxH, 1.5, 1.5, 'FD')

  doc.setDrawColor(...COLOR_UTA_CRIMSON)
  doc.setLineWidth(0.9)
  doc.line(MARGEN_HORIZONTAL_MM, boxY, MARGEN_HORIZONTAL_MM, boxY + boxH)
  doc.setLineWidth(0.2)

  doc.setTextColor(...COLOR_TEXTO_OSCURO)
  doc.setFontSize(8.2)
  doc.setFont('helvetica', 'bold')
  doc.text('Asignatura:', MARGEN_HORIZONTAL_MM + 4, boxY + 6.5)
  doc.text('Docente:', MARGEN_HORIZONTAL_MM + 4, boxY + 12.5)
  doc.text('Correo:', MARGEN_HORIZONTAL_MM + 4, boxY + 18)

  doc.text('Período / Parcial:', 114, boxY + 6.5)
  doc.text('Fecha de emisión:', 114, boxY + 12.5)
  doc.text('Modelo:', 114, boxY + 18)

  doc.setFont('helvetica', 'normal')
  doc.text(
    `${membrete.materiaNombre} (${membrete.materiaCodigo})`,
    MARGEN_HORIZONTAL_MM + 24,
    boxY + 6.5,
    { maxWidth: 72 }
  )
  doc.text(membrete.docenteTitular, MARGEN_HORIZONTAL_MM + 24, boxY + 12.5, { maxWidth: 72 })
  doc.text(membrete.docenteCorreo || 'docencia.fisei@uta.edu.ec', MARGEN_HORIZONTAL_MM + 24, boxY + 18, {
    maxWidth: 72,
  })

  doc.text(`${membrete.periodoLectivo} · Parcial ${membrete.parcialNumero}`, 143, boxY + 6.5, {
    maxWidth: 50,
  })
  doc.text(formatearFechaLocal(membrete.fechaEmisionUtc), 143, boxY + 12.5, { maxWidth: 50 })
  doc.text('30% Tareas · 30% APE · 40% Examen', 143, boxY + 18, { maxWidth: 50 })

  return {
    doc,
    contentStartY: boxY + boxH + 6,
  }
}

/**
 * Inserta el bloque formal de conformidad/firma docente y aplica pie institucional
 * con numeración "Página X de Y" en todas las páginas (CA-05.4).
 */
export function aplicarBloqueFirmaYPieUta(
  doc: jsPDF,
  finalY: number,
  firma: FirmaDocenteDto,
  pie: PiePaginaReporteDto
): void {
  const pageCountPrev = doc.getNumberOfPages()
  doc.setPage(pageCountPrev)

  // Garantiza espacio suficiente antes del pie de página (A4 alto = 297mm)
  let firmaY = finalY + 10
  if (firmaY > 236) {
    doc.addPage()
    firmaY = 24
  }

  // Recuadro oficial de conformidad y firma docente
  const boxH = 34
  doc.setFillColor(...COLOR_FONDO_SUAVE)
  doc.setDrawColor(...COLOR_BORDE_SUAVE)
  doc.roundedRect(MARGEN_HORIZONTAL_MM, firmaY, ANCHO_UTIL_A4_MM, boxH, 1.5, 1.5, 'FD')

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7.4)
  doc.setTextColor(...COLOR_TEXTO_MEDIO)
  const lineasConformidad = doc.splitTextToSize(
    firma.leyendaConformidad,
    ANCHO_UTIL_A4_MM - 8
  ) as string[]
  doc.text(lineasConformidad, MARGEN_HORIZONTAL_MM + 4, firmaY + 5.5)

  const lineaFirmaY = firmaY + 22
  doc.setDrawColor(113, 113, 122)
  doc.setLineWidth(0.35)
  doc.line(30, lineaFirmaY, 96, lineaFirmaY)
  doc.line(114, lineaFirmaY, 180, lineaFirmaY)
  doc.setLineWidth(0.2)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...COLOR_TEXTO_OSCURO)
  doc.text(firma.nombreDocente, 63, lineaFirmaY + 4.5, { align: 'center', maxWidth: 64 })
  doc.text('Coordinación Académica FISEI', 147, lineaFirmaY + 4.5, {
    align: 'center',
    maxWidth: 64,
  })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...COLOR_TEXTO_MEDIO)
  doc.text(firma.etiquetaCasillero, 63, lineaFirmaY + 8.5, { align: 'center', maxWidth: 64 })
  doc.text('Visto Bueno / Seguimiento SISRA', 147, lineaFirmaY + 8.5, {
    align: 'center',
    maxWidth: 64,
  })

  // Numeración formal y pie institucional en TODAS las páginas generadas
  const totalPaginas = doc.getNumberOfPages()
  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i)
    doc.setDrawColor(...COLOR_BORDE_SUAVE)
    doc.line(MARGEN_HORIZONTAL_MM, 281, 210 - MARGEN_HORIZONTAL_MM, 281)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.2)
    doc.setTextColor(...COLOR_TEXTO_MEDIO)
    doc.text(pie.textoInstitucional, MARGEN_HORIZONTAL_MM, 286, { maxWidth: 138 })

    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COLOR_TEXTO_OSCURO)
    doc.text(`Página ${i} de ${totalPaginas}`, 210 - MARGEN_HORIZONTAL_MM, 286, {
      align: 'right',
    })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.6)
    doc.setTextColor(...COLOR_TEXTO_MEDIO)
    doc.text(`Ref: ${pie.codigoDocumento}`, MARGEN_HORIZONTAL_MM, 290)
  }
}

export function descargarPdfSeguro(doc: jsPDF, nombreArchivo: string): void {
  const limpio = nombreArchivo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
  doc.save(limpio.endsWith('.pdf') ? limpio : `${limpio}.pdf`)
}
