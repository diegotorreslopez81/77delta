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
    ef = esub.add_parser('ficha', help='ver el contexto de un encargo sin tomarlo (frente, kit, avances, contactos, expediente)')
    ef.add_argument('id', type=int)
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
    c = sub.add_parser('contacto', help='registro de contactos y envíos a terceros (una fila por toque)')
    csub = c.add_subparsers(dest='sub', required=True)
    ca = csub.add_parser('alta'); ca.add_argument('--encargo', type=int, required=True); ca.add_argument('--persona'); ca.add_argument('--email'); ca.add_argument('--organizacion')
    ca.add_argument('--canal', required=True, choices=('correo', 'linkedin', 'formulario', 'telefono', 'plataforma')); ca.add_argument('--motivo', required=True)
    ca.add_argument('--proximo-toque', dest='proximo_toque'); ca.add_argument('--tarjeta', type=int); ca.add_argument('--agente')
    ce = csub.add_parser('estado'); ce.add_argument('id', type=int); ce.add_argument('valor', choices=('enviado', 'respondido', 'reunion', 'cerrado', 'sin_respuesta')); ce.add_argument('--ref'); ce.add_argument('--proximo-toque', dest='proximo_toque')
    cl = csub.add_parser('lista'); cl.add_argument('--encargo', type=int); cl.add_argument('--frente'); cl.add_argument('--estado'); cl.add_argument('--agente'); cl.add_argument('--pendientes', action='store_true')
    cf = csub.add_parser('ficha'); cf.add_argument('id', type=int)
    cr = csub.add_parser('respondido'); cr.add_argument('--email', required=True); cr.add_argument('--ref', required=True)
    # v3 T6 (encargo #1053): interacciones por canal con clientes y colaboradores; Gmail y LinkedIn son canal, HQ es la fuente.
    ix = sub.add_parser('interaccion', help='interacciones por canal (correo, linkedin, llamada, reunion, whatsapp, plataforma, formulario) enlazadas al cliente')
    ixsub = ix.add_subparsers(dest='sub', required=True)
    ixa = ixsub.add_parser('alta'); ixa.add_argument('--canal', required=True, choices=('correo', 'linkedin', 'llamada', 'reunion', 'whatsapp', 'plataforma', 'formulario'))
    ixa.add_argument('--sentido', default='entrada', choices=('entrada', 'salida')); ixa.add_argument('--ref', help='Message-ID, URL o id externo: hace la alta idempotente')
    ixa.add_argument('--email', help='correo del tercero: enlaza al cliente por persona conocida o por dominio de su web'); ixa.add_argument('--asunto'); ixa.add_argument('--resumen'); ixa.add_argument('--fecha')
    ixa.add_argument('--cliente', type=int); ixa.add_argument('--expediente', type=int); ixa.add_argument('--colaborador', type=int); ixa.add_argument('--contacto', type=int)
    ixa.add_argument('--encargo', type=int, help='encargo ligado: al atender la interacción el encargo se cierra solo, y al cerrar el encargo la interacción queda atendida')
    ixa.add_argument('--pendiente', action='store_true', help='queda pendiente de atender (aparece en HQ hasta interaccion atendida)'); ixa.add_argument('--agente')
    ixt = ixsub.add_parser('atendida'); ixt.add_argument('id', type=int, nargs='?'); ixt.add_argument('--ref'); ixt.add_argument('--canal', default='correo'); ixt.add_argument('--motivo'); ixt.add_argument('--agente')
    ixl = ixsub.add_parser('lista'); ixl.add_argument('--cliente', type=int); ixl.add_argument('--expediente', type=int); ixl.add_argument('--canal'); ixl.add_argument('--pendientes', action='store_true'); ixl.add_argument('--desde'); ixl.add_argument('--limite', type=int)
    cl = sub.add_parser('cliente', help='alta idempotente de cliente en el CRM (por NIF o nombre): sin DNI, móvil personal ni IBAN')
    clsub = cl.add_subparsers(dest='sub', required=True)
    cla = clsub.add_parser('alta'); cla.add_argument('--nombre', required=True); cla.add_argument('--corto', dest='nombre_corto'); cla.add_argument('--nif')
    cla.add_argument('--tipo', choices=('empresa', 'administracion', 'autonomo', 'entidad')); cla.add_argument('--sector'); cla.add_argument('--cnae'); cla.add_argument('--web'); cla.add_argument('--localidad')
    cla.add_argument('--carpeta', dest='carpeta_url'); cla.add_argument('--ficha', dest='ficha_url'); cla.add_argument('--estado', choices=('prospecto', 'activo', 'inactivo', 'perdido'))
    cla.add_argument('--forzar-estado', dest='forzar_estado', action='store_true', help='si ya existe, cambia el estado (por defecto solo rellena huecos)')
    cla.add_argument('--origen'); cla.add_argument('--responsable'); cla.add_argument('--notas')
    pe = sub.add_parser('persona', help='alta idempotente de persona de contacto de un cliente (por email o nombre dentro del cliente)')
    pesub = pe.add_subparsers(dest='sub', required=True)
    pea = pesub.add_parser('alta'); pea.add_argument('--nombre', required=True); pea.add_argument('--cliente', help='id o nombre del cliente; si falta, se deduce del dominio del email')
    pea.add_argument('--email'); pea.add_argument('--cargo'); pea.add_argument('--telefono', help='solo teléfono de empresa, nunca móvil personal'); pea.add_argument('--linkedin', dest='linkedin_url')
    pea.add_argument('--idioma'); pea.add_argument('--principal', action='store_true'); pea.add_argument('--notas')
    co = sub.add_parser('colaborador', help='alta idempotente de colaborador externo (por email o nombre): sin DNI, móvil personal ni IBAN')
    cosub = co.add_subparsers(dest='sub', required=True)
    coa = cosub.add_parser('alta'); coa.add_argument('--nombre', required=True); coa.add_argument('--perfil'); coa.add_argument('--especialidad', action='append', default=[], help='repetible')
    coa.add_argument('--email'); coa.add_argument('--linkedin', dest='linkedin_url'); coa.add_argument('--foto', dest='foto_url'); coa.add_argument('--cv', dest='cv_url'); coa.add_argument('--carpeta', dest='carpeta_url')
    coa.add_argument('--tarifa-dia', dest='tarifa_dia', type=float); coa.add_argument('--disponibilidad'); coa.add_argument('--ubicacion'); coa.add_argument('--idioma', action='append', default=[], help='repetible')
    coa.add_argument('--origen', choices=('red', 'referido', 'linkedin', 'upwork', 'cliente', 'otro')); coa.add_argument('--estado', choices=('candidato', 'contactado', 'activo', 'inactivo'))
    coa.add_argument('--forzar-estado', dest='forzar_estado', action='store_true'); coa.add_argument('--acuerdo-fecha', dest='acuerdo_fecha'); coa.add_argument('--acuerdo', dest='acuerdo_url'); coa.add_argument('--notas')
    x = sub.add_parser('expediente', help='clientes, productos, convocatorias y licitaciones con su ficha, encargos, contactos y sesiones')
    xsub = x.add_subparsers(dest='sub', required=True)
    xa = xsub.add_parser('alta'); xa.add_argument('--id', type=int); xa.add_argument('--nombre'); xa.add_argument('--tipo', choices=('cliente', 'producto', 'convocatoria', 'licitacion')); xa.add_argument('--frente')
    xa.add_argument('--responsable'); xa.add_argument('--ficha'); xa.add_argument('--carpeta'); xa.add_argument('--estado-funnel', dest='estado_funnel'); xa.add_argument('--importe', type=float); xa.add_argument('--agente')
    xl = xsub.add_parser('lista'); xl.add_argument('--tipo'); xl.add_argument('--frente'); xl.add_argument('--responsable')
    xf = xsub.add_parser('ficha'); xf.add_argument('id', type=int)
    xe = xsub.add_parser('entregable'); xe.add_argument('id', type=int); xe.add_argument('--nombre', required=True); xe.add_argument('--fecha', required=True); xe.add_argument('--agente')
    s = sub.add_parser('sesion', help='sesión de trabajo sobre un expediente (abrir carga el contexto; cerrar exige avances)')
    ssub = s.add_subparsers(dest='sub', required=True)
    sa = ssub.add_parser('abrir'); sa.add_argument('--expediente', type=int, required=True); sa.add_argument('--agente')
    sc = ssub.add_parser('cerrar'); sc.add_argument('id', type=int); sc.add_argument('--resumen', required=True); sc.add_argument('--entregable', action='append', default=[]); sc.add_argument('--agente')
    ss = ssub.add_parser('solicitar'); ss.add_argument('--expediente', type=int, required=True)
    g = sub.add_parser('agente', help='fichas de agentes: lista, ficha, frentes, avatar, sesion-url, alta')
    gsub = g.add_subparsers(dest='sub', required=True)
    gsub.add_parser('lista')
    gf = gsub.add_parser('ficha'); gf.add_argument('id')
    gr = gsub.add_parser('frentes'); gr.add_argument('id'); gr.add_argument('codigos', nargs='+')
    gv = gsub.add_parser('avatar'); gv.add_argument('id')
    gu = gsub.add_parser('sesion-url'); gu.add_argument('id'); gu.add_argument('url'); gu.add_argument('--cuenta', choices=('diego', 'team'))
    ga = gsub.add_parser('alta'); ga.add_argument('--frentes', nargs='*', default=[])
    # 'agente alta' es alias de 'alta-agente' (hq.py ya la registró antes de llamar a registrar(), ver
    # comentario en hq.py junto a la llamada): se copian sus argumentos para no duplicarlos aquí.
    for act in sub.choices['alta-agente']._actions:
        if act.option_strings and act.dest not in ('help',):
            ga._add_action(act)


