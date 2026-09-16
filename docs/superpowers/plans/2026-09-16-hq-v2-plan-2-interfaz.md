# HQ v2 · Plan 2: interfaz nueva sobre `omc_hq_v2`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** sustituir la webapp de HQ (`public/hq/index.html`, 146 KB en un solo fichero) por una interfaz nueva, móvil primero, que enseña la cascada objetivo → bloque → frente → encargo, un tablero Kanban editable por Diego, sus decisiones, el equipo y los expedientes, leyendo todo de `omc_hq_v2` y sin perder nada de lo que la v1 ya hace (decisiones, licitaciones, push).

**Architecture:** la v1 se mueve entera a `public/hq/v1/` y sigue funcionando (Licita, Contactos y el histórico enlazan allí hasta el plan 3). La v2 vive en `public/hq/` como HTML mínimo + módulos ES sin build (GitHub Pages sirve `public/` tal cual): `app/api.js` (config, token, `rpc`, realtime), `app/estado.js` (estado en memoria y funciones puras: cascada, kanban, filtros), `app/ui.js` (helpers DOM, modal, toast), una vista por fichero en `app/vistas/` y `app/main.js` (rutas por `#hash`). La lógica pura se prueba con `node --test` (Node 22, sin dependencias); la UI se verifica con una lista de comprobación en móvil y escritorio antes de cada publicación.

**Tech Stack:** HTML + CSS con los tokens de `brand/tokens.css` (copiados a `public/hq/app/tokens.css` por script), JavaScript ES2022 en módulos nativos, `@supabase/supabase-js@2` UMD por CDN (como la v1), `node:test`. Sin framework, sin bundler.

**Spec:** `docs/superpowers/specs/2026-09-16-hq-fuente-unica-cascada-design.md` (secciones 4 y 6) y el contrato `docs/superpowers/specs/2026-09-16-hq-v2-contrato-omc_hq_v2.md` (plan 1, T16). Depende de que el plan 1 esté aplicado en producción hasta T16.

## Global Constraints

- Nunca la raya larga ni el guion largo en código, CSS, textos de la UI, docs ni commits; siempre "-".
- Identificadores (ficheros, funciones, clases CSS, ids) sin acentos ni eñes; los textos visibles en español con acentos.
- Ninguna credencial ni token en el repo: la config viene de `https://api.77delta.com/hq/config` (`localStorage.hq_cfg`) y el token de `?t=` (`localStorage.hq_t`), igual que la v1.
- Un solo color de acento (oro plano, `--oro`), nunca degradados; tinta, oro y neutros de `tokens.css`; sin serif de display fuera de los tokens.
- Móvil primero: todo usable a 390 px de ancho con el pulgar; Kanban en móvil = una columna a la vez con pestañas, en escritorio las cinco a la vez.
- La UI no recalcula lo que ya calcula la base: columna Kanban, `rojo`, `encargos_abiertos` vienen de `omc_hq_v2`; la UI solo ordena y filtra.
- Toda escritura pasa por RPC existentes del plan 1 con `p_token`; no hay SQL en el navegador.
- Nada de 77 Delta escrito en el código: nombres de bloques, frentes, agentes y empresa vienen de los datos.
- Cada publicación: `scripts/hq/version.sh` (estampa versión y fecha en `public/hq/index.html`), `git push` y verificación con `curl -s https://77delta.com/hq/ | grep HQ_VERSION` antes de decir "publicado".
- Commits pequeños por tarea, con las líneas de atribución de la sesión.

## Mapa de ficheros

```
public/hq/
  index.html                 shell v2 (≤ 120 líneas): head, nav, <main id="vista">, scripts
  sw.js                      service worker v2 (cache hq-v13) que sirve el shell y desregistra cachés viejas
  manifest.webmanifest       igual que v1 con start_url /hq/
  app/tokens.css             copia de brand/tokens.css (scripts/hq/sincronizar-tokens.sh)
  app/hq.css                 estilos v2 (móvil primero)
  app/api.js                 conf(), token, rpc(), cargar() = omc_hq_v2, suscribir() realtime
  app/estado.js              S (estado), derivar(), kanban(), filtrar(), semana(), texto()
  app/ui.js                  el(), modal(), toast(), fecha(), eur()
  app/main.js                rutas por hash, nav, arranque, cambio de token
  app/vistas/inicio.js       lo que depende de ti, lo que pediste esta semana, rojos, sesiones
  app/vistas/plan.js         cascada objetivo → bloques → frentes con KPI
  app/vistas/tablero.js      Kanban + tarjeta (detalle, edición, hilo) + alta
  app/vistas/decisiones.js   tarjetas pendientes (aprobar, rechazar, comentar, posponer) y licitaciones por decidir
  app/vistas/equipo.js       fichas de agentes
  app/vistas/expedientes.js  lista y ficha con "Trabajar con <agente>" y "Cerrar sesión"
  v1/index.html, v1/sw.js    la webapp actual, sin cambios salvo rutas
public/hq/test/*.test.mjs    node --test de estado.js y ui.js (funciones puras)
scripts/hq/sincronizar-tokens.sh
```

---

### Task 1: Mover la v1 y levantar el shell v2

**Files:**
- Move: `public/hq/index.html` → `public/hq/v1/index.html`; `public/hq/sw.js` → `public/hq/v1/sw.js`
- Create: `public/hq/index.html`, `public/hq/app/hq.css`, `public/hq/app/api.js`, `public/hq/app/ui.js`, `public/hq/app/main.js`, `scripts/hq/sincronizar-tokens.sh`, `public/hq/app/tokens.css` (generado)
- Test: `public/hq/test/ui.test.mjs`

**Interfaces:**
- Produces: `api.js` exporta `conf() -> Promise<{url, anon}>`, `TOKEN` (string|null), `rpc(fn, args) -> Promise<any>` (añade `p_token` si falta), `cargar() -> Promise<datos>` (llama `omc_hq_v2`), `suscribir(onCambio)` (canal `omc:<empresa>` evento `cambio`), `guardarToken(t)`, `salir()`. `ui.js` exporta `el(tag, attrs, kids)`, `modal({titulo, cuerpo, acciones}) -> {cerrar}`, `toast(texto, accion?, fn?)`, `fecha(iso, {hora}) -> 'mié 16 15:30'`, `eur(n) -> '300.000 EUR'`, `horas(iso) -> 51`. `main.js` exporta nada; define rutas `#inicio #plan #tablero #decisiones #equipo #expedientes` y llama `vista.render(raiz, S)`.

- [ ] **Step 1: Test de `ui.js` (puro)**

```js
// public/hq/test/ui.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { eur, fecha, horas } from '../app/ui.js';

test('eur formatea sin decimales y con EUR', () => {
  assert.equal(eur(300000), '300.000 EUR');
  assert.equal(eur(0), '0 EUR');
  assert.equal(eur(null), '-');
});
test('fecha corta en español', () => {
  assert.equal(fecha('2026-09-16T15:30:00Z', { hora: true, tz: 'Europe/Madrid' }), 'mié 16 17:30');
  assert.equal(fecha('2026-09-20', {}), 'dom 20');
  assert.equal(fecha(null, {}), '-');
});
test('horas desde una fecha', () => {
  assert.equal(horas('2026-09-14T07:00:00Z', new Date('2026-09-16T10:00:00Z')), 51);
});
```

`ui.js` no puede tocar `document` al importarse (node no lo tiene): `el`, `modal` y `toast` usan `document` solo dentro de la función.

- [ ] **Step 2: Ejecutar** → `node --test public/hq/test/` FAIL (módulo no existe).

- [ ] **Step 3: Mover la v1 y escribir los ficheros**

```bash
mkdir -p public/hq/v1 public/hq/app/vistas public/hq/test
git mv public/hq/index.html public/hq/v1/index.html
git mv public/hq/sw.js public/hq/v1/sw.js
sed -i "s#'/hq/sw.js'#'/hq/v1/sw.js'#g; s#var SHELL = \['/hq/'#var SHELL = ['/hq/v1/'#; s#'hq-v12'#'hq-v1-legado'#" public/hq/v1/index.html public/hq/v1/sw.js
grep -n "sw.js\|SHELL" public/hq/v1/index.html public/hq/v1/sw.js | head
```

`scripts/hq/sincronizar-tokens.sh`:

```bash
#!/bin/sh
# Copia brand/tokens.css a public/hq/app/tokens.css (GitHub Pages solo sirve public/). Ejecutar cuando cambien los tokens.
set -e; cd "$(dirname "$0")/../.."
{ echo "/* GENERADO por scripts/hq/sincronizar-tokens.sh desde brand/tokens.css: no editar aquí */"; cat brand/tokens.css; } > public/hq/app/tokens.css
echo "tokens: $(wc -c < public/hq/app/tokens.css) bytes"
```

`public/hq/index.html`:

```html
<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>HQ</title>
<link rel="manifest" href="/hq/manifest.webmanifest">
<link rel="apple-touch-icon" href="/hq/apple-touch-icon.png">
<meta name="theme-color" content="#0b1f3a">
<link rel="stylesheet" href="/hq/app/tokens.css">
<link rel="stylesheet" href="/hq/app/hq.css">
</head>
<body>
<header class="cab">
  <a class="marca" href="#inicio">HQ</a>
  <nav class="nav" id="nav">
    <a href="#inicio">Inicio</a><a href="#plan">Plan</a><a href="#tablero">Tablero</a><a href="#decisiones">Decisiones</a><a href="#equipo">Equipo</a><a href="#expedientes">Expedientes</a>
  </nav>
  <span class="ver" id="ver"></span>
</header>
<main id="vista" class="vista"><p class="cargando">Cargando HQ...</p></main>
<div id="capa"></div>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
<script>var HQ_VERSION = { v: '2.0.0', fecha: '2026-09-17 09:00' }; // la actualiza scripts/hq/version.sh en cada publicación</script>
<script type="module" src="/hq/app/main.js"></script>
</body>
</html>
```

`public/hq/app/api.js`:

```js
// Acceso a HQ: config, token, RPC y realtime. Sin estado de negocio (eso está en estado.js).
const API = 'https://api.77delta.com';
const params = new URLSearchParams(location.search);
if (params.get('t')) { localStorage.setItem('hq_t', params.get('t')); history.replaceState(null, '', location.pathname + location.hash); }
export let TOKEN = localStorage.getItem('hq_t');
let sb = null, canal = null, CFG = null;

export async function conf() {
  const cache = localStorage.getItem('hq_cfg');
  const pedir = fetch(API + '/hq/config').then(r => r.json()).then(j => { if (!j.url || !j.anon) throw new Error('sin configuración'); localStorage.setItem('hq_cfg', JSON.stringify(j)); return j; });
  CFG = cache ? JSON.parse(cache) : await pedir;
  if (cache) pedir.catch(() => {});
  sb = window.supabase.createClient(CFG.url, CFG.anon, { auth: { persistSession: false, autoRefreshToken: false } });
  return CFG;
}
export function guardarToken(t) { localStorage.setItem('hq_t', t); TOKEN = t; }
export function salir() { localStorage.removeItem('hq_t'); TOKEN = null; location.reload(); }
export async function rpc(fn, args = {}) {
  if (!sb) await conf();
  const r = await sb.rpc(fn, { p_token: TOKEN, ...args });
  if (r.error) throw new Error(r.error.message || 'error');
  return r.data;
}
export function cargar() { return rpc('omc_hq_v2'); }
export function suscribir(empresa, onCambio) {
  if (canal) sb.removeChannel(canal);
  canal = sb.channel('omc:' + empresa).on('broadcast', { event: 'cambio' }, onCambio).subscribe();
}
```

`public/hq/app/ui.js`:

```js
// Helpers de DOM y formato. Las funciones de formato son puras (node --test).
export function el(tag, attrs = {}, kids = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'text') n.textContent = v; else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (k === 'class') n.className = v; else n.setAttribute(k, v === true ? '' : v);
  }
  for (const k of [].concat(kids)) if (k != null) n.append(k.nodeType ? k : document.createTextNode(String(k)));
  return n;
}
export function modal({ titulo, cuerpo, acciones = [] }) {
  const capa = document.getElementById('capa');
  const cerrar = () => { capa.innerHTML = ''; document.body.classList.remove('con-modal'); };
  const caja = el('div', { class: 'modal', role: 'dialog', 'aria-label': titulo }, [
    el('div', { class: 'modal-cab' }, [el('h2', { text: titulo }), el('button', { class: 'btn-x', 'aria-label': 'Cerrar', text: '×', onclick: cerrar })]),
    el('div', { class: 'modal-cuerpo' }, cuerpo),
    acciones.length ? el('div', { class: 'modal-acciones' }, acciones) : null]);
  capa.innerHTML = ''; capa.append(el('div', { class: 'fondo', onclick: e => { if (e.target === e.currentTarget) cerrar(); } }, [caja]));
  document.body.classList.add('con-modal');
  return { cerrar, caja };
}
export function toast(texto, accion, fn) {
  const t = el('div', { class: 'toast' }, [el('span', { text: texto }), accion ? el('button', { class: 'btn-enlace', text: accion, onclick: () => { fn(); t.remove(); } }) : null]);
  document.body.append(t); setTimeout(() => t.remove(), accion ? 8000 : 3500);
}
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
export function fecha(iso, { hora = false, tz = 'Europe/Madrid' } = {}) {
  if (!iso) return '-';
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00Z' : iso);
  const p = Object.fromEntries(new Intl.DateTimeFormat('es-ES', { timeZone: tz, weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d).map(x => [x.type, x.value]));
  const dia = DIAS[new Date(new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(d)).getDay()];
  return hora ? `${dia} ${p.day} ${p.hour}:${p.minute}` : `${dia} ${p.day}`;
}
export function eur(n) { return n == null ? '-' : Math.round(Number(n)).toLocaleString('es-ES') + ' EUR'; }
export function horas(iso, ahora = new Date()) { return iso ? Math.floor((ahora - new Date(iso)) / 36e5) : null; }
```

