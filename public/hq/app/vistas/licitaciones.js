// Operación/Licitaciones (#1057, tarjetas ricas HQ 2.0.15; hallazgo de Diego con capturas: la tarjeta
// vieja media unos 14.000 px de alto en móvil y usaba '.cab', la barra oscura del header, con texto
// oscuro encima casi invisible). Tarjeta nueva: colapsada por defecto (etiquetas, título, órgano),
// clic o Intro/espacio despliega objeto completo, solvencia, expediente y enlaces. El cuadro de los
// cinco paneles se va a Operación/KPIs (grupo licitaciones); aquí queda un enlace. La cola en criba
// sigue en filas compactas agrupadas por elegible. Decidir una licitación sigue en Reglas/Decisiones.
// La vista no gatea por rol: omc_hq_v2 solo sirve licitaciones al owner.
import { el, fecha, urlSegura } from '../ui.js';
import { sinAcentos } from '../estado.js';
import { embudo, enCriba, porElegible, porDecidir, ordenCierre, estadoDe, solvenciaTexto, pipelinePorMes, pendiente, ABIERTAS, DECIDIBLES, tipologia, TIPOLOGIAS, filtrar, motivosNo, MOTIVOS_NO, enlacesLic } from '../licitaciones.js';
import { donut, barras } from '../graficos.js';
import { eurCorto, anchoLog, panel, cifra, grafico, leyenda, ejeX, filaBarra } from '../cuadro.js';

const ACTIVAS = new Set(['Aprobada', 'Presentada']);

// #1063: las descartadas no viajan en omc_hq_v2 (peso), asi que la pestana 'descartadas' las pide a
// omc_licitaciones_descartadas al entrar (por motivo, tope 300) y las cachea en S cinco minutos. api.js
// se importa en diferido porque toca location/localStorage al cargarse y los tests importan esta vista
// sin DOM; usarCargador() permite a los tests sustituir la RPC por una funcion propia.
let cargador = async motivo => (await import('../api.js')).rpc('omc_licitaciones_descartadas', { p_motivo: motivo || null, p_limite: 300 });
export function usarCargador(fn) { cargador = fn; }
const CACHE_MS = 5 * 60e3;
let turno = 0;
const COLOR_ESTADO = { Aprobada: 'tinta', Presentada: 'tinta-2', 'Por decidir': 'neutro-1', Pausada: 'neutro-2', Nueva: 'neutro-3' };
const DIA = 864e5;
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
// Porcentaje del plazo consumido entre la detección y el cierre (null si falta alguna fecha). Ya no
// se pinta en la tarjeta (recorte de alto en móvil), pero se mantiene: la usan otras vistas/tests.
export function plazoConsumido(l, ahora = new Date()) {
  const a = Date.parse(l.detectada || ''), c = Date.parse(String(l.cierre || '').slice(0, 10));
  if (isNaN(a) || isNaN(c) || c <= a) return null;
  return Math.max(0, Math.min(100, Math.round(100 * (ahora.getTime() - a) / (c - a))));
}

