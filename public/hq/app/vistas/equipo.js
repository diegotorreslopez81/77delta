// Equipo: lista por departamento y ficha de agente con frentes y encargos abiertos. Sustituye el
// stub de T1.
//
// T6-b (ruling del controlador, 2026-09-16): agentes[].jefe no existe en el payload real: se omite
// por completo (ni se lee ni se muestra "reporta a ...").
//
// Ultima instruccion del controlador (punto 3): "editar" frentes de un agente es una de las 4
// acciones de escritura de esta tarea y solo se muestra con S.datos.rol==='owner' (ya lo hacia el
// paso 3 del brief; se mantiene).
import { rpc } from '../api.js';
import { el, modal, toast, horas } from '../ui.js';
import { filtrar } from '../estado.js';
import { tarjetaEncargo } from '../tarjeta.js';
import { recargar } from '../main.js';

function avatar(a) { return a.avatar_url ? el('img', { class: 'avatar', src: a.avatar_url, alt: '' }) : el('span', { class: 'avatar letra', text: (a.nombre || a.id)[0].toUpperCase() }); }
function latido(a) { const h = horas(a.ultima_actividad); return h == null ? 'sin latido' : h < 1 ? 'activo ahora' : h < 24 ? 'hace ' + h + ' h' : 'hace ' + Math.floor(h / 24) + ' d'; }

function editarFrentes(a, S) {
  const cajas = (S.datos.frentes || []).map(f => el('label', { class: 'fila' }, [el('input', { type: 'checkbox', value: f.codigo, checked: (a.frentes_codigos || []).includes(f.codigo) }), f.codigo + ' ' + f.linea]));
  const m = modal({ titulo: 'Frentes de ' + a.nombre, cuerpo: cajas, acciones: [el('button', { class: 'btn primario', text: 'Guardar', onclick: async () => {
    const sel = cajas.map(c => c.querySelector('input')).filter(i => i.checked).map(i => i.value);
    try { await rpc('omc_agente_frentes_set', { p_agente: a.id, p_frentes: sel }); m.cerrar(); await recargar(); }
    catch (err) { toast('HQ rechaza: ' + err.message); }
  } })] });
}

function ficha(raiz, S, a) {
  raiz.append(el('a', { href: '#equipo', class: 'btn-enlace', text: '← equipo' }));
  raiz.append(el('section', { class: 'objetivo fila' }, [avatar(a), el('div', {}, [
    el('h1', { text: a.nombre }),
    el('p', { class: 'mudo', text: [a.id, a.depto, 'nivel ' + a.nivel, a.modelo, a.cuenta ? 'cuenta ' + a.cuenta + '@' : null, latido(a)].filter(Boolean).join(' · ') })])]));
  raiz.append(el('section', { class: 'seccion' }, [
    el('div', { class: 'fila' }, [el('h2', { text: 'Frentes' }), S.datos.rol === 'owner' ? el('button', { class: 'btn-enlace', text: 'editar', onclick: () => editarFrentes(a, S) }) : null]),
    ...(a.frentes_codigos || []).map(c => { const f = (S.datos.frentes || []).find(x => x.codigo === c); return el('a', { class: 'pill codigo', href: '#tablero/f/' + c, text: c + (f ? ' ' + f.linea : '') }); }),
    (a.frentes_codigos || []).length ? null : el('p', { class: 'mudo', text: 'sin frentes asignados' })]));
  const enc = filtrar(S.datos.encargos, { agente: a.id }).filter(e => e.estado !== 'hecho' && e.estado !== 'descartado');
  raiz.append(el('section', { class: 'seccion' }, [el('h2', { text: 'Encargos abiertos (' + enc.length + ')' }), ...enc.map(e => tarjetaEncargo(e))]));
  const acciones = [
    a.sesion_url ? el('a', { class: 'btn primario', href: a.sesion_url, text: 'Abrir sesión' }) : el('span', { class: 'mudo', text: 'sin sesión publicada' }),
    a.sesion_abierta ? el('a', { class: 'pill sesion', href: '#expedientes/' + a.sesion_abierta.expediente_id, text: 'en sesión: ' + a.sesion_abierta.nombre }) : null];
  raiz.append(el('section', { class: 'seccion fila' }, acciones));
}

export function render(raiz, S, arg) {
  const ags = (S.datos.agentes || []).filter(a => a.activo !== false).sort((x, y) => (x.nivel - y.nivel) || x.nombre.localeCompare(y.nombre));
  if (arg) { const a = ags.find(x => x.id === arg); if (a) return ficha(raiz, S, a); }
  const deptos = [...new Set(ags.map(a => a.depto))];
  for (const d of deptos) {
    raiz.append(el('section', { class: 'seccion' }, [el('h2', { text: d }), el('div', { class: 'frentes' }, ags.filter(a => a.depto === d).map(a => el('a', { class: 'tarjeta enlace fila agente', href: '#equipo/' + a.id }, [
      avatar(a),
      el('div', {}, [el('strong', { text: a.nombre }), el('p', { class: 'mudo', text: [(a.frentes_codigos || []).join(' ') || 'sin frentes', a.encargos_abiertos + ' abiertos', latido(a)].join(' · ') })]),
      a.sesion_abierta ? el('span', { class: 'pill sesion', text: 'en sesión' }) : null])))]));
  }
}