`public/hq/app/main.js`:

```js
import { conf, TOKEN, cargar, suscribir, guardarToken, salir } from './api.js';
import { S, poner } from './estado.js';
import { el, toast } from './ui.js';
import * as inicio from './vistas/inicio.js';
import * as plan from './vistas/plan.js';
import * as tablero from './vistas/tablero.js';
import * as decisiones from './vistas/decisiones.js';
import * as equipo from './vistas/equipo.js';
import * as expedientes from './vistas/expedientes.js';

const VISTAS = { inicio, plan, tablero, decisiones, equipo, expedientes };
const raiz = document.getElementById('vista');
document.getElementById('ver').textContent = 'v' + HQ_VERSION.v;

function ruta() { const h = (location.hash || '#inicio').slice(1).split('/'); return { vista: VISTAS[h[0]] ? h[0] : 'inicio', arg: h[1] }; }
export function render() {
  const { vista, arg } = ruta();
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('activa', a.getAttribute('href') === '#' + vista));
  raiz.innerHTML = ''; raiz.className = 'vista vista-' + vista;
  if (!S.datos) { raiz.append(el('p', { class: 'cargando', text: 'Cargando HQ...' })); return; }
  VISTAS[vista].render(raiz, S, arg);
}
export async function recargar() { try { poner(await cargar()); render(); } catch (e) { toast('HQ: ' + e.message); } }

function pedirToken() {
  const campo = el('input', { class: 'campo', placeholder: 'Pega el enlace de HQ o el token', autofocus: true });
  raiz.innerHTML = ''; raiz.append(el('div', { class: 'entrar' }, [el('h1', { text: 'HQ' }), campo,
    el('button', { class: 'btn primario', text: 'Entrar', onclick: () => { const m = campo.value.match(/[?&]t=([0-9a-f]{20,})/i) || campo.value.match(/^([0-9a-f]{20,})$/i); if (!m) { campo.focus(); return; } guardarToken(m[1]); location.reload(); } })]));
}
window.addEventListener('hashchange', render);
document.addEventListener('click', e => { if (e.target.closest('[data-salir]')) salir(); });
if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => { if (!r.active || !r.active.scriptURL.endsWith('/hq/sw.js')) r.unregister(); }));
if (!TOKEN) pedirToken();
else conf().then(recargar).then(() => suscribir(S.datos.empresa || S.datos.agentes?.[0]?.empresa || '77delta', recargar)).catch(e => { raiz.innerHTML = ''; raiz.append(el('p', { class: 'error', text: 'No se pudo cargar HQ: ' + e.message })); });
```

`omc_hq_v2` debe devolver `empresa` (id) para el canal realtime: si el contrato de T16 no la incluye, añadirla ahí (`'empresa', t.empresa`) en vez de adivinarla aquí; quitar entonces el `||` de arriba.

`public/hq/app/hq.css` (base; cada vista añade sus reglas en la misma hoja, sección por vista):

```css
/* HQ v2 · móvil primero. Colores y tipografías solo de tokens.css. */
*{box-sizing:border-box} html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--papel);color:var(--tinta);font-family:var(--body);font-size:16px;line-height:1.45;padding-bottom:env(safe-area-inset-bottom)}
h1,h2,h3{font-family:var(--display);font-weight:600;letter-spacing:-.02em;line-height:1.15;margin:0}
a{color:inherit}
.cab{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:12px;padding:calc(8px + env(safe-area-inset-top)) 14px 8px;background:var(--marino);color:var(--marfil)}
.marca{font-family:var(--display);font-weight:700;text-decoration:none;font-size:18px}
.nav{display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;flex:1}
.nav a{padding:6px 10px;border-radius:var(--radio-boton);text-decoration:none;white-space:nowrap;font-size:14px;opacity:.8}
.nav a.activa{background:var(--oro);color:var(--tinta);opacity:1}
.ver{font-family:var(--mono);font-size:11px;opacity:.6}
.vista{padding:14px;max-width:1280px;margin:0 auto}
.tarjeta{background:var(--panel);border:1px solid var(--linea);border-radius:var(--radio);padding:12px;margin-bottom:10px}
.tarjeta.roja{border-left:4px solid var(--error)}
.btn{font:inherit;padding:8px 14px;border-radius:var(--radio-boton);border:1px solid var(--linea-fuerte);background:var(--panel);color:var(--tinta);cursor:pointer}
.btn.primario{background:var(--oro);border-color:var(--oro);font-weight:600}
.btn.peligro{border-color:var(--error);color:var(--error)}
.btn-enlace{background:none;border:0;color:var(--oro-oscuro);text-decoration:underline;cursor:pointer;font:inherit}
.campo,textarea,select{font:inherit;width:100%;padding:8px 10px;border:1px solid var(--linea-fuerte);border-radius:var(--radio-boton);background:var(--papel);color:var(--tinta)}
.fila{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.pill{font-size:12px;padding:2px 8px;border-radius:999px;background:var(--pizarra-tenue);color:var(--tinta-2)}
.pill.codigo{font-family:var(--mono);background:var(--oro-suave);color:var(--tinta)}
.mudo{color:var(--tinta-2);font-size:14px}
.fondo{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center;z-index:20}
.modal{background:var(--papel);width:100%;max-width:720px;max-height:92vh;overflow:auto;border-radius:var(--radio) var(--radio) 0 0;padding:14px}
.modal-cab{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.btn-x{font-size:24px;background:none;border:0;cursor:pointer;color:var(--tinta-2)}
.modal-acciones{display:flex;gap:8px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap}
.toast{position:fixed;left:50%;bottom:calc(16px + env(safe-area-inset-bottom));transform:translateX(-50%);background:var(--tinta);color:var(--papel);padding:10px 14px;border-radius:var(--radio-boton);z-index:30;display:flex;gap:12px;align-items:center;max-width:92vw}
.entrar{max-width:420px;margin:20vh auto;display:grid;gap:12px}
.cargando,.error{text-align:center;color:var(--tinta-2);padding:40px 0}
@media (min-width:900px){.fondo{align-items:center}.modal{border-radius:var(--radio)}.vista{padding:20px}}
```

Si algún token de la lista de arriba no existe en `brand/tokens.css` (comprobar con `grep -o -- '--[a-z0-9-]*:' brand/tokens.css | sort -u`), usar el equivalente que sí exista (`--panel`, `--linea`, `--linea-fuerte`, `--oro`, `--oro-suave`, `--oro-oscuro`, `--marino`, `--marfil`, `--papel`, `--tinta`, `--tinta-2`, `--pizarra-tenue`, `--error`, `--exito`, `--radio`, `--radio-boton`, `--body`, `--display`, `--mono` existen a 16-sep).

- [ ] **Step 4: Ejecutar** → `sh scripts/hq/sincronizar-tokens.sh && node --test public/hq/test/` PASS (3 tests). Abrir `public/hq/index.html` en local con `python3 -m http.server 8080 -d public` y `http://localhost:8080/hq/?t=<token>`: sale la cabecera y "Cargando HQ..." (las vistas aún no existen: crear en esta tarea seis ficheros `vistas/*.js` con `export function render(raiz){ raiz.append(document.createTextNode('pendiente')); }` para que el módulo cargue). `http://localhost:8080/hq/v1/` sigue mostrando la v1.

- [ ] **Step 5: Commit**

```bash
git add public/hq scripts/hq/sincronizar-tokens.sh
git commit -m "feat(hq-ui): shell v2 con api, ui y rutas; la v1 pasa a /hq/v1/"
```

---

### Task 2: `estado.js`: cascada, kanban y filtros (puro)

**Files:**
- Create: `public/hq/app/estado.js`
- Test: `public/hq/test/estado.test.mjs`

**Interfaces:**
- Consumes: la respuesta de `omc_hq_v2` (contrato T16): `objetivos[]`, `bloques[]` (letra, nombre, meta_eur, encargos_abiertos, frentes_n), `frentes[]` (id, codigo, linea, kpi, valor_actual, meta, unidad, responsable, bloque_letra, encargos_abiertos), `encargos[]` (id, codigo, bloque_letra, texto, estado, columna, prioridad, agente, responsable, fecha_hito, rojo, etiquetas, orden_kanban, origen, expediente_id, fecha, fecha_avance), `avances[]`, `pendientes[]`, `agentes[]`, `expedientes[]`, `sesiones[]`, `contactos[]`, `kit[]`, `licitaciones[]`.
- Produces: `S = { datos: null, filtros: { frente: null, bloque: null, agente: null, texto: '', etiqueta: null }, columnaMovil: 'en_curso' }`, `poner(datos)`, `derivar(datos) -> { objetivos, bloques: [{...bloque, frentes: [{...frente, encargos_abiertos}], abiertos, rojos}] }` (cascada anidada), `kanban(encargos, filtros) -> { backlog: [], por_hacer: [], en_curso: [], bloqueado: [], hecho: [] }` ordenadas por `orden_kanban` nulls al final, luego `fecha_hito` nulls al final, luego id, `filtrar(encargos, filtros)` (frente = codigo exacto, bloque = bloque_letra, agente contenido en `agente` o igual a `responsable`, texto en texto/interpretacion/origen sin acentos, etiqueta en `etiquetas`), `semana(encargos, ahora) -> { hechos, en_curso, parados }` (origen empieza por "diego", alta últimos 7 días), `sinAcentos(s)`, `COLUMNAS = [['backlog','Backlog'],['por_hacer','Por hacer'],['en_curso','En curso'],['bloqueado','Bloqueado'],['hecho','Hecho']]`.

- [ ] **Step 1: Test**

```js
// public/hq/test/estado.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { derivar, kanban, filtrar, semana, sinAcentos, COLUMNAS } from '../app/estado.js';

const datos = {
  objetivos: [{ horizonte: 2026, meta_eur: 300000 }],
  bloques: [{ letra: 'A', nombre: 'Licitaciones', meta_eur: 200000, encargos_abiertos: 2 }, { letra: 'B', nombre: 'Subvenciones', meta_eur: 105000, encargos_abiertos: 0 }],
  frentes: [{ id: 1, codigo: 'A1', bloque_letra: 'A', linea: 'Fuentes', encargos_abiertos: 1 }, { id: 2, codigo: 'A3', bloque_letra: 'A', linea: 'Ofertas', encargos_abiertos: 1 }, { id: 3, codigo: 'B1', bloque_letra: 'B', linea: 'ACCIÓ', encargos_abiertos: 0 }],
  encargos: [
    { id: 10, codigo: 'A1', bloque_letra: 'A', texto: 'Fuente Murcia', estado: 'en_curso', columna: 'en_curso', agente: 'Ariadna', responsable: 'Ariadna', rojo: true, orden_kanban: null, fecha_hito: '2026-09-18', origen: 'Diego 16-09 10:00', fecha: '2026-09-16T10:00:00Z', etiquetas: ['urgente'] },
    { id: 11, codigo: 'A3', bloque_letra: 'A', texto: 'Oferta Durango', estado: 'encolado', columna: 'por_hacer', agente: 'Guillem', responsable: 'Guillem', rojo: false, orden_kanban: 2, fecha_hito: '2026-09-18', origen: 'chief', fecha: '2026-09-15T10:00:00Z', etiquetas: [] },
    { id: 12, codigo: 'A3', bloque_letra: 'A', texto: 'Oferta Calp', estado: 'encolado', columna: 'por_hacer', agente: 'Guillem', responsable: 'Guillem', rojo: false, orden_kanban: 1, fecha_hito: null, origen: 'Diego 01-09 10:00', fecha: '2026-09-01T10:00:00Z', etiquetas: [] },
    { id: 13, codigo: 'A1', bloque_letra: 'A', texto: 'Hecho viejo', estado: 'hecho', columna: 'hecho', agente: 'Ariadna', responsable: 'Ariadna', rojo: false, orden_kanban: null, fecha_hito: null, origen: 'Diego 15-09 09:00', fecha: '2026-09-15T09:00:00Z', etiquetas: [] },
  ],
};
const ahora = new Date('2026-09-17T07:00:00Z');

test('derivar anida bloques y frentes y cuenta rojos', () => {
  const d = derivar(datos);
  assert.equal(d.bloques.length, 2);
  assert.deepEqual(d.bloques[0].frentes.map(f => f.codigo), ['A1', 'A3']);
  assert.equal(d.bloques[0].rojos, 1); assert.equal(d.bloques[1].frentes.length, 1);
});
test('kanban agrupa por columna y ordena por orden_kanban, hito, id', () => {
  const k = kanban(datos.encargos, {});
  assert.deepEqual(Object.keys(k), COLUMNAS.map(c => c[0]));
  assert.deepEqual(k.por_hacer.map(e => e.id), [12, 11]);
  assert.deepEqual(k.en_curso.map(e => e.id), [10]); assert.deepEqual(k.backlog, []);
});
test('filtrar por frente, bloque, agente, texto y etiqueta', () => {
  assert.deepEqual(filtrar(datos.encargos, { frente: 'A3' }).map(e => e.id), [11, 12]);
  assert.deepEqual(filtrar(datos.encargos, { bloque: 'A', agente: 'Ariadna' }).map(e => e.id), [10, 13]);
  assert.deepEqual(filtrar(datos.encargos, { texto: 'murcia' }).map(e => e.id), [10]);
  assert.deepEqual(filtrar(datos.encargos, { etiqueta: 'urgente' }).map(e => e.id), [10]);
});
test('semana: solo lo pedido por Diego en 7 días', () => {
  const s = semana(datos.encargos, ahora);
  assert.deepEqual(s.parados.map(e => e.id), [10]); assert.deepEqual(s.hechos.map(e => e.id), [13]); assert.deepEqual(s.en_curso, []);
});
test('sinAcentos', () => { assert.equal(sinAcentos('ACCIÓ Ñu'), 'accio nu'); });
```

