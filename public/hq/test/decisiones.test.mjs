import test from 'node:test';
import assert from 'node:assert/strict';
// pedirMotivos vive en ui.js, que no toca document al importarse (solo dentro de sus funciones, igual
// que pedirTexto): import estatico seguro aunque los globals de document/window se definan mas abajo.
import { pedirMotivos } from '../app/ui.js';

// decisiones.js importa `rpc` de api.js y `recargar` de main.js (mismo patron que tablero.js, exigido
// por la tarea: "copiar el patron exacto, no inventes otro"). api.js lee `location.search` y
// `localStorage` en su ambito de modulo, y main.js resuelve dos `document.getElementById(...)`, cablea
// `window`/`document.addEventListener` y, al no haber token, llama a `pedirToken()` (que construye DOM
// con `el()`) nada mas importarse. Node ejecuta los `import` estaticos antes que cualquier otra
// sentencia del fichero, asi que no hay forma de definir estos globals antes de un `import` estatico:
// se usa `import()` dinamico tras montar un DOM minimo (mismo shim que ya usa humo-t4.mjs para
// tablero.js, que tiene la misma cadena de imports). `decisiones.js` en si no toca el DOM al
// importarse (solo dentro de `render`); el shim es puro efecto de la cadena de imports compartida.
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
    // movil; sin este metodo la cadena api.js/main.js explota al importar decisiones.js.
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
};
globalThis.location = { hash: '', search: '', pathname: '/hq/' };
globalThis.history = { replaceState: () => {} };
globalThis.window = { addEventListener: () => {} };
globalThis.HQ_VERSION = { v: 'test' };
if (typeof globalThis.localStorage === 'undefined') {
  const mem = new Map();
  globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
}

const { agrupar, bandeja, textoChat } = await import('../app/vistas/decisiones.js');
const render = (raiz, S) => raiz.append(bandeja(S, undefined, new Date('2026-09-16T12:00:00Z')));
const ahora = new Date('2026-09-16T12:00:00Z');
test('agrupar por vencimiento', () => {
  const g = agrupar([{ id: 1, vence: '2026-09-16T18:00:00Z' }, { id: 2, vence: '2026-09-19T10:00:00Z' }, { id: 3, vence: null }, { id: 4, vence: '2026-09-30', pospuesta_hasta: '2026-09-20T08:00:00Z' }], ahora);
  assert.deepEqual(g.hoy.map(x => x.id), [1]); assert.deepEqual(g.semana.map(x => x.id), [2]); assert.deepEqual(g.resto.map(x => x.id), [3]); assert.deepEqual(g.pospuestas.map(x => x.id), [4]);
});

// Task 2 (plan 3b): la cola de licitaciones debe mostrar solo las decidibles (porDecidir), con una
// ficha completa (elegible, solvencia, motivo, enlaces a PCAP/PPT/Perfil/Drive), y la linea de criba
// aparte. Fixture con 2 decidibles (EXP-1 Probable, EXP-2 Dudosa), 1 en criba (EXP-3 Revisar) y 1
// descartada (EXP-4, no cuenta en ninguna de las dos).
const buscarNodos = (n, pred, out = []) => { if (n.nodeType === 1) { if (pred(n)) out.push(n); n.children.forEach(c => buscarNodos(c, pred, out)); } return out; };
const fichas = raiz => buscarNodos(raiz, n => n.tag === 'article' && n.className.includes('licitacion'));
const fichaCon = (raiz, expediente) => fichas(raiz).find(f => f.textContent.includes(expediente));
const licsFixture = [
  { expediente: 'EXP-1', organo: 'Ayuntamiento X', provincia: 'Barcelona', objeto: 'Objeto largo 1', resumen_corto: 'Resumen 1', importe: 45000, tipo: 'Servicios', procedimiento: 'Abierto', elegible: 'Probable', motivo_auto: 'Encaje claro con Regulia', solvencia: 'Clasificación grupo III', cierre: '2026-10-01', enlace: 'javascript:alert(1)', pcap: 'javascript:alert(1)', ppt: 'https://contrataciondelestado.es/exp1/ppt.pdf', carpeta: 'https://drive.google.com/drive/folders/exp1', estado: 'Nueva', decision: null },
  { expediente: 'EXP-2', organo: 'Diputación Y', provincia: 'Girona', objeto: 'Objeto largo 2', resumen_corto: '', importe: 12000, tipo: 'Suministros', procedimiento: 'Simplificado', elegible: 'Dudosa', motivo_auto: '', solvencia: '', cierre: '2026-09-25', enlace: '', pcap: '', ppt: '', carpeta: '', estado: 'Por decidir', decision: 'Pendiente' },
  { expediente: 'EXP-3', organo: 'Consejo Z', provincia: 'Lleida', objeto: 'Objeto revisar', resumen_corto: 'Revisar 3', importe: 8000, tipo: 'Obras', procedimiento: 'Abierto', elegible: 'Revisar', motivo_auto: '', solvencia: '?pendiente de Guillem', cierre: '2026-09-30', enlace: '', pcap: '', ppt: '', carpeta: '', estado: 'Nueva', decision: null },
  { expediente: 'EXP-4', organo: 'Generalitat W', provincia: 'Tarragona', objeto: 'Objeto descartado', resumen_corto: 'Descartado 4', importe: 5000, tipo: 'Servicios', procedimiento: 'Abierto', elegible: 'Probable', motivo_auto: '', solvencia: '', cierre: '2026-09-20', enlace: '', pcap: '', ppt: '', carpeta: '', estado: 'Descartada', decision: 'No' },
];
const raizLic = () => { const raiz = crearNodo('main'); render(raiz, { datos: { rol: 'owner', licitaciones: licsFixture } }); return raiz; };

