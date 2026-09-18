// Equipo > Colaboradores (#1057 tarea 24, HQ 2.0.11): base de colaboradores externos (formadores y
// perfiles técnicos para memorias y UTE) con la línea del Home visual. Los datos no viajan en omc_hq_v2:
// se piden aparte con omc_colaboradores_lista (sin email ni notas) y se guardan 5 minutos para que la
// recarga periódica de main.js no repita la llamada. KPI A4: colaboradores con acuerdo firmado.
import { rpc } from '../api.js';
import { el, fecha, urlSegura } from '../ui.js';
import { donut, apilada, progreso } from '../graficos.js';
import { eurCorto, panel, cifra, grafico, leyenda, filaBarra } from '../cuadro.js';

const COLOR_ESTADO = { activo: 'tinta', contactado: 'tinta-2', propuesto: 'neutro-1', descartado: 'neutro-3' };
const COLORES = ['tinta', 'tinta-2', 'neutro-1', 'neutro-2', 'neutro-3'];
const colorEstado = e => COLOR_ESTADO[e] || 'neutro-2';

// Recuento [{l, v, color}] de una clave (o de cada valor de un array), de más a menos; desde el quinto, "otros".
export function recuento(xs, clave) {
  const m = new Map();
  for (const x of xs) for (const v of [].concat(x[clave] ?? []).filter(Boolean)) m.set(v, (m.get(v) || 0) + 1);
  const r = [...m].map(([l, v]) => ({ l, v })).sort((a, b) => (b.v - a.v) || a.l.localeCompare(b.l));
  const top = r.length > 5 ? [...r.slice(0, 4), { l: 'otros', v: r.slice(4).reduce((s, x) => s + x.v, 0) }] : r;
  return top.map((x, i) => ({ ...x, color: COLORES[i] }));
}

export function cuadroColaboradores(cs, S) {
  const a4 = (S.datos.frentes || []).find(f => f.codigo === 'A4'), meta = Number(a4?.meta) || 5;
  const conAcuerdo = cs.filter(c => c.acuerdo_fecha).length;
  const estados = [...new Set(cs.map(c => c.estado || 'sin estado'))].map(e => ({ l: e, v: cs.filter(c => (c.estado || 'sin estado') === e).length, color: colorEstado(e) }));
  const esp = recuento(cs, 'especialidades'), maxEsp = Math.max(1, ...esp.map(x => x.v));
  const origen = recuento(cs, 'origen');
  const colab = cs.flatMap(c => c.colaboraciones || []);
  return [
    panel('Colaboradores', '#equipo/colaboradores', [cifra(String(cs.length), 'en la base'), grafico(apilada(estados, 'colaboradores por estado'), 'fina'), leyenda(estados)], 'ancho-2'),
    panel('Con acuerdo firmado', '#operacion/tablero?frente=A4', [cifra(conAcuerdo + ' de ' + meta, 'objetivo A4 · colaboradores con acuerdo'),
      grafico(progreso(100 * conAcuerdo / meta, 'colaboradores con acuerdo'), 'fina')], conAcuerdo ? null : 'alerta'),
    panel('Por especialidad', '#equipo/colaboradores', esp.length ? esp.map(x => filaBarra(x.l, String(x.v), 100 * x.v / maxEsp, 'tinta')) : [el('p', { class: 'mudo', text: 'sin especialidades registradas' })], 'ancho-2'),
    panel('Por origen', '#equipo/colaboradores', [el('div', { class: 'donut-fila' }, [grafico(donut(origen, 'colaboradores por origen'), 'donut'), leyenda(origen)])]),
    panel('En expedientes', '#operacion/expedientes', [cifra(String(colab.length), colab.length ? 'colaboraciones en ' + new Set(colab.map(k => k.expediente_id || k.licitacion_expediente)).size + ' expedientes' : 'ningún colaborador asignado aún')]),
  ];
}

