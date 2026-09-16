-- scripts/hq/schema-v2.sql · HQ v2: fuente única en cascada. Idempotente. Se aplica DESPUÉS de schema.sql.
-- Convención: cada sección lleva el número de tarea del plan 2026-09-16-hq-v2-plan-1-base.md.

-- T1 · versión del esquema v2 (los tests la usan como centinela)
create or replace function omc_v2_version() returns text language sql immutable as $$ select '2.0.3' $$;
grant execute on function omc_v2_version() to anon, authenticated;

-- T2 · objetivo por horizonte
alter table omc_plan_objetivo add column if not exists horizonte int not null default 2026;
do $$
begin
  if exists (select 1 from pg_constraint where conrelid='omc_plan_objetivo'::regclass and contype='p'
             and array_length(conkey,1)=1) then
    alter table omc_plan_objetivo drop constraint omc_plan_objetivo_pkey;
    alter table omc_plan_objetivo add primary key (empresa, horizonte);
  end if;
end $$;

drop function if exists omc_plan_objetivo_set(text, jsonb);
create or replace function omc_plan_objetivo_set(p_token text, p jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare t record; h int := coalesce((p->>'horizonte')::int, 2026); r omc_plan_objetivo;
begin
  select * into t from omc_tok(p_token);
  if t.rol <> 'owner' then raise exception 'solo owner' using errcode='42501'; end if;
  insert into omc_plan_objetivo (empresa, horizonte, titulo, meta, unidad, fecha_limite)
  values (t.empresa, h, coalesce(nullif(p->>'titulo',''), 'Contratado a 31 de diciembre'), (p->>'meta')::numeric,
          coalesce(nullif(p->>'unidad',''),'EUR'), nullif(p->>'fecha_limite','')::date)
  on conflict (empresa, horizonte) do update set titulo=excluded.titulo, meta=excluded.meta, unidad=excluded.unidad,
    fecha_limite=excluded.fecha_limite, updated_at=now()
  returning * into r;
  return to_jsonb(r);
end $$;

create or replace function omc_plan_objetivos(p_token text) returns jsonb
language sql security definer set search_path=public as $$
  select coalesce(jsonb_agg(to_jsonb(o) order by o.horizonte), '[]'::jsonb)
  from omc_plan_objetivo o where o.empresa = (select empresa from omc_tok(p_token));
$$;

-- omc_plan_objetivo(text) conserva el calculo de valor_actual/progreso_pct de schema.sql (los usa
-- hq.py plan, UI v1) y anade el horizonte minimo: un to_jsonb(o) sin agregados rompe esa UI porque
-- le faltarian esas dos claves.
drop function if exists omc_plan_objetivo(text);
create or replace function omc_plan_objetivo(p_token text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare t record; o omc_plan_objetivo; actual numeric;
begin
  select * into t from omc_tok(p_token);
  select * into o from omc_plan_objetivo where empresa = t.empresa order by horizonte limit 1;
  if not found then return null; end if;
  select coalesce(sum(l.valor_actual), 0) into actual from omc_plan_lineas l where l.empresa = t.empresa and l.activa and l.unidad = o.unidad;
  return to_jsonb(o) || jsonb_build_object('valor_actual', actual,
    'progreso_pct', case when o.meta <= 0 then null else round(least(actual / o.meta, 1) * 100) end);
end $$;
grant execute on function omc_plan_objetivo_set(text, jsonb), omc_plan_objetivos(text), omc_plan_objetivo(text) to anon, authenticated;

-- T3 · bloques y frentes
create table if not exists omc_plan_bloques (
  id bigserial primary key, empresa text not null references omc_empresas(id), letra text not null, nombre text not null,
  meta_eur numeric default 0, director text, orden int default 0, activo boolean default true, updated_at timestamptz default now(),
  unique (empresa, letra));
alter table omc_plan_bloques enable row level security;
alter table omc_plan_lineas add column if not exists bloque_id bigint references omc_plan_bloques(id) on delete set null;
alter table omc_plan_lineas add column if not exists codigo text;
alter table omc_plan_lineas add column if not exists etiquetas text[] default '{}';
create unique index if not exists omc_plan_lineas_codigo_u on omc_plan_lineas (empresa, upper(codigo)) where codigo is not null;

create or replace function omc_frente_id(p_empresa text, p_ref text) returns bigint
language sql stable as $$
  select l.id from omc_plan_lineas l where l.empresa = p_empresa and l.activa
    and (upper(l.codigo) = upper(trim(p_ref)) or (p_ref ~ '^[0-9]+$' and l.id = p_ref::bigint)) limit 1;
$$;
revoke execute on function omc_frente_id(text, text) from public, anon, authenticated;

create or replace function omc_agente_valido(p_empresa text, p_nombre text) returns text
language sql stable as $$
  select a.id from omc_agentes a where a.empresa = p_empresa and a.activo and p_nombre is not null
    and (lower(a.id) = lower(trim(p_nombre)) or lower(a.nombre) = lower(trim(p_nombre))
         or exists (select 1 from unnest(a.sesiones) s where lower(split_part(s,'-',1)) = lower(trim(p_nombre)) or lower(s) = lower(trim(p_nombre))))
  order by a.orden nulls last, a.id limit 1;
$$;
revoke execute on function omc_agente_valido(text, text) from public, anon, authenticated;

create or replace function omc_bloque_set(p_token text, p jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare t record; r omc_plan_bloques;
begin
  select * into t from omc_tok(p_token);
  if t.rol <> 'owner' then raise exception 'solo owner' using errcode='42501'; end if;
  if coalesce(p->>'letra','') = '' then raise exception 'falta letra'; end if;
  insert into omc_plan_bloques (empresa, letra, nombre, meta_eur, director, orden, activo)
  values (t.empresa, upper(p->>'letra'), coalesce(p->>'nombre','(sin nombre)'), coalesce((p->>'meta_eur')::numeric,0), p->>'director', coalesce((p->>'orden')::int,0), coalesce((p->>'activo')::boolean,true))
  on conflict (empresa, letra) do update set
    nombre = coalesce(p->>'nombre', omc_plan_bloques.nombre), meta_eur = coalesce((p->>'meta_eur')::numeric, omc_plan_bloques.meta_eur),
    director = coalesce(p->>'director', omc_plan_bloques.director), orden = coalesce((p->>'orden')::int, omc_plan_bloques.orden),
    activo = coalesce((p->>'activo')::boolean, omc_plan_bloques.activo), updated_at = now()
  returning * into r;
  return to_jsonb(r);
end $$;

create or replace function omc_frente_set(p_token text, p jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare t record; r omc_plan_lineas; b bigint; existente bigint;
begin
  select * into t from omc_tok(p_token);
  if t.rol <> 'owner' then raise exception 'solo owner' using errcode='42501'; end if;
  if coalesce(p->>'codigo','') = '' then raise exception 'falta codigo (A1, B2...)'; end if;
  if p ? 'bloque' then
    select id into b from omc_plan_bloques where empresa = t.empresa and letra = upper(p->>'bloque');
    if b is null then raise exception 'bloque % no existe', p->>'bloque'; end if;
  end if;
  select id into existente from omc_plan_lineas where empresa = t.empresa and upper(codigo) = upper(p->>'codigo');
  if existente is null then
    insert into omc_plan_lineas (empresa, orden, linea, kpi, valor_actual, meta, unidad, responsable, proximo_hito, fecha_hito, fuente, activa, actualizado_por, bloque_id, codigo, etiquetas)
    values (t.empresa, coalesce((p->>'orden')::int, 0), coalesce(p->>'linea','(sin nombre)'), coalesce(p->>'kpi',''), coalesce((p->>'valor_actual')::numeric,0),
            coalesce((p->>'meta')::numeric,0), coalesce(p->>'unidad','EUR'), coalesce(p->>'responsable',''), coalesce(p->>'proximo_hito',''), (p->>'fecha_hito')::date, 'manual', true, t.nombre, b, upper(p->>'codigo'),
            coalesce(array(select jsonb_array_elements_text(p->'etiquetas')), '{}'))
    returning * into r;
  else
    update omc_plan_lineas set
      orden = coalesce((p->>'orden')::int, orden), linea = coalesce(p->>'linea', linea), kpi = coalesce(p->>'kpi', kpi),
      valor_actual = coalesce((p->>'valor_actual')::numeric, valor_actual), meta = coalesce((p->>'meta')::numeric, meta), unidad = coalesce(p->>'unidad', unidad),
      responsable = coalesce(p->>'responsable', responsable), proximo_hito = coalesce(p->>'proximo_hito', proximo_hito), fecha_hito = coalesce((p->>'fecha_hito')::date, fecha_hito),
      activa = coalesce((p->>'activa')::boolean, activa), bloque_id = coalesce(b, bloque_id), actualizado_por = t.nombre,
      etiquetas = case when p ? 'etiquetas' then array(select jsonb_array_elements_text(p->'etiquetas')) else etiquetas end
    where id = existente returning * into r;
  end if;
  return to_jsonb(r);
end $$;

create or replace function omc_bloques_lista(p_token text) returns jsonb
language sql security definer set search_path=public as $$
  select coalesce(jsonb_agg(to_jsonb(b) || jsonb_build_object(
    'frentes', (select count(*) from omc_plan_lineas l where l.bloque_id = b.id and l.activa),
    'encargos_abiertos', (select count(*) from omc_encargos e join omc_plan_lineas l on l.id = e.linea_id where l.bloque_id = b.id and e.estado in ('encolado','en_curso','bloqueado_diego'))
  ) order by b.orden, b.letra), '[]'::jsonb)
  from omc_plan_bloques b where b.empresa = (select empresa from omc_tok(p_token)) and b.activo;
$$;

create or replace function omc_frentes_lista(p_token text, p_bloque text default null) returns jsonb
language sql security definer set search_path=public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', l.id, 'codigo', l.codigo, 'linea', l.linea, 'kpi', l.kpi, 'valor_actual', l.valor_actual, 'meta', l.meta, 'unidad', l.unidad,
    'responsable', l.responsable, 'proximo_hito', l.proximo_hito, 'fecha_hito', l.fecha_hito, 'etiquetas', l.etiquetas, 'orden', l.orden,
    'bloque_id', b.id, 'bloque_letra', b.letra, 'bloque_nombre', b.nombre,
    'encargos_abiertos', (select count(*) from omc_encargos e where e.linea_id = l.id and e.estado in ('encolado','en_curso','bloqueado_diego'))
  ) order by b.orden, b.letra, l.orden, l.codigo), '[]'::jsonb)
  from omc_plan_lineas l left join omc_plan_bloques b on b.id = l.bloque_id
  where l.empresa = (select empresa from omc_tok(p_token)) and l.activa and (p_bloque is null or b.letra = upper(p_bloque));
$$;
grant execute on function omc_bloque_set(text, jsonb), omc_frente_set(text, jsonb), omc_bloques_lista(text), omc_frentes_lista(text, text) to anon, authenticated;

-- T4 · encargos v2: columnas, avances append-only y alta con frente obligatorio
alter table omc_encargos add column if not exists etiquetas text[] default '{}';
alter table omc_encargos add column if not exists enlaces jsonb default '[]'::jsonb;
alter table omc_encargos add column if not exists fuente_cierre text;
alter table omc_encargos add column if not exists entregable_url text;
alter table omc_encargos add column if not exists orden_kanban int default 0;
alter table omc_encargos add column if not exists origen text;
alter table omc_encargos add column if not exists expediente_id bigint;
alter table omc_encargos add column if not exists motivo_descarte text;

create table if not exists omc_encargo_avances (
  id bigserial primary key, empresa text not null references omc_empresas(id), encargo_id bigint not null references omc_encargos(id) on delete cascade,
  autor text not null, tipo text not null check (tipo in ('alta','avance','comentario_diego','estado','cierre','sistema')), texto text not null,
  fecha timestamptz default now());
create index if not exists omc_encargo_avances_enc on omc_encargo_avances (encargo_id, fecha desc);
create index if not exists omc_encargo_avances_emp on omc_encargo_avances (empresa, fecha desc);
alter table omc_encargo_avances enable row level security;
create or replace function omc_avances_inmutables() returns trigger language plpgsql as $$
begin raise exception 'omc_encargo_avances es append-only'; end $$;
drop trigger if exists omc_avances_inmutables on omc_encargo_avances;
create trigger omc_avances_inmutables before update or delete on omc_encargo_avances for each row execute function omc_avances_inmutables();

-- Inserta la fila de historial y refresca la cache ultimo_avance/fecha_avance en omc_encargos. Interno:
-- se llama solo desde funciones security definer (omc_encargo_alta, omc_encargo_avance).
create or replace function omc_avance_insertar(p_empresa text, p_encargo bigint, p_autor text, p_tipo text, p_texto text) returns void
language sql as $$
  insert into omc_encargo_avances (empresa, encargo_id, autor, tipo, texto) values (p_empresa, p_encargo, coalesce(p_autor,'sistema'), p_tipo, p_texto);
  update omc_encargos set ultimo_avance = case when p_tipo in ('avance','cierre') then p_texto else ultimo_avance end,
    fecha_avance = case when p_tipo in ('avance','cierre') then now() else fecha_avance end, updated_at = now() where id = p_encargo;
$$;
revoke execute on function omc_avance_insertar(text, bigint, text, text, text) from public, anon, authenticated;

-- Regla de autorizacion compartida por avance/estado/hecho/tomar: owner, chief o sistema, quien lo creo,
-- o el responsable del encargo (por id, por nombre o por sesion tmux, via omc_agente_valido) - ademas del
-- fallback historico de v1 por substring/sesion para no romper encargos que ya llevan meses en produccion
-- con el campo agente como nombre libre en vez de id canonico. Interno: solo desde security definer.
create or replace function omc_encargo_puede(t omc_tokens, e omc_encargos, v_agente text) returns boolean
language sql stable as $$
  select t.rol = 'owner'
    or lower(v_agente) in ('chief', 'sistema')
    or lower(v_agente) = lower(coalesce(e.creado_por, ''))
    or position(lower(v_agente) in lower(coalesce(e.agente, ''))) > 0
    or (omc_agente_valido(t.empresa, v_agente) is not null
        and omc_agente_valido(t.empresa, v_agente) = omc_agente_valido(t.empresa, e.agente))
    or exists (
      select 1 from omc_agentes a, unnest(a.sesiones) s
      where a.empresa = t.empresa and a.id = v_agente
        and position(lower(split_part(s, '-', 1)) in lower(coalesce(e.agente, ''))) > 0
    );
$$;
revoke execute on function omc_encargo_puede(omc_tokens, omc_encargos, text) from public, anon, authenticated;

create or replace function omc_encargo_alta(p_token text, p jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare t record; v_linea bigint; v_resp text; v_actor text; r omc_encargos;
begin
  select * into t from omc_tok(p_token);
  if coalesce(p->>'texto','') = '' then raise exception 'falta texto'; end if;
  if coalesce(p->>'frente','') = '' then raise exception 'falta frente: pasa --frente A3 (hq.py frentes)'; end if;
  v_linea := omc_frente_id(t.empresa, p->>'frente');
  if v_linea is null then raise exception 'frente % no existe o no está activo (hq.py frentes)', p->>'frente'; end if;
  v_actor := case when t.rol = 'owner' then 'diego' else coalesce(p->>'agente', 'agente') end;
  if coalesce(p->>'responsable','') <> '' then
    v_resp := omc_agente_valido(t.empresa, p->>'responsable');
    if v_resp is null then raise exception 'responsable % no es un agente activo (hq.py agente lista)', p->>'responsable'; end if;
  end if;
  insert into omc_encargos (empresa, fecha, texto, interpretacion, linea_id, departamento, agente, estado, prioridad, solicitud_id, proximo_hito, fecha_hito,
                            creado_por, etiquetas, enlaces, origen, expediente_id, mensaje_id)
  values (t.empresa, now(), p->>'texto', coalesce(p->>'interpretacion', ''), v_linea,
          (select coalesce(b.nombre, 'sin bloque') from omc_plan_lineas l left join omc_plan_bloques b on b.id = l.bloque_id where l.id = v_linea),
          coalesce(v_resp, ''), 'encolado', coalesce((p->>'prioridad')::int, 0), nullif(p->>'solicitud_id','')::bigint, coalesce(p->>'proximo_hito', ''), nullif(p->>'fecha_hito','')::date,
          v_actor, coalesce(array(select jsonb_array_elements_text(p->'etiquetas')), '{}'), coalesce(p->'enlaces', '[]'::jsonb),
          coalesce(p->>'origen', initcap(v_actor) || ' ' || to_char(now(), 'DD-MM HH24:MI')), nullif(p->>'expediente_id','')::bigint, nullif(p->>'mensaje_id','')::bigint)
  returning * into r;
  perform omc_avance_insertar(t.empresa, r.id, v_actor, 'alta', left(r.texto, 200));
  return to_jsonb(r) || jsonb_build_object('codigo', (select codigo from omc_plan_lineas where id = v_linea));
end $$;

-- omc_encargo_set: ruling del controlador (task-4, 2026-09-16) sobre el brief. El brief pedia que un
-- alta sin id lanzara 'usa omc_encargo_alta (frente obligatorio)', pero hq.py de main (linea 845) todavia
-- llama a omc_encargo_set sin id para 'hq.py encargo alta' y main no se actualiza hasta el merge tras la
-- tarea 6. Mientras tanto: con 'frente' en p, delega en omc_encargo_alta; sin 'frente', mantiene el alta
-- v1 (linea_id puede quedar null) marcando origen='legado'. El frente sera obligatorio de verdad en la
-- tarea 7, con el check constraint tras migrar los encargos existentes.
create or replace function omc_encargo_set(p_token text, p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t omc_tokens; e omc_encargos; v_id bigint; v_agente text; v_prioridad int; autorizado boolean;
begin
  t := omc_tok(p_token);
  v_id := nullif(p->>'id','')::bigint;
  v_agente := case when t.rol = 'owner' then 'diego' else coalesce(nullif(p->>'agente',''), 'agente') end;
  if v_id is null then
    if coalesce(p->>'frente','') <> '' then
      return omc_encargo_alta(p_token, p);
    end if;
    if coalesce(p->>'texto','') = '' then raise exception 'falta texto'; end if;
    if nullif(p->>'linea_id','') is null then
      raise exception 'falta frente: usa encargo alta --frente CODIGO (lista: hq.py frentes)' using errcode = '23514';
    end if;
    v_prioridad := (p->>'prioridad')::int;
    if v_prioridad is null then
      select coalesce(max(prioridad), 0) + 1 into v_prioridad from omc_encargos
        where empresa = t.empresa and coalesce(linea_id, -1) = coalesce(nullif(p->>'linea_id','')::bigint, -1);
    end if;
    insert into omc_encargos (empresa, texto, interpretacion, linea_id, departamento, agente, estado, prioridad,
        solicitud_id, proximo_hito, fecha_hito, creado_por, espera, mensaje_id, origen)
      values (t.empresa, p->>'texto', coalesce(p->>'interpretacion',''), nullif(p->>'linea_id','')::bigint, coalesce(p->>'departamento',''),
              coalesce(p->>'agente_responsable', p->>'agente', ''), coalesce(nullif(p->>'estado',''), 'encolado'), v_prioridad,
              nullif(p->>'solicitud_id','')::bigint, coalesce(p->>'proximo_hito',''), nullif(p->>'fecha_hito','')::date, v_agente,
              coalesce(p->>'espera',''), nullif(p->>'mensaje_id','')::bigint, 'legado')
      returning * into e;
  else
    select * into e from omc_encargos where empresa = t.empresa and id = v_id;
    if not found then raise exception 'encargo no encontrado' using errcode = 'P0001'; end if;
    autorizado := t.rol = 'owner' or lower(v_agente) = lower(e.creado_por) or position(lower(v_agente) in lower(e.agente)) > 0;
    if not autorizado then
      -- 9-sep (chief): mismo fix que omc_encargo_avance/omc_encargo_estado - 'agente' es texto libre con
      -- nombres propios, no ids de puesto; comparar tambien por el nombre real (primer segmento de cada
      -- sesion tmux del agente).
      select true into autorizado
      from omc_agentes a, unnest(a.sesiones) s
      where a.empresa = t.empresa and a.id = v_agente
        and position(lower(split_part(s, '-', 1)) in lower(e.agente)) > 0
      limit 1;
    end if;
    if not coalesce(autorizado, false) then
      raise exception 'solo Diego, quien lo creo o el responsable pueden editarlo' using errcode = '42501';
    end if;
    update omc_encargos set texto = coalesce(p->>'texto', texto), interpretacion = coalesce(p->>'interpretacion', interpretacion),
      linea_id = case when p ? 'linea_id' then nullif(p->>'linea_id','')::bigint else linea_id end,
      departamento = coalesce(p->>'departamento', departamento), agente = coalesce(p->>'agente_responsable', p->>'agente', agente),
      estado = coalesce(nullif(p->>'estado',''), estado), proximo_hito = coalesce(p->>'proximo_hito', proximo_hito),
      fecha_hito = coalesce(nullif(p->>'fecha_hito','')::date, fecha_hito), solicitud_id = coalesce(nullif(p->>'solicitud_id','')::bigint, solicitud_id),
      espera = case when p ? 'espera' then p->>'espera' else espera end,
      mensaje_id = case when p ? 'mensaje_id' then nullif(p->>'mensaje_id','')::bigint else mensaje_id end,
      updated_at = now()
      where id = v_id returning * into e;
  end if;
  return to_jsonb(e);
end $$;

create or replace function omc_encargo_avance(p_token text, p_id bigint, p_texto text, p_agente text default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare t omc_tokens; e omc_encargos; v_agente text;
begin
  t := omc_tok(p_token);
  select * into e from omc_encargos where id = p_id and empresa = t.empresa;
  if e.id is null then raise exception 'encargo % no existe', p_id; end if;
  v_agente := case when t.rol = 'owner' then 'diego' else coalesce(nullif(p_agente, ''), 'agente') end;
  if not omc_encargo_puede(t, e, v_agente) then raise exception 'no autorizado: el encargo es de %', coalesce(nullif(e.agente,''), e.creado_por) using errcode='42501'; end if;
  if coalesce(trim(p_texto),'') = '' then raise exception 'falta texto'; end if;
  perform omc_avance_insertar(t.empresa, e.id, v_agente, 'avance', p_texto);
  select * into e from omc_encargos where id = p_id and empresa = t.empresa;
  return to_jsonb(e);
end $$;
grant execute on function omc_encargo_alta(text, jsonb), omc_encargo_avance(text, bigint, text, text) to anon, authenticated;

-- T5 · puertas de cierre (hecho con fuente, estado con motivo), tomar, editar y feed
-- Esqueleto minimo de omc_kit: ruling del controlador (task-5, 2026-09-16) sobre el brief, que
-- decia "se crea en T7". La tabla se crea aqui, con las mismas columnas; T7 solo anade RPC y semilla.
create table if not exists omc_kit (
  id bigserial primary key, empresa text not null references omc_empresas(id), linea_id bigint references omc_plan_lineas(id) on delete set null,
  tipo text not null check (tipo in ('plantilla','oficial','procedimiento','regla')), nombre text not null, url text, texto text,
  version text default '1', vigente boolean default true, actualizado_por text, fecha timestamptz default now());
create index if not exists omc_kit_emp on omc_kit (empresa, linea_id) where vigente;
alter table omc_kit enable row level security;

-- Fuente valida para cerrar un encargo: una url que ya esta en el kit vigente de la empresa, o un
-- Google Doc/Drive (docs.google.com o drive.google.com). Interno: lo usa solo omc_encargo_hecho.
create or replace function omc_fuente_valida(p_empresa text, p_fuente text) returns boolean
language sql stable as $$
  select p_fuente ~ '^https://(docs|drive)\.google\.com/'
      or exists (select 1 from omc_kit k where k.empresa = p_empresa and k.vigente and k.url is not null and k.url = trim(p_fuente));
$$;
revoke execute on function omc_fuente_valida(text, text) from public, anon, authenticated;

create or replace function omc_encargo_hecho(p_token text, p_id bigint, p_fuente text, p_entregable text default '', p_agente text default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare t omc_tokens; e omc_encargos; v_agente text;
begin
  t := omc_tok(p_token);
  select * into e from omc_encargos where id = p_id and empresa = t.empresa;
  if e.id is null then raise exception 'encargo % no existe', p_id; end if;
  v_agente := case when t.rol = 'owner' then 'diego' else coalesce(nullif(p_agente, ''), 'agente') end;
  if not omc_encargo_puede(t, e, v_agente) then raise exception 'no autorizado: el encargo es de %', coalesce(nullif(e.agente,''), e.creado_por) using errcode='42501'; end if;
  if not omc_fuente_valida(t.empresa, coalesce(p_fuente,'')) then
    raise exception 'fuente no válida: cita una entrada del kit (hq.py kit lista %) o un Google Doc', coalesce((select codigo from omc_plan_lineas where id = e.linea_id), '<frente>');
  end if;
  -- espera es text not null default '' (schema.sql): no puede quedar a null al cerrar.
  update omc_encargos set estado = 'hecho', fuente_cierre = trim(p_fuente), entregable_url = nullif(trim(coalesce(p_entregable,'')), ''), espera = '' where id = e.id;
  perform omc_avance_insertar(t.empresa, e.id, v_agente, 'cierre', 'hecho · fuente ' || trim(p_fuente) || case when coalesce(p_entregable,'') <> '' then ' · entregable ' || p_entregable else '' end);
  select * into e from omc_encargos where id = p_id and empresa = t.empresa;
  return to_jsonb(e);
end $$;

-- El drop cambia la firma de 4 a 5 argumentos (se anade p_motivo). Un drop borra el ACL de la
-- funcion vieja (revoke/grant de schema.sql, seccion final): se restaura justo debajo. Las llamadas
-- de 4 argumentos con nombre (hq.py de main, sin --motivo) siguen resolviendo a esta funcion nueva
-- porque PostgREST llama por argumentos nombrados y p_motivo tiene default ''.
drop function if exists omc_encargo_estado(text, bigint, text, text);
create or replace function omc_encargo_estado(p_token text, p_id bigint, p_estado text, p_agente text default null, p_motivo text default '') returns jsonb
language plpgsql security definer set search_path=public as $$
declare t omc_tokens; e omc_encargos; v_agente text;
begin
  t := omc_tok(p_token);
  select * into e from omc_encargos where id = p_id and empresa = t.empresa;
  if e.id is null then raise exception 'encargo % no existe', p_id; end if;
  v_agente := case when t.rol = 'owner' then 'diego' else coalesce(nullif(p_agente, ''), 'agente') end;
  if not omc_encargo_puede(t, e, v_agente) then raise exception 'no autorizado: el encargo es de %', coalesce(nullif(e.agente,''), e.creado_por) using errcode='42501'; end if;
  if p_estado = 'hecho' then raise exception 'usa omc_encargo_hecho --fuente <url del kit o Google Doc>'; end if;
  if p_estado not in ('encolado','en_curso','bloqueado_diego','descartado') then raise exception 'estado % no válido', p_estado; end if;
  if p_estado = 'descartado' and coalesce(trim(p_motivo),'') = '' then raise exception 'falta motivo: --motivo "por qué se descarta"'; end if;
  update omc_encargos set estado = p_estado, motivo_descarte = case when p_estado = 'descartado' then trim(p_motivo) else motivo_descarte end where id = e.id;
  perform omc_avance_insertar(t.empresa, e.id, v_agente, 'estado', e.estado || ' -> ' || p_estado || case when coalesce(p_motivo,'') <> '' then ' · ' || p_motivo else '' end);
  select * into e from omc_encargos where id = p_id and empresa = t.empresa;
  return to_jsonb(e);
end $$;
revoke all on function omc_encargo_estado(text, bigint, text, text, text) from public;
grant execute on function omc_encargo_estado(text, bigint, text, text, text) to anon, authenticated, service_role;

-- Esqueleto minimo de omc_contactos (mismo patron que omc_kit mas arriba): omc_encargo_contexto,
-- justo debajo, es "language sql" y por tanto exige que la tabla ya exista en el momento de crear
-- la funcion. La tabla se crea aqui; T9 (al final del fichero) solo anade las RPC.
create table if not exists omc_contactos (
  id bigserial primary key, empresa text not null references omc_empresas(id), persona text, email text, organizacion text,
  canal text not null check (canal in ('correo','linkedin','formulario','telefono','plataforma')), motivo text not null,
  linea_id bigint references omc_plan_lineas(id) on delete set null, encargo_id bigint references omc_encargos(id) on delete set null, expediente_id bigint, solicitud_id bigint,
  agente text, fecha timestamptz default now(), toque int default 1,
  estado text not null default 'previsto' check (estado in ('previsto','enviado','respondido','reunion','cerrado','sin_respuesta')),
  proximo_toque date, respuesta_ref text, respuesta_fecha timestamptz, updated_at timestamptz default now());
create index if not exists omc_contactos_emp on omc_contactos (empresa, fecha desc);
create index if not exists omc_contactos_email on omc_contactos (empresa, lower(email));
-- T10: idempotencia de la migracion de envios historicos (respuesta_ref = 'migracion:<tarjeta>'); evita duplicados
-- si migrar-envios-contactos.py --aplicar se ejecuta mas de una vez, sin depender solo del SELECT previo del script.
create unique index if not exists omc_contactos_respuesta_ref_migracion on omc_contactos (empresa, respuesta_ref) where respuesta_ref like 'migracion:%';
alter table omc_contactos enable row level security;

create or replace function omc_encargo_contexto(p_empresa text, p_id bigint) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'encargo', (select to_jsonb(e) || jsonb_build_object('codigo', l.codigo) from omc_encargos e left join omc_plan_lineas l on l.id = e.linea_id where e.id = p_id),
    'frente', (select jsonb_build_object('id', l.id, 'codigo', l.codigo, 'linea', l.linea, 'kpi', l.kpi, 'meta', l.meta, 'valor_actual', l.valor_actual, 'responsable', l.responsable,
                 'bloque', b.letra || ' ' || b.nombre) from omc_encargos e join omc_plan_lineas l on l.id = e.linea_id left join omc_plan_bloques b on b.id = l.bloque_id where e.id = p_id),
    'kit', (select coalesce(jsonb_agg(jsonb_build_object('id', k.id, 'tipo', k.tipo, 'nombre', k.nombre, 'url', k.url, 'texto', k.texto) order by k.tipo, k.nombre), '[]'::jsonb)
              from omc_kit k where k.empresa = p_empresa and k.vigente and (k.linea_id is null or k.linea_id = (select linea_id from omc_encargos where id = p_id))),
    'avances', (select coalesce(jsonb_agg(to_jsonb(a) order by a.fecha desc), '[]'::jsonb) from (select * from omc_encargo_avances where encargo_id = p_id order by fecha desc limit 10) a),
    'contactos', (select coalesce(jsonb_agg(to_jsonb(c) order by c.fecha desc), '[]'::jsonb) from omc_contactos c where c.encargo_id = p_id),
    'expediente', null);
$$;
revoke execute on function omc_encargo_contexto(text, bigint) from public, anon, authenticated;

create or replace function omc_encargo_tomar(p_token text, p_id bigint, p_agente text default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare t omc_tokens; e omc_encargos; v_agente text;
begin
  t := omc_tok(p_token);
  select * into e from omc_encargos where id = p_id and empresa = t.empresa;
  if e.id is null then raise exception 'encargo % no existe', p_id; end if;
  v_agente := case when t.rol = 'owner' then 'diego' else coalesce(nullif(p_agente, ''), 'agente') end;
  if not omc_encargo_puede(t, e, v_agente) then raise exception 'no autorizado: el encargo es de %', coalesce(nullif(e.agente,''), e.creado_por) using errcode='42501'; end if;
  if e.estado in ('encolado','bloqueado_diego') then
    update omc_encargos set estado = 'en_curso', agente = coalesce(nullif(agente, ''), omc_agente_valido(t.empresa, v_agente), v_agente) where id = e.id;
    perform omc_avance_insertar(t.empresa, e.id, v_agente, 'estado', e.estado || ' -> en_curso (tomado)');
  end if;
  return omc_encargo_contexto(t.empresa, e.id);
end $$;

create or replace function omc_encargo_editar(p_token text, p_id bigint, p jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare t omc_tokens; e omc_encargos; v_linea bigint; v_resp text;
begin
  t := omc_tok(p_token);
  if t.rol <> 'owner' then raise exception 'solo owner' using errcode='42501'; end if;
  select * into e from omc_encargos where id = p_id and empresa = t.empresa;
  if e.id is null then raise exception 'encargo % no existe', p_id; end if;
  if p ? 'frente' then v_linea := omc_frente_id(t.empresa, p->>'frente'); if v_linea is null then raise exception 'frente % no existe', p->>'frente'; end if; end if;
  if p ? 'responsable' then v_resp := omc_agente_valido(t.empresa, p->>'responsable'); if v_resp is null then raise exception 'responsable % no es un agente activo', p->>'responsable'; end if; end if;
  update omc_encargos set
    texto = coalesce(p->>'texto', texto), interpretacion = coalesce(p->>'interpretacion', interpretacion),
    prioridad = coalesce(nullif(p->>'prioridad','')::int, prioridad),
    etiquetas = case when p ? 'etiquetas' then array(select jsonb_array_elements_text(p->'etiquetas')) else etiquetas end,
    enlaces = coalesce(p->'enlaces', enlaces), proximo_hito = coalesce(p->>'proximo_hito', proximo_hito),
    fecha_hito = coalesce(nullif(p->>'fecha_hito','')::date, fecha_hito),
    linea_id = coalesce(v_linea, linea_id), agente = coalesce(v_resp, agente),
    orden_kanban = coalesce(nullif(p->>'orden_kanban','')::int, orden_kanban),
    expediente_id = coalesce(nullif(p->>'expediente_id','')::bigint, expediente_id), updated_at = now()
  where id = e.id returning * into e;
  if coalesce(p->>'comentario','') <> '' then perform omc_avance_insertar(t.empresa, e.id, 'diego', 'comentario_diego', p->>'comentario'); end if;
  return to_jsonb(e) || jsonb_build_object('codigo', (select codigo from omc_plan_lineas where id = e.linea_id));
end $$;

create or replace function omc_feed(p_token text, p_desde timestamptz default now() - interval '24 hours') returns jsonb
language sql security definer set search_path=public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'encargo_id', a.encargo_id, 'texto_encargo', left(e.texto, 80), 'codigo', l.codigo, 'agente', e.agente,
    'autor', a.autor, 'tipo', a.tipo, 'texto', a.texto, 'fecha', a.fecha) order by a.fecha desc), '[]'::jsonb)
  from omc_encargo_avances a join omc_encargos e on e.id = a.encargo_id left join omc_plan_lineas l on l.id = e.linea_id
  where a.empresa = (select empresa from omc_tok(p_token)) and a.fecha >= p_desde;
$$;
grant execute on function omc_encargo_hecho(text, bigint, text, text, text), omc_encargo_tomar(text, bigint, text),
  omc_encargo_editar(text, bigint, jsonb), omc_feed(text, timestamptz) to anon, authenticated;

-- T7 - sin encargos vivos fuera de plan (se activa tras la migracion; si falla, aun hay huerfanos)
do $$ begin
  if not exists (select 1 from omc_encargos where linea_id is null and estado <> 'descartado') then
    alter table omc_encargos drop constraint if exists omc_encargos_frente_obligatorio;
    alter table omc_encargos add constraint omc_encargos_frente_obligatorio check (linea_id is not null or estado = 'descartado');
  else
    raise notice 'omc_encargos: quedan encargos vivos sin frente, constraint no aplicada';
  end if;
end $$;

-- T8 · kit
create or replace function omc_kit_set(p_token text, p jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare t record; v_linea bigint; v_actor text; r omc_kit;
begin
  select * into t from omc_tok(p_token);
  v_actor := case when t.rol = 'owner' then 'diego' else coalesce(p->>'agente', 'agente') end;
  if t.rol <> 'owner' and lower(v_actor) <> 'chief' then raise exception 'solo owner o chief editan el kit' using errcode='42501'; end if;
  if (p->>'id') is not null then
    update omc_kit set vigente = coalesce((p->>'vigente')::boolean, vigente), url = coalesce(p->>'url', url), texto = coalesce(p->>'texto', texto), actualizado_por = v_actor, fecha = now()
    where id = (p->>'id')::bigint and empresa = t.empresa returning * into r;
    if r.id is null then raise exception 'kit % no existe en esta empresa', p->>'id'; end if;
    return to_jsonb(r);
  end if;
  if coalesce(p->>'nombre','') = '' or coalesce(p->>'tipo','') = '' then raise exception 'falta nombre o tipo (plantilla|oficial|procedimiento|regla)'; end if;
  if coalesce(p->>'frente','') <> '' then
    v_linea := omc_frente_id(t.empresa, p->>'frente');
    if v_linea is null then raise exception 'frente % no existe', p->>'frente'; end if;
  end if;
  update omc_kit set vigente = false where empresa = t.empresa and vigente and nombre = p->>'nombre' and linea_id is not distinct from v_linea;
  insert into omc_kit (empresa, linea_id, tipo, nombre, url, texto, version, vigente, actualizado_por)
  values (t.empresa, v_linea, p->>'tipo', p->>'nombre', p->>'url', p->>'texto', coalesce(p->>'version','1'), true, v_actor) returning * into r;
  return to_jsonb(r);
end $$;

create or replace function omc_kit_lista(p_token text, p_frente text default null) returns jsonb
language sql security definer set search_path=public as $$
  with e as (select empresa from omc_tok(p_token)), f as (select omc_frente_id((select empresa from e), p_frente) as id)
  select coalesce(jsonb_agg(to_jsonb(k) || jsonb_build_object('codigo', l.codigo) order by k.linea_id nulls first, k.tipo, k.nombre), '[]'::jsonb)
  from omc_kit k left join omc_plan_lineas l on l.id = k.linea_id
  where k.empresa = (select empresa from e) and k.vigente and (p_frente is null or k.linea_id is null or k.linea_id = (select id from f));
$$;
grant execute on function omc_kit_set(text, jsonb), omc_kit_lista(text, text) to anon, authenticated;

-- T9 · contactos (tabla creada en T5, mas arriba, por la exigencia de omc_encargo_contexto)
create or replace function omc_contacto_alta(p_token text, p jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare t record; e omc_encargos; v_actor text; v_toque int; r omc_contactos;
begin
  select * into t from omc_tok(p_token);
  v_actor := case when t.rol = 'owner' then 'diego' else coalesce(p->>'agente', 'agente') end;
  if (p->>'encargo') is null then raise exception 'falta encargo: --encargo <id> (todo contacto cuelga de un encargo con frente)'; end if;
  select * into e from omc_encargos where id = (p->>'encargo')::bigint and empresa = t.empresa;
  if e.id is null then raise exception 'encargo % no existe', p->>'encargo'; end if;
  if coalesce(p->>'persona','') = '' and coalesce(p->>'organizacion','') = '' then raise exception 'falta persona u organizacion'; end if;
  if coalesce(p->>'canal','') = '' or coalesce(p->>'motivo','') = '' then raise exception 'falta canal o motivo'; end if;
  if p->>'canal' = 'correo' and coalesce(p->>'email','') = '' then raise exception 'falta email (canal correo)'; end if;
  -- Cuenta TODO contacto previo del mismo email/persona en este encargo, este o no ya enviado: si solo
  -- contara los ya "enviado" (estado <> 'previsto'), un segundo alta sin marcar antes su estado dejaria
  -- colar un tercero sin bloquear (visto en la primera ejecucion de estos tests).
  select count(*) + 1 into v_toque from omc_contactos c where c.empresa = t.empresa and c.encargo_id = e.id
    and ((p->>'email') is not null and lower(c.email) = lower(p->>'email') or (p->>'email') is null and lower(c.persona) = lower(p->>'persona'));
  if v_toque > 2 then raise exception 'máximo dos toques (regla 39): pide OK al chief con hq.py pedir antes de un tercero'; end if;
  insert into omc_contactos (empresa, persona, email, organizacion, canal, motivo, linea_id, encargo_id, expediente_id, solicitud_id, agente, toque, proximo_toque)
  values (t.empresa, p->>'persona', lower(nullif(trim(p->>'email'),'')), p->>'organizacion', p->>'canal', p->>'motivo', e.linea_id, e.id, e.expediente_id, (p->>'solicitud_id')::bigint,
          coalesce(omc_agente_valido(t.empresa, v_actor), v_actor), coalesce((p->>'toque')::int, v_toque), (p->>'proximo_toque')::date)
  returning * into r;
  perform omc_avance_insertar(t.empresa, e.id, v_actor, 'sistema', 'contacto #' || r.id || ' previsto: ' || coalesce(r.persona, r.organizacion) || ' por ' || r.canal || ' (toque ' || r.toque || ')');
  return to_jsonb(r);
end $$;

create or replace function omc_contacto_estado(p_token text, p_id bigint, p_estado text, p_ref text default null, p_proximo date default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare t record; r omc_contactos;
begin
  select * into t from omc_tok(p_token);
  update omc_contactos set estado = p_estado, respuesta_ref = coalesce(p_ref, respuesta_ref),
    respuesta_fecha = case when p_estado in ('respondido','reunion') then now() else respuesta_fecha end,
    fecha = case when p_estado = 'enviado' then now() else fecha end,
    proximo_toque = coalesce(p_proximo, case when p_estado = 'enviado' then (now() + interval '7 days')::date else proximo_toque end), updated_at = now()
  where id = p_id and empresa = t.empresa returning * into r;
  if r.id is null then raise exception 'contacto % no existe', p_id; end if;
  if r.encargo_id is not null then perform omc_avance_insertar(t.empresa, r.encargo_id, coalesce(r.agente,'sistema'), 'sistema', 'contacto #' || r.id || ' ' || p_estado || ': ' || coalesce(r.persona, r.organizacion)); end if;
  return to_jsonb(r);
end $$;

create or replace function omc_contactos_lista(p_token text, p_filtro jsonb default '{}'::jsonb) returns jsonb
language sql security definer set search_path=public as $$
  select coalesce(jsonb_agg(to_jsonb(c) || jsonb_build_object('codigo', l.codigo, 'texto_encargo', left(e.texto, 60)) order by c.fecha desc), '[]'::jsonb)
  from omc_contactos c left join omc_plan_lineas l on l.id = c.linea_id left join omc_encargos e on e.id = c.encargo_id
  where c.empresa = (select empresa from omc_tok(p_token))
    and (p_filtro->>'encargo' is null or c.encargo_id = (p_filtro->>'encargo')::bigint)
    and (p_filtro->>'frente' is null or c.linea_id = omc_frente_id(c.empresa, p_filtro->>'frente'))
    and (p_filtro->>'estado' is null or c.estado = p_filtro->>'estado')
    and (p_filtro->>'agente' is null or lower(c.agente) = lower(p_filtro->>'agente'))
    and (coalesce((p_filtro->>'pendientes')::boolean, false) = false or (c.estado = 'enviado' and c.proximo_toque <= current_date));
$$;

create or replace function omc_contacto_ficha(p_token text, p_id bigint) returns jsonb
language sql security definer set search_path=public as $$
  select to_jsonb(c) || jsonb_build_object('codigo', l.codigo, 'texto_encargo', e.texto,
    'historial', (select coalesce(jsonb_agg(jsonb_build_object('id', h.id, 'fecha', h.fecha, 'toque', h.toque, 'estado', h.estado, 'canal', h.canal, 'motivo', h.motivo) order by h.fecha), '[]'::jsonb)
                  from omc_contactos h where h.empresa = c.empresa and (lower(h.email) = lower(c.email) or (c.email is null and lower(h.persona) = lower(c.persona)))))
  from omc_contactos c left join omc_plan_lineas l on l.id = c.linea_id left join omc_encargos e on e.id = c.encargo_id
  where c.id = p_id and c.empresa = (select empresa from omc_tok(p_token));
$$;

create or replace function omc_contacto_casar(p_token text, p_email text, p_ref text, p_fecha timestamptz default now()) returns jsonb
language plpgsql security definer set search_path=public as $$
declare t record; r omc_contactos;
begin
  select * into t from omc_tok(p_token);
  select * into r from omc_contactos c where c.empresa = t.empresa and lower(c.email) = lower(trim(p_email)) and c.estado = 'enviado' and c.fecha >= p_fecha - interval '60 days'
  order by c.fecha desc limit 1;
  if r.id is null then return null; end if;
  update omc_contactos set estado = 'respondido', respuesta_ref = p_ref, respuesta_fecha = p_fecha, updated_at = now() where id = r.id returning * into r;
  if r.encargo_id is not null then perform omc_avance_insertar(t.empresa, r.encargo_id, 'sistema', 'sistema', 'respuesta de ' || coalesce(r.persona, r.email) || ' casada con el contacto #' || r.id); end if;
  return to_jsonb(r);
end $$;
grant execute on function omc_contacto_alta(text, jsonb), omc_contacto_estado(text, bigint, text, text, date), omc_contactos_lista(text, jsonb), omc_contacto_ficha(text, bigint), omc_contacto_casar(text, text, text, timestamptz) to anon, authenticated;

-- T11 · expedientes y sesiones de trabajo
create table if not exists omc_expedientes (
  id bigserial primary key, empresa text not null references omc_empresas(id), tipo text not null check (tipo in ('cliente','producto','convocatoria','licitacion')),
  nombre text not null, linea_id bigint references omc_plan_lineas(id) on delete set null, responsable text, ficha_url text, carpeta_url text, estado_funnel text,
  entregables jsonb default '[]'::jsonb, importe numeric, resumen_estado text, resumen_fecha timestamptz, licitacion_expediente text, activo boolean default true,
  created_at timestamptz default now(), updated_at timestamptz default now(), unique (empresa, nombre));
alter table omc_expedientes enable row level security;
create table if not exists omc_sesiones (
  id bigserial primary key, empresa text not null references omc_empresas(id), expediente_id bigint not null references omc_expedientes(id) on delete cascade,
  agente text not null, solicitada_por text, estado text not null default 'abierta' check (estado in ('solicitada','abierta','cerrada')),
  abierta timestamptz, cerrada timestamptz, resumen text, encargos_tocados bigint[] default '{}', created_at timestamptz default now());
alter table omc_sesiones enable row level security;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'omc_encargos_expediente_fk') then
    alter table omc_encargos add constraint omc_encargos_expediente_fk foreign key (expediente_id) references omc_expedientes(id) on delete set null; end if;
  if not exists (select 1 from pg_constraint where conname = 'omc_contactos_expediente_fk') then
    alter table omc_contactos add constraint omc_contactos_expediente_fk foreign key (expediente_id) references omc_expedientes(id) on delete set null; end if;
end $$;

create or replace function omc_expediente_set(p_token text, p jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare t record; v_actor text; v_linea bigint; v_resp text; r omc_expedientes; existente bigint;
begin
  select * into t from omc_tok(p_token);
  v_actor := case when t.rol = 'owner' then 'diego' else coalesce(p->>'agente','agente') end;
  if t.rol <> 'owner' and lower(v_actor) <> 'chief' then raise exception 'solo owner o chief' using errcode='42501'; end if;
  if p ? 'frente' then v_linea := omc_frente_id(t.empresa, p->>'frente'); if v_linea is null then raise exception 'frente % no existe', p->>'frente'; end if; end if;
  if p ? 'responsable' then v_resp := omc_agente_valido(t.empresa, p->>'responsable'); if v_resp is null then raise exception 'responsable % no es un agente activo', p->>'responsable'; end if; end if;
  select id into existente from omc_expedientes where empresa = t.empresa and (id = (p->>'id')::bigint or lower(nombre) = lower(p->>'nombre'));
  if existente is null then
    if coalesce(p->>'nombre','') = '' or coalesce(p->>'tipo','') = '' or v_linea is null then raise exception 'alta de expediente: faltan nombre, tipo o frente'; end if;
    insert into omc_expedientes (empresa, tipo, nombre, linea_id, responsable, ficha_url, carpeta_url, estado_funnel, entregables, importe, licitacion_expediente)
    values (t.empresa, p->>'tipo', p->>'nombre', v_linea, v_resp, p->>'ficha_url', p->>'carpeta_url', p->>'estado_funnel', coalesce(p->'entregables','[]'::jsonb), (p->>'importe')::numeric, p->>'licitacion_expediente')
    returning * into r;
  else
    update omc_expedientes set tipo = coalesce(p->>'tipo', tipo), nombre = coalesce(p->>'nombre', nombre), linea_id = coalesce(v_linea, linea_id), responsable = coalesce(v_resp, responsable),
      ficha_url = coalesce(p->>'ficha_url', ficha_url), carpeta_url = coalesce(p->>'carpeta_url', carpeta_url), estado_funnel = coalesce(p->>'estado_funnel', estado_funnel),
      entregables = case when p ? 'entregable' then entregables || jsonb_build_array(p->'entregable') else coalesce(p->'entregables', entregables) end,
      importe = coalesce((p->>'importe')::numeric, importe), licitacion_expediente = coalesce(p->>'licitacion_expediente', licitacion_expediente),
      activo = coalesce((p->>'activo')::boolean, activo), updated_at = now()
    where id = existente returning * into r;
  end if;
  return to_jsonb(r);
end $$;

create or replace function omc_expediente_ficha(p_token text, p_id bigint) returns jsonb
language sql security definer set search_path=public as $$
  with e as (select empresa from omc_tok(p_token)), x as (select * from omc_expedientes where id = p_id and empresa = (select empresa from e))
  select jsonb_build_object(
    'expediente', (select to_jsonb(x) from x),
    'frente', (select jsonb_build_object('id', l.id, 'codigo', l.codigo, 'linea', l.linea, 'kpi', l.kpi) from x join omc_plan_lineas l on l.id = x.linea_id),
    'encargos', (select coalesce(jsonb_agg(to_jsonb(en) order by en.estado, en.fecha_hito nulls last), '[]'::jsonb) from omc_encargos en where en.expediente_id = p_id and en.estado <> 'descartado'),
    'contactos', (select coalesce(jsonb_agg(to_jsonb(c) order by c.fecha desc), '[]'::jsonb) from omc_contactos c where c.expediente_id = p_id),
    'decisiones', (select coalesce(jsonb_agg(to_jsonb(d) order by d.fecha desc), '[]'::jsonb) from omc_decisiones d join x on d.linea_id = x.linea_id and d.empresa = x.empresa),
    'sesiones', (select coalesce(jsonb_agg(to_jsonb(s) order by s.created_at desc), '[]'::jsonb) from (select * from omc_sesiones where expediente_id = p_id order by created_at desc limit 5) s),
    'kit', (select coalesce(jsonb_agg(jsonb_build_object('id', k.id, 'tipo', k.tipo, 'nombre', k.nombre, 'url', k.url) order by k.tipo, k.nombre), '[]'::jsonb)
            from omc_kit k join x on k.empresa = x.empresa where k.vigente and (k.linea_id is null or k.linea_id = x.linea_id)));
$$;

create or replace function omc_expedientes_lista(p_token text, p_filtro jsonb default '{}'::jsonb) returns jsonb
language sql security definer set search_path=public as $$
  select coalesce(jsonb_agg(to_jsonb(x) || jsonb_build_object('codigo', l.codigo,
    'encargos_abiertos', (select count(*) from omc_encargos en where en.expediente_id = x.id and en.estado in ('encolado','en_curso','bloqueado_diego')),
    'sesion_abierta', (select s.agente from omc_sesiones s where s.expediente_id = x.id and s.estado = 'abierta' limit 1)) order by x.tipo, x.nombre), '[]'::jsonb)
  from omc_expedientes x left join omc_plan_lineas l on l.id = x.linea_id
  where x.empresa = (select empresa from omc_tok(p_token)) and x.activo = coalesce((p_filtro->>'activo')::boolean, true)
    and (p_filtro->>'tipo' is null or x.tipo = p_filtro->>'tipo') and (p_filtro->>'frente' is null or x.linea_id = omc_frente_id(x.empresa, p_filtro->>'frente'))
    and (p_filtro->>'responsable' is null or lower(x.responsable) = lower(omc_agente_valido(x.empresa, p_filtro->>'responsable')));
$$;

create or replace function omc_sesion_solicitar(p_token text, p_expediente bigint) returns jsonb
language plpgsql security definer set search_path=public as $$
declare t record; x omc_expedientes; s omc_sesiones;
begin
  select * into t from omc_tok(p_token);
  if t.rol <> 'owner' then raise exception 'solo owner' using errcode='42501'; end if;
  select * into x from omc_expedientes where id = p_expediente and empresa = t.empresa;
  if x.id is null then raise exception 'expediente % no existe', p_expediente; end if;
  if x.responsable is null then raise exception 'el expediente % no tiene responsable', x.nombre; end if;
  select * into s from omc_sesiones where expediente_id = x.id and agente = x.responsable and estado in ('solicitada','abierta') order by created_at desc limit 1;
  if s.id is not null then return to_jsonb(s); end if;
  insert into omc_sesiones (empresa, expediente_id, agente, solicitada_por, estado) values (t.empresa, x.id, x.responsable, 'diego', 'solicitada') returning * into s;
  return to_jsonb(s);
end $$;

create or replace function omc_sesion_abrir(p_token text, p_expediente bigint, p_agente text default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare t record; v_agente text; abierta_id bigint; s omc_sesiones;
begin
  select * into t from omc_tok(p_token);
  v_agente := coalesce(omc_agente_valido(t.empresa, case when t.rol = 'owner' then 'diego' else coalesce(p_agente,'agente') end), case when t.rol = 'owner' then 'diego' else coalesce(p_agente,'agente') end);
  if not exists (select 1 from omc_expedientes where id = p_expediente and empresa = t.empresa) then raise exception 'expediente % no existe', p_expediente; end if;
  select id into abierta_id from omc_sesiones where empresa = t.empresa and agente = v_agente and estado = 'abierta';
  if abierta_id is not null then raise exception 'cierra antes la sesión #% (hq.py sesion cerrar % --resumen "...")', abierta_id, abierta_id; end if;
  update omc_sesiones set estado = 'abierta', abierta = now() where empresa = t.empresa and expediente_id = p_expediente and agente = v_agente and estado = 'solicitada' returning * into s;
  if s.id is null then
    insert into omc_sesiones (empresa, expediente_id, agente, estado, abierta) values (t.empresa, p_expediente, v_agente, 'abierta', now()) returning * into s;
  end if;
  return jsonb_build_object('sesion', to_jsonb(s), 'ficha', omc_expediente_ficha(p_token, p_expediente));
end $$;

create or replace function omc_sesion_cerrar(p_token text, p_sesion bigint, p_resumen text, p_entregables jsonb default '[]'::jsonb, p_agente text default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare t record; s omc_sesiones; v_agente text; pendiente record; tocados bigint[];
begin
  select * into t from omc_tok(p_token);
  select * into s from omc_sesiones where id = p_sesion and empresa = t.empresa;
  if s.id is null then raise exception 'sesión % no existe', p_sesion; end if;
  if s.estado <> 'abierta' then raise exception 'la sesión #% está %', s.id, s.estado; end if;
  v_agente := case when t.rol = 'owner' then 'diego' else coalesce(p_agente,'agente') end;
  if t.rol <> 'owner' and lower(v_agente) <> 'chief' and coalesce(omc_agente_valido(t.empresa, v_agente), v_agente) <> s.agente then raise exception 'la sesión #% es de %', s.id, s.agente using errcode='42501'; end if;
  if coalesce(trim(p_resumen),'') = '' then raise exception 'falta resumen: --resumen "estado en una o dos frases"'; end if;
  for pendiente in select e.id from omc_encargos e where e.expediente_id = s.expediente_id and e.estado in ('en_curso','bloqueado_diego') and position(lower(s.agente) in lower(coalesce(e.agente,''))) > 0
    and not exists (select 1 from omc_encargo_avances a where a.encargo_id = e.id and a.fecha >= s.abierta and a.tipo in ('avance','cierre','estado')) loop
    raise exception 'falta avance en #%: hq.py encargo avance % --texto "..." (o hecho --fuente)', pendiente.id, pendiente.id;
  end loop;
  select coalesce(array_agg(distinct a.encargo_id), '{}') into tocados from omc_encargo_avances a join omc_encargos e on e.id = a.encargo_id where e.expediente_id = s.expediente_id and a.fecha >= s.abierta;
  update omc_sesiones set estado = 'cerrada', cerrada = now(), resumen = p_resumen, encargos_tocados = tocados where id = s.id returning * into s;
  update omc_expedientes set resumen_estado = p_resumen, resumen_fecha = now(), updated_at = now(),
    entregables = (select coalesce(jsonb_agg(case when exists (select 1 from jsonb_array_elements(p_entregables) n where n->>'nombre' = x->>'nombre') then x || '{"hecho": true}'::jsonb else x end), '[]'::jsonb) from jsonb_array_elements(entregables) x)
                  || (select coalesce(jsonb_agg(n || '{"hecho": true}'::jsonb), '[]'::jsonb) from jsonb_array_elements(p_entregables) n where not exists (select 1 from jsonb_array_elements(entregables) x where x->>'nombre' = n->>'nombre'))
  where id = s.expediente_id;
  return to_jsonb(s);
end $$;
grant execute on function omc_expediente_set(text, jsonb), omc_expediente_ficha(text, bigint), omc_expedientes_lista(text, jsonb), omc_sesion_solicitar(text, bigint),
  omc_sesion_abrir(text, bigint, text), omc_sesion_cerrar(text, bigint, text, jsonb, text) to anon, authenticated;

-- omc_encargo_contexto (T5, mas arriba en el fichero) se redefine aqui, no alli: es "language sql" y
-- Postgres valida el cuerpo contra el catalogo en el momento de crear la funcion (mismo motivo que el
-- esqueleto minimo de omc_kit/omc_contactos en T5), y omc_expedientes no existe todavia en ese punto del
-- fichero. Mismo cuerpo que en T5, sustituyendo el 'expediente' fijo a null por el expediente real.
-- T13 (revision, BLOCKING): la version anterior resolvia avances/contactos/frente/expediente contra
-- p_id sin comprobar la empresa del encargo (solo 'kit' filtraba por p_empresa) - con security definer y
-- grant a anon/authenticated (omc_encargo_ficha), un token de la empresa A podia leer el encargo, los
-- avances, los contactos (PII) y el expediente de un id de la empresa B. Ahora todo cuelga de la CTE e0,
-- que solo trae el encargo si es de p_empresa: con un id ajeno o inexistente e0 queda vacia, el FROM e0
-- del select principal no devuelve filas y la funcion entera responde null (mismo patron que
-- omc_contacto_ficha).
create or replace function omc_encargo_contexto(p_empresa text, p_id bigint) returns jsonb
language sql stable as $$
  with e0 as (select * from omc_encargos where id = p_id and empresa = p_empresa)
  select jsonb_build_object(
    'encargo', (select to_jsonb(e) || jsonb_build_object('codigo', l.codigo) from e0 e left join omc_plan_lineas l on l.id = e.linea_id),
    'frente', (select jsonb_build_object('id', l.id, 'codigo', l.codigo, 'linea', l.linea, 'kpi', l.kpi, 'meta', l.meta, 'valor_actual', l.valor_actual, 'responsable', l.responsable,
                 'bloque', b.letra || ' ' || b.nombre) from e0 e join omc_plan_lineas l on l.id = e.linea_id left join omc_plan_bloques b on b.id = l.bloque_id),
    'kit', (select coalesce(jsonb_agg(jsonb_build_object('id', k.id, 'tipo', k.tipo, 'nombre', k.nombre, 'url', k.url, 'texto', k.texto) order by k.tipo, k.nombre), '[]'::jsonb)
              from omc_kit k where k.empresa = p_empresa and k.vigente and (k.linea_id is null or k.linea_id = (select linea_id from e0))),
    'avances', (select coalesce(jsonb_agg(to_jsonb(a) order by a.fecha desc), '[]'::jsonb) from (select av.* from omc_encargo_avances av where av.encargo_id = (select id from e0) order by av.fecha desc limit 10) a),
    'contactos', (select coalesce(jsonb_agg(to_jsonb(c) order by c.fecha desc), '[]'::jsonb) from omc_contactos c where c.encargo_id = (select id from e0)),
    'expediente', (select to_jsonb(x) from omc_expedientes x where x.id = (select expediente_id from e0)))
  from e0;
$$;
revoke execute on function omc_encargo_contexto(text, bigint) from public, anon, authenticated;

-- HQ v2 (T11): sesiones solicitadas desde la ficha del expediente en HQ, para que hq-despertar.py
-- escriba la orden en la ventana tmux del agente sin esperar a que alguien lo arranque a mano.
create or replace function omc_sesiones_solicitadas(p_token text) returns jsonb
language sql security definer set search_path=public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'expediente_id', s.expediente_id, 'nombre', x.nombre, 'agente', s.agente, 'created_at', s.created_at) order by s.created_at), '[]'::jsonb)
  from omc_sesiones s join omc_expedientes x on x.id = s.expediente_id
  where s.empresa = (select empresa from omc_tok(p_token)) and s.estado = 'solicitada' and s.created_at > now() - interval '2 hours';
$$;
grant execute on function omc_sesiones_solicitadas(text) to anon, authenticated;

-- T12 · fichas de agentes: frentes, avatar y URL de sesión (Remote Control) para cambio de cuenta sin rotura
alter table omc_agentes add column if not exists frentes text[] default '{}';
alter table omc_agentes add column if not exists cuenta text check (cuenta in ('diego','team'));
alter table omc_agentes add column if not exists avatar_url text;
alter table omc_agentes add column if not exists sesion_url text;
alter table omc_agentes add column if not exists sesion_url_fecha timestamptz;

-- El propio agente por su token (rol 'agente', declarando p_agente) o el owner fijan la URL de la sesión
-- de Remote Control en curso. Concern (T12, se anota en el informe): el brief de esta tarea proponía
-- restringir "propio agente" comparando t.nombre (de omc_tokens) contra v_id, asumiendo nombre=''. En
-- producción el token de rol 'agente' de 77delta tiene nombre='agentes' (comprobado en vivo contra el
-- tenant pruebas, tabla omc_tokens: fila owner tiene nombre='Diego', la de agente nombre='agentes'), un
-- valor fijo que nunca coincide con ningún id de agente real - esa comparación habría bloqueado SIEMPRE
-- el camino "propio agente" en producción. Se resuelve del lado del código existente: igual que
-- omc_kit_set (T8) y omc_encargo_tomar, la identidad la da p_agente declarado (validado contra
-- omc_agente_valido, que exige activo=true en la empresa del token) y no hay comparación con t.nombre.
create or replace function omc_agente_sesion_url(p_token text, p_agente text, p_url text, p_cuenta text default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare t record; v_id text; r omc_agentes;
begin
  select * into t from omc_tok(p_token);
  v_id := omc_agente_valido(t.empresa, p_agente);
  if v_id is null then raise exception 'agente % no existe', p_agente; end if;
  if p_url !~ '^https://(claude\.ai|claude\.com)/' then raise exception 'sesion_url debe ser una URL de claude.ai (Remote Control)'; end if;
  update omc_agentes set sesion_url = p_url, sesion_url_fecha = now(), cuenta = coalesce(p_cuenta, cuenta) where empresa = t.empresa and id = v_id returning * into r;
  return jsonb_build_object('id', r.id, 'nombre', r.nombre, 'sesion_url', r.sesion_url, 'cuenta', r.cuenta, 'sesion_url_fecha', r.sesion_url_fecha);
end $$;

-- Solo owner: avatar_url no lo toca omc_agente_set (schema.sql 886, no admite ese campo; se deja así y se
-- añade este setter pequeño para no tocar una RPC ya estable con más superficie de la necesaria).
create or replace function omc_agente_avatar_set(p_token text, p_agente text, p_url text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare t record; v_id text; r omc_agentes;
begin
  select * into t from omc_tok(p_token);
  if t.rol <> 'owner' then raise exception 'solo owner' using errcode='42501'; end if;
  v_id := omc_agente_valido(t.empresa, p_agente);
  if v_id is null then raise exception 'agente % no existe', p_agente; end if;
  update omc_agentes set avatar_url = p_url where empresa = t.empresa and id = v_id returning * into r;
  return jsonb_build_object('id', r.id, 'avatar_url', r.avatar_url);
end $$;

create or replace function omc_agente_frentes_set(p_token text, p_agente text, p_frentes text[]) returns jsonb
language plpgsql security definer set search_path=public as $$
declare t record; v_id text; f text; r omc_agentes;
begin
  select * into t from omc_tok(p_token);
  if t.rol <> 'owner' then raise exception 'solo owner' using errcode='42501'; end if;
  v_id := omc_agente_valido(t.empresa, p_agente);
  if v_id is null then raise exception 'agente % no existe', p_agente; end if;
  foreach f in array p_frentes loop
    if omc_frente_id(t.empresa, f) is null then raise exception 'frente % no existe', f; end if;
  end loop;
  update omc_agentes set frentes = (select coalesce(array_agg(upper(x)), '{}') from unnest(p_frentes) x) where empresa = t.empresa and id = v_id returning * into r;
  return jsonb_build_object('id', r.id, 'frentes', r.frentes);
end $$;

create or replace function omc_agentes_lista(p_token text) returns jsonb
language sql security definer set search_path=public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'nombre', a.nombre, 'depto', a.depto, 'nivel', a.nivel, 'modelo', a.contrato->>'modelo', 'activo', a.activo,
    'frentes', a.frentes, 'frentes_codigos', a.frentes, 'cuenta', a.cuenta, 'avatar_url', a.avatar_url, 'sesion_url', a.sesion_url, 'sesion_url_fecha', a.sesion_url_fecha,
    'ultima_actividad', a.ultima_actividad,
    'encargos_abiertos', (select count(*) from omc_encargos e where e.empresa = a.empresa and e.estado in ('encolado','en_curso','bloqueado_diego') and position(lower(a.id) in lower(coalesce(e.agente,''))) > 0),
    'sesion_abierta', (select s.expediente_id from omc_sesiones s where s.empresa = a.empresa and s.agente = a.id and s.estado = 'abierta' limit 1)
  ) order by a.depto, a.nivel, a.nombre), '[]'::jsonb)
  from omc_agentes a where a.empresa = (select empresa from omc_tok(p_token));
$$;
grant execute on function omc_agente_sesion_url(text, text, text, text), omc_agente_avatar_set(text, text, text), omc_agente_frentes_set(text, text, text[]), omc_agentes_lista(text) to anon, authenticated;

-- T13 · latido con encargos abiertos y sesión: sobrescribe la omc_latido de schema.sql (misma firma, para
-- que "create or replace" reemplace la implementación sin tocar los grants ya concedidos allí). La rama
-- "no existe" y el bloque "base" son literales de schema.sql 1153-1163: hq.py y hq-latido.sh dependen de
-- esas claves exactas (incluida 'agente' en la rama "no existe", que hq.py imprime cuando existe=false).
create or replace function public.omc_latido(p_token text, p_agente text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.omc_tokens; a public.omc_agentes; base jsonb;
begin
  t := public.omc_tok(p_token);
  select * into a from public.omc_agentes where empresa = t.empresa and (id = p_agente or p_agente = any(sesiones)) order by (id = p_agente) desc limit 1;
  if not found then return jsonb_build_object('existe', false, 'activo', true, 'agente', p_agente); end if;
  update public.omc_agentes set ultima_actividad = now() where empresa = t.empresa and id = a.id;
  base := jsonb_build_object('existe', true, 'activo', a.activo, 'agente', a.id, 'nombre', a.nombre, 'depto', a.depto, 'nivel', a.nivel,
                            'modelo', a.contrato->>'modelo', 'subagentes', a.contrato->>'subagentes',
                            'pendientes', (select count(*) from public.omc_solicitudes s where s.empresa = t.empresa and s.agente = a.id and s.estado in ('aprobada','respondida')),
                            'comentarios', (select coalesce(jsonb_agg(distinct s.id), '[]'::jsonb) from public.omc_mensajes m join public.omc_solicitudes s on s.id = m.solicitud_id
                                            where s.empresa = t.empresa and s.agente = a.id and s.estado = 'pendiente' and m.autor = 'diego'
                                              and m.ts > coalesce((select max(m2.ts) from public.omc_mensajes m2 where m2.solicitud_id = s.id and m2.autor <> 'diego'), s.created_at)));
  return base || jsonb_build_object(
    'encargos', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'codigo', l.codigo, 'texto', left(e.texto, 90), 'estado', e.estado, 'fecha_hito', e.fecha_hito,
        'kit_n', (select count(*) from public.omc_kit k where k.empresa = e.empresa and k.vigente and (k.linea_id = e.linea_id or k.linea_id is null)))
        order by case e.estado when 'en_curso' then 0 when 'bloqueado_diego' then 1 else 2 end, e.fecha_hito nulls last, e.id), '[]'::jsonb)
      from public.omc_encargos e left join public.omc_plan_lineas l on l.id = e.linea_id
      where e.empresa = t.empresa and e.estado in ('encolado','en_curso','bloqueado_diego') and position(lower(a.id) in lower(coalesce(e.agente,''))) > 0),
    'sesion', (select jsonb_build_object('id', s.id, 'expediente_id', s.expediente_id, 'nombre', x.nombre, 'estado', s.estado) from public.omc_sesiones s join public.omc_expedientes x on x.id = s.expediente_id
      where s.empresa = t.empresa and s.agente = a.id and s.estado in ('solicitada','abierta') order by s.estado limit 1));
end $$;

-- omc_encargo_ficha: alias publico de omc_encargo_contexto (interna, revocada de anon/authenticated más
-- arriba en este fichero) para que "hq.py encargo ficha ID" muestre kit, avances, contactos y expediente
-- sin tomar el encargo. Concern (T13, se anota en el informe): el brief no pedía "security definer", pero
-- sin ella la llamada de anon/authenticated a omc_tok y omc_encargo_contexto (ambas revocadas de esos
-- roles) fallaría siempre; se resuelve del lado del patrón ya usado por omc_sesiones_solicitadas.
-- T13 (revision, BLOCKING): omc_encargo_contexto ahora devuelve null si el id no es de la empresa del
-- token (ver comentario mas arriba); language plpgsql en vez de sql para poder comprobarlo y lanzar
-- excepcion en vez de devolver null en silencio, igual que "encargo no existe" en otros comandos.
create or replace function omc_encargo_ficha(p_token text, p_id bigint) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_empresa text; v_ctx jsonb;
begin
  select empresa into v_empresa from omc_tok(p_token);
  v_ctx := omc_encargo_contexto(v_empresa, p_id);
  if v_ctx is null then
    raise exception 'encargo % no existe en esta empresa', p_id using errcode = 'P0002';
  end if;
  return v_ctx;
end $$;
grant execute on function omc_encargo_ficha(text, bigint) to anon, authenticated;

-- T14 · omc_escalar: una sola firma, siempre a Diego, con motivo en el hilo. Sustituye las dos firmas de
-- schema.sql (2 args) y la añadida en caliente en producción (3er parámetro p_agente, nunca llegó a
-- schema.sql) por una única omc_escalar(p_token, p_id, p_motivo default null). Se filtra por t.empresa
-- (igual que el resto de RPC v2, T13) para que no se pueda escalar una tarjeta de otra empresa.
-- Concern (T14, se anota en el informe): la interfaz pedía restringir a "owner, chief o el agente autor
-- de la tarjeta", pero omc_tokens solo distingue rol owner/agente (un único token "agente" compartido
-- por todo el equipo, sin id de agente); con ese modelo no hay forma de comprobar autoría ni un rol
-- "chief" aparte, así que cualquier token válido de la empresa puede escalar cualquier tarjeta de esa
-- empresa. Se deja sin ese control, igual que hacía ya omc_comentar con p_agente de solo etiqueta.
-- Sin pg_notify (a diferencia del borrador del brief): ninguna otra RPC de este fichero lo usa: la UI
-- v1 se refresca con el realtime de tabla de Supabase sobre omc_solicitudes/omc_mensajes, no con
-- pg_notify a mano.
drop function if exists omc_escalar(text, bigint);
drop function if exists omc_escalar(text, bigint, text);
create or replace function omc_escalar(p_token text, p_id bigint, p_motivo text default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare t record; s omc_solicitudes; v_actor text;
begin
  select * into t from omc_tok(p_token);
  select * into s from omc_solicitudes where id = p_id and empresa = t.empresa;
  if s.id is null then raise exception 'tarjeta % no existe', p_id; end if;
  v_actor := case when t.rol = 'owner' then 'diego' else 'agente' end;
  update omc_solicitudes set destinatario = 'diego' where id = s.id returning * into s;
  insert into omc_mensajes (empresa, solicitud_id, autor, texto) values (t.empresa, s.id, v_actor, '[escalado a Diego] ' || coalesce(p_motivo, 'sin motivo'));
  return jsonb_build_object('id', s.id, 'destinatario', s.destinatario, 'estado', s.estado);
end $$;
grant execute on function omc_escalar(text, bigint, text) to anon, authenticated;

-- T15 · omc_encargos_lista añade los campos v2 (origen, motivo_descarte, codigo) que ya tiene
-- omc_encargo_ficha desde T13/T14: hq-informe.py y hq-parados.py los necesitan para agrupar "lo que
-- pediste esta semana" por origen y mostrar el frente (codigo) de cada encargo. Misma firma que
-- schema.sql (no se dropea: create or replace basta y conserva los grants ya existentes).
create or replace function public.omc_encargos_lista(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.omc_tokens;
begin
  t := public.omc_tok(p_token);
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'id', e.id, 'fecha', e.fecha, 'texto', e.texto, 'interpretacion', e.interpretacion, 'linea_id', e.linea_id,
      'departamento', e.departamento, 'agente', e.agente, 'estado', e.estado, 'prioridad', e.prioridad,
      'solicitud_id', e.solicitud_id, 'proximo_hito', e.proximo_hito, 'fecha_hito', e.fecha_hito,
      'ultimo_avance', e.ultimo_avance, 'fecha_avance', e.fecha_avance, 'creado_por', e.creado_por, 'updated_at', e.updated_at, 'espera', e.espera, 'mensaje_id', e.mensaje_id,
      'antiguo', e.estado not in ('hecho','descartado') and coalesce(e.fecha_avance, e.fecha) < now() - interval '48 hours',
      'origen', e.origen, 'motivo_descarte', e.motivo_descarte, 'codigo', l.codigo
    ) order by e.linea_id nulls last, e.prioridad), '[]'::jsonb)
    from public.omc_encargos e left join public.omc_plan_lineas l on l.id = e.linea_id where e.empresa = t.empresa);
