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
import shutil, argparse, json, os, subprocess, sys, time, urllib.request, urllib.error
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


def engram(titulo, texto, tipo='context'):
    """Espejo automático en Engram (decisión del chief, doc 32-engram-hq-omc.md, encargo 42): HQ dice
    'cómo está', Engram dice 'qué pasó y por qué'. Nunca debe romper la operación de HQ si Engram no
    responde - si el guardado falla, se encola en ~/.config/77delta/engram-cola.jsonl y hq-test.py
    (cada 10 min) la vacía."""
    eng = shutil.which('engram') or os.path.expanduser('~/.local/bin/engram')
    try:
        r = subprocess.run([eng, 'save', titulo, texto, '--project', '77delta', '--type', tipo], capture_output=True, text=True, timeout=15)
        if r.returncode == 0:
            return
    except Exception:
        pass
    try:
        cola = Path.home() / '.config' / '77delta' / 'engram-cola.jsonl'
        cola.parent.mkdir(parents=True, exist_ok=True)
        with cola.open('a') as f:
            f.write(json.dumps({'titulo': titulo, 'texto': texto, 'tipo': tipo}, ensure_ascii=False) + '\n')
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
        p.add_argument('--cuerpo', default='', help='texto completo de un envío (correo, mensaje) para verlo plegado en la tarjeta; sin tope de 700 caracteres')
        p.add_argument('--cuerpo-archivo', dest='cuerpo_archivo', help='leer --cuerpo desde un fichero en vez de pasarlo en la línea de comandos')
        p.add_argument('--agente')
        p.add_argument('--depto')
        p.add_argument('--prioridad', type=int)
        p.add_argument('--esperar', nargs='?', const=21600, type=int, help='bloquea hasta el veredicto (segundos, 6h por defecto)')
        p.add_argument('--intervalo', type=int, default=30)

    p = sub.add_parser('pedir'); comun(p); p.add_argument('--tipo', choices=TIPOS, default='otro')
    p = sub.add_parser('duda'); comun(p)
    p = sub.add_parser('estado'); p.add_argument('id', type=int)
    p = sub.add_parser('esperar'); p.add_argument('id', type=int); p.add_argument('--timeout', type=int, default=21600); p.add_argument('--intervalo', type=int, default=30); p.add_argument('--vistos', type=int, help='comentarios de Diego ya leídos')
    p = sub.add_parser('comentar', help='responder en el hilo de una solicitud sin cerrarla'); p.add_argument('id', type=int); p.add_argument('--texto', required=True); p.add_argument('--agente')
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
    p = sub.add_parser('plan', help='pestaña Plan: objetivo global y líneas con KPI, meta y semáforo')
    p = sub.add_parser('plan-linea', help='(Diego) crear o editar una línea del plan estratégico')
    p.add_argument('--id', type=int); p.add_argument('--linea'); p.add_argument('--kpi'); p.add_argument('--meta', type=float); p.add_argument('--unidad')
    p.add_argument('--responsable'); p.add_argument('--proximo-hito', dest='proximo_hito'); p.add_argument('--fecha-hito', dest='fecha_hito')
    p.add_argument('--fuente', choices=('manual', 'sql')); p.add_argument('--sql-metrica', dest='sql_metrica'); p.add_argument('--orden', type=int); p.add_argument('--borrar', action='store_true')
    p = sub.add_parser('kpi-linea', help='actualizar el progreso de TU línea del plan (solo fuente manual)')
    p.add_argument('id', type=int); p.add_argument('--valor', type=float, required=True); p.add_argument('--proximo-hito', dest='proximo_hito'); p.add_argument('--fecha-hito', dest='fecha_hito'); p.add_argument('--agente')
    p = sub.add_parser('decision', help='anotar una decisión estratégica (queda en el registro de la pestaña Plan)')
    p.add_argument('--texto', required=True); p.add_argument('--linea', type=int, help='id de la línea del plan afectada'); p.add_argument('--tarjeta', type=int, help='id de la solicitud de la que viene'); p.add_argument('--agente')
    p = sub.add_parser('decisiones', help='ver el registro de decisiones estratégicas')
    p = sub.add_parser('encargo', help='registro de encargos de Diego (chat o HQ), segundo nivel de la pestaña Plan')
    esub = p.add_subparsers(dest='sub', required=True)
    ea = esub.add_parser('alta', help='registrar un encargo nuevo (o editarlo si pasas --id)')
    ea.add_argument('--id', type=int); ea.add_argument('--texto'); ea.add_argument('--interpretacion'); ea.add_argument('--linea', type=int, help='id de línea del plan; sin esto, fuera de plan')
    ea.add_argument('--departamento'); ea.add_argument('--responsable'); ea.add_argument('--estado', choices=('encolado', 'en_curso', 'bloqueado_diego', 'hecho', 'descartado'))
    ea.add_argument('--prioridad', type=int); ea.add_argument('--tarjeta', type=int); ea.add_argument('--proximo-hito', dest='proximo_hito'); ea.add_argument('--fecha-hito', dest='fecha_hito'); ea.add_argument('--agente')
    ea.add_argument('--espera', help='en qué espera un encargo EN_CURSO, corto: "2 referees", "tu decisión"... (registro vivo, encargo 43)')
    ea.add_argument('--mensaje', type=int, help='id del mensaje de Diego (tarjeta 193) del que nace este encargo (encargo 42)')
    ev = esub.add_parser('avance', help='anotar el último avance de un encargo')
    ev.add_argument('id', type=int); ev.add_argument('--texto', required=True); ev.add_argument('--agente')
    ee = esub.add_parser('estado', help='cambiar el estado de un encargo')
    ee.add_argument('id', type=int); ee.add_argument('valor', choices=('encolado', 'en_curso', 'bloqueado_diego', 'hecho', 'descartado')); ee.add_argument('--agente')
    ep = esub.add_parser('prioridad', help='(Diego) subir o bajar un encargo en su línea')
    ep.add_argument('id', type=int); ep.add_argument('direccion', choices=('subir', 'bajar'))
    esub.add_parser('lista', help='ver todos los encargos')
    p = sub.add_parser('parte', help='parte de jornada del agente (Engram, proyecto 77delta): lo leen los demás al arrancar'); p.add_argument('texto', nargs='?'); p.add_argument('--agente')
    p = sub.add_parser('partes', help='partes de las últimas 48 h de todos los agentes'); p.add_argument('--horas', type=int, default=48)
    p = sub.add_parser('historia', help='buscar en el histórico de Engram (título y contenido), en vez de fiarse de la memoria de la sesión')
    p.add_argument('texto'); p.add_argument('--limite', type=int, default=15)
    p = sub.add_parser('escaladas', help='(chief) tarjetas respondidas por Diego con orden de escalar que nadie ha cerrado')
    p = sub.add_parser('alta-agente', help='alta de un agente nuevo: pasos 1,2,4,5 de docs/empresa/30-alta-de-agente.md (puesto en HQ, ventana en equipo + hq-agente, nivel de ahorro, tarjeta del alias). Pasos 3 (CLAUDE.md) y 6 (relanzar) se quedan a mano.')
    p.add_argument('--id', required=True, help='id del puesto en HQ, ej. delivery-x')
    p.add_argument('--nombre', required=True, help='nombre de pila, ej. Marta')
    p.add_argument('--depto', required=True)
    p.add_argument('--nivel', type=int, choices=(1, 2, 3), default=3, help='nivel de ahorro (dict NIVEL de hq-ahorro.py)')
    p.add_argument('--jefe', default='chief')
    p.add_argument('--ventana', required=True, help='nombre de la ventana tmux, ej. Marta-Rol')
    p.add_argument('--carpeta', required=True, help='ruta absoluta del repo del agente')
    p.add_argument('--modelo', default='sonnet')
    p.add_argument('--cuenta', choices=('a', 'b'), required=True, help='a = cuenta de Diego, b = segunda cuenta Max team@77delta.com')
    p.add_argument('--alias', help='alias de correo para "enviar como", minúsculas sin acentos; por defecto se deriva de --nombre')
    p.add_argument('--agente', help='quien pide la tarjeta del alias (por defecto quien ejecuta esto)')
    a = ap.parse_args()

    if a.cmd in ('pedir', 'duda'):
        cuerpo = a.cuerpo
        if a.cuerpo_archivo:
            cuerpo = Path(a.cuerpo_archivo).read_text()
        payload = {'agente': agente_actual(a.agente), 'tipo': 'duda' if a.cmd == 'duda' else a.tipo, 'titulo': a.titulo, 'detalle': a.detalle,
                   'riesgo': a.riesgo, 'enlace': a.enlace, 'vence': a.vence, 'cuerpo': cuerpo}
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
        m = rpc('omc_comentar', p_token=E['HQ_TOKEN'], p_id=a.id, p_texto=a.texto, p_agente=agente_actual(a.agente))
        avisar({'id': a.id, 'texto': a.texto})
        print(json.dumps(m, ensure_ascii=False) if a.json else f"#{a.id} comentario enviado a Diego ({m['autor']})")
    elif a.cmd == 'retirar':
        r = rpc('omc_retirar', p_token=E['HQ_TOKEN'], p_id=a.id, p_nota=a.nota)
        engram(f"[TARJETA #{a.id}] retirada", a.nota or '(sin nota)')
        salida(r, a.json)
    elif a.cmd == 'hilo':
        s = rpc('omc_estado', p_token=E['HQ_TOKEN'], p_id=a.id)
        if a.json: print(json.dumps(s.get('hilo') or [], ensure_ascii=False))
        else:
            print(linea(s))
            for m in (s.get('hilo') or []): print(f"  [{m['ts'][:16].replace('T', ' ')}] {m['autor']}: {m['texto']}")
    elif a.cmd in ('hecho', 'fallo'):
        r = rpc('omc_reportar', p_token=E['HQ_TOKEN'], p_id=a.id, p_ok=(a.cmd == 'hecho'), p_nota=a.nota)
        engram(f"[TARJETA #{a.id}] {a.cmd}", (r.get('titulo') or '') + (' · ' + a.nota if a.nota else ''))
        salida(r, a.json)
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
        # error - un SystemExit que "except Exception" no atrapa); omc_latido ya hace este mismo update
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
    elif a.cmd == 'historia':
        # doc 32 (encargo 42): "chief, cuando necesita recordar: hq.py historia <texto>". /observations
        # viene ordenado por fecha, no por relevancia (a diferencia de /search) - se pide un lote amplio y
        # se filtra aquí por texto en título O contenido, sin distinguir mayúsculas/acentos exactos.
        try:
            rs = json.loads(urllib.request.urlopen(f'http://127.0.0.1:7437/observations?project=77delta&limit=2000', timeout=15).read() or b'[]') or []
        except Exception as ex:
            sys.exit(f'Engram local no responde: {ex}')
        q = a.texto.lower()
        rs = [x for x in rs if q in (x.get('title') or '').lower() or q in (x.get('content') or '').lower()]
        rs = sorted(rs, key=lambda x: x.get('created_at') or '', reverse=True)[:a.limite]
        if a.json:
            print(json.dumps(rs, ensure_ascii=False))
        elif not rs:
            print(f'nada en Engram para "{a.texto}"')
        else:
            for x in rs:
                primera = (x.get('content') or '').strip().splitlines()
                print(f"{(x.get('created_at') or '')[:16]} · {x.get('title')} · {primera[0][:160] if primera else ''}")
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
    elif a.cmd == 'alta-agente':
        import subprocess, unicodedata

        def slug(s):
            s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
            return ''.join(c for c in s.lower() if c.isalnum())

        owner = E.get('HQ_OWNER_TOKEN')
        if not owner:
            sys.exit('falta HQ_OWNER_TOKEN en hq.env: el alta de agente necesita permiso de owner (omc_agente_set)')
        alias = slug(a.alias or a.nombre)
        cuenta_desc = 'Max · team@77delta.com' if a.cuenta == 'b' else 'Max 20x · Diego'

        # 1) puesto en HQ (omc_agentes)
        patch = {'nombre': a.nombre, 'depto': a.depto, 'nivel': a.nivel, 'jefe': a.jefe,
                 'sesiones': [a.ventana], 'contrato': {'cuenta': cuenta_desc, 'modelo': a.modelo}}
        ag = rpc('omc_agente_set', p_token=owner, p_id=a.id, p_patch=patch)
        print(f"1/5 puesto en HQ: {ag['id']} · {ag['nombre']} ({ag['depto']}, nivel {ag['nivel']}, jefe {ag['jefe']})")

        # 2) ventana en ~/bin/equipo (LISTA) + .claude/hq-agente en su carpeta
        eq = Path.home() / 'bin' / 'equipo'
        original = eq.read_text()
        lineas = original.splitlines()
        if any(l.split('|', 1)[0] == a.ventana for l in lineas if '|' in l):
            print(f"2/5 ventana '{a.ventana}' ya está en ~/bin/equipo, no se toca")
        else:
            try:
                idx = next(i for i, l in enumerate(lineas) if l.strip() == "LISTA='")
            except StopIteration:
                sys.exit("2/5 no encuentro \"LISTA='\" en ~/bin/equipo; añade la ventana a mano")
            lineas.insert(idx + 1, f"{a.ventana}|{a.carpeta}||{a.modelo}|{a.cuenta}|{a.id}")
            eq.write_text('\n'.join(lineas) + '\n')
            r = subprocess.run(['bash', '-n', str(eq)], capture_output=True, text=True)
            if r.returncode != 0:
                eq.write_text(original)
                sys.exit(f"2/5 el parche de ~/bin/equipo rompía la sintaxis, revertido sin tocar nada: {r.stderr.strip()[:300]}")
            print(f"2/5 ventana '{a.ventana}' añadida a ~/bin/equipo ({a.carpeta}, cuenta {a.cuenta})")
        carpeta = Path(a.carpeta)
        if not carpeta.is_dir():
            print(f"    aviso: {a.carpeta} no existe todavía; créala antes de 'relanzar {a.ventana}'")
        else:
            (carpeta / '.claude').mkdir(exist_ok=True)
            (carpeta / '.claude' / 'hq-agente').write_text(a.id + '\n')
            print(f"    .claude/hq-agente escrito con '{a.id}'")

        # 3) CLAUDE.md del puesto: se queda a mano (rol, qué puede y qué no)
        print(f"3/5 (manual) escribe {a.carpeta}/CLAUDE.md con el rol, qué puede y qué no")

        # 4) nivel de ahorro en ~/bin/hq-ahorro.py (dict NIVEL)
        ah = Path.home() / 'bin' / 'hq-ahorro.py'
        txt = ah.read_text()
        if f"'{a.id}':" in txt:
            print(f"4/5 '{a.id}' ya tiene nivel de ahorro asignado en hq-ahorro.py, no se toca")
        else:
            marcador = 'NIVEL = {\n'
            if marcador not in txt:
                sys.exit("4/5 no encuentro 'NIVEL = {' en ~/bin/hq-ahorro.py; añade el nivel a mano")
            ah.write_text(txt.replace(marcador, marcador + f"    '{a.id}': {a.nivel},\n", 1))
            r = subprocess.run(['python3', '-m', 'py_compile', str(ah)], capture_output=True, text=True)
            if r.returncode != 0:
                ah.write_text(txt)
                sys.exit(f"4/5 el parche de hq-ahorro.py no compilaba, revertido sin tocar nada: {r.stderr.strip()[:300]}")
            print(f"4/5 nivel de ahorro {a.nivel} añadido para '{a.id}' en ~/bin/hq-ahorro.py")

        # 5) tarjeta obligatoria a Diego con el alias propuesto (sin esto, gmail-agente.py send se niega)
        detalle = (f"- Alias propuesto: {alias}@77delta.com\n"
                   f"- Workspace Admin > Usuarios > team@ > Direcciones alternativas: añadir el alias\n"
                   f"- Gmail de team@ > Ajustes > Cuentas > Enviar como > Añadir: nombre {a.nombre}, "
                   f"dirección {alias}@77delta.com, Tratar como alias\n"
                   f"- Al terminar, 'hecho' aquí; Pol lo añade a ALIAS_OK")
        payload = {'agente': agente_actual(a.agente), 'tipo': 'accion',
                   'titulo': f"Alias de correo para {a.nombre}: {alias}@77delta.com (Enviar como)", 'detalle': detalle}
        s = rpc('omc_pedir', p_token=E['HQ_TOKEN'], p=payload)
        avisar(s)
        print(f"5/5 tarjeta #{s['id']} abierta a Diego pidiendo el alias {alias}@77delta.com")
        print(f"\nPendiente a mano: 3) CLAUDE.md en {a.carpeta} · 6) '~/bin/relanzar {a.ventana}', comprobar el latido "
              f"y 'hq.py parte --agente {a.id}'. El alias no funciona para enviar hasta que se cierre la tarjeta #{s['id']} y se rellene ALIAS_OK.")
    elif a.cmd == 'kpi':
        print(json.dumps(rpc('omc_kpi_set', p_token=E['HQ_TOKEN'], p_filas=[{'clave': a.clave, 'valor': a.valor, 'texto': a.texto, 'fuente': a.fuente or agente_actual(None)}]), ensure_ascii=False))
    elif a.cmd == 'plan':
        obj = rpc('omc_plan_objetivo', p_token=E['HQ_TOKEN'])
        lineas = rpc('omc_plan_lineas_lista', p_token=E['HQ_TOKEN'])
        if a.json:
            print(json.dumps({'objetivo': obj, 'lineas': lineas}, ensure_ascii=False))
        else:
            if obj:
                print(f"{obj['titulo']}: {obj['valor_actual']:g} / {obj['meta']:g} {obj['unidad']} ({obj['progreso_pct']}%)" + (f" · límite {obj['fecha_limite']}" if obj.get('fecha_limite') else ''))
            for l in lineas:
                print(f"  #{l['id']} [{l['semaforo']}] {l['linea']} · {l['valor_actual']:g}/{l['meta']:g} {l['unidad']} ({l['progreso_pct']}%) · {l['responsable']} · {l['fuente']}" + (f" · próximo: {l['proximo_hito']}" if l.get('proximo_hito') else ''))
    elif a.cmd == 'plan-linea':
        p = {k: v for k, v in {'id': a.id, 'linea': a.linea, 'kpi': a.kpi, 'meta': a.meta, 'unidad': a.unidad, 'responsable': a.responsable,
                               'proximo_hito': a.proximo_hito, 'fecha_hito': a.fecha_hito, 'fuente': a.fuente, 'sql_metrica': a.sql_metrica,
                               'orden': a.orden, 'borrar': a.borrar or None}.items() if v is not None}
        print(json.dumps(rpc('omc_plan_linea_set', p_token=E['HQ_TOKEN'], p=p), ensure_ascii=False))
    elif a.cmd == 'kpi-linea':
        r = rpc('omc_plan_kpi_actualizar', p_token=E['HQ_TOKEN'], p_id=a.id, p_valor=a.valor, p_agente=agente_actual(a.agente), p_proximo_hito=a.proximo_hito, p_fecha_hito=a.fecha_hito)
        print(json.dumps(r, ensure_ascii=False) if a.json else f"#{r['id']} {r['linea']}: {r['valor_actual']:g}/{r['meta']:g} {r['unidad']}" + (f" · próximo: {r['proximo_hito']}" if r.get('proximo_hito') else ''))
    elif a.cmd == 'decision':
        p = {'decision': a.texto, 'linea_id': a.linea, 'solicitud_id': a.tarjeta, 'agente': agente_actual(a.agente)}
        r = rpc('omc_decision_anadir', p_token=E['HQ_TOKEN'], p=p)
        engram(f"[DECISION] {a.texto[:80]}", a.texto)
        print(json.dumps(r, ensure_ascii=False) if a.json else f"decisión #{r['id']} anotada ({r['quien']})")
    elif a.cmd == 'decisiones':
        ds = rpc('omc_decisiones_lista', p_token=E['HQ_TOKEN'])
        if a.json: print(json.dumps(ds, ensure_ascii=False))
        else:
            for d in ds: print(f"[{d['fecha'][:10]}] {d['decision']} · {d['quien']}" + (f" · línea #{d['linea_id']}" if d.get('linea_id') else ''))
    elif a.cmd == 'encargo':
        def linea_encargo(e):
            return f"línea #{e['linea_id']}" if e.get('linea_id') else 'fuera de plan'
        if a.sub == 'alta':
            p = {k: v for k, v in {'id': a.id, 'texto': a.texto, 'interpretacion': a.interpretacion, 'linea_id': a.linea, 'departamento': a.departamento,
                                   'agente_responsable': a.responsable, 'estado': a.estado, 'prioridad': a.prioridad, 'solicitud_id': a.tarjeta,
                                   'proximo_hito': a.proximo_hito, 'fecha_hito': a.fecha_hito, 'agente': agente_actual(a.agente), 'espera': a.espera,
                                   'mensaje_id': a.mensaje}.items() if v is not None}
            r = rpc('omc_encargo_set', p_token=E['HQ_TOKEN'], p=p)
            engram(f"[ENCARGO #{r['id']}] alta", f"{r['texto']} · {linea_encargo(r)} · {r.get('departamento') or 'sin depto'} · {r.get('agente') or 'sin responsable'} · estado {r['estado']}")
            print(json.dumps(r, ensure_ascii=False) if a.json else f"#{r['id']} [{r['estado']}] {r['texto'][:60]} · {linea_encargo(r)} · prioridad {r['prioridad']}")
        elif a.sub == 'avance':
            r = rpc('omc_encargo_avance', p_token=E['HQ_TOKEN'], p_id=a.id, p_texto=a.texto, p_agente=agente_actual(a.agente))
            engram(f"[ENCARGO #{a.id}] avance", a.texto)
            print(json.dumps(r, ensure_ascii=False) if a.json else f"#{r['id']} avance anotado: {r['ultimo_avance'][:80]}")
        elif a.sub == 'estado':
            r = rpc('omc_encargo_estado', p_token=E['HQ_TOKEN'], p_id=a.id, p_estado=a.valor, p_agente=agente_actual(a.agente))
            engram(f"[ENCARGO #{a.id}] estado", f"-> {a.valor}")
            print(json.dumps(r, ensure_ascii=False) if a.json else f"#{r['id']} -> {r['estado']}")
        elif a.sub == 'prioridad':
            r = rpc('omc_encargo_prioridad', p_token=E['HQ_TOKEN'], p_id=a.id, p_direccion=a.direccion)
            print(json.dumps(r, ensure_ascii=False))
        elif a.sub == 'lista':
            es = rpc('omc_encargos_lista', p_token=E['HQ_TOKEN'])
            if a.json: print(json.dumps(es, ensure_ascii=False))
            else:
                for e in es:
                    marca = ' ⚠ 48h sin avance' if e['antiguo'] else ''
                    print(f"#{e['id']} [{e['estado']}] p{e['prioridad']} · {linea_encargo(e)} · {e['texto'][:60]} · {e['departamento']}/{e['agente']}{marca}")


if __name__ == '__main__':
    main()
