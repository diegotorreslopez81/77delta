import test from 'node:test';
import assert from 'node:assert/strict';
import { DECIDIBLES, ABIERTAS, pendiente, porDecidir, enCriba, porElegible, solvenciaTexto, embudo } from '../app/licitaciones.js';

// Fixture de 8 licitaciones (Task 1, plan 3b): cubre decidibles, criba, descartada, aprobada por
// decision sin ser decidible, presentada y contratada con importe.
const lics = [
  { expediente: 'E1', elegible: 'Probable', estado: 'Nueva', decision: null, cierre: '2026-10-05', importe: null },
  { expediente: 'E2', elegible: 'Dudosa', estado: 'Por decidir', decision: '', cierre: null, importe: null },
  { expediente: 'E3', elegible: 'Revisar', estado: 'Nueva', decision: null, cierre: null, importe: null },
  { expediente: 'E4', elegible: 'No viable', estado: 'Nueva', decision: null, cierre: '2026-09-25', importe: null },
  { expediente: 'E5', elegible: 'Probable', estado: 'Descartada', decision: null, cierre: '2026-09-10', importe: '5000' },
  { expediente: 'E6', elegible: 'Probable', estado: 'Nueva', decision: 'OK', cierre: '2026-09-15', importe: '12000' },
  { expediente: 'E7', elegible: null, estado: 'Presentada', decision: 'OK', cierre: '2026-09-12', importe: '30000' },
  { expediente: 'E8', elegible: null, estado: 'Contratada', decision: 'OK', cierre: '2026-08-01', importe: '45000.5' },
];

test('DECIDIBLES y ABIERTAS son los conjuntos esperados', () => {
  assert.deepEqual([...DECIDIBLES], ['Probable', 'Dudosa']);
  assert.deepEqual([...ABIERTAS], ['Nueva', 'Por decidir']);
});

test('pendiente: decision null, vacia o Pendiente; OK y No no son pendientes', () => {
  assert.equal(pendiente({ decision: null }), true);
  assert.equal(pendiente({ decision: '' }), true);
  assert.equal(pendiente({ decision: 'Pendiente' }), true);
  assert.equal(pendiente({}), true);
  assert.equal(pendiente({ decision: 'OK' }), false);
  assert.equal(pendiente({ decision: 'No' }), false);
});

test('porDecidir: Probable/Nueva y Dudosa/Por decidir pendientes entran, ordenadas por cierre asc con nulls last', () => {
  const pd = porDecidir(lics);
  assert.deepEqual(pd.map(l => l.expediente), ['E1', 'E2']);
});

test('enCriba: Revisar/Nueva y No viable/Nueva pendientes entran, no decidibles, mismo orden', () => {
  const ec = enCriba(lics);
  assert.deepEqual(ec.map(l => l.expediente), ['E4', 'E3']);
});

test('Descartada queda fuera de porDecidir y enCriba aunque sea Probable y pendiente', () => {
  assert.ok(!porDecidir(lics).some(l => l.expediente === 'E5'));
  assert.ok(!enCriba(lics).some(l => l.expediente === 'E5'));
});

test('decision OK saca la fila de porDecidir/enCriba aunque sea elegible y este abierta', () => {
  assert.ok(!porDecidir(lics).some(l => l.expediente === 'E6'));
  assert.ok(!enCriba(lics).some(l => l.expediente === 'E6'));
});

test('porDecidir/enCriba: empate de cierre (incluidos ambos null) desempata por expediente', () => {
  const empatadas = [
    { expediente: 'Z9', elegible: 'Probable', estado: 'Nueva', decision: null, cierre: '2026-09-01' },
    { expediente: 'A1', elegible: 'Probable', estado: 'Nueva', decision: null, cierre: '2026-09-01' },
    { expediente: 'B2', elegible: 'Probable', estado: 'Nueva', decision: null, cierre: null },
    { expediente: 'A3', elegible: 'Probable', estado: 'Nueva', decision: null, cierre: null },
  ];
  assert.deepEqual(porDecidir(empatadas).map(l => l.expediente), ['A1', 'Z9', 'A3', 'B2']);
});

test('porElegible: agrupa por elegible (o Sin clasificar) y ordena por tamano desc', () => {
  const grupos = porElegible(lics);
  assert.deepEqual(grupos[0], ['Probable', grupos[0][1]]);
  assert.equal(grupos[0][1].length, 3);
  assert.equal(grupos[1][0], 'Sin clasificar');
  assert.equal(grupos[1][1].length, 2);
  assert.equal(grupos.length, 5);
  assert.equal(grupos.reduce((n, g) => n + g[1].length, 0), 8);
});

