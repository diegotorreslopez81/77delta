#!/usr/bin/env python3
"""HQ · despertador de agentes. Cada minuto lee los eventos nuevos de Diego (comentarios en hilos y decisiones)
y se los escribe al agente en su ventana de tmux (sesión `equipo`), para que responda por el hilo o ejecute sin esperar
a que alguien lo arranque. Estado en ~/.config/77delta/hq-despertar.json (última marca de tiempo procesada)."""
import json, os, subprocess, sys, urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

CONF = Path.home() / '.config' / '77delta' / 'hq.env'
ESTADO = Path.home() / '.config' / '77delta' / 'hq-despertar.json'
HQ = '/Users/diego/dev/77delta/scripts/hq/hq.py'
e = {}
for l in CONF.read_text().splitlines():
    if '=' in l and not l.startswith('#'):
        k, v = l.split('=', 1); e[k.strip()] = v.strip()


def rpc(fn, **p):
    req = urllib.request.Request(e['HQ_URL'].rstrip('/') + '/rest/v1/rpc/' + fn, data=json.dumps(p).encode(), method='POST',
                                 headers={'apikey': e['HQ_ANON'], 'Authorization': 'Bearer ' + e['HQ_ANON'], 'Content-Type': 'application/json'})
    return json.loads(urllib.request.urlopen(req, timeout=30).read() or b'null')


def ventanas():
    try:
        out = subprocess.run(['tmux', 'list-windows', '-t', 'equipo', '-F', '#W'], capture_output=True, text=True, timeout=5).stdout.split()
    except Exception:
        out = []
    return set(out)


def escribir(ventana, texto):
    subprocess.run(['tmux', 'send-keys', '-t', f'equipo:{ventana}', '-l', texto], check=True, timeout=5)
    subprocess.run(['tmux', 'send-keys', '-t', f'equipo:{ventana}', 'Enter'], check=True, timeout=5)


def main():
    est = json.loads(ESTADO.read_text()) if ESTADO.exists() else {}
    desde = est.get('desde') or (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
    eventos = rpc('omc_eventos', p_token=e['HQ_OWNER_TOKEN'], p_desde=desde) or []
    if not eventos:
        return
    agentes = {a['id']: a for a in rpc('omc_hq', p_token=e['HQ_OWNER_TOKEN'])['agentes']}
    wins = ventanas(); ultimo = desde; n = 0
    for ev in eventos:
        ultimo = max(ultimo, ev['ts'])
        a = agentes.get(ev['agente']) or {}
        ventana = next((s for s in (a.get('sesiones') or []) if s in wins), None)
        if not ventana:
            print(f"sin ventana tmux para {ev['agente']} (#{ev['id']})", file=sys.stderr); continue
        texto = (ev.get('texto') or '').replace('\n', ' ').strip()
        if ev['tipo'] == 'comentario':
            msg = (f"[HQ] Diego ha comentado en tu solicitud #{ev['id']} ({ev['titulo']}): «{texto}». Contesta AHORA por el hilo, corto y ejecutivo: "
                   f"python3 {HQ} comentar {ev['id']} --texto \"...\" ; si te pide hacer algo reversible, hazlo y cuéntalo en el mismo comentario; si cambia el plan, retira la petición y abre otra.")
        else:
            verbo = {'aprobada': 'APROBADO', 'rechazada': 'RECHAZADO', 'respondida': 'RESPONDIDO'}.get(ev['estado'], ev['estado'])
            msg = (f"[HQ] Diego ha {verbo} tu solicitud #{ev['id']} ({ev['titulo']})" + (f": «{texto}»" if texto else '') +
                   f". Actúa ahora: si está aprobada, ejecútala y cierra con python3 {HQ} hecho {ev['id']} --nota \"...\"; si es una respuesta, aplícala y cierra igual; si te pide escalar o fichar, reenvíalo al chief (sesión Chief OMC) y cierra con hecho.")
        try:
            escribir(ventana, msg); n += 1
        except Exception as ex:
            print(f"no se pudo escribir en {ventana}: {ex}", file=sys.stderr)
    ESTADO.write_text(json.dumps({'desde': ultimo}))
    print(f"{n} agentes despertados")


if __name__ == '__main__':
    main()