- [ ] **Step 2: Ejecutar** → FAIL.

- [ ] **Step 3: `estado.js`**

```js
// Estado en memoria y funciones puras de la interfaz. Sin DOM: se prueba con node --test.
export const S = { datos: null, filtros: { frente: null, bloque: null, agente: null, texto: '', etiqueta: null }, columnaMovil: 'en_curso' };
export const COLUMNAS = [['backlog', 'Backlog'], ['por_hacer', 'Por hacer'], ['en_curso', 'En curso'], ['bloqueado', 'Bloqueado'], ['hecho', 'Hecho']];
export function poner(datos) { S.datos = datos; S.derivado = derivar(datos); }
export function sinAcentos(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

export function derivar(datos) {
  const porBloque = {};
  for (const f of datos.frentes || []) (porBloque[f.bloque_letra] ||= []).push(f);
  const rojosPorBloque = {};
  for (const e of datos.encargos || []) if (e.rojo) rojosPorBloque[e.bloque_letra] = (rojosPorBloque[e.bloque_letra] || 0) + 1;
  const bloques = (datos.bloques || []).map(b => ({ ...b, frentes: (porBloque[b.letra] || []).sort((x, y) => x.codigo.localeCompare(y.codigo)), abiertos: b.encargos_abiertos, rojos: rojosPorBloque[b.letra] || 0 }));
  return { objetivos: datos.objetivos || [], bloques };
}

export function filtrar(encargos, f = {}) {
  const t = sinAcentos(f.texto || '');
  return (encargos || []).filter(e =>
    (!f.frente || e.codigo === f.frente) && (!f.bloque || e.bloque_letra === f.bloque) &&
    (!f.agente || sinAcentos(e.agente).includes(sinAcentos(f.agente)) || sinAcentos(e.responsable) === sinAcentos(f.agente)) &&
    (!f.etiqueta || (e.etiquetas || []).includes(f.etiqueta)) &&
    (!t || sinAcentos([e.texto, e.interpretacion, e.origen, e.id].join(' ')).includes(t)));
}

const ordenKanban = (a, b) => (a.orden_kanban ?? 1e9) - (b.orden_kanban ?? 1e9) || String(a.fecha_hito || '9999').localeCompare(String(b.fecha_hito || '9999')) || a.id - b.id;
export function kanban(encargos, filtros = {}) {
  const k = Object.fromEntries(COLUMNAS.map(c => [c[0], []]));
  for (const e of filtrar(encargos, filtros)) (k[e.columna] || k.backlog).push(e);
  for (const c of Object.values(k)) c.sort(ordenKanban);
  return k;
}

export function semana(encargos, ahora = new Date()) {
  const desde = new Date(ahora.getTime() - 7 * 864e5);
  const pedidos = (encargos || []).filter(e => sinAcentos(e.origen).startsWith('diego') && new Date(e.fecha) >= desde);
  return { hechos: pedidos.filter(e => e.estado === 'hecho'), parados: pedidos.filter(e => e.rojo), en_curso: pedidos.filter(e => e.estado !== 'hecho' && e.estado !== 'descartado' && !e.rojo) };
}
```

- [ ] **Step 4: Ejecutar** → `node --test public/hq/test/` PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add public/hq/app/estado.js public/hq/test/estado.test.mjs
git commit -m "feat(hq-ui): estado con cascada, kanban, filtros y semana de Diego"
```

---

### Task 3: Vistas Inicio y Plan

**Files:**
- Create: `public/hq/app/vistas/inicio.js`, `public/hq/app/vistas/plan.js`, `public/hq/app/tarjeta.js` (tarjeta compacta de encargo reutilizada por inicio, plan y tablero)
- Modify: `public/hq/app/hq.css` (sección `/* inicio */` y `/* plan */`)
- Test: `public/hq/test/tarjeta.test.mjs`

**Interfaces:**
- Consumes: `S.datos`, `S.derivado` (T2), `semana()`, `filtrar()`, `el()`, `fecha()`, `eur()`, `horas()` (T1).
- Produces: `tarjeta.js` exporta `resumenEncargo(e) -> { codigo, titulo (≤90 chars), sub: 'Guillem · hito jue 18 · 51 h sin avance', clase: 'roja'|'' }` (puro) y `tarjetaEncargo(e, { onAbrir }) -> HTMLElement` (click abre `#tablero/<id>`). `inicio.js` y `plan.js` exportan `render(raiz, S, arg)`. `plan.js` al pulsar un frente navega a `#tablero/f/<codigo>` (el tablero lee `arg` = `f/A3` y fija `S.filtros.frente`).

- [ ] **Step 1: Test de `resumenEncargo`**

```js
// public/hq/test/tarjeta.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { resumenEncargo } from '../app/tarjeta.js';

const ahora = new Date('2026-09-16T12:00:00Z');
test('resumen recorta el texto y compone la línea secundaria', () => {
  const r = resumenEncargo({ id: 10, codigo: 'A1', texto: 'x'.repeat(120), agente: 'Ariadna', fecha_hito: '2026-09-18', fecha_avance: '2026-09-14T09:00:00Z', rojo: true, estado: 'en_curso' }, ahora);
  assert.equal(r.titulo.length, 90); assert.ok(r.titulo.endsWith('…'));
  assert.equal(r.sub, 'Ariadna · hito vie 18 · 51 h sin avance'); assert.equal(r.clase, 'roja');
});
test('resumen sin hito ni rojo', () => {
  const r = resumenEncargo({ id: 11, codigo: 'B1', texto: 'corto', agente: 'Helena', fecha_hito: null, fecha_avance: null, fecha: '2026-09-16T10:00:00Z', rojo: false, estado: 'encolado' }, ahora);
  assert.equal(r.sub, 'Helena · sin hito'); assert.equal(r.clase, '');
});
```

- [ ] **Step 2: Ejecutar** → FAIL.

- [ ] **Step 3: `tarjeta.js`, `inicio.js`, `plan.js` y CSS**

```js
// public/hq/app/tarjeta.js
import { el, fecha, horas } from './ui.js';
export function resumenEncargo(e, ahora = new Date()) {
  const t = String(e.texto || '');
  const partes = [e.agente || 'sin responsable', e.fecha_hito ? 'hito ' + fecha(e.fecha_hito) : 'sin hito'];
  if (e.rojo) partes.push(horas(e.fecha_avance || e.fecha, ahora) + ' h sin avance');
  return { codigo: e.codigo, titulo: t.length > 90 ? t.slice(0, 89) + '…' : t, sub: partes.join(' · '), clase: e.rojo ? 'roja' : '' };
}
export function tarjetaEncargo(e, { onAbrir } = {}) {
  const r = resumenEncargo(e);
  return el('article', { class: 'tarjeta encargo ' + r.clase, 'data-id': e.id, tabindex: 0, onclick: () => onAbrir ? onAbrir(e) : (location.hash = '#tablero/' + e.id) }, [
    el('div', { class: 'fila' }, [el('span', { class: 'pill codigo', text: r.codigo }), el('span', { class: 'mudo', text: '#' + e.id }), ...(e.etiquetas || []).map(x => el('span', { class: 'pill', text: x }))]),
    el('p', { class: 'titulo', text: r.titulo }), el('p', { class: 'mudo', text: r.sub })]);
}
```

```js
// public/hq/app/vistas/inicio.js
import { el, fecha, eur } from '../ui.js';
import { semana } from '../estado.js';
import { tarjetaEncargo } from '../tarjeta.js';

function bloque(titulo, kids, vacio) { return el('section', { class: 'seccion' }, [el('h2', { text: titulo }), ...(kids.length ? kids : [el('p', { class: 'mudo', text: vacio })])]); }

export function render(raiz, S) {
  const d = S.datos, s = semana(d.encargos);
  const obj = (d.objetivos || []).find(o => o.horizonte === new Date().getFullYear()) || d.objetivos?.[0];
  if (obj) raiz.append(el('section', { class: 'objetivo' }, [
    el('p', { class: 'mudo', text: 'Objetivo ' + obj.horizonte }),
    el('h1', { text: eur(obj.contratado_eur) + ' de ' + eur(obj.meta_eur) }),
    el('p', { class: 'mudo', text: 'presentado: ' + eur(obj.presentado_eur) + ' · KPI semanal ' + eur(obj.kpi_semanal_eur) }),
    el('div', { class: 'barra' }, [el('i', { style: 'width:' + Math.min(100, 100 * (obj.contratado_eur || 0) / (obj.meta_eur || 1)) + '%' })])]));
  const pend = d.pendientes || [];
  raiz.append(bloque('Lo que depende de ti', pend.slice(0, 8).map(p => el('a', { class: 'tarjeta enlace', href: '#decisiones/' + p.id }, [
    el('p', { class: 'titulo', text: p.titulo }), el('p', { class: 'mudo', text: [p.agente, p.vence ? 'vence ' + fecha(p.vence, { hora: true }) : null].filter(Boolean).join(' · ') })])), 'nada pendiente'));
  if (pend.length > 8) raiz.append(el('a', { class: 'btn-enlace', href: '#decisiones', text: 'ver las ' + pend.length }));
  raiz.append(bloque('Lo que pediste esta semana', [
    ...s.parados.map(e => tarjetaEncargo(e)), ...s.en_curso.map(e => tarjetaEncargo(e)),
    s.hechos.length ? el('p', { class: 'mudo', text: 'hechos: ' + s.hechos.map(e => '#' + e.id).join(', ') }) : null].filter(Boolean), 'sin peticiones tuyas en 7 días'));
  const rojos = (d.encargos || []).filter(e => e.rojo && !s.parados.includes(e));
  raiz.append(bloque('Parados más de 48 h', rojos.slice(0, 10).map(e => tarjetaEncargo(e)), 'ninguno'));
  const ses = (d.sesiones || []).filter(x => x.estado !== 'cerrada');
  raiz.append(bloque('Sesiones abiertas', ses.map(x => el('a', { class: 'tarjeta enlace', href: '#expedientes/' + x.expediente_id }, [el('p', { class: 'titulo', text: x.expediente_nombre + ' con ' + x.agente }), el('p', { class: 'mudo', text: x.estado + ' · ' + fecha(x.abierta || x.created_at, { hora: true }) })])), 'ninguna'));
  raiz.append(el('p', { class: 'mudo pie' }, [el('a', { href: '/hq/v1/', text: 'HQ v1 (licitaciones y contactos)' }), ' · ', el('button', { class: 'btn-enlace', 'data-salir': true, text: 'salir' })]));
}
```

```js
// public/hq/app/vistas/plan.js
import { el, eur } from '../ui.js';
export function render(raiz, S) {
  const d = S.derivado;
  for (const o of d.objetivos) raiz.append(el('section', { class: 'objetivo' }, [el('p', { class: 'mudo', text: 'Objetivo ' + o.horizonte }), el('h1', { text: o.texto || eur(o.meta_eur) }), el('p', { class: 'mudo', text: 'contratado ' + eur(o.contratado_eur) + ' · presentado ' + eur(o.presentado_eur) })]));
  for (const b of d.bloques) raiz.append(el('section', { class: 'bloque' }, [
    el('div', { class: 'fila bloque-cab' }, [el('span', { class: 'pill codigo', text: b.letra }), el('h2', { text: b.nombre }), el('span', { class: 'mudo', text: (b.meta_eur ? eur(b.meta_eur) + ' · ' : '') + b.abiertos + ' abiertos' + (b.rojos ? ' · ' + b.rojos + ' rojos' : '') })]),
    el('div', { class: 'frentes' }, b.frentes.map(f => el('a', { class: 'tarjeta frente enlace' + (f.encargos_abiertos ? '' : ' vacio'), href: '#tablero/f/' + f.codigo }, [
      el('div', { class: 'fila' }, [el('span', { class: 'pill codigo', text: f.codigo }), el('strong', { text: f.linea })]),
      el('p', { class: 'mudo', text: [f.responsable, f.kpi ? f.kpi + ': ' + (f.valor_actual ?? '?') + (f.meta != null ? ' / ' + f.meta : '') + (f.unidad ? ' ' + f.unidad : '') : null, f.encargos_abiertos + ' abiertos'].filter(Boolean).join(' · ') })])))]));
  if (!d.bloques.length) raiz.append(el('p', { class: 'mudo', text: 'Sin bloques: ejecuta el plan 1 (T3) o revisa omc_hq_v2.' }));
}
```

