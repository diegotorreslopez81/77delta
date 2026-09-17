import test from 'node:test';
import assert from 'node:assert/strict';
import { accionAlSoltar } from '../app/dnd.js';
test('movimientos del kanban', () => {
  assert.equal(accionAlSoltar('por_hacer', 'en_curso').tipo, 'tomar');
  assert.equal(accionAlSoltar('bloqueado', 'en_curso').tipo, 'tomar');
  assert.equal(accionAlSoltar('en_curso', 'hecho').tipo, 'hecho');
  assert.equal(accionAlSoltar('en_curso', 'bloqueado').tipo, 'bloquear');
  assert.equal(accionAlSoltar('en_curso', 'backlog').tipo, 'reabrir');
  assert.equal(accionAlSoltar('hecho', 'por_hacer').tipo, 'reabrir');
  assert.equal(accionAlSoltar('backlog', 'por_hacer').tipo, 'planificar');
  assert.equal(accionAlSoltar('por_hacer', 'por_hacer').tipo, 'nada');
});
