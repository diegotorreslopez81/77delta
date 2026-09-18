// Shell de HQ v2 (plan 3a): menú lateral por áreas (plegable desde 900 px, drawer por debajo), barra
// superior (contador, semáforo de cuentas, buscador global) y "copiar enlace". Solo DOM del armazón;
// las vistas no saben que existe. Ids esperados en index.html: nav, menu, hamburguesa, velo, plegar,
// busqueda, resultados, contador, semaforo, buscador.
// Plan 3b, T4: menú con iconos y cómodo en el móvil. cablearShell() monta la cabecera del cajón
// (logo + marca "HQ" + botón cerrar) dentro de #menu con prepend (no hay hueco fijo en index.html: nav ya
// vive ahí, y prepend ya es un patrón usado en tablero.js). El cierre al navegar ya existía
// (window.addEventListener('hashchange', cerrarMenu), más abajo): un click en un enlace del menú
// cambia location.hash, dispara hashchange y cierra el cajón sin código nuevo.
// Encargo #1057 tarea 29 (menú + KPIs + campana): index.html no se toca (lo edita otro implementador en
// paralelo), así que la campana de notificaciones y el botón de recarga se insertan por JS dentro de
// #buscador, que sí existe ya en index.html.
import { AREAS } from './rutas.js';
import { el, toast } from './ui.js';
import { buscar } from './buscador.js';
import { contador, semaforoCuentas } from './estado.js';

const ref = { enlaces: new Map(), areas: new Map() };
const $ = id => document.getElementById(id);

const ICONO_CAMPANA = '<svg class="ico" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';
const ICONO_RECARGAR = '<svg class="ico" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7"/><polyline points="21 3 21 9 15 9"/></svg>';

export function montarMenu(nav) {
  nav.innerHTML = ''; ref.enlaces.clear(); ref.areas.clear();
  for (const a of AREAS) {
    // Menú (#1057 tarea 29): un área con una sola vista sale como un único enlace icono+texto, sin
    // 'area-titulo' encima (sería repetir la misma línea dos veces). Equipo es la única área con más
    // de una vista: lleva su título y cada sub-vista con su propio icono (`v.icono`, si no cae al de
    // el área). hq.css ya no oculta el icono de '.sub' (regla retirada, era de cuando todas las
    // sub-vistas compartían el icono del área y se repetía).
    const unaVista = a.vistas.length === 1;
    const titulo = unaVista ? null : el('p', { class: 'area-titulo' }, [el('span', { class: 'ico', html: a.icono }), a.nombre]);
    const div = el('div', { class: 'area', 'data-area': a.id }, [titulo,
      ...(a.vistas.length ? a.vistas.map(v => {
        const e = el('a', { href: '#' + v.clave, 'data-clave': v.clave, title: v.nombre, class: unaVista ? '' : 'sub',
          // Minor 5 (revision final): un click en un enlace del cajon lo cierra aunque el hash ya fuera
          // el activo (el listener de hashchange no dispara si el hash no cambia).
          onclick: cerrarMenu },
          [el('span', { class: 'ico', html: v.icono || a.icono }), el('span', { class: 'txt', text: v.nombre })]);
        ref.enlaces.set(v.clave, e); return e;
      }) : [el('p', { class: 'mudo pronto', text: 'pronto' })])]);
    ref.areas.set(a.id, div); nav.append(div);
  }
  return ref;
}
// Cabecera del cajón móvil (logo + marca "HQ" + botón cerrar). Se monta una sola vez, la primera vez
// que se llama a cablearShell() (que en producción solo ocurre una vez, al arrancar main.js).
function montarCabeceraMenu() {
  const menu = $('menu');
  const cerrar = el('button', { class: 'btn-icono', id: 'cerrar-menu', 'aria-label': 'Cerrar menú', text: '✕', onclick: cerrarMenu });
  const marca = el('span', { class: 'marca-menu' }, [el('img', { src: '/hq/monograma.svg', alt: '77 Delta', class: 'logo-menu' }), el('span', { text: 'HQ' })]);
  menu.prepend(el('div', { class: 'menu-cab' }, [marca, cerrar]));
}
// Campana de notificaciones + botón de recarga (#1057 tarea 29). Se insertan dentro de #buscador, a la
// derecha del campo de búsqueda, ya que index.html no se toca en este lote. Idempotente igual que
// cablearShell(), marcado con data-acciones para no duplicar si algo volviera a llamarla.
function montarAcciones() {
  const buscador = $('buscador');
  if (!buscador || buscador.getAttribute('data-acciones')) return;
  buscador.setAttribute('data-acciones', '1');
  const badge = el('span', { class: 'badge-campana' }, ['0']);
  badge.hidden = true;
  const campana = el('a', { class: 'btn-icono campana', id: 'campana', href: '#hoy/bandeja', 'aria-label': 'Bandeja de decisiones' }, [el('span', { class: 'ico', html: ICONO_CAMPANA }), badge]);
  const btnRecargar = el('button', { class: 'btn-icono recargar', id: 'recargar-btn', type: 'button', 'aria-label': 'Recargar datos' }, [el('span', { class: 'ico', html: ICONO_RECARGAR })]);
  btnRecargar.addEventListener('click', async () => {
    if (btnRecargar.classList.contains('girando')) return;
    btnRecargar.classList.add('girando');
    try { if (typeof window !== 'undefined' && window.HQ_RECARGAR) await window.HQ_RECARGAR(); } finally { btnRecargar.classList.remove('girando'); }
  });
  buscador.append(campana, btnRecargar);
  ref.badgeCampana = badge; ref.campana = campana; ref.recargarBtn = btnRecargar;
}
export function marcarActiva(clave) {
  // #1057 tarea 29: Tablero, Expedientes y Licitaciones pasan a ser áreas propias (id 'tablero',
  // 'expedientes', 'licitaciones') aunque su clave de ruta siga bajo el prefijo 'operacion/' (las
  // claves de ruta no cambian). El id del área ya no coincide con ese prefijo, así que se busca el
  // área por la vista que contiene la clave; 'equipo/agente' (la ficha, sin entrada de menú) cae al
  // prefijo de siempre.
  const area = AREAS.find(a => a.vistas.some(v => v.clave === clave))?.id || clave.split('/')[0];
  for (const [k, e] of ref.enlaces) e.classList.toggle('activa', k === clave);
  for (const [id, d] of ref.areas) d.classList.toggle('abierta', id === area);
}
// Badging API (petición del owner, 17-sep): refleja el contador en el icono de la app instalada
// (PWA). Ni Safari ni algunos navegadores la implementan, y en los tests no existe `navigator`:
// por eso todo entra en un try/catch y solo se toca si `navigator` existe.
function pintarBadge(n) {
  if (typeof navigator === 'undefined') return;
  try {
    if (n > 0) navigator.setAppBadge?.(n);
    else navigator.clearAppBadge?.();
  } catch {}
}
export function pintarBarra(datos) {
  const c = contador(datos), nodo = $('contador');
  nodo.textContent = c.texto + ' ' + c.n; nodo.setAttribute('href', c.href); nodo.hidden = !c.n;
  pintarBadge(c.n);
  // Campana (#1057 tarea 29): mismo recuento que el contador de la barra (pendientes del owner, en
  // curso del agente), pero el destino del click es siempre la bandeja de Hoy.
  if (ref.badgeCampana) { ref.badgeCampana.textContent = String(c.n); ref.badgeCampana.hidden = !c.n; }
  const s = semaforoCuentas(datos), sem = $('semaforo');
  sem.hidden = !s;
  if (s) { sem.className = 'semaforo ' + s.color; sem.setAttribute('title', s.cuenta + ' al ' + s.pct + ' % de la ventana'); }
}
// Minor 4 (revision final): aria-label del hamburguesa alterna Abrir/Cerrar menu junto con aria-expanded.
export function cerrarMenu() {
  document.body.classList.remove('menu-abierto');
  const h = $('hamburguesa'); h.setAttribute('aria-expanded', 'false'); h.setAttribute('aria-label', 'Abrir menú');
}
function abrirMenu() {
  document.body.classList.add('menu-abierto');
  const h = $('hamburguesa'); h.setAttribute('aria-expanded', 'true'); h.setAttribute('aria-label', 'Cerrar menú');
}

