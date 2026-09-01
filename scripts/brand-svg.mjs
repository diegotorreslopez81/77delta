// Genera los SVG de marca en brand/ y el componente src/components/Delta.astro.
// El «77» sale de Sora Bold. Sora no tiene glifo Δ: en el documento de identidad
// la ponía la fuente del sistema del Mac (SF Pro Bold). Aquí la Δ se toma de
// Inter Bold, la equivalente abierta de SF, escalada a la caja alta de Sora,
// de modo que sea idéntica en web, favicon y print.
// Uso: node scripts/brand-svg.mjs <ruta/Sora-Bold.ttf> <ruta/Inter-Bold.ttf>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import opentype from 'opentype.js';

const [rutaSora, rutaInter] = process.argv.slice(2);
if (!rutaSora || !rutaInter) throw new Error('Uso: brand-svg.mjs <Sora-Bold.ttf> <Inter-Bold.ttf>');
const carga = (ruta) => {
  const buf = readFileSync(ruta);
  return opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
};
const font = carga(rutaSora);
const inter = carga(rutaInter);
if (font.tables.os2.usWeightClass !== 700) throw new Error('Se espera Sora Bold (700)');
if (inter.tables.os2.usWeightClass !== 700) throw new Error('Se espera Inter Bold (700)');

const upm = font.unitsPerEm;
const cap = font.tables.os2.sCapHeight || font.charToGlyph('H').getBoundingBox().y2;
const astaI = (() => { const g = font.charToGlyph('I').getBoundingBox(); return g.x2 - g.x1; })();
const bearing = Math.round(font.charToGlyph('7').leftSideBearing);
const track = -0.055 * upm;

const ORO = '#A7781B';
const MARFIL = '#EDEAE3';
const TINTA = '#060B14';

/** Δ de Inter Bold escalada para que su caja alta coincida con la de Sora. Coordenadas: y negativa hacia arriba, como opentype. */
function delta() {
  const g = inter.charToGlyph('Δ');
  if (!g || g.index === 0) throw new Error('Inter sin glifo Δ');
  const capInter = inter.tables.os2.sCapHeight;
  const tam = (cap / capInter) * inter.unitsPerEm; // tamaño de fuente que deja la Δ a altura `cap`
  const k = tam / inter.unitsPerEm;
  return { d: g.getPath(0, 0, tam).toPathData(1), ancho: g.advanceWidth * k, alto: cap };
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
