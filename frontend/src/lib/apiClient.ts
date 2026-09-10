// =====================================================
// Cliente HTTP central. Reemplaza los 8 `apiFetch` duplicados
// del front vanilla por una sola instancia de axios:
//   - inyecta `Authorization: Bearer <token>` si hay sesión (R1)
//   - en un 401, limpia la sesión y redirige a /login (cuando exista)
//   - tipo de error común para que cada página no repita el try/catch
//
// Token: por decisión del plan (sessionStorage, ver
// PLAN_MEJORA_STG_v2_REACT.md sección R1), no localStorage. Se borra
// solo al cerrar la pestaña/ventana — razonable para una intranet de
// agencia, combinado con que React ya neutraliza el XSS de render.
// =====================================================
import axios, { AxiosError } from 'axios'

const TOKEN_KEY = 'stg_token'

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  sessionStorage.removeItem(TOKEN_KEY)
}

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE ?? '/api',
})

apiClient.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export interface ApiError {
  status: number
  message: string
  detalles?: { campo: string; mensaje: string }[]
}

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: string; detalles?: ApiError['detalles'] }>) => {
    const status = error.response?.status ?? 0

    // 401: sesión vencida o ausente. Mientras AUTH_ENABLED=false en el
    // back (modo demo) esto no debería pasar nunca; cuando R1 prenda el
    // login, acá se limpia el token y se redirige.
    if (status === 401) {
      clearToken()
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }

    const apiError: ApiError = {
      status,
      message: error.response?.data?.error ?? error.message ?? 'Error de red',
      detalles: error.response?.data?.detalles,
    }
    return Promise.reject(apiError)
  },
)
