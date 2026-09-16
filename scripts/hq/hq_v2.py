"""Subcomandos HQ v2 (fuente única en cascada). hq.py los registra con registrar() y delega con ejecutar().
Plan: docs/superpowers/plans/2026-09-16-hq-v2-plan-1-base.md"""
import json


def _enlaces(lista):
    out = []
    for x in lista or []:
        if '=' not in x:
            raise SystemExit(f'--enlace espera TITULO=URL, no "{x}"')
        t, u = x.split('=', 1)
        out.append({'titulo': t.strip(), 'url': u.strip()})
    return out


def registrar(sub, esub):
    f = sub.add_parser('frentes', help='frentes del plan (código, KPI, responsable, encargos abiertos)')
    f.add_argument('--bloque', help='letra del bloque (A..E)')
    sub.add_parser('bloques', help='bloques estratégicos con meta y director')
    fe = sub.add_parser('feed', help='actividad de encargos (avances, comentarios de Diego, cambios de estado)')
    fe.add_argument('--desde', help='fecha u hora ISO; por defecto últimas 24 h')
    # ampliaciones de encargo alta / estado (los parsers los creó hq.py)
    ea, ee = esub.choices['alta'], esub.choices['estado']
    ea.add_argument('--frente', help='código del frente (A3) o id de línea; obligatorio en altas nuevas')
    ea.add_argument('--etiqueta', action='append', default=[], help='repetible')
    ea.add_argument('--enlace', action='append', default=[], help='TITULO=URL, repetible')
    ea.add_argument('--origen', help='"Diego 16-09 15:30" o de dónde nace la petición')
    ee.add_argument('--motivo', default='', help='obligatorio al descartar')
    et = esub.add_parser('tomar', help='pasar a en_curso y recibir el contexto (frente, kit, avances, contactos, expediente)')
    et.add_argument('id', type=int); et.add_argument('--agente')
    eh = esub.add_parser('hecho', help='cerrar con fuente citada (url del kit o Google Doc)')
    eh.add_argument('id', type=int); eh.add_argument('--fuente', required=True); eh.add_argument('--entregable', default=''); eh.add_argument('--agente')
    ed = esub.add_parser('editar', help='(Diego) editar la tarjeta del tablero')
    ed.add_argument('id', type=int)
    for k in ('--texto', '--interpretacion', '--frente', '--responsable', '--proximo-hito', '--fecha-hito', '--comentario'):
        ed.add_argument(k)
    ed.add_argument('--prioridad', type=int); ed.add_argument('--orden', type=int); ed.add_argument('--etiqueta', action='append')
    k = sub.add_parser('kit', help='plantillas, oficiales, procedimientos y reglas por frente')
    ksub = k.add_subparsers(dest='sub', required=True)
    kl = ksub.add_parser('lista'); kl.add_argument('frente', nargs='?')
    ka = ksub.add_parser('alta'); ka.add_argument('--frente'); ka.add_argument('--general', action='store_true'); ka.add_argument('--tipo', required=True, choices=('plantilla', 'oficial', 'procedimiento', 'regla'))
    ka.add_argument('--nombre', required=True); ka.add_argument('--url'); ka.add_argument('--texto'); ka.add_argument('--version'); ka.add_argument('--agente')
    kv = ksub.add_parser('vigente'); kv.add_argument('id', type=int); kv.add_argument('--no', action='store_true'); kv.add_argument('--agente')


def _linea_encargo(e):
    return f"[{e.get('codigo') or '?'}] " if e.get('codigo') else ''


