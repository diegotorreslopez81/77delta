#!/usr/bin/env python3
"""HQ · sincroniza el Sheet de licitaciones de Sales con HQ en los dos sentidos.

1. Trae las filas analizadas (con estado o importe) de las pestañas Licitaciones y Descartadas a omc_licitaciones.
2. Devuelve al Sheet las decisiones tomadas por Diego en HQ: Decisión Diego (W), Estado (X), Fecha decisión (Y) y Comentarios (U, con los motivos).
OAuth con el refresh token del MCP gdrive-pdata (no se escribe en sus ficheros). Cron cada 10 minutos.

  hq-licitaciones.py [--seco]
"""
import argparse, json, os, re, sys, urllib.parse, urllib.request, urllib.error
from datetime import date
from pathlib import Path

CONF = Path.home() / '.config' / '77delta' / 'hq.env'
GDIR = Path.home() / '.google-mcp' / 'gdrive-pdata'
SHEET = '12XpybhNqVapG1esl8vcHHaew83ACeTRli0gfkhcKb9I'
# Columnas del Sheet (fila 1 = cabecera). Se localizan por nombre de cabecera para tolerar cambios de orden.
CAMPOS = {'detectada': 'detectada', 'expediente': 'expediente', 'organo': 'órgano', 'provincia': 'provincia', 'objeto': 'objeto', 'importe': 'importe', 'tipo': 'tipo',
          'procedimiento': 'procedimiento', 'elegible': 'elegible', 'motivo_auto': 'motivo', 'solvencia': 'solvencia', 'cierre': 'cierre', 'enlace': 'enlace', 'pcap': 'pcap',
          'ppt': 'ppt', 'carpeta': 'carpeta', 'resumen': 'resumen', 'comentarios': 'comentarios', 'resumen_corto': 'resumen corto', 'decision': 'decisión', 'fecha_decision': 'fecha decisión',
          'excepcion': 'excepción', 'progreso': 'progreso', 'progreso_nota': 'nota progreso'}


def env():
    e = {}
    for l in CONF.read_text().splitlines():
        if '=' in l and not l.startswith('#'):
            k, v = l.split('=', 1); e[k.strip()] = v.strip()
    return e


def rpc(e, fn, token, **p):
    req = urllib.request.Request(e['HQ_URL'].rstrip('/') + '/rest/v1/rpc/' + fn, data=json.dumps({'p_token': token, **p}).encode(), method='POST',
                                 headers={'apikey': e['HQ_ANON'], 'Authorization': 'Bearer ' + e['HQ_ANON'], 'Content-Type': 'application/json'})
    try:
        return json.loads(urllib.request.urlopen(req, timeout=90).read() or b'null')
    except urllib.error.HTTPError as ex:
        sys.exit(f'{fn}: HTTP {ex.code} {ex.read().decode()[:300]}')


def access_token():
    cred = json.load(open(GDIR / 'credentials.json')); k = cred.get('web') or cred.get('installed') or cred
    tok = json.load(open(GDIR / 'token.json')); acc = tok['accounts'][tok.get('defaultAccount', 'default')]
    datos = urllib.parse.urlencode({'client_id': k['client_id'], 'client_secret': k['client_secret'], 'refresh_token': acc['refreshToken'], 'grant_type': 'refresh_token'}).encode()
    with urllib.request.urlopen(urllib.request.Request(k.get('token_uri', 'https://oauth2.googleapis.com/token'), data=datos, method='POST'), timeout=20) as r:
        return json.loads(r.read())['access_token']


def leer(tok, rango):
    url = f'https://sheets.googleapis.com/v4/spreadsheets/{SHEET}/values/{urllib.parse.quote(rango)}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING'
    with urllib.request.urlopen(urllib.request.Request(url, headers={'Authorization': 'Bearer ' + tok}), timeout=60) as r:
        return json.loads(r.read()).get('values') or []


def escribir(tok, datos):
    """datos: lista de {'range': 'Licitaciones!W12', 'values': [[...]]}"""
    url = f'https://sheets.googleapis.com/v4/spreadsheets/{SHEET}/values:batchUpdate'
    cuerpo = json.dumps({'valueInputOption': 'USER_ENTERED', 'data': datos}).encode()
    with urllib.request.urlopen(urllib.request.Request(url, data=cuerpo, method='POST', headers={'Authorization': 'Bearer ' + tok, 'Content-Type': 'application/json'}), timeout=60) as r:
        return json.loads(r.read())


def num(v):
    if isinstance(v, (int, float)):
        return float(v)
    s = re.sub(r'[^\d,.\-]', '', str(v or ''))
    if not s:
        return None
    if ',' in s and '.' in s:
        s = s.replace('.', '').replace(',', '.') if s.rfind(',') > s.rfind('.') else s.replace(',', '')
    elif ',' in s:
        s = s.replace(',', '.') if len(s.split(',')[-1]) <= 2 else s.replace(',', '')
    try:
        return float(s)
    except ValueError:
        return None


def fecha(v):
    s = str(v or '').strip()
    m = re.match(r'(\d{4})-(\d{2})-(\d{2})', s)
    if m:
        return m.group(0)
    m = re.match(r'(\d{1,2})/(\d{1,2})/(\d{4})', s)
    return f'{m.group(3)}-{int(m.group(2)):02d}-{int(m.group(1)):02d}' if m else ''


def letra(i):
    s = ''
    i += 1
    while i:
        i, r = divmod(i - 1, 26); s = chr(65 + r) + s
    return s


