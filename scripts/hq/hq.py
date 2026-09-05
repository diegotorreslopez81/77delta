#!/usr/bin/env python3
"""HQ · cliente de línea de comandos para los agentes de la One Man Corporation.

Un agente pide aprobaciones o plantea dudas a Diego, espera el veredicto y cierra el bucle.
Configuración en ~/.config/77delta/hq.env (HQ_URL, HQ_ANON, HQ_TOKEN, HQ_NOTIFY_URL, HQ_AGENTE).
El agente se resuelve por --agente, HQ_AGENTE, el fichero .claude/hq-agente del repo o el nombre de la carpeta.

  hq.py pedir --tipo gasto --titulo "Pagar Hetzner 48 €" --importe 48 [--detalle ...] [--enlace ...] [--vence 2026-09-09] [--esperar]
  hq.py duda --titulo "¿Presentamos Silicosis con la contradicción ISO?" --detalle "..."
  hq.py estado 12 | hq.py esperar 12 [--timeout 21600] | hq.py hecho 12 [--nota ...] | hq.py fallo 12 --nota ...
  hq.py activo [agente]        (código 0 activo, 2 desactivado, 3 no existe)
  hq.py pendientes [agente]
"""
import argparse, json, os, sys, time, urllib.request, urllib.error
from pathlib import Path

CONF = Path.home() / '.config' / '77delta' / 'hq.env'
TIPOS = ('gasto', 'contacto', 'publicacion', 'estrategia', 'duda', 'accion', 'otro')


def env():
    e = {}
    if CONF.exists():
        for l in CONF.read_text().splitlines():
            l = l.strip()
            if '=' in l and not l.startswith('#'):
                k, v = l.split('=', 1)
                e[k.strip()] = v.strip().strip('"').strip("'")
    e.update({k: v for k, v in os.environ.items() if k.startswith('HQ_')})
    for k in ('HQ_URL', 'HQ_ANON', 'HQ_TOKEN'):
        if not e.get(k):
            sys.exit(f'falta {k} en {CONF}')
    return e


E = env()


