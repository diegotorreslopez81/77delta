// Operación/Licitaciones con la línea de diseño del cuadro de mando (#1057, HQ 2.0.7; regla de kit #221).
// Arriba cinco paneles: pipeline activo por mes de cierre, embudo (escala logarítmica), licitaciones por
// estado en donut, por decidir y próximos cierres. Debajo, filtros por enlace (estado y orden viajan en la
// ruta: #operacion/licitaciones?estado=decidir&orden=importe) más un buscador, y la lista en tarjetas ricas:
// estado, expediente, plazo con semáforo, importe grande, órgano y provincia, barra de plazo consumido,
// solvencia y enlaces (perfil, carpeta, PPT, PCAP). La cola en criba se sigue pintando agrupada por
// elegible, en filas compactas, porque son cientos. Decidir una licitación sigue viviendo en
// Reglas/Decisiones. La vista no gatea por rol: omc_hq_v2 solo sirve licitaciones al owner.
import { el, fecha, urlSegura } from '../ui.js';
import { sinAcentos } from '../estado.js';
import { embudo, enCriba, porElegible, porDecidir, ordenCierre, estadoDe, solvenciaTexto, pipelinePorMes, pendiente, ABIERTAS, DECIDIBLES } from '../licitaciones.js';
import { donut, barras, progreso } from '../graficos.js';
import { eurCorto, anchoLog, panel, cifra, grafico, leyenda, ejeX, filaBarra } from '../cuadro.js';

const DIA = 864e5;
const ACTIVAS = new Set(['Aprobada', 'Presentada']);
const COLOR_ESTADO = { Aprobada: 'tinta', Presentada: 'tinta-2', 'Por decidir': 'neutro-1', Pausada: 'neutro-2', Nueva: 'neutro-3' };
const importe = l => Number(l.importe) || 0;
const suma = rows => rows.reduce((s, l) => s + importe(l), 0);
function corto(t, n) { t = String(t || ''); return t.length > n ? t.slice(0, n - 1) + '…' : t; }

// Días hasta el cierre (negativo si ya pasó), contados por fecha de Madrid a medianoche UTC.
export function diasA(cierre, ahora = new Date()) {
  if (!cierre) return null;
  const c = Date.parse(String(cierre).slice(0, 10)), h = Date.parse(ahora.toISOString().slice(0, 10));
  return isNaN(c) ? null : Math.round((c - h) / DIA);
}
// Semáforo del plazo: rojo a 7 días o menos, ámbar a 14, verde más allá; cerrado en neutro.
export function plazo(cierre, ahora = new Date()) {
  const d = diasA(cierre, ahora);
  if (d == null) return { d, color: 'neutro-3', texto: 'sin fecha de cierre' };
  if (d < 0) return { d, color: 'neutro-2', texto: 'cerró hace ' + -d + ' d' };
  return { d, color: d <= 7 ? 'rojo' : d <= 14 ? 'ambar' : 'verde', texto: d === 0 ? 'cierra hoy' : 'cierra en ' + d + ' d' };
}
// Porcentaje del plazo consumido entre la detección y el cierre (null si falta alguna fecha).
export function plazoConsumido(l, ahora = new Date()) {
  const a = Date.parse(l.detectada || ''), c = Date.parse(String(l.cierre || '').slice(0, 10));
  if (isNaN(a) || isNaN(c) || c <= a) return null;
  return Math.max(0, Math.min(100, Math.round(100 * (ahora.getTime() - a) / (c - a))));
}

// Filtros de la lista: estado (activas por defecto), orden (cierre por defecto) y texto libre sin acentos.
export const FILTROS = [['activas', 'Activas'], ['decidir', 'Por decidir'], ['pausadas', 'Pausadas'], ['criba', 'En criba']];
export function porFiltro(lics, estado = 'activas') {
  const rows = lics || [];
  if (estado === 'decidir') return porDecidir(rows);
  if (estado === 'criba') return enCriba(rows);
  if (estado === 'pausadas') return rows.filter(l => estadoDe(l) === 'Pausada');
  return rows.filter(l => ACTIVAS.has(estadoDe(l)));
}
export function ordenar(rows, orden = 'cierre') {
  return [...rows].sort(orden === 'importe' ? (a, b) => importe(b) - importe(a) || ordenCierre(a, b) : ordenCierre);
}
export function buscar(rows, texto) {
  const q = sinAcentos(texto).trim();
  if (!q) return rows;
  return rows.filter(l => sinAcentos([l.expediente, l.resumen_corto, l.objeto, l.organo, l.provincia].join(' ')).includes(q));
}

