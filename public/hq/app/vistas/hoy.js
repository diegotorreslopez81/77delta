// Hoy (orden de Diego, 17-sep): cuadro de mando del CEO. Un vistazo, no una vista donde actuar: sin
// listas de tarjetas ni botones, cada cifra es un enlace a la vista donde sí se actúa. Sustituye al
// "Hoy" anterior (que duplicaba Reglas/Decisiones con las mismas tarjetas del tablero).
// Lote 2 de #259 (#1056, 18-sep): barra de progreso del objetivo, KPIs vivos (líneas del plan y correo
// pendiente de omc_kpis), urgentes en "Depende de ti", equipo activo (actividad en las últimas 2 h) y
// consumo por cuenta (omc_cuentas_estado + KPI cuentas.urge_tercera). Aquí nunca sale el coste en EUR
// de tokens: eso vive solo en Recursos/Cómputo (spec §8).
import { el, eur, fecha } from '../ui.js';
import { enCurso, prorrateo, cierres, semaforoCuentas } from '../estado.js';
import { tarjetaEncargo } from '../tarjeta.js';
import { urgeTercera, peorPct } from './recursos.js';

const DOS_HORAS = 2 * 36e5;
function bloque(titulo, kids, vacio) { return el('section', { class: 'seccion' }, [el('h2', { text: titulo }), ...(kids.length ? kids : [el('p', { class: 'mudo', text: vacio })])]); }
function metaTexto(o) { return (!o.unidad || o.unidad === 'EUR') ? eur(o.meta) : o.meta + ' ' + o.unidad; }
function corto(t, n = 60) { t = String(t || ''); return t.length > n ? t.slice(0, n - 1) + '…' : t; }
// Valor numérico de un KPI del payload (`kpis[clave] = {valor, texto, updated_at}`); null si no viaja.
function kpi(clave, kpis) { const k = (kpis || {})[clave]; return k && k.valor != null ? Number(k.valor) : null; }
function mini(v, l, s, href, color) {
  return el('a', { class: 'mini enlace' + (color ? ' ' + color : ''), href }, [el('span', { class: 'v', text: v }), el('span', { class: 'l', text: l }), s ? el('span', { class: 's', text: s }) : null]);
}
function haceTexto(ms) { const m = Math.max(0, Math.round(ms / 6e4)); return m < 60 ? 'hace ' + m + ' min' : 'hace ' + Math.floor(m / 60) + ' h'; }

// Urgentes: prioridad 1 o 2 (1 es la más alta), o vencimiento en menos de 24 h (o ya vencida).
export function urgentes(pendientes, ahora = new Date()) {
  const limite = ahora.getTime() + 24 * 36e5;
  return (pendientes || []).filter(p => {
    const pr = Number(p.prioridad);
    return (pr >= 1 && pr <= 2) || (p.vence && new Date(p.vence).getTime() <= limite);
  }).sort((a, b) => ((Number(a.prioridad) || 9) - (Number(b.prioridad) || 9)) || String(a.vence || '9').localeCompare(String(b.vence || '9')));
}
// Agentes con actividad reciente: sesión abierta (sesion_url_fecha) o último encargo (ultima_actividad)
// hace menos de 2 h, los inactivos fuera; el más reciente primero.
export function activosRecientes(agentes, ahora = new Date()) {
  return (agentes || []).map(a => {
    const ts = [a.sesion_url_fecha, a.ultima_actividad].filter(Boolean).map(x => new Date(x).getTime()).filter(x => !isNaN(x));
    return { ...a, _ts: ts.length ? Math.max(...ts) : null };
  }).filter(a => a.activo !== false && a._ts != null && ahora.getTime() - a._ts < DOS_HORAS).sort((a, b) => b._ts - a._ts);
}

