import test from 'node:test';
import assert from 'node:assert/strict';
import { eur, fecha, horas, enlazar, urlSegura, campoTexto } from '../app/ui.js';

// enlazar() solo toca `document` dentro de sus funciones (via el()), nunca al importar el modulo, asi que
// un shim minimo definido tras un import estatico normal es suficiente (mismo razonamiento que en
// decisiones.test.mjs, pero sin necesitar import() dinamico porque ui.js no importa api.js ni main.js).
function crearNodo(tag) {
  return {
    tag, nodeType: 1, children: [], attrs: {}, className: '', _text: '', listeners: {},
    setAttribute(k, v) { this.attrs[k] = v; },
    addEventListener(ev, fn) { (this.listeners[ev] ||= []).push(fn); },
    // Un <textarea> real toma su valor inicial del texto que se le pasa como hijo (asi lo usan
    // detalle.js/decisiones.js: campoTexto({...}, [texto])); se replica aqui para poder probar "el campo
    // ya nace con contenido" con el mismo patron que usa la app.
    append(...kids) { for (const k of kids) { if (k == null) continue; this.children.push(k); if (this.tag === 'textarea' && k.nodeType === 3) this.value = (this.value || '') + k.data; } },
    set textContent(v) { this._text = v; },
    get textContent() { return this._text; },
  };
}
globalThis.document = { createElement: (tag) => crearNodo(tag), createTextNode: (data) => ({ nodeType: 3, data }) };
// Borrador local de campoTexto (brief 2021, capa C): localStorage propio de este fichero, con memoria
// aparte para poder simular "storage que lanza" (modo privado de iOS) sin tocar los demas tests.
const memoriaLS = new Map();
globalThis.localStorage = {
  getItem: k => (memoriaLS.has(k) ? memoriaLS.get(k) : null),
  setItem: (k, v) => memoriaLS.set(k, String(v)),
  removeItem: k => memoriaLS.delete(k),
};

test('eur formatea sin decimales y con EUR', () => {
  assert.equal(eur(300000), '300.000 EUR');
  assert.equal(eur(0), '0 EUR');
  assert.equal(eur(null), '-');
});
test('fecha corta en español', () => {
  assert.equal(fecha('2026-09-16T15:30:00Z', { hora: true, tz: 'Europe/Madrid' }), 'mié 16 17:30');
  assert.equal(fecha('2026-09-20', {}), 'dom 20');
  assert.equal(fecha(null, {}), '-');
});
test('horas desde una fecha', () => {
  assert.equal(horas('2026-09-14T07:00:00Z', new Date('2026-09-16T10:00:00Z')), 51);
});
test('enlazar convierte URLs en <a> por atributo real (nunca html:) y saltos de linea en <br>', () => {
  // Payload de la revision (T5 fix ronda 1): una comilla doble en el texto no debe poder inyectar un
  // atributo, porque href se fija con setAttribute (via el()), no interpolando una cadena en innerHTML.
  const payload = 'Ver factura en https://evil.example.com/x"onmouseover="document.location=1;a=1\nSegunda linea';
  const nodos = enlazar(payload);
  const link = nodos.find(n => n.tag === 'a');
  assert.ok(link, 'debe crear un nodo <a>');
  assert.equal(link.attrs.href, 'https://evil.example.com/x"onmouseover="document.location=1;a=1');
  assert.equal(link.attrs.target, '_blank');
  assert.equal(link.attrs.rel, 'noopener');
  assert.equal(Object.prototype.hasOwnProperty.call(link.attrs, 'onmouseover'), false, 'la comilla no debe crear un segundo atributo');
  assert.equal(nodos.filter(n => n.tag === 'br').length, 1);
  assert.equal(enlazar('').length, 0);
  assert.equal(enlazar(null).length, 0);
});
test('campoTexto crea un textarea con los atributos de teclado que iOS necesita para no ofrecer autofill de contacto (2.0.19, fix 7)', () => {
  const c = campoTexto({ rows: 3, placeholder: 'Comentario o avance' });
  assert.equal(c.tag, 'textarea');
  assert.equal(c.attrs.autocomplete, 'off');
  assert.equal(c.attrs.autocorrect, 'on');
  assert.equal(c.attrs.autocapitalize, 'sentences');
  assert.equal(c.attrs.spellcheck, 'true');
  assert.equal(c.attrs.enterkeyhint, 'enter');
  // attrs propios de cada sitio de uso se conservan tal cual.
  assert.equal(c.attrs.rows, 3);
  assert.equal(c.attrs.placeholder, 'Comentario o avance');
});
test('urlSegura solo deja pasar http(s) absoluto (fix ronda 2, B2)', () => {
  assert.equal(urlSegura('javascript:alert(1)'), null);
  assert.equal(urlSegura('https://x'), 'https://x');
  assert.equal(urlSegura('http://x.example.com/a?b=1'), 'http://x.example.com/a?b=1');
  assert.equal(urlSegura(''), null);
  assert.equal(urlSegura(null), null);
  assert.equal(urlSegura(undefined), null);
  assert.equal(urlSegura('#tablero/f/A3'), null);
  assert.equal(urlSegura('data:text/html,x'), null);
});