end $$;
grant execute on function omc_encargos_lista(text) to anon, authenticated;

notify pgrst, 'reload schema';

-- T16 · omc_hq_v2: lectura unica para la interfaz nueva (cascada objetivo -> bloque -> frente -> encargo).
-- Reutiliza omc_hq(p_token) para 'pendientes' y 'licitaciones' (no se duplica esa consulta), pero omc_hq
-- y omc_hq_uso son "solo owner" (schema.sql 337 y 778): para un token de agente se saltan esas llamadas y
-- se devuelve '[]'/'{}' en esas claves, en vez de dejar que la excepcion tumbe todo omc_hq_v2.
-- Columnas verificadas en schema.sql antes de escribir esto (el brief traia nombres que no existen):
-- omc_plan_objetivo es (empresa, horizonte, titulo, meta, unidad, fecha_limite), no (meta_eur, kpi, texto).
-- omc_licitaciones no tiene fecha_presentada ni fecha_limite: la fecha de cierre es 'cierre' y la decision
-- de Diego es 'OK'/'No'/'Pendiente' (omc_licitacion_decidir, schema.sql 1063), no 'presentar'.
create or replace function omc_columna_kanban(p_estado text, p_prioridad int, p_fecha_hito date) returns text
language sql immutable as $$
  select case p_estado
    when 'en_curso' then 'en_curso' when 'bloqueado_diego' then 'bloqueado'
    when 'hecho' then 'hecho' when 'descartado' then 'hecho'
    else case when p_fecha_hito is null or coalesce(p_prioridad, 0) >= 8 then 'backlog' else 'por_hacer' end end; -- prioridad es int (0 alta ... 9 baja) en omc_encargos
