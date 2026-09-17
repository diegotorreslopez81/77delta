import { el, fecha, eur } from '../ui.js';
import { semana } from '../estado.js';
import { tarjetaEncargo } from '../tarjeta.js';

function bloque(titulo, kids, vacio) { return el('section', { class: 'seccion' }, [el('h2', { text: titulo }), ...(kids.length ? kids : [el('p', { class: 'mudo', text: vacio })])]); }
function metaTexto(obj) { return (!obj.unidad || obj.unidad === 'EUR') ? eur(obj.meta) : obj.meta + ' ' + obj.unidad; }

export function render(raiz, S) {
  const d = S.datos, s = semana(d.encargos);
  const obj = (d.objetivos || []).find(o => o.horizonte === new Date().getFullYear()) || d.objetivos?.[0];
  if (obj) raiz.append(el('section', { class: 'objetivo' }, [
    el('p', { class: 'mudo', text: 'Objetivo ' + obj.horizonte }),
    el('h1', { text: eur(obj.contratado_eur) + ' de ' + metaTexto(obj) }),
    el('p', { class: 'mudo', text: obj.titulo + ' · presentado: ' + eur(obj.presentado_eur) }),
    el('div', { class: 'barra' }, [el('i', { style: 'width:' + Math.min(100, 100 * (obj.contratado_eur || 0) / (obj.meta || 1)) + '%' })])]));
  const pend = d.pendientes || [];
  raiz.append(bloque('Lo que depende de ti', pend.slice(0, 8).map(p => el('a', { class: 'tarjeta enlace', href: '#decisiones/' + p.id }, [
    el('p', { class: 'titulo', text: p.titulo }), el('p', { class: 'mudo', text: [p.agente, p.vence ? 'vence ' + fecha(p.vence, { hora: true }) : null].filter(Boolean).join(' · ') })])), 'nada pendiente'));
  if (pend.length > 8) raiz.append(el('a', { class: 'btn-enlace', href: '#decisiones', text: 'ver las ' + pend.length }));
  raiz.append(bloque('Lo que pediste esta semana', [
    ...s.parados.map(e => tarjetaEncargo(e)), ...s.en_curso.map(e => tarjetaEncargo(e)),
    s.hechos.length ? el('p', { class: 'mudo', text: 'hechos: ' + s.hechos.map(e => '#' + e.id).join(', ') }) : null].filter(Boolean), 'sin peticiones tuyas en 7 días'));
  const rojos = (d.encargos || []).filter(e => e.rojo && !s.parados.includes(e));
  raiz.append(bloque('Parados más de 48 h', rojos.slice(0, 10).map(e => tarjetaEncargo(e)), 'ninguno'));
  const ses = (d.sesiones || []).filter(x => x.estado !== 'cerrada');
  raiz.append(bloque('Sesiones abiertas', ses.map(x => el('a', { class: 'tarjeta enlace', href: '#expedientes/' + x.expediente_id }, [el('p', { class: 'titulo', text: x.nombre + ' con ' + x.agente }), el('p', { class: 'mudo', text: x.estado + ' · ' + fecha(x.abierta || x.created_at, { hora: true }) })])), 'ninguna'));
  raiz.append(el('p', { class: 'mudo pie' }, [el('a', { href: '/hq/v1/', text: 'HQ v1 (licitaciones y contactos)' }), ' · ', el('button', { class: 'btn-enlace', 'data-salir': true, text: 'salir' })]));
}
