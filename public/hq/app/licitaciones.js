// Funciones puras de licitaciones (plan 3b, tanda 2a): que Diego decida sobre las decidibles (unas
// 60) en vez de las 1.475 filas del feed, y el embudo de KPIs de Operacion/Licitaciones. Sin DOM,
// sin imports de vistas: se prueba con node --test.
export const DECIDIBLES = new Set(['Probable', 'Dudosa']);
export const ABIERTAS = new Set(['Nueva', 'Por decidir']);

// C1 (revision final del controlador): estado '' (cadena vacia, valor por defecto de la columna en
// BD) se trata como 'Nueva' en todo el modulo, igual que ya hace schema-v2.sql en omc_hq_v2 con
// coalesce(nullif(x->>'estado', ''), 'Nueva'). Sin esto una fila recien detectada con estado ''
// caia fuera de ABIERTAS y no aparecia ni en porDecidir ni en enCriba.
export function estadoDe(l) {
  return (l?.estado || '').trim() || 'Nueva';
}

export function pendiente(l) {
  const d = l?.decision;
  return d == null || d === '' || d === 'Pendiente';
}

// Nulls de cierre van al final; empate (incluido null contra null) se desempata por expediente.
export function ordenCierre(a, b) {
  const ac = a.cierre, bc = b.cierre;
  if (ac == null && bc == null) return String(a.expediente || '').localeCompare(String(b.expediente || ''));
  if (ac == null) return 1;
  if (bc == null) return -1;
  return String(ac).localeCompare(String(bc)) || String(a.expediente || '').localeCompare(String(b.expediente || ''));
}

export function porDecidir(lics) {
  return (lics || [])
    .filter(l => pendiente(l) && ABIERTAS.has(estadoDe(l)) && DECIDIBLES.has(l.elegible))
    .sort(ordenCierre);
}

export function enCriba(lics) {
  return (lics || [])
    .filter(l => pendiente(l) && ABIERTAS.has(estadoDe(l)) && !DECIDIBLES.has(l.elegible))
    .sort(ordenCierre);
}

export function porElegible(lics) {
  const g = {};
  for (const l of lics || []) { const k = l.elegible || 'Sin clasificar'; (g[k] ||= []).push(l); }
  return Object.entries(g).sort((a, b) => b[1].length - a[1].length);
}

export function solvenciaTexto(l) {
  const t = l?.solvencia || '';
  if (!t || t.startsWith('?')) return 'sin dato';
  return t.length > 160 ? t.slice(0, 160) + '…' : t;
}

function sumaImporte(rows) { return rows.reduce((s, l) => s + (Number(l.importe) || 0), 0); }
function fila(clave, nombre, rows) { return { clave, nombre, n: rows.length, eur: sumaImporte(rows) }; }

// Task 3 (ruling del controlador): el payload del servidor solo trae licitaciones abiertas; adjudicadas,
// contratadas, descartadas y cerradas llegan agregadas en d.lic_resumen (n/eur ya sumados alli). Si existe
// resumen[clave] se usa eso (Number con default 0); si no, se sigue contando el array como antes, para que
// el embudo no se quede vacio con datos antiguos o de un agente que aun no manda lic_resumen.
function filaResumen(clave, nombre, rows, resumen) {
  const r = resumen?.[clave];
  if (r) return { clave, nombre, n: Number(r.n ?? 0), eur: Number(r.eur ?? 0) };
  return fila(clave, nombre, rows);
}

