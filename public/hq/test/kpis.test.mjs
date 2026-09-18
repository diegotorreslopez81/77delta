import test from 'node:test';
import assert from 'node:assert/strict';

// KPIs (#1057 tarea 29). kpis.js importa objetivo/licitaciones/expedientes/tablero/equipo/colaboradores,
// y tablero.js y equipo.js importan `recargar` de main.js: mismo shim completo (con classList, dataset,
// querySelector/querySelectorAll/closest) que tablero.test.mjs y equipo.test.mjs, porque los import()
// estaticos de esa cadena se ejecutan antes que cualquier otra sentencia de este fichero.
function crearNodo(tag) {
  const n = {
    tag, nodeType: 1, children: [], attrs: {}, className: '', _text: '', _html: '', listeners: {}, parent: null, dataset: {},
    classList: { toggle(c, on) { const s = new Set(this._n.className.split(' ').filter(Boolean)); on ? s.add(c) : s.delete(c); this._n.className = [...s].join(' '); return on; }, contains(c) { return this._n.className.split(' ').includes(c); }, add(c) { this.toggle(c, true); }, remove(c) { this.toggle(c, false); } },
    setAttribute(k, v) { this.attrs[k] = v; if (k.startsWith('data-')) this.dataset[k.slice(5)] = v; },
    getAttribute(k) { return this.attrs[k] ?? null; },
    addEventListener(ev, fn) { (this.listeners[ev] ||= []).push(fn); },
    append(...kids) { for (const k of kids) { if (k == null) continue; k.parent = this; this.children.push(k); } },
    remove() { if (this.parent) { const i = this.parent.children.indexOf(this); if (i >= 0) this.parent.children.splice(i, 1); this.parent = null; } },
    prepend(...kids) { for (const k of kids.reverse()) { if (k == null) continue; k.parent = this; this.children.unshift(k); } },
    querySelector() { return null; }, querySelectorAll() { return []; }, closest() { return null; },
    get textContent() { return this.children.length ? this.children.map(c => (c.nodeType === 3 ? c.data : c.textContent)).join('') : this._text; },
    set textContent(v) { this._text = v; this.children = []; },
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = v; this.children = []; },
  };
  n.classList._n = n;
  return n;
}
globalThis.document = {
  createElement: (tag) => crearNodo(tag),
  createTextNode: (data) => ({ nodeType: 3, data }),
  getElementById: () => crearNodo('div'),
  body: crearNodo('body'),
  addEventListener: () => {},
};
globalThis.location = { hash: '', search: '', pathname: '/hq/' };
globalThis.history = { replaceState: () => {} };
globalThis.window = { addEventListener: () => {} };
globalThis.HQ_VERSION = { v: 'test' };
globalThis.matchMedia = () => ({ matches: false });
if (typeof globalThis.localStorage === 'undefined') {
  const mem = new Map();
  globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
}

const { render, GRUPOS } = await import('../app/vistas/kpis.js');
const { derivar } = await import('../app/estado.js');
const { cargarColaboradores, limpiarCache } = await import('../app/vistas/colaboradores.js');

const buscarNodos = (n, f, out = []) => { if (n && n.nodeType === 1) { if (f(n)) out.push(n); n.children.forEach(c => buscarNodos(c, f, out)); } return out; };
const clase = (n, c) => (n.className || '').split(' ').includes(c);
const AHORA = new Date('2026-09-18T10:00:00Z');

// Fixture de owner: un objetivo/bloque validos (mismo patron que objetivo.test.mjs), dos licitaciones
// (mismo fixture que licitaciones-vista.test.mjs), un expediente y un tablero minimos.
const lics = [
  { expediente: 'L1', elegible: 'Probable', estado: 'Nueva', decision: null, cierre: '2026-10-05', importe: '10000', resumen_corto: 'Resumen L1', objeto: 'Objeto L1' },
  { expediente: 'L6', elegible: 'Probable', estado: 'Aprobada', decision: 'OK', cierre: '2026-09-30', importe: '40000', resumen_corto: 'Resumen L6', objeto: 'Objeto L6' },
];
const xs = [{ id: 1, codigo: 'B2', nombre: 'Aresa', tipo: 'cliente', estado_funnel: 'ejecución', estado_economico: 'contratado', importe: '8000', encargos_abiertos: 1, responsable: 'nil' }];
const encargos = [{ id: 1, columna: 'en_curso', responsable: 'nil', texto: 'Uno', fecha_hito: '2026-09-10' }];
const ags = [{ id: 'nil', nombre: 'Nil', depto: 'Delivery', nivel: 3, ultima_actividad: '2026-09-18T09:00:00Z', encargos_abiertos: 1, frentes_codigos: [] }];
const cs = [{ id: 1, nombre: 'Ana', especialidades: ['salud'], estado: 'activo', origen: 'red', colaboraciones: [] }];

const datosOwner = {
  rol: 'owner',
  objetivos: [{ horizonte: 2026, meta: 300000, contratado_eur: 20000, presentado_eur: 90000 }],
  bloques: [{ id: 1, letra: 'A', nombre: 'Licitaciones', meta_eur: 200000, encargos_abiertos: 1 }],
  frentes: [], licitaciones: lics, lic_resumen: {}, kpis: {}, expedientes: xs, encargos, agentes: ags, sesiones: [],
};
const sOwner = () => ({ datos: datosOwner, derivado: derivar(datosOwner) });

