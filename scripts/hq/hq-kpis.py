#!/usr/bin/env python3
"""HQ · KPIs del embudo de licitaciones desde el Sheet de control de Sales ("Licitaciones · NGA · control").

Lee las pestañas Licitaciones y Descartadas con la API de Sheets (OAuth del MCP gdrive-pdata: refresh token en
~/.google-mcp/gdrive-pdata/token.json y client en credentials.json; no se escribe nada en esos ficheros) y sube a HQ:
lic.detectadas / aprobadas / presentadas / en_juego / contratadas / perdidas (n y €), tasa de éxito y próximo cierre.
Cron cada hora.

  hq-kpis.py [--seco]
"""
import argparse, json, os, re, sys, urllib.parse, urllib.request, urllib.error
from datetime import date, datetime, timezone
from pathlib import Path

CONF = Path.home() / '.config' / '77delta' / 'hq.env'
GDIR = Path.home() / '.google-mcp' / 'gdrive-pdata'
SHEET = '12XpybhNqVapG1esl8vcHHaew83ACeTRli0gfkhcKb9I'
ESTADOS = {
    'analisis': {'nueva', 'analizada'},
    'aprobadas': {'aprobada', 'en preparación', 'en preparacion'},
    'en_juego': {'presentada', 'en juego', 'en evaluación', 'en evaluacion'},
    'contratadas': {'adjudicada', 'contratada', 'ganada', 'contratado'},
    'perdidas': {'perdida', 'no adjudicada', 'desierta', 'excluida'},
    'sin_presentar': {'cerrada sin presentar', 'descartada'},
}
ESTADOS['presentadas'] = ESTADOS['en_juego'] | ESTADOS['contratadas'] | ESTADOS['perdidas']


def env():
    e = {}
    for l in CONF.read_text().splitlines():
        if '=' in l and not l.startswith('#'):
            k, v = l.split('=', 1); e[k.strip()] = v.strip()
    return e


def access_token():
    cred = json.load(open(GDIR / 'credentials.json')); k = cred.get('web') or cred.get('installed') or cred
    tok = json.load(open(GDIR / 'token.json')); acc = tok['accounts'][tok.get('defaultAccount', 'default')]
    datos = urllib.parse.urlencode({'client_id': k['client_id'], 'client_secret': k['client_secret'], 'refresh_token': acc['refreshToken'], 'grant_type': 'refresh_token'}).encode()
    with urllib.request.urlopen(urllib.request.Request(k.get('token_uri', 'https://oauth2.googleapis.com/token'), data=datos, method='POST'), timeout=20) as r:
        return json.loads(r.read())['access_token']


def hoja(tok, rango):
    url = f'https://sheets.googleapis.com/v4/spreadsheets/{SHEET}/values/{urllib.parse.quote(rango)}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING'
    with urllib.request.urlopen(urllib.request.Request(url, headers={'Authorization': 'Bearer ' + tok}), timeout=30) as r:
        return json.loads(r.read()).get('values') or []


def num(v):
    if isinstance(v, (int, float)):
        return float(v)
    s = re.sub(r'[^\d,.\-]', '', str(v or ''))
    if not s:
        return 0.0
    if ',' in s and '.' in s:
        s = s.replace('.', '').replace(',', '.') if s.rfind(',') > s.rfind('.') else s.replace(',', '')
    elif ',' in s:
        s = s.replace(',', '.') if len(s.split(',')[-1]) <= 2 else s.replace(',', '')
    try:
        return float(s)
    except ValueError:
        return 0.0


