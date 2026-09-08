#!/usr/bin/env python3
"""HQ · devuelve a la bandeja las solicitudes pospuestas cuya hora ha llegado. Cron cada 5 minutos.
Ya no avisa a Diego por push aquí (8-sep, ruido): omc_pospuestas_vencidas resetea notificado_push=false
al devolverlas, y es hq-notificar.py (cron cada 10 min) quien las recoge y las agrupa con cualquier otra
tarjeta pendiente en un único push."""
import json, sys, urllib.request
from pathlib import Path
CONF = Path.home() / '.config' / '77delta' / 'hq.env'
e = {}
for l in CONF.read_text().splitlines():
    if '=' in l and not l.startswith('#'):
        k, v = l.split('=', 1); e[k.strip()] = v.strip()
def rpc(fn, **p):
    req = urllib.request.Request(e['HQ_URL'].rstrip('/') + '/rest/v1/rpc/' + fn, data=json.dumps(p).encode(), method='POST',
                                 headers={'apikey': e['HQ_ANON'], 'Authorization': 'Bearer ' + e['HQ_ANON'], 'Content-Type': 'application/json'})
    return json.loads(urllib.request.urlopen(req, timeout=30).read() or b'null')
vencidas = rpc('omc_pospuestas_vencidas', p_token=e['HQ_OWNER_TOKEN']) or []
if vencidas:
    print(f"{len(vencidas)} pospuestas devueltas a la bandeja: {', '.join('#' + str(s['id']) for s in vencidas)}")
