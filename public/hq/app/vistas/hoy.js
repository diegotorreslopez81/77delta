// Hoy (orden de Diego, 17-sep): cuadro de mando del CEO. Un vistazo, no una vista donde actuar: sin
// listas de tarjetas ni botones, cada panel es un enlace a la vista donde sí se actúa.
// HQ 2.0.6 (#1056, 18-sep): Diego dijo NO al Home 2.0.5 ("no es fácil de digerir") y aprobó un cuadro
// visual: rejilla de paneles con cifra grande, tendencia y gráfico en SVG propio (graficos.js), texto
// mínimo y paleta de marca (tinta, oro de acento, neutros; verde, ámbar y rojo solo en semáforos).
// Aquí nunca sale el coste en EUR de tokens: eso vive solo en Recursos/Cómputo (spec §8).
import { el, eur, fecha } from '../ui.js';
import { COLUMNAS, enCurso, prorrateo, cierres, semaforoCuentas } from '../estado.js';
import { tarjetaEncargo } from '../tarjeta.js';
import { urgeTercera, peorPct } from './recursos.js';
import { donut, barras, apilada, progreso, medidor, linea } from '../graficos.js';

const DOS_HORAS = 2 * 36e5, DIA = 864e5;
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const INICIAL = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
function bloque(titulo, kids, vacio) { return el('section', { class: 'seccion' }, [el('h2', { text: titulo }), ...(kids.length ? kids : [el('p', { class: 'mudo', text: vacio })])]); }
function corto(t, n = 60) { t = String(t || ''); return t.length > n ? t.slice(0, n - 1) + '…' : t; }
// Valor numérico de un KPI del payload (`kpis[clave] = {valor, texto, updated_at}`); null si no viaja.
function kpi(clave, kpis) { const k = (kpis || {})[clave]; return k && k.valor != null ? Number(k.valor) : null; }
function haceTexto(ms) { const m = Math.max(0, Math.round(ms / 6e4)); return m < 60 ? 'hace ' + m + ' min' : 'hace ' + Math.floor(m / 60) + ' h'; }
const dia = t => new Date(t).toISOString().slice(0, 10);
const pctDe = (v, m) => (Number(m) > 0 ? Math.round(100 * (Number(v) || 0) / Number(m)) : 0);
// Ancho logarítmico para el embudo: 2.977 detectadas y 9 presentadas caben en la misma escala.
const anchoLog = (v, max) => (v > 0 ? Math.max(3, Math.round(100 * Math.log10(v + 1) / Math.log10(max + 1))) : 0);

