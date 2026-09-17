// Rutas de HQ v2 por pregunta del CEO (plan 3, tanda 1). Sin DOM: se prueba con node --test.
// Una clave es 'hoy' o 'area/vista'. El hash completo es '#clave[/arg][?filtros]'.
export const AREAS = [
  { id: 'hoy', nombre: 'Hoy', vistas: [{ clave: 'hoy', nombre: 'Hoy' }] },
  { id: 'direccion', nombre: 'Dirección', vistas: [{ clave: 'direccion/objetivo', nombre: 'Objetivo' }] },
  { id: 'operacion', nombre: 'Operación', vistas: [{ clave: 'operacion/tablero', nombre: 'Tablero' }, { clave: 'operacion/expedientes', nombre: 'Expedientes' }] },
  { id: 'equipo', nombre: 'Equipo', vistas: [{ clave: 'equipo/organigrama', nombre: 'Organigrama' }] },
  { id: 'recursos', nombre: 'Recursos', vistas: [] },
  { id: 'reglas', nombre: 'Reglas', vistas: [{ clave: 'reglas/decisiones', nombre: 'Decisiones' }] },
];
// Claves que tienen vista. 'equipo/agente' no sale en el menú (es la ficha) pero es una ruta válida.
export const CLAVES = new Set(['hoy', 'direccion/objetivo', 'operacion/tablero', 'operacion/expedientes', 'equipo/organigrama', 'equipo/agente', 'reglas/decisiones']);
// Rutas de la v2.0 (tabs): se redirigen para que no se rompa ningún enlace ya enviado en tarjetas o push.
const VIEJAS = { inicio: 'hoy', plan: 'direccion/objetivo', tablero: 'operacion/tablero', decisiones: 'reglas/decisiones', equipo: 'equipo/organigrama', expedientes: 'operacion/expedientes' };
// Área sin vista (o con vista desconocida): a su vista por defecto. Recursos no tiene vista hasta la tanda 3.
const DEFECTO = { hoy: 'hoy', direccion: 'direccion/objetivo', operacion: 'operacion/tablero', equipo: 'equipo/organigrama', reglas: 'reglas/decisiones' };

export function resolver(hash = '', search = '') {
  const idPush = new URLSearchParams(search || '').get('id');
  if (idPush && /^\d+$/.test(idPush)) return { clave: 'reglas/decisiones', arg: idPush, filtros: {}, canonico: '#reglas/decisiones/' + idPush, redirigido: true };
  const [camino, q = ''] = String(hash || '').replace(/^#/, '').split('?');
  const filtros = Object.fromEntries(new URLSearchParams(q));
  let seg = camino.split('/').filter(Boolean), redirigido = false;
  if (!seg.length) { seg = ['hoy']; redirigido = true; }
  if (VIEJAS[seg[0]] && !(seg[0] === 'equipo' && seg[1] === 'agente')) {
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
