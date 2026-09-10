// =====================================================
// Modal alta/edición de hotel. Paridad con Hoteles.js:
// abrirModalNuevoHotel/abrirEditar/guardarHotel.
// =====================================================
import { useEffect, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Hotel } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { hotelSchema, type HotelInput } from '../../schemas/hotel.schema'
import type { DestinoCompleto, HotelCompleto } from '../../types/hotel'

const inputClass =
  'w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-[var(--text)] outline-none focus:border-[var(--accent)]'

export function HotelFormModal({
  open,
  onClose,
  onSubmit,
  hotel,
  destinos,
  pending,
  serverError,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (values: HotelInput) => void
  hotel: HotelCompleto | null
  destinos: DestinoCompleto[]
  pending: boolean
  serverError: string | null
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<HotelInput>({ resolver: zodResolver(hotelSchema) })

  useEffect(() => {
    if (!open) return
    reset(
      hotel
        ? {
            nombre: hotel.nombre,
            destinoId: hotel.destinoId,
            estrellas: hotel.estrellas,
            precioNoche: Number(hotel.precioNoche),
            rating: hotel.rating != null ? Number(hotel.rating) : '',
            descripcion: hotel.descripcion ?? '',
            direccion: hotel.direccion ?? '',
            urlImagen: hotel.urlImagen ?? '',
            urlReserva: hotel.urlReserva ?? '',
          }
        : {
            nombre: '',
            destinoId: destinos[0]?.id ?? '',
            estrellas: 3,
            precioNoche: undefined as unknown as number,
            rating: '',
            descripcion: '',
            direccion: '',
            urlImagen: '',
            urlReserva: '',
          },
    )
  }, [open, hotel, destinos, reset])

  return (
    <Modal open={open} onClose={onClose} title={hotel ? `Editar ${hotel.nombre}` : 'Nuevo hotel'} icon={Hotel} widthClass="max-w-lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <Field label="Nombre" error={errors.nombre?.message}>
          <input {...register('nombre')} className={inputClass} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Destino" error={errors.destinoId?.message}>
            <select {...register('destinoId')} className={inputClass}>
              {destinos.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.codigoIATA} — {d.nombre}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Estrellas" error={errors.estrellas?.message}>
            <select {...register('estrellas')} className={inputClass}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} ★
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Precio por noche (USD)" error={errors.precioNoche?.message}>
            <input type="number" step="0.01" min={0} {...register('precioNoche')} className={inputClass} />
          </Field>
          <Field label="Rating (0-10, opcional)" error={errors.rating?.message}>
            <input type="number" step="0.1" min={0} max={10} {...register('rating')} className={inputClass} />
          </Field>
        </div>

        <Field label="Descripción" error={errors.descripcion?.message}>
          <textarea {...register('descripcion')} rows={2} className={inputClass} />
        </Field>
        <Field label="Dirección" error={errors.direccion?.message}>
          <input {...register('direccion')} className={inputClass} />
        </Field>
        <Field label="URL imagen" error={errors.urlImagen?.message}>
          <input {...register('urlImagen')} className={inputClass} />
        </Field>
        <Field label="URL de reserva" error={errors.urlReserva?.message}>
          <input {...register('urlReserva')} className={inputClass} />
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
            {pending ? 'Guardando…' : 'Guardar hotel'}
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
