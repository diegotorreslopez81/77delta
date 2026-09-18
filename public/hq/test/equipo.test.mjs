import test from 'node:test';
import assert from 'node:assert/strict';

// Organigrama con perfiles vivos (#1057 tarea 23, HQ 2.0.10). equipo.js importa `recargar` de main.js,
// que toca el DOM al importarse: mismo shim mínimo que tablero.test.mjs.
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

const { render, cuadroEquipo, tarjetaAgente, tramo, porDepto } = await import('../app/vistas/equipo.js');
const buscarNodos = (n, f, out = []) => { if (n && n.nodeType === 1) { if (f(n)) out.push(n); n.children.forEach(c => buscarNodos(c, f, out)); } return out; };
const AHORA = new Date('2026-09-18T20:00:00Z');
const ags = [
  { id: 'chief', nombre: 'Marc', depto: 'Dirección', nivel: 1, modelo: 'fable', cuenta: 'team', ultima_actividad: '2026-09-18T19:30:00Z', encargos_abiertos: 20, frentes_codigos: ['E4'] },
  { id: 'sales-licita', nombre: 'Guillem', depto: 'Comercial', nivel: 3, modelo: 'fable', ultima_actividad: '2026-09-18T10:00:00Z', encargos_abiertos: 45, frentes_codigos: [] },
  { id: 'grants', nombre: 'Helena', depto: 'Estrategia', nivel: 3, modelo: 'opus', cuenta: 'team', ultima_actividad: '2026-09-15T10:00:00Z', encargos_abiertos: 1, sesion_abierta: 8, frentes_codigos: [] },
  { id: 'dir-com', nombre: 'Biel', depto: 'Comercial', nivel: 2, modelo: 'opus', ultima_actividad: null, encargos_abiertos: 0, frentes_codigos: [] },
  { id: 'baja', nombre: 'Baja', depto: 'Admin', nivel: 2, activo: false, encargos_abiertos: 0 },
];
const Sx = () => ({ datos: { agentes: ags, frentes: [], encargos: [], sesiones: [], expedientes: [{ id: 8, nombre: 'Aresa' }], rol: 'owner' } });
const textos = n => buscarNodos(n, () => true).map(x => x._text).filter(Boolean);

test('tramo de latido: activo, hoy, dormido y sin latido', () => {
  assert.deepEqual(ags.slice(0, 4).map(a => tramo(a, AHORA)), ['activo', 'hoy', 'dormido', 'sin']);
});

test('porDepto ordena por número de agentes y agrupa a partir del quinto en otros', () => {
  assert.deepEqual(porDepto(ags.slice(0, 4)).map(x => [x.l, x.v]), [['Comercial', 2], ['Dirección', 1], ['Estrategia', 1]]);
  const muchos = ['a', 'b', 'c', 'd', 'e', 'f'].map(d => ({ depto: d }));
  const r = porDepto(muchos);
  assert.equal(r.length, 5); assert.deepEqual(r[4], { l: 'otros', v: 2, color: 'neutro-3' });
});

test('cuadro del equipo: activos, departamentos, carga ordenada con enlace a la ficha y en sesión', () => {
  const ps = cuadroEquipo(ags.slice(0, 4), Sx(), AHORA);
  assert.equal(ps.length, 4);
  const t = ps.map(textos);
  assert.ok(t[0].includes('Equipo activo') && t[0].includes('4') && t[0].includes('2 con latido en las últimas 24 h'));
  assert.ok(t[2].includes('66') && t[2].includes('encargos abiertos en 3 agentes'));
  const filas = buscarNodos(ps[2], n => (n.className || '').includes('fila-barra'));
  assert.deepEqual(filas.map(f => f.attrs.href), ['#equipo/agente/sales-licita', '#equipo/agente/chief', '#equipo/agente/grants']);
  assert.ok(t[3].includes('1') && t[3].includes('Helena'));
});

test('tarjeta de agente: semáforo de latido, sesión con nombre de expediente, cifra y frentes', () => {
  const S = Sx();
  const c = tarjetaAgente(ags[0], S, AHORA);
  assert.ok(c.className.includes('tarjeta-rica'));
  assert.ok(buscarNodos(c, n => n.className === 'pill estado verde').length === 1);
  assert.equal(buscarNodos(c, n => n.tag === 'a' && n.attrs.href === '#operacion/tablero?frente=E4').length, 1);
  assert.ok(textos(c).includes('20') && textos(c).includes('Dirección · nivel 1 · fable · team@'));
  const h = tarjetaAgente(ags[2], S, AHORA);
  assert.ok(textos(h).includes('en sesión: Aresa') && textos(h).includes('1') && textos(h).includes('encargo abierto'));
  assert.ok(buscarNodos(h, n => n.className === 'pill estado').length === 1);
  assert.match(tarjetaAgente(ags[3], S, AHORA).textContent, /sin latido/);
});

test('render: cuadro arriba, secciones por departamento sin inactivos y ficha con arg', () => {
  const raiz = crearNodo('main');
  render(raiz, Sx(), null, {}, AHORA);
  assert.equal(raiz.children[0].className, 'cuadro');
  const h2 = raiz.children.slice(1).map(s => s.children[0]._text);
  assert.deepEqual(h2, ['Dirección', 'Comercial', 'Estrategia']);
  assert.equal(buscarNodos(raiz, n => (n.className || '').includes('tarjeta-agente')).length, 4);
  const f = crearNodo('main');
  render(f, Sx(), 'chief', {}, AHORA);
  assert.ok(textos(f).includes('Marc'));
});
