import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import type { UsuarioInfo } from '../types/auth'

interface AuthContextType {
  user: UsuarioInfo | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (token: string, usuario: UsuarioInfo) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UsuarioInfo | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // Al cargar la aplicación, recuperamos la sesión guardada en localStorage si existe
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem('token')
      const storedUser = localStorage.getItem('usuario')

      if (storedToken && storedUser) {
        setToken(storedToken)
        setUser(JSON.parse(storedUser))
      }
    } catch (error) {
      console.error('Error al recuperar sesión local:', error)
      localStorage.removeItem('token')
      localStorage.removeItem('usuario')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const login = (newToken: string, newUsuario: UsuarioInfo) => {
    localStorage.setItem('token', newToken)
    localStorage.setItem('usuario', JSON.stringify(newUsuario))
    setToken(newToken)
    setUser(newUsuario)
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('usuario')
    setToken(null)
    setUser(null)
  }

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!token,
    isLoading,
    login,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Hook personalizado para consumir el contexto de autenticación fácilmente
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider')
  }
  return context
}
