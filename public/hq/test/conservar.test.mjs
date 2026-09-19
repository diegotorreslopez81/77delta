import test from 'node:test';
import assert from 'node:assert/strict';
import { fotografiar, restaurar } from '../app/conservar.js';

// Shim de DOM propio para este fichero: conservar.js corre sobre DOM real en el navegador (tagName,
// parentNode, children, open, value, selectionStart/End, setSelectionRange), asi que aqui se modela con
// esos mismos nombres en vez de reutilizar el shim de otros tests (que usa 'tag'/'parent', pensado solo
// para lo que necesita el(); brief 2021: "si el shim no soporta [lo necesario], amplialo en el propio
// test, no en el codigo de produccion").
function nodo(tagName, { id = '', attrs = {} } = {}) {
  const n = {
    tagName: tagName.toUpperCase(), id, children: [], nodeType: 1, parentNode: null,
    _attrs: { ...attrs }, value: '', type: attrs.type || 'text', focused: false,
    selectionStart: null, selectionEnd: null,
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(this._attrs, k) ? this._attrs[k] : null; },
    setAttribute(k, v) { this._attrs[k] = v; },
    append(...kids) { for (const k of kids) { k.parentNode = this; this.children.push(k); } },
    focus() { this.focused = true; },
    setSelectionRange(i, f) { this.selectionStart = i; this.selectionEnd = f; },
  };
  return n;
}
function details({ id = '', open = false } = {}, kids = []) {
  const d = nodo('details', { id });
  d.open = open;
  d.append(...kids);
  return d;
}
function textarea({ id = '', conservar, valor = '' } = {}) {
  const t = nodo('textarea', { id, attrs: conservar ? { 'data-conservar': conservar } : {} });
  t.value = valor;
  return t;
}
function raizCon(...kids) { const r = nodo('div'); r.append(...kids); return r; }

test('fotografiar: recoge los <details> abiertos por el id propio', () => {
  const raiz = raizCon(details({ id: 'd1', open: true }), details({ id: 'd2', open: false }), details({ id: 'd3', open: true }));
  const foto = fotografiar(raiz, null);
  assert.deepEqual(foto.abiertos.sort(), ['d1', 'd3']);
});

test('fotografiar: un <details> sin id propio usa el id del ancestro mas cercano (article#d123 > details)', () => {
  const art = nodo('article', { id: 'd123' });
  const det = details({ open: true });
  art.append(det);
  const raiz = raizCon(art);
  const foto = fotografiar(raiz, null);
  assert.deepEqual(foto.abiertos, ['d123']);
});

test('fotografiar: un <details> abierto sin ningun id en la cadena no se apunta (no hay forma de reencontrarlo)', () => {
  const raiz = raizCon(details({ open: true }));
  const foto = fotografiar(raiz, null);
  assert.deepEqual(foto.abiertos, []);
});

test('fotografiar: recoge el valor de cada textarea/input con data-conservar', () => {
  const t1 = textarea({ conservar: 'd1', valor: 'prueba borrador' });
  const t2 = textarea({ conservar: 'tablero:nuevo', valor: '' });
  const sinClave = textarea({ valor: 'no se toca' });
  const raiz = raizCon(t1, t2, sinClave);
  const foto = fotografiar(raiz, null);
  assert.deepEqual(foto.campos, { 'd1': 'prueba borrador', 'tablero:nuevo': '' });
});

test('fotografiar: si el elemento activo tiene data-conservar, guarda clave + posicion del cursor', () => {
  const activo = textarea({ conservar: 'd1', valor: 'hola mundo' });
  activo.selectionStart = 4; activo.selectionEnd = 4;
  const raiz = raizCon(activo);
  const foto = fotografiar(raiz, activo);
  assert.deepEqual(foto.foco, { clave: 'd1', inicio: 4, fin: 4 });
});

test('fotografiar: sin elemento activo, o activo sin data-conservar, foco es null', () => {
  const raiz = raizCon(textarea({ conservar: 'd1' }));
  assert.equal(fotografiar(raiz, null).foco, null);
  assert.equal(fotografiar(raiz, undefined).foco, null);
  const sinClave = textarea({ valor: 'x' });
  assert.equal(fotografiar(raizCon(sinClave), sinClave).foco, null);
});

test('restaurar: reabre por id propio y por id del ancestro (article#d123 > details sin id)', () => {
  const raiz1 = raizCon(details({ id: 'd1', open: false }));
  restaurar(raiz1, { abiertos: ['d1'], campos: {}, foco: null });
  assert.equal(raiz1.children[0].open, true);

  const art = nodo('article', { id: 'd123' });
  const det = details({ open: false });
  art.append(det);
  const raiz2 = raizCon(art);
  restaurar(raiz2, { abiertos: ['d123'], campos: {}, foco: null });
  assert.equal(det.open, true);
});

test('restaurar: un id de la foto que ya no existe tras el render no lanza', () => {
  const raiz = raizCon(details({ id: 'd9', open: false }));
  assert.doesNotThrow(() => restaurar(raiz, { abiertos: ['fantasma'], campos: {}, foco: null }));
});

test('restaurar: rellena un campo con data-conservar solo si tras el render esta vacio', () => {
  const vacio = textarea({ conservar: 'd1', valor: '' });
  restaurar(raizCon(vacio), { abiertos: [], campos: { d1: 'prueba borrador' }, foco: null });
  assert.equal(vacio.value, 'prueba borrador');

  const conAlgo = textarea({ conservar: 'd1', valor: 'ya tenia texto' });
  restaurar(raizCon(conAlgo), { abiertos: [], campos: { d1: 'prueba borrador' }, foco: null });
  assert.equal(conAlgo.value, 'ya tenia texto', 'no pisa un valor que ya viniera relleno (p.ej. desde el borrador de localStorage)');
});

test('restaurar: si el campo era el que tenia el foco, lo recupera con la posicion del cursor', () => {
  const campo = textarea({ conservar: 'd1', valor: '' });
  restaurar(raizCon(campo), { abiertos: [], campos: { d1: 'prueba borrador' }, foco: { clave: 'd1', inicio: 6, fin: 6 } });
  assert.equal(campo.focused, true);
  assert.equal(campo.selectionStart, 6);
  assert.equal(campo.selectionEnd, 6);
});

test('restaurar: con foto null (p.ej. cambio de vista) no hace nada y no lanza', () => {
  const raiz = raizCon(details({ id: 'd1', open: false }));
  assert.doesNotThrow(() => restaurar(raiz, null));
  assert.equal(raiz.children[0].open, false);
});
