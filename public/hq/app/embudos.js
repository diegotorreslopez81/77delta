// Embudos de KPIs (brief 2022, 19-sep): agregan en un solo sitio, por área, lo que hoy vive disperso en
// las pestañas de Licitaciones, Expedientes, Tablero y Equipo. Sin DOM: se prueban con node --test
// (test/embudos.test.mjs) sin necesitar el shim de document/window que arrastran las vistas. Cada paso
// de un embudo es { clave, titulo, n, importe, conversion, ruta }: importe/conversion son null cuando no
// aplican (paso sin dinero, primer paso sin anterior, paso anterior en cero) o el payload no trae el
// dato; nunca se inventan. Los pasos con salida lateral (no forman parte de la secuencia del embudo, p.
// ej. pausadas/descartadas en Licitaciones o caducados en Tablero) viajan aparte, en `laterales`.
import { estadoBase } from './licitaciones.js';
import { agentesActivos, kanban, COLUMNAS } from './estado.js';

// % de conversión de un paso sobre el anterior, redondeado a un decimal. null si no hay paso anterior o
// si el paso anterior está a cero (no se puede convertir "de cero"): así nunca sale Infinity ni NaN.
export function conversion(actual, previo) {
  if (previo == null || !previo) return null;
  return Math.round(1000 * actual / previo) / 10;
}
function sumaImporte(rows) { return rows.reduce((s, l) => s + (Number(l.importe) || 0), 0); }

// --- Licitaciones -------------------------------------------------------------------------------------
// Mismos estados y la misma función estadoBase() que alimentan los chips de Operación/Licitaciones
// (app/vistas/licitaciones.js, array ESTADOS): nuevas > por decidir > aprobadas > en redacción >
// presentadas. Pausadas y descartadas son salida lateral (Diego: "no como paso"), no un paso más.
// Ganadas/perdidas no tienen chip propio en esa pestaña (Adjudicada/Contratada nunca viajan en el array
// recortado del payload, y el chip 'descartadas' mezcla Retirada/No adjudicada con lo descartado antes
// de presentar) así que salen de lic_resumen y enlazan a la pestaña sin filtro; se anota como decisión
// en el informe. 'Retirada' no tiene clave propia en lic_resumen (hueco de datos: no se puede sumar a
// Perdidas sin inventar), así que cae en "Otros estados" en vez de desaparecer: se ve, no se pierde.
const PASOS_LIC = [
  ['nuevas', 'Nuevas', ['Nueva']],
  ['decidir', 'Por decidir', ['Por decidir', 'Analizada']],
  ['aprobadas', 'Aprobadas', ['Aprobada']],
  ['redaccion', 'En redacción', ['En redacción']],
  ['presentadas', 'Presentadas', ['Presentada']],
];
// 'Retirada' se deja fuera a propósito (ver comentario de arriba): sin bucket propio, cae en "otros".
const ESTADOS_LIC_CONOCIDOS = new Set([...PASOS_LIC.flatMap(p => p[2]), 'Pausada', 'Adjudicada', 'Contratada', 'Cerrada sin presentar', 'No adjudicada']);
const esDescartadaSucia = l => estadoBase(l).startsWith('Descartada');

