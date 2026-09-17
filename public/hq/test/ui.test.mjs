import test from 'node:test';
import assert from 'node:assert/strict';
import { eur, fecha, horas, enlazar, urlSegura } from '../app/ui.js';

// enlazar() solo toca `document` dentro de sus funciones (via el()), nunca al importar el modulo, asi que
// un shim minimo definido tras un import estatico normal es suficiente (mismo razonamiento que en
// decisiones.test.mjs, pero sin necesitar import() dinamico porque ui.js no importa api.js ni main.js).
function crearNodo(tag) {
  return {
    tag, nodeType: 1, children: [], attrs: {}, className: '', _text: '',
    setAttribute(k, v) { this.attrs[k] = v; },
    addEventListener() {},
    append(...kids) { for (const k of kids) if (k != null) this.children.push(k); },
    set textContent(v) { this._text = v; },
    get textContent() { return this._text; },
  };
}
globalThis.document = { createElement: (tag) => crearNodo(tag), createTextNode: (data) => ({ nodeType: 3, data }) };

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
