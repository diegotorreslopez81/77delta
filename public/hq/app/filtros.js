// Sistema de filtros común (2.0.20, feedback de Diego del 19-sep desde el iPhone: "los filtros están
// mezclados"). Un único componente para Licitaciones, Expedientes y Tablero: botón flotante con el
// embudo y el número de filtros activos, hoja inferior por secciones con chips de una sola elección,
// buscador arriba y pie con "Limpiar" y "Ver N resultados". Lo que se puede probar sin DOM vive en
// funciones puras (contarActivos, normalizarValores, etiquetaActivo).
//
// Forma de una sección: { clave, titulo, opciones: [[valor, etiqueta, n?]], visible?, fija?, defecto?, libre? }
//   visible(valores): false la oculta de la hoja (Motivo de NO fuera de Descartadas, o los filtros que
//     solo llegan por la ruta como `fuente` y `desiertas`, que se quieren como pill pero no en la hoja).
//   fija: la sección del embudo (Estado, columna del Tablero). Siempre tiene valor, así que no cuenta
//     como filtro activo ni sale como pill: sus chips ya se ven arriba.
//   defecto: el valor que no cuenta como filtro (Orden = Cierre).
//   libre: acepta cualquier texto (el buscador de la hoja); no se pinta como chips en el cuerpo.
import { el } from './ui.js';

const seccionDe = (secciones, clave) => (secciones || []).find(s => s && s.clave === clave) || null;
const valida = (s, v) => !!s && v != null && v !== '' && (s.libre ? true : (s.opciones || []).some(o => o[0] === v));
const cuenta = (s, v) => !s.fija && v !== s.defecto;

export function normalizarValores(valores, secciones) {
  const out = {};
  for (const [k, v] of Object.entries(valores || {})) if (valida(seccionDe(secciones, k), v)) out[k] = v;
  return out;
}

export function contarActivos(valores, secciones) {
  return Object.entries(normalizarValores(valores, secciones)).filter(([k, v]) => cuenta(seccionDe(secciones, k), v)).length;
}

export function etiquetaActivo(clave, valor, secciones) {
  const s = seccionDe(secciones, clave);
  if (!valida(s, valor)) return null;
  const o = s.libre ? null : (s.opciones || []).find(x => x[0] === valor);
  return s.titulo + ': ' + (o ? o[1] : valor);
}

// Pills de los filtros activos encima de la lista; la x quita ese filtro. El estado del embudo no sale
// aquí (es una sección `fija`), que ya se ve en los chips de arriba.
export function pillsActivos(valores, secciones, onQuitar) {
  // En el orden de las secciones, no en el del objeto: así las pills no bailan entre renders.
  const limpio = normalizarValores(valores, secciones);
  const activos = (secciones || []).filter(s => s && limpio[s.clave] !== undefined && cuenta(s, limpio[s.clave])).map(s => [s.clave, limpio[s.clave]]);
  if (!activos.length) return null;
  return el('div', { class: 'chips chips-activos' }, activos.map(([k, v]) => {
    const t = etiquetaActivo(k, v, secciones);
    return el('span', { class: 'pill pill-activo' }, [t,
      el('button', { class: 'quita-pill', type: 'button', 'aria-label': 'Quitar filtro ' + t, text: '×', onclick: () => onQuitar && onQuitar(k) })]);
  }));
}

const EMBUDO = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5h18l-7.2 8.4V20l-3.6-2.2v-4.4z"/></svg>';

