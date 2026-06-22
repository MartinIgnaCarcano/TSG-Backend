import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

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

  // Cliente y reserva de ejemplo para que el front nunca se vea vacío
  console.log('🌱 Seed: cliente + reserva demo…')
  const ezeId = (await prisma.destino.findUnique({ where: { codigoIATA: 'EZE' } }))!.id
  const madId = (await prisma.destino.findUnique({ where: { codigoIATA: 'MAD' } }))!.id

  const cli = await prisma.cliente.upsert({
    where: { numeroCliente: 'CLI-SEED-001' },
    update: { baja: null },
    create: {
      numeroCliente: 'CLI-SEED-001',
      nombre: 'María',
      apellido: 'García',
      email: 'maria.garcia@example.com',
      telefono: '+5492611234567',
    },
  })

  // Buscamos un viaje existente o lo creamos
  let viaje = await prisma.viaje.findFirst({
    where: { origenId: ezeId, destinoId: madId, baja: null },
  })
  if (!viaje) {
    viaje = await prisma.viaje.create({
      data: {
        origenId: ezeId,
        destinoId: madId,
        tieneEscalas: false,
        descripcion: 'EZE → MAD demo',
      },
    })
  }

  const cot = await prisma.cotizacion.upsert({
    where: { numeroCotizacion: 'COT-SEED-001' },
    update: { baja: null },
    create: {
      numeroCotizacion: 'COT-SEED-001',
      viajeId: viaje.id,
      clienteId: cli.id,
      fechaVencimiento: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      moneda: 'USD',
      precioIda: 850,
      precioVuelta: 920,
      precioIdaYVuelta: 1700,
      impuestos: 250,
      observaciones: 'Datos de ejemplo del seed',
    },
  })

  await prisma.reserva.upsert({
    where: { numeroReserva: 'RES-SEED-001' },
    update: { baja: null },
    create: {
      numeroReserva: 'RES-SEED-001',
      cotizacionId: cot.id,
      clienteId: cli.id,
      tipoReserva: 'IDA_Y_VUELTA',
      montoFinal: 1950,
      observaciones: 'Reserva de ejemplo',
    },
  })

  console.log('  ✓ cliente y reserva demo')

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
  console.log('  ✓ USD_OFICIAL y USD_BLUE')

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
