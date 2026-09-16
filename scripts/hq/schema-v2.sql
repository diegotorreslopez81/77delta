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

notify pgrst, 'reload schema';
