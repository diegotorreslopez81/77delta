-- scripts/hq/schema-v3-crm.sql · HQ v3 · lote 1 "datos primero" (18-sep-2026). CRM MVP dentro de HQ.
--
-- Contexto: decisión de Diego del 18-sep-2026: tres fuentes de la verdad y ninguna más (HQ en Supabase,
-- Engram, Google Drive). Gmail es canal, no fuente. Twenty y Notion quedan fuera. El CRM nace aquí, muy MVP,
-- y crece columna a columna según uso: cliente, personas de contacto, expediente (se amplía el actual),
-- interacción por canal, colaborador y colaboración, servicio y certificación de empresa.
--
-- Reglas de este fichero:
--   · aditivo e idempotente: create table if not exists / add column if not exists / create or replace.
--     Nunca drop ni truncate. Se puede aplicar tantas veces como haga falta.
--   · toda tabla nueva lleva RLS activado y sin políticas: no es legible por REST directo, solo por RPC con
--     token (omc_tok), igual que el resto de omc_* ("ninguna tabla expuesta a anon", cabecera de schema.sql).
--   · sin DNI, móvil personal ni IBAN en ninguna tabla del CRM (orden de Diego). Teléfono y correo de
--     empresa de las personas de contacto sí.
--   · se aplica DESPUÉS de schema.sql y schema-v2.sql (aplicar-schema.sh). omc_hq_v2 (schema-v2.sql, plpgsql)
--     llama a omc_lic_presentada, definida aquí: plpgsql resuelve en ejecución, no al crear, así que el orden
--     de aplicación no rompe una instalación limpia.
--   · vocabularios de estado: listas cerradas en CHECK, en minúsculas y sin acentos, para que la UI y los
--     scripts no tengan que adivinar (lección de la v2: vocabularios duplicados entre JS y SQL).

create or replace function omc_v3_version() returns text language sql immutable as $$ select '3.0.0' $$;
grant execute on function omc_v3_version() to anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- T1 · Clientes. Una fila por empresa, administración o entidad con la que facturamos o queremos facturar.
-- nombre = razón social tal como factura; nombre_corto = como la llamamos en HQ (coincide con
-- omc_expedientes.nombre y omc_ingresos.cliente cuando existen). carpeta_url = carpeta raíz del cliente en
-- Drive (la fuente documental). ficha_url = ficha pública en 77delta.com/<slug>, SIN token.
-- portal_org_id = organizations.id del portal de cupones (misma base): permite sincronizar sin duplicar.
create table if not exists omc_clientes (
  id bigserial primary key, empresa text not null references omc_empresas(id),
  nombre text not null, nombre_corto text, nif text,
  tipo text not null default 'empresa' check (tipo in ('empresa','administracion','autonomo','entidad')),
  sector text, cnae text, web text, localidad text, carpeta_url text, ficha_url text,
  estado text not null default 'activo' check (estado in ('prospecto','activo','inactivo','perdido')),
  origen text, responsable text, notas text, portal_org_id uuid,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  unique (empresa, nombre));
create unique index if not exists omc_clientes_nif on omc_clientes (empresa, upper(nif)) where nif is not null;
create unique index if not exists omc_clientes_corto on omc_clientes (empresa, lower(nombre_corto)) where nombre_corto is not null;
alter table omc_clientes enable row level security;

-- T2 · Personas de contacto del cliente (correo y teléfono de empresa; nunca DNI).
create table if not exists omc_personas (
  id bigserial primary key, empresa text not null references omc_empresas(id),
  cliente_id bigint not null references omc_clientes(id) on delete cascade,
  nombre text not null, cargo text, email text, telefono text, linkedin_url text, idioma text,
  principal boolean not null default false, activo boolean not null default true, notas text,
  created_at timestamptz default now(), updated_at timestamptz default now());
create index if not exists omc_personas_cliente on omc_personas (cliente_id);
create index if not exists omc_personas_email on omc_personas (empresa, lower(email));
alter table omc_personas enable row level security;

-- T3 · Expedientes: se amplía la tabla de la v2. `tipo` (cliente/producto/convocatoria/licitacion) sigue
-- diciendo qué clase de tarjeta es; `tipologia` dice qué vendemos o tramitamos (cupón, ayuda, licitación,
-- contrato, servicio, formación). `codigo` = código oficial (nº de expediente ACCIÓ, expediente PLACSP,
-- nº de contrato). `estado_economico` usa el mismo vocabulario que omc_ingresos.estado.
alter table omc_expedientes
  add column if not exists cliente_id bigint references omc_clientes(id) on delete set null,
  add column if not exists tipologia text check (tipologia in ('cupon','ayuda','licitacion','contrato','servicio','formacion','producto','otro')),
  add column if not exists codigo text,
  add column if not exists estado_economico text check (estado_economico in ('sin_importe','propuesto','concedido','contratado','facturado','cobrado','perdido')),
  add column if not exists fecha_inicio date,
  add column if not exists fecha_fin date,
  add column if not exists notas text;
