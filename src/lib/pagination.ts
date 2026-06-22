// =====================================================
// Paginación opcional para listados (?page=&pageSize=).
//
// Backward-compatible a propósito: si el caller (front vanilla, n8n)
// no manda ni `page` ni `pageSize`, el endpoint devuelve el array
// plano de siempre — nadie que ya consume estas rutas se rompe. La
// paginación solo entra en juego si alguien la pide explícitamente.
// =====================================================
export interface Paginacion {
  page: number
  pageSize: number
  skip: number
  take: number
}

export interface RespuestaPaginada<T> {
  data: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

const MAX_PAGE_SIZE = 100
const DEFAULT_PAGE_SIZE = 20

export function parsePaginacion(query: Record<string, unknown>): Paginacion | null {
  if (query.page === undefined && query.pageSize === undefined) return null

  const page = Math.max(1, parseInt(String(query.page ?? '1'), 10) || 1)
  const pageSizeRaw = parseInt(String(query.pageSize ?? DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, pageSizeRaw))

  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize }
}

export function paginarArray<T>(items: T[], p: Paginacion): RespuestaPaginada<T> {
  const total = items.length
  return {
    data: items.slice(p.skip, p.skip + p.take),
    page: p.page,
    pageSize: p.pageSize,
    total,
    totalPages: Math.ceil(total / p.pageSize),
  }
}