$$;

create or replace function omc_hq_v2(p_token text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare t record; base jsonb; ahora timestamptz := now(); es_owner boolean;
begin
  select * into t from omc_tok(p_token); es_owner := t.rol = 'owner';
  if es_owner then base := omc_hq(p_token); else base := '{}'::jsonb; end if;
  return jsonb_build_object(
    'version', omc_v2_version(), 'ahora', ahora, 'rol', t.rol,
    'objetivos', (select coalesce(jsonb_agg(jsonb_build_object('horizonte', o.horizonte, 'titulo', o.titulo, 'meta', o.meta, 'unidad', o.unidad, 'fecha_limite', o.fecha_limite,
        'contratado_eur', (select coalesce(sum(i.importe),0) from omc_ingresos i where i.empresa = t.empresa and i.estado in ('contratado','facturado','cobrado') and extract(year from i.fecha) = o.horizonte),
        'presentado_eur', (select coalesce(sum(l.importe),0) from omc_licitaciones l where l.empresa = t.empresa and l.decision = 'OK' and extract(year from coalesce(l.fecha_decision, l.cierre)) = o.horizonte)) order by o.horizonte), '[]'::jsonb)
      from omc_plan_objetivo o where o.empresa = t.empresa),
    'bloques', (select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'letra', b.letra, 'nombre', b.nombre, 'meta_eur', b.meta_eur, 'director', b.director, 'orden', b.orden,
        'frentes_n', (select count(*) from omc_plan_lineas l where l.bloque_id = b.id and l.activa),
        'encargos_abiertos', (select count(*) from omc_encargos e join omc_plan_lineas l on l.id = e.linea_id where l.bloque_id = b.id and e.estado in ('encolado','en_curso','bloqueado_diego')),
        'contratado_eur', 0) order by b.orden), '[]'::jsonb) -- sin vinculo omc_ingresos-bloque en el esquema actual (omc_ingresos no tiene linea_id ni bloque_id): siempre 0 hasta que exista esa columna
      from omc_plan_bloques b where b.empresa = t.empresa and b.activo),
    'frentes', omc_frentes_lista(p_token),
    'encargos', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'codigo', l.codigo, 'bloque_letra', b.letra, 'texto', e.texto, 'interpretacion', e.interpretacion, 'estado', e.estado,
        'columna', omc_columna_kanban(e.estado, e.prioridad, e.fecha_hito), 'prioridad', e.prioridad, 'agente', e.agente, 'responsable', e.agente, 'departamento', e.departamento,
        'fecha_hito', e.fecha_hito, 'proximo_hito', e.proximo_hito, 'ultimo_avance', e.ultimo_avance, 'fecha_avance', e.fecha_avance,
        'rojo', (e.estado = 'en_curso' and coalesce(e.fecha_avance, e.fecha) < ahora - interval '48 hours'),
        'etiquetas', e.etiquetas, 'enlaces', e.enlaces, 'orden_kanban', e.orden_kanban, 'origen', e.origen, 'expediente_id', e.expediente_id,
        'fuente_cierre', e.fuente_cierre, 'entregable_url', e.entregable_url, 'motivo_descarte', e.motivo_descarte, 'fecha', e.fecha,
        'avances_n', (select count(*) from omc_encargo_avances a where a.encargo_id = e.id)) order by e.orden_kanban nulls last, e.fecha_hito nulls last, e.id), '[]'::jsonb)
      from omc_encargos e left join omc_plan_lineas l on l.id = e.linea_id left join omc_plan_bloques b on b.id = l.bloque_id
      where e.empresa = t.empresa and (e.estado in ('encolado','en_curso','bloqueado_diego') or coalesce(e.fecha_avance, e.fecha) > ahora - interval '14 days')),
    'avances', omc_feed(p_token, ahora - interval '3 days'), -- T16 Step 4: recortado de 7 a 3 dias, medido en produccion (3,84 MB con 7 dias, ver informe)
    'kit', omc_kit_lista(p_token),
    'contactos', (select coalesce(jsonb_agg(c), '[]'::jsonb) from jsonb_array_elements(omc_contactos_lista(p_token, '{}'::jsonb)) c
        where (c->>'fecha')::timestamptz >= ahora - interval '14 days' or ((c->>'estado') = 'enviado' and (c->>'proximo_toque')::date <= current_date)), -- T16 Step 4: 14 dias + pendientes reales de toque, ya no historial completo
    'expedientes', omc_expedientes_lista(p_token, '{}'::jsonb),
    'sesiones', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'expediente_id', s.expediente_id, 'nombre', x.nombre, 'agente', s.agente, 'estado', s.estado, 'abierta', s.abierta, 'created_at', s.created_at) order by s.created_at desc), '[]'::jsonb)
      from omc_sesiones s join omc_expedientes x on x.id = s.expediente_id where s.empresa = t.empresa and s.estado in ('abierta','solicitada')),
    'agentes', (select coalesce(jsonb_agg(case when es_owner or a->>'id' = t.nombre then a else a - 'sesion_url' end), '[]'::jsonb) from jsonb_array_elements(omc_agentes_lista(p_token)) a),
    'pendientes', case when es_owner then coalesce(base->'pendientes', '[]'::jsonb) else '[]'::jsonb end,
    -- Ajuste por rulings del controlador (tarea 16): 'licitaciones' es, con mucho, la clave mas pesada
    -- (3,36 MB de 3,84 MB medidos en produccion con 1641 filas, el 90% en decision='Pendiente'). Ruling
    -- paso 1: lo cerrado hace mas de una semana no va al tablero (el historico se sirve en el plan 2 con
    -- una RPC paginada aparte); medido en produccion, esto solo baja de 1641 a 1603 filas (la mayoria de
    -- 'Pendiente' tiene cierre futuro o nulo, no pasado) y deja el total en 2,37 MB, seguia por encima de
    -- 1,5 MB. Ruling paso 2 (aplicado): se recorta a solo los campos minimos que pide el controlador
    -- (resumen_corto, objeto, organo, importe, cierre, decision, expediente como id, enlace como url);
    -- fuera quedan provincia, tipo, procedimiento, elegible, detectada, estado, fecha_decision, progreso.
    -- El listado completo con esos campos y los de texto largo (resumen, comentarios, pcap, ppt,
    -- motivo_auto, solvencia) sigue disponible via omc_licitaciones_lista u omc_hq para quien lo necesite.
    'licitaciones', case when es_owner then (
        select coalesce(jsonb_agg(jsonb_build_object(
          'expediente', x->>'expediente', 'organo', x->>'organo', 'objeto', x->>'objeto',
          'resumen_corto', x->>'resumen_corto', 'importe', (x->>'importe')::numeric,
          'cierre', (x->>'cierre')::date, 'enlace', x->>'enlace', 'decision', x->>'decision'
        )), '[]'::jsonb)
        from jsonb_array_elements(coalesce(base->'licitaciones', '[]'::jsonb)) x
        where (x->>'cierre') is null or (x->>'cierre')::date >= (ahora - interval '7 days')::date
      ) else '[]'::jsonb end,
    'uso', case when es_owner and exists (select 1 from pg_proc where proname = 'omc_hq_uso') then omc_hq_uso(p_token) else '{}'::jsonb end
  );
end $$;
grant execute on function omc_columna_kanban(text, int, date), omc_hq_v2(text) to anon, authenticated;

notify pgrst, 'reload schema';
