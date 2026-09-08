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
import shutil, argparse, json, os, sys, time, urllib.request, urllib.error
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
    """Broadcast en tiempo real a la app (refresco si la tiene abierta). El push al móvil de Diego NO se
    manda desde aquí (8-sep, queja de ruido): lo hace el cron hq-notificar.py agrupando lo pendiente-sin-
    -notificar cada 10 min, para que una ráfaga de tarjetas/comentarios llegue como un único aviso."""
    try:
        empresa = rpc('omc_token_info', p_token=E['HQ_TOKEN']).get('empresa')
        req = urllib.request.Request(E['HQ_URL'].rstrip('/') + '/realtime/v1/api/broadcast', method='POST',
                                     data=json.dumps({'messages': [{'topic': 'omc:' + empresa, 'event': 'cambio', 'payload': {'id': solicitud['id']}}]}).encode(),
                                     headers={'apikey': E['HQ_ANON'], 'Authorization': 'Bearer ' + E['HQ_ANON'], 'Content-Type': 'application/json'})
        urllib.request.urlopen(req, timeout=10).read()
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


def avisar_lic(expediente, texto):
    """Broadcast en tiempo real a la app cuando un agente comenta en el hilo de una licitación. Sin push
    directo (8-sep): es una respuesta de un agente en un hilo que Diego ya conoce, no una tarjeta pendiente
    nueva; si de verdad necesita su decisión, se abre como tarjeta y la recoge hq-notificar.py."""
    try:
        empresa = rpc('omc_token_info', p_token=E['HQ_TOKEN']).get('empresa')
        req = urllib.request.Request(E['HQ_URL'].rstrip('/') + '/realtime/v1/api/broadcast', method='POST',
                                     data=json.dumps({'messages': [{'topic': 'omc:' + empresa, 'event': 'cambio', 'payload': {'lic': expediente}}]}).encode(),
                                     headers={'apikey': E['HQ_ANON'], 'Authorization': 'Bearer ' + E['HQ_ANON'], 'Content-Type': 'application/json'})
        urllib.request.urlopen(req, timeout=10).read()
    except Exception:
        pass


def comentarios_diego(s):
    return [m for m in (s.get('hilo') or []) if m['autor'] == 'diego']


def comentarios_diego_lic(l):
    return [m for m in (l.get('hilo') or []) if m['autor'] == 'diego']


def esperar(sid, timeout, intervalo, js, vistos=None):
    """Bloquea hasta que Diego resuelve (0 aprobada/respondida, 1 rechazada/caducada) o comenta en el hilo (5: responde con 'comentar' y vuelve a esperar)."""
    fin = time.time() + timeout
    s = rpc('omc_estado', p_token=E['HQ_TOKEN'], p_id=sid)
    vistos = len(comentarios_diego(s)) if vistos is None else vistos
    while True:
        if s['estado'] != 'pendiente':
            salida(s, js)
            return 0 if s['estado'] in ('aprobada', 'respondida') else 1
        nuevos = comentarios_diego(s)[vistos:]
        if nuevos:
            for m in nuevos:
                print(f"#{sid} Diego comenta ({m['ts'][:16].replace('T', ' ')}): {m['texto']}")
            print(f"Responde con: hq comentar {sid} --texto \"...\" y vuelve a esperar con: hq esperar {sid} --vistos {len(comentarios_diego(s))}")
            return 5
        if time.time() > fin:
            print(f"#{sid} sigue pendiente tras {timeout}s", file=sys.stderr)
            return 4
        time.sleep(intervalo)
        s = rpc('omc_estado', p_token=E['HQ_TOKEN'], p_id=sid)


