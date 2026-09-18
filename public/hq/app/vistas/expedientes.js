// Expedientes: lista por tipo, ficha con sesion (T11) y alta. Sustituye el stub de T1.
//
// T6-a (ruling del controlador, 2026-09-16): sesiones[] del payload omc_hq_v2 no trae
// 'expediente_nombre': trae 'nombre' (el nombre del expediente) y no trae 'resumen' ni 'cerrada'.
// estadoSesion() solo mira expediente_id y estado, asi que no depende de esos campos; el bloque de
// "Sesiones" dentro de ficha() lee resumen/cerrada de f.sesiones (la respuesta propia de
// omc_expediente_ficha, T11, no del payload), que es una estructura distinta.
//
// T6-b: agentes[].jefe no existe en el payload real: se omite (no se lee ni se muestra).
//
// T6-c: omc_expediente_set(p_token, p jsonb); el alta solo manda las claves que usa este formulario
// (nombre, tipo, frente, responsable) dentro de 'p'. El alta exige nombre, tipo y frente y solo
// owner o chief pueden llamarla; esta vista solo sabe distinguir 'owner' de lo que no lo es (mismo
// patron que el resto de T1-T5), asi que el boton "+ Expediente" se gatea con S.datos.rol==='owner'
// y se deja para el backend rechazar cualquier caso de 'chief' que esta interfaz no distingue (se
// anota como duda en el informe).
//
// Ultima instruccion del controlador (punto 3): las 4 acciones de escritura de esta tarea (Trabajar
// con, Cerrar sesion, Nuevo expediente, frentes de agente) solo se muestran con rol==='owner'. El
// paso 3 del brief no gateaba "Cerrar sesion": aqui se anade el gate por instruccion explicita.
import { rpc } from '../api.js';
import { el, modal, toast, fecha, eur, pedirTexto, enlazar, urlSegura } from '../ui.js';
import { tarjetaEncargo } from '../tarjeta.js';
import { sinAcentos } from '../estado.js';
import { donut, apilada, progreso } from '../graficos.js';
import { eurCorto, anchoLog, panel, cifra, grafico, leyenda, filaBarra } from '../cuadro.js';
import { recargar } from '../main.js';

export function estadoSesion(exp, sesiones) {
  const mias = (sesiones || []).filter(s => s.expediente_id === exp.id);
  const s = mias.find(x => x.estado === 'abierta') || mias.find(x => x.estado === 'solicitada') || null;
  return { hay: !!s, estado: s ? s.estado : null, sesion: s };
}

async function trabajarCon(exp, S) {
  const ag = (S.datos.agentes || []).find(a => a.id === exp.responsable);
  try {
    const s = await rpc('omc_sesion_solicitar', { p_expediente: exp.id });
    // Fix ronda 2 (B2): sesion_url ya la valida omc_agente_sesion_url en la BD (^https://(claude\.ai|
    // claude\.com)/), pero se pasa por urlSegura tambien aqui por coherencia con el resto de href/src.
    const url = urlSegura(ag?.sesion_url);
    if (url) { toast('abriendo la sesión de ' + ag.nombre); setTimeout(() => { location.href = url; }, 400); }
    else { toast(ag ? ag.nombre + ' no ha publicado su sesión (hq.py agente sesion-url). Queda solicitada #' + s.id : 'sin responsable'); await recargar(); }
  } catch (err) { toast('HQ rechaza: ' + err.message); }
}

async function cerrarSesion(s, S) {
  const resumen = await pedirTexto('Cerrar sesión #' + s.id, 'Resumen de la sesión (obligatorio)');
  if (resumen === null) return;
  try { await rpc('omc_sesion_cerrar', { p_sesion: s.id, p_resumen: resumen, p_entregables: [], p_agente: s.agente }); toast('sesión cerrada'); await recargar(); }
  catch (err) { toast('HQ rechaza: ' + err.message); }
}

