import { useState, useEffect, useMemo, useCallback, type FormEvent } from 'react'
import {
  crearUsuario,
  desbloquearUsuario,
  listarUsuarios,
  mensajeDeError,
  vincularMoodle,
  type RolUsuario,
  type UsuarioAdmin,
  type VinculoMoodle,
} from '../api/usuariosService'
import { SearchAutocompleteInput } from '../components/SearchAutocompleteInput'

interface Aviso {
  tipo: 'exito' | 'advertencia' | 'error'
  texto: string
}

const ESTILO_AVISO: Record<Aviso['tipo'], string> = {
  exito: 'bg-emerald-50 border-emerald-600 text-emerald-800',
  advertencia: 'bg-amber-50 border-amber-500 text-amber-800',
  error: 'bg-red-50 border-red-600 text-red-800',
}

const CAMPO = 'w-full px-3 py-2 border border-[#d4d4d8] rounded text-xs focus:outline-none focus:border-[#8B151A]'

/** Requisitos de contraseña: los mismos que valida la API. */
function problemasPassword(password: string): string[] {
  const faltan: string[] = []
  if (password.length < 10) faltan.push('10 caracteres')
  if (!/[A-ZÁÉÍÓÚÑ]/.test(password)) faltan.push('una mayúscula')
  if (!/[a-záéíóúñ]/.test(password)) faltan.push('una minúscula')
  if (!/\d/.test(password)) faltan.push('un número')
  if (!/[^A-Za-z0-9ÁÉÍÓÚÑáéíóúñ]/.test(password)) faltan.push('un símbolo')
  return faltan
}

function resumenVinculo(v: VinculoMoodle): Aviso {
  if (v.moodleUserId === null) return { tipo: 'advertencia', texto: v.advertencia ?? 'Cuenta desenlazada de Moodle.' }
  if (v.advertencia) return { tipo: 'advertencia', texto: `Enlazado con el usuario ${v.moodleUserId} de Moodle. ${v.advertencia}` }
  const nombre = v.nombreMoodle ? ` (${v.nombreMoodle})` : ''
  return {
    tipo: 'exito',
    texto: `Enlazado con el usuario ${v.moodleUserId} de Moodle${nombre}. Cursos del período: ${v.cursosMoodle.join('; ')}.`,
  }
}

