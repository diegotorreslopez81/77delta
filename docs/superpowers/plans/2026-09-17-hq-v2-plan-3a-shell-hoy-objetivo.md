# HQ v2 · Plan 3a (tanda 1): shell por áreas, Hoy y Dirección/Objetivo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sustituir la navegación por tabs de HQ v2 por un shell de seis áreas (barra superior con buscador y contador, menú lateral plegable y drawer móvil, rutas `#area/vista/id` con redirecciones), con las vistas Hoy y Dirección/Objetivo nuevas y las vistas existentes movidas a sus rutas, sin tocar la BD.

**Architecture:** SPA de módulos ES sin build en `public/hq/`. Se añaden tres módulos puros y testables con `node --test` (`rutas.js`, `buscador.js`, funciones nuevas en `estado.js`), un módulo de DOM (`shell.js`) y dos vistas (`hoy.js`, `objetivo.js`) que sustituyen a `inicio.js` y `plan.js`. `main.js` resuelve la ruta con `rutas.resolver`, redirige las rutas antiguas y llama a `render(raiz, S, arg, filtros)` de la vista. Payload `omc_hq_v2` sin cambios.

**Tech Stack:** JavaScript ES2022 en navegador (sin bundler), CSS con tokens de `tokens.css`, tests `node:test` (Node 22 en `~/.nvm/versions/node/v22.23.1/bin`), shim DOM mínimo en los tests de vistas (patrón de `test/decisiones.test.mjs`).

**Spec:** `docs/superpowers/specs/2026-09-17-hq-v2-plan-3-arquitectura-informacion-design.md` (secciones 1, 2, 3.1, 3.2, 7 "Tanda 1", 8). Spec madre: `docs/superpowers/specs/2026-09-16-hq-fuente-unica-cascada-design.md`. Contrato del payload: `docs/superpowers/specs/2026-09-16-hq-v2-contrato-omc_hq_v2.md`.

## Global Constraints

- MVP: cada vista es una lista o una ficha con campos que ya existen en el payload. Nada de tablas nuevas ni RPC nuevos en esta tanda. Si un dato no está en el payload, no se enseña.
- Cada dato tiene una casa: las tarjetas de encargo solo se detallan en `#operacion/tablero`; Hoy no es un tablero.
- Rutas `#area/vista/id`. Redirecciones obligatorias: `#inicio` → `#hoy`, `#plan` → `#direccion/objetivo`, `#tablero` → `#operacion/tablero`, `#tablero/f/A3` → `#operacion/tablero?frente=A3`, `#tablero/12` → `#operacion/tablero/12`, `#decisiones/N` → `#reglas/decisiones/N`, `#equipo` → `#equipo/organigrama`, `#equipo/ID` → `#equipo/agente/ID`, `#expedientes/ID` → `#operacion/expedientes/ID`, `?id=N` → `#reglas/decisiones/N`.
- Móvil primero: todo funciona a 390 px; menú lateral de 232 px (plegable a 56 px) desde 900 px, drawer con hamburguesa por debajo.
- Token de agente ve, owner actúa: nada nuevo de escritura; los botones existentes siguen condicionados a `S.datos.rol === 'owner'`.
- Toda URL que venga de la BD pasa por `urlSegura` antes de pintarse. Los hashes internos los construye la UI.
- Nunca la raya larga (em dash) en código, textos de UI, comentarios ni commits: guion normal "-". Español con acentos en textos de UI.
- Sin dependencias nuevas. Sin `innerHTML` con datos de la BD (usar `el()` y `enlazar()`).
- Tests: `cd /Users/diego/dev/77delta && PATH=$HOME/.nvm/versions/node/v22.23.1/bin:$PATH timeout 500 node --test public/hq/test/*.mjs`. Los 22 tests actuales siguen en verde en cada commit.
- No se publica desde las tareas: no tocar `HQ_VERSION` en `index.html`, no ejecutar `scripts/hq/version.sh`, no hacer push. Publica el controlador al cerrar la tanda.
- Los implementadores no ejecutan SQL ni tocan la BD (ni el tenant `pruebas`).
- Los ficheros modificados ajenos del checkout (`astro.config.mjs`, `scripts/gmail/gmail-agente.py`, `src/components/*.astro`, `src/layouts/Base.astro`) no se tocan ni se añaden a ningún commit. `git add` siempre con rutas explícitas.
- Commits con la atribución: última línea `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` y `Claude-Session: https://claude.ai/code/session_016CVmDqUV5diuD59mpZWRZv`.

---

## Mapa de ficheros

| Fichero | Acción | Responsabilidad |
|---|---|---|
| `public/hq/app/rutas.js` | crear | `AREAS` (menú), `resolver(hash, search)` con redirecciones. Puro. |
| `public/hq/test/rutas.test.mjs` | crear | tabla de rutas y redirecciones |
| `public/hq/app/buscador.js` | crear | `buscar(datos, consulta, max)` sobre el payload. Puro. |
| `public/hq/test/buscador.test.mjs` | crear | número y texto, tope 12 |
| `public/hq/app/estado.js` | modificar | `prorrateo`, `contador`, `semaforoCuentas`, `enCurso` |
| `public/hq/test/estado.test.mjs` | modificar | tests de las funciones nuevas |
| `public/hq/app/vistas/hoy.js` | crear (sustituye `inicio.js`) | Depende de ti, Tus peticiones, Sesiones abiertas |
| `public/hq/app/vistas/objetivo.js` | crear (sustituye `plan.js`) | cuadro de objetivo con prorrateo y bloques con frentes |
| `public/hq/app/vistas/inicio.js`, `plan.js` | borrar | |
| `public/hq/test/hoy.test.mjs`, `objetivo.test.mjs` | crear | render con shim DOM |
| `public/hq/app/shell.js` | crear | menú lateral, drawer, barra superior, buscador, copiar enlace |
| `public/hq/test/shell.test.mjs` | crear | montarMenu y marcarActiva con shim |
| `public/hq/index.html` | modificar | estructura del shell |
| `public/hq/app/hq.css` | modificar | layout con menú lateral, drawer, barra |
| `public/hq/app/main.js` | modificar | `resolver`, VISTAS por clave, `render(raiz, S, arg, filtros)` |
| `public/hq/app/tarjeta.js`, `detalle.js`, `vistas/tablero.js`, `expedientes.js`, `equipo.js` | modificar | hashes internos a las rutas nuevas |
| `public/hq/sw.js` | modificar | CACHE `hq-v14`, SHELL nuevo, `notificationclick` a `#hoy` y `#reglas/decisiones/N` |
| `scripts/hq/tests/verificar-hq-web.sh` | modificar | lista de ficheros y `hq-v14` |

---

### Task 1: `rutas.js`: áreas del menú y resolución de rutas con redirecciones

**Files:**
- Create: `public/hq/app/rutas.js`
- Test: `public/hq/test/rutas.test.mjs`

**Interfaces:**
- Consumes: nada.
- Produces: `export const AREAS: Array<{ id, nombre, vistas: Array<{ clave, nombre }> }>`; `export const CLAVES: Set<string>`; `export function resolver(hash: string, search: string): { clave: string, arg: string|undefined, filtros: Record<string,string>, canonico: string, redirigido: boolean }`. Una `clave` es `'hoy'` o `'area/vista'`; `canonico` es el hash completo (`'#operacion/tablero/12'` o `'#operacion/tablero?frente=A3'`).

- [ ] **Step 1: Escribir el test que falla**

