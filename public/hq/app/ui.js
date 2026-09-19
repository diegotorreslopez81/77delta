// Helpers de DOM y formato. Las funciones de formato son puras (node --test).
export function el(tag, attrs = {}, kids = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'text') n.textContent = v; else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (k === 'class') n.className = v; else n.setAttribute(k, v === true ? '' : v);
  }
  for (const k of [].concat(kids)) if (k != null) n.append(k.nodeType ? k : document.createTextNode(String(k)));
  return n;
}
// Fix 7 (2.0.19, feedback movil de Diego): en iOS, un textarea sin atributos de teclado declarados a
// veces se trata como un campo de contacto/direccion (barra "AutoFill Contact" en vez de autocorrector
// normal). campoTexto() centraliza los textarea de comentario de la app con los atributos que hacen
// falta para que el teclado se comporte como en cualquier chat: autocomplete off (no son datos
// guardados), autocorrect/autocapitalize/spellcheck activos, enterkeyhint 'enter'. `attrs` puede añadir
// o pisar cualquiera de estos (p.ej. autocapitalize:'off' si algun campo concreto lo necesitara).
// Brief 2021 (feedback movil de Diego, 19-sep): ademas de fotografiar/restaurar (app/conservar.js, que
// salva un render de main.js), cada campo con `data-conservar` guarda un borrador en localStorage
// mientras se escribe. Cubre el caso que conservar.js no puede: un cierre de pestaña, un refresco manual
// del navegador o cualquier otro accidente entre el tick de 60s. Clave real: 'hq_borrador:' + la clave
// que pase quien llama (p.ej. 'd123' en decisiones.js, 'tablero:nuevo' en tablero.js). localStorage puede
// no existir o lanzar (modo privado de iOS): todo va en try/catch para no romper el campo.
const VEINTICUATRO_HORAS_MS = 24 * 60 * 60 * 1000;
export function campoTexto(attrs = {}, kids = []) {
  const campo = el('textarea', { autocomplete: 'off', autocorrect: 'on', autocapitalize: 'sentences', spellcheck: 'true', enterkeyhint: 'enter', ...attrs }, kids);
  const clave = attrs['data-conservar'];
  if (clave) {
    const llave = 'hq_borrador:' + clave;
    const leerBorrador = () => {
      try {
        const bruto = localStorage.getItem(llave);
        if (!bruto) return null;
        const { v, t } = JSON.parse(bruto);
        if (!v || !t || Date.now() - t > VEINTICUATRO_HORAS_MS) { localStorage.removeItem(llave); return null; }
        return v;
      } catch { return null; }
    };
    const guardarBorrador = v => {
      try { v ? localStorage.setItem(llave, JSON.stringify({ v, t: Date.now() })) : localStorage.removeItem(llave); } catch { /* modo privado: sin borrador, el campo sigue funcionando */ }
    };
    if (!campo.value) { const guardado = leerBorrador(); if (guardado) campo.value = guardado; }
    campo.addEventListener('input', () => guardarBorrador(campo.value));
    campo.olvidarBorrador = () => { try { localStorage.removeItem(llave); } catch { /* nada que borrar si ya fallaba */ } };
  }
  return campo;
}
export function modal({ titulo, cuerpo, acciones = [] }) {
  const capa = document.getElementById('capa');
  const cerrar = () => { capa.innerHTML = ''; document.body.classList.remove('con-modal'); };
  const caja = el('div', { class: 'modal', role: 'dialog', 'aria-label': titulo }, [
    el('div', { class: 'modal-cab' }, [el('h2', { text: titulo }), el('button', { class: 'btn-x', 'aria-label': 'Cerrar', text: '×', onclick: cerrar })]),
    el('div', { class: 'modal-cuerpo' }, cuerpo),
    acciones.length ? el('div', { class: 'modal-acciones' }, acciones) : null]);
  capa.innerHTML = ''; capa.append(el('div', { class: 'fondo', onclick: e => { if (e.target === e.currentTarget) cerrar(); } }, [caja]));
  document.body.classList.add('con-modal');
  return { cerrar, caja };
}
// Brief B (19-sep): el aviso de "Trabajar con" cuando no se puede abrir el chat necesita quedarse al
// menos 6s (hay que leer motivo + qué hacer). `duracion` por defecto sigue en 4000 para no tocar ningún
// toast existente.
export function toast(texto, accion, fn, duracion = 4000) {
  const t = el('div', { class: 'toast' }, [el('span', { text: texto }), accion ? el('button', { class: 'btn-enlace', text: accion, onclick: () => { fn(); t.remove(); } }) : null]);
  document.body.append(t); setTimeout(() => t.remove(), duracion);
}
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
export function fecha(iso, { hora = false, tz = 'Europe/Madrid' } = {}) {
  if (!iso) return '-';
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00Z' : iso);
  const p = Object.fromEntries(new Intl.DateTimeFormat('es-ES', { timeZone: tz, weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d).map(x => [x.type, x.value]));
  const dia = DIAS[new Date(new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(d)).getDay()];
  return hora ? `${dia} ${p.day} ${p.hour}:${p.minute}` : `${dia} ${p.day}`;
}
export function eur(n) { return n == null ? '-' : Math.round(Number(n)).toLocaleString('es-ES') + ' EUR'; }
export function horas(iso, ahora = new Date()) { return iso ? Math.floor((ahora - new Date(iso)) / 36e5) : null; }

// Fix ronda 2 (revision final, B2): cualquier href/src que venga de un campo escrito por un agente o por
// el chief (enlace de una solicitud, kit, ficha_url, carpeta_url, entregable, avatar...) pasa por aqui
// antes de pintarse. Solo deja pasar http(s) absoluto; un `javascript:...` (o cualquier otro esquema)
// vuelve null y quien llama no pinta el enlace. Los enlaces internos (`#tablero/...`, `#decisiones/...`)
// nunca pasan por esta funcion: los construye la propia UI, no vienen de la BD.
export function urlSegura(u) { return /^https?:\/\//i.test(String(u || '')) ? String(u) : null; }

// Modal de texto libre reutilizable (antes duplicado en detalle.js y en decisiones.js). Cancelar resuelve
// null; quien llama debe comprobar `=== null` para no seguir. `opciones`, si se pasa, añade un select por
// delante del textarea (para un motivo de una lista cerrada) sin duplicar el modal.
export function pedirTexto(titulo, etiqueta, obligatorio = true, { opciones } = {}) {
  return new Promise(res => {
    const campo = campoTexto({ rows: 3, placeholder: etiqueta });
    const sel = opciones ? el('select', {}, [el('option', { value: '', text: 'Motivo (opcional)' }), ...opciones.map(o => el('option', { value: o, text: o }))]) : null;
    const m = modal({ titulo, cuerpo: [sel, campo].filter(Boolean), acciones: [el('button', { class: 'btn', text: 'Cancelar', onclick: () => { m.cerrar(); res(null); } }),
      el('button', { class: 'btn primario', text: 'Guardar', onclick: () => {
        if (obligatorio && !campo.value.trim()) { campo.focus(); return; }
        m.cerrar(); res(sel ? { texto: campo.value.trim(), motivo: sel.value || null } : campo.value.trim());
      } })] });
    setTimeout(() => campo.focus(), 50);
  });
}

// Modal de motivos de un catalogo cerrado con multiseleccion (chips) mas un textarea opcional de
// detalle (encargo #1063: motivos de NO al descartar una licitacion). Cancelar resuelve null; Guardar
// exige al menos un motivo marcado, asi que empieza deshabilitado.
export function pedirMotivos(titulo, catalogo) {
  return new Promise(res => {
    const seleccionados = new Set();
    const detalle = campoTexto({ rows: 3, placeholder: 'Detalle (opcional)' });
    const guardar = el('button', { class: 'btn primario', text: 'Guardar', onclick: () => {
      if (!seleccionados.size) return;
      m.cerrar(); res({ motivos: [...seleccionados], texto: detalle.value.trim() });
    } });
    guardar.disabled = true;
    const chips = catalogo.map(motivo => {
      const btn = el('button', { class: 'chip', type: 'button', 'aria-pressed': 'false', text: motivo, onclick: () => {
        const activo = btn.getAttribute('aria-pressed') === 'true';
        btn.setAttribute('aria-pressed', String(!activo));
        btn.classList.toggle('activo', !activo);
        activo ? seleccionados.delete(motivo) : seleccionados.add(motivo);
        guardar.disabled = seleccionados.size === 0;
      } });
      return btn;
    });
    const m = modal({ titulo, cuerpo: [el('div', { class: 'chips' }, chips), detalle],
      acciones: [el('button', { class: 'btn', text: 'Cancelar', onclick: () => { m.cerrar(); res(null); } }), guardar] });
  });
}

// Convierte texto plano de la BD en nodos DOM: URLs en <a href> (atributo real via el(), nunca `html:` con
// datos de la BD: una comilla en el texto no puede escapar del atributo porque no hay parseo de HTML de por
// medio) y saltos de línea en <br>. Reemplaza el patrón `html:` con reemplazos de string usado antes en
// decisiones.js (T5, fix ronda 1: ese patrón dejaba inyectar atributos via un `"` en el detalle).
export function enlazar(texto) {
  const out = [];
  for (const parte of String(texto || '').split(/(https?:\/\/[^\s)]+)/g)) {
    if (/^https?:\/\//.test(parte)) { out.push(el('a', { href: parte, target: '_blank', rel: 'noopener', text: parte })); continue; }
    parte.split('\n').forEach((linea, i) => {
      if (i > 0) out.push(el('br'));
      if (linea) out.push(document.createTextNode(linea));
    });
  }
  return out;
}