export function AdminUsuariosPage() {
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtroRol, setFiltroRol] = useState('Todos')
  const [aviso, setAviso] = useState<Aviso | null>(null)

  // Modal: nuevo usuario
  const [modalNuevo, setModalNuevo] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoEmail, setNuevoEmail] = useState('')
  const [nuevoUsername, setNuevoUsername] = useState('')
  const [nuevoPassword, setNuevoPassword] = useState('')
  const [nuevoConfirmacion, setNuevoConfirmacion] = useState('')
  const [nuevoRol, setNuevoRol] = useState<RolUsuario>('Docente')
  const [nuevoMoodleId, setNuevoMoodleId] = useState('')
  const [errorNuevo, setErrorNuevo] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  // Modal: enlace con Moodle
  const [modalMoodle, setModalMoodle] = useState<UsuarioAdmin | null>(null)
  const [moodleId, setMoodleId] = useState('')
  const [errorMoodle, setErrorMoodle] = useState<string | null>(null)

  const cargarUsuarios = useCallback(async () => {
    setCargando(true)
    setErrorCarga(null)
    try {
      setUsuarios(await listarUsuarios())
    } catch (error) {
      setUsuarios([])
      setErrorCarga(mensajeDeError(error, 'No se pudieron cargar las cuentas. Verifique la conexión con el API Gateway.'))
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargarUsuarios()
  }, [cargarUsuarios])

  const desbloquear = async (usuario: UsuarioAdmin) => {
    try {
      await desbloquearUsuario(usuario.id)
      setAviso({ tipo: 'exito', texto: `Cuenta de ${usuario.nombreCompleto} desbloqueada.` })
      await cargarUsuarios()
    } catch (error) {
      setAviso({ tipo: 'error', texto: mensajeDeError(error, 'No se pudo desbloquear la cuenta.') })
    }
  }

  const abrirNuevo = () => {
    setNuevoNombre('')
    setNuevoEmail('')
    setNuevoUsername('')
    setNuevoPassword('')
    setNuevoConfirmacion('')
    setNuevoRol('Docente')
    setNuevoMoodleId('')
    setErrorNuevo(null)
    setModalNuevo(true)
  }

  const faltanPassword = problemasPassword(nuevoPassword)

  const handleCrearUsuario = async (e: FormEvent) => {
    e.preventDefault()
    setErrorNuevo(null)
    if (faltanPassword.length > 0) {
      setErrorNuevo(`La contraseña necesita: ${faltanPassword.join(', ')}.`)
      return
    }
    if (nuevoPassword !== nuevoConfirmacion) {
      setErrorNuevo('Las contraseñas no coinciden.')
      return
    }
    const moodleUserId = nuevoRol === 'Docente' && nuevoMoodleId.trim() ? Number(nuevoMoodleId) : null
    if (moodleUserId !== null && (!Number.isInteger(moodleUserId) || moodleUserId <= 0)) {
      setErrorNuevo('El ID de Moodle debe ser un número entero positivo.')
      return
    }

    setGuardando(true)
    try {
      const resultado = await crearUsuario({
        nombreCompleto: nuevoNombre.trim(),
        email: nuevoEmail.trim(),
        username: nuevoUsername.trim() || undefined,
        password: nuevoPassword,
        rol: nuevoRol,
        moodleUserId,
      })
      setModalNuevo(false)
      const base = `Cuenta de ${resultado.usuario.nombreCompleto} creada (usuario ${resultado.usuario.username}).`
      if (resultado.moodle) {
        const detalle = resumenVinculo(resultado.moodle)
        setAviso({ tipo: detalle.tipo, texto: `${base} ${detalle.texto}` })
      } else {
        setAviso({ tipo: 'exito', texto: base })
      }
      await cargarUsuarios()
    } catch (error) {
      setErrorNuevo(mensajeDeError(error, 'No se pudo crear la cuenta.'))
    } finally {
      setGuardando(false)
    }
  }

  const abrirMoodle = (usuario: UsuarioAdmin) => {
    setModalMoodle(usuario)
    setMoodleId(usuario.moodleUserId ? String(usuario.moodleUserId) : '')
    setErrorMoodle(null)
  }

  const guardarMoodle = async (desenlazar: boolean) => {
    if (!modalMoodle) return
    setErrorMoodle(null)
    const valor = desenlazar ? null : Number(moodleId)
    if (valor !== null && (!Number.isInteger(valor) || valor <= 0)) {
      setErrorMoodle('Ingrese el ID numérico del usuario en Moodle.')
      return
    }
    setGuardando(true)
    try {
      const resultado = await vincularMoodle(modalMoodle.id, valor)
      setModalMoodle(null)
      setAviso(resumenVinculo(resultado))
      await cargarUsuarios()
    } catch (error) {
      setErrorMoodle(mensajeDeError(error, 'No se pudo guardar el enlace con Moodle.'))
    } finally {
      setGuardando(false)
    }
  }

  const usuariosFiltrados = useMemo(() => {
    const texto = busqueda.toLowerCase()
    return usuarios.filter((u) => {
      const coincideTexto = u.nombreCompleto.toLowerCase().includes(texto) || u.email.toLowerCase().includes(texto)
      const coincideRol = filtroRol === 'Todos' || u.rol === filtroRol
      return coincideTexto && coincideRol
    })
  }, [usuarios, busqueda, filtroRol])

  return (
    <div className="space-y-6">
      {/* Franja de indicadores del directorio */}
      <section className="stat-strip">
        <div className="stat-cell">
          <span className="stat-k">Total Usuarios</span>
          <span className="stat-v">{usuarios.length}</span>
          <div className="stat-note">Directorio Institucional UTA</div>
        </div>
        <div className="stat-cell">
          <span className="stat-k">Cuentas Activas (Status=1)</span>
          <span className="stat-v text-[#15803d]">
            {usuarios.filter((u) => u.status === 1 && u.intentosFallidos < 3).length}
          </span>
          <div className="stat-note">Acceso habilitado</div>
        </div>
        <div className="stat-cell">
          <span className="stat-k">Cuentas Bloqueadas (Status=0)</span>
          <span className="stat-v text-[#8B151A]">
            {usuarios.filter((u) => u.status !== 1 || u.intentosFallidos >= 3).length}
          </span>
          <div className="stat-note">3 fallos consecutivos</div>
        </div>
        <div className="stat-cell">
          <span className="stat-k">Administradores</span>
          <span className="stat-v">
            {usuarios.filter((u) => u.rol === 'Administrador').length}
          </span>
          <div className="stat-note">
            {usuarios.filter((u) => u.rol !== 'Administrador').length} docentes
          </div>
        </div>
      </section>

      {aviso && (
        <div role="alert" className={`p-3 border-l-4 text-xs font-medium flex justify-between gap-3 ${ESTILO_AVISO[aviso.tipo]}`}>
          <span>{aviso.texto}</span>
          <button type="button" onClick={() => setAviso(null)} className="opacity-70 hover:opacity-100" aria-label="Cerrar aviso">
            ✕
          </button>
        </div>
      )}

      {/* Barra de controles */}
      <div className="cadence-toolbar">
        <div className="toolbar-group">
          <div className="parcial-tabs" role="tablist" aria-label="Filtrar por rol">
            {(['Todos', 'Docente', 'Administrador'] as const).map((rol) => (
              <button
                key={rol}
                type="button"
                role="tab"
                aria-selected={filtroRol === rol}
                onClick={() => setFiltroRol(rol)}
                className={`parcial-tab ${filtroRol === rol ? 'active' : ''}`}
              >
                {rol}
              </button>
            ))}
          </div>
          <div className="w-[260px]">
            <SearchAutocompleteInput
              value={busqueda}
              onSearch={setBusqueda}
              suggestions={usuarios.flatMap((u) => [u.nombreCompleto, u.email])}
              placeholder="Buscar por nombre o correo..."
            />
          </div>
        </div>
        <div className="toolbar-group">
          <button type="button" onClick={abrirNuevo} className="btn-primary">
            + Nuevo Usuario
          </button>
        </div>
      </div>

      {/* Tabla de Usuarios */}
      <div className="table-card">
        <div className="overflow-x-auto">
          <table className="em-table">
            <thead>
              <tr>
                <th>Nombre Completo</th>
                <th>Correo Institucional</th>
                <th>Rol</th>
                <th>Moodle</th>
                <th>Estado</th>
                <th className="text-center">Intentos Fallidos</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-[#71717a]">Cargando cuentas de usuario...</td>
                </tr>
              ) : errorCarga ? (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-[#991b1b]" role="alert">{errorCarga}</td>
                </tr>
              ) : usuariosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-[#71717a]">
                    No se encontraron usuarios con los criterios de búsqueda.
                  </td>
                </tr>
              ) : (
                usuariosFiltrados.map((u) => {
                  const estaBloqueado = u.status === 0 || u.intentosFallidos >= 3
                  const esDocente = u.rol === 'Docente'
                  return (
                    <tr key={u.id}>
                      <td className="font-semibold text-black">{u.nombreCompleto}</td>
                      <td className="text-[#52525b]">{u.email}</td>
                      <td className="text-black font-medium">{u.rol}</td>
                      <td>
                        {!esDocente ? (
                          <span className="text-[#a1a1aa]">—</span>
                        ) : u.moodleUserId ? (
                          <span className="badge-clean ok">ID {u.moodleUserId}</span>
                        ) : (
                          <span className="badge-clean warn">Sin enlazar</span>
                        )}
                      </td>
                      <td>
                        {estaBloqueado ? (
                          <span className="badge-clean bad">Bloqueado</span>
                        ) : (
                          <span className="badge-clean ok">Activo</span>
                        )}
                      </td>
                      <td className="text-center font-semibold">
                        <span className={u.intentosFallidos >= 3 ? 'text-[#991b1b]' : 'text-[#52525b]'}>{u.intentosFallidos}</span>
                      </td>
                      <td className="text-right space-x-3 whitespace-nowrap">
                        {esDocente && (
                          <button
                            type="button"
                            onClick={() => abrirMoodle(u)}
                            className="link-btn"
                          >
                            {u.moodleUserId ? 'Cambiar enlace Moodle' : 'Enlazar Moodle'}
                          </button>
                        )}
                        {estaBloqueado && (
                          <button
                            type="button"
                            onClick={() => desbloquear(u)}
                            className="link-btn text-[#991b1b] font-semibold"
                          >
                            Desbloquear
                          </button>
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
          <span>Total: <strong className="text-black">{usuarios.length}</strong> usuarios registrados en el sistema</span>
          <span>Directorio Institucional UTA</span>
        </div>
      </div>

      {/* Recuadro de Política Institucional */}
      <div className="p-4 bg-[#f8f9fb] border border-[#e5e7eb] text-xs text-[#52525b] space-y-1">
        <p className="font-bold text-black">Política de Seguridad Institucional (FISEI - UTA):</p>
        <p>
          Las contraseñas se guardan cifradas (PBKDF2) y exigen al menos 10 caracteres con mayúscula, minúscula, número y
          símbolo. Las cuentas se bloquean al 3er fallo consecutivo de autenticación. Cada docente se enlaza con su usuario
          de Moodle para sincronizar únicamente sus propios cursos.
        </p>
      </div>

      {/* Modal: Nuevo Usuario */}
      {modalNuevo && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-md border border-[#e4e4e7] max-w-md w-full overflow-hidden shadow-lg max-h-[92vh] overflow-y-auto">
            <div className="bg-[#8B151A] px-5 py-3 text-white flex items-center justify-between">
              <h2 className="text-sm font-bold">Registrar Nuevo Usuario</h2>
              <button type="button" onClick={() => setModalNuevo(false)} className="text-white/80 hover:text-white text-base leading-none" aria-label="Cerrar">
                ✕
              </button>
            </div>
            <form onSubmit={handleCrearUsuario} className="p-5 space-y-3 text-xs">
              <div>
                <label htmlFor="nuevo-nombre" className="block font-semibold text-[#18181b] mb-1">Nombre Completo (*)</label>
                <input id="nuevo-nombre" type="text" required value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)}
                  placeholder="Ej: Ing. Marcelo Fernando López" className={CAMPO} />
              </div>

              <div>
                <label htmlFor="nuevo-email" className="block font-semibold text-[#18181b] mb-1">Correo Institucional (*)</label>
                <input id="nuevo-email" type="email" required value={nuevoEmail} onChange={(e) => setNuevoEmail(e.target.value)}
                  placeholder="m.lopez@uta.edu.ec" className={CAMPO} />
              </div>

              <div>
                <label htmlFor="nuevo-username" className="block font-semibold text-[#18181b] mb-1">Usuario (opcional)</label>
                <input id="nuevo-username" type="text" value={nuevoUsername} onChange={(e) => setNuevoUsername(e.target.value)}
                  placeholder="Por defecto, la parte del correo antes de @" className={CAMPO} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="nuevo-password" className="block font-semibold text-[#18181b] mb-1">Contraseña (*)</label>
                  <input id="nuevo-password" type="password" required autoComplete="new-password" value={nuevoPassword}
                    onChange={(e) => setNuevoPassword(e.target.value)} className={CAMPO} />
                </div>
                <div>
                  <label htmlFor="nuevo-confirmacion" className="block font-semibold text-[#18181b] mb-1">Confirmar (*)</label>
                  <input id="nuevo-confirmacion" type="password" required autoComplete="new-password" value={nuevoConfirmacion}
                    onChange={(e) => setNuevoConfirmacion(e.target.value)} className={CAMPO} />
                </div>
              </div>
              {nuevoPassword && faltanPassword.length > 0 && (
                <p className="text-[11px] text-amber-700">Falta: {faltanPassword.join(', ')}.</p>
              )}

              <div>
                <label htmlFor="nuevo-rol" className="block font-semibold text-[#18181b] mb-1">Rol Asignado (*)</label>
                <select id="nuevo-rol" value={nuevoRol} onChange={(e) => setNuevoRol(e.target.value as RolUsuario)}
                  className={`${CAMPO} bg-white`}>
                  <option value="Docente">Docente</option>
                  <option value="Administrador">Administrador</option>
                </select>
              </div>

              {nuevoRol === 'Docente' && (
                <div>
                  <label htmlFor="nuevo-moodle" className="block font-semibold text-[#18181b] mb-1">ID de usuario en Moodle (opcional)</label>
                  <input id="nuevo-moodle" type="number" min={1} value={nuevoMoodleId} onChange={(e) => setNuevoMoodleId(e.target.value)}
                    placeholder="Ej: 19" className={CAMPO} />
                  <p className="text-[11px] text-[#71717a] mt-1">
                    En Moodle: Administración del sitio → Usuarios → abra el perfil; es el número después de «id=» en la dirección.
                  </p>
                </div>
              )}

              {errorNuevo && <p role="alert" className="p-2 bg-red-50 border border-red-200 rounded text-red-700">{errorNuevo}</p>}

              <div className="pt-3 border-t border-[#e4e4e7] flex justify-end gap-2">
                <button type="button" onClick={() => setModalNuevo(false)}
                  className="px-3.5 py-1.5 border border-[#d4d4d8] text-[#52525b] hover:bg-[#f4f4f5] rounded font-semibold cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" disabled={guardando}
                  className="px-4 py-1.5 bg-[#8B151A] hover:bg-[#6E1014] disabled:opacity-60 text-white rounded font-semibold shadow-xs cursor-pointer">
                  {guardando ? 'Registrando...' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Enlace con Moodle */}
      {modalMoodle && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-md border border-[#e4e4e7] max-w-md w-full overflow-hidden shadow-lg">
            <div className="bg-[#1F3B73] px-5 py-3 text-white flex items-center justify-between">
              <h2 className="text-sm font-bold">Enlace con Moodle: {modalMoodle.nombreCompleto}</h2>
              <button type="button" onClick={() => setModalMoodle(null)} className="text-white/80 hover:text-white text-base leading-none" aria-label="Cerrar">
                ✕
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void guardarMoodle(false)
              }}
              className="p-5 space-y-3 text-xs"
            >
              <p className="text-[#52525b]">
                SISRA verificará con la cuenta de servicio en qué cursos del período es profesor este usuario de Moodle.
                Después, el docente podrá sincronizar esos cursos desde Evaluaciones.
              </p>
              <div>
                <label htmlFor="moodle-id" className="block font-semibold text-[#18181b] mb-1">ID de usuario en Moodle</label>
                <input id="moodle-id" type="number" min={1} required value={moodleId} onChange={(e) => setMoodleId(e.target.value)}
                  placeholder="Ej: 19" className={CAMPO} />
                <p className="text-[11px] text-[#71717a] mt-1">
                  En Moodle: Administración del sitio → Usuarios → abra el perfil; es el número después de «id=» en la dirección.
                </p>
              </div>

              {errorMoodle && <p role="alert" className="p-2 bg-red-50 border border-red-200 rounded text-red-700">{errorMoodle}</p>}

              <div className="pt-3 border-t border-[#e4e4e7] flex justify-between gap-2">
                {modalMoodle.moodleUserId ? (
                  <button type="button" disabled={guardando} onClick={() => void guardarMoodle(true)}
                    className="px-3 py-1.5 text-red-700 hover:bg-red-50 rounded font-semibold cursor-pointer">
                    Desenlazar
                  </button>
                ) : (
                  <span />
                )}
                <div className="flex gap-2">
                  <button type="button" onClick={() => setModalMoodle(null)}
                    className="px-3.5 py-1.5 border border-[#d4d4d8] text-[#52525b] hover:bg-[#f4f4f5] rounded font-semibold cursor-pointer">
                    Cancelar
                  </button>
                  <button type="submit" disabled={guardando}
                    className="px-4 py-1.5 bg-[#1F3B73] hover:bg-[#2A4A8A] disabled:opacity-60 text-white rounded font-semibold shadow-xs cursor-pointer">
                    {guardando ? 'Verificando...' : 'Verificar y guardar'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminUsuariosPage
