import test from 'node:test';
import assert from 'node:assert/strict';
import { AREAS, CLAVES, resolver } from '../app/rutas.js';

test('AREAS tiene las seis áreas en orden y cada vista del menú es una clave válida', () => {
  assert.deepEqual(AREAS.map(a => a.id), ['hoy', 'operacion', 'equipo', 'recursos', 'direccion', 'reglas']);
  for (const a of AREAS) for (const v of a.vistas) assert.ok(CLAVES.has(v.clave), v.clave);
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
  ['#operacion', '', 'operacion/tablero', undefined, {}, '#operacion/tablero', true],
  ['#decisiones', '', 'reglas/decisiones', undefined, {}, '#reglas/decisiones', true],
  ['#decisiones/77', '', 'reglas/decisiones', '77', {}, '#reglas/decisiones/77', true],
  ['#reglas', '', 'reglas/decisiones', undefined, {}, '#reglas/decisiones', true],
  ['#equipo', '', 'equipo/organigrama', undefined, {}, '#equipo/organigrama', true],
  ['#equipo/sales-motor', '', 'equipo/agente', 'sales-motor', {}, '#equipo/agente/sales-motor', true],
  ['#equipo/agente/sales-motor', '', 'equipo/agente', 'sales-motor', {}, '#equipo/agente/sales-motor', false],
  ['#expedientes/9', '', 'operacion/expedientes', '9', {}, '#operacion/expedientes/9', true],
  ['#operacion/licitaciones', '', 'operacion/licitaciones', undefined, {}, '#operacion/licitaciones', false],
  ['#recursos', '', 'recursos/computo', undefined, {}, '#recursos/computo', true],
  ['#recursos/computo', '', 'recursos/computo', undefined, {}, '#recursos/computo', false],
  ['#recursos/dinero', '', 'recursos/computo', undefined, {}, '#recursos/computo', true],
  ['#loquesea/x', '', 'hoy', undefined, {}, '#hoy', true],
  ['#tablero', '?id=55', 'reglas/decisiones', '55', {}, '#reglas/decisiones/55', true],
  ['#hoy', '?id=abc', 'hoy', undefined, {}, '#hoy', false],
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
