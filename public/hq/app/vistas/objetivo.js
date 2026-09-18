// Plan estratégico (ruta #direccion/objetivo; tarea 26 del lote 3 #1057, HQ 2.0.13): cuadro con la línea de
// diseño de Hoy. Arriba un panel por objetivo (2026 y 2027): contratado frente a la meta con la raya del
// prorrateo y la desviación como tendencia. Debajo un panel por línea (A, B, C...) con su barra general
// (media del avance de sus actividades con meta), la de contratado frente a la meta de la línea y una barra
// por actividad (A1, A2...) que enlaza al tablero filtrado. Única casa del plan estratégico; va al final del
// menú por orden de Diego (17-sep). El alta y la edición de actividades siguen en hq.py plan-linea.
import { el } from '../ui.js';
import { prorrateo } from '../estado.js';
import { progreso } from '../graficos.js';
import { eurCorto, panel, cifra, grafico, leyenda, filaBarra } from '../cuadro.js';

const pctDe = (v, m) => (Number(m) > 0 ? Math.round(100 * (Number(v) || 0) / Number(m)) : 0);
const esEur = x => !x.unidad || x.unidad === 'EUR';
const fmt = (v, x) => (esEur(x) ? eurCorto(v) : (Number(v) || 0).toLocaleString('es-ES') + ' ' + x.unidad);
// Avance de una actividad: % de su KPI sobre la meta, con tope 100 para que una sola no infle la media.
export function avanceFrente(f) { return Number(f?.meta) > 0 ? Math.min(100, pctDe(f.valor_actual, f.meta)) : null; }
export function avanceBloque(b) {
  const ps = (b?.frentes || []).map(avanceFrente).filter(p => p != null);
  return ps.length ? Math.round(ps.reduce((s, p) => s + p, 0) / ps.length) : null;
}

function panelObjetivo(o, ahora) {
  const meta = Number(o.meta) || 0, contratado = Number(o.contratado_eur) || 0, alaFecha = prorrateo(meta, o.horizonte, ahora), desv = Math.round(contratado - alaFecha);
  const futuro = Number(o.horizonte) > ahora.getUTCFullYear(), p = pctDe(contratado, meta);
  return panel('Objetivo ' + o.horizonte, '#direccion/objetivo', [
    cifra(fmt(contratado, o), 'contratado de ' + fmt(meta, o) + ' · ' + p + ' %',
      futuro ? { sentido: '', texto: 'empieza a contar en ' + o.horizonte } : { sentido: desv < 0 ? 'baja' : 'sube', texto: eurCorto(Math.abs(desv)) + (desv < 0 ? ' por debajo' : ' por encima') + ' de lo previsto a hoy' }),
    grafico(progreso(p, 'contratado ' + p + ' % de la meta ' + o.horizonte, { marca: futuro ? null : pctDe(alaFecha, meta) }), 'gruesa'),
    leyenda([{ color: 'oro', l: 'contratado' }, futuro ? null : { color: 'tinta', l: 'a hoy tocaría ' + eurCorto(alaFecha) }].filter(Boolean)),
    el('p', { class: 'sub', text: (o.titulo ? o.titulo + ' · ' : '') + 'presentado ' + eurCorto(o.presentado_eur) }),
  ], 'ancho-2');
}

function filaFrente(f) {
  const p = avanceFrente(f);
  return filaBarra(f.codigo + ' · ' + (f.linea || f.kpi || ''), p == null ? 'sin meta' : fmt(f.valor_actual, f) + ' / ' + fmt(f.meta, f) + ' · ' + p + ' %',
    p || 0, p >= 100 ? 'oro' : 'tinta-2', '#operacion/tablero?frente=' + encodeURIComponent(f.codigo));
}
function panelBloque(b) {
  const av = avanceBloque(b), fs = b.frentes || [], conMeta = fs.filter(f => avanceFrente(f) != null).length;
  return panel(b.letra + ' · ' + b.nombre, '#operacion/tablero', [
    cifra(av == null ? 'sin KPIs' : av + ' %', av == null ? 'ninguna actividad con meta' : 'avance general · media de ' + conMeta + ' de ' + fs.length + ' actividades' + (b.director ? ' · dirige ' + b.director : '')),
    el('div', { class: 'filas' }, [
      filaBarra('Línea ' + b.letra + ' · general', av == null ? '-' : av + ' %', av || 0, 'tinta'),
      Number(b.meta_eur) > 0 ? filaBarra('Contratado frente a la meta de la línea', eurCorto(b.contratado_eur) + ' de ' + eurCorto(b.meta_eur), pctDe(b.contratado_eur, b.meta_eur), 'oro') : null,
      ...fs.map(filaFrente)]),
    el('p', { class: 'sub', text: (b.abiertos ?? b.encargos_abiertos ?? 0) + ' encargos abiertos' + (b.rojos ? ' · ' + b.rojos + ' rojos' : '') }),
  ], 'ancho-2');
}

export function render(raiz, S, arg, filtros, ahora = new Date()) {
  const d = S.derivado || { objetivos: [], bloques: [] };
  const obs = [...(d.objetivos || [])].sort((a, b) => Number(a.horizonte) - Number(b.horizonte));
  raiz.append(el('h1', { text: 'Plan estratégico' }));
  raiz.append(el('div', { class: 'cuadro' }, [...obs.map(o => panelObjetivo(o, ahora)), ...(d.bloques || []).map(panelBloque)]));
  if (!obs.length && !(d.bloques || []).length) raiz.append(el('p', { class: 'mudo', text: 'Sin objetivos ni líneas en el plan.' }));
  raiz.append(el('p', { class: 'mudo', text: 'Actividades: alta y edición con hq.py plan-linea. La meta de cada línea no está desglosada por año (2026 y 2027).' }));
}
