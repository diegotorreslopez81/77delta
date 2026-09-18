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

const { render, urgentes, activosRecientes } = await import('../app/vistas/hoy.js');
const { enCurso, cierres } = await import('../app/estado.js');

const ahora = new Date('2026-09-17T07:00:00Z');
const secciones = raiz => raiz.children.filter(c => c.tag === 'section');
const titulos = raiz => secciones(raiz).map(s => s.children[0].textContent);
const buscarNodos = (n, pred, out = []) => { if (n.nodeType === 1) { if (pred(n)) out.push(n); n.children.forEach(c => buscarNodos(c, pred, out)); } return out; };
const hrefs = raiz => buscarNodos(raiz, n => n.tag === 'a').map(a => a.attrs.href);
const TITULOS = ['Objetivo', 'Depende de ti', 'Indicadores', 'Cierres en 7 días', 'Equipo', 'Consumo', 'Alertas'];
const seccion = (raiz, titulo) => secciones(raiz)[TITULOS.indexOf(titulo)];

// Fixture con la forma real del payload owner del 18-sep (omc_hq_v2 2.0.10: pendientes con prioridad 1-5,
// frentes con kpi/valor_actual/meta, agentes con ultima_actividad, cuentas de omc_cuentas_estado y kpis).
const datosOwner = {
  rol: 'owner',
  pendientes: [
    { id: 635, titulo: 'Responder a Guillem', agente: 'sales-licita', prioridad: 1, vence: '2026-09-17T18:00:00Z' }, // vence hoy (misma fecha UTC que `ahora`) y prioridad 1
    { id: 640, titulo: 'Otra', agente: 'coo', prioridad: 4, vence: '2026-09-20T10:00:00Z' }, // ni urge ni vence hoy
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
    { id: 'ariadna', nombre: 'Ariadna', activo: true, ultima_actividad: '2026-09-17T06:30:00Z' }, // hace 30 min
    { id: 'guillem', nombre: 'Guillem', activo: true, ultima_actividad: '2026-09-17T02:00:00Z', sesion_url_fecha: '2026-09-16T20:00:00Z' }, // hace 5 h
    { id: 'viejo', nombre: 'Viejo', activo: false, ultima_actividad: '2026-09-17T06:59:00Z' }, // inactivo aunque reciente
  ],
  frentes: [
    { id: 3, codigo: 'A3', kpi: 'Ofertas presentadas', valor_actual: 3, meta: 12, unidad: 'ofertas', bloque_nombre: 'Licitaciones' },
    { id: 7, codigo: 'B2', kpi: 'Memorias entregadas', valor_actual: 0, meta: 0, unidad: '', bloque_nombre: 'Subvenciones' }, // sin meta ni valor: no sale
    { id: 9, codigo: 'E1', kpi: '', valor_actual: 5, meta: 10, unidad: '', bloque_nombre: 'Empresa' }, // sin kpi: no sale
  ],
  kpis: {
    'correo.pendientes.n': { valor: 2, texto: '', updated_at: '2026-09-17T06:50:00Z' },
    'correo.pendientes.mas_antiguo_h': { valor: 5, texto: '', updated_at: '2026-09-17T06:50:00Z' },
    'cuentas.urge_tercera': { valor: 1, texto: 'diego@ 93 % · team@ 97 %', updated_at: '2026-09-17T06:45:00Z' },
  },
  cuentas: [
    { clave: 'principal', cuenta: 'diego@', pct_ventana: 12, pct_semana: 93, semana_fin: '2026-09-18T21:59:59Z', saturada: true },
    { clave: 'team', cuenta: 'team@', pct_ventana: 5, pct_semana: 97, semana_fin: '2026-09-19T22:59:59Z', saturada: true },
  ],
  sesiones: [{ id: 1, expediente_id: 9, nombre: 'Cíclica', agente: 'cupones', estado: 'abierta', abierta: ahora.toISOString() }],
};
const derivadoOwner = { objetivos: [{ horizonte: 2026, titulo: 'Contratado a 31 de diciembre', meta: 300000, unidad: 'EUR', contratado_eur: 20000 }] };
const pintar = (datos = datosOwner, derivado = derivadoOwner) => { const raiz = crearNodo('main'); render(raiz, { datos, derivado }, undefined, {}, ahora); return raiz; };

test('urgentes: prioridad 1-2 o vencimiento en menos de 24 h, ordenadas por prioridad y vencimiento', () => {
  const ps = [
    { id: 1, prioridad: 4, vence: '2026-09-25T10:00:00Z' }, // no
    { id: 2, prioridad: 2, vence: null }, // prioridad
    { id: 3, prioridad: 5, vence: '2026-09-17T20:00:00Z' }, // vence en 13 h
    { id: 4, prioridad: 5, vence: '2026-09-10T20:00:00Z' }, // ya vencida
    { id: 5, prioridad: 1, vence: '2026-09-30T20:00:00Z' }, // prioridad 1, primera
    { id: 6, prioridad: null, vence: null }, // no
  ];
  assert.deepEqual(urgentes(ps, ahora).map(p => p.id), [5, 2, 4, 3]);
  assert.deepEqual(urgentes(undefined, ahora), []);
});