CSS a añadir en `hq.css`:

```css
/* inicio y plan */
.seccion{margin:18px 0}.seccion h2{font-size:17px;margin-bottom:8px}
.objetivo{padding:14px;border-radius:var(--radio);background:var(--marino);color:var(--marfil);margin-bottom:14px}.objetivo .mudo{color:var(--marfil);opacity:.75}
.barra{height:6px;background:rgba(255,255,255,.2);border-radius:3px;margin-top:10px;overflow:hidden}.barra i{display:block;height:100%;background:var(--oro)}
.tarjeta.enlace{display:block;text-decoration:none}.tarjeta .titulo{margin:4px 0 2px;font-weight:500}
.bloque{margin:18px 0}.bloque-cab h2{font-size:18px}.frentes{display:grid;gap:8px;margin-top:8px}.frente.vacio{opacity:.6}
@media (min-width:900px){.frentes{grid-template-columns:repeat(auto-fill,minmax(280px,1fr))}}
```

- [ ] **Step 4: Ejecutar** → `node --test public/hq/test/` PASS (10). En el navegador local: `#inicio` muestra objetivo, pendientes, semana, rojos y sesiones; `#plan` muestra 5 bloques con sus frentes; pulsar un frente lleva a `#tablero/f/<codigo>` (el tablero llega en T4: de momento "pendiente").

- [ ] **Step 5: Commit**

```bash
git add public/hq/app public/hq/test/tarjeta.test.mjs
git commit -m "feat(hq-ui): vistas inicio y plan con la cascada objetivo, bloques y frentes"
```

---

### Task 4: Tablero Kanban con tarjeta editable

**Files:**
- Create: `public/hq/app/vistas/tablero.js`, `public/hq/app/detalle.js` (modal de detalle y edición de un encargo), `public/hq/app/dnd.js` (arrastrar y soltar, puro donde se pueda)
- Modify: `public/hq/app/hq.css` (sección `/* tablero */`), `public/hq/app/main.js` (exportar `recargar`, ya hecho en T1)
- Test: `public/hq/test/dnd.test.mjs`

**Interfaces:**
- Consumes RPC del plan 1 (todas con `p_token` implícito en `rpc()`): `omc_encargo_alta(p jsonb)` con `{texto, frente, responsable, prioridad, fecha_hito, etiquetas}` (T4 plan 1), `omc_encargo_tomar(p_id, p_agente)`, `omc_encargo_editar(p_id, p jsonb)` con claves `texto, interpretacion, frente, agente, prioridad, fecha_hito, etiquetas, enlaces, orden_kanban` (T5 plan 1), `omc_encargo_estado(p_id, p_estado, p_motivo)` (bloqueado_diego / encolado / descartado), `omc_encargo_hecho(p_id, p_fuente, p_texto, p_agente)` (rechaza sin fuente), `omc_encargo_avance(p_id, p_texto, p_agente)`, `omc_encargo_ficha(p_id)` → `{encargo, frente, kit, avances[], contactos[], expediente}` (T13 plan 1). Confirmar los nombres exactos en `scripts/hq/schema-v2.sql` antes de escribir; si alguna firma difiere, adaptar aquí, nunca en la base.
- Produces: `dnd.js` exporta `accionAlSoltar(estadoOrigen, columnaDestino) -> { tipo: 'tomar'|'hecho'|'bloquear'|'reabrir'|'descartar'|'nada'|'prohibido' }` (puro) y `habilitarArrastre(contenedor, { onSoltar(id, columna, indice) })`. `detalle.js` exporta `abrirDetalle(id, S, recargar)`.

Reglas de movimiento (puro, testeable): a `en_curso` desde backlog/por_hacer/bloqueado = `tomar` (el responsable es `S.datos.rol === 'owner' ? encargo.agente : yo`); a `hecho` desde cualquier columna viva = `hecho` (pide fuente); a `bloqueado` = `bloquear` (pide motivo); a `backlog` o `por_hacer` desde `en_curso`/`bloqueado` = `reabrir` (`omc_encargo_estado` a `encolado`, y `omc_encargo_editar` con `fecha_hito` null si va a backlog); desde `hecho` a cualquier viva = `reabrir`; misma columna = `nada` (solo reorden con `orden_kanban`). Solo el owner mueve tarjetas de otros; un agente solo las suyas (la base ya lo impone; la UI oculta el arrastre).

- [ ] **Step 1: Test de `accionAlSoltar`**

```js
// public/hq/test/dnd.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { accionAlSoltar } from '../app/dnd.js';
test('movimientos del kanban', () => {
  assert.equal(accionAlSoltar('por_hacer', 'en_curso').tipo, 'tomar');
  assert.equal(accionAlSoltar('bloqueado', 'en_curso').tipo, 'tomar');
  assert.equal(accionAlSoltar('en_curso', 'hecho').tipo, 'hecho');
  assert.equal(accionAlSoltar('en_curso', 'bloqueado').tipo, 'bloquear');
  assert.equal(accionAlSoltar('en_curso', 'backlog').tipo, 'reabrir');
  assert.equal(accionAlSoltar('hecho', 'por_hacer').tipo, 'reabrir');
  assert.equal(accionAlSoltar('backlog', 'por_hacer').tipo, 'planificar');
  assert.equal(accionAlSoltar('por_hacer', 'por_hacer').tipo, 'nada');
});
```

- [ ] **Step 2: Ejecutar** → FAIL.

- [ ] **Step 3: `dnd.js`, `detalle.js`, `tablero.js`, CSS**

```js
// public/hq/app/dnd.js
export function accionAlSoltar(origen, destino) {
  if (origen === destino) return { tipo: 'nada' };
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
```

```js
// public/hq/app/detalle.js · modal de un encargo: ficha, edición, hilo, acciones
import { rpc } from './api.js';
import { el, modal, toast, fecha } from './ui.js';

const yo = S => S.datos.rol === 'owner' ? 'diego' : S.datos.yo;
export function pedirTexto(titulo, etiqueta, obligatorio = true) {
  return new Promise(res => {
    const campo = el('textarea', { rows: 3, placeholder: etiqueta });
    const m = modal({ titulo, cuerpo: [campo], acciones: [el('button', { class: 'btn', text: 'Cancelar', onclick: () => { m.cerrar(); res(null); } }),
      el('button', { class: 'btn primario', text: 'Guardar', onclick: () => { if (obligatorio && !campo.value.trim()) { campo.focus(); return; } m.cerrar(); res(campo.value.trim()); } })] });
    setTimeout(() => campo.focus(), 50);
  });
}
export async function moverEncargo(e, accion, S, recargar) {
  try {
    if (accion.tipo === 'tomar') await rpc('omc_encargo_tomar', { p_id: e.id, p_agente: S.datos.rol === 'owner' ? e.agente : yo(S) });
    else if (accion.tipo === 'hecho') { const fuente = await pedirTexto('Cerrar #' + e.id, 'Fuente del cierre: URL del Google Doc, del kit o del correo enviado (obligatoria)'); if (fuente == null) return; const texto = await pedirTexto('Qué se ha hecho', 'Una o dos líneas', false); await rpc('omc_encargo_hecho', { p_id: e.id, p_fuente: fuente, p_texto: texto || 'cerrado desde HQ', p_agente: yo(S) }); }
    else if (accion.tipo === 'bloquear') { const motivo = await pedirTexto('Bloquear #' + e.id, 'Qué falta de Diego'); if (motivo == null) return; await rpc('omc_encargo_estado', { p_id: e.id, p_estado: 'bloqueado_diego', p_motivo: motivo }); }
    else if (accion.tipo === 'reabrir') { await rpc('omc_encargo_estado', { p_id: e.id, p_estado: 'encolado', p_motivo: 'reabierto desde HQ' }); if (accion.destino === 'backlog') await rpc('omc_encargo_editar', { p_id: e.id, p: { fecha_hito: null } }); }
    else if (accion.tipo === 'planificar') { if (accion.destino === 'backlog') await rpc('omc_encargo_editar', { p_id: e.id, p: { fecha_hito: null } }); else { const hito = await pedirTexto('Planificar #' + e.id, 'Fecha del hito (AAAA-MM-DD)'); if (!hito) return; await rpc('omc_encargo_editar', { p_id: e.id, p: { fecha_hito: hito } }); } }
    else if (accion.tipo === 'descartar') { const motivo = await pedirTexto('Descartar #' + e.id, 'Motivo del descarte'); if (motivo == null) return; await rpc('omc_encargo_estado', { p_id: e.id, p_estado: 'descartado', p_motivo: motivo }); }
    toast('#' + e.id + ' ' + accion.tipo); await recargar();
  } catch (err) { toast('HQ rechaza: ' + err.message); }
}
export async function abrirDetalle(id, S, recargar) {
  let f; try { f = await rpc('omc_encargo_ficha', { p_id: id }); } catch (err) { toast(err.message); return; }
  const e = f.encargo, owner = S.datos.rol === 'owner';
  const campos = { texto: el('textarea', { rows: 3 }, [e.texto || '']), interpretacion: el('textarea', { rows: 2, placeholder: 'Interpretación del chief' }, [e.interpretacion || '']),
    frente: el('select', {}, (S.datos.frentes || []).map(x => el('option', { value: x.codigo, selected: x.codigo === e.codigo, text: x.codigo + ' ' + x.linea }))),
    agente: el('select', {}, (S.datos.agentes || []).map(a => el('option', { value: a.id, selected: a.id === e.agente, text: a.nombre + ' (' + a.id + ')' }))),
    prioridad: el('input', { class: 'campo', type: 'number', min: 0, max: 9, value: e.prioridad ?? 0 }), fecha_hito: el('input', { class: 'campo', type: 'date', value: e.fecha_hito || '' }),
    etiquetas: el('input', { class: 'campo', placeholder: 'etiquetas separadas por coma', value: (e.etiquetas || []).join(', ') }), enlaces: el('textarea', { rows: 2, placeholder: 'un enlace por línea' }, [(e.enlaces || []).join('\n')]) };
  const fila = (nombre, c) => el('label', { class: 'campo-l' }, [el('span', { class: 'mudo', text: nombre }), c]);
  const hilo = el('div', { class: 'hilo' }, (f.avances || []).map(a => el('div', { class: 'avance' }, [el('span', { class: 'mudo', text: fecha(a.ts || a.fecha, { hora: true }) + ' · ' + a.autor + ' · ' + a.tipo }), el('p', { text: a.texto })])));
  const nuevo = el('textarea', { rows: 2, placeholder: 'Comentario o avance' });
  const guardar = async () => {
    const p = { texto: campos.texto.value.trim(), interpretacion: campos.interpretacion.value.trim(), frente: campos.frente.value, agente: campos.agente.value, prioridad: Number(campos.prioridad.value), fecha_hito: campos.fecha_hito.value || null,
      etiquetas: campos.etiquetas.value.split(',').map(s => s.trim()).filter(Boolean), enlaces: campos.enlaces.value.split('\n').map(s => s.trim()).filter(Boolean) };
    try { await rpc('omc_encargo_editar', { p_id: id, p }); toast('#' + id + ' guardado'); m.cerrar(); await recargar(); } catch (err) { toast('HQ rechaza: ' + err.message); }
  };
  const comentar = async () => { if (!nuevo.value.trim()) return; try { await rpc('omc_encargo_avance', { p_id: id, p_texto: nuevo.value.trim(), p_agente: yo(S) }); m.cerrar(); await recargar(); abrirDetalle(id, S, recargar); } catch (err) { toast(err.message); } };
  const acciones = [el('button', { class: 'btn peligro', text: 'Descartar', onclick: () => { m.cerrar(); moverEncargo(e, { tipo: 'descartar' }, S, recargar); } }),
    e.estado !== 'hecho' ? el('button', { class: 'btn', text: 'Cerrar con fuente', onclick: () => { m.cerrar(); moverEncargo(e, { tipo: 'hecho' }, S, recargar); } }) : null,
    owner ? el('button', { class: 'btn primario', text: 'Guardar', onclick: guardar }) : null];
  const m = modal({ titulo: '#' + id + ' · ' + e.codigo + ' · ' + e.estado, acciones, cuerpo: [
    el('p', { class: 'mudo', text: [e.origen, 'alta ' + fecha(e.fecha, { hora: true }), e.fecha_avance ? 'último avance ' + fecha(e.fecha_avance, { hora: true }) : null].filter(Boolean).join(' · ') }),
    f.expediente ? el('a', { href: '#expedientes/' + f.expediente.id, class: 'pill', text: 'expediente: ' + f.expediente.nombre }) : null,
    owner ? el('div', { class: 'form' }, [fila('Texto', campos.texto), fila('Interpretación', campos.interpretacion), el('div', { class: 'dos' }, [fila('Frente', campos.frente), fila('Responsable', campos.agente)]), el('div', { class: 'dos' }, [fila('Prioridad (0 alta, 9 baja)', campos.prioridad), fila('Hito', campos.fecha_hito)]), fila('Etiquetas', campos.etiquetas), fila('Enlaces', campos.enlaces)])
      : el('div', {}, [el('p', { text: e.texto }), e.interpretacion ? el('p', { class: 'mudo', text: e.interpretacion }) : null, ...(e.enlaces || []).map(u => el('a', { href: u, target: '_blank', rel: 'noopener', text: u }))]),
    f.kit?.length ? el('details', {}, [el('summary', { text: 'Kit del frente (' + f.kit.length + ')' }), ...f.kit.map(k => el('a', { href: k.url, target: '_blank', rel: 'noopener', class: 'kit', text: k.titulo }))]) : null,
    el('h3', { text: 'Hilo' }), hilo, el('div', { class: 'fila' }, [nuevo, el('button', { class: 'btn', text: 'Enviar', onclick: comentar })])] });
}
```