def ejecutar(a, c):
    rpc, E, agente_actual, engram = c['rpc'], c['E'], c['agente_actual'], c['engram']
    salida = lambda r, txt: print(json.dumps(r, ensure_ascii=False) if a.json else txt)
    if a.cmd == 'frentes':
        fs = rpc('omc_frentes_lista', p_token=E['HQ_TOKEN'], p_bloque=a.bloque)
        salida(fs, '\n'.join(f"{f['codigo']:<4} {f['linea']} · {f['kpi']} {f['valor_actual']}/{f['meta']} · {f.get('responsable') or '-'} · {f['encargos_abiertos']} abiertos" for f in fs))
        return True
    if a.cmd == 'bloques':
        bs = rpc('omc_bloques_lista', p_token=E['HQ_TOKEN'])
        salida(bs, '\n'.join(f"{b['letra']} {b['nombre']} · meta {b['meta_eur']} EUR · {b.get('director') or '-'} · {b['frentes']} frentes · {b['encargos_abiertos']} abiertos" for b in bs))
        return True
    if a.cmd == 'feed':
        args = {'p_token': E['HQ_TOKEN']}
        if a.desde: args['p_desde'] = a.desde
        fs = rpc('omc_feed', **args)
        salida(fs, '\n'.join(f"{f['fecha'][:16]} #{f['encargo_id']} {_linea_encargo(f)}{f['autor']} {f['tipo']}: {f['texto'][:100]}" for f in fs))
        return True
    if a.cmd == 'kit':
        if a.sub == 'lista':
            ks = rpc('omc_kit_lista', p_token=E['HQ_TOKEN'], p_frente=a.frente)
            salida(ks, '\n'.join(f"#{k['id']} [{k.get('codigo') or 'general'}] {k['tipo']}: {k['nombre']} v{k['version']} {k.get('url') or ''}\n    {(k.get('texto') or '')[:160]}".rstrip() for k in ks))
        elif a.sub == 'alta':
            if not a.frente and not a.general: raise SystemExit('kit alta: --frente A3 o --general')
            p = {k: v for k, v in {'frente': a.frente, 'tipo': a.tipo, 'nombre': a.nombre, 'url': a.url, 'texto': a.texto, 'version': a.version, 'agente': agente_actual(a.agente)}.items() if v is not None}
            r = rpc('omc_kit_set', p_token=E.get('HQ_OWNER_TOKEN') or E['HQ_TOKEN'], p=p)
            salida(r, f"kit #{r['id']} {r['tipo']}: {r['nombre']} v{r['version']}")
        else:
            r = rpc('omc_kit_set', p_token=E.get('HQ_OWNER_TOKEN') or E['HQ_TOKEN'], p={'id': a.id, 'vigente': not a.no, 'agente': agente_actual(a.agente)})
            salida(r, f"kit #{r['id']} vigente={r['vigente']}")
        return True
    if a.cmd != 'encargo':
        return False
    if a.sub == 'alta' and a.id is None:
        p = {k: v for k, v in {'texto': a.texto, 'interpretacion': a.interpretacion, 'frente': a.frente, 'responsable': a.responsable, 'prioridad': a.prioridad,
                               'solicitud_id': a.tarjeta, 'proximo_hito': a.proximo_hito, 'fecha_hito': a.fecha_hito, 'agente': agente_actual(a.agente),
                               'origen': a.origen, 'mensaje_id': a.mensaje}.items() if v is not None}
        if a.etiqueta: p['etiquetas'] = a.etiqueta
        if a.enlace: p['enlaces'] = _enlaces(a.enlace)
        r = rpc('omc_encargo_alta', p_token=E['HQ_TOKEN'], p=p)
        engram(f"[ENCARGO #{r['id']}] alta", f"{r['texto']} · frente {r.get('codigo')} · {r.get('agente') or 'sin responsable'} · {r['estado']}")
        salida(r, f"#{r['id']} [{r['estado']}] {_linea_encargo(r)}{r['texto'][:60]} · {r.get('agente') or 'sin responsable'}")
        return True
    if a.sub == 'tomar':
        r = rpc('omc_encargo_tomar', p_token=E['HQ_TOKEN'], p_id=a.id, p_agente=agente_actual(a.agente))
        e, fr = r['encargo'], r.get('frente') or {}
        txt = [f"#{e['id']} [{e['estado']}] {_linea_encargo(e)}{e['texto']}", f"frente: {fr.get('codigo')} {fr.get('linea')} · KPI {fr.get('kpi')} {fr.get('valor_actual')}/{fr.get('meta')} · bloque {fr.get('bloque')}"]
        txt += [f"kit · {k['tipo']}: {k['nombre']} {k.get('url') or ''}".rstrip() for k in r['kit']] or ['kit · (vacío: pide al chief la plantilla antes de producir nada)']
        txt += [f"avance {x['fecha'][:16]} {x['autor']} {x['tipo']}: {x['texto'][:100]}" for x in r['avances']]
        if r.get('expediente'): txt.append(f"expediente: #{r['expediente']['id']} {r['expediente']['nombre']} · ficha {r['expediente'].get('ficha_url') or '-'}")
        engram(f"[ENCARGO #{a.id}] tomado", agente_actual(a.agente))
        salida(r, '\n'.join(txt))
        return True
    if a.sub == 'hecho':
        r = rpc('omc_encargo_hecho', p_token=E['HQ_TOKEN'], p_id=a.id, p_fuente=a.fuente, p_entregable=a.entregable, p_agente=agente_actual(a.agente))
        engram(f"[ENCARGO #{a.id}] hecho", f"fuente {a.fuente} · entregable {a.entregable or '-'}")
        salida(r, f"#{r['id']} -> hecho · fuente {r['fuente_cierre']}")
        return True
    if a.sub == 'estado':
        r = rpc('omc_encargo_estado', p_token=E['HQ_TOKEN'], p_id=a.id, p_estado=a.valor, p_agente=agente_actual(a.agente), p_motivo=a.motivo)
        engram(f"[ENCARGO #{a.id}] estado", f"-> {a.valor}" + (f" · {a.motivo}" if a.motivo else ''))
        salida(r, f"#{r['id']} -> {r['estado']}")
        return True
    if a.sub == 'editar':
        p = {k: v for k, v in {'texto': a.texto, 'interpretacion': a.interpretacion, 'frente': a.frente, 'responsable': a.responsable, 'proximo_hito': a.proximo_hito,
                               'fecha_hito': a.fecha_hito, 'comentario': a.comentario, 'prioridad': a.prioridad, 'orden_kanban': a.orden, 'etiquetas': a.etiqueta}.items() if v is not None}
        r = rpc('omc_encargo_editar', p_token=E.get('HQ_OWNER_TOKEN') or E['HQ_TOKEN'], p_id=a.id, p=p)
        salida(r, f"#{r['id']} editado · {_linea_encargo(r)}{r['texto'][:60]}")
        return True
    return False
