import test from 'node:test';
import assert from 'node:assert/strict';

// KPIs (#1057 tarea 29, rediseño brief 2022 19-sep: embudos por área con importes, ver app/embudos.js).
// kpis.js ya no importa las vistas de licitaciones/expedientes/tablero/equipo/colaboradores ni hace
// fetch propio (los helpers de embudos.js son puros y síncronos), pero sigue usando `el()` y las piezas
// de cuadro.js, que sí tocan `document`: mismo shim mínimo que el resto de vistas.
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

const { render, GRUPOS, porMotivo, filasMotivos } = await import('../app/vistas/kpis.js');
const { derivar } = await import('../app/estado.js');

const buscarNodos = (n, f, out = []) => { if (n && n.nodeType === 1) { if (f(n)) out.push(n); n.children.forEach(c => buscarNodos(c, f, out)); } return out; };
const clase = (n, c) => (n.className || '').split(' ').includes(c);
const AHORA = new Date('2026-09-18T10:00:00Z');

// Fixture de owner: un objetivo/bloque válidos (mismo patrón que objetivo.test.mjs), dos licitaciones en
// pasos distintos del embudo, un expediente, un encargo con hito vencido (para probar el lateral
// "Caducados" del Tablero) y un agente activo hace 5 minutos (para el grupo Equipo, con una cuenta al
// límite de consumo).
const lics = [
  { expediente: 'L1', elegible: 'Probable', estado: 'Nueva', decision: null, cierre: '2026-10-05', importe: '10000', resumen_corto: 'Resumen L1', objeto: 'Objeto L1' },
  { expediente: 'L6', elegible: 'Probable', estado: 'Aprobada', decision: 'OK', cierre: '2026-09-30', importe: '40000', resumen_corto: 'Resumen L6', objeto: 'Objeto L6' },
];
const xs = [{ id: 1, codigo: 'B2', nombre: 'Aresa', tipo: 'cliente', estado_funnel: 'ejecución', estado_economico: 'contratado', importe: '18000', encargos_abiertos: 1, responsable: 'nil' }];
const encargos = [{ id: 1, columna: 'en_curso', responsable: 'nil', texto: 'Uno', fecha_hito: '2026-09-10' }];
const ags = [{ id: 'nil', nombre: 'Nil', depto: 'Delivery', nivel: 3, ultima_actividad: '2026-09-18T09:55:00Z', encargos_abiertos: 1, frentes_codigos: [] }];

const datosOwner = {
  rol: 'owner',
  objetivos: [{ horizonte: 2026, meta: 300000, contratado_eur: 20000, presentado_eur: 90000 }],
  bloques: [{ id: 1, letra: 'A', nombre: 'Licitaciones', meta_eur: 200000, encargos_abiertos: 1 }],
  frentes: [], licitaciones: lics, lic_resumen: {}, kpis: {}, expedientes: xs, encargos, agentes: ags, sesiones: [],
  cuentas: [{ cuenta: 'diego', pct_ventana: 40, pct_semana: 97 }],
};
const sOwner = () => ({ datos: datosOwner, derivado: derivar(datosOwner) });

// Payload de agente (T4-c): solo lo que trae omc_hq_v2 para un token de agente, sin objetivos, bloques,
// licitaciones ni expedientes.
const datosAgente = { rol: 'agente', encargos, agentes: ags, sesiones: [] };
const sAgente = () => ({ datos: datosAgente, derivado: derivar(datosAgente) });

// render() ya no es async (embudos.js es puro y síncrono, sin fetch propio): `pintar` sigue devolviendo
// el nodo directamente, y los `await pintar(...)` de los tests de abajo siguen siendo válidos (await
// sobre un valor que no es promesa se resuelve igual).
const pintar = (S, filtrosRuta = {}) => { const raiz = crearNodo('main'); render(raiz, S, undefined, filtrosRuta, AHORA); return raiz; };
const grupos = r => buscarNodos(r, n => n.tag === 'section' && clase(n, 'kpi-grupo'));
const nombreGrupo = g => g.children[0].textContent;
const chips = r => buscarNodos(r, n => n.tag === 'a' && clase(n, 'chip'));

test('GRUPOS.disponible depende de las claves crudas del payload, no de S.derivado normalizado', () => {
  assert.deepEqual(GRUPOS.map(g => g.disponible(datosOwner)), [true, true, true, true, true]);
  assert.deepEqual(GRUPOS.map(g => [g.clave, g.disponible(datosAgente)]), [['licitaciones', false], ['expedientes', false], ['tablero', true], ['equipo', true], ['plan', false]]);
  // derivar() normaliza objetivos/bloques a [] aunque el payload nunca los trajera: disponible() se
  // calcula siempre sobre S.datos crudo, nunca sobre S.derivado (que enmascararía la ausencia).
  assert.deepEqual(derivar(datosAgente), { objetivos: [], bloques: [] });
});

