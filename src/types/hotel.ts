// =====================================================
// Tipos para el catálogo de Hoteles (CRUD admin), reflejando
// Back/TSG-Backend/src/routes/hoteles.ts. El Destino completo
// incluye "pais" (a diferencia del Destino recortado de cotizacion.ts).
// =====================================================

export interface DestinoCompleto {
  id: string
  codigoIATA: string
  nombre: string
  pais: string
}

export type FuenteHotel = 'MANUAL' | 'RAPIDAPI' | 'BOOKING'

export interface HotelCompleto {
  id: string
  nombre: string
  destinoId: string
  destino: DestinoCompleto | null
  estrellas: number
  precioNoche: number | string
  moneda: string
  rating: number | string | null
  descripcion: string | null
  direccion: string | null
  urlImagen: string | null
  urlReserva: string | null
  fuente: FuenteHotel
  alta: string
  baja: string | null
}