export function hojaFiltros({ titulo = 'Filtros', secciones = [], valores = {}, total = 0, onCambio, onAplicar, onLimpiar }) {
  let fijos = { ...valores };          // lo aplicado de verdad (lo que hay en la ruta)
  let prov = { ...valores };           // lo que se está tocando con la hoja abierta
  let n = Number(total) || 0;          // recuento vivo del pie
  let escuchando = null;
  const claveTexto = (secciones.find(s => s && s.libre) || {}).clave || 'texto';

  const globo = el('span', { class: 'globo' });
  const fab = el('button', { class: 'fab-filtros', type: 'button', 'aria-label': 'Filtros', 'aria-expanded': 'false', html: EMBUDO, onclick: () => abrir() });
  fab.append(globo);

  const buscador = el('input', { class: 'campo hoja-buscar', type: 'search', placeholder: 'Buscar en la lista', 'aria-label': 'Buscar en la lista',
    autocorrect: 'off', autocapitalize: 'off', autocomplete: 'off', enterkeyhint: 'search',
    oninput: e => cambiar(claveTexto, e.target.value) });
  const cuerpo = el('div', { class: 'hoja-cuerpo' });
  const limpiar = el('button', { class: 'btn-enlace', type: 'button', text: 'Limpiar', onclick: () => {
    prov = Object.fromEntries(Object.entries(prov).filter(([k]) => (seccionDe(secciones, k) || {}).fija));
    buscador.value = '';
    if (onLimpiar) onLimpiar({ ...prov });
    recontar(); pintarCuerpo(); pintarPie();
  } });
  const aplicar = el('button', { class: 'btn primario', type: 'button', text: 'Ver resultados', onclick: () => { cerrar(); if (onAplicar) onAplicar({ ...prov }); } });
  const caja = el('div', { class: 'hoja', role: 'dialog', 'aria-modal': 'true', 'aria-label': titulo }, [
    el('div', { class: 'hoja-asa', 'aria-hidden': 'true' }),
    el('div', { class: 'hoja-cab' }, [el('h2', { text: titulo }), el('button', { class: 'btn-x', type: 'button', 'aria-label': 'Cerrar', text: '×', onclick: () => cerrar() })]),
    buscador, cuerpo, el('div', { class: 'hoja-pie' }, [limpiar, aplicar])]);
  const hoja = el('div', { class: 'hoja-fondo', onclick: e => { if (e.target === e.currentTarget) cerrar(); } }, [caja]);

  function pintarCuerpo() {
    cuerpo.innerHTML = '';
    for (const s of secciones) {
      if (!s || s.libre || !(s.opciones || []).length) continue;
      if (s.visible && !s.visible(prov)) continue;
      cuerpo.append(el('section', { class: 'hoja-seccion' }, [
        el('h3', { text: s.titulo }),
        el('div', { class: 'chips' }, s.opciones.map(([valor, etiqueta, num]) => {
          const puesto = prov[s.clave] === valor;
          return el('button', { class: 'chip' + (puesto ? ' activo' : ''), type: 'button', 'aria-pressed': String(puesto),
            text: etiqueta + (num == null ? '' : ' ' + num), onclick: () => cambiar(s.clave, puesto ? '' : valor) });
        }))]));
    }
  }
  function pintarPie() {
    aplicar.textContent = 'Ver ' + n + (n === 1 ? ' resultado' : ' resultados');
    limpiar.hidden = contarActivos(prov, secciones) === 0;
  }
  function pintarGlobo() {
    const c = contarActivos(fijos, secciones);
    globo.textContent = String(c);
    globo.hidden = c === 0;
  }
  function recontar() { const r = onCambio ? onCambio({ ...prov }) : null; if (typeof r === 'number') n = r; }
  function cambiar(clave, valor) {
    if (valor === '' || valor == null) delete prov[clave]; else prov[clave] = valor;
    recontar(); pintarCuerpo(); pintarPie();
  }

  function abrir() {
    prov = { ...fijos };
    buscador.value = fijos[claveTexto] || '';
    recontar(); pintarCuerpo(); pintarPie();
    hoja.classList.add('abierta');
    fab.setAttribute('aria-expanded', 'true');
    document.body.classList.add('con-hoja');
    escuchando = ev => { if (ev.key === 'Escape') cerrar(); };
    document.addEventListener('keydown', escuchando);
    setTimeout(() => buscador.focus && buscador.focus(), 60);
  }
  function cerrar() {
    hoja.classList.remove('abierta');
    fab.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('con-hoja');
    if (escuchando) { document.removeEventListener('keydown', escuchando); escuchando = null; }
    if (fab.focus) fab.focus();
  }
  function actualizar(v, t) {
    fijos = { ...(v || {}) };
    if (t != null) { total = Number(t) || 0; n = total; }
    pintarGlobo(); pintarPie();
  }

  pintarGlobo(); pintarCuerpo(); pintarPie();
  return { fab, hoja, abrir, cerrar, actualizar };
}
