#!/usr/bin/env python3
"""HQ · único origen de push al móvil de Diego (8-sep, queja de ruido: "muchísimas notificaciones y
luego no veo nada en la bandeja"). Cron cada 10 min: lee omc_pendientes_sin_notificar (tarjetas en
estado pendiente, de un tipo que de verdad necesita su decisión -duda/accion/gasto/contacto/estrategia-
y aún no avisadas por push en este estado), manda UN push -sencillo si hay una, agrupado con el
recuento si hay varias- y las marca con omc_marcar_notificado para no repetir.

Con esto dejan de generar push directo: comentarios de agentes (hq.py comentar/lic-comentar), tarjetas
que un agente abre y cierra él mismo (nunca llegan a este listado porque ya no están en pendiente),
hq-test y capataz (no llaman a este cron ni a /hq/notificar). hq-recordatorios.py tampoco notifica ya
por su cuenta: al devolver una pospuesta a la bandeja resetea notificado_push=false y este cron la
recoge en su siguiente pasada.
"""
import json, sys, urllib.request
from pathlib import Path

CONF = Path.home() / '.config' / '77delta' / 'hq.env'
e = {}
for l in CONF.read_text().splitlines():
    l = l.strip()
    if '=' in l and not l.startswith('#'):
        k, v = l.split('=', 1)
        e[k.strip()] = v.strip().strip('"').strip("'")


def rpc(fn, **p):
    req = urllib.request.Request(e['HQ_URL'].rstrip('/') + '/rest/v1/rpc/' + fn, data=json.dumps(p).encode(), method='POST',
                                 headers={'apikey': e['HQ_ANON'], 'Authorization': 'Bearer ' + e['HQ_ANON'], 'Content-Type': 'application/json'})
    return json.loads(urllib.request.urlopen(req, timeout=30).read() or b'null')


def post(ruta, cuerpo):
    req = urllib.request.Request(e['HQ_NOTIFY_URL'].rstrip('/') + ruta, method='POST',
                                 data=json.dumps(cuerpo).encode(), headers={'Content-Type': 'application/json'})
    return json.loads(urllib.request.urlopen(req, timeout=20).read() or b'null')


def main():
    pendientes = rpc('omc_pendientes_sin_notificar', p_token=e['HQ_TOKEN']) or []
    if not pendientes:
        return
    ids = [p['id'] for p in pendientes]
    try:
        if len(pendientes) == 1:
            s = pendientes[0]
            r = post('/hq/notificar', {'token': e['HQ_TOKEN'], 'id': s['id']})
        else:
            r = post('/hq/notificar-lote', {'token': e['HQ_TOKEN'], 'ids': ids})
        print(f"push enviado ({len(pendientes)} tarjeta(s)): {json.dumps(r, ensure_ascii=False)}")
    except Exception as ex:
        print('push fallido, no se marcan como notificadas:', ex, file=sys.stderr)
        return
    m = rpc('omc_marcar_notificado', p_token=e['HQ_TOKEN'], p_ids=ids)
    print('marcadas', m)


if __name__ == '__main__':
    main()
