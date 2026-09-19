#!/usr/bin/env python3
"""Rellena pcap_drive y ppt_drive en omc_licitaciones con los pliegos que el bot ya subió a Drive.

El bot de licitaciones (grants/licitaciones-nga/bot/licita.js) deja los pliegos en
<Licitaciones>/<expediente>/01 Pliegos (ficheros "PCAP*.pdf", "PPT*.pdf", "Anexo - ...pdf"),
pero en la BD y en el Sheet solo quedan los enlaces del portal (PLACSP, Gencat...), que en el
móvil fallan o piden sesión. HQ abre el de Drive si existe y, si no, el del portal.

Uso: lic-pliegos-drive.py [--todas] [--limite N] [--seco]
  sin opciones: licitaciones no descartadas con carpeta y aún sin revisar (cron horario)
  --todas: también las ya revisadas que siguen sin enlaces (por si el bot subió los pliegos después)
  --seco: no escribe en la BD
Credenciales: Drive con ~/.config/77delta/gdrive-diego.json (las carpetas están compartidas con diego@ y team@);
BD por PostgREST con la clave de servicio de infinitelabs-portal-cupons/.env.local (la misma que usa pgq.py).
"""
import argparse, json, re, sys, time, urllib.parse, urllib.request, urllib.error
from datetime import datetime, timezone
from pathlib import Path

ENV = Path('/Users/diego/dev/infinitelabs-portal-cupons/.env.local')
FOLDER_RE = re.compile(r'/folders/([A-Za-z0-9_-]+)')


def env():
    e = {}
    for l in ENV.read_text().splitlines():
        if '=' in l and not l.startswith('#'):
            k, v = l.split('=', 1); e[k.strip()] = v.strip().strip('"').strip("'")
    return e


def access_token():
    t = json.load(open(Path.home() / '.config/77delta/gdrive-diego.json'))
    datos = urllib.parse.urlencode({'client_id': t['client_id'], 'client_secret': t['client_secret'], 'refresh_token': t['refresh_token'], 'grant_type': 'refresh_token'}).encode()
    with urllib.request.urlopen(urllib.request.Request('https://oauth2.googleapis.com/token', data=datos, method='POST'), timeout=20) as r:
        return json.loads(r.read())['access_token']


def drive_list(tok, q, intentos=3):
    """Lista ficheros de Drive; None si la carpeta no es accesible (403/404) o la API no responde."""
    url = 'https://www.googleapis.com/drive/v3/files?' + urllib.parse.urlencode({'q': q, 'fields': 'files(id,name,mimeType)', 'pageSize': 200, 'supportsAllDrives': 'true', 'includeItemsFromAllDrives': 'true'})
    for i in range(intentos):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'Authorization': 'Bearer ' + tok}), timeout=30) as r:
                return json.loads(r.read()).get('files', [])
        except urllib.error.HTTPError as ex:
            if ex.code in (403, 404): return None
            if ex.code == 429 or ex.code >= 500: time.sleep(2 * (i + 1)); continue
            raise
        except (urllib.error.URLError, TimeoutError):
            time.sleep(2 * (i + 1))
    return None


def rest(e, metodo, ruta, cuerpo=None, prefer=None):
    h = {'apikey': e['SUPABASE_SERVICE_ROLE_KEY'], 'Authorization': 'Bearer ' + e['SUPABASE_SERVICE_ROLE_KEY'], 'Content-Type': 'application/json'}
    if prefer: h['Prefer'] = prefer
    req = urllib.request.Request(e['SUPABASE_URL'].rstrip('/') + '/rest/v1/' + ruta, data=json.dumps(cuerpo).encode() if cuerpo is not None else None, method=metodo, headers=h)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read() or b'null')


def enlaces_pliegos(tok, carpeta_url):
    """Devuelve (pcap, ppt, n_ficheros) o None si la carpeta no es accesible."""
    m = FOLDER_RE.search(carpeta_url or '')
    if not m: return None
    sub = drive_list(tok, f"'{m.group(1)}' in parents and name = '01 Pliegos' and mimeType = 'application/vnd.google-apps.folder' and trashed = false")
    if sub is None: return None
    if not sub: return ('', '', 0)
    ficheros = drive_list(tok, f"'{sub[0]['id']}' in parents and trashed = false")
    if ficheros is None: return None
    ficheros = sorted(ficheros, key=lambda f: f['name'].lower())

    def primero(prefijo):
        # El bot nombra "PCAP*.pdf" y "PPT*.pdf"; el resto va como "<tipo> - <nombre>.pdf".
        for f in ficheros:
            if f['name'].upper().startswith(prefijo): return 'https://drive.google.com/file/d/' + f['id'] + '/view'
        return ''
    return (primero('PCAP'), primero('PPT'), len(ficheros))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--todas', action='store_true'); ap.add_argument('--limite', type=int, default=500); ap.add_argument('--seco', action='store_true')
    a = ap.parse_args()
    e = env()
    filtro = 'empresa=eq.77delta&carpeta=neq.&estado=not.like.Descartada*&order=updated_at.desc&limit=' + str(a.limite)
    filtro += '&pcap_drive=eq.&ppt_drive=eq.' if a.todas else '&pliegos_drive_revisado=is.null'
    filas = rest(e, 'GET', 'omc_licitaciones?select=expediente,carpeta,estado&' + filtro)
    if not filas:
        print(f'{datetime.now():%Y-%m-%d %H:%M} nada que revisar'); return
    tok = access_token()
    ok = vacias = sin_acceso = 0
    for f in filas:
        r = enlaces_pliegos(tok, f['carpeta'])
        if r is None:
            sin_acceso += 1; print('sin acceso', f['expediente'], f['carpeta'][:70]); continue
        pcap, ppt, n = r
        if pcap or ppt: ok += 1
        else: vacias += 1
        if not a.seco:
            rest(e, 'PATCH', 'omc_licitaciones?empresa=eq.77delta&expediente=eq.' + urllib.parse.quote(f['expediente'], safe=''),
                 {'pcap_drive': pcap, 'ppt_drive': ppt, 'pliegos_drive_revisado': datetime.now(timezone.utc).isoformat()}, prefer='return=minimal')
        time.sleep(0.1)
    print(f'{datetime.now():%Y-%m-%d %H:%M} revisadas {len(filas)}: con pliegos {ok}, sin pliegos {vacias}, sin acceso {sin_acceso}' + (' (seco)' if a.seco else ''))


if __name__ == '__main__':
    main()
