// Hoy (#1057 tarea 29, orden de Diego 19-sep): Home deja de ser un cuadro de KPIs (eso vive en KPIs)
// y vuelve a ser una lista de lo que toca actuar hoy. Owner: la franja de alertas, la bandeja de
// decisiones justo debajo (lo primero que se lee) y tres paneles compactos de lo que se sale de madre
// si no se mira: encargos vencidos o parados, licitaciones que cierran esta semana y sesiones abiertas.
// Los diez paneles agregados (Objetivo, Pipeline, Embudo, Expedientes, Frentes, Encargos, Cierres,
// Equipo, Consumo) se fueron a #kpis; aquí no se calcula ni se pinta ningún agregado, solo lo accionable.
import { el, fecha } from '../ui.js';
import { enCurso, agentesActivos } from '../estado.js';
import { tarjetaEncargo } from '../tarjeta.js';
import { panel, cifra } from '../cuadro.js';
import { urgeTercera } from './recursos.js';
import { estadoDe } from '../licitaciones.js';
import * as decisiones from './decisiones.js';

const DIA = 864e5;
function bloque(titulo, kids, vacio) { return el('section', { class: 'seccion' }, [el('h2', { text: titulo }), ...(kids.length ? kids : [el('p', { class: 'mudo', text: vacio })])]); }
function corto(t, n = 60) { t = String(t || ''); return t.length > n ? t.slice(0, n - 1) + '…' : t; }
// Valor numérico de un KPI del payload (`kpis[clave] = {valor, texto, updated_at}`); null si no viaja.
function kpi(clave, kpis) { const k = (kpis || {})[clave]; return k && k.valor != null ? Number(k.valor) : null; }
const dia = t => new Date(t).toISOString().slice(0, 10);

// Franja de semáforos: lo que pide atención ahora, una píldora por alerta (o "sin alertas" en verde).
// 2.0.20 (orden de Diego 19-sep): la primera píldora es siempre "N agentes activos", que sale de
// agentesActivos() en estado.js, la misma fuente que la cabecera del Tablero. Nunca coste aquí.
export function franja(d, urg, ahora = new Date()) {
  const sesiones = (d.sesiones || []).filter(x => x.estado !== 'cerrada').length;
  const parados = (d.encargos || []).filter(e => e.rojo).length;
  const correo = kpi('correo.pendientes.n', d.kpis) || 0;
  const tercera = kpi('cuentas.urge_tercera', d.kpis) === 1 || urgeTercera(d.cuentas);
  const pills = [
    urg ? ['rojo', urg + ' urgentes tuyas', '#hoy'] : null,
    parados ? ['rojo', parados + ' encargos parados', '#operacion/tablero'] : null,
    tercera ? ['rojo', 'cuentas saturadas', '#recursos/computo'] : null,
    correo ? ['ambar', correo + ' correos sin contestar', '#operacion/expedientes'] : null,
    sesiones ? ['ambar', sesiones + ' sesiones abiertas', '#operacion/expedientes'] : null,
  ].filter(Boolean);
  const act = agentesActivos(d.agentes, d.encargos, ahora);
  const todas = [
    act.n ? ['verde', act.n + (act.n === 1 ? ' agente activo' : ' agentes activos'), '#operacion/tablero?estado=en_curso']
      : ['neutro-2', 'ningún agente activo', '#operacion/tablero?estado=en_curso'],
    ...(pills.length ? pills : [['verde', 'sin alertas', '#operacion/tablero']]),
  ];
  return el('div', { class: 'franja' }, todas.map(([c, t, h]) => el('a', { class: 'semaforo-pill ' + c, href: h }, [el('i', { class: 'punto g-' + c }), el('span', { text: t })])));
}

export function urgentes(pendientes, ahora = new Date()) {
  const limite = ahora.getTime() + 24 * 36e5;
  return (pendientes || []).filter(p => {
    const pr = Number(p.prioridad);
    return (pr >= 1 && pr <= 2) || (p.vence && new Date(p.vence).getTime() <= limite);
  }).sort((a, b) => ((Number(a.prioridad) || 9) - (Number(b.prioridad) || 9)) || String(a.vence || '9').localeCompare(String(b.vence || '9')));
}

