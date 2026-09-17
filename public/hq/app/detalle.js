// Modal de un encargo: ficha, edición, hilo, acciones.
import { rpc } from './api.js';
import { el, modal, toast, fecha } from './ui.js';

// T4-c (ruling del controlador, 2026-09-16): omc_hq_v2 no expone 'yo' en la raíz. Con null la base
// resuelve la identidad del token (coalesce a 'agente' genérico); solo owner tiene un nombre fijo ('diego').
const yo = S => S.datos.rol === 'owner' ? 'diego' : null;
export function pedirTexto(titulo, etiqueta, obligatorio = true) {
  return new Promise(res => {
    const campo = el('textarea', { rows: 3, placeholder: etiqueta });
    const m = modal({ titulo, cuerpo: [campo], acciones: [el('button', { class: 'btn', text: 'Cancelar', onclick: () => { m.cerrar(); res(null); } }),
      el('button', { class: 'btn primario', text: 'Guardar', onclick: () => { if (obligatorio && !campo.value.trim()) { campo.focus(); return; } m.cerrar(); res(campo.value.trim()); } })] });
    setTimeout(() => campo.focus(), 50);
  });
}
export async function moverEncargo(e, accion, S, recargar) {
  try {
    if (accion.tipo === 'tomar') await rpc('omc_encargo_tomar', { p_id: e.id, p_agente: S.datos.rol === 'owner' ? e.agente : yo(S) });
    else if (accion.tipo === 'hecho') {
      const fuente = await pedirTexto('Cerrar #' + e.id, 'Fuente del cierre: URL del Google Doc, del kit o del correo enviado (obligatoria)'); if (fuente == null) return;
      // T4-a (ruling del controlador): omc_encargo_hecho no tiene p_texto, tiene p_entregable (URL del entregable, opcional).
      const entregable = await pedirTexto('Entregable', 'URL del entregable (opcional)', false);
      await rpc('omc_encargo_hecho', { p_id: e.id, p_fuente: fuente, p_entregable: entregable || '', p_agente: yo(S) });
    }
    else if (accion.tipo === 'bloquear') { const motivo = await pedirTexto('Bloquear #' + e.id, 'Qué falta de Diego'); if (motivo == null) return; await rpc('omc_encargo_estado', { p_id: e.id, p_estado: 'bloqueado_diego', p_motivo: motivo, p_agente: yo(S) }); }
    else if (accion.tipo === 'reabrir') { await rpc('omc_encargo_estado', { p_id: e.id, p_estado: 'encolado', p_motivo: 'reabierto desde HQ', p_agente: yo(S) }); if (accion.destino === 'backlog') await rpc('omc_encargo_editar', { p_id: e.id, p: { fecha_hito: null } }); }
    else if (accion.tipo === 'planificar') { if (accion.destino === 'backlog') await rpc('omc_encargo_editar', { p_id: e.id, p: { fecha_hito: null } }); else { const hito = await pedirTexto('Planificar #' + e.id, 'Fecha del hito (AAAA-MM-DD)'); if (!hito) return; await rpc('omc_encargo_editar', { p_id: e.id, p: { fecha_hito: hito } }); } }
    else if (accion.tipo === 'descartar') { const motivo = await pedirTexto('Descartar #' + e.id, 'Motivo del descarte'); if (motivo == null) return; await rpc('omc_encargo_estado', { p_id: e.id, p_estado: 'descartado', p_motivo: motivo, p_agente: yo(S) }); }
    toast('#' + e.id + ' ' + accion.tipo); await recargar();
  } catch (err) { toast('HQ rechaza: ' + err.message); }
}
export async function abrirDetalle(id, S, recargar) {
  let f; try { f = await rpc('omc_encargo_ficha', { p_id: id }); } catch (err) { toast(err.message); return; }
  const e = f.encargo, owner = S.datos.rol === 'owner';
  const campos = { texto: el('textarea', { rows: 3 }, [e.texto || '']), interpretacion: el('textarea', { rows: 2, placeholder: 'Interpretación del chief' }, [e.interpretacion || '']),
    frente: el('select', {}, (S.datos.frentes || []).map(x => el('option', { value: x.codigo, selected: x.codigo === e.codigo, text: x.codigo + ' ' + x.linea }))),
    agente: el('select', {}, (S.datos.agentes || []).map(a => el('option', { value: a.id, selected: a.id === e.agente, text: a.nombre + ' (' + a.id + ')' }))),
    prioridad: el('input', { class: 'campo', type: 'number', min: 0, max: 9, value: e.prioridad ?? 0 }), fecha_hito: el('input', { class: 'campo', type: 'date', value: e.fecha_hito || '' }),
    etiquetas: el('input', { class: 'campo', placeholder: 'etiquetas separadas por coma', value: (e.etiquetas || []).join(', ') }), enlaces: el('textarea', { rows: 2, placeholder: 'un enlace por línea' }, [(e.enlaces || []).join('\n')]) };
  const fila = (nombre, c) => el('label', { class: 'campo-l' }, [el('span', { class: 'mudo', text: nombre }), c]);
  const hilo = el('div', { class: 'hilo' }, (f.avances || []).map(a => el('div', { class: 'avance' }, [el('span', { class: 'mudo', text: fecha(a.ts || a.fecha, { hora: true }) + ' · ' + a.autor + ' · ' + a.tipo }), el('p', { text: a.texto })])));
  const nuevo = el('textarea', { rows: 2, placeholder: 'Comentario o avance' });
  const guardar = async () => {
    const p = { texto: campos.texto.value.trim(), interpretacion: campos.interpretacion.value.trim(), frente: campos.frente.value, responsable: campos.agente.value, prioridad: Number(campos.prioridad.value), fecha_hito: campos.fecha_hito.value || null,
      etiquetas: campos.etiquetas.value.split(',').map(s => s.trim()).filter(Boolean), enlaces: campos.enlaces.value.split('\n').map(s => s.trim()).filter(Boolean) };
    try { await rpc('omc_encargo_editar', { p_id: id, p }); toast('#' + id + ' guardado'); m.cerrar(); await recargar(); } catch (err) { toast('HQ rechaza: ' + err.message); }
  };
  const comentar = async () => { if (!nuevo.value.trim()) return; try { await rpc('omc_encargo_avance', { p_id: id, p_texto: nuevo.value.trim(), p_agente: yo(S) }); m.cerrar(); await recargar(); abrirDetalle(id, S, recargar); } catch (err) { toast(err.message); } };
  const acciones = [el('button', { class: 'btn peligro', text: 'Descartar', onclick: () => { m.cerrar(); moverEncargo(e, { tipo: 'descartar' }, S, recargar); } }),
    e.estado !== 'hecho' ? el('button', { class: 'btn', text: 'Cerrar con fuente', onclick: () => { m.cerrar(); moverEncargo(e, { tipo: 'hecho' }, S, recargar); } }) : null,
    owner ? el('button', { class: 'btn primario', text: 'Guardar', onclick: guardar }) : null];
  const m = modal({ titulo: '#' + id + ' · ' + e.codigo + ' · ' + e.estado, acciones, cuerpo: [
    el('p', { class: 'mudo', text: [e.origen, 'alta ' + fecha(e.fecha, { hora: true }), e.fecha_avance ? 'último avance ' + fecha(e.fecha_avance, { hora: true }) : null].filter(Boolean).join(' · ') }),
    f.expediente ? el('a', { href: '#expedientes/' + f.expediente.id, class: 'pill', text: 'expediente: ' + f.expediente.nombre }) : null,
    owner ? el('div', { class: 'form' }, [fila('Texto', campos.texto), fila('Interpretación', campos.interpretacion), el('div', { class: 'dos' }, [fila('Frente', campos.frente), fila('Responsable', campos.agente)]), el('div', { class: 'dos' }, [fila('Prioridad (0 alta, 9 baja)', campos.prioridad), fila('Hito', campos.fecha_hito)]), fila('Etiquetas', campos.etiquetas), fila('Enlaces', campos.enlaces)])
      : el('div', {}, [el('p', { text: e.texto }), e.interpretacion ? el('p', { class: 'mudo', text: e.interpretacion }) : null, ...(e.enlaces || []).map(u => el('a', { href: u, target: '_blank', rel: 'noopener', text: u }))]),
    f.kit?.length ? el('details', {}, [el('summary', { text: 'Kit del frente (' + f.kit.length + ')' }), ...f.kit.map(k => el('a', { href: k.url, target: '_blank', rel: 'noopener', class: 'kit', text: k.titulo }))]) : null,
    el('h3', { text: 'Hilo' }), hilo, el('div', { class: 'fila' }, [nuevo, el('button', { class: 'btn', text: 'Enviar', onclick: comentar })])] });
}
