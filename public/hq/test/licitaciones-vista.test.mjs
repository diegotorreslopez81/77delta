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

const { render } = await import('../app/vistas/licitaciones.js');

const buscarNodos = (n, pred, out = []) => { if (n.nodeType === 1) { if (pred(n)) out.push(n); n.children.forEach(c => buscarNodos(c, pred, out)); } return out; };
const clase = (n, c) => n.className.split(' ').includes(c);
const h2s = raiz => buscarNodos(raiz, n => n.tag === 'h2');
const minis = raiz => buscarNodos(raiz, n => clase(n, 'mini'));
const miniPor = (raiz, nombre) => minis(raiz).find(m => buscarNodos(m, n => clase(n, 'l'))[0].textContent === nombre);
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

test('embudo: la fila "Por decidir" cuenta L1 y L2, con la suma de importes', () => {
  const raiz = raizVacia();
  render(raiz, { datos: { licitaciones: lics } });
  assert.ok(h2s(raiz).some(h => h.textContent === 'Embudo'));
  const m = miniPor(raiz, 'Por decidir');
  assert.ok(m, 'debe existir la mini de Por decidir');
  const v = buscarNodos(m, n => clase(n, 'v'))[0];
  assert.equal(v.children[0].data, '2');
  const small = buscarNodos(v, n => n.tag === 'small')[0];
  assert.equal(small.textContent, eurTexto(30000));
});

function eurTexto(n) { return Math.round(n).toLocaleString('es-ES') + ' EUR'; }

test('embudo: sin kpis.lic.detectadas.n ni resumen.total no hay fila Detectadas', () => {
  const raiz = raizVacia();
  render(raiz, { datos: { licitaciones: lics } });
  assert.equal(miniPor(raiz, 'Detectadas'), undefined);
});

test('embudo: una fila con eur 0 (Adjudicadas, sin filas) no pinta <small>', () => {
  const raiz = raizVacia();
  render(raiz, { datos: { licitaciones: lics } });
  const m = miniPor(raiz, 'Adjudicadas');
  const v = buscarNodos(m, n => clase(n, 'v'))[0];
  assert.equal(v.children[0].data, '0');
  assert.equal(buscarNodos(v, n => n.tag === 'small').length, 0);
});

test('embudo: enlace reciproco a Reglas/Decisiones con el total de por decidir', () => {
  const raiz = raizVacia();
  render(raiz, { datos: { licitaciones: lics } });
  const a = buscarNodos(raiz, n => n.tag === 'a' && n.attrs.href === '#reglas/decisiones' && n.textContent.includes('por decidir'))[0];
  assert.ok(a);
  assert.equal(a.textContent, '2 por decidir en Reglas/Decisiones');
});

test('embudo: kpis.lic.tasa_exito, lic.proximo_cierre y lic.actualizado se pintan solo si existen', () => {
  const raiz1 = raizVacia();
  render(raiz1, { datos: { licitaciones: lics } });
  assert.ok(!buscarNodos(raiz1, n => clase(n, 'mudo')).some(n => n.textContent.includes('tasa de éxito')));
  const raiz2 = raizVacia();
  render(raiz2, { datos: { licitaciones: lics, kpis: { 'lic.tasa_exito': { valor: 42.3 }, 'lic.proximo_cierre': { texto: 'L2 · 2026-09-20' }, 'lic.actualizado': { texto: '2026-09-17T10:00' } } } });
  const textos = buscarNodos(raiz2, n => clase(n, 'mudo')).map(n => n.textContent);
  assert.ok(textos.some(t => t.includes('tasa de éxito 42.3 %') && t.includes('próximo cierre L2 · 2026-09-20')));
  assert.ok(textos.some(t => t === 'KPIs del barrido actualizados 2026-09-17T10:00'));
});

test('embudo: caption unica "Importes sin IVA" bajo el embudo, no repetida por tile (Minor 1)', () => {
  const raiz = raizVacia();
  render(raiz, { datos: { licitaciones: lics } });
  const textos = buscarNodos(raiz, n => clase(n, 'mudo')).map(n => n.textContent);
  assert.ok(textos.includes('Importes sin IVA'));
});

test('embudo: sin licitaciones pausadas, la mini "Pausadas" no se pinta (I1)', () => {
  const raiz = raizVacia();
  render(raiz, { datos: { licitaciones: lics } });
  assert.equal(miniPor(raiz, 'Pausadas'), undefined);
});