export function tarjetaColaborador(c) {
  const enlaces = [['CV', c.cv_url], ['Carpeta', c.carpeta_url], ['Acuerdo', c.acuerdo_url], ['LinkedIn', c.linkedin_url]].map(([t, u]) => [t, urlSegura(u)]).filter(e => e[1]);
  const colab = c.colaboraciones || [];
  return el('article', { class: 'tarjeta-rica tarjeta-colaborador' }, [
    el('div', { class: 'cab' }, [el('span', { class: 'pill estado' }, [el('i', { class: 'punto g-' + colorEstado(c.estado) }), c.estado || 'sin estado']),
      c.acuerdo_fecha ? el('span', { class: 'pill verde', text: 'acuerdo ' + fecha(c.acuerdo_fecha) }) : el('span', { class: 'pill', text: 'sin acuerdo' }),
      c.origen ? el('span', { class: 'plazo', text: c.origen }) : null]),
    el('h3', { text: c.nombre }),
    c.perfil ? el('p', { class: 'sub', text: c.perfil }) : null,
    el('div', { class: 'cifra-fila' }, [el('p', { class: 'cifra-l', text: c.tarifa_dia ? eurCorto(c.tarifa_dia) : 'tarifa sin dato' }), c.tarifa_dia ? el('span', { class: 'mudo', text: 'por día, sin IVA' }) : null]),
    (c.especialidades || []).length ? el('div', { class: 'enlaces' }, c.especialidades.map(e => el('span', { class: 'pill', text: e }))) : null,
    el('p', { class: 'solv', text: [c.disponibilidad, c.ubicacion, (c.idiomas || []).join(', ')].filter(Boolean).join(' · ') || 'disponibilidad sin dato' }),
    colab.length ? el('p', { class: 'solv' }, colab.map((k, i) => [i ? ' · ' : '', k.expediente_id ? el('a', { href: '#operacion/expedientes/' + k.expediente_id, text: k.expediente || '#' + k.expediente_id }) : (k.licitacion_expediente || 'licitación'), k.rol ? ' (' + k.rol + ')' : '']).flat()) : null,
    enlaces.length ? el('div', { class: 'enlaces' }, enlaces.map(([t, h]) => el('a', { href: h, target: '_blank', rel: 'noopener', text: t }))) : null,
  ]);
}

export function pintar(raiz, S, cs) {
  raiz.append(el('div', { class: 'fila enlace-kpis' }, [el('a', { class: 'btn-enlace', href: '#kpis?grupo=equipo', text: 'KPIs ›' })]));
  raiz.append(el('section', { class: 'seccion' }, [el('h2', { text: 'Base de colaboradores (' + cs.length + ')' }),
    cs.length ? el('div', { class: 'lista-rica' }, cs.map(tarjetaColaborador)) : el('p', { class: 'mudo', text: 'sin colaboradores dados de alta (hq.py colaborador alta)' })]));
}

// main.js vacía raiz y vuelve a llamar a render en cada recarga o cambio de ruta: si mientras se espera
// la RPC llega otro render (turno) o raiz ya no está en el documento, la respuesta tardía no se pinta.
let cache = null, turno = 0;
// Grupo 'Equipo' de KPIs (#1057 tarea 29): kpis.js necesita la misma lista de colaboradores que esta
// vista sin duplicar la llamada RPC ni el cacheo de 5 minutos; cuadroColaboradores() ya estaba exportada.
export async function cargarColaboradores(cargar = () => rpc('omc_colaboradores_lista')) {
  if (!cache || Date.now() - cache.t > 5 * 60e3) cache = { t: Date.now(), cs: (await cargar()) || [] };
  return cache.cs;
}
export async function render(raiz, S, arg, filtrosRuta = {}, cargar = () => rpc('omc_colaboradores_lista')) {
  const mio = ++turno;
  const yaCache = cache && Date.now() - cache.t <= 5 * 60e3;
  const espera = yaCache ? null : el('p', { class: 'mudo', text: 'cargando colaboradores…' });
  if (espera) raiz.append(espera);
  let cs;
  try { cs = await cargarColaboradores(cargar); }
  catch (err) { if (mio === turno && espera) espera.textContent = 'HQ no devuelve colaboradores: ' + err.message; return; }
  if (mio !== turno || raiz.isConnected === false) return;
  if (espera) espera.remove();
  pintar(raiz, S, cs);
}
export function limpiarCache() { cache = null; }
