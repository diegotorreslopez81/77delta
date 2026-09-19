// Tablero Kanban: filtros, alta de encargo, arrastre y detalle.
import { rpc } from '../api.js';
import { el, modal, toast, fecha, campoTexto } from '../ui.js';
import { apilada } from '../graficos.js';
import { panel, cifra, grafico, leyenda, filaBarra } from '../cuadro.js';
import { kanban, filtrar, COLUMNAS, yo, enCurso, agentesActivos } from '../estado.js';
import { hojaFiltros, pillsActivos } from '../filtros.js';
import { tarjetaEncargo } from '../tarjeta.js';
import { accionAlSoltar, habilitarArrastre } from '../dnd.js';
import { abrirDetalle, moverEncargo } from '../detalle.js';
import { recargar } from '../main.js';

// T4-c (ruling del controlador, 2026-09-16): omc_hq_v2 no expone 'yo' en la raíz; con null la base
// resuelve la identidad del token (yo() vive en estado.js). Efecto en este fichero: sin un id de
// agente real en el payload, una tarjeta de agente nunca coincide con yo(S) para un token que no sea
// owner, así que el arrastre queda restringido al owner hasta que el backend exponga la identidad
// del agente (se anota en el informe).

// 2.0.20 (feedback de Diego del 19-sep desde el iPhone): fuera la barra `filtros fila` con selects y
// fuera las pestañas de móvil. Arriba, chips de columna (el embudo del Tablero); el resto de filtros,
// en la hoja común de app/filtros.js. Puras y probadas sin DOM: columnaChip y seccionesTablero.
export function columnaChip(valorRuta) {
  const v = String(valorRuta || '');
  return COLUMNAS.some(([c]) => c === v) ? v : '';
}
export function seccionesTablero(d = {}) {
  const etiquetas = [...new Set((d.encargos || []).flatMap(e => e.etiquetas || []))].sort();
  return [
    { clave: 'bloque', titulo: 'Bloque', opciones: (d.bloques || []).map(b => [b.letra, b.letra + ' ' + b.nombre]) },
    // Los frentes no se recortan por el bloque elegido: el código ya lleva la letra delante y así la
    // hoja no depende del orden en que se tocan las secciones.
    { clave: 'frente', titulo: 'Frente', opciones: (d.frentes || []).map(x => [x.codigo, x.codigo + ' ' + x.linea]) },
    { clave: 'agente', titulo: 'Agente', opciones: (d.agentes || []).map(a => [a.id, a.nombre || a.id]) },
    { clave: 'etiqueta', titulo: 'Etiqueta', opciones: etiquetas.map(x => [x, x]) },
    { clave: 'texto', titulo: 'Buscar', libre: true },
  ];
}
// Cabecera "Ahora mismo" del Tablero con estado=en_curso. El recuento sale de agentesActivos(), la
// misma función que la pill de Home: no hay dos criterios de "activo".
export function cabeceraAhora(S, ahora = new Date()) {
  const { n, agentes } = agentesActivos(S.datos.agentes, S.datos.encargos, ahora);
  const m = enCurso(S.datos.encargos).length;
  return el('section', { class: 'ahora-mismo' }, [
    el('h2', { text: 'Ahora mismo · ' + n + (n === 1 ? ' agente activo' : ' agentes activos') + ' · ' + m + (m === 1 ? ' encargo en curso' : ' encargos en curso') }),
    el('div', { class: 'chips chips-ahora' }, n ? agentes.map(a => el('a', {
      class: 'pill verde', href: '#equipo/agente/' + encodeURIComponent(a.id),
      title: a.encargo ? '#' + a.encargo.id + ' ' + a.encargo.titulo : 'sin encargo en curso',
    }, [el('i', { class: 'punto g-verde' }), a.nombre + ' · ' + (a.encargo ? corto(a.encargo.titulo, 40) : 'sin encargo en curso')]))
      : [el('span', { class: 'pill', text: 'ningún agente activo' })]),
  ]);
}