def rpc(fn, **params):
    req = urllib.request.Request(E['HQ_URL'].rstrip('/') + '/rest/v1/rpc/' + fn, data=json.dumps(params).encode(), method='POST',
                                 headers={'apikey': E['HQ_ANON'], 'Authorization': 'Bearer ' + E['HQ_ANON'], 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read() or b'null')
    except urllib.error.HTTPError as ex:
        cuerpo = ex.read().decode()[:400]
        try:
            cuerpo = json.loads(cuerpo).get('message', cuerpo)
        except Exception:
            pass
        sys.exit(f'HQ {fn}: HTTP {ex.code} {cuerpo}')


def agente_actual(explicito=None):
    if explicito:
        return explicito
    if E.get('HQ_AGENTE_FORZADO'):
        return E['HQ_AGENTE_FORZADO']
    d = Path.cwd()
    for p in [d, *d.parents]:
        f = p / '.claude' / 'hq-agente'
        if f.exists():
            return f.read_text().strip()
    return E.get('HQ_AGENTE') or d.name


def avisar(solicitud):
    """Broadcast en tiempo real a la app y push al móvil. Nunca bloquea al agente."""
    empresa = None
    try:
        empresa = rpc('omc_token_info', p_token=E['HQ_TOKEN']).get('empresa')
        req = urllib.request.Request(E['HQ_URL'].rstrip('/') + '/realtime/v1/api/broadcast', method='POST',
                                     data=json.dumps({'messages': [{'topic': 'omc:' + empresa, 'event': 'cambio', 'payload': {'id': solicitud['id']}}]}).encode(),
                                     headers={'apikey': E['HQ_ANON'], 'Authorization': 'Bearer ' + E['HQ_ANON'], 'Content-Type': 'application/json'})
        urllib.request.urlopen(req, timeout=10).read()
    except Exception:
        pass
    if E.get('HQ_NOTIFY_URL'):
        try:
            req = urllib.request.Request(E['HQ_NOTIFY_URL'].rstrip('/') + '/hq/notificar', method='POST',
                                         data=json.dumps({'token': E['HQ_TOKEN'], 'id': solicitud['id']}).encode(),
                                         headers={'Content-Type': 'application/json'})
            urllib.request.urlopen(req, timeout=15).read()
        except Exception:
            pass


def linea(s):
    extra = []
    if s.get('importe') is not None:
        extra.append(f"{s['importe']} €")
    if s.get('vence'):
        extra.append('vence ' + s['vence'][:16].replace('T', ' '))
    if s.get('respuesta'):
        extra.append('respuesta: ' + s['respuesta'])
    if s.get('resultado'):
        extra.append('resultado: ' + s['resultado'])
    return f"#{s['id']} [{s['estado']}] {s['tipo']} · {s['agente']} · {s['titulo']}" + (' · ' + ' · '.join(extra) if extra else '')


def salida(obj, js):
    if js:
        print(json.dumps(obj, ensure_ascii=False))
    elif isinstance(obj, list):
        print('\n'.join(linea(s) for s in obj) or '(nada)')
    else:
        print(linea(obj))


def esperar(sid, timeout, intervalo, js):
    fin = time.time() + timeout
    while True:
        s = rpc('omc_estado', p_token=E['HQ_TOKEN'], p_id=sid)
        if s['estado'] != 'pendiente':
            salida(s, js)
            return 0 if s['estado'] in ('aprobada', 'respondida') else 1
        if time.time() > fin:
            print(f"#{sid} sigue pendiente tras {timeout}s", file=sys.stderr)
            return 4
        time.sleep(intervalo)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--json', action='store_true')
    sub = ap.add_subparsers(dest='cmd', required=True)

    def comun(p):
        p.add_argument('--titulo', required=True)
        p.add_argument('--detalle', default='')
        p.add_argument('--importe', type=float)
        p.add_argument('--riesgo', default='')
        p.add_argument('--enlace', default='')
        p.add_argument('--vence', default='', help='ISO: 2026-09-09 o 2026-09-09T12:00')
        p.add_argument('--agente')
        p.add_argument('--depto')
        p.add_argument('--prioridad', type=int)
        p.add_argument('--esperar', nargs='?', const=21600, type=int, help='bloquea hasta el veredicto (segundos, 6h por defecto)')
        p.add_argument('--intervalo', type=int, default=30)

    p = sub.add_parser('pedir'); comun(p); p.add_argument('--tipo', choices=TIPOS, default='otro')
    p = sub.add_parser('duda'); comun(p)
    p = sub.add_parser('estado'); p.add_argument('id', type=int)
    p = sub.add_parser('esperar'); p.add_argument('id', type=int); p.add_argument('--timeout', type=int, default=21600); p.add_argument('--intervalo', type=int, default=30)
    p = sub.add_parser('hecho'); p.add_argument('id', type=int); p.add_argument('--nota', default='')
    p = sub.add_parser('fallo'); p.add_argument('id', type=int); p.add_argument('--nota', default='')
    p = sub.add_parser('activo'); p.add_argument('agente', nargs='?')
    p = sub.add_parser('pendientes'); p.add_argument('agente', nargs='?')
    p = sub.add_parser('ingreso', help='libro de ingresos (admin-books): crear, editar o borrar una fila')
    p.add_argument('--id', type=int); p.add_argument('--cliente'); p.add_argument('--linea', choices=('cupones', 'licitaciones', 'consultoria', 'producto', 'formacion', 'otro'))
    p.add_argument('--concepto'); p.add_argument('--importe', type=float); p.add_argument('--estado', choices=('propuesto', 'concedido', 'contratado', 'facturado', 'cobrado', 'perdido'))
    p.add_argument('--periodicidad', choices=('unico', 'mensual', 'anual')); p.add_argument('--fecha'); p.add_argument('--nota'); p.add_argument('--borrar', action='store_true'); p.add_argument('--agente')
    p = sub.add_parser('ingresos', help='listar el libro de ingresos')
    p = sub.add_parser('kpi', help='fijar un KPI de negocio'); p.add_argument('--clave', required=True); p.add_argument('--valor', type=float); p.add_argument('--texto', default=''); p.add_argument('--fuente')
    a = ap.parse_args()

    if a.cmd in ('pedir', 'duda'):
        payload = {'agente': agente_actual(a.agente), 'tipo': 'duda' if a.cmd == 'duda' else a.tipo, 'titulo': a.titulo, 'detalle': a.detalle,
                   'riesgo': a.riesgo, 'enlace': a.enlace, 'vence': a.vence}
        if a.importe is not None: payload['importe'] = a.importe
        if a.depto: payload['depto'] = a.depto
        if a.prioridad: payload['prioridad'] = a.prioridad
        s = rpc('omc_pedir', p_token=E['HQ_TOKEN'], p=payload)
        avisar(s)
        salida(s, a.json)
        if a.esperar:
            sys.exit(esperar(s['id'], a.esperar, a.intervalo, a.json))
    elif a.cmd == 'estado':
        salida(rpc('omc_estado', p_token=E['HQ_TOKEN'], p_id=a.id), a.json)
    elif a.cmd == 'esperar':
        sys.exit(esperar(a.id, a.timeout, a.intervalo, a.json))
    elif a.cmd in ('hecho', 'fallo'):
        salida(rpc('omc_reportar', p_token=E['HQ_TOKEN'], p_id=a.id, p_ok=(a.cmd == 'hecho'), p_nota=a.nota), a.json)
    elif a.cmd == 'activo':
        r = rpc('omc_latido', p_token=E['HQ_TOKEN'], p_agente=agente_actual(a.agente))
        if a.json:
            print(json.dumps(r, ensure_ascii=False))
        elif not r['existe']:
            print(f"{r['agente']}: no está dado de alta en HQ (se considera activo)")
        else:
            modelo = f" · modelo {r['modelo']} (subagentes {r.get('subagentes') or 'por defecto'})" if r.get('modelo') else ''
            print(f"{r['agente']} ({r['depto']}): {'ACTIVO' if r['activo'] else 'DESACTIVADO'} · {r['pendientes']} aprobadas por ejecutar{modelo}")
        sys.exit(0 if not r['existe'] and False else (3 if not r['existe'] else (0 if r['activo'] else 2)))
    elif a.cmd == 'pendientes':
        salida(rpc('omc_mis_solicitudes', p_token=E['HQ_TOKEN'], p_agente=agente_actual(a.agente)), a.json)
    elif a.cmd == 'ingreso':
        p = {k: v for k, v in {'id': a.id, 'cliente': a.cliente, 'linea': a.linea, 'concepto': a.concepto, 'importe': a.importe, 'estado': a.estado,
                               'periodicidad': a.periodicidad, 'fecha': a.fecha, 'notas': a.nota, 'agente': a.agente, 'borrar': a.borrar or None}.items() if v is not None}
        r = rpc('omc_ingreso_set', p_token=E['HQ_TOKEN'], p=p)
        print(json.dumps(r, ensure_ascii=False) if a.json or 'borrado' in r else f"#{r['id']} {r['cliente']} · {r['linea']} · {r['importe']} € · {r['estado']} · {r.get('fecha') or ''}")
    elif a.cmd == 'ingresos':
        rs = rpc('omc_ingresos', p_token=E['HQ_TOKEN'])
        if a.json: print(json.dumps(rs, ensure_ascii=False))
        else:
            for r in rs: print(f"#{r['id']} {r['cliente']} · {r['linea']} · {r['importe']} € · {r['estado']} · {r.get('periodicidad')} · {r.get('fecha') or ''}{' · ' + r['notas'] if r.get('notas') else ''}")
            print(f"total comprometido: {sum(float(r['importe']) for r in rs if r['estado'] in ('concedido','contratado','facturado','cobrado')):.2f} €")
    elif a.cmd == 'kpi':
        print(json.dumps(rpc('omc_kpi_set', p_token=E['HQ_TOKEN'], p_filas=[{'clave': a.clave, 'valor': a.valor, 'texto': a.texto, 'fuente': a.fuente or agente_actual(None)}]), ensure_ascii=False))


if __name__ == '__main__':
    main()
