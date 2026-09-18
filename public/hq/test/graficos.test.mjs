// Gráficos SVG del Home visual (#1056, HQ 2.0.6): cadenas sin librerías, clases de color de marca.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esc, donut, barras, apilada, progreso, medidor, linea } from '../app/graficos.js';

test('esc: escapa lo que puede romper el aria-label', () => {
  assert.equal(esc('a<b>"c"&\'d\''), 'a&lt;b&gt;&quot;c&quot;&amp;&#39;d&#39;');
  assert.equal(esc(null), '');
});

test('donut: un arco por segmento con valor, porcentajes y desfase desde las 12', () => {
  const s = donut([{ v: 3, color: 'tinta' }, { v: 1, color: 'oro' }, { v: 0, color: 'rojo' }], 'x"y');
  assert.match(s, /aria-label="x&quot;y"/);
  assert.match(s, /class="t-tinta"[^>]*stroke-dasharray="75 25" stroke-dashoffset="25"/);
  assert.match(s, /class="t-oro"[^>]*stroke-dasharray="25 75" stroke-dashoffset="-50"/);
  assert.ok(!s.includes('t-rojo'));
  assert.equal((donut([], 'vacío').match(/<circle/g) || []).length, 1); // solo la pista
});

test('barras: alto proporcional al máximo, columnas a 0 como raya de 1 px', () => {
  const s = barras([{ partes: [{ v: 10, color: 'tinta' }, { v: 10, color: 'neutro-2' }] }, { partes: [{ v: 0, color: 'tinta' }] }], 'b', { alto: 60 });
  assert.match(s, /viewBox="0 0 100 60"/);
  assert.match(s, /class="g-tinta" x="7.5" y="30" width="35" height="30"/);
  assert.match(s, /class="g-neutro-2" x="7.5" y="0" width="35" height="30"/);
  assert.match(s, /class="g-pista" x="57.5" y="59" width="35" height="1"/);
});

test('apilada y progreso: 100 x 10 sin proporción fija, marca de prorrateo en tinta', () => {
  const a = apilada([{ v: 1, color: 'rojo' }, { v: 3, color: 'neutro-2' }], 'a');
  assert.match(a, /preserveAspectRatio="none"/);
  assert.match(a, /class="g-rojo" x="0" y="0" width="25"/);
  assert.match(a, /class="g-neutro-2" x="25" y="0" width="75"/);
  const p = progreso(140, 'p', { marca: 30 });
  assert.match(p, /class="g-oro" x="0" y="0" width="100"/);
  assert.match(p, /class="g-tinta" x="30"/);
  assert.ok(!progreso(10, 'p').includes('g-tinta'));
});

test('medidor y línea: arco por pathLength y punto final en oro', () => {
  assert.match(medidor(97, 'm', 'rojo'), /class="t-rojo"[^>]*stroke-dasharray="97 100"/);
  assert.match(medidor(-5, 'm', 'verde'), /stroke-dasharray="0 100"/);
  const l = linea([0, 2, 4], 'l', { alto: 30 });
  assert.match(l, /points="0,28 50,15 100,2"/);
  assert.match(l, /<circle class="g-oro" cx="100" cy="2"/);
  assert.ok(!linea([], 'l').includes('<polyline'));
});
