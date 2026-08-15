// =====================================================
// Clientes (R3, paso 2 del plan) — CRUD completo.
// Paridad funcional con Front/STG-Sistema-de-gesti-n-de-viajes-/Cliente.js:
// búsqueda en cliente, alta/edición vía modal, baja lógica con confirmación.
// =====================================================
import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, RefreshCw, Circle, CirclePause } from 'lucide-react'
import {
  useActualizarCliente,
  useClientes,
  useCrearCliente,
  useEliminarCliente,
} from '../hooks/useClientes'
import { ClienteFormModal } from '../components/clientes/ClienteFormModal'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { IconButton } from '../components/ui/IconButton'
import { SkeletonTableRows } from '../components/ui/Skeleton'
import type { ClienteCompleto } from '../types/cliente'
import type { ClienteInput } from '../schemas/cliente.schema'
import type { ApiError } from '../lib/apiClient'

export default function Clientes() {
  const [autoRefresh, setAutoRefresh] = useState(false)
  const { data: clientes, isLoading, isError, error, refetch, isFetching } = useClientes(autoRefresh)
  const crear = useCrearCliente()
  const actualizar = useActualizarCliente()
  const eliminar = useEliminarCliente()

  const [busqueda, setBusqueda] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [clienteEditando, setClienteEditando] = useState<ClienteCompleto | null>(null)
  const [clienteABorrar, setClienteABorrar] = useState<ClienteCompleto | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const filtrados = useMemo(() => {
    const lista = clientes ?? []
    const q = busqueda.trim().toLowerCase()
    if (!q) return lista
    return lista.filter((c) =>
      `${c.nombre} ${c.apellido} ${c.email ?? ''} ${c.telefono ?? ''} ${c.numeroCliente}`
        .toLowerCase()
        .includes(q),
    )
  }, [clientes, busqueda])

  function abrirNuevo() {
    setClienteEditando(null)
    setFormError(null)
    setModalAbierto(true)
  }

  function abrirEditar(c: ClienteCompleto) {
    setClienteEditando(c)
    setFormError(null)
    setModalAbierto(true)
  }

  async function onSubmit(values: ClienteInput) {
    setFormError(null)
    try {
      if (clienteEditando) {
        await actualizar.mutateAsync({ id: clienteEditando.id, input: values })
      } else {
        await crear.mutateAsync(values)
      }
      setModalAbierto(false)
    } catch (e) {
      setFormError((e as ApiError).message || 'No se pudo guardar el cliente')
    }
  }

  async function confirmarBorrado() {
    if (!clienteABorrar) return
    await eliminar.mutateAsync(clienteABorrar.id)
    setClienteABorrar(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold text-[var(--text)]">Clientes</h1>
        <div className="flex gap-2">
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar nombre, email, teléfono o # cliente"
            className="w-64 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
          />
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--text)] disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} /> Actualizar
          </button>
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--text)]"
          >
            {autoRefresh ? (
              <>
                <Circle className="h-3 w-3 fill-green-500 text-green-500" /> Auto: ON (5s)
              </>
            ) : (
              <>
                <CirclePause className="h-3.5 w-3.5" /> Auto: OFF
              </>
            )}
          </button>
          <button
            onClick={abrirNuevo}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]"
          >
            <Plus className="h-4 w-4" /> Nuevo cliente
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl2 border border-[var(--border)] bg-[var(--surface)] shadow-soft">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-xs uppercase text-[var(--text-muted)]">
              <th className="px-4 py-3"># Cliente</th>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Teléfono</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <SkeletonTableRows cols={6} />}

            {isError && !isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-red-500">
                  Error: {(error as unknown as ApiError)?.message ?? 'no se pudo cargar la lista'}
                </td>
              </tr>
            )}

            {!isLoading && !isError && filtrados.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-[var(--text-muted)]">
                  No hay clientes.
                </td>
              </tr>
            )}

            {filtrados.map((c) => (
              <tr key={c.id} className="border-b border-[var(--border)] last:border-b-0">
                <td className="px-4 py-3 font-mono text-xs text-[var(--text-muted)]">{c.numeroCliente}</td>
                <td className="px-4 py-3 font-semibold text-[var(--text)]">
                  {c.nombre} {c.apellido}
                </td>
                <td className="px-4 py-3 text-[var(--text-muted)]">{c.telefono || '–'}</td>
                <td className="px-4 py-3 text-[var(--text-muted)]">{c.email || '–'}</td>
                <td className="px-4 py-3">
                  {c.baja ? (
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">
                      Baja
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                      Activo
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <IconButton icon={Pencil} label="Editar" onClick={() => abrirEditar(c)} />
                    <IconButton icon={Trash2} label="Eliminar" variant="danger" onClick={() => setClienteABorrar(c)} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ClienteFormModal
        open={modalAbierto}
        onClose={() => setModalAbierto(false)}
        onSubmit={onSubmit}
        cliente={clienteEditando}
        pending={crear.isPending || actualizar.isPending}
        serverError={formError}
      />

      <ConfirmDialog
        open={!!clienteABorrar}
        onClose={() => setClienteABorrar(null)}
        onConfirm={confirmarBorrado}
        pending={eliminar.isPending}
        mensaje={
          clienteABorrar ? `¿Eliminar a ${clienteABorrar.nombre} ${clienteABorrar.apellido}? Es una baja lógica.` : ''
        }
      />
    </div>
  )
}
