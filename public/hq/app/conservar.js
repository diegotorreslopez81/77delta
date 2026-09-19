// Brief 2021 (feedback de Diego en iPhone, 19-sep): render() de main.js hace `raiz.innerHTML = ''` y
// reconstruye toda la vista en cada recarga automatica (tick de 60s, volver a la pestaña). En movil eso
// cerraba un <details> abierto a mano (p.ej. la tarjeta de decisiones.js) y sustituia el <textarea> que
// se estaba escribiendo por un nodo nuevo, con el texto perdido y el teclado de iOS cerrado.
//
// fotografiar(raiz, activo) se llama justo antes de vaciar raiz; restaurar(raiz, foto) justo despues de
// volver a pintar. Ambas son funciones puras sobre DOM real (sin tocar `document`/`window` mas alla de
// los nodos que reciben), testables solas en test/conservar.test.mjs sin arrancar la cadena de imports
// de main.js.

// Un input es "de texto" con el mismo criterio que escribiendo() en app/main.js: cualquier textarea, o
// un input que no sea de los tipos que no llevan texto libre.
const TIPOS_SIN_TEXTO = ['checkbox', 'radio', 'button', 'submit', 'range', 'color', 'file'];
function esCampoDeTexto(n) {
  if (!n || !n.tagName) return false;
  const tag = n.tagName.toLowerCase();
  if (tag === 'textarea') return true;
  if (tag !== 'input') return false;
  return !TIPOS_SIN_TEXTO.includes(String(n.type || 'text').toLowerCase());
}
function esDetails(n) { return !!n && !!n.tagName && n.tagName.toLowerCase() === 'details'; }

// Recorre todos los descendientes elemento (nodeType 1) de un nodo, en profundidad. `children` (no
// `childNodes`): en DOM real solo trae elementos, así que no hace falta filtrar nodos de texto.
function* descendientes(nodo) {
  for (const hijo of nodo.children || []) {
    if (!hijo || hijo.nodeType !== 1) continue;
    yield hijo;
    yield* descendientes(hijo);
  }
}

// Clave de un <details> para poder reencontrarlo tras el render: su propio id, o si no tiene, el del
// ancestro mas cercano que si lo tenga (p.ej. `article#d123` > `details` sin id, en decisiones.js
// tarjeta()). Sin ningun id en la cadena no hay forma de reencontrarlo: se descarta.
function claveDetails(det) {
  let n = det;
  while (n && n.nodeType === 1) { if (n.id) return n.id; n = n.parentNode; }
  return null;
}

export function fotografiar(raiz, activo) {
  const abiertos = [];
  const campos = {};
  for (const n of descendientes(raiz)) {
    if (esDetails(n) && n.open) { const clave = claveDetails(n); if (clave) abiertos.push(clave); }
    if (esCampoDeTexto(n)) { const clave = n.getAttribute && n.getAttribute('data-conservar'); if (clave) campos[clave] = n.value; }
  }
  let foco = null;
  if (esCampoDeTexto(activo)) {
    const clave = activo.getAttribute && activo.getAttribute('data-conservar');
    if (clave) foco = { clave, inicio: activo.selectionStart ?? null, fin: activo.selectionEnd ?? null };
  }
  return { abiertos, campos, foco };
}

export function restaurar(raiz, foto) {
  if (!foto) return;
  const porId = new Map();
  const camposPorClave = new Map();
  for (const n of descendientes(raiz)) {
    if (n.id) porId.set(n.id, n);
    if (esCampoDeTexto(n)) { const clave = n.getAttribute && n.getAttribute('data-conservar'); if (clave) camposPorClave.set(clave, n); }
  }
  for (const clave of foto.abiertos || []) {
    const destino = porId.get(clave);
    if (!destino) continue;
    if (esDetails(destino)) { destino.open = true; continue; }
    for (const n of descendientes(destino)) { if (esDetails(n)) { n.open = true; break; } }
  }
  for (const [clave, valor] of Object.entries(foto.campos || {})) {
    const campo = camposPorClave.get(clave);
    if (campo && !campo.value) campo.value = valor;
  }
  if (foto.foco) {
    const campo = camposPorClave.get(foto.foco.clave);
    if (campo) {
      campo.focus();
      if (typeof campo.setSelectionRange === 'function' && foto.foco.inicio != null) {
        try { campo.setSelectionRange(foto.foco.inicio, foto.foco.fin); } catch { /* algunos input type= no admiten seleccion */ }
      }
    }
  }
}
