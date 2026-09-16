#!/usr/bin/env bash
# Comprueba que las dos cuentas Max (diego@ y team@) tienen la misma configuración de HQ: hooks, latido y hq.env.
# Solo lectura: nunca cambia cuentas ni relanza nada, solo compara configuración.
# Uso: scripts/hq/tests/comprobar-cuentas.sh   (exit 0 si iguales, 1 si difieren)
set -u
A=/home/diego/.claude; B=/home/diego/.claude-team; rc=0
for f in settings.json; do
  da=$(python3 -c "import json,sys; d=json.load(open('$A/$f')); print(json.dumps(d.get('hooks',{}), sort_keys=True))")
  db=$(python3 -c "import json,sys; d=json.load(open('$B/$f')); print(json.dumps(d.get('hooks',{}), sort_keys=True))")
  if [ "$da" != "$db" ]; then echo "DIFIEREN hooks en $f"; diff <(echo "$da" | tr ',' '\n') <(echo "$db" | tr ',' '\n') | head -20; rc=1; else echo "OK hooks $f"; fi
done
for f in /Users/diego/bin/hq-latido.sh ~/.config/77delta/hq.env; do
  if [ -r "$f" ]; then echo "OK $f legible ($(wc -c <"$f") bytes)"; else echo "FALTA $f"; rc=1; fi
done
for k in HQ_URL HQ_ANON HQ_TOKEN; do grep -q "^$k=" ~/.config/77delta/hq.env || { echo "FALTA $k en hq.env"; rc=1; }; done
# los dos CLAUDE.md de cuenta deben apuntar a las mismas reglas de HQ
for d in $A $B; do grep -q 'reglas-agente-hq' "$d/CLAUDE.md" 2>/dev/null && echo "OK $d/CLAUDE.md cita reglas-agente-hq" || echo "AVISO $d/CLAUDE.md no cita reglas-agente-hq"; done
exit $rc
