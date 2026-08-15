// =====================================================
// AuthContext: estado de sesión del front (R1).
//
// - login(): POST /api/admin-users/login, guarda token (sessionStorage,
//   vía setToken de apiClient.ts) y el usuario en memoria.
// - logout(): limpia token + usuario, redirige a /login.
// - El JWT no se valida criptográficamente acá (eso lo hace el back);
//   solo se decodifica el payload para leer `exp` y saber cuándo expiró,
//   así el guard puede patear a /login sin esperar el primer 401.
//
// Nota: con AUTH_ENABLED=false en el back (modo demo actual), el login
// funciona igual y devuelve token, pero el back no exige el header en
// las demás rutas todavía. El guard de abajo igual funciona porque
// depende del token guardado en el front, no de que el back lo exija.
// =====================================================
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { apiClient, getToken, setToken, clearToken } from './apiClient'

export interface AuthUser {
  id: number
  email: string
  nombre: string
}

interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)
const USER_KEY = 'stg_user'

function decodeExp(token: string): number | null {
  try {
    const payload = token.split('.')[1]
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    return typeof json.exp === 'number' ? json.exp : null
  } catch {
    return null
  }
}

function isExpired(token: string): boolean {
  const exp = decodeExp(token)
  if (!exp) return false // si no se puede leer exp, no bloqueamos por las dudas
  return Date.now() >= exp * 1000
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = getToken()
    const savedUser = sessionStorage.getItem(USER_KEY)
    if (token && savedUser && !isExpired(token)) {
      setUser(JSON.parse(savedUser))
    } else if (token) {
      // token vencido o sin usuario guardado: limpiamos sesión a medias
      clearToken()
      sessionStorage.removeItem(USER_KEY)
    }
    setLoading(false)
  }, [])

  async function login(email: string, password: string) {
    const { data } = await apiClient.post<{ token: string; user: AuthUser }>(
      '/admin-users/login',
      { email, password },
    )
    setToken(data.token)
    sessionStorage.setItem(USER_KEY, JSON.stringify(data.user))
    setUser(data.user)
  }

  function logout() {
    clearToken()
    sessionStorage.removeItem(USER_KEY)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
