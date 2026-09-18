// Gráficos del Home visual (#1056, HQ 2.0.6): SVG propio, sin librerías, devuelto como cadena para
// `el('div', { html })`. Dentro del SVG solo viajan formas y números: las etiquetas de datos van en HTML
// con textContent, así que lo único que se escapa es el aria-label (esc). Cada segmento lleva un `color`
// (tinta, tinta-2, oro, neutro-1..3, verde, ambar, rojo) que se traduce a clase: g-<color> pinta el relleno
// y t-<color> el trazo (el CSS gana al atributo fill="none", por eso donut y medidor van por trazo). Las
// clases viven en hq.css con los tokens de marca: el modo oscuro sale solo. Oro solo como acento.
export function esc(t) { return String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
const r2 = x => Math.round(x * 100) / 100;
const num = x => (Number.isFinite(Number(x)) ? Math.max(0, Number(x)) : 0);
function svg(vb, etiqueta, cuerpo, extra = '') { return `<svg viewBox="${vb}" role="img" aria-label="${esc(etiqueta)}" class="graf-svg"${extra}>${cuerpo}</svg>`; }

// Donut: segmentos [{v, color}] sobre una circunferencia de 100 (r = 15.9155) empezando a las 12.
export function donut(segs, etiqueta) {
  const total = segs.reduce((s, x) => s + num(x.v), 0);
  let acum = 0;
  const arcos = total ? segs.filter(x => num(x.v) > 0).map(x => {
    const p = r2(100 * num(x.v) / total), off = r2(25 - acum); acum += p;
    return `<circle class="t-${x.color}" cx="21" cy="21" r="15.9155" fill="none" stroke-width="5" stroke-dasharray="${p} ${r2(100 - p)}" stroke-dashoffset="${off}"/>`;
  }).join('') : '';
  return svg('0 0 42 42', etiqueta, `<circle class="t-pista" cx="21" cy="21" r="15.9155" fill="none" stroke-width="5"/>${arcos}`);
}

// Barras verticales apiladas: columnas [{partes: [{v, color}]}], alto proporcional al máximo de la serie
// (o `max`). Cada columna deja un 30 % de hueco. Una columna a 0 se pinta como una raya de 1 px.
export function barras(cols, etiqueta, { alto = 60, max } = {}) {
  const n = cols.length || 1, ancho = 100 / n, top = max || Math.max(1, ...cols.map(c => c.partes.reduce((s, p) => s + num(p.v), 0)));
  const cuerpo = cols.map((c, i) => {
    let y = alto; const x = r2(i * ancho + ancho * 0.15), w = r2(ancho * 0.7);
    const rects = c.partes.map(p => { const h = r2(alto * num(p.v) / top); y = r2(y - h); return h > 0 ? `<rect class="g-${p.color}" x="${x}" y="${y}" width="${w}" height="${h}" rx="1"/>` : ''; }).join('');
    return rects || `<rect class="g-pista" x="${x}" y="${alto - 1}" width="${w}" height="1"/>`;
  }).join('');
  return svg(`0 0 100 ${alto}`, etiqueta, cuerpo);
}

// Barra horizontal apilada de 100 x 10: segmentos [{v, color}] proporcionales al total.
export function apilada(segs, etiqueta) {
  const total = segs.reduce((s, x) => s + num(x.v), 0);
  let x = 0;
  const cuerpo = total ? segs.map(s => { const w = r2(100 * num(s.v) / total), r = w > 0 ? `<rect class="g-${s.color}" x="${r2(x)}" y="0" width="${w}" height="10"/>` : ''; x += w; return r; }).join('') : '';
  return svg('0 0 100 10', etiqueta, `<rect class="g-pista" x="0" y="0" width="100" height="10"/>${cuerpo}`, ' preserveAspectRatio="none"');
}

// Progreso de 100 x 10: relleno en oro hasta `pct` (tope 100) y, si llega `marca`, una raya de tinta donde
// "tocaría estar" (prorrateo del objetivo).
export function progreso(pct, etiqueta, { marca = null, color = 'oro' } = {}) {
  const w = r2(Math.min(100, num(pct)));
  const m = marca == null ? '' : `<rect class="g-tinta" x="${r2(Math.min(99.4, num(marca)))}" y="0" width="0.6" height="10"/>`;
  return svg('0 0 100 10', etiqueta, `<rect class="g-pista" x="0" y="0" width="100" height="10"/><rect class="g-${color}" x="0" y="0" width="${w}" height="10"/>${m}`, ' preserveAspectRatio="none"');
}

// Medidor semicircular (consumo de una cuenta): arco de fondo y arco relleno hasta `pct` con la clase del
// semáforo (verde, ambar, rojo). pathLength=100 hace que el dasharray sea directamente el porcentaje.
export function medidor(pct, etiqueta, color) {
  const p = r2(Math.min(100, num(pct))), d = 'M4 22 A18 18 0 0 1 40 22';
  return svg('0 0 44 24', etiqueta, `<path class="t-pista" d="${d}" fill="none" stroke-width="5" pathLength="100"/><path class="t-${color}" d="${d}" fill="none" stroke-width="5" pathLength="100" stroke-dasharray="${p} 100"/>`);
}

// Línea de tendencia: valores en orden temporal, área suave debajo y punto final en oro.
export function linea(vals, etiqueta, { alto = 30 } = {}) {
  const vs = vals.map(num), n = vs.length, top = Math.max(1, ...vs);
  if (!n) return svg(`0 0 100 ${alto}`, etiqueta, '');
  const pts = vs.map((v, i) => [r2(n === 1 ? 50 : 100 * i / (n - 1)), r2(alto - 2 - (alto - 4) * v / top)]);
  const l = pts.map(p => p.join(',')).join(' '), [ux, uy] = pts[n - 1];
  return svg(`0 0 100 ${alto}`, etiqueta, `<polygon class="l-area" points="0,${alto} ${l} 100,${alto}"/><polyline class="l-traz" points="${l}" fill="none" stroke-width="1.5" vector-effect="non-scaling-stroke"/><circle class="g-oro" cx="${ux}" cy="${uy}" r="1.8"/>`);
}
