import test from 'node:test';
import assert from 'node:assert/strict';
import { derivar, kanban, filtrar, semana, sinAcentos, COLUMNAS } from '../app/estado.js';
import { prorrateo, contador, semaforoCuentas, enCurso, cierres } from '../app/estado.js';

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
test('prorrateo reparte la meta anual por día natural; año futuro 0, año pasado la meta entera', () => {
  // 2026-07-02 es el día 183 de 365: 300000 * 183 / 365 = 150410.9...
  assert.equal(Math.round(prorrateo(300000, 2026, new Date('2026-07-02T12:00:00Z'))), 150411);
  assert.ok(Math.abs(prorrateo(300000, 2026, new Date('2026-01-01T12:00:00Z')) - 300000 / 365) < 0.01);
  assert.equal(prorrateo(300000, 2026, new Date('2026-12-31T12:00:00Z')), 300000);
  assert.equal(prorrateo(3000000, 2027, new Date('2026-09-17T12:00:00Z')), 0);
  assert.equal(prorrateo(100, 2025, new Date('2026-09-17T12:00:00Z')), 100);
  assert.equal(prorrateo(null, 2026, new Date('2026-09-17T12:00:00Z')), 0);
});
test('contador: owner cuenta lo que depende de Diego; agente cuenta lo que está en curso', () => {
  const owner = { rol: 'owner', pendientes: [{ id: 1 }, { id: 2 }], encargos: [{ id: 9, estado: 'en_curso' }] };
  assert.deepEqual(contador(owner), { texto: 'Depende de ti', n: 2, href: '#hoy' });
  const agente = { rol: 'agente', pendientes: [], encargos: [{ id: 9, estado: 'en_curso' }, { id: 10, estado: 'hecho' }, { id: 11, estado: 'bloqueado_diego' }] };
  assert.deepEqual(contador(agente), { texto: 'En curso', n: 1, href: '#operacion/tablero' });
  assert.deepEqual(contador({ rol: 'owner' }), { texto: 'Depende de ti', n: 0, href: '#hoy' });
});
test('semaforoCuentas: null sin datos de cuentas; color por la cuenta más cargada', () => {
  assert.equal(semaforoCuentas({}), null); assert.equal(semaforoCuentas({ cuentas: [] }), null);
  assert.deepEqual(semaforoCuentas({ cuentas: [{ cuenta: 'diego@', pct_ventana: 40 }, { cuenta: 'team@', pct_ventana: 79 }] }), { color: 'verde', pct: 79, cuenta: 'team@', tramo: 'ventana' });
  assert.deepEqual(semaforoCuentas({ cuentas: [{ cuenta: 'diego@', pct_ventana: 80 }] }), { color: 'ambar', pct: 80, cuenta: 'diego@', tramo: 'ventana' });
  assert.deepEqual(semaforoCuentas({ cuentas: [{ cuenta: 'diego@', pct_ventana: 95 }, { cuenta: 'team@', pct_ventana: 10 }] }), { color: 'rojo', pct: 95, cuenta: 'diego@', tramo: 'ventana' });
  // #1054: cuenta el mayor de ventana y semana (la cuenta se bloquea por cualquiera de los dos límites)
  assert.deepEqual(semaforoCuentas({ cuentas: [{ cuenta: 'diego@', pct_ventana: 12, pct_semana: 93 }, { cuenta: 'team@', pct_ventana: 5, pct_semana: 97 }] }), { color: 'rojo', pct: 97, cuenta: 'team@', tramo: 'semana' });
});
test('enCurso deja solo estado en_curso', () => {
  assert.deepEqual(enCurso([{ id: 1, estado: 'en_curso' }, { id: 2, estado: 'encolado' }, { id: 3, estado: 'hecho' }]).map(e => e.id), [1]);
  assert.deepEqual(enCurso(undefined), []);
});
test('cierres: fecha_hito dentro de la ventana, nunca hecho/descartado, ordenado por fecha_hito', () => {
  const ahoraC = new Date('2026-09-17T07:00:00Z');
  const encargosC = [
    { id: 1, fecha_hito: '2026-09-20', estado: 'en_curso' },
    { id: 2, fecha_hito: '2026-09-18', estado: 'encolado' },
    { id: 3, fecha_hito: '2026-09-30', estado: 'en_curso' }, // fuera de la ventana de 7 días
    { id: 4, fecha_hito: '2026-09-19', estado: 'hecho' }, // excluido por estado
    { id: 5, fecha_hito: '2026-09-19', estado: 'descartado' }, // excluido por estado
    { id: 6, fecha_hito: null, estado: 'en_curso' }, // sin hito
    { id: 7, fecha_hito: '2026-09-16', estado: 'en_curso' }, // ya pasó
  ];
  assert.deepEqual(cierres(encargosC, ahoraC).map(e => e.id), [2, 1]);
  assert.deepEqual(cierres(encargosC, ahoraC, 15).map(e => e.id), [2, 1, 3]);
  assert.deepEqual(cierres(undefined, ahoraC), []);
});

