-- seed-77delta-v2.sql · datos de 77 Delta para HQ v2. Idempotente.
insert into omc_plan_objetivo (empresa, horizonte, titulo, meta, unidad, fecha_limite) values
  ('77delta', 2026, 'Contratado a 31 de diciembre de 2026', 300000, 'EUR', '2026-12-31'),
  ('77delta', 2027, 'Contratado en 2027 con licitaciones europeas', 3000000, 'EUR', '2027-12-31')
on conflict (empresa, horizonte) do update set titulo=excluded.titulo, meta=excluded.meta, fecha_limite=excluded.fecha_limite;