test('activosRecientes: actividad hace menos de 2 h por sesión o último encargo, inactivos fuera, el más reciente primero', () => {
  assert.deepEqual(activosRecientes(datosOwner.agentes, ahora).map(a => a.id), ['ariadna']);
  const conSesion = [{ id: 'x', activo: true, ultima_actividad: '2026-09-16T00:00:00Z', sesion_url_fecha: '2026-09-17T06:00:00Z' }, { id: 'y', activo: true, ultima_actividad: '2026-09-17T06:40:00Z' }, { id: 'z', activo: true }];
  assert.deepEqual(activosRecientes(conSesion, ahora).map(a => a.id), ['y', 'x']);
  assert.deepEqual(activosRecientes(undefined, ahora), []);
});

test('owner: los siete bloques del cuadro de mando, en orden', () => {
  assert.deepEqual(titulos(pintar()), TITULOS);
});

test('owner: Objetivo es la cifra de contratado sobre la meta con barra de progreso y desviación, enlazando a Dirección', () => {
  const bloque = seccion(pintar(), 'Objetivo');
  assert.ok(bloque.textContent.includes('20.000 EUR'));
  assert.ok(bloque.textContent.includes('desviación'));
  const barras = buscarNodos(bloque, n => n.className === 'barra');
  assert.equal(barras.length, 1);
  assert.equal(barras[0].children[0].attrs.style, 'width:7%', '20.000 de 300.000 redondea al 7 %');
  assert.deepEqual(hrefs(bloque), ['#direccion/objetivo']);
});

test('owner: Depende de ti es el número, las urgentes y las que vencen hoy, sin ancla a tarjetas individuales ni botones', () => {
  const raiz = pintar(), bloque = seccion(raiz, 'Depende de ti');
  assert.ok(bloque.textContent.includes('2'), 'dos pendientes');
  assert.ok(bloque.textContent.includes('1 urgentes · 1 vencen hoy'));
  assert.ok(bloque.textContent.includes('Responder a Guillem'), 'la urgente sale en una línea');
  assert.ok(!bloque.textContent.includes('Otra'), 'la que no urge no sale');
  assert.ok(bloque.children[1].className.includes('roja'), 'con urgentes la tarjeta va en rojo');
  assert.ok(!hrefs(raiz).includes('#reglas/decisiones/635'), 'nunca un ancla a una decisión concreta');
  for (const a of hrefs(bloque)) assert.equal(a, '#reglas/decisiones');
  assert.equal(buscarNodos(bloque, n => n.tag === 'button').length, 0);
  const sinUrgentes = seccion(pintar({ ...datosOwner, pendientes: [datosOwner.pendientes[1]] }), 'Depende de ti');
  assert.ok(sinUrgentes.textContent.includes('0 urgentes · 0 vencen hoy'));
  assert.ok(!sinUrgentes.children[1].className.includes('roja'));
});

test('owner: Indicadores pinta el correo sin contestar y los KPIs vivos de las líneas con meta o valor, enlazados al tablero por frente', () => {
  const bloque = seccion(pintar(), 'Indicadores');
  const t = bloque.textContent;
  assert.ok(t.includes('2correos sin contestar') || t.includes('2') && t.includes('correos sin contestar'));
  assert.ok(t.includes('el más antiguo hace 5 h'));
  assert.ok(t.includes('3 / 12 ofertas') && t.includes('A3 · Ofertas presentadas'));
  assert.ok(!t.includes('B2'), 'sin meta ni valor no sale');
  assert.ok(!t.includes('E1'), 'sin kpi no sale');
  assert.ok(hrefs(bloque).includes('#operacion/tablero?frente=A3'));
  assert.ok(hrefs(bloque).includes('#operacion/expedientes'));
  const correo = buscarNodos(bloque, n => n.className.includes('mini'))[0];
  assert.ok(correo.className.includes('rojo'), 'correo pendiente en rojo');
  const sinKpis = seccion(pintar({ ...datosOwner, kpis: {}, frentes: [] }), 'Indicadores');
  assert.ok(sinKpis.textContent.includes('sin indicadores'));
});

test('owner: Cierres en 7 días, máximo 5 filas ordenadas por fecha_hito, con "y N más"', () => {
  const bloque = seccion(pintar(), 'Cierres en 7 días');
  const esperados = cierres(datosOwner.encargos, ahora, 7);
  assert.ok(esperados.length > 5, 'la fixture debe forzar el "y N más"');
  const filas = buscarNodos(bloque, n => n.tag === 'a' && n.className.includes('fila'));
  assert.equal(filas.length, 5, 'máximo 5 filas de hito, aparte del enlace "y N más"');
  assert.ok(bloque.textContent.includes('y ' + (esperados.length - 5) + ' más'));
  assert.ok(bloque.textContent.includes('#1'));
  assert.ok(!bloque.textContent.includes('Fuera de ventana'), 'fuera de la ventana de 7 días no sale');
  for (const a of hrefs(bloque)) assert.equal(a, '#operacion/tablero');
});