test('embudo: con una licitacion en estado Pausada, se pinta la mini "Pausadas" con su importe (I1)', () => {
  const raiz = raizVacia();
  const conPausada = [...lics, { expediente: 'L8', elegible: 'Probable', estado: 'Pausada', decision: null, cierre: '2026-09-25', importe: '7000', resumen_corto: 'Resumen L8', objeto: 'Objeto L8' }];
  render(raiz, { datos: { licitaciones: conPausada } });
  const m = miniPor(raiz, 'Pausadas');
  assert.ok(m, 'debe existir la mini de Pausadas cuando hay al menos una');
  const v = buscarNodos(m, n => clase(n, 'v'))[0];
  assert.equal(v.children[0].data, '1');
  const small = buscarNodos(v, n => n.tag === 'small')[0];
  assert.equal(small.textContent, eurTexto(7000));
});

test('criba: los grupos salen ordenados por tamano desc (Revisar 2, No viable 1) y el primero abierto', () => {
  const raiz = raizVacia();
  render(raiz, { datos: { licitaciones: lics } });
  const gs = grupos(raiz);
  assert.equal(gs.length, 2);
  const summaries = gs.map(g => buscarNodos(g, n => n.tag === 'summary')[0].textContent);
  assert.deepEqual(summaries, ['Revisar (2)', 'No viable (1)']);
  assert.equal(gs[0].attrs.open, '');
  assert.equal(gs[1].attrs.open, undefined);
});

test('criba: h2 con el total de enCriba y filas con expediente, resumen, cierre e importe; Perfil solo si la url es http', () => {
  const raiz = raizVacia();
  render(raiz, { datos: { licitaciones: lics } });
  assert.ok(h2s(raiz).some(h => h.textContent === 'En criba de Guillem (3)'));
  const revisar = grupos(raiz)[0];
  const filas = buscarNodos(revisar, n => n.tag === 'p');
  const filaL3 = filas.find(p => p.textContent.includes('L3'));
  assert.ok(filaL3.textContent.includes('Resumen L3'));
  assert.ok(filaL3.textContent.includes('cierra'));
  assert.ok(filaL3.textContent.includes(eurTexto(5000) + ' sin IVA'));
  const enlaceL3 = buscarNodos(filaL3, n => n.tag === 'a')[0];
  assert.equal(enlaceL3.attrs.href, 'https://perfil.example.com/l3');
  assert.equal(enlaceL3.attrs.target, '_blank');
  assert.equal(enlaceL3.attrs.rel, 'noopener');
  const filaL5 = filas.find(p => p.textContent.includes('L5'));
  assert.equal(buscarNodos(filaL5, n => n.tag === 'a').length, 0, 'L5 trae un enlace javascript: que urlSegura descarta');
});

test('Aprobadas y presentadas: solo Aprobada/Presentada, ordenadas por cierre asc, enlazan a Reglas/Decisiones', () => {
  const raiz = raizVacia();
  render(raiz, { datos: { licitaciones: lics } });
  const tarjetas = buscarNodos(raiz, n => n.tag === 'a' && clase(n, 'tarjeta') && clase(n, 'enlace'));
  assert.equal(tarjetas.length, 2);
  assert.equal(tarjetas[0].textContent.includes('L7'), true, 'L7 cierra antes (2026-09-15) que L6 (2026-09-30)');
  assert.equal(tarjetas[1].textContent.includes('L6'), true);
  for (const t of tarjetas) assert.equal(t.attrs.href, '#reglas/decisiones');
});

test('sin licitaciones ni resumen: pinta "sin licitaciones" y nada mas', () => {
  const raiz = raizVacia();
  render(raiz, { datos: { licitaciones: [], lic_resumen: {} } });
  assert.equal(raiz.textContent, 'sin licitaciones');
  assert.equal(h2s(raiz).length, 0);
});

test('sin licitaciones pero con lic_resumen: no dice "sin licitaciones", pinta el embudo con los datos del resumen', () => {
  const raiz = raizVacia();
  render(raiz, { datos: { licitaciones: [], lic_resumen: { total: { n: 1500, eur: 9000000 }, contratadas: { n: 20, eur: 200000 } } } });
  assert.ok(!raiz.textContent.includes('sin licitaciones'));
  const detectadas = miniPor(raiz, 'Detectadas');
  assert.ok(detectadas);
  assert.equal(buscarNodos(detectadas, n => clase(n, 'v'))[0].children[0].data, '1500');
  const contratadas = miniPor(raiz, 'Contratadas');
  assert.equal(buscarNodos(contratadas, n => clase(n, 'v'))[0].children[0].data, '20');
});

test('sin datos en absoluto (S.datos vacio) no rompe: pinta "sin licitaciones"', () => {
  const raiz = raizVacia();
  render(raiz, { datos: {} });
  assert.equal(raiz.textContent, 'sin licitaciones');
});