// Payload de agente (T4-c): solo lo que trae omc_hq_v2 para un token de agente, sin objetivos, bloques,
// licitaciones ni expedientes.
const datosAgente = { rol: 'agente', encargos, agentes: ags, sesiones: [] };
const sAgente = () => ({ datos: datosAgente, derivado: derivar(datosAgente) });

const pintar = async (S, filtrosRuta = {}) => { const raiz = crearNodo('main'); await render(raiz, S, undefined, filtrosRuta, AHORA); return raiz; };
const grupos = r => buscarNodos(r, n => n.tag === 'section' && clase(n, 'kpi-grupo'));
const nombreGrupo = g => g.children[0].textContent;
const chips = r => buscarNodos(r, n => n.tag === 'a' && clase(n, 'chip'));

test('GRUPOS.disponible depende de las claves crudas del payload, no de S.derivado normalizado', () => {
  assert.deepEqual(GRUPOS.map(g => g.disponible(datosOwner)), [true, true, true, true, true]);
  assert.deepEqual(GRUPOS.map(g => [g.clave, g.disponible(datosAgente)]), [['plan', false], ['licitaciones', false], ['expedientes', false], ['tablero', true], ['equipo', true]]);
  // derivar() normaliza objetivos/bloques a [] aunque el payload nunca los trajera: disponible() se
  // calcula siempre sobre S.datos crudo, nunca sobre S.derivado (que enmascararía la ausencia).
  assert.deepEqual(derivar(datosAgente), { objetivos: [], bloques: [] });
});

test('render (owner, sin filtro): las 5 secciones en orden Plan, Licitaciones, Expedientes, Tablero, Equipo', async () => {
  limpiarCache();
  await cargarColaboradores(async () => cs);
  const r = await pintar(sOwner());
  assert.deepEqual(grupos(r).map(nombreGrupo), ['Plan', 'Licitaciones', 'Expedientes', 'Tablero', 'Equipo']);
  assert.ok(r.textContent.includes('Objetivo 2026'), 'paneles reales de objetivo.js dentro de Plan');
  assert.ok(r.textContent.includes('Cartera de clientes'), 'paneles reales de expedientes.js dentro de Expedientes');
  assert.ok(r.textContent.includes('Equipo activo') && r.textContent.includes('Colaboradores'), 'equipo + colaboradores fusionados en Equipo');
});

test('chips: "Todos" activo sin filtro, uno por grupo disponible en el payload de owner', async () => {
  const r = await pintar(sOwner());
  assert.deepEqual(chips(r).map(c => c.textContent), ['Todos', 'Plan', 'Licitaciones', 'Expedientes', 'Tablero', 'Equipo']);
  assert.ok(clase(chips(r)[0], 'activo'));
  assert.ok(chips(r).slice(1).every(c => !clase(c, 'activo')));
});

test('#kpis?grupo=tablero: solo esa sección, chip Tablero activo y "Todos" no', async () => {
  const r = await pintar(sOwner(), { grupo: 'tablero' });
  assert.deepEqual(grupos(r).map(nombreGrupo), ['Tablero']);
  const cs2 = chips(r);
  assert.ok(!clase(cs2.find(c => c.textContent === 'Todos'), 'activo'));
  assert.ok(clase(cs2.find(c => c.textContent === 'Tablero'), 'activo'));
});

test('un grupo de la ruta que no existe en GRUPOS se trata como sin filtro (todas las secciones disponibles)', async () => {
  const r = await pintar(sOwner(), { grupo: 'inventado' });
  assert.deepEqual(grupos(r).map(nombreGrupo), ['Plan', 'Licitaciones', 'Expedientes', 'Tablero', 'Equipo']);
});

test('rol agente: payload sin objetivos/bloques/licitaciones/expedientes solo pinta chips y secciones de Tablero y Equipo', async () => {
  limpiarCache();
  await cargarColaboradores(async () => []);
  const r = await pintar(sAgente());
  assert.deepEqual(chips(r).map(c => c.textContent), ['Todos', 'Tablero', 'Equipo']);
  assert.deepEqual(grupos(r).map(nombreGrupo), ['Tablero', 'Equipo']);
  assert.ok(!r.textContent.includes('Objetivo'));
  assert.ok(!r.textContent.includes('Pipeline activo'));
  assert.ok(!r.textContent.includes('Cartera de clientes'));
});

test('un grupo de owner pedido explícitamente sobre un payload de agente no se pinta (grupo no disponible)', async () => {
  const r = await pintar(sAgente(), { grupo: 'plan' });
  assert.deepEqual(grupos(r).map(nombreGrupo), []);
  assert.ok(r.textContent.includes('Sin KPIs disponibles para este filtro'));
});

// Mismo patrón de guarda de carrera que colaboradores.test.mjs: turno es de módulo, así que basta con
// no esperar la primera llamada antes de lanzar la segunda; cargarColaboradores() ya viene con caché
// caliente (arriba) así que ambas resuelven rápido, pero el orden de `mio` queda fijado al llamar.
test('render: la respuesta tardía del grupo equipo no se pinta si llegó otra después', async () => {
  limpiarCache();
  await cargarColaboradores(async () => cs);
  const vieja = crearNodo('main'), nueva = crearNodo('main');
  const p1 = render(vieja, sOwner(), undefined, { grupo: 'equipo' }, AHORA);
  const p2 = render(nueva, sOwner(), undefined, { grupo: 'equipo' }, AHORA);
  await p1; await p2;
  assert.deepEqual(grupos(vieja).map(nombreGrupo), []);
  assert.deepEqual(grupos(nueva).map(nombreGrupo), ['Equipo']);
});
