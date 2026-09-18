// Rutas de HQ v2 por pregunta del CEO (plan 3, tanda 1). Sin DOM: se prueba con node --test.
// Una clave es 'hoy' o 'area/vista'. El hash completo es '#clave[/arg][?filtros]'.
// `icono` (plan 3b, T4): svg 24x24 dibujado a mano, sin librerías ni fuente de iconos. shell.js lo
// inserta con innerHTML (no con document.createElement('svg'), que en un documento HTML no crea un
// nodo SVG real): así el navegador lo parsea como namespace SVG de verdad y se ve.
const ICONOS = {
  hoy: '<svg class="ico" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
  direccion: '<svg class="ico" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="3"/></svg>',
  operacion: '<svg class="ico" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="5" height="18"/><rect x="10" y="3" width="5" height="12"/><rect x="17" y="3" width="4" height="8"/></svg>',
  equipo: '<svg class="ico" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="3"/><path d="M2 20a6 6 0 0 1 12 0"/><circle cx="17" cy="7" r="2.5"/><path d="M13 20a5 5 0 0 1 9 0"/></svg>',
  recursos: '<svg class="ico" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="7" rx="1"/><rect x="3" y="13" width="18" height="7" rx="1"/><circle cx="7" cy="7.5" r="0.75" fill="currentColor" stroke="none"/></svg>',
  reglas: '<svg class="ico" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2 L20 5 V11 C20 16.25 16.6 20.74 12 22 C7.4 20.74 4 16.25 4 11 V5 Z"/><polyline points="9 12 11 14 15 10"/></svg>',
};
export const AREAS = [
  { id: 'hoy', nombre: 'Hoy', icono: ICONOS.hoy, vistas: [{ clave: 'hoy', nombre: 'Hoy' }] },
  { id: 'direccion', nombre: 'Dirección', icono: ICONOS.direccion, vistas: [{ clave: 'direccion/objetivo', nombre: 'Objetivo' }] },
  { id: 'operacion', nombre: 'Operación', icono: ICONOS.operacion, vistas: [{ clave: 'operacion/tablero', nombre: 'Tablero' }, { clave: 'operacion/expedientes', nombre: 'Expedientes' }, { clave: 'operacion/licitaciones', nombre: 'Licitaciones' }] },
  { id: 'equipo', nombre: 'Equipo', icono: ICONOS.equipo, vistas: [{ clave: 'equipo/organigrama', nombre: 'Organigrama' }, { clave: 'equipo/colaboradores', nombre: 'Colaboradores' }] },
  { id: 'recursos', nombre: 'Recursos', icono: ICONOS.recursos, vistas: [{ clave: 'recursos/computo', nombre: 'Cómputo' }] },
  { id: 'reglas', nombre: 'Reglas', icono: ICONOS.reglas, vistas: [{ clave: 'reglas/decisiones', nombre: 'Decisiones' }] },
];
// Claves que tienen vista. 'equipo/agente' no sale en el menú (es la ficha) pero es una ruta válida.
export const CLAVES = new Set(['hoy', 'direccion/objetivo', 'operacion/tablero', 'operacion/expedientes', 'operacion/licitaciones', 'equipo/organigrama', 'equipo/colaboradores', 'equipo/agente', 'recursos/computo', 'reglas/decisiones']);
// Rutas de la v2.0 (tabs): se redirigen para que no se rompa ningún enlace ya enviado en tarjetas o push.
const VIEJAS = { inicio: 'hoy', plan: 'direccion/objetivo', tablero: 'operacion/tablero', decisiones: 'reglas/decisiones', equipo: 'equipo/organigrama', expedientes: 'operacion/expedientes' };
// Área sin vista (o con vista desconocida): a su vista por defecto. Recursos: Cómputo desde el lote 1e (#1054); Dinero llega en la tanda 3.
const DEFECTO = { hoy: 'hoy', direccion: 'direccion/objetivo', operacion: 'operacion/tablero', equipo: 'equipo/organigrama', recursos: 'recursos/computo', reglas: 'reglas/decisiones' };

export function resolver(hash = '', search = '') {
  const idPush = new URLSearchParams(search || '').get('id');
  if (idPush && /^\d+$/.test(idPush)) return { clave: 'reglas/decisiones', arg: idPush, filtros: {}, canonico: '#reglas/decisiones/' + idPush, redirigido: true };
  const [camino, q = ''] = String(hash || '').replace(/^#/, '').split('?');
  const filtros = Object.fromEntries(new URLSearchParams(q));
  let seg = camino.split('/').filter(Boolean), redirigido = false;
  if (!seg.length) { seg = ['hoy']; redirigido = true; }
  // #1057 tarea 24: '#equipo/<vista>' con vista propia (organigrama, colaboradores, agente) no es la ruta
  // vieja '#equipo/<id>'; antes '#equipo/organigrama' acababa en '#equipo/agente/organigrama'.
  if (VIEJAS[seg[0]] && !(seg[0] === 'equipo' && CLAVES.has('equipo/' + seg[1]))) {
    const nueva = VIEJAS[seg[0]].split('/'); let resto = seg.slice(1);
    if (seg[0] === 'tablero' && resto[0] === 'f' && resto[1]) { filtros.frente = resto[1]; resto = []; }
    if (seg[0] === 'equipo' && resto[0]) nueva[1] = 'agente';
    seg = [...nueva, ...resto]; redirigido = true;
  }
  let clave = seg[0] === 'hoy' ? 'hoy' : seg.slice(0, 2).join('/');
  let arg = seg[0] === 'hoy' ? undefined : (seg.slice(2).join('/') || undefined);
  if (!CLAVES.has(clave)) { clave = DEFECTO[seg[0]] || 'hoy'; arg = undefined; redirigido = true; if (clave === 'hoy') for (const k of Object.keys(filtros)) delete filtros[k]; }
  const qs = new URLSearchParams(filtros).toString();
  const canonico = '#' + clave + (arg ? '/' + arg : '') + (qs ? '?' + qs : '');
  return { clave, arg, filtros, canonico, redirigido };
}
