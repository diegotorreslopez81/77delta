#!/usr/bin/env bash
# scripts/hq/tests/test_10_candado.sh · se ejecuta con el entorno del tenant pruebas (HQ_*). Imprime OK/FALLO por caso y sale 1 si alguno falla.
set -u
AQUI="$(cd "$(dirname "$0")" && pwd)"; HQ="$AQUI/../hq.py"; LOCK="$AQUI/../../gmail/enviar-con-lock.sh"; FALLOS=0
caso() { local esperado="$1"; shift; "$LOCK" "$@" >/tmp/candado.out 2>&1; local rc=$?; if [ "$rc" = "$esperado" ]; then echo "OK   rc=$rc $*"; else echo "FALLO rc=$rc (esperaba $esperado) $*"; sed -n 1,3p /tmp/candado.out; FALLOS=$((FALLOS+1)); fi; }
TARJETA="$1"; CONTACTO="$2"; CONTACTO_OTRO_EMAIL="$3"
# Reloj falso solo para el test: el candado lee la hora con "date +%s"; aqui esa llamada devuelve
# las CANDADO_HORA_FAKE de hoy (12:00 por defecto, dentro de la franja 8-20) para que los casos 0
# no dependan de la hora real. El script de envio no cambia y no admite ninguna variable de bypass.
DATE_REAL="$(command -v date)"; SHIM="$(mktemp -d)"
cat > "$SHIM/date" <<EOS
#!/usr/bin/env bash
if [ "\$#" = 1 ] && [ "\$1" = "+%s" ]; then exec "$DATE_REAL" -d "\$("$DATE_REAL" +%Y-%m-%d) \${CANDADO_HORA_FAKE:-12:00}" +%s; fi
exec "$DATE_REAL" "\$@"
EOS
chmod +x "$SHIM/date"; export PATH="$SHIM:$PATH"; trap 'rm -rf "$SHIM"' EXIT
caso 2 --tarjeta "$TARJETA" --to nil@example.com --simular
caso 6 --tarjeta "$TARJETA" --to nil@example.com --contacto 999999 --simular
caso 6 --tarjeta "$TARJETA" --to nil@example.com --contacto "$CONTACTO_OTRO_EMAIL" --simular
caso 7 --tarjeta "$TARJETA" --to nil@example.com --contacto "$CONTACTO" --simular -- --adjunto acta.html
caso 7 --tarjeta "$TARJETA" --to nil@example.com --contacto "$CONTACTO" --simular -- --adjunto INFORME.HTML
caso 0 --tarjeta "$TARJETA" --to nil@example.com --contacto "$CONTACTO" --organo --simular -- --adjunto acta.html
caso 0 --tarjeta "$TARJETA" --to nil@example.com --contacto "$CONTACTO" --simular -- --subject hola
CANDADO_HORA_FAKE=22:00 caso 3 --tarjeta "$TARJETA" --to nil@example.com --contacto "$CONTACTO" --simular -- --subject hola
# I2 (revision final plan 1): --cc o un segundo --to en el passthrough no deben poder saltarse la
# puerta de contacto ni el candado, que solo miran $TO.
caso 8 --tarjeta "$TARJETA" --to nil@example.com --contacto "$CONTACTO" --simular -- --cc x@example.com
caso 8 --tarjeta "$TARJETA" --to nil@example.com --contacto "$CONTACTO" --simular -- --to otro@example.com
exit $FALLOS
