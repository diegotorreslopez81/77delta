// Recursos / Cómputo (encargo #1054, tarea 13 del rediseño HQ): las cuentas diego@ y team@ con su % de semana
// y de ventana de 5 h, resets y antigüedad de la muestra. Datos: omc_plan (hq-plan.py cada 15 min) servidos en
// el payload como `cuentas` (RPC omc_cuentas_estado, solo owner). peni quedó retirada el 12-sep y no entra.
// Aviso cuando todas las cuentas activas están al 90 % o más: urge la tercera cuenta. El coste API por agente
// y por sesión (omc_uso) llega con Recursos/Dinero en la tanda 3 (#1057).
import { el, fecha } from '../ui.js';

export function peorPct(c) { return Math.max(Number(c?.pct_ventana) || 0, Number(c?.pct_semana) || 0); }
export function urgeTercera(cuentas) { const cs = (cuentas || []).filter(Boolean); return cs.length > 0 && cs.every(c => c.saturada === true || peorPct(c) >= 90); }
function color(p) { return p >= 95 ? 'rojo' : p >= 80 ? 'ambar' : 'verde'; }
function etiqueta(p) { return p >= 90 ? 'saturada' : p >= 80 ? 'justa' : 'libre'; }
function horasHasta(iso, ahora) { if (!iso) return null; const h = (new Date(iso) - ahora) / 36e5; return Number.isFinite(h) ? Math.max(0, Math.round(h * 10) / 10) : null; }

function barra(nombre, pct, fin, ahora) {
  const p = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
  const h = horasHasta(fin, ahora);
  return el('div', { class: 'consumo' }, [
    el('div', { class: 'fila' }, [
      el('span', { class: 'mudo', text: nombre }),
      el('strong', { text: p + ' %' }),
      el('span', { class: 'mudo', text: fin ? 'reinicio ' + fecha(fin, { hora: true }) + (h != null ? ' (en ' + h + ' h)' : '') : '' })]),
    el('div', { class: 'barra ' + color(p) }, [el('i', { style: 'width:' + p + '%' })])]);
}

function tarjeta(c, ahora) {
  const peor = peorPct(c);
  return el('section', { class: 'tarjeta cuenta ' + color(peor) }, [
    el('div', { class: 'fila' }, [
      el('h2', { text: c.cuenta || c.clave || '?' }),
      el('span', { class: 'pill ' + color(peor), text: etiqueta(peor) }),
      el('span', { class: 'mudo', text: c.minutos != null ? 'muestra de hace ' + c.minutos + ' min' : 'sin muestra' })]),
    barra('semana', c.pct_semana, c.semana_fin, ahora),
    barra('ventana 5 h', c.pct_ventana, c.ventana_fin, ahora),
    c.pct_semana_opus != null ? el('p', { class: 'mudo', text: 'Opus: ' + c.pct_semana_opus + ' % de la semana' }) : null,
    (c.pausados || []).length ? el('p', { class: 'mudo', text: 'pausados por ahorro: ' + c.pausados.join(', ') }) : null]);
}

export function render(raiz, S, arg, filtros, ahora = new Date()) {
  const cuentas = (S?.datos?.cuentas || []).filter(Boolean);
  raiz.append(el('h1', { text: 'Cómputo' }));
  if (urgeTercera(cuentas)) raiz.append(el('p', { class: 'aviso rojo', text: 'Todas las cuentas al 90 % o más de su ventana o semana: urge la tercera cuenta.' }));
  if (!cuentas.length) raiz.append(el('p', { class: 'mudo', text: 'Sin muestras de consumo en las últimas 48 h (hq-plan.py sube una cada 15 min).' }));
  for (const c of cuentas) raiz.append(tarjeta(c, ahora));
  raiz.append(el('p', { class: 'mudo', text: 'peni retirada el 12-sep: fuera del cómputo. Coste API por agente y sesión: llega con Dinero en la tanda 3.' }));
}
