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
  removeEventListener: () => {},
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

const { render, cuadroTablero, vencidos, porResponsable, columnaChip, seccionesTablero, cabeceraAhora } = await import('../app/vistas/tablero.js');
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

// #1057 tarea 29: el cuadro se va a Operación/KPIs (grupo tablero); render() ya solo deja el enlace.
// 2.0.20: la barra de selects y las pestañas de móvil se van; quedan los chips de columna y la hoja.
test('render pinta el enlace a KPIs, los chips de columna y el FAB de la hoja', () => {
  const raiz = crearNodo('main');
  render(raiz, Sx(), null, {}, AHORA);
  assert.deepEqual(raiz.children.map(n => n.className), ['fila enlace-kpis', 'barra-filtros', 'kanban con-fab', 'fab-filtros', 'hoja-fondo']);
  const enlace = buscarNodos(raiz.children[0], n => n.tag === 'a')[0];
  assert.equal(enlace.attrs.href, '#kpis?grupo=tablero');
  assert.equal(enlace.textContent, 'KPIs ›');
  assert.equal(buscarNodos(raiz, n => n.tag === 'select').length, 0, 'fuera los selects de la barra vieja');
  assert.equal(buscarNodos(raiz, n => (n.className || '').includes('pestanas')).length, 0);
  const chips = buscarNodos(raiz.children[1], n => n.tag === 'a' && (n.className || '').includes('chip'));
  assert.deepEqual(chips.map(c => [c.textContent, c.attrs.href, (c.className || '').includes('activo')]), [
    ['Todas', '#operacion/tablero', true],
    ['Backlog 1', '#operacion/tablero?estado=backlog', false],
    ['Por hacer 0', '#operacion/tablero?estado=por_hacer', false],
    ['En curso 2', '#operacion/tablero?estado=en_curso', false],
    ['Bloqueado 1', '#operacion/tablero?estado=bloqueado', false],
    ['Hecho 1', '#operacion/tablero?estado=hecho', false],
    // Brief B (19-sep): chip virtual "Parados" al final del embudo, ninguno en este fixture (sin e.rojo).
    ['Parados 0', '#operacion/tablero?estado=parados', false]]);
  // Sin chip activo se ven las cinco columnas, como hasta ahora.
  assert.deepEqual(buscarNodos(raiz.children[2], n => (n.className || '') === 'columna').map(n => n.attrs['data-columna']),
    ['backlog', 'por_hacer', 'en_curso', 'bloqueado', 'hecho']);
});

test('estado=<columna> en la ruta deja solo esa columna y marca su chip', () => {
  const raiz = crearNodo('main');
  render(raiz, Sx(), null, { estado: 'bloqueado' }, AHORA);
  assert.deepEqual(buscarNodos(raiz.children[2], n => (n.className || '') === 'columna').map(n => n.attrs['data-columna']), ['bloqueado']);
  assert.ok(raiz.children[2].className.includes('una'));
  const activo = buscarNodos(raiz.children[1], n => n.tag === 'a' && (n.className || '').includes('activo'))[0];
  assert.equal(activo.attrs.href, '#operacion/tablero?estado=bloqueado');
  // Una columna inventada no filtra nada.
  const otra = crearNodo('main');
  render(otra, Sx(), null, { estado: 'chorra' }, AHORA);
  assert.equal(buscarNodos(otra.children[2], n => (n.className || '') === 'columna').length, 5);
  assert.equal(columnaChip('en_curso'), 'en_curso');
  assert.equal(columnaChip('chorra'), '');
  assert.equal(columnaChip(null), '');
  // Brief B (19-sep, pill "N encargos parados" de Home): 'parados' es virtual, no columna del kanban.
  assert.equal(columnaChip('parados'), 'parados');
});

// Brief B (19-sep): sección virtual "Parados" (e.rojo de cualquier columna abierta), con su chip rojo,
// sin arrastre y sin contar los ya 'hecho' aunque vinieran marcados rojo por error.
test('estado=parados: chip rojo con el recuento, solo tarjetas con e.rojo de columnas abiertas y sin arrastre', () => {
  const encargosParados = [
    { id: 10, columna: 'en_curso', agente: 'chief', texto: 'Parado uno', rojo: true },
    { id: 11, columna: 'bloqueado', agente: 'chief', texto: 'Parado dos', rojo: true },
    { id: 12, columna: 'hecho', agente: 'chief', texto: 'Hecho marcado rojo, no cuenta', rojo: true },
    { id: 13, columna: 'en_curso', agente: 'chief', texto: 'Sano', rojo: false },
  ];
  const S = { datos: { encargos: encargosParados, bloques: [], frentes: [], agentes: [{ id: 'chief', nombre: 'Marc' }], rol: 'owner' }, filtros: {}, columnaMovil: null };
  const raiz = crearNodo('main');
  render(raiz, S, null, { estado: 'parados' }, AHORA);
  const chip = buscarNodos(raiz.children[1], n => n.tag === 'a' && n.textContent.startsWith('Parados'))[0];
  assert.equal(chip.textContent, 'Parados 2');
  assert.ok(chip.className.includes('chip rojo') && chip.className.includes('activo'), chip.className);
  const secciones = buscarNodos(raiz.children[2], n => (n.className || '') === 'columna');
  assert.deepEqual(secciones.map(s => s.attrs['data-columna']), ['parados']);
  const tarjetas = buscarNodos(secciones[0], n => (n.className || '').includes('tarjeta'));
  assert.equal(tarjetas.length, 2);
  assert.deepEqual(tarjetas.map(t => t.draggable), [false, false], 'la sección virtual no admite soltar');
  assert.ok(secciones[0].textContent.includes('Parado uno') && secciones[0].textContent.includes('Parado dos'));
  assert.ok(!secciones[0].textContent.includes('Sano') && !secciones[0].textContent.includes('Hecho marcado rojo'));
});

