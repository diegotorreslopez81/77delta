#!/usr/bin/env python3
# scripts/hq/migrar-envios-contactos.py
"""Carga ~/.config/77delta/envios-realizados.json (80 envíos del candado, 9-16 sep) en omc_contactos como toques 'enviado'.
Cada envío se cuelga del encargo de su tarjeta (solicitud_id) si existe; si no, del encargo del frente C5 más reciente del agente. --dry-run | --aplicar."""
import json, os, sys, urllib.request

ENVIOS = os.path.expanduser('~/.config/77delta/envios-realizados.json'); EMPRESA = '77delta'


def _sql(q):
    e = dict(l.strip().split('=', 1) for l in open('/Users/diego/dev/infinitelabs-portal-cupons/.env.local') if '=' in l and not l.startswith('#'))
    svc = e['SUPABASE_SERVICE_ROLE_KEY'].strip('"').strip("'")
    req = urllib.request.Request(e['SUPABASE_URL'].strip('"').rstrip('/') + '/pg/query', data=json.dumps({'query': q}).encode(), method='POST',
                                 headers={'apikey': svc, 'Authorization': 'Bearer ' + svc, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read() or b'null') or []


def q(s):
    return 'null' if s is None else "'" + str(s).replace("'", "''") + "'"


def main():
    modo = sys.argv[1] if len(sys.argv) > 1 else '--dry-run'
    envios = list(json.load(open(ENVIOS)).values())
    por_tarjeta = {int(r['solicitud_id']): r['id'] for r in _sql(f"select id, solicitud_id from omc_encargos where empresa={q(EMPRESA)} and solicitud_id is not null")}
    ya = {(r['email'], r['respuesta_ref']) for r in _sql(f"select lower(email) as email, respuesta_ref from omc_contactos where empresa={q(EMPRESA)} and respuesta_ref like 'migracion:%'")}
    c5 = _sql(f"select id from omc_encargos where empresa={q(EMPRESA)} and linea_id = omc_frente_id({q(EMPRESA)}, 'C5') and estado <> 'descartado' order by id desc limit 1")
    fallback = c5[0]['id'] if c5 else None
    filas = []
    for e in envios:
        ref = f"migracion:{e['tarjeta']}"
        if (e['destinatario'].lower(), ref) in ya: continue
        encargo = por_tarjeta.get(int(e['tarjeta'])) or fallback
        filas.append((e, encargo, ref))
    print(f"{len(filas)} envíos a cargar ({sum(1 for f in filas if f[1] == fallback)} sin encargo propio, van a C5 #{fallback})")
    if modo != '--aplicar':
        for e, enc, _ in filas[:80]: print(f"  {e['fecha'][:10]} {e['agente']:<8} -> {e['destinatario']:<40} #{enc} {e['asunto'][:50]}")
        return
    for e, enc, ref in filas:
        toque = 2 if e['asunto'].lower().startswith('re:') else 1
        _sql(f"insert into omc_contactos (empresa, persona, email, canal, motivo, linea_id, encargo_id, solicitud_id, agente, fecha, toque, estado, proximo_toque, respuesta_ref) "
             f"select {q(EMPRESA)}, null, {q(e['destinatario'].lower())}, 'correo', {q(e['asunto'][:200])}, x.linea_id, x.id, {e['tarjeta']}, {q(e['agente'])}, {q(e['fecha'])}, {toque}, 'enviado', "
             f"({q(e['fecha'])}::timestamptz + interval '7 days')::date, {q(ref)} from omc_encargos x where x.id = {enc}")
    print('aplicado')


if __name__ == '__main__':
    main()
