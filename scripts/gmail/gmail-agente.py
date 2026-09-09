#!/usr/bin/env python3
"""Correo por agente sobre el buzón compartido team@77delta.com (borradores y envío real), por IMAP+SMTP.
Adaptado de cuponsIA/scripts/gmail-draft.py (HQ #73/doc 18c, encargo del chief 7-sep) para aceptar
cuenta (qué buzón autentica) y alias (qué "enviar como" usa, una vez configurado en Gmail > Ajustes >
Cuentas). Firma de IA obligatoria (AI Act art. 50) y Diego siempre en copia en correo a cliente.

Credenciales por cuenta en ~/.config/77delta/<cuenta>.env (permisos 600):
  - team: ~/.config/77delta/gmail-equipo.env (TEAM_USER, TEAM_APP_PASS). TEAM_PASS también vive ahí pero
    es solo para el login web con manos-web — nunca para IMAP/SMTP, desde que hay 2SV activada (7-sep).
  - diego: ~/.config/77delta/gmail.env (GMAIL_USER, GMAIL_APP_PASSWORD) — el de siempre, sin cambios

Uso:
  gmail-agente.py list --cuenta team
  gmail-agente.py draft --cuenta team --alias marti --agente "Martí" --to a@b.com [--cc x@y.com]
                         --subject "..." --body cuerpo.txt [--reply-to <id hex de Gmail>] [--no-sig]
  gmail-agente.py send  --cuenta team --alias marti --agente "Martí" --tarjeta 90 --to a@b.com ...
                         (send exige --tarjeta con una solicitud en HQ en estado 'aprobada': es contacto
                         real con un tercero, no un borrador. draft no lo exige.)
  gmail-agente.py delete --cuenta team "<texto del asunto>"

Regla dura: todo correo a cliente (draft o send) añade automáticamente diego@77delta.com en copia,
salvo --sin-diego explícito (para pruebas internas). No hay "--no-sig" que quite el disclaimer de IA,
solo el bloque de marca; el AI Act no es opcional.
"""
import os
import argparse, email, html, imaplib, os, re, smtplib, subprocess, sys, time
from email.header import decode_header, make_header
from email.message import EmailMessage
from email.utils import formataddr, formatdate, make_msgid

HQ = '/Users/diego/dev/77delta/scripts/hq/hq.py'
CONF_DIR = os.path.expanduser('~/.config/77delta')
CUENTAS = {
    'team': {'env': 'gmail-equipo.env', 'user_key': 'TEAM_USER', 'pass_keys': ('TEAM_APP_PASS',)},
    'diego': {'env': 'gmail.env', 'user_key': 'GMAIL_USER', 'pass_keys': ('GMAIL_APP_PASSWORD',)},
}
DRAFTS = '"[Gmail]/Drafts"'
ALL = '"[Gmail]/All Mail"'
DIEGO_CC = 'diego@77delta.com'


def creds(cuenta):
    cfg = CUENTAS[cuenta]
    path = os.path.join(CONF_DIR, cfg['env'])
    e = dict(l.strip().split('=', 1) for l in open(path) if '=' in l and not l.startswith('#'))
    user = e[cfg['user_key']]
    pw = None
    for k in cfg['pass_keys']:
        if e.get(k):
            pw = e[k].replace(' ', ''); break
    if not pw:
        sys.exit(f"cuenta '{cuenta}': falta contraseña de aplicación en {path} (claves probadas: {cfg['pass_keys']}). "
                 f"Sin 2SV activada, IMAP/SMTP con la contraseña normal no funciona.")
    return user, pw


def connect_imap(cuenta):
    user, pw = creds(cuenta)
    M = imaplib.IMAP4_SSL('imap.gmail.com')
    M.login(user, pw)
    return M, user


def connect_smtp(cuenta):
    user, pw = creds(cuenta)
    S = smtplib.SMTP_SSL('smtp.gmail.com', 465)
    S.login(user, pw)
    return S, user


def dec(h):
    if not h:
        return ''
    try:
        return ' '.join(str(make_header(decode_header(h))).split())
    except Exception:
        return ' '.join(str(h).split())


def to_html(text):
    out = []
    for para in re.split(r'\n\s*\n', text.strip()):
        lines = [html.escape(l) for l in para.splitlines()]
        p = '<br>'.join(lines)
        p = re.sub(r'(https?://[^\s<]+[^\s<.,;:)])', r'<a href="\1" style="color:#8A6216">\1</a>', p)
        out.append(f'<p style="margin:0 0 14px">{p}</p>')
    return '<div style="font-family:IBM Plex Sans,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#0A1628">' + ''.join(out) + '</div>'


