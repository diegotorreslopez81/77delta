#!/usr/bin/env python3
"""HQ · agrega el uso de tokens de las sesiones de Claude Code y lo sube a Supabase.

Lee ~/.claude/projects/**/*.jsonl (excluye los duplicados sync-conflict de Syncthing), deduplica por requestId,
agrega por día, sesión y modelo, calcula el coste nocional a precio de API y hace upsert vía omc_subir_uso.
Por defecto solo relee los ficheros modificados en los últimos 3 días (idempotente); --todo hace el histórico completo.

  hq-uso.py [--dias 3] [--todo] [--seco]
"""
import argparse, glob, json, os, socket, sys, time, urllib.request, urllib.error
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

CONF = Path.home() / '.config' / '77delta' / 'hq.env'
RAICES = [Path.home() / '.claude' / 'projects', Path('/Users/diego/.claude/projects'), Path('/home/diego/.claude/projects')]
TZ = ZoneInfo('Europe/Madrid')
# $/MTok: input, output, cache write 5m, cache write 1h, cache read. Orden de coincidencia por substring del id de modelo.
PRECIOS = [
    ('fable-5-1', (10, 50, 12.5, 20, 0.25)), ('mythos-5-1', (10, 50, 12.5, 20, 0.25)),
    ('fable', (10, 50, 12.5, 20, 1.0)), ('mythos', (10, 50, 12.5, 20, 1.0)),
    ('opus', (5, 25, 6.25, 10, 0.5)),
    ('sonnet-5', (2, 10, 2.5, 4, 0.2)), ('sonnet', (3, 15, 3.75, 6, 0.3)),
    ('haiku', (1, 5, 1.25, 2, 0.1)),
]


def env():
    e = {}
    if CONF.exists():
        for l in CONF.read_text().splitlines():
            l = l.strip()
            if '=' in l and not l.startswith('#'):
                k, v = l.split('=', 1); e[k.strip()] = v.strip().strip('"').strip("'")
    e.update({k: v for k, v in os.environ.items() if k.startswith('HQ_')})
    return e


def precio(modelo):
    m = (modelo or '').lower()
    for clave, p in PRECIOS:
        if clave in m:
            return p
    return (5, 25, 6.25, 10, 0.5)


def coste(modelo, inp, out, cw5, cw1, cr):
    pi, po, p5, p1, pr = precio(modelo)
    return (inp * pi + out * po + cw5 * p5 + cw1 * p1 + cr * pr) / 1e6


def ficheros(dias, todo):
    limite = time.time() - dias * 86400
    vistos, out = set(), []
    for raiz in RAICES:
        if not raiz.is_dir():
            continue
        for f in glob.glob(str(raiz / '**' / '*.jsonl'), recursive=True):
            if '.sync-conflict-' in f:
                continue
            real = os.path.realpath(f)
            if real in vistos:
                continue
            vistos.add(real)
            if todo or os.path.getmtime(f) >= limite:
                out.append(f)
    return sorted(out)


