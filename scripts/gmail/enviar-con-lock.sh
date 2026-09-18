#!/usr/bin/env bash
# Envoltorio con candado para gmail-agente.py send.
#
# POR QUE EXISTE (Helena, 10-sep-2026, encargo del COO):
# un comando de envio escrito en un hilo de HQ o en un documento puede dispararse VARIAS veces:
# el cron que lo programo, los avisos del capataz mientras la tarjeta siga 'aprobada sin ejecutar',
# y cualquier sesion nueva que lea el traspaso y ejecute el comando literal. El fallo que importa no
# es que el correo no salga (eso se ve y se arregla): es que un TERCERO reciba el mismo correo dos
# veces, que es dano externo y no se deshace.
#
# QUE GARANTIZA
#   1. Candado atomico por (tarjeta, destinatario): un unico envio a cada destinatario bajo esa
#      tarjeta, aunque disparen tres mecanismos a la vez. Por destinatario y no solo por tarjeta,
#      para que un lote legitimo de N correos siga funcionando.
#   2. Los candados viven en ~/.config/77delta/locks-envio/, NO en /tmp: /tmp se limpia al reiniciar
#      y un candado que desaparece no es un candado.
#   3. Ventana horaria obligatoria 8-20 (comunicaciones a terceros), sin flag que la desactive.
#      --no-antes es un suelo ADICIONAL opcional para retrasar un envio concreto mas alla de las 8.
#      Antes (incidente #609) la ventana solo se aplicaba si alguien pasaba --no-antes: Aina envio
#      a las 07:02 porque esa llamada no lo llevaba. Ahora se comprueba siempre, la pases o no.
#   4. Estado: delega en gmail-agente.py, que ya exige la tarjeta en 'aprobada'. Se comprueba antes
#      para no coger el candado si de todas formas no se puede enviar.
#   5. Si el envio falla de verdad, libera el candado para poder reintentar.
#   6. Puerta de contacto (HQ v2, T10): sin --contacto <id> no se dispara, y ese contacto debe existir
#      en HQ con el mismo email que --to y estar en 'previsto' o 'enviado'. Ademas ningun adjunto
#      .html/.md a un tercero (regla 40); con --organo (destinatario = organo de contratacion) si van.
#
# USO
#   enviar-con-lock.sh --tarjeta 347 --to a@b.com --contacto 12 [--organo] \
#                      [--no-antes '2026-09-16 09:00'] [--simular] \
#                      -- <resto de argumentos tal cual para gmail-agente.py send>
#
#   --simular ejecuta todas las comprobaciones y dice que haria, sin enviar y sin dejar candado.
#
# CODIGOS DE SALIDA
#   2 argumentos invalidos o incompletos · 3 fuera de franja horaria · 4 ya enviado (candado) ·
#   5 tarjeta no aprobada · 6 contacto invalido (no existe, estado distinto de previsto/enviado, o
#   email distinto de --to) · 7 adjunto .html/.md sin --organo · 8 --to/--cc/--bcc extra en el passthrough

set -uo pipefail
HQ=/Users/diego/dev/77delta/scripts/hq/hq.py
GM=/Users/diego/dev/77delta/scripts/gmail/gmail-agente.py
LOCKDIR="$HOME/.config/77delta/locks-envio"

TARJETA=""; TO=""; NOANTES=""; SIMULAR=0; CONTACTO=""; ORGANO=0
while [ $# -gt 0 ]; do
  case "$1" in
    --tarjeta)  TARJETA="${2:-}"; shift 2 ;;
    --to)       TO="${2:-}"; shift 2 ;;
    --no-antes) NOANTES="${2:-}"; shift 2 ;;
    --simular)  SIMULAR=1; shift ;;
    --contacto) CONTACTO="${2:-}"; shift 2 ;;
    --organo)   ORGANO=1; shift ;;
    --)         shift; break ;;
    *) echo "argumento no reconocido antes de --: $1" >&2; exit 2 ;;
  esac
done
[ -n "$TARJETA" ] || { echo "falta --tarjeta" >&2; exit 2; }
[ -n "$TO" ]      || { echo "falta --to" >&2; exit 2; }
[ -n "$CONTACTO" ] || { echo "ABORTA (2): falta --contacto <id>. Registra el toque: hq.py contacto alta --encargo N --persona ... --email $TO --canal correo --motivo ..." >&2; exit 2; }

# 2b. puerta de contacto (HQ v2, spec 2.5): sin fila de contacto en HQ no se dispara
FICHA=$(python3 "$HQ" --json contacto ficha "$CONTACTO" 2>&1) || { echo "ABORTA (6): contacto #$CONTACTO no existe en HQ. $(echo "$FICHA" | head -1 | cut -c1-140)"; exit 6; }
C_EMAIL=$(printf '%s' "$FICHA" | python3 -c 'import json,sys; d=json.load(sys.stdin); print((d.get("email") or "").lower())')
C_ESTADO=$(printf '%s' "$FICHA" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("estado",""))')
if [ "$C_EMAIL" != "$(printf '%s' "$TO" | tr 'A-Z' 'a-z')" ]; then echo "ABORTA (6): el contacto #$CONTACTO es de '$C_EMAIL', no de '$TO'."; exit 6; fi
case "$C_ESTADO" in previsto|enviado) ;; *) echo "ABORTA (6): el contacto #$CONTACTO está en '$C_ESTADO'; solo se envía en previsto (o enviado para el segundo toque con fila nueva)."; exit 6 ;; esac

