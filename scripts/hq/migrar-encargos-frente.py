#!/usr/bin/env python3
# scripts/hq/migrar-encargos-frente.py
"""Asigna frente (omc_plan_lineas.codigo) a los encargos de 77delta sin linea_id y normaliza departamentos.
Uso: --dry-run (CSV en scratchpad) | --aplicar [--asignar 123=A3,124=E4]. Usa la service key del portal (como pgq.py); no imprime claves."""
import argparse, csv, json, os, re, sys, urllib.request
from datetime import date

EMPRESA = os.environ.get('HQ_EMPRESA', '77delta')
MESES_ES = {1: 'ene', 2: 'feb', 3: 'mar', 4: 'abr', 5: 'may', 6: 'jun', 7: 'jul', 8: 'ago', 9: 'sep', 10: 'oct', 11: 'nov', 12: 'dic'}
FECHA_HOY = f'{date.today().day:02d}-{MESES_ES[date.today().month]}'
# orden importa: la primera regla que casa gana. Específicas antes que genéricas.
REGLAS = [
    ('A2', r'crib|elegib|art\.? ?76|rolece|reli\b|checklist de (elegib|viab)'), ('A1', r'fuentes?\b.*(ccaa|licitaci|feed)|placsp|detecci[oó]n|motor de licitaciones|scraper'),
    ('A4', r'colaborador|\bute\b|freelance|referee|jaume|oriol'), ('D1', r'licita producto|licita\.app|landing de licita|demo de licita'),
    ('A3', r'licitaci|oferta|pliego|sobre digital|deuc|segipsa|\bdgt\b|san fernando|\bcvc\b|durango|memoria t[eé]cnica'),
    ('B1', r'acci[oó]|exploraci[oó]|cambra|\been\b'), ('B2', r'cup[oó]n?s? ia|cup[oó] ia|nora|one ?hub|aresa|zimeron|epic|ipae|\bacta\b'),
    ('B4', r'fundae|bonificad|formaci[oó]n programada'), ('B3', r'subvenci|europe|kit digital|kit consulting|cdti|convocatoria'),
    ('C1', r'ayuntamient|municip|diputaci'), ('C2', r'contrato menor|\bmenor(es)?\b'), ('C3', r'peninsula|consultor[ií]a|moncon'), ('C4', r'\bciber|leakai|auditor[ií]a de chatbot'),
    ('C5', r'prospecci|outreach|linkedin|seguimiento|campa[nñ]a|\blead|swarmix|toque'), ('D2', r'regulia|stripe'), ('D3', r'contestia|instantexam|canto|scoreflow|contablia|corpora|radar'),
    ('E1', r'\biae\b|\biso\b|\bens\b|certific|ep[ií]grafe|habilitaci'), ('E2', r'solvencia|factur|banco|santander|finom|capital|contab|fiscal|patrimonio'),
    ('E3', r'agente|ventana|tmux|cuenta|ahorro|relanzar|onboarding|alias'), ('E4', r'\bhq\b|tarjeta|encargo|backlog|informe|engram|memoria|cron|latido|webapp|spec'),
    ('E5', r'\bweb\b|marca|firma|logo|landing|seo'),
]
RESPONSABLE = {'guillem': 'A3', 'laia': 'A3', 'roger': 'A3', 'ariadna': 'A1', 'quim': 'A1', 'helena': 'B1', 'martí': 'B2', 'marti': 'B2', 'biel': 'C2', 'aina': 'C5', 'ona': 'C4',
               'marina': 'D2', 'joana': 'D1', 'ferran': 'E2', 'teresa': 'E2', 'arnau': 'E2', 'pol': 'E3', 'jordi': 'E3', 'coo': 'E3', 'bernat': 'E3', 'victor': 'E3', 'víctor': 'E3',
               'nuria': 'E4', 'núria': 'E4', 'chief': 'E4', 'mireia': 'E5', 'clara': 'B3'}
DEPARTAMENTO = {'licitaciones': 'A3', 'sales': 'A3', 'grants': 'B3', 'subvenciones': 'B3', 'comercial': 'C5', 'bizdev': 'C5', 'producto': 'D1', 'operaciones': 'E3',
                'estrategia': 'E4', 'chief': 'E4', 'direccion': 'E4', 'hq': 'E4', 'finanzas': 'E2'}
CANONICO = {'A': 'licitaciones', 'B': 'subvenciones', 'C': 'comercial', 'D': 'producto', 'E': 'operaciones'}
CANONICO_E = {'E1': 'operaciones', 'E2': 'finanzas', 'E3': 'operaciones', 'E4': 'hq', 'E5': 'comercial'}


