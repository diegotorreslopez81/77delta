#!/usr/bin/env python3
"""HQ · devuelve a la bandeja las solicitudes pospuestas cuya hora ha llegado y avisa a Diego por push. Cron cada 5 minutos."""
import json, os, sys, urllib.request
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
for s in vencidas:
    try:
        req = urllib.request.Request(e['HQ_NOTIFY_URL'].rstrip('/') + '/hq/notificar', method='POST', headers={'Content-Type': 'application/json'},
                                     data=json.dumps({'token': e['HQ_TOKEN'], 'id': s['id'], 'texto': 'Recordatorio: pospusiste esta decisión y ya toca. ' + s['titulo']}).encode())
        urllib.request.urlopen(req, timeout=15).read()
    except Exception as ex:
        print('aviso fallido', s['id'], ex, file=sys.stderr)
if vencidas:
    print(f"{len(vencidas)} pospuestas devueltas a la bandeja")