// Euros compactos para las cifras grandes: 2,3 M EUR, 228 k EUR; por debajo de 10.000, eur() entero.
export function eurCorto(n) {
  n = Number(n) || 0; const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(1).replace('.', ',') + ' M EUR';
  if (a >= 1e4) return Math.round(n / 1e3) + ' k EUR';
  return eur(Math.round(n));
}
// Urgentes: prioridad 1 o 2 (1 es la más alta), o vencimiento en menos de 24 h (o ya vencida).
export function urgentes(pendientes, ahora = new Date()) {
  const limite = ahora.getTime() + 24 * 36e5;
  return (pendientes || []).filter(p => {
    const pr = Number(p.prioridad);
    return (pr >= 1 && pr <= 2) || (p.vence && new Date(p.vence).getTime() <= limite);
  }).sort((a, b) => ((Number(a.prioridad) || 9) - (Number(b.prioridad) || 9)) || String(a.vence || '9').localeCompare(String(b.vence || '9')));
}
// Agentes con actividad reciente: sesión abierta (sesion_url_fecha) o último encargo (ultima_actividad)
// hace menos de 2 h, los inactivos fuera; el más reciente primero.
export function activosRecientes(agentes, ahora = new Date()) {
  return (agentes || []).map(a => {
    const ts = [a.sesion_url_fecha, a.ultima_actividad].filter(Boolean).map(x => new Date(x).getTime()).filter(x => !isNaN(x));
    return { ...a, _ts: ts.length ? Math.max(...ts) : null };
  }).filter(a => a.activo !== false && a._ts != null && ahora.getTime() - a._ts < DOS_HORAS).sort((a, b) => b._ts - a._ts);
}
// Pipeline por mes de cierre: importe de las licitaciones aprobadas y presentadas en `meses` columnas
// desde el mes en curso; lo anterior cae en la primera y lo posterior en la última ("feb+").
export function pipelinePorMes(licitaciones, ahora = new Date(), meses = 6) {
  const y0 = ahora.getUTCFullYear(), m0 = ahora.getUTCMonth();
  const cols = Array.from({ length: meses }, (_, i) => ({ etiqueta: MESES[(m0 + i) % 12] + (i === meses - 1 ? '+' : ''), presentada: 0, aprobada: 0 }));
  for (const l of licitaciones || []) {
    const est = String(l.estado || '').toLowerCase();
    if (est !== 'aprobada' && est !== 'presentada') continue;
    const c = l.cierre ? new Date(l.cierre) : null;
    const i = c && !isNaN(c) ? (c.getUTCFullYear() - y0) * 12 + c.getUTCMonth() - m0 : 0;
    cols[Math.min(meses - 1, Math.max(0, i))][est] += Number(l.importe) || 0;
  }
  return cols;
}
// Embudo acumulado desde lic_resumen (estados excluyentes): lo presentado incluye lo ya resuelto.
export function embudoLicitaciones(lr = {}) {
  const n = k => Number((lr[k] || {}).n) || 0;
  const adj = n('adjudicadas') + n('contratadas'), pres = n('presentadas') + n('no_adjudicadas') + adj;
  return [['Detectadas', n('total')], ['Sin descartar', Math.max(0, n('total') - n('descartadas'))], ['Aprobadas', n('aprobadas') + pres], ['Presentadas', pres], ['Adjudicadas', adj]]
    .map(([l, v]) => ({ l, n: v }));
}
// Avances por día (UTC, como el resto del Home) en los últimos `dias` días, hoy el último.
export function avancesPorDia(avances, ahora = new Date(), dias = 3) {
  const claves = Array.from({ length: dias }, (_, i) => dia(ahora.getTime() - (dias - 1 - i) * DIA));
  const c = Object.fromEntries(claves.map(k => [k, 0]));
  for (const a of avances || []) if (a.fecha && dia(a.fecha) in c) c[dia(a.fecha)]++;
  return claves.map(k => ({ dia: k, n: c[k] }));
}
// Hitos de los próximos `dias` días (cierres() de estado.js) repartidos por día, con los parados aparte.
export function cierresPorDia(encargos, ahora = new Date(), dias = 7) {
  const cs = cierres(encargos, ahora, dias);
  return Array.from({ length: dias + 1 }, (_, i) => dia(ahora.getTime() + i * DIA)).map(k => {
    const del = cs.filter(e => String(e.fecha_hito).slice(0, 10) === k);
    return { dia: k, n: del.length, rojos: del.filter(e => e.rojo).length };
  }).filter(x => x.dia > dia(ahora.getTime()) || x.n);
}
export function porColumna(encargos) {
  const c = Object.fromEntries(COLUMNAS.map(x => [x[0], 0]));
  for (const e of encargos || []) if (e.columna in c) c[e.columna]++;
  return c;
}