```js
// public/hq/app/vistas/tablero.js
import { rpc } from '../api.js';
import { el, modal, toast } from '../ui.js';
import { kanban, COLUMNAS } from '../estado.js';
import { tarjetaEncargo } from '../tarjeta.js';
import { accionAlSoltar, habilitarArrastre } from '../dnd.js';
import { abrirDetalle, moverEncargo } from '../detalle.js';
import { recargar } from '../main.js';

function filtros(S, pintar) {
  const d = S.datos, f = S.filtros;
  const sel = (clave, opciones, todo) => el('select', { class: 'campo mini', onchange: e => { f[clave] = e.target.value || null; pintar(); } }, [el('option', { value: '', text: todo }), ...opciones.map(([v, t]) => el('option', { value: v, selected: f[clave] === v, text: t }))]);
  const etiquetas = [...new Set((d.encargos || []).flatMap(e => e.etiquetas || []))].sort();
  return el('div', { class: 'filtros fila' }, [
    sel('bloque', (d.bloques || []).map(b => [b.letra, b.letra + ' ' + b.nombre]), 'Todos los bloques'),
    sel('frente', (d.frentes || []).filter(x => !f.bloque || x.bloque_letra === f.bloque).map(x => [x.codigo, x.codigo + ' ' + x.linea]), 'Todos los frentes'),
    sel('agente', (d.agentes || []).map(a => [a.id, a.nombre]), 'Todos'), etiquetas.length ? sel('etiqueta', etiquetas.map(x => [x, x]), 'Etiquetas') : null,
    el('input', { class: 'campo mini', placeholder: 'buscar', value: f.texto, oninput: e => { f.texto = e.target.value; pintar(); } }),
    (f.frente || f.bloque || f.agente || f.etiqueta || f.texto) ? el('button', { class: 'btn-enlace', text: 'quitar filtros', onclick: () => { Object.assign(f, { frente: null, bloque: null, agente: null, etiqueta: null, texto: '' }); pintar(); } }) : null,
    el('button', { class: 'btn primario', text: '+ Encargo', onclick: () => nuevoEncargo(S) })]);
}
function nuevoEncargo(S) {
  const d = S.datos, f = S.filtros;
  const texto = el('textarea', { rows: 3, placeholder: 'Qué hay que hacer (empieza por el verbo)' });
  const frente = el('select', {}, [el('option', { value: '', text: 'Frente (obligatorio)' }), ...(d.frentes || []).map(x => el('option', { value: x.codigo, selected: x.codigo === f.frente, text: x.codigo + ' ' + x.linea }))]);
  const resp = el('select', {}, [el('option', { value: '', text: 'Responsable (por defecto el del frente)' }), ...(d.agentes || []).map(a => el('option', { value: a.id, text: a.nombre }))]);
  const hito = el('input', { class: 'campo', type: 'date' }), etiq = el('input', { class: 'campo', placeholder: 'etiquetas separadas por coma' });
  const m = modal({ titulo: 'Nuevo encargo', cuerpo: [texto, frente, resp, hito, etiq], acciones: [el('button', { class: 'btn', text: 'Cancelar', onclick: () => m.cerrar() }), el('button', { class: 'btn primario', text: 'Crear', onclick: async () => {
    if (!texto.value.trim() || !frente.value) { toast('texto y frente son obligatorios'); return; }
    try { const r = await rpc('omc_encargo_alta', { p: { texto: texto.value.trim(), frente: frente.value, responsable: resp.value || null, fecha_hito: hito.value || null, etiquetas: etiq.value.split(',').map(s => s.trim()).filter(Boolean), origen: 'Diego HQ ' + new Date().toISOString().slice(0, 16).replace('T', ' ') } }); m.cerrar(); toast('encargo #' + (r.id || r.encargo?.id) + ' creado'); await recargar(); } catch (err) { toast('HQ rechaza: ' + err.message); } } })] });
}
export function render(raiz, S, arg) {
  if (arg && arg.startsWith('f/')) { S.filtros.frente = arg.slice(2); history.replaceState(null, '', '#tablero'); }
  else if (arg && /^\d+$/.test(arg)) { history.replaceState(null, '', '#tablero'); abrirDetalle(Number(arg), S, recargar); }
  const movil = matchMedia('(max-width: 899px)').matches;
  const cont = el('div', { class: 'kanban' + (movil ? ' movil' : '') });
  const pintar = () => {
    raiz.querySelector('.filtros')?.remove(); raiz.prepend(filtros(S, pintar));
    const k = kanban(S.datos.encargos, S.filtros); cont.innerHTML = '';
    if (movil) cont.append(el('div', { class: 'pestanas' }, COLUMNAS.map(([c, t]) => el('button', { class: 'btn' + (S.columnaMovil === c ? ' primario' : ''), text: t + ' ' + k[c].length, onclick: () => { S.columnaMovil = c; pintar(); } }))));
    for (const [c, t] of COLUMNAS) {
      if (movil && c !== S.columnaMovil) continue;
      cont.append(el('section', { class: 'columna', 'data-columna': c }, [el('h2', {}, [t, el('span', { class: 'mudo', text: ' ' + k[c].length })]), ...k[c].map(e => {
        const tj = tarjetaEncargo(e, { onAbrir: x => abrirDetalle(x.id, S, recargar) });
        if (S.datos.rol === 'owner' || e.agente === S.datos.yo) { tj.draggable = !movil; tj.append(el('button', { class: 'btn-enlace mover', text: 'mover', onclick: ev => { ev.stopPropagation(); menuMover(e, S); } })); }
        return tj; })]));
    }
  };
  habilitarArrastre(cont, { onSoltar: async (id, columna, indice) => {
    const e = S.datos.encargos.find(x => x.id === id); if (!e) return;
    const a = accionAlSoltar(e.columna, columna); a.destino = columna;
    if (a.tipo === 'nada') { try { const vecinos = kanban(S.datos.encargos, S.filtros)[columna].filter(x => x.id !== id); const orden = indice === 0 ? (vecinos[0]?.orden_kanban ?? 1000) - 10 : indice >= vecinos.length ? (vecinos.at(-1)?.orden_kanban ?? 0) + 10 : Math.floor(((vecinos[indice - 1].orden_kanban ?? 0) + (vecinos[indice].orden_kanban ?? 1000)) / 2); await rpc('omc_encargo_editar', { p_id: id, p: { orden_kanban: orden } }); await recargar(); } catch (err) { toast(err.message); } return; }
    await moverEncargo(e, a, S, recargar);
  } });
  raiz.append(cont); pintar();
}
function menuMover(e, S) {
  const m = modal({ titulo: 'Mover #' + e.id, cuerpo: COLUMNAS.filter(([c]) => c !== e.columna).map(([c, t]) => el('button', { class: 'btn ancho', text: t, onclick: () => { m.cerrar(); const a = accionAlSoltar(e.columna, c); a.destino = c; moverEncargo(e, a, S, recargar); } })) });
}
```

`S.datos.yo` = id del agente del token (`omc_hq_v2` devuelve `yo` para tokens de agente; si el contrato T16 no lo trae, añadir `'yo', t.nombre` allí). En `main.js` la importación circular `tablero.js ↔ main.js` funciona con módulos ES porque `recargar` se usa solo en tiempo de ejecución.

CSS:

```css
/* tablero */
.filtros{margin-bottom:10px}.campo.mini{width:auto;min-width:120px;padding:6px 8px;font-size:14px}
.kanban{display:grid;gap:10px;align-items:start}
@media (min-width:900px){.kanban{grid-template-columns:repeat(5,minmax(200px,1fr));overflow-x:auto}}
.columna{background:var(--pizarra-tenue);border-radius:var(--radio);padding:8px;min-height:120px}.columna.sobre{outline:2px solid var(--oro)}
.columna h2{font-size:14px;text-transform:uppercase;letter-spacing:.04em;margin:2px 4px 8px;color:var(--tinta-2)}
.encargo{cursor:pointer;position:relative}.encargo.arrastrando{opacity:.4}.encargo .mover{position:absolute;right:10px;bottom:8px;font-size:12px}
.pestanas{display:flex;gap:6px;overflow-x:auto;padding-bottom:6px}.pestanas .btn{white-space:nowrap;font-size:13px;padding:6px 10px}
.form{display:grid;gap:8px}.dos{display:grid;gap:8px;grid-template-columns:1fr 1fr}.campo-l{display:grid;gap:3px;font-size:14px}
.hilo{display:grid;gap:8px;max-height:40vh;overflow:auto;margin:8px 0}.avance p{margin:2px 0 0}.kit{display:block;font-size:14px}.btn.ancho{width:100%;margin-bottom:6px}
```

- [ ] **Step 4: Ejecutar** → `node --test public/hq/test/` PASS (11). En local, con el tenant `pruebas` (token de prueba de `pg.entorno_cli`), comprobar: crear encargo sin frente falla con toast; con frente aparece en Por hacer o Backlog según hito; arrastrar a En curso lo pone en_curso (y `hq.py encargo ficha ID` lo confirma); arrastrar a Hecho sin fuente no cierra; con fuente cierra; reorden dentro de una columna persiste tras recargar; en móvil (390 px, DevTools) pestañas por columna y botón "mover" funcionan; el detalle guarda texto, frente, responsable, hito y etiquetas.

- [ ] **Step 5: Commit**

```bash
git add public/hq/app public/hq/test/dnd.test.mjs
git commit -m "feat(hq-ui): tablero kanban con arrastre, tarjeta editable e hilo"
```

---

### Task 5: Decisiones (paridad con la v1)

**Files:**
- Create: `public/hq/app/vistas/decisiones.js`
- Modify: `public/hq/app/hq.css` (sección `/* decisiones */`)
- Test: manual (no hay lógica pura nueva; la única función pura, `agrupar(pendientes)`, se prueba en `public/hq/test/decisiones.test.mjs`)

**Interfaces:**
- Consumes de `omc_hq_v2`: `pendientes[]` (solo owner) con `{id, tipo, titulo, detalle, agente, depto, importe, riesgo, enlace, vence, prioridad, estado, created_at, pospuesta_hasta, mensajes: [{autor, texto, ts}]}` (mismo formato que `omc_hq` en la v1: comprobar en `public/hq/v1/index.html` líneas 463-640 cómo lee `S.hq.pendientes` y copiar los nombres); `licitaciones[]` con `{expediente, titulo, organo, importe, fin_ofertas, resumen_corto, solvencia, decision}`; RPC de la v1 sin cambios: `omc_comentar(p_token, p_id, p_texto)`, `omc_resolver(p_token, p_id, p_estado, p_respuesta)` con estado `aprobada|rechazada|respondida`, `omc_posponer(p_token, p_id, p_hasta)`, `omc_licitacion_decidir(p_token, p_expediente, p_decision, p_motivos, p_texto)` con decision `presentar|descartar|estudiar`.
- Produces: `agrupar(pendientes, ahora) -> { hoy: [], semana: [], resto: [], pospuestas: [] }` por `vence`; `render(raiz, S, arg)` (arg = id abre esa tarjeta desplegada).

- [ ] **Step 1: Test**

```js
// public/hq/test/decisiones.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { agrupar } from '../app/vistas/decisiones.js';
const ahora = new Date('2026-09-16T12:00:00Z');
test('agrupar por vencimiento', () => {
  const g = agrupar([{ id: 1, vence: '2026-09-16T18:00:00Z' }, { id: 2, vence: '2026-09-19T10:00:00Z' }, { id: 3, vence: null }, { id: 4, vence: '2026-09-30', pospuesta_hasta: '2026-09-20T08:00:00Z' }], ahora);
  assert.deepEqual(g.hoy.map(x => x.id), [1]); assert.deepEqual(g.semana.map(x => x.id), [2]); assert.deepEqual(g.resto.map(x => x.id), [3]); assert.deepEqual(g.pospuestas.map(x => x.id), [4]);
});
```

