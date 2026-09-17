import test from 'node:test';
import assert from 'node:assert/strict';

// Fix round 1 (revision del controlador sobre T6): render(raiz, S, arg, filtrosRuta) usaba el nombre
// 'filtros' para el cuarto parametro, que tapaba (shadowing) a la funcion local `function filtros(S,
// pintar)` (la barra de filtros del tablero) definida mas arriba en tablero.js. Dentro de pintar() la
// llamada `filtros(S, pintar)` resolvia entonces al objeto de filtros de la ruta (p.ej. {}), no a la
// funcion, y explotaba con "filtros is not a function" en cada render real del Tablero. Ningun test
// existente ejercitaba tablero.js render() (T6 solo tenia node --check + humo manual), asi que el bug
// paso todas las pruebas automaticas. Este test cubre exactamente ese camino: importar tablero.js y
// llamar a render con un filtro de ruta no debe lanzar, y debe volcar el filtro a S.filtros.
//
// tablero.js importa `recargar` de main.js (mismo motivo que decisiones.test.mjs/expedientes.test.mjs):
// main.js llama a cablearShell() al importarse, que toca document.body.classList. Se reutiliza el mismo
// shim de DOM minimo (con classList) ya usado en esos dos ficheros, mas `matchMedia` (que tablero.js usa
// para decidir el layout movil) tomado del smoke script humo-3a.mjs.
function crearNodo(tag) {
  const n = {
    tag, nodeType: 1, children: [], attrs: {}, className: '', _text: '', _html: '', listeners: {}, parent: null, dataset: {},
    classList: { toggle(c, on) { const s = new Set(this._n.className.split(' ').filter(Boolean)); on ? s.add(c) : s.delete(c); this._n.className = [...s].join(' '); return on; }, contains(c) { return this._n.className.split(' ').includes(c); }, add(c) { this.toggle(c, true); }, remove(c) { this.toggle(c, false); } },
    setAttribute(k, v) { this.attrs[k] = v; if (k.startsWith('data-')) this.dataset[k.slice(5)] = v; },
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

const { render } = await import('../app/vistas/tablero.js');

test('render con filtro de ruta no lanza y vuelca el filtro a S.filtros (regresion shadowing filtros/filtrosRuta)', () => {
  const raiz = crearNodo('main');
  const S = { datos: { encargos: [], bloques: [], frentes: [], agentes: [], rol: 'owner' }, filtros: {}, columnaMovil: null };
  assert.doesNotThrow(() => render(raiz, S, null, { frente: 'x' }));
  assert.equal(S.filtros.frente, 'x');
});
