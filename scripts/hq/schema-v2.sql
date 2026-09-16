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

notify pgrst, 'reload schema';
