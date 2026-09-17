// Hoy (plan 3a): ¿qué necesito hoy? Tres bloques y nada más. No es un tablero: las tarjetas viven en
// #operacion/tablero y el objetivo en #direccion/objetivo. Sustituye a inicio.js.
import { el, fecha } from '../ui.js';
import { semana, enCurso } from '../estado.js';
import { tarjetaEncargo } from '../tarjeta.js';

function bloque(titulo, kids, vacio) { return el('section', { class: 'seccion' }, [el('h2', { text: titulo }), ...(kids.length ? kids : [el('p', { class: 'mudo', text: vacio })])]); }

export function render(raiz, S) {
  const d = S.datos || {};
  if (d.rol === 'owner') {
    const pend = d.pendientes || [];
    raiz.append(bloque('Depende de ti', pend.slice(0, 20).map(p => el('a', { class: 'tarjeta enlace', href: '#reglas/decisiones/' + p.id }, [
      el('p', { class: 'titulo', text: p.titulo }), el('p', { class: 'mudo', text: [p.agente, p.vence ? 'vence ' + fecha(p.vence, { hora: true }) : null].filter(Boolean).join(' · ') })])), 'nada pendiente'));
    if (pend.length > 20) raiz.append(el('a', { class: 'btn-enlace', href: '#reglas/decisiones', text: 'ver las ' + pend.length }));
    const s = semana(d.encargos);
    raiz.append(bloque('Tus peticiones de la semana', [...s.parados, ...s.en_curso].map(e => tarjetaEncargo(e)).concat(
      s.hechos.length ? [el('p', { class: 'mudo', text: 'hechos: ' + s.hechos.map(e => '#' + e.id).join(', ') })] : []), 'sin peticiones tuyas en 7 días'));
  } else {
    // El token de agente no conoce su identidad en el payload (T4-c): se enseña lo que está en curso.
    raiz.append(bloque('Tus tarjetas', enCurso(d.encargos).map(e => tarjetaEncargo(e)), 'nada en curso'));
  }
  const ses = (d.sesiones || []).filter(x => x.estado !== 'cerrada');
  raiz.append(bloque('Sesiones abiertas', ses.map(x => el('a', { class: 'tarjeta enlace', href: '#operacion/expedientes/' + x.expediente_id }, [
    el('p', { class: 'titulo', text: x.nombre + ' con ' + x.agente }), el('p', { class: 'mudo', text: x.estado + ' · ' + fecha(x.abierta || x.created_at, { hora: true }) })])), 'ninguna'));
}
