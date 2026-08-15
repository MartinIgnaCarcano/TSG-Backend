import { Outlet, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Sidebar } from './Sidebar'
import { ErrorBoundary } from './ErrorBoundary'
import { useTheme } from '../lib/theme'

export function Layout() {
  const location = useLocation()
  const { theme } = useTheme()

  return (
    <div className="flex min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <Sidebar />
      <main className="flex-1 p-8">
        {/* key=pathname: si una página rompe en otra ruta, el boundary
            se remonta limpio en vez de seguir mostrando el error viejo. */}
        <ErrorBoundary key={location.pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
      {/* Global: toast() se puede llamar desde cualquier componente hijo,
          sonner solo necesita un <Toaster/> montado una vez. Tema
          sincronizado con el ThemeProvider propio (clase `dark` en <html>). */}
      <Toaster theme={theme} richColors position="top-right" toastOptions={{ style: { fontFamily: 'Inter, sans-serif' } }} />
    </div>
  )
}