test('owner: Equipo cuenta activos, en curso y parados, y lista quién trabajó en las últimas 2 h con enlace a su ficha', () => {
  const bloque = seccion(pintar(), 'Equipo');
  assert.ok(bloque.textContent.includes('2 activos'), 'dos agentes activos (el tercero tiene activo:false)');
  assert.ok(bloque.textContent.includes(enCurso(datosOwner.encargos).length + ' en curso'));
  assert.ok(bloque.textContent.includes('1 parados'));
  assert.ok(hrefs(bloque).includes('#equipo/organigrama'));
  assert.ok(hrefs(bloque).includes('#operacion/tablero'), 'parados enlaza al tablero');
  assert.ok(bloque.textContent.includes('Ariadna · hace 30 min'));
  assert.ok(!bloque.textContent.includes('Guillem'), 'hace 5 h ya no cuenta como activo');
  assert.ok(!bloque.textContent.includes('Viejo'), 'inactivo fuera aunque tenga actividad reciente');
  assert.ok(hrefs(bloque).includes('#equipo/agente/ariadna'));
  const nadie = seccion(pintar({ ...datosOwner, agentes: [datosOwner.agentes[1]] }), 'Equipo');
  assert.ok(nadie.textContent.includes('nadie activo en las últimas 2 h'));
});

test('owner: Consumo pinta cada cuenta con su semáforo y el aviso de tercera cuenta, todo hacia Recursos/Cómputo y sin EUR', () => {
  const bloque = seccion(pintar(), 'Consumo');
  const t = bloque.textContent;
  assert.ok(t.includes('diego@ 93 %') && t.includes('semana 93 % · ventana 12 %'));
  assert.ok(t.includes('team@ 97 %'));
  assert.ok(t.includes('reinicio semana'));
  assert.ok(t.includes('urge la tercera cuenta'));
  assert.ok(!t.includes('EUR'), 'el coste en EUR de tokens solo vive en Recursos/Cómputo (spec §8)');
  for (const a of hrefs(bloque)) assert.equal(a, '#recursos/computo');
  const pills = buscarNodos(bloque, n => n.className.startsWith('pill'));
  assert.ok(pills[0].className.includes('ambar') && pills[1].className.includes('rojo'));
  // Sin KPI y con una cuenta libre no hay aviso.
  const libre = seccion(pintar({ ...datosOwner, kpis: {}, cuentas: [{ ...datosOwner.cuentas[0], pct_semana: 30, saturada: false }, datosOwner.cuentas[1]] }), 'Consumo');
  assert.ok(!libre.textContent.includes('urge la tercera cuenta'));
});

test('owner: Alertas resume sesiones abiertas, encargos parados, correo sin contestar y cuentas saturadas', () => {
  const bloque = seccion(pintar(), 'Alertas');
  const t = bloque.textContent;
  assert.ok(t.includes('1 sesiones abiertas'));
  assert.ok(t.includes('1 encargos parados'));
  assert.ok(t.includes('2 correos sin contestar'));
  assert.ok(t.includes('urge la tercera'));
  assert.ok(hrefs(bloque).includes('#operacion/expedientes'));
  assert.ok(hrefs(bloque).includes('#recursos/computo'));
});

test('owner: vacíos', () => {
  const t = pintar({ rol: 'owner' }, { objetivos: [] }).textContent;
  for (const s of ['sin objetivo', '0 urgentes · 0 vencen hoy', 'sin indicadores', 'ningún hito en 7 días', 'sin agentes', 'sin muestras de consumo', 'sin alertas']) assert.ok(t.includes(s), s);
});

test('agente: sin cambios, "Tus tarjetas" con lo en curso y sesiones abiertas; nada de cuentas ni KPIs aunque viajen', () => {
  const raiz = pintar({ ...datosOwner, rol: 'agente', pendientes: [] }, undefined);
  assert.deepEqual(titulos(raiz), ['Tus tarjetas', 'Sesiones abiertas']);
  const ids = buscarNodos(raiz, n => n.className.includes('encargo')).map(t => t.attrs['data-id'] || t.textContent);
  assert.equal(ids.length, enCurso(datosOwner.encargos).length);
  assert.ok(hrefs(raiz).includes('#operacion/expedientes/9'));
  assert.ok(!raiz.textContent.includes('diego@') && !raiz.textContent.includes('correos sin contestar'));
});

test('agente: sin datos en las listas pinta los textos vacíos', () => {
  const t = pintar({ rol: 'agente' }, undefined).textContent;
  assert.ok(t.includes('nada en curso'));
  assert.ok(t.includes('ninguna'));
});
