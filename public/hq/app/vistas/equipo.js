// Equipo: lista por departamento y ficha de agente con frentes y encargos abiertos. Sustituye el
// stub de T1.
//
// T6-b (ruling del controlador, 2026-09-16): agentes[].jefe no existe en el payload real: se omite
// por completo (ni se lee ni se muestra "reporta a ...").
//
// Ultima instruccion del controlador (punto 3): "editar" frentes de un agente es una de las 4
// acciones de escritura de esta tarea y solo se muestra con S.datos.rol==='owner' (ya lo hacia el
// paso 3 del brief; se mantiene).
//
// Fix ronda 1 (revision del controlador, hallazgo BLOQUEA): agentes[].sesion_abierta es el
// expediente_id (bigint, schema-v2.sql:964), no un objeto con .expediente_id/.nombre. Se resuelve el
// nombre buscando primero en S.datos.sesiones (misma sesion, mismo agente) y si no aparece en
// S.datos.expedientes por id; si tampoco esta, se muestra '#' + id en vez de "undefined".
import { rpc } from '../api.js';
import { el, modal, toast, horas, urlSegura } from '../ui.js';
import { filtrar } from '../estado.js';
import { donut, apilada } from '../graficos.js';
import { panel, cifra, grafico, leyenda, filaBarra } from '../cuadro.js';
import { tarjetaEncargo } from '../tarjeta.js';
import { recargar } from '../main.js';

// Fix ronda 2 (B2): avatar_url lo publica hq.py agente avatar-url sin validar esquema en la BD.
// NIT #9 (parado, aplicado aqui por ser trivial): (a.nombre || a.id) puede ser '' si ambos faltan;
// se cae a '?' en vez de lanzar en [0] de una cadena vacia.
function avatar(a) { const url = urlSegura(a.avatar_url); return url ? el('img', { class: 'avatar', src: url, alt: '' }) : el('span', { class: 'avatar letra', text: ((a.nombre || a.id || '?')[0] || '?').toUpperCase() }); }
function latido(a, ahora = new Date()) { const h = horas(a.ultima_actividad, ahora); return h == null ? 'sin latido' : h < 1 ? 'activo ahora' : h < 24 ? 'hace ' + h + ' h' : 'hace ' + Math.floor(h / 24) + ' d'; }
function nombreExpedienteSesion(id, agenteId, S) {
  const s = (S.datos.sesiones || []).find(x => x.expediente_id === id && x.agente === agenteId);
  if (s?.nombre) return s.nombre;
  const e = (S.datos.expedientes || []).find(x => x.id === id);
  return e?.nombre || ('#' + id);
}

function editarFrentes(a, S) {
  const cajas = (S.datos.frentes || []).map(f => el('label', { class: 'fila' }, [el('input', { type: 'checkbox', value: f.codigo, checked: (a.frentes_codigos || []).includes(f.codigo) }), f.codigo + ' ' + f.linea]));
  const m = modal({ titulo: 'Frentes de ' + a.nombre, cuerpo: cajas, acciones: [el('button', { class: 'btn primario', text: 'Guardar', onclick: async () => {
    const sel = cajas.map(c => c.querySelector('input')).filter(i => i.checked).map(i => i.value);
    try { await rpc('omc_agente_frentes_set', { p_agente: a.id, p_frentes: sel }); m.cerrar(); toast('frentes guardados'); await recargar(); }
    catch (err) { toast('HQ rechaza: ' + err.message); }
  } })] });
}

