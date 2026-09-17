import { conf, TOKEN, cargar, rpc, guardarToken, salir } from './api.js';
import { S, poner } from './estado.js';
import { el, toast } from './ui.js';
import * as inicio from './vistas/inicio.js';
import * as plan from './vistas/plan.js';
import * as tablero from './vistas/tablero.js';
import * as decisiones from './vistas/decisiones.js';
import * as equipo from './vistas/equipo.js';
import * as expedientes from './vistas/expedientes.js';

const VISTAS = { inicio, plan, tablero, decisiones, equipo, expedientes };
const raiz = document.getElementById('vista');
document.getElementById('ver').textContent = 'v' + HQ_VERSION.v;

function ruta() { const h = (location.hash || '#inicio').slice(1).split('/'); return { vista: VISTAS[h[0]] ? h[0] : 'inicio', arg: h[1] }; }
export function render() {
  const { vista, arg } = ruta();
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('activa', a.getAttribute('href') === '#' + vista));
  raiz.innerHTML = ''; raiz.className = 'vista vista-' + vista;
  if (!S.datos) { raiz.append(el('p', { class: 'cargando', text: 'Cargando HQ...' })); return; }
  VISTAS[vista].render(raiz, S, arg);
}
export async function recargar() { try { poner(await cargar()); render(); } catch (e) { toast('HQ: ' + e.message); } }

function pedirToken() {
  const campo = el('input', { class: 'campo', placeholder: 'Pega el enlace de HQ o el token', autofocus: true });
  raiz.innerHTML = ''; raiz.append(el('div', { class: 'entrar' }, [el('h1', { text: 'HQ' }), campo,
    el('button', { class: 'btn primario', text: 'Entrar', onclick: () => { const m = campo.value.match(/[?&]t=([0-9a-f]{20,})/i) || campo.value.match(/^([0-9a-f]{20,})$/i); if (!m) { campo.focus(); return; } guardarToken(m[1]); location.reload(); } })]));
}
window.addEventListener('hashchange', render);
document.addEventListener('click', e => { if (e.target.closest('[data-salir]')) salir(); });

// Push: la clave publica VAPID viaja en la config que ya trae conf() (GET /hq/config -> { url, anon,
// publicKey }), nunca literal en el codigo. b64() replica el formato de public/hq/v1/index.html (misma
// codificacion base64url con relleno) porque la clave VAPID no siempre trae el '=' de relleno.
function b64(s) { const p = '='.repeat((4 - s.length % 4) % 4), b = (s + p).replace(/-/g, '+').replace(/_/g, '/'), r = atob(b), o = new Uint8Array(r.length); for (let i = 0; i < r.length; i++) o[i] = r.charCodeAt(i); return o; }
async function pedirPush() { if (await Notification.requestPermission() === 'granted') activarPush(await navigator.serviceWorker.ready); }
async function activarPush(reg) {
  try {
    const cfg = JSON.parse(localStorage.getItem('hq_cfg') || '{}');
    if (!cfg.publicKey) return;
    const sub = await reg.pushManager.getSubscription() || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(cfg.publicKey) });
    await rpc('omc_guardar_push', { p_sub: sub.toJSON() });
  } catch (e) { console.warn('push', e.message); }
}

// Service worker: registra el nuevo /hq/sw.js y desregistra cualquier registro sobrante en el mismo
// scope (/hq/) que no sea ese script activo (residuos de versiones o pruebas anteriores). Nunca toca
// registros de otro scope (p.ej. /hq/v1/, que se gestiona a si mismo y no se debe romper desde aqui).
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => { if (new URL(r.scope).pathname === '/hq/' && !(r.active && r.active.scriptURL.endsWith('/hq/sw.js'))) r.unregister(); }));
  navigator.serviceWorker.register('/hq/sw.js', { updateViaCache: 'none' }).then(reg => {
    reg.addEventListener('updatefound', () => { const nuevo = reg.installing; if (nuevo) nuevo.addEventListener('statechange', () => { if (nuevo.state === 'activated' && navigator.serviceWorker.controller) toast('HQ tiene versión nueva', 'recargar', () => location.reload()); }); });
    if (Notification.permission === 'default') document.addEventListener('click', pedirPush, { once: true });
    else if (Notification.permission === 'granted') activarPush(reg);
  }).catch(() => {});
}

if (!TOKEN) pedirToken();
else {
  conf().then(recargar).catch(e => { raiz.innerHTML = ''; raiz.append(el('p', { class: 'error', text: 'No se pudo cargar HQ: ' + e.message })); });
  // Sin realtime (T7-b): recarga cada 60s y al volver a la pestaña, nunca en segundo plano.
  setInterval(recargar, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) recargar(); });
}
