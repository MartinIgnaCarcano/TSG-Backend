import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from './lib/theme'
import { AuthProvider } from './lib/auth'
import { RequireAuth } from './components/RequireAuth'
import { Layout } from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Clientes from './pages/Clientes'
import Cotizaciones from './pages/Cotizaciones'
import Calculadora from './pages/Calculadora'
import Reservas from './pages/Reservas'
import Recordatorios from './pages/Recordatorios'
import Hoteles from './pages/Hoteles'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                element={
                  <RequireAuth>
                    <Layout />
                  </RequireAuth>
                }
              >
                <Route index element={<Dashboard />} />
                <Route path="clientes" element={<Clientes />} />
                <Route path="cotizaciones" element={<Cotizaciones />} />
                <Route path="calculadora" element={<Calculadora />} />
                <Route path="reservas" element={<Reservas />} />
                <Route path="recordatorios" element={<Recordatorios />} />
                <Route path="hoteles" element={<Hoteles />} />
              </Route>
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
