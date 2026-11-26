import { useState, useEffect, useMemo, useCallback } from 'react'
import clienteAxios from '../api/clienteAxios'
import { SearchAutocompleteInput } from '../components/SearchAutocompleteInput'
import { listarUsuarios, mensajeDeError, type UsuarioAdmin } from '../api/usuariosService'

interface LogAcceso {
  id: number
  usuarioId?: number
  emailIntentado?: string
  fechaRegistro: string
  exitoso: boolean
  detalle: string
  ipOrigen?: string
}

export function AdminAuditoriaPage() {
  const [logs, setLogs] = useState<LogAcceso[]>([])
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Momento de la consulta: referencia para contar los eventos de "hoy".
  const [consultadoEn, setConsultadoEn] = useState<Date | null>(null)
  const [filtroUsuario, setFiltroUsuario] = useState('')
  const [filtroResultado, setFiltroResultado] = useState('Todos')

  // Solo datos reales de LogsAcceso y de las cuentas; si la API falla se informa, no se inventan trazas.
  const consultar = useCallback(
    () =>
      Promise.all([clienteAxios.get<LogAcceso[]>('/auth/auditoria'), listarUsuarios()])
        .then(([{ data }, cuentas]) => {
          setLogs(data)
          setUsuarios(cuentas)
          setConsultadoEn(new Date())
          setError(null)
        })
        .catch((e: unknown) => {
          setLogs([])
          setUsuarios([])
          setError(mensajeDeError(e, 'No se pudo cargar la bitácora de auditoría. Verifique que la API esté disponible.'))
        })
        .finally(() => setCargando(false)),
    []
  )

  useEffect(() => {
    void consultar()
  }, [consultar])

  const cargarLogs = () => {
    setCargando(true)
    void consultar()
  }

  const kpis = useMemo(() => {
    const hoy = consultadoEn?.toDateString()
    const deHoy = logs.filter((l) => new Date(l.fechaRegistro).toDateString() === hoy)
    return {
      validosHoy: deHoy.filter((l) => l.exitoso).length,
      fallidosHoy: deHoy.filter((l) => !l.exitoso).length,
      // Estado actual de las cuentas (Status = 0 bloqueada, 1 activa), no un conteo de mensajes.
      cuentasBloqueadas: usuarios.filter((u) => u.status === 0).length,
      usuariosActivos: usuarios.filter((u) => u.status === 1).length,
    }
  }, [logs, usuarios, consultadoEn])

  const logsFiltrados = useMemo(() => {
    return logs.filter((l) => {
      const matchUsuario = (l.emailIntentado || '').toLowerCase().includes(filtroUsuario.toLowerCase())
      const matchRes =
        filtroResultado === 'Todos' ||
        (filtroResultado === 'Exitoso' && l.exitoso) ||
        (filtroResultado === 'Fallido' && !l.exitoso)
      return matchUsuario && matchRes
    })
  }, [logs, filtroUsuario, filtroResultado])

  return (
    <div className="space-y-5">
      {error && (
        <div role="alert" className="p-3.5 bg-[#f8f9fb] border-l-4 border-[#b91c1c] text-xs text-[#b91c1c] font-medium">
          {error}
        </div>
      )}

      {/* Franja de indicadores de seguridad */}
      <section className="stat-strip">
        <div className="stat-cell">
          <span className="stat-k">Accesos Válidos Hoy</span>
          <span className="stat-v text-[#15803d]">{kpis.validosHoy}</span>
          <div className="stat-note">Tokens JWT emitidos hoy</div>
        </div>

        <div className="stat-cell">
          <span className="stat-k">Intentos Fallidos Hoy</span>
          <span className="stat-v text-[#b45309]">{kpis.fallidosHoy}</span>
          <div className="stat-note">Credenciales rechazadas</div>
        </div>

        <div className="stat-cell">
          <span className="stat-k">Cuentas Bloqueadas (Status=0)</span>
          <span className="stat-v text-[#991b1b]">{kpis.cuentasBloqueadas}</span>
          <div className="stat-note">Bloqueo tras 3 fallos consecutivos</div>
        </div>

        <div className="stat-cell">
          <span className="stat-k">Usuarios Activos (Status=1)</span>
          <span className="stat-v">{kpis.usuariosActivos}</span>
          <div className="stat-note">En el sistema</div>
        </div>
      </section>

      {/* Barra de controles */}
      <div className="cadence-toolbar">
        <div className="toolbar-group">
          <div className="parcial-tabs" role="tablist" aria-label="Filtrar por resultado">
            {[
              { id: 'Todos', label: 'Todos los resultados' },
              { id: 'Exitoso', label: 'Exitosos' },
              { id: 'Fallido', label: 'Fallidos / Bloqueos' },
            ].map((op) => (
              <button
                key={op.id}
                type="button"
                role="tab"
                aria-selected={filtroResultado === op.id}
                onClick={() => setFiltroResultado(op.id)}
                className={`parcial-tab ${filtroResultado === op.id ? 'active' : ''}`}
              >
                {op.label}
              </button>
            ))}
          </div>
          <div className="w-[260px]">
            <SearchAutocompleteInput
              value={filtroUsuario}
              onSearch={setFiltroUsuario}
              suggestions={logs.map((l) => l.emailIntentado || '').filter(Boolean)}
              placeholder="Buscar por usuario o correo..."
            />
          </div>
        </div>
        <div className="toolbar-group">
          <button type="button" onClick={cargarLogs} className="btn-secondary">
            Actualizar Trazas
          </button>
        </div>
      </div>

      {/* Tabla de Auditoría */}
      <div className="table-card">
        <div className="overflow-x-auto">
          <table className="em-table">
            <thead>
              <tr>
                <th>Fecha y Hora</th>
                <th>Usuario / Identidad</th>
                <th>Evento / Detalle</th>
                <th>IP Origen</th>
                <th className="text-right">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[#71717a]">
                    Cargando bitácora de auditoría desde LogsAcceso...
                  </td>
                </tr>
              ) : logsFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[#71717a]">
                    {error
                      ? 'Bitácora no disponible.'
                      : logs.length === 0
                        ? 'Aún no hay eventos de acceso registrados.'
                        : 'No hay registros de auditoría que coincidan con el filtro.'}
                  </td>
                </tr>
              ) : (
                logsFiltrados.map((log) => {
                  const esBloqueo = log.detalle?.toLowerCase().includes('bloqueada')
                  return (
                    <tr key={log.id}>
                      <td className="text-[#52525b] whitespace-nowrap">
                        {new Date(log.fechaRegistro).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'medium' })}
                      </td>
                      <td className="font-semibold text-black">
                        {log.emailIntentado || `Usuario #${log.usuarioId}`}
                      </td>
                      <td className="text-[#3f3f46]">
                        {log.detalle}
                      </td>
                      <td className="font-mono text-[11px] text-[#71717a]">
                        {log.ipOrigen || '—'}
                      </td>
                      <td className="text-right">
                        {log.exitoso ? (
                          <span className="badge-clean ok">Exitoso</span>
                        ) : esBloqueo ? (
                          <span className="badge-clean bad">Bloqueo Seguridad</span>
                        ) : (
                          <span className="badge-clean warn">Fallido</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 bg-[#f8f9fb] border-t border-[#e5e7eb] flex items-center justify-between text-xs text-[#6b7280]">
          <span>
            Mostrando <strong className="text-black">{logsFiltrados.length}</strong> de los últimos {logs.length}{' '}
            eventos registrados (máximo 100)
          </span>
          <span>Seguridad Institucional FISEI</span>
        </div>
      </div>
    </div>
  )
}

export default AdminAuditoriaPage
