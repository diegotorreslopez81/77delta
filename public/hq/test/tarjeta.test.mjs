import test from 'node:test';
import assert from 'node:assert/strict';
import { resumenEncargo } from '../app/tarjeta.js';

const ahora = new Date('2026-09-16T12:00:00Z');
test('resumen recorta el texto y compone la linea secundaria', () => {
  const r = resumenEncargo({ id: 10, codigo: 'A1', texto: 'x'.repeat(120), agente: 'Ariadna', fecha_hito: '2026-09-18', fecha_avance: '2026-09-14T09:00:00Z', rojo: true, estado: 'en_curso' }, ahora);
  assert.equal(r.titulo.length, 90); assert.ok(r.titulo.endsWith('…'));
  assert.equal(r.sub, 'Ariadna · hito vie 18 · 51 h sin avance'); assert.equal(r.clase, 'roja');
});
test('resumen sin hito ni rojo', () => {
  const r = resumenEncargo({ id: 11, codigo: 'B1', texto: 'corto', agente: 'Helena', fecha_hito: null, fecha_avance: null, fecha: '2026-09-16T10:00:00Z', rojo: false, estado: 'encolado' }, ahora);
  assert.equal(r.sub, 'Helena · sin hito'); assert.equal(r.clase, '');
});
