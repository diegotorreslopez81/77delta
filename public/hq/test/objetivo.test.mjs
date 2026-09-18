import test from 'node:test';
import assert from 'node:assert/strict';
function crearNodo(tag) {
  return { tag, nodeType: 1, children: [], attrs: {}, className: '', _text: '', parent: null,
    setAttribute(k, v) { this.attrs[k] = v; }, addEventListener() {},
    append(...kids) { for (const k of kids) { if (k == null) continue; k.parent = this; this.children.push(k); } },
    get textContent() { return this.children.length ? this.children.map(c => (c.nodeType === 3 ? c.data : c.textContent)).join('') : this._text; },
    set textContent(v) { this._text = v; this.children = []; } };
}
globalThis.document = { createElement: t => crearNodo(t), createTextNode: d => ({ nodeType: 3, data: d }) };
const { render, avanceFrente, avanceBloque } = await import('../app/vistas/objetivo.js');
const { derivar } = await import('../app/estado.js');
const buscarNodos = (n, pred, out = []) => { if (n.nodeType === 1) { if (pred(n)) out.push(n); n.children.forEach(c => buscarNodos(c, pred, out)); } return out; };
const datos = {
  objetivos: [{ horizonte: 2026, titulo: 'Contratado a 31 de diciembre', meta: 300000, unidad: 'EUR', contratado_eur: 20000, presentado_eur: 90000 }, { horizonte: 2027, titulo: 'Contratado', meta: 3000000, unidad: 'EUR', contratado_eur: 0, presentado_eur: 0 }],
  bloques: [{ id: 1, letra: 'A', nombre: 'Licitaciones', meta_eur: 200000, encargos_abiertos: 3, orden: 1 }],
  frentes: [{ id: 1, codigo: 'A1', linea: 'Detección y fuentes', kpi: 'Fuentes cubiertas', valor_actual: 0, meta: 17, unidad: 'CCAA', responsable: 'Ariadna', bloque_letra: 'A', encargos_abiertos: 2 }],
  encargos: [],
};
const paneles = raiz => buscarNodos(raiz, n => n.className.startsWith('panel-kpi'));
test('avance: % del KPI con tope 100 por actividad y media de las que tienen meta por línea', () => {
  assert.equal(avanceFrente({ valor_actual: 5, meta: 20 }), 25);
  assert.equal(avanceFrente({ valor_actual: 40, meta: 20 }), 100);
  assert.equal(avanceFrente({ valor_actual: 3, meta: null }), null);
  assert.equal(avanceBloque({ frentes: [{ valor_actual: 5, meta: 20 }, { valor_actual: 40, meta: 20 }, { meta: 0 }] }), 63);
  assert.equal(avanceBloque({ frentes: [] }), null);
});
test('un panel por objetivo con contratado, raya del prorrateo, desviación y presentado; 2027 sin desviación', () => {
  const raiz = crearNodo('main'); render(raiz, { datos, derivado: derivar(datos) }, undefined, {}, new Date('2026-07-02T12:00:00Z'));
  const ps = paneles(raiz);
  assert.deepEqual(ps.map(p => p.children[0].textContent), ['Objetivo 2026', 'Objetivo 2027', 'A · Licitaciones']);
  const t = ps[0].textContent;
  for (const s of ['20 k EUR', 'contratado de 300 k EUR · 7 %', '130 k EUR por debajo de lo previsto a hoy', 'a hoy tocaría 150 k EUR', 'presentado 90 k EUR']) assert.ok(t.includes(s), s);
  assert.ok(ps[0].children.some(c => String(c.html || c.innerHTML || '').includes('g-tinta')), 'raya del prorrateo');
  assert.ok(ps[1].textContent.includes('empieza a contar en 2027'));
  assert.ok(!ps[1].textContent.includes('tocaría'));
  assert.equal(raiz.children[0].textContent, 'Plan estratégico');
});
test('panel por línea: barra general, contratado frente a la meta y una barra por actividad con enlace al tablero filtrado', () => {
  const d2 = { ...datos, frentes: [...datos.frentes, { id: 2, codigo: 'A2', linea: 'Cribado', kpi: 'Leídas', valor_actual: 10, meta: 20, unidad: 'expedientes', bloque_letra: 'A', encargos_abiertos: 1 }, { id: 3, codigo: 'A3', linea: 'Sin KPI', bloque_letra: 'A', encargos_abiertos: 0 }] };
  const raiz = crearNodo('main'); render(raiz, { datos: d2, derivado: derivar(d2) }, undefined, {}, new Date('2026-07-02T12:00:00Z'));
  const pb = paneles(raiz)[2], t = pb.textContent;
  for (const s of ['25 %', 'media de 2 de 3 actividades', 'Línea A · general', 'Contratado frente a la meta de la línea', '0 EUR de 200 k EUR', 'A1 · Detección y fuentes', '0 CCAA / 17 CCAA · 0 %', '10 expedientes / 20 expedientes · 50 %', 'sin meta', '3 encargos abiertos']) assert.ok(t.includes(s), s);
  const hrefs = buscarNodos(pb, n => n.tag === 'a' && String(n.attrs.href || '').includes('frente=')).map(a => a.attrs.href);
  assert.deepEqual(hrefs, ['#operacion/tablero?frente=A1', '#operacion/tablero?frente=A2', '#operacion/tablero?frente=A3']);
});
test('sin datos: aviso de plan vacío', () => {
  const raiz = crearNodo('main'); render(raiz, { datos: {}, derivado: undefined });
  assert.ok(raiz.textContent.includes('Sin objetivos ni líneas'));
});
