import test from 'node:test';
import assert from 'node:assert/strict';
import { conversion, embudoLicitaciones, embudoExpedientes, embudoTablero, resumenEquipo } from '../app/embudos.js';

// --- conversion() ---------------------------------------------------------------------------------------
test('conversion: division por cero y casos normales', () => {
  assert.equal(conversion(5, 0), null, 'paso anterior en cero no puede convertir "de cero"');
  assert.equal(conversion(0, 0), null);
  assert.equal(conversion(0, 10), 0);
  assert.equal(conversion(5, null), null, 'sin paso anterior, null');
  assert.equal(conversion(5, undefined), null);
  assert.equal(conversion(3, 4), 75, '3 de 4 es 75%');
  assert.equal(conversion(1, 3), 33.3, 'redondeo a un decimal');
});

// --- embudoLicitaciones ----------------------------------------------------------------------------------
// 8 licitaciones que cubren los 5 pasos del embudo, un estado en cada lateral (pausada, descartada,
// ganada via estado crudo, perdida via estado crudo) y una fila de estado desconocido.
const lics = [
  { expediente: 'L1', estado: 'Nueva', importe: 1000 },
  { expediente: 'L2', estado: 'Nueva', importe: 2000 },
  { expediente: 'L3', estado: 'Por decidir', importe: 3000 },
  { expediente: 'L4', estado: 'Analizada', importe: 500 },
  { expediente: 'L5', estado: 'Aprobada', importe: 4000 },
  { expediente: 'L6', estado: 'En redacción', importe: 1500 },
  { expediente: 'L7', estado: 'Presentada', importe: 2500 },
  { expediente: 'L8', estado: 'Pausada', importe: 300 },
  { expediente: 'L9', estado: 'Descartada: sin encaje', importe: 700 },
  { expediente: 'L10', estado: 'Adjudicada', importe: 9000 },
  { expediente: 'L11', estado: 'Contratada', importe: 6000 },
  { expediente: 'L12', estado: 'No adjudicada', importe: 800 },
  { expediente: 'L13', estado: 'Cerrada sin presentar', importe: 400 },
  { expediente: 'L14', estado: 'Retirada', importe: 250 },
  { expediente: 'L15', estado: 'Un estado nuevo del Sheet', importe: 999 },
];

test('embudoLicitaciones: recuentos e importes por paso, sin resumen (todo desde el array crudo)', () => {
  const { pasos, laterales } = embudoLicitaciones(lics);
  const porClave = Object.fromEntries(pasos.map(p => [p.clave, p]));
  assert.equal(porClave.nuevas.n, 2);
  assert.equal(porClave.nuevas.importe, 3000);
  assert.equal(porClave.decidir.n, 2, 'Por decidir + Analizada');
  assert.equal(porClave.decidir.importe, 3500);
  assert.equal(porClave.aprobadas.n, 1);
  assert.equal(porClave.aprobadas.importe, 4000);
  assert.equal(porClave.redaccion.n, 1);
  assert.equal(porClave.presentadas.n, 1);
  assert.equal(porClave.presentadas.importe, 2500);
  // Ganadas = Adjudicada + Contratada (fallback al array crudo sin lic_resumen)
  assert.equal(porClave.ganadas.n, 2);
  assert.equal(porClave.ganadas.importe, 15000);
  // Perdidas = No adjudicada + Cerrada sin presentar (Retirada no tiene clave: hueco de datos, no cuenta aqui)
  assert.equal(porClave.perdidas.n, 2);
  assert.equal(porClave.perdidas.importe, 1200);

  const porClaveLat = Object.fromEntries(laterales.map(l => [l.clave, l]));
  assert.equal(porClaveLat.pausadas.n, 1);
  assert.equal(porClaveLat.pausadas.importe, 300);
  assert.equal(porClaveLat.descartadas.n, 1, 'solo L9 (estado empieza por Descartada)');
  assert.equal(porClaveLat.descartadas.importe, 700);
});

test('embudoLicitaciones: estados desconocidos van a "otros" y nunca se pierden (ni Retirada, ni un valor nuevo)', () => {
  const { laterales } = embudoLicitaciones(lics);
  const otros = laterales.find(l => l.clave === 'otros');
  assert.ok(otros, 'debe existir la fila de otros');
  // Retirada (hueco de lic_resumen) y el estado inventado del Sheet caen aqui, nunca desaparecen.
  assert.equal(otros.n, 2);
  assert.equal(otros.importe, 250 + 999);
});

