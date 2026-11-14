export interface LoginRequest {
  email: string
  password: string
}

export interface UsuarioInfo {
  id: number
  nombreCompleto: string
  email: string
  rol: string
}

export interface LoginResponse {
  exitoso: boolean
  mensaje: string
  token?: string | null
  intentosRestantes?: number | null
  cuentaBloqueada: boolean
  usuario?: UsuarioInfo | null
}
