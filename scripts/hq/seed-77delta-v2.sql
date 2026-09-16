-- seed-77delta-v2.sql · datos de 77 Delta para HQ v2. Idempotente.
insert into omc_plan_objetivo (empresa, horizonte, titulo, meta, unidad, fecha_limite) values
  ('77delta', 2026, 'Contratado a 31 de diciembre de 2026', 300000, 'EUR', '2026-12-31'),
  ('77delta', 2027, 'Contratado en 2027 con licitaciones europeas', 3000000, 'EUR', '2027-12-31')
on conflict (empresa, horizonte) do update set titulo=excluded.titulo, meta=excluded.meta, fecha_limite=excluded.fecha_limite;

-- T3 · bloques y frentes
insert into omc_plan_bloques (empresa, letra, nombre, meta_eur, director, orden) values
  ('77delta','A','Licitaciones públicas',200000,'Guillem',1), ('77delta','B','Subvenciones y ayudas',105000,'Helena',2),
  ('77delta','C','Comercial directo',60000,'Biel',3), ('77delta','D','Producto',9000,'Marina',4), ('77delta','E','Empresa y capacidades',0,'chief',5)
on conflict (empresa, letra) do update set nombre=excluded.nombre, meta_eur=excluded.meta_eur, director=excluded.director, orden=excluded.orden;

-- líneas existentes (ids 1-8 de 77delta) reciben código y bloque; la 8 se apaga (KPI duplicado de A3)
update omc_plan_lineas l set codigo = m.codigo, bloque_id = (select id from omc_plan_bloques where empresa='77delta' and letra = m.letra), orden = m.orden,
  linea = coalesce(m.linea, l.linea), kpi = coalesce(m.kpi, l.kpi)
from (values (1,'B1','B',1,null,null), (2,'A3','A',3,'Ofertas en curso','EUR presentados'), (3,'C2','C',2,null,null), (4,'B4','B',4,null,null),
             (5,'D1','D',1,null,null), (6,'E2','E',2,null,null), (7,'C4','C',4,null,null)) as m(id, codigo, letra, orden, linea, kpi)
where l.empresa='77delta' and l.id = m.id and l.codigo is null;
update omc_plan_lineas set activa = false where empresa='77delta' and id = 8 and codigo is null;
update omc_encargos set linea_id = 2 where empresa='77delta' and linea_id = 8;

-- frentes nuevos
insert into omc_plan_lineas (empresa, orden, linea, kpi, valor_actual, meta, unidad, responsable, fuente, activa, actualizado_por, bloque_id, codigo)
select '77delta', f.orden, f.linea, f.kpi, 0, f.meta, f.unidad, f.responsable, 'manual', true, 'seed', b.id, f.codigo
from (values
  ('A1',1,'Detección y fuentes','Fuentes cubiertas (CCAA)',17,'fuentes','Ariadna'), ('A2',2,'Cribado y elegibilidad','Candidatas con art. 76 leído por semana',20,'expedientes','Guillem'),
  ('A4',4,'Solvencia, colaboradores y UTE','Colaboradores con acuerdo',5,'personas','Biel'), ('A5',5,'Europeas 2027','Convocatorias UE identificadas',10,'convocatorias','Clara'),
  ('B2',2,'Cupons IA','EUR concedidos',40000,'EUR','Martí'), ('B3',3,'Estatales y europeas','Solicitudes presentadas',3,'solicitudes','Clara'),
  ('C1',1,'Ayuntamientos','Reuniones',10,'reuniones','Biel'), ('C3',3,'Consultoría y Peninsula','EUR facturados',20000,'EUR','Diego'), ('C5',5,'Prospección y seguimiento','% respuesta',20,'%','Aina'),
  ('D2',2,'Regulia','Clientes de pago',3,'clientes','Marina'), ('D3',3,'Otros SaaS','MRR',0,'EUR','Diego'),
  ('E1',1,'Habilitaciones y certificaciones','Habilitaciones conseguidas',4,'habilitaciones','Ferran'), ('E3',3,'Equipo y cuentas','% fichas completas',100,'%','Pol'),
  ('E4',4,'HQ y fuente de la verdad','Encargos fuera de plan',0,'encargos','chief'), ('E5',5,'Marca y web','Leads web al mes',10,'leads','Mireia')
) as f(codigo, orden, linea, kpi, meta, unidad, responsable)
join omc_plan_bloques b on b.empresa='77delta' and b.letra = left(f.codigo,1)
where not exists (select 1 from omc_plan_lineas x where x.empresa='77delta' and upper(x.codigo) = f.codigo);