create index if not exists omc_expedientes_cliente on omc_expedientes (cliente_id);

-- T4 · Enlaces desde lo que ya existía: ingresos, contactos (outreach) y licitaciones apuntan al cliente.
alter table omc_ingresos
  add column if not exists cliente_id bigint references omc_clientes(id) on delete set null,
  add column if not exists expediente_id bigint references omc_expedientes(id) on delete set null;
create index if not exists omc_ingresos_cliente on omc_ingresos (cliente_id);
alter table omc_contactos
  add column if not exists cliente_id bigint references omc_clientes(id) on delete set null,
  add column if not exists persona_id bigint references omc_personas(id) on delete set null;
create index if not exists omc_contactos_cliente on omc_contactos (cliente_id);
-- el órgano contratante como cliente tipo 'administracion'; se rellena cuando hay adjudicación o contrato.
alter table omc_licitaciones add column if not exists cliente_id bigint references omc_clientes(id) on delete set null;

-- T5 · Colaboradores y formadores (perfiles técnicos y formadoras). Sin DNI, móvil personal ni IBAN: eso vive en
-- su carpeta de Drive (carpeta_url) y en facturación. acuerdo_fecha no nula = colaborador con acuerdo
-- firmado (KPI A4 "colaboradores con acuerdo").
create table if not exists omc_colaboradores (
  id bigserial primary key, empresa text not null references omc_empresas(id),
  nombre text not null, perfil text, especialidades text[] not null default '{}',
  email text, linkedin_url text, foto_url text, cv_url text, carpeta_url text,
  tarifa_dia numeric, disponibilidad text, ubicacion text, idiomas text[] not null default '{}',
  origen text check (origen in ('red','referido','linkedin','upwork','cliente','otro')),
  estado text not null default 'candidato' check (estado in ('candidato','contactado','activo','inactivo')),
  acuerdo_fecha date, acuerdo_url text, notas text,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  unique (empresa, nombre));
alter table omc_colaboradores enable row level security;

-- T6 · Colaboraciones: qué colaborador va en qué expediente o licitación, con qué rol y en qué estado.
-- Al redactar una memoria el agente busca aquí y en omc_colaboradores; si no hay perfil adecuado abre un
-- encargo de búsqueda (LinkedIn, Upwork).
create table if not exists omc_colaboraciones (
  id bigserial primary key, empresa text not null references omc_empresas(id),
  colaborador_id bigint not null references omc_colaboradores(id) on delete cascade,
  expediente_id bigint references omc_expedientes(id) on delete cascade,
  licitacion_expediente text, rol text, horas numeric, importe numeric,
  estado text not null default 'propuesto' check (estado in ('propuesto','comprometido','ejecutando','cerrado','descartado')),
  notas text, created_at timestamptz default now(), updated_at timestamptz default now());
create index if not exists omc_colaboraciones_colab on omc_colaboraciones (colaborador_id);
create index if not exists omc_colaboraciones_exp on omc_colaboraciones (expediente_id);
alter table omc_colaboraciones enable row level security;

-- T7 · Interacciones por canal (correo, LinkedIn, llamada, reunión...). El contenido vive en el canal;
-- aquí queda el rastro: con quién, sobre qué expediente, referencia (id del mensaje de Gmail, URL) y si
-- exige acción de Diego (pendiente = aviso en HQ). Es la base del lote 1d "correo vinculado a cliente".
create table if not exists omc_interacciones (
  id bigserial primary key, empresa text not null references omc_empresas(id),
  cliente_id bigint references omc_clientes(id) on delete cascade,
  persona_id bigint references omc_personas(id) on delete set null,
  expediente_id bigint references omc_expedientes(id) on delete set null,
  colaborador_id bigint references omc_colaboradores(id) on delete set null,
  contacto_id bigint references omc_contactos(id) on delete set null,
  canal text not null check (canal in ('correo','linkedin','llamada','reunion','whatsapp','plataforma','formulario')),
  sentido text not null default 'salida' check (sentido in ('entrada','salida')),
  fecha timestamptz not null default now(), asunto text, resumen text, ref text, agente text,
  pendiente boolean not null default false, atendido_por text, atendido_fecha timestamptz,
  created_at timestamptz default now());