// Paneles del cuadro.
function panelPipeline(lics, ahora) {
  const act = lics.filter(l => ACTIVAS.has(estadoDe(l))), meses = pipelinePorMes(lics, ahora);
  const nA = act.filter(l => estadoDe(l) === 'Aprobada').length, nP = act.length - nA;
  return panel('Pipeline activo', '#operacion/licitaciones?estado=activas', [
    cifra(eurCorto(suma(act)), nA + ' aprobadas · ' + nP + ' presentadas · sin IVA'),
    grafico(barras(meses.map(m => ({ partes: [{ v: m.presentada, color: 'tinta' }, { v: m.aprobada, color: 'neutro-2' }] })), 'importe por mes de cierre'), 'barras'),
    ejeX(meses.map(m => m.etiqueta)),
    leyenda([{ color: 'tinta', l: 'presentadas' }, { color: 'neutro-2', l: 'aprobadas' }]),
  ], 'ancho-2');
}
function panelEmbudo(lics, kpis, resumen) {
  const filas = embudo(lics, kpis, resumen).filter(f => f.n > 0 || ['aprobadas', 'presentadas', 'adjudicadas'].includes(f.clave));
  const max = Math.max(1, ...filas.map(f => f.n)), tasa = kpis['lic.tasa_exito'], act = kpis['lic.actualizado'];
  return panel('Embudo', '#operacion/licitaciones', [
    el('div', { class: 'filas' }, filas.map(f => filaBarra(f.nombre, f.n.toLocaleString('es-ES'), anchoLog(f.n, max), f.clave === 'presentadas' ? 'oro' : 'tinta-2'))),
    tasa?.valor != null ? el('p', { class: 'sub', text: 'tasa de éxito ' + tasa.valor + ' %' }) : null,
    act?.texto ? el('p', { class: 'sub', text: 'barrido actualizado ' + act.texto }) : null,
  ]);
}
function panelEstados(lics) {
  const cuenta = {};
  for (const l of lics) { const e = estadoDe(l); if (COLOR_ESTADO[e]) cuenta[e] = (cuenta[e] || 0) + 1; }
  const segs = Object.keys(COLOR_ESTADO).filter(e => cuenta[e]).map(e => ({ l: e, v: cuenta[e], color: COLOR_ESTADO[e] }));
  const total = segs.reduce((s, x) => s + x.v, 0);
  return panel('Por estado', '#operacion/licitaciones', [
    el('div', { class: 'donut-fila' }, [el('div', { class: 'donut' }, [grafico(donut(segs, 'licitaciones abiertas por estado')), el('span', { class: 'centro', text: String(total) })]), leyenda(segs)]),
  ]);
}
function panelDecidir(lics) {
  const pd = porDecidir(lics);
  return panel('Por decidir', '#reglas/decisiones', [
    cifra(String(pd.length), pd.length ? eurCorto(suma(pd)) + ' sin IVA en juego' : 'nada pendiente'),
    pd.length ? el('ul', { class: 'lista-corta' }, pd.slice(0, 3).map(l => el('li', { text: corto(l.resumen_corto || l.objeto || l.expediente, 60) + ' · ' + plazo(l.cierre).texto }))) : null,
  ], pd.length ? 'alerta' : null);
}
function panelCierres(lics, ahora) {
  const prox = ordenar(lics.filter(l => estadoDe(l) === 'Aprobada' && (diasA(l.cierre, ahora) ?? -1) >= 0), 'cierre');
  const p = prox[0] ? plazo(prox[0].cierre, ahora) : null;
  return panel('Próximos cierres', '#operacion/licitaciones?estado=activas', [
    cifra(p ? (p.d === 0 ? 'hoy' : p.d + ' d') : '-', p ? 'hasta el siguiente cierre de una aprobada' : 'sin aprobadas por cerrar'),
    prox.length ? el('ul', { class: 'lista-corta' }, prox.slice(0, 3).map(l => el('li', { text: fecha(l.cierre) + ' · ' + corto(l.resumen_corto || l.objeto || l.expediente, 50) }))) : null,
  ], p && p.d <= 7 ? 'alerta' : null);
}