function filaLic(clave, titulo, rows, ruta) { return { clave, titulo, n: rows.length, importe: sumaImporte(rows), conversion: null, ruta }; }
// n/eur de un estado de lic_resumen: prefiere el agregado del servidor (patrón filaResumen() de
// licitaciones.js); si no existe esa clave en el resumen, cuenta sobre el array crudo (por si el estado
// sí viaja ahí, como en un payload de agente antiguo o en un fixture de test sin lic_resumen).
function nEurEstado(clave, estados, rows, resumen) {
  const r = resumen?.[clave];
  if (r) return { n: Number(r.n) || 0, eur: r.eur != null ? Number(r.eur) : null };
  const sub = rows.filter(l => estados.includes(estadoBase(l)));
  return { n: sub.length, eur: sumaImporte(sub) };
}
// Combina varias partes {n,eur} (p. ej. adjudicadas + contratadas para Ganadas). eur solo se suma si
// alguna parte lo trae; si ninguna trae importe, se deja en null (no se inventa un 0).
function combinar(...partes) {
  let n = 0, eur = 0, hayEur = false;
  for (const p of partes) { n += p.n; if (p.eur != null) { eur += p.eur; hayEur = true; } }
  return { n, eur: hayEur ? eur : null };
}
function filaCombinada(clave, titulo, r, ruta) { return { clave, titulo, n: r.n, importe: r.eur, conversion: null, ruta }; }
// Descartadas: mismo predicado que usa embudo() en licitaciones.js (estado que empieza por 'Descartada'
// o decision en NO/NOK/DESCARTADA/DESCARTADO), reaplicado aquí para no importar esa función (agrupa en
// un orden distinto al que necesita este embudo). Con lic_resumen.descartadas presente, se usa ese.
const esDescartadaPredicado = l => estadoBase(l).startsWith('Descartada') || ['NO', 'NOK', 'DESCARTADA', 'DESCARTADO'].includes(String(l.decision || '').toUpperCase());
function filaDescartadas(rows, resumen, ruta) {
  const r = resumen?.descartadas;
  if (r) return { clave: 'descartadas', titulo: 'Descartadas', n: Number(r.n) || 0, importe: r.eur != null ? Number(r.eur) : null, conversion: null, ruta };
  return filaLic('descartadas', 'Descartadas', rows.filter(esDescartadaPredicado), ruta);
}

export function embudoLicitaciones(lics, resumen = {}) {
  const rows = lics || [];
  const pasos = PASOS_LIC.map(([clave, titulo, estados]) => filaLic(clave, titulo, rows.filter(l => estados.includes(estadoBase(l))), '#operacion/licitaciones?estado=' + clave));
  const ganadas = combinar(nEurEstado('adjudicadas', ['Adjudicada'], rows, resumen), nEurEstado('contratadas', ['Contratada'], rows, resumen));
  const noAdjudicadas = nEurEstado('no_adjudicadas', ['No adjudicada'], rows, resumen);
  const cerradas = nEurEstado('cerradas', ['Cerrada sin presentar'], rows, resumen);
  pasos.push(filaCombinada('ganadas', 'Ganadas', ganadas, '#operacion/licitaciones'));
  pasos.push(filaCombinada('perdidas', 'Perdidas', combinar(noAdjudicadas, cerradas), '#operacion/licitaciones'));
  // Conversión acumulada, no n/n entre estados excluyentes: el embudo es una foto (cada paso cuenta lo que
  // hoy está en ese estado), así que "presentadas / en redacción" daba 450 % con 9 presentadas y 2 en
  // redacción. El % de un paso es acumulado(paso) / acumulado(anterior), donde acumulado = lo que hay en
  // ese paso más todo lo que ya está más adelante en la cadena (ha llegado al menos hasta aquí): nunca
  // pasa de 100 %. Las no adjudicadas pasaron por Presentadas, así que suman en el acumulado de
  // presentadas y anteriores; cerradas sin presentar, pausadas y descartadas salieron antes y no suman.
  // Perdidas es terminal, hermana de Ganadas, y mezcla no adjudicadas con cerradas: sin % (sería mentir).
  const cadena = ['nuevas', 'decidir', 'aprobadas', 'redaccion', 'presentadas', 'ganadas'];
  const porClave = Object.fromEntries(pasos.map(p => [p.clave, p]));
  const acumulado = {};
  let acum = 0;
  for (const clave of [...cadena].reverse()) {
    acum += porClave[clave].n + (clave === 'presentadas' ? noAdjudicadas.n : 0);
    acumulado[clave] = acum;
  }
  for (let i = 1; i < cadena.length; i++) porClave[cadena[i]].conversion = conversion(acumulado[cadena[i]], acumulado[cadena[i - 1]]);
  const pausadas = filaCombinada('pausadas', 'Pausadas', nEurEstado('pausadas', ['Pausada'], rows, resumen), '#operacion/licitaciones?estado=pausadas');
  const descartadas = filaDescartadas(rows, resumen, '#operacion/licitaciones?estado=descartadas');
  // Estados desconocidos (o presentes en el array crudo sin encajar en ningún paso ni salida lateral,
  // p. ej. un valor nuevo del Sheet que aún no está en el catálogo): nunca se pierden, van a "Otros".
  const otros = rows.filter(l => !ESTADOS_LIC_CONOCIDOS.has(estadoBase(l)) && !esDescartadaSucia(l));
  const filaOtros = otros.length ? filaLic('otros', 'Otros estados', otros, '#operacion/licitaciones') : null;
  return { pasos, laterales: [pausadas, descartadas, filaOtros].filter(f => f && f.n > 0) };
}

