import { describe, expect, it, vi } from 'vitest'
import type {
  EvaluacionDto,
  FirmaDocenteDto,
  MembreteInstitucionalDto,
  ParcialDto,
  PiePaginaReporteDto,
  ResumenAcademicoEstudianteDto,
} from '../types/academico'
import {
  calcularMetricasGrupo,
  calcularRendimientoFiltrado,
  obtenerEvaluacionesEnAlcance,
} from './calculoFiltrosAcademicos'
import {
  aplicarBloqueFirmaYPieUta,
  crearDocumentoPdfUta,
  descargarPdfSeguro,
  normalizarTextoPdf,
} from './pdfPlantillaUta'

function esLatin1Imprimible(texto: string): boolean {
  return Array.from(texto).every((ch) => {
    const code = ch.charCodeAt(0)
    return (
      code === 9 ||
      code === 10 ||
      code === 13 ||
      (code >= 32 && code <= 126) ||
      (code >= 160 && code <= 255)
    )
  })
}

describe('normalizarTextoPdf (compatibilidad Latin-1 / helvetica en jsPDF)', () => {
  it('convierte guiones largos, viñetas, comillas tipográficas, flechas y elipsis', () => {
    const entrada = 'Diagnóstico — • “Refuerzo” ‘Scrum’… nota ≥ 7.00 → aprobar 🚀'
    const salida = normalizarTextoPdf(entrada)

    expect(salida).toBe('Diagnóstico - - "Refuerzo" \'Scrum\'... nota >= 7.00 -> aprobar ')
    expect(esLatin1Imprimible(salida)).toBe(true)
  })

  it('conserva tildes y eñes del español y maneja valores nulos o vacíos', () => {
    expect(normalizarTextoPdf('Evaluación Académica — Ingeniería en Software (Ñandú)')).toBe(
      'Evaluación Académica - Ingeniería en Software (Ñandú)'
    )
    expect(normalizarTextoPdf(null)).toBe('')
    expect(normalizarTextoPdf(undefined)).toBe('')
  })
})

describe('crearDocumentoPdfUta y aplicarBloqueFirmaYPieUta (T-11.1)', () => {
  it('genera un PDF válido con membrete UTA y pie institucional sin fallar con texto IA', async () => {
    const membrete: MembreteInstitucionalDto = {
      universidad: 'Universidad Técnica de Ambato',
      facultad: 'FISEI — Ingeniería',
      carrera: 'Ingeniería en Software',
      sistema: 'SISRA EduMonitor AI',
      tituloReporte: 'Informe Consolidado — Parcial 1',
      materiaCodigo: 'SOF-401',
      materiaNombre: 'Metodologías Ágiles',
      periodoLectivo: '2026-2027',
      parcialId: 1,
      parcialNumero: 1,
      docenteTitular: 'Ing. Diego Proaño',
      docenteCorreo: 'd.proano@uta.edu.ec',
      fechaEmisionUtc: '2026-11-24T15:00:00Z',
    }
    const firma: FirmaDocenteDto = {
      nombreDocente: 'Ing. Diego Proaño',
      correoDocente: 'd.proano@uta.edu.ec',
      cargo: 'Docente Titular',
      etiquetaCasillero: 'Docente Titular — FISEI',
      leyendaConformidad: 'Documento emitido por SISRA • Validado con datos de Moodle…',
      lineaFirma: '______________________',
    }
    const pie: PiePaginaReporteDto = {
      textoInstitucional: 'Universidad Técnica de Ambato — FISEI',
      plantillaNumeracion: 'Página {0} de {1}',
      numeracionInicial: 'Página 1 de 1',
      totalPaginasEstimadas: 1,
      registrosPorPagina: 20,
      paginas: ['Página 1 de 1'],
      codigoDocumento: 'SISRA-SOF401-P1',
      fechaEmisionUtc: '2026-11-24T15:00:00Z',
    }

    const { doc, contentStartY } = await crearDocumentoPdfUta(membrete, pie.codigoDocumento)
    expect(contentStartY).toBeGreaterThan(50)

    aplicarBloqueFirmaYPieUta(doc, contentStartY + 20, firma, pie)
    const salidaPdf = doc.output('datauristring')
    expect(salidaPdf).toContain('data:application/pdf')
    expect(doc.getNumberOfPages()).toBe(1)
  })
})

