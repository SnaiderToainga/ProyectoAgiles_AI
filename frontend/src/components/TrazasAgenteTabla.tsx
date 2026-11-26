import { Fragment, useCallback, useEffect, useState } from 'react'
import clienteAxios from '../api/clienteAxios'
import { mensajeDeError } from '../api/usuariosService'
import type { TrazaAgenteDto } from '../types/academico'

const HERRAMIENTAS: Record<string, string> = {
  consultar_resumen_curso: 'Resumen del curso',
  listar_estudiantes_en_riesgo: 'Estudiantes en riesgo',
  analizar_temas_y_actividades: 'Temas y actividades',
  identificar_alertas: 'Alertas académicas',
  diagnosticar_estudiante: 'Diagnóstico individual',
}

/** Traza auditable del agente pedagógico (sección 7 / RF-12): consulta, herramientas, parámetros y fallos. */
export function TrazasAgenteTabla() {
  const [trazas, setTrazas] = useState<TrazaAgenteDto[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [abierta, setAbierta] = useState<number | null>(null)

  const consultar = useCallback(
    () =>
      clienteAxios
        .get<TrazaAgenteDto[]>('/academico/agente/trazas', { params: { limite: 30 } })
        .then(({ data }) => {
          setTrazas(data)
          setError(null)
        })
        .catch((e: unknown) => setError(mensajeDeError(e, 'No se pudieron cargar las trazas del agente.')))
        .finally(() => setCargando(false)),
    []
  )

  useEffect(() => {
    void consultar()
  }, [consultar])

  return (
    <div className="table-card">
      <div className="table-toolbar">
        <h3 className="card-title">Trazas del agente pedagógico</h3>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            setCargando(true)
            void consultar()
          }}
        >
          Actualizar
        </button>
      </div>
      {error && <p className="px-4 py-2 text-xs text-[#b91c1c]">{error}</p>}
      <div className="overflow-x-auto">
        <table className="em-table">
          <thead>
            <tr>
              <th>Fecha y hora</th>
              <th>Docente</th>
              <th>Asignatura</th>
              <th>Consulta (anonimizada)</th>
              <th>Herramientas invocadas</th>
              <th className="text-right">Resultado</th>
            </tr>
          </thead>
          <tbody>
            {trazas.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-[#71717a]">
                  {cargando ? 'Cargando trazas…' : 'Aún no hay consultas registradas al agente.'}
                </td>
              </tr>
            ) : (
              trazas.map((t) => (
                <Fragment key={t.id}>
                  <tr className="cursor-pointer" onClick={() => setAbierta(abierta === t.id ? null : t.id)}>
                    <td className="text-[#52525b] whitespace-nowrap">
                      {new Date(t.fecha).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'medium' })}
                    </td>
                    <td className="text-black">{t.usuario ?? `Usuario #${t.usuarioId}`}</td>
                    <td className="text-[#52525b]">{t.curso ?? '—'}</td>
                    <td className="text-[#3f3f46] max-w-[280px] truncate" title={t.consulta}>
                      {t.consulta}
                    </td>
                    <td className="text-[#3f3f46]">
                      {t.pasos.length === 0 ? '—' : t.pasos.map((p) => HERRAMIENTAS[p.herramienta] ?? p.herramienta).join(', ')}
                    </td>
                    <td className="text-right whitespace-nowrap">
                      {!t.exitoso ? (
                        <span className="badge-clean bad" title={t.error ?? undefined}>
                          Fallida
                        </span>
                      ) : t.esFallback ? (
                        <span className="badge-clean warn">Motor local</span>
                      ) : (
                        <span className="badge-clean ok">{t.modelo ?? 'Modelo'}</span>
                      )}
                    </td>
                  </tr>
                  {abierta === t.id && (
                    <tr>
                      <td colSpan={6} className="bg-[#f8f9fb]">
                        <ol className="space-y-1 text-[11px] text-[#3f3f46] list-decimal pl-5">
                          {t.pasos.map((p, i) => (
                            <li key={i}>
                              <b>{HERRAMIENTAS[p.herramienta] ?? p.herramienta}</b> · {p.duracionMs} ms ·{' '}
                              {p.exito ? 'correcta' : `fallo: ${p.error ?? 'sin detalle'}`}
                              <div className="font-mono text-[10px] text-[#71717a] break-all">
                                Parámetros: {p.parametros ?? '{}'}
                              </div>
                            </li>
                          ))}
                          {t.pasos.length === 0 && <li>Sin herramientas ejecutadas{t.error ? `: ${t.error}` : ''}.</li>}
                        </ol>
                        <div className="text-[10px] text-[#71717a] pt-1">Duración total: {t.duracionMs} ms</div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
