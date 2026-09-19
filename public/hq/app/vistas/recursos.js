// Recursos / Cómputo (tarea 25 del rediseño HQ, lote 3 #1057, HQ 2.0.12): cuadro de mando con la línea de
// diseño de Hoy. Cuentas diego@ y team@ (omc_plan vía `cuentas`, hq-plan.py cada 15 min) con medidor y
// semáforo, y el coste de tokens de omc_uso vía `uso` (RPC omc_hq_uso): mes natural en curso con proyección,
// coste por día, por modelo, por agente y por sesión. Todo en USD a precio API: es el equivalente de lo que
// se consume con los planes Max, no una factura. Regla de coste: estas cifras solo viven aquí y en la ficha
// del agente, nunca en el Home. peni quedó retirada el 12-sep y no entra.
import { el, fecha } from '../ui.js';
import { donut, medidor, linea } from '../graficos.js';
import { panel, cifra, grafico, leyenda, ejeX, filaBarra } from '../cuadro.js';

export function peorPct(c) { return Math.max(Number(c?.pct_ventana) || 0, Number(c?.pct_semana) || 0); }
export function urgeTercera(cuentas) { const cs = (cuentas || []).filter(Boolean); return cs.length > 0 && cs.every(c => c.saturada === true || peorPct(c) >= 90); }
function color(p) { return p >= 95 ? 'rojo' : p >= 80 ? 'ambar' : 'verde'; }
function etiqueta(p) { return p >= 90 ? 'saturada' : p >= 80 ? 'justa' : 'libre'; }
function horasHasta(iso, ahora) { if (!iso) return null; const h = (new Date(iso) - ahora) / 36e5; return Number.isFinite(h) ? Math.max(0, Math.round(h * 10) / 10) : null; }
const pctEntero = x => Math.max(0, Math.min(100, Math.round(Number(x) || 0)));
const diaMes = iso => { const m = String(iso || '').match(/^\d{4}-(\d{2})-(\d{2})/); return m ? m[2] + '-' + m[1] : ''; };
const FUENTE = 'USD a precio API · fuente omc_uso';

export function usd(n) {
  n = Number(n) || 0; const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(1).replace('.', ',') + ' M USD';
  if (a >= 1e4) return (n / 1e3).toFixed(1).replace('.', ',') + ' k USD';
  return Math.round(n).toLocaleString('es-ES') + ' USD';
}
// Proyección lineal del mes natural en curso: lo gastado hasta hoy entre los días transcurridos, por los días
// del mes. El mes anterior viene completo, así que la comparación honesta es contra la proyección.
export function proyeccion(coste, ahora = new Date()) {
  const dia = ahora.getDate(), dias = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0).getDate();
  return (Number(coste) || 0) / dia * dias;
}
const FAMILIAS = [['Fable', /fable/, 'tinta'], ['Opus', /opus/, 'tinta-2'], ['Sonnet', /sonnet/, 'neutro-1'], ['Haiku', /haiku/, 'neutro-2']];
export function porModelo(filas) {
  const acum = new Map();
  for (const f of filas || []) {
    const fam = FAMILIAS.find(([, re]) => re.test(String(f.modelo || '').toLowerCase())) || ['otros', null, 'neutro-3'];
    const x = acum.get(fam[0]) || { l: fam[0], v: 0, color: fam[2] }; x.v += Number(f.coste) || 0; acum.set(fam[0], x);
  }
  return [...acum.values()].filter(x => x.v > 0).sort((a, b) => b.v - a.v);
}

// Un bloque por cuenta: medidor con el peor de semana y ventana, y una fila por cada una con su reinicio.
function bloqueCuenta(c, ahora) {
  const peor = peorPct(c), col = color(peor);
  const fila = (nombre, pct, fin) => { const p = pctEntero(pct), h = horasHasta(fin, ahora);
    return filaBarra(nombre + (fin ? ' · reinicio ' + fecha(fin, { hora: true }) + (h != null ? ' (en ' + h + ' h)' : '') : ''), p + ' %', p, color(p)); };
  // 'medidor-cuenta' y no 'medidor': tokens.css ya define un '.medidor' de 8px (barra lineal de otro
  // componente) y colisionaba por especificidad, aplastando el medidor circular a 8px con overflow oculto
  // y dejando la primera card de Computo vacia en apariencia (19-sep).
  return el('div', { class: 'medidor-cuenta ' + col }, [
    grafico(medidor(peor, (c.cuenta || c.clave || '?') + ' ' + peor + ' %', col)),
    el('p', { class: 'cifra-m', text: peor + ' %' }),
    el('p', {}, [el('span', { class: 'pill ' + col, text: etiqueta(peor) }), el('b', { text: ' ' + (c.cuenta || c.clave || '?') })]),
    fila('semana', c.pct_semana, c.semana_fin), fila('ventana 5 h', c.pct_ventana, c.ventana_fin),
    c.pct_semana_opus != null ? el('p', { class: 'sub', text: 'Opus: ' + c.pct_semana_opus + ' % de la semana' }) : null,
    (c.pausados || []).length ? el('p', { class: 'sub', text: 'pausados por ahorro: ' + c.pausados.join(', ') }) : null,
    el('p', { class: 'sub', text: c.minutos != null ? 'muestra de hace ' + c.minutos + ' min' : 'sin muestra' })]);
}
function panelCuentas(cuentas, ahora) {
  const tercera = urgeTercera(cuentas);
  return panel('Cuentas', '#recursos/computo', [
    cuentas.length ? el('div', { class: 'medidores cuentas' }, cuentas.map(c => bloqueCuenta(c, ahora)))
      : el('p', { class: 'mudo', text: 'Sin muestras de consumo en las últimas 48 h (hq-plan.py sube una cada 15 min).' }),
    tercera ? el('p', { class: 'aviso rojo', text: 'Todas las cuentas al 90 % o más de su ventana o semana: urge la tercera cuenta.' }) : null,
  ], 'ancho-2' + (tercera ? ' alerta' : ''));
}
const sinCoste = () => el('p', { class: 'mudo', text: 'sin datos de coste en omc_uso' });

