import test from 'node:test';
import assert from 'node:assert/strict';
import { crearRecargador, decidirRecargaAutomatica } from '../app/recargador.js';

// Sin DOM: crearRecargador no toca `document` ni `window`, solo coordina promesas (razonamiento igual
// que ui.test.mjs para las funciones que si usan document via el()).
function deferido() {
  let resolver;
  const promesa = new Promise(r => { resolver = r; });
  return { promesa, resolver };
}
const tick = () => new Promise(r => setTimeout(r, 0));

test('dos llamadas concurrentes comparten una sola carga en vuelo (dedupe, no dos fetch en paralelo)', async () => {
  const cargas = [deferido(), deferido()];
  let llamadas = 0;
  const cargarFn = () => { const d = cargas[llamadas]; llamadas++; return d.promesa; };
  const renders = [];
  const recargar = crearRecargador(cargarFn, d => renders.push(d));

  const p1 = recargar();
  const p2 = recargar();
  assert.equal(p1, p2, 'ambas llamadas devuelven la misma promesa');
  assert.equal(llamadas, 1, 'la segunda llamada no dispara un segundo fetch mientras la primera sigue en vuelo');

  cargas[0].resolver('datos-1');
  await tick();
  // La llamada que llego durante el vuelo (p2) encadena una carga extra al terminar la primera.
  assert.equal(llamadas, 2, 'una llamada durante el vuelo provoca una segunda carga al terminar la primera');
  assert.deepEqual(renders, ['datos-1']);

  cargas[1].resolver('datos-2');
  await p1;
  assert.deepEqual(renders, ['datos-1', 'datos-2'], 'la promesa compartida no resuelve hasta la carga fresca');
});

test('sin llamadas solapadas, cada recargar() hace exactamente una carga', async () => {
  let llamadas = 0;
  const cargarFn = async () => { llamadas++; return 'datos-' + llamadas; };
  const renders = [];
  const recargar = crearRecargador(cargarFn, d => renders.push(d));

  await recargar();
  await recargar();
  assert.equal(llamadas, 2);
  assert.deepEqual(renders, ['datos-1', 'datos-2']);
});

test('un error de cargarFn no deja la carga colgada: el siguiente recargar() vuelve a intentar', async () => {
  let llamadas = 0;
  const cargarFn = async () => { llamadas++; if (llamadas === 1) throw new Error('fallo de red'); return 'ok'; };
  const renders = [];
  const recargar = crearRecargador(cargarFn, d => renders.push(d));

  await assert.rejects(() => recargar(), /fallo de red/);
  await recargar();
  assert.equal(llamadas, 2);
  assert.deepEqual(renders, ['ok']);
});

// Brief 2021 (feedback iPhone, 19-sep): el tick de 60s y el visibilitychange de main.js no deben cerrar
// una tarjeta ni borrar un textarea a medio escribir. decidirRecargaAutomatica() extrae la decision pura
// ("¿disparo ya o dejo pendiente?") sin tocar DOM, para poder probarla sin arrancar toda la cadena de
// main.js. Las recargas explicitas (await recargar() tras una escritura, boton manual HQ_RECARGAR) no
// pasan por aqui: siguen llamando a recargar()/recargarYMarcar() directamente.
test('decidirRecargaAutomatica: sin nadie escribiendo, dispara ya y no deja nada pendiente', () => {
  assert.deepEqual(decidirRecargaAutomatica(false), { disparar: true, pendiente: false });
});
test('decidirRecargaAutomatica: con un campo de texto enfocado, no dispara y deja pendiente', () => {
  assert.deepEqual(decidirRecargaAutomatica(true), { disparar: false, pendiente: true });
});
