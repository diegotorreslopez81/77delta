import test from 'node:test';
import assert from 'node:assert/strict';
function crearNodo(tag) {
  return { tag, nodeType: 1, children: [], attrs: {}, className: '', _text: '', _html: '', listeners: {}, parent: null, dataset: {}, hidden: false,
    classList: { toggle(c, on) { const s = new Set(this._n.className.split(' ').filter(Boolean)); on ? s.add(c) : s.delete(c); this._n.className = [...s].join(' '); return on; }, contains(c) { return this._n.className.split(' ').includes(c); }, add(c) { this.toggle(c, true); }, remove(c) { this.toggle(c, false); } },
    setAttribute(k, v) { this.attrs[k] = v; if (k.startsWith('data-')) this.dataset[k.slice(5)] = v; },
    getAttribute(k) { return this.attrs[k] ?? null; },
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
// Minor 5 (revision final): document.addEventListener era un no-op; para probar que Escape cierra el
// cajon hace falta guardar los listeners de verdad y poder dispararlos con dispararDoc().
const documentListeners = {};
const dispararDoc = (ev, evt = {}) => (documentListeners[ev] || []).forEach(fn => fn(evt));
globalThis.document = { createElement: t => { const n = crearNodo(t); n.classList._n = n; return n; }, createTextNode: d => ({ nodeType: 3, data: d }), getElementById: id => (nodos[id] ||= document.createElement('div')), body: null, addEventListener(ev, fn) { (documentListeners[ev] ||= []).push(fn); } };
document.body = document.createElement('body');
globalThis.location = { hash: '', search: '', pathname: '/hq/', href: 'https://77delta.com/hq/#hoy' }; globalThis.history = { replaceState() {} }; globalThis.window = { addEventListener() {} }; globalThis.HQ_VERSION = { v: 'test' };
if (typeof globalThis.localStorage === 'undefined') { const mem = new Map(); globalThis.localStorage = { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) }; }
globalThis.matchMedia = () => ({ matches: false });

const { montarMenu, marcarActiva, pintarBarra, cablearShell } = await import('../app/shell.js');
const { AREAS } = await import('../app/rutas.js');

test('montarMenu pinta las seis áreas, un enlace por vista y Cómputo en Recursos', () => {
  const nav = document.createElement('nav'); const m = montarMenu(nav);
  assert.equal(nav.children.length, 6); assert.equal(m.enlaces.size, 8);
  assert.equal(m.enlaces.get('operacion/tablero').attrs.href, '#operacion/tablero');
  // C3 (revision final): data-inicial era codigo muerto (nunca lo leia el CSS ni ningun otro modulo);
  // se retira, y en su lugar se comprueba lo que realmente hace visible el icono en modo plegado.
  assert.ok(m.enlaces.get('hoy').children.some(c => c.className.includes('ico')), 'C3: cada enlace lleva su span.ico');
  assert.ok(m.enlaces.get('hoy').attrs['data-inicial'] === undefined, 'C3: data-inicial es codigo muerto, se retira');
  // #1054: Recursos ya tiene vista (Cómputo); el "pronto" desaparece
  assert.equal(m.enlaces.get('recursos/computo').attrs.href, '#recursos/computo');
  assert.ok(!m.areas.get('recursos').textContent.includes('pronto'));
});
// C3 (revision final del controlador): con el menu plegado, las areas de varias vistas (operacion,
// reglas si tuviera mas de una...) dejaban filas en blanco porque solo las areas de una vista pintaban
// el icono en el propio enlace. Ahora todo enlace lleva su span.ico con el svg del area, plegado o no.
test('montarMenu: todo enlace del menu lleva su span.ico con un svg, tenga el area una o varias vistas (C3)', () => {
  const nav = document.createElement('nav'); const m = montarMenu(nav);
  for (const [clave, e] of m.enlaces) {
    const ico = e.children.find(c => c.className.includes('ico'));
    assert.ok(ico, clave + ': falta span.ico en el enlace');
    assert.ok((ico.innerHTML || '').includes('<svg'), clave + ': el span.ico no lleva un svg');
  }
});
test('montarMenu: enlaces de areas con varias vistas llevan class "sub"; los de una sola vista no (C3)', () => {
  const nav = document.createElement('nav'); const m = montarMenu(nav);
  for (const a of AREAS) {
    for (const v of a.vistas) {
      const e = m.enlaces.get(v.clave);
      assert.equal(e.className.includes('sub'), a.vistas.length > 1, v.clave + ': class sub segun si el area tiene varias vistas');
    }
  }
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

// Minor 3, 4, 5 (revision final del controlador): cablearShell() se llama sin condicion desde main.js
// al importarse; una segunda llamada (posible si algun test o alguna cadena de imports repite el import
// en el mismo proceso) no debe duplicar .menu-cab ni los listeners. El aria-label del hamburguesa
// alterna Abrir/Cerrar menu con aria-expanded, y la tecla Escape cierra el cajon igual que el velo.
test('cablearShell: idempotente, aria-label alterna Abrir/Cerrar y Escape cierra el cajon (Minor 3, 4, 5)', () => {
  delete nodos.menu; delete nodos.hamburguesa; delete nodos.velo; delete nodos.plegar; delete nodos.busqueda; delete nodos.resultados;
  document.body.classList.remove('menu-abierto');
  const nav = document.createElement('nav'); montarMenu(nav);
  cablearShell();
  const menu = document.getElementById('menu');
  assert.equal(menu.children.filter(c => c.className.includes('menu-cab')).length, 1);
  cablearShell(); // segunda llamada: no debe montar otra cabecera ni duplicar listeners (Minor 3)
  assert.equal(menu.children.filter(c => c.className.includes('menu-cab')).length, 1, 'una segunda llamada no debe montar otra cabecera');
  const hamb = document.getElementById('hamburguesa');
  assert.equal(hamb.attrs['aria-label'], 'Abrir menú');
  disparar(hamb, 'click');
  assert.equal(hamb.attrs['aria-expanded'], 'true');
  assert.equal(hamb.attrs['aria-label'], 'Cerrar menú', 'Minor 4: aria-label pasa a Cerrar menu al abrir');
  dispararDoc('keydown', { key: 'Escape' });
  assert.equal(hamb.attrs['aria-expanded'], 'false', 'Minor 5: Escape cierra el cajon');
  assert.equal(hamb.attrs['aria-label'], 'Abrir menú');
  assert.ok(!document.body.classList.contains('menu-abierto'));
  document.body.classList.remove('menu-abierto');
});

// Minor 5 (revision final): un click en un enlace del menu debe cerrar el cajon aunque el hash ya sea
// el activo (el hashchange no dispara si el hash no cambia, asi que hace falta un onclick propio).
test('un click en un enlace del menu cierra el cajon aunque el hash ya sea el activo (Minor 5)', () => {
  delete nodos.menu; delete nodos.hamburguesa; delete nodos.velo; delete nodos.plegar; delete nodos.busqueda; delete nodos.resultados;
  document.body.classList.remove('menu-abierto');
  const nav = document.createElement('nav'); const m = montarMenu(nav);
  cablearShell();
  document.body.classList.add('menu-abierto');
  disparar(m.enlaces.get('hoy'), 'click');
  assert.ok(!document.body.classList.contains('menu-abierto'), 'el cajon debe cerrarse al hacer click en un enlace');
  document.body.classList.remove('menu-abierto');
});