create index if not exists omc_interacciones_cliente on omc_interacciones (cliente_id, fecha desc);
create index if not exists omc_interacciones_pend on omc_interacciones (empresa, fecha desc) where pendiente;
create unique index if not exists omc_interacciones_ref on omc_interacciones (empresa, canal, ref) where ref is not null;
alter table omc_interacciones enable row level security;

-- T8 · Servicios: catálogo de lo que vendemos y de lo que desarrollamos (incluida Corpora, corpora.cat).
-- `linea` usa el vocabulario de omc_ingresos.linea para poder cruzar ingresos por servicio.
create table if not exists omc_servicios (
  id bigserial primary key, empresa text not null references omc_empresas(id),
  codigo text not null, nombre text not null,
  marca text not null default '77delta' check (marca in ('77delta','corpora','infinitelabs','nga')),
  linea text check (linea in ('cupones','licitaciones','consultoria','producto','formacion','otro')),
  linea_id bigint references omc_plan_lineas(id) on delete set null,
  descripcion text, publico text, precio_desde numeric, unidad text,
  estado text not null default 'activo' check (estado in ('idea','desarrollo','piloto','activo','retirado')),
  url text, carpeta_url text, responsable text, notas text,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  unique (empresa, codigo));
alter table omc_servicios enable row level security;

-- T9 · Certificaciones y habilitaciones de empresa (RELI, ROLECE, ENS, ISO...): seguimiento de cuáles
-- hacen falta para facturar mucho en 2027. requerida_por = para qué sirve cada una (licitaciones de la
-- Generalitat, hosting de datos de la administración, clientes corporativos...). KPI E1 = activas.
create table if not exists omc_certificaciones (
  id bigserial primary key, empresa text not null references omc_empresas(id),
  codigo text not null, nombre text not null,
  tipo text not null check (tipo in ('registro','norma','seguridad','calidad','sello','habilitacion')),
  organismo text, numero text, expediente text,
  estado text not null default 'no_iniciada' check (estado in ('no_iniciada','en_tramite','activa','caducada','descartada')),
  fecha_solicitud date, fecha_obtencion date, fecha_caducidad date, coste_estimado numeric, coste_real numeric,
  requerida_por text[] not null default '{}', prioridad int not null default 3 check (prioridad between 1 and 5),
  carpeta_url text, responsable text, proximo_paso text, fecha_hito date, notas text,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  unique (empresa, codigo));
alter table omc_certificaciones enable row level security;

