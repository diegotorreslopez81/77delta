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

const { render, cuadroTablero, vencidos, porResponsable } = await import('../app/vistas/tablero.js');
const { kanban } = await import('../app/estado.js');

test('render con filtro de ruta no lanza y vuelca el filtro a S.filtros (regresion shadowing filtros/filtrosRuta)', () => {
  const raiz = crearNodo('main');
  const S = { datos: { encargos: [], bloques: [], frentes: [], agentes: [], rol: 'owner' }, filtros: {}, columnaMovil: null };
  assert.doesNotThrow(() => render(raiz, S, null, { frente: 'x' }));
  assert.equal(S.filtros.frente, 'x');
});

// Cuadro de mando del tablero (#1057 tarea 22, HQ 2.0.9).
const buscarNodos = (n, f, out = []) => { if (n && n.nodeType === 1) { if (f(n)) out.push(n); n.children.forEach(c => buscarNodos(c, f, out)); } return out; };
const AHORA = new Date('2026-09-18T10:00:00Z');
const encargos = [
  { id: 1, columna: 'en_curso', responsable: 'chief', texto: 'Uno', fecha_hito: '2026-09-10' },
  { id: 2, columna: 'en_curso', responsable: 'chief', texto: 'Dos', fecha_hito: '2026-09-25' },
  { id: 3, columna: 'bloqueado', responsable: 'guillem', texto: 'Tres bloqueado', fecha_hito: '2026-09-01' },
  { id: 4, columna: 'backlog', agente: 'nil', texto: 'Cuatro' },
  { id: 5, columna: 'hecho', responsable: 'chief', texto: 'Cinco', fecha_hito: '2026-09-01' },
];
const Sx = () => ({ datos: { encargos, bloques: [], frentes: [], agentes: [{ id: 'chief', nombre: 'Marc' }, { id: 'guillem', nombre: 'Guillem' }], rol: 'owner' }, filtros: {}, columnaMovil: null });

test('cuadro del tablero: abiertos por columna, vencidos, por responsable y bloqueados', () => {
  const ps = cuadroTablero(Sx(), kanban(encargos, {}), AHORA);
  assert.deepEqual(ps.map(p => p.children[0].textContent), ['Encargos abiertos', 'Vencidos', 'Por responsable', 'Bloqueados']);
  assert.ok(ps[0].textContent.startsWith('Encargos abiertos41 hechos con este filtro'), ps[0].textContent);
  assert.match(buscarNodos(ps[0], n => (n.className || '').includes('graf'))[0].innerHTML, /g-neutro-3.*g-tinta-2.*g-tinta"/);
  assert.match(ps[1].className, /alerta/);
  assert.ok(ps[1].textContent.includes('2con el hito pasado sin cerrar') && ps[1].textContent.includes('#3 Tres bloqueado'), ps[1].textContent);
  assert.deepEqual(buscarNodos(ps[2], n => n.tag === 'a' && (n.className || '').includes('fila-barra')).map(a => [a.children[0].textContent, a.children[1].textContent, a.attrs.href]),
    [['Marc', '2', '#operacion/tablero?agente=chief'], ['Guillem', '1', '#operacion/tablero?agente=guillem'], ['nil', '1', '#operacion/tablero?agente=nil']]);
  assert.match(ps[3].className, /alerta/);
});

test('cuadro del tablero sigue los filtros y sin abiertos no marca alertas', () => {
  const ps = cuadroTablero(Sx(), kanban(encargos, { agente: 'nil' }), AHORA);
  assert.ok(ps[0].textContent.startsWith('Encargos abiertos10 hechos'), ps[0].textContent);
  const vacio = cuadroTablero(Sx(), kanban([], {}), AHORA);
  assert.ok(vacio.every(p => !/alerta/.test(p.className)));
  assert.ok(vacio[2].textContent.includes('sin encargos abiertos'));
});

test('vencidos ordena por hito más antiguo e ignora hechos y sin hito; porResponsable cae en agente', () => {
  assert.deepEqual(vencidos(kanban(encargos, {}), AHORA).map(e => e.id), [3, 1]);
  assert.deepEqual(porResponsable(kanban(encargos, {}), []).map(r => [r.id, r.n, r.nombre]), [['chief', 2, 'chief'], ['guillem', 1, 'guillem'], ['nil', 1, 'nil']]);
});

test('render pinta el cuadro antes de los filtros y del kanban', () => {
  const raiz = crearNodo('main');
  render(raiz, Sx(), null, {}, AHORA);
  assert.deepEqual(raiz.children.map(n => n.className), ['cuadro', 'barra-filtros', 'kanban']);
  assert.equal(raiz.children[0].children.length, 4);
});
