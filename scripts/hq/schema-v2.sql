-- scripts/hq/schema-v2.sql · HQ v2: fuente única en cascada. Idempotente. Se aplica DESPUÉS de schema.sql.
-- Convención: cada sección lleva el número de tarea del plan 2026-09-16-hq-v2-plan-1-base.md.

-- T1 · versión del esquema v2 (los tests la usan como centinela)
create or replace function omc_v2_version() returns text language sql immutable as $$ select '2.0.1' $$;
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

create or replace function omc_encargo_contexto(p_empresa text, p_id bigint) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'encargo', (select to_jsonb(e) || jsonb_build_object('codigo', l.codigo) from omc_encargos e left join omc_plan_lineas l on l.id = e.linea_id where e.id = p_id),
    'frente', (select jsonb_build_object('id', l.id, 'codigo', l.codigo, 'linea', l.linea, 'kpi', l.kpi, 'meta', l.meta, 'valor_actual', l.valor_actual, 'responsable', l.responsable,
                 'bloque', b.letra || ' ' || b.nombre) from omc_encargos e join omc_plan_lineas l on l.id = e.linea_id left join omc_plan_bloques b on b.id = l.bloque_id where e.id = p_id),
    'kit', (select coalesce(jsonb_agg(jsonb_build_object('id', k.id, 'tipo', k.tipo, 'nombre', k.nombre, 'url', k.url, 'texto', k.texto) order by k.tipo, k.nombre), '[]'::jsonb)
              from omc_kit k where k.empresa = p_empresa and k.vigente and (k.linea_id is null or k.linea_id = (select linea_id from omc_encargos where id = p_id))),
    'avances', (select coalesce(jsonb_agg(to_jsonb(a) order by a.fecha desc), '[]'::jsonb) from (select * from omc_encargo_avances where encargo_id = p_id order by fecha desc limit 10) a),
    'contactos', '[]'::jsonb,
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

notify pgrst, 'reload schema';
