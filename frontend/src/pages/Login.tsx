import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useLocation } from 'react-router-dom'
import { Mail, Lock, LogIn, Loader2 } from 'lucide-react'
import { loginSchema, type LoginInput } from '../schemas/login.schema'
import { useAuth } from '../lib/auth'
import type { ApiError } from '../lib/apiClient'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [serverError, setServerError] = useState<string | null>(null)
  const from = (location.state as { from?: string })?.from ?? '/'

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) })

  async function onSubmit(values: LoginInput) {
    setServerError(null)
    try {
      await login(values.email, values.password)
      navigate(from, { replace: true })
    } catch (e) {
      const err = e as ApiError
      setServerError(err.message || 'Credenciales inválidas')
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--bg)] px-4">
      {/* Fondo decorativo — dos manchas de color de la paleta oceano/turquesa,
          bien desenfocadas para no competir con la card. Colores fijos (no
          tokens), funcionan igual en claro/oscuro por la baja opacidad. */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-oceano-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-turquesa-500/20 blur-3xl" />

      <div className="relative w-full max-w-sm overflow-hidden rounded-xl2 border border-[var(--border)] bg-[var(--surface)] shadow-soft">
        <div className="h-1.5 bg-gradient-to-r from-oceano-600 to-turquesa-500" />

        <div className="p-8">
          <div className="mb-6 flex flex-col items-center gap-3">
            <img src="/logo-stg.png" alt="STG" className="w-20 drop-shadow-sm" />
            <div className="text-center">
              <h1 className="font-heading text-xl font-bold text-[var(--text)]">Iniciar sesión</h1>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">Sistema de Gestión de Viajes</p>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-muted)]">Email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="email"
                  {...register('email')}
                  className="w-full rounded-lg border border-[var(--border)] bg-transparent py-2 pl-9 pr-3 text-[var(--text)] outline-none focus:border-[var(--accent)]"
                  placeholder="admin@stg.com"
                />
              </div>
              {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-muted)]">Contraseña</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="password"
                  {...register('password')}
                  className="w-full rounded-lg border border-[var(--border)] bg-transparent py-2 pl-9 pr-3 text-[var(--text)] outline-none focus:border-[var(--accent)]"
                  placeholder="••••••••"
                />
              </div>
              {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
            </div>

            {serverError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-2 font-heading font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Ingresando…
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" /> Ingresar
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
