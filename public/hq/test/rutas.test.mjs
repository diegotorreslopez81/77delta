import test from 'node:test';
import assert from 'node:assert/strict';
import { AREAS, CLAVES, resolver } from '../app/rutas.js';

// Brief B (19-sep): menú nuevo con nueve áreas, todas de una sola vista. Operación va Licitaciones,
// Expedientes, Tablero (Diego: "así deberían ir ordenados y no al revés"); Equipo ya no agrupa: se
// reparte en Organigrama y Colaboradores, en la posición que ocupaba Equipo (justo antes de Recursos).
test('AREAS tiene las nueve áreas del menú nuevo en orden y cada vista es una clave válida', () => {
  assert.deepEqual(AREAS.map(a => a.id), ['hoy', 'kpis', 'licitaciones', 'expedientes', 'tablero', 'organigrama', 'colaboradores', 'recursos', 'direccion']);
  for (const a of AREAS) for (const v of a.vistas) assert.ok(CLAVES.has(v.clave), v.clave);
  assert.deepEqual(AREAS.find(a => a.id === 'organigrama').vistas.map(v => v.clave), ['equipo/organigrama']);
  assert.deepEqual(AREAS.find(a => a.id === 'colaboradores').vistas.map(v => v.clave), ['equipo/colaboradores']);
  assert.deepEqual(AREAS.find(a => a.id === 'recursos').vistas.map(v => v.clave), ['recursos/computo'], 'Recursos: Cómputo desde #1054; Dinero llega en la tanda 3');
});

const casos = [
  // [hash, search, clave, arg, filtros, canonico, redirigido]
  ['', '', 'hoy', undefined, {}, '#hoy', true],
  ['#hoy', '', 'hoy', undefined, {}, '#hoy', false],
  ['#inicio', '', 'hoy', undefined, {}, '#hoy', true],
  ['#plan', '', 'direccion/objetivo', undefined, {}, '#direccion/objetivo', true],
  ['#direccion', '', 'direccion/objetivo', undefined, {}, '#direccion/objetivo', true],
  ['#tablero', '', 'operacion/tablero', undefined, {}, '#operacion/tablero', true],
  ['#tablero/f/A3', '', 'operacion/tablero', undefined, { frente: 'A3' }, '#operacion/tablero?frente=A3', true],
  ['#tablero/12', '', 'operacion/tablero', '12', {}, '#operacion/tablero/12', true],
  ['#operacion/tablero?frente=A1&agente=sales-motor', '', 'operacion/tablero', undefined, { frente: 'A1', agente: 'sales-motor' }, '#operacion/tablero?frente=A1&agente=sales-motor', false],
  ['#operacion', '', 'operacion/licitaciones', undefined, {}, '#operacion/licitaciones', true],
  ['#decisiones', '', 'hoy', 'bandeja', {}, '#hoy/bandeja', true],
  ['#decisiones/77', '', 'hoy', '77', {}, '#hoy/77', true],
  ['#reglas/decisiones/77', '', 'hoy', '77', {}, '#hoy/77', true],
  ['#hoy/bandeja', '', 'hoy', 'bandeja', {}, '#hoy/bandeja', false],
  ['#hoy/12', '', 'hoy', '12', {}, '#hoy/12', false],
  ['#reglas', '', 'hoy', 'bandeja', {}, '#hoy/bandeja', true],
  ['#equipo', '', 'equipo/organigrama', undefined, {}, '#equipo/organigrama', true],
  ['#equipo/sales-motor', '', 'equipo/agente', 'sales-motor', {}, '#equipo/agente/sales-motor', true],
  ['#equipo/agente/sales-motor', '', 'equipo/agente', 'sales-motor', {}, '#equipo/agente/sales-motor', false],
  ['#expedientes/9', '', 'operacion/expedientes', '9', {}, '#operacion/expedientes/9', true],
  ['#operacion/licitaciones', '', 'operacion/licitaciones', undefined, {}, '#operacion/licitaciones', false],
  ['#recursos', '', 'recursos/computo', undefined, {}, '#recursos/computo', true],
  ['#recursos/computo', '', 'recursos/computo', undefined, {}, '#recursos/computo', false],
  ['#recursos/dinero', '', 'recursos/computo', undefined, {}, '#recursos/computo', true],
  ['#loquesea/x', '', 'hoy', undefined, {}, '#hoy', true],
  ['#tablero', '?id=55', 'hoy', '55', {}, '#hoy/55', true],
  ['#hoy', '?id=abc', 'hoy', undefined, {}, '#hoy', false],
  // #1057 tarea 29: nueva sección KPIs, con paso de grupo por query string igual que cualquier otro filtro.
  ['#kpis', '', 'kpis', undefined, {}, '#kpis', false],
  ['#kpis?grupo=licitaciones', '', 'kpis', undefined, { grupo: 'licitaciones' }, '#kpis?grupo=licitaciones', false],
];
for (const [hash, search, clave, arg, filtros, canonico, redirigido] of casos) {
  test('resolver ' + JSON.stringify(hash) + ' ' + JSON.stringify(search), () => {
    const r = resolver(hash, search);
    assert.equal(r.clave, clave); assert.equal(r.arg, arg); assert.deepEqual(r.filtros, filtros);
    assert.equal(r.canonico, canonico); assert.equal(r.redirigido, redirigido);
  });
}

// #1057 tarea 24: '#equipo/<vista>' con vista propia ya no cae en la ruta vieja '#equipo/<id>'.
test('equipo/organigrama y equipo/colaboradores resuelven a su vista sin redirigir', async () => {
  const { resolver } = await import('../app/rutas.js');
  for (const c of ['equipo/organigrama', 'equipo/colaboradores']) {
    const r = resolver('#' + c);
    assert.equal(r.clave, c); assert.equal(r.arg, undefined); assert.equal(r.redirigido, false);
  }
  assert.equal(resolver('#equipo/sales-motor').clave, 'equipo/agente');
});
