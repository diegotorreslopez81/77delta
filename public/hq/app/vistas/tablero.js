// Tablero Kanban: filtros, alta de encargo, arrastre y detalle.
import { rpc } from '../api.js';
import { el, modal, toast } from '../ui.js';
import { kanban, COLUMNAS, yo } from '../estado.js';
import { tarjetaEncargo } from '../tarjeta.js';
import { accionAlSoltar, habilitarArrastre } from '../dnd.js';
import { abrirDetalle, moverEncargo } from '../detalle.js';
import { recargar } from '../main.js';

// T4-c (ruling del controlador, 2026-09-16): omc_hq_v2 no expone 'yo' en la raíz; con null la base
// resuelve la identidad del token (yo() vive en estado.js). Efecto en este fichero: sin un id de
// agente real en el payload, una tarjeta de agente nunca coincide con yo(S) para un token que no sea
// owner, así que el arrastre queda restringido al owner hasta que el backend exponga la identidad
// del agente (se anota en el informe).

function filtros(S, pintar) {
  const d = S.datos, f = S.filtros;
  const sel = (clave, opciones, todo) => el('select', { class: 'campo mini', onchange: e => { f[clave] = e.target.value || null; pintar(); } }, [el('option', { value: '', text: todo }), ...opciones.map(([v, t]) => el('option', { value: v, selected: f[clave] === v, text: t }))]);
  const etiquetas = [...new Set((d.encargos || []).flatMap(e => e.etiquetas || []))].sort();
  return el('div', { class: 'filtros fila' }, [
    sel('bloque', (d.bloques || []).map(b => [b.letra, b.letra + ' ' + b.nombre]), 'Todos los bloques'),
    sel('frente', (d.frentes || []).filter(x => !f.bloque || x.bloque_letra === f.bloque).map(x => [x.codigo, x.codigo + ' ' + x.linea]), 'Todos los frentes'),
    sel('agente', (d.agentes || []).map(a => [a.id, a.nombre]), 'Todos'), etiquetas.length ? sel('etiqueta', etiquetas.map(x => [x, x]), 'Etiquetas') : null,
    el('input', { class: 'campo mini', placeholder: 'buscar', value: f.texto, oninput: e => { f.texto = e.target.value; pintar(); } }),
    (f.frente || f.bloque || f.agente || f.etiqueta || f.texto) ? el('button', { class: 'btn-enlace', text: 'quitar filtros', onclick: () => { Object.assign(f, { frente: null, bloque: null, agente: null, etiqueta: null, texto: '' }); pintar(); } }) : null,
    el('button', { class: 'btn primario', text: '+ Encargo', onclick: () => nuevoEncargo(S) })]);
}

// T4-b (correccion del controlador vs. lo verificado en schema-v2.sql, se anota en el informe): la
// tabla dice que omc_encargo_alta ignora 'etiquetas', pero el insert de omc_encargo_alta (linea ~211
// del schema) SI incluye la columna etiquetas leyendo p->'etiquetas'. Se comprobó directamente antes de
// escribir esto: se mantienen las etiquetas dentro de la propia alta (como el brief original) y no se
// añade una segunda llamada a omc_encargo_editar (que además es solo-owner, ver nota en detalle.js).
function nuevoEncargo(S) {
  const d = S.datos, f = S.filtros;
  const texto = el('textarea', { rows: 3, placeholder: 'Qué hay que hacer (empieza por el verbo)' });
  const frente = el('select', {}, [el('option', { value: '', text: 'Frente (obligatorio)' }), ...(d.frentes || []).map(x => el('option', { value: x.codigo, selected: x.codigo === f.frente, text: x.codigo + ' ' + x.linea }))]);
  const resp = el('select', {}, [el('option', { value: '', text: 'Responsable (por defecto el del frente)' }), ...(d.agentes || []).map(a => el('option', { value: a.id, text: a.nombre }))]);
  const hito = el('input', { class: 'campo', type: 'date' }), etiq = el('input', { class: 'campo', placeholder: 'etiquetas separadas por coma' });
  const m = modal({ titulo: 'Nuevo encargo', cuerpo: [texto, frente, resp, hito, etiq], acciones: [el('button', { class: 'btn', text: 'Cancelar', onclick: () => m.cerrar() }), el('button', { class: 'btn primario', text: 'Crear', onclick: async () => {
    if (!texto.value.trim() || !frente.value) { toast('texto y frente son obligatorios'); return; }
    try {
      const r = await rpc('omc_encargo_alta', { p: { texto: texto.value.trim(), frente: frente.value, responsable: resp.value || null, fecha_hito: hito.value || null, etiquetas: etiq.value.split(',').map(s => s.trim()).filter(Boolean), origen: 'Diego HQ ' + new Date().toISOString().slice(0, 16).replace('T', ' ') } });
      m.cerrar(); toast('encargo #' + r.id + ' creado'); await recargar();
    } catch (err) { toast('HQ rechaza: ' + err.message); }
  } })] });
}