test('licitaciones: la cola solo trae las decidibles (h2 con el total correcto)', () => {
  const raiz = raizLic();
  const h2 = buscarNodos(raiz, n => n.tag === 'h2').find(n => n.textContent.includes('Licitaciones por decidir'));
  assert.equal(h2.textContent, 'Licitaciones por decidir (2)');
  assert.ok(fichaCon(raiz, 'EXP-1'), 'EXP-1 (Probable) es decidible');
  assert.ok(fichaCon(raiz, 'EXP-2'), 'EXP-2 (Dudosa) es decidible');
  assert.ok(!fichaCon(raiz, 'EXP-3'), 'EXP-3 (Revisar) va a criba, no a la cola');
  assert.ok(!fichaCon(raiz, 'EXP-4'), 'EXP-4 (Descartada) no se decide ya');
});

test('licitaciones: la linea de criba cuenta solo lo abierto y no decidible, con enlace a Operacion/Licitaciones', () => {
  const raiz = raizLic();
  const criba = buscarNodos(raiz, n => n.className.includes('mudo')).find(n => n.textContent.includes('en criba'));
  assert.equal(criba.textContent, '1 en criba de Guillem (Revisar, No viable, Sin pliego): se deciden cuando estén analizadas');
  const enlace = buscarNodos(criba, n => n.tag === 'a')[0];
  assert.equal(enlace.attrs.href, '#operacion/licitaciones');
});

// Minor 9 (revision final): sin nada en criba (todas las abiertas son decidibles) no se pinta la
// linea "0 en criba...": no aporta nada y confunde ("0 en criba" suena a que algo falta).
test('licitaciones: sin nada en criba, no se pinta la linea "en criba" (Minor 9)', () => {
  const raiz = crearNodo('main');
  render(raiz, { datos: { rol: 'owner', licitaciones: [licsFixture[0], licsFixture[1]] } });
  const lineas = buscarNodos(raiz, n => n.className.includes('mudo'));
  assert.ok(!lineas.some(n => n.textContent.includes('en criba')), 'no debe existir ninguna linea "en criba" cuando el conteo es 0');
});

test('ficha de licitacion: elegible, solvencia (con "sin dato" si esta vacia) y motivo solo si hay', () => {
  const raiz = raizLic();
  const f1 = fichaCon(raiz, 'EXP-1'), f2 = fichaCon(raiz, 'EXP-2');
  assert.ok(f1.textContent.includes('Elegible'));
  assert.ok(f1.textContent.includes('Solvencia'));
  assert.ok(f1.textContent.includes('Clasificación grupo III'));
  assert.ok(f1.textContent.includes('Motivo'));
  assert.ok(f1.textContent.includes('Encaje claro con Regulia'));
  assert.ok(f2.textContent.includes('sin dato'), 'EXP-2 no trae solvencia: solvenciaTexto cae a "sin dato"');
  assert.ok(!f2.textContent.includes('Motivo'), 'EXP-2 no trae motivo_auto: no se pinta la linea');
  const pillElegible = buscarNodos(f1, n => n.className.includes('pill') && n.className.includes('elegible'))[0];
  assert.equal(pillElegible.className, 'pill elegible-probable');
});

test('ficha de licitacion: enlaces PCAP/PPT/Drive solo si empiezan por http; javascript: no pinta ningun <a>', () => {
  const raiz = raizLic();
  const f1 = fichaCon(raiz, 'EXP-1');
  const enlaces = buscarNodos(f1, n => n.tag === 'a');
  assert.equal(enlaces.length, 2, 'solo ppt y drive: pcap y perfil venian con javascript:');
  assert.ok(!enlaces.some(a => String(a.attrs.href || '').startsWith('javascript:')), 'ningun <a> con esquema javascript:');
  const porTexto = t => enlaces.find(a => a.textContent === t);
  assert.equal(porTexto('PPT').attrs.href, 'https://contrataciondelestado.es/exp1/ppt.pdf');
  assert.equal(porTexto('PPT').attrs.target, '_blank');
  assert.equal(porTexto('PPT').attrs.rel, 'noopener');
  assert.equal(porTexto('Drive').attrs.href, 'https://drive.google.com/drive/folders/exp1');
  assert.ok(!porTexto('PCAP'), 'PCAP no se pinta: la url no empezaba por http');
  const f2 = fichaCon(raiz, 'EXP-2');
  assert.equal(buscarNodos(f2, n => n.tag === 'a').length, 0, 'EXP-2 no trae ningun enlace: no se pinta div.enlaces-doc');
});