test('secciones de la hoja del tablero: bloque, frente, agente, etiqueta y buscador', () => {
  const d = { bloques: [{ letra: 'A', nombre: 'Licitaciones' }], frentes: [{ codigo: 'A1', linea: 'Fuentes' }], agentes: [{ id: 'chief', nombre: 'Marc' }], encargos: [{ etiquetas: ['urgente'] }, { etiquetas: ['urgente', 'kit'] }] };
  const ss = seccionesTablero(d);
  assert.deepEqual(ss.map(s2 => s2.clave), ['bloque', 'frente', 'agente', 'etiqueta', 'texto']);
  assert.deepEqual(ss[0].opciones, [['A', 'A Licitaciones']]);
  assert.deepEqual(ss[1].opciones, [['A1', 'A1 Fuentes']]);
  assert.deepEqual(ss[2].opciones, [['chief', 'Marc']]);
  assert.deepEqual(ss[3].opciones, [['kit', 'kit'], ['urgente', 'urgente']]);
  assert.equal(ss[4].libre, true);
  assert.deepEqual(seccionesTablero().map(s2 => (s2.opciones || []).length), [0, 0, 0, 0, 0]);
});

// 2.0.20 punto 4: la cabecera "Ahora mismo" sale de agentesActivos(), la misma fuente que Home.
test('cabecera Ahora mismo con estado=en_curso: recuento y una pill por agente activo', () => {
  const ahora = new Date('2026-09-19T12:00:00Z');
  const S = { datos: { rol: 'owner', bloques: [], frentes: [], encargos: [
    { id: 7, columna: 'en_curso', estado: 'en_curso', agente: 'chief', texto: 'Cerrar la oferta de Calp con toda la documentación del sobre B' },
    { id: 8, columna: 'en_curso', estado: 'en_curso', agente: 'nadie', texto: 'Otro' }],
    agentes: [{ id: 'chief', nombre: 'Marc', ultima_actividad: '2026-09-19T11:50:00Z' }, { id: 'guillem', nombre: 'Guillem', ultima_actividad: '2026-09-19T11:55:00Z' }, { id: 'nil', nombre: 'Nil', ultima_actividad: '2026-09-17T10:00:00Z' }] },
    filtros: {} };
  const cab = cabeceraAhora(S, ahora);
  assert.equal(cab.children[0].textContent, 'Ahora mismo · 2 agentes activos · 2 encargos en curso');
  const pills = buscarNodos(cab, n => n.tag === 'a' && (n.className || '').includes('pill'));
  assert.deepEqual(pills.map(a => [a.textContent, a.attrs.href]), [
    ['Marc · Cerrar la oferta de Calp con toda la do…', '#equipo/agente/chief'],
    ['Guillem · sin encargo en curso', '#equipo/agente/guillem']]);
  const raiz = crearNodo('main');
  render(raiz, S, null, { estado: 'en_curso' }, ahora);
  assert.ok(raiz.children[1].textContent.includes('Ahora mismo · 2 agentes activos'));
  // Sin el chip de En curso no hay cabecera.
  const otra = crearNodo('main');
  render(otra, S, null, {}, ahora);
  assert.ok(!otra.children[1].textContent.includes('Ahora mismo'));
  // Sin nadie con latido reciente, una pill neutra.
  const solos = { ...S, datos: { ...S.datos, agentes: [{ id: 'nil', nombre: 'Nil', ultima_actividad: null }] } };
  assert.ok(cabeceraAhora(solos, ahora).textContent.includes('0 agentes activos'));
  assert.ok(cabeceraAhora(solos, ahora).textContent.includes('ningún agente activo'));
});

// Brief 2021 (capa C): el textarea del modal "Nuevo encargo" lleva data-conservar fijo para que
// campoTexto() le enganche el borrador de localStorage (mismo patron de intercepcion de getElementById
// que usa decisiones.test.mjs para pedirMotivos, porque el shim de este fichero no cachea 'capa').
test('nuevoEncargo: el textarea del modal lleva data-conservar fijo', () => {
  const raiz = crearNodo('main');
  render(raiz, Sx(), null, {}, AHORA);
  const boton = buscarNodos(raiz, n => n.tag === 'button' && n.textContent === '+ Encargo')[0];
  const capa = crearNodo('div');
  const original = document.getElementById;
  document.getElementById = () => capa;
  try {
    boton.listeners.click[0]();
    const textarea = buscarNodos(capa, n => n.tag === 'textarea')[0];
    assert.equal(textarea.attrs['data-conservar'], 'tablero:nuevo');
  } finally { document.getElementById = original; }
});
