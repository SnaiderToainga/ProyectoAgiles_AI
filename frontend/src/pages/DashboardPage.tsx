import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useChatIa } from '../context/ChatIaContext'
import clienteAxios from '../api/clienteAxios'
import { mensajeDeError } from '../api/usuariosService'
import { RendimientoBarChart, type PuntoTendencia } from '../components/RendimientoBarChart'
import { NOMBRE_COMPONENTE, type MateriaDto, type ResumenAcademicoEstudianteDto } from '../types/academico'
import { PrimeraSincronizacionMoodle } from '../components/PrimeraSincronizacionMoodle'
import { estaEvaluado, textoNotaFinal } from '../utils/estadoCalificacion'
import { FechaSincronizacionMoodle } from '../components/FechaSincronizacionMoodle'
import { AlertasAcademicasPanel } from '../components/AlertasAcademicasPanel'

interface ResumenMateria {
  materia: MateriaDto
  totalEstudiantes: number
  promedio: number
  enRiesgo: number
  estudiantes: ResumenAcademicoEstudianteDto[]
}

export function DashboardPage() {
  const { user } = useAuth()
  const {
    materiaActivaId: materiaContextoId,
    actualizarContextoChat,
    abrirChatConEstudiante,
  } = useChatIa()
  const [resumenes, setResumenes] = useState<ResumenMateria[]>([])
  const [materiasOriginales, setMateriasOriginales] = useState<MateriaDto[]>([])
  const [materiaActivaId, setMateriaActivaId] = useState<number | null>(null)
  const [cargando, setCargando] = useState(true)
  // Si la API no responde se informa el error: nunca se muestran estudiantes ni notas inventadas.
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  // Docente recién creado: aún no tiene materias importadas desde Moodle.
  const [sinMaterias, setSinMaterias] = useState(false)

  useEffect(() => {
    let vigente = true

    async function cargarDashboard() {
      try {
        const { data: materias } = await clienteAxios.get<MateriaDto[]>('/academico/materias')
        if (vigente) setMateriasOriginales(materias)
        if (materias.length === 0) {
          // Sin materias no se muestran datos de demostración: se ofrece la primera sincronización.
          if (vigente) {
            setResumenes([])
            setSinMaterias(true)
          }
          return
        }

        const resultados = await Promise.all(
          materias.map(async (materia) => {
            const parcial = materia.parciales.find((p) => p.numero === 1) || materia.parciales[0]
            if (!parcial) {
              return { materia, totalEstudiantes: 0, promedio: 0, enRiesgo: 0, estudiantes: [] }
            }

            try {
              const { data: estudiantes } = await clienteAxios.get<ResumenAcademicoEstudianteDto[]>(
                `/academico/materias/${materia.id}/parciales/${parcial.id}/rendimiento`
              )
              const totalEstudiantes = estudiantes.length
              // El promedio solo considera a quienes ya tienen actividades evaluadas.
              const evaluados = estudiantes.filter(estaEvaluado)
              const promedio =
                evaluados.length > 0
                  ? evaluados.reduce((acc, e) => acc + e.notaFinalParcial, 0) / evaluados.length
                  : 0
              const enRiesgo = estudiantes.filter((e) => e.enRiesgo).length
              return { materia, totalEstudiantes, promedio, enRiesgo, estudiantes }
            } catch {
              return { materia, totalEstudiantes: 0, promedio: 0, enRiesgo: 0, estudiantes: [] }
            }
          })
        )

        if (vigente) {
          setResumenes(resultados)
          setMateriaActivaId(resultados[0].materia.id)
          setErrorCarga(null)
        }
      } catch (e) {
        if (vigente) {
          setResumenes([])
          setErrorCarga(mensajeDeError(e, 'No se pudo cargar el rendimiento académico. Verifique que la API esté disponible.'))
        }
      } finally {
        if (vigente) setCargando(false)
      }
    }

    cargarDashboard()
    return () => {
      vigente = false
    }
  }, [])

  const [parcialNum, setParcialNum] = useState(1)
  const [rendimientoExtra, setRendimientoExtra] = useState<{
    clave: string
    lista: ResumenAcademicoEstudianteDto[]
  } | null>(null)

  const resumenSeleccionado = useMemo(() => {
    if (!materiaActivaId && resumenes.length > 0) return resumenes[0]
    return resumenes.find((r) => r.materia.id === materiaActivaId) || resumenes[0] || null
  }, [resumenes, materiaActivaId])

  // Sincroniza la asignatura elegida en el menú lateral con el Dashboard.
  useEffect(() => {
    if (materiaContextoId && resumenes.some((r) => r.materia.id === materiaContextoId)) {
      setMateriaActivaId(materiaContextoId)
    }
  }, [materiaContextoId, resumenes])

  const parcialCargado = useMemo(() => {
    if (!resumenSeleccionado) return null
    const ps = resumenSeleccionado.materia.parciales
    return ps.find((p) => p.numero === 1) || ps[0] || null
  }, [resumenSeleccionado])

  const parcialActual = useMemo(() => {
    if (!resumenSeleccionado) return null
    const ps = resumenSeleccionado.materia.parciales
    return ps.find((p) => p.numero === parcialNum) || ps[0] || null
  }, [resumenSeleccionado, parcialNum])

  const claveParcial =
    resumenSeleccionado && parcialActual ? `${resumenSeleccionado.materia.id}-${parcialActual.id}` : ''

  useEffect(() => {
    if (!resumenSeleccionado || !parcialActual || !parcialCargado) return
    if (parcialActual.id === parcialCargado.id) return
    let vigente = true
    clienteAxios
      .get<ResumenAcademicoEstudianteDto[]>(
        `/academico/materias/${resumenSeleccionado.materia.id}/parciales/${parcialActual.id}/rendimiento`
      )
      .then(({ data }) => {
        if (vigente) setRendimientoExtra({ clave: claveParcial, lista: data })
      })
      .catch(() => {
        if (vigente) setRendimientoExtra({ clave: claveParcial, lista: [] })
      })
    return () => {
      vigente = false
    }
  }, [resumenSeleccionado, parcialActual, parcialCargado, claveParcial])

  const estudiantesParaGrafico = useMemo(() => {
    if (!resumenSeleccionado || !parcialActual || !parcialCargado) return []
    if (parcialActual.id === parcialCargado.id) return resumenSeleccionado.estudiantes
    return rendimientoExtra?.clave === claveParcial ? rendimientoExtra.lista : []
  }, [resumenSeleccionado, parcialActual, parcialCargado, rendimientoExtra, claveParcial])

  useEffect(() => {
    if (cargando) return
    const mapaRendimientos: Record<number, ResumenAcademicoEstudianteDto[]> = {}
    for (const r of resumenes) {
      mapaRendimientos[r.materia.id] = r.estudiantes
    }
    actualizarContextoChat({
      materias: materiasOriginales,
      materiaId: materiaActivaId,
      estudiantes: estudiantesParaGrafico,
      rendimientosPorMateria: mapaRendimientos,
      esModoFallback: false,
    })
  }, [
    cargando,
    resumenes,
    materiasOriginales,
    materiaActivaId,
    estudiantesParaGrafico,
    actualizarContextoChat,
  ])

  const actividades = useMemo(() => {
    const mapa = new Map<number, { id: number; nombre: string; tipo: number; notas: number[] }>()
    for (const est of estudiantesParaGrafico) {
      for (const comp of est.componentes) {
        for (const ev of comp.evaluaciones) {
          const item = mapa.get(ev.itemEvaluacionId) ?? {
            id: ev.itemEvaluacionId,
            nombre: ev.nombre,
            tipo: ev.tipo,
            notas: [] as number[],
          }
          if (ev.nota !== null) item.notas.push(ev.nota)
          mapa.set(ev.itemEvaluacionId, item)
        }
      }
    }
    return [...mapa.values()]
  }, [estudiantesParaGrafico])

  const tendencia: PuntoTendencia[] = useMemo(
    () =>
      actividades
        .filter((a) => a.notas.length > 0)
        .map((a) => ({
          nombre: a.nombre,
          promedio: a.notas.reduce((x, y) => x + y, 0) / a.notas.length,
        })),
    [actividades]
  )

  const resumen = useMemo(() => {
    const total = estudiantesParaGrafico.length
    const evaluados = estudiantesParaGrafico.filter(estaEvaluado)
    // Promedio por componente solo entre quienes tienen ese componente evaluado (no cuenta 0 por ausencia).
    const prom = (tipo: number) => {
      const vals = evaluados
        .map((e) => e.componentes.find((c) => c.tipo === tipo))
        .filter((c) => c !== undefined && c.evaluado !== false)
        .map((c) => c!.promedioComponente)
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
    }
    const promedio =
      evaluados.length > 0 ? evaluados.reduce((a, e) => a + e.notaFinalParcial, 0) / evaluados.length : 0
    const aprobados = evaluados.filter((e) => e.notaFinalParcial >= 7).length
    const riesgo = evaluados
      .filter((e) => e.enRiesgo || e.notaFinalParcial < 7)
      .sort((a, b) => a.notaFinalParcial - b.notaFinalParcial)
    return {
      total,
      evaluados: evaluados.length,
      promedio,
      aprobados,
      pctAprob: evaluados.length > 0 ? Math.round((aprobados / evaluados.length) * 100) : 0,
      riesgo,
      criticos: riesgo.filter((e) => e.notaFinalParcial < 4).length,
      t: prom(1).toFixed(2),
      a: prom(2).toFixed(2),
      e: prom(3).toFixed(2),
    }
  }, [estudiantesParaGrafico])

  const compNota = (est: ResumenAcademicoEstudianteDto, tipo: number) => {
    const comp = est.componentes.find((c) => c.tipo === tipo)
    return comp && comp.evaluado !== false ? comp.promedioComponente.toFixed(2) : '—'
  }

  if (!cargando && sinMaterias) {
    return (
      <div className="space-y-4 min-w-0">
        <div className="cadence-header">
          <h1 className="cadence-title">Bienvenido, {user?.nombreCompleto || 'Docente'}</h1>
        </div>
        <PrimeraSincronizacionMoodle />
      </div>
    )
  }

  return (
    <div className="space-y-4 min-w-0">
      <div className="cadence-header">
        <h1 className="cadence-title">Bienvenido, {user?.nombreCompleto || 'Docente'}</h1>
        {resumenSeleccionado && (
          <div className="parcial-tabs">
            {resumenSeleccionado.materia.parciales.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`parcial-tab ${parcialActual?.numero === p.numero ? 'active' : ''}`}
                onClick={() => setParcialNum(p.numero)}
              >
                Parcial {p.numero}
              </button>
            ))}
          </div>
        )}
      </div>

      {errorCarga && (
        <div role="alert" className="p-3 bg-[#fafafa] border-l-4 border-[#b91c1c] text-xs text-[#b91c1c]">
          {errorCarga}
        </div>
      )}

      {resumenSeleccionado && (
        <FechaSincronizacionMoodle fecha={resumenSeleccionado.materia.ultimaSincronizacion} />
      )}

      <section className="stat-strip">
        <div className="stat-cell">
          <span className="stat-k">Estudiantes</span>
          <span className="stat-v">{cargando ? '...' : resumen.total}</span>
          <div className="stat-note">
            {actividades.length} actividades en Parcial {parcialActual?.numero ?? 1}
            {resumen.total > resumen.evaluados && ` · ${resumen.total - resumen.evaluados} sin evaluaciones`}
          </div>
        </div>
        <div className="stat-cell">
          <span className="stat-k">Promedio</span>
          <span className="stat-v">
            {resumen.evaluados > 0 ? resumen.promedio.toFixed(2) : '—'}
            {resumen.evaluados > 0 && <span style={{ fontSize: 12, fontWeight: 500 }}>/10</span>}
          </span>
          <div className="stat-note tabular-nums">
            {resumen.evaluados > 0 ? `T ${resumen.t} · A ${resumen.a} · E ${resumen.e}` : 'Sin notas calificadas'}
          </div>
        </div>
        <div className="stat-cell">
          <span className="stat-k">Aprobación</span>
          <span className="stat-v" style={{ color: 'var(--green)' }}>
            {resumen.evaluados > 0 ? `${resumen.pctAprob}%` : '—'}
          </span>
          <div className="stat-note">
            {resumen.aprobados} de {resumen.evaluados} evaluados aprobados
          </div>
        </div>
        <div className="stat-cell">
          <span className="stat-k">En riesgo (&lt; 7.00)</span>
          <span className="stat-v" style={{ color: resumen.riesgo.length ? 'var(--uta)' : '#000' }}>
            {resumen.riesgo.length}
          </span>
          <div className="stat-note">
            {resumen.criticos} crítico{resumen.criticos === 1 ? '' : 's'} (&lt; 4.00)
          </div>
        </div>
      </section>

      <section className="dash-grid-mid">
        <RendimientoBarChart
          estudiantes={estudiantesParaGrafico}
          materiaNombre={resumenSeleccionado?.materia.nombre}
          cargando={cargando}
          tendencia={tendencia}
          onSeleccionarEstudiante={(est) => abrirChatConEstudiante(est, resumenSeleccionado?.materia.id)}
        />

        <div className="em-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="em-card-head">
            <h2 className="card-title">Actividades Evaluadas · Parcial {parcialActual?.numero ?? 1}</h2>
            <Link to="/evaluaciones" className="link-btn">
              Ver matriz →
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
            {actividades.length === 0 ? (
              <p className="text-xs text-black">Aún no hay actividades publicadas en este parcial.</p>
            ) : (
              actividades.map((ev) => {
                const avg = ev.notas.length ? ev.notas.reduce((a, b) => a + b, 0) / ev.notas.length : 0
                return (
                  <div key={ev.id} className="list-row">
                    <div style={{ minWidth: 0 }}>
                      <div className="k-name">{ev.nombre}</div>
                      <div className="k-sub">
                        {NOMBRE_COMPONENTE[ev.tipo as 1 | 2 | 3] ?? 'Sin clasificar'} · {ev.notas.length}/
                        {resumen.total} entregas
                      </div>
                    </div>
                    <span className={`badge-clean tabular-nums ${avg < 7 ? 'risk' : 'neutral'}`}>
                      {avg.toFixed(2)}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </section>

      <section className="table-card">
        <div className="table-toolbar">
          <div>
            <span className="card-title">Estudiantes en Riesgo ({resumen.riesgo.length})</span>
            <span style={{ fontSize: 12, marginLeft: 10 }}>
              Promedio menor a 7.00 en Parcial {parcialActual?.numero ?? 1}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link to="/evaluaciones" className="btn-secondary">
              Exportar Matriz PDF
            </Link>
            <Link to="/tutoria" className="btn-primary">
              Abrir Tutoría
            </Link>
          </div>
        </div>

        {resumen.riesgo.length === 0 ? (
          <p className="p-5 text-xs text-black">No hay estudiantes por debajo de 7.00 en este parcial.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="em-table">
              <thead>
                <tr>
                  <th>Estudiante</th>
                  <th>Tema Crítico</th>
                  <th className="num-col">Tareas 30%</th>
                  <th className="num-col">APE 30%</th>
                  <th className="num-col">Examen 40%</th>
                  <th className="num-col">Nota Final</th>
                  <th className="num-col">Acción</th>
                </tr>
              </thead>
              <tbody>
                {resumen.riesgo.map((est) => (
                  <tr key={est.estudianteId}>
                    <td style={{ fontWeight: 600 }}>
                      {est.apellidos} {est.nombres}
                    </td>
                    <td style={{ fontSize: 12.5 }}>
                      {est.temasDeficientes[0]?.nombreTema || 'Evaluación parcial'}
                    </td>
                    <td className="num-col tabular-nums">{compNota(est, 1)}</td>
                    <td className="num-col tabular-nums">{compNota(est, 2)}</td>
                    <td className="num-col tabular-nums">{compNota(est, 3)}</td>
                    <td className="num-col">
                      <span className="badge-clean risk tabular-nums">{textoNotaFinal(est)}</span>
                    </td>
                    <td className="num-col">
                      <Link
                        to={`/tutoria?materia=${resumenSeleccionado?.materia.id || 1}&estudiante=${est.estudianteId}`}
                        className="link-btn"
                        style={{ marginRight: 10 }}
                      >
                        Tutoría
                      </Link>
                      <button
                        type="button"
                        className="link-btn"
                        style={{ color: 'var(--uta)' }}
                        onClick={() => abrirChatConEstudiante(est, resumenSeleccionado?.materia.id)}
                      >
                        IA
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {resumenSeleccionado && parcialActual && (
        <AlertasAcademicasPanel
          key={`${resumenSeleccionado.materia.id}-${parcialActual.id}`}
          materiaId={resumenSeleccionado.materia.id}
          parcialId={parcialActual.id}
          parcialNumero={parcialActual.numero}
        />
      )}
    </div>
  )
}

export default DashboardPage
