// Estado en memoria y funciones puras de la interfaz. Sin DOM: se prueba con node --test.
export const S = { datos: null, filtros: { frente: null, bloque: null, agente: null, texto: '', etiqueta: null }, columnaMovil: 'en_curso' };
export const COLUMNAS = [['backlog', 'Backlog'], ['por_hacer', 'Por hacer'], ['en_curso', 'En curso'], ['bloqueado', 'Bloqueado'], ['hecho', 'Hecho']];
export function poner(datos) { S.datos = datos; S.derivado = derivar(datos); }
export function sinAcentos(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
// T4-c (ruling del controlador, 2026-09-16): omc_hq_v2 no expone 'yo' en la raíz. Con null la base
// resuelve la identidad del token (coalesce a 'agente' genérico); solo owner tiene un nombre fijo ('diego').
export const yo = S => S.datos?.rol === 'owner' ? 'diego' : null;

export function derivar(datos) {
  const porBloque = {};
  for (const f of datos.frentes || []) (porBloque[f.bloque_letra] ||= []).push(f);
  const rojosPorBloque = {};
  for (const e of datos.encargos || []) if (e.rojo) rojosPorBloque[e.bloque_letra] = (rojosPorBloque[e.bloque_letra] || 0) + 1;
  const bloques = (datos.bloques || []).map(b => ({ ...b, frentes: (porBloque[b.letra] || []).sort((x, y) => x.codigo.localeCompare(y.codigo)), abiertos: b.encargos_abiertos, rojos: rojosPorBloque[b.letra] || 0 }));
  return { objetivos: datos.objetivos || [], bloques };
}

export function filtrar(encargos, f = {}) {
  const t = sinAcentos(f.texto || '');
  return (encargos || []).filter(e =>
    (!f.frente || e.codigo === f.frente) && (!f.bloque || e.bloque_letra === f.bloque) &&
    // NIT #5 (parado en la revision, aplicado aqui por ser trivial): .includes() sobre e.agente dejaba
    // que un id de agente que fuera substring de otro (p. ej. 'ana' dentro de 'ariadna') colase en el
    // filtro; se compara con igualdad exacta, igual que ya se hacia con e.responsable.
    (!f.agente || sinAcentos(e.agente) === sinAcentos(f.agente) || sinAcentos(e.responsable) === sinAcentos(f.agente)) &&
    (!f.etiqueta || (e.etiquetas || []).includes(f.etiqueta)) &&
    (!t || sinAcentos([e.texto, e.interpretacion, e.origen, e.id].join(' ')).includes(t)));
}

const ordenKanban = (a, b) => (a.orden_kanban ?? 1e9) - (b.orden_kanban ?? 1e9) || String(a.fecha_hito || '9999').localeCompare(String(b.fecha_hito || '9999')) || a.id - b.id;
export function kanban(encargos, filtros = {}) {
  const k = Object.fromEntries(COLUMNAS.map(c => [c[0], []]));
  for (const e of filtrar(encargos, filtros)) (k[e.columna] || k.backlog).push(e);
  for (const c of Object.values(k)) c.sort(ordenKanban);
  return k;
}

export function semana(encargos, ahora = new Date()) {
  const desde = new Date(ahora.getTime() - 7 * 864e5);
  const pedidos = (encargos || []).filter(e => sinAcentos(e.origen).startsWith('diego') && new Date(e.fecha) >= desde);
  return { hechos: pedidos.filter(e => e.estado === 'hecho'), parados: pedidos.filter(e => e.rojo), en_curso: pedidos.filter(e => e.estado !== 'hecho' && e.estado !== 'descartado' && !e.rojo) };
}

// Plan 3a (tanda 1): funciones puras del shell y de Dirección/Objetivo.
// prorrateo: parte de la meta anual que tocaría a la fecha, por día natural (Europe/Madrid no importa:
// se usa la fecha UTC del instante, la diferencia de un día en el cambio de año es irrelevante aquí).
export function prorrateo(meta, horizonte, ahora = new Date()) {
  const m = Number(meta) || 0, y = ahora.getUTCFullYear();
  if (horizonte > y) return 0;
  if (horizonte < y) return m;
  const inicio = Date.UTC(y, 0, 1), fin = Date.UTC(y + 1, 0, 1);
  const dias = Math.round((fin - inicio) / 864e5), dia = Math.floor((ahora.getTime() - inicio) / 864e5) + 1;
  return dia >= dias ? m : m * dia / dias;
}
export function enCurso(encargos) { return (encargos || []).filter(e => e.estado === 'en_curso'); }
// Hoy como cuadro de mando (plan 3a, orden de Diego 17-sep): encargos con hito en los próximos `dias`
// días, nunca hecho/descartado, ordenados por fecha_hito ascendente. Pura, sin DOM.
export function cierres(encargos, ahora = new Date(), dias = 7) {
  const desde = ahora.getTime(), hasta = desde + dias * 864e5;
  return (encargos || [])
    .filter(e => e.fecha_hito && e.estado !== 'hecho' && e.estado !== 'descartado')
    .filter(e => { const t = new Date(e.fecha_hito).getTime(); return t >= desde && t <= hasta; })
    .sort((a, b) => new Date(a.fecha_hito) - new Date(b.fecha_hito));
}
// contador de la barra superior. El token de agente no sabe quién es (omc_hq_v2 no expone la identidad,
// ver T4-c), así que cuenta lo que hay en curso en vez de "sus" tarjetas.
export function contador(datos) {
  if (datos?.rol === 'owner') return { texto: 'Depende de ti', n: (datos.pendientes || []).length, href: '#hoy' };
  return { texto: 'En curso', n: enCurso(datos?.encargos).length, href: '#operacion/tablero' };
}
// semáforo de cuentas: `cuentas` entra en el payload en la tanda 3 (omc_cuentas_estado); hasta entonces null
// y la barra no pinta nada. Umbrales de la spec 2.1: verde < 80, ámbar 80-94, rojo >= 95.
export function semaforoCuentas(datos) {
  const cs = (datos?.cuentas || []).filter(c => c && c.pct_ventana != null);
  if (!cs.length) return null;
  const peor = cs.reduce((a, b) => (Number(b.pct_ventana) > Number(a.pct_ventana) ? b : a));
  const pct = Number(peor.pct_ventana);
  return { color: pct >= 95 ? 'rojo' : pct >= 80 ? 'ambar' : 'verde', pct, cuenta: peor.cuenta };
}
