#!/usr/bin/env bash
# scripts/hq/aplicar-schema.sh · aplica schema.sql, schema-v2.sql y schema-v3-crm.sql (y las semillas con --seed) en el Supabase de HQ.
set -euo pipefail
AQUI="$(cd "$(dirname "$0")" && pwd)"
PGQ="/Users/diego/dev/cuponsIA/scripts/plataforma/pgq.py"
[ -f "$PGQ" ] || { echo "falta $PGQ" >&2; exit 1; }
for f in schema.sql schema-v2.sql schema-v3-crm.sql; do
  echo "== $f"; python3 "$PGQ" "$AQUI/$f" | cut -c1-300
done
if [ "${1:-}" = "--seed" ]; then
  echo "== seed-77delta-v2.sql"; python3 "$PGQ" "$AQUI/seed-77delta-v2.sql" | cut -c1-300
  echo "== seed-crm-77delta.sql"; python3 "$PGQ" "$AQUI/seed-crm-77delta.sql" | cut -c1-300
fi
python3 "$PGQ" -c "select omc_v2_version() as v" 
