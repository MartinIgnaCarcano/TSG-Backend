// =====================================================
// Cotización del dólar para el Dashboard.
// Replica Front/STG-Sistema-de-gesti-n-de-viajes-/Dashboard.js
// (renderDolar): primero busca USD_OFICIAL/USD_BLUE en /parametros;
// si el back no los tiene cargados, hace fallback a dolarapi.com y,
// de paso, los guarda en el back con PUT /parametros/:clave para que
// la próxima vez ya estén.
// =====================================================
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../lib/apiClient'
import type { Parametro } from '../types/dashboard'

interface DolarApiEntry {
  casa: string
  venta: number
}

export interface DolarInfo {
  oficial: number | null
  blue: number | null
  brechaPct: number | null
}

async function resolverDolar(parametros: Parametro[]): Promise<DolarInfo> {
  const oficialParam = parametros.find((p) => p.clave === 'USD_OFICIAL')
  const blueParam = parametros.find((p) => p.clave === 'USD_BLUE')

  let oficial = oficialParam ? Number(oficialParam.valor) : null
  let blue = blueParam ? Number(blueParam.valor) : null

  if (!oficial || !blue) {
    try {
      const res = await fetch('https://dolarapi.com/v1/dolares')
      if (res.ok) {
        const dolares: DolarApiEntry[] = await res.json()
        const of = dolares.find((d) => (d.casa || '').toLowerCase() === 'oficial')
        const bl = dolares.find((d) => (d.casa || '').toLowerCase() === 'blue')
        if (of) oficial = Number(of.venta)
        if (bl) blue = Number(bl.venta)

        await Promise.allSettled([
          of &&
            apiClient.put(`/parametros/USD_OFICIAL`, {
              valor: String(of.venta),
              descripcion: 'Dólar oficial (fallback Dashboard)',
            }),
          bl &&
            apiClient.put(`/parametros/USD_BLUE`, {
              valor: String(bl.venta),
              descripcion: 'Dólar blue (fallback Dashboard)',
            }),
        ])
      }
    } catch {
      // sin conexión a dolarapi.com: seguimos con lo que haya (o null)
    }
  }

  const brechaPct = oficial && blue && oficial > 0 ? ((blue - oficial) / oficial) * 100 : null
  return { oficial, blue, brechaPct }
}

export function useDolar(parametros: Parametro[]) {
  return useQuery<DolarInfo>({
    queryKey: ['dolar', parametros.map((p) => p.clave + p.valor).join(',')],
    queryFn: () => resolverDolar(parametros),
    enabled: parametros.length >= 0, // siempre habilitada; corre también con [] para ir al fallback
    staleTime: 5 * 60_000,
  })
}
