// Decisiones de Diego: tarjetas pendientes (aprobar, rechazar, responder, posponer, comentar) y
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
import { rpc } from '../api.js';
import { el, modal, toast, fecha, eur } from '../ui.js';
import { recargar } from '../main.js';

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

async function resolver(p, estado) {
  const campo = el('textarea', { rows: 3, placeholder: estado === 'aprobada' ? 'Instrucción para quien ejecuta (opcional)' : 'Motivo o respuesta' });
  const m = modal({ titulo: (estado === 'aprobada' ? 'Aprobar' : estado === 'rechazada' ? 'Rechazar' : 'Responder') + ' #' + p.id, cuerpo: [el('p', { text: p.titulo }), campo], acciones: [
    el('button', { class: 'btn', text: 'Cancelar', onclick: () => m.cerrar() }),
    el('button', { class: 'btn primario', text: 'Confirmar', onclick: async () => {
      if (estado !== 'aprobada' && !campo.value.trim()) { campo.focus(); return; }
      try { await rpc('omc_resolver', { p_id: p.id, p_estado: estado, p_respuesta: campo.value.trim() }); m.cerrar(); toast('#' + p.id + ' ' + estado); await recargar(); }
      catch (err) { toast('HQ rechaza: ' + err.message); }
    } })] });
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
  const det = el('details', { open: abierta }, [
    el('summary', {}, [el('div', { class: 'fila' }, [el('span', { class: 'pill', text: p.tipo }), el('strong', { text: p.titulo })]),
      el('p', { class: 'mudo', text: [p.agente, p.importe ? eur(p.importe) : null, p.vence ? 'vence ' + fecha(p.vence, { hora: true }) : null, p.riesgo].filter(Boolean).join(' · ') })]),
    el('div', { class: 'detalle', html: (p.detalle || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/(https?:\/\/[^\s)]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g, '<br>') }),
    p.enlace ? el('a', { href: p.enlace, target: '_blank', rel: 'noopener', class: 'btn-enlace', text: 'abrir enlace' }) : null,
    el('div', { class: 'hilo' }, (hilo || []).map(mm => el('div', { class: 'avance' }, [el('span', { class: 'mudo', text: fecha(mm.ts, { hora: true }) + ' · ' + mm.autor }), el('p', { text: mm.texto })]))),
    el('div', { class: 'fila' }, [(() => {
      const c = el('input', { class: 'campo', placeholder: 'Comentar sin resolver' });
      c.onkeydown = async ev => { if (ev.key === 'Enter' && c.value.trim()) { try { await rpc('omc_comentar', { p_id: p.id, p_texto: c.value.trim() }); c.value = ''; toast('comentado'); await recargar(); } catch (err) { toast('HQ rechaza: ' + err.message); } } };
      return c;
    })()]),
    el('div', { class: 'modal-acciones' }, [
      el('button', { class: 'btn', text: 'Posponer', onclick: () => posponer(p) }),
      el('button', { class: 'btn peligro', text: 'Rechazar', onclick: () => resolver(p, 'rechazada') }),
      p.tipo === 'duda' ? el('button', { class: 'btn primario', text: 'Responder', onclick: () => resolver(p, 'respondida') }) : el('button', { class: 'btn primario', text: 'Aprobar', onclick: () => resolver(p, 'aprobada') })])]);
  return el('article', { class: 'tarjeta decision', id: 'd' + p.id }, [det]);
}

// T5-a: mapea el verbo de la UI a la decision real que acepta omc_licitacion_decidir.
const DECISION = { presentar: 'OK', descartar: 'No', estudiar: 'Pendiente' };
function licitacion(l) {
  const decidir = async (verbo) => {
    const decision = DECISION[verbo];
    const texto = decision === 'OK' ? '' : await new Promise(res => {
      const c = el('textarea', { rows: 2, placeholder: 'Motivo' });
      const m = modal({ titulo: verbo + ' ' + l.expediente, cuerpo: [c], acciones: [el('button', { class: 'btn primario', text: 'Confirmar', onclick: () => { m.cerrar(); res(c.value.trim()); } })] });
    });
    if (texto == null) return;
    try { await rpc('omc_licitacion_decidir', { p_expediente: l.expediente, p_decision: decision, p_motivos: [], p_texto: texto || '' }); toast(l.expediente + ': ' + verbo); await recargar(); }
    catch (err) { toast('HQ rechaza: ' + err.message); }
  };
  return el('article', { class: 'tarjeta licitacion' }, [
    el('div', { class: 'fila' }, [el('span', { class: 'pill codigo', text: l.expediente }), el('strong', { text: l.resumen_corto || l.objeto || l.expediente })]),
    el('p', { class: 'mudo', text: [l.organo, l.importe ? eur(l.importe) + ' sin IVA' : null, l.cierre ? 'cierra ' + fecha(l.cierre) : null].filter(Boolean).join(' · ') }),
    l.objeto && l.objeto !== l.resumen_corto ? el('p', { text: l.objeto }) : null,
    el('div', { class: 'modal-acciones' }, [
      el('button', { class: 'btn peligro', text: 'Descartar', onclick: () => decidir('descartar') }),
      el('button', { class: 'btn', text: 'Estudiar', onclick: () => decidir('estudiar') }),
      el('button', { class: 'btn primario', text: 'Presentar', onclick: () => decidir('presentar') })])]);
}

export function render(raiz, S, arg) {
  if (S.datos.rol !== 'owner') { raiz.append(el('p', { class: 'mudo', text: 'Las decisiones son de Diego. Tus tarjetas: hq.py activo.' })); return; }
  const d = S.datos, hilos = d.hilos || {};
  const ahora = new Date();
  const g = agrupar([...(d.pendientes || []), ...(d.pospuestas || [])], ahora);
  const abierta = Number(arg) || null;
  const sec = (t, xs) => xs.length ? el('section', { class: 'seccion' }, [el('h2', { text: t + ' (' + xs.length + ')' }), ...xs.map(p => tarjeta(p, p.id === abierta, hilos[p.id] || []))]) : null;
  raiz.append(sec('Vence hoy', g.hoy), sec('Esta semana', g.semana), sec('Sin fecha', g.resto), sec('Pospuestas', g.pospuestas));
  const lic = (d.licitaciones || []).filter(l => !l.decision || l.decision === 'Pendiente');
  raiz.append(el('section', { class: 'seccion' }, [el('h2', { text: 'Licitaciones por decidir (' + lic.length + ')' }), ...lic.map(licitacion), el('a', { class: 'btn-enlace', href: '/hq/v1/#licita', text: 'histórico y fichas completas en HQ v1' })]));
  const total = g.hoy.length + g.semana.length + g.resto.length + g.pospuestas.length;
  if (!total && !lic.length) raiz.append(el('p', { class: 'mudo', text: 'Nada que decidir.' }));
  if (abierta) setTimeout(() => document.getElementById('d' + abierta)?.scrollIntoView({ block: 'start' }), 50);
}
