import { conf, TOKEN, cargar, suscribir, guardarToken, salir } from './api.js';
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
if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => { if (!r.active || !r.active.scriptURL.endsWith('/hq/sw.js')) r.unregister(); }));
if (!TOKEN) pedirToken();
else conf().then(recargar).then(() => suscribir(S.datos.empresa, recargar)).catch(e => { raiz.innerHTML = ''; raiz.append(el('p', { class: 'error', text: 'No se pudo cargar HQ: ' + e.message })); });