export function render(raiz, S, arg) {
  if (arg && arg.startsWith('f/')) { S.filtros.frente = arg.slice(2); history.replaceState(null, '', '#tablero'); }
  else if (arg && /^\d+$/.test(arg)) { history.replaceState(null, '', '#tablero'); abrirDetalle(Number(arg), S, recargar); }
  const movil = matchMedia('(max-width: 899px)').matches;
  const cont = el('div', { class: 'kanban' + (movil ? ' movil' : '') });
  const pintar = () => {
    raiz.querySelector('.filtros')?.remove(); raiz.prepend(filtros(S, pintar));
    const k = kanban(S.datos.encargos, S.filtros); cont.innerHTML = '';
    if (movil) cont.append(el('div', { class: 'pestanas' }, COLUMNAS.map(([c, t]) => el('button', { class: 'btn' + (S.columnaMovil === c ? ' primario' : ''), text: t + ' ' + k[c].length, onclick: () => { S.columnaMovil = c; pintar(); } }))));
    for (const [c, t] of COLUMNAS) {
      if (movil && c !== S.columnaMovil) continue;
      cont.append(el('section', { class: 'columna', 'data-columna': c }, [el('h2', {}, [t, el('span', { class: 'mudo', text: ' ' + k[c].length })]), ...k[c].map(e => {
        const tj = tarjetaEncargo(e, { onAbrir: x => abrirDetalle(x.id, S, recargar) });
        if (S.datos.rol === 'owner' || e.agente === yo(S)) { tj.draggable = !movil; tj.append(el('button', { class: 'btn-enlace mover', text: 'mover', onclick: ev => { ev.stopPropagation(); menuMover(e, S); } })); }
        return tj; })]));
    }
  };
  habilitarArrastre(cont, { onSoltar: async (id, columna, indice) => {
    const e = S.datos.encargos.find(x => x.id === id); if (!e) return;
    const a = accionAlSoltar(e.columna, columna); a.destino = columna;
    if (a.tipo === 'nada') { try { const vecinos = kanban(S.datos.encargos, S.filtros)[columna].filter(x => x.id !== id); const orden = indice === 0 ? (vecinos[0]?.orden_kanban ?? 1000) - 10 : indice >= vecinos.length ? (vecinos.at(-1)?.orden_kanban ?? 0) + 10 : Math.floor(((vecinos[indice - 1].orden_kanban ?? 0) + (vecinos[indice].orden_kanban ?? 1000)) / 2); await rpc('omc_encargo_editar', { p_id: id, p: { orden_kanban: orden } }); await recargar(); } catch (err) { toast(err.message); } return; }
    await moverEncargo(e, a, S, recargar);
  } });
  raiz.append(cont); pintar();
}
function menuMover(e, S) {
  const m = modal({ titulo: 'Mover #' + e.id, cuerpo: COLUMNAS.filter(([c]) => c !== e.columna).map(([c, t]) => el('button', { class: 'btn ancho', text: t, onclick: () => { m.cerrar(); const a = accionAlSoltar(e.columna, c); a.destino = c; moverEncargo(e, a, S, recargar); } })) });
}
