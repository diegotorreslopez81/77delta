import test from 'node:test';
import assert from 'node:assert/strict';
function crearNodo(tag) {
  return { tag, nodeType: 1, children: [], attrs: {}, className: '', _text: '', _html: '', listeners: {}, parent: null, dataset: {}, hidden: false,
    classList: { toggle(c, on) { const s = new Set(this._n.className.split(' ').filter(Boolean)); on ? s.add(c) : s.delete(c); this._n.className = [...s].join(' '); return on; }, contains(c) { return this._n.className.split(' ').includes(c); }, add(c) { this.toggle(c, true); }, remove(c) { this.toggle(c, false); } },
    setAttribute(k, v) { this.attrs[k] = v; if (k.startsWith('data-')) this.dataset[k.slice(5)] = v; },
    addEventListener(ev, fn) { (this.listeners[ev] ||= []).push(fn); },
    append(...kids) { for (const k of kids) { if (k == null) continue; k.parent = this; this.children.push(k); } },
    prepend(...kids) { for (const k of kids.reverse()) { if (k == null) continue; k.parent = this; this.children.unshift(k); } },
    querySelector() { return null; }, querySelectorAll() { return []; }, closest() { return null; },
    get textContent() { return this.children.length ? this.children.map(c => (c.nodeType === 3 ? c.data : c.textContent)).join('') : this._text; },
    set textContent(v) { this._text = v; this.children = []; }, set innerHTML(v) { this._html = v; this.children = []; }, get innerHTML() { return this._html; } };
}
// Dispara los listeners guardados por addEventListener (extensión del stub para T4: clicks en
// hamburguesa/cerrar-menu). No hay Event real en node --test, basta un objeto mínimo compatible.
const disparar = (nodo, ev) => (nodo.listeners[ev] || []).forEach(fn => fn({ target: nodo, currentTarget: nodo, preventDefault() {} }));
const nodos = {};
globalThis.document = { createElement: t => { const n = crearNodo(t); n.classList._n = n; return n; }, createTextNode: d => ({ nodeType: 3, data: d }), getElementById: id => (nodos[id] ||= document.createElement('div')), body: null, addEventListener() {} };
document.body = document.createElement('body');
globalThis.location = { hash: '', search: '', pathname: '/hq/', href: 'https://77delta.com/hq/#hoy' }; globalThis.history = { replaceState() {} }; globalThis.window = { addEventListener() {} }; globalThis.HQ_VERSION = { v: 'test' };
if (typeof globalThis.localStorage === 'undefined') { const mem = new Map(); globalThis.localStorage = { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) }; }
globalThis.matchMedia = () => ({ matches: false });

const { montarMenu, marcarActiva, pintarBarra, cablearShell } = await import('../app/shell.js');
const { AREAS } = await import('../app/rutas.js');

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
// Plan 3b, T4: menú con iconos y cómodo en el móvil. montarMenu pinta un svg por área (en area-titulo,
// y también en el enlace de las áreas de una sola vista) y envuelve el nombre de cada enlace en
// span.txt (lo que permite ocultar solo el texto al plegar, nunca font-size:0).
test('montarMenu: icono svg en cada área y span.txt con el nombre en cada enlace', () => {
  const nav = document.createElement('nav'); const m = montarMenu(nav);
  for (const a of AREAS) {
    const div = m.areas.get(a.id);
    const titulo = div.children.find(c => c.className.includes('area-titulo'));
    assert.ok(titulo, a.id + ': falta area-titulo');
    assert.ok(titulo.children.some(c => (c.innerHTML || '').includes('<svg')), a.id + ': area-titulo sin svg');
    for (const v of a.vistas) {
      const enlace = m.enlaces.get(v.clave);
      const txt = enlace.children.find(c => c.className.includes('txt'));
      assert.ok(txt, v.clave + ': falta span.txt');
      assert.equal(txt.textContent, v.nombre, v.clave + ': span.txt con el nombre');
    }
  }
});
// La cabecera del cajón móvil (marca "HQ" + botón cerrar) la monta cablearShell dentro de #menu; el
// botón cerrar llama a cerrarMenu(), que es lo mismo que hace el velo y lo que deja aria-expanded en
// "false" en el hamburguesa. Un click en el hamburguesa hace lo contrario (abre, aria-expanded "true").
test('cablearShell monta la cabecera del cajón móvil y cablea abrir/cerrar (aria-expanded)', () => {
  const nav = document.createElement('nav'); montarMenu(nav);
  cablearShell();
  const menu = document.getElementById('menu');
  const cab = menu.children.find(c => c.className.includes('menu-cab'));
  assert.ok(cab, 'falta .menu-cab dentro de #menu');
  const btnCerrar = cab.children.find(c => c.attrs['aria-label'] === 'Cerrar menú');
  assert.ok(btnCerrar, 'falta el botón [aria-label="Cerrar menú"]');
  const hamb = document.getElementById('hamburguesa');
  disparar(hamb, 'click');
  assert.equal(hamb.attrs['aria-expanded'], 'true');
  disparar(btnCerrar, 'click');
  assert.equal(hamb.attrs['aria-expanded'], 'false');
});
