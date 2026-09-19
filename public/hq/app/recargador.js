// Fix ronda 2 (revision final, D3): coalesce de recargas sin DOM (testable con node --test). Antes,
// setInterval, visibilitychange y el `await recargar()` de cada escritura podian solapar dos cargas: la
// respuesta mas lenta ganaba y pisaba datos mas nuevos (caso real: expedientes.ficha() es async y un
// segundo render() entraba antes de que el primero terminara, duplicando la ficha en el DOM).
//
// crearRecargador(cargarFn, renderFn) devuelve una funcion `recargar()` que:
// - si no hay ninguna carga en curso, arranca una y la deja en `enVuelo`.
// - si ya hay una carga en curso, NO dispara un segundo `cargarFn()` de inmediato: marca `pendiente` y
//   devuelve la MISMA promesa que ya se habia devuelto (dedupe real, nunca dos fetch en paralelo).
// - al terminar un ciclo, si `pendiente` quedo marcado (alguien llamo a recargar() mientras esta carga
//   ya estaba en vuelo, tipicamente justo despues de escribir algo por RPC), encadena UNA carga mas
//   antes de resolver la promesa: quien hizo `await recargar()` tras la escritura recibe datos frescos
//   de verdad, no los que ya estaban en camino antes de escribir. `pendiente` es un booleano, nunca una
//   cola: por muchas llamadas que lleguen durante un ciclo, como mucho se encadena una carga extra.
export function crearRecargador(cargarFn, renderFn) {
  let enVuelo = null;
  let pendiente = false;
  return function recargar() {
    if (enVuelo) { pendiente = true; return enVuelo; }
    enVuelo = (async () => {
      try {
        do { pendiente = false; renderFn(await cargarFn()); } while (pendiente);
      } finally { enVuelo = null; }
    })();
    return enVuelo;
  };
}

// Brief 2021 (feedback iPhone, 19-sep): el tick de 60s y el visibilitychange de main.js no deben cerrar
// una tarjeta abierta ni borrar un textarea a medio escribir. Esta funcion es la decision pura ("¿disparo
// la recarga automatica ya, o la dejo pendiente porque hay un campo de texto enfocado?"), sin tocar DOM:
// quien llama (main.js) decide que hacer con recargaPendiente y con el listener de focusout que dispara
// la recarga en cuanto deja de haber un campo enfocado. Las recargas explicitas (tras escribir por RPC,
// boton manual HQ_RECARGAR) no pasan por aqui: llaman a recargar()/recargarYMarcar() directamente.
export function decidirRecargaAutomatica(escribiendo) {
  return { disparar: !escribiendo, pendiente: !!escribiendo };
}
