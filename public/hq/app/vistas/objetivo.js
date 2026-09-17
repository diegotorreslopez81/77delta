// Dirección/Objetivo (plan 3a): ¿vamos bien? Cuadro por objetivo (contratado, presentado, meta a la
// fecha y desviación) y los bloques con sus frentes y su KPI. Única casa del plan estratégico.
// Sustituye a plan.js. La edición de KPI y líneas sigue en hq.py plan-linea.
import { el, eur } from '../ui.js';
import { prorrateo } from '../estado.js';

function metaTexto(o) { return (!o.unidad || o.unidad === 'EUR') ? eur(o.meta) : o.meta + ' ' + o.unidad; }
function dato(etiqueta, valor, clase) { return el('div', { class: 'dato' + (clase ? ' ' + clase : '') }, [el('span', { class: 'mudo', text: etiqueta }), el('strong', { text: valor })]); }

export function render(raiz, S, arg, filtros, ahora = new Date()) {
  const d = S.derivado || { objetivos: [], bloques: [] };
  for (const o of d.objetivos) {
    const meta = Number(o.meta) || 0, contratado = Number(o.contratado_eur) || 0, alaFecha = prorrateo(meta, o.horizonte, ahora), desv = contratado - alaFecha;
    raiz.append(el('section', { class: 'objetivo' }, [
      el('p', { class: 'mudo', text: 'Objetivo ' + o.horizonte + ' · ' + (o.titulo || '') }),
      el('h1', { text: eur(contratado) + ' de ' + metaTexto(o) }),
      el('div', { class: 'datos' }, [
        dato('presentado', eur(o.presentado_eur)), dato('meta a la fecha', eur(Math.round(alaFecha))),
        dato('desviación', (desv < 0 ? '-' : '+') + eur(Math.abs(Math.round(desv))), desv < 0 ? 'mal' : 'bien')]),
      el('div', { class: 'barra' }, [el('i', { style: 'width:' + Math.min(100, 100 * contratado / (meta || 1)) + '%' })])]));
  }
  for (const b of d.bloques) raiz.append(el('section', { class: 'bloque' }, [
    el('div', { class: 'fila bloque-cab' }, [el('span', { class: 'pill codigo', text: b.letra }), el('h2', { text: b.nombre }), el('span', { class: 'mudo', text: (b.meta_eur ? eur(b.meta_eur) + ' · ' : '') + b.abiertos + ' abiertos' + (b.rojos ? ' · ' + b.rojos + ' rojos' : '') })]),
    el('div', { class: 'frentes' }, b.frentes.map(f => el('a', { class: 'tarjeta frente enlace' + (f.encargos_abiertos ? '' : ' vacio'), href: '#operacion/tablero?frente=' + f.codigo }, [
      el('div', { class: 'fila' }, [el('span', { class: 'pill codigo', text: f.codigo }), el('strong', { text: f.linea })]),
      el('p', { class: 'mudo', text: [f.responsable, f.kpi ? f.kpi + ': ' + (f.valor_actual ?? '?') + (f.meta != null ? ' / ' + f.meta : '') + (f.unidad ? ' ' + f.unidad : '') : null, f.encargos_abiertos + ' abiertos'].filter(Boolean).join(' · ') })])))]));
  if (!d.bloques.length) raiz.append(el('p', { class: 'mudo', text: 'Sin bloques en el plan.' }));
}
