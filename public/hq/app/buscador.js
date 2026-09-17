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
  const out = [];
  for (const [tipo, lista, id, titulo, href] of FUENTES) {
    for (const x of lista(datos || {}) || []) {
      const coincide = num != null ? Number(id(x)) === num : sinAcentos([id(x), titulo(x)].join(' ')).includes(q);
      if (!coincide) continue;
      out.push({ tipo, id: id(x), titulo: String(titulo(x) || ''), href: href(x) });
      if (out.length >= max) return out;
    }
  }
  return out;
}
