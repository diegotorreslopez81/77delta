// Genera los SVG de marca en brand/ y el componente src/components/Delta.astro
// a partir de Sora Bold (TTF estático). Sora no tiene glifo Δ: la Δ se dibuja
// como triángulo con el trazo derivado del asta de Sora Bold, de modo que sea
// idéntica en web, favicon y print.
// Uso: node scripts/brand-svg.mjs <ruta/Sora-Bold.ttf>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import opentype from 'opentype.js';

const ruta = process.argv[2];
if (!ruta) throw new Error('Falta la ruta al TTF de Sora Bold');
const buf = readFileSync(ruta);
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
if (font.tables.os2.usWeightClass !== 700) throw new Error('Se espera Sora Bold (700)');

const upm = font.unitsPerEm;
const cap = font.tables.os2.sCapHeight || font.charToGlyph('H').getBoundingBox().y2;
const astaI = (() => { const g = font.charToGlyph('I').getBoundingBox(); return g.x2 - g.x1; })();
const bearing = Math.round(font.charToGlyph('7').leftSideBearing);
const track = -0.055 * upm;

// Proporciones de la Δ: algo más estrecha que alta y con trazo diagonal un 20 % más fino que el asta vertical.
const ANCHO_REL = 0.94;
const TRAZO_REL = 0.8;

const ORO = '#A7781B';
const MARFIL = '#EDEAE3';
const TINTA = '#060B14';

/** Triángulo isósceles de altura `cap` y anchura ANCHO_REL·cap con hueco interior a distancia `s` de cada lado. Coordenadas: y hacia arriba. */
function delta() {
  const H = cap, W = ANCHO_REL * H, s = TRAZO_REL * astaI;
  const A = [bearing + W / 2, H], B = [bearing + W, 0], C = [bearing, 0];
  const d = (P, Q) => Math.hypot(P[0] - Q[0], P[1] - Q[1]);
  const a = d(B, C), b = d(A, C), c = d(A, B), per = a + b + c;
  const I = [(a * A[0] + b * B[0] + c * C[0]) / per, (a * A[1] + b * B[1] + c * C[1]) / per];
  const area = Math.abs((B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1])) / 2;
  const r = area / (per / 2);
  const k = (r - s) / r;
  const inner = [A, B, C].map(([x, y]) => [I[0] + (x - I[0]) * k, I[1] + (y - I[1]) * k]);
  const poly = (pts) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${(-y).toFixed(1)}`).join('') + 'Z';
  return { d: poly([A, B, C]) + poly(inner), ancho: W + 2 * bearing, alto: H };
}
const D = delta();
const PATH = (fill, extra = '') => `<path fill="${fill}" fill-rule="evenodd"${extra} d="${D.d}"/>`;

function monograma(c77, cD) {
  let x = 0; const partes = [];
  for (const ch of '77') {
    const g = font.charToGlyph(ch);
    partes.push(`<path fill="${c77}" d="${g.getPath(x, 0, upm).toPathData(1)}"/>`);
    x += g.advanceWidth + track;
  }
  partes.push(PATH(cD, ` transform="translate(${x.toFixed(1)} 0)"`));
  return { partes, ancho: x + D.ancho };
}

function svgMonograma(c77, cD, fondo) {
  const m = monograma(c77, cD), pad = upm * 0.06;
  const w = m.ancho + pad * 2, h = cap + pad * 2;
  const rect = fondo ? `<rect width="${w.toFixed(0)}" height="${h.toFixed(0)}" fill="${fondo}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w.toFixed(0)} ${h.toFixed(0)}" role="img" aria-label="77 Delta">${rect}<g transform="translate(${pad.toFixed(0)} ${(cap + pad).toFixed(0)})">${m.partes.join('')}</g></svg>\n`;
}

function svgDelta(color, fondo, radio) {
  if (!fondo) return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${D.ancho.toFixed(0)} ${cap.toFixed(0)}" role="img" aria-label="Delta">${PATH(color, ` transform="translate(0 ${cap.toFixed(1)})"`)}</svg>\n`;
  const lado = cap * 1.64, ox = (lado - D.ancho) / 2, oy = (lado - cap) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lado.toFixed(0)} ${lado.toFixed(0)}" role="img" aria-label="Delta"><rect width="${lado.toFixed(0)}" height="${lado.toFixed(0)}" rx="${(lado * radio).toFixed(0)}" fill="${fondo}"/>${PATH(color, ` transform="translate(${ox.toFixed(1)} ${(oy + cap).toFixed(1)})"`)}</svg>\n`;
}

mkdirSync('brand', { recursive: true });
writeFileSync('brand/monograma.svg', svgMonograma(MARFIL, ORO, null));
writeFileSync('brand/monograma-positivo.svg', svgMonograma(TINTA, ORO, null));
writeFileSync('brand/monograma-sobre-tinta.svg', svgMonograma(MARFIL, ORO, TINTA));
writeFileSync('brand/delta.svg', svgDelta(ORO, null));
writeFileSync('brand/favicon.svg', svgDelta(ORO, TINTA, 0.19));
writeFileSync('public/favicon.svg', svgDelta(ORO, TINTA, 0.19));

// Componente web con la misma geometría.
writeFileSync(
  'src/components/Delta.astro',
  `---
/**
 * La Δ de la marca como SVG inline. Sora no tiene glifo Δ y el navegador la
 * sustituiría por la fuente del sistema; así es idéntica en todas partes.
 * GENERADO por scripts/brand-svg.mjs: no editar a mano.
 */
interface Props {
  class?: string;
}
const { class: extra = '' } = Astro.props;
---

<svg
  viewBox="0 0 ${D.ancho.toFixed(0)} ${cap.toFixed(0)}"
  class:list={['inline-block h-[${(cap / upm).toFixed(2)}em] w-auto align-baseline fill-current', extra]}
  aria-hidden="true"
  focusable="false"
>
  <path fill-rule="evenodd" transform="translate(0 ${cap.toFixed(1)})" d="${D.d}"></path>
</svg>
`,
);

// Especimen para revisar los cuatro juntos.
const b64 = (f) => Buffer.from(readFileSync(f)).toString('base64');
const vb = (f) => readFileSync(f, 'utf8').match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/).slice(1).map(Number);
const img = (f, x, y, h) => { const [w, hh] = vb(f); return `<image href="data:image/svg+xml;base64,${b64(f)}" x="${x}" y="${y}" width="${(h * w / hh).toFixed(0)}" height="${h}"/>`; };
writeFileSync(
  'brand/especimen.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="520" viewBox="0 0 900 520"><rect width="900" height="260" fill="${TINTA}"/><rect y="260" width="900" height="260" fill="#FFFFFF"/>` +
    img('brand/monograma.svg', 70, 78, 104) + img('brand/favicon.svg', 600, 80, 100) + img('brand/favicon.svg', 720, 100, 60) + img('brand/favicon.svg', 800, 118, 32) +
    img('brand/monograma-positivo.svg', 70, 338, 104) + img('brand/delta.svg', 600, 350, 84) + img('brand/favicon.svg', 740, 342, 100) +
    `</svg>\n`,
);
console.log({ upm, cap, astaI, bearing, viewBox: `0 0 ${D.ancho.toFixed(0)} ${cap.toFixed(0)}` });