// Encargos abiertos con el hito pasado sin cerrar o marcados rojo (bloqueados/parados); los parados
// primero, luego los más vencidos. El detalle completo vive en Operación/Tablero, aquí solo los peores 8.
export function vencidosYParados(encargos, ahora = new Date()) {
  const hoy = dia(ahora.getTime());
  return (encargos || [])
    .filter(e => e.columna !== 'hecho' && ((e.fecha_hito && String(e.fecha_hito).slice(0, 10) < hoy) || e.rojo))
    .sort((a, b) => (b.rojo ? 1 : 0) - (a.rojo ? 1 : 0) || String(a.fecha_hito || '9999').localeCompare(String(b.fecha_hito || '9999')))
    .slice(0, 8);
}

// Licitaciones aprobadas o presentadas cuyo cierre cae en los próximos `dias` días.
export function proximosCierres(licitaciones, ahora = new Date(), dias = 7) {
  const desde = ahora.getTime(), hasta = desde + dias * DIA;
  return (licitaciones || [])
    .filter(l => ['Aprobada', 'Presentada'].includes(estadoDe(l)) && l.cierre)
    .filter(l => { const t = new Date(l.cierre).getTime(); return t >= desde && t <= hasta; })
    .sort((a, b) => String(a.cierre).localeCompare(String(b.cierre)));
}

function panelVencidosParados(encargos, ahora) {
  const es = vencidosYParados(encargos, ahora);
  return panel('Vencidos y parados', '#operacion/tablero', [
    cifra(String(es.length), es.length ? 'con el hito pasado o bloqueados' : 'nada parado'),
    es.length ? el('ul', { class: 'lista-corta' }, es.map(e => el('li', { text: '#' + e.id + ' ' + corto(e.texto, 46) + ' · ' + (e.rojo ? 'parado' : 'venció ' + fecha(e.fecha_hito)) }))) : null,
  ], es.length ? 'alerta' : '');
}

function panelProximosCierres(licitaciones, ahora) {
  const cs = proximosCierres(licitaciones, ahora);
  return panel('Próximos cierres', '#operacion/licitaciones', [
    cifra(String(cs.length), cs.length === 1 ? 'licitación cierra esta semana' : 'licitaciones cierran esta semana'),
    cs.length ? el('ul', { class: 'lista-corta' }, cs.map(l => el('li', { text: l.expediente + ' ' + corto(l.resumen_corto || l.objeto || '', 40) + ' · cierra ' + fecha(l.cierre) }))) : null,
  ]);
}

function panelSesiones(sesiones) {
  const ses = (sesiones || []).filter(x => x.estado !== 'cerrada');
  return panel('Sesiones abiertas', '#operacion/expedientes', [
    cifra(String(ses.length), ses.length ? 'en curso ahora mismo' : 'ninguna abierta'),
    ses.length ? el('ul', { class: 'lista-corta' }, ses.map(x => el('li', { text: (x.nombre || 'Expediente') + ' con ' + x.agente + ' · ' + x.estado }))) : null,
  ]);
}

export function render(raiz, S, arg, filtros, ahora = new Date()) {
  const d = S.datos || {};
  if (d.rol === 'owner') {
    raiz.append(franja(d, urgentes(d.pendientes, ahora).length, ahora));
    decisiones.montar(raiz, S, arg);
    raiz.append(el('div', { class: 'cuadro' }, [panelVencidosParados(d.encargos, ahora), panelProximosCierres(d.licitaciones, ahora), panelSesiones(d.sesiones)]));
  } else {
    // El token de agente no conoce su identidad en el payload (T4-c): d.encargos ya viaja recortado a
    // lo suyo, así que "ver las restantes" enlaza sin filtro extra a Operación/Tablero.
    const enc = enCurso(d.encargos), primeras = enc.slice(0, 10), resto = enc.length - primeras.length;
    raiz.append(bloque('Tus tarjetas', primeras.map(e => tarjetaEncargo(e)), 'nada en curso'));
    if (resto > 0) raiz.append(el('p', { class: 'mudo' }, [el('a', { href: '#operacion/tablero', text: 'ver las ' + resto + ' restantes' })]));
    const ses = (d.sesiones || []).filter(x => x.estado !== 'cerrada');
    raiz.append(bloque('Sesiones abiertas', ses.map(x => el('a', { class: 'tarjeta enlace', href: '#operacion/expedientes/' + x.expediente_id }, [
      el('p', { class: 'titulo', text: x.nombre + ' con ' + x.agente }), el('p', { class: 'mudo', text: x.estado + ' · ' + fecha(x.abierta || x.created_at, { hora: true }) })])), 'ninguna'));
  }
}
