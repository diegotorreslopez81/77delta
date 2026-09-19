// Operación/Licitaciones (#1057, tarjetas ricas HQ 2.0.15; hallazgo de Diego con capturas: la tarjeta
// vieja media unos 14.000 px de alto en móvil y usaba '.cab', la barra oscura del header, con texto
// oscuro encima casi invisible). Tarjeta nueva: colapsada por defecto (etiquetas, título, órgano),
// clic o Intro/espacio despliega objeto completo, solvencia, expediente y enlaces. El cuadro de los
// cinco paneles se va a Operación/KPIs (grupo licitaciones); aquí queda un enlace. La cola en criba
// sigue en filas compactas agrupadas por elegible. Decidir una licitación sigue en Reglas/Decisiones.
// La vista no gatea por rol: omc_hq_v2 solo sirve licitaciones al owner.
import { el, fecha, urlSegura } from '../ui.js';
import { embudo, enCriba, porElegible, porDecidir, ordenCierre, estadoDe, estadoBase, estadoPartido, solvenciaTexto, pipelinePorMes, pendiente, ABIERTAS, DECIDIBLES, tipologia, TIPOLOGIAS, filtrar, motivosNo, MOTIVOS_NO, enlacesLic } from '../licitaciones.js';
import { hojaFiltros, pillsActivos } from '../filtros.js';
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

