// Operacion/Licitaciones (plan 3b, tanda 2a): el embudo de KPIs (detectadas -> analizadas -> por
// decidir -> en criba -> aprobadas -> presentadas -> adjudicadas -> contratadas, con descartadas y
// cerradas aparte) y la cola en criba de Guillem agrupada por elegible. Sin botones de accion: decidir
// una licitacion (Presentar/Estudiar/Descartar) vive en Reglas/Decisiones (vistas/decisiones.js), no
// aqui. La vista en si no gatea por S.datos.rol, pero el SQL si: omc_hq_v2 sirve 'licitaciones' y
// 'lic_resumen' solo con case when es_owner (schema-v2.sql), asi que un agente ve siempre "sin
// licitaciones" aqui (Minor 10, revision final del controlador: corregido el comentario, no la vista).
import { el, eur, fecha, urlSegura } from '../ui.js';
import { embudo, enCriba, porElegible, porDecidir, ordenCierre, estadoDe } from '../licitaciones.js';

const APROBADA_PRESENTADA = new Set(['Aprobada', 'Presentada']);

function mini(f) {
  return el('div', { class: 'mini' }, [
    el('div', { class: 'v' }, [f.n, f.eur > 0 ? el('small', { text: eur(f.eur) }) : null]),
    el('div', { class: 'l', text: f.nombre }),
  ]);
}

function tarjetaAprobada(l) {
  return el('a', { class: 'tarjeta enlace', href: '#reglas/decisiones' }, [
    el('div', { class: 'fila' }, [el('span', { class: 'pill codigo', text: l.expediente }), el('strong', { text: l.resumen_corto || l.objeto || l.expediente })]),
    el('p', { class: 'mudo', text: [l.importe ? eur(l.importe) + ' sin IVA' : null, l.cierre ? 'cierra ' + fecha(l.cierre) : null].filter(Boolean).join(' · ') }),
  ]);
}

function filaCriba(l) {
  const perfil = urlSegura(l.enlace);
  const texto = [l.expediente, l.resumen_corto || l.objeto, l.cierre ? 'cierra ' + fecha(l.cierre) : null, l.importe ? eur(l.importe) + ' sin IVA' : null].filter(Boolean).join(' · ');
  return el('p', {}, [texto, perfil ? el('a', { class: 'btn-enlace', href: perfil, target: '_blank', rel: 'noopener', text: 'Perfil' }) : null]);
}

function grupoCriba([nombre, rows], abierto) {
  return el('details', { class: 'grupo-criba', open: abierto }, [el('summary', { text: nombre + ' (' + rows.length + ')' }), ...rows.map(filaCriba)]);
}

export function render(raiz, S, arg, filtrosRuta = {}) {
  const d = S.datos || {};
  const lics = d.licitaciones || [];
  const resumen = d.lic_resumen || {};
  const kpis = d.kpis || {};
  if (!lics.length && !Object.keys(resumen).length) { raiz.append(el('p', { class: 'mudo', text: 'sin licitaciones' })); return; }

  // I1 (revision final): la fila pausadas solo se pinta cuando n > 0 (no siempre hay licitaciones
  // pausadas, y una mini a 0 no aporta nada en un embudo que ya tiene bastantes tiles).
  const filas = embudo(lics, kpis, resumen).filter(f => f.clave !== 'pausadas' || f.n > 0);
  const secEmbudo = el('section', { class: 'seccion' }, [
    el('h2', { text: 'Embudo' }),
    el('div', { class: 'embudo' }, filas.map(mini)),
    // Minor 1 (revision final): caption unica bajo el embudo en vez de repetir "sin IVA" en cada tile
    // (las tiles de 140px son demasiado estrechas para el sufijo sin partirse en dos lineas).
    el('p', { class: 'mudo', text: 'Importes sin IVA' }),
    el('p', { class: 'mudo' }, [el('a', { href: '#reglas/decisiones', text: porDecidir(lics).length + ' por decidir en Reglas/Decisiones' })]),
  ]);
  const tasa = kpis['lic.tasa_exito'], proximo = kpis['lic.proximo_cierre'], actualizado = kpis['lic.actualizado'];
  const bits = [];
  if (tasa?.valor != null) bits.push('tasa de éxito ' + tasa.valor + ' %');
  if (proximo?.texto) bits.push('próximo cierre ' + proximo.texto);
  if (bits.length) secEmbudo.append(el('p', { class: 'mudo', text: bits.join(' · ') }));
  if (actualizado?.texto) secEmbudo.append(el('p', { class: 'mudo', text: 'KPIs del barrido actualizados ' + actualizado.texto }));
  raiz.append(secEmbudo);

  const aprPres = lics.filter(l => APROBADA_PRESENTADA.has(estadoDe(l))).sort(ordenCierre);
  if (aprPres.length) raiz.append(el('section', { class: 'seccion' }, [el('h2', { text: 'Aprobadas y presentadas' }), ...aprPres.map(tarjetaAprobada)]));

  const criba = enCriba(lics);
  if (criba.length) {
    const grupos = porElegible(criba);
    raiz.append(el('section', { class: 'seccion' }, [el('h2', { text: 'En criba de Guillem (' + criba.length + ')' }), ...grupos.map((g, i) => grupoCriba(g, i === 0))]));
  }
}