def ejecutar_frentes(agente_id, frentes, c):
    """Aplica --frentes tras un 'agente alta' (hq.py la llama después de crear el puesto)."""
    rpc, E = c['rpc'], c['E']
    tok = E.get('HQ_OWNER_TOKEN') or E['HQ_TOKEN']
    r = rpc('omc_agente_frentes_set', p_token=tok, p_agente=agente_id, p_frentes=frentes)
    print(f"frentes de {r['id']}: {r['frentes']}")
    return r


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
    if a.cmd == 'contacto':
        if a.sub == 'alta':
            p = {k: v for k, v in {'encargo': a.encargo, 'persona': a.persona, 'email': a.email, 'organizacion': a.organizacion, 'canal': a.canal, 'motivo': a.motivo,
                                   'proximo_toque': a.proximo_toque, 'solicitud_id': a.tarjeta, 'agente': agente_actual(a.agente)}.items() if v is not None}
            r = rpc('omc_contacto_alta', p_token=E['HQ_TOKEN'], p=p)
            salida(r, f"contacto #{r['id']} [{r['estado']}] {r.get('persona') or r.get('organizacion')} · {r['canal']} · toque {r['toque']} · encargo #{r['encargo_id']}")
        elif a.sub == 'estado':
            args = {'p_token': E['HQ_TOKEN'], 'p_id': a.id, 'p_estado': a.valor}
            if a.ref: args['p_ref'] = a.ref
            if a.proximo_toque: args['p_proximo'] = a.proximo_toque
            r = rpc('omc_contacto_estado', **args)
            salida(r, f"contacto #{r['id']} -> {r['estado']} · próximo toque {r.get('proximo_toque') or '-'}")
        elif a.sub == 'lista':
            f = {k: v for k, v in {'encargo': a.encargo, 'frente': a.frente, 'estado': a.estado, 'agente': a.agente, 'pendientes': a.pendientes or None}.items() if v is not None}
            cs = rpc('omc_contactos_lista', p_token=E['HQ_TOKEN'], p_filtro=f)
            salida(cs, '\n'.join(f"#{c['id']} {c['fecha'][:10]} [{c['estado']}] {c.get('persona') or ''} {c.get('organizacion') or ''} · {c['canal']} t{c['toque']} · {c.get('codigo')} #{c.get('encargo_id')} · {c.get('agente')} · próximo {c.get('proximo_toque') or '-'}" for c in cs))
        elif a.sub == 'ficha':
            r = rpc('omc_contacto_ficha', p_token=E['HQ_TOKEN'], p_id=a.id)
            salida(r, json.dumps(r, ensure_ascii=False, indent=1))
        elif a.sub == 'respondido':
            r = rpc('omc_contacto_casar', p_token=E['HQ_TOKEN'], p_email=a.email, p_ref=a.ref)
            salida(r, f"casado con contacto #{r['id']} ({r.get('persona')})" if r else 'sin contacto enviado para ese email')
        return True
    if a.cmd == 'interaccion':
        if a.sub == 'alta':
            p = {k: v for k, v in {'canal': a.canal, 'sentido': a.sentido, 'ref': a.ref, 'email': a.email, 'asunto': a.asunto, 'resumen': a.resumen, 'fecha': a.fecha,
                                   'cliente_id': a.cliente, 'expediente_id': a.expediente, 'colaborador_id': a.colaborador, 'contacto_id': a.contacto,
                                   'encargo_id': a.encargo, 'pendiente': a.pendiente, 'agente': agente_actual(a.agente)}.items() if v is not None}
            r = rpc('omc_interaccion_alta', p_token=E['HQ_TOKEN'], p=p)
            salida(r, f"interacción #{r['id']} {'nueva' if r.get('nuevo') else 'ya existía'} · {r['canal']} {r['sentido']} · cliente {r.get('cliente') or '-'} · {'pendiente' if r.get('pendiente') else 'atendida'}")
        elif a.sub == 'atendida':
            if a.id is None and not a.ref: raise SystemExit('interaccion atendida: id o --ref')
            r = rpc('omc_interaccion_atender', p_token=E['HQ_TOKEN'], p_id=a.id, p_canal=a.canal, p_ref=a.ref, p_agente=agente_actual(a.agente), p_motivo=a.motivo)
            salida(r, (f"interacción #{r['id']} atendida por {r['atendido_por']}" + (f" · encargo #{r['encargo_id']} cerrado" if r.get('encargo_cerrado') else '')) if r else 'sin interacción pendiente que case')
        elif a.sub == 'lista':
            f = {k: v for k, v in {'cliente_id': a.cliente, 'expediente_id': a.expediente, 'canal': a.canal, 'pendientes': a.pendientes or None, 'desde': a.desde, 'limite': a.limite}.items() if v is not None}
            xs = rpc('omc_interacciones_lista', p_token=E['HQ_TOKEN'], p_filtro=f)
            salida(xs, '\n'.join(f"#{x['id']} {x['fecha'][:16]} {'PENDIENTE' if x['pendiente'] else 'ok'} {x['canal']} {x['sentido']} · {x.get('cliente') or '-'} · {(x.get('asunto') or '')[:70]} · {x.get('agente') or ''}" + (f" · encargo #{x['encargo_id']}" if x.get('encargo_id') else '') for x in xs) or '(sin interacciones)')
        return True
    if a.cmd in ('cliente', 'persona', 'colaborador') and a.sub == 'alta':
        if a.cmd == 'cliente':
            p = {'nombre': a.nombre, 'nombre_corto': a.nombre_corto, 'nif': a.nif, 'tipo': a.tipo, 'sector': a.sector, 'cnae': a.cnae, 'web': a.web, 'localidad': a.localidad,
                 'carpeta_url': a.carpeta_url, 'ficha_url': a.ficha_url, 'estado': a.estado, 'forzar_estado': a.forzar_estado or None, 'origen': a.origen, 'responsable': a.responsable, 'notas': a.notas}
            r = rpc('omc_cliente_alta', p_token=E['HQ_TOKEN'], p={k: v for k, v in p.items() if v is not None})
            salida(r, f"cliente #{r['id']} {'nuevo' if r.get('nuevo') else 'ya existía'} · {r['nombre']} · {r['estado']} · nif {r.get('nif') or '-'} · web {r.get('web') or '-'}")
        elif a.cmd == 'persona':
            p = {'nombre': a.nombre, 'email': a.email, 'cargo': a.cargo, 'telefono': a.telefono, 'linkedin_url': a.linkedin_url, 'idioma': a.idioma, 'principal': a.principal or None, 'notas': a.notas}
            if a.cliente: p['cliente_id' if a.cliente.isdigit() else 'cliente'] = int(a.cliente) if a.cliente.isdigit() else a.cliente
            r = rpc('omc_persona_alta', p_token=E['HQ_TOKEN'], p={k: v for k, v in p.items() if v is not None})
            salida(r, f"persona #{r['id']} {'nueva' if r.get('nuevo') else 'ya existía'} · {r['nombre']} · {r.get('cargo') or '-'} · cliente {r.get('cliente') or r['cliente_id']} · {r.get('email') or '-'}" + (' · principal' if r.get('principal') else ''))
        else:
            p = {'nombre': a.nombre, 'perfil': a.perfil, 'especialidades': a.especialidad or None, 'email': a.email, 'linkedin_url': a.linkedin_url, 'foto_url': a.foto_url, 'cv_url': a.cv_url,
                 'carpeta_url': a.carpeta_url, 'tarifa_dia': a.tarifa_dia, 'disponibilidad': a.disponibilidad, 'ubicacion': a.ubicacion, 'idiomas': a.idioma or None, 'origen': a.origen,
                 'estado': a.estado, 'forzar_estado': a.forzar_estado or None, 'acuerdo_fecha': a.acuerdo_fecha, 'acuerdo_url': a.acuerdo_url, 'notas': a.notas}
            r = rpc('omc_colaborador_alta', p_token=E['HQ_TOKEN'], p={k: v for k, v in p.items() if v is not None})
            salida(r, f"colaborador #{r['id']} {'nuevo' if r.get('nuevo') else 'ya existía'} · {r['nombre']} · {r.get('perfil') or '-'} · {r['estado']} · {', '.join(r.get('especialidades') or []) or '-'}")
        return True
    if a.cmd == 'expediente':
        tok = E.get('HQ_OWNER_TOKEN') or E['HQ_TOKEN']
        if a.sub == 'alta':
            p = {k: v for k, v in {'id': a.id, 'nombre': a.nombre, 'tipo': a.tipo, 'frente': a.frente, 'responsable': a.responsable, 'ficha_url': a.ficha, 'carpeta_url': a.carpeta,
                                   'estado_funnel': a.estado_funnel, 'importe': a.importe, 'agente': agente_actual(a.agente)}.items() if v is not None}
            r = rpc('omc_expediente_set', p_token=tok, p=p); salida(r, f"expediente #{r['id']} {r['tipo']} {r['nombre']} · {r.get('estado_funnel') or '-'} · {r.get('responsable') or '-'}")
        elif a.sub == 'entregable':
            r = rpc('omc_expediente_set', p_token=tok, p={'id': a.id, 'entregable': {'nombre': a.nombre, 'fecha': a.fecha, 'hecho': False}, 'agente': agente_actual(a.agente)})
            salida(r, f"expediente #{r['id']}: {len(r['entregables'])} entregables")
        elif a.sub == 'lista':
            f = {k: v for k, v in {'tipo': a.tipo, 'frente': a.frente, 'responsable': a.responsable}.items() if v}
            xs = rpc('omc_expedientes_lista', p_token=E['HQ_TOKEN'], p_filtro=f)
            salida(xs, '\n'.join(f"#{x['id']} {x['tipo']:<12} {x['nombre']:<32} {x.get('codigo')} · {x.get('estado_funnel') or '-'} · {x.get('responsable') or '-'} · {x['encargos_abiertos']} abiertos" + (f" · sesión abierta: {x['sesion_abierta']}" if x.get('sesion_abierta') else '') for x in xs))
        else:
            r = rpc('omc_expediente_ficha', p_token=E['HQ_TOKEN'], p_id=a.id); x = r['expediente']
            txt = [f"#{x['id']} {x['tipo']} {x['nombre']} · {x.get('estado_funnel') or '-'} · {x.get('responsable') or '-'} · ficha {x.get('ficha_url') or '-'} · carpeta {x.get('carpeta_url') or '-'}",
                   f"estado ({(x.get('resumen_fecha') or '')[:10]}): {x.get('resumen_estado') or 'sin resumen'}"]
            txt += [f"entregable {'[x]' if n.get('hecho') else '[ ]'} {n['nombre']} {n.get('fecha')}" for n in x.get('entregables') or []]
            txt += [f"encargo #{en['id']} [{en['estado']}] {en['texto'][:70]} · hito {en.get('fecha_hito') or '-'}" for en in r['encargos']]
            txt += [f"contacto #{c['id']} [{c['estado']}] {c.get('persona') or c.get('organizacion')} · {c['canal']} t{c['toque']} · {c['fecha'][:10]}" for c in r['contactos']]
            txt += [f"kit · {k['tipo']}: {k['nombre']} {k.get('url') or ''}".rstrip() for k in r['kit']]
            salida(r, '\n'.join(txt))
        return True
    if a.cmd == 'sesion':
        if a.sub == 'abrir':
            r = rpc('omc_sesion_abrir', p_token=E['HQ_TOKEN'], p_expediente=a.expediente, p_agente=agente_actual(a.agente))
            engram(f"[SESION #{r['sesion']['id']}] abierta", f"expediente #{a.expediente} {r['ficha']['expediente']['nombre']} · {agente_actual(a.agente)}")
            a.id = a.expediente; a.sub = 'ficha'; a.cmd = 'expediente'
            print(f"sesión #{r['sesion']['id']} abierta. Al terminar: hq.py sesion cerrar {r['sesion']['id']} --resumen \"...\" (exige avance en cada encargo en curso)")
            return ejecutar(a, c)
        if a.sub == 'cerrar':
            r = rpc('omc_sesion_cerrar', p_token=E['HQ_TOKEN'], p_sesion=a.id, p_resumen=a.resumen, p_entregables=[{'nombre': n} for n in a.entregable], p_agente=agente_actual(a.agente))
            engram(f"[SESION #{a.id}] cerrada", a.resumen)
            salida(r, f"sesión #{r['id']} cerrada · encargos tocados {r['encargos_tocados']}")
            return True
        r = rpc('omc_sesion_solicitar', p_token=E.get('HQ_OWNER_TOKEN') or E['HQ_TOKEN'], p_expediente=a.expediente)
        salida(r, f"sesión #{r['id']} {r['estado']} para {r['agente']}; hq-despertar la abre en su ventana en menos de un minuto")
        return True
    if a.cmd == 'agente':
        tok_owner = E.get('HQ_OWNER_TOKEN') or E['HQ_TOKEN']
        if a.sub == 'lista':
            xs = rpc('omc_agentes_lista', p_token=E['HQ_TOKEN'])
            salida(xs, '\n'.join(f"{x['id']:<14} {x['nombre']:<10} {x['depto']:<14} n{x['nivel']} {'ON ' if x['activo'] else 'OFF'} {','.join(x['frentes'] or []) or '-':<10} {x.get('cuenta') or '-':<5} {x['encargos_abiertos']} abiertos" + (f" · sesión #{x['sesion_abierta']}" if x.get('sesion_abierta') else '') for x in xs))
        elif a.sub == 'ficha':
            xs = [x for x in rpc('omc_agentes_lista', p_token=E['HQ_TOKEN']) if x['id'] == a.id or x['nombre'].lower() == a.id.lower()]
            if not xs: raise SystemExit(f'agente {a.id} no existe')
            x = xs[0]; salida(x, '\n'.join(f'{k}: {v}' for k, v in x.items()))
        elif a.sub == 'frentes':
            r = rpc('omc_agente_frentes_set', p_token=tok_owner, p_agente=a.id, p_frentes=a.codigos)
            salida(r, f"{r['id']}: frentes {r['frentes']}")
        elif a.sub == 'avatar':
            import pathlib
            import urllib.request
            # HQ_AVATARES_URL (opcional en hq.env): base donde se sirven los SVG de public/hq/avatares/;
            # por defecto el dominio de producción de 77delta, único sitio que hoy los sirve.
            base = (E.get('HQ_AVATARES_URL') or 'https://77delta.com/hq/avatares/').rstrip('/')
            destino = pathlib.Path(__file__).resolve().parents[2] / 'public' / 'hq' / 'avatares' / f'{a.id}.svg'
            url = f'{base}/{a.id}.svg'
            if destino.exists():
                # No se toca red ni disco si el SVG ya existe (revisión T12, ronda 1): un id repetido no
                # debe pisar un avatar ya commiteado. Si al agente le falta avatar_url, se deja fijada.
                print(f'{destino} ya existe, no se sobrescribe')
                xs = [x for x in rpc('omc_agentes_lista', p_token=E['HQ_TOKEN']) if x['id'] == a.id]
                if xs and not xs[0].get('avatar_url'):
                    rpc('omc_agente_avatar_set', p_token=tok_owner, p_agente=a.id, p_url=url)
                    print(f'avatar_url fijada a {url} (no tenía ninguna)')
            else:
                destino.parent.mkdir(parents=True, exist_ok=True)
                with urllib.request.urlopen(f'https://api.dicebear.com/9.x/icons/svg?seed={a.id}&backgroundColor=0b1f3a&radius=50', timeout=20) as u:
                    destino.write_bytes(u.read())
                rpc('omc_agente_avatar_set', p_token=tok_owner, p_agente=a.id, p_url=url)
                print(f'{destino} · {url} (commitea el svg)')
        elif a.sub == 'sesion-url':
            r = rpc('omc_agente_sesion_url', p_token=E['HQ_TOKEN'] if not a.cuenta else tok_owner, p_agente=a.id, p_url=a.url, p_cuenta=a.cuenta)
            salida(r, f"{r['id']}: sesion_url actualizada ({r.get('cuenta') or '-'})")
        else:  # alta: hq.py sigue con su rama alta-agente (mismos argumentos) y aplica --frentes después
            a.cmd = 'alta-agente'; a.sub = None
            return False
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
    if a.sub == 'ficha':
        r = rpc('omc_encargo_ficha', p_token=E['HQ_TOKEN'], p_id=a.id)
        e, fr = r['encargo'], r.get('frente') or {}
        txt = [f"#{e['id']} [{e['estado']}] {_linea_encargo(e)}{e['texto']}", f"frente: {fr.get('codigo')} {fr.get('linea')} · KPI {fr.get('kpi')} {fr.get('valor_actual')}/{fr.get('meta')} · bloque {fr.get('bloque')}"]
        txt += [f"kit · {k['tipo']}: {k['nombre']} {k.get('url') or ''}".rstrip() for k in r['kit']] or ['kit · (vacío: pide al chief la plantilla antes de producir nada)']
        txt += [f"avance {x['fecha'][:16]} {x['autor']} {x['tipo']}: {x['texto'][:100]}" for x in (r['avances'] or [])[:5]]
        txt += [f"contacto #{c['id']} [{c['estado']}] {c.get('persona') or c.get('organizacion')} · {c['canal']} t{c['toque']} · {c['fecha'][:10]}" for c in r['contactos']]
        if r.get('expediente'): txt.append(f"expediente: #{r['expediente']['id']} {r['expediente']['nombre']} · ficha {r['expediente'].get('ficha_url') or '-'}")
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