-- T8 · kit: reglas y procedimientos generales y por frente. Las URL de Drive de las plantillas las
-- da de alta el chief el 17-sep con `kit alta` tras el inventario; aqui solo reglas y procedimientos
-- del repo.
insert into omc_kit (empresa, linea_id, tipo, nombre, url, texto, actualizado_por)
select '77delta', null, k.tipo, k.nombre, k.url, k.texto, 'seed' from (values
  ('regla', 'Ningún documento a cliente en HTML ni markdown', null, 'Todo entregable a cliente u órgano va en plantilla 77 Delta (Google Doc, PDF o DOCX). Regla 40, incidente #648.'),
  ('regla', 'Documento por enlace, nunca adjunto (decisión 80)', null, 'Correos de impacto a cliente salen como borrador de diego@; el documento va por enlace de Google Doc. A un órgano de contratación sí va adjunto. Nunca datos de otro cliente, ni anonimizados.'),
  ('regla', 'Cifras con etiqueta y fuente (decisión 81)', null, 'Toda cifra lleva "sin IVA" o "con IVA" y su fuente; bajas y márgenes sobre base sin IVA; si no se puede reconstruir, se escribe NO LO SÉ.'),
  ('regla', 'Catalán con entidades catalanas', null, 'A entidades y empresas catalanas se escribe en catalán.'),
  ('regla', 'Validar lo que llega de oídas (regla 36)', null, 'Antes de actuar sobre un dato verbal se contrasta en la fuente primaria.'),
  ('regla', 'Prospección fría desde el alias de team@ (regla 37)', null, 'Nunca desde diego@. Remitente = agente con su alias verificado o Diego en persona; nunca "Equipo 77 Delta".'),
  ('regla', 'Cronología completa antes de redactar (regla 38)', null, 'Antes de redactar a un tercero se reconstruye el hilo entero con él.'),
  ('regla', 'Máximo dos toques (regla 39)', null, 'Segundo toque obligatorio antes de dar por perdido un contacto; nunca un tercero sin OK del chief.'),
  ('procedimiento', 'Envío a terceros con candado', 'https://github.com/diegotorreslopez81/77delta/blob/main/scripts/gmail/enviar-con-lock.sh', 'Tarjeta HQ aprobada + fila de contacto + franja 08-20. Nada sale de otra forma.'),
  ('procedimiento', 'Alta de agente', 'https://github.com/diegotorreslopez81/77delta/blob/main/docs/empresa/30-alta-de-agente.md', 'hq.py agente alta con frentes, ventana tmux y ficha.')
) as k(tipo, nombre, url, texto)
where not exists (select 1 from omc_kit x where x.empresa='77delta' and x.nombre = k.nombre);

insert into omc_kit (empresa, linea_id, tipo, nombre, texto, actualizado_por)
select '77delta', l.id, k.tipo, k.nombre, k.texto, 'seed' from (values
  ('A2', 'regla', 'Medios personales del art. 76 antes de proponer', 'El bloque de medios a adscribir del pliego se lee y se cita ANTES de proponer un expediente (caso CVC).'),
  ('A3', 'regla', 'Facturador en contratos públicos', 'Siempre Next Gen Academy SL (B44861649). Nunca Infinite Labs OÜ ni su solvencia externa.'),
  ('A3', 'regla', 'Hosting con datos de la administración', 'Proveedor con conformidad ENS en el registro del CCN (OVHcloud por defecto). Nunca Hetzner, Vercel ni Supabase.'),
  ('B4', 'regla', 'FUNDAE: solo áreas con formador acreditable', 'Inscritos en todas las áreas por decisión de Diego 16-sep, pero nunca se oferta ni acepta formación sin formador acreditable.'),
  ('C5', 'regla', 'Seguimiento siempre en campañas', 'Toque 2 obligatorio antes de parar o escalar (Aina, Ona, Marina, 15-sep).')
) as k(codigo, tipo, nombre, texto) join omc_plan_lineas l on l.empresa='77delta' and l.codigo = k.codigo
where not exists (select 1 from omc_kit x where x.empresa='77delta' and x.nombre = k.nombre);

-- T11 · expedientes. responsable se resuelve con omc_agente_valido: 'Helena' y 'Marina' casan con la
-- sesion tmux de su puesto (Helena-Grants, Marina-Regulia) y quedan con responsable relleno; 'Martí'
-- NO casa (el puesto tiene la sesion 'Marti-Cupones' sin tilde y omc_agente_valido compara en
-- minusculas sin quitar acentos) y 'Diego' tampoco (es el owner, no un agente de omc_agentes), asi que
-- esos expedientes quedan con responsable NULL hasta que alguien con permiso corrija el nombre de la
-- sesion o el registro de agentes; omc_sesion_solicitar exige responsable no nulo, asi que esos
-- expedientes no podran pedir sesion desde HQ hasta entonces.
insert into omc_expedientes (empresa, tipo, nombre, linea_id, responsable, estado_funnel)
select '77delta', x.tipo, x.nombre, omc_frente_id('77delta', x.codigo), omc_agente_valido('77delta', x.resp), x.funnel from (values
  ('cliente','Nora Fuchs','B2','Martí','diagnóstico'), ('cliente','One Hub','B2','Martí','propuesta'), ('cliente','Aresa','B2','Martí','ejecución'), ('cliente','Zimeron','B2','Martí','ejecución'),
  ('cliente','Epic','B2','Martí','ejecución'), ('cliente','IPAE','B2','Martí','ejecución'), ('cliente','Peninsula','C3','Diego','activo'),
  ('convocatoria','ACCIÓ Exploració Tecnològica 2026','B1','Helena','redacción'), ('producto','Regulia','D2','Marina','beta')
) as x(tipo, nombre, codigo, resp, funnel)
where not exists (select 1 from omc_expedientes e where e.empresa='77delta' and e.nombre = x.nombre);
