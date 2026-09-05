#!/usr/bin/env python3
"""HQ · genera la documentación de empresa en Markdown (docs/empresa/) a partir del manual y de la base de datos de HQ.

01 y 07 se extraen de ~/dev/ONE-MAN-CORPORATION.md (fuente de verdad); 02 (equipo) se genera de omc_agentes.
Los demás ficheros de docs/empresa/ se escriben a mano. Subir a Drive: carpeta "77 Delta · Empresa" (lo hace el chief con el MCP de Drive).

  docs-empresa.py
"""
import json, os, re, sys, urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
DOCS = RAIZ / 'docs' / 'empresa'
MANUAL = Path('/Users/diego/dev/ONE-MAN-CORPORATION.md')
CONF = Path.home() / '.config' / '77delta' / 'hq.env'
NOMBRE_MODELO = {'claude-fable-5-1': 'Fable 5.1', 'opus': 'Opus 5', 'opus[1m]': 'Opus 5 (contexto 1M)', 'sonnet': 'Sonnet 5', 'haiku': 'Haiku 4.5'}


def env():
    e = {}
    for l in CONF.read_text().splitlines():
        if '=' in l and not l.startswith('#'):
            k, v = l.split('=', 1); e[k.strip()] = v.strip()
    return e


def rpc(e, fn, **p):
    req = urllib.request.Request(e['HQ_URL'].rstrip('/') + '/rest/v1/rpc/' + fn, data=json.dumps(p).encode(), method='POST',
                                 headers={'apikey': e['HQ_ANON'], 'Authorization': 'Bearer ' + e['HQ_ANON'], 'Content-Type': 'application/json'})
    return json.loads(urllib.request.urlopen(req, timeout=30).read())


def seccion(md, titulo_regex, hasta_regex):
    """Devuelve el bloque del manual entre un encabezado y el siguiente que case."""
    m = re.search(titulo_regex, md, re.M)
    if not m:
        return ''
    resto = md[m.start():]
    n = re.search(hasta_regex, resto[1:], re.M)
    return resto[: n.start() + 1] if n else resto


def equipo_md(agentes):
    niveles = {1: 'Dirección y control', 2: 'Directores de departamento', 3: 'Ejecutores'}
    out = ['# Equipo de agentes de 77 Delta', '', 'Cada agente es una sesión de Claude Code con su contrato (alma), su modelo asignado y su interruptor en HQ (`https://77delta.com/hq/`, pestaña Equipo). Por encima de todos, Diego (Owner) aprueba lo irreversible; el Chief of Staff enruta. Los avatares y nombres de persona sirven para reconocerlos rápido; el identificador técnico (`id`) es el que usan los scripts.', '']
    n = 0
    for nivel in (1, 2, 3):
        out += [f'## {niveles[nivel]}', '']
        for a in [x for x in agentes if x['nivel'] == nivel]:
            n += 1; c = a.get('contrato') or {}
            out += [f"### {n}. {c.get('persona', '')} · {c.get('rol') or a['nombre']}", '',
                    f"- **id:** `{a['id']}` · **departamento:** {a['depto']} · **nivel:** {a['nivel']}" + (f" · **reporta a:** `{a['jefe']}`" if a.get('jefe') else ''),
                    f"- **estado:** {'activo' if a['activo'] else 'por contratar (desactivado)'} · **prioridad:** {a['prioridad']}" + (' (ingresos)' if a['prioridad'] == 1 else ''),
                    f"- **modelo:** {NOMBRE_MODELO.get(c.get('modelo'), c.get('modelo', ''))} · **subagentes:** {NOMBRE_MODELO.get(c.get('subagentes'), c.get('subagentes', ''))}",
                    f"- **por qué ese modelo:** {c.get('modelo_por_que', '')}"]
            if a.get('sesiones'): out.append(f"- **sesiones Claude:** {', '.join(a['sesiones'])}")
            if a.get('rutas'): out.append(f"- **repos:** {', '.join('`' + r.replace('/Users/diego/dev/', '~/dev/') + '`' for r in a['rutas'])}")
            if c.get('job'): out.append(f"- **job:** {c['job']}")
            if c.get('forbidden'): out.append(f"- **prohibido:** {c['forbidden']}")
            out.append('')
    out += ['## Cómo se añade un agente', '', '1. Alta en HQ: `omc_agente_set` (o fila en `scripts/hq/seed-77delta.sql`) con id, nombre, departamento, nivel, jefe, sesiones, rutas y contrato.',
            '2. Carpeta o repo propio con `.claude/settings.json` (modelo y modelo de subagentes) y `.claude/hq-agente` con su id.', '3. Avatar en `public/hq/avatares/<id>.svg` (generado con DiceBear notionists, semilla = nombre de persona).',
            '4. `CLAUDE.md` del repo con el contrato de 7 campos.', '5. Regenerar este documento: `python3 scripts/hq/docs-empresa.py`.', '']
    return '\n'.join(out)


def main():
    DOCS.mkdir(parents=True, exist_ok=True)
    md = MANUAL.read_text()
    (DOCS / '01-one-man-corporation.md').write_text(md)
    e = env(); hq = rpc(e, 'omc_hq', p_token=e['HQ_OWNER_TOKEN'])
    (DOCS / '02-equipo.md').write_text(equipo_md(hq['agentes']))
    s = seccion(md, r'^## 9a\. Modelos y ventanas', r'^## ')
    (DOCS / '07-modelos-y-ventanas.md').write_text('# Modelos y ventanas del plan Max\n\n' + re.sub(r'^## 9a\. [^\n]*\n', '', s))
    print('generados:', ', '.join(sorted(p.name for p in DOCS.glob('*.md'))))


if __name__ == '__main__':
    main()
