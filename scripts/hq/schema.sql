-- HQ · One Man Corporation (77 Delta). Acceso solo por token vía RPC; ninguna tabla expuesta a anon.
-- Aplicar con: python3 ~/dev/cuponsIA/scripts/plataforma/pgq.py scripts/hq/schema.sql
create extension if not exists pgcrypto;

create table if not exists public.omc_empresas (
  id text primary key,
  nombre text not null,
  plan_usd numeric not null default 200,
  created_at timestamptz not null default now()
);

create table if not exists public.omc_tokens (
  token text primary key default encode(gen_random_bytes(24),'hex'),
  empresa text not null references public.omc_empresas(id) on delete cascade,
  rol text not null check (rol in ('owner','agente')),
  nombre text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.omc_agentes (
  empresa text not null references public.omc_empresas(id) on delete cascade,
  id text not null,
  nombre text not null,
  depto text not null,
  nivel int not null default 3 check (nivel between 1 and 3),
  jefe text,
  sesiones text[] not null default '{}',
  rutas text[] not null default '{}',
  activo boolean not null default true,
  prioridad int not null default 5,
  contrato jsonb not null default '{}'::jsonb,
  ultima_actividad timestamptz,
  orden int not null default 100,
  primary key (empresa, id)
);

create table if not exists public.omc_solicitudes (
  id bigserial primary key,
  empresa text not null references public.omc_empresas(id) on delete cascade,
  agente text not null,
  depto text not null default '',
  tipo text not null default 'otro' check (tipo in ('gasto','contacto','publicacion','estrategia','duda','accion','otro')),
  titulo text not null,
  detalle text not null default '',
  importe numeric,
  riesgo text not null default '',
  enlace text not null default '',
  vence timestamptz,
  prioridad int not null default 5,
  estado text not null default 'pendiente' check (estado in ('pendiente','aprobada','rechazada','respondida','ejecutada','fallida','caducada','retirada')),
  respuesta text not null default '',
  resultado text not null default '',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  done_at timestamptz,
  pospuesta_hasta timestamptz
);
alter table public.omc_solicitudes add column if not exists pospuesta_hasta timestamptz;
create index if not exists omc_solicitudes_estado on public.omc_solicitudes (empresa, estado, created_at desc);

create table if not exists public.omc_uso (
  empresa text not null references public.omc_empresas(id) on delete cascade,
  fecha date not null,
  sesion_id text not null,
  modelo text not null,
  titulo text not null default '',
  ruta text not null default '',
  maquina text not null default '',
  input bigint not null default 0,
  output bigint not null default 0,
  cache_write bigint not null default 0,
  cache_read bigint not null default 0,
  mensajes int not null default 0,
  coste_usd numeric(12,6) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (empresa, fecha, sesion_id, modelo)
);

-- Consumo real del plan Max (ventanas de 5 h y semanal) por cuenta, muestreado por hq-plan.py.
create table if not exists public.omc_plan (
  empresa text not null references public.omc_empresas(id) on delete cascade,
  cuenta text not null default 'principal',
  ts timestamptz not null,
  tipo text not null default '',
  cinco_h numeric not null default 0,
  cinco_h_reset timestamptz,
  semana numeric not null default 0,
  semana_reset timestamptz,
  semana_opus numeric,
  primary key (empresa, cuenta, ts)
);

-- Actividad reciente de cada agente (observaciones de Engram por proyecto), la sube hq-actividad.py.
create table if not exists public.omc_actividad (
  empresa text not null references public.omc_empresas(id) on delete cascade,
  agente text not null,
  obs_id bigint not null,
  ts timestamptz not null,
  proyecto text not null default '',
  tipo text not null default '',
  titulo text not null,
  primary key (empresa, obs_id)
);
create index if not exists omc_actividad_agente on public.omc_actividad (empresa, agente, ts desc);

-- KPIs de negocio (clave/valor) que suben los scripts (embudo de licitaciones desde el Sheet de Sales) o los agentes.
create table if not exists public.omc_kpis (
  empresa text not null references public.omc_empresas(id) on delete cascade,
  clave text not null,
  valor numeric,
  texto text not null default '',
  fuente text not null default '',
  updated_at timestamptz not null default now(),
  primary key (empresa, clave)
);

-- Libro de ingresos (lo lleva admin-books): concedido, contratado, facturado, cobrado.
create table if not exists public.omc_ingresos (
  id bigserial primary key,
  empresa text not null references public.omc_empresas(id) on delete cascade,
  cliente text not null,
  linea text not null default 'otro' check (linea in ('cupones','licitaciones','consultoria','producto','formacion','otro')),
  concepto text not null default '',
  importe numeric not null default 0,
  estado text not null default 'concedido' check (estado in ('propuesto','concedido','contratado','facturado','cobrado','perdido')),
  periodicidad text not null default 'unico' check (periodicidad in ('unico','mensual','anual')),
  fecha date,
  notas text not null default '',
  agente text not null default 'admin-books',
  updated_at timestamptz not null default now()
);

-- Licitaciones: espejo del Sheet de control de Sales con la decisión de Diego, sus motivos y quién decidió.
-- hq-licitaciones.py trae las filas analizadas cada 10 minutos y devuelve al Sheet las decisiones tomadas en HQ.
create table if not exists public.omc_licitaciones (
  empresa text not null references public.omc_empresas(id) on delete cascade,
  expediente text not null,
  fila int,
  pestana text not null default 'Licitaciones',
  detectada date,
  organo text not null default '',
  provincia text not null default '',
  objeto text not null default '',
  resumen text not null default '',
  resumen_corto text not null default '',
  importe numeric,
  tipo text not null default '',
  procedimiento text not null default '',
  elegible text not null default '',
  motivo_auto text not null default '',
  solvencia text not null default '',
  cierre date,
  enlace text not null default '',
  pcap text not null default '',
  ppt text not null default '',
  carpeta text not null default '',
  estado text not null default '',
  decision text not null default 'Pendiente',
  fecha_decision date,
  decidido_por text not null default '',
  motivos text[] not null default '{}',
  motivo_texto text not null default '',
  comentarios text not null default '',
  excepcion text not null default '',
  progreso numeric,
  progreso_nota text not null default '',
  sincronizado boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (empresa, expediente)
);
alter table public.omc_licitaciones add column if not exists progreso numeric;
alter table public.omc_licitaciones add column if not exists progreso_nota text not null default '';

-- Hilo de conversación de cada solicitud (Diego y el agente se cruzan mensajes hasta resolver).
create table if not exists public.omc_mensajes (
  id bigserial primary key,
  empresa text not null references public.omc_empresas(id) on delete cascade,
  solicitud_id bigint not null references public.omc_solicitudes(id) on delete cascade,
  autor text not null,
  texto text not null,
  ts timestamptz not null default now()
);
create index if not exists omc_mensajes_sol on public.omc_mensajes (solicitud_id, ts);

create table if not exists public.omc_push (
  id bigserial primary key,
  empresa text not null references public.omc_empresas(id) on delete cascade,
  endpoint text not null unique,
  sub jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.omc_empresas enable row level security;
alter table public.omc_tokens enable row level security;
alter table public.omc_agentes enable row level security;
alter table public.omc_solicitudes enable row level security;
alter table public.omc_uso enable row level security;
alter table public.omc_push enable row level security;
alter table public.omc_plan enable row level security;
alter table public.omc_actividad enable row level security;
alter table public.omc_kpis enable row level security;
alter table public.omc_ingresos enable row level security;
alter table public.omc_mensajes enable row level security;
alter table public.omc_licitaciones enable row level security;
revoke all on public.omc_empresas, public.omc_tokens, public.omc_agentes, public.omc_solicitudes, public.omc_uso, public.omc_push, public.omc_plan, public.omc_actividad, public.omc_kpis, public.omc_ingresos, public.omc_mensajes, public.omc_licitaciones from anon, authenticated;
revoke all on sequence public.omc_solicitudes_id_seq, public.omc_push_id_seq, public.omc_ingresos_id_seq, public.omc_mensajes_id_seq from anon, authenticated;

-- Helper interno: no se concede a anon.
create or replace function public.omc_tok(p_token text)
returns public.omc_tokens language plpgsql security definer set search_path = public as $$
declare t public.omc_tokens;
begin
  select * into t from public.omc_tokens where token = p_token;
  if not found then raise exception 'token no válido' using errcode = 'P0001'; end if;
  return t;
end $$;
revoke all on function public.omc_tok(text) from public;

create or replace function public.omc_token_info(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.omc_tokens;
begin
  t := public.omc_tok(p_token);
  return jsonb_build_object('empresa', t.empresa, 'rol', t.rol, 'nombre', t.nombre);
end $$;

-- Vista completa para la app (solo owner).
create or replace function public.omc_hq(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.omc_tokens; e public.omc_empresas;
begin
  t := public.omc_tok(p_token);
  if t.rol <> 'owner' then raise exception 'solo owner' using errcode = '42501'; end if;
  select * into e from public.omc_empresas where id = t.empresa;
  return jsonb_build_object(
    'empresa', jsonb_build_object('id', e.id, 'nombre', e.nombre, 'plan_usd', e.plan_usd),
    'ahora', now(),
    'agentes', (select coalesce(jsonb_agg(to_jsonb(a) order by a.nivel, a.orden, a.id), '[]'::jsonb)
                from public.omc_agentes a where a.empresa = e.id),
    'pendientes', (select coalesce(jsonb_agg(to_jsonb(s) order by s.prioridad, s.vence asc nulls last, s.created_at), '[]'::jsonb)
                   from public.omc_solicitudes s where s.empresa = e.id and s.estado = 'pendiente' and (s.pospuesta_hasta is null or s.pospuesta_hasta <= now())),
    'pospuestas', (select coalesce(jsonb_agg(to_jsonb(s) order by s.pospuesta_hasta), '[]'::jsonb)
                   from public.omc_solicitudes s where s.empresa = e.id and s.estado = 'pendiente' and s.pospuesta_hasta > now()),
    'seguimiento', (select coalesce(jsonb_agg(to_jsonb(s) order by s.resolved_at desc), '[]'::jsonb)
                    from public.omc_solicitudes s where s.empresa = e.id and s.estado in ('aprobada','respondida')),
    'historial', (select coalesce(jsonb_agg(to_jsonb(s) order by coalesce(s.done_at, s.resolved_at) desc), '[]'::jsonb)
                  from (select * from public.omc_solicitudes s where s.empresa = e.id and s.estado in ('rechazada','ejecutada','fallida','caducada','retirada')
                        order by coalesce(s.done_at, s.resolved_at) desc limit 100) s),
    'gasto_mes', (select coalesce(jsonb_agg(jsonb_build_object('depto', g.depto, 'total', g.total)), '[]'::jsonb)
                  from (select depto, sum(importe) total from public.omc_solicitudes
                        where empresa = e.id and tipo = 'gasto' and estado in ('aprobada','ejecutada')
                          and resolved_at >= date_trunc('month', now()) group by depto) g),
    'actividad', (select coalesce(jsonb_agg(jsonb_build_object('agente', y.agente, 'items', y.items)), '[]'::jsonb)
                  from (select agente, jsonb_agg(jsonb_build_object('ts', ts, 'titulo', titulo, 'tipo', tipo, 'proyecto', proyecto) order by ts desc) items
                        from (select *, row_number() over (partition by agente order by ts desc) rn from public.omc_actividad where empresa = e.id) z
                        where rn <= 6 group by agente) y),
    'kpis', (select coalesce(jsonb_object_agg(k.clave, jsonb_build_object('valor', k.valor, 'texto', k.texto, 'fuente', k.fuente, 'updated_at', k.updated_at)), '{}'::jsonb)
             from public.omc_kpis k where k.empresa = e.id),
    'licitaciones', (select coalesce(jsonb_agg(jsonb_build_object('expediente', l.expediente, 'pestana', l.pestana, 'detectada', l.detectada, 'organo', l.organo, 'provincia', l.provincia,
                        'objeto', l.objeto, 'resumen', l.resumen, 'resumen_corto', l.resumen_corto, 'importe', l.importe, 'tipo', l.tipo, 'procedimiento', l.procedimiento,
                        'elegible', l.elegible, 'motivo_auto', l.motivo_auto, 'solvencia', l.solvencia, 'cierre', l.cierre, 'enlace', l.enlace, 'pcap', l.pcap, 'ppt', l.ppt, 'carpeta', l.carpeta,
                        'estado', l.estado, 'decision', l.decision, 'fecha_decision', l.fecha_decision, 'decidido_por', l.decidido_por, 'motivos', to_jsonb(l.motivos), 'motivo_texto', l.motivo_texto,
                        'comentarios', l.comentarios, 'sincronizado', l.sincronizado, 'progreso', l.progreso, 'progreso_nota', l.progreso_nota) order by l.cierre asc nulls last, l.detectada desc), '[]'::jsonb)
                     from public.omc_licitaciones l where l.empresa = e.id and (l.pestana = 'Licitaciones' or l.updated_at > now() - interval '30 days')),
    'hilos', (select coalesce(jsonb_object_agg(h.sid, h.items), '{}'::jsonb)
              from (select m.solicitud_id sid, jsonb_agg(jsonb_build_object('id', m.id, 'autor', m.autor, 'texto', m.texto, 'ts', m.ts) order by m.ts) items
                    from public.omc_mensajes m join public.omc_solicitudes s on s.id = m.solicitud_id
                    where m.empresa = e.id and (s.estado in ('pendiente','aprobada','respondida') or s.resolved_at > now() - interval '30 days') group by m.solicitud_id) h),
    'ingresos', (select coalesce(jsonb_agg(to_jsonb(i) order by i.fecha desc nulls last, i.id desc), '[]'::jsonb) from public.omc_ingresos i where i.empresa = e.id)
  );
end $$;

-- KPIs: upsert de {clave, valor, texto, fuente}.
create or replace function public.omc_kpi_set(p_token text, p_filas jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.omc_tokens; n int := 0; f jsonb;
begin
  t := public.omc_tok(p_token);
  for f in select * from jsonb_array_elements(p_filas) loop
    insert into public.omc_kpis (empresa, clave, valor, texto, fuente, updated_at)
      values (t.empresa, f->>'clave', nullif(f->>'valor','')::numeric, coalesce(f->>'texto',''), coalesce(f->>'fuente', t.nombre), now())
      on conflict (empresa, clave) do update set valor = excluded.valor, texto = excluded.texto, fuente = excluded.fuente, updated_at = now();
    n := n + 1;
  end loop;
  return jsonb_build_object('filas', n);
end $$;

-- Libro de ingresos: crear, editar o borrar una fila (agente o owner).
create or replace function public.omc_ingreso_set(p_token text, p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.omc_tokens; i public.omc_ingresos; v_id bigint;
begin
  t := public.omc_tok(p_token);
  v_id := nullif(p->>'id','')::bigint;
  if coalesce((p->>'borrar')::boolean, false) then
    delete from public.omc_ingresos where empresa = t.empresa and id = v_id;
    return jsonb_build_object('borrado', v_id);
  end if;
  if v_id is null then
    if coalesce(p->>'cliente','') = '' then raise exception 'falta cliente'; end if;
    insert into public.omc_ingresos (empresa, cliente, linea, concepto, importe, estado, periodicidad, fecha, notas, agente)
      values (t.empresa, p->>'cliente', coalesce(nullif(p->>'linea',''),'otro'), coalesce(p->>'concepto',''), coalesce((p->>'importe')::numeric,0),
              coalesce(nullif(p->>'estado',''),'concedido'), coalesce(nullif(p->>'periodicidad',''),'unico'), nullif(p->>'fecha','')::date, coalesce(p->>'notas',''), coalesce(nullif(p->>'agente',''), 'admin-books'))
      returning * into i;
  else
    update public.omc_ingresos set cliente = coalesce(p->>'cliente', cliente), linea = coalesce(nullif(p->>'linea',''), linea), concepto = coalesce(p->>'concepto', concepto),
      importe = coalesce((p->>'importe')::numeric, importe), estado = coalesce(nullif(p->>'estado',''), estado), periodicidad = coalesce(nullif(p->>'periodicidad',''), periodicidad),
      fecha = coalesce(nullif(p->>'fecha','')::date, fecha), notas = coalesce(p->>'notas', notas), updated_at = now()
      where empresa = t.empresa and id = v_id returning * into i;
    if not found then raise exception 'ingreso no encontrado' using errcode = 'P0001'; end if;
  end if;
  return to_jsonb(i);
end $$;

create or replace function public.omc_ingresos(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.omc_tokens;
begin
  t := public.omc_tok(p_token);
  return (select coalesce(jsonb_agg(to_jsonb(i) order by i.fecha desc nulls last, i.id desc), '[]'::jsonb) from public.omc_ingresos i where i.empresa = t.empresa);
end $$;

-- Actividad de agentes (upsert por observación).
create or replace function public.omc_subir_actividad(p_token text, p_filas jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.omc_tokens; n int := 0; f jsonb;
begin
  t := public.omc_tok(p_token);
  for f in select * from jsonb_array_elements(p_filas) loop
    insert into public.omc_actividad (empresa, agente, obs_id, ts, proyecto, tipo, titulo)
      values (t.empresa, f->>'agente', (f->>'obs_id')::bigint, (f->>'ts')::timestamptz, coalesce(f->>'proyecto',''), coalesce(f->>'tipo',''), left(coalesce(f->>'titulo',''), 300))
      on conflict (empresa, obs_id) do update set agente = excluded.agente, ts = excluded.ts, tipo = excluded.tipo, titulo = excluded.titulo, proyecto = excluded.proyecto;
    n := n + 1;
  end loop;
  return jsonb_build_object('filas', n);
end $$;

-- Uso de tokens (solo owner). Cada fila de uso se atribuye a un agente por nombre de sesión o por ruta.
create or replace function public.omc_hq_uso(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.omc_tokens; r jsonb;
begin
  t := public.omc_tok(p_token);
  if t.rol <> 'owner' then raise exception 'solo owner' using errcode = '42501'; end if;
  with u as (
    select u.*, coalesce((select a.id from public.omc_agentes a
                          where a.empresa = u.empresa and ((u.titulo <> '' and u.titulo = any(a.sesiones)) or u.ruta = any(a.rutas))
                          order by (u.titulo = any(a.sesiones)) desc, a.nivel desc limit 1), '') as agente
    from public.omc_uso u where u.empresa = t.empresa and u.fecha >= current_date - 62
  ), mes as (select * from u where fecha >= date_trunc('month', current_date))
  select jsonb_build_object(
    'mes', (select jsonb_build_object('coste', coalesce(sum(coste_usd),0), 'input', coalesce(sum(input),0), 'output', coalesce(sum(output),0),
                                      'cache_write', coalesce(sum(cache_write),0), 'cache_read', coalesce(sum(cache_read),0), 'mensajes', coalesce(sum(mensajes),0)) from mes),
    'mes_anterior', (select coalesce(sum(coste_usd),0) from u where fecha >= date_trunc('month', current_date) - interval '1 month' and fecha < date_trunc('month', current_date)),
    'por_agente', (select coalesce(jsonb_agg(jsonb_build_object('agente', x.agente, 'coste', x.c, 'tokens', x.tk, 'ultimo', x.ul) order by x.c desc), '[]'::jsonb)
                   from (select agente, sum(coste_usd) c, sum(input+output+cache_write+cache_read) tk, max(fecha) ul from mes group by agente) x),
    'por_sesion', (select coalesce(jsonb_agg(jsonb_build_object('sesion_id', x.sesion_id, 'titulo', x.titulo, 'ruta', x.ruta, 'agente', x.agente, 'coste', x.c, 'ultimo', x.ul) order by x.c desc), '[]'::jsonb)
                   from (select sesion_id, max(titulo) titulo, max(ruta) ruta, max(agente) agente, sum(coste_usd) c, max(fecha) ul from mes group by sesion_id order by c desc limit 40) x),
    'dias', (select coalesce(jsonb_agg(jsonb_build_object('fecha', d.fecha, 'coste', d.c) order by d.fecha), '[]'::jsonb)
             from (select fecha, sum(coste_usd) c from u where fecha >= current_date - 30 group by fecha) d),
    'por_agente_modelo', (select coalesce(jsonb_agg(jsonb_build_object('agente', x.agente, 'modelo', x.modelo, 'coste', x.c, 'mensajes', x.m) order by x.agente, x.c desc), '[]'::jsonb)
                          from (select agente, modelo, sum(coste_usd) c, sum(mensajes) m from mes group by agente, modelo) x),
    'plan', (select coalesce(jsonb_agg(jsonb_build_object('cuenta', p.cuenta, 'tipo', p.tipo, 'ts', p.ts, 'cinco_h', p.cinco_h, 'cinco_h_reset', p.cinco_h_reset,
                                                          'semana', p.semana, 'semana_reset', p.semana_reset, 'semana_opus', p.semana_opus)), '[]'::jsonb)
             from (select distinct on (cuenta) * from public.omc_plan where empresa = t.empresa order by cuenta, ts desc) p),
    'plan_serie', (select coalesce(jsonb_agg(jsonb_build_object('cuenta', p.cuenta, 'ts', p.ts, 'cinco_h', p.cinco_h, 'semana', p.semana) order by p.ts), '[]'::jsonb)
                   from public.omc_plan p where p.empresa = t.empresa and p.ts >= now() - interval '7 days')
  ) into r;
  return r;
end $$;

-- Muestra del consumo real del plan (la sube hq-plan.py cada 15 minutos).
create or replace function public.omc_subir_plan(p_token text, p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.omc_tokens;
begin
  t := public.omc_tok(p_token);
  insert into public.omc_plan (empresa, cuenta, ts, tipo, cinco_h, cinco_h_reset, semana, semana_reset, semana_opus)
    values (t.empresa, coalesce(p->>'cuenta','principal'), (p->>'ts')::timestamptz, coalesce(p->>'tipo',''), coalesce((p->>'cinco_h')::numeric,0),
            nullif(p->>'cinco_h_reset','')::timestamptz, coalesce((p->>'semana')::numeric,0), nullif(p->>'semana_reset','')::timestamptz, nullif(p->>'semana_opus','')::numeric)
    on conflict (empresa, cuenta, ts) do update set cinco_h = excluded.cinco_h, cinco_h_reset = excluded.cinco_h_reset, semana = excluded.semana,
      semana_reset = excluded.semana_reset, semana_opus = excluded.semana_opus, tipo = excluded.tipo;
  return jsonb_build_object('ok', true);
end $$;

-- Owner resuelve una solicitud: aprobada | rechazada | respondida | pendiente (deshacer) | caducada.
create or replace function public.omc_resolver(p_token text, p_id bigint, p_estado text, p_respuesta text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.omc_tokens; s public.omc_solicitudes;
begin
  t := public.omc_tok(p_token);
  if t.rol <> 'owner' then raise exception 'solo owner' using errcode = '42501'; end if;
  if p_estado not in ('aprobada','rechazada','respondida','pendiente','caducada') then raise exception 'estado no válido'; end if;
  update public.omc_solicitudes set estado = p_estado, respuesta = coalesce(p_respuesta, ''),
    resolved_at = case when p_estado = 'pendiente' then null else now() end
    where id = p_id and empresa = t.empresa returning * into s;
  if not found then raise exception 'solicitud no encontrada' using errcode = 'P0002'; end if;
  return to_jsonb(s);
end $$;

-- Owner pospone una solicitud pendiente hasta una fecha (vuelve sola a la bandeja y avisa por push). null = traer ahora.
create or replace function public.omc_posponer(p_token text, p_id bigint, p_hasta timestamptz)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.omc_tokens; s public.omc_solicitudes;
begin
  t := public.omc_tok(p_token);
  if t.rol <> 'owner' then raise exception 'solo owner' using errcode = '42501'; end if;
  update public.omc_solicitudes set pospuesta_hasta = p_hasta where id = p_id and empresa = t.empresa and estado = 'pendiente' returning * into s;
  if not found then raise exception 'solicitud no encontrada o ya resuelta' using errcode = 'P0001'; end if;
  return to_jsonb(s);
end $$;

-- Pospuestas que ya han vencido: las devuelve (y limpia la marca) para que el recordatorio avise una sola vez.
create or replace function public.omc_pospuestas_vencidas(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.omc_tokens; r jsonb;
begin
  t := public.omc_tok(p_token);
  with v as (update public.omc_solicitudes set pospuesta_hasta = null where empresa = t.empresa and estado = 'pendiente' and pospuesta_hasta is not null and pospuesta_hasta <= now() returning id, titulo, agente)
  select coalesce(jsonb_agg(to_jsonb(v)), '[]'::jsonb) into r from v;
  return r;
end $$;

-- Owner edita o crea un agente (activo, contrato, rutas...).
create or replace function public.omc_agente_set(p_token text, p_id text, p_patch jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.omc_tokens; a public.omc_agentes;
begin
  t := public.omc_tok(p_token);
  if t.rol <> 'owner' then raise exception 'solo owner' using errcode = '42501'; end if;
  insert into public.omc_agentes (empresa, id, nombre, depto)
    values (t.empresa, p_id, coalesce(p_patch->>'nombre', p_id), coalesce(p_patch->>'depto', ''))
    on conflict (empresa, id) do nothing;
  update public.omc_agentes set
    nombre = coalesce(p_patch->>'nombre', nombre),
    depto = coalesce(p_patch->>'depto', depto),
    nivel = coalesce((p_patch->>'nivel')::int, nivel),
    jefe = case when p_patch ? 'jefe' then p_patch->>'jefe' else jefe end,
    sesiones = case when p_patch ? 'sesiones' then (select coalesce(array_agg(x), '{}') from jsonb_array_elements_text(p_patch->'sesiones') x) else sesiones end,
    rutas = case when p_patch ? 'rutas' then (select coalesce(array_agg(x), '{}') from jsonb_array_elements_text(p_patch->'rutas') x) else rutas end,
    activo = coalesce((p_patch->>'activo')::boolean, activo),
    prioridad = coalesce((p_patch->>'prioridad')::int, prioridad),
    contrato = case when p_patch ? 'contrato' then contrato || (p_patch->'contrato') else contrato end,
    ultima_actividad = greatest(ultima_actividad, nullif(p_patch->>'ultima_actividad','')::timestamptz),
    orden = coalesce((p_patch->>'orden')::int, orden)
    where empresa = t.empresa and id = p_id returning * into a;
  return to_jsonb(a);
end $$;

-- Un agente pide algo (aprobación, duda, acción humana).
create or replace function public.omc_pedir(p_token text, p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.omc_tokens; a public.omc_agentes; s public.omc_solicitudes; v_agente text; v_depto text; v_prio int;
begin
  t := public.omc_tok(p_token);
  v_agente := coalesce(nullif(p->>'agente',''), t.nombre);
  if v_agente is null or v_agente = '' then raise exception 'falta agente'; end if;
  if coalesce(p->>'titulo','') = '' then raise exception 'falta titulo'; end if;
  select * into a from public.omc_agentes where empresa = t.empresa and id = v_agente;
  v_depto := coalesce(nullif(p->>'depto',''), a.depto, '');
  v_prio := coalesce((p->>'prioridad')::int, a.prioridad, 5);
  insert into public.omc_solicitudes (empresa, agente, depto, tipo, titulo, detalle, importe, riesgo, enlace, vence, prioridad)
    values (t.empresa, v_agente, v_depto, coalesce(nullif(p->>'tipo',''), 'otro'), p->>'titulo', coalesce(p->>'detalle',''),
            nullif(p->>'importe','')::numeric, coalesce(p->>'riesgo',''), coalesce(p->>'enlace',''), nullif(p->>'vence','')::timestamptz, v_prio)
    returning * into s;
  update public.omc_agentes set ultima_actividad = now() where empresa = t.empresa and id = v_agente;
  return to_jsonb(s);
end $$;

create or replace function public.omc_estado(p_token text, p_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.omc_tokens; s public.omc_solicitudes;
begin
  t := public.omc_tok(p_token);
  select * into s from public.omc_solicitudes where id = p_id and empresa = t.empresa;
  if not found then raise exception 'solicitud no encontrada' using errcode = 'P0002'; end if;
  return to_jsonb(s) || jsonb_build_object('hilo', (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'autor', m.autor, 'texto', m.texto, 'ts', m.ts) order by m.ts), '[]'::jsonb)
                                                     from public.omc_mensajes m where m.solicitud_id = s.id));
end $$;

-- Comentar en el hilo de una solicitud sin resolverla. Diego (owner) firma como 'diego'; el agente firma con el id de la solicitud.
create or replace function public.omc_comentar(p_token text, p_id bigint, p_texto text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.omc_tokens; s public.omc_solicitudes; m public.omc_mensajes;
begin
  t := public.omc_tok(p_token);
  select * into s from public.omc_solicitudes where id = p_id and empresa = t.empresa;
  if not found then raise exception 'solicitud no encontrada' using errcode = 'P0001'; end if;
  if coalesce(trim(p_texto), '') = '' then raise exception 'texto vacío' using errcode = 'P0001'; end if;
  insert into public.omc_mensajes (empresa, solicitud_id, autor, texto) values (t.empresa, s.id, case when t.rol = 'owner' then 'diego' else s.agente end, trim(p_texto)) returning * into m;
  if t.rol <> 'owner' then update public.omc_agentes set ultima_actividad = now() where empresa = t.empresa and id = s.agente; end if;
  return to_jsonb(m);
end $$;

-- El agente cierra el bucle: ejecutada o fallida.
create or replace function public.omc_reportar(p_token text, p_id bigint, p_ok boolean, p_nota text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.omc_tokens; s public.omc_solicitudes;
begin
  t := public.omc_tok(p_token);
  update public.omc_solicitudes set estado = case when p_ok then 'ejecutada' else 'fallida' end,
    resultado = coalesce(p_nota, ''), done_at = now()
    where id = p_id and empresa = t.empresa and estado in ('aprobada','respondida','pendiente') returning * into s;
  if not found then raise exception 'solicitud no encontrada o ya cerrada' using errcode = 'P0002'; end if;
  update public.omc_agentes set ultima_actividad = now() where empresa = t.empresa and id = s.agente;
  return to_jsonb(s);
end $$;

-- El agente retira su propia solicitud (cuando el hilo cambia el plan). Solo si sigue pendiente.
create or replace function public.omc_retirar(p_token text, p_id bigint, p_nota text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.omc_tokens; s public.omc_solicitudes;
begin
  t := public.omc_tok(p_token);
  update public.omc_solicitudes set estado = 'retirada', resultado = coalesce(p_nota, ''), resolved_at = now(), done_at = now()
    where id = p_id and empresa = t.empresa and estado = 'pendiente' returning * into s;
  if not found then raise exception 'solicitud no encontrada o ya resuelta' using errcode = 'P0001'; end if;
  return to_jsonb(s);
end $$;

-- Licitaciones: carga desde el Sheet. La decisión del Sheet manda salvo que HQ tenga una decisión aún no devuelta (sincronizado = false).
create or replace function public.omc_licitaciones_subir(p_token text, p_filas jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.omc_tokens; f jsonb; n int := 0;
begin
  t := public.omc_tok(p_token);
  for f in select * from jsonb_array_elements(p_filas) loop
    insert into public.omc_licitaciones (empresa, expediente, fila, pestana, detectada, organo, provincia, objeto, resumen, resumen_corto, importe, tipo, procedimiento, elegible, motivo_auto, solvencia,
                                         cierre, enlace, pcap, ppt, carpeta, estado, decision, fecha_decision, decidido_por, comentarios, excepcion, progreso, progreso_nota, updated_at)
      values (t.empresa, f->>'expediente', nullif(f->>'fila','')::int, coalesce(f->>'pestana','Licitaciones'), nullif(f->>'detectada','')::date, coalesce(f->>'organo',''), coalesce(f->>'provincia',''),
              coalesce(f->>'objeto',''), coalesce(f->>'resumen',''), coalesce(f->>'resumen_corto',''), nullif(f->>'importe','')::numeric, coalesce(f->>'tipo',''), coalesce(f->>'procedimiento',''),
              coalesce(f->>'elegible',''), coalesce(f->>'motivo_auto',''), coalesce(f->>'solvencia',''), nullif(f->>'cierre','')::date, coalesce(f->>'enlace',''), coalesce(f->>'pcap',''), coalesce(f->>'ppt',''),
              coalesce(f->>'carpeta',''), coalesce(f->>'estado',''), coalesce(nullif(f->>'decision',''),'Pendiente'), nullif(f->>'fecha_decision','')::date,
              case when coalesce(f->>'decision','') in ('OK','No') then 'sales' else '' end, coalesce(f->>'comentarios',''), coalesce(f->>'excepcion',''), nullif(f->>'progreso','')::numeric, coalesce(f->>'progreso_nota',''), now())
      on conflict (empresa, expediente) do update set
        fila = excluded.fila, pestana = excluded.pestana, detectada = excluded.detectada, organo = excluded.organo, provincia = excluded.provincia, objeto = excluded.objeto,
        resumen = excluded.resumen, resumen_corto = excluded.resumen_corto, importe = excluded.importe, tipo = excluded.tipo, procedimiento = excluded.procedimiento, elegible = excluded.elegible,
        motivo_auto = excluded.motivo_auto, solvencia = excluded.solvencia, cierre = excluded.cierre, enlace = excluded.enlace, pcap = excluded.pcap, ppt = excluded.ppt, carpeta = excluded.carpeta,
        comentarios = excluded.comentarios, excepcion = excluded.excepcion, progreso = excluded.progreso, progreso_nota = excluded.progreso_nota, updated_at = now(),
        estado = case when public.omc_licitaciones.sincronizado then excluded.estado else public.omc_licitaciones.estado end,
        decision = case when public.omc_licitaciones.sincronizado then excluded.decision else public.omc_licitaciones.decision end,
        fecha_decision = case when public.omc_licitaciones.sincronizado then excluded.fecha_decision else public.omc_licitaciones.fecha_decision end,
        decidido_por = case when public.omc_licitaciones.sincronizado
                            then (case when excluded.decision in ('OK','No') then coalesce(nullif(public.omc_licitaciones.decidido_por,''), 'sales') else '' end)
                            else public.omc_licitaciones.decidido_por end;
    n := n + 1;
  end loop;
  return jsonb_build_object('filas', n);
end $$;

-- Diego decide una licitación desde HQ: OK o No con motivos (o Pendiente para deshacer). Vuelve al Sheet con hq-licitaciones.py.
create or replace function public.omc_licitacion_decidir(p_token text, p_expediente text, p_decision text, p_motivos jsonb default '[]'::jsonb, p_texto text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.omc_tokens; l public.omc_licitaciones;
begin
  t := public.omc_tok(p_token);
  if t.rol <> 'owner' then raise exception 'solo owner' using errcode = '42501'; end if;
  if p_decision not in ('OK','No','Pendiente') then raise exception 'decisión no válida' using errcode = 'P0001'; end if;
  update public.omc_licitaciones set decision = p_decision, fecha_decision = case when p_decision = 'Pendiente' then null else current_date end,
    decidido_por = case when p_decision = 'Pendiente' then '' else 'diego' end,
    motivos = coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p_motivos, '[]'::jsonb)) x), '{}'),
    motivo_texto = coalesce(p_texto, ''),
    estado = case when p_decision = 'OK' then 'Aprobada' when p_decision = 'No' then 'Descartada' else 'Analizada' end,
    sincronizado = false, updated_at = now()
    where empresa = t.empresa and expediente = p_expediente returning * into l;
  if not found then raise exception 'licitación no encontrada' using errcode = 'P0001'; end if;
  return to_jsonb(l);
end $$;

create or replace function public.omc_licitaciones_pendientes_sync(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.omc_tokens;
begin
  t := public.omc_tok(p_token);
  return (select coalesce(jsonb_agg(jsonb_build_object('expediente', expediente, 'decision', decision, 'fecha_decision', fecha_decision, 'estado', estado, 'motivos', to_jsonb(motivos), 'motivo_texto', motivo_texto)), '[]'::jsonb)
          from public.omc_licitaciones where empresa = t.empresa and not sincronizado);
end $$;

create or replace function public.omc_licitaciones_sincronizadas(p_token text, p_expedientes jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.omc_tokens; n int;
begin
  t := public.omc_tok(p_token);
  update public.omc_licitaciones set sincronizado = true where empresa = t.empresa and expediente in (select jsonb_array_elements_text(p_expedientes));
  get diagnostics n = row_count;
  return jsonb_build_object('filas', n);
end $$;

-- Lista para la CLI (Sales lee las decisiones y los motivos de Diego para aprender).
create or replace function public.omc_licitaciones_lista(p_token text, p_todas boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.omc_tokens;
begin
  t := public.omc_tok(p_token);
  return (select coalesce(jsonb_agg(jsonb_build_object('expediente', expediente, 'organo', organo, 'importe', importe, 'cierre', cierre, 'tipo', tipo, 'procedimiento', procedimiento, 'elegible', elegible,
                                                       'estado', estado, 'decision', decision, 'fecha_decision', fecha_decision, 'decidido_por', decidido_por, 'motivos', to_jsonb(motivos), 'motivo_texto', motivo_texto, 'sincronizado', sincronizado)
                                    order by cierre asc nulls last), '[]'::jsonb)
          from public.omc_licitaciones where empresa = t.empresa and (p_todas or pestana = 'Licitaciones'));
end $$;

-- Eventos de Diego desde una fecha (comentarios y resoluciones) para despertar a los agentes.
create or replace function public.omc_eventos(p_token text, p_desde timestamptz)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.omc_tokens;
begin
  t := public.omc_tok(p_token);
  return (select coalesce(jsonb_agg(x order by x->>'ts'), '[]'::jsonb) from (
    select jsonb_build_object('tipo', 'comentario', 'ts', m.ts, 'id', s.id, 'agente', s.agente, 'titulo', s.titulo, 'texto', m.texto, 'estado', s.estado)
      from public.omc_mensajes m join public.omc_solicitudes s on s.id = m.solicitud_id where m.empresa = t.empresa and m.autor = 'diego' and m.ts > p_desde
    union all
    select jsonb_build_object('tipo', 'resolucion', 'ts', s.resolved_at, 'id', s.id, 'agente', s.agente, 'titulo', s.titulo, 'texto', s.respuesta, 'estado', s.estado)
      from public.omc_solicitudes s where s.empresa = t.empresa and s.resolved_at > p_desde and s.estado in ('aprobada','rechazada','respondida') and s.done_at is null
  ) e(x));
end $$;

-- Latido: el agente pregunta si está activo (hook de arranque) y deja constancia de actividad.
create or replace function public.omc_latido(p_token text, p_agente text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.omc_tokens; a public.omc_agentes;
begin
  t := public.omc_tok(p_token);
  select * into a from public.omc_agentes where empresa = t.empresa and (id = p_agente or p_agente = any(sesiones)) order by (id = p_agente) desc limit 1;
  if not found then return jsonb_build_object('existe', false, 'activo', true, 'agente', p_agente); end if;
  update public.omc_agentes set ultima_actividad = now() where empresa = t.empresa and id = a.id;
  return jsonb_build_object('existe', true, 'activo', a.activo, 'agente', a.id, 'nombre', a.nombre, 'depto', a.depto, 'nivel', a.nivel,
                            'modelo', a.contrato->>'modelo', 'subagentes', a.contrato->>'subagentes',
                            'pendientes', (select count(*) from public.omc_solicitudes s where s.empresa = t.empresa and s.agente = a.id and s.estado in ('aprobada','respondida')),
                            'comentarios', (select coalesce(jsonb_agg(distinct s.id), '[]'::jsonb) from public.omc_mensajes m join public.omc_solicitudes s on s.id = m.solicitud_id
                                            where s.empresa = t.empresa and s.agente = a.id and s.estado = 'pendiente' and m.autor = 'diego'
                                              and m.ts > coalesce((select max(m2.ts) from public.omc_mensajes m2 where m2.solicitud_id = s.id and m2.autor <> 'diego'), s.created_at)));
end $$;

create or replace function public.omc_mis_solicitudes(p_token text, p_agente text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.omc_tokens;
begin
  t := public.omc_tok(p_token);
  return (select coalesce(jsonb_agg(to_jsonb(s) order by s.created_at desc), '[]'::jsonb) from public.omc_solicitudes s
          where s.empresa = t.empresa and s.agente = p_agente and s.estado in ('pendiente','aprobada','respondida'));
end $$;

-- Carga de uso de tokens (upsert por sesión, día y modelo).
create or replace function public.omc_subir_uso(p_token text, p_filas jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.omc_tokens; n int := 0; f jsonb;
begin
  t := public.omc_tok(p_token);
  for f in select * from jsonb_array_elements(p_filas) loop
    insert into public.omc_uso (empresa, fecha, sesion_id, modelo, titulo, ruta, maquina, input, output, cache_write, cache_read, mensajes, coste_usd, updated_at)
      values (t.empresa, (f->>'fecha')::date, f->>'sesion_id', f->>'modelo', coalesce(f->>'titulo',''), coalesce(f->>'ruta',''), coalesce(f->>'maquina',''),
              coalesce((f->>'input')::bigint,0), coalesce((f->>'output')::bigint,0), coalesce((f->>'cache_write')::bigint,0), coalesce((f->>'cache_read')::bigint,0),
              coalesce((f->>'mensajes')::int,0), coalesce((f->>'coste_usd')::numeric,0), now())
      on conflict (empresa, fecha, sesion_id, modelo) do update set
        titulo = case when excluded.titulo <> '' then excluded.titulo else public.omc_uso.titulo end,
        ruta = excluded.ruta, maquina = excluded.maquina, input = excluded.input, output = excluded.output,
        cache_write = excluded.cache_write, cache_read = excluded.cache_read, mensajes = excluded.mensajes, coste_usd = excluded.coste_usd, updated_at = now();
    n := n + 1;
  end loop;
  return jsonb_build_object('filas', n);
end $$;

create or replace function public.omc_guardar_push(p_token text, p_sub jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.omc_tokens;
begin
  t := public.omc_tok(p_token);
  if t.rol <> 'owner' then raise exception 'solo owner' using errcode = '42501'; end if;
  insert into public.omc_push (empresa, endpoint, sub) values (t.empresa, p_sub->>'endpoint', p_sub)
    on conflict (endpoint) do update set sub = excluded.sub, empresa = excluded.empresa;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.omc_token_info(text), public.omc_hq(text), public.omc_hq_uso(text), public.omc_resolver(text, bigint, text, text),
  public.omc_agente_set(text, text, jsonb), public.omc_pedir(text, jsonb), public.omc_estado(text, bigint), public.omc_reportar(text, bigint, boolean, text),
  public.omc_latido(text, text), public.omc_mis_solicitudes(text, text), public.omc_subir_uso(text, jsonb), public.omc_guardar_push(text, jsonb), public.omc_subir_plan(text, jsonb), public.omc_subir_actividad(text, jsonb),
  public.omc_kpi_set(text, jsonb), public.omc_ingreso_set(text, jsonb), public.omc_ingresos(text), public.omc_comentar(text, bigint, text), public.omc_retirar(text, bigint, text),
  public.omc_licitaciones_subir(text, jsonb), public.omc_licitacion_decidir(text, text, text, jsonb, text), public.omc_licitaciones_pendientes_sync(text), public.omc_licitaciones_sincronizadas(text, jsonb), public.omc_licitaciones_lista(text, boolean), public.omc_posponer(text, bigint, timestamptz), public.omc_pospuestas_vencidas(text), public.omc_eventos(text, timestamptz) from public;
grant execute on function public.omc_token_info(text), public.omc_hq(text), public.omc_hq_uso(text), public.omc_resolver(text, bigint, text, text),
  public.omc_agente_set(text, text, jsonb), public.omc_pedir(text, jsonb), public.omc_estado(text, bigint), public.omc_reportar(text, bigint, boolean, text),
  public.omc_latido(text, text), public.omc_mis_solicitudes(text, text), public.omc_subir_uso(text, jsonb), public.omc_guardar_push(text, jsonb), public.omc_subir_plan(text, jsonb), public.omc_subir_actividad(text, jsonb),
  public.omc_kpi_set(text, jsonb), public.omc_ingreso_set(text, jsonb), public.omc_ingresos(text), public.omc_comentar(text, bigint, text), public.omc_retirar(text, bigint, text),
  public.omc_licitaciones_subir(text, jsonb), public.omc_licitacion_decidir(text, text, text, jsonb, text), public.omc_licitaciones_pendientes_sync(text), public.omc_licitaciones_sincronizadas(text, jsonb), public.omc_licitaciones_lista(text, boolean), public.omc_posponer(text, bigint, timestamptz), public.omc_pospuestas_vencidas(text), public.omc_eventos(text, timestamptz)
  to anon, authenticated, service_role;
notify pgrst, 'reload schema';