function ficha(raiz, S, a) {
  raiz.append(el('a', { href: '#equipo/organigrama', class: 'btn-enlace', text: '← equipo' }));
  raiz.append(el('section', { class: 'objetivo fila' }, [avatar(a), el('div', {}, [
    el('h1', { text: a.nombre }),
    el('p', { class: 'mudo', text: [a.id, a.depto, 'nivel ' + a.nivel, a.modelo, a.cuenta ? 'cuenta ' + a.cuenta + '@' : null, latido(a)].filter(Boolean).join(' · ') })])]));
  raiz.append(el('section', { class: 'seccion' }, [
    el('div', { class: 'fila' }, [el('h2', { text: 'Frentes' }), S.datos.rol === 'owner' ? el('button', { class: 'btn-enlace', text: 'editar', onclick: () => editarFrentes(a, S) }) : null]),
    ...(a.frentes_codigos || []).map(c => { const f = (S.datos.frentes || []).find(x => x.codigo === c); return el('a', { class: 'pill codigo', href: '#operacion/tablero?frente=' + c, text: c + (f ? ' ' + f.linea : '') }); }),
    (a.frentes_codigos || []).length ? null : el('p', { class: 'mudo', text: 'sin frentes asignados' })]));
  const enc = filtrar(S.datos.encargos, { agente: a.id }).filter(e => e.estado !== 'hecho' && e.estado !== 'descartado');
  raiz.append(el('section', { class: 'seccion' }, [el('h2', { text: 'Encargos abiertos (' + enc.length + ')' }), ...enc.map(e => tarjetaEncargo(e))]));
  const sesionUrl = urlSegura(a.sesion_url);
  const acciones = [
    sesionUrl ? el('a', { class: 'btn primario', href: sesionUrl, text: 'Abrir sesión' }) : el('span', { class: 'mudo', text: 'sin sesión publicada' }),
    a.sesion_abierta ? el('a', { class: 'pill sesion', href: '#operacion/expedientes/' + a.sesion_abierta, text: 'en sesión: ' + nombreExpedienteSesion(a.sesion_abierta, a.id, S) }) : null];
  raiz.append(el('section', { class: 'seccion fila' }, acciones));
}

// Perfiles vivos (#1057 tarea 23, HQ 2.0.10): la lista del organigrama pasa a cuadro de mando con la
// línea del Home visual. Latido en cuatro tramos (activo menos de 1 h, hoy menos de 24 h, dormido, sin
// latido); verde y ámbar solo en la pill del semáforo, el resto en tinta y neutros.
export const TRAMOS = [['activo', 'activo ahora', 'tinta'], ['hoy', 'hoy', 'tinta-2'], ['dormido', 'más de 24 h', 'neutro-2'], ['sin', 'sin latido', 'neutro-3']];
export function tramo(a, ahora = new Date()) { const h = horas(a.ultima_actividad, ahora); return h == null ? 'sin' : h < 1 ? 'activo' : h < 24 ? 'hoy' : 'dormido'; }
const SEMAFORO = { activo: 'verde', hoy: 'ambar' };
const COLORES_DEPTO = ['tinta', 'tinta-2', 'neutro-1', 'neutro-2', 'neutro-3'];
// Departamentos por número de agentes; a partir del quinto se agrupan en "otros".
export function porDepto(ags) {
  const m = new Map();
  for (const a of ags) { const d = a.depto || 'sin depto'; m.set(d, (m.get(d) || 0) + 1); }
  const xs = [...m].map(([l, v]) => ({ l, v })).sort((x, y) => (y.v - x.v) || x.l.localeCompare(y.l));
  const top = xs.length > 5 ? [...xs.slice(0, 4), { l: 'otros', v: xs.slice(4).reduce((s, x) => s + x.v, 0) }] : xs;
  return top.map((x, i) => ({ ...x, color: COLORES_DEPTO[i] }));
}

