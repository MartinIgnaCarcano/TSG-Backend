import { PrismaClient, MedioPago, TipoRecordatorio, TipoDocumentoIdentidad } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

const dias = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000)

const DESTINOS = [
  { codigoIATA: 'EZE', nombre: 'Buenos Aires (Ezeiza)', pais: 'Argentina', timezone: 'America/Argentina/Buenos_Aires' },
  { codigoIATA: 'AEP', nombre: 'Buenos Aires (Aeroparque)', pais: 'Argentina', timezone: 'America/Argentina/Buenos_Aires' },
  { codigoIATA: 'MDZ', nombre: 'Mendoza', pais: 'Argentina', timezone: 'America/Argentina/Mendoza' },
  { codigoIATA: 'COR', nombre: 'Córdoba', pais: 'Argentina', timezone: 'America/Argentina/Cordoba' },
  { codigoIATA: 'BRC', nombre: 'Bariloche', pais: 'Argentina', timezone: 'America/Argentina/Salta' },
  { codigoIATA: 'IGR', nombre: 'Puerto Iguazú', pais: 'Argentina', timezone: 'America/Argentina/Cordoba' },
  { codigoIATA: 'MIA', nombre: 'Miami', pais: 'Estados Unidos', timezone: 'America/New_York' },
  { codigoIATA: 'JFK', nombre: 'Nueva York (JFK)', pais: 'Estados Unidos', timezone: 'America/New_York' },
  { codigoIATA: 'LAX', nombre: 'Los Ángeles', pais: 'Estados Unidos', timezone: 'America/Los_Angeles' },
  { codigoIATA: 'CUN', nombre: 'Cancún', pais: 'México', timezone: 'America/Cancun' },
  { codigoIATA: 'MAD', nombre: 'Madrid', pais: 'España', timezone: 'Europe/Madrid' },
  { codigoIATA: 'BCN', nombre: 'Barcelona', pais: 'España', timezone: 'Europe/Madrid' },
  { codigoIATA: 'CDG', nombre: 'París (Charles de Gaulle)', pais: 'Francia', timezone: 'Europe/Paris' },
  { codigoIATA: 'FCO', nombre: 'Roma (Fiumicino)', pais: 'Italia', timezone: 'Europe/Rome' },
  { codigoIATA: 'LHR', nombre: 'Londres (Heathrow)', pais: 'Reino Unido', timezone: 'Europe/London' },
  { codigoIATA: 'GRU', nombre: 'São Paulo (Guarulhos)', pais: 'Brasil', timezone: 'America/Sao_Paulo' },
  { codigoIATA: 'GIG', nombre: 'Río de Janeiro', pais: 'Brasil', timezone: 'America/Sao_Paulo' },
  { codigoIATA: 'SCL', nombre: 'Santiago de Chile', pais: 'Chile', timezone: 'America/Santiago' },
  { codigoIATA: 'LIM', nombre: 'Lima', pais: 'Perú', timezone: 'America/Lima' },
  { codigoIATA: 'PUJ', nombre: 'Punta Cana', pais: 'República Dominicana', timezone: 'America/Santo_Domingo' },
]