test('embudoLicitaciones: conversion acumulada (ha llegado al menos hasta aqui), nunca n/n entre estados excluyentes', () => {
  const { pasos } = embudoLicitaciones(lics);
  const porClave = Object.fromEntries(pasos.map(p => [p.clave, p]));
  // Acumulados del fixture: ganadas 2; presentadas 1 + 2 ganadas + 1 no adjudicada = 4; redaccion 5;
  // aprobadas 6; decidir 8; nuevas 10 (la cerrada sin presentar, la pausada y la descartada no suman).
  assert.equal(porClave.nuevas.conversion, null, 'primer paso, sin anterior');
  assert.equal(porClave.decidir.conversion, conversion(8, 10));
  assert.equal(porClave.aprobadas.conversion, conversion(6, 8));
  assert.equal(porClave.redaccion.conversion, conversion(5, 6));
  assert.equal(porClave.presentadas.conversion, conversion(4, 5));
  assert.equal(porClave.ganadas.conversion, conversion(2, 4));
  assert.equal(porClave.perdidas.conversion, null, 'terminal que mezcla no adjudicadas y cerradas: sin %');
  for (const p of pasos) if (p.conversion != null) assert.ok(p.conversion <= 100, p.clave + ' no pasa de 100 %');
});

test('embudoLicitaciones: mas presentadas que en redaccion (caso real 19-sep) no da mas de 100 %', () => {
  const real = [
    ...Array.from({ length: 9 }, (_, i) => ({ expediente: 'P' + i, estado: 'Presentada', importe: 10 })),
    { expediente: 'R1', estado: 'En redacción', importe: 10 }, { expediente: 'R2', estado: 'En redacción', importe: 10 },
    ...Array.from({ length: 25 }, (_, i) => ({ expediente: 'A' + i, estado: 'Aprobada', importe: 10 })),
  ];
  const porClave = Object.fromEntries(embudoLicitaciones(real).pasos.map(p => [p.clave, p]));
  assert.equal(porClave.presentadas.n, 9);
  assert.equal(porClave.redaccion.n, 2);
  assert.equal(porClave.presentadas.conversion, conversion(9, 11), 'de 11 que llegaron al menos a redaccion, 9 estan presentadas');
  assert.equal(porClave.redaccion.conversion, conversion(11, 36));
  assert.equal(porClave.ganadas.conversion, 0, 'nada ganado todavia: 0 %, no null');
});

test('embudoLicitaciones: division por cero cuando nada ha llegado al paso anterior', () => {
  const soloNuevas = embudoLicitaciones([{ expediente: 'X', estado: 'Nueva', importe: 100 }]);
  const p2 = Object.fromEntries(soloNuevas.pasos.map(p => [p.clave, p]));
  assert.equal(p2.decidir.conversion, 0, 'de 1 nueva, 0 han pasado a decidir');
  assert.equal(p2.aprobadas.conversion, null, 'acumulado anterior en cero: no se puede convertir "de cero"');
  assert.equal(p2.ganadas.conversion, null);
});

test('embudoLicitaciones: con lic_resumen presente, prefiere sus n/eur sobre contar el array crudo', () => {
  const resumen = {
    pausadas: { n: 4, eur: 40000 },
    descartadas: { n: 7, eur: 70000 },
    adjudicadas: { n: 2, eur: 20000 },
    contratadas: { n: 1, eur: 10000 },
    no_adjudicadas: { n: 3, eur: 3000 },
    cerradas: { n: 1, eur: 100 },
  };
  const { pasos, laterales } = embudoLicitaciones(lics, resumen);
  const porClave = Object.fromEntries(pasos.map(p => [p.clave, p]));
  assert.equal(porClave.ganadas.n, 3);
  assert.equal(porClave.ganadas.importe, 30000);
  assert.equal(porClave.perdidas.n, 4);
  assert.equal(porClave.perdidas.importe, 3100);
  const porClaveLat = Object.fromEntries(laterales.map(l => [l.clave, l]));
  assert.equal(porClaveLat.pausadas.n, 4);
  assert.equal(porClaveLat.pausadas.importe, 40000);
  assert.equal(porClaveLat.descartadas.n, 7);
  assert.equal(porClaveLat.descartadas.importe, 70000);
});

test('embudoLicitaciones: array vacio o ausente no rompe nada', () => {
  const { pasos, laterales } = embudoLicitaciones([]);
  assert.ok(pasos.every(p => p.n === 0 && p.importe === 0));
  assert.deepEqual(laterales, []);
  const sinArray = embudoLicitaciones(undefined);
  assert.ok(sinArray.pasos.every(p => p.n === 0));
});

