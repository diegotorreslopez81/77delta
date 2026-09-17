// Hoy (orden de Diego, 17-sep): cuadro de mando del CEO. Un vistazo, no una vista donde actuar: sin
// listas de tarjetas ni botones, cada cifra es un enlace a la vista donde sí se actúa. Sustituye al
// "Hoy" anterior (que duplicaba Reglas/Decisiones con las mismas tarjetas del tablero).
import { el, eur, fecha } from '../ui.js';
import { enCurso, prorrateo, cierres } from '../estado.js';
import { tarjetaEncargo } from '../tarjeta.js';

function bloque(titulo, kids, vacio) { return el('section', { class: 'seccion' }, [el('h2', { text: titulo }), ...(kids.length ? kids : [el('p', { class: 'mudo', text: vacio })])]); }
function metaTexto(o) { return (!o.unidad || o.unidad === 'EUR') ? eur(o.meta) : o.meta + ' ' + o.unidad; }

// 1. Objetivo: contratado sobre la meta y la desviación contra el prorrateo (ver objetivo.js).
function bloqueObjetivo(objetivos, ahora) {
  return objetivos.map(o => {
    const meta = Number(o.meta) || 0, contratado = Number(o.contratado_eur) || 0;
    const alaFecha = prorrateo(meta, o.horizonte, ahora), desv = contratado - alaFecha;
    return el('a', { class: 'tarjeta enlace', href: '#direccion/objetivo' }, [
      el('p', { class: 'cifra', text: eur(contratado) + ' de ' + metaTexto(o) }),
      el('p', { class: 'mudo', text: 'a la fecha tocaría ' + eur(Math.round(alaFecha)) + ' · desviación ' + (desv < 0 ? '-' : '+') + eur(Math.abs(Math.round(desv))) }),
    ]);
  });
}
// 2. Depende de ti: solo el número, nunca la lista de decisiones (esa vive en Reglas/Decisiones).
function bloqueDependeDeTi(pendientes, ahora) {
  const hoyIso = ahora.toISOString().slice(0, 10);
  const vencenHoy = pendientes.filter(p => p.vence && String(p.vence).slice(0, 10) === hoyIso).length;
  return [el('a', { class: 'tarjeta enlace', href: '#reglas/decisiones' }, [
    el('p', { class: 'cifra', text: String(pendientes.length) }),
    el('p', { class: 'mudo', text: vencenHoy + ' vencen hoy' }),
  ])];
}
// 3. Cierres en 7 días: hitos próximos (cierres() en estado.js), máximo 5 filas y "y N más".
function bloqueCierres(encargos, ahora) {
  const cs = cierres(encargos, ahora, 7);
  const filas = cs.slice(0, 5).map(e => {
    const t = String(e.texto || ''), corto = t.length > 60 ? t.slice(0, 59) + '…' : t;
    return el('a', { class: 'fila enlace', href: '#operacion/tablero' }, [el('span', { text: [fecha(e.fecha_hito), '#' + e.id, corto, e.agente || ''].join(' · ') })]);
  });
  const resto = cs.length - 5;
  if (resto > 0) filas.push(el('a', { class: 'btn-enlace', href: '#operacion/tablero', text: 'y ' + resto + ' más' }));
  return filas;
}
// 4. Equipo: activos, en curso y parados, cada uno enlazado a donde se ve el detalle.
function bloqueEquipo(d) {
  const agentes = d.agentes || [];
  if (!agentes.length) return [];
  const activos = agentes.filter(a => a.activo !== false).length;
  const enc = enCurso(d.encargos).length;
  const parados = (d.encargos || []).filter(e => e.rojo).length;
  return [el('p', { class: 'fila-cifras' }, [
    el('a', { class: 'enlace', href: '#equipo/organigrama', text: activos + ' activos' }),
    el('a', { class: 'enlace', href: '#equipo/organigrama', text: enc + ' en curso' }),
    el('a', { class: 'enlace', href: '#operacion/tablero', text: parados + ' parados' }),
  ])];
}
// 5. Alertas: sesiones abiertas y encargos parados, en una línea cada uno.
function bloqueAlertas(d) {
  const sesionesAbiertas = (d.sesiones || []).filter(x => x.estado !== 'cerrada').length;
  const parados = (d.encargos || []).filter(e => e.rojo).length;
  const kids = [];
  if (sesionesAbiertas) kids.push(el('a', { class: 'enlace', href: '#operacion/expedientes', text: sesionesAbiertas + ' sesiones abiertas' }));
  if (parados > 0) kids.push(el('a', { class: 'enlace', href: '#operacion/tablero', text: parados + ' encargos parados' }));
  return kids;
}

export function render(raiz, S, arg, filtros, ahora = new Date()) {
  const d = S.datos || {};
  if (d.rol === 'owner') {
    const dv = S.derivado || { objetivos: [] };
    raiz.append(bloque('Objetivo', bloqueObjetivo(dv.objetivos || [], ahora), 'sin objetivo'));
    raiz.append(bloque('Depende de ti', bloqueDependeDeTi(d.pendientes || [], ahora), null));
    raiz.append(bloque('Cierres en 7 días', bloqueCierres(d.encargos, ahora), 'ningún hito en 7 días'));
    raiz.append(bloque('Equipo', bloqueEquipo(d), 'sin agentes'));
    raiz.append(bloque('Alertas', bloqueAlertas(d), 'sin alertas'));
  } else {
    // El token de agente no conoce su identidad en el payload (T4-c): se enseña lo que está en curso.
    raiz.append(bloque('Tus tarjetas', enCurso(d.encargos).map(e => tarjetaEncargo(e)), 'nada en curso'));
    const ses = (d.sesiones || []).filter(x => x.estado !== 'cerrada');
    raiz.append(bloque('Sesiones abiertas', ses.map(x => el('a', { class: 'tarjeta enlace', href: '#operacion/expedientes/' + x.expediente_id }, [
      el('p', { class: 'titulo', text: x.nombre + ' con ' + x.agente }), el('p', { class: 'mudo', text: x.estado + ' · ' + fecha(x.abierta || x.created_at, { hora: true }) })])), 'ninguna'));
  }
}