test('GRUPOS: nombre "Objetivo" (antes "Plan"), misma clave "plan" para no romper #kpis?grupo=plan', () => {
  const plan = GRUPOS.find(g => g.clave === 'plan');
  assert.equal(plan.nombre, 'Objetivo');
});

test('render (owner, sin filtro): las 5 secciones en el orden del brief: Licitaciones, Expedientes, Tablero, Equipo, Objetivo', () => {
  const r = pintar(sOwner());
  assert.deepEqual(grupos(r).map(nombreGrupo), ['Licitaciones', 'Expedientes', 'Tablero', 'Equipo', 'Objetivo']);
  assert.ok(r.textContent.includes('Embudo de licitaciones') && r.textContent.includes('Nuevas') && r.textContent.includes('Ganadas') && r.textContent.includes('Perdidas'));
  assert.ok(r.textContent.includes('10 k EUR sin IVA') && r.textContent.includes('40 k EUR sin IVA'), 'importe de cada paso, etiquetado sin IVA');
  assert.ok(r.textContent.includes('Embudo de expedientes') && r.textContent.includes('ejecución') && r.textContent.includes('18 k EUR sin IVA'));
  assert.ok(r.textContent.includes('Encargos por columna') && r.textContent.includes('Backlog') && r.textContent.includes('En curso'));
  assert.ok(r.textContent.includes('Fuera del embudo') && r.textContent.includes('Caducados'), 'el encargo con hito 2026-09-10 esta vencido a fecha de AHORA');
  assert.ok(r.textContent.includes('Equipo activo') && r.textContent.includes('Nil'), 'agente activo hace 5 minutos, via agentesActivos()');
  assert.ok(r.textContent.includes('diego') && r.textContent.includes('97 %'), 'consumo semanal por cuenta, nunca EUR/USD');
  assert.ok(!r.textContent.includes('EUR/USD') && !r.textContent.includes('$'));
  assert.ok(r.textContent.includes('Objetivo 2026'), 'panel de una sola cifra, enlazado a #direccion/objetivo');
});

test('chips: "Todos" activo sin filtro, uno por grupo disponible en el payload de owner, en el orden del brief', () => {
  const r = pintar(sOwner());
  assert.deepEqual(chips(r).map(c => c.textContent), ['Todos', 'Licitaciones', 'Expedientes', 'Tablero', 'Equipo', 'Objetivo']);
  assert.ok(clase(chips(r)[0], 'activo'));
  assert.ok(chips(r).slice(1).every(c => !clase(c, 'activo')));
});

test('#kpis?grupo=tablero: solo esa sección, chip Tablero activo y "Todos" no', () => {
  const r = pintar(sOwner(), { grupo: 'tablero' });
  assert.deepEqual(grupos(r).map(nombreGrupo), ['Tablero']);
  const cs2 = chips(r);
  assert.ok(!clase(cs2.find(c => c.textContent === 'Todos'), 'activo'));
  assert.ok(clase(cs2.find(c => c.textContent === 'Tablero'), 'activo'));
});

test('un grupo de la ruta que no existe en GRUPOS se trata como sin filtro (todas las secciones disponibles)', () => {
  const r = pintar(sOwner(), { grupo: 'inventado' });
  assert.deepEqual(grupos(r).map(nombreGrupo), ['Licitaciones', 'Expedientes', 'Tablero', 'Equipo', 'Objetivo']);
});

test('rol agente: payload sin objetivos/bloques/licitaciones/expedientes solo pinta chips y secciones de Tablero y Equipo', () => {
  const r = pintar(sAgente());
  assert.deepEqual(chips(r).map(c => c.textContent), ['Todos', 'Tablero', 'Equipo']);
  assert.deepEqual(grupos(r).map(nombreGrupo), ['Tablero', 'Equipo']);
  assert.ok(!r.textContent.includes('Objetivo'));
  assert.ok(!r.textContent.includes('Embudo de licitaciones'));
  assert.ok(!r.textContent.includes('Embudo de expedientes'));
});

test('un grupo de owner pedido explícitamente sobre un payload de agente no se pinta (grupo no disponible)', () => {
  const r = pintar(sAgente(), { grupo: 'plan' });
  assert.deepEqual(grupos(r).map(nombreGrupo), []);
  assert.ok(r.textContent.includes('Sin KPIs disponibles para este filtro'));
});

test('render: sin expedientes en el payload, la sección Expedientes no se pinta (panelEmbudo devuelve null)', () => {
  const sinExp = { ...datosOwner, expedientes: [] };
  const r = pintar({ datos: sinExp, derivado: derivar(sinExp) });
  assert.ok(!grupos(r).map(nombreGrupo).includes('Expedientes'));
});