test('solvenciaTexto: vacio, ausente o que empieza por ? es sin dato', () => {
  assert.equal(solvenciaTexto({ solvencia: '' }), 'sin dato');
  assert.equal(solvenciaTexto({ solvencia: null }), 'sin dato');
  assert.equal(solvenciaTexto({}), 'sin dato');
  assert.equal(solvenciaTexto({ solvencia: '? no se pudo determinar la solvencia' }), 'sin dato');
});

test('solvenciaTexto: texto normal se devuelve tal cual', () => {
  assert.equal(solvenciaTexto({ solvencia: 'Alta, sin incidencias declaradas' }), 'Alta, sin incidencias declaradas');
});

test('solvenciaTexto: recorte a 160 caracteres mas el caracter de elipsis U+2026', () => {
  const largo = 'a'.repeat(200);
  const r = solvenciaTexto({ solvencia: largo });
  assert.equal(r.length, 161);
  assert.equal(r.slice(0, 160), 'a'.repeat(160));
  assert.equal(r.slice(160), '…');
  assert.equal(r.includes('...'), false);
});

test('embudo sin kpis: no hay fila detectadas ni analizadas', () => {
  const e = embudo(lics);
  assert.deepEqual(e.map(f => f.clave), ['por_decidir', 'en_criba', 'aprobadas', 'presentadas', 'adjudicadas', 'contratadas', 'descartadas', 'cerradas']);
});

test('embudo con kpis.lic.detectadas.n: primera fila detectadas con n 1500 y eur null', () => {
  const e = embudo(lics, { 'lic.detectadas.n': { valor: 1500 } });
  assert.equal(e[0].clave, 'detectadas');
  assert.equal(e[0].n, 1500);
  assert.equal(e[0].eur, null);
  assert.equal(e.some(f => f.clave === 'analizadas'), false);
});

test('embudo con detectadas y analizadas: ambas delante, en ese orden', () => {
  const e = embudo(lics, { 'lic.detectadas.n': { valor: 1500 }, 'lic.analizadas.n': { valor: 300 } });
  assert.deepEqual(e.slice(0, 2).map(f => f.clave), ['detectadas', 'analizadas']);
  assert.equal(e[1].n, 300);
});

test('embudo: cuenta por_decidir y en_criba igual que las funciones puras', () => {
  const e = embudo(lics);
  const pd = e.find(f => f.clave === 'por_decidir'), ec = e.find(f => f.clave === 'en_criba');
  assert.equal(pd.n, 2); assert.equal(pd.eur, 0);
  assert.equal(ec.n, 2); assert.equal(ec.eur, 0);
});

test('embudo: aprobadas cuenta estado Aprobada y decision OK fuera de Presentada/Adjudicada/Contratada, una vez cada fila', () => {
  const e = embudo(lics);
  const ap = e.find(f => f.clave === 'aprobadas');
  assert.equal(ap.n, 1); // solo E6
  assert.equal(ap.eur, 12000);
  const ambas = [...lics, { expediente: 'E9', estado: 'Aprobada', decision: 'OK', importe: '100' }];
  assert.equal(embudo(ambas).find(f => f.clave === 'aprobadas').n, 2);
});

test('embudo: presentadas, adjudicadas y contratadas por estado exacto', () => {
  const e = embudo(lics);
  assert.equal(e.find(f => f.clave === 'presentadas').n, 1);
  assert.equal(e.find(f => f.clave === 'presentadas').eur, 30000);
  assert.equal(e.find(f => f.clave === 'adjudicadas').n, 0);
  assert.equal(e.find(f => f.clave === 'contratadas').n, 1);
  assert.equal(e.find(f => f.clave === 'contratadas').eur, 45000.5);
});

test('embudo: No adjudicada no cuenta como adjudicada', () => {
  const conNoAdjudicada = [...lics, { expediente: 'E10', estado: 'No adjudicada', decision: 'OK', importe: '9999' }];
  assert.equal(embudo(conNoAdjudicada).find(f => f.clave === 'adjudicadas').n, 0);
});

test('embudo: descartadas por estado que empieza por Descartada o decision No, una vez por fila', () => {
  const e = embudo(lics);
  const de = e.find(f => f.clave === 'descartadas');
  assert.equal(de.n, 1); assert.equal(de.eur, 5000);
  const conNo = [...lics, { expediente: 'E11', estado: 'Nueva', decision: 'No', importe: '10' }, { expediente: 'E12', estado: 'Descartada por chief', decision: 'No', importe: '20' }];
  assert.equal(embudo(conNo).find(f => f.clave === 'descartadas').n, 3);
});

test('embudo: cerradas solo con estado Cerrada sin presentar', () => {
  const e = embudo(lics);
  assert.equal(e.find(f => f.clave === 'cerradas').n, 0);
  const conCerrada = [...lics, { expediente: 'E13', estado: 'Cerrada sin presentar', importe: '0' }];
  assert.equal(embudo(conCerrada).find(f => f.clave === 'cerradas').n, 1);
});
