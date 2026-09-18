import test from 'node:test';
import assert from 'node:assert/strict';

// Equipo > Colaboradores (#1057 tarea 24, HQ 2.0.11). colaboradores.js importa api.js, que lee location
// y localStorage al importarse: mismo shim mínimo que tablero.test.mjs.
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

const { render, pintar, recuento, cuadroColaboradores, tarjetaColaborador, limpiarCache, cargarColaboradores } = await import('../app/vistas/colaboradores.js');
const buscarNodos = (n, f, out = []) => { if (n && n.nodeType === 1) { if (f(n)) out.push(n); n.children.forEach(c => buscarNodos(c, f, out)); } return out; };
const textos = n => buscarNodos(n, () => true).map(x => x._text).filter(Boolean);
const cs = [
  { id: 1, nombre: 'Ana', perfil: 'Formadora en salud', especialidades: ['salud', 'formación'], estado: 'activo', origen: 'red', tarifa_dia: 400, acuerdo_fecha: '2026-09-10', cv_url: 'https://drive.google.com/cv', carpeta_url: 'javascript:alert(1)', idiomas: ['es', 'ca'],
    colaboraciones: [{ expediente_id: 8, expediente: 'Aresa', rol: 'formadora' }] },
  { id: 2, nombre: 'Bea', perfil: 'Terapeuta', especialidades: ['salud'], estado: 'contactado', origen: 'referido', colaboraciones: [] },
  { id: 3, nombre: 'Carles', especialidades: [], estado: 'contactado', origen: 'red', colaboraciones: [] },
];
const S = { datos: { frentes: [{ codigo: 'A4', meta: 5 }] } };

test('recuento cuenta valores sueltos y arrays, ordena y agrupa en otros', () => {
  assert.deepEqual(recuento(cs, 'especialidades').map(x => [x.l, x.v]), [['salud', 2], ['formación', 1]]);
  assert.deepEqual(recuento(cs, 'origen').map(x => [x.l, x.v, x.color]), [['red', 2, 'tinta'], ['referido', 1, 'tinta-2']]);
  assert.equal(recuento([1, 2, 3, 4, 5, 6].map(i => ({ o: 'x' + i })), 'o')[4].l, 'otros');
});

test('cuadro de colaboradores: total, acuerdo frente a la meta A4, especialidades, origen y expedientes', () => {
  const ps = cuadroColaboradores(cs, S);
  assert.equal(ps.length, 5);
  const t = ps.map(textos);
  assert.ok(t[0].includes('3'));
  assert.ok(t[1].includes('1 de 5') && !ps[1].className.includes('alerta'));
  assert.ok(t[2].includes('salud') && t[2].includes('2'));
  assert.ok(t[4].includes('colaboraciones en 1 expedientes'));
  assert.ok(cuadroColaboradores([cs[1]], S)[1].className.includes('alerta'));
});

test('tarjeta de colaborador: estado, acuerdo, tarifa, especialidades, expediente enlazado y solo URLs seguras', () => {
  const c = tarjetaColaborador(cs[0]);
  assert.ok(c.className.includes('tarjeta-rica'));
  assert.ok(textos(c).includes('Ana') && textos(c).includes('por día, sin IVA') && textos(c).includes('salud'));
  assert.equal(buscarNodos(c, n => n.className === 'pill verde').length, 1);
  assert.equal(buscarNodos(c, n => n.attrs.href === '#operacion/expedientes/8').length, 1);
  const ext = buscarNodos(c, n => n.attrs.target === '_blank').map(n => n._text);
  assert.deepEqual(ext, ['CV']);
  assert.ok(textos(tarjetaColaborador(cs[2])).includes('tarifa sin dato'));
});

test('render pide los datos una vez, pinta cuadro y lista, y cachea', async () => {
  limpiarCache();
  let llamadas = 0; const cargar = async () => { llamadas++; return cs; };
  const raiz = crearNodo('main');
  await render(raiz, S, null, {}, cargar);
  assert.equal(raiz.children[0].className, 'fila enlace-kpis');
  assert.equal(buscarNodos(raiz, n => (n.className || '').includes('tarjeta-colaborador')).length, 3);
  const r2 = crearNodo('main');
  await render(r2, S, null, {}, cargar);
  assert.equal(llamadas, 1);
  assert.equal(r2.children.length, 2);
});

test('render con error de HQ lo muestra y un render posterior gana a la respuesta tardía', async () => {
  limpiarCache();
  const raiz = crearNodo('main');
  await render(raiz, S, null, {}, async () => { throw new Error('token no válido'); });
  assert.match(raiz.children[0]._text, /token no válido/);
  limpiarCache();
  let soltar; const lenta = new Promise(r => { soltar = r; });
  const vieja = crearNodo('main');
  const p1 = render(vieja, S, null, {}, () => lenta);
  const nueva = crearNodo('main');
  const p2 = render(nueva, S, null, {}, async () => cs);
  await p2; soltar(cs); await p1;
  assert.equal(buscarNodos(vieja, n => n.className === 'fila enlace-kpis').length, 0);
  assert.equal(buscarNodos(nueva, n => n.className === 'fila enlace-kpis').length, 1);
});

// Grupo 'Equipo' de KPIs (#1057 tarea 29): kpis.js reutiliza esta carga/caché sin pasar por pintar().
test('cargarColaboradores cachea 5 minutos y no repite la llamada', async () => {
  limpiarCache();
  let llamadas = 0; const cargar = async () => { llamadas++; return cs; };
  const a = await cargarColaboradores(cargar);
  const b = await cargarColaboradores(cargar);
  assert.equal(llamadas, 1);
  assert.deepEqual(a, cs);
  assert.deepEqual(b, cs);
});
