#!/usr/bin/env bash
# E2E HQ v2: una peticion de Diego recorre alta -> tomar -> contacto -> envio simulado -> hecho con fuente -> feed -> sesion, en el tenant pruebas.
# Se ejecuta a mano antes de cada checkpoint y tras cualquier cambio de schema:
#   bash scripts/hq/tests/e2e-peticion.sh
# Termina con "E2E OK" (exit 0) o se para en el primer paso que falla (exit 1), con el mensaje de ese paso.
set -euo pipefail
cd "$(dirname "$0")/../../.."

ENV_JSON=$(python3 -c "import json; from scripts.hq.tests import pg; pg.preparar_tenant(); pg.limpiar_tenant(); print(json.dumps(pg.entorno_cli('owner')))")
eval "$(python3 -c "import json,shlex,sys; [print(f'export {k}={shlex.quote(str(v))}') for k,v in json.loads(sys.argv[1]).items()]" "$ENV_JSON")"
HQ="python3 scripts/hq/hq.py"
paso() { echo; echo "== $*"; }

python3 - <<'PY'
from scripts.hq.tests import pg
from scripts.hq.tests.pg import rpc
t = pg.preparar_tenant()
pg.sql("insert into omc_agentes (empresa, id, nombre, depto, nivel, sesiones, activo) values ('pruebas','probador','Probador','pruebas',2,array['Probador-Pruebas'],true) on conflict do nothing")
rpc(t['owner'], 'omc_bloque_set', p={'letra': 'C', 'nombre': 'Comercial directo', 'orden': 3})
rpc(t['owner'], 'omc_frente_set', p={'codigo': 'C5', 'bloque': 'C', 'linea': 'Seguimiento', 'kpi': '% respuesta', 'meta': 20})
rpc(t['owner'], 'omc_kit_set', p={'frente': 'C5', 'tipo': 'plantilla', 'nombre': 'Correo de seguimiento', 'url': 'https://docs.google.com/document/d/kit-c5'})
PY

paso "1 alta con frente"
ID=$($HQ --json encargo alta --texto "E2E: escribir a la empresa de prueba" --frente C5 --responsable Probador --origen "Diego e2e" | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")
echo "encargo #$ID"

paso "1b alta sin frente debe fallar"
if $HQ encargo alta --texto "sin frente" --responsable Probador 2>/dev/null; then echo "FALLO: acepto alta sin frente"; exit 1; fi
echo ok

paso "2 tomar"
$HQ encargo tomar "$ID" --agente Probador

paso "3 contacto"
CID=$($HQ --json contacto alta --encargo "$ID" --persona "Prueba E2E" --email prueba@example.com --organizacion "Empresa E2E" --canal correo --motivo "seguimiento" | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")
echo "contacto #$CID"

paso "4 tarjeta aprobada y envio simulado"
TID=$($HQ --json pedir --agente probador --tipo contacto --titulo "Aprobar correo E2E" --detalle "prueba" | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")
python3 -c "from scripts.hq.tests import pg; pg.sql(\"update omc_solicitudes set estado = '{0}' where id = {1}\", 'aprobada', $TID)"
# Reloj falso solo para este paso (mismo truco que test_10_candado.sh): enviar-con-lock.sh lee la hora
# con "date +%s"; con el shim en PATH, esa llamada da mediodia de hoy, dentro de la franja 8-20, para
# que el paso se ejecute de verdad en vez de aceptar un rc=3 de "fuera de horario" como bueno de noche.
DATE_REAL="$(command -v date)"
SHIM="$(mktemp -d)"
cat > "$SHIM/date" <<EOS
#!/usr/bin/env bash
if [ "\$#" = 1 ] && [ "\$1" = "+%s" ]; then exec "$DATE_REAL" -d "\$("$DATE_REAL" +%Y-%m-%d) 12:00" +%s; fi
exec "$DATE_REAL" "\$@"
EOS
chmod +x "$SHIM/date"
if PATH="$SHIM:$PATH" bash scripts/gmail/enviar-con-lock.sh --tarjeta "$TID" --to prueba@example.com --contacto "$CID" --simular -- --subject "E2E" --body "hola"; then
  echo "simulacro ok"
else
  rc=$?
  rm -rf "$SHIM"
  echo "FALLO rc=$rc"; exit 1
fi
rm -rf "$SHIM"

paso "4b envio sin contacto debe fallar"
if bash scripts/gmail/enviar-con-lock.sh --tarjeta "$TID" --to prueba@example.com --simular -- --subject x 2>/dev/null; then echo "FALLO: envio sin contacto"; exit 1; fi
echo ok

paso "5 hecho sin fuente debe fallar"
if $HQ encargo estado "$ID" hecho --agente Probador 2>/dev/null; then echo "FALLO: hecho sin fuente"; exit 1; fi
echo ok

paso "5b hecho con fuente"
$HQ encargo hecho "$ID" --fuente https://docs.google.com/document/d/kit-c5 --entregable https://docs.google.com/document/d/entregable --agente Probador

paso "6 feed"
N=$($HQ --json feed | python3 -c "import json,sys; print(len([x for x in json.load(sys.stdin) if x['encargo_id'] == $ID]))")
echo "$N eventos del encargo"
[ "$N" -ge 4 ] || { echo "FALLO: feed con $N eventos"; exit 1; }

paso "7 sesion"
XID=$($HQ --json expediente alta --nombre "Expediente E2E" --tipo cliente --frente C5 --responsable Probador | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")
$HQ sesion abrir --expediente "$XID" --agente Probador >/dev/null
SID=$(python3 -c "from scripts.hq.tests import pg; print(pg.sql(\"select id from omc_sesiones where estado = '{0}' order by id desc limit 1\", 'abierta')[0]['id'])")
$HQ sesion cerrar "$SID" --resumen "E2E cerrada" --agente Probador

# Limpieza final: sin esto el tenant "pruebas" se queda con el bloque C, el frente C5, el encargo,
# el contacto, el expediente y la sesion de esta pasada, y la siguiente vez que corra la suite
# completa test_03_frentes.py revienta (su setUpClass borra omc_plan_lineas a pelo, sin borrar antes
# los encargos que la referencian, y omc_encargos_frente_obligatorio lo rechaza). limpiar_tenant()
# deja el orden de borrado correcto (encargos antes que lineas/bloques); se repite aqui al final por
# la misma razon que al principio: dejar "pruebas" limpio para quien corra despues, sea este mismo
# script otra vez o la suite de unittest.
python3 -c "from scripts.hq.tests import pg; pg.limpiar_tenant()"

echo
echo "E2E OK"