export function cablearShell() {
  // Minor 3 (revision final): cablearShell() se llama sin condicion desde main.js al importarse; una
  // segunda llamada (posible si algun test o alguna cadena de imports repite el import en el mismo
  // proceso) no debe duplicar la cabecera del cajon ni los listeners. Se marca #menu con data-cableado
  // la primera vez y se corta aqui en las siguientes.
  const menu = $('menu');
  if (menu.getAttribute('data-cableado')) return;
  menu.setAttribute('data-cableado', '1');
  montarCabeceraMenu();
  montarAcciones();
  cerrarMenu();
  $('hamburguesa').addEventListener('click', () => (document.body.classList.contains('menu-abierto') ? cerrarMenu() : abrirMenu()));
  $('velo').addEventListener('click', cerrarMenu);
  // Plegado del menú (solo escritorio). Se recuerda en localStorage hq_menu ('plegado' o 'abierto').
  let plegado = false; try { plegado = localStorage.getItem('hq_menu') === 'plegado'; } catch {}
  document.body.classList.toggle('menu-plegado', plegado);
  $('plegar').addEventListener('click', () => { const p = !document.body.classList.contains('menu-plegado'); document.body.classList.toggle('menu-plegado', p); try { localStorage.setItem('hq_menu', p ? 'plegado' : 'abierto'); } catch {} });
  // Buscador: pinta hasta 12 resultados bajo el campo; Enter abre el primero; Escape cierra.
  const campo = $('busqueda'), lista = $('resultados');
  const cerrarLista = () => { lista.hidden = true; lista.innerHTML = ''; };
  const pintar = () => {
    const r = buscar(window.HQ_DATOS || {}, campo.value);
    lista.innerHTML = ''; lista.hidden = !r.length;
    r.forEach((x, i) => lista.append(el('a', { href: x.href, class: i === 0 ? 'marcado' : '', onclick: () => { campo.value = ''; cerrarLista(); cerrarMenu(); } }, [el('span', { class: 'tipo', text: x.tipo }), el('span', { text: (typeof x.id === 'number' ? '#' + x.id + ' ' : '') + x.titulo })])));
  };
  campo.addEventListener('input', pintar);
  campo.addEventListener('focus', () => { if (campo.value) pintar(); });
  campo.addEventListener('keydown', e => {
    if (e.key === 'Escape') { campo.value = ''; cerrarLista(); campo.blur(); }
    if (e.key === 'Enter') { const primero = lista.querySelector('a'); if (primero) { location.hash = primero.getAttribute('href'); campo.value = ''; cerrarLista(); } }
  });
  document.addEventListener('click', e => { if (!e.target.closest('#buscador')) cerrarLista(); });
  // Copiar enlace: cualquier elemento con data-copiar-enlace copia la URL actual (hash incluido).
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-copiar-enlace]'); if (!b) return;
    const url = location.href.split('?')[0].split('#')[0] + location.hash;
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => toast('enlace copiado'), () => toast(url));
  });
  window.addEventListener('hashchange', cerrarMenu);
  // Minor 5 (revision final): cierre del cajon tambien con la tecla Escape.
  document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarMenu(); });
}
