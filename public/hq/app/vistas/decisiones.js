// Decisiones de Diego, desde #1057 tarea 27 como bandeja debajo de Hoy (montar/bandeja): tarjetas pendientes
// licitaciones por decidir. Paridad con public/hq/v1/index.html (bandeja + licitaciones), adaptado a
// las claves reales de omc_hq_v2.
//
// T5-b (ruling del controlador, 2026-09-16): omc_hq_v2 no devuelve pendientes[].mensajes. El hilo vive
// en la clave 'hilos' de omc_hq_v2 (mapa solicitud_id -> [{id, autor, texto, ts}], copiado de omc_hq v1;
// ver schema-v2.sql, seccion T16, junto a la clave 'pendientes'). Aqui se lee con
// ((S.datos.hilos || {})[p.id] || []) y se pasa a tarjeta() en vez de p.mensajes.
//
// T5-c: 'pendientes' excluye las pospuestas (viven en 'pospuestas', mismas columnas, con
// pospuesta_hasta en el futuro). render() concatena ambos arrays antes de agrupar; agrupar() en si
// misma ya separa pospuestas por su propio campo pospuesta_hasta, asi que el resultado es el mismo
// tanto si una pendiente llega en 'pendientes' como en 'pospuestas'.
//
// T5-a: omc_licitacion_decidir solo admite p_decision in ('OK','No','Pendiente'). Los botones
// conservan los verbos de la v1 (Presentar/Estudiar/Descartar); decidir() los traduce antes de llamar
// a la RPC.
//
// Fix ronda 1 (revision del controlador, 2026-09-17): resolver() y licitacion().decidir() reimplementaban
// el modal "textarea + Cancelar/Guardar" que ya vive en pedirTexto (antes en detalle.js, ahora compartido en
// ui.js); usarlo aqui elimina la duplicacion y, de paso, arregla que el modal de motivo de licitaciones no
// tenia boton Cancelar (dejaba decidir() colgado para siempre si se cerraba con la X). El detalle de una
// pendiente tambien se pintaba con `html:` sobre texto de la BD (p.detalle): una comilla doble en el texto
// rompia el atributo href del enlace autogenerado e inyectaba atributos (XSS). Se sustituye por enlazar(),
// que construye los nodos <a>/<br> via el() (atributos DOM reales, no interpolacion de string en innerHTML).
import { rpc } from '../api.js';
import { el, modal, toast, fecha, eur, pedirTexto, pedirMotivos, enlazar, urlSegura, campoTexto } from '../ui.js';
import { recargar } from '../main.js';
import { porDecidir, enCriba, solvenciaTexto, MOTIVOS_NO } from '../licitaciones.js';

export function agrupar(pendientes, ahora = new Date()) {
  const finHoy = new Date(ahora); finHoy.setUTCHours(23, 59, 59, 999); const finSemana = new Date(ahora.getTime() + 7 * 864e5);
  const g = { hoy: [], semana: [], resto: [], pospuestas: [] };
  for (const p of pendientes || []) {
    if (p.pospuesta_hasta && new Date(p.pospuesta_hasta) > ahora) { g.pospuestas.push(p); continue; }
    const v = p.vence ? new Date(p.vence) : null;
    (v && v <= finHoy ? g.hoy : v && v <= finSemana ? g.semana : g.resto).push(p);
  }
  return g;
}

// #1057 tarea 27 (Diego, 17-sep): "me siento raro rellenando dos campos". Un solo campo por tarjeta: lo
// escrito viaja con el botón que se pulse (aprobar, rechazar, responder o comentar), sin segundo modal.
// "Copiar para el chat" deja en el portapapeles '#id título: texto' para pegarlo en el chat del chief.
async function actuar(p, accion, campo) {
  const texto = campo.value.trim();
  if (accion !== 'aprobada' && !texto) { toast(accion === 'comentar' ? 'Escribe el comentario' : 'Escribe el motivo o la respuesta'); campo.focus?.(); return; }
  try {
    if (accion === 'comentar') { await rpc('omc_comentar', { p_id: p.id, p_texto: texto }); toast('#' + p.id + ' comentado'); }
    else { await rpc('omc_resolver', { p_id: p.id, p_estado: accion, p_respuesta: texto }); toast('#' + p.id + ' ' + accion); }
    await recargar();
  } catch (err) { toast('HQ rechaza: ' + err.message); }
}
export function textoChat(p, texto) { return '#' + p.id + ' ' + p.titulo + ': ' + String(texto || '').trim(); }
async function copiar(p, campo) {
  try { await navigator.clipboard.writeText(textoChat(p, campo.value)); toast('Copiado: pégalo en el chat del chief'); }
  catch { toast('No se pudo copiar'); }
}

