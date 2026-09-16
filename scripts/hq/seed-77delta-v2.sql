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