def firma_agente(nombre_agente, sin_marca=False):
    """Firma obligatoria de IA (AI Act art. 50). sin_marca=True para pruebas internas sin el pie de marca."""
    linea = f"{nombre_agente} · asistente de IA de 77 Delta, supervisado por Diego Torres"
    txt = f"\n\n--\n{linea}\n77delta.com"
    h = (f'<div style="font-family:IBM Plex Sans,Helvetica,Arial,sans-serif;font-size:13px;'
         f'color:#5A6472;margin-top:18px;border-top:1px solid #E5E7EB;padding-top:10px">'
         f'{html.escape(linea)}<br><a href="https://77delta.com" style="color:#8A6216">77delta.com</a></div>')
    return txt, h


def find_message(M, gm_hex):
    M.select(ALL, readonly=True)
    typ, ids = M.search(None, 'X-GM-MSGID', str(int(gm_hex, 16)))
    if not ids[0]:
        raise SystemExit('no encuentro el mensaje ' + gm_hex)
    typ, data = M.fetch(ids[0].split()[-1], '(BODY.PEEK[HEADER.FIELDS (MESSAGE-ID REFERENCES SUBJECT)])')
    hdr = email.message_from_bytes(data[0][1])
    clean = lambda v: ' '.join((v or '').split())
    return clean(hdr.get('Message-ID')), clean(hdr.get('References')), dec(hdr.get('Subject', ''))


def exigir_remitente_coherente(a, remitente_addr):
    """9-sep (bug grave visto por Diego): salio un correo 'Aina <diego@77delta.com>'. El nombre visible y el buzon
    tienen que ser la misma persona o el buzon del equipo con alias verificado. Reglas:
      - cuenta diego: solo se envia como Diego Torres; --agente o --alias estan prohibidos.
      - cuenta team: --agente exige --alias, y el alias tiene que estar en ALIAS_OK de gmail-equipo.env
        (alias 'enviar como' verificados en Gmail). Sin alias, el remitente es 'Equipo 77 Delta <team@...>'."""
    if a.cuenta == 'diego' and (a.agente or a.alias):
        sys.exit("NO ENVÍO: desde el buzón personal de Diego solo se envía como Diego Torres. Quita --agente/--alias o usa --cuenta team con un alias verificado.")
    if a.cuenta == 'team' and a.agente and not a.alias:
        sys.exit(f"NO ENVÍO: --agente '{a.agente}' sin --alias pondría un nombre de persona sobre el buzón team@. Pasa --alias <nombre> (alias verificado) o quita --agente.")
    if a.alias:
        ok = [x.strip().lower() for x in os.environ.get('ALIAS_OK', '').split(',') if x.strip()]
        if not ok:
            try:
                for l in open(os.path.expanduser('~/.config/77delta/gmail-equipo.env')):
                    if l.startswith('ALIAS_OK='):
                        ok = [x.strip().lower() for x in l.split('=', 1)[1].strip().strip('"').split(',') if x.strip()]
            except Exception:
                pass
        if a.alias.lower() not in ok:
            sys.exit(f"NO ENVÍO: el alias '{a.alias}@77delta.com' no consta como 'enviar como' verificado (ALIAS_OK en gmail-equipo.env). Gmail reescribiría el From al buzón autenticado. Pendiente #89.")


def exigir_cuerpo_sano(body, destinatarios, forzar):
    """9-sep (Jordi-COO, incidente real): un agente envió con --body apuntando al fichero de trabajo
    entero en vez del texto del mensaje - le llegó a una regidora de Terrassa un documento interno de
    9.739 caracteres con 10 correos de cargos de otros ayuntamientos y notas internas. El script hizo
    lo que le pidieron: el hueco era que no había red de seguridad. Avisa y para, no bloquea en
    silencio: --forzar-cuerpo lo salta a propósito para quien de verdad lo necesite."""
    if forzar:
        return
    propios = {d.strip().lower() for d in destinatarios if d and d.strip()}
    problemas = []
    if re.search(r'(?m)^\s*#{1,6}\s|^\s*>\s', body):
        problemas.append("tiene cabeceras markdown al principio de línea (#, ##, >): parece un documento de trabajo, no el texto de un correo")
    ajenos = sorted({e.lower() for e in re.findall(r'[\w.+-]+@[\w-]+\.[\w.-]+', body)} - propios)
    if len(ajenos) > 2:
        problemas.append(f"tiene {len(ajenos)} direcciones de correo que no son el destinatario ({', '.join(ajenos[:5])}{', ...' if len(ajenos) > 5 else ''}): parece contener contactos ajenos, no el mensaje")
    if len(body) > 3000:
        problemas.append(f"tiene {len(body)} caracteres: ningún correo en frío nuestro llega a 3.000")
    if problemas:
        sys.exit("NO ENVÍO/NO GUARDO: el --body parece el fichero equivocado (" + '; '.join(problemas) + "). "
                  "Si el fichero es el correcto y de verdad quieres pasarlo así, repite el mismo comando añadiendo --forzar-cuerpo.")


