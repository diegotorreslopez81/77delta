import test from 'node:test';
import assert from 'node:assert/strict';

// vistas/licitaciones.js solo importa ui.js y licitaciones.js (ninguno de los dos toca document/window
// al importarse: ui.js solo lo hace dentro de sus funciones, ver comentario de ui.test.mjs), asi que un
// import estatico normal basta, sin el import() dinamico que si hace falta en decisiones.test.mjs o
// expedientes.test.mjs (que arrastran la cadena api.js/main.js). Mismo shim con recorrido de hijos que
// esos dos ficheros, para poder buscar nodos anidados con buscarNodos().
function crearNodo(tag) {
  const n = {
    tag, nodeType: 1, children: [], attrs: {}, className: '', _text: '', _html: '', listeners: {}, parent: null,
    classList: { toggle(c, on) { const s = new Set(this._n.className.split(' ').filter(Boolean)); on ? s.add(c) : s.delete(c); this._n.className = [...s].join(' '); return on; }, contains(c) { return this._n.className.split(' ').includes(c); }, add(c) { this.toggle(c, true); }, remove(c) { this.toggle(c, false); } },
    setAttribute(k, v) { this.attrs[k] = v; },
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
};

const { render, diasA, plazo, plazoConsumido, porFiltro, ordenar, buscar, tarjetaLic } = await import('../app/vistas/licitaciones.js');

const buscarNodos = (n, pred, out = []) => { if (n.nodeType === 1) { if (pred(n)) out.push(n); n.children.forEach(c => buscarNodos(c, pred, out)); } return out; };
const clase = (n, c) => n.className.split(' ').includes(c);
const h2s = raiz => buscarNodos(raiz, n => n.tag === 'h2');
const paneles = raiz => buscarNodos(raiz, n => n.tag === 'section' && clase(n, 'panel-kpi'));
const panel = (raiz, t) => paneles(raiz).find(p => p.children[0].textContent === t);
const filaDe = (raiz, et) => buscarNodos(panel(raiz, 'Embudo'), n => clase(n, 'fila-barra')).find(f => f.children[0].textContent === et);
const tarjetas = raiz => buscarNodos(raiz, n => n.tag === 'article' && clase(n, 'tarjeta-lic'));
const codigos = raiz => tarjetas(raiz).map(t => buscarNodos(t, n => clase(n, 'codigo'))[0].textContent);
const chips = raiz => buscarNodos(raiz, n => n.tag === 'a' && clase(n, 'chip'));
const grupos = raiz => buscarNodos(raiz, n => n.tag === 'details' && clase(n, 'grupo-criba'));
const raizVacia = () => crearNodo('main');

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

test('cuadro: cinco paneles en orden, cada uno con su enlace', () => {
  const raiz = pintar({ licitaciones: lics });
  assert.deepEqual(paneles(raiz).map(p => p.children[0].textContent), ['Pipeline activo', 'Embudo', 'Por estado', 'Por decidir', 'Próximos cierres']);
  assert.deepEqual(paneles(raiz).map(p => p.children[0].children[0].attrs.href), ['#operacion/licitaciones?estado=activas', '#operacion/licitaciones', '#operacion/licitaciones', '#reglas/decisiones', '#operacion/licitaciones?estado=activas']);
});

test('Pipeline activo: suma de aprobadas y presentadas sin IVA y barras por mes de cierre', () => {
  const p = panel(pintar({ licitaciones: lics }), 'Pipeline activo');
  assert.ok(p.textContent.includes('55 k EUR1 aprobadas · 1 presentadas · sin IVA'), p.textContent);
  assert.match(buscarNodos(p, n => clase(n, 'graf'))[0].innerHTML, /^<svg viewBox="0 0 100 60"/);
  assert.match(p.className, /ancho-2/);
});

test('Embudo: filas con barra, Por decidir cuenta L1 y L2, presentadas en oro, Detectadas desde lic_resumen', () => {
  const raiz = pintar({ licitaciones: lics, lic_resumen: { total: { n: 1500, eur: 9 } }, kpis: { 'lic.tasa_exito': { valor: 12 } } });
  assert.equal(filaDe(raiz, 'Por decidir').children[1].textContent, '2');
  assert.equal(filaDe(raiz, 'Detectadas').children[1].textContent, '1500');
  assert.match(filaDe(raiz, 'Presentadas').children[2].innerHTML, /g-oro/);
  assert.ok(panel(raiz, 'Embudo').textContent.includes('tasa de éxito 12 %'));
  assert.equal(filaDe(raiz, 'Contratadas'), undefined); // a 0 no se pinta
});

test('Por estado: donut con un arco por estado presente y el total en el centro', () => {
  const p = panel(pintar({ licitaciones: lics }), 'Por estado');
  assert.equal((buscarNodos(p, n => clase(n, 'graf'))[0].innerHTML.match(/stroke-dasharray/g) || []).length, 4);
  assert.equal(buscarNodos(p, n => clase(n, 'centro'))[0].textContent, '7');
});

test('Por decidir y Próximos cierres: cifra, alerta y lista corta', () => {
  const raiz = pintar({ licitaciones: lics });
  const pd = panel(raiz, 'Por decidir');
  assert.match(pd.className, /alerta/);
  assert.ok(pd.textContent.startsWith('Por decidir230 k EUR sin IVA en juego'), pd.textContent);
  const pc = panel(raiz, 'Próximos cierres');
  assert.ok(pc.textContent.startsWith('Próximos cierres13 d'), pc.textContent);
  assert.ok(!/alerta/.test(pc.className));
});

test('filtros: activas por defecto, ordenadas por cierre, chips con recuento y enlace que conserva el orden', () => {
  const raiz = pintar({ licitaciones: lics });
  assert.deepEqual(codigos(raiz), ['L7', 'L6']);
  assert.deepEqual(chips(raiz).map(c => [c.textContent, c.attrs.href, clase(c, 'activo')]), [
    ['Activas 2', '#operacion/licitaciones?estado=activas', true], ['Por decidir 2', '#operacion/licitaciones?estado=decidir', false],
    ['Pausadas 0', '#operacion/licitaciones?estado=pausadas', false], ['En criba 3', '#operacion/licitaciones?estado=criba', false],
    ['por cierre', '#operacion/licitaciones?estado=activas', true], ['por importe', '#operacion/licitaciones?estado=activas&orden=importe', false]]);
  assert.deepEqual(codigos(pintar({ licitaciones: lics }, { orden: 'importe' })), ['L6', 'L7']);
  assert.deepEqual(codigos(pintar({ licitaciones: lics }, { estado: 'raro' })), ['L7', 'L6']);
});

test('filtros: por decidir con enlace Decidir; en criba agrupada por elegible, la mayor abierta, Perfil solo con http', () => {
  const dec = pintar({ licitaciones: lics }, { estado: 'decidir' });
  assert.deepEqual(codigos(dec), ['L2', 'L1']);
  assert.ok(tarjetas(dec).every(t => buscarNodos(t, n => n.tag === 'a' && n.textContent === 'Decidir').length === 1));
  const cri = pintar({ licitaciones: lics }, { estado: 'criba' });
  const gs = buscarNodos(cri, n => n.tag === 'details');
  assert.deepEqual(gs.map(g => g.children[0].textContent), ['Revisar (2)', 'No viable (1)']);
  assert.equal(gs[0].attrs.open, '');
  assert.equal(gs[1].attrs.open, undefined);
  const perfiles = buscarNodos(cri, n => n.tag === 'a' && n.textContent === 'Perfil');
  assert.deepEqual(perfiles.map(a => a.attrs.href), ['https://perfil.example.com/l3']);
  assert.equal(tarjetas(cri).length, 0);
});

test('buscador: filtra la lista sin acentos por expediente, objeto u órgano, y avisa si no queda nada', () => {
  const raiz = pintar({ licitaciones: lics });
  const input = buscarNodos(raiz, n => n.tag === 'input')[0];
  input.listeners.input[0]({ target: { value: 'l6' } });
  assert.deepEqual(codigos(raiz), ['L6']);
  input.listeners.input[0]({ target: { value: 'zzz' } });
  assert.ok(raiz.textContent.includes('nada con este filtro'));
});

test('tarjetaLic: estado, código, plazo con semáforo, importe, órgano, barra de plazo, solvencia y enlaces seguros', () => {
  const t = tarjetaLic({ expediente: 'X1', estado: 'Aprobada', decision: 'OK', cierre: '2026-09-20', importe: '227990', resumen_corto: 'Plataforma', organo: 'Ajuntament', provincia: 'Barcelona',
    detectada: '2026-09-07T00:00:00Z', solvencia: 'Clasificación no exigida', enlace: 'https://perfil/x', carpeta: 'https://drive/x', ppt: 'javascript:alert(1)', pcap: 'https://pcap/x' }, AHORA);
  const txt = t.textContent;
  for (const x of ['Aprobada', 'X1', 'cierra en 3 d', 'Plataforma', 'Ajuntament · Barcelona', '228 k EUR', 'sin IVA', 'decisión OK', '80 % del plazo consumido', 'Solvencia: Clasificación no exigida']) assert.ok(txt.includes(x), x);
  assert.match(buscarNodos(t, n => clase(n, 'plazo'))[0].children[0].className, /g-rojo/);
  assert.deepEqual(buscarNodos(t, n => n.tag === 'a').map(a => [a.textContent, a.attrs.href]), [['Perfil', 'https://perfil/x'], ['Carpeta', 'https://drive/x'], ['PCAP', 'https://pcap/x']]);
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

test('porFiltro, ordenar y buscar: funciones puras', () => {
  assert.deepEqual(porFiltro([{ estado: 'Pausada', expediente: 'P' }, { estado: 'Aprobada' }], 'pausadas').map(l => l.expediente), ['P']);
  assert.deepEqual(ordenar([{ expediente: 'a', importe: '1' }, { expediente: 'b', importe: '9' }], 'importe').map(l => l.expediente), ['b', 'a']);
  assert.deepEqual(buscar([{ organo: 'Ajuntament de Badalona' }, { organo: 'Calonge' }], 'BADALONA').length, 1);
  assert.equal(buscar(lics, '  ').length, lics.length);
});

test('sin licitaciones ni resumen: pinta "sin licitaciones" y nada mas', () => {
  const raiz = pintar({ licitaciones: [], lic_resumen: {} });
  assert.equal(raiz.textContent, 'sin licitaciones');
  assert.equal(h2s(raiz).length, 0);
  assert.equal(pintar({}).textContent, 'sin licitaciones');
});

test('sin licitaciones pero con lic_resumen: cuadro con el embudo del resumen y lista vacía', () => {
  const raiz = pintar({ licitaciones: [], lic_resumen: { total: { n: 1500, eur: 9000000 }, contratadas: { n: 20, eur: 200000 } } });
  assert.equal(paneles(raiz).length, 5);
  assert.equal(filaDe(raiz, 'Detectadas').children[1].textContent, '1500');
  assert.equal(filaDe(raiz, 'Contratadas').children[1].textContent, '20');
  assert.ok(raiz.textContent.includes('nada con este filtro'));
});