`decisiones.js` no debe tocar el DOM al importarse (solo dentro de `render`).

- [ ] **Step 2: Ejecutar** → FAIL.

- [ ] **Step 3: `decisiones.js`**

```js
import { rpc } from '../api.js';
import { el, modal, toast, fecha, eur } from '../ui.js';
import { recargar } from '../main.js';

export function agrupar(pendientes, ahora = new Date()) {
  const finHoy = new Date(ahora); finHoy.setUTCHours(23, 59, 59, 999); const finSemana = new Date(ahora.getTime() + 7 * 864e5);
  const g = { hoy: [], semana: [], resto: [], pospuestas: [] };
  for (const p of pendientes || []) {
    if (p.pospuesta_hasta && new Date(p.pospuesta_hasta) > ahora) { g.pospuestas.push(p); continue; }
    const v = p.vence ? new Date(p.vence) : null;
    (v && v <= finHoy ? g.hoy : v && v <= finSemana ? g.semana : g.resto).push(p);
  }
  return g;
}
async function resolver(p, estado) {
  const campo = el('textarea', { rows: 3, placeholder: estado === 'aprobada' ? 'Instrucción para quien ejecuta (opcional)' : 'Motivo o respuesta' });
  const m = modal({ titulo: (estado === 'aprobada' ? 'Aprobar' : estado === 'rechazada' ? 'Rechazar' : 'Responder') + ' #' + p.id, cuerpo: [el('p', { text: p.titulo }), campo], acciones: [
    el('button', { class: 'btn', text: 'Cancelar', onclick: () => m.cerrar() }),
    el('button', { class: 'btn primario', text: 'Confirmar', onclick: async () => { if (estado !== 'aprobada' && !campo.value.trim()) { campo.focus(); return; } try { await rpc('omc_resolver', { p_id: p.id, p_estado: estado, p_respuesta: campo.value.trim() }); m.cerrar(); toast('#' + p.id + ' ' + estado); await recargar(); } catch (err) { toast(err.message); } } })] });
}
async function posponer(p) {
  const opciones = [['2 h', 2], ['mañana 9:00', 'm'], ['lunes 9:00', 'l']];
  const m = modal({ titulo: 'Posponer #' + p.id, cuerpo: opciones.map(([t, v]) => el('button', { class: 'btn ancho', text: t, onclick: async () => {
    const d = new Date(); if (v === 2) d.setHours(d.getHours() + 2); else { d.setDate(d.getDate() + (v === 'm' ? 1 : ((8 - d.getDay()) % 7) || 7)); d.setHours(9, 0, 0, 0); }
    try { await rpc('omc_posponer', { p_id: p.id, p_hasta: d.toISOString() }); m.cerrar(); toast('#' + p.id + ' hasta ' + fecha(d.toISOString(), { hora: true })); await recargar(); } catch (err) { toast(err.message); } } })) });
}
function tarjeta(p, abierta) {
  const det = el('details', { open: abierta }, [
    el('summary', {}, [el('div', { class: 'fila' }, [el('span', { class: 'pill', text: p.tipo }), el('strong', { text: p.titulo })]), el('p', { class: 'mudo', text: [p.agente, p.importe ? eur(p.importe) : null, p.vence ? 'vence ' + fecha(p.vence, { hora: true }) : null, p.riesgo].filter(Boolean).join(' · ') })]),
    el('div', { class: 'detalle', html: (p.detalle || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/(https?:\/\/[^\s)]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g, '<br>') }),
    p.enlace ? el('a', { href: p.enlace, target: '_blank', rel: 'noopener', class: 'btn-enlace', text: 'abrir enlace' }) : null,
    el('div', { class: 'hilo' }, (p.mensajes || []).map(mm => el('div', { class: 'avance' }, [el('span', { class: 'mudo', text: fecha(mm.ts, { hora: true }) + ' · ' + mm.autor }), el('p', { text: mm.texto })]))),
    el('div', { class: 'fila' }, [(() => { const c = el('input', { class: 'campo', placeholder: 'Comentar sin resolver' }); c.onkeydown = async ev => { if (ev.key === 'Enter' && c.value.trim()) { try { await rpc('omc_comentar', { p_id: p.id, p_texto: c.value.trim() }); c.value = ''; toast('comentado'); await recargar(); } catch (err) { toast(err.message); } } }; return c; })()]),
    el('div', { class: 'modal-acciones' }, [el('button', { class: 'btn', text: 'Posponer', onclick: () => posponer(p) }), el('button', { class: 'btn peligro', text: 'Rechazar', onclick: () => resolver(p, 'rechazada') }),
      p.tipo === 'duda' ? el('button', { class: 'btn primario', text: 'Responder', onclick: () => resolver(p, 'respondida') }) : el('button', { class: 'btn primario', text: 'Aprobar', onclick: () => resolver(p, 'aprobada') })])]);
  return el('article', { class: 'tarjeta decision', id: 'd' + p.id }, [det]);
}
function licitacion(l) {
  const decidir = async (decision) => { const texto = decision === 'presentar' ? '' : await new Promise(res => { const c = el('textarea', { rows: 2, placeholder: 'Motivo' }); const m = modal({ titulo: decision + ' ' + l.expediente, cuerpo: [c], acciones: [el('button', { class: 'btn primario', text: 'Confirmar', onclick: () => { m.cerrar(); res(c.value.trim()); } })] }); }); if (texto == null) return;
    try { await rpc('omc_licitacion_decidir', { p_expediente: l.expediente, p_decision: decision, p_motivos: [], p_texto: texto || '' }); toast(l.expediente + ': ' + decision); await recargar(); } catch (err) { toast(err.message); } };
  return el('article', { class: 'tarjeta licitacion' }, [el('div', { class: 'fila' }, [el('span', { class: 'pill codigo', text: l.expediente }), el('strong', { text: l.titulo })]),
    el('p', { class: 'mudo', text: [l.organo, l.importe ? eur(l.importe) + ' sin IVA' : null, l.fin_ofertas ? 'cierra ' + fecha(l.fin_ofertas, { hora: true }) : null].filter(Boolean).join(' · ') }),
    el('p', { text: l.resumen_corto || '' }), l.solvencia ? el('p', { class: 'mudo', text: 'solvencia: ' + (typeof l.solvencia === 'string' ? l.solvencia : JSON.stringify(l.solvencia)) }) : null,
    el('div', { class: 'modal-acciones' }, [el('button', { class: 'btn peligro', text: 'Descartar', onclick: () => decidir('descartar') }), el('button', { class: 'btn', text: 'Estudiar', onclick: () => decidir('estudiar') }), el('button', { class: 'btn primario', text: 'Presentar', onclick: () => decidir('presentar') })])]);
}
export function render(raiz, S, arg) {
  if (S.datos.rol !== 'owner') { raiz.append(el('p', { class: 'mudo', text: 'Las decisiones son de Diego. Tus tarjetas: hq.py activo.' })); return; }
  const g = agrupar(S.datos.pendientes); const abierta = Number(arg) || null;
  const sec = (t, xs) => xs.length ? el('section', { class: 'seccion' }, [el('h2', { text: t + ' (' + xs.length + ')' }), ...xs.map(p => tarjeta(p, p.id === abierta))]) : null;
  raiz.append(sec('Vence hoy', g.hoy), sec('Esta semana', g.semana), sec('Sin fecha', g.resto), sec('Pospuestas', g.pospuestas));
  const lic = (S.datos.licitaciones || []).filter(l => !l.decision);
  raiz.append(el('section', { class: 'seccion' }, [el('h2', { text: 'Licitaciones por decidir (' + lic.length + ')' }), ...lic.map(licitacion), el('a', { class: 'btn-enlace', href: '/hq/v1/#licita', text: 'histórico y fichas completas en HQ v1' })]));
  if (!S.datos.pendientes?.length && !lic.length) raiz.append(el('p', { class: 'mudo', text: 'Nada que decidir.' }));
  if (abierta) setTimeout(() => document.getElementById('d' + abierta)?.scrollIntoView({ block: 'start' }), 50);
}
```

Nota: en la v1 los `detalle` de tarjeta llegan como texto plano con enlaces sueltos; el `html:` de arriba escapa `&` y `<` antes de enlazar, así que no se inyecta nada. Si `omc_hq` ya devuelve `detalle_html` saneado, usar eso y quitar el reemplazo.

CSS:

```css
/* decisiones */
.decision summary{cursor:pointer;list-style:none}.decision summary::-webkit-details-marker{display:none}.decision .detalle{margin:8px 0;white-space:normal;word-break:break-word}
.licitacion .modal-acciones{justify-content:flex-start}
```

- [ ] **Step 4: Ejecutar** → PASS (12). Manual con el token owner **solo en local y con Diego avisado** (ojo: las tarjetas reales se resuelven de verdad; probar posponer 2 h sobre una tarjeta que Diego ya haya pospuesto o comentar en el tenant `pruebas` con una tarjeta creada por `hq.py --json pedir --agente probador --tipo duda ...`). Comprobar: aprobar, rechazar con motivo, responder duda, posponer, comentar, decidir licitación en `pruebas`.

- [ ] **Step 5: Commit**

```bash
git add public/hq/app/vistas/decisiones.js public/hq/app/hq.css public/hq/test/decisiones.test.mjs
git commit -m "feat(hq-ui): decisiones de Diego con paridad v1 (tarjetas y licitaciones)"
```

---

### Task 6: Equipo y expedientes con "Trabajar con <agente>"

**Files:**
- Create: `public/hq/app/vistas/equipo.js`, `public/hq/app/vistas/expedientes.js`
- Modify: `public/hq/app/hq.css` (sección `/* equipo y expedientes */`)
- Test: `public/hq/test/expedientes.test.mjs` (función pura `estadoSesion(expediente, sesiones)`)

**Interfaces:**
- Consumes de `omc_hq_v2`: `agentes[]` `{id, nombre, depto, nivel, jefe, modelo, frentes[], frentes_codigos[], cuenta, avatar_url, sesion_url (solo owner o el propio), encargos_abiertos, sesion_abierta, ultima_actividad, activo}`; `expedientes[]` `{id, tipo, nombre, codigo (frente), linea_id, responsable, ficha_url, carpeta_url, estado_funnel, entregables[], importe, resumen_estado, resumen_fecha, encargos_abiertos, sesion_abierta, activo}`; `sesiones[]` `{id, expediente_id, expediente_nombre, agente, estado, abierta, cerrada, resumen, created_at}`. RPC: `omc_expediente_ficha(p_id)` → `{expediente, frente, encargos, contactos, decisiones, sesiones, kit}` (T11), `omc_sesion_solicitar(p_expediente)` (owner) → fila de sesión, `omc_sesion_cerrar(p_sesion, p_resumen, p_entregables, p_agente)`, `omc_expediente_set(p)` (owner o chief; alta y edición), `omc_agente_frentes_set(p_agente, p_frentes text[])` (owner).
- Produces: `estadoSesion(expediente, sesiones) -> { hay: bool, estado: 'solicitada'|'abierta'|null, sesion }`; `render(raiz, S, arg)` en ambas vistas (`#equipo/<id>` abre la ficha del agente; `#expedientes/<id>` abre la ficha del expediente).

Flujo del botón "Trabajar con <agente>" (lo que se le contó a Diego el 16-sep): (1) `omc_sesion_solicitar` deja la fila `solicitada` (o devuelve la abierta); (2) si el agente tiene `sesion_url`, `location.href = sesion_url` en la misma pestaña (móvil incluido); si no la tiene, toast "el agente no ha publicado su sesión: hq.py agente sesion-url" y el botón queda en "Solicitada, esperando"; (3) hq-despertar inyecta la petición en la ventana del agente en <1 min (plan 1, T11). "Cerrar sesión" pide resumen y llama `omc_sesion_cerrar` con `p_agente` = el agente de la sesión; si la base rechaza por falta de avances, el toast enseña el motivo literal.

- [ ] **Step 1: Test**

```js
// public/hq/test/expedientes.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { estadoSesion } from '../app/vistas/expedientes.js';
test('estadoSesion prioriza abierta, luego solicitada, luego nada', () => {
  const ses = [{ id: 1, expediente_id: 5, estado: 'cerrada' }, { id: 2, expediente_id: 5, estado: 'solicitada' }, { id: 3, expediente_id: 6, estado: 'abierta' }];
  assert.deepEqual(estadoSesion({ id: 5 }, ses), { hay: true, estado: 'solicitada', sesion: ses[1] });
  assert.equal(estadoSesion({ id: 6 }, ses).estado, 'abierta');
  assert.deepEqual(estadoSesion({ id: 7 }, ses), { hay: false, estado: null, sesion: null });
});
```

- [ ] **Step 2: Ejecutar** → FAIL.

- [ ] **Step 3: `expedientes.js` y `equipo.js`**