// Piezas comunes de un panel: título que es el enlace (estirado a todo el panel por CSS), cifra grande
// con subtítulo y tendencia, gráfico y leyenda.
function panel(titulo, href, kids, clase) {
  return el('section', { class: 'panel-kpi' + (clase ? ' ' + clase : '') }, [el('h2', {}, [el('a', { class: 'estirado', href, text: titulo })]), ...kids.filter(Boolean)]);
}
function cifra(valor, sub, tend) {
  return el('div', { class: 'cifra-bloque' }, [el('p', { class: 'cifra-xl', text: valor }), sub ? el('p', { class: 'sub', text: sub }) : null,
    tend ? el('p', { class: 'tend ' + tend.sentido, text: (tend.sentido === 'sube' ? '▲ ' : tend.sentido === 'baja' ? '▼ ' : '') + tend.texto }) : null]);
}
const grafico = (svgTxt, clase) => el('div', { class: 'graf' + (clase ? ' ' + clase : ''), html: svgTxt });
function leyenda(items) { return el('ul', { class: 'leyenda' }, items.map(i => el('li', {}, [el('i', { class: 'punto g-' + i.color }), el('span', { text: i.l }), i.v != null ? el('b', { text: String(i.v) }) : null]))); }
function ejeX(etiquetas) { return el('div', { class: 'eje-x' }, etiquetas.map(t => el('span', { text: t }))); }
function filaBarra(etiqueta, valor, pct, color, href) {
  return el(href ? 'a' : 'div', { class: 'fila-barra' + (href ? ' enlace' : ''), href }, [el('span', { class: 'et', text: etiqueta }), el('b', { text: valor }), grafico(progreso(pct, etiqueta + ' ' + valor, { color }), 'fina')]);
}

