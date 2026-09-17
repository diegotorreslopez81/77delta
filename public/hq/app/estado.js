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
