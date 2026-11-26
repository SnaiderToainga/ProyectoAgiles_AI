import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { loginUsuario } from '../api/authService'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'
import logo from '../assets/logo.png'
import loginHero from '../assets/login-hero.jpg'

export function LoginPage() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [verClave, setVerClave] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [infoAyuda, setInfoAyuda] = useState(false)
  const [bloqueado, setBloqueado] = useState(false)

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard')
  }, [isAuthenticated, navigate])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setCargando(true)
    setError(null)

    try {
      const res = await loginUsuario({ email: email.trim(), password })
      if (res.exitoso && res.token && res.usuario) {
        login(res.token, res.usuario)
        navigate('/dashboard')
      } else {
        setError(res.mensaje || 'Credenciales incorrectas.')
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
        setError('No se pudo conectar con el servidor de autenticación. Verifica que el API Gateway esté activo.')
      }
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f1f3f7] flex items-center justify-center p-6">
      <div className="w-full max-w-[960px] min-h-[580px] bg-white border border-[#e5e7eb] shadow-[0_24px_60px_rgba(15,23,42,0.08)] p-4.5 grid grid-cols-1 md:grid-cols-[1.04fr_1fr] gap-4.5">
        <div className="hidden md:block bg-[#6b7280] relative overflow-hidden min-h-[540px]">
          <img
            src={loginHero}
            alt="Simplifica la gestión académica - EduMonitor AI"
            className="w-full h-full object-cover object-center block"
          />
        </div>

        <div className="px-6 py-8 md:px-10 md:py-9 flex flex-col justify-center bg-white">
          <div className="flex items-center justify-center gap-2.5 mb-4.5">
            <img src={logo} alt="EduMonitor AI" className="w-9 h-9 object-contain" />
            <div>
              <div className="text-[15.5px] font-bold leading-tight text-black font-display">EduMonitor AI</div>
              <div className="text-[11.5px] text-black">FISEI · Universidad Técnica de Ambato</div>
            </div>
          </div>

          <h1 className="text-[27px] font-bold text-center text-black leading-tight font-display">
            Bienvenido de nuevo
          </h1>
          <p className="text-[13px] text-center text-black mt-1 mb-6">
            Ingresa con tu cuenta institucional
          </p>

          {bloqueado ? (
            <div className="bg-[#fef2f2] border-l-[3px] border-[#8B151A] px-3 py-2.5 text-[12.5px] text-black mb-3.5">
              <p className="font-bold text-[#8B151A]">Acceso bloqueado</p>
              <p className="mt-0.5">Se registraron 3 intentos fallidos. Solicite el desbloqueo al administrador.</p>
            </div>
          ) : error ? (
            <div className="bg-[#fef2f2] border-l-[3px] border-[#8B151A] px-3 py-2.5 text-[12.5px] font-semibold text-[#8B151A] mb-3.5">
              {error}
            </div>
          ) : infoAyuda ? (
            <div className="bg-[#eff6ff] border-l-[3px] border-[#2563eb] px-3 py-2.5 text-[12.5px] text-black mb-3.5">
              Para restablecer su contraseña o desbloquear una cuenta institucional, comuníquese con el Administrador del sistema FISEI - UTA.
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-black mb-1.5">Correo institucional</label>
              <input
                type="email"
                disabled={bloqueado || cargando}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@uta.edu.ec"
                className="w-full h-11 px-3.5 bg-[#f4f5f7] border border-[#e5e7eb] text-[13.5px] text-black focus:outline-none focus:bg-white focus:border-[#2563eb] disabled:bg-[#eceef2] disabled:cursor-not-allowed transition"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-black mb-1.5">Contraseña</label>
              <div className="relative flex items-center">
                <input
                  type={verClave ? 'text' : 'password'}
                  disabled={bloqueado || cargando}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 pl-3.5 pr-10 bg-[#f4f5f7] border border-[#e5e7eb] text-[13.5px] text-black focus:outline-none focus:bg-white focus:border-[#2563eb] disabled:bg-[#eceef2] disabled:cursor-not-allowed transition"
                  required
                />
                <button
                  type="button"
                  onClick={() => setVerClave(!verClave)}
                  title={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-2.5 w-7 h-7 grid place-items-center text-black cursor-pointer"
                >
                  {verClave ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.77 21.77 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.8 21.8 0 0 1-3.17 4.49" />
                      <path d="M1 1l22 22" />
                      <path d="M10.58 10.58a2 2 0 1 0 2.83 2.83" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="flex justify-end -mt-0.5 mb-0.5">
              <button
                type="button"
                onClick={() => { setError(null); setInfoAyuda(true) }}
                className="text-xs font-medium text-black underline underline-offset-3 cursor-pointer"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            <button
              type="submit"
              disabled={bloqueado || cargando}
              className="w-full h-11 bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-semibold disabled:bg-[#cbd5e1] disabled:text-black transition cursor-pointer"
            >
              {cargando ? 'Ingresando...' : bloqueado ? 'Cuenta bloqueada' : 'Ingresar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