function panelMes(u, ahora) {
  const c = Number(u?.mes?.coste) || 0, ant = Number(u?.mes_anterior) || 0, proy = proyeccion(c, ahora);
  return panel('Coste del mes', '#recursos/computo', c ? [
    cifra(usd(c), 'mes en curso hasta hoy · ' + FUENTE, ant ? { sentido: proy >= ant ? 'sube' : 'baja', texto: 'a este ritmo ' + usd(proy) + ' · mes anterior ' + usd(ant) } : null),
    u.mes.mensajes ? el('p', { class: 'sub', text: Number(u.mes.mensajes).toLocaleString('es-ES') + ' mensajes' }) : null,
  ] : [sinCoste()]);
}
function panelDias(u) {
  const ds = (u?.dias || []).filter(d => d && d.fecha);
  if (!ds.length) return panel('Coste por día', '#recursos/computo', [sinCoste()], 'ancho-2');
  const ult = ds[ds.length - 1], ult7 = ds.slice(-7), media = ult7.reduce((s, d) => s + (Number(d.coste) || 0), 0) / ult7.length;
  return panel('Coste por día', '#recursos/computo', [
    cifra(usd(ult.coste), 'día ' + diaMes(ult.fecha) + ' · media 7 días ' + usd(media)),
    grafico(linea(ds.map(d => d.coste), 'coste por día, últimos ' + ds.length + ' días', { alto: 40 })),
    ejeX([diaMes(ds[0].fecha), diaMes(ds[Math.floor(ds.length / 2)].fecha), diaMes(ult.fecha)]),
    el('p', { class: 'sub', text: FUENTE }),
  ], 'ancho-2');
}
function panelModelo(u) {
  const segs = porModelo(u?.por_agente_modelo);
  return panel('Por modelo', '#recursos/computo', segs.length ? [
    el('div', { class: 'donut-fila' }, [grafico(donut(segs, 'coste por modelo'), 'donut'), leyenda(segs.map(s => ({ ...s, v: usd(s.v) })))]),
  ] : [sinCoste()]);
}
function panelAgentes(u, S) {
  const nombres = new Map((S?.datos?.agentes || []).map(a => [a.id, a.nombre || a.id]));
  const top = (u?.por_agente || []).filter(a => Number(a.coste) > 0).slice(0, 8), max = Math.max(1, ...top.map(a => Number(a.coste)));
  return panel('Por agente', '#equipo/organigrama', top.length ? [
    el('div', { class: 'filas' }, top.map(a => filaBarra(a.agente ? nombres.get(a.agente) || a.agente : 'sin agente', usd(a.coste), 100 * a.coste / max, 'tinta',
      a.agente ? '#equipo/agente/' + encodeURIComponent(a.agente) : null))),
    el('p', { class: 'sub', text: 'mes en curso · ' + FUENTE }),
  ] : [sinCoste()], 'ancho-2');
}
function panelSesiones(u) {
  const top = (u?.por_sesion || []).filter(s => Number(s.coste) > 0).slice(0, 6), max = Math.max(1, ...top.map(s => Number(s.coste)));
  const nombre = s => s.titulo || String(s.ruta || '').split('/').filter(Boolean).pop() || String(s.sesion_id || '?').slice(0, 8);
  return panel('Por sesión', '#recursos/computo', top.length ? [
    el('div', { class: 'filas' }, top.map(s => filaBarra(nombre(s) + (s.ultimo ? ' · ' + diaMes(s.ultimo) : ''), usd(s.coste), 100 * s.coste / max, 'tinta-2'))),
    el('p', { class: 'sub', text: 'mes en curso · ' + FUENTE }),
  ] : [sinCoste()]);
}

export function render(raiz, S, arg, filtros, ahora = new Date()) {
  const cuentas = (S?.datos?.cuentas || []).filter(Boolean), u = S?.datos?.uso || {};
  raiz.append(el('h1', { text: 'Cómputo' }));
  // Cuentas y coste solo viajan en el payload del owner: al agente se le dice, no se le enseña un panel vacío.
  if (S?.datos?.rol && S.datos.rol !== 'owner') {
    raiz.append(el('p', { class: 'mudo', text: 'Cuentas y coste de cómputo solo visibles para Diego.' }));
    return;
  }
  raiz.append(el('div', { class: 'cuadro' }, [panelCuentas(cuentas, ahora), panelMes(u, ahora), panelModelo(u), panelDias(u), panelAgentes(u, S), panelSesiones(u)]));
  raiz.append(el('p', { class: 'mudo', text: 'Coste en USD a precio API (fuente omc_uso, mes natural): equivale a lo consumido con los planes Max, no es una factura. peni retirada el 12-sep: fuera del cómputo.' }));
}
