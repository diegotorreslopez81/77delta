import test from 'node:test';
import assert from 'node:assert/strict';

// decisiones.js importa `rpc` de api.js y `recargar` de main.js (mismo patron que tablero.js, exigido
// por la tarea: "copiar el patron exacto, no inventes otro"). api.js lee `location.search` y
// `localStorage` en su ambito de modulo, y main.js resuelve dos `document.getElementById(...)`, cablea
// `window`/`document.addEventListener` y, al no haber token, llama a `pedirToken()` (que construye DOM
// con `el()`) nada mas importarse. Node ejecuta los `import` estaticos antes que cualquier otra
// sentencia del fichero, asi que no hay forma de definir estos globals antes de un `import` estatico:
// se usa `import()` dinamico tras montar un DOM minimo (mismo shim que ya usa humo-t4.mjs para
// tablero.js, que tiene la misma cadena de imports). `decisiones.js` en si no toca el DOM al
// importarse (solo dentro de `render`); el shim es puro efecto de la cadena de imports compartida.
function crearNodo(tag) {
  const n = {
    tag, nodeType: 1, children: [], attrs: {}, className: '', _text: '', _html: '', listeners: {}, parent: null,
    setAttribute(k, v) { this.attrs[k] = v; },
    addEventListener(ev, fn) { (this.listeners[ev] ||= []).push(fn); },
    append(...kids) { for (const k of kids) { if (k == null) continue; k.parent = this; this.children.push(k); } },
    remove() { if (this.parent) { const i = this.parent.children.indexOf(this); if (i >= 0) this.parent.children.splice(i, 1); this.parent = null; } },
    get textContent() { return this.children.length ? this.children.map(c => (c.nodeType === 3 ? c.data : c.textContent)).join('') : this._text; },
    set textContent(v) { this._text = v; this.children = []; },
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = v; this.children = []; },
  };
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
if (typeof globalThis.localStorage === 'undefined') {
  const mem = new Map();
  globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
}

const { agrupar } = await import('../app/vistas/decisiones.js');
const ahora = new Date('2026-09-16T12:00:00Z');
test('agrupar por vencimiento', () => {
  const g = agrupar([{ id: 1, vence: '2026-09-16T18:00:00Z' }, { id: 2, vence: '2026-09-19T10:00:00Z' }, { id: 3, vence: null }, { id: 4, vence: '2026-09-30', pospuesta_hasta: '2026-09-20T08:00:00Z' }], ahora);
  assert.deepEqual(g.hoy.map(x => x.id), [1]); assert.deepEqual(g.semana.map(x => x.id), [2]); assert.deepEqual(g.resto.map(x => x.id), [3]); assert.deepEqual(g.pospuestas.map(x => x.id), [4]);
});
