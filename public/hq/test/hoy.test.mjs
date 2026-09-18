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
    set innerHTML(v) { this.children = []; this._html = v; }, get innerHTML() { return this._html || ''; },
    querySelector() { return null; }, querySelectorAll() { return []; },
  };
  return n;
}
globalThis.document = { createElement: t => crearNodo(t), createTextNode: d => ({ nodeType: 3, data: d }), getElementById: () => crearNodo('div'), body: crearNodo('body'), addEventListener() {} };
globalThis.location = { hash: '', search: '', pathname: '/hq/' }; globalThis.history = { replaceState() {} }; globalThis.window = { addEventListener() {} }; globalThis.HQ_VERSION = { v: 'test' };
if (typeof globalThis.localStorage === 'undefined') { const mem = new Map(); globalThis.localStorage = { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) }; }

const { render, urgentes, activosRecientes, eurCorto, pipelinePorMes, embudoLicitaciones, avancesPorDia, cierresPorDia, porColumna } = await import('../app/vistas/hoy.js');
const { enCurso, cierres } = await import('../app/estado.js');

const ahora = new Date('2026-09-17T07:00:00Z');
const secciones = raiz => raiz.children.filter(c => c.tag === 'section');
const titulos = raiz => secciones(raiz).map(s => s.children[0].textContent);
const buscarNodos = (n, pred, out = []) => { if (n.nodeType === 1) { if (pred(n)) out.push(n); n.children.forEach(c => buscarNodos(c, pred, out)); } return out; };
const hrefs = raiz => buscarNodos(raiz, n => n.tag === 'a').map(a => a.attrs.href);
const paneles = raiz => buscarNodos(raiz, n => n.tag === 'section' && /panel-kpi/.test(n.className));
const panel = (raiz, titulo) => paneles(raiz).find(p => p.children[0].textContent.startsWith(titulo));
const svgs = n => buscarNodos(n, x => /graf/.test(x.className)).map(x => x.innerHTML);

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

test('eurCorto: M con una decimal y coma, k redondeado, entero por debajo de 10.000', () => {
  assert.equal(eurCorto(2272000), '2,3 M EUR');
  assert.equal(eurCorto(227990.46), '228 k EUR');
  assert.equal(eurCorto(null), '0 EUR');
});

test('pipelinePorMes: aprobadas y presentadas por mes de cierre desde el mes en curso, lo anterior a la primera y lo posterior a la última', () => {
  const cols = pipelinePorMes([
    { estado: 'Presentada', cierre: '2026-08-30', importe: 100 }, // anterior: cae en sep
    { estado: 'Presentada', cierre: '2026-09-17', importe: 50 },
    { estado: 'Aprobada', cierre: '2026-10-02', importe: '200' },
    { estado: 'Aprobada', cierre: '2030-04-29', importe: 7 }, // posterior: cae en la última
    { estado: 'Nueva', cierre: '2026-09-20', importe: 999 }, // no cuenta
    { estado: 'aprobada', cierre: null, importe: 1 }, // sin cierre: primera
  ], ahora);
  assert.deepEqual(cols.map(c => c.etiqueta), ['sep', 'oct', 'nov', 'dic', 'ene', 'feb+']);
  assert.deepEqual(cols.map(c => [c.presentada, c.aprobada]), [[150, 1], [0, 200], [0, 0], [0, 0], [0, 0], [0, 7]]);
});

test('embudoLicitaciones: acumulado desde lic_resumen', () => {
  const e = embudoLicitaciones({ total: { n: 1888 }, descartadas: { n: 1383 }, aprobadas: { n: 26 }, presentadas: { n: 9 }, no_adjudicadas: { n: 1 }, adjudicadas: { n: 0 }, contratadas: { n: 0 } });
  assert.deepEqual(e.map(x => [x.l, x.n]), [['Detectadas', 1888], ['Sin descartar', 505], ['Aprobadas', 36], ['Presentadas', 10], ['Adjudicadas', 0]]);
  assert.equal(embudoLicitaciones(undefined)[0].n, 0);
});

test('avancesPorDia y cierresPorDia: series por día (UTC), hoy el último en avances y la semana siguiente en cierres', () => {
  const av = avancesPorDia([{ fecha: '2026-09-17T06:00:00Z' }, { fecha: '2026-09-17T01:00:00Z' }, { fecha: '2026-09-16T10:00:00Z' }, { fecha: '2026-09-10T10:00:00Z' }, {}], ahora, 3);
  assert.deepEqual(av.map(x => [x.dia, x.n]), [['2026-09-15', 0], ['2026-09-16', 1], ['2026-09-17', 2]]);
  const ci = cierresPorDia(datosOwner.encargos, ahora, 7);
  assert.equal(ci.length, 7);
  assert.deepEqual(ci.slice(0, 3).map(x => [x.dia, x.n, x.rojos]), [['2026-09-18', 1, 0], ['2026-09-19', 1, 1], ['2026-09-20', 1, 0]]);
});

test('porColumna: cuenta por columna del tablero, lo desconocido fuera', () => {
  assert.deepEqual(porColumna([{ columna: 'en_curso' }, { columna: 'en_curso' }, { columna: 'hecho' }, { columna: 'raro' }, {}]), { backlog: 0, por_hacer: 0, en_curso: 2, bloqueado: 0, hecho: 1 });
});