async function main() {
  console.log('🌱 Seed: destinos…')
  for (const d of DESTINOS) {
    await prisma.destino.upsert({
      where: { codigoIATA: d.codigoIATA },
      update: { nombre: d.nombre, pais: d.pais, timezone: d.timezone, baja: null },
      create: d,
    })
  }
  console.log(`  ✓ ${DESTINOS.length} destinos cargados`)

  console.log('🌱 Seed: admin…')
  const passwordHash = await bcrypt.hash('admin123', 10)
  await prisma.adminUser.upsert({
    where: { email: 'admin@stg.com' },
    update: { nombre: 'Admin STG', passwordHash, baja: null },
    create: { email: 'admin@stg.com', nombre: 'Admin STG', passwordHash },
  })
  console.log('  ✓ admin@stg.com / admin123')

  // ====================== CLIENTES + RESERVAS DE PRUEBA ======================
  // Una reserva por estado de la máquina de estados (EN_PROCESO, SEÑADA,
  // PAGADA, DOCUMENTADA) + una "vencida" para Flujo4, de forma que al
  // levantar el front después de un reset ya haya algo para apretar todos
  // los botones (confirmar, pagar, emitir voucher/contrato, cancelar) y
  // probar los webhooks/cron sin tener que armar todo a mano antes de la demo.
  console.log('🌱 Seed: clientes + reservas de prueba…')

  const destino = async (iata: string) => (await prisma.destino.findUnique({ where: { codigoIATA: iata } }))!.id
  const [ezeId, madId, miaId, cunId, bcnId, gruId] = await Promise.all(
    ['EZE', 'MAD', 'MIA', 'CUN', 'BCN', 'GRU'].map(destino),
  )

  async function viajeEntre(origenId: string, destinoId: string, descripcion: string) {
    let v = await prisma.viaje.findFirst({ where: { origenId, destinoId, baja: null } })
    if (!v) v = await prisma.viaje.create({ data: { origenId, destinoId, tieneEscalas: false, descripcion } })
    return v
  }

  async function cliente(numeroCliente: string, nombre: string, apellido: string, email: string, telefono: string) {
    return prisma.cliente.upsert({
      where: { numeroCliente },
      update: { baja: null },
      create: { numeroCliente, nombre, apellido, email, telefono },
    })
  }

  async function cotizacion(numero: string, viajeId: string, clienteId: string, precios: { ida: number; vuelta: number; idaVuelta: number; impuestos: number }) {
    return prisma.cotizacion.upsert({
      where: { numeroCotizacion: numero },
      update: { baja: null },
      create: {
        numeroCotizacion: numero,
        viajeId,
        clienteId,
        fechaVencimiento: dias(30),
        moneda: 'USD',
        precioIda: precios.ida,
        precioVuelta: precios.vuelta,
        precioIdaYVuelta: precios.idaVuelta,
        impuestos: precios.impuestos,
        observaciones: 'Datos de prueba del seed',
      },
    })
  }

  // --- 1) EN_PROCESO, sin seña — RES-SEED-001 (la original, el front nunca se ve vacío) ---
  const cliProceso = await cliente('CLI-SEED-001', 'María', 'García', 'maria.garcia@example.com', '+5492611234567')
  const viajeMad = await viajeEntre(ezeId, madId, 'EZE → MAD demo')
  const cotProceso = await cotizacion('COT-SEED-001', viajeMad.id, cliProceso.id, { ida: 850, vuelta: 920, idaVuelta: 1700, impuestos: 250 })
  const resProceso = await prisma.reserva.upsert({
    where: { numeroReserva: 'RES-SEED-001' },
    update: { baja: null, estado: 'EN_PROCESO', saldoPagado: 0 },
    create: {
      numeroReserva: 'RES-SEED-001',
      cotizacionId: cotProceso.id,
      clienteId: cliProceso.id,
      tipoReserva: 'IDA_Y_VUELTA',
      montoFinal: 1950,
      estado: 'EN_PROCESO',
      fechaViaje: dias(35),
      fechaRegreso: dias(45),
      observaciones: 'EN_PROCESO — probar "Confirmar seña"',
    },
  })

  // --- 2) SEÑADA, con seña parcial registrada — probar "Emitir contrato" y pago de saldo ---
  const cliSeñada = await cliente('CLI-SEED-002', 'Juan', 'Pérez', 'juan.perez@example.com', '+5492611234568')
  const viajeMia = await viajeEntre(ezeId, miaId, 'EZE → MIA demo')
  const cotSeñada = await cotizacion('COT-SEED-002', viajeMia.id, cliSeñada.id, { ida: 600, vuelta: 650, idaVuelta: 1250, impuestos: 180 })
  const resSeñada = await prisma.reserva.upsert({
    where: { numeroReserva: 'RES-SEED-002' },
    update: { baja: null, estado: 'SEÑADA', saldoPagado: 500 },
    create: {
      numeroReserva: 'RES-SEED-002',
      cotizacionId: cotSeñada.id,
      clienteId: cliSeñada.id,
      tipoReserva: 'IDA_Y_VUELTA',
      montoFinal: 1430,
      saldoPagado: 500,
      estado: 'SEÑADA',
      fechaViaje: dias(25),
      fechaRegreso: dias(32),
      observaciones: 'SEÑADA — probar "Emitir contrato" (Flujo7) y pago de saldo',
    },
  })
  await prisma.pasajero.upsert({
    where: { id: 'seed-pasajero-002' },
    update: {},
    create: {
      id: 'seed-pasajero-002',
      reservaId: resSeñada.id,
      nombre: 'Juan',
      apellido: 'Pérez',
      documentoTipo: TipoDocumentoIdentidad.DNI,
      documentoNumero: '30123456',
      fechaNacimiento: new Date('1988-04-12'),
      nacionalidad: 'Argentina',
      esTitular: true,
    },
  })
  await prisma.pago.create({
    data: { reservaId: resSeñada.id, monto: 500, medioPago: MedioPago.TRANSFERENCIA, referencia: 'SEED-PAGO-002', fechaPago: dias(-2) },
  })

  // --- 3) PAGADA, saldo cubierto — probar "Emitir voucher" (Flujo7) ---
  const cliPagada = await cliente('CLI-SEED-003', 'Lucía', 'Fernández', 'lucia.fernandez@example.com', '+5492611234569')
  const viajeCun = await viajeEntre(ezeId, cunId, 'EZE → CUN demo')
  const cotPagada = await cotizacion('COT-SEED-003', viajeCun.id, cliPagada.id, { ida: 700, vuelta: 740, idaVuelta: 1440, impuestos: 210 })
  const resPagada = await prisma.reserva.upsert({
    where: { numeroReserva: 'RES-SEED-003' },
    update: { baja: null, estado: 'PAGADA', saldoPagado: 1650 },
    create: {
      numeroReserva: 'RES-SEED-003',
      cotizacionId: cotPagada.id,
      clienteId: cliPagada.id,
      tipoReserva: 'IDA_Y_VUELTA',
      montoFinal: 1650,
      saldoPagado: 1650,
      estado: 'PAGADA',
      fechaViaje: dias(15),
      fechaRegreso: dias(22),
      observaciones: 'PAGADA — probar "Emitir voucher" (Flujo7)',
    },
  })
  await prisma.pasajero.upsert({
    where: { id: 'seed-pasajero-003' },
    update: {},
    create: {
      id: 'seed-pasajero-003',
      reservaId: resPagada.id,
      nombre: 'Lucía',
      apellido: 'Fernández',
      documentoTipo: TipoDocumentoIdentidad.DNI,
      documentoNumero: '32456789',
      fechaNacimiento: new Date('1992-09-03'),
      nacionalidad: 'Argentina',
      esTitular: true,
    },
  })
  await prisma.pago.create({
    data: { reservaId: resPagada.id, monto: 1650, medioPago: MedioPago.MERCADOPAGO, referencia: 'SEED-PAGO-003', fechaPago: dias(-1) },
  })

  // --- 4) DOCUMENTADA, voucher ya emitido — probar reemisión y CHECK_IN ---
  const cliDoc = await cliente('CLI-SEED-004', 'Tomás', 'Rodríguez', 'tomas.rodriguez@example.com', '+5492611234570')
  const viajeBcn = await viajeEntre(ezeId, bcnId, 'EZE → BCN demo')
  const cotDoc = await cotizacion('COT-SEED-004', viajeBcn.id, cliDoc.id, { ida: 780, vuelta: 810, idaVuelta: 1590, impuestos: 230 })
  const resDoc = await prisma.reserva.upsert({
    where: { numeroReserva: 'RES-SEED-004' },
    update: { baja: null, estado: 'DOCUMENTADA', saldoPagado: 1820 },
    create: {
      numeroReserva: 'RES-SEED-004',
      cotizacionId: cotDoc.id,
      clienteId: cliDoc.id,
      tipoReserva: 'IDA_Y_VUELTA',
      montoFinal: 1820,
      saldoPagado: 1820,
      estado: 'DOCUMENTADA',
      fechaViaje: dias(1),
      fechaRegreso: dias(8),
      observaciones: 'DOCUMENTADA — viaje mañana, probar recordatorio CHECK_IN',
    },
  })
  await prisma.pasajero.upsert({
    where: { id: 'seed-pasajero-004' },
    update: {},
    create: {
      id: 'seed-pasajero-004',
      reservaId: resDoc.id,
      nombre: 'Tomás',
      apellido: 'Rodríguez',
      documentoTipo: TipoDocumentoIdentidad.PASAPORTE,
      documentoNumero: 'AAB123456',
      fechaNacimiento: new Date('1979-12-20'),
      nacionalidad: 'Argentina',
      esTitular: true,
    },
  })

  // --- 5) Vencida — saldo pendiente y viaje en 3 días, para Flujo4 (?vencidas=true) ---
  const cliVencida = await cliente('CLI-SEED-005', 'Carla', 'Sosa', 'carla.sosa@example.com', '+5492611234571')
  const viajeGru = await viajeEntre(ezeId, gruId, 'EZE → GRU demo')
  const cotVencida = await cotizacion('COT-SEED-005', viajeGru.id, cliVencida.id, { ida: 420, vuelta: 450, idaVuelta: 870, impuestos: 120 })
  const resVencida = await prisma.reserva.upsert({
    where: { numeroReserva: 'RES-SEED-005' },
    update: { baja: null, estado: 'SEÑADA', saldoPagado: 200 },
    create: {
      numeroReserva: 'RES-SEED-005',
      cotizacionId: cotVencida.id,
      clienteId: cliVencida.id,
      tipoReserva: 'IDA_Y_VUELTA',
      montoFinal: 990,
      saldoPagado: 200,
      estado: 'SEÑADA',
      fechaViaje: dias(3),
      fechaRegreso: dias(9),
      observaciones: 'Vencida — saldo pendiente con viaje en 3 días, para Flujo4 (cancelación automática)',
    },
  })

  // --- Recordatorios para HOY, ya enganchados a reservas reales — así Flujo3
  // (cron 9AM / ejecución manual) encuentra algo sin depender de que las
  // fechas de viaje coincidan justo con -14/-1/+1 días al momento del seed.
  await prisma.recordatorio.createMany({
    data: [
      { reservaId: resVencida.id, tipo: TipoRecordatorio.PAGO_SALDO, fechaProgramada: new Date() },
      { reservaId: resDoc.id, tipo: TipoRecordatorio.CHECK_IN, fechaProgramada: new Date() },
      { reservaId: resPagada.id, tipo: TipoRecordatorio.POST_VIAJE, fechaProgramada: new Date() },
    ],
  })

  console.log('  ✓ 5 clientes + 5 reservas (EN_PROCESO, SEÑADA, PAGADA, DOCUMENTADA, vencida) + pasajeros + pagos + recordatorios de hoy')

  // Parámetros del sistema (los actualiza el Flujo 5 cada día, acá los seedeamos)
  console.log('🌱 Seed: parámetros sistema…')
  await prisma.parametroSistema.upsert({
    where: { clave: 'USD_OFICIAL' },
    update: {},
    create: { clave: 'USD_OFICIAL', valor: '1100', descripcion: 'Dólar oficial venta (semilla)' },
  })
  await prisma.parametroSistema.upsert({
    where: { clave: 'USD_BLUE' },
    update: {},
    create: { clave: 'USD_BLUE', valor: '1450', descripcion: 'Dólar blue venta (semilla)' },
  })
  // Antes hardcodeados en el front (Calculadora.js): 21% de impuestos y
  // split 50/50 entre tramo de ida y vuelta. Movidos acá para que el
  // front los lea de la API en vez de tenerlos fijos en el JS — cambiar
  // el IVA o el split ya no requiere tocar código, solo este parámetro.
  await prisma.parametroSistema.upsert({
    where: { clave: 'IVA_PORCENTAJE' },
    update: {},
    create: { clave: 'IVA_PORCENTAJE', valor: '0.21', descripcion: 'Porcentaje de impuestos aplicado sobre el total (Calculadora)' },
  })
  await prisma.parametroSistema.upsert({
    where: { clave: 'SPLIT_IDA_VUELTA' },
    update: {},
    create: { clave: 'SPLIT_IDA_VUELTA', valor: '0.5', descripcion: 'Proporción del total asignada al tramo de ida (el resto va a vuelta)' },
  })
  console.log('  ✓ USD_OFICIAL, USD_BLUE, IVA_PORCENTAJE, SPLIT_IDA_VUELTA')

  // ====================== HOTELES ======================
  console.log('🌱 Seed: hoteles…')
  const hotelesSemilla = [
    // Madrid
    { iata: 'MAD', nombre: 'Hotel Riu Plaza España',  estrellas: 4, precioNoche: 220, descripcion: 'Hotel emblemático en Plaza España, piscina en azotea', rating: 8.5 },
    { iata: 'MAD', nombre: 'Hotel Atocha Madrid',     estrellas: 4, precioNoche: 165, descripcion: 'A 5 min de Atocha, ideal viajeros de negocios', rating: 8.2 },
    { iata: 'MAD', nombre: 'Hostal Madrid Centro',    estrellas: 2, precioNoche: 65,  descripcion: 'Económico, en pleno centro', rating: 7.4 },
    // Miami
    { iata: 'MIA', nombre: 'Fontainebleau Miami Beach', estrellas: 5, precioNoche: 480, descripcion: 'Resort de lujo en Miami Beach', rating: 9.0 },
    { iata: 'MIA', nombre: 'Generator Miami',         estrellas: 3, precioNoche: 130, descripcion: 'Diseño moderno, a una cuadra de la playa', rating: 8.1 },
    { iata: 'MIA', nombre: 'Holiday Inn Miami West',  estrellas: 3, precioNoche: 95,  descripcion: 'Cerca del aeropuerto, ideal para escalas', rating: 7.8 },
    // Cancún
    { iata: 'CUN', nombre: 'Hard Rock Hotel Cancún',   estrellas: 5, precioNoche: 420, descripcion: 'All-inclusive con vista al mar', rating: 8.9 },
    { iata: 'CUN', nombre: 'Krystal Cancún',           estrellas: 4, precioNoche: 210, descripcion: 'Frente al mar, excelente relación precio-calidad', rating: 8.0 },
    // Barcelona
    { iata: 'BCN', nombre: 'Hotel Arts Barcelona',     estrellas: 5, precioNoche: 380, descripcion: 'Frente al Mediterráneo, en el Puerto Olímpico', rating: 9.1 },
    { iata: 'BCN', nombre: 'Praktik Rambla',           estrellas: 3, precioNoche: 145, descripcion: 'Boutique en La Rambla', rating: 8.4 },
    // Buenos Aires
    { iata: 'EZE', nombre: 'Alvear Palace Hotel',      estrellas: 5, precioNoche: 350, descripcion: 'Clásico de Recoleta', rating: 9.3 },
    { iata: 'EZE', nombre: 'NH Florida',               estrellas: 4, precioNoche: 140, descripcion: 'En pleno microcentro porteño', rating: 8.2 },
    // San Pablo
    { iata: 'GRU', nombre: 'Tivoli Mofarrej',          estrellas: 5, precioNoche: 280, descripcion: 'En Av. Paulista, lujo brasileño', rating: 8.8 },
    // Río
    { iata: 'GIG', nombre: 'Belmond Copacabana Palace', estrellas: 5, precioNoche: 520, descripcion: 'Frente a Copacabana, ícono', rating: 9.4 },
    // Punta Cana
    { iata: 'PUJ', nombre: 'Iberostar Selection Bávaro', estrellas: 5, precioNoche: 360, descripcion: 'All-inclusive de lujo en Playa Bávaro', rating: 8.9 },
    // Santiago
    { iata: 'SCL', nombre: 'W Santiago',                estrellas: 5, precioNoche: 290, descripcion: 'Diseño moderno en El Golf', rating: 8.7 },
    // París
    { iata: 'CDG', nombre: 'Hotel des Grands Boulevards', estrellas: 4, precioNoche: 290, descripcion: 'Boutique en el centro de París', rating: 9.0 },
    // Roma
    { iata: 'FCO', nombre: 'Hotel Quirinale',           estrellas: 4, precioNoche: 230, descripcion: 'Histórico, a 10 min de la Fontana di Trevi', rating: 8.3 },
  ]

  for (const h of hotelesSemilla) {
    const dest = await prisma.destino.findUnique({ where: { codigoIATA: h.iata } })
    if (!dest) continue
    const existente = await prisma.hotel.findFirst({
      where: { nombre: h.nombre, destinoId: dest.id, baja: null },
    })
    if (!existente) {
      await prisma.hotel.create({
        data: {
          nombre: h.nombre,
          destinoId: dest.id,
          estrellas: h.estrellas,
          precioNoche: h.precioNoche,
          descripcion: h.descripcion,
          rating: h.rating,
          fuente: 'MANUAL',
        },
      })
    }
  }
  console.log(`  ✓ ${hotelesSemilla.length} hoteles cargados`)

  console.log('✅ Seed completo')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
