// Modal de un encargo: ficha, edición, hilo, acciones.
import { rpc } from './api.js';
import { el, modal, toast, fecha, pedirTexto, urlSegura, campoTexto } from './ui.js';
import { yo } from './estado.js';

// T5 fix ronda 1: pedirTexto vivia aqui y estaba reimplementado (copiado) en decisiones.js; ahora es
// compartido desde ui.js. Se re-exporta para no romper a quien ya lo importaba desde detalle.js.
export { pedirTexto };
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
    else if (accion.tipo === 'reabrir') {
      // T4-e: reabrir aterriza en la columna destino real (en_curso/bloqueado tambien son validos
      // para omc_encargo_estado), no siempre en 'encolado'. Nunca con omc_encargo_tomar.
      const estado = accion.destino === 'en_curso' ? 'en_curso' : accion.destino === 'bloqueado' ? 'bloqueado_diego' : 'encolado';
      await rpc('omc_encargo_estado', { p_id: e.id, p_estado: estado, p_motivo: 'reabierto desde HQ', p_agente: yo(S) });
      if (accion.destino === 'backlog') await rpc('omc_encargo_editar', { p_id: e.id, p: { fecha_hito: null } });
    }
    else if (accion.tipo === 'planificar') { if (accion.destino === 'backlog') await rpc('omc_encargo_editar', { p_id: e.id, p: { fecha_hito: null } }); else { const hito = await pedirTexto('Planificar #' + e.id, 'Fecha del hito (AAAA-MM-DD)'); if (!hito) return; await rpc('omc_encargo_editar', { p_id: e.id, p: { fecha_hito: hito } }); } }
    else if (accion.tipo === 'descartar') { const motivo = await pedirTexto('Descartar #' + e.id, 'Motivo del descarte'); if (motivo == null) return; await rpc('omc_encargo_estado', { p_id: e.id, p_estado: 'descartado', p_motivo: motivo, p_agente: yo(S) }); }
    toast('#' + e.id + ' ' + accion.tipo); await recargar();
  } catch (err) { toast('HQ rechaza: ' + err.message); }
}
export async function abrirDetalle(id, S, recargar) {
  let f; try { f = await rpc('omc_encargo_ficha', { p_id: id }); } catch (err) { toast('HQ rechaza: ' + err.message); return; }
  const e = f.encargo, owner = S.datos.rol === 'owner';
  const campos = { texto: campoTexto({ rows: 3 }, [e.texto || '']), interpretacion: campoTexto({ rows: 2, placeholder: 'Interpretación del chief' }, [e.interpretacion || '']),
    frente: el('select', {}, (S.datos.frentes || []).map(x => el('option', { value: x.codigo, selected: x.codigo === e.codigo, text: x.codigo + ' ' + x.linea }))),
    agente: el('select', {}, (S.datos.agentes || []).map(a => el('option', { value: a.id, selected: a.id === e.agente, text: a.nombre + ' (' + a.id + ')' }))),
    prioridad: el('input', { class: 'campo', type: 'number', min: 0, max: 9, value: e.prioridad ?? 0 }), fecha_hito: el('input', { class: 'campo', type: 'date', value: e.fecha_hito || '' }),
    etiquetas: el('input', { class: 'campo', placeholder: 'etiquetas separadas por coma', value: (e.etiquetas || []).join(', ') }), enlaces: campoTexto({ rows: 2, placeholder: 'un enlace por línea' }, [(e.enlaces || []).join('\n')]) };
  const fila = (nombre, c) => el('label', { class: 'campo-l' }, [el('span', { class: 'mudo', text: nombre }), c]);
  const hilo = el('div', { class: 'hilo' }, (f.avances || []).map(a => el('div', { class: 'avance' }, [el('span', { class: 'mudo', text: fecha(a.ts || a.fecha, { hora: true }) + ' · ' + a.autor + ' · ' + a.tipo }), el('p', { text: a.texto })])));
  const nuevo = campoTexto({ rows: 2, placeholder: 'Comentario o avance' });
  const guardar = async () => {
    const p = { texto: campos.texto.value.trim(), interpretacion: campos.interpretacion.value.trim(), frente: campos.frente.value, responsable: campos.agente.value, prioridad: Number(campos.prioridad.value), fecha_hito: campos.fecha_hito.value || null,
      etiquetas: campos.etiquetas.value.split(',').map(s => s.trim()).filter(Boolean), enlaces: campos.enlaces.value.split('\n').map(s => s.trim()).filter(Boolean) };
    try { await rpc('omc_encargo_editar', { p_id: id, p }); toast('#' + id + ' guardado'); m.cerrar(); await recargar(); } catch (err) { toast('HQ rechaza: ' + err.message); }
  };
  const comentar = async () => { if (!nuevo.value.trim()) return; try { await rpc('omc_encargo_avance', { p_id: id, p_texto: nuevo.value.trim(), p_agente: yo(S) }); m.cerrar(); await recargar(); abrirDetalle(id, S, recargar); } catch (err) { toast('HQ rechaza: ' + err.message); } };
  const acciones = [el('button', { class: 'btn peligro', text: 'Descartar', onclick: () => { m.cerrar(); moverEncargo(e, { tipo: 'descartar' }, S, recargar); } }),
    e.estado !== 'hecho' ? el('button', { class: 'btn', text: 'Cerrar con fuente', onclick: () => { m.cerrar(); moverEncargo(e, { tipo: 'hecho' }, S, recargar); } }) : null,
    owner ? el('button', { class: 'btn primario', text: 'Guardar', onclick: guardar }) : null];
  const m = modal({ titulo: '#' + id + ' · ' + e.codigo + ' · ' + e.estado, acciones, cuerpo: [
    el('p', { class: 'mudo', text: [e.origen, 'alta ' + fecha(e.fecha, { hora: true }), e.fecha_avance ? 'último avance ' + fecha(e.fecha_avance, { hora: true }) : null].filter(Boolean).join(' · ') }),
    f.expediente ? el('a', { href: '#operacion/expedientes/' + f.expediente.id, class: 'pill', text: 'expediente: ' + f.expediente.nombre }) : null,
    owner ? el('div', { class: 'form' }, [fila('Texto', campos.texto), fila('Interpretación', campos.interpretacion), el('div', { class: 'dos' }, [fila('Frente', campos.frente), fila('Responsable', campos.agente)]), el('div', { class: 'dos' }, [fila('Prioridad (0 alta, 9 baja)', campos.prioridad), fila('Hito', campos.fecha_hito)]), fila('Etiquetas', campos.etiquetas), fila('Enlaces', campos.enlaces)])
      : el('div', {}, [el('p', { text: e.texto }), e.interpretacion ? el('p', { class: 'mudo', text: e.interpretacion }) : null,
        // Fix ronda 2 (revision final, B2): e.enlaces lo escribe quien edita el encargo (agente o chief),
        // sin validar esquema en la BD. Se descarta cualquier enlace que no sea http(s) absoluto.
        ...(e.enlaces || []).map(u => urlSegura(u)).filter(Boolean).map(h => el('a', { href: h, target: '_blank', rel: 'noopener', text: h }))]),
    // Fix ronda 2 (B2): k.url viene del kit del frente (omc_kit_set, sin validar esquema); si no es
    // http(s) se pinta el titulo sin enlace en vez de omitirlo del todo.
    f.kit?.length ? el('details', {}, [el('summary', { text: 'Kit del frente (' + f.kit.length + ')' }), ...f.kit.map(k => { const h = urlSegura(k.url); return h ? el('a', { href: h, target: '_blank', rel: 'noopener', class: 'kit', text: k.titulo }) : el('span', { class: 'kit mudo', text: k.titulo }); })]) : null,
    el('h3', { text: 'Hilo' }), hilo, el('div', { class: 'fila' }, [nuevo, el('button', { class: 'btn', text: 'Enviar', onclick: comentar })])] });
}