// Orden fijo del embudo (Task 1, plan 3b; I1 de la revision final anade pausadas). aprobadas/
// presentadas/pausadas/adjudicadas/contratadas/descartadas/cerradas son exclusivas entre si por
// estado, salvo aprobadas que ademas admite decision 'OK' cuando el estado no ha avanzado a
// Presentada/Adjudicada/Contratada; cada fila cuenta una sola vez porque el filtro es un unico
// predicado OR, no la union de dos arrays.
export function embudo(lics, kpis = {}, resumen = {}) {
  const rows = lics || [];
  const filas = [];
  const detectadas = kpis?.['lic.detectadas.n'];
  if (detectadas) filas.push({ clave: 'detectadas', nombre: 'Detectadas', n: Number(detectadas.valor) || 0, eur: null });
  else if (resumen?.total) filas.push({ clave: 'detectadas', nombre: 'Detectadas', n: Number(resumen.total.n) || 0, eur: null });
  const analizadas = kpis?.['lic.analizadas.n'];
  if (analizadas) filas.push({ clave: 'analizadas', nombre: 'Analizadas', n: Number(analizadas.valor) || 0, eur: null });
  filas.push(fila('por_decidir', 'Por decidir', porDecidir(rows)));
  filas.push(fila('en_criba', 'En criba', enCriba(rows)));
  // C2 (revision final): aprobadas y presentadas tambien pueden venir de lic_resumen cuando existe
  // (el array de 'licitaciones' ya no se recorta a 7 dias para estos dos estados, pero lic_resumen
  // sigue siendo la fuente completa, sin el limite de pestana/30 dias de omc_hq; ver Deuda aceptada).
  filas.push(filaResumen('aprobadas', 'Aprobadas', rows.filter(l => estadoDe(l) === 'Aprobada' || (l.decision === 'OK' && !['Presentada', 'Adjudicada', 'Contratada'].includes(estadoDe(l)))), resumen));
  filas.push(filaResumen('presentadas', 'Presentadas', rows.filter(l => estadoDe(l) === 'Presentada'), resumen));
  // I1 (revision final): fila pausadas, misma fuente (lic_resumen o array) que aprobadas/presentadas;
  // la vista decide si la pinta (solo cuando n > 0).
  filas.push(filaResumen('pausadas', 'Pausadas', rows.filter(l => estadoDe(l) === 'Pausada'), resumen));
  filas.push(filaResumen('adjudicadas', 'Adjudicadas', rows.filter(l => estadoDe(l) === 'Adjudicada'), resumen));
  filas.push(filaResumen('contratadas', 'Contratadas', rows.filter(l => estadoDe(l) === 'Contratada'), resumen));
  // Minor 8 (revision final): mismo predicado de descartada que la SQL (estado empieza por
  // 'Descartada' o decision en NO/NOK/DESCARTADA/DESCARTADO, sin distinguir mayusculas).
  filas.push(filaResumen('descartadas', 'Descartadas', rows.filter(l => estadoDe(l).startsWith('Descartada') || ['NO', 'NOK', 'DESCARTADA', 'DESCARTADO'].includes(String(l.decision || '').toUpperCase())), resumen));
  filas.push(filaResumen('cerradas', 'Cerradas sin presentar', rows.filter(l => estadoDe(l) === 'Cerrada sin presentar'), resumen));
  return filas;
}

// Pipeline por mes de cierre (Home y Operación/Licitaciones): importe de aprobadas y presentadas desde el mes
// en curso; lo anterior cae en la primera columna y lo posterior (o sin fecha) en la última.
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export function pipelinePorMes(licitaciones, ahora = new Date(), meses = 6) {
  const y0 = ahora.getUTCFullYear(), m0 = ahora.getUTCMonth();
  const cols = Array.from({ length: meses }, (_, i) => ({ etiqueta: MESES[(m0 + i) % 12] + (i === meses - 1 ? '+' : ''), presentada: 0, aprobada: 0 }));
  for (const l of licitaciones || []) {
    const est = String(l.estado || '').toLowerCase();
    if (est !== 'aprobada' && est !== 'presentada') continue;
    const c = l.cierre ? new Date(l.cierre) : null;
    const i = c && !isNaN(c) ? (c.getUTCFullYear() - y0) * 12 + c.getUTCMonth() - m0 : 0;
    cols[Math.min(meses - 1, Math.max(0, i))][est] += Number(l.importe) || 0;
  }
  return cols;
}
// Embudo acumulado desde lic_resumen (estados excluyentes): lo presentado incluye lo ya resuelto.

