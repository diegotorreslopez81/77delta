import { el, eur } from '../ui.js';
function metaTexto(o) { return (!o.unidad || o.unidad === 'EUR') ? eur(o.meta) : o.meta + ' ' + o.unidad; }
export function render(raiz, S) {
  const d = S.derivado;
  for (const o of d.objetivos) raiz.append(el('section', { class: 'objetivo' }, [el('p', { class: 'mudo', text: 'Objetivo ' + o.horizonte }), el('h1', { text: o.titulo || metaTexto(o) }), el('p', { class: 'mudo', text: 'contratado ' + eur(o.contratado_eur) + ' · presentado ' + eur(o.presentado_eur) })]));
  for (const b of d.bloques) raiz.append(el('section', { class: 'bloque' }, [
    el('div', { class: 'fila bloque-cab' }, [el('span', { class: 'pill codigo', text: b.letra }), el('h2', { text: b.nombre }), el('span', { class: 'mudo', text: (b.meta_eur ? eur(b.meta_eur) + ' · ' : '') + b.abiertos + ' abiertos' + (b.rojos ? ' · ' + b.rojos + ' rojos' : '') })]),
    el('div', { class: 'frentes' }, b.frentes.map(f => el('a', { class: 'tarjeta frente enlace' + (f.encargos_abiertos ? '' : ' vacio'), href: '#tablero/f/' + f.codigo }, [
      el('div', { class: 'fila' }, [el('span', { class: 'pill codigo', text: f.codigo }), el('strong', { text: f.linea })]),
      el('p', { class: 'mudo', text: [f.responsable, f.kpi ? f.kpi + ': ' + (f.valor_actual ?? '?') + (f.meta != null ? ' / ' + f.meta : '') + (f.unidad ? ' ' + f.unidad : '') : null, f.encargos_abiertos + ' abiertos'].filter(Boolean).join(' · ') })])))]));
  if (!d.bloques.length) raiz.append(el('p', { class: 'mudo', text: 'Sin bloques: ejecuta el plan 1 (T3) o revisa omc_hq_v2.' }));
}