-- ---------------------------------------------------------------------------------------------------------
-- T10 · KPIs vivos. Una licitación cuenta como PRESENTADA por su ESTADO, nunca por `decision`: decision='OK'
-- solo dice que se aprobó ir a por ella (a 18-sep-2026 hay 81 'OK'/'Descartada' y 20 'OK'/'Cerrada sin
-- presentar'). Por eso el objetivo "presentado" de Home no se movía y la línea A3 marcaba 0. La columna
-- `decision` NO se normaliza (orden de Diego); la lectura correcta es esta función, única para omc_hq_v2
-- (objetivos de Home) y para omc_plan_lineas_recalcular_sql (barras por línea).
-- Vocabulario real de omc_licitaciones.estado: Presentada, Adjudicada, Contratada, No adjudicada (cuentan);
-- Aprobada, En redacción, Por decidir, Nueva, Pausada, Cerrada sin presentar, Descartada, Retirada (no).
create or replace function omc_lic_presentada(p_estado text) returns boolean language sql immutable as $$
  select lower(coalesce(p_estado, '')) in ('presentada','en resolución','en resolucion','adjudicada','contratada','no adjudicada')
$$;
grant execute on function omc_lic_presentada(text) to anon, authenticated;

-- Sustituye a la versión de schema.sql (8-sep): mismas dos métricas de entonces más las del CRM. sql_metrica
-- sigue siendo una CLAVE FIJA de esta lista cerrada: nunca se ejecuta SQL que venga de fuera. Añadir una
-- métrica = añadir un WHEN aquí. Llamado por el cron hq-plan-kpis.py y tras cada seed.
-- Año en curso por defecto; una fila sin fecha cuenta (mejor sobrar que ocultar).
create or replace function public.omc_plan_lineas_recalcular_sql(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.omc_tokens; l record; v numeric; n int := 0; ini date; anyo int;
begin
  t := public.omc_tok(p_token);
  ini := date_trunc('quarter', current_date)::date;
  anyo := extract(year from current_date)::int;
  for l in select id, sql_metrica from public.omc_plan_lineas where empresa = t.empresa and activa and fuente = 'sql' loop
    v := case l.sql_metrica
      when 'licitaciones_ganables_eur' then
        (select coalesce(sum(importe), 0) from public.omc_licitaciones where empresa = t.empresa and lower(estado) in ('adjudicada','contratada'))
      when 'licitaciones_presentadas_eur' then
        (select coalesce(sum(importe), 0) from public.omc_licitaciones where empresa = t.empresa and public.omc_lic_presentada(estado)
           and (coalesce(cierre, fecha_decision) is null or extract(year from coalesce(cierre, fecha_decision)) = anyo))
      when 'licitaciones_presentadas_n' then
        (select count(*)::numeric from public.omc_licitaciones where empresa = t.empresa and public.omc_lic_presentada(estado)
           and (coalesce(cierre, fecha_decision) is null or extract(year from coalesce(cierre, fecha_decision)) = anyo))
      when 'ingresos_nga_trimestre_eur' then
        -- excluye 'cupones' (los factura Diego como persona física, decisión del 8-sep, no NGA).
        (select coalesce(sum(importe), 0) from public.omc_ingresos where empresa = t.empresa and estado in ('facturado','cobrado') and linea <> 'cupones' and fecha >= ini)
      when 'cupones_concedidos_eur' then
        (select coalesce(sum(importe), 0) from public.omc_ingresos where empresa = t.empresa and linea = 'cupones'
           and estado in ('concedido','contratado','facturado','cobrado') and (fecha is null or extract(year from fecha) = anyo))
      when 'consultoria_facturado_eur' then
        (select coalesce(sum(importe), 0) from public.omc_ingresos where empresa = t.empresa and linea = 'consultoria'
           and estado in ('facturado','cobrado') and (fecha is null or extract(year from fecha) = anyo))
      when 'certificaciones_activas' then
        (select count(*)::numeric from public.omc_certificaciones where empresa = t.empresa and estado = 'activa')
      when 'colaboradores_con_acuerdo' then
        (select count(*)::numeric from public.omc_colaboradores where empresa = t.empresa and estado = 'activo' and acuerdo_fecha is not null)
      when 'clientes_activos' then
        (select count(*)::numeric from public.omc_clientes where empresa = t.empresa and estado = 'activo')
      else null
    end;
    if v is null then continue; end if;
    update public.omc_plan_lineas set valor_actual = v, actualizado_por = 'sql', updated_at = now() where id = l.id;
    n := n + 1;
  end loop;
  return jsonb_build_object('actualizadas', n);
end $$;

-- ---------------------------------------------------------------------------------------------------------
-- T11 · Lectura del CRM por RPC (owner y agentes del tenant). Es lo que pintarán las pestañas Expedientes,
-- Colaboradores y Recursos del lote 3 y lo que usa la verificación del lote 1. Sin escritura todavía: las
-- altas de esta noche entran por el seed; las RPC de alta (cliente, colaborador, interacción) llegan con
-- los comandos de hq.py del lote 1d.
create or replace function omc_crm_resumen(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t record;
begin
  select * into t from omc_tok(p_token);
  return jsonb_build_object(
    'version', omc_v3_version(),
    'clientes', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id, 'nombre', c.nombre, 'nombre_corto', c.nombre_corto, 'nif', c.nif, 'tipo', c.tipo, 'sector', c.sector, 'web', c.web,
        'localidad', c.localidad, 'carpeta_url', c.carpeta_url, 'ficha_url', c.ficha_url, 'estado', c.estado, 'origen', c.origen, 'responsable', c.responsable,
        'personas', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre, 'cargo', p.cargo, 'email', p.email, 'telefono', p.telefono, 'linkedin_url', p.linkedin_url, 'principal', p.principal) order by p.principal desc, p.nombre), '[]'::jsonb)
                     from omc_personas p where p.cliente_id = c.id and p.activo),
        'expedientes', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'nombre', e.nombre, 'tipo', e.tipo, 'tipologia', e.tipologia, 'codigo', e.codigo, 'importe', e.importe,
                          'estado_economico', e.estado_economico, 'estado_funnel', e.estado_funnel, 'carpeta_url', e.carpeta_url, 'ficha_url', e.ficha_url, 'resumen_estado', e.resumen_estado) order by e.id), '[]'::jsonb)
                        from omc_expedientes e where e.cliente_id = c.id and e.activo),
        'ingresos_eur', (select coalesce(sum(i.importe), 0) from omc_ingresos i where i.cliente_id = c.id and i.estado in ('concedido','contratado','facturado','cobrado')),
        'cobrado_eur', (select coalesce(sum(i.importe), 0) from omc_ingresos i where i.cliente_id = c.id and i.estado = 'cobrado'),
        'ultima_interaccion', (select max(x.fecha) from omc_interacciones x where x.cliente_id = c.id),
        'pendientes', (select count(*) from omc_interacciones x where x.cliente_id = c.id and x.pendiente)
      ) order by c.estado, c.nombre_corto, c.nombre), '[]'::jsonb) from omc_clientes c where c.empresa = t.empresa),
    'colaboradores', (select coalesce(jsonb_agg(jsonb_build_object('id', k.id, 'nombre', k.nombre, 'perfil', k.perfil, 'especialidades', k.especialidades, 'email', k.email,
        'linkedin_url', k.linkedin_url, 'foto_url', k.foto_url, 'cv_url', k.cv_url, 'carpeta_url', k.carpeta_url, 'estado', k.estado, 'acuerdo_fecha', k.acuerdo_fecha, 'ubicacion', k.ubicacion,
        'colaboraciones', (select coalesce(jsonb_agg(jsonb_build_object('id', z.id, 'expediente_id', z.expediente_id, 'licitacion_expediente', z.licitacion_expediente, 'rol', z.rol, 'estado', z.estado) order by z.id), '[]'::jsonb)
                           from omc_colaboraciones z where z.colaborador_id = k.id)) order by k.estado, k.nombre), '[]'::jsonb)
      from omc_colaboradores k where k.empresa = t.empresa),
    'servicios', (select coalesce(jsonb_agg(to_jsonb(s) - 'empresa' order by s.marca, s.estado, s.nombre), '[]'::jsonb) from omc_servicios s where s.empresa = t.empresa),
    'certificaciones', (select coalesce(jsonb_agg(to_jsonb(z) - 'empresa' order by z.prioridad, z.estado, z.nombre), '[]'::jsonb) from omc_certificaciones z where z.empresa = t.empresa),
    'totales', jsonb_build_object(
        'clientes_activos', (select count(*) from omc_clientes c where c.empresa = t.empresa and c.estado = 'activo'),
        'colaboradores_activos', (select count(*) from omc_colaboradores k where k.empresa = t.empresa and k.estado = 'activo'),
        'certificaciones_activas', (select count(*) from omc_certificaciones z where z.empresa = t.empresa and z.estado = 'activa'),
        'interacciones_pendientes', (select count(*) from omc_interacciones x where x.empresa = t.empresa and x.pendiente)));
