import clienteAxios from './clienteAxios'
import type { LoginRequest, LoginResponse } from '../types/auth'

export const loginUsuario = async (credenciales: LoginRequest): Promise<LoginResponse> => {
  const { data } = await clienteAxios.post<LoginResponse>('/auth/login', credenciales)
  return data
}