def parsear(valores, pestana):
    cab = [str(c).strip().lower() for c in valores[0]] if valores else []
    idx = {}
    for campo, nombre in CAMPOS.items():
        hits = [i for i, c in enumerate(cab) if c.startswith(nombre)]
        if hits:
            idx[campo] = hits[-1] if campo in ('decision',) else hits[0]
    # 'estado' es la última columna con esa cabecera (la del flujo)
    est = [i for i, c in enumerate(cab) if c.startswith('estado')]
    idx['estado'] = est[-1] if est else None
    filas, cols = [], {}
    for n, r in enumerate(valores[1:], start=2):
        g = lambda c: (str(r[idx[c]]).strip() if c in idx and idx[c] is not None and idx[c] < len(r) and r[idx[c]] is not None else '')
        exp = g('expediente')
        if not exp:
            continue
        estado, imp = g('estado'), num(r[idx['importe']] if 'importe' in idx and idx['importe'] < len(r) else None)
        if pestana == 'Licitaciones' and not estado and not imp:
            continue  # barrido en bruto, sin analizar
        filas.append({'expediente': exp, 'fila': n, 'pestana': pestana, 'detectada': fecha(g('detectada')), 'organo': g('organo'), 'provincia': g('provincia'), 'objeto': g('objeto')[:4000],
                      'resumen': g('resumen')[:4000], 'resumen_corto': g('resumen_corto')[:1000], 'importe': imp, 'tipo': g('tipo'), 'procedimiento': g('procedimiento'), 'elegible': g('elegible'),
                      'motivo_auto': g('motivo_auto')[:2000], 'solvencia': g('solvencia')[:1500], 'cierre': fecha(g('cierre')), 'enlace': g('enlace'), 'pcap': g('pcap'), 'ppt': g('ppt'),
                      'carpeta': g('carpeta'), 'estado': estado if pestana == 'Licitaciones' else 'Descartada', 'decision': g('decision') or 'Pendiente',
                      'fecha_decision': fecha(g('fecha_decision')), 'comentarios': g('comentarios')[:2000], 'excepcion': g('excepcion')[:500],
                      'progreso': num(r[idx['progreso']] if 'progreso' in idx and idx['progreso'] < len(r) else None), 'progreso_nota': g('progreso_nota')[:200]})
    cols = {c: idx.get(c) for c in ('decision', 'estado', 'fecha_decision', 'comentarios')}
    return filas, cols


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--seco', action='store_true')
    a = ap.parse_args()
    e = env(); tok = access_token()
    vivas, cols = parsear(leer(tok, 'Licitaciones!A1:Z'), 'Licitaciones')
    try:
        desc, _ = parsear(leer(tok, 'Descartadas!A1:Z'), 'Descartadas')
    except urllib.error.HTTPError:
        desc = []
    # 1) Decisiones de HQ pendientes de devolver al Sheet (antes de traer, para no pisarlas)
    pendientes = [] if a.seco else rpc(e, 'omc_licitaciones_pendientes_sync', e['HQ_TOKEN'])
    por_exp = {f['expediente']: f for f in vivas}
    datos, hechas = [], []
    for l in pendientes:
        f = por_exp.get(l['expediente'])
        if not f or not f.get('fila'):
            continue
        n = f['fila']; motivo = ', '.join(l.get('motivos') or []) + ((' · ' if l.get('motivos') else '') + l['motivo_texto'] if l.get('motivo_texto') else '')
        coment = (f.get('comentarios') or '').strip()
        nota = f"HQ {l['decision']} ({l.get('fecha_decision') or date.today().isoformat()}): {motivo}".strip()
        if cols.get('decision') is not None: datos.append({'range': f"Licitaciones!{letra(cols['decision'])}{n}", 'values': [[l['decision']]]})
        if cols.get('fecha_decision') is not None: datos.append({'range': f"Licitaciones!{letra(cols['fecha_decision'])}{n}", 'values': [[l.get('fecha_decision') or date.today().isoformat()]]})
        if cols.get('estado') is not None and l.get('estado'): datos.append({'range': f"Licitaciones!{letra(cols['estado'])}{n}", 'values': [[l['estado']]]})
        if cols.get('comentarios') is not None and nota not in coment: datos.append({'range': f"Licitaciones!{letra(cols['comentarios'])}{n}", 'values': [[(coment + '\n' if coment else '') + nota]]})
        hechas.append(l['expediente'])
        f['decision'], f['fecha_decision'], f['estado'] = l['decision'], l.get('fecha_decision') or date.today().isoformat(), l.get('estado') or f['estado']
    if datos and not a.seco:
        escribir(tok, datos)
        rpc(e, 'omc_licitaciones_sincronizadas', e['HQ_TOKEN'], p_expedientes=hechas)
    # 2) Traer todo a HQ
    todas = vivas + desc
    print(f"{len(vivas)} analizadas · {len(desc)} descartadas · {len(hechas)} decisiones devueltas al Sheet" + (' (seco)' if a.seco else ''))
    if a.seco:
        for f in [x for x in vivas if x['decision'] == 'Pendiente'][:5]:
            print(' ', f['expediente'], f['organo'][:40], f['importe'], f['cierre'], f['estado'], f['elegible'])
        return
    for i in range(0, len(todas), 150):
        rpc(e, 'omc_licitaciones_subir', e['HQ_TOKEN'], p_filas=todas[i:i + 150])


if __name__ == '__main__':
    main()
