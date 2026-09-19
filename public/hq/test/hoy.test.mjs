import test from 'node:test';
import assert from 'node:assert/strict';

// Hoy (#1057 tarea 29): render() ahora monta decisiones.montar() (que a su vez importa main.js), asi
// que la cadena de imports es la misma que decisiones.test.mjs/tablero.test.mjs: shim completo con
// classList, getAttribute y prepend (cablearShell() los usa al importar main.js).
function crearNodo(tag) {
  const n = {
    tag, nodeType: 1, children: [], attrs: {}, className: '', _text: '', _html: '', listeners: {}, parent: null,
    classList: { toggle(c, on) { const s = new Set(this._n.className.split(' ').filter(Boolean)); on ? s.add(c) : s.delete(c); this._n.className = [...s].join(' '); return on; }, contains(c) { return this._n.className.split(' ').includes(c); }, add(c) { this.toggle(c, true); }, remove(c) { this.toggle(c, false); } },
    setAttribute(k, v) { this.attrs[k] = v; },
    getAttribute(k) { return this.attrs[k] ?? null; },
    addEventListener(ev, fn) { (this.listeners[ev] ||= []).push(fn); },
    append(...kids) { for (const k of kids) { if (k == null) continue; k.parent = this; this.children.push(k); } },
    prepend(...kids) { for (const k of kids.reverse()) { if (k == null) continue; k.parent = this; this.children.unshift(k); } },
    remove() { if (this.parent) { const i = this.parent.children.indexOf(this); if (i >= 0) this.parent.children.splice(i, 1); this.parent = null; } },
    get textContent() { return this.children.length ? this.children.map(c => (c.nodeType === 3 ? c.data : c.textContent)).join('') : this._text; },
    set textContent(v) { this._text = v; this.children = []; },
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = v; this.children = []; },
    querySelector() { return null; }, querySelectorAll() { return []; }, closest() { return null; },
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

const { render, urgentes, vencidosYParados, proximosCierres } = await import('../app/vistas/hoy.js');
const { enCurso } = await import('../app/estado.js');

const ahora = new Date('2026-09-17T07:00:00Z');
const secciones = raiz => raiz.children.filter(c => c.tag === 'section');
const titulos = raiz => secciones(raiz).map(s => s.children[0].textContent);
const buscarNodos = (n, pred, out = []) => { if (n.nodeType === 1) { if (pred(n)) out.push(n); n.children.forEach(c => buscarNodos(c, pred, out)); } return out; };
const hrefs = raiz => buscarNodos(raiz, n => n.tag === 'a').map(a => a.attrs.href);
const paneles = raiz => buscarNodos(raiz, n => n.tag === 'section' && /panel-kpi/.test(n.className));
const panel = (raiz, titulo) => paneles(raiz).find(p => p.children[0].textContent.startsWith(titulo));

// Fixture con la forma real del payload owner (mismo patrón que el 2.0.10 anterior).
const datosOwner = {
  rol: 'owner',
  pendientes: [
    { id: 635, titulo: 'Responder a Guillem', agente: 'sales-licita', prioridad: 1, vence: '2026-09-17T18:00:00Z' }, // vence hoy y prioridad 1: urgente
    { id: 640, titulo: 'Otra', agente: 'coo', prioridad: 4, vence: '2026-09-20T10:00:00Z' }, // ni urge ni vence hoy
  ],
  encargos: [
    { id: 1, columna: 'en_curso', estado: 'en_curso', texto: 'Cierre A', fecha_hito: '2026-09-10', agente: 'Ariadna', rojo: false }, // vencido (hito pasado)
    { id: 2, columna: 'en_curso', estado: 'en_curso', texto: 'Cierre B '.repeat(10), fecha_hito: '2026-09-19', agente: 'Guillem', rojo: true }, // parado
    { id: 3, columna: 'hecho', estado: 'hecho', texto: 'Cierre C', fecha_hito: '2026-09-01', agente: 'Ona', rojo: false }, // hecho: no cuenta aunque tenga hito pasado
  ],
  licitaciones: [
    { expediente: 'L1', estado: 'Presentada', cierre: '2026-09-20', resumen_corto: 'Resumen L1' }, // dentro de 7 días
    { expediente: 'L2', estado: 'Aprobada', cierre: '2026-09-30', objeto: 'Objeto L2' }, // fuera de 7 días
    { expediente: 'L3', estado: 'Nueva', cierre: '2026-09-18', resumen_corto: 'No cuenta' }, // estado no elegible
  ],
  agentes: [{ id: 'ariadna', nombre: 'Ariadna', activo: true }],
  kpis: {
    'correo.pendientes.n': { valor: 2, texto: '', updated_at: '2026-09-17T06:50:00Z' },
    'cuentas.urge_tercera': { valor: 1, texto: 'diego@ 93 % · team@ 97 %', updated_at: '2026-09-17T06:45:00Z' },
  },
  cuentas: [{ clave: 'principal', cuenta: 'diego@', pct_ventana: 12, pct_semana: 93, saturada: true }],
  sesiones: [{ id: 1, expediente_id: 9, nombre: 'Cíclica', agente: 'cupones', estado: 'abierta', abierta: ahora.toISOString() }],
};
const pintar = (datos = datosOwner) => { const raiz = crearNodo('main'); render(raiz, { datos, filtros: {} }, undefined, {}, ahora); return raiz; };

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

test('vencidosYParados: hito pasado sin cerrar o rojo, hecho fuera, parados primero y luego lo más vencido, tope 8', () => {
  const es = vencidosYParados(datosOwner.encargos, ahora);
  assert.deepEqual(es.map(e => e.id), [2, 1]); // #2 parado primero, luego #1 vencido; #3 esta hecho y no cuenta
  assert.deepEqual(vencidosYParados(undefined, ahora), []);
  const muchos = Array.from({ length: 12 }, (_, i) => ({ id: i, columna: 'en_curso', rojo: true }));
  assert.equal(vencidosYParados(muchos, ahora).length, 8);
});

test('proximosCierres: aprobadas o presentadas que cierran en los próximos 7 días, ordenadas por fecha', () => {
  const cs = proximosCierres(datosOwner.licitaciones, ahora);
  assert.deepEqual(cs.map(l => l.expediente), ['L1']); // L2 cierra fuera de la ventana, L3 no es Aprobada/Presentada
  assert.deepEqual(proximosCierres(undefined, ahora), []);
});

test('owner: franja primero, luego la bandeja de decisiones y por último los tres paneles accionables', () => {
  const raiz = pintar();
  assert.equal(raiz.children[0].className, 'franja');
  assert.equal(raiz.children[1].className, 'seccion bandeja');
  assert.deepEqual(paneles(raiz).map(p => p.children[0].textContent), ['Vencidos y parados', 'Próximos cierres', 'Sesiones abiertas']);
  assert.deepEqual(paneles(raiz).map(p => p.children[0].children[0].attrs.href), ['#operacion/tablero', '#operacion/licitaciones', '#operacion/expedientes']);
  // nada de los diez paneles agregados del cuadro anterior (Objetivo, Pipeline, Embudo, Equipo...): eso vive en KPIs
  for (const t of ['Objetivo', 'Pipeline', 'Embudo', 'Frentes', 'Consumo']) assert.ok(!raiz.textContent.includes(t), t);
});

test('owner: la franja enciende urgentes, parados, cuentas y correo; sin nada, "sin alertas" en verde', () => {
  const t = pintar().children[0].textContent;
  for (const x of ['1 urgentes tuyas', '1 encargos parados', 'cuentas saturadas', '2 correos sin contestar']) assert.ok(t.includes(x), x);
  const raiz = pintar({ rol: 'owner' });
  assert.ok(raiz.children[0].textContent.endsWith('sin alertas'));
  assert.match(raiz.children[0].children.at(-1).className, /verde/);
});

// 2.0.20 punto 4: la primera pill de la franja es "N agentes activos", de agentesActivos().
test('owner: la franja abre con los agentes activos y enlaza al tablero en curso; nunca coste en Home', () => {
  const con = { ...datosOwner, agentes: [
    { id: 'ariadna', nombre: 'Ariadna', activo: true, ultima_actividad: '2026-09-17T06:40:00Z' },
    { id: 'guillem', nombre: 'Guillem', activo: true, ultima_actividad: '2026-09-15T06:40:00Z' }] };
  const primera = pintar(con).children[0].children[0];
  assert.equal(primera.textContent, '1 agente activo');
  assert.equal(primera.attrs.href, '#operacion/tablero?estado=en_curso');
  assert.match(primera.className, /verde/);
  // Sin nadie con latido reciente, pill neutra pero con el mismo enlace.
  const sin = pintar().children[0].children[0];
  assert.equal(sin.textContent, 'ningún agente activo');
  assert.match(sin.className, /neutro-2/);
  assert.equal(sin.attrs.href, '#operacion/tablero?estado=en_curso');
  assert.ok(!/EUR|USD|\$|€/.test(pintar(con).textContent), 'Home nunca habla de coste');
});

test('owner: Vencidos y parados marca alerta y lista lo peor primero', () => {
  const p = panel(pintar(), 'Vencidos y parados');
  assert.match(p.className, /alerta/);
  assert.ok(p.textContent.startsWith('Vencidos y parados2'), p.textContent);
  assert.ok(p.textContent.includes('#2') && p.textContent.indexOf('#2') < p.textContent.indexOf('#1'));
});

test('owner: Próximos cierres cuenta solo lo que cierra esta semana', () => {
  const p = panel(pintar(), 'Próximos cierres');
  assert.ok(p.textContent.startsWith('Próximos cierres1licitación cierra esta semana'), p.textContent);
  assert.ok(p.textContent.includes('L1'));
});

test('owner: Sesiones abiertas cuenta las no cerradas', () => {
  const p = panel(pintar(), 'Sesiones abiertas');
  assert.ok(p.textContent.includes('en curso ahora mismo'));
  assert.ok(p.textContent.includes('Cíclica'));
});

test('owner: vacíos no rompen y no marcan alerta', () => {
  const raiz = pintar({ rol: 'owner' });
  assert.equal(paneles(raiz).length, 3);
  assert.ok(panel(raiz, 'Vencidos y parados').textContent.includes('nada parado'));
  assert.ok(!/alerta/.test(panel(raiz, 'Vencidos y parados').className));
  assert.ok(panel(raiz, 'Próximos cierres').textContent.includes('0licitaciones cierran esta semana'));
  assert.ok(panel(raiz, 'Sesiones abiertas').textContent.includes('ninguna abierta'));
});

test('agente: "Tus tarjetas" con lo en curso y sesiones abiertas; nada de franja ni bandeja', () => {
  const raiz = pintar({ ...datosOwner, rol: 'agente', pendientes: [] });
  assert.deepEqual(titulos(raiz), ['Tus tarjetas', 'Sesiones abiertas']);
  const ids = buscarNodos(raiz, n => n.className.includes('encargo')).map(t => t.attrs['data-id'] || t.textContent);
  assert.equal(ids.length, enCurso(datosOwner.encargos).length);
  assert.ok(hrefs(raiz).includes('#operacion/expedientes/9'));
  assert.ok(!raiz.textContent.includes('correos sin contestar'));
});

test('agente: "Tus tarjetas" se corta en 10 con enlace a las restantes', () => {
  const muchos = Array.from({ length: 13 }, (_, i) => ({ id: i, columna: 'en_curso', estado: 'en_curso', texto: 'Tarea ' + i }));
  const raiz = pintar({ rol: 'agente', encargos: muchos, sesiones: [] });
  assert.equal(buscarNodos(raiz, n => n.className.includes('encargo')).length, 10);
  const enlace = buscarNodos(raiz, n => n.tag === 'a' && n.textContent === 'ver las 3 restantes')[0];
  assert.ok(enlace, 'debe enlazar a las 3 restantes');
  assert.equal(enlace.attrs.href, '#operacion/tablero');
});

test('agente: con 10 o menos no aparece el enlace de "ver más"', () => {
  const raiz = pintar({ rol: 'agente', encargos: [{ id: 1, columna: 'en_curso', estado: 'en_curso', texto: 'Uno' }], sesiones: [] });
  assert.equal(buscarNodos(raiz, n => n.tag === 'a' && /restantes/.test(n.textContent)).length, 0);
});

test('agente: sin datos en las listas pinta los textos vacíos', () => {
  const t = pintar({ rol: 'agente' }).textContent;
  assert.ok(t.includes('nada en curso'));
  assert.ok(t.includes('ninguna'));
});