# 2c. ningún .html ni .md a un tercero (regla 40); a un órgano de contratación sí van adjuntos
if [ "$ORGANO" != "1" ]; then
  for arg in "$@"; do arg_lc="${arg,,}"; case "$arg_lc" in *.html|*.htm|*.md) echo "ABORTA (7): adjunto '$arg' en HTML o markdown. Conviértelo a la plantilla 77 Delta (PDF o Google Doc por enlace). Si el destinatario es un órgano de contratación, pasa --organo."; exit 7 ;; esac; done
fi

# 2d. un solo destinatario por invocación (I2, revisión final plan 1): gmail-agente.py send acepta
# --cc, y argparse resuelve un --to repetido con "gana el último", así que un --cc o un segundo --to
# colado en el passthrough (todo lo que va tras --) llega a un tercero sin pasar por las
# comprobaciones de arriba (contacto, candado): esas sólo miran $TO. Cada destinatario necesita su
# propia fila de contacto y su propia invocación de este script.
for arg in "$@"; do
  case "$arg" in
    --to|--to=*|--cc|--cc=*|--bcc|--bcc=*)
      echo "ABORTA (8): un destinatario por invocación, cada uno con su fila de contacto (--cc/--bcc/--to extra no permitidos)."; exit 8 ;;
  esac
done

# 3. ventana horaria obligatoria 8-20, encargo #213 / incidente #609
FRANJA_INICIO_DEFECTO="08:00"
FRANJA_FIN_DEFECTO="20:00"
HOY=$(date +%Y-%m-%d)
INICIO_EPOCH=$(date -d "$HOY $FRANJA_INICIO_DEFECTO" +%s)
FIN_EPOCH=$(date -d "$HOY $FRANJA_FIN_DEFECTO" +%s)
AHORA_EPOCH=$(date +%s)
if [ "$AHORA_EPOCH" -lt "$INICIO_EPOCH" ] || [ "$AHORA_EPOCH" -ge "$FIN_EPOCH" ]; then
  echo "ABORTA (3): fuera de franja $FRANJA_INICIO_DEFECTO-$FRANJA_FIN_DEFECTO. Ahora son $(date '+%Y-%m-%d %H:%M:%S %Z'). No envio."; exit 3
fi

if [ -n "$NOANTES" ]; then
  V=$(date -d "$NOANTES" +%s 2>/dev/null) || { echo "ABORTA (2): fecha invalida en --no-antes: $NOANTES" >&2; exit 2; }
  if [ "$AHORA_EPOCH" -lt "$V" ]; then
    echo "ABORTA (3): --no-antes abre el $NOANTES y ahora son $(date '+%Y-%m-%d %H:%M:%S %Z'). No envio."; exit 3
  fi
fi

# 4. estado de la tarjeta
EST=$(python3 "$HQ" estado "$TARJETA" 2>&1)
if [[ "$EST" != *"[aprobada]"* ]]; then
  echo "ABORTA (5): la tarjeta #$TARJETA no esta en 'aprobada'. gmail-agente.py la rechazaria igual."
  echo "  estado: $(echo "$EST" | head -1 | cut -c1-140)"
  exit 5
fi

# 1+2. candado atomico por tarjeta+destinatario
mkdir -p "$LOCKDIR" 2>/dev/null
CLAVE=$(printf '%s|%s' "$TARJETA" "$TO" | sha1sum | cut -c1-16)
LOCK="$LOCKDIR/t${TARJETA}-${CLAVE}"
[ "$SIMULAR" = "1" ] && LOCK="${LOCK}.simulacro.$$"

if ! mkdir "$LOCK" 2>/dev/null; then
  echo "ABORTA (4): YA SE ENVIO este correo. Candado: $LOCK"
  echo "  $(cat "$LOCK/enviado" 2>/dev/null || echo 'sin marca de hora')"
  echo "  NO reintentes ni reenvies: el destinatario $TO ya lo recibio bajo la tarjeta #$TARJETA."
  exit 4
fi
printf 'destinatario: %s\ntarjeta: %s\n' "$TO" "$TARJETA" > "$LOCK/datos"

if [ "$SIMULAR" = "1" ]; then
  SALIDA=$(python3 "$GM" send --tarjeta "$TARJETA" --to "$TO" "$@" --simular 2>&1)
  RC=$?
  rm -rf "$LOCK"
  if [ $RC -ne 0 ]; then
    echo "SIMULACRO: gmail-agente.py RECHAZA este envio (rc=$RC), no lo intentes de verdad tal cual."
    echo "$SALIDA"
    exit $RC
  fi
  echo "SIMULACRO OK: pasa ventana, pasa estado ('aprobada'), candado libre, y gmail-agente.py valida los argumentos reales (adjuntos, alias, dominio, duplicado)."
  echo "  contacto: #$CONTACTO ($C_EMAIL, $C_ESTADO)"
  echo "  candado real que usaria: ${LOCK%.simulacro.$$}"
  echo "$SALIDA"
  exit 0
fi

python3 "$GM" send --tarjeta "$TARJETA" --to "$TO" "$@"
RC=$?
if [ $RC -ne 0 ]; then
  rm -rf "$LOCK"
  echo "FALLO EL ENVIO (rc=$RC). Candado liberado, se puede reintentar."; exit $RC
fi
date '+%Y-%m-%d %H:%M:%S %Z' > "$LOCK/enviado"
echo "ENVIADO OK a $TO · hora real: $(cat "$LOCK/enviado")"
python3 "$HQ" contacto estado "$CONTACTO" enviado >/dev/null 2>&1 || echo "  aviso: no pude marcar el contacto #$CONTACTO como enviado; hazlo a mano: hq.py contacto estado $CONTACTO enviado"
