#!/usr/bin/env python3
"""HQ · qué está haciendo cada agente: sube a Supabase las últimas observaciones de Engram de sus proyectos,
la URL de su sesión Remote Control (si la hay en la transcripción) y su última actividad real (mtime de la transcripción).

Fuentes locales: Engram en http://127.0.0.1:7437 (proyecto = nombre de la carpeta del repo) y ~/.claude/projects/**/*.jsonl.
Cron cada 15 minutos junto a hq-plan.py.

  hq-actividad.py [--seco]
"""
import argparse, glob, json, os, re, sys, urllib.request, urllib.error
from datetime import datetime, timezone
from pathlib import Path

CONF = Path.home() / '.config' / '77delta' / 'hq.env'
ENGRAM = 'http://127.0.0.1:7437'
TRANSCRIPCIONES = Path.home() / '.claude' / 'projects'


def env():
    e = {}
    for l in CONF.read_text().splitlines():
        if '=' in l and not l.startswith('#'):
            k, v = l.split('=', 1); e[k.strip()] = v.strip()
    e.update({k: v for k, v in os.environ.items() if k.startswith('HQ_')})
    return e


def rpc(e, fn, token, **p):
    req = urllib.request.Request(e['HQ_URL'].rstrip('/') + '/rest/v1/rpc/' + fn, data=json.dumps({'p_token': token, **p}).encode(), method='POST',
                                 headers={'apikey': e['HQ_ANON'], 'Authorization': 'Bearer ' + e['HQ_ANON'], 'Content-Type': 'application/json'})
    try:
        return json.loads(urllib.request.urlopen(req, timeout=60).read() or b'null')
    except urllib.error.HTTPError as ex:
        sys.exit(f'{fn}: HTTP {ex.code} {ex.read().decode()[:300]}')


def engram(proyecto, limite=8):
    try:
        with urllib.request.urlopen(f'{ENGRAM}/observations?project={urllib.parse.quote(proyecto)}&limit={limite}', timeout=10) as r:
            return json.loads(r.read() or b'[]') or []
    except Exception:
        return []


def transcripciones():
    """{titulo_o_cwd: (mtime, url)} para cada transcripción viva (sin duplicados de Syncthing)."""
    por_titulo, por_cwd = {}, {}
    for f in glob.glob(str(TRANSCRIPCIONES / '**' / '*.jsonl'), recursive=True):
        if '.sync-conflict-' in f:
            continue
        mt = datetime.fromtimestamp(os.path.getmtime(f), timezone.utc)
        titulo = cwd = url = None
        urls = {}  # la URL propia de la sesión es la que más se repite (recordatorios); las ajenas llegan en mensajes sueltos
        try:
            with open(f, errors='replace') as fh:
                for i, l in enumerate(fh):
                    if cwd is None and '"cwd"' in l:
                        m = re.search(r'"cwd":"([^"]*)"', l); cwd = m.group(1) if m else cwd
                    if '"customTitle"' in l:
                        m = re.search(r'"customTitle":"([^"]*)"', l); titulo = m.group(1) if m else titulo
                    if 'claude.ai/code/session_' in l and 'cross-session-message' not in l:
                        for u in re.findall(r'https://claude\.ai/code/session_[A-Za-z0-9]+', l):
                            urls[u] = urls.get(u, 0) + 1
        except OSError:
            continue
        if urls:
            url = max(urls, key=urls.get)
        for clave, tabla in ((titulo, por_titulo), (cwd, por_cwd)):
            if clave and (clave not in tabla or tabla[clave][0] < mt):
                tabla[clave] = (mt, url or (tabla.get(clave) or (None, None))[1])
    return por_titulo, por_cwd


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--seco', action='store_true')
    a = ap.parse_args()
    e = env()
    hq = rpc(e, 'omc_hq', e['HQ_OWNER_TOKEN'])
    por_titulo, por_cwd = transcripciones()
    filas, parches = [], {}
    for ag in hq['agentes']:
        proyectos = sorted({Path(r).name for r in (ag.get('rutas') or [])})
        for p in proyectos:
            for o in engram(p):
                ts = o.get('created_at') or o.get('updated_at')
                if not ts or not o.get('title'):
                    continue
                filas.append({'agente': ag['id'], 'obs_id': o['id'], 'ts': ts, 'proyecto': p, 'tipo': o.get('type') or '', 'titulo': o['title']})
        ult, url = None, None
        for s in (ag.get('sesiones') or []):
            if s in por_titulo:
                mt, u = por_titulo[s]; ult = max(ult, mt) if ult else mt; url = u or url
        for r in (ag.get('rutas') or []):
            if r in por_cwd:
                mt, u = por_cwd[r]; ult = max(ult, mt) if ult else mt; url = url or u
        parche = {}
        if ult: parche['ultima_actividad'] = ult.isoformat()
        if url and (ag.get('contrato') or {}).get('sesion_url') != url: parche['contrato'] = {'sesion_url': url}
        if parche: parches[ag['id']] = parche
    print(f'{len(filas)} observaciones · {len(parches)} agentes con latido/URL' + (' (seco)' if a.seco else ''))
    if a.seco:
        return
    for i in range(0, len(filas), 300):
        rpc(e, 'omc_subir_actividad', e['HQ_TOKEN'], p_filas=filas[i:i + 300])
    for id_, parche in parches.items():
        rpc(e, 'omc_agente_set', e['HQ_OWNER_TOKEN'], p_id=id_, p_patch=parche)


if __name__ == '__main__':
    import urllib.parse
    main()
