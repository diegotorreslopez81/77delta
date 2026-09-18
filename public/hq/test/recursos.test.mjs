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
const { render, urgeTercera, peorPct } = await import('../app/vistas/recursos.js');
const buscarNodos = (n, pred, out = []) => { if (n.nodeType === 1) { if (pred(n)) out.push(n); n.children.forEach(c => buscarNodos(c, pred, out)); } return out; };
const ahora = new Date('2026-09-18T21:30:00Z');
// Payload real del 18-sep (omc_cuentas_estado): diego@ 12 % de ventana y 93 % de semana; team@ 5 % y 97 %.
const cuentas = [
  { clave: 'principal', cuenta: 'diego@', pct_ventana: 12, pct_semana: 93, pct_semana_opus: 40, ventana_fin: '2026-09-19T01:00:00Z', semana_fin: '2026-09-18T21:59:59Z', updated_at: '2026-09-18T21:15:00Z', minutos: 15, saturada: true, pausados: [] },
  { clave: 'team', cuenta: 'team@', pct_ventana: 5, pct_semana: 97, pct_semana_opus: null, ventana_fin: null, semana_fin: '2026-09-19T22:59:59Z', updated_at: '2026-09-18T21:15:00Z', minutos: 15, saturada: true, pausados: ['admin-books'] },
];

test('peorPct toma el mayor de ventana y semana; urgeTercera solo cuando todas las cuentas están al 90 % o más', () => {
  assert.equal(peorPct({ pct_ventana: 12, pct_semana: 93 }), 93);
  assert.equal(peorPct({ pct_ventana: '40' }), 40);
  assert.equal(urgeTercera([]), false);
  assert.equal(urgeTercera(undefined), false);
  assert.equal(urgeTercera(cuentas), true);
  assert.equal(urgeTercera([cuentas[0], { ...cuentas[1], pct_semana: 40, saturada: false }]), false);
});

test('una tarjeta por cuenta con % de semana y de ventana, reinicio, antigüedad, pausados y aviso de tercera cuenta', () => {
  const raiz = crearNodo('main'); render(raiz, { datos: { cuentas } }, undefined, {}, ahora);
  const tarjetas = raiz.children.filter(c => c.className.includes('cuenta'));
  assert.equal(tarjetas.length, 2);
  const t = tarjetas[0].textContent;
  for (const s of ['diego@', '93 %', '12 %', 'saturada', 'muestra de hace 15 min', 'Opus: 40 %', 'reinicio']) assert.ok(t.includes(s), s);
  assert.ok(tarjetas[0].className.includes('ambar'), 'diego@ al 93: ámbar');
  assert.ok(tarjetas[1].className.includes('rojo'), 'team@ al 97: rojo');
  assert.ok(tarjetas[1].textContent.includes('pausados por ahorro: admin-books'));
  assert.ok(!tarjetas[1].textContent.includes('Opus'), 'sin dato de Opus no se pinta');
  const barras = buscarNodos(tarjetas[0], n => n.className.startsWith('barra'));
  assert.equal(barras.length, 2);
  assert.equal(barras[0].children[0].attrs.style, 'width:93%');
  assert.equal(barras[1].children[0].attrs.style, 'width:12%');
  assert.ok(raiz.children.some(c => c.className.includes('aviso') && c.textContent.includes('urge la tercera cuenta')));
  assert.ok(raiz.textContent.includes('peni retirada'));
});

test('sin cuentas: mensaje de sin muestras y sin aviso; una sola cuenta libre tampoco avisa', () => {
  const raiz = crearNodo('main'); render(raiz, { datos: {} }, undefined, {}, ahora);
  assert.ok(raiz.textContent.includes('Sin muestras'));
  assert.ok(!raiz.children.some(c => c.className.includes('aviso')));
  const r2 = crearNodo('main'); render(r2, { datos: { cuentas: [{ ...cuentas[0], pct_semana: 30, saturada: false }] } }, undefined, {}, ahora);
  assert.ok(!r2.children.some(c => c.className.includes('aviso')));
  assert.ok(r2.children.find(c => c.className.includes('cuenta')).textContent.includes('libre'));
});
