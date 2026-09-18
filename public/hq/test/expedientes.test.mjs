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

const { estadoSesion, render, tarjetaExp, pasoEconomico, porFase, sinActualizar, buscarExp } = await import('../app/vistas/expedientes.js');

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

// Lista como cuadro de mando (#1057 tarea 21, HQ 2.0.8).
const buscarNodos = (n, f, out = []) => { if (n && n.nodeType === 1) { if (f(n)) out.push(n); n.children.forEach(c => buscarNodos(c, f, out)); } return out; };
const clase = (n, c) => (n.className || '').split(' ').includes(c);
const AHORA = new Date('2026-09-18T10:00:00Z');
const xs = [
  { id: 1, codigo: 'B2', nombre: 'Aresa', tipo: 'cliente', estado_funnel: 'ejecución', estado_economico: 'contratado', importe: '8000', encargos_abiertos: 2, responsable: 'delivery-cupones', tipologia: 'cupon', ficha_url: 'javascript:alert(1)', carpeta_url: 'https://drive.google.com/x' },
  { id: 2, codigo: 'B2', nombre: 'Zimeron', tipo: 'cliente', estado_funnel: 'ejecución', estado_economico: 'concedido', importe: '9000', encargos_abiertos: 0, responsable: 'delivery-cupones', resumen_estado: 'al día', resumen_fecha: '2026-09-17T10:00:00Z' },
  { id: 3, codigo: 'C3', nombre: 'Órgano Uno', tipo: 'cliente', estado_funnel: 'activo', estado_economico: 'facturado', importe: '7000', encargos_abiertos: 1, responsable: 'chief' },
  { id: 4, codigo: 'B1', nombre: 'ACCIÓ Exploració', tipo: 'convocatoria', estado_funnel: 'redacción', encargos_abiertos: 5, responsable: 'estrategia-grants' },
  { id: 5, codigo: 'D2', nombre: 'Regulia', tipo: 'producto', estado_funnel: 'beta', responsable: 'po-regulia' },
  { id: 6, codigo: 'X', nombre: 'Viejo', tipo: 'cliente', activo: false, importe: '99999' },
];
const S = (rol = 'agente') => ({ datos: { rol, expedientes: xs, agentes: [{ id: 'delivery-cupones', nombre: 'Nil' }, { id: 'chief', nombre: 'Marc' }], sesiones: [{ id: 9, expediente_id: 1, estado: 'abierta' }] } });
const pintar = (filtros = {}, rol) => { const raiz = document.createElement('div'); render(raiz, S(rol), undefined, filtros, AHORA); return raiz; };
const paneles = r => buscarNodos(r, n => n.tag === 'section' && clase(n, 'panel-kpi'));
const panelDe = (r, t) => paneles(r).find(p => p.children[0].textContent === t);
const nombres = r => buscarNodos(r, n => n.tag === 'article').map(a => a.children[1].textContent);