// Filtros de la lista: estado (activas por defecto), orden (cierre por defecto) y texto libre sin acentos.
export const FILTROS = [['activas', 'Activas'], ['decidir', 'Por decidir'], ['pausadas', 'Pausadas'], ['criba', 'En criba']];
// 'descartadas' no tiene chip propio (no se pide una pestaña nueva): solo llega por URL desde el panel
// "Por qué no vamos" de KPIs, para poder ver y filtrar por motivo las descartadas sin tocar FILTROS.
const ESTADOS_VALIDOS = new Set([...FILTROS.map(f => f[0]), 'descartadas']);
export function porFiltro(lics, estado = 'activas') {
  const rows = lics || [];
  if (estado === 'decidir') return porDecidir(rows);
  if (estado === 'criba') return enCriba(rows);
  if (estado === 'pausadas') return rows.filter(l => estadoDe(l) === 'Pausada');
  if (estado === 'descartadas') return rows.filter(l => estadoDe(l) === 'Descartada');
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

// Paneles del cuadro (se mueven a Operación/KPIs vía panelesLicitaciones; se dejan intactos aquí como
// funciones internas para que ese export los reutilice sin duplicar código).
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
  return panel('Por decidir', '#hoy/bandeja', [
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
// Grupo 'Licitaciones' de Operación/KPIs (#1057 tarea 29): mismos 5 paneles que antes encabezaban esta
// vista, ahora reutilizados desde kpis.js sin duplicar código ni tocar más de esta vista.
export function panelesLicitaciones(d, ahora = new Date()) {
  const lics = d.licitaciones || [], resumen = d.lic_resumen || {}, kpis = d.kpis || {};
  return [panelPipeline(lics, ahora), panelEmbudo(lics, kpis, resumen), panelEstados(lics), panelDecidir(lics), panelCierres(lics, ahora)];
}

// Tarjeta rica de una licitación: colapsada por defecto, clic/Intro/espacio despliega el detalle. Sin
// '.cab' (esa clase es la barra superior oscura de la app, aquí pintaba el header casi ilegible).
function alternar(art) {
  const abierto = art.getAttribute('aria-expanded') === 'true';
  art.setAttribute('aria-expanded', String(!abierto));
}
export function tarjetaLic(l, ahora = new Date()) {
  const p = plazo(l.cierre, ahora), est = estadoDe(l);
  const enlaces = enlacesLic(l).map(([t, u]) => [t, urlSegura(u)]).filter(x => x[1]);
  const solv = solvenciaTexto(l);
  const tipo = tipologia(l.organo);
  // #1063: motivos de NO como tags neutros (misma clase 'pill' que tipo/procedimiento, nunca oro), solo
  // en descartadas; si no tiene ninguno del catalogo, un tag "sin motivo" en vez de dejarlo en blanco.
  const motivos = est === 'Descartada' ? motivosNo(l) : [];
  const tagsMotivo = est === 'Descartada'
    ? (motivos.length ? motivos.map(m => el('span', { class: 'pill', text: m })) : [el('span', { class: 'pill', text: 'sin motivo' })])
    : [];
  const alClic = e => { if (e.target?.closest?.('a, button')) return; alternar(e.currentTarget || art); };
  const art = el('article', {
    class: 'card-lic', tabindex: '0', 'aria-expanded': 'false', 'data-expediente': l.expediente || '',
    onclick: alClic, onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault?.(); alternar(e.currentTarget || art); } },
  }, [
    el('div', { class: 'lic-tags' }, [
      el('span', { class: 'pill' }, [el('i', { class: 'punto g-' + (COLOR_ESTADO[est] || 'neutro-3') }), est]),
      el('span', { class: 'pill', text: tipo }),
      el('span', { class: 'pill', text: l.importe ? eurCorto(l.importe) + ' sin IVA' : 'sin importe' }),
      l.procedimiento ? el('span', { class: 'pill', text: l.procedimiento }) : null,
      ...tagsMotivo,
      el('span', { class: 'plazo' }, [el('i', { class: 'punto g-' + p.color }), p.texto]),
    ]),
    el('h3', { class: 'lic-titulo', text: corto(l.resumen_corto || l.objeto || l.expediente, 160) }),
    l.organo || l.provincia ? el('p', { class: 'lic-organo', text: [l.organo, l.provincia].filter(Boolean).join(' · ') }) : null,
    el('div', { class: 'detalle' }, [
      l.objeto ? el('p', { class: 'sub', text: l.objeto }) : null,
      l.expediente ? el('p', { class: 'sub', text: 'Expediente ' + l.expediente }) : null,
      solv !== 'sin dato' ? el('p', { class: 'sub', text: 'Solvencia: ' + solv }) : null,
      l.decision && l.decision !== 'Pendiente' ? el('p', { class: 'sub', text: 'Decisión: ' + l.decision }) : null,
      el('div', { class: 'enlaces enlaces-doc' }, [
        ...enlaces.map(([t, u]) => el('a', { class: 'btn-enlace', href: u, target: '_blank', rel: 'noopener', text: t })),
        pendiente(l) && ABIERTAS.has(est) && DECIDIBLES.has(l.elegible) ? el('a', { class: 'btn-enlace', href: '#hoy/bandeja', text: 'Decidir' }) : null,
      ]),
    ]),
  ]);
  return art;
}

function filaCriba(l) {
  const perfil = urlSegura(l.enlace);
  const texto = [l.expediente, l.resumen_corto || l.objeto, l.cierre ? 'cierra ' + fecha(l.cierre) : null, l.importe ? eurCorto(l.importe) + ' sin IVA' : null].filter(Boolean).join(' · ');
  return el('p', {}, [texto, perfil ? el('a', { class: 'btn-enlace', href: perfil, target: '_blank', rel: 'noopener', text: 'Perfil' }) : null]);
}
function grupoCriba([nombre, rows], abierto) {
  return el('details', { class: 'grupo-criba', open: abierto }, [el('summary', { text: nombre + ' (' + rows.length + ')' }), ...rows.map(filaCriba)]);
}

// Construye la ruta con los filtros activos + los que cambian en 'over'; omite los que quedan vacíos.
function construirRuta(base, over) {
  const q = new URLSearchParams();
  const v = { ...base, ...over };
  if (v.estado) q.set('estado', v.estado);
  if (v.orden === 'importe') q.set('orden', 'importe');
  if (v.tipologia) q.set('tipologia', v.tipologia);
  if (v.solvencia && v.solvencia !== 'todas') q.set('solvencia', v.solvencia);
  if (v.fuente) q.set('fuente', v.fuente);
  if (v.tipo) q.set('tipo', v.tipo);
  if (v.motivo) q.set('motivo', v.motivo);
  if (v.desiertas) q.set('desiertas', '1');
  const s = q.toString();
  return '#operacion/licitaciones' + (s ? '?' + s : '');
}

export function render(raiz, S, arg, filtrosRuta = {}, ahora = new Date()) {
  const d = S.datos || {};
  const lics = d.licitaciones || [], resumen = d.lic_resumen || {};
  if (!lics.length && !Object.keys(resumen).length) { raiz.append(el('p', { class: 'mudo', text: 'sin licitaciones' })); return; }

  const estado = ESTADOS_VALIDOS.has(filtrosRuta.estado) ? filtrosRuta.estado : 'activas';
  const orden = filtrosRuta.orden === 'importe' ? 'importe' : 'cierre';
  const f = {
    tipologia: filtrosRuta.tipologia || '',
    solvencia: filtrosRuta.solvencia || '',
    fuente: filtrosRuta.fuente || '',
    tipo: filtrosRuta.tipo || '',
    motivo: filtrosRuta.motivo || '',
    desiertas: filtrosRuta.desiertas === '1',
  };
  const activos = { estado, orden, ...f };
  const ruta = over => construirRuta(activos, over);

  raiz.append(el('div', { class: 'fila enlace-kpis' }, [el('a', { class: 'btn-enlace', href: '#kpis?grupo=licitaciones', text: 'KPIs ›' })]));

  const fuentes = [...new Set(lics.map(l => l.pestana).filter(Boolean))];
  const tipos = [...new Set(lics.map(l => l.tipo).filter(Boolean))];
  const opcion = (v, t, sel) => el('option', { value: v, selected: v === sel || undefined, text: t });
  const selects = [
    el('select', { 'aria-label': 'Tipología', onchange: e => { location.hash = ruta({ tipologia: e.target.value }); } }, [
      opcion('', 'Tipología (todas)', f.tipologia), ...TIPOLOGIAS.map(t => opcion(t, t, f.tipologia)),
    ]),
    el('select', { 'aria-label': 'Solvencia', onchange: e => { location.hash = ruta({ solvencia: e.target.value }); } }, [
      opcion('', 'Solvencia (todas)', f.solvencia), opcion('sin solvencia', 'Sin solvencia', f.solvencia), opcion('exige', 'Exige solvencia', f.solvencia),
    ]),
    fuentes.length ? el('select', { 'aria-label': 'Fuente', onchange: e => { location.hash = ruta({ fuente: e.target.value }); } }, [
      opcion('', 'Fuente (todas)', f.fuente), ...fuentes.map(v => opcion(v, v, f.fuente)),
    ]) : null,
    tipos.length ? el('select', { 'aria-label': 'Tipo', onchange: e => { location.hash = ruta({ tipo: e.target.value }); } }, [
      opcion('', 'Tipo (todos)', f.tipo), ...tipos.map(v => opcion(v, v, f.tipo)),
    ]) : null,
    // #1063: catalogo cerrado y fijo (como TIPOLOGIAS), siempre visible aunque el payload no traiga
    // descartadas cargadas en este momento; 'sin' cierra las descartadas sin motivo del catalogo.
    el('select', { 'aria-label': 'Motivo de NO', onchange: e => { location.hash = ruta({ motivo: e.target.value }); } }, [
      opcion('', 'Motivo de NO (todos)', f.motivo), ...MOTIVOS_NO.map(v => opcion(v, v, f.motivo)), opcion('sin', 'Sin motivo', f.motivo),
    ]),
    estado === 'criba' ? el('label', {}, [el('input', { type: 'checkbox', checked: f.desiertas || undefined, onchange: e => { location.hash = ruta({ desiertas: e.target.checked ? '1' : '' }); } }), 'Solo desiertas']) : null,
  ];

  let base = filtrar(ordenar(porFiltro(lics, estado), orden), f);
  const lista = el('div', { class: estado === 'criba' ? 'lista-criba' : 'lista-rica' });
  const pintarLista = texto => {
    const rows = buscar(base, texto);
    lista.innerHTML = '';
    if (!rows.length) { lista.append(el('p', { class: 'mudo', text: 'nada con este filtro' })); return; }
    if (estado === 'criba') porElegible(rows).forEach((g, i) => lista.append(grupoCriba(g, i === 0)));
    else rows.forEach(l => lista.append(tarjetaLic(l, ahora)));
  };
  raiz.append(el('div', { class: 'filtros-rica' }, [
    el('div', { class: 'chips' }, FILTROS.map(([k, t]) => el('a', { class: 'chip' + (k === estado ? ' activo' : ''), href: ruta({ estado: k }), text: t + ' ' + porFiltro(lics, k).length }))),
    el('div', { class: 'chips' }, [['cierre', 'por cierre'], ['importe', 'por importe']].map(([k, t]) => el('a', { class: 'chip' + (k === orden ? ' activo' : ''), href: ruta({ orden: k }), text: t }))),
    el('div', { class: 'filtros-select' }, selects),
    el('input', { class: 'campo mini', type: 'search', placeholder: 'Buscar expediente, objeto u órgano', 'aria-label': 'Buscar licitación', oninput: e => pintarLista(e.target.value) }),
  ]));
  raiz.append(lista);
  pintarLista('');

  // Pestana 'descartadas': el payload no las trae (o trae solo las recientes); se piden al servidor y se
  // repinta la lista cuando llegan, salvo que otro render haya tomado el relevo mientras tanto.
  if (estado !== 'descartadas') return;
  const mio = ++turno;
  const clave = f.motivo || '';
  const cache = S.cacheDescartadas;
  const pintarServidor = rows => {
    base = filtrar(rows, f);
    pintarLista('');
    if (rows.length >= 300) lista.append(el('p', { class: 'mudo', text: 'se muestran las 300 descartadas más recientes' }));
  };
  if (cache && cache.clave === clave && Date.now() - cache.ts < CACHE_MS) { pintarServidor(cache.rows); return; }
  const aviso = el('p', { class: 'mudo', text: 'cargando descartadas…' });
  if (!base.length) lista.innerHTML = '';
  lista.append(aviso);
  return cargador(clave).then(rows => {
    if (mio !== turno || raiz.isConnected === false) return;
    if (!Array.isArray(rows)) { aviso.remove(); return; }
    S.cacheDescartadas = { clave, rows, ts: Date.now() };
    pintarServidor(rows);
  }).catch(() => { if (mio === turno) aviso.textContent = 'no se pudieron cargar las descartadas del servidor'; });
}