export function cuadroEquipo(ags, S, ahora = new Date()) {
  const n = t => ags.filter(a => tramo(a, ahora) === t).length;
  const segs = TRAMOS.map(([t, l, color]) => ({ l, v: n(t), color }));
  const vivos = n('activo') + n('hoy');
  const deps = porDepto(ags);
  const carga = ags.filter(a => a.encargos_abiertos > 0).sort((x, y) => y.encargos_abiertos - x.encargos_abiertos);
  const max = Math.max(1, ...carga.map(a => a.encargos_abiertos));
  const total = carga.reduce((s, a) => s + a.encargos_abiertos, 0);
  const enSesion = ags.filter(a => a.sesion_abierta);
  return [
    panel('Equipo activo', '#equipo/organigrama', [cifra(String(ags.length), vivos + ' con latido en las últimas 24 h'),
      grafico(apilada(segs, 'agentes por latido'), 'fina'), leyenda(segs)], 'ancho-2'),
    panel('Por departamento', '#equipo/organigrama', [el('div', { class: 'donut-fila' }, [grafico(donut(deps, 'agentes por departamento'), 'donut'), leyenda(deps)])]),
    panel('Carga de encargos', '#operacion/tablero', [cifra(String(total), 'encargos abiertos en ' + carga.length + (carga.length === 1 ? ' agente' : ' agentes')),
      ...carga.slice(0, 6).map(a => filaBarra(a.nombre || a.id, String(a.encargos_abiertos), 100 * a.encargos_abiertos / max, 'tinta', '#equipo/agente/' + a.id))], 'ancho-2'),
    panel('En sesión', '#equipo/organigrama', [cifra(String(enSesion.length), enSesion.length ? enSesion.map(a => a.nombre || a.id).join(' · ') : 'nadie en sesión ahora')]),
  ];
}

export function tarjetaAgente(a, S, ahora = new Date()) {
  const t = tramo(a, ahora), f = a.frentes_codigos || [];
  return el('article', { class: 'tarjeta-rica tarjeta-agente' }, [
    el('div', { class: 'cab' }, [avatar(a), el('span', { class: 'pill estado' + (SEMAFORO[t] ? ' ' + SEMAFORO[t] : '') }, [el('i', { class: 'punto g-' + TRAMOS.find(x => x[0] === t)[2] }), latido(a, ahora)]),
      a.sesion_abierta ? el('a', { class: 'pill sesion', href: '#operacion/expedientes/' + a.sesion_abierta, text: 'en sesión: ' + nombreExpedienteSesion(a.sesion_abierta, a.id, S) }) : null]),
    el('h3', {}, [el('a', { href: '#equipo/agente/' + a.id, text: a.nombre || a.id })]),
    el('p', { class: 'sub', text: [a.depto, 'nivel ' + a.nivel, a.modelo, a.cuenta ? a.cuenta + '@' : null].filter(Boolean).join(' · ') }),
    el('div', { class: 'cifra-fila' }, [el('p', { class: 'cifra-l', text: String(a.encargos_abiertos || 0) }), el('span', { class: 'mudo', text: a.encargos_abiertos === 1 ? 'encargo abierto' : 'encargos abiertos' })]),
    f.length ? el('div', { class: 'enlaces' }, f.map(c => el('a', { class: 'pill codigo', href: '#operacion/tablero?frente=' + c, text: c }))) : el('p', { class: 'solv', text: 'sin frentes asignados' }),
  ]);
}

export function render(raiz, S, arg, filtrosRuta = {}, ahora = new Date()) {
  // NIT #9 (parado, aplicado aqui por ser trivial): x.nombre/y.nombre pueden faltar en un agente mal
  // dado de alta; localeCompare sobre undefined lanza TypeError y tira toda la vista.
  const ags = (S.datos.agentes || []).filter(a => a.activo !== false).sort((x, y) => (x.nivel - y.nivel) || (x.nombre || '').localeCompare(y.nombre || ''));
  if (arg) { const a = ags.find(x => x.id === arg); if (a) return ficha(raiz, S, a); }
  raiz.append(el('div', { class: 'cuadro' }, cuadroEquipo(ags, S, ahora)));
  const deptos = [...new Set(ags.map(a => a.depto))];
  for (const d of deptos) raiz.append(el('section', { class: 'seccion' }, [el('h2', { text: d }), el('div', { class: 'lista-rica' }, ags.filter(a => a.depto === d).map(a => tarjetaAgente(a, S, ahora)))]));
}