def construir_mensaje(a, remitente_addr):
    exigir_remitente_coherente(a, remitente_addr)
    body = open(a.body, encoding='utf-8').read().strip()
    exigir_cuerpo_sano(body, [a.to, a.cc or ''], getattr(a, 'forzar_cuerpo', False))
    msg = EmailMessage()
    # 9-sep: desde el buzon personal el nombre visible es siempre Diego; 'Equipo 77 Delta' solo tiene sentido en team@.
    # 9-sep, regla de Diego: nunca 'Equipo 77 Delta'. O el agente desde su alias verificado, o Diego Torres.
    if a.cuenta == 'diego':
        nombre_from = 'Diego Torres'
    elif a.alias:
        nombre_from = a.agente or a.alias.capitalize()
    else:
        sys.exit('NO ENVÍO: desde team@ hace falta --alias verificado (ALIAS_OK). No existe remitente genérico.')
    msg['From'] = formataddr((nombre_from, remitente_addr))
    msg['To'] = a.to.replace(',', ', ')
    cc = a.cc or ''
    # 9-sep: si el correo sale del propio buzon de Diego, no se le pone en copia (se autocopiaba).
    if not a.sin_diego and a.cuenta != 'diego' and DIEGO_CC not in cc:
        cc = (cc + ',' + DIEGO_CC).strip(',')
    if cc:
        msg['Cc'] = cc.replace(',', ', ')
    subject = a.subject
    mid_ref = None
    if getattr(a, 'reply_to', None):
        M, _ = connect_imap(a.cuenta)
        mid, refs, subj = find_message(M, a.reply_to)
        M.logout()
        msg['In-Reply-To'] = mid
        msg['References'] = (refs + ' ' + mid).strip()
        if not subject:
            subject = subj if subj.lower().startswith('re:') else 'Re: ' + subj
    msg['Subject'] = subject
    msg['Date'] = formatdate(localtime=True)
    msg['Message-ID'] = make_msgid(domain='77delta.com')
    # 9-sep: cuando el correo sale como Diego desde su propio buzon, lo envia un humano que lo ha revisado: sin pie de IA.
    # La marca del AI Act va solo cuando escribe un agente con su nombre desde team@.
    txt_sig, html_sig = ('', '') if (a.cuenta == 'diego' and not a.agente) else firma_agente(nombre_from)
    text = body + txt_sig
    h = to_html(body) + html_sig
    msg.set_content(text)
    msg.add_alternative('<html><body>' + h + '</body></html>', subtype='html')
    return msg, subject, cc


def alias_addr(a):
    if not a.alias:
        return None
    return f"{a.alias}@77delta.com"


def exigir_tarjeta_aprobada(tarjeta_id):
    r = subprocess.run(['python3', HQ, '--json', 'estado', str(tarjeta_id)], capture_output=True, text=True, timeout=30)
    if r.returncode != 0:
        sys.exit(f"no pude consultar la tarjeta #{tarjeta_id}: {r.stderr.strip()[:300]}")
    try:
        s = __import__('json').loads(r.stdout)
    except Exception:
        sys.exit(f"respuesta rara de HQ para #{tarjeta_id}: {r.stdout[:300]}")
    if s.get('estado') != 'aprobada':
        sys.exit(f"NO ENVÍO: tarjeta #{tarjeta_id} está en estado '{s.get('estado')}', no 'aprobada'. Título: {s.get('titulo')}")
    return s


def draft(a):
    M, user = connect_imap(a.cuenta)
    remitente = alias_addr(a) or user
    msg, subject, cc = construir_mensaje(a, remitente)
    M.append(DRAFTS, '\\Draft', imaplib.Time2Internaldate(time.time()), msg.as_bytes())
    M.logout()
    print(f"borrador creado ({a.cuenta}{' / alias ' + a.alias if a.alias else ''}): {subject} -> {a.to}" + (f" · cc {cc}" if cc else ""))