// 2.0.20: latido compartido y "quién está activo ahora mismo".
test('tramoLatido: cuatro tramos desde la ultima actividad', async () => {
  const { tramoLatido } = await import('../app/estado.js');
  const ahora = new Date('2026-09-19T12:00:00Z');
  assert.equal(tramoLatido({ ultima_actividad: '2026-09-19T11:40:00Z' }, ahora), 'activo');
  assert.equal(tramoLatido({ ultima_actividad: '2026-09-19T05:00:00Z' }, ahora), 'hoy');
  assert.equal(tramoLatido({ ultima_actividad: '2026-09-17T05:00:00Z' }, ahora), 'dormido');
  assert.equal(tramoLatido({ ultima_actividad: null }, ahora), 'sin');
  assert.equal(tramoLatido(null, ahora), 'sin');
});

test('agentesActivos: solo agentes de alta con latido reciente, con su encargo en curso', async () => {
  const { agentesActivos } = await import('../app/estado.js');
  const ahora = new Date('2026-09-19T12:00:00Z');
  const agentes = [
    { id: 'ariadna', nombre: 'Ariadna', ultima_actividad: '2026-09-19T11:50:00Z' },
    { id: 'guillem', nombre: 'Guillem', ultima_actividad: '2026-09-19T11:59:00Z' },
    { id: 'marta', nombre: 'Marta', ultima_actividad: '2026-09-19T08:00:00Z' },   // latido viejo
    { id: 'pau', nombre: 'Pau', ultima_actividad: null },                          // sin latido
    { id: 'jordi', nombre: 'Jordi', ultima_actividad: '2026-09-19T11:55:00Z', activo: false }, // de baja
  ];
  const encargos = [
    { id: 1, texto: 'Oferta Calp', estado: 'en_curso', agente: 'ariadna', fecha_estado: '2026-09-18T10:00:00Z' },
    { id: 2, texto: 'Oferta Durango', estado: 'en_curso', agente: 'ariadna', fecha_estado: '2026-09-19T09:00:00Z' },
    { id: 3, texto: 'Ya cerrado', estado: 'hecho', agente: 'guillem' },
    { id: 4, texto: 'Por responsable', estado: 'en_curso', agente: null, responsable: 'guillem', fecha: '2026-09-19T07:00:00Z' },
  ];
  const r = agentesActivos(agentes, encargos, ahora);
  assert.equal(r.n, 2);
  assert.deepEqual(r.agentes.map(a => a.id), ['ariadna', 'guillem']);
  assert.deepEqual(r.agentes[0].encargo, { id: 2, titulo: 'Oferta Durango' }, 'el mas reciente de los suyos en curso');
  assert.deepEqual(r.agentes[1].encargo, { id: 4, titulo: 'Por responsable' });
  assert.deepEqual(agentesActivos([], [], ahora), { n: 0, agentes: [] });
  assert.deepEqual(agentesActivos(undefined, undefined, ahora), { n: 0, agentes: [] });
  // Un agente activo sin encargo en curso sale igual, con encargo null.
  assert.equal(agentesActivos([agentes[0]], [], ahora).agentes[0].encargo, null);
});
