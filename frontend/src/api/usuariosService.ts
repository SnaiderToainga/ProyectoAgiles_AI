import axios from 'axios'
import clienteAxios from './clienteAxios'

export type RolUsuario = 'Docente' | 'Administrador'

export interface UsuarioAdmin {
  id: number
  username: string
  email: string
  nombreCompleto: string
  rol: RolUsuario | string
  status: number
  intentosFallidos: number
  fechaBloqueo: string | null
  moodleUserId: number | null
}

export interface VinculoMoodle {
  usuarioId: number
  moodleUserId: number | null
  nombreMoodle: string | null
  cursosMoodle: string[]
  advertencia: string | null
}

export interface CrearUsuarioRequest {
  nombreCompleto: string
  email: string
  password: string
  rol: RolUsuario
  username?: string
  moodleUserId?: number | null
}

export interface CrearUsuarioResponse {
  usuario: UsuarioAdmin
  moodle: VinculoMoodle | null
}

export const listarUsuarios = async (): Promise<UsuarioAdmin[]> =>
  (await clienteAxios.get<UsuarioAdmin[]>('/auth/usuarios')).data

export const crearUsuario = async (datos: CrearUsuarioRequest): Promise<CrearUsuarioResponse> =>
  (await clienteAxios.post<CrearUsuarioResponse>('/auth/usuarios', datos, { timeout: 30000 })).data

export const vincularMoodle = async (usuarioId: number, moodleUserId: number | null): Promise<VinculoMoodle> =>
  (await clienteAxios.put<VinculoMoodle>(`/auth/usuarios/${usuarioId}/moodle`, { moodleUserId }, { timeout: 30000 })).data

export const desbloquearUsuario = async (usuarioId: number): Promise<void> => {
  await clienteAxios.put(`/auth/desbloquear/${usuarioId}`)
}

/** Extrae el mensaje que devuelve la API (ProblemDetails.title o el campo mensaje). */
export function mensajeDeError(error: unknown, porDefecto: string): string {
  if (axios.isAxiosError(error)) {
    const datos = error.response?.data as { title?: string; detail?: string; mensaje?: string; errors?: Record<string, string[]> } | undefined
    if (datos?.errors) return Object.values(datos.errors).flat().join(' ')
    return datos?.title || datos?.detail || datos?.mensaje || porDefecto
  }
  return porDefecto
}