test('owner: franja de semáforos y diez paneles en orden, cada uno con su enlace de destino', () => {
  const raiz = pintar();
  assert.equal(raiz.children[0].className, 'franja');
  assert.deepEqual(paneles(raiz).map(p => p.children[0].textContent), ['Objetivo 2026', 'Depende de ti', 'Pipeline de licitaciones', 'Embudo de licitaciones', 'Expedientes', 'Frentes', 'Encargos', 'Cierres en 7 días', 'Equipo', 'Consumo de cuentas']);
  assert.deepEqual(paneles(raiz).map(p => p.children[0].children[0].attrs.href), ['#direccion/objetivo', '#reglas/decisiones', '#operacion/licitaciones', '#operacion/licitaciones', '#operacion/expedientes', '#operacion/tablero', '#operacion/tablero', '#operacion/tablero', '#equipo/organigrama', '#recursos/computo']);
  assert.equal(secciones(raiz).length, 0); // nada de las secciones de texto del 2.0.5
});

test('owner: la franja enciende urgentes, parados, cuentas, correo y sesiones; sin nada, "sin alertas" en verde', () => {
  const t = pintar().children[0].textContent;
  for (const x of ['1 urgentes tuyas', '1 encargos parados', 'cuentas saturadas', '2 correos sin contestar', '1 sesiones abiertas']) assert.ok(t.includes(x), x);
  const vacia = pintar({ rol: 'owner' }, { objetivos: [] }).children[0];
  assert.equal(vacia.textContent, 'sin alertas');
  assert.match(vacia.children[0].className, /verde/);
});

test('owner: Objetivo con cifra grande, progreso con la raya del prorrateo en SVG y desviación como tendencia', () => {
  const p = panel(pintar(), 'Objetivo');
  const t = p.textContent;
  assert.ok(t.startsWith('Objetivo 202620 k EUR'), t);
  assert.ok(t.includes('de 300 k EUR · 7 %'), t);
  assert.ok(/por (debajo|encima) de lo previsto a hoy/.test(t), t);
  const svg = svgs(p)[0];
  assert.match(svg, /^<svg viewBox="0 0 100 10" role="img"/);
  assert.match(svg, /class="g-oro" x="0" y="0" width="7"/);
  assert.match(svg, /class="g-tinta"/); // la raya de "a hoy tocaría"
});

test('owner: Depende de ti con número, urgentes y hasta tres líneas, marcado como alerta si hay urgentes', () => {
  const p = panel(pintar(), 'Depende de ti');
  assert.match(p.className, /alerta/);
  assert.ok(p.textContent.startsWith('Depende de ti2'));
  assert.ok(p.textContent.includes('1 urgentes · 1 vencen hoy'));
  assert.ok(p.textContent.includes('Responder a Guillem'));
  assert.equal(buscarNodos(p, n => n.tag === 'button').length, 0);
});

test('owner: Pipeline, Embudo y Expedientes pintan SVG propio y leyendas con cifras', () => {
  const datos = { ...datosOwner,
    licitaciones: [{ estado: 'Presentada', cierre: '2026-09-10', importe: 165489 }, { estado: 'Aprobada', cierre: '2026-10-20', importe: 2106960 }],
    lic_resumen: { total: { n: 1888 }, descartadas: { n: 1383 }, aprobadas: { n: 26 }, presentadas: { n: 9 } },
    expedientes: [{ estado_funnel: 'ejecución', importe: 8000 }, { estado_funnel: 'ejecución', importe: 8000 }, { estado_funnel: 'propuesta', importe: 8000 }, { estado_funnel: null }] };
  const raiz = pintar(datos);
  const pip = panel(raiz, 'Pipeline');
  assert.ok(pip.textContent.includes('2,3 M EUR'));
  assert.equal((svgs(pip)[0].match(/<rect /g) || []).length, 6); // 2 meses con barra + 4 rayas a 0
  const emb = panel(raiz, 'Embudo');
  assert.ok(emb.textContent.includes('presentadas de 1888 detectadas'));
  assert.equal(svgs(emb).filter(s => s.includes('g-oro')).length, 1); // solo presentadas en oro
  const exp = panel(raiz, 'Expedientes');
  assert.ok(exp.textContent.includes('24 k EUR'));
  assert.ok(exp.textContent.includes('ejecución2'));
  assert.equal((svgs(exp)[0].match(/stroke-dasharray/g) || []).length, 3);
});

test('owner: Frentes ordenados por avance con enlace al tablero filtrado; Encargos, Cierres, Equipo y Consumo', () => {
  const raiz = pintar();
  const fr = panel(raiz, 'Frentes');
  assert.deepEqual(buscarNodos(fr, n => n.tag === 'a' && /fila-barra/.test(n.className)).map(a => a.attrs.href), ['#operacion/tablero?frente=A3']);
  assert.ok(panel(raiz, 'Encargos').textContent.includes('parados'));
  const ci = panel(raiz, 'Cierres');
  assert.ok(ci.textContent.startsWith('Cierres en 7 días6hitos esta semana'), ci.textContent);
  assert.ok(ci.textContent.includes('siguiente: '));
  const eq = panel(raiz, 'Equipo');
  assert.deepEqual(buscarNodos(eq, n => n.tag === 'a' && /pill/.test(n.className)).map(a => a.attrs.href), ['#equipo/agente/ariadna']);
  const co = panel(raiz, 'Consumo');
  assert.equal(svgs(co).length, 2);
  assert.match(svgs(co)[0], /t-(rojo|ambar)/);
  assert.ok(co.textContent.includes('urge la tercera cuenta'));
  assert.ok(!/EUR/.test(co.textContent));
});

test('owner: vacíos no rompen', () => {
  const raiz = pintar({ rol: 'owner' }, { objetivos: [] });
  assert.equal(paneles(raiz).length, 10);
  assert.ok(panel(raiz, 'Objetivo').textContent.includes('sin objetivo'));
  assert.ok(panel(raiz, 'Consumo').textContent.includes('sin muestras de consumo'));
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
