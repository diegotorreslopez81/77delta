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
  removeEventListener: () => {},
};
globalThis.location = { hash: '', search: '', pathname: '/hq/' };
globalThis.history = { replaceState: () => {} };
globalThis.window = { addEventListener: () => {} };
globalThis.HQ_VERSION = { v: 'test' };
if (typeof globalThis.localStorage === 'undefined') {
  const mem = new Map();
  globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
}

const { estadoSesion, render, tarjetaExp, pasoEconomico, porFase, sinActualizar, buscarExp, panelesExpedientes, decidirSesion, filtrarExp, ordenarExp, seccionesExp, construirRutaExp, conSesionAbierta } = await import('../app/vistas/expedientes.js');

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

// #1057 tarea 29: los cuatro paneles se van a Operación/KPIs (grupo expedientes); lista() ya no los
// pinta, solo el enlace. panelesExpedientes() se prueba directo con el mismo payload y fixture de antes.
test('panelesExpedientes: cuatro paneles con cartera, fase, trabajo y estado sin actualizar', () => {
  const ps = panelesExpedientes(S().datos, AHORA);
  const panelDe2 = t => ps.find(p => p.children[0].textContent === t);
  assert.deepEqual(ps.map(p => p.children[0].textContent), ['Cartera de clientes', 'Por fase', 'Trabajo abierto', 'Sin estado reciente']);
  assert.ok(panelDe2('Cartera de clientes').textContent.startsWith('Cartera de clientes24 k EUR3 clientes · sin IVA'), panelDe2('Cartera de clientes').textContent);
  assert.match(buscarNodos(panelDe2('Cartera de clientes'), n => clase(n, 'graf'))[0].innerHTML, /g-neutro-2.*g-tinta-2.*g-tinta"/);
  assert.equal(buscarNodos(panelDe2('Por fase'), n => clase(n, 'centro'))[0].textContent, '5');
  const tr = panelDe2('Trabajo abierto');
  assert.ok(tr.textContent.startsWith('Trabajo abierto8encargos abiertos en 3 expedientes'), tr.textContent);
  assert.deepEqual(buscarNodos(tr, n => clase(n, 'fila-barra')).map(f => f.attrs.href), ['#operacion/expedientes/4', '#operacion/expedientes/1', '#operacion/expedientes/3']);
  const sa = panelDe2('Sin estado reciente');
  assert.match(sa.className, /alerta/);
  assert.ok(sa.textContent.includes('4sin resumen en 7 días'));
});

test('lista: enlace KPIs en vez del cuadro de mando', () => {
  const r = pintar();
  assert.equal(paneles(r).length, 0);
  const enlace = buscarNodos(r, n => n.tag === 'a' && clase(n, 'btn-enlace'))[0];
  assert.equal(enlace.attrs.href, '#kpis?grupo=expedientes');
  assert.equal(enlace.textContent, 'KPIs ›');
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

// 2.0.20: el buscador y los filtros nuevos viven en la hoja; la lista se repinta por la ruta.
test('hoja: buscador sin acentos, secciones con recuento y "Ver N resultados" a la ruta; alta solo owner', () => {
  const r = pintar();
  const clase2 = (n, c) => (n.className || '').split(' ').includes(c);
  const input = buscarNodos(r, n => n.tag === 'input' && clase2(n, 'hoja-buscar'))[0];
  const ver = buscarNodos(r, n => n.tag === 'button' && clase2(n, 'primario') && /^Ver /.test(n.textContent))[0];
  input.listeners.input[0]({ target: { value: 'organo' } });
  assert.equal(ver.textContent, 'Ver 1 resultado');
  globalThis.location.hash = '';
  ver.listeners.click[0]({});
  assert.equal(globalThis.location.hash, '#operacion/expedientes?tipo=cliente&texto=organo');
  assert.deepEqual(nombres(pintar({ texto: 'organo' })), ['Órgano Uno']);
  assert.deepEqual(nombres(pintar({ texto: 'nil' })), ['Zimeron', 'Aresa']);
  assert.ok(pintar({ texto: 'zzz' }).textContent.includes('nada con este filtro'));
  assert.equal(buscarNodos(r, n => n.tag === 'button' && n.textContent === '+ Expediente').length, 0);
  assert.equal(buscarNodos(pintar({}, 'owner'), n => n.tag === 'button' && n.textContent === '+ Expediente').length, 1);
});

test('hoja de expedientes: fase, responsable, tipología y orden, con pills de lo activo', () => {
  const secc = r => buscarNodos(r, n => n.tag === 'section' && (n.className || '').includes('hoja-seccion')).map(s2 => s2.children[0].textContent);
  assert.deepEqual(secc(pintar()), ['Fase', 'Responsable', 'Tipología', 'Orden']);
  const r = pintar({ fase: 'ejecución', orden: 'nombre' });
  assert.deepEqual(nombres(r), ['Aresa', 'Zimeron']);
  assert.deepEqual(nombres(pintar({ fase: 'activo' })), ['Órgano Uno']);
  assert.deepEqual(nombres(pintar({ tipologia: 'cupon' })), ['Aresa']);
  // Orden por actualización: primero el que tiene resumen reciente, el resto por nombre.
  assert.deepEqual(nombres(pintar({ orden: 'actualizacion' })), ['Zimeron', 'Aresa', 'Órgano Uno']);
  assert.deepEqual(buscarNodos(r, n => n.tag === 'span' && (n.className || '').includes('pill-activo')).map(n => n.textContent),
    ['Fase: ejecución×', 'Orden: Nombre×']);
  // La x de la pill reescribe la ruta sin ese filtro.
  globalThis.location.hash = '';
  buscarNodos(r, n => n.tag === 'button' && (n.className || '').includes('quita-pill'))[0].listeners.click[0]({});
  assert.equal(globalThis.location.hash, '#operacion/expedientes?tipo=cliente&orden=nombre');
  // Orden por nombre y por actualización sobre todos los tipos.
  assert.deepEqual(nombres(pintar({ tipo: 'todos', orden: 'nombre' })), ['ACCIÓ Exploració', 'Aresa', 'Órgano Uno', 'Regulia', 'Zimeron']);
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

// Brief B (19-sep): "Trabajar con" ya no redirige a ciegas. decidirSesion es pura (sin RPC ni DOM):
// el '{id}' de los mensajes lo sustituye trabajarCon con el id que devuelve omc_sesion_solicitar.
// Umbral de "latido reciente" = tramo(a, ahora) === 'activo' en equipo.js, o sea menos de 1 hora.
const agenteVivo = { id: 'agente-x', nombre: 'Agente X', activo: true, sesion_url: 'https://claude.ai/chat/abc', ultima_actividad: new Date(AHORA.getTime() - 10 * 60000).toISOString() };
const agenteSinSesion = { id: 'agente-y', nombre: 'Agente Y', activo: true, ultima_actividad: new Date(AHORA.getTime() - 10 * 60000).toISOString() };
const agenteInactivo = { id: 'delivery-cupones', nombre: 'Nil', activo: false, sesion_url: 'https://claude.ai/chat/def', ultima_actividad: new Date(AHORA.getTime() - 2 * 3600000).toISOString() };
const agenteCuentaTeam = { id: 'agente-z', nombre: 'Agente Z', activo: true, cuenta: 'team', sesion_url: 'https://claude.ai/chat/ghi', ultima_actividad: new Date(AHORA.getTime() - 10 * 60000).toISOString() };
const agenteLatidoViejo = { id: 'agente-w', nombre: 'Agente W', activo: true, sesion_url: 'https://claude.ai/chat/jkl', ultima_actividad: new Date(AHORA.getTime() - 25 * 3600000).toISOString() };
const agentesGuardia = [agenteVivo, agenteSinSesion, agenteInactivo, agenteCuentaTeam, agenteLatidoViejo];

test('decidirSesion: activo con latido reciente abre la sesion de verdad', () => {
  const d = decidirSesion({ id: 1, responsable: 'agente-x' }, agentesGuardia, AHORA);
  assert.deepEqual(d, { accion: 'abrir', url: 'https://claude.ai/chat/abc', mensaje: null });
});

test('decidirSesion: activo pero sin sesion publicada avisa con el id de la solicitud', () => {
  const d = decidirSesion({ id: 2, responsable: 'agente-y' }, agentesGuardia, AHORA);
  assert.equal(d.accion, 'avisar'); assert.equal(d.url, null);
  assert.equal(d.mensaje, 'El agente Agente Y no ha publicado su sesión: solicitada #{id}');
});

test('decidirSesion: inactivo con sesion avisa que la publicara al arrancar, nunca abre', () => {
  const d = decidirSesion({ id: 3, responsable: 'delivery-cupones' }, agentesGuardia, AHORA);
  assert.equal(d.accion, 'avisar'); assert.equal(d.url, null);
  assert.equal(d.mensaje, 'El agente Nil está inactivo: sesión solicitada #{id}, la publicará al arrancar');
});

test('decidirSesion: agente inexistente avisa sin responsable', () => {
  const d = decidirSesion({ id: 4, responsable: 'no-existe' }, agentesGuardia, AHORA);
  assert.deepEqual(d, { accion: 'avisar', url: null, mensaje: 'sin responsable' });
});

test('decidirSesion: sesion de la cuenta team@ nunca se abre sola, se dice de que cuenta es', () => {
  const d = decidirSesion({ id: 5, responsable: 'agente-z' }, agentesGuardia, AHORA);
  assert.equal(d.accion, 'avisar'); assert.equal(d.url, null);
  assert.equal(d.mensaje, 'La sesión de Agente Z es de la cuenta team@: ábrela con esa cuenta');
});

test('decidirSesion: activo=true pero latido de mas de un dia cuenta como inactivo (mismo umbral que el punto verde)', () => {
  const d = decidirSesion({ id: 6, responsable: 'agente-w' }, agentesGuardia, AHORA);
  assert.equal(d.accion, 'avisar'); assert.equal(d.url, null);
  assert.match(d.mensaje, /está inactivo/);
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

// 2.0.20: funciones puras de los filtros de la lista.
test('filtrarExp, ordenarExp, seccionesExp y construirRutaExp: puras', () => {
  const vivos = xs.filter(x => x.activo !== false);
  assert.deepEqual(filtrarExp(vivos, { fase: 'ejecución' }).map(x => x.nombre), ['Aresa', 'Zimeron']);
  assert.deepEqual(filtrarExp(vivos, { responsable: 'chief' }).map(x => x.nombre), ['Órgano Uno']);
  assert.deepEqual(filtrarExp(vivos, { tipologia: 'cupon' }).map(x => x.nombre), ['Aresa']);
  assert.deepEqual(filtrarExp(vivos, { texto: 'accio' }).map(x => x.nombre), ['ACCIÓ Exploració']);
  assert.equal(filtrarExp(vivos, {}).length, 5);
  assert.deepEqual(filtrarExp([{ nombre: 'Sin fase' }], { fase: 'sin fase' }).map(x => x.nombre), ['Sin fase']);
  assert.deepEqual(ordenarExp(vivos).map(x => x.nombre), ['Zimeron', 'Aresa', 'Órgano Uno', 'ACCIÓ Exploració', 'Regulia']);
  assert.deepEqual(ordenarExp(vivos, 'nombre').map(x => x.nombre), ['ACCIÓ Exploració', 'Aresa', 'Órgano Uno', 'Regulia', 'Zimeron']);
  assert.equal(ordenarExp(vivos, 'actualizacion')[0].nombre, 'Zimeron');
  assert.deepEqual(ordenarExp(), []);
  const ss = seccionesExp(vivos, [{ id: 'chief', nombre: 'Marc' }]);
  assert.deepEqual(ss.map(x => x.clave), ['fase', 'responsable', 'tipologia', 'orden', 'texto']);
  assert.deepEqual(ss[0].opciones[0], ['ejecución', 'ejecución', 2]);
  assert.deepEqual(ss[1].opciones.find(o => o[0] === 'chief'), ['chief', 'Marc', 1]);
  assert.equal(ss[3].defecto, 'importe');
  assert.equal(construirRutaExp({ tipo: 'cliente' }), '#operacion/expedientes?tipo=cliente');
  assert.equal(construirRutaExp({ tipo: 'todos', fase: 'beta', orden: 'nombre', texto: 'x' }), '#operacion/expedientes?tipo=todos&fase=beta&texto=x&orden=nombre');
  assert.equal(construirRutaExp({ tipo: 'cliente', orden: 'importe' }), '#operacion/expedientes?tipo=cliente', 'el orden por defecto no ensucia la ruta');
  assert.equal(construirRutaExp(), '#operacion/expedientes');
});

// Brief B (19-sep, píldora "N sesiones abiertas" de Home): construirRutaExp lleva 'sesion=abierta'
// solo cuando se pide, y conSesionAbierta es la funcion pura que de verdad filtra.
test('construirRutaExp con sesion=abierta; sin el parametro no ensucia la ruta', () => {
  assert.equal(construirRutaExp({ tipo: 'todos', sesion: 'abierta' }), '#operacion/expedientes?tipo=todos&sesion=abierta');
  assert.equal(construirRutaExp({ tipo: 'todos' }), '#operacion/expedientes?tipo=todos', 'sin sesion, la ruta no lleva el parametro');
  assert.equal(construirRutaExp({ tipo: 'todos', sesion: 'lo-que-sea' }), '#operacion/expedientes?tipo=todos', 'solo "abierta" cuenta como valor valido');
});

test('conSesionAbierta: solo los expedientes con sesion abierta o solicitada, nunca cerrada', () => {
  const ses = [{ id: 1, expediente_id: 1, estado: 'abierta' }, { id: 2, expediente_id: 2, estado: 'solicitada' }, { id: 3, expediente_id: 3, estado: 'cerrada' }];
  assert.deepEqual(conSesionAbierta(xs, ses).map(x => x.nombre), ['Aresa', 'Zimeron']);
  assert.deepEqual(conSesionAbierta(xs, []), []);
  assert.deepEqual(conSesionAbierta(xs, undefined), []);
});

// Brief B: la lista filtrada por ?sesion=abierta muestra solo esos expedientes y una pill "sesión
// abierta x" removible que devuelve a la misma ruta sin el parametro (mismo patron que las demas pills).
test('lista con sesion=abierta: solo expedientes con sesion abierta y pill removible', () => {
  const r = pintar({ tipo: 'todos', sesion: 'abierta' });
  assert.deepEqual(nombres(r), ['Aresa'], 'solo Aresa tiene sesion abierta en el fixture S()');
  const pill = buscarNodos(r, n => n.tag === 'span' && clase(n, 'pill-activo') && n.textContent.startsWith('sesión abierta'))[0];
  assert.ok(pill, 'la pill "sesión abierta x" debe pintarse');
  globalThis.location.hash = '#algo-previo';
  buscarNodos(pill, n => n.tag === 'button' && clase(n, 'quita-pill'))[0].listeners.click[0]({});
  assert.equal(globalThis.location.hash, '#operacion/expedientes?tipo=todos', 'quitar la pill vuelve a la ruta sin sesion');
  assert.equal(buscarNodos(pintar({ tipo: 'todos' }), n => n.tag === 'span' && clase(n, 'pill-activo') && n.textContent.startsWith('sesión abierta')).length, 0, 'sin el parametro no se pinta la pill');
});