end $$;
revoke all on function omc_crm_resumen(text) from public;
grant execute on function omc_crm_resumen(text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------
-- T6 · interacciones por canal (encargo #1053, 18-sep-2026). Gmail, LinkedIn, llamadas y plataformas son
-- canales; la fuente es HQ: cada entrada relevante queda en omc_interacciones enlazada al cliente (por
-- correo de persona conocida o por dominio de la web del cliente) y con pendiente=true hasta que alguien
-- la atiende. Los agentes consultan HQ, no el buzón. Sin cuerpo del correo: asunto y resumen corto.
-- ---------------------------------------------------------------------------------------------------
create or replace function omc_v3_version() returns text language sql immutable as $$ select '3.1.0' $$;

create or replace function omc_dominio_correo(p_email text) returns text
language sql immutable as $$
  select nullif(regexp_replace(lower(trim(coalesce(p_email, ''))), '^.*@', ''), '')
$$;

create or replace function omc_dominio_web(p_web text) returns text
language sql immutable as $$
  select nullif(split_part(regexp_replace(regexp_replace(lower(trim(coalesce(p_web, ''))), '^[a-z]+://', ''), '^www\.', ''), '/', 1), '')
$$;

-- Dominios de correo genéricos: nunca identifican a un cliente.
create or replace function omc_dominio_generico(p_dominio text) returns boolean
language sql immutable as $$
  select coalesce(p_dominio, '') in ('gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.es', 'outlook.com', 'outlook.es', 'live.com', 'msn.com',
                                     'yahoo.com', 'yahoo.es', 'icloud.com', 'me.com', 'protonmail.com', 'proton.me', 'telefonica.net', '77delta.com')
$$;

create or replace function omc_cliente_por_email(p_empresa text, p_email text) returns bigint
language plpgsql stable as $$
declare d text; cid bigint; em text;
begin
  em := nullif(lower(trim(coalesce(p_email, ''))), '');
  if em is null then return null; end if;
  select p.cliente_id into cid from omc_personas p join omc_clientes c on c.id = p.cliente_id
   where c.empresa = p_empresa and lower(p.email) = em order by p.activo desc, p.principal desc, p.id limit 1;
  if cid is not null then return cid; end if;
  d := omc_dominio_correo(em);
  if d is null or omc_dominio_generico(d) then return null; end if;
  select c.id into cid from omc_clientes c where c.empresa = p_empresa and omc_dominio_web(c.web) = d
   order by (c.estado = 'activo') desc, c.id limit 1;
  if cid is not null then return cid; end if;
  select p.cliente_id into cid from omc_personas p join omc_clientes c on c.id = p.cliente_id
   where c.empresa = p_empresa and omc_dominio_correo(p.email) = d order by p.id limit 1;
  return cid;
end $$;

-- Alta idempotente: con ref (Message-ID, URL de LinkedIn...) la misma interacción no se duplica; la segunda
-- llamada solo rellena huecos (cliente, persona, expediente, contacto, resumen). p = jsonb con canal,
-- sentido, ref, email, asunto, resumen, fecha, agente, pendiente, cliente_id, expediente_id, colaborador_id, contacto_id.
create or replace function omc_interaccion_alta(p_token text, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t record; r omc_interacciones; cid bigint; pid bigint; em text; nuevo boolean := false; v_canal text;
begin
  select * into t from omc_tok(p_token);
  v_canal := coalesce(nullif(p->>'canal', ''), 'correo');
  em := nullif(lower(trim(coalesce(p->>'email', ''))), '');
  cid := nullif(p->>'cliente_id', '')::bigint;
  if cid is null then cid := omc_cliente_por_email(t.empresa, em); end if;
  if cid is not null and em is not null then
    select id into pid from omc_personas where cliente_id = cid and lower(email) = em order by activo desc, id limit 1;
  end if;
  if nullif(p->>'ref', '') is not null then
    select * into r from omc_interacciones x where x.empresa = t.empresa and x.canal = v_canal and x.ref = p->>'ref';
  end if;
  if r.id is null then
    insert into omc_interacciones (empresa, cliente_id, persona_id, expediente_id, colaborador_id, contacto_id, canal, sentido, fecha, asunto, resumen, ref, agente, pendiente)
    values (t.empresa, cid, pid, nullif(p->>'expediente_id', '')::bigint, nullif(p->>'colaborador_id', '')::bigint, nullif(p->>'contacto_id', '')::bigint,
            v_canal, coalesce(nullif(p->>'sentido', ''), 'entrada'), coalesce(nullif(p->>'fecha', '')::timestamptz, now()),
            left(nullif(p->>'asunto', ''), 300), left(nullif(p->>'resumen', ''), 2000), nullif(p->>'ref', ''),
            coalesce(nullif(p->>'agente', ''), nullif(t.nombre, ''), 'sistema'), coalesce((p->>'pendiente')::boolean, false))
    returning * into r;
    nuevo := true;
  else
    update omc_interacciones set cliente_id = coalesce(cliente_id, cid), persona_id = coalesce(persona_id, pid),
      expediente_id = coalesce(expediente_id, nullif(p->>'expediente_id', '')::bigint),
      contacto_id = coalesce(contacto_id, nullif(p->>'contacto_id', '')::bigint),
      resumen = coalesce(resumen, left(nullif(p->>'resumen', ''), 2000))
      where id = r.id returning * into r;
  end if;
  return to_jsonb(r) || jsonb_build_object('nuevo', nuevo, 'cliente', (select c.nombre_corto from omc_clientes c where c.id = r.cliente_id));
end $$;

-- Atender por id o por (canal, ref). Devuelve la fila o null si no había nada pendiente que casara.
create or replace function omc_interaccion_atender(p_token text, p_id bigint default null, p_canal text default 'correo', p_ref text default null,
                                                    p_agente text default null, p_motivo text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t record; r omc_interacciones;
begin
  select * into t from omc_tok(p_token);
  if p_id is null and nullif(p_ref, '') is null then raise exception 'omc_interaccion_atender: hace falta p_id o p_ref'; end if;
  update omc_interacciones x set pendiente = false, atendido_por = coalesce(nullif(p_agente, ''), nullif(t.nombre, ''), 'sistema'), atendido_fecha = now(),
      resumen = case when nullif(p_motivo, '') is not null then left(coalesce(x.resumen, '') || ' · atendido: ' || p_motivo, 2000) else x.resumen end
    where x.empresa = t.empresa and x.pendiente and ((p_id is not null and x.id = p_id) or (p_id is null and x.canal = p_canal and x.ref = p_ref))
    returning * into r;
  if r.id is null then return null; end if;
  return to_jsonb(r);
end $$;

-- Lista con filtros: cliente_id, expediente_id, canal, pendientes (bool), desde (fecha), limite (50 por defecto, máximo 500).
create or replace function omc_interacciones_lista(p_token text, p_filtro jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t record; lim int;
begin
  select * into t from omc_tok(p_token);
  lim := least(coalesce(nullif(p_filtro->>'limite', '')::int, 50), 500);
  return (select coalesce(jsonb_agg(j), '[]'::jsonb) from (
    select to_jsonb(x) - 'empresa' || jsonb_build_object('cliente', c.nombre_corto, 'expediente', e.nombre) as j
      from omc_interacciones x left join omc_clientes c on c.id = x.cliente_id left join omc_expedientes e on e.id = x.expediente_id
     where x.empresa = t.empresa
       and (nullif(p_filtro->>'cliente_id', '') is null or x.cliente_id = (p_filtro->>'cliente_id')::bigint)
       and (nullif(p_filtro->>'expediente_id', '') is null or x.expediente_id = (p_filtro->>'expediente_id')::bigint)
       and (nullif(p_filtro->>'canal', '') is null or x.canal = p_filtro->>'canal')
       and (coalesce((p_filtro->>'pendientes')::boolean, false) = false or x.pendiente)
       and (nullif(p_filtro->>'desde', '') is null or x.fecha >= (p_filtro->>'desde')::timestamptz)
     order by x.fecha desc limit lim) s);
end $$;

revoke all on function omc_interaccion_alta(text, jsonb), omc_interaccion_atender(text, bigint, text, text, text, text), omc_interacciones_lista(text, jsonb) from public;
grant execute on function omc_interaccion_alta(text, jsonb), omc_interaccion_atender(text, bigint, text, text, text, text), omc_interacciones_lista(text, jsonb) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------
-- T7 · cierre automático de encargos (encargo #1053, tarea 11 del rediseño HQ, 18-sep-2026).
-- Una interacción puede nacer ligada a un encargo (encargo_id): el correo de un lead esperado abre un
-- encargo, la notificación de LinkedIn abre el de Biel. Cuando la interacción se atiende (respuesta
-- detectada en Enviados o cierre manual) el encargo se cierra solo como hecho con fuente_cierre
-- "interacción #n atendida". Y al revés: si el agente cierra el encargo con encargo hecho, las
-- interacciones pendientes ligadas quedan atendidas (trigger). Aditivo e idempotente.
-- ---------------------------------------------------------------------------------------------------
alter table omc_interacciones add column if not exists encargo_id bigint references omc_encargos(id) on delete set null;
create index if not exists omc_interacciones_encargo_idx on omc_interacciones(encargo_id) where encargo_id is not null;

create or replace function omc_v3_version() returns text language sql immutable as $$ select '3.2.0' $$;

create or replace function omc_interaccion_alta(p_token text, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t record; r omc_interacciones; cid bigint; pid bigint; em text; nuevo boolean := false; v_canal text; eid bigint;
begin
  select * into t from omc_tok(p_token);
  v_canal := coalesce(nullif(p->>'canal', ''), 'correo');
  em := nullif(lower(trim(coalesce(p->>'email', ''))), '');
  cid := nullif(p->>'cliente_id', '')::bigint;
  if cid is null then cid := omc_cliente_por_email(t.empresa, em); end if;
  if cid is not null and em is not null then
    select id into pid from omc_personas where cliente_id = cid and lower(email) = em order by activo desc, id limit 1;
  end if;
  eid := nullif(p->>'encargo_id', '')::bigint;
  if eid is not null and not exists (select 1 from omc_encargos e where e.id = eid and e.empresa = t.empresa) then
    raise exception 'omc_interaccion_alta: el encargo % no existe', eid;
  end if;
  if nullif(p->>'ref', '') is not null then
    select * into r from omc_interacciones x where x.empresa = t.empresa and x.canal = v_canal and x.ref = p->>'ref';
  end if;
  if r.id is null then
    insert into omc_interacciones (empresa, cliente_id, persona_id, expediente_id, colaborador_id, contacto_id, encargo_id, canal, sentido, fecha, asunto, resumen, ref, agente, pendiente)
    values (t.empresa, cid, pid, nullif(p->>'expediente_id', '')::bigint, nullif(p->>'colaborador_id', '')::bigint, nullif(p->>'contacto_id', '')::bigint, eid,
            v_canal, coalesce(nullif(p->>'sentido', ''), 'entrada'), coalesce(nullif(p->>'fecha', '')::timestamptz, now()),
            left(nullif(p->>'asunto', ''), 300), left(nullif(p->>'resumen', ''), 2000), nullif(p->>'ref', ''),
            coalesce(nullif(p->>'agente', ''), nullif(t.nombre, ''), 'sistema'), coalesce((p->>'pendiente')::boolean, false))
    returning * into r;
    nuevo := true;
  else
    update omc_interacciones set cliente_id = coalesce(cliente_id, cid), persona_id = coalesce(persona_id, pid),
      expediente_id = coalesce(expediente_id, nullif(p->>'expediente_id', '')::bigint),
      contacto_id = coalesce(contacto_id, nullif(p->>'contacto_id', '')::bigint),
      encargo_id = coalesce(encargo_id, eid),
      resumen = coalesce(resumen, left(nullif(p->>'resumen', ''), 2000))
      where id = r.id returning * into r;
  end if;
  return to_jsonb(r) || jsonb_build_object('nuevo', nuevo, 'cliente', (select c.nombre_corto from omc_clientes c where c.id = r.cliente_id));
end $$;

-- Atender por id o por (canal, ref). Devuelve la fila (con encargo_cerrado) o null si no había nada pendiente que casara.
create or replace function omc_interaccion_atender(p_token text, p_id bigint default null, p_canal text default 'correo', p_ref text default null,
                                                    p_agente text default null, p_motivo text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t record; r omc_interacciones; v_agente text; cerrado boolean := false; e omc_encargos;
begin
  select * into t from omc_tok(p_token);
  if p_id is null and nullif(p_ref, '') is null then raise exception 'omc_interaccion_atender: hace falta p_id o p_ref'; end if;
  v_agente := coalesce(nullif(p_agente, ''), nullif(t.nombre, ''), 'sistema');
  update omc_interacciones x set pendiente = false, atendido_por = v_agente, atendido_fecha = now(),
      resumen = case when nullif(p_motivo, '') is not null then left(coalesce(x.resumen, '') || ' · atendido: ' || p_motivo, 2000) else x.resumen end
    where x.empresa = t.empresa and x.pendiente and ((p_id is not null and x.id = p_id) or (p_id is null and x.canal = p_canal and x.ref = p_ref))
    returning * into r;
  if r.id is null then return null; end if;
  if r.encargo_id is not null then
    select * into e from omc_encargos where id = r.encargo_id and empresa = t.empresa and estado in ('encolado', 'en_curso', 'bloqueado_diego');
    if e.id is not null then
      update omc_encargos set estado = 'hecho', espera = '',
          fuente_cierre = left('interacción #' || r.id || ' atendida' || coalesce(' · ' || nullif(p_motivo, ''), ''), 600)
        where id = e.id;
      perform omc_avance_insertar(t.empresa, e.id, v_agente, 'cierre',
        left('cierre automático: interacción #' || r.id || ' (' || r.canal || ') atendida por ' || v_agente || coalesce(' · ' || nullif(p_motivo, ''), ''), 600));
      cerrado := true;
    end if;
  end if;
  return to_jsonb(r) || jsonb_build_object('encargo_cerrado', cerrado);
end $$;

-- Al revés: encargo hecho (por RPC omc_encargo_hecho o cualquier update) deja atendidas sus interacciones pendientes.
create or replace function omc_encargo_hecho_atiende_interacciones() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.estado = 'hecho' and coalesce(old.estado, '') <> 'hecho' then
    update omc_interacciones set pendiente = false, atendido_por = coalesce(nullif(new.agente, ''), 'sistema'), atendido_fecha = now(),
        resumen = left(coalesce(resumen, '') || ' · atendido: encargo #' || new.id || ' hecho', 2000)
      where encargo_id = new.id and pendiente;
  end if;
  return new;
end $$;
drop trigger if exists trg_omc_encargo_hecho_interacciones on omc_encargos;
create trigger trg_omc_encargo_hecho_interacciones after update of estado on omc_encargos
  for each row execute function omc_encargo_hecho_atiende_interacciones();

revoke all on function omc_interaccion_alta(text, jsonb), omc_interaccion_atender(text, bigint, text, text, text, text) from public;
grant execute on function omc_interaccion_alta(text, jsonb), omc_interaccion_atender(text, bigint, text, text, text, text) to anon, authenticated, service_role;
