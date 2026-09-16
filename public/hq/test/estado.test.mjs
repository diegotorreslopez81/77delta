import test from 'node:test';
import assert from 'node:assert/strict';
import { derivar, kanban, filtrar, semana, sinAcentos, COLUMNAS } from '../app/estado.js';

const datos = {
  objetivos: [{ horizonte: 2026, meta_eur: 300000 }],
  bloques: [{ letra: 'A', nombre: 'Licitaciones', meta_eur: 200000, encargos_abiertos: 2 }, { letra: 'B', nombre: 'Subvenciones', meta_eur: 105000, encargos_abiertos: 0 }],
  frentes: [{ id: 1, codigo: 'A1', bloque_letra: 'A', linea: 'Fuentes', encargos_abiertos: 1 }, { id: 2, codigo: 'A3', bloque_letra: 'A', linea: 'Ofertas', encargos_abiertos: 1 }, { id: 3, codigo: 'B1', bloque_letra: 'B', linea: 'ACCIÓ', encargos_abiertos: 0 }],
  encargos: [
    { id: 10, codigo: 'A1', bloque_letra: 'A', texto: 'Fuente Murcia', estado: 'en_curso', columna: 'en_curso', agente: 'Ariadna', responsable: 'Ariadna', rojo: true, orden_kanban: null, fecha_hito: '2026-09-18', origen: 'Diego 16-09 10:00', fecha: '2026-09-16T10:00:00Z', etiquetas: ['urgente'] },
    { id: 11, codigo: 'A3', bloque_letra: 'A', texto: 'Oferta Durango', estado: 'encolado', columna: 'por_hacer', agente: 'Guillem', responsable: 'Guillem', rojo: false, orden_kanban: 2, fecha_hito: '2026-09-18', origen: 'chief', fecha: '2026-09-15T10:00:00Z', etiquetas: [] },
    { id: 12, codigo: 'A3', bloque_letra: 'A', texto: 'Oferta Calp', estado: 'encolado', columna: 'por_hacer', agente: 'Guillem', responsable: 'Guillem', rojo: false, orden_kanban: 1, fecha_hito: null, origen: 'Diego 01-09 10:00', fecha: '2026-09-01T10:00:00Z', etiquetas: [] },
    { id: 13, codigo: 'A1', bloque_letra: 'A', texto: 'Hecho viejo', estado: 'hecho', columna: 'hecho', agente: 'Ariadna', responsable: 'Ariadna', rojo: false, orden_kanban: null, fecha_hito: null, origen: 'Diego 15-09 09:00', fecha: '2026-09-15T09:00:00Z', etiquetas: [] },
  ],
};
const ahora = new Date('2026-09-17T07:00:00Z');

test('derivar anida bloques y frentes y cuenta rojos', () => {
  const d = derivar(datos);
  assert.equal(d.bloques.length, 2);
  assert.deepEqual(d.bloques[0].frentes.map(f => f.codigo), ['A1', 'A3']);
  assert.equal(d.bloques[0].rojos, 1); assert.equal(d.bloques[1].frentes.length, 1);
});
test('kanban agrupa por columna y ordena por orden_kanban, hito, id', () => {
  const k = kanban(datos.encargos, {});
  assert.deepEqual(Object.keys(k), COLUMNAS.map(c => c[0]));
  assert.deepEqual(k.por_hacer.map(e => e.id), [12, 11]);
  assert.deepEqual(k.en_curso.map(e => e.id), [10]); assert.deepEqual(k.backlog, []);
});
test('filtrar por frente, bloque, agente, texto y etiqueta', () => {
  assert.deepEqual(filtrar(datos.encargos, { frente: 'A3' }).map(e => e.id), [11, 12]);
  assert.deepEqual(filtrar(datos.encargos, { bloque: 'A', agente: 'Ariadna' }).map(e => e.id), [10, 13]);
  assert.deepEqual(filtrar(datos.encargos, { texto: 'murcia' }).map(e => e.id), [10]);
  assert.deepEqual(filtrar(datos.encargos, { etiqueta: 'urgente' }).map(e => e.id), [10]);
});
test('semana: solo lo pedido por Diego en 7 días', () => {
  const s = semana(datos.encargos, ahora);
  assert.deepEqual(s.parados.map(e => e.id), [10]); assert.deepEqual(s.hechos.map(e => e.id), [13]); assert.deepEqual(s.en_curso, []);
});
test('sinAcentos', () => { assert.equal(sinAcentos('ACCIÓ Ñu'), 'accio nu'); });