// #1057 tarea 27: bandeja en Hoy. Arriba solo lo urgente; sin fecha y pospuestas plegadas; un solo campo
// por tarjeta y el texto prefabricado para pegar en el chat del chief.
test('bandeja: urgentes arriba, sin fecha y pospuestas plegadas, un solo campo por tarjeta', () => {
  const raiz = crearNodo('main');
  raiz.append(bandeja({ datos: { rol: 'owner', pendientes: [{ id: 1, tipo: 'aprobacion', titulo: 'Firmar A', vence: '2026-09-16T18:00:00Z' }, { id: 3, tipo: 'duda', titulo: 'Duda C' }], pospuestas: [{ id: 4, tipo: 'aprobacion', titulo: 'D', pospuesta_hasta: '2026-09-20T08:00:00Z' }] } }, '3', ahora));
  assert.equal(buscarNodos(raiz, n => n.tag === 'h2')[0].textContent, 'Bandeja · depende de ti (3)');
  const plegada = buscarNodos(raiz, n => n.tag === 'details' && n.className === 'grupo-criba')[0];
  assert.equal(plegada.children[0].textContent, 'Sin fecha (1) · pospuestas (1)');
  assert.equal(plegada.attrs.open, '', 'se abre si la tarjeta pedida (#3) está dentro');
  const t1 = buscarNodos(raiz, n => n.tag === 'article' && n.attrs.id === 'd1')[0];
  assert.equal(buscarNodos(t1, n => n.tag === 'textarea' || n.tag === 'input').length, 1, 'un solo campo');
  assert.deepEqual(buscarNodos(t1, n => n.tag === 'button').map(b => b.textContent), ['Copiar para el chat', 'Comentar', 'Posponer', 'Rechazar', 'Aprobar']);
  const t3 = buscarNodos(raiz, n => n.tag === 'article' && n.attrs.id === 'd3')[0];
  assert.ok(buscarNodos(t3, n => n.tag === 'button').some(b => b.textContent === 'Responder'));
  assert.equal(textoChat({ id: 7, titulo: 'Firmar A' }, '  sí, adelante '), '#7 Firmar A: sí, adelante');
});
test('bandeja: sin nada, "Nada que decidir."', () => {
  const raiz = crearNodo('main'); raiz.append(bandeja({ datos: { rol: 'owner' } }, undefined, ahora));
  assert.ok(raiz.textContent.includes('Nada que decidir.'));
});

// pedirMotivos (#1063): contrato del modal de motivos de NO. El shim de getElementById siempre crea un
// div nuevo (no cachea 'capa'), asi que para poder localizar los botones que monta modal() dentro se
// intercepta getElementById durante la vida de la promesa, igual que se restaura despues.
test('pedirMotivos: Guardar deshabilitado sin chips; marcar uno lo habilita y Guardar resuelve motivos + texto', async () => {
  const capa = crearNodo('div');
  const original = document.getElementById;
  document.getElementById = () => capa;
  try {
    const promesa = pedirMotivos('Descartar EXP-9', ['A', 'B', 'C']);
    const botones = buscarNodos(capa, n => n.tag === 'button');
    const chipA = botones.find(b => b.textContent === 'A');
    const guardar = botones.find(b => b.textContent === 'Guardar');
    const detalle = buscarNodos(capa, n => n.tag === 'textarea')[0];
    detalle.value = 'demasiado caro';
    assert.equal(guardar.disabled, true, 'sin chips marcados, Guardar empieza deshabilitado');
    chipA.listeners.click[0]();
    assert.equal(chipA.attrs['aria-pressed'], 'true');
    assert.equal(guardar.disabled, false, 'marcar un chip habilita Guardar');
    guardar.listeners.click[0]();
    assert.deepEqual(await promesa, { motivos: ['A'], texto: 'demasiado caro' });
  } finally { document.getElementById = original; }
});

test('pedirMotivos: desmarcar el unico chip vuelve a deshabilitar Guardar; Cancelar resuelve null', async () => {
  const capa = crearNodo('div');
  const original = document.getElementById;
  document.getElementById = () => capa;
  try {
    const promesa = pedirMotivos('Descartar EXP-9', ['A', 'B']);
    const botones = buscarNodos(capa, n => n.tag === 'button');
    const chipA = botones.find(b => b.textContent === 'A');
    const guardar = botones.find(b => b.textContent === 'Guardar');
    const cancelar = botones.find(b => b.textContent === 'Cancelar');
    chipA.listeners.click[0]();
    chipA.listeners.click[0]();
    assert.equal(guardar.disabled, true, 'sin ningun chip marcado, Guardar vuelve a deshabilitarse');
    cancelar.listeners.click[0]();
    assert.equal(await promesa, null);
  } finally { document.getElementById = original; }
});