// Brief 2021 (feedback iPhone, 19-sep, capa C): campoTexto con data-conservar guarda un borrador en
// localStorage mientras se escribe, para sobrevivir a un cierre de pestaña o a un fallo que la capa B
// (conservar.js, restaurar entre renders) no llegue a cubrir. Clave real: 'hq_borrador:' + la clave.
test('campoTexto sin data-conservar no toca localStorage (comportamiento de antes intacto)', () => {
  memoriaLS.clear();
  const c = campoTexto({ rows: 2 });
  c.listeners.input?.[0]?.();
  assert.equal(memoriaLS.size, 0);
});

test('campoTexto con data-conservar: si hay borrador guardado y el campo nace vacio, lo rellena', () => {
  memoriaLS.clear();
  memoriaLS.set('hq_borrador:d1', JSON.stringify({ v: 'prueba borrador', t: Date.now() }));
  const c = campoTexto({ rows: 2, 'data-conservar': 'd1' });
  assert.equal(c.value, 'prueba borrador');
});

test('campoTexto con data-conservar: si el campo ya nace con contenido, no pisa ese valor con el borrador', () => {
  memoriaLS.clear();
  memoriaLS.set('hq_borrador:d1', JSON.stringify({ v: 'borrador viejo', t: Date.now() }));
  const c = campoTexto({ rows: 2, 'data-conservar': 'd1' }, ['ya tenia texto']);
  assert.notEqual(c.value, 'borrador viejo');
});

test('campoTexto con data-conservar: al escribir (evento input) guarda el valor, y lo borra si queda vacio', () => {
  memoriaLS.clear();
  const c = campoTexto({ rows: 2, 'data-conservar': 'd2' });
  c.value = 'estoy escribiendo';
  c.listeners.input[0]();
  assert.equal(JSON.parse(memoriaLS.get('hq_borrador:d2')).v, 'estoy escribiendo');
  c.value = '';
  c.listeners.input[0]();
  assert.equal(memoriaLS.has('hq_borrador:d2'), false);
});

test('campoTexto con data-conservar: olvidarBorrador() borra la clave', () => {
  memoriaLS.clear();
  const c = campoTexto({ rows: 2, 'data-conservar': 'd3' });
  c.value = 'algo'; c.listeners.input[0]();
  assert.equal(memoriaLS.has('hq_borrador:d3'), true);
  c.olvidarBorrador();
  assert.equal(memoriaLS.has('hq_borrador:d3'), false);
});

test('campoTexto con data-conservar: un borrador de mas de 24h caduca, se ignora y se borra', () => {
  memoriaLS.clear();
  const hace25h = Date.now() - 25 * 60 * 60 * 1000;
  memoriaLS.set('hq_borrador:d4', JSON.stringify({ v: 'texto viejo', t: hace25h }));
  const c = campoTexto({ rows: 2, 'data-conservar': 'd4' });
  assert.notEqual(c.value, 'texto viejo');
  assert.equal(memoriaLS.has('hq_borrador:d4'), false, 'la lectura borra la clave caducada');
});

test('campoTexto con data-conservar: si localStorage lanza (modo privado), no rompe el campo', () => {
  const original = globalThis.localStorage;
  globalThis.localStorage = {
    getItem() { throw new Error('modo privado'); },
    setItem() { throw new Error('modo privado'); },
    removeItem() { throw new Error('modo privado'); },
  };
  try {
    const c = campoTexto({ rows: 2, 'data-conservar': 'd5' });
    assert.doesNotThrow(() => { c.value = 'x'; c.listeners.input[0](); });
    assert.doesNotThrow(() => c.olvidarBorrador());
  } finally { globalThis.localStorage = original; }
});
