#!/bin/sh
# Verifica HQ web publicada. Uso: scripts/hq/tests/verificar-hq-web.sh [version-esperada]
# Por defecto apunta a https://77delta.com/hq; para probar contra otro host (local, staging) exporta
# HQ_BASE antes de llamar, p.ej.: HQ_BASE=http://localhost:8080/hq sh scripts/hq/tests/verificar-hq-web.sh
set -e
B="${HQ_BASE:-https://77delta.com/hq}"
v=$(curl -fsS "$B/" | grep -o "HQ_VERSION = { v: '[0-9.]*'" | grep -o "[0-9.]*'$" | tr -d "'")
[ -n "$v" ] || { echo "FALLO: sin HQ_VERSION en $B/"; exit 1; }
[ -z "$1" ] || [ "$v" = "$1" ] || { echo "FALLO: publicada $v, esperada $1 (caché de Pages: espera 1-2 min)"; exit 1; }
for f in app/main.js app/api.js app/estado.js app/recargador.js app/rutas.js app/buscador.js app/licitaciones.js app/shell.js app/ui.js app/tarjeta.js app/detalle.js app/dnd.js app/vistas/hoy.js app/vistas/objetivo.js app/vistas/tablero.js app/vistas/decisiones.js app/vistas/licitaciones.js app/vistas/equipo.js app/vistas/expedientes.js app/tokens.css app/hq.css sw.js manifest.webmanifest v1/index.html v1/sw.js; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$B/$f"); [ "$code" = 200 ] || { echo "FALLO: $f -> $code"; exit 1; }; done
curl -fsS "$B/sw.js" | grep -q "hq-v15" || { echo "FALLO: sw.js no es la v15"; exit 1; }
curl -fsS "$B/v1/index.html" | grep -q "/hq/v1/sw.js" || { echo "FALLO: v1 sigue registrando /hq/sw.js"; exit 1; }
echo "HQ web OK: v$v"
