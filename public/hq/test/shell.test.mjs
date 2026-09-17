import test from 'node:test';
import assert from 'node:assert/strict';
function crearNodo(tag) {
  return { tag, nodeType: 1, children: [], attrs: {}, className: '', _text: '', parent: null, dataset: {}, hidden: false,
    classList: { toggle(c, on) { const s = new Set(this._n.className.split(' ').filter(Boolean)); on ? s.add(c) : s.delete(c); this._n.className = [...s].join(' '); return on; }, contains(c) { return this._n.className.split(' ').includes(c); }, add(c) { this.toggle(c, true); }, remove(c) { this.toggle(c, false); } },
    setAttribute(k, v) { this.attrs[k] = v; if (k.startsWith('data-')) this.dataset[k.slice(5)] = v; }, addEventListener() {},
    append(...kids) { for (const k of kids) { if (k == null) continue; k.parent = this; this.children.push(k); } },
    get textContent() { return this.children.length ? this.children.map(c => (c.nodeType === 3 ? c.data : c.textContent)).join('') : this._text; },
    set textContent(v) { this._text = v; this.children = []; }, set innerHTML(v) { this.children = []; }, get innerHTML() { return ''; } };
}
const nodos = {};
globalThis.document = { createElement: t => { const n = crearNodo(t); n.classList._n = n; return n; }, createTextNode: d => ({ nodeType: 3, data: d }), getElementById: id => (nodos[id] ||= document.createElement('div')), body: null, addEventListener() {} };
document.body = document.createElement('body');
globalThis.location = { hash: '', search: '', pathname: '/hq/', href: 'https://77delta.com/hq/#hoy' }; globalThis.history = { replaceState() {} }; globalThis.window = { addEventListener() {} }; globalThis.HQ_VERSION = { v: 'test' };
if (typeof globalThis.localStorage === 'undefined') { const mem = new Map(); globalThis.localStorage = { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) }; }
globalThis.matchMedia = () => ({ matches: false });

const { montarMenu, marcarActiva, pintarBarra } = await import('../app/shell.js');

test('montarMenu pinta las seis áreas, un enlace por vista y "pronto" en Recursos', () => {
  const nav = document.createElement('nav'); const m = montarMenu(nav);
  assert.equal(nav.children.length, 6); assert.equal(m.enlaces.size, 7);
  assert.equal(m.enlaces.get('operacion/tablero').attrs.href, '#operacion/tablero');
  assert.equal(m.enlaces.get('hoy').attrs['data-inicial'], 'H');
  assert.ok(m.areas.get('recursos').textContent.includes('pronto'));
});
test('marcarActiva marca el enlace y abre su área; la ficha de agente activa Equipo', () => {
  const nav = document.createElement('nav'); const m = montarMenu(nav);
  marcarActiva('operacion/tablero');
  assert.ok(m.enlaces.get('operacion/tablero').classList.contains('activa')); assert.ok(!m.enlaces.get('hoy').classList.contains('activa'));
  assert.ok(m.areas.get('operacion').classList.contains('abierta')); assert.ok(!m.areas.get('hoy').classList.contains('abierta'));
  marcarActiva('equipo/agente');
  assert.ok(m.areas.get('equipo').classList.contains('abierta')); assert.ok(!m.enlaces.get('operacion/tablero').classList.contains('activa'));
});
test('pintarBarra: contador con número y href; semáforo oculto sin cuentas y con color si las hay', () => {
  pintarBarra({ rol: 'owner', pendientes: [{ id: 1 }, { id: 2 }] });
  const c = document.getElementById('contador'), s = document.getElementById('semaforo');
  assert.equal(c.textContent, 'Depende de ti 2'); assert.equal(c.attrs.href, '#hoy'); assert.equal(c.hidden, false); assert.equal(s.hidden, true);
  pintarBarra({ rol: 'owner', pendientes: [], cuentas: [{ cuenta: 'team@', pct_ventana: 96 }] });
  assert.equal(c.hidden, true, 'a cero se oculta'); assert.equal(s.hidden, false); assert.ok(s.className.includes('rojo')); assert.equal(s.attrs.title, 'team@ al 96 % de la ventana');
});
test('pintarBarra refleja el contador en el icono de la app instalada (Badging API), sin lanzar si no existe', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const llamadas = [];
  Object.defineProperty(globalThis, 'navigator', { value: { setAppBadge: n => llamadas.push(['set', n]), clearAppBadge: () => llamadas.push(['clear']) }, configurable: true });
  pintarBarra({ rol: 'owner', pendientes: [{ id: 1 }, { id: 2 }, { id: 3 }] });
  assert.deepEqual(llamadas.at(-1), ['set', 3]);
  pintarBarra({ rol: 'owner', pendientes: [] });
  assert.deepEqual(llamadas.at(-1), ['clear']);
  Object.defineProperty(globalThis, 'navigator', { value: undefined, configurable: true });
  assert.doesNotThrow(() => pintarBarra({ rol: 'owner', pendientes: [{ id: 1 }] }));
  Object.defineProperty(globalThis, 'navigator', original);
});
