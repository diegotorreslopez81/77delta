// Funciones puras de licitaciones (plan 3b, tanda 2a): que Diego decida sobre las decidibles (unas
// 60) en vez de las 1.475 filas del feed, y el embudo de KPIs de Operacion/Licitaciones. Sin DOM,
// sin imports de vistas: se prueba con node --test.
export const DECIDIBLES = new Set(['Probable', 'Dudosa']);
export const ABIERTAS = new Set(['Nueva', 'Por decidir']);

export function pendiente(l) {
  const d = l?.decision;
  return d == null || d === '' || d === 'Pendiente';
}

// Nulls de cierre van al final; empate (incluido null contra null) se desempata por expediente.
function ordenCierre(a, b) {
  const ac = a.cierre, bc = b.cierre;
  if (ac == null && bc == null) return String(a.expediente || '').localeCompare(String(b.expediente || ''));
  if (ac == null) return 1;
  if (bc == null) return -1;
  return String(ac).localeCompare(String(bc)) || String(a.expediente || '').localeCompare(String(b.expediente || ''));
}

export function porDecidir(lics) {
  return (lics || [])
    .filter(l => pendiente(l) && ABIERTAS.has(l.estado) && DECIDIBLES.has(l.elegible))
    .sort(ordenCierre);
}

export function enCriba(lics) {
  return (lics || [])
    .filter(l => pendiente(l) && ABIERTAS.has(l.estado) && !DECIDIBLES.has(l.elegible))
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

// Orden fijo del embudo (Task 1, plan 3b). aprobadas/presentadas/adjudicadas/contratadas/descartadas/
// cerradas son exclusivas entre si por estado, salvo aprobadas que ademas admite decision 'OK' cuando
// el estado no ha avanzado a Presentada/Adjudicada/Contratada; cada fila cuenta una sola vez porque el
// filtro es un unico predicado OR, no la union de dos arrays.
export function embudo(lics, kpis = {}) {
  const rows = lics || [];
  const filas = [];
  const detectadas = kpis?.['lic.detectadas.n'];
  if (detectadas) filas.push({ clave: 'detectadas', nombre: 'Detectadas', n: Number(detectadas.valor), eur: null });
  const analizadas = kpis?.['lic.analizadas.n'];
  if (analizadas) filas.push({ clave: 'analizadas', nombre: 'Analizadas', n: Number(analizadas.valor), eur: null });
  filas.push(fila('por_decidir', 'Por decidir', porDecidir(rows)));
  filas.push(fila('en_criba', 'En criba', enCriba(rows)));
  filas.push(fila('aprobadas', 'Aprobadas', rows.filter(l => l.estado === 'Aprobada' || (l.decision === 'OK' && !['Presentada', 'Adjudicada', 'Contratada'].includes(l.estado)))));
  filas.push(fila('presentadas', 'Presentadas', rows.filter(l => l.estado === 'Presentada')));
  filas.push(fila('adjudicadas', 'Adjudicadas', rows.filter(l => l.estado === 'Adjudicada')));
  filas.push(fila('contratadas', 'Contratadas', rows.filter(l => l.estado === 'Contratada')));
  filas.push(fila('descartadas', 'Descartadas', rows.filter(l => (l.estado || '').startsWith('Descartada') || l.decision === 'No')));
  filas.push(fila('cerradas', 'Cerradas sin presentar', rows.filter(l => l.estado === 'Cerrada sin presentar')));
  return filas;
}
