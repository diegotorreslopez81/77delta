// Expedientes: lista por tipo, ficha con sesion (T11) y alta. Sustituye el stub de T1.
//
// T6-a (ruling del controlador, 2026-09-16): sesiones[] del payload omc_hq_v2 no trae
// 'expediente_nombre': trae 'nombre' (el nombre del expediente) y no trae 'resumen' ni 'cerrada'.
// estadoSesion() solo mira expediente_id y estado, asi que no depende de esos campos; el bloque de
// "Sesiones" dentro de ficha() lee resumen/cerrada de f.sesiones (la respuesta propia de
// omc_expediente_ficha, T11, no del payload), que es una estructura distinta.
//
// T6-b: agentes[].jefe no existe en el payload real: se omite (no se lee ni se muestra).
//
// T6-c: omc_expediente_set(p_token, p jsonb); el alta solo manda las claves que usa este formulario
// (nombre, tipo, frente, responsable) dentro de 'p'. El alta exige nombre, tipo y frente y solo
// owner o chief pueden llamarla; esta vista solo sabe distinguir 'owner' de lo que no lo es (mismo
// patron que el resto de T1-T5), asi que el boton "+ Expediente" se gatea con S.datos.rol==='owner'
// y se deja para el backend rechazar cualquier caso de 'chief' que esta interfaz no distingue (se
// anota como duda en el informe).
//
// Ultima instruccion del controlador (punto 3): las 4 acciones de escritura de esta tarea (Trabajar
// con, Cerrar sesion, Nuevo expediente, frentes de agente) solo se muestran con rol==='owner'. El
// paso 3 del brief no gateaba "Cerrar sesion": aqui se anade el gate por instruccion explicita.
import { rpc } from '../api.js';
import { el, modal, toast, fecha, eur, pedirTexto, enlazar, urlSegura } from '../ui.js';
import { tarjetaEncargo } from '../tarjeta.js';
import { recargar } from '../main.js';

export function estadoSesion(exp, sesiones) {
  const mias = (sesiones || []).filter(s => s.expediente_id === exp.id);
  const s = mias.find(x => x.estado === 'abierta') || mias.find(x => x.estado === 'solicitada') || null;
  return { hay: !!s, estado: s ? s.estado : null, sesion: s };
}

async function trabajarCon(exp, S) {
  const ag = (S.datos.agentes || []).find(a => a.id === exp.responsable);
  try {
    const s = await rpc('omc_sesion_solicitar', { p_expediente: exp.id });
    // Fix ronda 2 (B2): sesion_url ya la valida omc_agente_sesion_url en la BD (^https://(claude\.ai|
    // claude\.com)/), pero se pasa por urlSegura tambien aqui por coherencia con el resto de href/src.
    const url = urlSegura(ag?.sesion_url);
    if (url) { toast('abriendo la sesión de ' + ag.nombre); setTimeout(() => { location.href = url; }, 400); }
    else { toast(ag ? ag.nombre + ' no ha publicado su sesión (hq.py agente sesion-url). Queda solicitada #' + s.id : 'sin responsable'); await recargar(); }
  } catch (err) { toast('HQ rechaza: ' + err.message); }
}

async function cerrarSesion(s, S) {
  const resumen = await pedirTexto('Cerrar sesión #' + s.id, 'Resumen de la sesión (obligatorio)');
  if (resumen === null) return;
  try { await rpc('omc_sesion_cerrar', { p_sesion: s.id, p_resumen: resumen, p_entregables: [], p_agente: s.agente }); toast('sesión cerrada'); await recargar(); }
  catch (err) { toast('HQ rechaza: ' + err.message); }
}

