import test from 'node:test';
import assert from 'node:assert/strict';

// hoy.js importa tarjeta.js (que importa ui.js) y estado.js: solo tocan `document` dentro de funciones,
// pero se monta el shim antes del import dinámico por el mismo motivo que decisiones.test.mjs (cadena
// de imports).
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
const { enCurso, cierres } = await import('../app/estado.js');

const ahora = new Date('2026-09-17T07:00:00Z');
const secciones = raiz => raiz.children.filter(c => c.tag === 'section');
const titulos = raiz => secciones(raiz).map(s => s.children[0].textContent);
const buscarNodos = (n, pred, out = []) => { if (n.nodeType === 1) { if (pred(n)) out.push(n); n.children.forEach(c => buscarNodos(c, pred, out)); } return out; };
const hrefs = raiz => buscarNodos(raiz, n => n.tag === 'a').map(a => a.attrs.href);

const datosOwner = {
  rol: 'owner',
  pendientes: [
    { id: 635, titulo: 'Responder a Guillem', agente: 'sales-licita', vence: '2026-09-17T18:00:00Z' }, // vence hoy (misma fecha UTC que `ahora`)
    { id: 640, titulo: 'Otra', agente: 'coo', vence: '2026-09-20T10:00:00Z' }, // no vence hoy
  ],
  encargos: [
    { id: 1, texto: 'Cierre A', estado: 'en_curso', fecha_hito: '2026-09-18', agente: 'Ariadna', rojo: false },
    { id: 2, texto: 'Cierre B '.repeat(10), estado: 'encolado', fecha_hito: '2026-09-19', agente: 'Guillem', rojo: true },
    { id: 3, texto: 'Cierre C', estado: 'en_curso', fecha_hito: '2026-09-20', agente: 'Ona', rojo: false },
    { id: 4, texto: 'Cierre D', estado: 'en_curso', fecha_hito: '2026-09-21', agente: 'Marina', rojo: false },
    { id: 5, texto: 'Cierre E', estado: 'en_curso', fecha_hito: '2026-09-22', agente: 'Aina', rojo: false },
    { id: 6, texto: 'Cierre F', estado: 'en_curso', fecha_hito: '2026-09-23', agente: 'Biel', rojo: false },
    { id: 7, texto: 'Fuera de ventana', estado: 'en_curso', fecha_hito: '2026-10-01', agente: 'X', rojo: false },
    { id: 8, texto: 'Sin hito', estado: 'en_curso', fecha_hito: null, agente: 'Y', rojo: false },
  ],
  agentes: [
    { id: 'ariadna', nombre: 'Ariadna', activo: true },
    { id: 'guillem', nombre: 'Guillem', activo: true },
    { id: 'viejo', nombre: 'Viejo', activo: false },
  ],
  sesiones: [{ id: 1, expediente_id: 9, nombre: 'Cíclica', agente: 'cupones', estado: 'abierta', abierta: ahora.toISOString() }],
};
const derivadoOwner = { objetivos: [{ horizonte: 2026, titulo: 'Contratado a 31 de diciembre', meta: 300000, unidad: 'EUR', contratado_eur: 20000 }] };

test('owner: los cinco bloques del cuadro de mando, en orden', () => {
  const raiz = crearNodo('main');
  render(raiz, { datos: datosOwner, derivado: derivadoOwner }, undefined, {}, ahora);
  assert.deepEqual(titulos(raiz), ['Objetivo', 'Depende de ti', 'Cierres en 7 días', 'Equipo', 'Alertas']);
});

test('owner: Objetivo es la cifra de contratado sobre la meta, con la desviación, enlazando a Dirección', () => {
  const raiz = crearNodo('main');
  render(raiz, { datos: datosOwner, derivado: derivadoOwner }, undefined, {}, ahora);
  const bloque = secciones(raiz)[0];
  assert.ok(bloque.textContent.includes('20.000 EUR'));
  assert.ok(bloque.textContent.includes('desviación'));
  assert.deepEqual(hrefs(bloque), ['#direccion/objetivo']);
});

