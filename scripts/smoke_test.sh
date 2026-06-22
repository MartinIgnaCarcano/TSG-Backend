#!/usr/bin/env bash
# ============================================================
# Smoke test del bot — variante bash (Mac/Linux/Git-Bash en Win)
# ============================================================
set -e
BASE="http://localhost:3000/api/bot/test"
FROM="whatsapp:+5492611111111"

send() {
  local body="$1"
  echo ""
  echo "👤 $FROM"
  echo "   > $body"
  echo ""
  echo "🤖 Bot:"
  curl -s -X POST "$BASE" \
    -H "Content-Type: application/json" \
    -d "{\"from\":\"$FROM\",\"body\":\"$body\"}" \
    | python3 -c "import sys, json; r=json.load(sys.stdin); [print(f'   {l}') for l in r['respuesta'].split(chr(10))]"
  echo ""
  echo "------------------------------------------------------------"
}

echo ""
echo "🧪 Smoke test del bot STG (sin Twilio)"
echo ""

# Health check
echo "✅ Health:"
curl -s http://localhost:3000/api/bot/health | python3 -m json.tool

send "reset"
send "Hola, quiero un vuelo"
send "De Mendoza a Madrid del 2026-07-15 al 2026-07-30"
send "1 | Juan Test | juan.test@stg.com"

echo ""
echo "🎉 Flujo end-to-end OK. Mirá http://localhost:3000/api/reservas"
echo ""