// Chips del embudo (2.0.20, palabras de Diego: "arriba solo unos filtros predefinidos, uno por estado
// del embudo"). Sustituyen a los cuatro FILTROS viejos (activas/decidir/pausadas/criba); ALIAS mantiene
// vivos los enlaces que ya existen en hoy.js, kpis.js, objetivo.js, cuadro.js y los marcadores de Diego.
// El tercer elemento son los estados reales de BD que caen en ese chip; 'Analizada' y 'En redacción'
// viajan siempre en omc_hq_v2 desde la 2.0.19.
export const ESTADOS = [
  ['nuevas', 'Nuevas', ['Nueva']],
  ['decidir', 'Por decidir', ['Por decidir', 'Analizada']],
  ['aprobadas', 'Aprobadas', ['Aprobada']],
  ['redaccion', 'En redacción', ['En redacción']],
  ['presentadas', 'Presentadas', ['Presentada']],
  ['pausadas', 'Pausadas', ['Pausada']],
  ['descartadas', 'Descartadas', ['Descartada', 'Cerrada sin presentar', 'Retirada', 'No adjudicada']],
];
const ALIAS = { activas: 'aprobadas', criba: 'nuevas' };
export function estadoChip(valorRuta) {
  const v = String(valorRuta || ''), k = ALIAS[v] || v;
  return ESTADOS.some(([x]) => x === k) ? k : '';
}
// Filtra por chip del embudo con el estado real (estadoBase limpia el "Descartada: motivo" del Sheet).
export function porEstado(lics, estado) {
  const e = ESTADOS.find(([k]) => k === estado);
  if (!e) return lics || [];
  const set = new Set(e[2]);
  return (lics || []).filter(l => set.has(estadoBase(l)));
}
// "Por defecto lo que está por decidir; si no queda nada, lo que se está redactando; si tampoco, las
// aprobadas" (Diego, 19-sep). No se escribe en la ruta: así el defecto cambia cuando cambian los datos.
export function estadoPorDefecto(lics) {
  if (porEstado(lics, 'decidir').length) return 'decidir';
  if (porEstado(lics, 'redaccion').length) return 'redaccion';
  return 'aprobadas';
}
export function ordenar(rows, orden = 'cierre') {
  return [...rows].sort(orden === 'importe' ? (a, b) => importe(b) - importe(a) || ordenCierre(a, b) : ordenCierre);
}
// El buscador de la hoja es el filtro 'texto' de filtrar(); buscar() se mantiene como atajo.
export function buscar(rows, texto) { return filtrar(rows, { texto }); }

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
  // 2.0.20: el estado sucio "Descartada: solo viable en UTE" se parte (estadoPartido) para que la pill
  // diga solo "Descartada" y el resto se lea como un motivo mas.
  const par = estadoPartido(l), motivos = par.estado === 'Descartada' ? motivosNo(l) : [];
  const tagsMotivo = [
    ...(par.estado === 'Descartada'
      ? (motivos.length ? motivos.map(m => el('span', { class: 'pill', text: m })) : [el('span', { class: 'pill', text: 'sin motivo' })])
      : []),
    ...(par.motivo ? [el('span', { class: 'pill', text: corto(par.motivo, 60) })] : []),
  ];
  const alClic = e => { if (e.target?.closest?.('a, button')) return; alternar(e.currentTarget || art); };
  const art = el('article', {
    class: 'card-lic', tabindex: '0', 'aria-expanded': 'false', 'data-expediente': l.expediente || '',
    onclick: alClic, onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault?.(); alternar(e.currentTarget || art); } },
  }, [
    el('div', { class: 'lic-tags' }, [
      el('span', { class: 'pill' }, [el('i', { class: 'punto g-' + (COLOR_ESTADO[par.estado] || 'neutro-3') }), par.estado]),
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

// Ruta canónica de la vista con los filtros puestos; se omite lo vacío y lo que ya es el defecto. Los
// valores viven en la ruta (no en memoria) para que los enlaces de KPIs/Home y el botón atrás del
// iPhone sigan funcionando.
export function construirRuta(v = {}) {
  const q = new URLSearchParams();
  if (v.estado) q.set('estado', v.estado);
  if (v.orden === 'importe') q.set('orden', 'importe');
  for (const k of ['tipologia', 'solvencia', 'fuente', 'tipo', 'motivo', 'presencial', 'texto']) if (v[k] && v[k] !== 'todas') q.set(k, v[k]);
  if (v.desiertas === '1' || v.desiertas === true) q.set('desiertas', '1');
  const s = q.toString();
  return '#operacion/licitaciones' + (s ? '?' + s : '');
}

export function render(raiz, S, arg, filtrosRuta = {}, ahora = new Date()) {
  const d = S.datos || {};
  const lics = d.licitaciones || [], resumen = d.lic_resumen || {};
  if (!lics.length && !Object.keys(resumen).length) { raiz.append(el('p', { class: 'mudo', text: 'sin licitaciones' })); return; }

  const estado = estadoChip(filtrosRuta.estado) || estadoPorDefecto(lics);
  const valores = { estado, orden: filtrosRuta.orden === 'importe' ? 'importe' : 'cierre' };
  for (const k of ['tipologia', 'solvencia', 'fuente', 'tipo', 'motivo', 'presencial', 'texto']) if (filtrosRuta[k]) valores[k] = filtrosRuta[k];
  if (filtrosRuta.desiertas === '1') valores.desiertas = '1';

  let descartadas = null;                                   // filas del servidor, cuando llegan
  const nr = k => Number(resumen?.[k]?.n) || 0;
  // Antes de cargarlas no se sabe cuántas hay: se usa el resumen del payload (descartadas + cerradas sin
  // presentar + no adjudicadas, las tres familias que devuelve omc_licitaciones_descartadas).
  const cuenta = k => k === 'descartadas'
    ? (descartadas ? descartadas.length : Math.max(porEstado(lics, k).length, nr('descartadas') + nr('cerradas') + nr('no_adjudicadas')))
    : porEstado(lics, k).length;
  const filtroDe = v => ({ tipologia: v.tipologia || '', solvencia: v.solvencia || '', fuente: v.fuente || '', tipo: v.tipo || '',
    motivo: v.motivo || '', presencial: v.presencial || '', texto: v.texto || '', desiertas: v.desiertas === '1' });
  const filasDe = v => {
    const est = estadoChip(v.estado) || estado;
    const base = est === 'descartadas' && descartadas ? descartadas : porEstado(lics, est);
    return filtrar(ordenar(base, v.orden === 'importe' ? 'importe' : 'cierre'), filtroDe(v));
  };

  const fuentes = [...new Set(lics.map(l => l.pestana).filter(Boolean))];
  const tipos = [...new Set(lics.map(l => l.tipo).filter(Boolean))];
  const secciones = [
    { clave: 'estado', titulo: 'Estado', fija: true, opciones: ESTADOS.map(([k, t]) => [k, t, cuenta(k)]) },
    { clave: 'orden', titulo: 'Orden', defecto: 'cierre', opciones: [['cierre', 'Cierre'], ['importe', 'Importe']] },
    { clave: 'tipologia', titulo: 'Tipología', opciones: TIPOLOGIAS.map(t => [t, t]) },
    { clave: 'solvencia', titulo: 'Solvencia', opciones: [['sin solvencia', 'Sin solvencia'], ['exige', 'Exige solvencia']] },
    { clave: 'tipo', titulo: 'Tipo', opciones: tipos.map(t => [t, t]) },
    { clave: 'presencial', titulo: 'Presencial', opciones: [['no', 'Sin presencia'], ['si', 'Requiere presencia']] },
    // Motivo de NO solo tiene sentido sobre las descartadas (#1063, catálogo cerrado + 'sin motivo').
    { clave: 'motivo', titulo: 'Motivo de NO', visible: v => (estadoChip(v.estado) || estado) === 'descartadas',
      opciones: [...MOTIVOS_NO.map(m => [m, m]), ['sin', 'Sin motivo']] },
    // Fuente y desiertas solo llegan por la ruta (enlaces de KPIs): salen como pill con x, no en la hoja.
    { clave: 'fuente', titulo: 'Fuente', visible: () => false, opciones: fuentes.map(t => [t, t]) },
    { clave: 'desiertas', titulo: 'Desiertas', visible: () => false, opciones: [['1', 'Solo desiertas']] },
    { clave: 'texto', titulo: 'Buscar', libre: true },
  ];

  raiz.append(el('div', { class: 'fila enlace-kpis' }, [el('a', { class: 'btn-enlace', href: '#kpis?grupo=licitaciones', text: 'KPIs ›' })]));
  const chips = el('div', { class: 'chips chips-embudo' });
  const zonaPills = el('div', { class: 'zona-pills' });
  const lista = el('div', { class: (estado === 'nuevas' ? 'lista-criba' : 'lista-rica') + ' con-fab' });

  const pintarChips = () => {
    chips.innerHTML = '';
    for (const [k, t] of ESTADOS) {
      const a = el('a', { class: 'chip' + (k === estado ? ' activo' : ''), href: construirRuta({ ...valores, estado: k }), text: t + ' ' + cuenta(k) });
      chips.append(a);
      // En móvil la fila va con scroll horizontal: el chip activo tiene que quedar a la vista.
      if (k === estado && a.scrollIntoView) setTimeout(() => a.scrollIntoView({ block: 'nearest', inline: 'center' }), 0);
    }
  };
  const pintarPills = () => {
    zonaPills.innerHTML = '';
    const p = pillsActivos(valores, secciones, clave => { const v = { ...valores }; delete v[clave]; location.hash = construirRuta(v); });
    if (p) zonaPills.append(p);
  };
  // Las Nuevas son más de mil filas: se siguen pintando como cola compacta agrupada por elegible (lo que
  // hacía la pestaña 'criba'), no como tarjetas ricas, que colgaban el móvil.
  const pintarLista = v => {
    const rows = filasDe(v);
    lista.innerHTML = '';
    if (!rows.length) lista.append(el('p', { class: 'mudo', text: 'nada con este filtro' }));
    else if ((estadoChip(v.estado) || estado) === 'nuevas') porElegible(rows).forEach((g, i) => lista.append(grupoCriba(g, i === 0)));
    else rows.forEach(l => lista.append(tarjetaLic(l, ahora)));
    return rows.length;
  };

  const hoja = hojaFiltros({ secciones, valores, total: 0,
    onCambio: v => filasDe(v).length,
    onAplicar: v => { location.hash = construirRuta(v); } });

  pintarChips(); pintarPills();
  raiz.append(chips, zonaPills, lista, hoja.fab, hoja.hoja);
  const n0 = pintarLista(valores);
  hoja.actualizar(valores, n0);

  // Chip 'descartadas': el payload no las trae (o trae solo las recientes); se piden al servidor y se
  // repinta la lista cuando llegan, salvo que otro render haya tomado el relevo mientras tanto.
  if (estado !== 'descartadas') return;
  const mio = ++turno;
  const clave = valores.motivo || '';
  const cache = S.cacheDescartadas;
  const pintarServidor = rows => {
    descartadas = rows;
    secciones[0].opciones = ESTADOS.map(([k, t]) => [k, t, cuenta(k)]);
    pintarChips();
    hoja.actualizar(valores, pintarLista(valores));
    if (rows.length >= 300) lista.append(el('p', { class: 'mudo', text: 'se muestran las 300 descartadas más recientes' }));
  };
  if (cache && cache.clave === clave && Date.now() - cache.ts < CACHE_MS) { pintarServidor(cache.rows); return; }
  const aviso = el('p', { class: 'mudo', text: 'cargando descartadas…' });
  if (!n0) lista.innerHTML = '';
  lista.append(aviso);
  return cargador(clave).then(rows => {
    if (mio !== turno || raiz.isConnected === false) return;
    if (!Array.isArray(rows)) { aviso.remove(); return; }
    S.cacheDescartadas = { clave, rows, ts: Date.now() };
    pintarServidor(rows);
  }).catch(() => { if (mio === turno) aviso.textContent = 'no se pudieron cargar las descartadas del servidor'; });
}