```js
// public/hq/app/vistas/expedientes.js
import { rpc } from '../api.js';
import { el, modal, toast, fecha, eur } from '../ui.js';
import { tarjetaEncargo } from '../tarjeta.js';
import { pedirTexto } from '../detalle.js';
import { recargar } from '../main.js';

export function estadoSesion(exp, sesiones) {
  const mias = (sesiones || []).filter(s => s.expediente_id === exp.id);
  const s = mias.find(x => x.estado === 'abierta') || mias.find(x => x.estado === 'solicitada') || null;
  return { hay: !!s, estado: s ? s.estado : null, sesion: s };
}
async function trabajarCon(exp, S) {
  const ag = (S.datos.agentes || []).find(a => a.id === exp.responsable);
  try {
    const s = await rpc('omc_sesion_solicitar', { p_expediente: exp.id });
    if (ag?.sesion_url) { toast('abriendo la sesión de ' + ag.nombre); setTimeout(() => { location.href = ag.sesion_url; }, 400); }
    else { toast(ag ? ag.nombre + ' no ha publicado su sesión (hq.py agente sesion-url). Queda solicitada #' + s.id : 'sin responsable'); await recargar(); }
  } catch (err) { toast('HQ rechaza: ' + err.message); }
}
async function cerrarSesion(s, S) {
  const resumen = await pedirTexto('Cerrar sesión #' + s.id, 'Resumen de la sesión (obligatorio)'); if (resumen == null) return;
  try { await rpc('omc_sesion_cerrar', { p_sesion: s.id, p_resumen: resumen, p_entregables: [], p_agente: s.agente }); toast('sesión cerrada'); await recargar(); } catch (err) { toast('HQ rechaza: ' + err.message); }
}
function lista(raiz, S) {
  const xs = (S.datos.expedientes || []).filter(x => x.activo !== false);
  const tipos = [...new Set(xs.map(x => x.tipo))];
  for (const t of tipos) raiz.append(el('section', { class: 'seccion' }, [el('h2', { text: t + 's' }), ...xs.filter(x => x.tipo === t).map(x => {
    const es = estadoSesion(x, S.datos.sesiones);
    return el('a', { class: 'tarjeta enlace expediente', href: '#expedientes/' + x.id }, [el('div', { class: 'fila' }, [el('span', { class: 'pill codigo', text: x.codigo }), el('strong', { text: x.nombre }), es.hay ? el('span', { class: 'pill sesion', text: 'sesión ' + es.estado }) : null]),
      el('p', { class: 'mudo', text: [x.responsable, x.estado_funnel, x.importe ? eur(x.importe) : null, x.encargos_abiertos + ' abiertos'].filter(Boolean).join(' · ') }), x.resumen_estado ? el('p', { class: 'resumen', text: x.resumen_estado }) : null]); })]));
  if (S.datos.rol === 'owner') raiz.append(el('button', { class: 'btn primario', text: '+ Expediente', onclick: () => alta(S) }));
}
function alta(S) {
  const nombre = el('input', { class: 'campo', placeholder: 'Nombre (cliente, producto o convocatoria)' }), tipo = el('select', {}, ['cliente', 'producto', 'convocatoria', 'licitacion'].map(t => el('option', { value: t, text: t })));
  const frente = el('select', {}, [el('option', { value: '', text: 'Frente' }), ...(S.datos.frentes || []).map(f => el('option', { value: f.codigo, text: f.codigo + ' ' + f.linea }))]);
  const resp = el('select', {}, [el('option', { value: '', text: 'Responsable' }), ...(S.datos.agentes || []).map(a => el('option', { value: a.id, text: a.nombre }))]);
  const m = modal({ titulo: 'Nuevo expediente', cuerpo: [nombre, tipo, frente, resp], acciones: [el('button', { class: 'btn primario', text: 'Crear', onclick: async () => { try { await rpc('omc_expediente_set', { p: { nombre: nombre.value.trim(), tipo: tipo.value, frente: frente.value, responsable: resp.value || null } }); m.cerrar(); await recargar(); } catch (err) { toast('HQ rechaza: ' + err.message); } } })] });
}
async function ficha(raiz, S, id) {
  let f; try { f = await rpc('omc_expediente_ficha', { p_id: id }); } catch (err) { raiz.append(el('p', { class: 'error', text: err.message })); return; }
  const x = f.expediente, es = estadoSesion(x, f.sesiones.length ? f.sesiones : S.datos.sesiones), ag = (S.datos.agentes || []).find(a => a.id === x.responsable);
  raiz.append(el('a', { href: '#expedientes', class: 'btn-enlace', text: '← expedientes' }));
  raiz.append(el('section', { class: 'objetivo' }, [el('p', { class: 'mudo', text: x.tipo + ' · ' + (f.frente ? f.frente.codigo + ' ' + f.frente.linea : '') }), el('h1', { text: x.nombre }),
    el('p', { class: 'mudo', text: [x.responsable, x.estado_funnel, x.importe ? eur(x.importe) : null].filter(Boolean).join(' · ') }),
    el('div', { class: 'fila acciones-exp' }, [
      S.datos.rol === 'owner' && !es.hay ? el('button', { class: 'btn primario', text: 'Trabajar con ' + (ag?.nombre || x.responsable || '…'), onclick: () => trabajarCon(x, S) }) : null,
      es.estado === 'solicitada' ? el('span', { class: 'pill sesion', text: 'sesión solicitada, ' + (ag?.nombre || '') + ' la abre en <1 min' }) : null,
      es.estado === 'abierta' && ag?.sesion_url ? el('a', { class: 'btn primario', href: ag.sesion_url, text: 'Volver a la sesión' }) : null,
      es.hay ? el('button', { class: 'btn', text: 'Cerrar sesión', onclick: () => cerrarSesion(es.sesion, S) }) : null,
      x.ficha_url ? el('a', { class: 'btn', href: x.ficha_url, target: '_blank', rel: 'noopener', text: 'Ficha (Doc)' }) : null, x.carpeta_url ? el('a', { class: 'btn', href: x.carpeta_url, target: '_blank', rel: 'noopener', text: 'Carpeta' }) : null])]));
  if (x.resumen_estado) raiz.append(el('section', { class: 'seccion' }, [el('h2', { text: 'Estado (' + fecha(x.resumen_fecha, { hora: true }) + ')' }), el('p', { text: x.resumen_estado })]));
  raiz.append(el('section', { class: 'seccion' }, [el('h2', { text: 'Encargos (' + f.encargos.length + ')' }), ...f.encargos.map(e => tarjetaEncargo(e))]));
  if (x.entregables?.length) raiz.append(el('section', { class: 'seccion' }, [el('h2', { text: 'Entregables' }), ...x.entregables.map(en => el('p', {}, [el('span', { class: 'pill', text: en.estado || 'pendiente' }), ' ', en.url ? el('a', { href: en.url, target: '_blank', rel: 'noopener', text: en.nombre }) : en.nombre]))]));
  if (f.contactos?.length) raiz.append(el('section', { class: 'seccion' }, [el('h2', { text: 'Contactos y envíos' }), ...f.contactos.map(c => el('p', { class: 'mudo', text: fecha(c.fecha || c.created_at, { hora: true }) + ' · ' + c.canal + ' · ' + (c.persona || c.destinatario || '') + ' · ' + (c.estado || '') + (c.asunto ? ' · ' + c.asunto : '') }))]));
  if (f.decisiones?.length) raiz.append(el('section', { class: 'seccion' }, [el('h2', { text: 'Decisiones' }), ...f.decisiones.map(d => el('a', { class: 'tarjeta enlace', href: '#decisiones/' + d.id }, [el('p', { class: 'titulo', text: '#' + d.id + ' ' + d.titulo }), el('p', { class: 'mudo', text: d.estado })]))]));
  if (f.sesiones?.length) raiz.append(el('section', { class: 'seccion' }, [el('h2', { text: 'Sesiones' }), ...f.sesiones.map(s => el('p', { class: 'mudo', text: fecha(s.abierta || s.created_at, { hora: true }) + ' · ' + s.agente + ' · ' + s.estado + (s.resumen ? ' · ' + s.resumen : '') }))]));
  if (f.kit?.length) raiz.append(el('details', {}, [el('summary', { text: 'Kit del frente (' + f.kit.length + ')' }), ...f.kit.map(k => el('a', { href: k.url, target: '_blank', rel: 'noopener', class: 'kit', text: k.titulo }))]));
}
export function render(raiz, S, arg) { if (arg && /^\d+$/.test(arg)) ficha(raiz, S, Number(arg)); else lista(raiz, S); }
```

```js
// public/hq/app/vistas/equipo.js
import { rpc } from '../api.js';
import { el, modal, toast, fecha, horas } from '../ui.js';
import { filtrar } from '../estado.js';
import { tarjetaEncargo } from '../tarjeta.js';
import { recargar } from '../main.js';

function avatar(a) { return a.avatar_url ? el('img', { class: 'avatar', src: a.avatar_url, alt: '' }) : el('span', { class: 'avatar letra', text: (a.nombre || a.id)[0].toUpperCase() }); }
function latido(a) { const h = horas(a.ultima_actividad); return h == null ? 'sin latido' : h < 1 ? 'activo ahora' : h < 24 ? 'hace ' + h + ' h' : 'hace ' + Math.floor(h / 24) + ' d'; }
function editarFrentes(a, S) {
  const cajas = (S.datos.frentes || []).map(f => el('label', { class: 'fila' }, [el('input', { type: 'checkbox', value: f.codigo, checked: (a.frentes_codigos || []).includes(f.codigo) }), f.codigo + ' ' + f.linea]));
  const m = modal({ titulo: 'Frentes de ' + a.nombre, cuerpo: cajas, acciones: [el('button', { class: 'btn primario', text: 'Guardar', onclick: async () => { const sel = cajas.map(c => c.querySelector('input')).filter(i => i.checked).map(i => i.value); try { await rpc('omc_agente_frentes_set', { p_agente: a.id, p_frentes: sel }); m.cerrar(); await recargar(); } catch (err) { toast(err.message); } } })] });
}
function ficha(raiz, S, a) {
  raiz.append(el('a', { href: '#equipo', class: 'btn-enlace', text: '← equipo' }));
  raiz.append(el('section', { class: 'objetivo fila' }, [avatar(a), el('div', {}, [el('h1', { text: a.nombre }), el('p', { class: 'mudo', text: [a.id, a.depto, 'nivel ' + a.nivel, a.jefe ? 'reporta a ' + a.jefe : null, a.modelo, a.cuenta ? 'cuenta ' + a.cuenta + '@' : null, latido(a)].filter(Boolean).join(' · ') })])]));
  raiz.append(el('section', { class: 'seccion' }, [el('div', { class: 'fila' }, [el('h2', { text: 'Frentes' }), S.datos.rol === 'owner' ? el('button', { class: 'btn-enlace', text: 'editar', onclick: () => editarFrentes(a, S) }) : null]),
    ...(a.frentes_codigos || []).map(c => { const f = (S.datos.frentes || []).find(x => x.codigo === c); return el('a', { class: 'pill codigo', href: '#tablero/f/' + c, text: c + (f ? ' ' + f.linea : '') }); }), (a.frentes_codigos || []).length ? null : el('p', { class: 'mudo', text: 'sin frentes asignados' })]));
  const enc = filtrar(S.datos.encargos, { agente: a.id }).filter(e => e.estado !== 'hecho' && e.estado !== 'descartado');
  raiz.append(el('section', { class: 'seccion' }, [el('h2', { text: 'Encargos abiertos (' + enc.length + ')' }), ...enc.map(e => tarjetaEncargo(e))]));
  const acciones = [a.sesion_url ? el('a', { class: 'btn primario', href: a.sesion_url, text: 'Abrir sesión' }) : el('span', { class: 'mudo', text: 'sin sesión publicada' }), a.sesion_abierta ? el('a', { class: 'pill sesion', href: '#expedientes/' + a.sesion_abierta.expediente_id, text: 'en sesión: ' + a.sesion_abierta.nombre }) : null];
  raiz.append(el('section', { class: 'seccion fila' }, acciones));
}
export function render(raiz, S, arg) {
  const ags = (S.datos.agentes || []).filter(a => a.activo !== false).sort((x, y) => (x.nivel - y.nivel) || x.nombre.localeCompare(y.nombre));
  if (arg) { const a = ags.find(x => x.id === arg); if (a) return ficha(raiz, S, a); }
  const deptos = [...new Set(ags.map(a => a.depto))];
  for (const d of deptos) raiz.append(el('section', { class: 'seccion' }, [el('h2', { text: d }), el('div', { class: 'frentes' }, ags.filter(a => a.depto === d).map(a => el('a', { class: 'tarjeta enlace fila agente', href: '#equipo/' + a.id }, [avatar(a), el('div', {}, [el('strong', { text: a.nombre }), el('p', { class: 'mudo', text: [(a.frentes_codigos || []).join(' ') || 'sin frentes', a.encargos_abiertos + ' abiertos', latido(a)].join(' · ') })]), a.sesion_abierta ? el('span', { class: 'pill sesion', text: 'en sesión' }) : null])))]));
}
```

CSS:

```css
/* equipo y expedientes */
.avatar{width:44px;height:44px;border-radius:50%;flex:none;object-fit:cover;background:var(--marino)}.avatar.letra{display:grid;place-items:center;color:var(--oro);font-family:var(--display);font-weight:700;font-size:20px}
.agente{align-items:center}.pill.sesion{background:var(--oro-suave);color:var(--tinta)}.acciones-exp{margin-top:10px}.objetivo .btn{color:var(--tinta)}.resumen{margin:4px 0 0;font-size:14px}
```

- [ ] **Step 4: Ejecutar** → PASS (13). Manual en `pruebas` (expediente creado por `hq.py expediente alta`, agente `probador` con `sesion-url https://claude.ai/code/session_prueba`): "Trabajar con probador" crea la sesión solicitada y redirige a la URL; volver atrás muestra "sesión solicitada"; `hq.py sesion abrir --expediente N --agente probador` la pasa a abierta y en la ficha aparece "Volver a la sesión" + "Cerrar sesión"; cerrar sin avance del encargo en curso enseña el motivo de la base; con avance cierra. Ficha de agente muestra frentes y encargos; el owner edita frentes.

- [ ] **Step 5: Commit**

```bash
git add public/hq/app public/hq/test/expedientes.test.mjs
git commit -m "feat(hq-ui): equipo y expedientes con sesiones por expediente"
```

---

### Task 7: Realtime, push, service worker, publicación y verificación

**Files:**
- Create: `public/hq/sw.js` (nuevo), `scripts/hq/tests/verificar-hq-web.sh`
- Modify: `public/hq/app/main.js` (push + aviso de versión nueva), `public/hq/manifest.webmanifest` (revisar `start_url`, `scope`), `scripts/hq/version.sh` (ya apunta a `public/hq/index.html`: comprobar que el regex sigue casando con la línea nueva de `HQ_VERSION`), `docs/empresa/03-hq-manual.md` (sección "Interfaz v2")
- Test: `scripts/hq/tests/verificar-hq-web.sh` (curl), `node --test` completo

**Interfaces:**
- Consumes: `omc_guardar_push(p_token, p_sub)` (v1, sin cambios), el canal `omc:<empresa>` evento `cambio` (ya lo emiten los triggers de la v1 y las RPC del plan 1 con `pg_notify`/broadcast; comprobar en `schema.sql` cómo emite la v1 y que las RPC nuevas del plan 1 lo hagan igual).
- Produces: HQ v2 publicada en `https://77delta.com/hq/`, v1 en `https://77delta.com/hq/v1/`.

- [ ] **Step 1: Script de verificación (falla ahora porque la v2 no está publicada)**

```bash
#!/bin/sh
# Verifica HQ web publicada. Uso: scripts/hq/tests/verificar-hq-web.sh [version-esperada]
set -e; B=https://77delta.com/hq
v=$(curl -fsS "$B/" | grep -o "HQ_VERSION = { v: '[0-9.]*'" | grep -o "[0-9.]*'$" | tr -d "'")
[ -n "$v" ] || { echo "FALLO: sin HQ_VERSION en $B/"; exit 1; }
[ -z "$1" ] || [ "$v" = "$1" ] || { echo "FALLO: publicada $v, esperada $1 (caché de Pages: espera 1-2 min)"; exit 1; }
for f in app/main.js app/api.js app/estado.js app/ui.js app/tokens.css app/hq.css sw.js manifest.webmanifest v1/index.html v1/sw.js; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$B/$f"); [ "$code" = 200 ] || { echo "FALLO: $f -> $code"; exit 1; }; done
curl -fsS "$B/sw.js" | grep -q "hq-v13" || { echo "FALLO: sw.js no es la v13"; exit 1; }
curl -fsS "$B/v1/index.html" | grep -q "/hq/v1/sw.js" || { echo "FALLO: v1 sigue registrando /hq/sw.js"; exit 1; }
echo "HQ web OK: v$v"
```

- [ ] **Step 2: Ejecutar** → `sh scripts/hq/tests/verificar-hq-web.sh` FALLO (aún v0.9.x publicada).

- [ ] **Step 3: `sw.js`, push y aviso de versión**

```js
// public/hq/sw.js · v2. Cachea el shell; el resto va a red primero.
var CACHE = 'hq-v13';
var SHELL = ['/hq/', '/hq/app/main.js', '/hq/app/api.js', '/hq/app/estado.js', '/hq/app/ui.js', '/hq/app/tarjeta.js', '/hq/app/detalle.js', '/hq/app/dnd.js', '/hq/app/vistas/inicio.js', '/hq/app/vistas/plan.js', '/hq/app/vistas/tablero.js', '/hq/app/vistas/decisiones.js', '/hq/app/vistas/equipo.js', '/hq/app/vistas/expedientes.js', '/hq/app/tokens.css', '/hq/app/hq.css', '/hq/manifest.webmanifest', '/hq/icon-192.png', '/hq/icon-512.png'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (e) { e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); })); });
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || !u.pathname.startsWith('/hq/') || u.pathname.startsWith('/hq/v1/')) return;
  e.respondWith(fetch(e.request).then(function (r) { var copia = r.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copia); }); return r; }).catch(function () { return caches.match(e.request).then(function (r) { return r || caches.match('/hq/'); }); }));
});
self.addEventListener('push', function (e) {
  var d = {}; try { d = e.data.json(); } catch (x) { d = { title: 'HQ', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'HQ', { body: d.body || '', icon: '/hq/icon-192.png', data: { url: d.url || '/hq/#inicio' } }));
});
self.addEventListener('notificationclick', function (e) { e.notification.close(); e.waitUntil(clients.openWindow(e.notification.data.url)); });
```

Copiar del `v1/sw.js` los manejadores `push` y `notificationclick` reales si difieren de los de arriba (mismo payload que envía `hq-push` en el servidor): `grep -n "push\|notificationclick" public/hq/v1/sw.js`.

En `main.js`, sustituir la línea del `getRegistrations` de T1 por:

```js
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => { if (!(r.active && r.active.scriptURL.endsWith('/hq/sw.js'))) r.unregister(); }));
  navigator.serviceWorker.register('/hq/sw.js', { updateViaCache: 'none' }).then(reg => {
    reg.addEventListener('updatefound', () => { const nuevo = reg.installing; nuevo?.addEventListener('statechange', () => { if (nuevo.state === 'activated' && navigator.serviceWorker.controller) toast('HQ tiene versión nueva', 'recargar', () => location.reload()); }); });
    if (Notification.permission === 'default') document.addEventListener('click', pedirPush, { once: true }); else if (Notification.permission === 'granted') activarPush(reg);
  }).catch(() => {});
}
async function pedirPush() { if (await Notification.requestPermission() === 'granted') activarPush(await navigator.serviceWorker.ready); }
async function activarPush(reg) {
  try { const cfg = JSON.parse(localStorage.getItem('hq_cfg') || '{}'); if (!cfg.vapid) return;
    const sub = await reg.pushManager.getSubscription() || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: Uint8Array.from(atob(cfg.vapid.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)) });
    await rpc('omc_guardar_push', { p_sub: sub.toJSON() }); } catch (e) { console.warn('push', e.message); }
}
```

(comprobar en `public/hq/v1/index.html` líneas 1420-1436 el nombre real de la clave VAPID en `CFG` y el formato de `p_sub`; copiar literalmente). Importar `rpc` en `main.js`.

`manifest.webmanifest`: `"start_url": "/hq/#inicio"`, `"scope": "/hq/"`, `"display": "standalone"`, `"theme_color": "#0b1f3a"`, iconos como estaban.

`scripts/hq/version.sh`: comprobar que el `sed` casa con `var HQ_VERSION = { v: '2.0.0', fecha: '...' }` en `public/hq/index.html` (misma forma que en la v1, así que debería); ejecutar `sh scripts/hq/version.sh` y ver `2.0.1` estampada.

Docs, `docs/empresa/03-hq-manual.md`, sección nueva:

```markdown
## Interfaz v2 (septiembre 2026)

- `https://77delta.com/hq/` es la v2: Inicio (lo que depende de ti, lo que pediste esta semana), Plan (objetivo, bloques, frentes), Tablero (Kanban editable), Decisiones, Equipo, Expedientes. La v1 sigue en `https://77delta.com/hq/v1/` para Licita, Contactos e histórico hasta el plan 3.
- Mover una tarjeta a En curso la toma; a Hecho pide la fuente (sin fuente no cierra); a Bloqueado pide qué falta de Diego; el orden dentro de la columna se guarda.
- "Trabajar con <agente>" en la ficha de un expediente abre la sesión del agente en la misma pestaña; el agente la abre con `hq.py sesion abrir` en menos de un minuto y no puede cerrarla sin avance en los encargos tocados.
- Código en `public/hq/app/` (módulos ES, sin build). Tests: `node --test public/hq/test/`. Publicar: `sh scripts/hq/version.sh && git commit -am "hq: vX" && git push && sh scripts/hq/tests/verificar-hq-web.sh`.
- Los tokens de marca se copian con `sh scripts/hq/sincronizar-tokens.sh` cuando cambia `brand/tokens.css`.
```

- [ ] **Step 4: Publicar y verificar**

```bash
node --test public/hq/test/ && sh scripts/hq/version.sh && git add -A public/hq scripts/hq docs/empresa/03-hq-manual.md && git commit -m "feat(hq-ui): HQ v2 publicada: sw v13, push, realtime y verificación" && git push
sleep 90; sh scripts/hq/tests/verificar-hq-web.sh
```

Esperado: `HQ web OK: v2.0.x`. Luego en el móvil de Diego (o en Chrome con emulación): abrir `https://77delta.com/hq/?t=<su token>` (el token se lo da el propio Diego desde su enlace de la v1: no imprimirlo), ver Inicio, arrastrar una tarjeta en el tablero, abrir un expediente. Comprobar en DevTools > Application que solo hay un service worker (`/hq/sw.js`, cache `hq-v13`) y que `https://77delta.com/hq/v1/` sigue funcionando con su propio SW.

Si la verificación falla: no decir "publicado"; arreglar y repetir. Si la v2 rompe algo que la v1 hacía y no se arregla en una hora, revertir el commit de publicación (`git revert`) y volver a `git push`: la v1 vuelve a `/hq/` porque el `git mv` se deshace con el revert.

- [ ] **Step 5: Cierre**

```bash
python3 scripts/hq/hq.py encargo avance 259 --texto "plan 2 (interfaz) publicado en 77delta.com/hq/: inicio, plan, tablero kanban, decisiones, equipo, expedientes con sesiones; v1 en /hq/v1/" --agente chief
```

---

## Orden de ejecución y puntos de parada

1. **T1-T2** (shell, api, estado) sin publicar: solo local y tests. Parada: enseñar a Diego una captura de móvil del shell y confirmar la paleta (marino + oro plano, sin serif).
2. **T3-T4** (inicio, plan, tablero). Parada: Diego prueba el tablero en local o en una rama publicada bajo `public/hq/beta/` (misma app, `index.html` copiado con `<base href="/hq/">` no: mejor publicar en `beta/` con rutas relativas `./app/`; decidir en T3 si las rutas del shell son relativas para permitirlo). Sin su OK sobre la tarjeta y el arrastre no se sigue.
3. **T5-T6** (decisiones, equipo, expedientes). Parada: comprobar con Diego el flujo "Trabajar con Martí" en el móvil.
4. **T7** publicación. Solo tras el checkpoint del 23-sep o antes si Diego lo pide; la v1 queda en `/hq/v1/` como red de seguridad.

Cada tarea la ejecuta un subagente nuevo con el plan, la spec y el contrato de `omc_hq_v2` como únicos contextos, y se revisa entre tareas (`superpowers:subagent-driven-development`).

## Self-review aplicado

- Cobertura de la spec: sección 4 (cascada visible, Kanban editable, hilo por tarjeta, tags y frente) → T2-T4; sección 6 (fichas de agente, onboarding en el manual, avatares, sesiones por expediente, botón en la ficha) → T6 y T7; cambio de cuenta sin rotura → `sesion_url` viene de la base (plan 1, T12), la UI no guarda nada por su cuenta; chat embebido: fuera de la v1 (no hay tarea, por decisión de Diego).
- Nombres compartidos: `render(raiz, S, arg)` en todas las vistas; `recargar` exportado por `main.js`; `tarjetaEncargo` y `resumenEncargo` en `tarjeta.js`; `pedirTexto` y `moverEncargo` en `detalle.js`; `COLUMNAS` en `estado.js`; `estadoSesion` en `expedientes.js`.
- Dependencias del plan 1 que la UI da por hechas y hay que confirmar en `schema-v2.sql` antes de T4: `omc_encargo_alta(p)`, `omc_encargo_editar(p_id, p)` con `orden_kanban`, `omc_encargo_estado(p_id, p_estado, p_motivo)`, `omc_encargo_hecho(p_id, p_fuente, p_texto, p_agente)`, `omc_encargo_tomar(p_id, p_agente)`, `omc_encargo_avance(p_id, p_texto, p_agente)`, `omc_encargo_ficha(p_id)`; y en `omc_hq_v2`: `empresa`, `yo`, `rol`, `expediente_nombre` en sesiones, `sesion_abierta` en agentes y expedientes. Si falta alguna clave, se añade a `omc_hq_v2` (misma firma) y se anota en el contrato.
