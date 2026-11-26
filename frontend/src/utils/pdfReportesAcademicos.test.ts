import { describe, expect, it, vi } from 'vitest'
import type {
  FirmaDocenteDto,
  MembreteInstitucionalDto,
  PiePaginaReporteDto,
  ReporteConsolidadoCursoDto,
  ReporteIndividualTutoriaDto,
} from '../types/academico'

const descargarSpy = vi.fn()

vi.mock('./pdfPlantillaUta', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./pdfPlantillaUta')>()
  return {
    ...actual,
    descargarPdfSeguro: (doc: Parameters<typeof actual.descargarPdfSeguro>[0], nombre: string) => {
      descargarSpy(doc, nombre)
    },
  }
})

import {
  exportarPdfMatrizConsolidada,
  exportarPdfReporteIndividual,
} from './pdfReportesAcademicos'

describe('exportación oficial de reportes PDF UTA/FISEI (T-11.6)', () => {
  const membrete: MembreteInstitucionalDto = {
    universidad: 'Universidad Técnica de Ambato',
    facultad: 'FISEI',
    carrera: 'Ingeniería en Software',
    sistema: 'SISRA EduMonitor AI',
    tituloReporte: 'Informe Oficial de Rendimiento',
    materiaCodigo: 'SOF-401',
    materiaNombre: 'Metodologías Ágiles',
    periodoLectivo: '2026-2',
    parcialId: 1,
    parcialNumero: 1,
    docenteTitular: 'Ing. Diego Proaño',
    docenteCorreo: 'd.proano@uta.edu.ec',
    fechaEmisionUtc: '2026-11-24T20:00:00Z',
  }

  const firma: FirmaDocenteDto = {
    nombreDocente: 'Ing. Diego Proaño',
    correoDocente: 'd.proano@uta.edu.ec',
    cargo: 'Docente Titular',
    etiquetaCasillero: 'Firma y Rúbrica del Docente Titular',
    leyendaConformidad: 'Certifico que las calificaciones corresponden a registros oficiales.',
    lineaFirma: '______________________',
  }

  const pie: PiePaginaReporteDto = {
    textoInstitucional: 'Universidad Técnica de Ambato - FISEI',
    plantillaNumeracion: 'Página {0} de {1}',
    numeracionInicial: 'Página 1 de 1',
    totalPaginasEstimadas: 1,
    registrosPorPagina: 20,
    paginas: ['Página 1 de 1'],
    codigoDocumento: 'UTA-FISEI-SOF-401-P1',
    fechaEmisionUtc: '2026-11-24T20:00:00Z',
  }

  it('genera documentos PDF válidos para matriz consolidada y tutoría individual con autoTable', async () => {
    descargarSpy.mockClear()

    const filaEstudiante = {
      numeroOrden: 1,
      estudianteId: 10,
      nombres: 'Kevin Paul',
      apellidos: 'Fuerez Morales',
      nombreCompleto: 'Fuerez Morales Kevin Paul',
      correo: 'kevin.fuerez@uta.edu.ec',
      fotoUrl: null,
      promedioTareas: 5.8,
      aporteTareas: 1.74,
      promedioApe: 5.8,
      aporteApe: 1.74,
      promedioExamen: 5.43,
      aporteExamen: 2.17,
      notaFinalParcial: 5.65,
      enRiesgo: true,
      estadoAcademico: 'En Riesgo',
      componentes: [
        {
          tipo: 1 as const,
          ponderacion: 0.3,
          promedioComponente: 5.8,
          aporteFinal: 1.74,
          esDeficiente: true,
          evaluaciones: [
            {
              itemEvaluacionId: 1,
              nombre: 'Evaluación 1.1: Scrum',
              tipo: 1 as const,
              nota: 5.8,
              esDeficiente: true,
              temas: [{ temaId: 1, nombre: 'Fundamentos Scrum' }],
            },
          ],
        },
      ],
      temasDeficientes: [
        {
          temaId: 1,
          nombreTema: 'Fundamentos Scrum',
          evaluacionOrigen: 'Evaluación 1.1: Scrum',
          notaObtenida: 5.8,
        },
      ],
      planRefuerzoVigente: null,
    }

    const consolidado: ReporteConsolidadoCursoDto = {
      cursoId: 1,
      parcialId: 1,
      parcialNumero: 1,
      membrete,
      resumenEstadistico: {
        totalEstudiantes: 1,
        totalAprobados: 0,
        totalEnRiesgo: 1,
        porcentajeAprobados: 0,
        porcentajeEnRiesgo: 100,
        promedioGeneralCurso: 5.65,
        promedioTareasCurso: 5.8,
        aporteTareasCurso: 1.74,
        promedioApeCurso: 5.8,
        aporteApeCurso: 1.74,
        promedioExamenCurso: 5.43,
        aporteExamenCurso: 2.17,
        umbralAprobacion: 7.0,
      },
      estudiantes: [filaEstudiante],
      bloqueFirma: firma,
      piePagina: pie,
    }

    const individual: ReporteIndividualTutoriaDto = {
      cursoId: 1,
      parcialId: 1,
      parcialNumero: 1,
      membrete,
      estudiante: filaEstudiante,
      causaPrincipalRendimiento: 'Deficiencia en tareas y examen.',
      planRefuerzo: null,
      bloqueFirma: firma,
      piePagina: pie,
    }

    await exportarPdfMatrizConsolidada(consolidado)
    await exportarPdfReporteIndividual(individual)

    expect(descargarSpy).toHaveBeenCalledTimes(2)
    expect(descargarSpy.mock.calls[0][1]).toBe('Matriz_Consolidada_SOF-401_Parcial1.pdf')
    expect(descargarSpy.mock.calls[1][1]).toBe(
      'Informe_Tutoria_SOF-401_P1_Fuerez Morales_Kevin Paul.pdf'
    )

    const docConsolidado = descargarSpy.mock.calls[0][0]
    const docIndividual = descargarSpy.mock.calls[1][0]
    expect(docConsolidado.output('datauristring')).toContain('data:application/pdf')
    expect(docIndividual.output('datauristring')).toContain('data:application/pdf')
  })
})
