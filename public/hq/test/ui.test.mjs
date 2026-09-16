import test from 'node:test';
import assert from 'node:assert/strict';
import { eur, fecha, horas } from '../app/ui.js';

test('eur formatea sin decimales y con EUR', () => {
  assert.equal(eur(300000), '300.000 EUR');
  assert.equal(eur(0), '0 EUR');
  assert.equal(eur(null), '-');
});
test('fecha corta en español', () => {
  assert.equal(fecha('2026-09-16T15:30:00Z', { hora: true, tz: 'Europe/Madrid' }), 'mié 16 17:30');
  assert.equal(fecha('2026-09-20', {}), 'dom 20');
  assert.equal(fecha(null, {}), '-');
});
test('horas desde una fecha', () => {
  assert.equal(horas('2026-09-14T07:00:00Z', new Date('2026-09-16T10:00:00Z')), 51);
});
