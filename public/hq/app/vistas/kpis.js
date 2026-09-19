// KPIs (#1057 tarea 29, rediseño brief 2022 19-sep): cuadro de mando único con TODO lo que antes vivía
// disperso por pestañas, agrupado por área y cada área como embudo de conversión con nº e importe por
// estado (petición literal de Diego: "el funnel de conversión y los importes en cada estado del funnel").
// Los helpers de agregación son puros y viven en ../embudos.js (se prueban sin DOM); esta vista solo los
// llama y los pinta con las piezas de cuadro.js. Orden de arriba a abajo: Licitaciones, Expedientes,
// Tablero, Equipo, Objetivo (antes "Plan"; mismo clave 'plan' para no romper la ruta #kpis?grupo=plan).
// Un agente solo ve los grupos cuyo dato viaja en su payload (mismo criterio que antes, GRUPOS.disponible).
import { el } from '../ui.js';
import { estadoDe, motivosNo, MOTIVOS_NO } from '../licitaciones.js';
import { panel, cifra, filaBarra, anchoLog, eurCorto } from '../cuadro.js';
import { embudoLicitaciones, embudoExpedientes, embudoTablero, resumenEquipo } from '../embudos.js';

export const GRUPOS = [
  { clave: 'licitaciones', nombre: 'Licitaciones', disponible: d => Array.isArray(d.licitaciones) },
  { clave: 'expedientes', nombre: 'Expedientes', disponible: d => Array.isArray(d.expedientes) },
  { clave: 'tablero', nombre: 'Tablero', disponible: d => Array.isArray(d.encargos) },
  { clave: 'equipo', nombre: 'Equipo', disponible: d => Array.isArray(d.agentes) },
  { clave: 'plan', nombre: 'Objetivo', disponible: d => Array.isArray(d.objetivos) || Array.isArray(d.bloques) },
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

// #1063: filas del panel "Por qué no vamos". Desde la 2.0.18 omc_hq_v2 trae 'lic_motivos' ya contado en
// SQL ({ descartadas, con_motivo, motivos: [{ motivo, n }] }), porque las descartadas no viajan en el
// array 'licitaciones' (peso del payload); si falta, se cuenta sobre el payload con porMotivo.
export function filasMotivos(d) {
  const r = d?.lic_motivos;
  if (r && Array.isArray(r.motivos)) {
    const filas = r.motivos.map(f => ({ motivo: f.motivo, n: Number(f.n) || 0 })).filter(f => f.n > 0).sort((a, b) => b.n - a.n);
    const total = Number(r.descartadas) || 0, conMotivo = Number(r.con_motivo) || 0;
    if (total - conMotivo > 0) filas.push({ motivo: 'Sin motivo', n: total - conMotivo });
    return { filas, total, conMotivo };
  }
  const lics = d?.licitaciones || [];
  const descartadas = lics.filter(l => estadoDe(l) === 'Descartada');
  return { filas: porMotivo(lics), total: descartadas.length, conMotivo: descartadas.filter(l => motivosNo(l).length > 0).length };
}

// Panel de la pestaña Licitaciones (vive aquí y no en vistas/licitaciones.js porque es el único de los
// paneles de esa pestaña que no reutiliza otra vista: agrega directo sobre el payload). null si no hay
// ninguna descartada con datos que mostrar, para que seccion() no pinte un panel vacío.
function panelPorQueNo(d) {
  const { filas, total, conMotivo } = filasMotivos(d);
  if (!filas.length) return null;
  const max = Math.max(1, ...filas.map(f => f.n));
  return panel('Por qué no vamos', '#operacion/licitaciones?estado=descartadas', [
    el('div', { class: 'filas' }, filas.map(f => filaBarra(f.motivo, String(f.n), anchoLog(f.n, max), 'tinta-2',
      '#operacion/licitaciones?estado=descartadas&motivo=' + encodeURIComponent(f.motivo === 'Sin motivo' ? 'sin' : f.motivo)))),
    el('p', { class: 'sub', text: 'descartadas con motivo del catálogo · ' + conMotivo + ' de ' + total }),
  ]);
}

// --- Embudo genérico (brief 2022) ---------------------------------------------------------------------
// Ancho de barra proporcional al nº de forma lineal sobre el paso mayor del grupo (no logarítmica como
// anchoLog: en un embudo lo que importa es ver el estrechamiento real entre pasos consecutivos). Mínimo
// 3% si n > 0 para que un paso pequeño no desaparezca visualmente.
function anchoEmbudo(n, max) { return n > 0 ? Math.max(3, Math.round(100 * n / max)) : 0; }
// Texto de cada fila: nº siempre; importe si el paso lo trae (siempre "sin IVA", el mismo campo que ya
// muestran las cards de Licitaciones y Expedientes, ver decisión en el informe); % de conversión si
// embudos.js lo calculó para ese paso (solo Licitaciones lo pide el brief).
function valorPaso(f) {
  const partes = [String(f.n)];
  if (f.importe != null) partes.push(eurCorto(f.importe) + ' sin IVA');
  if (f.conversion != null) partes.push(String(f.conversion).replace('.', ',') + ' %');
  return partes.join(' · ');
}
// Panel de un grupo con forma { pasos, laterales } (de embudos.js). Los laterales (pausadas,
// descartadas, otros, caducados...) van debajo de un rótulo separador: no son un paso de la secuencia
// (Diego: "descartadas/pausadas como salida lateral del embudo, no como paso"). null si no hay nada que
// pintar (p. ej. Expedientes sin ningún expediente en el payload), para que seccion() no deje un hueco.
function panelEmbudo(titulo, ruta, resultado) {
  const { pasos, laterales } = resultado;
  if (!pasos.length && !laterales.length) return null;
  const max = Math.max(1, ...pasos.map(f => f.n), ...laterales.map(f => f.n));
  const fila = f => filaBarra(f.titulo, valorPaso(f), anchoEmbudo(f.n, max), 'tinta-2', f.ruta);
  return panel(titulo, ruta, [
    pasos.length ? el('div', { class: 'filas' }, pasos.map(fila)) : null,
    laterales.length ? el('p', { class: 'sub', text: 'Fuera del embudo' }) : null,
    laterales.length ? el('div', { class: 'filas' }, laterales.map(fila)) : null,
  ], 'ancho-2');
}

// --- Equipo (brief 2022) -------------------------------------------------------------------------------
// No es un embudo: agentes activos ahora (agentesActivos(), única fuente, vía resumenEquipo) y, si el
// payload trae cuentas (solo owner), consumo semanal por cuenta en %. Mismos umbrales de color que
// semaforoCuentas() en estado.js (rojo >= 95, ámbar >= 80): no se inventa una escala nueva.
const colorConsumo = n => (n >= 95 ? 'rojo' : n >= 80 ? 'ambar' : 'tinta-2');
function panelEquipo(r) {
  const { activos, cuentas } = r;
  const nombres = activos.agentes.map(a => a.nombre).join(' · ');
  return panel('Equipo activo', '#equipo/organigrama', [
    cifra(String(activos.n), activos.n ? nombres : 'ningún agente activo ahora mismo'),
    cuentas.length ? el('div', { class: 'filas' }, cuentas.map(c => filaBarra(c.titulo, Math.round(c.n) + ' %', c.n, colorConsumo(c.n), c.ruta))) : null,
  ], 'ancho-2');
}

// --- Objetivo (antes "Plan") ---------------------------------------------------------------------------
// Brief: "una sola cifra de avance del objetivo anual, enlazada al Plan". Busca el objetivo del año en
// curso en d.objetivos (crudo, no S.derivado: mismo criterio que GRUPOS.disponible más abajo); si no lo
// hay, el más próximo en el futuro. Sin objetivos en el payload, no se pinta nada.
function panelObjetivoKpi(d, ahora) {
  const obs = d.objetivos || [];
  if (!obs.length) return null;
  const anio = ahora.getUTCFullYear();
  const o = obs.find(x => Number(x.horizonte) === anio) || [...obs].sort((a, b) => Number(a.horizonte) - Number(b.horizonte)).find(x => Number(x.horizonte) > anio);
  if (!o) return null;
  const meta = Number(o.meta) || 0, contratado = Number(o.contratado_eur) || 0;
  const pct = meta > 0 ? Math.round(100 * contratado / meta) : 0;
  return panel('Objetivo ' + o.horizonte, '#direccion/objetivo', [cifra(pct + ' %', eurCorto(contratado) + ' contratado de ' + eurCorto(meta) + ' de meta')]);
}

// Sin fetch propio (a diferencia de la versión anterior, que esperaba a cargarColaboradores()): todos los
// helpers de embudos.js son puros y síncronos, así que render() ya no necesita ser async ni el guardia de
// "turno" que evitaba pintar una respuesta tardía (app/main.js llama a render() sin esperar su resultado,
// así que tampoco depende de que siga siendo una promesa).
export function render(raiz, S, arg, filtrosRuta = {}, ahora = new Date()) {
  const d = S.datos || {};
  const grupo = GRUPOS.some(g => g.clave === filtrosRuta.grupo) ? filtrosRuta.grupo : null;
  const quiere = clave => (!grupo || grupo === clave) && GRUPOS.find(g => g.clave === clave).disponible(d);
  raiz.append(el('h1', { text: 'KPIs' }), chips(d, grupo));
  const bloques = [];
  if (quiere('licitaciones')) {
    const emb = panelEmbudo('Embudo de licitaciones', '#operacion/licitaciones', embudoLicitaciones(d.licitaciones, d.lic_resumen));
    const pqn = panelPorQueNo(d);
    bloques.push(seccion('Licitaciones', [...(emb ? [emb] : []), ...(pqn ? [pqn] : [])]));
  }
  if (quiere('expedientes')) {
    const emb = panelEmbudo('Embudo de expedientes', '#operacion/expedientes?tipo=todos', embudoExpedientes(d.expedientes));
    bloques.push(seccion('Expedientes', emb ? [emb] : []));
  }
  if (quiere('tablero')) {
    const emb = panelEmbudo('Encargos por columna', '#operacion/tablero', embudoTablero(d.encargos, ahora));
    bloques.push(seccion('Tablero', emb ? [emb] : []));
  }
  if (quiere('equipo')) bloques.push(seccion('Equipo', [panelEquipo(resumenEquipo(d.agentes, d.encargos, d.cuentas, ahora))]));
  if (quiere('plan')) {
    const p = panelObjetivoKpi(d, ahora);
    bloques.push(seccion('Objetivo', p ? [p] : []));
  }
  const visibles = bloques.filter(Boolean);
  raiz.append(el('div', {}, visibles.length ? visibles : [el('p', { class: 'mudo', text: 'Sin KPIs disponibles para este filtro.' })]));
}