def clasificar(texto, responsable, departamento):
    t = (texto or '').lower()
    for codigo, patron in REGLAS:
        if re.search(patron, t):
            return codigo, f'regla:{patron[:30]}'
    r = (responsable or '').lower().split('-')[0].strip()
    if r in RESPONSABLE:
        return RESPONSABLE[r], f'responsable:{r}'
    d = (departamento or '').lower().strip()
    if d in DEPARTAMENTO:
        return DEPARTAMENTO[d], f'departamento:{d}'
    return None, 'sin regla'


def depto_canonico(departamento, codigo):
    if not codigo:
        return (departamento or '').lower().strip() or 'operaciones'
    return CANONICO_E.get(codigo) or CANONICO[codigo[0]]


def _sql(q):
    e = {}
    for l in open('/Users/diego/dev/infinitelabs-portal-cupons/.env.local'):
        if '=' in l and not l.startswith('#'):
            k, v = l.strip().split('=', 1); e[k] = v.strip('"').strip("'")
    svc = e['SUPABASE_SERVICE_ROLE_KEY']
    req = urllib.request.Request(e['SUPABASE_URL'].rstrip('/') + '/pg/query', data=json.dumps({'query': q}).encode(), method='POST',
                                 headers={'apikey': svc, 'Authorization': 'Bearer ' + svc, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read() or b'null') or []


def q(s):
    return "'" + str(s).replace("'", "''") + "'"


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    g = ap.add_mutually_exclusive_group(required=True); g.add_argument('--dry-run', action='store_true'); g.add_argument('--aplicar', action='store_true')
    ap.add_argument('--asignar', default='', help='123=A3,124=E4')
    a = ap.parse_args()
    manual = dict(x.split('=') for x in a.asignar.split(',') if '=' in x)
    frentes = {f['codigo'].upper(): f['id'] for f in _sql(f"select id, upper(codigo) as codigo from omc_plan_lineas where empresa={q(EMPRESA)} and activa and codigo is not null")}
    encargos = _sql(f"select id, texto, agente, departamento, estado, linea_id from omc_encargos where empresa={q(EMPRESA)} order by id")
    existentes = {str(e['id']) for e in encargos}
    desconocidos = sorted(set(manual) - existentes)
    if desconocidos:
        sys.exit(f'--asignar con ids que no existen en el tenant {EMPRESA}: {",".join(desconocidos)}')
    filas = []
    for e in encargos:
        if e['linea_id']:
            codigo = next((c for c, i in frentes.items() if i == e['linea_id']), None); motivo = 'ya tenía'
        elif str(e['id']) in manual:
            codigo, motivo = manual[str(e['id'])].upper(), 'manual'
        else:
            codigo, motivo = clasificar(e['texto'], e['agente'], e['departamento'])
        if codigo and codigo not in frentes:
            sys.exit(f'frente {codigo} no existe en la base (encargo {e["id"]})')
        filas.append({'id': e['id'], 'estado': e['estado'], 'codigo': codigo or '', 'motivo': motivo, 'depto': depto_canonico(e['departamento'], codigo), 'texto': (e['texto'] or '')[:90]})
    sin = [f for f in filas if not f['codigo'] and f['estado'] != 'descartado']
    if a.dry_run:
        destino = os.path.join(os.environ.get('SCRATCHPAD', '/tmp'), 'migracion-encargos.csv')
        with open(destino, 'w', newline='') as fh:
            w = csv.DictWriter(fh, fieldnames=list(filas[0].keys()), delimiter=';'); w.writeheader(); w.writerows(filas)
        print(f'{len(filas)} encargos - {len(sin)} vivos sin frente - CSV {destino}')
        for f in sin: print(f"  #{f['id']} [{f['estado']}] {f['texto']}")
        return
    if sin:
        sys.exit(f'{len(sin)} encargos vivos sin frente; pásalos con --asignar id=CODIGO')
    for f in filas:
        if f['motivo'] == 'ya tenía' or not f['codigo']:
            _sql(f"update omc_encargos set departamento={q(f['depto'])} where id={f['id']} and empresa={q(EMPRESA)} and departamento is distinct from {q(f['depto'])}")
            continue
        _sql(f"update omc_encargos set linea_id={frentes[f['codigo']]}, departamento={q(f['depto'])}, updated_at=now() where id={f['id']} and empresa={q(EMPRESA)}")
        _sql(f"insert into omc_encargo_avances (empresa, encargo_id, autor, tipo, texto) values ({q(EMPRESA)}, {f['id']}, 'sistema', 'sistema', {q('frente ' + f['codigo'] + ' asignado por migración ' + FECHA_HOY + ' (' + f['motivo'] + ')')})")
    print(f'aplicado: {sum(1 for f in filas if f["motivo"] not in ("ya tenía",) and f["codigo"])} encargos con frente nuevo')


if __name__ == '__main__':
    main()
