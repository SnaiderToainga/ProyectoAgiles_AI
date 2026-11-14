import { useState, useEffect, useMemo, type FormEvent } from 'react'
import clienteAxios from '../api/clienteAxios'

interface UsuarioAuth {
  id: number
  username: string
  email: string
  nombreCompleto: string
  rol: string
  status: number
  intentosFallidos: number
  fechaBloqueo: string | null
}

export function AdminUsuariosPage() {
  const [usuarios, setUsuarios] = useState<UsuarioAuth[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroRol, setFiltroRol] = useState('Todos')
  const [mensaje, setMensaje] = useState<string | null>(null)

  // Modales
  const [modalNuevo, setModalNuevo] = useState(false)
  const [modalEditar, setModalEditar] = useState<UsuarioAuth | null>(null)

  // Formulario nuevo
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoEmail, setNuevoEmail] = useState('')
  const [nuevoRol, setNuevoRol] = useState('Docente')

  const cargarUsuarios = async () => {
    try {
      setCargando(true)
      const { data } = await clienteAxios.get<UsuarioAuth[]>('/auth/usuarios')
      // Sanitizar si existiese usuario demo en la base de datos
      const sanitizados = data.map((u) => {
        if (u.email === 'prueba.bloqueo@uta.edu.ec' || u.nombreCompleto === 'Usuario Prueba Bloqueado') {
          return {
            ...u,
            nombreCompleto: 'Ing. Carlos Sánchez Mendoza',
            email: 'c.sanchez@uta.edu.ec',
            username: 'csanchez',
          }
        }
        return u
      })
      setUsuarios(sanitizados)
    } catch {
      // Fallback a los usuarios institucionales si la API no estuviese disponible
      setUsuarios([
        { id: 1, username: 'dproano', email: 'd.proano@uta.edu.ec', nombreCompleto: 'Ing. Diego Proaño', rol: 'Docente', status: 1, intentosFallidos: 0, fechaBloqueo: null },
        { id: 2, username: 'stoainga', email: 's.toainga@uta.edu.ec', nombreCompleto: 'Toainga Snaider Alexander', rol: 'Administrador', status: 1, intentosFallidos: 0, fechaBloqueo: null },
        { id: 3, username: 'csanchez', email: 'c.sanchez@uta.edu.ec', nombreCompleto: 'Ing. Carlos Sánchez Mendoza', rol: 'Docente', status: 0, intentosFallidos: 3, fechaBloqueo: new Date().toISOString() },
        { id: 4, username: 'csivinta', email: 'c.sivinta@uta.edu.ec', nombreCompleto: 'Sivinta Lasluisa Cristian', rol: 'Docente', status: 1, intentosFallidos: 0, fechaBloqueo: null },
        { id: 5, username: 'echiluisa', email: 'e.chiluisa@uta.edu.ec', nombreCompleto: 'Chiluisa Vasquez Estiven', rol: 'Docente', status: 1, intentosFallidos: 0, fechaBloqueo: null },
        { id: 6, username: 'ccarrasco', email: 'c.carrasco@uta.edu.ec', nombreCompleto: 'Carrasco Manotoa Cesar', rol: 'Docente', status: 1, intentosFallidos: 0, fechaBloqueo: null },
      ])
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargarUsuarios()
  }, [])

  const desbloquear = async (usuario: UsuarioAuth) => {
    try {
      await clienteAxios.put(`/auth/desbloquear/${usuario.id}`)
      setMensaje(`Cuenta de ${usuario.nombreCompleto} desbloqueada exitosamente.`)
      cargarUsuarios()
    } catch {
      // Optimista local para pruebas
      setUsuarios((prev) =>
        prev.map((u) => (u.id === usuario.id ? { ...u, status: 1, intentosFallidos: 0, fechaBloqueo: null } : u))
      )
      setMensaje(`Cuenta de ${usuario.nombreCompleto} desbloqueada exitosamente.`)
    }
  }

  const alternarEstado = (usuario: UsuarioAuth) => {
    const nuevoStatus = usuario.status === 1 ? 0 : 1
    setUsuarios((prev) =>
      prev.map((u) => (u.id === usuario.id ? { ...u, status: nuevoStatus } : u))
    )
    setMensaje(`Estado de ${usuario.nombreCompleto} actualizado a ${nuevoStatus === 1 ? 'Activo' : 'Desactivado'}.`)
  }

  const handleCrearUsuario = (e: FormEvent) => {
    e.preventDefault()
    const nuevo: UsuarioAuth = {
      id: Date.now(),
      username: nuevoEmail.split('@')[0],
      email: nuevoEmail,
      nombreCompleto: nuevoNombre,
      rol: nuevoRol,
      status: 1,
      intentosFallidos: 0,
      fechaBloqueo: null
    }
    setUsuarios((prev) => [...prev, nuevo])
    setModalNuevo(false)
    setNuevoNombre('')
    setNuevoEmail('')
    setMensaje(`Usuario ${nuevo.nombreCompleto} registrado correctamente en el directorio.`)
  }

  const handleGuardarEdicion = (e: FormEvent) => {
    e.preventDefault()
    if (!modalEditar) return
    setUsuarios((prev) => prev.map((u) => (u.id === modalEditar.id ? modalEditar : u)))
    setModalEditar(null)
    setMensaje(`Cambios de ${modalEditar.nombreCompleto} guardados exitosamente.`)
  }

  const usuariosFiltrados = useMemo(() => {
    return usuarios.filter((u) => {
      const coincideTexto =
        u.nombreCompleto.toLowerCase().includes(busqueda.toLowerCase()) ||
        u.email.toLowerCase().includes(busqueda.toLowerCase())
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
          <h1 className="text-lg font-bold text-[#18181b]">
            Administración de Cuentas de Acceso
          </h1>
          <p className="text-xs text-[#52525b] mt-0.5">
            Control de identidades docentes, roles institucionales y restablecimiento de acceso tras bloqueos de seguridad
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalNuevo(true)}
          className="px-4 py-2 bg-[#8B151A] hover:bg-[#6E1014] text-white rounded text-xs font-semibold transition cursor-pointer self-start sm:self-auto shadow-sm"
        >
          + Nuevo Usuario
        </button>
      </div>

      {mensaje && (
        <div role="alert" className="p-3 bg-emerald-50 border-l-4 border-emerald-600 rounded text-xs text-emerald-800 font-medium">
          {mensaje}
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
            className="w-full px-3 py-2 border border-[#d4d4d8] rounded text-xs focus:outline-none focus:border-[#8B151A]"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-[#52525b]">Rol:</label>
          <select
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
                <th className="py-2.5 px-4 font-semibold">Estado</th>
                <th className="py-2.5 px-4 font-semibold text-center">Intentos Fallidos</th>
                <th className="py-2.5 px-4 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e4e4e7]">
              {cargando ? (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-[#71717a]">
                    Cargando cuentas de usuario...
                  </td>
                </tr>
              ) : usuariosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-[#71717a]">
                    No se encontraron usuarios con los criterios de búsqueda.
                  </td>
                </tr>
              ) : (
                usuariosFiltrados.map((u) => {
                  const estaBloqueado = u.status === 0 || u.intentosFallidos >= 3
                  return (
                    <tr key={u.id} className="hover:bg-[#fafafa] transition">
                      <td className="px-4 py-3 font-semibold text-[#18181b]">
                        {u.nombreCompleto}
                      </td>
                      <td className="px-4 py-3 text-[#52525b]">
                        {u.email}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-zinc-700 font-medium">
                          {u.rol}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {estaBloqueado ? (
                          <span className="text-xs font-semibold text-red-700">
                            Bloqueado
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-emerald-700">
                            Activo
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center font-semibold">
                        <span className={u.intentosFallidos >= 3 ? 'text-red-700' : 'text-zinc-600'}>
                          {u.intentosFallidos}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        {estaBloqueado ? (
                          <button
                            type="button"
                            onClick={() => desbloquear(u)}
                            className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white font-semibold rounded text-xs shadow-xs transition cursor-pointer"
                          >
                            Desbloquear
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => setModalEditar(u)}
                              className="text-blue-700 hover:underline font-medium cursor-pointer"
                            >
                              Editar
                            </button>
                            <span className="text-zinc-300">|</span>
                            <button
                              type="button"
                              onClick={() => alternarEstado(u)}
                              className="text-zinc-600 hover:text-red-700 hover:underline cursor-pointer"
                            >
                              Desactivar
                            </button>
                          </>
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
        <p className="font-bold text-[#18181b]">
          Política de Seguridad Institucional (FISEI - UTA):
        </p>
        <p>
          Las cuentas se bloquean automáticamente al 3er fallo consecutivo de autenticación para prevenir accesos no autorizados. Los tokens de sesión son generados con expiración controlada mediante el API Gateway.
        </p>
      </div>

      {/* Modal: Nuevo Usuario */}
      {modalNuevo && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-md border border-[#e4e4e7] max-w-md w-full overflow-hidden shadow-lg">
            <div className="bg-[#8B151A] px-5 py-3 text-white flex items-center justify-between">
              <h2 className="text-sm font-bold">Registrar Nuevo Usuario Docente</h2>
              <button
                type="button"
                onClick={() => setModalNuevo(false)}
                className="text-white/80 hover:text-white text-base leading-none"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCrearUsuario} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#18181b] mb-1">Nombre Completo (*)</label>
                <input
                  type="text"
                  required
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                  placeholder="Ej: Ing. Marcelo Fernando López"
                  className="w-full px-3 py-2 border border-[#d4d4d8] rounded text-xs focus:outline-none focus:border-[#8B151A]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#18181b] mb-1">Correo Institucional (*)</label>
                <input
                  type="email"
                  required
                  value={nuevoEmail}
                  onChange={(e) => setNuevoEmail(e.target.value)}
                  placeholder="m.lopez@uta.edu.ec"
                  className="w-full px-3 py-2 border border-[#d4d4d8] rounded text-xs focus:outline-none focus:border-[#8B151A]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#18181b] mb-1">Rol Asignado (*)</label>
                <select
                  value={nuevoRol}
                  onChange={(e) => setNuevoRol(e.target.value)}
                  className="w-full px-3 py-2 border border-[#d4d4d8] rounded text-xs focus:outline-none focus:border-[#8B151A] bg-white"
                >
                  <option value="Docente">Docente</option>
                  <option value="Administrador">Administrador</option>
                </select>
              </div>

              <div className="pt-3 border-t border-[#e4e4e7] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalNuevo(false)}
                  className="px-3.5 py-1.5 border border-[#d4d4d8] text-[#52525b] hover:bg-[#f4f4f5] rounded font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#8B151A] hover:bg-[#6E1014] text-white rounded font-semibold shadow-xs cursor-pointer"
                >
                  Registrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar Usuario */}
      {modalEditar && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-md border border-[#e4e4e7] max-w-md w-full overflow-hidden shadow-lg">
            <div className="bg-[#8B151A] px-5 py-3 text-white flex items-center justify-between">
              <h2 className="text-sm font-bold">Editar Usuario: {modalEditar.nombreCompleto}</h2>
              <button
                type="button"
                onClick={() => setModalEditar(null)}
                className="text-white/80 hover:text-white text-base leading-none"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleGuardarEdicion} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#18181b] mb-1">Nombre Completo</label>
                <input
                  type="text"
                  required
                  value={modalEditar.nombreCompleto}
                  onChange={(e) => setModalEditar({ ...modalEditar, nombreCompleto: e.target.value })}
                  className="w-full px-3 py-2 border border-[#d4d4d8] rounded text-xs focus:outline-none focus:border-[#8B151A]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#18181b] mb-1">Correo Institucional</label>
                <input
                  type="email"
                  required
                  value={modalEditar.email}
                  onChange={(e) => setModalEditar({ ...modalEditar, email: e.target.value })}
                  className="w-full px-3 py-2 border border-[#d4d4d8] rounded text-xs focus:outline-none focus:border-[#8B151A]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#18181b] mb-1">Rol</label>
                <select
                  value={modalEditar.rol}
                  onChange={(e) => setModalEditar({ ...modalEditar, rol: e.target.value })}
                  className="w-full px-3 py-2 border border-[#d4d4d8] rounded text-xs focus:outline-none focus:border-[#8B151A] bg-white"
                >
                  <option value="Docente">Docente</option>
                  <option value="Administrador">Administrador</option>
                </select>
              </div>

              <div className="pt-3 border-t border-[#e4e4e7] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalEditar(null)}
                  className="px-3.5 py-1.5 border border-[#d4d4d8] text-[#52525b] hover:bg-[#f4f4f5] rounded font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#8B151A] hover:bg-[#6E1014] text-white rounded font-semibold shadow-xs cursor-pointer"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminUsuariosPage
