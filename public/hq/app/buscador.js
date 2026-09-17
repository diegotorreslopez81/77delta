// Buscador global (plan 3a): busca sobre el payload ya cargado, nunca llama a la BD. Sin DOM.
// Un número encuentra por id exacto en todas las fuentes; un texto busca sin acentos en id y título.
// Clientes y licitaciones se añaden en la tanda 2 cuando entren en el payload.
import { sinAcentos } from './estado.js';

const FUENTES = [
  ['encargo', d => d.encargos, e => e.id, e => e.texto, e => '#operacion/tablero/' + e.id],
  ['decision', d => d.pendientes, p => p.id, p => p.titulo, p => '#reglas/decisiones/' + p.id],
  ['expediente', d => d.expedientes, x => x.id, x => x.nombre, x => '#operacion/expedientes/' + x.id],
  ['agente', d => d.agentes, a => a.id, a => a.nombre, a => '#equipo/agente/' + a.id],
  ['frente', d => d.frentes, f => f.codigo, f => f.linea, f => '#operacion/tablero?frente=' + f.codigo],
];

export function buscar(datos, consulta, max = 12) {
  const q = sinAcentos(consulta).trim().replace(/^#/, '');
  if (!q) return [];
  const num = /^\d+$/.test(q) ? Number(q) : null;
  // Important 2 de la revisión final: reparto por fuente con un cupo propio para que un tipo con muchas
  // coincidencias (frecuente en encargos, la lista más larga) no agote el tope y deje fuera a los demás
  // (decisiones, expedientes, agentes...). Cada fuente aporta hasta `cupo`; lo que sobre de hueco se
  // rellena después con el resto de cada fuente, respetando el orden de FUENTES.
  const porTipo = [];
  for (const [tipo, lista, id, titulo, href] of FUENTES) {
    const hits = (lista(datos || {}) || [])
      .filter(x => num != null ? Number(id(x)) === num : sinAcentos([id(x), titulo(x)].join(' ')).includes(q))
      .map(x => ({ tipo, id: id(x), titulo: String(titulo(x) || ''), href: href(x) }));
    porTipo.push(hits);
  }
  const cupo = Math.max(2, Math.floor(max / FUENTES.length));
  return [...porTipo.flatMap(h => h.slice(0, cupo)), ...porTipo.flatMap(h => h.slice(cupo))].slice(0, max);
}