// Lista como cuadro de mando (#1057 tarea 21, HQ 2.0.8; regla de kit #221): paneles de cartera, fase,
// trabajo abierto y estado sin actualizar; chips por tipo con los clientes delante y una tarjeta por
// expediente. Sin esquema nuevo: todo sale de expedientes[] y sesiones[] del payload.
export const TIPOS = [['cliente', 'Clientes'], ['convocatoria', 'Convocatorias'], ['producto', 'Productos'], ['licitacion', 'Licitaciones'], ['todos', 'Todos']];
export const ECONOMICO = [['concedido', 'neutro-2'], ['contratado', 'tinta-2'], ['facturado', 'tinta'], ['cobrado', 'oro']];
const COLORES_FASE = ['tinta', 'tinta-2', 'neutro-1', 'neutro-2', 'neutro-3'];
const DIA = 86400000;
const suma = xs => xs.reduce((s, x) => s + (Number(x.importe) || 0), 0);
const abiertos = x => Number(x.encargos_abiertos) || 0;

export function pasoEconomico(x) {
  const i = ECONOMICO.findIndex(([k]) => k === x.estado_economico);
  return i < 0 ? null : { paso: i + 1, de: ECONOMICO.length, pct: Math.round(100 * (i + 1) / ECONOMICO.length) };
}
// Fases del embudo presentes, de más a menos expedientes, con color de la paleta neutra en ese orden.
export function porFase(xs) {
  const c = {};
  for (const x of xs) { const f = x.estado_funnel || 'sin fase'; c[f] = (c[f] || 0) + 1; }
  return Object.entries(c).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([l, v], i) => ({ l, v, color: COLORES_FASE[Math.min(i, COLORES_FASE.length - 1)] }));
}
// Sin estado reciente: sin resumen o con el resumen de hace más de 7 días.
export const sinActualizar = (xs, ahora = new Date()) => xs.filter(x => { const t = Date.parse(x.resumen_fecha || ''); return !x.resumen_estado || isNaN(t) || ahora - t > 7 * DIA; });
export function porTipo(xs, tipo) { return tipo === 'todos' ? xs : xs.filter(x => x.tipo === tipo); }
export function buscarExp(xs, texto, agentes = []) {
  const q = sinAcentos(String(texto || '').trim().toLowerCase());
  if (!q) return xs;
  const nombre = id => (agentes.find(a => a.id === id) || {}).nombre;
  return xs.filter(x => sinAcentos([x.nombre, x.codigo, x.responsable, nombre(x.responsable), x.estado_funnel, x.tipologia].filter(Boolean).join(' ').toLowerCase()).includes(q));
}

function panelCartera(clientes) {
  const tramos = ECONOMICO.map(([k, color]) => ({ l: k, color, xs: clientes.filter(x => x.estado_economico === k) }));
  tramos.push({ l: 'sin estado', color: 'neutro-3', xs: clientes.filter(x => !ECONOMICO.some(([k]) => k === x.estado_economico)) });
  const segs = tramos.filter(t => t.xs.length).map(t => ({ l: t.l, color: t.color, v: suma(t.xs), n: t.xs.length }));
  return panel('Cartera de clientes', '#operacion/expedientes?tipo=cliente', [
    cifra(eurCorto(suma(clientes)), clientes.length + ' clientes · sin IVA'),
    clientes.length ? grafico(apilada(segs, 'importe de clientes por estado económico'), 'fina') : null,
    leyenda(segs.map(s => ({ l: s.l + ' (' + s.n + ')', v: eurCorto(s.v), color: s.color }))),
  ], 'ancho-2');
}
function panelFase(xs) {
  const segs = porFase(xs);
  return panel('Por fase', '#operacion/expedientes?tipo=todos', [
    el('div', { class: 'donut-fila' }, [el('div', { class: 'donut' }, [grafico(donut(segs, 'expedientes por fase')), el('span', { class: 'centro', text: String(xs.length) })]), leyenda(segs)]),
  ]);
}
function panelTrabajo(xs) {
  const con = xs.filter(x => abiertos(x) > 0).sort((a, b) => abiertos(b) - abiertos(a));
  const total = con.reduce((s, x) => s + abiertos(x), 0), max = con.length ? abiertos(con[0]) : 0;
  return panel('Trabajo abierto', '#operacion/tablero', [
    cifra(String(total), con.length ? 'encargos abiertos en ' + con.length + ' expedientes' : 'sin encargos abiertos'),
    ...con.slice(0, 4).map(x => filaBarra(x.nombre, String(abiertos(x)), anchoLog(abiertos(x), max), 'tinta-2', '#operacion/expedientes/' + x.id)),
  ], 'ancho-2');
}
function panelSinActualizar(xs, ahora) {
  const sa = sinActualizar(xs, ahora);
  return panel('Sin estado reciente', '#operacion/expedientes?tipo=todos', [
    cifra(String(sa.length), sa.length ? 'sin resumen en 7 días' : 'todos al día'),
    sa.length ? el('ul', { class: 'lista-corta' }, sa.slice(0, 3).map(x => el('li', { text: x.nombre }))) : null,
  ], sa.length ? 'alerta' : null);
}