async function posponer(p) {
  const opciones = [['2 h', 2], ['mañana 9:00', 'm'], ['lunes 9:00', 'l']];
  const m = modal({ titulo: 'Posponer #' + p.id, cuerpo: opciones.map(([t, v]) => el('button', { class: 'btn ancho', text: t, onclick: async () => {
    const d = new Date(); if (v === 2) d.setHours(d.getHours() + 2); else { d.setDate(d.getDate() + (v === 'm' ? 1 : ((8 - d.getDay()) % 7) || 7)); d.setHours(9, 0, 0, 0); }
    try { await rpc('omc_posponer', { p_id: p.id, p_hasta: d.toISOString() }); m.cerrar(); toast('#' + p.id + ' hasta ' + fecha(d.toISOString(), { hora: true })); await recargar(); }
    catch (err) { toast('HQ rechaza: ' + err.message); }
  } })) });
}

function tarjeta(p, abierta, hilo) {
  // Fix ronda 2 (revision final, B2): p.enlace lo escribe cualquier agente al crear la tarjeta
  // (omc_solicitudes.enlace no valida esquema en la BD); un `javascript:...` ahi ejecutaria codigo en
  // el origen de HQ con el token owner a mano. urlSegura() lo descarta antes de pintarlo.
  const enlaceSeguro = urlSegura(p.enlace);
  const campo = campoTexto({ class: 'campo', rows: 2, placeholder: p.tipo === 'duda' ? 'Tu respuesta' : 'Instrucción o motivo (opcional para aprobar)' });
  const det = el('details', { open: abierta }, [
    el('summary', {}, [el('div', { class: 'fila' }, [el('span', { class: 'pill', text: p.tipo }), el('strong', { text: p.titulo })]),
      el('p', { class: 'mudo', text: [p.agente, p.importe ? eur(p.importe) : null, p.vence ? 'vence ' + fecha(p.vence, { hora: true }) : null, p.riesgo].filter(Boolean).join(' · ') })]),
    el('div', { class: 'detalle' }, enlazar(p.detalle || '')),
    enlaceSeguro ? el('a', { href: enlaceSeguro, target: '_blank', rel: 'noopener', class: 'btn-enlace', text: 'abrir enlace' }) : null,
    el('div', { class: 'hilo' }, (hilo || []).map(mm => el('div', { class: 'avance' }, [el('span', { class: 'mudo', text: fecha(mm.ts, { hora: true }) + ' · ' + mm.autor }), el('p', { text: mm.texto })]))),
    campo,
    el('div', { class: 'modal-acciones' }, [
      el('button', { class: 'btn', text: 'Copiar para el chat', onclick: () => copiar(p, campo) }),
      el('button', { class: 'btn', text: 'Comentar', onclick: () => actuar(p, 'comentar', campo) }),
      el('button', { class: 'btn', text: 'Posponer', onclick: () => posponer(p) }),
      el('button', { class: 'btn peligro', text: 'Rechazar', onclick: () => actuar(p, 'rechazada', campo) }),
      p.tipo === 'duda' ? el('button', { class: 'btn primario', text: 'Responder', onclick: () => actuar(p, 'respondida', campo) })
        : el('button', { class: 'btn primario', text: 'Aprobar', onclick: () => actuar(p, 'aprobada', campo) })])]);
  return el('article', { class: 'tarjeta decision', id: 'd' + p.id }, [det]);
}

// T5-a: mapea el verbo de la UI a la decision real que acepta omc_licitacion_decidir.
const DECISION = { presentar: 'OK', descartar: 'No', estudiar: 'Pendiente' };

// Slug de 'Elegible' para la clase del pill: minusculas, sin acentos, espacios a '-' (probable, dudosa,
// revisar, no-viable...). La ficha solo pinta Probable/Dudosa (porDecidir ya filtra), pero la funcion
// no asume eso: cualquier valor de 'elegible' produce un slug valido.
function slugElegible(v) {
  return String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, '-');
}

// PCAP/PPT/Perfil (campo 'enlace')/Drive (campo 'carpeta'): solo se pintan si la url es http(s)
// absoluta (urlSegura, la misma puerta que ya usa tarjeta() para p.enlace) - un 'javascript:...' en
// cualquiera de los cuatro campos no produce ningun <a>.
function enlacesDoc(l) {
  return [['PCAP', l.pcap], ['PPT', l.ppt], ['Perfil', l.enlace], ['Drive', l.carpeta]]
    .map(([etiqueta, valor]) => { const href = urlSegura(valor); return href ? el('a', { class: 'btn-enlace', href, target: '_blank', rel: 'noopener', text: etiqueta }) : null; })
    .filter(Boolean);
}