def agregar(f):
    """Devuelve {(fecha, sesion, modelo): dict} para un fichero de transcripción."""
    filas = defaultdict(lambda: {'input': 0, 'output': 0, 'cache_write': 0, 'cache_read': 0, 'mensajes': 0, 'coste_usd': 0.0, 'ruta': '', 'titulo': ''})
    titulos, sesion_fichero, vistos = {}, Path(f).stem, set()
    with open(f, 'r', encoding='utf-8', errors='replace') as fh:
        for linea in fh:
            if '"usage"' not in linea and '"customTitle"' not in linea:
                continue
            try:
                d = json.loads(linea)
            except Exception:
                continue
            sid = d.get('sessionId') or sesion_fichero
            if d.get('type') == 'custom-title' and d.get('customTitle'):
                titulos[sid] = d['customTitle']
                continue
            if d.get('type') != 'assistant':
                continue
            m = d.get('message') or {}
            u = m.get('usage')
            if not u:
                continue
            clave = d.get('requestId') or m.get('id')
            if clave and clave in vistos:
                continue
            if clave:
                vistos.add(clave)
            ts = d.get('timestamp')
            try:
                fecha = datetime.fromisoformat(ts.replace('Z', '+00:00')).astimezone(TZ).date().isoformat()
            except Exception:
                fecha = datetime.fromtimestamp(os.path.getmtime(f), TZ).date().isoformat()
            modelo = m.get('model') or 'desconocido'
            if modelo == '<synthetic>':
                continue
            cc = u.get('cache_creation') or {}
            cw1 = int(cc.get('ephemeral_1h_input_tokens') or 0)
            cw5 = int(cc.get('ephemeral_5m_input_tokens') or 0)
            cw = int(u.get('cache_creation_input_tokens') or 0)
            if cw1 + cw5 == 0:
                cw1 = cw
            inp, out, cr = int(u.get('input_tokens') or 0), int(u.get('output_tokens') or 0), int(u.get('cache_read_input_tokens') or 0)
            r = filas[(fecha, sid, modelo)]
            r['input'] += inp; r['output'] += out; r['cache_write'] += cw1 + cw5; r['cache_read'] += cr; r['mensajes'] += 1
            r['coste_usd'] += coste(modelo, inp, out, cw5, cw1, cr)
            if d.get('cwd'):
                r['ruta'] = d['cwd']
    for (fecha, sid, modelo), r in filas.items():
        r['titulo'] = titulos.get(sid, '')
    return filas


def subir(e, filas, seco):
    lote, n = [], 0
    for (fecha, sid, modelo), r in filas.items():
        lote.append({'fecha': fecha, 'sesion_id': sid, 'modelo': modelo, 'maquina': socket.gethostname(), **{k: (round(v, 6) if k == 'coste_usd' else v) for k, v in r.items()}})
    if seco:
        return len(lote)
    for i in range(0, len(lote), 400):
        trozo = lote[i:i + 400]
        req = urllib.request.Request(e['HQ_URL'].rstrip('/') + '/rest/v1/rpc/omc_subir_uso', method='POST',
                                     data=json.dumps({'p_token': e['HQ_TOKEN'], 'p_filas': trozo}).encode(),
                                     headers={'apikey': e['HQ_ANON'], 'Authorization': 'Bearer ' + e['HQ_ANON'], 'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                n += json.loads(r.read()).get('filas', 0)
        except urllib.error.HTTPError as ex:
            sys.exit(f'HTTP {ex.code}: {ex.read().decode()[:400]}')
    return n


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--dias', type=int, default=3)
    ap.add_argument('--todo', action='store_true')
    ap.add_argument('--seco', action='store_true', help='no sube: imprime el resumen')
    a = ap.parse_args()
    e = env()
    if not a.seco:
        for k in ('HQ_URL', 'HQ_ANON', 'HQ_TOKEN'):
            if not e.get(k):
                sys.exit(f'falta {k} en {CONF}')
    fs = ficheros(a.dias, a.todo)
    todas = {}
    for f in fs:
        for k, r in agregar(f).items():
            if k in todas:  # misma sesión repartida en varios ficheros (subagentes): se suma
                t = todas[k]
                for c in ('input', 'output', 'cache_write', 'cache_read', 'mensajes', 'coste_usd'):
                    t[c] += r[c]
                t['titulo'] = t['titulo'] or r['titulo']; t['ruta'] = t['ruta'] or r['ruta']
            else:
                todas[k] = r
    total = sum(r['coste_usd'] for r in todas.values())
    n = subir(e, todas, a.seco)
    print(f"{len(fs)} ficheros · {len(todas)} filas · {total:.2f} $ nocionales · {'sin subir' if a.seco else f'{n} filas subidas'}")
    if a.seco:
        por = defaultdict(float)
        for (fecha, sid, modelo), r in todas.items():
            por[r['titulo'] or Path(r['ruta']).name or sid[:8]] += r['coste_usd']
        for k, v in sorted(por.items(), key=lambda x: -x[1])[:25]:
            print(f"  {v:9.2f} $  {k}")


if __name__ == '__main__':
    main()