// 1. Objetivo: contratado sobre la meta con barra de progreso y desviación contra el prorrateo (ver objetivo.js).
function bloqueObjetivo(objetivos, ahora) {
  return objetivos.map(o => {
    const meta = Number(o.meta) || 0, contratado = Number(o.contratado_eur) || 0;
    const alaFecha = prorrateo(meta, o.horizonte, ahora), desv = contratado - alaFecha;
    return el('a', { class: 'tarjeta enlace', href: '#direccion/objetivo' }, [
      el('p', { class: 'cifra', text: eur(contratado) + ' de ' + metaTexto(o) }),
      el('div', { class: 'barra' }, [el('i', { style: 'width:' + Math.min(100, Math.round(100 * contratado / (meta || 1))) + '%' })]),
      el('p', { class: 'mudo', text: 'a la fecha tocaría ' + eur(Math.round(alaFecha)) + ' · desviación ' + (desv < 0 ? '-' : '+') + eur(Math.abs(Math.round(desv))) }),
    ]);
  });
}
// 2. Depende de ti: el número, cuántas urgen y las tres más urgentes en una línea. Nunca un ancla a una
// decisión concreta ni botones: se actúa en Reglas/Decisiones.
function bloqueDependeDeTi(pendientes, ahora) {
  const hoyIso = ahora.toISOString().slice(0, 10);
  const vencenHoy = pendientes.filter(p => p.vence && String(p.vence).slice(0, 10) === hoyIso).length;
  const urg = urgentes(pendientes, ahora);
  const kids = [el('a', { class: 'tarjeta enlace' + (urg.length ? ' roja' : ''), href: '#reglas/decisiones' }, [
    el('p', { class: 'cifra', text: String(pendientes.length) }),
    el('p', { class: 'mudo', text: urg.length + ' urgentes · ' + vencenHoy + ' vencen hoy' }),
  ])];
  for (const p of urg.slice(0, 3)) {
    const cuando = p.vence ? 'vence ' + fecha(p.vence) : 'prioridad ' + p.prioridad;
    kids.push(el('a', { class: 'fila enlace urgente', href: '#reglas/decisiones' }, [el('span', { text: [cuando, p.agente || '', corto(p.titulo)].filter(Boolean).join(' · ') })]));
  }
  if (urg.length > 3) kids.push(el('a', { class: 'btn-enlace', href: '#reglas/decisiones', text: 'y ' + (urg.length - 3) + ' urgentes más' }));
  return kids;
}
// 3. Indicadores: correo sin contestar (KPI de hq-correo) y KPIs vivos de las líneas del plan con meta o
// valor; cada uno enlaza al tablero filtrado por su frente, donde se actúa.
function bloqueIndicadores(d) {
  const kids = [];
  const n = kpi('correo.pendientes.n', d.kpis);
  if (n != null) {
    const h = kpi('correo.pendientes.mas_antiguo_h', d.kpis);
    kids.push(mini(String(n), 'correos sin contestar', h ? 'el más antiguo hace ' + Math.round(h) + ' h' : '', '#operacion/expedientes', n > 0 ? 'rojo' : ''));
  }
  const frentes = (d.frentes || []).filter(f => f.kpi && (Number(f.meta) > 0 || Number(f.valor_actual) > 0)).slice(0, 8);
  for (const f of frentes) {
    const v = String(f.valor_actual ?? 0) + (Number(f.meta) > 0 ? ' / ' + f.meta : '') + (f.unidad ? ' ' + f.unidad : '');
    kids.push(mini(v, f.codigo + ' · ' + f.kpi, f.bloque_nombre || '', '#operacion/tablero?frente=' + encodeURIComponent(f.codigo)));
  }
  return kids.length ? [el('div', { class: 'embudo' }, kids)] : [];
}
// 4. Cierres en 7 días: hitos próximos (cierres() en estado.js), máximo 5 filas y "y N más".
function bloqueCierres(encargos, ahora) {
  const cs = cierres(encargos, ahora, 7);
  const filas = cs.slice(0, 5).map(e => el('a', { class: 'fila enlace', href: '#operacion/tablero' }, [el('span', { text: [fecha(e.fecha_hito), '#' + e.id, corto(e.texto), e.agente || ''].join(' · ') })]));
  const resto = cs.length - 5;
  if (resto > 0) filas.push(el('a', { class: 'btn-enlace', href: '#operacion/tablero', text: 'y ' + resto + ' más' }));
  return filas;
}
// 5. Equipo: activos, en curso y parados, y quién ha trabajado en las últimas 2 h (ficha del agente).
function bloqueEquipo(d, ahora) {
  const agentes = d.agentes || [];
  if (!agentes.length) return [];
  const activos = agentes.filter(a => a.activo !== false).length;
  const enc = enCurso(d.encargos).length;
  const parados = (d.encargos || []).filter(e => e.rojo).length;
  const rec = activosRecientes(agentes, ahora);
  const pills = rec.slice(0, 8).map(a => el('a', { class: 'pill verde activo', href: '#equipo/agente/' + a.id, text: (a.nombre || a.id) + ' · ' + haceTexto(ahora.getTime() - a._ts) }));
  return [
    el('p', { class: 'fila-cifras' }, [
      el('a', { class: 'enlace', href: '#equipo/organigrama', text: activos + ' activos' }),
      el('a', { class: 'enlace', href: '#equipo/organigrama', text: enc + ' en curso' }),
      el('a', { class: 'enlace', href: '#operacion/tablero', text: parados + ' parados' }),
    ]),
    el('p', { class: 'fila-cifras' }, pills.length ? pills : [el('span', { class: 'mudo', text: 'nadie activo en las últimas 2 h' })]),
  ];
}
// 6. Consumo: una línea por cuenta (peor de ventana y semana, con el semáforo de estado.js) y el aviso de
// tercera cuenta (KPI cuentas.urge_tercera o el cálculo local). Sin EUR: el coste vive en Recursos/Cómputo.
function bloqueConsumo(d) {
  const cuentas = d.cuentas || [];
  if (!cuentas.length) return [];
  const kids = cuentas.map(c => {
    const s = semaforoCuentas({ cuentas: [c] }) || { color: 'verde' };
    const fin = c.semana_fin ? 'reinicio semana ' + fecha(c.semana_fin, { hora: true }) : '';
    return el('a', { class: 'fila enlace', href: '#recursos/computo' }, [
      el('span', { class: 'pill ' + s.color, text: c.cuenta + ' ' + peorPct(c) + ' %' }),
      el('span', { text: ' semana ' + (c.pct_semana ?? '-') + ' % · ventana ' + (c.pct_ventana ?? '-') + ' %' + (fin ? ' · ' + fin : '') }),
    ]);
  });
  if (kpi('cuentas.urge_tercera', d.kpis) === 1 || urgeTercera(cuentas)) kids.push(el('a', { class: 'aviso rojo enlace', href: '#recursos/computo', text: 'urge la tercera cuenta: todas al 90 % o más' }));
  return kids;
}
// 7. Alertas: sesiones abiertas, encargos parados, correo sin contestar y cuentas saturadas, una línea cada uno.
function bloqueAlertas(d) {
  const sesionesAbiertas = (d.sesiones || []).filter(x => x.estado !== 'cerrada').length;
  const parados = (d.encargos || []).filter(e => e.rojo).length;
  const correo = kpi('correo.pendientes.n', d.kpis);
  const kids = [];
  if (sesionesAbiertas) kids.push(el('a', { class: 'enlace', href: '#operacion/expedientes', text: sesionesAbiertas + ' sesiones abiertas' }));
  if (parados > 0) kids.push(el('a', { class: 'enlace', href: '#operacion/tablero', text: parados + ' encargos parados' }));
  if (correo > 0) kids.push(el('a', { class: 'enlace', href: '#operacion/expedientes', text: correo + ' correos sin contestar' }));
  if (kpi('cuentas.urge_tercera', d.kpis) === 1 || urgeTercera(d.cuentas)) kids.push(el('a', { class: 'enlace', href: '#recursos/computo', text: 'cuentas saturadas: urge la tercera' }));
  return kids;
}

