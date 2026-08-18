// =====================================================
// Identificadores de negocio (numeroReserva, numeroCotizacion,
// numeroCliente, y los números de voucher y contrato).
//
// Hallazgo A-3 de la auditoría de ingeniería: se generaban como
// `RES-${Date.now()}`. Tres de ellos van a columnas con restricción
// `@unique`, así que dos altas en el mismo milisegundo violaban la
// restricción y el cliente recibía un 409 "Ya existe un registro con ese
// valor" que no tenía nada que ver con lo que había hecho. Con n8n
// reintentando webhooks y con el bot creando clientes y cotizaciones en
// ráfaga, no es un caso hipotético.
//
// Se le agrega un sufijo aleatorio: se conserva la parte temporal (que
// hace los números legibles y ordenables a ojo, que era la intención
// original) y se elimina la colisión.
//
// Nota: esto no pretende ser una numeración correlativa contable. Si en
// algún momento la agencia necesita "reserva número 1, 2, 3…", eso se
// resuelve con una secuencia de PostgreSQL, no acá.
// =====================================================
import { randomBytes } from 'crypto'

export function generarNumero(prefijo: string): string {
  return `${prefijo}-${Date.now()}-${randomBytes(3).toString('hex')}`
}
