import { conf, TOKEN, cargar, rpc, guardarToken, salir } from './api.js';
import { S, poner } from './estado.js';
import { el, toast } from './ui.js';
import { crearRecargador } from './recargador.js';
import { resolver } from './rutas.js';
import { montarMenu, marcarActiva, pintarBarra, cablearShell } from './shell.js';
import * as hoy from './vistas/hoy.js';
import * as objetivo from './vistas/objetivo.js';
import * as tablero from './vistas/tablero.js';
import * as decisiones from './vistas/decisiones.js';
import * as equipo from './vistas/equipo.js';
import * as colaboradores from './vistas/colaboradores.js';
import * as expedientes from './vistas/expedientes.js';
import * as licitaciones from './vistas/licitaciones.js';
import * as recursos from './vistas/recursos.js';

// Plan 3a: una vista por clave de ruta (rutas.js). 'equipo/agente' es la ficha de equipo.js (arg = id).
const VISTAS = { 'hoy': hoy, 'direccion/objetivo': objetivo, 'operacion/tablero': tablero, 'operacion/expedientes': expedientes, 'operacion/licitaciones': licitaciones, 'equipo/organigrama': equipo, 'equipo/agente': equipo, 'equipo/colaboradores': colaboradores, 'recursos/computo': recursos, 'reglas/decisiones': decisiones };
const raiz = document.getElementById('vista');
document.getElementById('ver').textContent = 'v' + HQ_VERSION.v;
montarMenu(document.getElementById('nav'));
cablearShell();

// resolver() absorbe las rutas de la v2.0 (#inicio, #tablero/f/A3, ?id=N...) y devuelve el hash canónico;
// si difiere del actual (o hay que limpiar la query) se sustituye en el historial para no dejar enlaces
// viejos colgados. Ruling del controlador (17-sep): comparar contra r.canonico, no solo r.redirigido,
// porque '#hoy/extra' resuelve a canonico '#hoy' con redirigido=false y aun asi hay que limpiar la URL.
export function render() {
  // Fix Important 3 de la revisión final: sin token, cualquier hashchange (clic en el menú, en "HQ" o
  // Enter en el buscador) llegaba hasta aquí, borraba el formulario de pedirToken() y dejaba "Cargando
  // HQ..." para siempre (S.datos nunca llega sin token). pedirToken está declarada con `function`, así
  // que el hoisting cubre este orden.
  if (!TOKEN) return pedirToken();
  const r = resolver(location.hash, location.search);
  if (r.canonico !== location.hash || location.search) history.replaceState(null, '', location.pathname + r.canonico);
  marcarActiva(r.clave);
  raiz.innerHTML = ''; raiz.className = 'vista vista-' + r.clave.replace('/', '-');
  if (!S.datos) { raiz.append(el('p', { class: 'cargando', text: 'Cargando HQ...' })); return; }
  window.HQ_DATOS = S.datos; pintarBarra(S.datos);
  VISTAS[r.clave].render(raiz, S, r.arg, r.filtros);
}
// Fix ronda 2 (revision final, D3): recargar() coalescido via crearRecargador (modulo sin DOM, con test
// propio en test/recargador.test.mjs). cargarFn atrapa el error y muestra el toast (igual que antes:
// nunca deja una excepcion sin capturar), renderFn no hace nada si cargarFn no trajo datos.
export const recargar = crearRecargador(
  async () => { try { return await cargar(); } catch (e) { toast('HQ: ' + e.message); return undefined; } },
  datos => { if (datos !== undefined) { poner(datos); render(); } }
);

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
  // Fix ronda 2 (revision final, D5): enlace profundo del push cuando la app ya esta abierta (sw.js
  // hace postMessage en vez de navegar la pestana existente). Plan 3a: las rutas nuevas viven bajo
  // 'reglas/decisiones' (no hay ruta propia para licitaciones en la v2: viven dentro de esa area).
  navigator.serviceWorker.addEventListener('message', ev => {
    if (ev.data?.tipo === 'abrir' && ev.data.id) location.hash = '#reglas/decisiones/' + ev.data.id;
    else if (ev.data?.tipo === 'abrir-lic' && ev.data.lic) location.hash = '#reglas/decisiones';
  });
}

if (!TOKEN) pedirToken();
else {
  conf().then(recargar).catch(e => { raiz.innerHTML = ''; raiz.append(el('p', { class: 'error', text: 'No se pudo cargar HQ: ' + e.message })); });
  // Sin realtime (T7-b): recarga cada 60s y al volver a la pestaña, nunca en segundo plano. Fix ronda 2
  // (revision final, D3): el propio tick del intervalo tambien mira document.hidden (antes solo lo
  // miraba el comentario, no el codigo).
  setInterval(() => { if (!document.hidden) recargar(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) recargar(); });
}
