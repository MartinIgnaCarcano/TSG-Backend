// Placeholder genérico para las páginas todavía no migradas (R2..R7).
// Mientras una página no tenga su versión React terminada, la oficial
// sigue siendo la del front vanilla — esto es solo el andamiaje de R0.
export function PagePlaceholder({ titulo }: { titulo: string }) {
  return (
    <div className="rounded-xl2 border border-[var(--border)] bg-[var(--surface)] p-8 shadow-soft">
      <h1 className="font-heading text-2xl font-bold text-[var(--text)]">{titulo}</h1>
      <p className="mt-2 text-[var(--text-muted)]">
        Andamiaje R0 — esta página se migra en su fase correspondiente (R2..R7). La versión
        oficial por ahora sigue siendo la del front vanilla.
      </p>
    </div>
  )
}
