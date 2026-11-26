import { useCallback, useEffect, useState } from 'react'
import clienteAxios from '../api/clienteAxios'
import { mensajeDeError } from '../api/usuariosService'
import type { EstadoMoodleDto, LogSincronizacionDto, MateriaDto } from '../types/academico'

const OPERACIONES: Record<string, string> = {
  Cursos: 'Asignaturas del docente',
  Notas: 'Calificaciones y actividades',
}

function formatearFecha(iso: string | null | undefined): string {
  if (!iso) return 'Sin registro'
  const fecha = new Date(iso)
  return Number.isNaN(fecha.getTime())
    ? 'Sin registro'
    : fecha.toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' })
}

function claseEstado(log: LogSincronizacionDto): string {
  if (log.exitoso) return 'badge-clean ok'
  return log.estado === 'Iniciado' ? 'badge-clean warn' : 'badge-clean bad'
}

/**
 * Supervisión de la integración con Moodle para el administrador.
 * Todo lo que se muestra proviene de una consulta real: el estado se verifica contra
 * core_webservice_get_site_info y el historial sale de los registros de sincronización.
 * El token vive solo en la configuración del servidor y nunca llega al navegador.
 */
export function AdminMoodlePage() {
  const [estado, setEstado] = useState<EstadoMoodleDto | null>(null)
  const [logs, setLogs] = useState<LogSincronizacionDto[]>([])
  const [materias, setMaterias] = useState<MateriaDto[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const consultar = useCallback(
    () =>
      Promise.all([
        clienteAxios.get<EstadoMoodleDto>('/moodle/estado', { timeout: 45000 }),
        clienteAxios.get<LogSincronizacionDto[]>('/moodle/logs', { params: { limite: 30 } }),
        clienteAxios.get<MateriaDto[]>('/academico/materias'),
      ])
        .then(([rEstado, rLogs, rMaterias]) => {
          setEstado(rEstado.data)
          setLogs(rLogs.data)
          setMaterias(rMaterias.data)
          setError(null)
        })
        .catch((e: unknown) => {
          setError(mensajeDeError(e, 'No se pudo consultar el estado de la integración con Moodle.'))
        })
        .finally(() => setCargando(false)),
    []
  )

  useEffect(() => {
    // Carga inicial: el estado solo cambia cuando la petición se resuelve.
    void consultar()
  }, [consultar])

  const cargar = () => {
    setCargando(true)
    void consultar()
  }

  const vinculadas = materias.filter((m) => m.ultimaSincronizacion)

  return (
    <div className="space-y-5">
      {error && (
        <div role="alert" className="p-3.5 bg-[#f8f9fb] border-l-4 border-[#b91c1c] text-xs text-[#b91c1c] font-medium">
          {error}
        </div>
      )}

      <section className="stat-strip" aria-busy={cargando}>
        <div className="stat-cell">
          <span className="stat-k">Servicio web de Moodle</span>
          {estado ? (
            <span className={`stat-v text-base pt-1 ${estado.enLinea ? 'text-[#15803d]' : 'text-[#b91c1c]'}`}>
              {estado.enLinea ? 'EN LÍNEA' : 'SIN CONEXIÓN'}
            </span>
          ) : (
            <span className="stat-v text-base pt-1 text-[#52525b]">{cargando ? 'Verificando…' : 'Desconocido'}</span>
          )}
          <div className="stat-note">
            {estado?.enLinea
              ? `${estado.sitio ?? 'Moodle'} · versión ${estado.version ?? 's/d'}`
              : (estado?.error ?? 'Sin respuesta del servidor')}
          </div>
        </div>

        <div className="stat-cell">
          <span className="stat-k">Cuenta de servicio</span>
          <span className="stat-v text-base pt-1">
            {estado?.cuentaServicio ?? (estado && !estado.tokenConfigurado ? 'Token no configurado' : '—')}
          </span>
          <div className="stat-note">{estado ? estado.baseUrl : 'Moodle:BaseUrl'}</div>
        </div>

        <div className="stat-cell">
          <span className="stat-k">Última sincronización exitosa</span>
          <span className="stat-v text-base pt-1">{formatearFecha(estado?.ultimaSincronizacionExitosa)}</span>
          <div className="stat-note">Verificado {formatearFecha(estado?.consultadoEn)}</div>
        </div>

        <div className="stat-cell">
          <span className="stat-k">Vinculación</span>
          <span className="stat-v">{estado?.cursosVinculados ?? '—'}</span>
          <div className="stat-note">
            asignaturas · {estado?.docentesVinculados ?? '—'} docentes con usuario Moodle
          </div>
        </div>
      </section>

      <div className="em-card">
        <div className="em-card-head">
          <div>
            <h2 className="card-title">Conexión con Moodle (servicios web REST)</h2>
            <p className="card-sub">
              La URL y el token se definen en el servidor (variables MOODLE_BASE_URL y MOODLE_TOKEN) y no se
              exponen en el navegador.
            </p>
          </div>
          <div className="toolbar-group">
            <button type="button" onClick={cargar} disabled={cargando} className="btn-primary disabled:opacity-60">
              {cargando ? 'Verificando…' : 'Probar conexión'}
            </button>
          </div>
        </div>
        <div className="em-card-body">
          <p className="text-xs text-[#52525b] leading-relaxed">
            Cada docente sincroniza sus asignaturas y calificaciones desde su propia sesión (Catálogo o Evaluaciones),
            porque la sincronización se hace con su usuario Moodle vinculado. Desde aquí se supervisa que la integración
            responda y que las ingestas se completen.
          </p>
        </div>
      </div>

      <div className="table-card">
        <div className="table-toolbar">
          <h3 className="card-title">Vigencia de datos por asignatura</h3>
        </div>
        <table className="em-table">
          <thead>
            <tr>
              <th>Asignatura</th>
              <th>Período</th>
              <th className="text-right">Última ingesta de notas</th>
            </tr>
          </thead>
          <tbody>
            {materias.length === 0 ? (
              <tr>
                <td colSpan={3} className="text-[#52525b]">
                  {cargando ? 'Cargando…' : 'No hay asignaturas registradas.'}
                </td>
              </tr>
            ) : (
              materias.map((m) => (
                <tr key={m.id}>
                  <td className="font-semibold text-black">
                    {m.codigo} {m.nombre}
                  </td>
                  <td className="text-[#52525b]">{m.semestre}</td>
                  <td className="text-right">
                    {m.ultimaSincronizacion ? (
                      formatearFecha(m.ultimaSincronizacion)
                    ) : (
                      <span className="badge-clean warn">Nunca sincronizada</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {materias.length > 0 && (
          <p className="px-4 py-2 text-[11px] text-[#52525b]">
            {vinculadas.length} de {materias.length} asignaturas tienen al menos una ingesta de notas exitosa.
          </p>
        )}
      </div>

      <div className="table-card">
        <div className="table-toolbar">
          <h3 className="card-title">Registro de sincronizaciones</h3>
        </div>
        <table className="em-table">
          <thead>
            <tr>
              <th>Fecha y hora</th>
              <th>Operación</th>
              <th>Asignatura</th>
              <th>Docente</th>
              <th>Registros</th>
              <th className="text-right">Estado</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-[#52525b]">
                  {cargando ? 'Cargando…' : 'Todavía no se ha ejecutado ninguna sincronización.'}
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id}>
                  <td className="text-[#52525b]">{formatearFecha(log.fecha)}</td>
                  <td className="text-black">{OPERACIONES[log.operacion] ?? log.operacion}</td>
                  <td className="text-black">{log.curso ?? 'Todas las del docente'}</td>
                  <td className="text-[#52525b]">{log.docente ?? '—'}</td>
                  <td className="text-black tabular-nums">{log.exitoso ? log.totalRegistros : '—'}</td>
                  <td className="text-right">
                    <span className={claseEstado(log)} title={log.mensajeError ?? undefined}>
                      {log.exitoso ? 'Completado' : log.estado === 'Iniciado' ? 'En curso' : `Fallido (${log.mensajeError ?? 'error'})`}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default AdminMoodlePage
