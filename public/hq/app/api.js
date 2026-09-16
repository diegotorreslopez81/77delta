// Acceso a HQ: config, token, RPC y realtime. Sin estado de negocio (eso está en estado.js).
const API = 'https://api.77delta.com';
const params = new URLSearchParams(location.search);
if (params.get('t')) { localStorage.setItem('hq_t', params.get('t')); history.replaceState(null, '', location.pathname + location.hash); }
export let TOKEN = localStorage.getItem('hq_t');
let sb = null, canal = null, CFG = null;

export async function conf() {
  const cache = localStorage.getItem('hq_cfg');
  const pedir = fetch(API + '/hq/config').then(r => r.json()).then(j => { if (!j.url || !j.anon) throw new Error('sin configuración'); localStorage.setItem('hq_cfg', JSON.stringify(j)); return j; });
  CFG = cache ? JSON.parse(cache) : await pedir;
  if (cache) pedir.catch(() => {});
  sb = window.supabase.createClient(CFG.url, CFG.anon, { auth: { persistSession: false, autoRefreshToken: false } });
  return CFG;
}
export function guardarToken(t) { localStorage.setItem('hq_t', t); TOKEN = t; }
export function salir() { localStorage.removeItem('hq_t'); TOKEN = null; location.reload(); }
export async function rpc(fn, args = {}) {
  if (!sb) await conf();
  const r = await sb.rpc(fn, { p_token: TOKEN, ...args });
  if (r.error) throw new Error(r.error.message || 'error');
  return r.data;
}
export function cargar() { return rpc('omc_hq_v2'); }
export function suscribir(empresa, onCambio) {
  if (canal) sb.removeChannel(canal);
  canal = sb.channel('omc:' + empresa).on('broadcast', { event: 'cambio' }, onCambio).subscribe();
}