// Franja de semáforos: lo que pide atención ahora, una píldora por alerta (o "sin alertas" en verde).
function franja(d, urg) {
  const sesiones = (d.sesiones || []).filter(x => x.estado !== 'cerrada').length;
  const parados = (d.encargos || []).filter(e => e.rojo).length;
  const correo = kpi('correo.pendientes.n', d.kpis) || 0;
  const tercera = kpi('cuentas.urge_tercera', d.kpis) === 1 || urgeTercera(d.cuentas);
  const pills = [
    urg ? ['rojo', urg + ' urgentes tuyas', '#reglas/decisiones'] : null,
    parados ? ['rojo', parados + ' encargos parados', '#operacion/tablero'] : null,
    tercera ? ['rojo', 'cuentas saturadas', '#recursos/computo'] : null,
    correo ? ['ambar', correo + ' correos sin contestar', '#operacion/expedientes'] : null,
    sesiones ? ['ambar', sesiones + ' sesiones abiertas', '#operacion/expedientes'] : null,
  ].filter(Boolean);
  return el('div', { class: 'franja' }, (pills.length ? pills : [['verde', 'sin alertas', '#operacion/tablero']]).map(([c, t, h]) => el('a', { class: 'semaforo-pill ' + c, href: h }, [el('i', { class: 'punto g-' + c }), el('span', { text: t })])));
}
// 1. Objetivo: contratado sobre la meta con la raya de lo que tocaría a hoy (prorrateo) y la desviación
// como tendencia; debajo, el reparto por bloque (contratado sobre su meta y encargos abiertos).
function panelObjetivo(dv, ahora) {
  const obs = [...(dv.objetivos || [])].sort((a, b) => Number(a.horizonte) - Number(b.horizonte));
  const o = obs.find(x => Number(x.horizonte) >= ahora.getUTCFullYear()) || obs[0];
  if (!o) return panel('Objetivo', '#direccion/objetivo', [el('p', { class: 'mudo', text: 'sin objetivo' })], 'ancho');
  const meta = Number(o.meta) || 0, contratado = Number(o.contratado_eur) || 0, alaFecha = prorrateo(meta, o.horizonte, ahora), desv = Math.round(contratado - alaFecha);
  const bloques = (dv.bloques || []).filter(b => Number(b.meta_eur) > 0).map(b => filaBarra(b.letra + ' · ' + b.nombre, eurCorto(b.contratado_eur) + ' de ' + eurCorto(b.meta_eur) + ' · ' + (b.abiertos ?? b.encargos_abiertos ?? 0) + ' abiertos', pctDe(b.contratado_eur, b.meta_eur), 'tinta-2'));
  const otros = obs.filter(x => x !== o).map(x => el('p', { class: 'sub', text: x.horizonte + ': ' + eurCorto(x.contratado_eur) + ' de ' + eurCorto(x.meta) }));
  return panel('Objetivo ' + o.horizonte, '#direccion/objetivo', [
    el('div', { class: 'dos-col' }, [
      el('div', {}, [
        cifra(eurCorto(contratado), 'contratado de ' + eurCorto(meta) + ' · ' + pctDe(contratado, meta) + ' %', { sentido: desv < 0 ? 'baja' : 'sube', texto: eurCorto(Math.abs(desv)) + (desv < 0 ? ' por debajo' : ' por encima') + ' de lo previsto a hoy' }),
        grafico(progreso(pctDe(contratado, meta), 'contratado ' + pctDe(contratado, meta) + ' % de la meta', { marca: pctDe(alaFecha, meta) }), 'gruesa'),
        leyenda([{ color: 'oro', l: 'contratado' }, { color: 'tinta', l: 'a hoy tocaría ' + eurCorto(alaFecha) }]),
        o.presentado_eur != null ? el('p', { class: 'sub', text: 'presentado ' + eurCorto(o.presentado_eur) }) : null, ...otros]),
      el('div', { class: 'filas' }, bloques)]),
  ], 'ancho');
}
// 2. Depende de ti: el número, el semáforo y las tres más urgentes en una línea cada una (sin anclas).
function panelDependeDeTi(pendientes, ahora) {
  const urg = urgentes(pendientes, ahora), hoyIso = dia(ahora.getTime());
  const vencenHoy = pendientes.filter(p => p.vence && String(p.vence).slice(0, 10) === hoyIso).length;
  return panel('Depende de ti', '#reglas/decisiones', [
    cifra(String(pendientes.length), urg.length + ' urgentes · ' + vencenHoy + ' vencen hoy'),
    grafico(apilada([{ v: urg.length, color: 'rojo' }, { v: pendientes.length - urg.length, color: 'neutro-2' }], urg.length + ' urgentes de ' + pendientes.length), 'fina'),
    urg.length ? el('ul', { class: 'lista-corta' }, urg.slice(0, 3).map(p => el('li', { text: (p.vence ? fecha(p.vence) : 'P' + p.prioridad) + ' · ' + corto(p.titulo, 48) }))) : null,
  ], urg.length ? 'alerta' : '');
}
// 3. Pipeline: importe en juego por mes de cierre, presentadas en tinta y aprobadas en neutro.
function panelPipeline(d, ahora) {
  const cols = pipelinePorMes(d.licitaciones, ahora);
  const pres = cols.reduce((s, c) => s + c.presentada, 0), apr = cols.reduce((s, c) => s + c.aprobada, 0);
  return panel('Pipeline de licitaciones', '#operacion/licitaciones', [
    cifra(eurCorto(pres + apr), 'en juego por mes de cierre'),
    grafico(barras(cols.map(c => ({ partes: [{ v: c.presentada, color: 'tinta' }, { v: c.aprobada, color: 'neutro-2' }] })), 'importe por mes de cierre')),
    ejeX(cols.map(c => c.etiqueta)),
    leyenda([{ color: 'tinta', l: 'presentadas', v: eurCorto(pres) }, { color: 'neutro-2', l: 'aprobadas', v: eurCorto(apr) }]),
  ]);
}
// 4. Embudo: de detectadas a adjudicadas en escala logarítmica; presentadas en oro (el acento).
function panelEmbudo(d) {
  const e = embudoLicitaciones(d.lic_resumen || {}), max = Math.max(1, ...e.map(x => x.n));
  return panel('Embudo de licitaciones', '#operacion/licitaciones', [
    cifra(String(e[3].n), 'presentadas de ' + e[0].n.toLocaleString('es-ES') + ' detectadas'),
    el('div', { class: 'filas' }, e.map(x => filaBarra(x.l, x.n.toLocaleString('es-ES'), anchoLog(x.n, max), x.l === 'Presentadas' ? 'oro' : 'tinta-2'))),
  ]);
}
// 5. Expedientes: donut por estado del embudo comercial, la cifra es el importe total.
function panelExpedientes(d) {
  const exps = d.expedientes || [], cuenta = {};
  for (const x of exps) cuenta[x.estado_funnel || 'sin estado'] = (cuenta[x.estado_funnel || 'sin estado'] || 0) + 1;
  const colores = ['tinta', 'tinta-2', 'neutro-1', 'neutro-2', 'neutro-3'];
  const segs = Object.entries(cuenta).sort((a, b) => b[1] - a[1]).map(([l, v], i) => ({ l, v, color: colores[Math.min(i, colores.length - 1)] }));
  const total = exps.reduce((s, x) => s + (Number(x.importe) || 0), 0);
  return panel('Expedientes', '#operacion/expedientes', [
    cifra(eurCorto(total), exps.length + ' expedientes'),
    el('div', { class: 'donut-fila' }, [el('div', { class: 'donut' }, [grafico(donut(segs, 'expedientes por estado')), el('span', { class: 'centro', text: String(exps.length) })]), leyenda(segs)]),
  ]);
}
// 6. Frentes: KPI de cada línea del plan con meta, ordenados por avance; 100 % o más en oro.
function panelFrentes(d) {
  const fs = (d.frentes || []).filter(f => f.kpi && Number(f.meta) > 0).map(f => ({ ...f, _p: pctDe(f.valor_actual, f.meta) })).sort((a, b) => b._p - a._p).slice(0, 6);
  const fmt = (v, f) => (!f.unidad || f.unidad === 'EUR' || /eur/i.test(f.kpi) ? eurCorto(v) : String(Number(v) || 0));
  return panel('Frentes', '#operacion/tablero', [
    el('div', { class: 'filas' }, fs.length ? fs.map(f => filaBarra(f.codigo + ' · ' + corto(f.kpi, 28), fmt(f.valor_actual, f) + ' / ' + fmt(f.meta, f) + ' · ' + f._p + ' %', f._p, f._p >= 100 ? 'oro' : 'tinta-2', '#operacion/tablero?frente=' + encodeURIComponent(f.codigo)))
      : [el('p', { class: 'mudo', text: 'sin KPIs con meta' })]),
  ]);
}
// 7. Encargos: reparto por columna del tablero en una barra apilada; bloqueados en rojo.
function panelEncargos(d) {
  const c = porColumna(d.encargos), parados = (d.encargos || []).filter(e => e.rojo).length;
  const colores = { backlog: 'neutro-3', por_hacer: 'neutro-2', en_curso: 'tinta', bloqueado: 'rojo', hecho: 'neutro-1' };
  const segs = COLUMNAS.map(([k, l]) => ({ l, v: c[k], color: colores[k] }));
  return panel('Encargos', '#operacion/tablero', [
    cifra(String(c.en_curso), 'en curso · ' + parados + ' parados'),
    grafico(apilada(segs, 'encargos por columna'), 'gruesa'),
    leyenda(segs),
  ], parados ? 'alerta' : '');
}
// 8. Cierres: hitos por día en la próxima semana, los parados en rojo; debajo, el siguiente.
function panelCierres(encargos, ahora) {
  const serie = cierresPorDia(encargos, ahora, 7), cs = cierres(encargos, ahora, 7), sig = cs[0];
  return panel('Cierres en 7 días', '#operacion/tablero', [
    cifra(String(cs.length), cs.length === 1 ? 'hito esta semana' : 'hitos esta semana'),
    grafico(barras(serie.map(x => ({ partes: [{ v: x.rojos, color: 'rojo' }, { v: x.n - x.rojos, color: 'tinta-2' }] })), 'hitos por día')),
    ejeX(serie.map(x => INICIAL[new Date(x.dia + 'T12:00:00Z').getUTCDay()] + ' ' + Number(x.dia.slice(8)))),
    sig ? el('p', { class: 'sub', text: 'siguiente: ' + fecha(sig.fecha_hito) + ' · #' + sig.id + ' ' + corto(sig.texto, 40) }) : null,
  ]);
}
// 9. Equipo: quién trabajó en las últimas 2 h (enlace a su ficha) y la tendencia de avances por día.
function panelEquipo(d, ahora) {
  const rec = activosRecientes(d.agentes, ahora), serie = avancesPorDia(d.avances, ahora, 3);
  const hoy = serie[serie.length - 1].n, ayer = serie.length > 1 ? serie[serie.length - 2].n : 0;
  const activos = (d.agentes || []).filter(a => a.activo !== false).length;
  return panel('Equipo', '#equipo/organigrama', [
    cifra(String(rec.length), 'trabajando en las últimas 2 h · ' + activos + ' activos · ' + enCurso(d.encargos).length + ' en curso',
      { sentido: hoy >= ayer ? 'sube' : 'baja', texto: hoy + ' avances hoy, ' + ayer + ' ayer' }),
    grafico(linea(serie.map(x => x.n), 'avances por día'), 'linea'),
    el('p', { class: 'fila-cifras' }, rec.slice(0, 6).map(a => el('a', { class: 'pill verde activo', href: '#equipo/agente/' + a.id, text: (a.nombre || a.id) + ' · ' + haceTexto(ahora.getTime() - a._ts) }))),
  ]);
}
// 10. Consumo: un medidor por cuenta con la semana (semáforo de estado.js) y la ventana de 5 h al lado.
function panelConsumo(d) {
  const cs = d.cuentas || [], tercera = kpi('cuentas.urge_tercera', d.kpis) === 1 || urgeTercera(cs);
  return panel('Consumo de cuentas', '#recursos/computo', [
    cs.length ? el('div', { class: 'medidores' }, cs.map(c => {
      const s = semaforoCuentas({ cuentas: [c] }) || { color: 'verde' };
      return el('div', { class: 'medidor' }, [grafico(medidor(c.pct_semana, c.cuenta + ' semana ' + (c.pct_semana ?? 0) + ' %', s.color)),
        el('p', { class: 'cifra-m', text: peorPct(c) + ' %' }), el('p', { class: 'sub', text: c.cuenta + ' · ventana ' + (c.pct_ventana ?? '-') + ' %' }),
        c.semana_fin ? el('p', { class: 'sub', text: 'reinicia ' + fecha(c.semana_fin, { hora: true }) }) : null]);
    })) : el('p', { class: 'mudo', text: 'sin muestras de consumo' }),
    tercera ? el('p', { class: 'aviso rojo', text: 'urge la tercera cuenta' }) : null,
  ], tercera ? 'alerta' : '');
}

