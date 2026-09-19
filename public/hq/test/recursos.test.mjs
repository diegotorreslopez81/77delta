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
const { render, urgeTercera, peorPct, usd, proyeccion, porModelo } = await import('../app/vistas/recursos.js');
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

const uso = {
  mes: { coste: 14881.38, mensajes: 100711 }, mes_anterior: 2525.86,
  dias: [{ fecha: '2026-09-16', coste: 500 }, { fecha: '2026-09-17', coste: 617.78 }, { fecha: '2026-09-18', coste: 744.85 }],
  por_agente: [{ agente: 'sales-licita', coste: 3185.73 }, { agente: 'chief', coste: 2525.62 }, { agente: '', coste: 10 }],
  por_sesion: [{ sesion_id: '5a14d48f-612a', titulo: 'sales', ruta: '/x/webapp', coste: 2092.93, ultimo: '2026-09-11' }, { sesion_id: 'abcdef123456', titulo: null, ruta: '/Users/diego/dev/77delta', coste: 900, ultimo: '2026-09-18' }],
  por_agente_modelo: [{ agente: 'chief', modelo: 'claude-opus-5', coste: 2000 }, { agente: 'coo', modelo: 'claude-fable-5-1', coste: 3000 }, { agente: 'coo', modelo: 'claude-fable-5', coste: 500 }, { agente: '', modelo: 'claude-haiku-4-5-20251001', coste: 20 }, { agente: 'x', modelo: '<synthetic>', coste: 0 }],
};
const agentes = [{ id: 'sales-licita', nombre: 'Guillem-Licitaciones' }, { id: 'chief', nombre: 'Marc-Chief' }];

test('usd, proyección del mes natural y agregado por familia de modelo', () => {
  assert.equal(usd(14881.38), '14,9 k USD');
  assert.equal(usd(2525.86), '2526 USD');
  assert.equal(usd(null), '0 USD');
  assert.equal(Math.round(proyeccion(1800, new Date(2026, 8, 18, 12))), 3000);
  const m = porModelo(uso.por_agente_modelo);
  assert.deepEqual(m.map(x => [x.l, x.v, x.color]), [['Fable', 3500, 'tinta'], ['Opus', 2000, 'tinta-2'], ['Haiku', 20, 'neutro-2']]);
  assert.deepEqual(porModelo(undefined), []);
});

test('bloque de cuenta: usa "medidor-cuenta" y no "medidor cuenta" (2.0.19, colision con el .medidor de tokens.css)', () => {
  // Regresion del bug de Computo del 19-sep: tokens.css (generado, no se toca) define su propio '.medidor'
  // de 8px para otro componente; si esta card volviera a llamarse 'medidor cuenta' esa regla la aplasta
  // otra vez a 8px con overflow oculto y la primera card de Computo vuelve a verse vacia.
  const raiz = crearNodo('main'); render(raiz, { datos: { cuentas, uso, agentes } }, undefined, {}, ahora);
  assert.equal(buscarNodos(raiz, n => n.className.startsWith('medidor cuenta')).length, 0);
  assert.equal(buscarNodos(raiz, n => n.className.startsWith('medidor-cuenta')).length, 2);
});

test('cuadro: un bloque por cuenta con medidor, semana, ventana, reinicio, antigüedad, pausados y aviso de tercera cuenta', () => {
  const raiz = crearNodo('main'); render(raiz, { datos: { cuentas, uso, agentes } }, undefined, {}, ahora);
  const bloques = buscarNodos(raiz, n => n.className.startsWith('medidor-cuenta'));
  assert.equal(bloques.length, 2);
  const t = bloques[0].textContent;
  for (const s of ['diego@', '93 %', '12 %', 'saturada', 'muestra de hace 15 min', 'Opus: 40 %', 'reinicio']) assert.ok(t.includes(s), s);
  assert.ok(bloques[0].className.includes('ambar'), 'diego@ al 93: ámbar');
  assert.ok(bloques[1].className.includes('rojo'), 'team@ al 97: rojo');
  assert.ok(bloques[1].textContent.includes('pausados por ahorro: admin-books'));
  assert.ok(!bloques[1].textContent.includes('Opus'), 'sin dato de Opus no se pinta');
  assert.equal(buscarNodos(bloques[0], n => n.className.startsWith('fila-barra')).length, 2);
  const panelC = buscarNodos(raiz, n => n.className.startsWith('panel-kpi'))[0];
  assert.ok(panelC.className.includes('alerta'));
  assert.ok(buscarNodos(raiz, n => n.className.includes('aviso')).some(n => n.textContent.includes('urge la tercera cuenta')));
  assert.ok(raiz.textContent.includes('peni retirada'));
});

test('coste: mes con proyección y mes anterior, días, modelos, agentes con enlace a la ficha y sesiones, siempre en USD con fuente', () => {
  const raiz = crearNodo('main'); render(raiz, { datos: { cuentas, uso, agentes } }, undefined, {}, ahora);
  const t = raiz.textContent;
  for (const s of ['14,9 k USD', 'mes anterior 2526 USD', 'a este ritmo', 'USD a precio API · fuente omc_uso', '745 USD', 'día 18-09', 'Fable', 'Guillem-Licitaciones', 'sin agente', 'sales · 11-09', '77delta · 18-09']) assert.ok(t.includes(s), s);
  const enlaces = buscarNodos(raiz, n => n.tag === 'a' && String(n.attrs.href || '').startsWith('#equipo/agente/')).map(n => n.attrs.href);
  assert.deepEqual(enlaces, ['#equipo/agente/sales-licita', '#equipo/agente/chief']);
  assert.ok(!t.includes('EUR'), 'el coste de tokens nunca en EUR');
});

test('sin cuentas ni uso: sin muestras, sin aviso y paneles de coste vacíos; una cuenta libre tampoco avisa', () => {
  const raiz = crearNodo('main'); render(raiz, { datos: {} }, undefined, {}, ahora);
  assert.ok(raiz.textContent.includes('Sin muestras'));
  assert.ok(raiz.textContent.includes('sin datos de coste en omc_uso'));
  assert.ok(!buscarNodos(raiz, n => n.className.includes('aviso')).length);
  const r2 = crearNodo('main'); render(r2, { datos: { cuentas: [{ ...cuentas[0], pct_semana: 30, saturada: false }] } }, undefined, {}, ahora);
  assert.ok(!buscarNodos(r2, n => n.className.includes('aviso')).length);
  assert.ok(buscarNodos(r2, n => n.className.startsWith('medidor-cuenta'))[0].textContent.includes('libre'));
});