// --- Expedientes ---------------------------------------------------------------------------------------
// Mismo agrupado que porFase() en app/vistas/expedientes.js (por x.estado_funnel, "sin fase" si falta),
// pero con importe agregado (porFase solo cuenta). Sin conversión: las fases no son un proceso secuencial
// fijo (se ordenan por volumen, como ya hace porFase), así que un % entre ellas no significa nada y el
// brief no lo pide para este grupo (solo lo pide explícitamente para Licitaciones). Cobro pendiente: no
// se pinta, ver decisión en el informe (el payload no trae ingresos/facturación por expediente, solo un
// único importe y un estado_economico por fila).
export function embudoExpedientes(exps) {
  const xs = (exps || []).filter(x => x.activo !== false);
  const grupos = {};
  for (const x of xs) { const f = x.estado_funnel || 'sin fase'; (grupos[f] ||= []).push(x); }
  const orden = Object.entries(grupos).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  const pasos = orden.map(([fase, rows]) => ({
    clave: fase, titulo: fase === 'sin fase' ? 'Sin fase' : fase, n: rows.length, importe: sumaImporte(rows), conversion: null,
    ruta: '#operacion/expedientes?tipo=todos&fase=' + encodeURIComponent(fase),
  }));
  return { pasos, laterales: [] };
}

// --- Tablero -------------------------------------------------------------------------------------------
// Las 5 columnas del kanban (COLUMNAS de estado.js, misma fuente que la pestaña Tablero) vía kanban(),
// que ya manda cualquier columna desconocida a 'backlog' (estado.js línea `k[e.columna] || k.backlog`):
// nada se pierde por construcción, sin necesidad de un bucket "otros" aparte. Caducados (hito vencido en
// una columna abierta) es la misma condición que vencidos() de app/vistas/tablero.js, reimplementada
// aquí para no importar esa vista (arrastra rpc de api.js y recargar de main.js, con efectos de DOM al
// cargarse) desde un módulo que se quiere puro. Sin importe: un encargo no tiene campo de dinero.
export function embudoTablero(encargos, ahora = new Date()) {
  const k = kanban(encargos, {});
  const pasos = COLUMNAS.map(([clave, titulo]) => ({ clave, titulo, n: k[clave].length, importe: null, conversion: null, ruta: '#operacion/tablero?estado=' + clave }));
  const hoy = ahora.toISOString().slice(0, 10);
  const abiertos = COLUMNAS.filter(([c]) => c !== 'hecho').flatMap(([c]) => k[c]);
  const vencidos = abiertos.filter(e => e.fecha_hito && String(e.fecha_hito).slice(0, 10) < hoy);
  const filaVencidos = { clave: 'vencidos', titulo: 'Caducados', n: vencidos.length, importe: null, conversion: null, ruta: '#operacion/tablero' };
  return { pasos, laterales: vencidos.length ? [filaVencidos] : [] };
}

// --- Equipo ---------------------------------------------------------------------------------------------
// No es un embudo (no hay pasos secuenciales): agentes activos ahora mismo (agentesActivos(), única
// fuente, sin duplicar el cálculo) y consumo semanal por cuenta en % (datos.cuentas, mismo campo que
// semaforoCuentas() en estado.js, pero mostrando TODAS las cuentas, no solo la peor). Nunca coste en
// EUR/USD: `n` es el % consumido (máximo entre pct_ventana y pct_semana, igual que semaforoCuentas),
// `importe` siempre null. Sin cuentas en el payload (agente, o token sin acceso), `cuentas` sale [].
export function resumenEquipo(agentes, encargos, cuentas, ahora = new Date()) {
  const activos = agentesActivos(agentes, encargos, ahora);
  const filas = (cuentas || [])
    .filter(c => c && (c.pct_ventana != null || c.pct_semana != null))
    .map(c => ({ clave: c.cuenta, titulo: c.cuenta, n: Math.max(Number(c.pct_ventana) || 0, Number(c.pct_semana) || 0), importe: null, conversion: null, ruta: '#equipo/organigrama' }))
    .sort((a, b) => b.n - a.n);
  return { activos, cuentas: filas };
}
