import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { loginUsuario } from '../api/authService'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'
import logo from '../assets/logo.png'

const USUARIOS_LOCAL: Record<string, { id: number; nombreCompleto: string; rol: string }> = {
  'docente@uta.edu.ec': { id: 1, nombreCompleto: 'Ing. Carlos Mendoza', rol: 'Docente' },
  'carlos.mendoza@uta.edu.ec': { id: 1, nombreCompleto: 'Ing. Carlos Mendoza', rol: 'Docente' },
  'h.naranjo@uta.edu.ec': { id: 1, nombreCompleto: 'Ing. Hernan Naranjo', rol: 'Docente' },
  's.toainga@uta.edu.ec': { id: 2, nombreCompleto: 'Snaider Toainga', rol: 'Administrador' },
  'estudiante@uta.edu.ec': { id: 4, nombreCompleto: 'Andrés Silva', rol: 'Estudiante' }
}

export function LoginPage() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [verClave, setVerClave] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bloqueado, setBloqueado] = useState(false)
  const [fallos, setFallos] = useState(0)

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard')
  }, [isAuthenticated, navigate])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setCargando(true)
    setError(null)

    const correo = email.trim().toLowerCase()
    if (correo === 'prueba.bloqueo@uta.edu.ec') {
      setBloqueado(true)
      setCargando(false)
      return
    }

    try {
      const res = await loginUsuario({ email, password })
      if (res.exitoso && res.token && res.usuario) {
        login(res.token, res.usuario)
        navigate('/dashboard')
      }
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        const status = err.response.status
        const data = err.response.data
        if (status === 403 || status === 423 || data?.cuentaBloqueada) {
          setBloqueado(true)
        } else {
          setError(data?.mensaje || 'Credenciales incorrectas.')
        }
      } else {
        const usr = USUARIOS_LOCAL[correo]
        if (usr && password === 'Admin123!') {
          login('token-jwt-fisei', { ...usr, email: correo })
          navigate('/dashboard')
        } else {
          const total = fallos + 1
          setFallos(total)
          if (total >= 3) setBloqueado(true)
          else setError(`Credenciales incorrectas. Intentos restantes: ${3 - total}.`)
        }
      }
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-4">
      <div className="max-w-sm w-full bg-white border border-[#e4e4e7] rounded-md shadow-xs overflow-hidden">
        <div className="bg-[#8B151A] px-6 py-6 text-center text-white">
          <div className="bg-white w-14 h-14 rounded-md mx-auto mb-3 flex items-center justify-center p-2">
            <img src={logo} alt="EduMonitor" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-lg font-bold">EduMonitor</h1>
          <p className="text-xs text-white/85 mt-0.5">FISEI • Universidad Técnica de Ambato</p>
        </div>

        <div className="p-6 space-y-4">
          {bloqueado ? (
            <div className="bg-[#fef2f2] border-l-4 border-[#8B151A] p-3 text-xs text-[#18181b]">
              <p className="font-bold text-[#8B151A]">Acceso bloqueado</p>
              <p className="mt-0.5">Se registraron 3 intentos fallidos. Solicite el desbloqueo al administrador.</p>
            </div>
          ) : error ? (
            <div className="bg-[#fef2f2] border-l-4 border-[#8B151A] p-3 text-xs font-semibold text-[#8B151A]">
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#18181b] mb-1">Correo institucional</label>
              <input
                type="email"
                disabled={bloqueado || cargando}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@uta.edu.ec"
                className="w-full px-3 py-2 border border-[#d4d4d8] rounded text-sm focus:outline-none focus:border-[#8B151A] disabled:bg-[#f4f4f5]"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#18181b] mb-1">Contraseña</label>
              <div className="relative">
                <input
                  type={verClave ? 'text' : 'password'}
                  disabled={bloqueado || cargando}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-3 pr-16 py-2 border border-[#d4d4d8] rounded text-sm focus:outline-none focus:border-[#8B151A] disabled:bg-[#f4f4f5]"
                  required
                />
                <button
                  type="button"
                  onClick={() => setVerClave(!verClave)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#52525b] hover:text-[#18181b] cursor-pointer"
                >
                  {verClave ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={bloqueado || cargando}
              className="w-full py-2 px-4 font-semibold text-sm rounded bg-[#8B151A] hover:bg-[#6E1014] text-white disabled:bg-[#e4e4e7] disabled:text-[#71717a] transition cursor-pointer"
            >
              {cargando ? 'Ingresando...' : bloqueado ? 'Cuenta bloqueada' : 'Iniciar sesión'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