function licitacion(l) {
  // #1063: descartar exige motivo(s) del catalogo cerrado (pedirMotivos, chips multiseleccion); no
  // se puede guardar sin ninguno. presentar/estudiar no cambian: siguen con el texto libre de pedirTexto.
  const decidir = async (verbo) => {
    const decision = DECISION[verbo];
    let texto = '', motivos = [];
    if (decision === 'No') {
      const r = await pedirMotivos('Descartar ' + l.expediente, MOTIVOS_NO);
      if (r == null) return;
      ({ motivos, texto } = r);
    } else if (decision !== 'OK') {
      const t = await pedirTexto(verbo + ' ' + l.expediente, 'Motivo', false);
      if (t == null) return;
      texto = t;
    }
    try {
      await rpc('omc_licitacion_decidir', { p_expediente: l.expediente, p_decision: decision, p_motivos: motivos, p_texto: texto || '' });
      toast(l.expediente + ': ' + verbo + (motivos.length ? ' · ' + motivos.join(' · ') : ''));
      await recargar();
    } catch (err) { toast('HQ rechaza: ' + err.message); }
  };
  const enlaces = enlacesDoc(l);
  return el('article', { class: 'tarjeta licitacion' }, [
    el('div', { class: 'fila' }, [el('span', { class: 'pill codigo', text: l.expediente }), el('strong', { text: l.resumen_corto || l.objeto || l.expediente })]),
    el('p', { class: 'mudo', text: [l.organo, l.provincia, l.importe ? eur(l.importe) + ' sin IVA' : null, l.cierre ? 'cierra ' + fecha(l.cierre) : null, l.tipo, l.procedimiento].filter(Boolean).join(' · ') }),
    el('div', { class: 'datos' }, [
      el('p', {}, ['Elegible: ', el('span', { class: 'pill elegible-' + slugElegible(l.elegible), text: l.elegible })]),
      el('p', { text: 'Solvencia: ' + solvenciaTexto(l) }),
      l.motivo_auto ? el('p', { text: 'Motivo: ' + l.motivo_auto }) : null,
    ]),
    enlaces.length ? el('div', { class: 'enlaces-doc' }, enlaces) : null,
    el('div', { class: 'modal-acciones' }, [
      el('button', { class: 'btn peligro', text: 'Descartar', onclick: () => decidir('descartar') }),
      el('button', { class: 'btn', text: 'Estudiar', onclick: () => decidir('estudiar') }),
      el('button', { class: 'btn primario', text: 'Presentar', onclick: () => decidir('presentar') })])]);
}

// #1057 tarea 27: Decisiones deja de ser vista propia y vive en Hoy como bandeja (Diego: "el inbox de lo
// que yo tengo que ir limpiando"). Arriba solo lo urgente (vence hoy y esta semana); sin fecha, pospuestas
// y licitaciones van plegadas. arg: id de la tarjeta a abrir (push, buscador) o 'bandeja' para bajar aquí.
export function bandeja(S, arg, ahora = new Date()) {
  const d = S.datos, hilos = d.hilos || {};
  const g = agrupar([...(d.pendientes || []), ...(d.pospuestas || [])], ahora);
  const abierta = Number(arg) || null;
  const tarjetas = xs => xs.map(p => tarjeta(p, p.id === abierta, hilos[p.id] || []));
  const sec = (t, xs) => xs.length ? el('section', { class: 'seccion' }, [el('h3', { text: t + ' (' + xs.length + ')' }), ...tarjetas(xs)]) : null;
  const plegada = (t, xs, abrir, extra = []) => xs.length || extra.length ? el('details', { class: 'grupo-criba', open: abrir }, [el('summary', {}, [el('h3', { text: t })]), ...extra, ...tarjetas(xs)]) : null;
  const otras = [...g.resto, ...g.pospuestas];
  // Fix ronda 3 (plan 3b, tarea 2): porDecidir() deja solo las decidibles; enCriba() cuenta lo que aún
  // analiza Guillem (Revisar, No viable, Sin pliego) para la línea informativa.
  const lic = porDecidir(d.licitaciones), criba = enCriba(d.licitaciones).length;
  const lineaCriba = criba ? el('p', { class: 'mudo' }, [el('a', { href: '#operacion/licitaciones', text: criba + ' en criba de Guillem (Revisar, No viable, Sin pliego): se deciden cuando estén analizadas' })]) : null;
  const urgentes = g.hoy.length + g.semana.length, total = urgentes + otras.length;
  return el('section', { class: 'seccion bandeja', id: 'bandeja' }, [
    el('h2', { text: 'Bandeja · depende de ti (' + total + ')' }),
    urgentes ? null : el('p', { class: 'mudo', text: total ? 'Nada urgente esta semana.' : 'Nada que decidir.' }),
    sec('Vence hoy', g.hoy), sec('Esta semana', g.semana),
    plegada('Sin fecha (' + g.resto.length + ') · pospuestas (' + g.pospuestas.length + ')', otras, otras.some(p => p.id === abierta)),
    lic.length ? el('details', { class: 'grupo-criba' }, [el('summary', {}, [el('h2', { text: 'Licitaciones por decidir (' + lic.length + ')' })]), lineaCriba, ...lic.map(licitacion),
      el('a', { class: 'btn-enlace', href: '/hq/v1/#licita', text: 'histórico y fichas completas en HQ v1' })]) : lineaCriba,
  ]);
}
export function montar(raiz, S, arg) {
  if (S.datos?.rol !== 'owner') return;
  raiz.append(bandeja(S, arg));
  const destino = Number(arg) ? 'd' + Number(arg) : arg === 'bandeja' ? 'bandeja' : null;
  if (destino) setTimeout(() => document.getElementById(destino)?.scrollIntoView({ block: 'start' }), 50);
}
