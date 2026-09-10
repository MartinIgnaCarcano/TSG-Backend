import { useEffect, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { User } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { clienteSchema, type ClienteInput } from '../../schemas/cliente.schema'
import type { ClienteCompleto } from '../../types/cliente'
const inputClass =
  'w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-[var(--text)] outline-none focus:border-[var(--accent)]'

export function ClienteFormModal({
  open,
  onClose,
  onSubmit,
  cliente,
  pending,
  serverError,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (values: ClienteInput) => void
  cliente: ClienteCompleto | null
  pending: boolean
  serverError: string | null
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ClienteInput>({ resolver: zodResolver(clienteSchema) })

  // Al abrir para editar, precarga el form; al abrir para alta, lo limpia.
  useEffect(() => {
    if (!open) return
    reset(
      cliente
        ? {
            nombre: cliente.nombre,
            apellido: cliente.apellido,
            telefono: cliente.telefono ?? '',
            email: cliente.email ?? '',
            numeroCliente: cliente.numeroCliente,
          }
        : { nombre: '', apellido: '', telefono: '', email: '', numeroCliente: '' },
    )
  }, [open, cliente, reset])

  return (
    <Modal open={open} onClose={onClose} title={cliente ? `Editar ${cliente.numeroCliente}` : 'Nuevo cliente'} icon={User}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <Field label="# Cliente (opcional)" error={errors.numeroCliente?.message}>
          <input
            {...register('numeroCliente')}
            disabled={!!cliente}
            placeholder="se genera automático si lo dejás vacío"
            className={`${inputClass} disabled:opacity-60`}
          />
        </Field>
        <Field label="Nombre" error={errors.nombre?.message}>
          <input {...register('nombre')} className={inputClass} />
        </Field>
        <Field label="Apellido" error={errors.apellido?.message}>
          <input {...register('apellido')} className={inputClass} />
        </Field>
        <Field label="Teléfono" error={errors.telefono?.message}>
          <input {...register('telefono')} placeholder="+5492611234567" className={inputClass} />
        </Field>
        <Field label="Email" error={errors.email?.message}>
          <input type="email" {...register('email')} className={inputClass} />
        </Field>

        {serverError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text)]"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-60"
          >
            {pending ? 'Guardando…' : 'Guardar cliente'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-[var(--text-muted)]">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