describe('calculoFiltrosAcademicos (T-12.7 y T-12.8)', () => {
  const parcial: ParcialDto = {
    id: 1,
    numero: 1,
    unidades: [
      {
        id: 10,
        nombre: 'Unidad 1',
        numero: 1,
        temas: [
          { id: 101, nombre: 'Scrum', descripcion: '' },
          { id: 102, nombre: 'Kanban', descripcion: '' },
        ],
      },
      {
        id: 20,
        nombre: 'Unidad 2',
        numero: 2,
        temas: [{ id: 201, nombre: 'Pruebas', descripcion: '' }],
      },
    ],
  }

  const evaluaciones: EvaluacionDto[] = [
    {
      id: 1,
      nombre: 'Tarea 1 Scrum',
      tipo: 1,
      parcialId: 1,
      ponderacion: 0.3,
      publicado: true,
      temaIds: [101],
    },
    {
      id: 2,
      nombre: 'APE 1 Kanban',
      tipo: 2,
      parcialId: 1,
      ponderacion: 0.3,
      publicado: true,
      temaIds: [102],
    },
    {
      id: 3,
      nombre: 'Examen Unidad 2',
      tipo: 3,
      parcialId: 1,
      ponderacion: 0.4,
      publicado: true,
      temaIds: [201],
    },
  ]

  const estudiantes: ResumenAcademicoEstudianteDto[] = [
    {
      estudianteId: 1,
      nombres: 'Ana',
      apellidos: 'Pérez',
      correo: 'a.perez@uta.edu.ec',
      cursoId: 1,
      parcialId: 1,
      fotoUrl: null,
      notaFinalParcial: 8.8,
      enRiesgo: false,
      temasDeficientes: [],
      componentes: [
        {
          tipo: 1,
          ponderacion: 0.3,
          promedioComponente: 9.0,
          aporteFinal: 2.7,
          esDeficiente: false,
          evaluaciones: [
            {
              itemEvaluacionId: 1,
              nombre: 'Tarea 1 Scrum',
              tipo: 1,
              nota: 9.0,
              esDeficiente: false,
              temas: [{ temaId: 101, nombre: 'Scrum' }],
            },
          ],
        },
        {
          tipo: 2,
          ponderacion: 0.3,
          promedioComponente: 9.0,
          aporteFinal: 2.7,
          esDeficiente: false,
          evaluaciones: [
            {
              itemEvaluacionId: 2,
              nombre: 'APE 1 Kanban',
              tipo: 2,
              nota: 9.0,
              esDeficiente: false,
              temas: [{ temaId: 102, nombre: 'Kanban' }],
            },
          ],
        },
        {
          tipo: 3,
          ponderacion: 0.4,
          promedioComponente: 8.5,
          aporteFinal: 3.4,
          esDeficiente: false,
          evaluaciones: [
            {
              itemEvaluacionId: 3,
              nombre: 'Examen Unidad 2',
              tipo: 3,
              nota: 8.5,
              esDeficiente: false,
              temas: [{ temaId: 201, nombre: 'Pruebas' }],
            },
          ],
        },
      ],
    },
    {
      estudianteId: 2,
      nombres: 'Luis',
      apellidos: 'Gómez',
      correo: 'l.gomez@uta.edu.ec',
      cursoId: 1,
      parcialId: 1,
      fotoUrl: null,
      notaFinalParcial: 5.5,
      enRiesgo: true,
      temasDeficientes: [],
      componentes: [
        {
          tipo: 1,
          ponderacion: 0.3,
          promedioComponente: 0,
          aporteFinal: 0,
          esDeficiente: true,
          evaluaciones: [
            {
              itemEvaluacionId: 1,
              nombre: 'Tarea 1 Scrum',
              tipo: 1,
              nota: null,
              esDeficiente: true,
              temas: [{ temaId: 101, nombre: 'Scrum' }],
              estado: 2, // Sin entrega (plazo vencido)
            },
          ],
        },
        {
          tipo: 2,
          ponderacion: 0.3,
          promedioComponente: 6.0,
          aporteFinal: 1.8,
          esDeficiente: true,
          evaluaciones: [
            {
              itemEvaluacionId: 2,
              nombre: 'APE 1 Kanban',
              tipo: 2,
              nota: 6.0,
              esDeficiente: true,
              temas: [{ temaId: 102, nombre: 'Kanban' }],
            },
          ],
        },
        {
          tipo: 3,
          ponderacion: 0.4,
          promedioComponente: 6.5,
          aporteFinal: 2.6,
          esDeficiente: true,
          evaluaciones: [
            {
              itemEvaluacionId: 3,
              nombre: 'Examen Unidad 2',
              tipo: 3,
              nota: 6.5,
              esDeficiente: true,
              temas: [{ temaId: 201, nombre: 'Pruebas' }],
            },
          ],
        },
      ],
    },
  ]

  it('filtra evaluaciones en cascada por Unidad y Tema', () => {
    const u1 = obtenerEvaluacionesEnAlcance(evaluaciones, parcial, 10, null, null)
    expect(u1.map((e) => e.id)).toEqual([1, 2])

    const temaScrum = obtenerEvaluacionesEnAlcance(evaluaciones, parcial, 10, 101, null)
    expect(temaScrum.map((e) => e.id)).toEqual([1])
  })

  it('calcula promedio del grupo y tasa de entrega al aislar una actividad con entrega faltante (CA-06.5)', () => {
    const evalAislada = evaluaciones[0]
    const alcance = obtenerEvaluacionesEnAlcance(evaluaciones, parcial, 10, 101, evalAislada.id)
    const filas = calcularRendimientoFiltrado(estudiantes, alcance, evalAislada.id, true, 'todos', '')
    const metricas = calcularMetricasGrupo(filas, evalAislada)

    expect(metricas.actividadAislada).not.toBeNull()
    expect(metricas.actividadAislada?.entregados).toBe(1)
    expect(metricas.actividadAislada?.totalEstudiantes).toBe(2)
    expect(metricas.actividadAislada?.tasaEntregaPorcentaje).toBe('50.0')
    expect(metricas.actividadAislada?.promedioActividad).toBe('9.00')
    expect(metricas.totalEnRiesgo).toBe(1)
    expect(filas.find((f) => f.estudiante.estudianteId === 2)?.estadoActividadAislada).toBe(2)
  })

  it('no marca en riesgo una actividad pendiente de calificar ni a quien no tiene evaluaciones (RF-06 / RNF-03)', () => {
    const pendiente: ResumenAcademicoEstudianteDto[] = estudiantes.map((est) =>
      est.estudianteId !== 2
        ? est
        : {
            ...est,
            componentes: est.componentes.map((c) => ({
              ...c,
              evaluaciones: c.evaluaciones.map((ev) =>
                ev.itemEvaluacionId === 1 ? { ...ev, estado: 3, esDeficiente: false } : ev
              ),
            })),
          }
    )
    const evalAislada = evaluaciones[0]
    const alcance = obtenerEvaluacionesEnAlcance(evaluaciones, parcial, 10, 101, evalAislada.id)
    const filas = calcularRendimientoFiltrado(pendiente, alcance, evalAislada.id, true, 'todos', '')
    expect(filas.find((f) => f.estudiante.estudianteId === 2)?.enRiesgoFiltrado).toBe(false)

    const sinNotas: ResumenAcademicoEstudianteDto = {
      ...estudiantes[0],
      estudianteId: 9,
      notaFinalParcial: 0,
      enRiesgo: false,
      sinEvaluaciones: true,
    }
    const [fila] = calcularRendimientoFiltrado([sinNotas], [], null, false, 'todos', '')
    expect(fila.enRiesgoFiltrado).toBe(false)
    expect(fila.esCriticoFiltrado).toBe(false)
    expect(fila.notaReferencia).toBeNull()
    expect(calcularMetricasGrupo([fila], null).promedioCurso).toBe('0.00')
  })
})