// Tipologia del organo de contratacion (tarjetas ricas, encargo #1057): deriva una categoria legible
// del texto libre de 'organo' para poder filtrar sin columna nueva en la BD. Gana el primer patron
// que matchea, en este orden.
const TIPOLOGIA_RE = [
  ['Ayuntamiento', /ajuntament|ayuntamiento|concello|udala|alcald/i],
  ['Diputación', /diputaci|consell insular|cabildo/i],
  ['Consorcio', /consorci/i],
  ['Autonómica', /generalitat|conselleria|departament|junta de|gobierno de|xunta|comunidad de|servei|servicio .* de salud/i],
  ['Estatal', /ministerio|estatal|instituto|agencia|sociedad mercantil|entidad p[uú]blica|m\.p\./i],
  ['Universidad', /universi/i],
  ['Empresa pública', /s\.a\.|s\.l\.|empresa/i],
];
export const TIPOLOGIAS = [...TIPOLOGIA_RE.map(x => x[0]), 'Otro'];
export function tipologia(organo) {
  const t = String(organo || '');
  for (const [nombre, re] of TIPOLOGIA_RE) if (re.test(t)) return nombre;
  return 'Otro';
}

// Sin columna de solvencia normalizada: 'sin solvencia' cuando el texto declara exencion (159.6,
// 'no exige', 'sin acreditaci'); si hay texto y no la declara, se entiende que exige.
export function sinSolvencia(l) {
  const t = String(l?.solvencia || '').toLowerCase();
  return /159\.6|no exige|sin acreditaci/.test(t);
}

// Catalogo cerrado de motivos de NO (encargo #1063), mismo orden que omc_motivos_no() en SQL y
// MOTIVOS_NO en scripts/hq/hq.py: es el orden en que Diego los ve, tanto en los chips del modal de
// descarte como en el panel de KPIs.
export const MOTIVOS_NO = ['Fuera de España', 'Suministro/hardware', 'No TIC ni formación', 'Solvencia/clasificación',
  'Presencial', 'Sin pliego', 'Plazo corto', 'Importe bajo', 'Competencia/consorcio', 'Duplicada'];

// Motivos de NO reales de una licitacion: solo lo de l.motivos que esta en el catalogo cerrado. Una
// aprobada/presentada trae en 'motivos' los motivos de SI del Sheet (texto libre de Sales), asi que
// para ellas esto siempre devuelve [] en vez de colar texto ajeno al catalogo.
export function motivosNo(l) {
  return (l?.motivos || []).filter(m => MOTIVOS_NO.includes(m));
}

// Filtro puro para la vista: tipologia/solvencia/fuente/tipo/motivo/desiertas, todos opcionales (sin
// valor no filtra). 'desiertas' lo aplica la vista solo cuando tiene sentido mostrarlo (pestaña criba).
// 'motivo' es un motivo del catalogo, o 'sin' para las descartadas sin ningun motivo reconocido.
export function filtrar(rows, f = {}) {
  return (rows || []).filter(l =>
    (!f.tipologia || tipologia(l.organo) === f.tipologia)
    && (!f.solvencia || f.solvencia === 'todas' || (f.solvencia === 'sin solvencia' ? sinSolvencia(l) : !sinSolvencia(l)))
    && (!f.fuente || l.pestana === f.fuente)
    && (!f.tipo || l.tipo === f.tipo)
    && (!f.motivo || (f.motivo === 'sin' ? (estadoDe(l) === 'Descartada' && motivosNo(l).length === 0) : motivosNo(l).includes(f.motivo)))
    && (!f.desiertas || estadoDe(l) === 'Cerrada sin presentar'));
}
