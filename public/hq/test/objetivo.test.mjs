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
const { render } = await import('../app/vistas/objetivo.js');
const { derivar } = await import('../app/estado.js');
const buscarNodos = (n, pred, out = []) => { if (n.nodeType === 1) { if (pred(n)) out.push(n); n.children.forEach(c => buscarNodos(c, pred, out)); } return out; };
const datos = {
  objetivos: [{ horizonte: 2026, titulo: 'Contratado a 31 de diciembre', meta: 300000, unidad: 'EUR', contratado_eur: 20000, presentado_eur: 90000 }, { horizonte: 2027, titulo: 'Contratado', meta: 3000000, unidad: 'EUR', contratado_eur: 0, presentado_eur: 0 }],
  bloques: [{ id: 1, letra: 'A', nombre: 'Licitaciones', meta_eur: 200000, encargos_abiertos: 3, orden: 1 }],
  frentes: [{ id: 1, codigo: 'A1', linea: 'Detección y fuentes', kpi: 'Fuentes cubiertas', valor_actual: 0, meta: 17, unidad: 'CCAA', responsable: 'Ariadna', bloque_letra: 'A', encargos_abiertos: 2 }],
  encargos: [],
};
test('cuadro por objetivo con contratado, presentado, meta a la fecha y desviación', () => {
  const raiz = crearNodo('main'); render(raiz, { datos, derivado: derivar(datos) }, undefined, {}, new Date('2026-07-02T12:00:00Z'));
  const cuadros = raiz.children.filter(c => c.className.includes('objetivo'));
  assert.equal(cuadros.length, 2);
  const t = cuadros[0].textContent;
  assert.ok(t.includes('20.000 EUR'), 'contratado'); assert.ok(t.includes('90.000 EUR'), 'presentado');
  assert.ok(t.includes('150.411 EUR'), 'meta a la fecha (300000 * 183 / 365)'); assert.ok(t.includes('-130.411 EUR'), 'desviación');
  assert.ok(cuadros[1].textContent.includes('0 EUR'));
});
test('los frentes enlazan al tablero filtrado por la ruta nueva', () => {
  const raiz = crearNodo('main'); render(raiz, { datos, derivado: derivar(datos) });
  const hrefs = buscarNodos(raiz, n => n.tag === 'a').map(a => a.attrs.href);
  assert.deepEqual(hrefs, ['#operacion/tablero?frente=A1']);
  assert.ok(raiz.textContent.includes('Fuentes cubiertas: 0 / 17 CCAA'));
});
