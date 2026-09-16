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
export function toast(texto, accion, fn) {
  const t = el('div', { class: 'toast' }, [el('span', { text: texto }), accion ? el('button', { class: 'btn-enlace', text: accion, onclick: () => { fn(); t.remove(); } }) : null]);
  document.body.append(t); setTimeout(() => t.remove(), accion ? 8000 : 3500);
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