// T4-b (correccion del controlador vs. lo verificado en schema-v2.sql, se anota en el informe): la
// tabla dice que omc_encargo_alta ignora 'etiquetas', pero el insert de omc_encargo_alta (linea ~211
// del schema) SI incluye la columna etiquetas leyendo p->'etiquetas'. Se comprobó directamente antes de
// escribir esto: se mantienen las etiquetas dentro de la propia alta (como el brief original) y no se
// añade una segunda llamada a omc_encargo_editar (que además es solo-owner, ver nota en detalle.js).
function nuevoEncargo(S) {
  const d = S.datos, f = S.filtros;
  // Brief 2021 (capa C): clave fija 'tablero:nuevo' (un solo modal de alta a la vez, no hace falta id).
  const texto = campoTexto({ rows: 3, placeholder: 'Qué hay que hacer (empieza por el verbo)', 'data-conservar': 'tablero:nuevo' });
  const frente = el('select', {}, [el('option', { value: '', text: 'Frente (obligatorio)' }), ...(d.frentes || []).map(x => el('option', { value: x.codigo, selected: x.codigo === f.frente, text: x.codigo + ' ' + x.linea }))]);
  const resp = el('select', {}, [el('option', { value: '', text: 'Responsable (por defecto el del frente)' }), ...(d.agentes || []).map(a => el('option', { value: a.id, text: a.nombre }))]);
  const hito = el('input', { class: 'campo', type: 'date' }), etiq = el('input', { class: 'campo', placeholder: 'etiquetas separadas por coma' });
  const m = modal({ titulo: 'Nuevo encargo', cuerpo: [texto, frente, resp, hito, etiq], acciones: [el('button', { class: 'btn', text: 'Cancelar', onclick: () => m.cerrar() }), el('button', { class: 'btn primario', text: 'Crear', onclick: async () => {
    if (!texto.value.trim() || !frente.value) { toast('texto y frente son obligatorios'); return; }
    try {
      const r = await rpc('omc_encargo_alta', { p: { texto: texto.value.trim(), frente: frente.value, responsable: resp.value || null, fecha_hito: hito.value || null, etiquetas: etiq.value.split(',').map(s => s.trim()).filter(Boolean), origen: 'Diego HQ ' + new Date().toISOString().slice(0, 16).replace('T', ' ') } });
      texto.olvidarBorrador?.();
      m.cerrar(); toast('encargo #' + r.id + ' creado'); await recargar();
    } catch (err) { toast('HQ rechaza: ' + err.message); }
  } })] });
}