export function tarjetaExp(x, S, colorFase = {}) {
  const es = estadoSesion(x, S.datos.sesiones), ag = (S.datos.agentes || []).find(a => a.id === x.responsable);
  const pe = pasoEconomico(x), fase = x.estado_funnel || 'sin fase', sub = [ag?.nombre || x.responsable, x.tipologia].filter(Boolean).join(' · ');
  const enlaces = [['Ficha (Doc)', x.ficha_url], ['Carpeta', x.carpeta_url]].map(([t, u]) => [t, urlSegura(u)]).filter(e => e[1]);
  return el('article', { class: 'tarjeta-rica tarjeta-exp' }, [
    el('div', { class: 'cab' }, [el('span', { class: 'pill estado' }, [el('i', { class: 'punto g-' + (colorFase[fase] || 'neutro-3') }), fase]), el('span', { class: 'pill codigo', text: x.codigo }),
      es.hay ? el('span', { class: 'pill sesion', text: 'sesión ' + es.estado }) : null]),
    el('h3', {}, [el('a', { href: '#operacion/expedientes/' + x.id, text: x.nombre })]),
    sub ? el('p', { class: 'sub', text: sub }) : null,
    el('div', { class: 'cifra-fila' }, [el('p', { class: 'cifra-l', text: x.importe ? eurCorto(x.importe) : 'importe sin dato' }), x.importe ? el('span', { class: 'mudo', text: 'sin IVA' }) : null]),
    pe ? el('div', { class: 'plazo-barra' }, [grafico(progreso(pe.pct, 'avance económico', { color: pe.paso === pe.de ? 'oro' : 'tinta-2' }), 'fina'),
      el('span', { class: 'mudo', text: x.estado_economico + ' · paso ' + pe.paso + ' de ' + pe.de + ' hasta cobrado' })]) : null,
    x.resumen_estado ? el('p', { class: 'solv' }, enlazar(x.resumen_estado)) : null,
    el('p', { class: 'solv', text: abiertos(x) + (abiertos(x) === 1 ? ' encargo abierto' : ' encargos abiertos') }),
    el('div', { class: 'enlaces' }, [el('a', { href: '#operacion/expedientes/' + x.id, text: 'Abrir' }), ...enlaces.map(([t, h]) => el('a', { href: h, target: '_blank', rel: 'noopener', text: t }))]),
  ]);
}

// Grupo 'Expedientes' de Operación/KPIs (#1057 tarea 29): mismos cuatro paneles que antes encabezaban
// esta vista, reutilizados desde kpis.js sin duplicar código.
export function panelesExpedientes(d, ahora = new Date()) {
  const xs = (d.expedientes || []).filter(x => x.activo !== false);
  return [panelCartera(porTipo(xs, 'cliente')), panelFase(xs), panelTrabajo(xs), panelSinActualizar(xs, ahora)];
}