test('owner: Depende de ti es solo el número, sin ancla a tarjetas individuales, y las que vencen hoy', () => {
  const raiz = crearNodo('main');
  render(raiz, { datos: datosOwner, derivado: derivadoOwner }, undefined, {}, ahora);
  const bloque = secciones(raiz)[1];
  assert.ok(bloque.textContent.includes('2'), 'dos pendientes');
  assert.ok(bloque.textContent.includes('1'), 'una vence hoy');
  assert.ok(!hrefs(raiz).includes('#reglas/decisiones/635'), 'nunca un ancla a una decisión concreta');
  assert.ok(hrefs(bloque).includes('#reglas/decisiones'));
});

test('owner: Cierres en 7 días, máximo 5 filas ordenadas por fecha_hito, con "y N más"', () => {
  const raiz = crearNodo('main');
  render(raiz, { datos: datosOwner, derivado: derivadoOwner }, undefined, {}, ahora);
  const bloque = secciones(raiz)[2];
  const esperados = cierres(datosOwner.encargos, ahora, 7);
  assert.ok(esperados.length > 5, 'la fixture debe forzar el "y N más"');
  const filas = buscarNodos(bloque, n => n.tag === 'a' && n.className.includes('fila'));
  assert.equal(filas.length, 5, 'máximo 5 filas de hito, aparte del enlace "y N más"');
  assert.ok(bloque.textContent.includes('y ' + (esperados.length - 5) + ' más'));
  assert.ok(bloque.textContent.includes('#1'));
  assert.ok(!bloque.textContent.includes('Fuera de ventana'), 'fuera de la ventana de 7 días no sale');
  for (const a of hrefs(bloque)) assert.equal(a, '#operacion/tablero');
});

test('owner: Equipo cuenta activos, en curso y parados, enlazados', () => {
  const raiz = crearNodo('main');
  render(raiz, { datos: datosOwner, derivado: derivadoOwner }, undefined, {}, ahora);
  const bloque = secciones(raiz)[3];
  assert.ok(bloque.textContent.includes('2'), 'dos agentes activos (el tercero tiene activo:false)');
  assert.equal(bloque.textContent.match(new RegExp(String(enCurso(datosOwner.encargos).length))) != null, true);
  assert.ok(hrefs(bloque).includes('#equipo/organigrama'));
  assert.ok(hrefs(bloque).includes('#operacion/tablero'), 'parados enlaza al tablero');
});

test('owner: Alertas resume sesiones abiertas y encargos parados', () => {
  const raiz = crearNodo('main');
  render(raiz, { datos: datosOwner, derivado: derivadoOwner }, undefined, {}, ahora);
  const bloque = secciones(raiz)[4];
  assert.ok(bloque.textContent.includes('sesion'));
  assert.ok(bloque.textContent.includes('parado'));
  assert.ok(hrefs(bloque).includes('#operacion/expedientes'));
});

test('owner: vacíos', () => {
  const raiz = crearNodo('main');
  render(raiz, { datos: { rol: 'owner' }, derivado: { objetivos: [] } }, undefined, {}, ahora);
  const t = raiz.textContent;
  assert.ok(t.includes('sin objetivo'));
  assert.ok(t.includes('ningún hito en 7 días'));
  assert.ok(t.includes('sin agentes'));
  assert.ok(t.includes('sin alertas'));
});

test('agente: sin cambios, "Tus tarjetas" con lo en curso y sesiones abiertas', () => {
  const raiz = crearNodo('main');
  render(raiz, { datos: { ...datosOwner, rol: 'agente', pendientes: [] } }, undefined, {}, ahora);
  assert.deepEqual(titulos(raiz), ['Tus tarjetas', 'Sesiones abiertas']);
  const ids = buscarNodos(raiz, n => n.className.includes('encargo')).map(t => t.attrs['data-id'] || t.textContent);
  assert.equal(ids.length, enCurso(datosOwner.encargos).length);
  assert.ok(hrefs(raiz).includes('#operacion/expedientes/9'));
});

test('agente: sin datos en las listas pinta los textos vacíos', () => {
  const raiz = crearNodo('main');
  render(raiz, { datos: { rol: 'agente' } }, undefined, {}, ahora);
  assert.ok(raiz.textContent.includes('nada en curso'));
  assert.ok(raiz.textContent.includes('ninguna'));
});