function lista(raiz, S) {
  const xs = (S.datos.expedientes || []).filter(x => x.activo !== false);
  const tipos = [...new Set(xs.map(x => x.tipo))];
  for (const t of tipos) {
    raiz.append(el('section', { class: 'seccion' }, [el('h2', { text: t + 's' }), ...xs.filter(x => x.tipo === t).map(x => {
      const es = estadoSesion(x, S.datos.sesiones);
      return el('a', { class: 'tarjeta enlace expediente', href: '#expedientes/' + x.id }, [
        el('div', { class: 'fila' }, [el('span', { class: 'pill codigo', text: x.codigo }), el('strong', { text: x.nombre }), es.hay ? el('span', { class: 'pill sesion', text: 'sesión ' + es.estado }) : null]),
        el('p', { class: 'mudo', text: [x.responsable, x.estado_funnel, x.importe ? eur(x.importe) : null, x.encargos_abiertos + ' abiertos'].filter(Boolean).join(' · ') }),
        x.resumen_estado ? el('p', { class: 'resumen' }, enlazar(x.resumen_estado)) : null]);
    })]));
  }
  if (S.datos.rol === 'owner') raiz.append(el('button', { class: 'btn primario', text: '+ Expediente', onclick: () => alta(S) }));
}

function alta(S) {
  const nombre = el('input', { class: 'campo', placeholder: 'Nombre (cliente, producto o convocatoria)' });
  const tipo = el('select', {}, ['cliente', 'producto', 'convocatoria', 'licitacion'].map(t => el('option', { value: t, text: t })));
  const frente = el('select', {}, [el('option', { value: '', text: 'Frente' }), ...(S.datos.frentes || []).map(f => el('option', { value: f.codigo, text: f.codigo + ' ' + f.linea }))]);
  const resp = el('select', {}, [el('option', { value: '', text: 'Responsable' }), ...(S.datos.agentes || []).map(a => el('option', { value: a.id, text: a.nombre }))]);
  const m = modal({ titulo: 'Nuevo expediente', cuerpo: [nombre, tipo, frente, resp], acciones: [el('button', { class: 'btn primario', text: 'Crear', onclick: async () => {
    if (!nombre.value.trim() || !frente.value) { toast('nombre y frente son obligatorios'); return; }
    try { await rpc('omc_expediente_set', { p: { nombre: nombre.value.trim(), tipo: tipo.value, frente: frente.value, responsable: resp.value || null } }); m.cerrar(); toast('expediente creado'); await recargar(); }
    catch (err) { toast('HQ rechaza: ' + err.message); }
  } })] });
}