// Tarjeta rica de una licitación.
export function tarjetaLic(l, ahora = new Date()) {
  const p = plazo(l.cierre, ahora), cons = plazoConsumido(l, ahora), est = estadoDe(l);
  const enlaces = [['Perfil', l.enlace], ['Carpeta', l.carpeta], ['PPT', l.ppt], ['PCAP', l.pcap]].map(([t, u]) => [t, urlSegura(u)]).filter(x => x[1]);
  const solv = solvenciaTexto(l);
  return el('article', { class: 'tarjeta-lic' }, [
    el('div', { class: 'cab' }, [
      el('span', { class: 'pill estado' }, [el('i', { class: 'punto g-' + (COLOR_ESTADO[est] || 'neutro-3') }), est]),
      l.expediente ? el('span', { class: 'pill codigo', text: l.expediente }) : null,
      el('span', { class: 'plazo' }, [el('i', { class: 'punto g-' + p.color }), p.texto]),
    ]),
    el('h3', { text: corto(l.resumen_corto || l.objeto || l.expediente, 140) }),
    l.organo || l.provincia || l.procedimiento ? el('p', { class: 'sub', text: [l.organo, l.provincia, l.procedimiento].filter(Boolean).join(' · ') }) : null,
    el('div', { class: 'lic-cifra' }, [el('p', { class: 'cifra-l', text: l.importe ? eurCorto(l.importe) : 'importe sin dato' }), l.importe ? el('span', { class: 'sub', text: 'sin IVA' }) : null,
      l.decision && l.decision !== 'Pendiente' ? el('span', { class: 'pill', text: 'decisión ' + l.decision }) : null]),
    cons != null ? el('div', { class: 'plazo-barra' }, [grafico(progreso(cons, 'plazo consumido ' + cons + ' %', { color: p.color === 'rojo' ? 'rojo' : 'tinta-2' }), 'fina'), el('span', { class: 'sub', text: cons + ' % del plazo consumido' })]) : null,
    solv !== 'sin dato' ? el('p', { class: 'solv', text: 'Solvencia: ' + solv }) : null,
    el('div', { class: 'enlaces' }, [
      ...enlaces.map(([t, u]) => el('a', { class: 'btn-enlace', href: u, target: '_blank', rel: 'noopener', text: t })),
      pendiente(l) && ABIERTAS.has(est) && DECIDIBLES.has(l.elegible) ? el('a', { class: 'btn-enlace', href: '#reglas/decisiones', text: 'Decidir' }) : null,
    ]),
  ]);
}

function filaCriba(l) {
  const perfil = urlSegura(l.enlace);
  const texto = [l.expediente, l.resumen_corto || l.objeto, l.cierre ? 'cierra ' + fecha(l.cierre) : null, l.importe ? eurCorto(l.importe) + ' sin IVA' : null].filter(Boolean).join(' · ');
  return el('p', {}, [texto, perfil ? el('a', { class: 'btn-enlace', href: perfil, target: '_blank', rel: 'noopener', text: 'Perfil' }) : null]);
}
function grupoCriba([nombre, rows], abierto) {
  return el('details', { class: 'grupo-criba', open: abierto }, [el('summary', { text: nombre + ' (' + rows.length + ')' }), ...rows.map(filaCriba)]);
}

export function render(raiz, S, arg, filtrosRuta = {}, ahora = new Date()) {
  const d = S.datos || {};
  const lics = d.licitaciones || [], resumen = d.lic_resumen || {}, kpis = d.kpis || {};
  if (!lics.length && !Object.keys(resumen).length) { raiz.append(el('p', { class: 'mudo', text: 'sin licitaciones' })); return; }
  const estado = FILTROS.some(f => f[0] === filtrosRuta.estado) ? filtrosRuta.estado : 'activas';
  const orden = filtrosRuta.orden === 'importe' ? 'importe' : 'cierre';
  const ruta = (e, o) => '#operacion/licitaciones?estado=' + e + (o === 'importe' ? '&orden=importe' : '');

  raiz.append(el('div', { class: 'cuadro' }, [panelPipeline(lics, ahora), panelEmbudo(lics, kpis, resumen), panelEstados(lics), panelDecidir(lics), panelCierres(lics, ahora)]));

  const base = ordenar(porFiltro(lics, estado), orden);
  const lista = el('div', { class: estado === 'criba' ? 'lista-criba' : 'lista-lic' });
  const pintarLista = texto => {
    const rows = buscar(base, texto);
    lista.innerHTML = '';
    if (!rows.length) { lista.append(el('p', { class: 'mudo', text: 'nada con este filtro' })); return; }
    if (estado === 'criba') porElegible(rows).forEach((g, i) => lista.append(grupoCriba(g, i === 0)));
    else rows.forEach(l => lista.append(tarjetaLic(l, ahora)));
  };
  raiz.append(el('div', { class: 'filtros-lic' }, [
    el('div', { class: 'chips' }, FILTROS.map(([k, t]) => el('a', { class: 'chip' + (k === estado ? ' activo' : ''), href: ruta(k, orden), text: t + ' ' + porFiltro(lics, k).length }))),
    el('div', { class: 'chips' }, [['cierre', 'por cierre'], ['importe', 'por importe']].map(([k, t]) => el('a', { class: 'chip' + (k === orden ? ' activo' : ''), href: ruta(estado, k), text: t }))),
    el('input', { class: 'campo mini', type: 'search', placeholder: 'Buscar expediente, objeto u órgano', 'aria-label': 'Buscar licitación', oninput: e => pintarLista(e.target.value) }),
  ]));
  raiz.append(lista);
  pintarLista('');
}