test('lista: cuatro paneles con cartera, fase, trabajo y estado sin actualizar', () => {
  const r = pintar();
  assert.deepEqual(paneles(r).map(p => p.children[0].textContent), ['Cartera de clientes', 'Por fase', 'Trabajo abierto', 'Sin estado reciente']);
  assert.ok(panelDe(r, 'Cartera de clientes').textContent.startsWith('Cartera de clientes24 k EUR3 clientes · sin IVA'), panelDe(r, 'Cartera de clientes').textContent);
  assert.match(buscarNodos(panelDe(r, 'Cartera de clientes'), n => clase(n, 'graf'))[0].innerHTML, /g-neutro-2.*g-tinta-2.*g-tinta"/);
  assert.equal(buscarNodos(panelDe(r, 'Por fase'), n => clase(n, 'centro'))[0].textContent, '5');
  const tr = panelDe(r, 'Trabajo abierto');
  assert.ok(tr.textContent.startsWith('Trabajo abierto8encargos abiertos en 3 expedientes'), tr.textContent);
  assert.deepEqual(buscarNodos(tr, n => clase(n, 'fila-barra')).map(f => f.attrs.href), ['#operacion/expedientes/4', '#operacion/expedientes/1', '#operacion/expedientes/3']);
  const sa = panelDe(r, 'Sin estado reciente');
  assert.match(sa.className, /alerta/);
  assert.ok(sa.textContent.includes('4sin resumen en 7 días'));
});

test('lista: clientes por defecto ordenados por importe, chips con recuento y sin tipos vacíos', () => {
  const r = pintar();
  assert.deepEqual(nombres(r), ['Zimeron', 'Aresa', 'Órgano Uno']);
  assert.deepEqual(buscarNodos(r, n => n.tag === 'a' && clase(n, 'chip')).map(c => [c.textContent, c.attrs.href, clase(c, 'activo')]), [
    ['Clientes 3', '#operacion/expedientes?tipo=cliente', true], ['Convocatorias 1', '#operacion/expedientes?tipo=convocatoria', false],
    ['Productos 1', '#operacion/expedientes?tipo=producto', false], ['Todos 5', '#operacion/expedientes?tipo=todos', false]]);
  assert.deepEqual(nombres(pintar({ tipo: 'todos' })), ['Zimeron', 'Aresa', 'Órgano Uno', 'ACCIÓ Exploració', 'Regulia']);
  assert.deepEqual(nombres(pintar({ tipo: 'raro' })), ['Zimeron', 'Aresa', 'Órgano Uno']);
  assert.deepEqual(nombres(pintar({ tipo: 'producto' })), ['Regulia']);
});

test('lista: buscador sin acentos por nombre o por el nombre del agente responsable; alta solo owner', () => {
  const r = pintar();
  const input = buscarNodos(r, n => n.tag === 'input')[0];
  input.listeners.input[0]({ target: { value: 'organo' } });
  assert.deepEqual(nombres(r), ['Órgano Uno']);
  input.listeners.input[0]({ target: { value: 'nil' } });
  assert.deepEqual(nombres(r), ['Zimeron', 'Aresa']);
  input.listeners.input[0]({ target: { value: 'zzz' } });
  assert.ok(r.textContent.includes('nada con este filtro'));
  assert.equal(buscarNodos(r, n => n.tag === 'button').length, 0);
  assert.equal(buscarNodos(pintar({}, 'owner'), n => n.tag === 'button' && n.textContent === '+ Expediente').length, 1);
});

test('tarjetaExp: fase con punto, sesión, responsable por nombre, importe, paso económico y enlaces seguros', () => {
  const t = tarjetaExp(xs[0], S(), { 'ejecución': 'tinta' });
  const txt = t.textContent;
  for (const x of ['ejecución', 'B2', 'sesión abierta', 'Aresa', 'Nil · cupon', '8000', 'contratado · paso 2 de 4 hasta cobrado', '2 encargos abiertos']) assert.ok(txt.includes(x), x);
  assert.match(buscarNodos(t, n => n.tag === 'i')[0].className, /g-tinta$/);
  assert.deepEqual(buscarNodos(t, n => n.tag === 'a').map(a => [a.textContent, a.attrs.href]), [['Aresa', '#operacion/expedientes/1'], ['Abrir', '#operacion/expedientes/1'], ['Carpeta', 'https://drive.google.com/x']]);
  const sinDato = tarjetaExp(xs[4], S());
  assert.ok(sinDato.textContent.includes('importe sin dato') && sinDato.textContent.includes('0 encargos abiertos'));
  assert.equal(buscarNodos(sinDato, n => clase(n, 'plazo-barra')).length, 0);
});

test('pasoEconomico, porFase, sinActualizar y buscarExp: funciones puras', () => {
  assert.deepEqual(pasoEconomico({ estado_economico: 'cobrado' }), { paso: 4, de: 4, pct: 100 });
  assert.equal(pasoEconomico({ estado_economico: 'raro' }), null);
  assert.deepEqual(porFase(xs.slice(0, 5)).map(s => [s.l, s.v, s.color]), [['ejecución', 2, 'tinta'], ['activo', 1, 'tinta-2'], ['beta', 1, 'neutro-1'], ['redacción', 1, 'neutro-2']]);
  assert.deepEqual(porFase([{}]).map(s => s.l), ['sin fase']);
  assert.deepEqual(sinActualizar(xs.slice(0, 2), AHORA).map(x => x.id), [1]);
  assert.deepEqual(sinActualizar(xs.slice(1, 2), new Date('2026-09-30T10:00:00Z')).map(x => x.id), [2]);
  assert.equal(buscarExp(xs, ' ').length, xs.length);
});