describe('validación PDF cross-browser y paginación sin solapamiento (T-11.6 / CA-05.4)', () => {
  const membreteBase: MembreteInstitucionalDto = {
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

  const firmaBase: FirmaDocenteDto = {
    nombreDocente: 'Ing. Diego Proaño',
    correoDocente: 'd.proano@uta.edu.ec',
    cargo: 'Docente Titular',
    etiquetaCasillero: 'Firma y Rúbrica del Docente Titular',
    leyendaConformidad: 'Certifico que las calificaciones corresponden a registros oficiales.',
    lineaFirma: '______________________',
  }

  const pieBase: PiePaginaReporteDto = {
    textoInstitucional: 'Universidad Técnica de Ambato - FISEI',
    plantillaNumeracion: 'Página {0} de {1}',
    numeracionInicial: 'Página 1 de 1',
    totalPaginasEstimadas: 1,
    registrosPorPagina: 20,
    paginas: ['Página 1 de 1'],
    codigoDocumento: 'UTA-FISEI-SOF-401-P1',
    fechaEmisionUtc: '2026-11-24T20:00:00Z',
  }

  it('agrega página nueva para el bloque de firma cuando finalY supera el límite seguro (> 236mm)', async () => {
    const { doc } = await crearDocumentoPdfUta(membreteBase, pieBase.codigoDocumento)
    expect(doc.getNumberOfPages()).toBe(1)

    aplicarBloqueFirmaYPieUta(doc, 240, firmaBase, pieBase)
    expect(doc.getNumberOfPages()).toBe(2)
  })

  it('sanitiza nombres de archivo con tildes y espacios en descargarPdfSeguro para Chrome y Firefox', async () => {
    const { doc } = await crearDocumentoPdfUta(membreteBase, pieBase.codigoDocumento)
    const saveSpy = vi.spyOn(doc, 'save').mockImplementation(() => doc)

    descargarPdfSeguro(doc, 'Informe Tutoría SOF-401 — Peña Álvaro')
    expect(saveSpy).toHaveBeenCalledWith('Informe_Tutoria_SOF-401_Pena_Alvaro.pdf')
    saveSpy.mockRestore()
  })
})
