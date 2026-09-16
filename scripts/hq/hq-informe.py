#!/usr/bin/env python3
"""Informe de las 07:00 para Diego (HQ v2, T15). Empieza por lo que pidio y lo que depende de el.
Lee HQ con HQ_OWNER_TOKEN, solo lectura. Sube el markdown a Drive con scripts/drive-subir.py y avisa
por tmux-decir a Marc-Chief; si Drive falla, guarda el informe en ~/.config/77delta/informes/ y avisa
con esa ruta (nunca se pierde el informe, y el aviso no lleva traza del fallo).
Uso: hq-informe.py [--dry-run] [--fecha YYYY-MM-DD]
"""
import argparse, os, pathlib, subprocess, sys
from collections import Counter
from datetime import datetime, timedelta, timezone

RAIZ = pathlib.Path(__file__).resolve().parents[2]
HQ = pathlib.Path(__file__).resolve().parent / 'hq.py'
sys.path.insert(0, str(HQ.parent)); os.environ.setdefault('HQ_ENGRAM_OFF', '1')
import hq  # noqa: E402
import importlib.util
_p = importlib.util.spec_from_file_location('hq_parados', HQ.parent / 'hq-parados.py'); hq_parados = importlib.util.module_from_spec(_p); _p.loader.exec_module(hq_parados)


def _f(v):
    if not v: return None
    d = datetime.fromisoformat(str(v).replace('Z', '+00:00')); return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def _hito(e):
    return f" · hito {e['fecha_hito']}" if e.get('fecha_hito') else ' · SIN HITO'


def secciones(hq_datos, feed, encargos, hoy):
    hace7 = hoy - timedelta(days=7)
    pedidos = [e for e in encargos if str(e.get('origen') or '').lower().startswith('diego') and (_f(e.get('fecha')) or hace7) >= hace7]
    parados = hq_parados.clasificar_parados(encargos, hoy); ids_parados = {e['id']: e['horas_parado'] for e in parados['avisar'] + parados['escalar']}
    l1 = []
    for e in sorted(pedidos, key=lambda e: e['id']):
        if e['estado'] == 'hecho': l1.append(f"HECHO #{e['id']} {e['texto'][:70]} ({e.get('agente') or '-'})")
        elif e['id'] in ids_parados: l1.append(f"PARADO #{e['id']} {e['texto'][:70]} ({e.get('agente') or '-'}) · {ids_parados[e['id']]} h sin avance{_hito(e)}")
        elif e['estado'] == 'descartado': l1.append(f"DESCARTADO #{e['id']} {e['texto'][:70]} · {e.get('motivo_descarte') or 'sin motivo'}")
        else: l1.append(f"EN CURSO #{e['id']} {e['texto'][:70]} ({e.get('agente') or '-'}) [{e['estado']}]{_hito(e)}")
    # omc_hq()['pendientes'] es to_jsonb(omc_solicitudes): la hora limite vive en la columna 'vence', no 'fecha_limite'.
    l2 = [f"#{p['id']} {p['titulo']}" + (f" · antes de {str(p['vence'])[11:16]}" if p.get('vence') else '') for p in hq_datos.get('pendientes', []) if p.get('destinatario') == 'diego' and p.get('estado') == 'pendiente'] or ['nada pendiente de ti']
    l3 = [f"#{e['id']} {e['texto'][:60]} ({e.get('agente') or '-'}) · {e['horas_parado']} h" for e in parados['escalar'] + parados['avisar']] or ['ninguno']
    cnt = Counter((x.get('codigo') or 'sin frente') for x in feed)
    l4 = [f"{k} · {v} eventos" for k, v in sorted(cnt.items(), key=lambda kv: (-kv[1], kv[0]))] or ['sin actividad']
    lic = hq_datos.get('licitaciones') or []
    # omc_hq()['licitaciones']: el cierre vive en 'cierre' (no 'fecha_limite') y el titulo corto en 'resumen_corto'/'objeto' (no 'titulo').
    l5 = [f"{x.get('expediente') or '-'} {str(x.get('resumen_corto') or x.get('objeto') or '')[:60]} · cierra {str(x.get('cierre') or '')[:16]} · {x.get('decision') or 'por decidir'}" for x in lic if x.get('cierre') and _f(x['cierre']) and _f(x['cierre']) <= hoy + timedelta(hours=72)] or ['nada cierra en 72 h']
    return [('Lo que pediste esta semana', l1 or ['ninguna petición registrada esta semana']), ('Lo que depende de ti', l2), ('Encargos parados', l3), ('Actividad por frente', l4), ('Licitaciones', l5)]


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--dry-run', action='store_true'); ap.add_argument('--fecha')
    a = ap.parse_args(); hoy = datetime.now(timezone.utc) if not a.fecha else datetime.fromisoformat(a.fecha).replace(tzinfo=timezone.utc)
    owner = hq.E.get('HQ_OWNER_TOKEN') or sys.exit('falta HQ_OWNER_TOKEN (solo lectura)')
    try:
        datos = hq.rpc('omc_hq', p_token=owner)
        feed = hq.rpc('omc_feed', p_token=owner, p_desde=(hoy - timedelta(hours=24)).isoformat())
        encargos = hq.rpc('omc_encargos_lista', p_token=owner)  # devuelve todos los encargos de la empresa; secciones() filtra por fecha y origen
    except Exception as ex:
        sys.exit(f'HQ no responde: {type(ex).__name__}')
    md = [f"# Informe HQ {hoy.strftime('%d-%m-%Y')} 07:00", '']
    for titulo, lineas in secciones(datos, feed, encargos, hoy):
        md += [f'## {titulo}', ''] + [f'- {l}' for l in lineas] + ['']
    texto = '\n'.join(md)
    if a.dry_run: print(texto); return
    tmp = pathlib.Path(os.environ.get('SCRATCHPAD', '/tmp')) / f"informe-hq-{hoy:%Y-%m-%d}.md"; tmp.write_text(texto)
    out = subprocess.run([sys.executable, str(RAIZ / 'scripts/drive-subir.py'), str(tmp), '--nombre', f"Informe HQ {hoy:%Y-%m-%d}"], capture_output=True, text=True)
    url = next((w for w in out.stdout.split() if w.startswith('https://')), None)
    if url:
        subprocess.run(['tmux-decir', 'Marc-Chief', f"[informe-7am] listo: {url} . Léelo y pásale a Diego las dos primeras secciones en el chat, en 6 líneas."], check=False)
        print(url)
    else:
        # Drive no disponible (MCP caido, oauth fallido...): nunca se pierde el informe, se guarda en
        # local y se avisa con la ruta, sin traza del fallo en el aviso (el detalle va solo al log del cron).
        print('drive-subir fallo, guardando informe en local:', out.stderr[-300:], file=sys.stderr)
        destino = pathlib.Path.home() / '.config/77delta/informes'; destino.mkdir(parents=True, exist_ok=True)
        ruta = destino / f"informe-hq-{hoy:%Y-%m-%d}.md"; ruta.write_text(texto)
        subprocess.run(['tmux-decir', 'Marc-Chief', f"[informe-7am] Drive no disponible, informe guardado en {ruta} . Léelo y pásale a Diego las dos primeras secciones en el chat, en 6 líneas."], check=False)
        print(str(ruta))


if __name__ == '__main__':
    main()
