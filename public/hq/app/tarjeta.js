// Tarjeta compacta de encargo, reutilizada por inicio, plan y el tablero.
import { el, fecha, horas } from './ui.js';
export function resumenEncargo(e, ahora = new Date()) {
  const t = String(e.texto || '');
  const partes = [e.agente || 'sin responsable', e.fecha_hito ? 'hito ' + fecha(e.fecha_hito) : 'sin hito'];
  if (e.rojo) partes.push(horas(e.fecha_avance || e.fecha, ahora) + ' h sin avance');
  return { codigo: e.codigo, titulo: t.length > 90 ? t.slice(0, 89) + '…' : t, sub: partes.join(' · '), clase: e.rojo ? 'roja' : '' };
}
export function tarjetaEncargo(e, { onAbrir } = {}) {
  const r = resumenEncargo(e);
  return el('article', { class: 'tarjeta encargo ' + r.clase, 'data-id': e.id, tabindex: 0, onclick: () => onAbrir ? onAbrir(e) : (location.hash = '#tablero/' + e.id) }, [
    el('div', { class: 'fila' }, [el('span', { class: 'pill codigo', text: r.codigo }), el('span', { class: 'mudo', text: '#' + e.id }), ...(e.etiquetas || []).map(x => el('span', { class: 'pill', text: x }))]),
    el('p', { class: 'titulo', text: r.titulo }), el('p', { class: 'mudo', text: r.sub })]);
}