def send(a):
    # 9-sep, politica de Diego: lo que sale de su cuenta personal (clientes con relacion) se queda SIEMPRE en borrador y lo
    # envia el. Solo se envia directamente desde team@ con alias de agente verificado (outreach, partners, contactos nuevos).
    if a.cuenta == 'diego':
        sys.exit("NO ENVÍO: desde la cuenta de Diego los agentes solo dejan borradores (política del 9-sep). Usa 'draft'; Diego lo envía.")
    if not a.tarjeta:
        sys.exit("send exige --tarjeta <id>: correo real a un tercero necesita una solicitud de HQ aprobada. Usa 'draft' si no la tienes todavía.")
    tarjeta = exigir_tarjeta_aprobada(a.tarjeta)
    remitente = alias_addr(a) or creds(a.cuenta)[0]
    msg, subject, cc = construir_mensaje(a, remitente)
    S, user = connect_smtp(a.cuenta)
    todos = [x.strip() for x in (a.to.split(',') + (cc.split(',') if cc else []))]
    S.send_message(msg, from_addr=user, to_addrs=todos)
    S.quit()
    print(f"ENVIADO de verdad ({a.cuenta}{' / alias ' + a.alias if a.alias else ''}, tarjeta #{a.tarjeta} [{tarjeta['estado']}]): {subject} -> {a.to}" + (f" · cc {cc}" if cc else ""))
    if a.lote:
        # Lote aprobado como conjunto (p. ej. #228, 'enviadlos todos'): la tarjeta sigue en 'aprobada' para los
        # siguientes envios; quien lanza el lote la cierra al final con 'hq.py hecho' y la lista completa.
        subprocess.run(['python3', HQ, 'comentar', str(a.tarjeta), '--texto', f'Enviado (lote): {subject} -> {a.to}'], capture_output=True, text=True, timeout=30)
    else:
        subprocess.run(['python3', HQ, 'hecho', str(a.tarjeta), '--nota', f'Correo enviado: {subject} -> {a.to}'], capture_output=True, text=True, timeout=30)


def list_drafts(a):
    M, _ = connect_imap(a.cuenta)
    M.select(DRAFTS, readonly=True)
    typ, ids = M.search(None, 'ALL')
    for i in ids[0].split():
        typ, d = M.fetch(i, '(BODY.PEEK[HEADER.FIELDS (SUBJECT TO DATE)])')
        hdr = email.message_from_bytes(d[0][1])
        print(i.decode(), '|', dec(hdr.get('Date', ''))[:22], '|', dec(hdr.get('To', ''))[:50], '|', dec(hdr.get('Subject', ''))[:70])
    M.logout()


def delete(a):
    M, _ = connect_imap(a.cuenta)
    M.select(DRAFTS)
    typ, ids = M.search(None, 'ALL')
    n = 0
    for i in ids[0].split():
        typ, d = M.fetch(i, '(BODY.PEEK[HEADER.FIELDS (SUBJECT)])')
        s = dec(email.message_from_bytes(d[0][1]).get('Subject', ''))
        if a.text.lower() in s.lower():
            M.store(i, '+FLAGS', '\\Deleted'); n += 1
            print('borrado:', s[:70])
    M.expunge(); M.logout()
    print(n, 'borradores eliminados')


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = p.add_subparsers(dest='cmd', required=True)

    def comun(sub, con_agente=True):
        sub.add_argument('--cuenta', choices=CUENTAS, default='team')
        sub.add_argument('--alias', help='parte antes de @77delta.com para "enviar como" (marti, ariadna, ...); requiere que ya esté configurado en Gmail > Ajustes > Cuentas')
        if con_agente:
            sub.add_argument('--agente', help='nombre para la firma, p.ej. "Martí"; si no se da, usa el alias')

    q = sp.add_parser('draft'); comun(q)
    q.add_argument('--to', required=True); q.add_argument('--cc'); q.add_argument('--subject', default='')
    q.add_argument('--body', required=True); q.add_argument('--reply-to'); q.add_argument('--sin-diego', action='store_true')
    q.add_argument('--forzar-cuerpo', dest='forzar_cuerpo', action='store_true', help='salta el chequeo de --body (markdown, >2 emails ajenos, >3000 caracteres) a propósito')

    r = sp.add_parser('send'); comun(r)
    r.add_argument('--to', required=True); r.add_argument('--cc'); r.add_argument('--subject', default='')
    r.add_argument('--body', required=True); r.add_argument('--reply-to'); r.add_argument('--sin-diego', action='store_true')
    r.add_argument('--tarjeta', type=int, required=True); r.add_argument('--lote', action='store_true', help='varios envios bajo la misma tarjeta aprobada: no la cierra, solo comenta; cerrarla al final con hq.py hecho')
    r.add_argument('--forzar-cuerpo', dest='forzar_cuerpo', action='store_true', help='salta el chequeo de --body (markdown, >2 emails ajenos, >3000 caracteres) a propósito')

    l = sp.add_parser('list'); comun(l, con_agente=False)
    d = sp.add_parser('delete'); comun(d, con_agente=False); d.add_argument('text')

    a = p.parse_args()
    if not getattr(a, 'agente', None) and getattr(a, 'alias', None):
        a.agente = a.alias.capitalize()
    {'draft': draft, 'send': send, 'list': list_drafts, 'delete': delete}[a.cmd](a)
