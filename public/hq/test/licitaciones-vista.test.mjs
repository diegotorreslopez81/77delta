import test from 'node:test';
import assert from 'node:assert/strict';

// vistas/licitaciones.js solo importa ui.js y licitaciones.js (ninguno de los dos toca document/window
// al importarse: ui.js solo lo hace dentro de sus funciones, ver comentario de ui.test.mjs), asi que un
// import estatico normal basta, sin el import() dinamico que si hace falta en decisiones.test.mjs o
// expedientes.test.mjs (que arrastran la cadena api.js/main.js). Mismo shim con recorrido de hijos que
// esos dos ficheros, para poder buscar nodos anidados con buscarNodos(). getAttribute se anade en la
// tanda de tarjetas ricas (#1057): tarjetaLic() lee aria-expanded de vuelta para alternarlo.
function crearNodo(tag) {
  const n = {
    tag, nodeType: 1, children: [], attrs: {}, className: '', _text: '', _html: '', listeners: {}, parent: null,
    classList: { toggle(c, on) { const s = new Set(this._n.className.split(' ').filter(Boolean)); on ? s.add(c) : s.delete(c); this._n.className = [...s].join(' '); return on; }, contains(c) { return this._n.className.split(' ').includes(c); }, add(c) { this.toggle(c, true); }, remove(c) { this.toggle(c, false); } },
    setAttribute(k, v) { this.attrs[k] = v; },
    getAttribute(k) { return this.attrs[k] ?? null; },
    addEventListener(ev, fn) { (this.listeners[ev] ||= []).push(fn); },
    append(...kids) { for (const k of kids) { if (k == null) continue; k.parent = this; this.children.push(k); } },
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
  body: crearNodo('body'),
  addEventListener() {}, removeEventListener() {},
};
globalThis.location = { hash: '' };

const { render, diasA, plazo, plazoConsumido, porEstado, estadoChip, estadoPorDefecto, ordenar, buscar, tarjetaLic, usarCargador } = await import('../app/vistas/licitaciones.js');
// La pestana 'descartadas' pide las filas al servidor tras pintar el payload (#1063): en los tests no hay
// red ni api.js, asi que el cargador por defecto se sustituye por uno mudo (null = no repintar).
usarCargador(async () => null);

const buscarNodos = (n, pred, out = []) => { if (n.nodeType === 1) { if (pred(n)) out.push(n); n.children.forEach(c => buscarNodos(c, pred, out)); } return out; };
const clase = (n, c) => n.className.split(' ').includes(c);
const tarjetas = raiz => buscarNodos(raiz, n => n.tag === 'article' && clase(n, 'card-lic'));
const expedientes = raiz => tarjetas(raiz).map(t => t.attrs['data-expediente']);
const chips = raiz => buscarNodos(raiz, n => n.tag === 'a' && clase(n, 'chip'));
const selects = raiz => buscarNodos(raiz, n => n.tag === 'select');
const raizVacia = () => crearNodo('main');
// 2.0.20: los filtros viven en la hoja (app/filtros.js), que se pinta dentro de la misma raiz.
const fab = raiz => buscarNodos(raiz, n => clase(n, 'fab-filtros'))[0];
const seccion = (raiz, titulo) => buscarNodos(raiz, n => n.tag === 'section' && clase(n, 'hoja-seccion')).find(s2 => s2.children[0].textContent === titulo);
const chipsHoja = (raiz, titulo) => { const s2 = seccion(raiz, titulo); return s2 ? buscarNodos(s2, n => n.tag === 'button' && clase(n, 'chip')) : []; };
const buscadorHoja = raiz => buscarNodos(raiz, n => n.tag === 'input' && clase(n, 'hoja-buscar'))[0];
const botonVer = raiz => buscarNodos(raiz, n => n.tag === 'button' && clase(n, 'primario'))[0];
const pillsX = raiz => buscarNodos(raiz, n => n.tag === 'span' && clase(n, 'pill-activo')).map(n => n.textContent);
const abrirHoja = raiz => { fab(raiz).listeners.click[0]({}); };

const lics = [
  { expediente: 'L1', elegible: 'Probable', estado: 'Nueva', decision: null, cierre: '2026-10-05', importe: '10000', resumen_corto: 'Resumen L1', objeto: 'Objeto L1' },
  { expediente: 'L2', elegible: 'Dudosa', estado: 'Por decidir', decision: '', cierre: '2026-09-20', importe: '20000', resumen_corto: 'Resumen L2', objeto: 'Objeto L2' },
  { expediente: 'L3', elegible: 'Revisar', estado: 'Nueva', decision: null, cierre: '2026-09-22', importe: '5000', resumen_corto: 'Resumen L3', objeto: 'Objeto L3', enlace: 'https://perfil.example.com/l3' },
  { expediente: 'L4', elegible: 'No viable', estado: 'Nueva', decision: null, cierre: null, importe: null, resumen_corto: '', objeto: 'Objeto L4' },
  { expediente: 'L5', elegible: 'Revisar', estado: 'Por decidir', decision: 'Pendiente', cierre: '2026-09-18', importe: '3000', resumen_corto: 'Resumen L5', objeto: 'Objeto L5', enlace: 'javascript:alert(1)' },
  { expediente: 'L6', elegible: 'Probable', estado: 'Aprobada', decision: 'OK', cierre: '2026-09-30', importe: '40000', resumen_corto: 'Resumen L6', objeto: 'Objeto L6' },
  { expediente: 'L7', elegible: null, estado: 'Presentada', decision: 'OK', cierre: '2026-09-15', importe: '15000', resumen_corto: 'Resumen L7', objeto: 'Objeto L7' },
];
const AHORA = new Date('2026-09-17T10:00:00Z');
const pintar = (datos, filtros = {}) => { const raiz = raizVacia(); render(raiz, { datos }, undefined, filtros, AHORA); return raiz; };

test('render: enlace a KPIs arriba, sin el cuadro de paneles de antes', () => {
  const raiz = pintar({ licitaciones: lics });
  const kpi = buscarNodos(raiz, n => n.tag === 'a' && n.attrs.href === '#kpis?grupo=licitaciones')[0];
  assert.ok(kpi && kpi.textContent.includes('KPIs'));
  assert.equal(buscarNodos(raiz, n => (n.className || '').includes('cuadro')).length, 0);
  assert.equal(buscarNodos(raiz, n => n.tag === 'section' && clase(n, 'panel-kpi')).length, 0);
});

// 2.0.20: chips del embudo (uno por estado), defecto 'decidir' y alias de las rutas viejas.
test('embudo: siete chips con recuento, por decidir por defecto y alias de las rutas viejas', () => {
  const raiz = pintar({ licitaciones: lics });
  assert.deepEqual(expedientes(raiz), ['L5', 'L2']);
  assert.deepEqual(chips(raiz).map(c => [c.textContent, c.attrs.href, clase(c, 'activo')]), [
    ['Nuevas 3', '#operacion/licitaciones?estado=nuevas', false],
    ['Por decidir 2', '#operacion/licitaciones?estado=decidir', true],
    ['Aprobadas 1', '#operacion/licitaciones?estado=aprobadas', false],
    ['En redacción 0', '#operacion/licitaciones?estado=redaccion', false],
    ['Presentadas 1', '#operacion/licitaciones?estado=presentadas', false],
    ['Pausadas 0', '#operacion/licitaciones?estado=pausadas', false],
    ['Descartadas 0', '#operacion/licitaciones?estado=descartadas', false]]);
  assert.deepEqual(expedientes(pintar({ licitaciones: lics }, { estado: 'activas' })), ['L6']);
  assert.deepEqual(expedientes(pintar({ licitaciones: lics }, { estado: 'aprobadas', orden: 'importe' })), ['L6']);
  assert.deepEqual(expedientes(pintar({ licitaciones: lics }, { estado: 'raro' })), ['L5', 'L2']);
  assert.equal(estadoChip('criba'), 'nuevas');
  assert.equal(estadoChip('activas'), 'aprobadas');
  assert.equal(estadoChip('descartadas'), 'descartadas');
  assert.equal(estadoChip('loquesea'), '');
  // 'Analizada' cae bajo 'Por decidir'.
  assert.equal(porEstado([{ estado: 'Analizada' }, { estado: 'Por decidir' }, { estado: 'Nueva' }], 'decidir').length, 2);
  assert.equal(estadoPorDefecto([{ estado: 'Analizada' }]), 'decidir');
  assert.equal(estadoPorDefecto([{ estado: 'En redacción' }, { estado: 'Nueva' }]), 'redaccion');
  assert.equal(estadoPorDefecto([{ estado: 'Nueva' }]), 'aprobadas');
  assert.equal(estadoPorDefecto([]), 'aprobadas');
});

test('filtros: por decidir con enlace Decidir; nuevas agrupadas por elegible, la mayor abierta, Perfil solo con http', () => {
  const dec = pintar({ licitaciones: lics }, { estado: 'decidir' });
  assert.deepEqual(expedientes(dec), ['L5', 'L2']);
  // El enlace Decidir sigue siendo solo para las decidibles (Probable/Dudosa), no para todo el chip.
  assert.deepEqual(tarjetas(dec).map(t => buscarNodos(t, n => n.tag === 'a' && n.textContent === 'Decidir').length), [0, 1]);
  const cri = pintar({ licitaciones: lics }, { estado: 'criba' });
  const gs = buscarNodos(cri, n => n.tag === 'details');
  assert.deepEqual(gs.map(g => g.children[0].textContent), ['Revisar (1)', 'Probable (1)', 'No viable (1)']);
  assert.equal(gs[0].attrs.open, '');
  assert.equal(gs[1].attrs.open, undefined);
  const perfiles = buscarNodos(cri, n => n.tag === 'a' && n.textContent === 'Perfil');
  assert.deepEqual(perfiles.map(a => a.attrs.href), ['https://perfil.example.com/l3']);
  assert.equal(tarjetas(cri).length, 0);
});

test('hoja: el FAB con el globo de filtros activos, las secciones en orden y las pills con x encima de la lista', () => {
  const raiz = pintar({ licitaciones: lics.map(l => ({ ...l, pestana: 'PLACSP', tipo: 'servicios' })) }, { tipologia: 'Estatal', presencial: 'no' });
  assert.equal(selects(raiz).length, 0, 'los selects de filtros desaparecen');
  const b = fab(raiz);
  assert.equal(b.attrs['aria-label'], 'Filtros');
  assert.equal(b.children.at(-1).textContent, '2');
  assert.equal(b.children.at(-1).hidden, false);
  assert.deepEqual(buscarNodos(raiz, n => n.tag === 'section' && clase(n, 'hoja-seccion')).map(s2 => s2.children[0].textContent),
    ['Estado', 'Orden', 'Tipología', 'Solvencia', 'Tipo', 'Presencial']);
  assert.deepEqual(pillsX(raiz), ['Tipología: Estatal×', 'Presencial: Sin presencia×']);
  // El estado del embudo y el orden por defecto no cuentan como filtro activo.
  assert.equal(fab(pintar({ licitaciones: lics })).children.at(-1).hidden, true);
  // Motivo de NO solo con descartadas; fuente y desiertas solo por ruta, como pill.
  const des = pintar({ licitaciones: [{ expediente: 'D1', estado: 'Descartada', motivos: ['Sin pliego'], pestana: 'PLACSP' }] }, { estado: 'descartadas', fuente: 'PLACSP', desiertas: '1' });
  assert.ok(seccion(des, 'Motivo de NO'));
  assert.equal(seccion(des, 'Fuente'), undefined);
  assert.deepEqual(pillsX(des), ['Fuente: PLACSP×', 'Desiertas: Solo desiertas×']);
});

test('hoja: elegir un chip recuenta en vivo y "Ver N resultados" escribe la ruta; la x quita ese filtro', () => {
  const raiz = pintar({ licitaciones: lics }, { estado: 'nuevas' });
  abrirHoja(raiz);
  assert.equal(botonVer(raiz).textContent, 'Ver 3 resultados');
  const chipDe = (titulo, texto) => chipsHoja(raiz, titulo).find(c => c.textContent === texto);
  chipDe('Orden', 'Importe').listeners.click[0]({});
  // La hoja se repinta en cada toque, hay que volver a buscar el chip.
  assert.equal(chipDe('Orden', 'Importe').attrs['aria-pressed'], 'true');
  chipDe('Presencial', 'Requiere presencia').listeners.click[0]({});
  assert.equal(botonVer(raiz).textContent, 'Ver 0 resultados');
  chipDe('Presencial', 'Requiere presencia').listeners.click[0]({});
  assert.equal(botonVer(raiz).textContent, 'Ver 3 resultados', 'tocar el chip activo lo quita');
  globalThis.location.hash = '';
  botonVer(raiz).listeners.click[0]({});
  assert.equal(globalThis.location.hash, '#operacion/licitaciones?estado=nuevas&orden=importe');
  const conPill = pintar({ licitaciones: lics.map(l => ({ ...l, tipo: 'servicios' })) }, { estado: 'nuevas', tipo: 'servicios' });
  buscarNodos(conPill, n => n.tag === 'button' && clase(n, 'quita-pill'))[0].listeners.click[0]({});
  assert.equal(globalThis.location.hash, '#operacion/licitaciones?estado=nuevas');
});

test('buscador de la hoja: recuenta en vivo, viaja en la ruta y avisa si no queda nada', () => {
  const raiz = pintar({ licitaciones: lics }, { estado: 'aprobadas' });
  const input = buscadorHoja(raiz);
  assert.equal(input.attrs.autocapitalize, 'off');
  assert.equal(input.attrs.placeholder, 'Buscar en la lista');
  input.listeners.input[0]({ target: { value: 'l6' } });
  assert.equal(botonVer(raiz).textContent, 'Ver 1 resultado');
  globalThis.location.hash = '';
  botonVer(raiz).listeners.click[0]({});
  assert.equal(globalThis.location.hash, '#operacion/licitaciones?estado=aprobadas&texto=l6');
  assert.deepEqual(expedientes(pintar({ licitaciones: lics }, { estado: 'aprobadas', texto: 'l6' })), ['L6']);
  assert.ok(pintar({ licitaciones: lics }, { estado: 'aprobadas', texto: 'zzz' }).textContent.includes('nada con este filtro'));
});

test('hoja: la seccion Tipo solo aparece si el payload trae tipos', () => {
  assert.equal(seccion(pintar({ licitaciones: lics }), 'Tipo'), undefined);
  assert.ok(seccion(pintar({ licitaciones: lics.map(l => ({ ...l, tipo: 'servicios' })) }), 'Tipo'));
});

test('filtro de tipologia desde la ruta se aplica a la lista de tarjetas', () => {
  const conOrgano = lics.map(l => ({ ...l, organo: l.expediente === 'L6' ? 'Ministerio de Hacienda' : 'Ajuntament de Girona' }));
  assert.deepEqual(expedientes(pintar({ licitaciones: conOrgano }, { estado: 'aprobadas', tipologia: 'Estatal' })), ['L6']);
  assert.deepEqual(expedientes(pintar({ licitaciones: conOrgano }, { estado: 'aprobadas', tipologia: 'Ayuntamiento' })), []);
  assert.deepEqual(expedientes(pintar({ licitaciones: conOrgano }, { estado: 'presentadas', tipologia: 'Ayuntamiento' })), ['L7']);
});

test('tarjetaLic: colapsada por defecto con etiquetas, título y órgano; el detalle trae objeto, expediente, solvencia y enlaces seguros', () => {
  const l = { expediente: 'X1', estado: 'Aprobada', decision: 'OK', cierre: '2026-09-20', importe: '227990', resumen_corto: 'Plataforma', objeto: 'Plataforma de gestión documental',
    organo: 'Ajuntament', provincia: 'Barcelona', solvencia: 'Clasificación no exigida',
    enlace: 'https://perfil/x', carpeta: 'https://drive/x', ppt: 'javascript:alert(1)', pcap: 'https://pcap/x' };
  const t = tarjetaLic(l, AHORA);
  assert.equal(t.attrs['aria-expanded'], 'false');
  assert.equal(t.attrs['data-expediente'], 'X1');
  const txt = t.textContent;
  for (const x of ['Aprobada', 'Ayuntamiento', 'cierra en 3 d', 'Plataforma', 'Ajuntament · Barcelona', '228 k EUR', 'sin IVA',
    'Plataforma de gestión documental', 'Expediente X1', 'Solvencia: Clasificación no exigida', 'Decisión: OK']) assert.ok(txt.includes(x), x);
  assert.match(buscarNodos(t, n => clase(n, 'plazo'))[0].children[0].className, /g-rojo/);
  assert.deepEqual(buscarNodos(t, n => n.tag === 'a').map(a => [a.textContent, a.attrs.href]), [['Perfil', 'https://perfil/x'], ['Carpeta', 'https://drive/x'], ['PCAP', 'https://pcap/x']]);
});

test('tarjetaLic: clic o Intro/espacio alterna aria-expanded; un clic en un enlace interno no lo toca', () => {
  const t = tarjetaLic({ expediente: 'X2', estado: 'Nueva', cierre: '2026-09-30' }, AHORA);
  assert.equal(t.attrs['aria-expanded'], 'false');
  t.listeners.click[0]({ target: t });
  assert.equal(t.attrs['aria-expanded'], 'true');
  t.listeners.click[0]({ target: t });
  assert.equal(t.attrs['aria-expanded'], 'false');
  t.listeners.keydown[0]({ key: 'Enter', target: t });
  assert.equal(t.attrs['aria-expanded'], 'true');
  const enlace = crearNodo('a');
  t.listeners.click[0]({ target: { closest: () => enlace } });
  assert.equal(t.attrs['aria-expanded'], 'true', 'un clic sobre un enlace interno no debe alternar la tarjeta');
});

// Motivos de NO en la tarjeta (#1063): mismo tag 'pill' neutro que tipo/procedimiento, nunca oro.
test('tarjetaLic: descartada con motivos de NO muestra un tag por motivo', () => {
  const t = tarjetaLic({ expediente: 'D1', estado: 'Descartada', motivos: ['Sin pliego', 'Plazo corto'] }, AHORA);
  const tags = buscarNodos(t, n => n.tag === 'span' && clase(n, 'pill')).map(n => n.textContent);
  assert.ok(tags.includes('Sin pliego'));
  assert.ok(tags.includes('Plazo corto'));
  assert.ok(!tags.includes('sin motivo'));
});

test('tarjetaLic: descartada sin motivo del catalogo muestra el tag "sin motivo"', () => {
  const t = tarjetaLic({ expediente: 'D2', estado: 'Descartada', motivos: [] }, AHORA);
  assert.ok(buscarNodos(t, n => n.tag === 'span' && clase(n, 'pill')).map(n => n.textContent).includes('sin motivo'));
  const t2 = tarjetaLic({ expediente: 'D3', estado: 'Descartada' }, AHORA);
  assert.ok(buscarNodos(t2, n => n.tag === 'span' && clase(n, 'pill')).map(n => n.textContent).includes('sin motivo'));
});

test('tarjetaLic: aprobada con motivos de SI no muestra tags de NO ni "sin motivo"', () => {
  const t = tarjetaLic({ expediente: 'A1', estado: 'Aprobada', decision: 'OK', motivos: ['Buen encaje', 'Cliente conocido'] }, AHORA);
  const tags = buscarNodos(t, n => n.tag === 'span' && clase(n, 'pill')).map(n => n.textContent);
  assert.ok(!tags.includes('Buen encaje'));
  assert.ok(!tags.includes('Cliente conocido'));
  assert.ok(!tags.includes('sin motivo'));
});

test('hoja "Motivo de NO": catalogo + Sin motivo, filtra la lista de descartadas', () => {
  const conMotivos = [
    { expediente: 'D1', estado: 'Descartada', motivos: ['Sin pliego'] },
    { expediente: 'D2', estado: 'Descartada: solo viable en UTE', motivos: [] },
  ];
  const raiz = pintar({ licitaciones: conMotivos }, { estado: 'descartadas' });
  const opts = chipsHoja(raiz, 'Motivo de NO').map(c => c.textContent);
  assert.equal(opts[0], 'Fuera de España');
  assert.ok(opts.includes('Sin pliego'));
  assert.equal(opts.at(-1), 'Sin motivo');
  assert.equal(opts.length, 11);
  assert.deepEqual(expedientes(pintar({ licitaciones: conMotivos }, { estado: 'descartadas', motivo: 'Sin pliego' })), ['D1']);
  // El estado sucio del Sheet cuenta como Descartada sin motivo del catalogo.
  assert.deepEqual(expedientes(pintar({ licitaciones: conMotivos }, { estado: 'descartadas', motivo: 'sin' })), ['D2']);
});

test('descartadas: tras pintar el payload, la lista se repinta con las filas del servidor (cargador) y se cachea en S', async () => {
  const llamadas = [];
  usarCargador(async motivo => { llamadas.push(motivo); return [
    { expediente: 'S1', estado: 'Descartada', motivos: ['Sin pliego'], motivo_texto: 'sin pliego en el perfil' },
    { expediente: 'S2', estado: 'Descartada', motivos: ['Sin pliego', 'Plazo corto'] },
  ]; });
  try {
    const S = { datos: { licitaciones: [{ expediente: 'D1', estado: 'Descartada', motivos: ['Sin pliego'] }] } };
    const raiz = raizVacia();
    const p = render(raiz, S, undefined, { estado: 'descartadas', motivo: 'Sin pliego' }, AHORA);
    assert.deepEqual(expedientes(raiz), ['D1']);
    assert.ok(raiz.textContent.includes('cargando descartadas'));
    await p;
    assert.deepEqual(expedientes(raiz), ['S1', 'S2']);
    assert.ok(!raiz.textContent.includes('cargando descartadas'));
    assert.deepEqual(llamadas, ['Sin pliego']);
    assert.equal(S.cacheDescartadas.clave, 'Sin pliego');
    assert.equal(S.cacheDescartadas.rows.length, 2);
    // Segundo render con el mismo filtro: sale de la cache, sin llamar al servidor.
    const raiz2 = raizVacia();
    render(raiz2, S, undefined, { estado: 'descartadas', motivo: 'Sin pliego' }, AHORA);
    assert.deepEqual(expedientes(raiz2), ['S1', 'S2']);
    assert.deepEqual(llamadas, ['Sin pliego']);
    // Otra pestana no toca el cargador.
    render(raizVacia(), S, undefined, { estado: 'decidir' }, AHORA);
    assert.deepEqual(llamadas, ['Sin pliego']);
  } finally { usarCargador(async () => null); }
});

test('descartadas: si el cargador falla, el payload se queda y se avisa en mudo', async () => {
  usarCargador(async () => { throw new Error('red'); });
  try {
    const raiz = raizVacia();
    await render(raiz, { datos: { licitaciones: [{ expediente: 'D1', estado: 'Descartada', motivos: [] }] } }, undefined, { estado: 'descartadas' }, AHORA);
    assert.deepEqual(expedientes(raiz), ['D1']);
    assert.ok(raiz.textContent.includes('no se pudieron cargar las descartadas'));
  } finally { usarCargador(async () => null); }
});

test('hoja: el chip de motivo persiste en la URL junto al resto de filtros activos', () => {
  globalThis.location.hash = '';
  const raiz = pintar({ licitaciones: [{ expediente: 'D1', estado: 'Descartada', motivos: ['Sin pliego'] }] }, { estado: 'descartadas', tipologia: 'Estatal' });
  chipsHoja(raiz, 'Motivo de NO').find(c => c.textContent === 'Sin pliego').listeners.click[0]({});
  botonVer(raiz).listeners.click[0]({});
  assert.equal(globalThis.location.hash, '#operacion/licitaciones?estado=descartadas&tipologia=Estatal&motivo=Sin+pliego');
});

test('diasA, plazo y plazoConsumido: bordes', () => {
  assert.equal(diasA(null, AHORA), null);
  assert.equal(diasA('2026-09-17T23:00:00Z', AHORA), 0);
  assert.deepEqual(plazo('2026-09-15', AHORA), { d: -2, color: 'neutro-2', texto: 'cerró hace 2 d' });
  assert.equal(plazo('2026-09-17', AHORA).texto, 'cierra hoy');
  assert.equal(plazo('2026-09-28', AHORA).color, 'ambar');
  assert.equal(plazo('2026-10-28', AHORA).color, 'verde');
  assert.equal(plazoConsumido({ cierre: '2026-09-20' }, AHORA), null);
  assert.equal(plazoConsumido({ detectada: '2026-09-01', cierre: '2026-09-10' }, AHORA), 100);
});

test('porEstado, ordenar y buscar: funciones puras', () => {
  assert.deepEqual(porEstado([{ estado: 'Pausada', expediente: 'P' }, { estado: 'Aprobada' }], 'pausadas').map(l => l.expediente), ['P']);
  assert.deepEqual(ordenar([{ expediente: 'a', importe: '1' }, { expediente: 'b', importe: '9' }], 'importe').map(l => l.expediente), ['b', 'a']);
  assert.deepEqual(buscar([{ organo: 'Ajuntament de Badalona' }, { organo: 'Calonge' }], 'BADALONA').length, 1);
  assert.equal(buscar(lics, '  ').length, lics.length);
});

test('sin licitaciones ni resumen: pinta "sin licitaciones" y nada mas', () => {
  const raiz = pintar({ licitaciones: [], lic_resumen: {} });
  assert.equal(raiz.textContent, 'sin licitaciones');
  assert.equal(pintar({}).textContent, 'sin licitaciones');
});

test('sin licitaciones pero con lic_resumen: enlace a KPIs y lista vacía, con el FAB y sin secciones de fuente ni tipo', () => {
  const raiz = pintar({ licitaciones: [], lic_resumen: { total: { n: 1500, eur: 9000000 }, contratadas: { n: 20, eur: 200000 } } });
  assert.ok(buscarNodos(raiz, n => n.tag === 'a' && n.attrs.href === '#kpis?grupo=licitaciones').length === 1);
  assert.equal(selects(raiz).length, 0);
  assert.ok(fab(raiz));
  assert.ok(raiz.textContent.includes('nada con este filtro'));
});
