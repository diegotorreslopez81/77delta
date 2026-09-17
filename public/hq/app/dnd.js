// Arrastrar y soltar del tablero. accionAlSoltar es puro (node --test); habilitarArrastre toca DOM.
export function accionAlSoltar(origen, destino) {
  if (origen === destino) return { tipo: 'nada' };
  // T4-e (ruling del controlador): desde hecho a cualquier viva = reabrir, prevalece sobre destino.
  if (origen === 'hecho') return { tipo: 'reabrir' };
  if (destino === 'en_curso') return { tipo: 'tomar' };
  if (destino === 'hecho') return { tipo: 'hecho' };
  if (destino === 'bloqueado') return { tipo: 'bloquear' };
  if (origen === 'backlog' && destino === 'por_hacer') return { tipo: 'planificar' };
  if (origen === 'por_hacer' && destino === 'backlog') return { tipo: 'planificar' };
  return { tipo: 'reabrir' };
}
// Arrastre nativo (escritorio) y pulsación larga + menú (móvil, lo resuelve tablero.js con un botón "Mover a...").
export function habilitarArrastre(contenedor, { onSoltar }) {
  let idArrastrado = null;
  contenedor.addEventListener('dragstart', e => { const t = e.target.closest('[data-id]'); if (!t) return; idArrastrado = Number(t.dataset.id); t.classList.add('arrastrando'); e.dataTransfer.effectAllowed = 'move'; });
  contenedor.addEventListener('dragend', e => { e.target.closest?.('[data-id]')?.classList.remove('arrastrando'); contenedor.querySelectorAll('.columna.sobre').forEach(c => c.classList.remove('sobre')); });
  contenedor.addEventListener('dragover', e => { const col = e.target.closest('.columna'); if (!col) return; e.preventDefault(); col.classList.add('sobre'); });
  contenedor.addEventListener('dragleave', e => { e.target.closest?.('.columna')?.classList.remove('sobre'); });
  contenedor.addEventListener('drop', e => {
    const col = e.target.closest('.columna'); if (!col || idArrastrado == null) return; e.preventDefault(); col.classList.remove('sobre');
    const tarjetas = [...col.querySelectorAll('[data-id]')].filter(t => Number(t.dataset.id) !== idArrastrado);
    const y = e.clientY; let indice = tarjetas.findIndex(t => y < t.getBoundingClientRect().top + t.offsetHeight / 2); if (indice < 0) indice = tarjetas.length;
    onSoltar(idArrastrado, col.dataset.columna, indice); idArrastrado = null;
  });
}
