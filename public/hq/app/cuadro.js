// Piezas del cuadro de mando de HQ (#1056, HQ 2.0.6; regla de kit #221): panel con título que es el
// enlace, cifra grande con tendencia, gráfico SVG, leyenda, eje y fila con barra. Las usan Hoy y las vistas
// que siguen la misma línea de diseño (Licitaciones desde 2.0.7).
import { el, eur } from './ui.js';
import { progreso } from './graficos.js';

export const anchoLog = (v, max) => (v > 0 ? Math.max(3, Math.round(100 * Math.log10(v + 1) / Math.log10(max + 1))) : 0);
export function eurCorto(n) {
  n = Number(n) || 0; const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(1).replace('.', ',') + ' M EUR';
  if (a >= 1e4) return Math.round(n / 1e3) + ' k EUR';
  return eur(Math.round(n));
}
// Urgentes: prioridad 1 o 2 (1 es la más alta), o vencimiento en menos de 24 h (o ya vencida).

// Piezas comunes de un panel: título que es el enlace (estirado a todo el panel por CSS), cifra grande
// con subtítulo y tendencia, gráfico y leyenda.
export function panel(titulo, href, kids, clase) {
  return el('section', { class: 'panel-kpi' + (clase ? ' ' + clase : '') }, [el('h2', {}, [el('a', { class: 'estirado', href, text: titulo })]), ...kids.filter(Boolean)]);
}
export function cifra(valor, sub, tend) {
  return el('div', { class: 'cifra-bloque' }, [el('p', { class: 'cifra-xl', text: valor }), sub ? el('p', { class: 'sub', text: sub }) : null,
    tend ? el('p', { class: 'tend ' + tend.sentido, text: (tend.sentido === 'sube' ? '▲ ' : tend.sentido === 'baja' ? '▼ ' : '') + tend.texto }) : null]);
}
export const grafico = (svgTxt, clase) => el('div', { class: 'graf' + (clase ? ' ' + clase : ''), html: svgTxt });
export function leyenda(items) { return el('ul', { class: 'leyenda' }, items.map(i => el('li', {}, [el('i', { class: 'punto g-' + i.color }), el('span', { text: i.l }), i.v != null ? el('b', { text: String(i.v) }) : null]))); }
export function ejeX(etiquetas) { return el('div', { class: 'eje-x' }, etiquetas.map(t => el('span', { text: t }))); }
export function filaBarra(etiqueta, valor, pct, color, href) {
  return el(href ? 'a' : 'div', { class: 'fila-barra' + (href ? ' enlace' : ''), href }, [el('span', { class: 'et', text: etiqueta }), el('b', { text: valor }), grafico(progreso(pct, etiqueta + ' ' + valor, { color }), 'fina')]);
}
