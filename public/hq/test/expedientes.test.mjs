import test from 'node:test';
import assert from 'node:assert/strict';

// expedientes.js importa `rpc` de api.js y `recargar` de main.js (misma cadena que decisiones.js y
// tablero.js): api.js lee `location.search`/`localStorage` en su ambito de modulo y main.js resuelve
// `document.getElementById(...)`, cablea `window`/`document.addEventListener` y llama a
// `pedirToken()` si no hay token. Mismo shim que decisiones.test.mjs, con import() dinamico tras
// montar un DOM minimo (los import estaticos se ejecutan antes que cualquier otra sentencia).
function crearNodo(tag) {
  const n = {
    tag, nodeType: 1, children: [], attrs: {}, className: '', _text: '', _html: '', listeners: {}, parent: null,
    // Plan 3a T6: main.js ahora llama a cablearShell() al importarse, y esa funcion toca
    // document.body.classList (plegado del menu). Antes de T6 esta cadena de imports nunca tocaba
    // classList, asi que el shim no lo tenia; se anade aqui con el mismo patron que test/shell.test.mjs.
    classList: { toggle(c, on) { const s = new Set(this._n.className.split(' ').filter(Boolean)); on ? s.add(c) : s.delete(c); this._n.className = [...s].join(' '); return on; }, contains(c) { return this._n.className.split(' ').includes(c); }, add(c) { this.toggle(c, true); }, remove(c) { this.toggle(c, false); } },
    setAttribute(k, v) { this.attrs[k] = v; },
    getAttribute(k) { return this.attrs[k] ?? null; },
    addEventListener(ev, fn) { (this.listeners[ev] ||= []).push(fn); },
    append(...kids) { for (const k of kids) { if (k == null) continue; k.parent = this; this.children.push(k); } },
    // T4 (plan 3b): cablearShell() ahora hace menu.prepend(...) para montar la cabecera del cajon
    // movil; sin este metodo la cadena api.js/main.js explota al importar expedientes.js.
    prepend(...kids) { for (const k of kids.reverse()) { if (k == null) continue; k.parent = this; this.children.unshift(k); } },
    remove() { if (this.parent) { const i = this.parent.children.indexOf(this); if (i >= 0) this.parent.children.splice(i, 1); this.parent = null; } },
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
if (typeof globalThis.localStorage === 'undefined') {
  const mem = new Map();
  globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
}

const { estadoSesion } = await import('../app/vistas/expedientes.js');

test('estadoSesion prioriza abierta, luego solicitada, luego nada', () => {
  const ses = [{ id: 1, expediente_id: 5, estado: 'cerrada' }, { id: 2, expediente_id: 5, estado: 'solicitada' }, { id: 3, expediente_id: 6, estado: 'abierta' }];
  assert.deepEqual(estadoSesion({ id: 5 }, ses), { hay: true, estado: 'solicitada', sesion: ses[1] });
  assert.equal(estadoSesion({ id: 6 }, ses).estado, 'abierta');
  assert.deepEqual(estadoSesion({ id: 7 }, ses), { hay: false, estado: null, sesion: null });
});

test('estadoSesion prefiere abierta aunque solicitada este antes en el array', () => {
  const ses = [{ id: 1, expediente_id: 9, estado: 'solicitada' }, { id: 2, expediente_id: 9, estado: 'abierta' }];
  assert.deepEqual(estadoSesion({ id: 9 }, ses), { hay: true, estado: 'abierta', sesion: ses[1] });
});

test('estadoSesion sin sesiones o con lista vacia no rompe', () => {
  assert.deepEqual(estadoSesion({ id: 1 }, undefined), { hay: false, estado: null, sesion: null });
  assert.deepEqual(estadoSesion({ id: 1 }, []), { hay: false, estado: null, sesion: null });
});
