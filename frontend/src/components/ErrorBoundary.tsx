import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

// ErrorBoundary por ruta (ver Layout.tsx, se remonta con key={pathname}).
// Si una página React rompe en render, esto evita tirar abajo toda la SPA
// y muestra un mensaje accionable en vez de una pantalla blanca.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-xl2 border border-[var(--border)] bg-[var(--surface)] p-8 shadow-soft">
          <h1 className="font-heading text-xl font-bold text-[var(--text)]">Algo salió mal en esta página</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">{this.state.error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
          >
            Recargar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
