// Rutas de HQ v2 por pregunta del CEO (plan 3, tanda 1). Sin DOM: se prueba con node --test.
// Una clave es 'hoy' o 'area/vista'. El hash completo es '#clave[/arg][?filtros]'.
// `icono` (plan 3b, T4): svg 24x24 dibujado a mano, sin librerías ni fuente de iconos. shell.js lo
// inserta con innerHTML (no con document.createElement('svg'), que en un documento HTML no crea un
// nodo SVG real): así el navegador lo parsea como namespace SVG de verdad y se ve.
// Menú (brief B, 19-sep): Home, KPIs, Licitaciones, Expedientes, Tablero, Organigrama, Colaboradores,
// Recursos y Plan estratégico salen cada uno como área propia de una sola vista. Equipo ya no agrupa
// Organigrama y Colaboradores (Diego: dos entradas directas donde antes estaba Equipo); las claves de
// ruta 'equipo/organigrama' y 'equipo/colaboradores' no cambian, solo se reparten en dos áreas.
const ICONOS = {
  hoy: '<svg class="ico" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg>',
  kpis: '<svg class="ico" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="3" y1="21" x2="21" y2="21"/><rect x="5" y="14" width="3" height="7"/><rect x="11" y="9" width="3" height="12"/><rect x="17" y="4" width="3" height="17"/></svg>',
  direccion: '<svg class="ico" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="3"/></svg>',
  operacion: '<svg class="ico" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="5" height="18"/><rect x="10" y="3" width="5" height="12"/><rect x="17" y="3" width="4" height="8"/></svg>',
  expedientes: '<svg class="ico" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>',
  licitaciones: '<svg class="ico" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 9l10-6 10 6"/><line x1="4" y1="9" x2="20" y2="9"/><line x1="5" y1="9" x2="5" y2="19"/><line x1="9" y1="9" x2="9" y2="19"/><line x1="15" y1="9" x2="15" y2="19"/><line x1="19" y1="9" x2="19" y2="19"/><line x1="3" y1="21" x2="21" y2="21"/></svg>',
  equipo: '<svg class="ico" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="3"/><path d="M2 20a6 6 0 0 1 12 0"/><circle cx="17" cy="7" r="2.5"/><path d="M13 20a5 5 0 0 1 9 0"/></svg>',
  organigrama: '<svg class="ico" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="4.5" r="2.5"/><circle cx="5" cy="19" r="2.5"/><circle cx="19" cy="19" r="2.5"/><path d="M12 7v4M12 11L5 16.5M12 11l7 5.5"/></svg>',
  colaboradores: '<svg class="ico" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2 20a7 7 0 0 1 14 0"/><line x1="18" y1="7" x2="18" y2="13"/><line x1="15" y1="10" x2="21" y2="10"/></svg>',
  recursos: '<svg class="ico" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="7" rx="1"/><rect x="3" y="13" width="18" height="7" rx="1"/><circle cx="7" cy="7.5" r="0.75" fill="currentColor" stroke="none"/></svg>',
};
export const AREAS = [
  { id: 'hoy', nombre: 'Home', icono: ICONOS.hoy, vistas: [{ clave: 'hoy', nombre: 'Home' }] },
  { id: 'kpis', nombre: 'KPIs', icono: ICONOS.kpis, vistas: [{ clave: 'kpis', nombre: 'KPIs' }] },
  { id: 'licitaciones', nombre: 'Licitaciones', icono: ICONOS.licitaciones, vistas: [{ clave: 'operacion/licitaciones', nombre: 'Licitaciones' }] },
  { id: 'expedientes', nombre: 'Expedientes', icono: ICONOS.expedientes, vistas: [{ clave: 'operacion/expedientes', nombre: 'Expedientes' }] },
  { id: 'tablero', nombre: 'Tablero', icono: ICONOS.operacion, vistas: [{ clave: 'operacion/tablero', nombre: 'Tablero' }] },
  { id: 'organigrama', nombre: 'Organigrama', icono: ICONOS.organigrama, vistas: [{ clave: 'equipo/organigrama', nombre: 'Organigrama' }] },
  { id: 'colaboradores', nombre: 'Colaboradores', icono: ICONOS.colaboradores, vistas: [{ clave: 'equipo/colaboradores', nombre: 'Colaboradores' }] },
  { id: 'recursos', nombre: 'Recursos', icono: ICONOS.recursos, vistas: [{ clave: 'recursos/computo', nombre: 'Cómputo' }] },
  { id: 'direccion', nombre: 'Plan estratégico', icono: ICONOS.direccion, vistas: [{ clave: 'direccion/objetivo', nombre: 'Plan estratégico' }] },
];
// Claves que tienen vista. 'equipo/agente' no sale en el menú (es la ficha) pero es una ruta válida.
export const CLAVES = new Set(['hoy', 'kpis', 'direccion/objetivo', 'operacion/tablero', 'operacion/expedientes', 'operacion/licitaciones', 'equipo/organigrama', 'equipo/colaboradores', 'equipo/agente', 'recursos/computo']);
// Rutas de la v2.0 (tabs): se redirigen para que no se rompa ningún enlace ya enviado en tarjetas o push.
const VIEJAS = { inicio: 'hoy', plan: 'direccion/objetivo', tablero: 'operacion/tablero', equipo: 'equipo/organigrama', expedientes: 'operacion/expedientes' };
// Área sin vista (o con vista desconocida): a su vista por defecto. Recursos: Cómputo desde el lote 1e (#1054); Dinero llega en la tanda 3.
// Diego 19-sep: "Licitaciones, Expedientes y Tablero" es el orden, así que '#operacion' a secas cae en
// Licitaciones. No hay entrada 'equipo': ese prefijo lo intercepta siempre VIEJAS (línea de abajo) antes
// de llegar aquí, así que sería código muerto; tampoco hacen falta 'organigrama'/'colaboradores' (como
// tablero/expedientes/licitaciones, nadie genera un hash de un solo segmento con esos ids).
const DEFECTO = { hoy: 'hoy', kpis: 'kpis', direccion: 'direccion/objetivo', operacion: 'operacion/licitaciones', recursos: 'recursos/computo' };