function lista(raiz, S, filtrosRuta = {}, ahora = new Date()) {
  const xs = (S.datos.expedientes || []).filter(x => x.activo !== false);
  const tipo = TIPOS.some(([k]) => k === filtrosRuta.tipo) ? filtrosRuta.tipo : 'cliente';
  const colorFase = Object.fromEntries(porFase(xs).map(s => [s.l, s.color]));
  raiz.append(el('div', { class: 'fila enlace-kpis' }, [el('a', { class: 'btn-enlace', href: '#kpis?grupo=expedientes', text: 'KPIs ›' })]));
  const base = porTipo(xs, tipo).slice().sort((a, b) => (Number(b.importe) || 0) - (Number(a.importe) || 0) || String(a.nombre).localeCompare(String(b.nombre)));
  const cont = el('div', { class: 'lista-rica' });
  const pintarLista = texto => {
    const rows = buscarExp(base, texto, S.datos.agentes);
    cont.innerHTML = '';
    if (!rows.length) { cont.append(el('p', { class: 'mudo', text: 'nada con este filtro' })); return; }
    rows.forEach(x => cont.append(tarjetaExp(x, S, colorFase)));
  };
  raiz.append(el('div', { class: 'filtros-rica' }, [
    el('div', { class: 'chips' }, TIPOS.filter(([k]) => k === 'todos' || k === tipo || porTipo(xs, k).length).map(([k, t]) => el('a', { class: 'chip' + (k === tipo ? ' activo' : ''), href: '#operacion/expedientes?tipo=' + k, text: t + ' ' + porTipo(xs, k).length }))),
    el('input', { class: 'campo mini', type: 'search', placeholder: 'Buscar por nombre, código o responsable', 'aria-label': 'Buscar expedientes', oninput: e => pintarLista(e.target.value) }),
  ]));
  raiz.append(cont);
  pintarLista('');
  if (S.datos.rol === 'owner') raiz.append(el('button', { class: 'btn primario', text: '+ Expediente', onclick: () => alta(S) }));
}

function alta(S) {
  const nombre = el('input', { class: 'campo', placeholder: 'Nombre (cliente, producto o convocatoria)' });
  const tipo = el('select', {}, ['cliente', 'producto', 'convocatoria', 'licitacion'].map(t => el('option', { value: t, text: t })));
  const frente = el('select', {}, [el('option', { value: '', text: 'Frente' }), ...(S.datos.frentes || []).map(f => el('option', { value: f.codigo, text: f.codigo + ' ' + f.linea }))]);
  const resp = el('select', {}, [el('option', { value: '', text: 'Responsable' }), ...(S.datos.agentes || []).map(a => el('option', { value: a.id, text: a.nombre }))]);
  const m = modal({ titulo: 'Nuevo expediente', cuerpo: [nombre, tipo, frente, resp], acciones: [el('button', { class: 'btn primario', text: 'Crear', onclick: async () => {
    if (!nombre.value.trim() || !frente.value) { toast('nombre y frente son obligatorios'); return; }
    try { await rpc('omc_expediente_set', { p: { nombre: nombre.value.trim(), tipo: tipo.value, frente: frente.value, responsable: resp.value || null } }); m.cerrar(); toast('expediente creado'); await recargar(); }
    catch (err) { toast('HQ rechaza: ' + err.message); }
  } })] });
}