```js
// public/hq/test/rutas.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { AREAS, CLAVES, resolver } from '../app/rutas.js';

test('AREAS tiene las seis áreas en orden y cada vista del menú es una clave válida', () => {
  assert.deepEqual(AREAS.map(a => a.id), ['hoy', 'direccion', 'operacion', 'equipo', 'recursos', 'reglas']);
  for (const a of AREAS) for (const v of a.vistas) assert.ok(CLAVES.has(v.clave), v.clave);
  assert.equal(AREAS.find(a => a.id === 'recursos').vistas.length, 0, 'Recursos llega en la tanda 3');
});

const casos = [
  // [hash, search, clave, arg, filtros, canonico, redirigido]
  ['', '', 'hoy', undefined, {}, '#hoy', true],
  ['#hoy', '', 'hoy', undefined, {}, '#hoy', false],
  ['#inicio', '', 'hoy', undefined, {}, '#hoy', true],
  ['#plan', '', 'direccion/objetivo', undefined, {}, '#direccion/objetivo', true],
  ['#direccion', '', 'direccion/objetivo', undefined, {}, '#direccion/objetivo', true],
  ['#tablero', '', 'operacion/tablero', undefined, {}, '#operacion/tablero', true],
  ['#tablero/f/A3', '', 'operacion/tablero', undefined, { frente: 'A3' }, '#operacion/tablero?frente=A3', true],
  ['#tablero/12', '', 'operacion/tablero', '12', {}, '#operacion/tablero/12', true],
  ['#operacion/tablero?frente=A1&agente=sales-motor', '', 'operacion/tablero', undefined, { frente: 'A1', agente: 'sales-motor' }, '#operacion/tablero?frente=A1&agente=sales-motor', false],
  ['#operacion', '', 'operacion/tablero', undefined, {}, '#operacion/tablero', true],
  ['#decisiones', '', 'reglas/decisiones', undefined, {}, '#reglas/decisiones', true],
  ['#decisiones/77', '', 'reglas/decisiones', '77', {}, '#reglas/decisiones/77', true],
  ['#reglas', '', 'reglas/decisiones', undefined, {}, '#reglas/decisiones', true],
  ['#equipo', '', 'equipo/organigrama', undefined, {}, '#equipo/organigrama', true],
  ['#equipo/sales-motor', '', 'equipo/agente', 'sales-motor', {}, '#equipo/agente/sales-motor', true],
  ['#equipo/agente/sales-motor', '', 'equipo/agente', 'sales-motor', {}, '#equipo/agente/sales-motor', false],
  ['#expedientes/9', '', 'operacion/expedientes', '9', {}, '#operacion/expedientes/9', true],
  ['#recursos', '', 'hoy', undefined, {}, '#hoy', true],
  ['#loquesea/x', '', 'hoy', undefined, {}, '#hoy', true],
  ['#tablero', '?id=55', 'reglas/decisiones', '55', {}, '#reglas/decisiones/55', true],
  ['#hoy', '?id=abc', 'hoy', undefined, {}, '#hoy', false],
];
for (const [hash, search, clave, arg, filtros, canonico, redirigido] of casos) {
  test('resolver ' + JSON.stringify(hash) + ' ' + JSON.stringify(search), () => {
    const r = resolver(hash, search);
    assert.equal(r.clave, clave); assert.equal(r.arg, arg); assert.deepEqual(r.filtros, filtros);
    assert.equal(r.canonico, canonico); assert.equal(r.redirigido, redirigido);
  });
}
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `cd /Users/diego/dev/77delta && PATH=$HOME/.nvm/versions/node/v22.23.1/bin:$PATH timeout 500 node --test public/hq/test/rutas.test.mjs`
Expected: FAIL con `Cannot find module '.../app/rutas.js'`.

- [ ] **Step 3: Implementar `rutas.js`**

```js
// public/hq/app/rutas.js
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
  if (VIEJAS[seg[0]]) {
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
```

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `cd /Users/diego/dev/77delta && PATH=$HOME/.nvm/versions/node/v22.23.1/bin:$PATH timeout 500 node --test public/hq/test/rutas.test.mjs`
Expected: PASS, 22 tests (1 de AREAS + 21 casos).

- [ ] **Step 5: Commit**

```bash
cd /Users/diego/dev/77delta && git add public/hq/app/rutas.js public/hq/test/rutas.test.mjs && git commit -m "feat(hq): rutas por área con redirecciones de la v2.0 (plan 3a T1)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016CVmDqUV5diuD59mpZWRZv"
```

---

### Task 2: `buscador.js`: búsqueda global sobre el payload

**Files:**
- Create: `public/hq/app/buscador.js`
- Test: `public/hq/test/buscador.test.mjs`

**Interfaces:**
- Consumes: `sinAcentos` de `public/hq/app/estado.js` (ya existe).
- Produces: `export function buscar(datos, consulta, max = 12): Array<{ tipo: 'encargo'|'decision'|'expediente'|'agente'|'frente', id: string|number, titulo: string, href: string }>`.

- [ ] **Step 1: Escribir el test que falla**

```js
// public/hq/test/buscador.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { buscar } from '../app/buscador.js';

const datos = {
  encargos: [{ id: 996, texto: 'Cobertura total de fuentes de licitaciones' }, { id: 12, texto: 'Otra cosa' }],
  pendientes: [{ id: 996, titulo: 'Aprobar gasto' }, { id: 635, titulo: 'Responder a Guillem sobre Cíclica' }],
  expedientes: [{ id: 9, nombre: 'Cíclica cupón IA' }],
  agentes: [{ id: 'sales-motor', nombre: 'Ariadna' }, { id: 'coo', nombre: 'Jordi-COO' }],
  frentes: [{ codigo: 'A1', linea: 'Detección y fuentes' }],
};
test('por número devuelve todo lo que tenga ese id, con su casa', () => {
  const r = buscar(datos, '#996');
  assert.deepEqual(r.map(x => [x.tipo, x.href]), [['encargo', '#operacion/tablero/996'], ['decision', '#reglas/decisiones/996']]);
  assert.equal(r[0].titulo, 'Cobertura total de fuentes de licitaciones');
});
test('por texto ignora acentos y mayúsculas y busca en título e id', () => {
  assert.deepEqual(buscar(datos, 'ciclica').map(x => x.tipo), ['decision', 'expediente']);
  assert.deepEqual(buscar(datos, 'ARIADNA').map(x => x.href), ['#equipo/agente/sales-motor']);
  assert.deepEqual(buscar(datos, 'sales-mot').map(x => x.tipo), ['agente']);
  assert.deepEqual(buscar(datos, 'a1').map(x => x.href), ['#operacion/tablero?frente=A1']);
});
test('vacío o sin resultados devuelve [], y respeta el tope', () => {
  assert.deepEqual(buscar(datos, ''), []); assert.deepEqual(buscar(datos, '   '), []); assert.deepEqual(buscar(datos, 'zzz'), []);
  const muchos = { encargos: Array.from({ length: 30 }, (_, i) => ({ id: i + 1, texto: 'repetido' })) };
  assert.equal(buscar(muchos, 'repetido').length, 12); assert.equal(buscar(muchos, 'repetido', 5).length, 5);
});
test('tolera payload sin listas', () => { assert.deepEqual(buscar({}, '996'), []); });
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `cd /Users/diego/dev/77delta && PATH=$HOME/.nvm/versions/node/v22.23.1/bin:$PATH timeout 500 node --test public/hq/test/buscador.test.mjs`
Expected: FAIL con `Cannot find module '.../app/buscador.js'`.

- [ ] **Step 3: Implementar `buscador.js`**

```js
// public/hq/app/buscador.js
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
```

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `cd /Users/diego/dev/77delta && PATH=$HOME/.nvm/versions/node/v22.23.1/bin:$PATH timeout 500 node --test public/hq/test/buscador.test.mjs`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
cd /Users/diego/dev/77delta && git add public/hq/app/buscador.js public/hq/test/buscador.test.mjs && git commit -m "feat(hq): buscador global sobre el payload (plan 3a T2)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016CVmDqUV5diuD59mpZWRZv"
```

---

### Task 3: `estado.js`: prorrateo del objetivo, contador de la barra, semáforo de cuentas y en curso

**Files:**
- Modify: `public/hq/app/estado.js` (añadir al final; no tocar lo existente)
- Test: `public/hq/test/estado.test.mjs` (añadir al final)

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `export function prorrateo(meta, horizonte, ahora = new Date()): number` (parte de la meta anual que tocaría a la fecha); `export function contador(datos): { texto: string, n: number, href: string }`; `export function semaforoCuentas(datos): null | { color: 'verde'|'ambar'|'rojo', pct: number, cuenta: string }`; `export function enCurso(encargos): Array`.

- [ ] **Step 1: Añadir los tests que fallan al final de `public/hq/test/estado.test.mjs`**

```js
import { prorrateo, contador, semaforoCuentas, enCurso } from '../app/estado.js';

test('prorrateo reparte la meta anual por día natural; año futuro 0, año pasado la meta entera', () => {
  // 2026-07-02 es el día 183 de 365: 300000 * 183 / 365 = 150410.9...
  assert.equal(Math.round(prorrateo(300000, 2026, new Date('2026-07-02T12:00:00Z'))), 150411);
  assert.equal(prorrateo(300000, 2026, new Date('2026-01-01T12:00:00Z')), Math.round(300000 / 365 * 100) / 100 === prorrateo(300000, 2026, new Date('2026-01-01T12:00:00Z')) ? prorrateo(300000, 2026, new Date('2026-01-01T12:00:00Z')) : prorrateo(300000, 2026, new Date('2026-01-01T12:00:00Z')));
  assert.equal(prorrateo(300000, 2026, new Date('2026-12-31T12:00:00Z')), 300000);
  assert.equal(prorrateo(3000000, 2027, new Date('2026-09-17T12:00:00Z')), 0);
  assert.equal(prorrateo(100, 2025, new Date('2026-09-17T12:00:00Z')), 100);
  assert.equal(prorrateo(null, 2026, new Date('2026-09-17T12:00:00Z')), 0);
});
test('contador: owner cuenta lo que depende de Diego; agente cuenta lo que está en curso', () => {
  const owner = { rol: 'owner', pendientes: [{ id: 1 }, { id: 2 }], encargos: [{ id: 9, estado: 'en_curso' }] };
  assert.deepEqual(contador(owner), { texto: 'Depende de ti', n: 2, href: '#hoy' });
  const agente = { rol: 'agente', pendientes: [], encargos: [{ id: 9, estado: 'en_curso' }, { id: 10, estado: 'hecho' }, { id: 11, estado: 'bloqueado_diego' }] };
  assert.deepEqual(contador(agente), { texto: 'En curso', n: 1, href: '#operacion/tablero' });
  assert.deepEqual(contador({ rol: 'owner' }), { texto: 'Depende de ti', n: 0, href: '#hoy' });
});
test('semaforoCuentas: null sin datos de cuentas; color por la cuenta más cargada', () => {
  assert.equal(semaforoCuentas({}), null); assert.equal(semaforoCuentas({ cuentas: [] }), null);
  assert.deepEqual(semaforoCuentas({ cuentas: [{ cuenta: 'diego@', pct_ventana: 40 }, { cuenta: 'team@', pct_ventana: 79 }] }), { color: 'verde', pct: 79, cuenta: 'team@' });
  assert.deepEqual(semaforoCuentas({ cuentas: [{ cuenta: 'diego@', pct_ventana: 80 }] }), { color: 'ambar', pct: 80, cuenta: 'diego@' });
  assert.deepEqual(semaforoCuentas({ cuentas: [{ cuenta: 'diego@', pct_ventana: 95 }, { cuenta: 'team@', pct_ventana: 10 }] }), { color: 'rojo', pct: 95, cuenta: 'diego@' });
});
test('enCurso deja solo estado en_curso', () => {
  assert.deepEqual(enCurso([{ id: 1, estado: 'en_curso' }, { id: 2, estado: 'encolado' }, { id: 3, estado: 'hecho' }]).map(e => e.id), [1]);
  assert.deepEqual(enCurso(undefined), []);
});
```

Nota para el implementador: la segunda aserción de `prorrateo` del bloque anterior es redundante y confusa; sustitúyela por esta única línea antes de ejecutar:

```js
  assert.ok(Math.abs(prorrateo(300000, 2026, new Date('2026-01-01T12:00:00Z')) - 300000 / 365) < 0.01);
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `cd /Users/diego/dev/77delta && PATH=$HOME/.nvm/versions/node/v22.23.1/bin:$PATH timeout 500 node --test public/hq/test/estado.test.mjs`
Expected: FAIL con `does not provide an export named 'prorrateo'`.

- [ ] **Step 3: Añadir al final de `public/hq/app/estado.js`**

```js

// Plan 3a (tanda 1): funciones puras del shell y de Dirección/Objetivo.
// prorrateo: parte de la meta anual que tocaría a la fecha, por día natural (Europe/Madrid no importa:
// se usa la fecha UTC del instante, la diferencia de un día en el cambio de año es irrelevante aquí).
export function prorrateo(meta, horizonte, ahora = new Date()) {
  const m = Number(meta) || 0, y = ahora.getUTCFullYear();
  if (horizonte > y) return 0;
  if (horizonte < y) return m;
  const inicio = Date.UTC(y, 0, 1), fin = Date.UTC(y + 1, 0, 1);
  const dias = Math.round((fin - inicio) / 864e5), dia = Math.floor((ahora.getTime() - inicio) / 864e5) + 1;
  return dia >= dias ? m : m * dia / dias;
}
export function enCurso(encargos) { return (encargos || []).filter(e => e.estado === 'en_curso'); }
// contador de la barra superior. El token de agente no sabe quién es (omc_hq_v2 no expone la identidad,
// ver T4-c), así que cuenta lo que hay en curso en vez de "sus" tarjetas.
export function contador(datos) {
  if (datos?.rol === 'owner') return { texto: 'Depende de ti', n: (datos.pendientes || []).length, href: '#hoy' };
  return { texto: 'En curso', n: enCurso(datos?.encargos).length, href: '#operacion/tablero' };
}
// semáforo de cuentas: `cuentas` entra en el payload en la tanda 3 (omc_cuentas_estado); hasta entonces null
// y la barra no pinta nada. Umbrales de la spec 2.1: verde < 80, ámbar 80-94, rojo >= 95.
export function semaforoCuentas(datos) {
  const cs = (datos?.cuentas || []).filter(c => c && c.pct_ventana != null);
  if (!cs.length) return null;
  const peor = cs.reduce((a, b) => (Number(b.pct_ventana) > Number(a.pct_ventana) ? b : a));
  const pct = Number(peor.pct_ventana);
  return { color: pct >= 95 ? 'rojo' : pct >= 80 ? 'ambar' : 'verde', pct, cuenta: peor.cuenta };
}
```

- [ ] **Step 4: Ejecutar toda la suite y ver que pasa**

Run: `cd /Users/diego/dev/77delta && PATH=$HOME/.nvm/versions/node/v22.23.1/bin:$PATH timeout 500 node --test public/hq/test/*.mjs`
Expected: PASS, 0 fallos (22 previos + 22 de rutas + 4 de buscador + 4 nuevos = 52).

- [ ] **Step 5: Commit**

```bash
cd /Users/diego/dev/77delta && git add public/hq/app/estado.js public/hq/test/estado.test.mjs && git commit -m "feat(hq): prorrateo, contador, semáforo de cuentas y enCurso en estado.js (plan 3a T3)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016CVmDqUV5diuD59mpZWRZv"
```

---

### Task 4: vistas `hoy.js` y `objetivo.js` (sustituyen a `inicio.js` y `plan.js`)

**Files:**
- Create: `public/hq/app/vistas/hoy.js`
- Create: `public/hq/app/vistas/objetivo.js`
- Delete: `public/hq/app/vistas/inicio.js`, `public/hq/app/vistas/plan.js`
- Test: `public/hq/test/hoy.test.mjs`, `public/hq/test/objetivo.test.mjs`

**Interfaces:**
- Consumes: `el, fecha, eur` de `ui.js`; `semana, enCurso, prorrateo` de `estado.js`; `tarjetaEncargo` de `tarjeta.js` (firma `tarjetaEncargo(e, { onAbrir })`, devuelve un nodo `.tarjeta.encargo`).
- Produces: `export function render(raiz, S, arg, filtros)` en cada vista (misma firma que el resto; `arg` y `filtros` se ignoran aquí). `main.js` (Task 6) importa `hoy` y `objetivo` en vez de `inicio` y `plan`. Hasta la Task 6, `main.js` sigue importando `inicio.js` y `plan.js`: en esta tarea NO se borran todavía esos dos ficheros ni se toca `main.js`; el borrado va en la Task 6.

- [ ] **Step 1: Escribir los tests que fallan**

```js
// public/hq/test/hoy.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

// hoy.js importa tarjeta.js, que importa ui.js: solo tocan `document` dentro de funciones, pero se
// monta el shim antes del import dinámico por el mismo motivo que decisiones.test.mjs (cadena de imports).
function crearNodo(tag) {
  const n = {
    tag, nodeType: 1, children: [], attrs: {}, className: '', _text: '', listeners: {}, parent: null,
    setAttribute(k, v) { this.attrs[k] = v; }, addEventListener(ev, fn) { (this.listeners[ev] ||= []).push(fn); },
    append(...kids) { for (const k of kids) { if (k == null) continue; k.parent = this; this.children.push(k); } },
    prepend(...kids) { for (const k of kids.reverse()) { if (k == null) continue; k.parent = this; this.children.unshift(k); } },
    remove() { if (this.parent) { const i = this.parent.children.indexOf(this); if (i >= 0) this.parent.children.splice(i, 1); this.parent = null; } },
    get textContent() { return this.children.length ? this.children.map(c => (c.nodeType === 3 ? c.data : c.textContent)).join('') : this._text; },
    set textContent(v) { this._text = v; this.children = []; },
    set innerHTML(v) { this.children = []; }, get innerHTML() { return ''; },
    querySelector() { return null; }, querySelectorAll() { return []; },
  };
  return n;
}
globalThis.document = { createElement: t => crearNodo(t), createTextNode: d => ({ nodeType: 3, data: d }), getElementById: () => crearNodo('div'), body: crearNodo('body'), addEventListener() {} };
globalThis.location = { hash: '', search: '', pathname: '/hq/' }; globalThis.history = { replaceState() {} }; globalThis.window = { addEventListener() {} }; globalThis.HQ_VERSION = { v: 'test' };
if (typeof globalThis.localStorage === 'undefined') { const mem = new Map(); globalThis.localStorage = { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) }; }

const { render } = await import('../app/vistas/hoy.js');
const hoyIso = new Date().toISOString();
const datos = {
  rol: 'owner',
  pendientes: [{ id: 635, titulo: 'Responder a Guillem', agente: 'sales-licita', vence: null }],
  encargos: [
    { id: 996, texto: 'Fuentes', origen: 'Diego 17-sep', fecha: hoyIso, estado: 'encolado', rojo: false, agente: 'sales-motor' },
    { id: 12, texto: 'Vieja', origen: 'Diego 1-ago', fecha: '2026-08-01T10:00:00Z', estado: 'en_curso', rojo: true, agente: 'coo' },
    { id: 13, texto: 'De otro', origen: 'coo', fecha: hoyIso, estado: 'en_curso', rojo: false, agente: 'coo' },
  ],
  sesiones: [{ id: 1, expediente_id: 9, nombre: 'Cíclica', agente: 'cupones', estado: 'abierta', abierta: hoyIso }],
};
const secciones = raiz => raiz.children.filter(c => c.tag === 'section');
const titulos = raiz => secciones(raiz).map(s => s.children[0].textContent);
const buscarNodos = (n, pred, out = []) => { if (n.nodeType === 1) { if (pred(n)) out.push(n); n.children.forEach(c => buscarNodos(c, pred, out)); } return out; };

test('owner: tres bloques en orden, sin tarjetas ajenas ni parados', () => {
  const raiz = crearNodo('main'); render(raiz, { datos });
  assert.deepEqual(titulos(raiz), ['Depende de ti', 'Tus peticiones de la semana', 'Sesiones abiertas']);
  const enlaces = buscarNodos(raiz, n => n.tag === 'a').map(a => a.attrs.href);
  assert.ok(enlaces.includes('#reglas/decisiones/635'));
  assert.ok(enlaces.includes('#operacion/expedientes/9'));
  const ids = buscarNodos(raiz, n => n.className.includes('encargo')).map(t => t.attrs['data-id'] || t.textContent);
  assert.equal(ids.length, 1, 'solo el encargo #996 (de Diego, esta semana)');
  assert.ok(!raiz.textContent.includes('Parados'), 'Hoy no lista parados: viven en Peticiones (tanda 2)');
  assert.ok(!raiz.textContent.includes('Objetivo'), 'el objetivo vive en Dirección');
});
test('agente: "Tus tarjetas" con lo en curso, sin peticiones', () => {
  const raiz = crearNodo('main'); render(raiz, { datos: { ...datos, rol: 'agente', pendientes: [] } });
  assert.deepEqual(titulos(raiz), ['Tus tarjetas', 'Sesiones abiertas']);
  assert.equal(buscarNodos(raiz, n => n.className.includes('encargo')).length, 2);
});
test('sin datos en las listas pinta los textos vacíos', () => {
  const raiz = crearNodo('main'); render(raiz, { datos: { rol: 'owner' } });
  assert.ok(raiz.textContent.includes('nada pendiente')); assert.ok(raiz.textContent.includes('sin peticiones tuyas en 7 días')); assert.ok(raiz.textContent.includes('ninguna'));
});
```

```js
// public/hq/test/objetivo.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
function crearNodo(tag) {
  return { tag, nodeType: 1, children: [], attrs: {}, className: '', _text: '', parent: null,
    setAttribute(k, v) { this.attrs[k] = v; }, addEventListener() {},
    append(...kids) { for (const k of kids) { if (k == null) continue; k.parent = this; this.children.push(k); } },
    get textContent() { return this.children.length ? this.children.map(c => (c.nodeType === 3 ? c.data : c.textContent)).join('') : this._text; },
    set textContent(v) { this._text = v; this.children = []; } };
}
globalThis.document = { createElement: t => crearNodo(t), createTextNode: d => ({ nodeType: 3, data: d }) };
const { render } = await import('../app/vistas/objetivo.js');
const { derivar } = await import('../app/estado.js');
const buscarNodos = (n, pred, out = []) => { if (n.nodeType === 1) { if (pred(n)) out.push(n); n.children.forEach(c => buscarNodos(c, pred, out)); } return out; };
const datos = {
  objetivos: [{ horizonte: 2026, titulo: 'Contratado a 31 de diciembre', meta: 300000, unidad: 'EUR', contratado_eur: 20000, presentado_eur: 90000 }, { horizonte: 2027, titulo: 'Contratado', meta: 3000000, unidad: 'EUR', contratado_eur: 0, presentado_eur: 0 }],
  bloques: [{ id: 1, letra: 'A', nombre: 'Licitaciones', meta_eur: 200000, encargos_abiertos: 3, orden: 1 }],
  frentes: [{ id: 1, codigo: 'A1', linea: 'Detección y fuentes', kpi: 'Fuentes cubiertas', valor_actual: 0, meta: 17, unidad: 'CCAA', responsable: 'Ariadna', bloque_letra: 'A', encargos_abiertos: 2 }],
  encargos: [],
};
test('cuadro por objetivo con contratado, presentado, meta a la fecha y desviación', () => {
  const raiz = crearNodo('main'); render(raiz, { datos, derivado: derivar(datos) }, undefined, {}, new Date('2026-07-02T12:00:00Z'));
  const cuadros = raiz.children.filter(c => c.className.includes('objetivo'));
  assert.equal(cuadros.length, 2);
  const t = cuadros[0].textContent;
  assert.ok(t.includes('20.000 EUR'), 'contratado'); assert.ok(t.includes('90.000 EUR'), 'presentado');
  assert.ok(t.includes('150.411 EUR'), 'meta a la fecha (300000 * 183 / 365)'); assert.ok(t.includes('-130.411 EUR'), 'desviación');
  assert.ok(cuadros[1].textContent.includes('0 EUR'));
});
test('los frentes enlazan al tablero filtrado por la ruta nueva', () => {
  const raiz = crearNodo('main'); render(raiz, { datos, derivado: derivar(datos) });
  const hrefs = buscarNodos(raiz, n => n.tag === 'a').map(a => a.attrs.href);
  assert.deepEqual(hrefs, ['#operacion/tablero?frente=A1']);
  assert.ok(raiz.textContent.includes('Fuentes cubiertas: 0 / 17 CCAA'));
});
```

- [ ] **Step 2: Ejecutar y ver que fallan**

Run: `cd /Users/diego/dev/77delta && PATH=$HOME/.nvm/versions/node/v22.23.1/bin:$PATH timeout 500 node --test public/hq/test/hoy.test.mjs public/hq/test/objetivo.test.mjs`
Expected: FAIL con `Cannot find module '.../vistas/hoy.js'` (y objetivo.js).

- [ ] **Step 3: Escribir `hoy.js`**

```js
// public/hq/app/vistas/hoy.js
// Hoy (plan 3a): ¿qué necesito hoy? Tres bloques y nada más. No es un tablero: las tarjetas viven en
// #operacion/tablero y el objetivo en #direccion/objetivo. Sustituye a inicio.js.
import { el, fecha } from '../ui.js';
import { semana, enCurso } from '../estado.js';
import { tarjetaEncargo } from '../tarjeta.js';

function bloque(titulo, kids, vacio) { return el('section', { class: 'seccion' }, [el('h2', { text: titulo }), ...(kids.length ? kids : [el('p', { class: 'mudo', text: vacio })])]); }

export function render(raiz, S) {
  const d = S.datos || {};
  if (d.rol === 'owner') {
    const pend = d.pendientes || [];
    raiz.append(bloque('Depende de ti', pend.slice(0, 20).map(p => el('a', { class: 'tarjeta enlace', href: '#reglas/decisiones/' + p.id }, [
      el('p', { class: 'titulo', text: p.titulo }), el('p', { class: 'mudo', text: [p.agente, p.vence ? 'vence ' + fecha(p.vence, { hora: true }) : null].filter(Boolean).join(' · ') })])), 'nada pendiente'));
    if (pend.length > 20) raiz.append(el('a', { class: 'btn-enlace', href: '#reglas/decisiones', text: 'ver las ' + pend.length }));
    const s = semana(d.encargos);
    raiz.append(bloque('Tus peticiones de la semana', [...s.parados, ...s.en_curso].map(e => tarjetaEncargo(e)).concat(
      s.hechos.length ? [el('p', { class: 'mudo', text: 'hechos: ' + s.hechos.map(e => '#' + e.id).join(', ') })] : []), 'sin peticiones tuyas en 7 días'));
  } else {
    // El token de agente no conoce su identidad en el payload (T4-c): se enseña lo que está en curso.
    raiz.append(bloque('Tus tarjetas', enCurso(d.encargos).map(e => tarjetaEncargo(e)), 'nada en curso'));
  }
  const ses = (d.sesiones || []).filter(x => x.estado !== 'cerrada');
  raiz.append(bloque('Sesiones abiertas', ses.map(x => el('a', { class: 'tarjeta enlace', href: '#operacion/expedientes/' + x.expediente_id }, [
    el('p', { class: 'titulo', text: x.nombre + ' con ' + x.agente }), el('p', { class: 'mudo', text: x.estado + ' · ' + fecha(x.abierta || x.created_at, { hora: true }) })])), 'ninguna'));
}
```

Comprueba en `public/hq/app/tarjeta.js` cómo se pinta la tarjeta: si el nodo raíz no lleva `data-id`, añade `'data-id': e.id` a sus atributos (el test de Hoy cuenta tarjetas por la clase `encargo`, no por `data-id`, así que esto es opcional; no cambies nada más de `tarjeta.js` en esta tarea).

- [ ] **Step 4: Escribir `objetivo.js`**

```js
// public/hq/app/vistas/objetivo.js
// Dirección/Objetivo (plan 3a): ¿vamos bien? Cuadro por objetivo (contratado, presentado, meta a la
// fecha y desviación) y los bloques con sus frentes y su KPI. Única casa del plan estratégico.
// Sustituye a plan.js. La edición de KPI y líneas sigue en hq.py plan-linea.
import { el, eur } from '../ui.js';
import { prorrateo } from '../estado.js';

function metaTexto(o) { return (!o.unidad || o.unidad === 'EUR') ? eur(o.meta) : o.meta + ' ' + o.unidad; }
function dato(etiqueta, valor, clase) { return el('div', { class: 'dato' + (clase ? ' ' + clase : '') }, [el('span', { class: 'mudo', text: etiqueta }), el('strong', { text: valor })]); }

export function render(raiz, S, arg, filtros, ahora = new Date()) {
  const d = S.derivado || { objetivos: [], bloques: [] };
  for (const o of d.objetivos) {
    const meta = Number(o.meta) || 0, contratado = Number(o.contratado_eur) || 0, alaFecha = prorrateo(meta, o.horizonte, ahora), desv = contratado - alaFecha;
    raiz.append(el('section', { class: 'objetivo' }, [
      el('p', { class: 'mudo', text: 'Objetivo ' + o.horizonte + ' · ' + (o.titulo || '') }),
      el('h1', { text: eur(contratado) + ' de ' + metaTexto(o) }),
      el('div', { class: 'datos' }, [
        dato('presentado', eur(o.presentado_eur)), dato('meta a la fecha', eur(Math.round(alaFecha))),
        dato('desviación', (desv < 0 ? '-' : '+') + eur(Math.abs(Math.round(desv))), desv < 0 ? 'mal' : 'bien')]),
      el('div', { class: 'barra' }, [el('i', { style: 'width:' + Math.min(100, 100 * contratado / (meta || 1)) + '%' })])]));
  }
  for (const b of d.bloques) raiz.append(el('section', { class: 'bloque' }, [
    el('div', { class: 'fila bloque-cab' }, [el('span', { class: 'pill codigo', text: b.letra }), el('h2', { text: b.nombre }), el('span', { class: 'mudo', text: (b.meta_eur ? eur(b.meta_eur) + ' · ' : '') + b.abiertos + ' abiertos' + (b.rojos ? ' · ' + b.rojos + ' rojos' : '') })]),
    el('div', { class: 'frentes' }, b.frentes.map(f => el('a', { class: 'tarjeta frente enlace' + (f.encargos_abiertos ? '' : ' vacio'), href: '#operacion/tablero?frente=' + f.codigo }, [
      el('div', { class: 'fila' }, [el('span', { class: 'pill codigo', text: f.codigo }), el('strong', { text: f.linea })]),
      el('p', { class: 'mudo', text: [f.responsable, f.kpi ? f.kpi + ': ' + (f.valor_actual ?? '?') + (f.meta != null ? ' / ' + f.meta : '') + (f.unidad ? ' ' + f.unidad : '') : null, f.encargos_abiertos + ' abiertos'].filter(Boolean).join(' · ') })])))]));
  if (!d.bloques.length) raiz.append(el('p', { class: 'mudo', text: 'Sin bloques en el plan.' }));
}
```

- [ ] **Step 5: Ejecutar y ver que pasan**

Run: `cd /Users/diego/dev/77delta && PATH=$HOME/.nvm/versions/node/v22.23.1/bin:$PATH timeout 500 node --test public/hq/test/*.mjs`
Expected: PASS, 0 fallos (57 tests). Si `hoy.test.mjs` falla en el recuento de tarjetas por la clase, mira `tarjeta.js`: la clase del nodo raíz debe contener `encargo` (es la que usa el tablero para el arrastre); si no la tuviera, cuenta por `data-id` y añade el atributo como se indica en el paso 3.

- [ ] **Step 6: Commit**

```bash
cd /Users/diego/dev/77delta && git add public/hq/app/vistas/hoy.js public/hq/app/vistas/objetivo.js public/hq/test/hoy.test.mjs public/hq/test/objetivo.test.mjs public/hq/app/tarjeta.js && git commit -m "feat(hq): vistas Hoy y Dirección/Objetivo (plan 3a T4)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016CVmDqUV5diuD59mpZWRZv"
```

(Si no tocaste `tarjeta.js`, quítalo del `git add`.)

---

### Task 5: `shell.js`: menú lateral, drawer, barra superior y buscador

**Files:**
- Create: `public/hq/app/shell.js`
- Test: `public/hq/test/shell.test.mjs`

**Interfaces:**
- Consumes: `AREAS` de `rutas.js`; `el, toast` de `ui.js`; `buscar` de `buscador.js`; `contador, semaforoCuentas` de `estado.js`.
- Produces: `export function montarMenu(nav): { enlaces: Map<clave, a>, areas: Map<areaId, div> }`; `export function marcarActiva(clave)`; `export function pintarBarra(datos)`; `export function cablearShell()` (hamburguesa, velo, plegar, buscador, copiar enlace); `export function cerrarMenu()`. `main.js` (Task 6) llama a `montarMenu(document.getElementById('nav'))` y `cablearShell()` una vez, y a `marcarActiva(clave)` y `pintarBarra(S.datos)` en cada `render`. Ids del DOM que `shell.js` espera en `index.html` (Task 6): `hamburguesa`, `velo`, `plegar`, `busqueda`, `resultados`, `contador`, `semaforo`, `nav`.

- [ ] **Step 1: Escribir el test que falla**

```js
// public/hq/test/shell.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
function crearNodo(tag) {
  return { tag, nodeType: 1, children: [], attrs: {}, className: '', _text: '', parent: null, dataset: {}, hidden: false,
    classList: { toggle(c, on) { const s = new Set(this._n.className.split(' ').filter(Boolean)); on ? s.add(c) : s.delete(c); this._n.className = [...s].join(' '); return on; }, contains(c) { return this._n.className.split(' ').includes(c); }, add(c) { this.toggle(c, true); }, remove(c) { this.toggle(c, false); } },
    setAttribute(k, v) { this.attrs[k] = v; if (k.startsWith('data-')) this.dataset[k.slice(5)] = v; }, addEventListener() {},
    append(...kids) { for (const k of kids) { if (k == null) continue; k.parent = this; this.children.push(k); } },
    get textContent() { return this.children.length ? this.children.map(c => (c.nodeType === 3 ? c.data : c.textContent)).join('') : this._text; },
    set textContent(v) { this._text = v; this.children = []; }, set innerHTML(v) { this.children = []; }, get innerHTML() { return ''; } };
}
const nodos = {};
globalThis.document = { createElement: t => { const n = crearNodo(t); n.classList._n = n; return n; }, createTextNode: d => ({ nodeType: 3, data: d }), getElementById: id => (nodos[id] ||= document.createElement('div')), body: null, addEventListener() {} };
document.body = document.createElement('body');
globalThis.location = { hash: '', search: '', pathname: '/hq/', href: 'https://77delta.com/hq/#hoy' }; globalThis.history = { replaceState() {} }; globalThis.window = { addEventListener() {} }; globalThis.HQ_VERSION = { v: 'test' };
if (typeof globalThis.localStorage === 'undefined') { const mem = new Map(); globalThis.localStorage = { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) }; }
globalThis.matchMedia = () => ({ matches: false });

const { montarMenu, marcarActiva, pintarBarra } = await import('../app/shell.js');

test('montarMenu pinta las seis áreas, un enlace por vista y "pronto" en Recursos', () => {
  const nav = document.createElement('nav'); const m = montarMenu(nav);
  assert.equal(nav.children.length, 6); assert.equal(m.enlaces.size, 6);
  assert.equal(m.enlaces.get('operacion/tablero').attrs.href, '#operacion/tablero');
  assert.equal(m.enlaces.get('hoy').attrs['data-inicial'], 'H');
  assert.ok(m.areas.get('recursos').textContent.includes('pronto'));
});
test('marcarActiva marca el enlace y abre su área; la ficha de agente activa Equipo', () => {
  const nav = document.createElement('nav'); const m = montarMenu(nav);
  marcarActiva('operacion/tablero');
  assert.ok(m.enlaces.get('operacion/tablero').classList.contains('activa')); assert.ok(!m.enlaces.get('hoy').classList.contains('activa'));
  assert.ok(m.areas.get('operacion').classList.contains('abierta')); assert.ok(!m.areas.get('hoy').classList.contains('abierta'));
  marcarActiva('equipo/agente');
  assert.ok(m.areas.get('equipo').classList.contains('abierta')); assert.ok(!m.enlaces.get('operacion/tablero').classList.contains('activa'));
});
test('pintarBarra: contador con número y href; semáforo oculto sin cuentas y con color si las hay', () => {
  pintarBarra({ rol: 'owner', pendientes: [{ id: 1 }, { id: 2 }] });
  const c = document.getElementById('contador'), s = document.getElementById('semaforo');
  assert.equal(c.textContent, 'Depende de ti 2'); assert.equal(c.attrs.href, '#hoy'); assert.equal(c.hidden, false); assert.equal(s.hidden, true);
  pintarBarra({ rol: 'owner', pendientes: [], cuentas: [{ cuenta: 'team@', pct_ventana: 96 }] });
  assert.equal(c.hidden, true, 'a cero se oculta'); assert.equal(s.hidden, false); assert.ok(s.className.includes('rojo')); assert.equal(s.attrs.title, 'team@ al 96 % de la ventana');
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `cd /Users/diego/dev/77delta && PATH=$HOME/.nvm/versions/node/v22.23.1/bin:$PATH timeout 500 node --test public/hq/test/shell.test.mjs`
Expected: FAIL con `Cannot find module '.../app/shell.js'`.

- [ ] **Step 3: Escribir `shell.js`**

```js
// public/hq/app/shell.js
// Shell de HQ v2 (plan 3a): menú lateral por áreas (plegable desde 900 px, drawer por debajo), barra
// superior (contador, semáforo de cuentas, buscador global) y "copiar enlace". Solo DOM del armazón;
// las vistas no saben que existe. Ids esperados en index.html: nav, hamburguesa, velo, plegar,
// busqueda, resultados, contador, semaforo.
import { AREAS } from './rutas.js';
import { el, toast } from './ui.js';
import { buscar } from './buscador.js';
import { contador, semaforoCuentas } from './estado.js';

const ref = { enlaces: new Map(), areas: new Map() };
const $ = id => document.getElementById(id);

export function montarMenu(nav) {
  nav.innerHTML = ''; ref.enlaces.clear(); ref.areas.clear();
  for (const a of AREAS) {
    const div = el('div', { class: 'area', 'data-area': a.id }, [el('p', { class: 'area-titulo', text: a.nombre }),
      ...(a.vistas.length ? a.vistas.map(v => { const e = el('a', { href: '#' + v.clave, 'data-clave': v.clave, 'data-inicial': v.nombre[0], text: v.nombre }); ref.enlaces.set(v.clave, e); return e; })
        : [el('p', { class: 'mudo pronto', text: 'pronto' })])]);
    ref.areas.set(a.id, div); nav.append(div);
  }
  return ref;
}
export function marcarActiva(clave) {
  const area = clave.split('/')[0];
  for (const [k, e] of ref.enlaces) e.classList.toggle('activa', k === clave);
  for (const [id, d] of ref.areas) d.classList.toggle('abierta', id === area);
}
export function pintarBarra(datos) {
  const c = contador(datos), nodo = $('contador');
  nodo.textContent = c.texto + ' ' + c.n; nodo.setAttribute('href', c.href); nodo.hidden = !c.n;
  const s = semaforoCuentas(datos), sem = $('semaforo');
  sem.hidden = !s;
  if (s) { sem.className = 'semaforo ' + s.color; sem.setAttribute('title', s.cuenta + ' al ' + s.pct + ' % de la ventana'); }
}
export function cerrarMenu() { document.body.classList.remove('menu-abierto'); $('hamburguesa').setAttribute('aria-expanded', 'false'); }
function abrirMenu() { document.body.classList.add('menu-abierto'); $('hamburguesa').setAttribute('aria-expanded', 'true'); }

export function cablearShell() {
  $('hamburguesa').addEventListener('click', () => (document.body.classList.contains('menu-abierto') ? cerrarMenu() : abrirMenu()));
  $('velo').addEventListener('click', cerrarMenu);
  // Plegado del menú (solo escritorio). Se recuerda en localStorage hq_menu ('plegado' o 'abierto').
  let plegado = false; try { plegado = localStorage.getItem('hq_menu') === 'plegado'; } catch {}
  document.body.classList.toggle('menu-plegado', plegado);
  $('plegar').addEventListener('click', () => { const p = !document.body.classList.contains('menu-plegado'); document.body.classList.toggle('menu-plegado', p); try { localStorage.setItem('hq_menu', p ? 'plegado' : 'abierto'); } catch {} });
  // Buscador: pinta hasta 12 resultados bajo el campo; Enter abre el primero; Escape cierra.
  const campo = $('busqueda'), lista = $('resultados');
  const cerrarLista = () => { lista.hidden = true; lista.innerHTML = ''; };
  const pintar = () => {
    const r = buscar(window.HQ_DATOS || {}, campo.value);
    lista.innerHTML = ''; lista.hidden = !r.length;
    r.forEach((x, i) => lista.append(el('a', { href: x.href, class: i === 0 ? 'marcado' : '', onclick: () => { campo.value = ''; cerrarLista(); cerrarMenu(); } }, [el('span', { class: 'tipo', text: x.tipo }), el('span', { text: (typeof x.id === 'number' ? '#' + x.id + ' ' : '') + x.titulo })])));
  };
  campo.addEventListener('input', pintar);
  campo.addEventListener('focus', () => { if (campo.value) pintar(); });
  campo.addEventListener('keydown', e => {
    if (e.key === 'Escape') { campo.value = ''; cerrarLista(); campo.blur(); }
    if (e.key === 'Enter') { const primero = lista.querySelector('a'); if (primero) { location.hash = primero.getAttribute('href'); campo.value = ''; cerrarLista(); } }
  });
  document.addEventListener('click', e => { if (!e.target.closest('#buscador')) cerrarLista(); });
  // Copiar enlace: cualquier elemento con data-copiar-enlace copia la URL actual (hash incluido).
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-copiar-enlace]'); if (!b) return;
    const url = location.href.split('?')[0].split('#')[0] + location.hash;
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => toast('enlace copiado'), () => toast(url));
  });
  window.addEventListener('hashchange', cerrarMenu);
}
```

Nota: `window.HQ_DATOS` lo fija `main.js` en `render()` (Task 6) con `S.datos`, para que el buscador vea el payload sin importar `estado.js` de forma circular con `main.js`. Sí, es una global: es la forma más corta y el buscador es solo lectura.

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `cd /Users/diego/dev/77delta && PATH=$HOME/.nvm/versions/node/v22.23.1/bin:$PATH timeout 500 node --test public/hq/test/*.mjs`
Expected: PASS, 60 tests, 0 fallos.

- [ ] **Step 5: Commit**

```bash
cd /Users/diego/dev/77delta && git add public/hq/app/shell.js public/hq/test/shell.test.mjs && git commit -m "feat(hq): shell con menú lateral, drawer, barra superior y buscador (plan 3a T5)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016CVmDqUV5diuD59mpZWRZv"
```

---

### Task 6: `index.html`, `hq.css` y `main.js`: cablear el shell y las rutas nuevas

**Files:**
- Modify: `public/hq/index.html` (cuerpo entero salvo `<head>` y los dos `<script>` finales; NO tocar la línea de `HQ_VERSION`)
- Modify: `public/hq/app/hq.css` (líneas 6-12 y añadir al final)
- Modify: `public/hq/app/main.js`
- Delete: `public/hq/app/vistas/inicio.js`, `public/hq/app/vistas/plan.js`

**Interfaces:**
- Consumes: `resolver` de `rutas.js`; `montarMenu, marcarActiva, pintarBarra, cablearShell` de `shell.js`; vistas `hoy`, `objetivo`, `tablero`, `expedientes`, `equipo`, `decisiones` con `render(raiz, S, arg, filtros)`.
- Produces: `main.js` sigue exportando `render` y `recargar` (los importan `tablero.js`, `decisiones.js`, `equipo.js`, `expedientes.js`, `detalle.js`). Contrato nuevo de las vistas: cuarto parámetro `filtros` (objeto, puede estar vacío).

- [ ] **Step 1: Sustituir el `<body>` de `index.html`**

Deja `<head>` como está. El `<body>` queda así (conserva exactamente los dos `<script>` finales que ya existen, con su `HQ_VERSION`):

```html
<body>
<header class="cab">
  <button class="btn-icono" id="hamburguesa" aria-label="Menú" aria-expanded="false" aria-controls="menu">☰</button>
  <a class="marca" href="#hoy">HQ</a>
  <div class="buscador" id="buscador">
    <input class="campo" id="busqueda" type="search" placeholder="Buscar número o texto" autocomplete="off" aria-label="Buscar en HQ">
    <div class="resultados" id="resultados" hidden></div>
  </div>
  <a class="contador" id="contador" href="#hoy" hidden></a>
  <a class="semaforo" id="semaforo" href="#recursos/computo" hidden aria-label="Cuentas"></a>
  <button class="btn-enlace salir" data-salir>salir</button>
</header>
<div class="cuerpo">
  <aside class="menu" id="menu">
    <nav id="nav" aria-label="Áreas"></nav>
    <div class="menu-pie">
      <button class="btn-enlace" id="plegar" aria-label="Plegar o desplegar el menú">plegar</button>
      <a href="/hq/v1/">v1 (hasta 30-sep)</a>
      <button class="btn-enlace" data-salir>salir</button>
      <span class="ver" id="ver"></span>
    </div>
  </aside>
  <div class="velo" id="velo"></div>
  <main id="vista" class="vista"><p class="cargando">Cargando HQ...</p></main>
</div>
<div id="capa"></div>
```

- [ ] **Step 2: CSS del shell en `hq.css`**

Sustituye las líneas 6-12 (`.cab`, `.marca`, `.nav`, `.nav a`, `.nav a.activa`, `.ver`, `.vista`) por:

```css
.cab{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:10px;padding:calc(8px + env(safe-area-inset-top)) 12px 8px;background:var(--marino);color:var(--marfil);min-height:52px}
.marca{font-family:var(--display);font-weight:700;text-decoration:none;font-size:18px;color:inherit}
.btn-icono{font:inherit;font-size:20px;line-height:1;background:none;border:0;color:inherit;cursor:pointer;padding:4px 6px}
.buscador{position:relative;flex:1;max-width:520px;margin-left:auto}
.buscador .campo{padding:6px 10px;font-size:14px;background:rgba(255,255,255,.1);border-color:transparent;color:var(--marfil)}
.buscador .campo::placeholder{color:var(--pizarra-clara)}
.resultados{position:absolute;top:100%;left:0;right:0;margin-top:4px;background:var(--panel);color:var(--tinta);border:1px solid var(--linea);border-radius:var(--radio);max-height:60vh;overflow:auto;z-index:15;box-shadow:0 8px 24px rgba(0,0,0,.18)}
.resultados a{display:block;padding:8px 10px;text-decoration:none;color:inherit;font-size:14px}.resultados a:hover,.resultados a.marcado{background:var(--oro-suave)}
.resultados .tipo{font-family:var(--mono);font-size:11px;text-transform:uppercase;color:var(--tinta-2);margin-right:6px}
.contador{background:var(--oro);color:var(--tinta);border-radius:999px;padding:3px 10px;font-size:13px;font-weight:600;text-decoration:none;white-space:nowrap}
.semaforo{width:14px;height:14px;border-radius:50%;flex:none;display:block}.semaforo.verde{background:var(--exito)}.semaforo.ambar{background:var(--oro-luz)}.semaforo.rojo{background:var(--error)}
.cab .salir{color:var(--pizarra-clara);font-size:13px}
.ver{font-family:var(--mono);font-size:11px;opacity:.6}
.cuerpo{display:flex;align-items:stretch;min-height:calc(100vh - 52px)}
.menu{background:var(--panel);border-right:1px solid var(--linea);width:232px;flex:none;display:flex;flex-direction:column;justify-content:space-between;padding:10px 8px;box-sizing:border-box}
.menu .area{margin-bottom:6px}.area-titulo{font-family:var(--display);font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--tinta-2);margin:8px 10px 2px}
.menu nav a{display:block;padding:7px 10px;border-radius:var(--radio-boton);text-decoration:none;color:var(--tinta);font-size:14px}
.menu nav a.activa{background:var(--oro);color:var(--tinta);font-weight:600}.menu .pronto{margin:0 10px;font-size:12px}
.menu-pie{display:grid;gap:6px;font-size:12px;padding:8px 10px}.menu-pie a{color:var(--tinta-2)}
.velo{display:none}
.vista{flex:1;min-width:0;padding:14px;max-width:1280px;margin:0 auto;box-sizing:border-box}
@media (max-width:899px){
  .menu{position:fixed;top:0;bottom:0;left:0;z-index:25;transform:translateX(-100%);transition:transform .2s var(--ease);padding-top:calc(10px + env(safe-area-inset-top))}
  body.menu-abierto .menu{transform:none}body.menu-abierto .velo{display:block;position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:24}
  #plegar,.cab .salir{display:none}.cab .contador{font-size:12px;padding:2px 8px}
}
@media (min-width:900px){
  #hamburguesa{display:none}.menu-pie [data-salir]{display:none}
  body.menu-plegado .menu{width:56px;padding:10px 4px}
  body.menu-plegado .menu nav a{font-size:0;padding:10px 0;text-align:center}
  body.menu-plegado .menu nav a::before{content:attr(data-inicial);font-size:14px;font-weight:600}
  body.menu-plegado .area-titulo,body.menu-plegado .menu-pie a,body.menu-plegado .menu-pie .ver,body.menu-plegado .pronto{display:none}
}
```

Añade al final del fichero (cuadro del objetivo):

```css
.objetivo .datos{display:flex;gap:18px;flex-wrap:wrap;margin-top:6px}.objetivo .dato{display:grid}.objetivo .dato strong{font-size:16px}.objetivo .dato.mal strong{color:var(--oro-luz)}.objetivo .dato.bien strong{color:#8CB897}
```

La línea 32 (`@media (min-width:900px){... .vista{padding:20px}}`) se queda. Comprueba que no quedan reglas `.nav` huérfanas.

- [ ] **Step 3: Reescribir `main.js`**

Sustituye los imports de vistas, `VISTAS`, el bloque `idPush`, `ruta()` y `render()` por lo siguiente. El resto del fichero (recargar, pedirToken, push, service worker, arranque) se queda igual salvo las dos líneas que se indican después.

```js
import { conf, TOKEN, cargar, rpc, guardarToken, salir } from './api.js';
import { S, poner } from './estado.js';
import { el, toast } from './ui.js';
import { crearRecargador } from './recargador.js';
import { resolver } from './rutas.js';
import { montarMenu, marcarActiva, pintarBarra, cablearShell } from './shell.js';
import * as hoy from './vistas/hoy.js';
import * as objetivo from './vistas/objetivo.js';
import * as tablero from './vistas/tablero.js';
import * as decisiones from './vistas/decisiones.js';
import * as equipo from './vistas/equipo.js';
import * as expedientes from './vistas/expedientes.js';

// Plan 3a: una vista por clave de ruta (rutas.js). 'equipo/agente' es la ficha de equipo.js (arg = id).
const VISTAS = { 'hoy': hoy, 'direccion/objetivo': objetivo, 'operacion/tablero': tablero, 'operacion/expedientes': expedientes, 'equipo/organigrama': equipo, 'equipo/agente': equipo, 'reglas/decisiones': decisiones };
const raiz = document.getElementById('vista');
document.getElementById('ver').textContent = 'v' + HQ_VERSION.v;
montarMenu(document.getElementById('nav'));
cablearShell();

// resolver() absorbe las rutas de la v2.0 (#inicio, #tablero/f/A3, ?id=N...) y devuelve el hash canónico;
// si difiere del actual se sustituye en el historial para no dejar enlaces viejos colgados.
export function render() {
  const r = resolver(location.hash, location.search);
  if (r.redirigido || location.search) history.replaceState(null, '', location.pathname + r.canonico);
  marcarActiva(r.clave);
  raiz.innerHTML = ''; raiz.className = 'vista vista-' + r.clave.replace('/', '-');
  if (!S.datos) { raiz.append(el('p', { class: 'cargando', text: 'Cargando HQ...' })); return; }
  window.HQ_DATOS = S.datos; pintarBarra(S.datos);
  VISTAS[r.clave].render(raiz, S, r.arg, r.filtros);
}
```

Después, en el listener del service worker (`navigator.serviceWorker.addEventListener('message', ...)`), cambia las dos rutas:

```js
    if (ev.data?.tipo === 'abrir' && ev.data.id) location.hash = '#reglas/decisiones/' + ev.data.id;
    else if (ev.data?.tipo === 'abrir-lic' && ev.data.lic) location.hash = '#reglas/decisiones';
```

Borra los ficheros `public/hq/app/vistas/inicio.js` y `public/hq/app/vistas/plan.js` con `git rm`.

- [ ] **Step 4: Tablero: filtro por query y rutas nuevas**

En `public/hq/app/vistas/tablero.js`, sustituye las dos primeras líneas de `render` por:

```js
export function render(raiz, S, arg, filtros = {}) {
  if (filtros.frente) { S.filtros.frente = filtros.frente; history.replaceState(null, '', '#operacion/tablero'); }
  if (filtros.agente) { S.filtros.agente = filtros.agente; history.replaceState(null, '', '#operacion/tablero'); }
  if (arg && /^\d+$/.test(arg)) { history.replaceState(null, '', '#operacion/tablero'); abrirDetalle(Number(arg), S, recargar); }
```

- [ ] **Step 5: Humo con el shim y suite completa**

Crea `scratchpad/humo-3a.mjs` fuera del repo (en el directorio scratchpad de la sesión; NO dentro de `public/`) que monte el mismo shim DOM de `test/shell.test.mjs`, añada `globalThis.navigator = { serviceWorker: undefined }`, `globalThis.Notification = { permission: 'denied' }`, `globalThis.matchMedia = () => ({ matches: false })`, `globalThis.setInterval = () => 0`, y haga `await import('/Users/diego/dev/77delta/public/hq/app/main.js')`; sin token, `main.js` debe llegar a `pedirToken()` sin lanzar. Ejecuta `node scratchpad/humo-3a.mjs` y comprueba que no hay excepción (la importación de `main.js` con el shim es la prueba de que no hay imports rotos tras borrar `inicio.js` y `plan.js`). Si el shim necesita algún método más (`querySelector`, `closest`), añádelo devolviendo `null`.

Run: `cd /Users/diego/dev/77delta && PATH=$HOME/.nvm/versions/node/v22.23.1/bin:$PATH timeout 500 node --test public/hq/test/*.mjs`
Expected: PASS, 60 tests, 0 fallos.

Además: `grep -rn "inicio.js\|plan.js\|'#inicio'\|'#plan'" public/hq/app public/hq/index.html` debe devolver 0 líneas.

- [ ] **Step 6: Commit**

```bash
cd /Users/diego/dev/77delta && git add public/hq/index.html public/hq/app/hq.css public/hq/app/main.js public/hq/app/vistas/tablero.js && git rm -q public/hq/app/vistas/inicio.js public/hq/app/vistas/plan.js && git commit -m "feat(hq): shell de seis áreas cableado en index, css y main; fuera inicio y plan (plan 3a T6)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016CVmDqUV5diuD59mpZWRZv"
```

---

### Task 7: rutas internas en las vistas existentes, `sw.js` y el verificador

**Files:**
- Modify: `public/hq/app/tarjeta.js:11`, `public/hq/app/detalle.js:53`, `public/hq/app/vistas/expedientes.js:57,87,103`, `public/hq/app/vistas/equipo.js:43,49,56,67`
- Modify: `public/hq/sw.js:5-6,37`
- Modify: `scripts/hq/tests/verificar-hq-web.sh:10,12`

**Interfaces:**
- Consumes: rutas de `rutas.js` (Task 1). Las redirecciones ya cubren los hashes viejos, pero los enlaces que construye la UI deben ser los canónicos para que el menú marque el área correcta sin un `replaceState` extra.
- Produces: nada nuevo.

- [ ] **Step 1: Sustituir los hashes internos**

Cambios exactos (usa `sed -i` o edición manual; comprueba cada uno con `grep -n` antes y después):

| Fichero | Antes | Después |
|---|---|---|
| `app/tarjeta.js` | `'#tablero/'` | `'#operacion/tablero/'` |
| `app/detalle.js` | `'#expedientes/'` | `'#operacion/expedientes/'` |
| `app/vistas/expedientes.js` | `'#expedientes/'` | `'#operacion/expedientes/'` |
| `app/vistas/expedientes.js` | `href: '#expedientes'` | `href: '#operacion/expedientes'` |
| `app/vistas/expedientes.js` | `'#decisiones/'` | `'#reglas/decisiones/'` |
| `app/vistas/equipo.js` | `href: '#equipo'` | `href: '#equipo/organigrama'` |
| `app/vistas/equipo.js` | `'#tablero/f/'` | `'#operacion/tablero?frente='` |
| `app/vistas/equipo.js` | `'#expedientes/'` | `'#operacion/expedientes/'` |
| `app/vistas/equipo.js` | `'#equipo/'` | `'#equipo/agente/'` |

Comprobación: `cd /Users/diego/dev/77delta/public/hq && grep -rn "'#tablero\|'#expedientes\|'#decisiones\|'#equipo'\|'#equipo/'\|'#inicio\|'#plan" app` debe devolver 0 líneas.

- [ ] **Step 2: `sw.js`**

Línea 5: `var CACHE = 'hq-v14';`

Línea 6, SHELL: quita `/hq/app/vistas/inicio.js` y `/hq/app/vistas/plan.js`; añade `/hq/app/rutas.js`, `/hq/app/buscador.js`, `/hq/app/shell.js`, `/hq/app/vistas/hoy.js`, `/hq/app/vistas/objetivo.js`. Queda:

```js
var SHELL = ['/hq/', '/hq/app/main.js', '/hq/app/api.js', '/hq/app/estado.js', '/hq/app/recargador.js', '/hq/app/rutas.js', '/hq/app/buscador.js', '/hq/app/shell.js', '/hq/app/ui.js', '/hq/app/tarjeta.js', '/hq/app/detalle.js', '/hq/app/dnd.js', '/hq/app/vistas/hoy.js', '/hq/app/vistas/objetivo.js', '/hq/app/vistas/tablero.js', '/hq/app/vistas/decisiones.js', '/hq/app/vistas/equipo.js', '/hq/app/vistas/expedientes.js', '/hq/app/tokens.css', '/hq/app/hq.css', '/hq/manifest.webmanifest', '/hq/icon-192.png', '/hq/icon-512.png'];
```

Línea 37 (`notificationclick`): `var d = e.notification.data || {}, url = d.url || (d.id ? '/hq/#reglas/decisiones/' + d.id : '/hq/#hoy');`

No toques nada más del `sw.js` (el `activate` sigue borrando solo `/^hq-v\d+$/` distintos de CACHE).

- [ ] **Step 3: `verificar-hq-web.sh`**

Línea 10: en la lista `for f in ...` quita `app/vistas/inicio.js app/vistas/plan.js` y añade `app/rutas.js app/buscador.js app/shell.js app/vistas/hoy.js app/vistas/objetivo.js`.
Línea 12: `hq-v13` → `hq-v14` en el `grep -q` y en el mensaje de FALLO.

`bash -n scripts/hq/tests/verificar-hq-web.sh` debe salir limpio. No ejecutes el verificador contra producción (aún no está publicado): lo hace el controlador tras el push.

- [ ] **Step 4: Suite completa y comprobaciones**

Run: `cd /Users/diego/dev/77delta && PATH=$HOME/.nvm/versions/node/v22.23.1/bin:$PATH timeout 500 node --test public/hq/test/*.mjs`
Expected: PASS, 60 tests, 0 fallos.

Run: `cd /Users/diego/dev/77delta && for f in $(grep -o "'/hq/[^']*'" public/hq/sw.js | tr -d "'" | sed 's|^/hq/||' | grep -v '^$'); do [ -e "public/hq/$f" ] || echo "FALTA $f"; done`
Expected: sin salida (todo lo que lista SHELL existe en disco).

- [ ] **Step 5: Commit**

```bash
cd /Users/diego/dev/77delta && git add public/hq/app/tarjeta.js public/hq/app/detalle.js public/hq/app/vistas/expedientes.js public/hq/app/vistas/equipo.js public/hq/sw.js scripts/hq/tests/verificar-hq-web.sh && git commit -m "feat(hq): rutas canónicas en vistas, sw hq-v14 y verificador (plan 3a T7)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016CVmDqUV5diuD59mpZWRZv"
```

---

## Cierre de la tanda (lo hace el controlador, no una tarea)

1. Revisión final (opus) del diff completo de la rama `hq-v3` contra `main`; un solo dispatch de arreglos.
2. Fusionar en `main`, `sh scripts/hq/version.sh` (2.0.1 → 2.0.2 o la siguiente), commit, push.
3. `bash scripts/hq/tests/verificar-hq-web.sh <version>` → "HQ web OK"; `curl -s https://77delta.com/hq/ | grep HQ_VERSION`.
4. Prueba manual del controlador a 390 px y a escritorio: hamburguesa abre y cierra el drawer, plegar recuerda el estado, buscador por `996` y por `ariadna`, `#tablero/f/A1` redirige y filtra, `?id=N` abre la decisión, contador "Depende de ti" coincide con Hoy.
5. Aviso a Nuria (po-hq) para la verificación contra la sección 8 de la spec, y línea a Diego con la versión publicada.

## Autorrevisión del plan (hecha al escribirlo)

- Cobertura de la spec, tanda 1: barra superior (T5, T6), menú lateral y drawer (T5, T6), rutas y redirecciones (T1, T6), buscador (T2, T5), Hoy con tres bloques (T4), Dirección/Objetivo con meta a la fecha (T3, T4), Tablero/Expedientes/Decisiones movidos (T6, T7), semáforo preparado pero oculto hasta la tanda 3 (T3, T5), `sw.js` y verificador (T7). "Copiar enlace" cableado en T5 con `data-copiar-enlace`; el botón visible en cada ficha llega con las vistas de la tanda 2 (las fichas de tablero y expedientes actuales no se tocan en esta tanda).
- Sin placeholders: cada paso lleva el código o el cambio exacto.
- Consistencia: `render(raiz, S, arg, filtros)` en todas las vistas; claves de ruta idénticas en `rutas.js`, `shell.js`, `main.js`, `buscador.js` y los hrefs de T7; `contador`, `semaforoCuentas`, `prorrateo`, `enCurso` con los mismos nombres en T3, T4 y T5.
