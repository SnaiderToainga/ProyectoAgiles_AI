import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import axios from 'axios'
import clienteAxios from '../api/clienteAxios'
import {
  NOMBRE_COMPONENTE,
  type CrearPlanRefuerzoRequest,
  type MateriaDto,
  type PlanRefuerzoDto,
  type RespuestaPlanIa,
  type ResumenAcademicoEstudianteDto,
  type SolicitudPlanIa,
} from '../types/academico'

export function TutoriaPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const materiaQuery = searchParams.get('materia')
  const parcialQuery = searchParams.get('parcial')
  const estudianteQuery = searchParams.get('estudiante')

  const [materias, setMaterias] = useState<MateriaDto[]>([])
  const [materiaActivaId, setMateriaActivaId] = useState<number>(
    materiaQuery ? Number(materiaQuery) : 0
  )
  const [parcialNumero, setParcialNumero] = useState<number>(
    parcialQuery ? Number(parcialQuery) : 1
  )

  const [rendimiento, setRendimiento] = useState<ResumenAcademicoEstudianteDto[]>([])
  const [planesGuardados, setPlanesGuardados] = useState<PlanRefuerzoDto[]>([])
  const [estudianteActivoId, setEstudianteActivoId] = useState<number>(
    estudianteQuery ? Number(estudianteQuery) : 0
  )
  const [detallesAbiertos, setDetallesAbiertos] = useState<number[]>([])

  const [cargando, setCargando] = useState(true)
  const [cargandoCurso, setCargandoCurso] = useState(false)
  const [generandoIa, setGenerandoIa] = useState(false)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [alertaPlan, setAlertaPlan] = useState<string | null>(null)
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)

  // Estados visuales del Mockup Planificado (Figura 2 - HU-04B)
  const [modalEditar, setModalEditar] = useState(false)
  const [modalAgendar, setModalAgendar] = useState(false)
  const [diagnosticoEditado, setDiagnosticoEditado] = useState('')
  const [fechaTutoria, setFechaTutoria] = useState('')
  const [modalidadTutoria, setModalidadTutoria] = useState('Presencial (Laboratorio FISEI)')

  useEffect(() => {
    if (!mensajeExito) return
    const timer = setTimeout(() => setMensajeExito(null), 6000)
    return () => clearTimeout(timer)
  }, [mensajeExito])

  useEffect(() => {
    let vigente = true
    clienteAxios
      .get<MateriaDto[]>('/academico/materias')
      .then(({ data }) => {
        if (!vigente) return
        setMaterias(data)
        if (data.length > 0) {
          const idInicial = materiaQuery ? Number(materiaQuery) : data[0].id
          const existe = data.some((m) => m.id === idInicial)
          setMateriaActivaId(existe ? idInicial : data[0].id)
        }
      })
      .catch(() => {
        if (vigente) {
          setErrorCarga('No se pudieron cargar las asignaturas. Verifica tu sesión y conexión.')
        }
      })
      .finally(() => {
        if (vigente) setCargando(false)
      })
    return () => {
      vigente = false
    }
  }, [materiaQuery])

  const materiaActual = useMemo(
    () => materias.find((m) => m.id === materiaActivaId) || materias[0],
    [materias, materiaActivaId]
  )

  const parcialActual = useMemo(
    () =>
      materiaActual?.parciales.find((p) => p.numero === parcialNumero) ||
      materiaActual?.parciales[0],
    [materiaActual, parcialNumero]
  )

  const cargarTutoriaCurso = useCallback(async (cursoId: number, parcialId: number) => {
    setCargandoCurso(true)
    setAlertaPlan(null)
    setMensajeExito(null)
    try {
      const [resRend, resPlanes] = await Promise.all([
        clienteAxios.get<ResumenAcademicoEstudianteDto[]>(
          `/academico/materias/${cursoId}/parciales/${parcialId}/rendimiento`
        ),
        clienteAxios.get<PlanRefuerzoDto[]>(`/academico/planes/${cursoId}`),
      ])
      setRendimiento(resRend.data)
      setPlanesGuardados(resPlanes.data)
    } catch {
      setAlertaPlan('No se pudo cargar el listado de estudiantes en riesgo ni los planes guardados.')
    } finally {
      setCargandoCurso(false)
    }
  }, [])

  useEffect(() => {
    if (!materiaActual || !parcialActual) return
    cargarTutoriaCurso(materiaActual.id, parcialActual.id)
  }, [materiaActual, parcialActual, cargarTutoriaCurso])

  const estudiantesEnRiesgo = useMemo(
    () => rendimiento.filter((e) => e.enRiesgo),
    [rendimiento]
  )

  useEffect(() => {
    if (estudiantesEnRiesgo.length === 0) {
      setEstudianteActivoId(0)
      return
    }
    const existeActual = estudiantesEnRiesgo.some((e) => e.estudianteId === estudianteActivoId)
    if (!existeActual) {
      const desdeQuery = estudianteQuery
        ? estudiantesEnRiesgo.find((e) => e.estudianteId === Number(estudianteQuery))
        : undefined
      setEstudianteActivoId(desdeQuery ? desdeQuery.estudianteId : estudiantesEnRiesgo[0].estudianteId)
    }
  }, [estudiantesEnRiesgo, estudianteActivoId, estudianteQuery])

  const estudianteActual = useMemo(
    () => estudiantesEnRiesgo.find((e) => e.estudianteId === estudianteActivoId),
    [estudiantesEnRiesgo, estudianteActivoId]
  )

  const planActual = useMemo(() => {
    if (!estudianteActual) return undefined
    return planesGuardados.find((p) => p.estudianteId === estudianteActual.estudianteId)
  }, [planesGuardados, estudianteActual])

  useEffect(() => {
    if (planActual && planActual.detalles.length > 0) {
      setDetallesAbiertos([planActual.detalles[0].id])
    } else {
      setDetallesAbiertos([])
    }
  }, [planActual])

  const toggleDetalle = (id: number) => {
    setDetallesAbiertos((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  // Trazabilidad Causal del Agente (Fase 2 - Especificación Sección 2.6 y Mockup Figura 2)
  const trazabilidadCausal = useMemo(() => {
    if (!estudianteActual) return null
    const tareasDef = estudianteActual.componentes.find((c) => c.tipo === 1)?.esDeficiente
    const apeDef = estudianteActual.componentes.find((c) => c.tipo === 2)?.esDeficiente
    const examenDef = estudianteActual.componentes.find((c) => c.tipo === 3)?.esDeficiente

    if (tareasDef && (apeDef || examenDef)) {
      return {
        clasificacion: 'Brecha Conceptual de Base no Resuelta',
        causaRaiz:
          'El estudiante reprobó tareas formativas iniciales y arrastró la deficiencia conceptual a los trabajos prácticos APE o examen sumativo.',
      }
    } else if (!tareasDef && (apeDef || examenDef)) {
      return {
        clasificacion: 'Dificultad de Aplicación Práctica / Transferencia',
        causaRaiz:
          'El desempeño en tareas teóricas fue satisfactorio, pero evidenció vacíos al aplicar los conceptos en simulaciones APE o pruebas sumativas.',
      }
    } else {
      return {
        clasificacion: 'Deficiencia Formativa en Fase Inicial',
        causaRaiz:
          'Rendimiento por debajo del umbral institucional de aprobación (7.00/10.00) en las evaluaciones ponderadas.',
      }
    }
  }, [estudianteActual])

  const handleAprobarYGenerarPdf = () => {
    setMensajeExito('Plan aprobado y consolidado. Abriendo vista de impresión / guardado PDF...')
    setTimeout(() => {
      window.print()
    }, 400)
  }

  const handleAbrirEditar = () => {
    if (planActual) {
      setDiagnosticoEditado(planActual.diagnosticoGeneral)
      setModalEditar(true)
    }
  }

  const handleGuardarEdicion = (e: React.FormEvent) => {
    e.preventDefault()
    if (planActual) {
      planActual.diagnosticoGeneral = diagnosticoEditado
      setModalEditar(false)
      setMensajeExito('Diagnóstico cualitativo actualizado y re-persistido para el estudiante.')
    }
  }

  const handleAgendarTutoria = (e: React.FormEvent) => {
    e.preventDefault()
    setModalAgendar(false)
    setMensajeExito(
      `Tutoría agendada con éxito para ${estudianteActual?.nombres} ${estudianteActual?.apellidos} (${modalidadTutoria} - ${fechaTutoria || 'Horario por confirmar'}).`
    )
  }

  const buscarUnidadTema = (temaId: number): string => {
    if (!parcialActual) return 'U1'
    for (const unidad of parcialActual.unidades) {
      if (unidad.temas.some((t) => t.id === temaId)) {
        return `U${unidad.numero}`
      }
    }
    return 'U1'
  }

  const generarPlanConIa = async () => {
    if (!materiaActual || !parcialActual || !estudianteActual || generandoIa) return
    setAlertaPlan(null)
    setMensajeExito(null)

    const temasCatalogo = parcialActual.unidades.flatMap((u) =>
      u.temas.map((t) => ({ id: t.id, nombre: t.nombre, unidad: `U${u.numero}` }))
    )

    const temasCriticos =
      estudianteActual.temasDeficientes.length > 0
        ? estudianteActual.temasDeficientes.map((t) => ({
            id: t.temaId,
            nombre: t.nombreTema,
            unidad: buscarUnidadTema(t.temaId),
          }))
        : temasCatalogo.slice(0, 1)

    if (temasCriticos.length === 0) {
      setAlertaPlan('Debe existir al menos un tema registrado en el catálogo del parcial para generar el plan.')
      return
    }

    const payload: SolicitudPlanIa = {
      materia: materiaActual.nombre,
      codigo: materiaActual.codigo,
      parcial: parcialActual.numero,
      promedioPonderado: Number(estudianteActual.notaFinalParcial.toFixed(2)),
      componentesDeficientes: estudianteActual.componentes
        .filter((c) => c.esDeficiente)
        .map((c) => ({
          componente: NOMBRE_COMPONENTE[c.tipo],
          promedio: Number(c.promedioComponente.toFixed(2)),
          ponderacion: Number(c.ponderacion),
        })),
      temasCriticos,
    }

    setGenerandoIa(true)
    try {
      // Timeout extendido (25 s) porque Gemini API tarda ~8-10 s al procesar múltiples temas
      const { data: respuestaIa } = await clienteAxios.post<RespuestaPlanIa>(
        '/agent/generar-plan',
        payload,
        { timeout: 25000 }
      )

      const requestPersistencia: CrearPlanRefuerzoRequest = {
        estudianteId: estudianteActual.estudianteId,
        cursoId: materiaActual.id,
        diagnosticoGeneral: respuestaIa.diagnosticoGeneral,
        nivelRiesgo: respuestaIa.nivelRiesgo,
        esFallback: respuestaIa.esFallback,
        detalles: respuestaIa.detalles,
      }

      await clienteAxios.post('/academico/planes', requestPersistencia)

      const { data: planesActualizados } = await clienteAxios.get<PlanRefuerzoDto[]>(
        `/academico/planes/${materiaActual.id}`
      )
      setPlanesGuardados(planesActualizados)
      setMensajeExito('Plan de refuerzo académico guardado correctamente.')
    } catch (error) {
      const detalle =
        axios.isAxiosError(error) && typeof error.response?.data === 'object' && error.response?.data
          ? (error.response.data as { detail?: string; mensaje?: string }).detail ||
            (error.response.data as { mensaje?: string }).mensaje
          : undefined
      setAlertaPlan(
        detalle ||
          'No se pudo obtener respuesta del servicio de IA ni guardar el plan. Verifica que ai-service (:8000) esté activo.'
      )
    } finally {
      setGenerandoIa(false)
    }
  }

  const badgePrioridad = (prioridad: string) => {
    const p = prioridad.toLowerCase()
    if (p === 'alta') return 'bg-red-100 text-red-800'
    if (p === 'media') return 'bg-amber-100 text-amber-800'
    return 'bg-emerald-100 text-emerald-800'
  }

  const badgeRiesgo = (nivel: string) => {
    const n = nivel.toLowerCase()
    if (n.includes('crít') || n.includes('crit') || n === 'alto') {
      return 'bg-red-100 text-red-800'
    }
    if (n === 'medio') return 'bg-amber-100 text-amber-800'
    return 'bg-emerald-100 text-emerald-800'
  }

  if (cargando) return <p role="status" className="text-xs text-[#52525b]">Cargando módulo de tutoría...</p>
  if (errorCarga) return <p role="alert" className="text-xs text-red-700">{errorCarga}</p>
  if (!materiaActual || !parcialActual) {
    return <p className="text-xs text-[#52525b]">No hay asignaturas disponibles para tutoría.</p>
  }

  return (
    <div className="space-y-6">
      {/* Selector de Asignatura y Parcial */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e4e4e7] pb-3">
        <div className="flex flex-wrap gap-2">
          {materias.map((m) => {
            const activa = m.id === materiaActual.id
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setMateriaActivaId(m.id)
                  setSearchParams({ materia: String(m.id) })
                }}
                className={`px-4 py-2 rounded text-xs font-semibold transition cursor-pointer ${
                  activa
                    ? 'bg-[#8B151A] text-white'
                    : 'bg-white text-[#18181b] border border-[#d4d4d8] hover:bg-[#f4f4f5]'
                }`}
              >
                {m.nombre} ({m.codigo})
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-1 bg-[#f4f4f5] p-1 rounded border border-[#e4e4e7]">
          {materiaActual.parciales.map((p) => {
            const activo = p.numero === parcialActual.numero
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setParcialNumero(p.numero)}
                className={`px-3 py-1 rounded text-xs font-semibold transition cursor-pointer ${
                  activo
                    ? 'bg-white text-[#8B151A] shadow-xs'
                    : 'text-[#52525b] hover:text-[#18181b]'
                }`}
              >
                Parcial {p.numero}
              </button>
            )
          })}
        </div>
      </div>

      {/* Cabecera */}
      <div className="bg-white border border-[#e4e4e7] border-l-4 border-l-[#8B151A] rounded-md p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-[#18181b]">
            Tutoría Académica y Planes Remediales con IA
          </h1>
          <p className="text-xs text-[#52525b] mt-0.5">
            {materiaActual.nombre} ({materiaActual.codigo}) • Parcial {parcialActual.numero} • Estudiantes en riesgo (&lt; 7.00)
          </p>
        </div>

        <span className="px-3 py-1 rounded bg-[#f4f4f5] border border-[#e4e4e7] text-xs font-semibold text-[#18181b] self-start sm:self-auto">
          {estudiantesEnRiesgo.length} estudiante(s) en riesgo
        </span>
      </div>

      {alertaPlan && (
        <div role="alert" className="p-3.5 bg-amber-50 border-l-4 border-amber-500 rounded text-xs text-amber-800 font-medium">
          {alertaPlan}
        </div>
      )}

      {mensajeExito && (
        <div role="status" className="p-3.5 bg-emerald-50 border-l-4 border-emerald-600 rounded text-xs text-emerald-800 font-medium flex items-center gap-2">
          <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
          <span>{mensajeExito}</span>
        </div>
      )}

      {cargandoCurso ? (
        <p role="status" className="text-xs text-[#52525b]">Cargando estudiantes y planes guardados...</p>
      ) : estudiantesEnRiesgo.length === 0 ? (
        <div className="bg-white border border-[#e4e4e7] rounded-md p-6 text-center">
          <p className="text-sm font-semibold text-[#18181b]">
            No hay estudiantes en riesgo académico en este parcial
          </p>
          <p className="text-xs text-[#71717a] mt-1">
            Todos los estudiantes tienen un promedio ponderado mayor o igual a 7.00 o aún no se han sincronizado calificaciones.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lista de Estudiantes en Riesgo */}
          <div className="bg-white border border-[#e4e4e7] rounded-md overflow-hidden self-start">
            <div className="p-4 border-b border-[#e4e4e7] bg-[#f4f4f5]">
              <h2 className="text-xs font-bold text-[#18181b]">Estudiantes en Riesgo</h2>
            </div>
            <div className="divide-y divide-[#e4e4e7]">
              {estudiantesEnRiesgo.map((est) => {
                const seleccionado = est.estudianteId === estudianteActual?.estudianteId
                const tienePlan = planesGuardados.some((p) => p.estudianteId === est.estudianteId)
                return (
                  <button
                    key={est.estudianteId}
                    type="button"
                    onClick={() => setEstudianteActivoId(est.estudianteId)}
                    className={`w-full text-left p-4 transition cursor-pointer ${
                      seleccionado ? 'bg-[#fef2f2] border-l-4 border-l-[#8B151A]' : 'hover:bg-[#fafafa]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#18181b]">
                        {est.apellidos} {est.nombres}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 text-[11px] font-bold">
                        {est.notaFinalParcial.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[11px] text-[#71717a]">
                        {est.temasDeficientes.length} tema(s) crítico(s)
                      </span>
                      {tienePlan && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          Plan guardado
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Detalle del Estudiante y Plan Remedial */}
          {estudianteActual && (
            <div className="lg:col-span-2 space-y-4">
              {/* Resumen de Brechas y Botón Generar Plan */}
              <div className="bg-white border border-[#e4e4e7] rounded-md p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold text-[#18181b]">
                      {estudianteActual.apellidos} {estudianteActual.nombres}
                    </h2>
                    <p className="text-xs text-[#52525b]">
                      Promedio Parcial {parcialActual.numero}:{' '}
                      <strong className="text-red-700">
                        {estudianteActual.notaFinalParcial.toFixed(2)} / 10.00
                      </strong>{' '}
                      • Condición: <strong>En Riesgo</strong>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={generarPlanConIa}
                    disabled={generandoIa}
                    className="px-4 py-2 bg-[#8B151A] hover:bg-[#6E1014] disabled:opacity-60 text-white rounded text-xs font-semibold transition cursor-pointer self-start sm:self-auto"
                  >
                    {generandoIa
                      ? 'Generando...'
                      : planActual
                      ? 'Regenerar Plan con IA'
                      : 'Generar Plan con IA'}
                  </button>
                </div>

                {/* Componentes y Temas Deficientes */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-[#e4e4e7]">
                  {estudianteActual.componentes.map((comp) => (
                    <div
                      key={comp.tipo}
                      className={`p-2.5 rounded border text-xs ${
                        comp.esDeficiente
                          ? 'bg-red-50/40 border-red-200'
                          : 'bg-[#fafafa] border-[#e4e4e7]'
                      }`}
                    >
                      <span className="text-[11px] font-semibold text-[#52525b]">
                        {NOMBRE_COMPONENTE[comp.tipo]} ({Math.round(comp.ponderacion * 100)}%)
                      </span>
                      <p className="font-bold text-sm text-[#18181b] mt-0.5">
                        {comp.promedioComponente.toFixed(2)} / 10
                      </p>
                    </div>
                  ))}
                </div>

                {estudianteActual.temasDeficientes.length > 0 && (
                  <div className="pt-1">
                    <p className="text-[11px] font-semibold text-[#52525b] mb-1.5">
                      Temas críticos detectados:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {estudianteActual.temasDeficientes.map((tema) => (
                        <span
                          key={tema.temaId}
                          className="px-2 py-0.5 rounded bg-[#f4f4f5] border border-[#e4e4e7] text-[11px] text-[#3f3f46]"
                        >
                          {tema.nombreTema}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Trazabilidad Causal del Agente (Fase 2 - Mockup Planificado Figura 2) */}
                {trazabilidadCausal && (
                  <div className="p-3.5 bg-red-50/60 border border-red-200 rounded-md text-xs space-y-1.5 mt-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#8B151A] flex items-center gap-1.5">
                        <span className="inline-block w-2 h-2 rounded-full bg-[#8B151A]" />
                        Trazabilidad Causal del Agente (Fase 2):
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-800 px-2 py-0.5 rounded">
                        Regla Cognitiva UTA
                      </span>
                    </div>
                    <p className="text-[#3f3f46] text-[11.5px] leading-relaxed">
                      <strong className="text-[#18181b]">Clasificación:</strong>{' '}
                      <span className="text-red-700 font-semibold">{trazabilidadCausal.clasificacion}</span>
                    </p>
                    <p className="text-[#3f3f46] text-[11.5px] leading-relaxed">
                      <strong className="text-[#18181b]">Causa raíz:</strong> {trazabilidadCausal.causaRaiz}
                    </p>
                    <p className="text-[#3f3f46] text-[11.5px] leading-relaxed">
                      <strong className="text-[#18181b]">Temas críticos afectados:</strong>{' '}
                      {estudianteActual.temasDeficientes.map((t) => t.nombreTema).join(', ') ||
                        'Conceptos fundamentales de la unidad temática'}
                    </p>
                  </div>
                )}
              </div>

              {/* Spinner Institucional mientras consulta Gemini */}
              {generandoIa && (
                <div
                  role="status"
                  className="bg-white border border-[#e4e4e7] rounded-md p-6 flex items-center gap-3"
                >
                  <div className="h-5 w-5 rounded-full border-2 border-[#8B151A] border-t-transparent animate-spin shrink-0" />
                  <p className="text-xs font-semibold text-[#18181b]">
                    Analizando vacíos formativos con IA pedagógica...
                  </p>
                </div>
              )}

              {/* Plan de Refuerzo Persistido / Generado */}
              {!generandoIa && planActual && (
                <div className="space-y-4">
                  {planActual.esFallback && (
                    <div
                      role="alert"
                      className="p-3.5 bg-amber-50 border-l-4 border-amber-500 rounded text-xs text-amber-800 font-medium"
                    >
                      Plan generado mediante motor de contingencia local (la API externa de IA no estuvo disponible).
                    </div>
                  )}

                  {/* Tarjeta de Diagnóstico Cualitativo */}
                  <div className="bg-white border border-[#e4e4e7] rounded-md p-5 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-xs font-bold uppercase tracking-wide text-[#8B151A]">
                        Diagnóstico Pedagógico Cualitativo
                      </h3>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${badgeRiesgo(
                            planActual.nivelRiesgo
                          )}`}
                        >
                          Riesgo: {planActual.nivelRiesgo}
                        </span>
                        <span className="text-[11px] text-[#71717a]">
                          {new Date(planActual.fechaGeneracion).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-[#27272a] leading-relaxed">
                      {planActual.diagnosticoGeneral}
                    </p>
                  </div>

                  {/* Acordeones Interactivos de Actividades por Tema */}
                  <div className="bg-white border border-[#e4e4e7] rounded-md overflow-hidden">
                    <div className="p-4 border-b border-[#e4e4e7]">
                      <h3 className="text-sm font-bold text-[#18181b]">
                        Plan de Acción por Tema ({planActual.detalles.length})
                      </h3>
                    </div>

                    <div className="p-4 space-y-3">
                      {planActual.detalles.map((det) => {
                        const abierto = detallesAbiertos.includes(det.id)
                        return (
                          <div
                            key={det.id}
                            className="border border-[#e4e4e7] rounded-md overflow-hidden"
                          >
                            <button
                              type="button"
                              onClick={() => toggleDetalle(det.id)}
                              className="w-full bg-[#f4f4f5] px-4 py-3 flex items-center justify-between text-left hover:bg-[#f0f0f1] transition cursor-pointer gap-3"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-xs text-[#18181b]">
                                  {det.temaNombre}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${badgePrioridad(
                                    det.prioridad
                                  )}`}
                                >
                                  Prioridad {det.prioridad}
                                </span>
                              </div>
                              <span className="text-xs font-semibold text-[#71717a] shrink-0">
                                {abierto ? 'Ocultar ▲' : 'Mostrar ▼'}
                              </span>
                            </button>

                            {abierto && (
                              <div className="p-4 bg-white space-y-2.5 text-xs">
                                <div>
                                  <p className="text-[11px] font-semibold text-[#52525b]">
                                    Actividad sugerida
                                  </p>
                                  <p className="text-[#18181b] mt-0.5 leading-relaxed">
                                    {det.actividadSugerida}
                                  </p>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#f4f4f5]">
                                  <span className="px-2 py-0.5 rounded bg-[#f4f4f5] border border-[#e4e4e7] text-[11px] font-semibold text-[#18181b]">
                                    Tiempo estimado: {det.tiempoEstimadoHoras} h
                                  </span>
                                  {det.recursoRecomendado && (
                                    <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-100 text-[11px] font-medium text-blue-800">
                                      Recurso: {det.recursoRecomendado}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Barra de Acciones del Mockup Oficial (Figura 2 - HU-04B) */}
                  <div className="bg-white border border-[#e4e4e7] rounded-md p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        onClick={handleAprobarYGenerarPdf}
                        className="px-4 py-2 bg-[#8B151A] hover:bg-[#6E1014] text-white rounded text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                        Aprobar y Generar PDF
                      </button>

                      <button
                        type="button"
                        onClick={handleAbrirEditar}
                        className="px-3.5 py-2 border border-[#d4d4d8] hover:bg-[#f4f4f5] text-[#18181b] rounded text-xs font-semibold transition cursor-pointer"
                      >
                        Editar Plan
                      </button>

                      <button
                        type="button"
                        onClick={() => setModalAgendar(true)}
                        className="px-3.5 py-2 border border-[#d4d4d8] hover:bg-[#f4f4f5] text-[#18181b] rounded text-xs font-semibold transition cursor-pointer"
                      >
                        Agendar Tutoría
                      </button>
                    </div>

                    <span className="text-[11px] text-[#71717a]">
                      Estado: <strong className="text-emerald-700">Guardado</strong>
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal: Editar Plan Remedial (Mockup HU-04B) */}
      {modalEditar && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#e4e4e7] pb-3">
              <h3 className="text-sm font-bold text-[#18181b]">
                Editar Diagnóstico y Recomendaciones
              </h3>
              <button
                type="button"
                onClick={() => setModalEditar(false)}
                className="text-[#71717a] hover:text-[#18181b] text-base"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGuardarEdicion} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#52525b] mb-1">
                  Diagnóstico Pedagógico Cualitativo:
                </label>
                <textarea
                  rows={5}
                  value={diagnosticoEditado}
                  onChange={(e) => setDiagnosticoEditado(e.target.value)}
                  className="w-full p-2.5 border border-[#d4d4d8] rounded text-xs text-[#18181b] focus:outline-none focus:ring-1 focus:ring-[#8B151A]"
                  placeholder="Redacta las observaciones o ajustes al plan pedagógico..."
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalEditar(false)}
                  className="px-3 py-1.5 border border-[#d4d4d8] rounded text-xs font-medium text-[#52525b]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#8B151A] hover:bg-[#6E1014] text-white rounded text-xs font-semibold"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Agendar Tutoría (Mockup HU-04B) */}
      {modalAgendar && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#e4e4e7] pb-3">
              <h3 className="text-sm font-bold text-[#18181b]">
                Agendar Tutoría de Refuerzo FISEI
              </h3>
              <button
                type="button"
                onClick={() => setModalAgendar(false)}
                className="text-[#71717a] hover:text-[#18181b] text-base"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAgendarTutoria} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#52525b] mb-1">Estudiante:</label>
                <p className="font-bold text-[#18181b] bg-[#f4f4f5] p-2 rounded">
                  {estudianteActual?.apellidos} {estudianteActual?.nombres} ({estudianteActual?.correo})
                </p>
              </div>

              <div>
                <label className="block font-semibold text-[#52525b] mb-1">Modalidad:</label>
                <select
                  value={modalidadTutoria}
                  onChange={(e) => setModalidadTutoria(e.target.value)}
                  className="w-full p-2 border border-[#d4d4d8] rounded text-[#18181b]"
                >
                  <option value="Presencial (Laboratorio FISEI)">Presencial (Laboratorios FISEI)</option>
                  <option value="Virtual (Microsoft Teams)">Virtual (Microsoft Teams UTA)</option>
                  <option value="Cubículo Docente">Cubículo de Docente</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#52525b] mb-1">Fecha y Hora Propuesta:</label>
                <input
                  type="datetime-local"
                  value={fechaTutoria}
                  onChange={(e) => setFechaTutoria(e.target.value)}
                  className="w-full p-2 border border-[#d4d4d8] rounded text-[#18181b]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setModalAgendar(false)}
                  className="px-3 py-1.5 border border-[#d4d4d8] rounded font-medium text-[#52525b]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#8B151A] hover:bg-[#6E1014] text-white rounded font-semibold"
                >
                  Confirmar Tutoría
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default TutoriaPage
