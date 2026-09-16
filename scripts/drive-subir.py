#!/usr/bin/env python3
"""Sube un Markdown a Google Drive como Google Doc (o lo actualiza si ya existe con el mismo nombre)
y devuelve el enlace. Fuente de la verdad para Diego: Drive, no rutas locales.

Uso: drive-subir.py <fichero.md|.html> [--carpeta <id>] [--subcarpeta Informes] [--nombre "Título"] [--html] [--compartir email1,email2]
--html: el fichero ya es HTML maquetado (p.ej. salida de gen-reunion-doc.py) y se sube tal cual,
sin pasar por la conversión de markdown.
--compartir: da permiso de lectura sobre el Doc a esas direcciones (para clientes).
Por defecto: carpeta "77 Delta · Empresa" (1S8YGhojPitnKCv8Qj7OG5ZrSB1tXQeLG), subcarpeta "Informes".
Token: ~/.config/77delta/gdrive-diego.json (diego@77delta.com, scope drive). Nunca se imprime.
"""
import argparse, html, json, os, re, sys, urllib.parse, urllib.request, uuid

TOKEN = os.path.expanduser('~/.config/77delta/gdrive-diego.json')
CARPETA_EMPRESA = '1S8YGhojPitnKCv8Qj7OG5ZrSB1tXQeLG'
API = 'https://www.googleapis.com/drive/v3/files'
UP = 'https://www.googleapis.com/upload/drive/v3/files'


def access_token():
    d = json.load(open(TOKEN))
    body = urllib.parse.urlencode({'client_id': d['client_id'], 'client_secret': d['client_secret'],
                                   'refresh_token': d['refresh_token'], 'grant_type': 'refresh_token'}).encode()
    return json.load(urllib.request.urlopen(urllib.request.Request('https://oauth2.googleapis.com/token', data=body)))['access_token']


def req(tok, url, data=None, method='GET', headers=None):
    h = {'Authorization': 'Bearer ' + tok}
    h.update(headers or {})
    r = urllib.request.Request(url, data=data, method=method, headers=h)
    return json.load(urllib.request.urlopen(r))


def q(tok, query, fields='files(id,name,mimeType)'):
    url = API + '?' + urllib.parse.urlencode({'q': query, 'fields': fields, 'pageSize': 100,
                                             'supportsAllDrives': 'true', 'includeItemsFromAllDrives': 'true', 'corpora': 'allDrives'})
    return req(tok, url).get('files', [])


def subcarpeta(tok, padre, nombre):
    esc = nombre.replace("'", "\\'")
    f = q(tok, f"'{padre}' in parents and name='{esc}' and mimeType='application/vnd.google-apps.folder' and trashed=false")
    if f:
        return f[0]['id']
    meta = json.dumps({'name': nombre, 'mimeType': 'application/vnd.google-apps.folder', 'parents': [padre]}).encode()
    return req(tok, API + '?supportsAllDrives=true', data=meta, method='POST', headers={'Content-Type': 'application/json'})['id']


def inline(t):
    t = html.escape(t, quote=False)
    t = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', t)
    t = re.sub(r'`([^`]+)`', r'<code>\1</code>', t)
    t = re.sub(r'\[([^\]]+)\]\((https?://[^)]+)\)', r'<a href="\2">\1</a>', t)
    return t


def md_a_html(md):
    out, tabla, lista, parrafo = [], [], False, []

    def cierra():
        nonlocal lista, parrafo, tabla
        if parrafo:
            out.append('<p>' + ' '.join(inline(x) for x in parrafo) + '</p>')
            parrafo = []
        if lista:
            out.append('</ul>')
            lista = False
        if tabla:
            filas = [r for r in tabla if not re.match(r'^\|?\s*:?-{2,}', r)]
            out.append('<table border="1" cellpadding="4" style="border-collapse:collapse">')
            for i, r in enumerate(filas):
                celdas = [c.strip() for c in r.strip().strip('|').split('|')]
                tag = 'th' if i == 0 else 'td'
                out.append('<tr>' + ''.join(f'<{tag}>{inline(c)}</{tag}>' for c in celdas) + '</tr>')
            out.append('</table>')
            tabla = []

    for linea in md.splitlines():
        s = linea.rstrip()
        if s.startswith('|'):
            if lista or parrafo:
                cierra()
            tabla.append(s)
            continue
        if tabla:
            cierra()
        m = re.match(r'^(#{1,4})\s+(.*)', s)
        if m:
            cierra()
            n = len(m.group(1))
            out.append(f'<h{n}>{inline(m.group(2))}</h{n}>')
        elif re.match(r'^\s*[-*]\s+', s):
            if parrafo:
                cierra()
            if not lista:
                out.append('<ul>')
                lista = True
            out.append('<li>' + inline(re.sub(r'^\s*[-*]\s+', '', s)) + '</li>')
        elif not s.strip():
            cierra()
        else:
            if lista:
                cierra()
            parrafo.append(s)
    cierra()
    return '<html><head><meta charset="utf-8"></head><body>' + '\n'.join(out) + '</body></html>'


def permitir(tok, fid, email):
    meta = json.dumps({'role': 'reader', 'type': 'user', 'emailAddress': email}).encode()
    req(tok, API + f"/{fid}/permissions?supportsAllDrives=true&sendNotificationEmail=false", data=meta, method='POST', headers={'Content-Type': 'application/json'})


def subir(tok, ruta, carpeta, nombre, es_html=False):
    fuente = open(ruta, encoding='utf-8').read()
    cuerpo = (fuente if es_html else md_a_html(fuente)).encode('utf-8')
    esc = nombre.replace("'", "\\'")
    previos = q(tok, f"'{carpeta}' in parents and name='{esc}' and trashed=false")
    lim = 'b' + uuid.uuid4().hex
    meta = {'name': nombre, 'mimeType': 'application/vnd.google-apps.document'}
    if not previos:
        meta['parents'] = [carpeta]
    partes = (f'--{lim}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{json.dumps(meta)}\r\n'
              f'--{lim}\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n').encode() + cuerpo + f'\r\n--{lim}--'.encode()
    h = {'Content-Type': f'multipart/related; boundary={lim}'}
    if previos:
        r = req(tok, UP + f"/{previos[0]['id']}?uploadType=multipart&supportsAllDrives=true", data=partes, method='PATCH', headers=h)
    else:
        r = req(tok, UP + '?uploadType=multipart&supportsAllDrives=true', data=partes, method='POST', headers=h)
    return r['id'], ('actualizado' if previos else 'creado')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('fichero')
    ap.add_argument('--carpeta', default=CARPETA_EMPRESA)
    ap.add_argument('--subcarpeta', default='Informes')
    ap.add_argument('--nombre')
    ap.add_argument('--html', action='store_true', help='el fichero ya es HTML maquetado, subir tal cual')
    ap.add_argument('--compartir', help='emails separados por coma, permiso de lectura')
    a = ap.parse_args()
    tok = access_token()
    carpeta = subcarpeta(tok, a.carpeta, a.subcarpeta) if a.subcarpeta else a.carpeta
    nombre = a.nombre or os.path.splitext(os.path.basename(a.fichero))[0]
    fid, accion = subir(tok, a.fichero, carpeta, nombre, es_html=a.html)
    if a.compartir:
        for email in a.compartir.split(','):
            permitir(tok, fid, email.strip())
    print(f'{accion}: https://docs.google.com/document/d/{fid}/edit')


if __name__ == '__main__':
    main()