def esperar_lic(lic_id, timeout, intervalo, js, vistos=None):
    """Bloquea hasta que Diego comenta en el hilo de una licitación (5: responde con 'lic-comentar' y vuelve a esperar) o pasa el timeout (4)."""
    fin = time.time() + timeout
    l = rpc('omc_lic_hilo', p_token=E['HQ_TOKEN'], p_lic_id=lic_id)
    vistos = len(comentarios_diego_lic(l)) if vistos is None else vistos
    while True:
        nuevos = comentarios_diego_lic(l)[vistos:]
        if nuevos:
            for m in nuevos:
                print(f"{lic_id} Diego comenta ({m['ts'][:16].replace('T', ' ')}): {m['texto']}")
            print(f"Responde con: hq lic-comentar {lic_id} --texto \"...\" y vuelve a esperar con: hq lic-esperar {lic_id} --vistos {len(comentarios_diego_lic(l))}")
            return 5
        if time.time() > fin:
            print(f"{lic_id} sin comentarios nuevos tras {timeout}s", file=sys.stderr)
            return 4
        time.sleep(intervalo)
        l = rpc('omc_lic_hilo', p_token=E['HQ_TOKEN'], p_lic_id=lic_id)


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
    p = sub.add_parser('esperar'); p.add_argument('id', type=int); p.add_argument('--timeout', type=int, default=21600); p.add_argument('--intervalo', type=int, default=30); p.add_argument('--vistos', type=int, help='comentarios de Diego ya leídos')
    p = sub.add_parser('comentar', help='responder en el hilo de una solicitud sin cerrarla'); p.add_argument('id', type=int); p.add_argument('--texto', required=True)
    p = sub.add_parser('hilo', help='ver el hilo de una solicitud'); p.add_argument('id', type=int)
    p = sub.add_parser('retirar', help='retirar tu propia solicitud cuando el hilo cambia el plan'); p.add_argument('id', type=int); p.add_argument('--nota', default='')
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
    p = sub.add_parser('licitaciones', help='licitaciones con la decisión y los motivos de Diego (para Sales)'); p.add_argument('--todas', action='store_true'); p.add_argument('--decididas', action='store_true')
    p = sub.add_parser('lic-hilo', help='ver el hilo de conversación de una licitación'); p.add_argument('id', help='expediente')
    p = sub.add_parser('lic-comentar', help='comentar en el hilo de una licitación sin resolverla'); p.add_argument('id', help='expediente'); p.add_argument('--texto', required=True); p.add_argument('--agente')
    p = sub.add_parser('lic-esperar', help='esperar a que Diego comente en el hilo de una licitación'); p.add_argument('id', help='expediente'); p.add_argument('--timeout', type=int, default=21600); p.add_argument('--intervalo', type=int, default=30); p.add_argument('--vistos', type=int, help='comentarios de Diego ya leídos')
    p = sub.add_parser('parte', help='parte de jornada del agente (Engram, proyecto 77delta): lo leen los demás al arrancar'); p.add_argument('texto', nargs='?'); p.add_argument('--agente')
    p = sub.add_parser('partes', help='partes de las últimas 48 h de todos los agentes'); p.add_argument('--horas', type=int, default=48)
    p = sub.add_parser('escaladas', help='(chief) tarjetas respondidas por Diego con orden de escalar que nadie ha cerrado')
    a = ap.parse_args()

    if a.cmd in ('pedir', 'duda'):
        payload = {'agente': agente_actual(a.agente), 'tipo': 'duda' if a.cmd == 'duda' else a.tipo, 'titulo': a.titulo, 'detalle': a.detalle,
                   'riesgo': a.riesgo, 'enlace': a.enlace, 'vence': a.vence}
        if a.importe is not None: payload['importe'] = a.importe
        if a.depto: payload['depto'] = a.depto
        if a.prioridad: payload['prioridad'] = a.prioridad
        # Formato ejecutivo obligatorio (Diego, 8-sep): tarjetas cortas y en bullets. Se rechaza aquí para que
        # no dependa de que cada agente se acuerde: el detalle largo y en prosa es lo que hace ilegible HQ en el móvil.
        det = (a.detalle or '')
        if len(det) > 700:
            sys.exit(f'Detalle de {len(det)} caracteres: el máximo son 700. Resúmelo en bullets: qué pasa, qué propones, '
                     f'qué decides tú (A/B). El detalle largo va en un documento y aquí se pone el enlace.')
        if len(det) > 220 and not any(l.strip().startswith(('-', '·', '*', '•')) for l in det.splitlines()):
            sys.exit('Detalle en prosa: pásalo a bullets con "- " al principio de cada línea. Diego lee HQ en el móvil.')
        s = rpc('omc_pedir', p_token=E['HQ_TOKEN'], p=payload)
        avisar(s)
        salida(s, a.json)
        if a.esperar:
            sys.exit(esperar(s['id'], a.esperar, a.intervalo, a.json))
    elif a.cmd == 'estado':
        salida(rpc('omc_estado', p_token=E['HQ_TOKEN'], p_id=a.id), a.json)
    elif a.cmd == 'esperar':
        sys.exit(esperar(a.id, a.timeout, a.intervalo, a.json, a.vistos))
    elif a.cmd == 'comentar':
        m = rpc('omc_comentar', p_token=E['HQ_TOKEN'], p_id=a.id, p_texto=a.texto)
        avisar({'id': a.id, 'texto': a.texto})
        print(json.dumps(m, ensure_ascii=False) if a.json else f"#{a.id} comentario enviado a Diego ({m['autor']})")
    elif a.cmd == 'retirar':
        salida(rpc('omc_retirar', p_token=E['HQ_TOKEN'], p_id=a.id, p_nota=a.nota), a.json)
    elif a.cmd == 'hilo':
        s = rpc('omc_estado', p_token=E['HQ_TOKEN'], p_id=a.id)
        if a.json: print(json.dumps(s.get('hilo') or [], ensure_ascii=False))
        else:
            print(linea(s))
            for m in (s.get('hilo') or []): print(f"  [{m['ts'][:16].replace('T', ' ')}] {m['autor']}: {m['texto']}")
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
            com = r.get('comentarios') or []
            aviso = f" · DIEGO HA COMENTADO en {', '.join('#' + str(x) for x in com)}: léelo con 'hq hilo <id>' y contesta con 'hq comentar <id> --texto ...'" if com else ''
            print(f"{r['agente']} ({r['depto']}): {'ACTIVO' if r['activo'] else 'DESACTIVADO'} · {r['pendientes']} aprobadas por ejecutar{modelo}{aviso}")
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
    elif a.cmd == 'licitaciones':
        ls = rpc('omc_licitaciones_lista', p_token=E['HQ_TOKEN'], p_todas=a.todas)
        if a.decididas: ls = [l for l in ls if l['decidido_por'] == 'diego']
        if a.json: print(json.dumps(ls, ensure_ascii=False))
        else:
            for l in ls:
                quien = {'diego': 'DIEGO', 'sales': 'sales/auto'}.get(l['decidido_por'], '')
                mot = (', '.join(l.get('motivos') or []) + (' · ' + l['motivo_texto'] if l.get('motivo_texto') else '')).strip(' ·')
                print(f"{l['expediente']} · {l['organo'][:40]} · {l['importe'] or '?'} € · cierre {l['cierre'] or '?'} · {l['estado'] or '-'} · {l['decision']}{' (' + quien + ')' if quien else ''}{' · ' + mot if mot else ''}")
    elif a.cmd == 'lic-hilo':
        l = rpc('omc_lic_hilo', p_token=E['HQ_TOKEN'], p_lic_id=a.id)
        if a.json:
            print(json.dumps(l.get('hilo') or [], ensure_ascii=False))
        else:
            print(f"{l['expediente']} · {l.get('organo', '')} · {l.get('importe') or '?'} € · {l.get('decision')}")
            for m in (l.get('hilo') or []): print(f"  [{m['ts'][:16].replace('T', ' ')}] {m['autor']}: {m['texto']}")
    elif a.cmd == 'lic-comentar':
        m = rpc('omc_lic_comentar', p_token=E['HQ_TOKEN'], p_lic_id=a.id, p_texto=a.texto, p_agente=agente_actual(a.agente))
        avisar_lic(a.id, a.texto)
        print(json.dumps(m, ensure_ascii=False) if a.json else f"{a.id} comentario enviado a Diego ({m['autor']})")
    elif a.cmd == 'lic-esperar':
        sys.exit(esperar_lic(a.id, a.timeout, a.intervalo, a.json, a.vistos))
    elif a.cmd == 'parte':
        import subprocess, datetime
        texto = a.texto or sys.stdin.read().strip()
        if not texto: sys.exit('parte vacío')
        ag = agente_actual(a.agente); hoy = datetime.date.today().isoformat()
        eng = shutil.which('engram') or os.path.expanduser('~/.local/bin/engram')
        r = subprocess.run([eng, 'save', f'[PARTE {ag}] {hoy}', texto, '--project', '77delta', '--type', 'context'], capture_output=True, text=True)
        print(f"parte de {ag} guardado en Engram (77delta)" if r.returncode == 0 else f"no se pudo guardar: {r.stderr.strip()[:200]}")
        # El parte también cuenta como actividad: si no, omc_agentes.ultima_actividad se queda congelada y
        # hq-test avisa de "10 h sin actividad" a agentes que llevan toda la noche reportando (8-sep).
        # omc_agente_set es solo-owner (401 para un token de agente normal, y rpc() sale con sys.exit en
        # error — un SystemExit que "except Exception" no atrapa); omc_latido ya hace este mismo update
        # y está abierto a cualquier token, así que es la llamada correcta aquí.
        try:
            rpc('omc_latido', p_token=E['HQ_TOKEN'], p_agente=ag)
        except SystemExit:
            pass
    elif a.cmd == 'partes':
        import datetime
        try:
            # /search ordena por relevancia y devuelve como mucho 20, así que en una noche con muchos partes
            # los recientes se caían fuera y el listado salía vacío (detectado por Nil, 8-sep 00:15).
            # /observations sí viene ordenado por fecha descendente: se pide un lote amplio y se filtra aquí.
            rs = json.loads(urllib.request.urlopen(f'http://127.0.0.1:7437/observations?project=77delta&limit={max(200, a.horas * 12)}', timeout=10).read() or b'[]') or []
        except Exception as ex:
            sys.exit(f'Engram local no responde: {ex}')
        desde = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=a.horas)).isoformat()
        # created_at viene como "2026-09-07 22:12:33" (espacio) y desde como "...T22:12:33+00:00": comparadas
        # como texto, el espacio siempre es menor que la T y el filtro se comía TODO. Se normaliza el separador.
        norm = lambda v: (v or '').replace('T', ' ')[:19]
        rs = [x for x in rs if '[PARTE' in (x.get('title') or '') and norm(x.get('created_at')) >= norm(desde)]
        for x in sorted(rs, key=lambda x: x.get('created_at') or ''):
            print(f"{(x.get('created_at') or '')[:16]} {x.get('title')}\n  {(x.get('content') or '').strip()[:600]}")
        if not rs: print('(sin partes en ese periodo)')
    elif a.cmd == 'escaladas':
        import re as _re
        pat = _re.compile(r'escala|@chief|ficha[rd]|product owner|producto nuevo|nuevo puesto', _re.I)
        hq = rpc('omc_hq', p_token=E.get('HQ_OWNER_TOKEN') or E['HQ_TOKEN'])
        hilos = hq.get('hilos') or {}
        out = []
        for s in hq['seguimiento'] + hq['pendientes']:
            textos = [s.get('respuesta') or ''] + [m['texto'] for m in hilos.get(str(s['id']), []) if m['autor'] == 'diego']
            if any(pat.search(t) for t in textos):
                out.append(s)
        if a.json: print(json.dumps(out, ensure_ascii=False))
        else:
            for s in out: print(linea(s))
            if not out: print('(nada escalado pendiente)')
    elif a.cmd == 'kpi':
        print(json.dumps(rpc('omc_kpi_set', p_token=E['HQ_TOKEN'], p_filas=[{'clave': a.clave, 'valor': a.valor, 'texto': a.texto, 'fuente': a.fuente or agente_actual(None)}]), ensure_ascii=False))


if __name__ == '__main__':
    main()
