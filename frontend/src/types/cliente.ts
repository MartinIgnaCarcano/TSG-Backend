export interface ClienteCompleto {
  id: string
  numeroCliente: string
  nombre: string
  apellido: string
  telefono: string | null
  email: string | null
  alta: string
  baja: string | null
}
