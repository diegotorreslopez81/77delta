// Operacion/Licitaciones (plan 3b, tanda 2a): el embudo de KPIs (detectadas -> analizadas -> por
// decidir -> en criba -> aprobadas -> presentadas -> adjudicadas -> contratadas, con descartadas y
// cerradas aparte) y la cola en criba de Guillem agrupada por elegible. Sin botones de accion: decidir
// una licitacion (Presentar/Estudiar/Descartar) vive en Reglas/Decisiones (vistas/decisiones.js), no
// aqui. Owner y agente ven exactamente lo mismo: la vista no gatea por S.datos.rol.
import { el, eur, fecha, urlSegura } from '../ui.js';
import { embudo, enCriba, porElegible, porDecidir } from '../licitaciones.js';

// Mismo criterio de orden que ordenCierre() en licitaciones.js (no exportada de alli: aqui solo hace
// falta para Aprobadas y presentadas, una lista pequena que no necesita el resto de licitaciones.js).
function ordenCierre(a, b) {
  const ac = a.cierre, bc = b.cierre;
  if (ac == null && bc == null) return String(a.expediente || '').localeCompare(String(b.expediente || ''));
  if (ac == null) return 1;
  if (bc == null) return -1;
  return String(ac).localeCompare(String(bc)) || String(a.expediente || '').localeCompare(String(b.expediente || ''));
}

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

  const filas = embudo(lics, kpis, resumen);
  const secEmbudo = el('section', { class: 'seccion' }, [
    el('h2', { text: 'Embudo' }),
    el('div', { class: 'embudo' }, filas.map(mini)),
    el('p', { class: 'mudo' }, [el('a', { href: '#reglas/decisiones', text: porDecidir(lics).length + ' por decidir en Reglas/Decisiones' })]),
  ]);
  const tasa = kpis['lic.tasa_exito'], proximo = kpis['lic.proximo_cierre'], actualizado = kpis['lic.actualizado'];
  const bits = [];
  if (tasa?.valor != null) bits.push('tasa de éxito ' + tasa.valor + ' %');
  if (proximo?.texto) bits.push('próximo cierre ' + proximo.texto);
  if (bits.length) secEmbudo.append(el('p', { class: 'mudo', text: bits.join(' · ') }));
  if (actualizado?.texto) secEmbudo.append(el('p', { class: 'mudo', text: 'KPIs del barrido actualizados ' + actualizado.texto }));
  raiz.append(secEmbudo);

  const aprPres = lics.filter(l => APROBADA_PRESENTADA.has(l.estado)).sort(ordenCierre);
  if (aprPres.length) raiz.append(el('section', { class: 'seccion' }, [el('h2', { text: 'Aprobadas y presentadas' }), ...aprPres.map(tarjetaAprobada)]));

  const criba = enCriba(lics);
  if (criba.length) {
    const grupos = porElegible(criba);
    raiz.append(el('section', { class: 'seccion' }, [el('h2', { text: 'En criba de Guillem (' + criba.length + ')' }), ...grupos.map((g, i) => grupoCriba(g, i === 0))]));
  }
}
