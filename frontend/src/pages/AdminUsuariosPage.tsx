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
      {/* Migas de pan institucionales */}
      <div className="text-xs text-[#71717a] flex items-center gap-1.5">
        <span>Inicio</span>
        <span>›</span>
        <span>Gestión de Cuentas</span>
        <span>›</span>
        <span className="font-semibold text-[#18181b]">Usuarios del Sistema</span>
      </div>

      {/* Encabezado y Acciones */}
      <div className="bg-white border border-[#e4e4e7] border-l-4 border-l-[#8B151A] rounded-md p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-[#18181b]">Administración de Cuentas de Acceso</h1>
          <p className="text-xs text-[#52525b] mt-0.5">
            Alta de docentes y administradores, enlace con Moodle y restablecimiento de acceso tras bloqueos de seguridad
          </p>
        </div>

        <button
          type="button"
          onClick={abrirNuevo}
          className="px-4 py-2 bg-[#8B151A] hover:bg-[#6E1014] text-white rounded text-xs font-semibold transition cursor-pointer self-start sm:self-auto shadow-sm"
        >
          + Nuevo Usuario
        </button>
      </div>

      {aviso && (
        <div role="alert" className={`p-3 border-l-4 rounded text-xs font-medium flex justify-between gap-3 ${ESTILO_AVISO[aviso.tipo]}`}>
          <span>{aviso.texto}</span>
          <button type="button" onClick={() => setAviso(null)} className="opacity-70 hover:opacity-100" aria-label="Cerrar aviso">
            ✕
          </button>
        </div>
      )}

      {/* Filtros de Búsqueda */}
      <div className="bg-white border border-[#e4e4e7] rounded-md p-4 shadow-sm flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o correo institucional..."
            className={CAMPO}
          />
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="filtro-rol" className="text-xs font-medium text-[#52525b]">Rol:</label>
          <select
            id="filtro-rol"
            value={filtroRol}
            onChange={(e) => setFiltroRol(e.target.value)}
            className="px-3 py-2 border border-[#d4d4d8] rounded text-xs focus:outline-none focus:border-[#8B151A] bg-white cursor-pointer"
          >
            <option value="Todos">Todos</option>
            <option value="Docente">Docente</option>
            <option value="Administrador">Administrador</option>
          </select>
        </div>
      </div>

      {/* Tabla de Usuarios */}
      <div className="bg-white border border-[#e4e4e7] rounded-md shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f4f4f5] text-[#52525b] border-b border-[#e4e4e7]">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Nombre Completo</th>
                <th className="py-2.5 px-4 font-semibold">Correo Institucional</th>
                <th className="py-2.5 px-4 font-semibold">Rol</th>
                <th className="py-2.5 px-4 font-semibold">Moodle</th>
                <th className="py-2.5 px-4 font-semibold">Estado</th>
                <th className="py-2.5 px-4 font-semibold text-center">Intentos Fallidos</th>
                <th className="py-2.5 px-4 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e4e4e7]">
              {cargando ? (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-[#71717a]">Cargando cuentas de usuario...</td>
                </tr>
              ) : errorCarga ? (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-red-700" role="alert">{errorCarga}</td>
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
                    <tr key={u.id} className="hover:bg-[#fafafa] transition">
                      <td className="px-4 py-3 font-semibold text-[#18181b]">{u.nombreCompleto}</td>
                      <td className="px-4 py-3 text-[#52525b]">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-zinc-700 font-medium">{u.rol}</span>
                      </td>
                      <td className="px-4 py-3">
                        {!esDocente ? (
                          <span className="text-zinc-400">—</span>
                        ) : u.moodleUserId ? (
                          <span className="text-xs font-semibold text-[#1F3B73]">ID {u.moodleUserId}</span>
                        ) : (
                          <span className="text-xs text-amber-700">Sin enlazar</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {estaBloqueado ? (
                          <span className="text-xs font-semibold text-red-700">Bloqueado</span>
                        ) : (
                          <span className="text-xs font-semibold text-emerald-700">Activo</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center font-semibold">
                        <span className={u.intentosFallidos >= 3 ? 'text-red-700' : 'text-zinc-600'}>{u.intentosFallidos}</span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                        {esDocente && (
                          <button
                            type="button"
                            onClick={() => abrirMoodle(u)}
                            className="text-blue-700 hover:underline font-medium cursor-pointer"
                          >
                            {u.moodleUserId ? 'Cambiar enlace Moodle' : 'Enlazar Moodle'}
                          </button>
                        )}
                        {estaBloqueado && (
                          <button
                            type="button"
                            onClick={() => desbloquear(u)}
                            className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white font-semibold rounded text-xs shadow-xs transition cursor-pointer"
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

        <div className="p-4 bg-[#fafafa] border-t border-[#e4e4e7] flex items-center justify-between text-xs text-[#71717a]">
          <span>Total: <strong>{usuarios.length}</strong> usuarios registrados en el sistema</span>
          <span>Directorio Institucional UTA</span>
        </div>
      </div>

      {/* Recuadro de Política Institucional */}
      <div className="p-4 bg-white border border-[#e4e4e7] rounded-md text-xs text-[#52525b] space-y-1">
        <p className="font-bold text-[#18181b]">Política de Seguridad Institucional (FISEI - UTA):</p>
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
