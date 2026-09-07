#!/usr/bin/env python3
"""HQ · muestrea el consumo real del plan Claude Max (ventana de 5 h, semanal general y semanal Fable/Opus,
con sus horas de reinicio) de las DOS cuentas y lo sube a Supabase.

Lee el token OAuth de cada cuenta por su CLAUDE_CONFIG_DIR: ~/.claude = 'principal' (Diego), ~/.claude-team =
'team' (team@77delta.com, ver docs/empresa/20-segunda-cuenta-max.md) si ya tiene login — si no, se salta esa
cuenta sin fallar (uso() devuelve None si no hay .credentials.json). Consulta el endpoint de uso y hace upsert
vía omc_subir_plan. Cron cada 15 minutos. Nunca imprime tokens.

  hq-plan.py [--seco]
"""
import argparse, json, os, sys, urllib.request, urllib.error
from datetime import datetime, timezone
from pathlib import Path

CONF = Path.home() / '.config' / '77delta' / 'hq.env'
CUENTAS = [('principal', Path.home() / '.claude'), ('team', Path.home() / '.claude-team')]


def env():
    e = {}
    if CONF.exists():
        for l in CONF.read_text().splitlines():
            l = l.strip()
            if '=' in l and not l.startswith('#'):
                k, v = l.split('=', 1); e[k.strip()] = v.strip().strip('"').strip("'")
    e.update({k: v for k, v in os.environ.items() if k.startswith('HQ_')})
    return e


def uso(cfg):
    cred = cfg / '.credentials.json'
    if not cred.exists():
        return None
    o = json.load(open(cred)).get('claudeAiOauth') or {}
    tok = o.get('accessToken')
    if not tok:
        return None
    req = urllib.request.Request('https://api.anthropic.com/api/oauth/usage',
                                 headers={'Authorization': 'Bearer ' + tok, 'anthropic-beta': 'oauth-2025-04-20', 'User-Agent': 'claude-code/2.1'})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            u = json.loads(r.read())
    except urllib.error.HTTPError as ex:
        print(f'{cfg}: HTTP {ex.code} (token caducado? se refresca al abrir Claude Code)', file=sys.stderr)
        return None
    f, s = u.get('five_hour') or {}, u.get('seven_day') or {}
    # El medidor "Fable/Opus" no viene en un campo simple (seven_day_opus siempre viene null): está dentro
    # de limits[], el único elemento semanal con scope.model (el general "weekly_all" no tiene scope). El
    # nombre del modelo cambia con el tiempo (Fable hoy, Opus cuando el equipo termine de migrar) pero
    # siempre es "el límite semanal atado a un modelo concreto", así que no hace falta hardcodear el nombre.
    semana_opus = None
    for l in u.get('limits') or []:
        if l.get('group') == 'weekly' and ((l.get('scope') or {}).get('model') or {}).get('display_name'):
            semana_opus = l.get('percent')
            break
    ts = datetime.now(timezone.utc).replace(second=0, microsecond=0)
    ts = ts.replace(minute=ts.minute - ts.minute % 15)
    return {'ts': ts.isoformat(), 'tipo': o.get('rateLimitTier') or o.get('subscriptionType') or '',
            'cinco_h': f.get('utilization') or 0, 'cinco_h_reset': f.get('resets_at') or '',
            'semana': s.get('utilization') or 0, 'semana_reset': s.get('resets_at') or '',
            'semana_opus': semana_opus}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--seco', action='store_true')
    a = ap.parse_args()
    e = env()
    for nombre, cfg in CUENTAS:
        m = uso(cfg)
        if not m:
            continue
        m['cuenta'] = nombre
        extra = f" · Fable/Opus {m['semana_opus']} %" if m['semana_opus'] is not None else ''
        print(f"{nombre} ({m['tipo']}): 5h {m['cinco_h']} % (reinicia {m['cinco_h_reset'][:16]}) · semana {m['semana']} % (reinicia {m['semana_reset'][:16]}){extra}")
        if a.seco:
            continue
        req = urllib.request.Request(e['HQ_URL'].rstrip('/') + '/rest/v1/rpc/omc_subir_plan', method='POST',
                                     data=json.dumps({'p_token': e['HQ_TOKEN'], 'p': m}).encode(),
                                     headers={'apikey': e['HQ_ANON'], 'Authorization': 'Bearer ' + e['HQ_ANON'], 'Content-Type': 'application/json'})
        try:
            urllib.request.urlopen(req, timeout=30).read()
        except urllib.error.HTTPError as ex:
            sys.exit(f'HTTP {ex.code}: {ex.read().decode()[:300]}')


if __name__ == '__main__':
    main()