async function ficha(raiz, S, id) {
  let f; try { f = await rpc('omc_expediente_ficha', { p_id: id }); } catch (err) { toast('HQ rechaza: ' + err.message); raiz.append(el('p', { class: 'error', text: 'No se pudo cargar el expediente.' })); return; }
  const x = f.expediente;
  // f.sesiones (respuesta de omc_expediente_ficha) hace se.* sobre omc_sesiones (schema-v2.sql:633),
  // que ya incluye expediente_id: no hace falta normalizarlo (NIT ronda 1, retirada la version
  // defensiva que lo daba por ausente).
  const es = estadoSesion(x, f.sesiones?.length ? f.sesiones : S.datos.sesiones), ag = (S.datos.agentes || []).find(a => a.id === x.responsable);
  // Fix ronda 2 (B2): sesion_url, ficha_url y carpeta_url vienen de la BD sin validar esquema.
  const sesionUrl = urlSegura(ag?.sesion_url), fichaUrl = urlSegura(x.ficha_url), carpetaUrl = urlSegura(x.carpeta_url);
  raiz.append(el('a', { href: '#operacion/expedientes', class: 'btn-enlace', text: '← expedientes' }));
  raiz.append(el('section', { class: 'objetivo' }, [
    el('p', { class: 'mudo', text: x.tipo + ' · ' + (f.frente ? f.frente.codigo + ' ' + f.frente.linea : '') }),
    el('h1', { text: x.nombre }),
    el('p', { class: 'mudo', text: [x.responsable, x.estado_funnel, x.importe ? eur(x.importe) : null].filter(Boolean).join(' · ') }),
    el('div', { class: 'fila acciones-exp' }, [
      S.datos.rol === 'owner' && !es.hay ? el('button', { class: 'btn primario', text: 'Trabajar con ' + (ag?.nombre || x.responsable || '…'), onclick: () => trabajarCon(x, S) }) : null,
      es.estado === 'solicitada' ? el('span', { class: 'pill sesion', text: 'sesión solicitada, ' + (ag?.nombre || '') + ' la abre en <1 min' }) : null,
      es.estado === 'abierta' && sesionUrl ? el('a', { class: 'btn primario', href: sesionUrl, text: 'Volver a la sesión' }) : null,
      es.hay && S.datos.rol === 'owner' ? el('button', { class: 'btn', text: 'Cerrar sesión', onclick: () => cerrarSesion(es.sesion, S) }) : null,
      fichaUrl ? el('a', { class: 'btn', href: fichaUrl, target: '_blank', rel: 'noopener', text: 'Ficha (Doc)' }) : null,
      carpetaUrl ? el('a', { class: 'btn', href: carpetaUrl, target: '_blank', rel: 'noopener', text: 'Carpeta' }) : null])]));
  if (x.resumen_estado) raiz.append(el('section', { class: 'seccion' }, [el('h2', { text: 'Estado (' + fecha(x.resumen_fecha, { hora: true }) + ')' }), el('p', {}, enlazar(x.resumen_estado))]));
  raiz.append(el('section', { class: 'seccion' }, [el('h2', { text: 'Encargos (' + f.encargos.length + ')' }), ...f.encargos.map(e => tarjetaEncargo(e))]));
  if (x.entregables?.length) raiz.append(el('section', { class: 'seccion' }, [el('h2', { text: 'Entregables' }), ...x.entregables.map(en => { const h = urlSegura(en.url); return el('p', {}, [el('span', { class: 'pill', text: en.estado || 'pendiente' }), ' ', h ? el('a', { href: h, target: '_blank', rel: 'noopener', text: en.nombre }) : en.nombre]); })]));
  if (f.contactos?.length) raiz.append(el('section', { class: 'seccion' }, [el('h2', { text: 'Contactos y envíos' }), ...f.contactos.map(c => el('p', { class: 'mudo', text: fecha(c.fecha || c.created_at, { hora: true }) + ' · ' + c.canal + ' · ' + (c.persona || c.destinatario || '') + ' · ' + (c.estado || '') + (c.asunto ? ' · ' + c.asunto : '') }))]));
  if (f.decisiones?.length) raiz.append(el('section', { class: 'seccion' }, [el('h2', { text: 'Decisiones' }), ...f.decisiones.map(d => el('a', { class: 'tarjeta enlace', href: '#hoy/' + d.id }, [el('p', { class: 'titulo', text: '#' + d.id + ' ' + d.titulo }), el('p', { class: 'mudo', text: d.estado })]))]));
  if (f.sesiones?.length) raiz.append(el('section', { class: 'seccion' }, [el('h2', { text: 'Sesiones' }), ...f.sesiones.map(s => el('p', { class: 'mudo', text: fecha(s.abierta || s.created_at, { hora: true }) + ' · ' + s.agente + ' · ' + s.estado + (s.resumen ? ' · ' + s.resumen : '') }))]));
  if (f.kit?.length) raiz.append(el('details', {}, [el('summary', { text: 'Kit del frente (' + f.kit.length + ')' }), ...f.kit.map(k => { const h = urlSegura(k.url); return h ? el('a', { href: h, target: '_blank', rel: 'noopener', class: 'kit', text: k.titulo }) : el('span', { class: 'kit mudo', text: k.titulo }); })]));
}

export function render(raiz, S, arg, filtrosRuta = {}, ahora = new Date()) { if (arg && /^\d+$/.test(arg)) ficha(raiz, S, Number(arg)); else lista(raiz, S, filtrosRuta, ahora); }
