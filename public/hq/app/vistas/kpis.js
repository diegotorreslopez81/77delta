// KPIs (#1057 tarea 29): cuadro de mando único con los paneles que antes encabezaban Tablero,
// Expedientes, Licitaciones, Plan estratégico y Equipo/Colaboradores. Esta vista no calcula nada
// nuevo: reúne por chip los paneles que cada módulo ya exporta (panelesObjetivo, panelesLicitaciones,
// panelesExpedientes, cuadroTablero, cuadroEquipo, cuadroColaboradores). Un agente solo ve los grupos
// cuyo dato viaja en su payload: tablero (encargos) y equipo (agentes) siempre; plan, licitaciones y
// expedientes son datos de owner (si faltan en el payload, el chip ni se pinta).
import { el } from '../ui.js';
import { kanban } from '../estado.js';
import { estadoDe, motivosNo, MOTIVOS_NO } from '../licitaciones.js';
import { panel, filaBarra, anchoLog } from '../cuadro.js';
import * as objetivo from './objetivo.js';
import * as licitaciones from './licitaciones.js';
import * as expedientes from './expedientes.js';
import * as tablero from './tablero.js';
import * as equipo from './equipo.js';
import * as colaboradores from './colaboradores.js';

export const GRUPOS = [
  { clave: 'plan', nombre: 'Plan', disponible: d => Array.isArray(d.objetivos) || Array.isArray(d.bloques) },
  { clave: 'licitaciones', nombre: 'Licitaciones', disponible: d => Array.isArray(d.licitaciones) },
  { clave: 'expedientes', nombre: 'Expedientes', disponible: d => Array.isArray(d.expedientes) },
  { clave: 'tablero', nombre: 'Tablero', disponible: d => Array.isArray(d.encargos) },
  { clave: 'equipo', nombre: 'Equipo', disponible: d => Array.isArray(d.agentes) },
];

function chips(d, grupo) {
  const disponibles = GRUPOS.filter(g => g.disponible(d));
  return el('div', { class: 'chips' }, [
    el('a', { class: 'chip' + (!grupo ? ' activo' : ''), href: '#kpis', text: 'Todos' }),
    ...disponibles.map(g => el('a', { class: 'chip' + (grupo === g.clave ? ' activo' : ''), href: '#kpis?grupo=' + g.clave, text: g.nombre })),
  ]);
}

function seccion(nombre, paneles) {
  return paneles && paneles.length ? el('section', { class: 'seccion kpi-grupo' }, [el('h2', { text: nombre }), el('div', { class: 'cuadro' }, paneles)]) : null;
}

// #1063: recuento puro de motivos de NO sobre todo el payload de licitaciones, para el panel "Por qué
// no vamos". Multietiqueta (una descartada con dos motivos cuenta en los dos), catálogo primero de
// mayor a menor y sin ceros, "Sin motivo" siempre al final si hay alguna descartada sin catálogo.
export function porMotivo(lics) {
  const cuenta = {};
  let sinMotivo = 0;
  for (const l of lics || []) {
    if (estadoDe(l) !== 'Descartada') continue;
    const motivos = motivosNo(l);
    if (motivos.length) motivos.forEach(m => { cuenta[m] = (cuenta[m] || 0) + 1; });
    else sinMotivo++;
  }
  const filas = MOTIVOS_NO.map(m => ({ motivo: m, n: cuenta[m] || 0 })).filter(f => f.n > 0).sort((a, b) => b.n - a.n);
  if (sinMotivo > 0) filas.push({ motivo: 'Sin motivo', n: sinMotivo });
  return filas;
}

// Panel de la pestaña Licitaciones (vive aquí y no en vistas/licitaciones.js porque es el único de los
// paneles de esa pestaña que no reutiliza otra vista: agrega directo sobre el payload). null si no hay
// ninguna descartada con datos que mostrar, para que seccion() no pinte un panel vacío.
function panelPorQueNo(d) {
  const lics = d.licitaciones || [];
  const filas = porMotivo(lics);
  if (!filas.length) return null;
  const descartadas = lics.filter(l => estadoDe(l) === 'Descartada');
  const conMotivo = descartadas.filter(l => motivosNo(l).length > 0).length;
  const max = Math.max(1, ...filas.map(f => f.n));
  return panel('Por qué no vamos', '#operacion/licitaciones?estado=descartadas', [
    el('div', { class: 'filas' }, filas.map(f => filaBarra(f.motivo, String(f.n), anchoLog(f.n, max), 'tinta-2',
      '#operacion/licitaciones?estado=descartadas&motivo=' + encodeURIComponent(f.motivo === 'Sin motivo' ? 'sin' : f.motivo)))),
    el('p', { class: 'sub', text: 'descartadas con motivo del catálogo · ' + conMotivo + ' de ' + descartadas.length }),
  ]);
}

// main.js vacía raiz y vuelve a llamar a render en cada recarga o cambio de ruta (mismo patrón que
// colaboradores.js): si mientras se espera la lista de colaboradores llega otro render, la respuesta
// tardía no se pinta.
let turno = 0;
export async function render(raiz, S, arg, filtrosRuta = {}, ahora = new Date()) {
  const mio = ++turno;
  const d = S.datos || {};
  const grupo = GRUPOS.some(g => g.clave === filtrosRuta.grupo) ? filtrosRuta.grupo : null;
  const quiere = clave => (!grupo || grupo === clave) && GRUPOS.find(g => g.clave === clave).disponible(d);
  raiz.append(el('h1', { text: 'KPIs' }), chips(d, grupo));
  const cont = el('div', {});
  raiz.append(cont);
  const bloques = [];
  if (quiere('plan')) bloques.push(seccion('Plan', objetivo.panelesObjetivo(S.derivado || { objetivos: [], bloques: [] }, ahora)));
  if (quiere('licitaciones')) {
    const pqn = panelPorQueNo(d);
    bloques.push(seccion('Licitaciones', [...licitaciones.panelesLicitaciones(d, ahora), ...(pqn ? [pqn] : [])]));
  }
  if (quiere('expedientes')) bloques.push(seccion('Expedientes', expedientes.panelesExpedientes(d, ahora)));
  if (quiere('tablero')) bloques.push(seccion('Tablero', tablero.cuadroTablero(S, kanban(d.encargos, {}), ahora)));
  if (quiere('equipo')) {
    const ags = d.agentes.filter(a => a.activo !== false);
    let cs = [];
    try { cs = await colaboradores.cargarColaboradores(); } catch { cs = []; }
    if (mio !== turno || raiz.isConnected === false) return;
    bloques.push(seccion('Equipo', [...equipo.cuadroEquipo(ags, S, ahora), ...colaboradores.cuadroColaboradores(cs, S)]));
  }
  const visibles = bloques.filter(Boolean);
  if (mio !== turno || raiz.isConnected === false) return;
  cont.append(...visibles);
  if (!visibles.length) cont.append(el('p', { class: 'mudo', text: 'Sin KPIs disponibles para este filtro.' }));
}
