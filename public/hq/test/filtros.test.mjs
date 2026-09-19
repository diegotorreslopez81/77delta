// Funciones puras del sistema de filtros común (2.0.20). Las partes con DOM (la hoja, el FAB) se
// prueban desde las vistas, que ya montan su propio shim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizarValores, contarActivos, etiquetaActivo } from '../app/filtros.js';

const secciones = [
  { clave: 'estado', titulo: 'Estado', fija: true, opciones: [['nuevas', 'Nuevas', 3], ['decidir', 'Por decidir', 2]] },
  { clave: 'orden', titulo: 'Orden', defecto: 'cierre', opciones: [['cierre', 'Cierre'], ['importe', 'Importe']] },
  { clave: 'tipologia', titulo: 'Tipología', opciones: [['Estatal', 'Estatal'], ['Ayuntamiento', 'Ayuntamiento']] },
  { clave: 'texto', titulo: 'Buscar', libre: true },
];

test('normalizarValores: se queda con las claves y los valores del catalogo', () => {
  assert.deepEqual(normalizarValores({ estado: 'decidir', tipologia: 'Estatal' }, secciones), { estado: 'decidir', tipologia: 'Estatal' });
  assert.deepEqual(normalizarValores({ tipologia: 'Inventada', chorra: 'x', orden: '' }, secciones), {});
  assert.deepEqual(normalizarValores({ texto: 'lo que sea' }, secciones), { texto: 'lo que sea' }, 'la seccion libre acepta cualquier texto');
  assert.deepEqual(normalizarValores(null, secciones), {});
  assert.deepEqual(normalizarValores({ estado: 'decidir' }, null), {});
});

test('contarActivos: ni la seccion fija ni el valor por defecto cuentan', () => {
  assert.equal(contarActivos({ estado: 'decidir', orden: 'cierre' }, secciones), 0);
  assert.equal(contarActivos({ estado: 'decidir', orden: 'importe' }, secciones), 1);
  assert.equal(contarActivos({ estado: 'nuevas', orden: 'importe', tipologia: 'Estatal', texto: 'ia' }, secciones), 3);
  assert.equal(contarActivos({ tipologia: 'Inventada' }, secciones), 0);
});

test('etiquetaActivo: "Titulo: etiqueta" y null si el valor no vale', () => {
  assert.equal(etiquetaActivo('tipologia', 'Estatal', secciones), 'Tipología: Estatal');
  assert.equal(etiquetaActivo('orden', 'importe', secciones), 'Orden: Importe');
  assert.equal(etiquetaActivo('texto', 'girona', secciones), 'Buscar: girona');
  assert.equal(etiquetaActivo('tipologia', 'Inventada', secciones), null);
  assert.equal(etiquetaActivo('chorra', 'x', secciones), null);
});