export function render(raiz, S, arg, filtros, ahora = new Date()) {
  const d = S.datos || {};
  if (d.rol === 'owner') {
    const dv = S.derivado || { objetivos: [] };
    raiz.append(bloque('Objetivo', bloqueObjetivo(dv.objetivos || [], ahora), 'sin objetivo'));
    raiz.append(bloque('Depende de ti', bloqueDependeDeTi(d.pendientes || [], ahora), null));
    raiz.append(bloque('Indicadores', bloqueIndicadores(d), 'sin indicadores'));
    raiz.append(bloque('Cierres en 7 días', bloqueCierres(d.encargos, ahora), 'ningún hito en 7 días'));
    raiz.append(bloque('Equipo', bloqueEquipo(d, ahora), 'sin agentes'));
    raiz.append(bloque('Consumo', bloqueConsumo(d), 'sin muestras de consumo'));
    raiz.append(bloque('Alertas', bloqueAlertas(d), 'sin alertas'));
  } else {
    // El token de agente no conoce su identidad en el payload (T4-c): se enseña lo que está en curso.
    raiz.append(bloque('Tus tarjetas', enCurso(d.encargos).map(e => tarjetaEncargo(e)), 'nada en curso'));
    const ses = (d.sesiones || []).filter(x => x.estado !== 'cerrada');
    raiz.append(bloque('Sesiones abiertas', ses.map(x => el('a', { class: 'tarjeta enlace', href: '#operacion/expedientes/' + x.expediente_id }, [
      el('p', { class: 'titulo', text: x.nombre + ' con ' + x.agente }), el('p', { class: 'mudo', text: x.estado + ' · ' + fecha(x.abierta || x.created_at, { hora: true }) })])), 'ninguna'));
  }
}