def filas(valores):
    if not valores:
        return []
    cab = [str(c).strip().lower() for c in valores[0]]
    def col(nombre, ultima=False):
        idx = [i for i, c in enumerate(cab) if c.startswith(nombre)]
        return (idx[-1] if ultima else idx[0]) if idx else None
    ci, ce, cx, cc, cd = col('importe'), col('expediente'), col('estado', ultima=True), col('cierre'), col('decisión') or col('decision')
    out = []
    for r in valores[1:]:
        if not any(str(x).strip() for x in r):
            continue
        g = lambda i: (r[i] if i is not None and i < len(r) else '')
        out.append({'expediente': str(g(ce)).strip(), 'importe': num(g(ci)), 'estado': str(g(cx)).strip().lower(), 'cierre': str(g(cc)).strip(), 'decision': str(g(cd)).strip()})
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--seco', action='store_true')
    a = ap.parse_args()
    tok = access_token()
    vivas = filas(hoja(tok, 'Licitaciones!A1:Z'))
    try:
        desc = filas(hoja(tok, 'Descartadas!A1:Z'))
    except urllib.error.HTTPError:
        desc = []
    # Detectada = fila que el bot ya ha analizado (tiene estado o importe); el resto es barrido en bruto y se cuenta aparte.
    brutas = [f for f in vivas if not f['estado'] and not f['importe']]
    vivas = [f for f in vivas if f['estado'] or f['importe']]
    todas = vivas + desc
    def grupo(nombre, base=vivas):
        sel = [f for f in base if f['estado'] in ESTADOS[nombre]]
        return len(sel), round(sum(f['importe'] for f in sel), 2)
    k = {}
    k['lic.detectadas.n'], k['lic.detectadas.eur'] = len(todas), round(sum(f['importe'] for f in todas), 2)
    k['lic.brutas.n'] = len(brutas)
    k['lic.vivas.n'], k['lic.vivas.eur'] = len(vivas), round(sum(f['importe'] for f in vivas), 2)
    for g in ('analisis', 'aprobadas', 'presentadas', 'en_juego', 'contratadas', 'perdidas', 'sin_presentar'):
        k[f'lic.{g}.n'], k[f'lic.{g}.eur'] = grupo(g)
    res = k['lic.contratadas.n'] + k['lic.perdidas.n']
    k['lic.tasa_exito'] = round(k['lic.contratadas.n'] / res * 100, 1) if res else None
    hoy = date.today().isoformat()
    prox = sorted([f for f in vivas if f['estado'] in ESTADOS['aprobadas'] | ESTADOS['analisis'] and f['cierre'] and f['cierre'][:10] >= hoy], key=lambda f: f['cierre'])
    filas_kpi = [{'clave': c, 'valor': v, 'fuente': 'sheet-licitaciones'} for c, v in k.items()]
    filas_kpi.append({'clave': 'lic.proximo_cierre', 'valor': None, 'texto': (prox[0]['expediente'] + ' · ' + prox[0]['cierre'][:10]) if prox else '', 'fuente': 'sheet-licitaciones'})
    filas_kpi.append({'clave': 'lic.actualizado', 'valor': None, 'texto': datetime.now(timezone.utc).isoformat(timespec='minutes'), 'fuente': 'sheet-licitaciones'})
    print(' · '.join(f"{c.replace('lic.', '')}={v}" for c, v in k.items() if c.endswith('.n') or c == 'lic.tasa_exito'), '| próximo cierre:', filas_kpi[-2]['texto'] or 'ninguno')
    if a.seco:
        return
    e = env()
    req = urllib.request.Request(e['HQ_URL'].rstrip('/') + '/rest/v1/rpc/omc_kpi_set', method='POST', data=json.dumps({'p_token': e['HQ_TOKEN'], 'p_filas': filas_kpi}).encode(),
                                 headers={'apikey': e['HQ_ANON'], 'Authorization': 'Bearer ' + e['HQ_ANON'], 'Content-Type': 'application/json'})
    try:
        urllib.request.urlopen(req, timeout=30).read()
    except urllib.error.HTTPError as ex:
        sys.exit(f'HTTP {ex.code}: {ex.read().decode()[:300]}')


if __name__ == '__main__':
    main()
