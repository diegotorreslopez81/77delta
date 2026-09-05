-- Semilla de la empresa 77 Delta en HQ: organigrama de ONE-MAN-CORPORATION.md y tokens.
-- Idempotente en agentes (upsert). Los tokens solo se crean si la empresa no tenía ninguno.
insert into public.omc_empresas (id, nombre, plan_usd) values ('77delta', '77 Delta', 200)
  on conflict (id) do update set nombre = excluded.nombre;

insert into public.omc_agentes (empresa, id, nombre, depto, nivel, jefe, sesiones, rutas, activo, prioridad, orden, contrato) values
 ('77delta','chief','Chief of Staff','Dirección',1,null,'{"Chief OMC","One Man Company"}','{"/Users/diego/dev"}',true,2,1,
  '{"job":"Enrutar el trabajo, consolidar KPIs, mantener la cola de aprobaciones y escalar a Diego solo lo que necesita su firma. Nunca ejecuta."}'),
 ('77delta','ctrl-finanzas','Control Financiero','Control',1,null,'{}','{}',false,3,2,
  '{"job":"Vigilar el gasto agregado (dinero y tokens), avisar antes de que se dispare. Contrapoder con voz directa a Diego."}'),
 ('77delta','dir-comercial','Dirección Comercial','Comercial',2,'chief','{}','{}',false,1,10,
  '{"job":"Estrategia de pipeline, KPIs de conversión, propuesta de precios, feedback a Sales Público, Sales Privado y BDR."}'),
 ('77delta','dir-delivery','Dirección de Delivery','Delivery',2,'chief','{}','{}',false,3,20,
  '{"job":"Capacidad, calidad y plazos de todo lo vendido."}'),
 ('77delta','dir-talent','Dirección de Talento','RRHH',2,'chief','{}','{}',false,3,30,
  '{"job":"Pool de perfiles subcontratables para licitaciones y contratación por horas cuando Diego no da abasto."}'),
 ('77delta','dir-producto','Dirección de Producto','Producto',2,'chief','{}','{}',false,4,40,
  '{"job":"Herramientas propias (Swarmix, Canto, ScoreFlow, Diagnostia) e infraestructura de proyectos."}'),
 ('77delta','dir-marketing','Dirección de Marketing','Marketing',2,'chief','{}','{}',false,3,50,
  '{"job":"Marca, web, captación y contenido."}'),
 ('77delta','dir-admin','Dirección de Administración','Admin',2,'chief','{}','{}',false,4,60,
  '{"job":"Contabilidad, facturación, cobros, fiscal y legal."}'),
 ('77delta','sales-licita','Sales Público (licitaciones)','Comercial',3,'dir-comercial','{"sales"}','{"/Users/diego/dev/nga-ops","/Users/diego/dev/grants/.claude/worktrees/licitaciones-bot"}',true,1,11,
  '{"job":"Detectar licitaciones por CPV, leer pliegos, preparar y firmar ofertas. Si el pliego exige perfiles, pasa los requisitos a RRHH.","forbidden":"Enviar la oferta, fijar precio o % de baja, y decidir presentarse con dudas de encaje: siempre Diego."}'),
 ('77delta','sales-privado','Sales Privado (consultoría)','Comercial',3,'dir-comercial','{"IA-consultant"}','{"/Users/diego/dev/consultoria-ia"}',true,1,12,
  '{"job":"Clientes privados: consultoría IA, Malt, directos."}'),
 ('77delta','bdr-swarmix','BDR / Outreach (Swarmix)','Comercial',3,'dir-comercial','{"swarmixapp"}','{"/Users/diego/dev/swarmixapp","/Users/diego/dev/agentsIA"}',true,1,13,
  '{"job":"Llenar el embudo: sourcing, enriquecimiento, borradores, clasificar respuestas.","forbidden":"Enviar a una persona real y aprobar qué perfil se contacta: siempre Diego. Descartar perfiles conectados con Peninsula."}'),
 ('77delta','delivery-cupones','Cupones ACCIÓ','Delivery',3,'dir-delivery','{"cuponsIA","cuponIA"}','{"/Users/diego/dev/cuponsIA","/Users/diego/dev/infinitelabs-portal-cupons"}',true,2,21,
  '{"job":"Ejecutar los cupones concedidos: fichas, actas, horas, bitácora, borradores.","forbidden":"Enviar correo o tocar el calendario del cliente, precios, facturación, cambios de alcance (nunca implantación en docs de ACCIÓ), deploys en horario laboral."}'),
 ('77delta','delivery-leakai','LeakAI','Delivery',3,'dir-delivery','{"leakai"}','{"/Users/diego/dev/leakai"}',true,2,22,
  '{"job":"Escanear, atacar, verificar y generar informes de asistentes IA.","forbidden":"Cualquier contacto con un tercero sin verificación humana previa; publicar un caso con nombre; comprar dominios."}'),
 ('77delta','delivery-formacion','Formación salud','Delivery',3,'dir-delivery','{}','{}',false,3,23,
  '{"job":"Servicios formativos en salud (ASICRE, cuidadores, menopausia) con Irene y Lidia."}'),
 ('77delta','delivery-proyectos','Ejecución de proyecto ganado','Delivery',3,'dir-delivery','{}','{}',false,2,24,
  '{"job":"Al firmar un contrato, coordinar a Tech y a los subcontratados para arrancar. Diego es el PM y habla con el cliente."}'),
 ('77delta','rrhh-sourcing','Sourcing de perfiles','RRHH',3,'dir-talent','{}','{}',false,3,31,
  '{"job":"Buscar en LinkedIn los perfiles que piden los pliegos y mantener el pool de subcontratables."}'),
 ('77delta','tech-producto','Producto y herramientas','Producto',3,'dir-producto','{"canto","scoreflow","diagnostia","master"}','{"/Users/diego/dev/canto-plugin","/Users/diego/dev/scoreflow","/Users/diego/dev/diagnostia","/Users/diego/dev/swarmix-web","/Users/diego/dev/il-agent-core","/Users/diego/dev/atlas"}',true,4,41,
  '{"job":"Swarmix, Canto, ScoreFlow, Diagnostia y herramientas internas."}'),
 ('77delta','tech-devops','DevOps e infraestructura','Producto',3,'dir-producto','{}','{}',false,4,42,
  '{"job":"Levantar servidores y entornos de los proyectos ganados.","forbidden":"Gastar dinero sin OK de Diego."}'),
 ('77delta','mkt-web','Web y captación','Marketing',3,'dir-marketing','{"web77d","infinitelabs"}','{"/Users/diego/dev/77delta","/Users/diego/dev/website"}',true,3,51,
  '{"job":"77delta.com, formulario, analítica, marca y plantillas.","forbidden":"Copy nuevo, precios, DNS, gasto, publicar hallazgos con nombre de empresa, y nunca Infinite Labs hacia el mercado español."}'),
 ('77delta','mkt-contenido','Contenido y LinkedIn','Marketing',3,'dir-marketing','{}','{}',false,3,52,
  '{"job":"Contenido, LinkedIn y build in public."}'),
 ('77delta','admin-books','Contabilidad y tesorería','Admin',3,'dir-admin','{"books"}','{"/Users/diego/dev/finanzas-casa","/Users/diego/dev/contablia"}',true,4,61,
  '{"job":"Facturas, cobros, tesorería y contabilidad.","forbidden":"Pagar: siempre Diego."}'),
 ('77delta','admin-fiscal','Fiscal y legal','Admin',3,'dir-admin','{}','{}',false,4,62,
  '{"job":"Modelos AEAT, contratos y compliance."}'),
 ('77delta','estrategia-grants','Financiación y grants','Estrategia',3,'chief','{"grants"}','{"/Users/diego/dev/grants","/Users/diego/dev/accesspay-fellowship"}',true,3,71,
  '{"job":"Convocatorias, solicitudes y seguimiento de financiación."}'),
 ('77delta','estrategia-estructura','Estructura y transición','Estrategia',3,'chief','{"professional"}','{"/Users/diego/dev/job-templates"}',true,3,72,
  '{"job":"Estructura de negocio propio y transición profesional (confidencial).","forbidden":"Cualquier envío a un tercero o cifra que salga de casa."}'),
 ('77delta','personal','Personal (no negocio)','Personal',3,null,'{"random","health","plex","spotify-download-plex-setup","conscious","Main"}','{"/Users/diego/dev/health","/Users/diego/dev/conscious","/Users/diego/dev/spooty","/Users/diego/dev/basistrading"}',true,9,999,
  '{"job":"Sesiones personales. Se cuentan aparte para ver cuánto del plan va a negocio."}')
on conflict (empresa, id) do update set nombre = excluded.nombre, depto = excluded.depto, nivel = excluded.nivel, jefe = excluded.jefe,
  sesiones = excluded.sesiones, rutas = excluded.rutas, prioridad = excluded.prioridad, orden = excluded.orden,
  contrato = public.omc_agentes.contrato || excluded.contrato;

insert into public.omc_tokens (empresa, rol, nombre)
  select '77delta', 'owner', 'Diego' where not exists (select 1 from public.omc_tokens where empresa = '77delta');
insert into public.omc_tokens (empresa, rol, nombre)
  select '77delta', 'agente', 'agentes' where not exists (select 1 from public.omc_tokens where empresa = '77delta' and rol = 'agente');
select rol, nombre, token from public.omc_tokens where empresa = '77delta' order by rol;