export function render(raiz, S, arg, filtros, ahora = new Date()) {
  const d = S.datos || {};
  if (d.rol === 'owner') {
    const dv = S.derivado || { objetivos: [] };
    raiz.append(franja(d, urgentes(d.pendientes, ahora).length));
    raiz.append(el('div', { class: 'cuadro' }, [
      panelObjetivo(dv, ahora), panelDependeDeTi(d.pendientes || [], ahora), panelPipeline(d, ahora), panelEmbudo(d), panelExpedientes(d),
      panelFrentes(d), panelEncargos(d), panelCierres(d.encargos, ahora), panelEquipo(d, ahora), panelConsumo(d),
    ]));
  } else {
    // El token de agente no conoce su identidad en el payload (T4-c): se enseña lo que está en curso.
    raiz.append(bloque('Tus tarjetas', enCurso(d.encargos).map(e => tarjetaEncargo(e)), 'nada en curso'));
    const ses = (d.sesiones || []).filter(x => x.estado !== 'cerrada');
    raiz.append(bloque('Sesiones abiertas', ses.map(x => el('a', { class: 'tarjeta enlace', href: '#operacion/expedientes/' + x.expediente_id }, [
      el('p', { class: 'titulo', text: x.nombre + ' con ' + x.agente }), el('p', { class: 'mudo', text: x.estado + ' · ' + fecha(x.abierta || x.created_at, { hora: true }) })])), 'ninguna'));
  }
}
