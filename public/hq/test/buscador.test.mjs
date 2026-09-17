import test from 'node:test';
import assert from 'node:assert/strict';
import { buscar } from '../app/buscador.js';

const datos = {
  encargos: [{ id: 996, texto: 'Cobertura total de fuentes de licitaciones' }, { id: 12, texto: 'Otra cosa' }],
  pendientes: [{ id: 996, titulo: 'Aprobar gasto' }, { id: 635, titulo: 'Responder a Guillem sobre Cíclica' }],
  expedientes: [{ id: 9, nombre: 'Cíclica cupón IA' }],
  agentes: [{ id: 'sales-motor', nombre: 'Ariadna' }, { id: 'coo', nombre: 'Jordi-COO' }],
  frentes: [{ codigo: 'A1', linea: 'Detección y fuentes' }],
};
test('por número devuelve todo lo que tenga ese id, con su casa', () => {
  const r = buscar(datos, '#996');
  assert.deepEqual(r.map(x => [x.tipo, x.href]), [['encargo', '#operacion/tablero/996'], ['decision', '#reglas/decisiones/996']]);
  assert.equal(r[0].titulo, 'Cobertura total de fuentes de licitaciones');
});
test('por texto ignora acentos y mayúsculas y busca en título e id', () => {
  assert.deepEqual(buscar(datos, 'ciclica').map(x => x.tipo), ['decision', 'expediente']);
  assert.deepEqual(buscar(datos, 'ARIADNA').map(x => x.href), ['#equipo/agente/sales-motor']);
  assert.deepEqual(buscar(datos, 'sales-mot').map(x => x.tipo), ['agente']);
  assert.deepEqual(buscar(datos, 'a1').map(x => x.href), ['#operacion/tablero?frente=A1']);
});
test('vacío o sin resultados devuelve [], y respeta el tope', () => {
  assert.deepEqual(buscar(datos, ''), []); assert.deepEqual(buscar(datos, '   '), []); assert.deepEqual(buscar(datos, 'zzz'), []);
  const muchos = { encargos: Array.from({ length: 30 }, (_, i) => ({ id: i + 1, texto: 'repetido' })) };
  assert.equal(buscar(muchos, 'repetido').length, 12); assert.equal(buscar(muchos, 'repetido', 5).length, 5);
});
test('tolera payload sin listas', () => { assert.deepEqual(buscar({}, '996'), []); });
// I3 (revision final del controlador): la ficha completa de una licitacion vive en
// Operacion/Licitaciones (Reglas/Decisiones solo lista las decidibles); el resultado de busqueda
// debe enlazar ahi, no a Reglas/Decisiones.
test('licitación enlaza a Operacion/Licitaciones, no a Reglas/Decisiones (revision final, I3)', () => {
  const conLicitaciones = { ...datos, licitaciones: [{ expediente: 'A31/2025/80', resumen_corto: 'Servicio de limpieza' }] };
  const r = buscar(conLicitaciones, 'A31/2025/80');
  assert.equal(r.length, 1);
  assert.equal(r[0].tipo, 'licitación');
  assert.equal(r[0].href, '#operacion/licitaciones');
});
test('un tipo con muchas coincidencias no agota el tope: los demás tipos también entran (revisión final, Important 2)', () => {
  const muchos = {
    encargos: Array.from({ length: 20 }, (_, i) => ({ id: i + 1, texto: 'kit consulting ' + i })),
    agentes: [{ id: 'kit-bot', nombre: 'Agente Kit' }],
  };
  const r = buscar(muchos, 'kit');
  assert.equal(r.length, 12);
  assert.ok(r.some(x => x.tipo === 'agente'), 'el agente que casa con "kit" debe estar entre los 12 resultados');
});
