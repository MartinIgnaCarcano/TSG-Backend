# ============================================================
# Smoke test del flujo COMPLETO STG (bot + vendedor)
# 1. El bot recibe los mensajes y crea Cotización PENDIENTE
# 2. El vendedor (vía API) confirma → se crea Reserva y pasa a SEÑADA/PAGADA
# Uso:  cd C:\Facultad\Tesis\Back\TSG-Backend
#       .\scripts\smoke_test.ps1
# Requiere que el back esté corriendo en localhost:3000
# ============================================================

$ErrorActionPreference = "Stop"
$baseBot   = "http://localhost:3000/api/bot/test"
$baseApi   = "http://localhost:3000/api"
$from      = "whatsapp:+5492611111111"

function Send-Bot($body) {
    $payload = @{ from = $from; body = $body } | ConvertTo-Json -Compress
    try {
        $r = Invoke-RestMethod -Uri $baseBot -Method POST -ContentType "application/json" -Body $payload -TimeoutSec 60
        Write-Host ""
        Write-Host "👤 $from" -ForegroundColor Cyan
        Write-Host "   > $body" -ForegroundColor White
        Write-Host ""
        Write-Host "🤖 Bot:" -ForegroundColor Green
        $r.respuesta -split "`n" | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
        Write-Host ""
        Write-Host ("-" * 60)
        return $r
    } catch {
        Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "🧪 Smoke test STG — flujo completo (bot + vendedor)" -ForegroundColor Yellow
Write-Host ""

# 0) Health
try {
    $health = Invoke-RestMethod -Uri "$baseApi/bot/health" -TimeoutSec 5
    Write-Host "✅ Bot health:" -ForegroundColor Green
    $health | Format-List
} catch {
    Write-Host "❌ El back no está corriendo en localhost:3000" -ForegroundColor Red
    Write-Host "   Arrancalo con: npm run dev"
    exit 1
}

# === PARTE 1: El cliente conversa con el bot ===
Write-Host ""
Write-Host "═══ PARTE 1: Cliente charla con el bot ═══" -ForegroundColor Magenta

Send-Bot "reset"           | Out-Null
Send-Bot "Hola, quiero un vuelo" | Out-Null
Send-Bot "De Mendoza a Madrid del 2026-07-15 al 2026-07-30" | Out-Null
Send-Bot "1 | Juan Test | juan.test@stg.com" | Out-Null

# === PARTE 2: Validar que se haya creado la Cotización PENDIENTE ===
Write-Host ""
Write-Host "═══ PARTE 2: Verificar Cotización en DB ═══" -ForegroundColor Magenta

$cots = Invoke-RestMethod -Uri "$baseApi/cotizaciones" -TimeoutSec 10
$pendiente = $cots | Where-Object { $_.estado -eq 'PENDIENTE' -and $_.cliente.email -eq 'juan.test@stg.com' } | Select-Object -First 1

if (-not $pendiente) {
    Write-Host "❌ No se encontró una Cotización PENDIENTE para juan.test@stg.com" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Cotización pendiente encontrada:" -ForegroundColor Green
Write-Host "   Número: $($pendiente.numeroCotizacion)"
Write-Host "   Cliente ID: $($pendiente.clienteId)"
Write-Host "   Total: USD $($pendiente.precioIdaYVuelta) + impuestos USD $($pendiente.impuestos)"

# === PARTE 3: El vendedor confirma la reserva (simulado por API) ===
Write-Host ""
Write-Host "═══ PARTE 3: Vendedor confirma la reserva ═══" -ForegroundColor Magenta

$montoFinal = [math]::Round([double]$pendiente.precioIdaYVuelta + [double]$pendiente.impuestos, 2)
$bodyReserva = @{
    clienteId    = $pendiente.clienteId
    cotizacionId = $pendiente.id
    tipoReserva  = 'IDA_Y_VUELTA'
    montoFinal   = $montoFinal
    observaciones= 'Confirmada por vendedor (smoke test)'
} | ConvertTo-Json -Compress

$reserva = Invoke-RestMethod -Uri "$baseApi/reservas" -Method POST -ContentType "application/json" -Body $bodyReserva
Write-Host "✅ Reserva creada: $($reserva.numeroReserva)" -ForegroundColor Green

# Marcar la cotización como ACEPTADA
$bodyAceptada = @{ estado = 'ACEPTADA' } | ConvertTo-Json -Compress
Invoke-RestMethod -Uri "$baseApi/cotizaciones/$($pendiente.id)" -Method PUT -ContentType "application/json" -Body $bodyAceptada | Out-Null
Write-Host "✅ Cotización $($pendiente.numeroCotizacion) marcada como ACEPTADA" -ForegroundColor Green

# === PARTE 4: Verificar reserva en estado correcto ===
$reservas = Invoke-RestMethod -Uri "$baseApi/reservas" -TimeoutSec 10
$r = $reservas | Where-Object { $_.id -eq $reserva.id } | Select-Object -First 1
Write-Host ""
Write-Host "✅ Reserva final:" -ForegroundColor Green
Write-Host "   $($r.numeroReserva) | $($r.estado) | $($r.tipoReserva) | USD $($r.montoFinal)"

Write-Host ""
Write-Host "🎉 Flujo end-to-end completo OK." -ForegroundColor Green
Write-Host "   Abrí http://localhost:3000/api/reservas o el front (Reservas.html)" -ForegroundColor Gray
Write-Host ""
