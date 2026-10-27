import axios from 'axios'

// La URL base apunta por defecto al API Gateway YARP en el puerto 5000
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'

export const clienteAxios = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
})

// Interceptor de peticiones: Inyecta el token Bearer si existe en localStorage
clienteAxios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Interceptor de respuestas: Manejo global de expiración de sesión (401)
clienteAxios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Limpiar sesión expirada
      localStorage.removeItem('token')
      localStorage.removeItem('usuario')

      // Redirigir al login si no estamos ya allí
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default clienteAxios
