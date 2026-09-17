import test from 'node:test';
import assert from 'node:assert/strict';

// hoy.js importa tarjeta.js, que importa ui.js: solo tocan `document` dentro de funciones, pero se
// monta el shim antes del import dinámico por el mismo motivo que decisiones.test.mjs (cadena de imports).
function crearNodo(tag) {
  const n = {
    tag, nodeType: 1, children: [], attrs: {}, className: '', _text: '', listeners: {}, parent: null,
    setAttribute(k, v) { this.attrs[k] = v; }, addEventListener(ev, fn) { (this.listeners[ev] ||= []).push(fn); },
    append(...kids) { for (const k of kids) { if (k == null) continue; k.parent = this; this.children.push(k); } },
    prepend(...kids) { for (const k of kids.reverse()) { if (k == null) continue; k.parent = this; this.children.unshift(k); } },
    remove() { if (this.parent) { const i = this.parent.children.indexOf(this); if (i >= 0) this.parent.children.splice(i, 1); this.parent = null; } },
    get textContent() { return this.children.length ? this.children.map(c => (c.nodeType === 3 ? c.data : c.textContent)).join('') : this._text; },
    set textContent(v) { this._text = v; this.children = []; },
    set innerHTML(v) { this.children = []; }, get innerHTML() { return ''; },
    querySelector() { return null; }, querySelectorAll() { return []; },
  };
  return n;
}
globalThis.document = { createElement: t => crearNodo(t), createTextNode: d => ({ nodeType: 3, data: d }), getElementById: () => crearNodo('div'), body: crearNodo('body'), addEventListener() {} };
globalThis.location = { hash: '', search: '', pathname: '/hq/' }; globalThis.history = { replaceState() {} }; globalThis.window = { addEventListener() {} }; globalThis.HQ_VERSION = { v: 'test' };
if (typeof globalThis.localStorage === 'undefined') { const mem = new Map(); globalThis.localStorage = { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) }; }

const { render } = await import('../app/vistas/hoy.js');
const hoyIso = new Date().toISOString();
const datos = {
  rol: 'owner',
  pendientes: [{ id: 635, titulo: 'Responder a Guillem', agente: 'sales-licita', vence: null }],
  encargos: [
    { id: 996, texto: 'Fuentes', origen: 'Diego 17-sep', fecha: hoyIso, estado: 'encolado', rojo: false, agente: 'sales-motor' },
    { id: 12, texto: 'Vieja', origen: 'Diego 1-ago', fecha: '2026-08-01T10:00:00Z', estado: 'en_curso', rojo: true, agente: 'coo' },
    { id: 13, texto: 'De otro', origen: 'coo', fecha: hoyIso, estado: 'en_curso', rojo: false, agente: 'coo' },
  ],
  sesiones: [{ id: 1, expediente_id: 9, nombre: 'Cíclica', agente: 'cupones', estado: 'abierta', abierta: hoyIso }],
};
const secciones = raiz => raiz.children.filter(c => c.tag === 'section');
const titulos = raiz => secciones(raiz).map(s => s.children[0].textContent);
const buscarNodos = (n, pred, out = []) => { if (n.nodeType === 1) { if (pred(n)) out.push(n); n.children.forEach(c => buscarNodos(c, pred, out)); } return out; };

test('owner: tres bloques en orden, sin tarjetas ajenas ni parados', () => {
  const raiz = crearNodo('main'); render(raiz, { datos });
  assert.deepEqual(titulos(raiz), ['Depende de ti', 'Tus peticiones de la semana', 'Sesiones abiertas']);
  const enlaces = buscarNodos(raiz, n => n.tag === 'a').map(a => a.attrs.href);
  assert.ok(enlaces.includes('#reglas/decisiones/635'));
  assert.ok(enlaces.includes('#operacion/expedientes/9'));
  const ids = buscarNodos(raiz, n => n.className.includes('encargo')).map(t => t.attrs['data-id'] || t.textContent);
  assert.equal(ids.length, 1, 'solo el encargo #996 (de Diego, esta semana)');
  assert.ok(!raiz.textContent.includes('Parados'), 'Hoy no lista parados: viven en Peticiones (tanda 2)');
  assert.ok(!raiz.textContent.includes('Objetivo'), 'el objetivo vive en Dirección');
});
test('agente: "Tus tarjetas" con lo en curso, sin peticiones', () => {
  const raiz = crearNodo('main'); render(raiz, { datos: { ...datos, rol: 'agente', pendientes: [] } });
  assert.deepEqual(titulos(raiz), ['Tus tarjetas', 'Sesiones abiertas']);
  assert.equal(buscarNodos(raiz, n => n.className.includes('encargo')).length, 2);
});
test('sin datos en las listas pinta los textos vacios', () => {
  const raiz = crearNodo('main'); render(raiz, { datos: { rol: 'owner' } });
  assert.ok(raiz.textContent.includes('nada pendiente')); assert.ok(raiz.textContent.includes('sin peticiones tuyas en 7 días')); assert.ok(raiz.textContent.includes('ninguna'));
});