// Cuadro de mando (#1057 tarea 22, HQ 2.0.9; regla de kit #221): cifras del conjunto filtrado, así que
// responden a los mismos filtros que las columnas. Se va a Operación/KPIs (grupo tablero) en la tarea
// 29: aquí queda solo el enlace, cuadroTablero() se mantiene exportada para ese uso.
export const COLOR_COLUMNA = { backlog: 'neutro-3', por_hacer: 'neutro-2', en_curso: 'tinta-2', bloqueado: 'tinta' };
const abiertosDe = k => COLUMNAS.filter(([c]) => c !== 'hecho').flatMap(([c]) => k[c]);
export const vencidos = (k, ahora = new Date()) => { const hoy = ahora.toISOString().slice(0, 10); return abiertosDe(k).filter(e => e.fecha_hito && String(e.fecha_hito).slice(0, 10) < hoy).sort((a, b) => String(a.fecha_hito).localeCompare(String(b.fecha_hito))); };
export function porResponsable(k, agentes = []) {
  const c = {};
  for (const e of abiertosDe(k)) { const a = e.responsable || e.agente || 'sin responsable'; c[a] = (c[a] || 0) + 1; }
  return Object.entries(c).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([id, n]) => ({ id, n, nombre: (agentes.find(a => a.id === id) || {}).nombre || id }));
}
const corto = (t, n) => { t = String(t || ''); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
export function cuadroTablero(S, k, ahora = new Date()) {
  const ab = abiertosDe(k), segs = COLUMNAS.filter(([c]) => c !== 'hecho' && k[c].length).map(([c, t]) => ({ l: t, v: k[c].length, color: COLOR_COLUMNA[c] }));
  const ven = vencidos(k, ahora), resp = porResponsable(k, S.datos.agentes), max = resp.length ? resp[0].n : 1, bl = k.bloqueado;
  return [
    panel('Encargos abiertos', '#operacion/tablero', [cifra(String(ab.length), k.hecho.length + ' hechos con este filtro'), ab.length ? grafico(apilada(segs, 'encargos abiertos por columna'), 'fina') : null, leyenda(segs)], 'ancho-2'),
    panel('Vencidos', '#operacion/tablero', [cifra(String(ven.length), ven.length ? 'con el hito pasado sin cerrar' : 'nada vencido'),
      ven.length ? el('ul', { class: 'lista-corta' }, ven.slice(0, 3).map(e => el('li', { text: '#' + e.id + ' ' + corto(e.texto, 50) + ' · ' + fecha(e.fecha_hito) }))) : null], ven.length ? 'alerta' : null),
    panel('Por responsable', '#equipo/organigrama', resp.length ? resp.slice(0, 5).map(r => filaBarra(r.nombre, String(r.n), Math.round(100 * r.n / max), 'tinta-2', '#operacion/tablero?agente=' + encodeURIComponent(r.id))) : [cifra('0', 'sin encargos abiertos')], 'ancho-2'),
    panel('Bloqueados', '#operacion/tablero', [cifra(String(bl.length), bl.length ? 'esperan una decisión o un tercero' : 'nada bloqueado'),
      bl.length ? el('ul', { class: 'lista-corta' }, bl.slice(0, 3).map(e => el('li', { text: '#' + e.id + ' ' + corto(e.texto, 60) }))) : null], bl.length ? 'alerta' : null),
  ];
}

export function render(raiz, S, arg, filtrosRuta = {}, ahora = new Date()) {
  const columna = columnaChip(filtrosRuta.estado);
  // Los enlaces viejos '?frente=' y '?agente=' siguen funcionando: vuelcan a S.filtros y limpian la
  // ruta, pero sin perder el chip de columna si venía puesto.
  const limpia = () => history.replaceState(null, '', '#operacion/tablero' + (columna ? '?estado=' + columna : ''));
  if (filtrosRuta.frente) { S.filtros.frente = filtrosRuta.frente; limpia(); }
  if (filtrosRuta.agente) { S.filtros.agente = filtrosRuta.agente; limpia(); }
  if (arg && /^\d+$/.test(arg)) { limpia(); abrirDetalle(Number(arg), S, recargar); }
  const movil = matchMedia('(max-width: 899px)').matches;
  const cont = el('div', { class: 'kanban' + (movil ? ' movil' : '') + (columna ? ' una' : '') + ' con-fab' });
  const barra = el('div', { class: 'barra-filtros' });
  const secciones = seccionesTablero(S.datos);
  const valores = () => ({ bloque: S.filtros.bloque || '', frente: S.filtros.frente || '', agente: S.filtros.agente || '', etiqueta: S.filtros.etiqueta || '', texto: S.filtros.texto || '' });
  const aplicar = v => { Object.assign(S.filtros, { bloque: v.bloque || null, frente: v.frente || null, agente: v.agente || null, etiqueta: v.etiqueta || null, texto: v.texto || '' }); pintar(); };
  const pintar = () => {
    const k = kanban(S.datos.encargos, S.filtros);
    barra.innerHTML = '';
    barra.append(el('div', { class: 'chips chips-embudo' }, [
      el('a', { class: 'chip' + (columna ? '' : ' activo'), href: '#operacion/tablero', text: 'Todas' }),
      ...COLUMNAS.map(([c, t]) => el('a', { class: 'chip' + (columna === c ? ' activo' : ''), href: '#operacion/tablero?estado=' + c, text: t + ' ' + k[c].length })),
    ]));
    const pills = pillsActivos(valores(), secciones, clave => { aplicar({ ...valores(), [clave]: '' }); });
    if (pills) barra.append(pills);
    if (columna === 'en_curso') barra.append(cabeceraAhora(S, ahora));
    if (hoja) hoja.actualizar(valores(), filtrar(S.datos.encargos, S.filtros).length);
    cont.innerHTML = '';
    for (const [c, t] of COLUMNAS) {
      if (columna && c !== columna) continue;
      cont.append(el('section', { class: 'columna', 'data-columna': c }, [el('h2', {}, [t, el('span', { class: 'mudo', text: ' ' + k[c].length })]), ...k[c].map(e => {
        const tj = tarjetaEncargo(e, { onAbrir: x => abrirDetalle(x.id, S, recargar) });
        if (S.datos.rol === 'owner' || e.agente === yo(S)) { tj.draggable = !movil; tj.append(el('button', { class: 'btn-enlace mover', text: 'mover', onclick: ev => { ev.stopPropagation(); menuMover(e, S); } })); }
        return tj; })]));
    }
  };
  const hoja = hojaFiltros({ secciones, valores: valores(), total: filtrar(S.datos.encargos, S.filtros).length,
    onCambio: v => filtrar(S.datos.encargos, { ...v, bloque: v.bloque || null, frente: v.frente || null, agente: v.agente || null, etiqueta: v.etiqueta || null }).length,
    onAplicar: aplicar });
  habilitarArrastre(cont, { onSoltar: async (id, columnaDestino, indice) => {
    const e = S.datos.encargos.find(x => x.id === id); if (!e) return;
    const a = accionAlSoltar(e.columna, columnaDestino); a.destino = columnaDestino;
    if (a.tipo === 'nada') { try { const vecinos = kanban(S.datos.encargos, S.filtros)[columnaDestino].filter(x => x.id !== id); const orden = indice === 0 ? (vecinos[0]?.orden_kanban ?? 1000) - 10 : indice >= vecinos.length ? (vecinos.at(-1)?.orden_kanban ?? 0) + 10 : Math.floor(((vecinos[indice - 1].orden_kanban ?? 0) + (vecinos[indice].orden_kanban ?? 1000)) / 2); await rpc('omc_encargo_editar', { p_id: id, p: { orden_kanban: orden } }); await recargar(); } catch (err) { toast('HQ rechaza: ' + err.message); } return; }
    await moverEncargo(e, a, S, recargar);
  } });
  raiz.append(el('div', { class: 'fila enlace-kpis' }, [
    el('a', { class: 'btn-enlace', href: '#kpis?grupo=tablero', text: 'KPIs ›' }),
    el('button', { class: 'btn primario', text: '+ Encargo', onclick: () => nuevoEncargo(S) })]),
    barra, cont, hoja.fab, hoja.hoja);
  pintar();
}
function menuMover(e, S) {
  const m = modal({ titulo: 'Mover #' + e.id, cuerpo: COLUMNAS.filter(([c]) => c !== e.columna).map(([c, t]) => el('button', { class: 'btn ancho', text: t, onclick: () => { m.cerrar(); const a = accionAlSoltar(e.columna, c); a.destino = c; moverEncargo(e, a, S, recargar); } })) });
}
