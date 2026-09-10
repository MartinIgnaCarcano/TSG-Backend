import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Calculator,
  BookmarkCheck,
  Bell,
  Hotel as HotelIcon,
  LogOut,
} from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'
import { useAuth } from '../lib/auth'

const LINKS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/cotizaciones', label: 'Cotizaciones', icon: MessageSquare },
  { to: '/calculadora', label: 'Calculadora', icon: Calculator },
  { to: '/reservas', label: 'Reservas', icon: BookmarkCheck },
  { to: '/recordatorios', label: 'Recordatorios', icon: Bell },
  { to: '/hoteles', label: 'Hoteles', icon: HotelIcon },
]

export function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <aside className="sticky top-0 flex h-screen w-56 min-w-56 flex-col border-r border-[var(--border)] bg-[var(--surface)]">
      <div className="border-b border-[var(--border)] px-4 py-5">
        <img src="/logo-stg.png" alt="STG" className="w-28" />
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-xl px-4 py-3 font-heading text-sm font-semibold transition ${
                isActive
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--accent-strong)]'
              }`
            }
          >
            <link.icon className="h-4 w-4 shrink-0" />
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-[var(--border)] px-4 py-3">
        <p className="truncate text-sm font-semibold text-[var(--text)]">{user?.nombre}</p>
        <p className="truncate text-xs text-[var(--text-muted)]">{user?.email}</p>
        <button
          onClick={handleLogout}
          className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:underline"
        >
          <LogOut className="h-3.5 w-3.5" />
          Cerrar sesión
        </button>
      </div>

      <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-4">
        <span className="text-xs text-[var(--text-muted)]">Tema</span>
        <ThemeToggle />
      </div>
    </aside>
  )
}