// --- embudoExpedientes -------------------------------------------------------------------------------
test('embudoExpedientes: agrupa por estado_funnel, "sin fase" si falta, orden por volumen y suma importe', () => {
  const xs = [
    { estado_funnel: 'ejecución', importe: 8000 },
    { estado_funnel: 'ejecución', importe: 2000 },
    { estado_funnel: 'ejecución', importe: 1000 },
    { estado_funnel: 'cierre', importe: 500 },
    { importe: 100 }, // sin estado_funnel
    { estado_funnel: 'cierre', importe: 1500 },
  ];
  const { pasos, laterales } = embudoExpedientes(xs);
  assert.deepEqual(laterales, []);
  assert.equal(pasos[0].clave, 'ejecución', 'el grupo con mas filas va primero');
  assert.equal(pasos[0].n, 3);
  assert.equal(pasos[0].importe, 11000);
  assert.equal(pasos[0].conversion, null, 'las fases no son secuenciales, nunca hay conversion');
  const cierre = pasos.find(p => p.clave === 'cierre');
  assert.equal(cierre.n, 2);
  assert.equal(cierre.importe, 2000);
  const sinFase = pasos.find(p => p.clave === 'sin fase');
  assert.equal(sinFase.n, 1);
  assert.equal(sinFase.titulo, 'Sin fase');
});

test('embudoExpedientes: filtra expedientes inactivos (activo === false) y no rompe con array vacio', () => {
  const xs = [{ estado_funnel: 'ejecución', importe: 100 }, { estado_funnel: 'ejecución', importe: 999, activo: false }];
  const { pasos } = embudoExpedientes(xs);
  assert.equal(pasos[0].n, 1);
  assert.equal(pasos[0].importe, 100);
  assert.deepEqual(embudoExpedientes([]).pasos, []);
  assert.deepEqual(embudoExpedientes(undefined).pasos, []);
});

// --- embudoTablero -----------------------------------------------------------------------------------
const AHORA = new Date('2026-09-19T10:00:00Z');
test('embudoTablero: recuento por columna, columna desconocida cae en backlog, sin importe nunca', () => {
  const encargos = [
    { id: 1, columna: 'backlog', fecha_hito: null },
    { id: 2, columna: 'por_hacer', fecha_hito: '2026-09-10' },
    { id: 3, columna: 'en_curso', fecha_hito: '2026-09-30' },
    { id: 4, columna: 'columna_rara', fecha_hito: null },
    { id: 5, columna: 'hecho', fecha_hito: '2026-01-01' },
  ];
  const { pasos, laterales } = embudoTablero(encargos, AHORA);
  const porClave = Object.fromEntries(pasos.map(p => [p.clave, p]));
  assert.equal(porClave.backlog.n, 2, 'el id 1 y la columna_rara desconocida (via kanban) caen aqui');
  assert.equal(porClave.por_hacer.n, 1);
  assert.equal(porClave.en_curso.n, 1);
  assert.equal(porClave.hecho.n, 1);
  assert.ok(pasos.every(p => p.importe === null), 'un encargo no tiene campo de dinero');
  assert.equal(laterales.length, 1);
  assert.equal(laterales[0].clave, 'vencidos');
  assert.equal(laterales[0].n, 1, 'solo el id 2 tiene hito vencido en columna abierta');
});

test('embudoTablero: sin vencidos, laterales vacio; sin encargos, todo a cero', () => {
  const { laterales } = embudoTablero([{ id: 1, columna: 'en_curso', fecha_hito: '2027-01-01' }], AHORA);
  assert.deepEqual(laterales, []);
  const vacio = embudoTablero([], AHORA);
  assert.ok(vacio.pasos.every(p => p.n === 0));
  assert.deepEqual(vacio.laterales, []);
});

// --- resumenEquipo -----------------------------------------------------------------------------------
test('resumenEquipo: activos delega en agentesActivos(), cuentas mapea pct maximo, ordenadas desc, sin EUR/USD', () => {
  const agentes = [{ id: 'nil', nombre: 'Nil', activo: true, ultima_actividad: AHORA.toISOString() }];
  const encargos = [{ id: 1, agente: 'nil', estado: 'en_curso', texto: 'algo' }];
  const cuentas = [
    { cuenta: 'diego', pct_ventana: 40, pct_semana: 90 },
    { cuenta: 'team', pct_ventana: 10, pct_semana: 5 },
    { cuenta: 'sin_datos' },
  ];
  const r = resumenEquipo(agentes, encargos, cuentas, AHORA);
  assert.equal(r.activos.n, 1);
  assert.equal(r.activos.agentes[0].id, 'nil');
  assert.equal(r.cuentas.length, 2, 'sin_datos se descarta al no traer pct_ventana ni pct_semana');
  assert.equal(r.cuentas[0].clave, 'diego', 'diego (90%) va antes que team (10%)');
  assert.equal(r.cuentas[0].n, 90);
  assert.equal(r.cuentas[1].n, 10);
  assert.ok(r.cuentas.every(c => c.importe === null), 'nunca coste en EUR/USD');
});

test('resumenEquipo: sin cuentas en el payload (agente, o token sin acceso), cuentas sale vacio', () => {
  const r1 = resumenEquipo([], [], [], AHORA);
  assert.deepEqual(r1.cuentas, []);
  assert.equal(r1.activos.n, 0);
  const r2 = resumenEquipo([], [], undefined, AHORA);
  assert.deepEqual(r2.cuentas, []);
});
