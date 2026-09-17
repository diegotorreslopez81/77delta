import test from 'node:test';
import assert from 'node:assert/strict';

// main.js resuelve document.getElementById('vista'/'ver'/'nav') y cablea el shell (montarMenu,
// cablearShell) al importarse, ademas de leer TOKEN de api.js (que a su vez lee location.search y
// localStorage en su ambito de modulo). Mismo shim que decisiones.test.mjs/tablero.test.mjs, que ya
// importan `recargar` de main.js por la misma cadena. Aqui getElementById memoiza por id (como
// shell.test.mjs) para poder recuperar el mismo nodo 'vista' que capturo main.js al importarse.
function crearNodo(tag) {
  const n = {
    tag, nodeType: 1, children: [], attrs: {}, className: '', _text: '', _html: '', listeners: {}, parent: null,
    dataset: {}, hidden: false,
    classList: { toggle(c, on) { const s = new Set(this._n.className.split(' ').filter(Boolean)); on ? s.add(c) : s.delete(c); this._n.className = [...s].join(' '); return on; }, contains(c) { return this._n.className.split(' ').includes(c); }, add(c) { this.toggle(c, true); }, remove(c) { this.toggle(c, false); } },
    setAttribute(k, v) { this.attrs[k] = v; if (k.startsWith('data-')) this.dataset[k.slice(5)] = v; },
    addEventListener(ev, fn) { (this.listeners[ev] ||= []).push(fn); },
    append(...kids) { for (const k of kids) { if (k == null) continue; k.parent = this; this.children.push(k); } },
    // T4 (plan 3b): cablearShell() ahora hace menu.prepend(...) para montar la cabecera del cajon
    // movil; sin este metodo la cadena principal de main.js explota al importarse.
    prepend(...kids) { for (const k of kids.reverse()) { if (k == null) continue; k.parent = this; this.children.unshift(k); } },
    remove() { if (this.parent) { const i = this.parent.children.indexOf(this); if (i >= 0) this.parent.children.splice(i, 1); this.parent = null; } },
    querySelector() { return null; }, querySelectorAll() { return []; }, closest() { return null; },
    get textContent() { return this.children.length ? this.children.map(c => (c.nodeType === 3 ? c.data : c.textContent)).join('') : this._text; },
    set textContent(v) { this._text = v; this.children = []; },
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = v; this.children = []; },
  };
  n.classList._n = n;
  return n;
}
const nodos = {};
globalThis.document = {
  createElement: t => crearNodo(t),
  createTextNode: d => ({ nodeType: 3, data: d }),
  getElementById: id => (nodos[id] ||= crearNodo('div')),
  body: crearNodo('body'),
  addEventListener() {},
};
globalThis.location = { hash: '', search: '', pathname: '/hq/', href: 'https://77delta.com/hq/#hoy' };
globalThis.history = { replaceState() {} };
globalThis.window = { addEventListener() {} };
globalThis.HQ_VERSION = { v: 'test' };
if (typeof globalThis.localStorage === 'undefined') {
  const mem = new Map();
  globalThis.localStorage = { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) };
}
globalThis.matchMedia = () => ({ matches: false });

// Sin 'hq_t' en localStorage: TOKEN queda null (api.js lo lee al importarse). main.js, al no haber
// token, llama a pedirToken() nada mas importarse (ver comentario de decisiones.test.mjs).
const { render } = await import('../app/main.js');

test('sin token, llamar a render() (p.ej. tras un hashchange por un clic en el menu o el buscador) no borra el formulario de entrada ni deja "Cargando HQ..." colgado (Important 3)', () => {
  const vista = document.getElementById('vista');
  assert.ok(vista.textContent.includes('HQ'), 'pedirToken ya pinto el formulario al importarse');
  render();
  assert.ok(!vista.textContent.includes('Cargando HQ'), 'render() no debe pintar "Cargando HQ..." sin token');
  assert.ok(vista.textContent.includes('HQ'), 'el formulario de entrada sigue ahi tras render()');
});