async function ficha(raiz, S, id) {
  let f; try { f = await rpc('omc_expediente_ficha', { p_id: id }); } catch (err) { toast('HQ rechaza: ' + err.message); raiz.append(el('p', { class: 'error', text: 'No se pudo cargar el expediente.' })); return; }
  const x = f.expediente;
  // f.sesiones (respuesta de omc_expediente_ficha) hace se.* sobre omc_sesiones (schema-v2.sql:633),
  // que ya incluye expediente_id: no hace falta normalizarlo (NIT ronda 1, retirada la version
  // defensiva que lo daba por ausente).
  const es = estadoSesion(x, f.sesiones?.length ? f.sesiones : S.datos.sesiones), ag = (S.datos.agentes || []).find(a => a.id === x.responsable);
  // Fix ronda 2 (B2): sesion_url, ficha_url y carpeta_url vienen de la BD sin validar esquema.
  const sesionUrl = urlSegura(ag?.sesion_url), fichaUrl = urlSegura(x.ficha_url), carpetaUrl = urlSegura(x.carpeta_url);
  raiz.append(el('a', { href: '#expedientes', class: 'btn-enlace', text: '← expedientes' }));
  raiz.append(el('section', { class: 'objetivo' }, [
    el('p', { class: 'mudo', text: x.tipo + ' · ' + (f.frente ? f.frente.codigo + ' ' + f.frente.linea : '') }),
    el('h1', { text: x.nombre }),
    el('p', { class: 'mudo', text: [x.responsable, x.estado_funnel, x.importe ? eur(x.importe) : null].filter(Boolean).join(' · ') }),
    el('div', { class: 'fila acciones-exp' }, [
      S.datos.rol === 'owner' && !es.hay ? el('button', { class: 'btn primario', text: 'Trabajar con ' + (ag?.nombre || x.responsable || '…'), onclick: () => trabajarCon(x, S) }) : null,
      es.estado === 'solicitada' ? el('span', { class: 'pill sesion', text: 'sesión solicitada, ' + (ag?.nombre || '') + ' la abre en <1 min' }) : null,
      es.estado === 'abierta' && sesionUrl ? el('a', { class: 'btn primario', href: sesionUrl, text: 'Volver a la sesión' }) : null,
      es.hay && S.datos.rol === 'owner' ? el('button', { class: 'btn', text: 'Cerrar sesión', onclick: () => cerrarSesion(es.sesion, S) }) : null,
      fichaUrl ? el('a', { class: 'btn', href: fichaUrl, target: '_blank', rel: 'noopener', text: 'Ficha (Doc)' }) : null,
      carpetaUrl ? el('a', { class: 'btn', href: carpetaUrl, target: '_blank', rel: 'noopener', text: 'Carpeta' }) : null])]));
  if (x.resumen_estado) raiz.append(el('section', { class: 'seccion' }, [el('h2', { text: 'Estado (' + fecha(x.resumen_fecha, { hora: true }) + ')' }), el('p', {}, enlazar(x.resumen_estado))]));
  raiz.append(el('section', { class: 'seccion' }, [el('h2', { text: 'Encargos (' + f.encargos.length + ')' }), ...f.encargos.map(e => tarjetaEncargo(e))]));
  if (x.entregables?.length) raiz.append(el('section', { class: 'seccion' }, [el('h2', { text: 'Entregables' }), ...x.entregables.map(en => { const h = urlSegura(en.url); return el('p', {}, [el('span', { class: 'pill', text: en.estado || 'pendiente' }), ' ', h ? el('a', { href: h, target: '_blank', rel: 'noopener', text: en.nombre }) : en.nombre]); })]));
  if (f.contactos?.length) raiz.append(el('section', { class: 'seccion' }, [el('h2', { text: 'Contactos y envíos' }), ...f.contactos.map(c => el('p', { class: 'mudo', text: fecha(c.fecha || c.created_at, { hora: true }) + ' · ' + c.canal + ' · ' + (c.persona || c.destinatario || '') + ' · ' + (c.estado || '') + (c.asunto ? ' · ' + c.asunto : '') }))]));
  if (f.decisiones?.length) raiz.append(el('section', { class: 'seccion' }, [el('h2', { text: 'Decisiones' }), ...f.decisiones.map(d => el('a', { class: 'tarjeta enlace', href: '#decisiones/' + d.id }, [el('p', { class: 'titulo', text: '#' + d.id + ' ' + d.titulo }), el('p', { class: 'mudo', text: d.estado })]))]));
  if (f.sesiones?.length) raiz.append(el('section', { class: 'seccion' }, [el('h2', { text: 'Sesiones' }), ...f.sesiones.map(s => el('p', { class: 'mudo', text: fecha(s.abierta || s.created_at, { hora: true }) + ' · ' + s.agente + ' · ' + s.estado + (s.resumen ? ' · ' + s.resumen : '') }))]));
  if (f.kit?.length) raiz.append(el('details', {}, [el('summary', { text: 'Kit del frente (' + f.kit.length + ')' }), ...f.kit.map(k => { const h = urlSegura(k.url); return h ? el('a', { href: h, target: '_blank', rel: 'noopener', class: 'kit', text: k.titulo }) : el('span', { class: 'kit mudo', text: k.titulo }); })]));
}

export function render(raiz, S, arg) { if (arg && /^\d+$/.test(arg)) ficha(raiz, S, Number(arg)); else lista(raiz, S); }
