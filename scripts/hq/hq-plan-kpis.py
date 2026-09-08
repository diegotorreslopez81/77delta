#!/usr/bin/env python3
"""HQ · recalcula el valor_actual de las lineas del Plan (pestaña Plan) cuya fuente es 'sql'. El calculo
en si vive dentro de omc_plan_lineas_recalcular_sql (Postgres): las tablas fuente (omc_licitaciones,
omc_ingresos) tienen RLS sin políticas y no son legibles por REST directo, así que este script solo
invoca la función, nunca lee esas tablas por fuera. Cron cada hora (mismo ritmo que hq-kpis.py).

  hq-plan-kpis.py [--seco]
"""
import argparse, json, urllib.request
from pathlib import Path

CONF = Path.home() / '.config' / '77delta' / 'hq.env'


def env():
    e = {}
    for l in CONF.read_text().splitlines():
        if '=' in l and not l.startswith('#'):
            k, v = l.split('=', 1); e[k.strip()] = v.strip().strip('"').strip("'")
    return e


def rpc(e, fn, **p):
    req = urllib.request.Request(e['HQ_URL'].rstrip('/') + '/rest/v1/rpc/' + fn, data=json.dumps(p).encode(), method='POST',
                                 headers={'apikey': e['HQ_ANON'], 'Authorization': 'Bearer ' + e['HQ_ANON'], 'Content-Type': 'application/json'})
    return json.loads(urllib.request.urlopen(req, timeout=30).read() or b'null')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--seco', action='store_true')
    a = ap.parse_args()
    e = env()
    if a.seco:
        lineas = rpc(e, 'omc_plan_lineas_lista', p_token=e['HQ_TOKEN'])
        for l in lineas:
            if l['fuente'] == 'sql':
                print(f"#{l['id']} {l['linea']} ({l['sql_metrica']}): valor_actual actual = {l['valor_actual']}")
        return
    r = rpc(e, 'omc_plan_lineas_recalcular_sql', p_token=e['HQ_TOKEN'])
    print('lineas recalculadas:', r.get('actualizadas'))


if __name__ == '__main__':
    main()