export function resolver(hash = '', search = '') {
  const idPush = new URLSearchParams(search || '').get('id');
  if (idPush && /^\d+$/.test(idPush)) return { clave: 'hoy', arg: idPush, filtros: {}, canonico: '#hoy/' + idPush, redirigido: true };
  const [camino, q = ''] = String(hash || '').replace(/^#/, '').split('?');
  const filtros = Object.fromEntries(new URLSearchParams(q));
  let seg = camino.split('/').filter(Boolean), redirigido = false;
  if (!seg.length) { seg = ['hoy']; redirigido = true; }
  // #1057 tarea 27: Decisiones vive en Hoy como bandeja. '#decisiones[/N]' y '#reglas[/decisiones[/N]]'
  // (tarjetas, push y enlaces ya enviados) van a '#hoy/N' o a '#hoy/bandeja'.
  if (seg[0] === 'decisiones' || seg[0] === 'reglas') { const id = seg.find(x => /^\d+$/.test(x)); seg = ['hoy', id || 'bandeja']; redirigido = true; }
  // #1057 tarea 24: '#equipo/<vista>' con vista propia (organigrama, colaboradores, agente) no es la ruta
  // vieja '#equipo/<id>'; antes '#equipo/organigrama' acababa en '#equipo/agente/organigrama'.
  if (VIEJAS[seg[0]] && !(seg[0] === 'equipo' && CLAVES.has('equipo/' + seg[1]))) {
    const nueva = VIEJAS[seg[0]].split('/'); let resto = seg.slice(1);
    if (seg[0] === 'tablero' && resto[0] === 'f' && resto[1]) { filtros.frente = resto[1]; resto = []; }
    if (seg[0] === 'equipo' && resto[0]) nueva[1] = 'agente';
    seg = [...nueva, ...resto]; redirigido = true;
  }
  let clave = seg[0] === 'hoy' ? 'hoy' : seg.slice(0, 2).join('/');
  let arg = seg[0] === 'hoy' ? (/^(\d+|bandeja)$/.test(seg[1] || '') ? seg[1] : undefined) : (seg.slice(2).join('/') || undefined);
  if (!CLAVES.has(clave)) { clave = DEFECTO[seg[0]] || 'hoy'; arg = undefined; redirigido = true; if (clave === 'hoy') for (const k of Object.keys(filtros)) delete filtros[k]; }
  const qs = new URLSearchParams(filtros).toString();
  const canonico = '#' + clave + (arg ? '/' + arg : '') + (qs ? '?' + qs : '');
  return { clave, arg, filtros, canonico, redirigido };
}
