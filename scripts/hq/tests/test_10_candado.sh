#!/usr/bin/env bash
# scripts/hq/tests/test_10_candado.sh · se ejecuta con el entorno del tenant pruebas (HQ_*). Imprime OK/FALLO por caso y sale 1 si alguno falla.
set -u
AQUI="$(cd "$(dirname "$0")" && pwd)"; HQ="$AQUI/../hq.py"; LOCK="$AQUI/../../gmail/enviar-con-lock.sh"; FALLOS=0
caso() { local esperado="$1"; shift; "$LOCK" "$@" >/tmp/candado.out 2>&1; local rc=$?; if [ "$rc" = "$esperado" ]; then echo "OK   rc=$rc $*"; else echo "FALLO rc=$rc (esperaba $esperado) $*"; sed -n 1,3p /tmp/candado.out; FALLOS=$((FALLOS+1)); fi; }
TARJETA="$1"; CONTACTO="$2"; CONTACTO_OTRO_EMAIL="$3"
caso 2 --tarjeta "$TARJETA" --to nil@example.com --simular
caso 6 --tarjeta "$TARJETA" --to nil@example.com --contacto 999999 --simular
caso 6 --tarjeta "$TARJETA" --to nil@example.com --contacto "$CONTACTO_OTRO_EMAIL" --simular
caso 7 --tarjeta "$TARJETA" --to nil@example.com --contacto "$CONTACTO" --simular -- --adjunto acta.html
caso 7 --tarjeta "$TARJETA" --to nil@example.com --contacto "$CONTACTO" --simular -- --adjunto INFORME.HTML
caso 0 --tarjeta "$TARJETA" --to nil@example.com --contacto "$CONTACTO" --organo --simular -- --adjunto acta.html
caso 0 --tarjeta "$TARJETA" --to nil@example.com --contacto "$CONTACTO" --simular -- --subject hola
exit $FALLOS