// Motivos de NO (#1063): recuento puro multietiqueta para el panel "Por qué no vamos". Sin cambios.
test('porMotivo: cuenta multietiqueta por motivo del catalogo, descendente, sin ceros, "Sin motivo" al final', () => {
  const conMotivos = [
    { expediente: 'D1', estado: 'Descartada', motivos: ['Sin pliego', 'Plazo corto'] },
    { expediente: 'D2', estado: 'Descartada', motivos: ['Sin pliego'] },
    { expediente: 'D3', estado: 'Descartada', motivos: [] },
    { expediente: 'D4', estado: 'Nueva', motivos: ['Sin pliego'] },
    { expediente: 'D5', estado: 'Aprobada', decision: 'OK', motivos: ['Cliente conocido'] },
  ];
  assert.deepEqual(porMotivo(conMotivos), [
    { motivo: 'Sin pliego', n: 2 },
    { motivo: 'Plazo corto', n: 1 },
    { motivo: 'Sin motivo', n: 1 },
  ]);
});

test('porMotivo: sin descartadas devuelve []; todas con motivo no añaden fila "Sin motivo"', () => {
  assert.deepEqual(porMotivo([]), []);
  assert.deepEqual(porMotivo([{ expediente: 'D1', estado: 'Descartada', motivos: ['Duplicada'] }]), [{ motivo: 'Duplicada', n: 1 }]);
});

test('render: panel "Por qué no vamos" en Licitaciones cuando hay descartadas con motivo, con subtitulo N de M', () => {
  const conDescartadas = { ...datosOwner, licitaciones: [...lics,
    { expediente: 'D1', estado: 'Descartada', motivos: ['Sin pliego'] },
    { expediente: 'D2', estado: 'Descartada', motivos: [] },
  ] };
  const r = pintar({ datos: conDescartadas, derivado: derivar(conDescartadas) });
  assert.ok(r.textContent.includes('Por qué no vamos'));
  assert.ok(r.textContent.includes('Sin pliego'));
  assert.ok(r.textContent.includes('descartadas con motivo del catálogo · 1 de 2'));
});

// Desde la 2.0.18 el payload trae lic_motivos agregado en SQL (las descartadas no viajan en 'licitaciones').
test('filasMotivos: con lic_motivos usa el agregado del servidor, ordena desc, anade "Sin motivo" y omite ceros', () => {
  const d = { licitaciones: [], lic_motivos: { descartadas: 10, con_motivo: 7, motivos: [
    { motivo: 'Presencial', n: 2 }, { motivo: 'Fuera de España', n: 5 }, { motivo: 'Duplicada', n: 0 } ] } };
  assert.deepEqual(filasMotivos(d), { filas: [
    { motivo: 'Fuera de España', n: 5 }, { motivo: 'Presencial', n: 2 }, { motivo: 'Sin motivo', n: 3 } ], total: 10, conMotivo: 7 });
});

test('filasMotivos: sin lic_motivos cae al recuento del payload (porMotivo); agregado vacio devuelve filas []', () => {
  const d = { licitaciones: [
    { expediente: 'D1', estado: 'Descartada', motivos: ['Sin pliego'] },
    { expediente: 'D2', estado: 'Descartada', motivos: [] } ] };
  assert.deepEqual(filasMotivos(d), { filas: [{ motivo: 'Sin pliego', n: 1 }, { motivo: 'Sin motivo', n: 1 }], total: 2, conMotivo: 1 });
  assert.deepEqual(filasMotivos({ licitaciones: [], lic_motivos: { descartadas: 0, con_motivo: 0, motivos: [] } }).filas, []);
  assert.deepEqual(filasMotivos({ licitaciones: [], lic_motivos: {} }).filas, []);
});

test('render: panel "Por qué no vamos" servido por lic_motivos aunque el payload no traiga descartadas', () => {
  const d = { ...datosOwner, lic_motivos: { descartadas: 1391, con_motivo: 1185, motivos: [{ motivo: 'Fuera de España', n: 638 }, { motivo: 'Sin pliego', n: 29 }] } };
  const r = pintar({ datos: d, derivado: derivar(d) });
  assert.ok(r.textContent.includes('Por qué no vamos'));
  assert.ok(r.textContent.includes('Fuera de España'));
  assert.ok(r.textContent.includes('descartadas con motivo del catálogo · 1185 de 1391'));
  const enlaces = buscarNodos(r, n => n.tag === 'a' && (n.attrs.href || '').includes('motivo=')).map(a => a.attrs.href);
  assert.ok(enlaces.includes('#operacion/licitaciones?estado=descartadas&motivo=Sin%20pliego'));
  assert.ok(enlaces.includes('#operacion/licitaciones?estado=descartadas&motivo=sin'));
});

test('render: sin descartadas, no se pinta el panel "Por qué no vamos"', () => {
  const r = pintar(sOwner());
  assert.ok(!r.textContent.includes('Por qué no vamos'));
});
