# HQ v2 · Plan 3b (tanda 2a): licitaciones decidibles, embudo y menú usable

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que Diego vea en Reglas/Decisiones solo las licitaciones analizadas y decidibles (unas 60, no 1.475), con la ficha completa (elegible, solvencia, motivo, PCAP, PPT, perfil, Drive); que exista Operación/Licitaciones con el embudo de KPIs y la cola en criba; y que el menú lateral tenga iconos y sea cómodo en el móvil.

**Architecture:** funciones puras nuevas en `public/hq/app/licitaciones.js` (filtros y embudo) usadas por dos vistas: `vistas/decisiones.js` (ficha y cola decidible) y la nueva `vistas/licitaciones.js` (embudo + criba). El menú gana un campo `icono` (SVG inline) en `rutas.js` que pinta `shell.js`. Nada de BD ni de esquema: todo sale del payload actual de `omc_hq_v2` (`datos.licitaciones`, `datos.kpis`).

**Tech Stack:** vanilla JS ES modules, `node --test` con el DOM simulado de los tests existentes (ver `public/hq/test/objetivo.test.mjs`), CSS en `public/hq/app/hq.css`.

**Spec:** `docs/superpowers/specs/2026-09-17-hq-v2-plan-3-arquitectura-informacion-design.md` (sección Operación/Licitaciones y CRM mínimo) más las órdenes de Diego del 17-sep: "me falta más campos: si somos elegibles, solvencia, con ute o solos, tags, links a ppt y pcap"; "1.475 por decidir es inmanejable"; "dónde veo los kpis que teníamos en la v1"; "muy mala calidad el menú hamburguesa, cero friendly, ni iconos ni nada".

## Global Constraints

- Concepto MVP: lo pedido y nada más. Sin librerías externas, sin iconos de fuera: SVG inline escritos a mano (viewBox 0 0 24 24, `stroke="currentColor"`, `fill="none"`, `stroke-width="2"`, `stroke-linecap="round"`, `stroke-linejoin="round"`, `aria-hidden="true"`).
- Nunca el guion largo ni la raya larga en código, textos, tests ni commits. Textos de UI en castellano con acentos. Cifras con "sin IVA" cuando sean importes de licitación.
- `HQ_VERSION` en `index.html` y `sw.js` no se tocan (los sube `scripts/hq/version.sh` al publicar). No se toca la BD ni `scripts/hq/`.
- Suite completa verde y sin warnings: `cd <worktree> && PATH=$HOME/.nvm/versions/node/v22.23.1/bin:$PATH timeout 500 node --test public/hq/test/*.mjs` (parte de 71 tests).
- Los enlaces externos solo se pintan si el valor empieza por `http` (misma defensa que ya aplica `decisiones.js` a `enlace`); `target="_blank" rel="noopener"`.
- Campos del payload `datos.licitaciones[]` (todos pueden venir null): expediente, organo, provincia, objeto, resumen_corto, importe (texto numérico, sin IVA), tipo, procedimiento, elegible ('Probable' | 'Dudosa' | 'Revisar' | 'No viable' | 'Sin pliego' | 'Sin datos' | otros), motivo_auto, solvencia (texto; si empieza por '?' o está vacío es "sin dato"), cierre (YYYY-MM-DD), enlace (perfil), pcap (URL), ppt (URL), carpeta (URL Drive), estado ('Nueva' | 'Por decidir' | 'Aprobada' | 'Presentada' | 'Pausada' | 'Descartada' | 'Cerrada sin presentar' | 'Retirada' | 'No adjudicada' | 'Adjudicada' | 'Contratada' | textos legados), decision ('Pendiente' | 'OK' | 'No' | null | legados), motivos, motivo_texto, progreso.
- `datos.kpis` es un mapa clave -> {valor, texto, fuente, updated_at}; claves útiles: `lic.detectadas.n`, `lic.analizadas.n`, `lic.tasa_exito`, `lic.proximo_cierre`, `lic.actualizado`. Pueden faltar: entonces no se pintan.
- Commits firmados con las dos líneas: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` y `Claude-Session: https://claude.ai/code/session_016CVmDqUV5diuD59mpZWRZv`.

---

### Task 1: funciones puras de licitaciones

**Files:**
- Create: `public/hq/app/licitaciones.js`
- Test: `public/hq/test/licitaciones.test.mjs`

**Interfaces (Produces):**
```js
export const DECIDIBLES = new Set(['Probable', 'Dudosa']);
export const ABIERTAS = new Set(['Nueva', 'Por decidir']);
export function pendiente(l)            // decision null, '' o 'Pendiente'
export function porDecidir(lics)        // pendiente && ABIERTAS.has(estado) && DECIDIBLES.has(elegible), orden cierre asc nulls last, luego expediente
export function enCriba(lics)           // pendiente && ABIERTAS.has(estado) && !DECIDIBLES.has(elegible), mismo orden
export function porElegible(lics)       // [[elegible || 'Sin clasificar', [..]], ...] ordenado por tamaño desc
export function solvenciaTexto(l)       // '' o texto que empieza por '?' -> 'sin dato'; si no, el texto recortado a 160 con '…' (carácter U+2026, no tres puntos)
export function embudo(lics, kpis = {}) // array de {clave, nombre, n, eur} en este orden:
//   detectadas (solo si kpis['lic.detectadas.n'] existe: n = Number(valor), eur = null)
//   analizadas (solo si kpis['lic.analizadas.n'] existe)
//   por_decidir (porDecidir(lics)), en_criba (enCriba(lics)),
//   aprobadas (estado 'Aprobada' o decision 'OK' y estado no en Presentada/Adjudicada/Contratada),
//   presentadas (estado 'Presentada'), adjudicadas (estado 'Adjudicada' o 'No adjudicada' cuenta solo 'Adjudicada'),
//   contratadas (estado 'Contratada'), descartadas (estado que empieza por 'Descartada' o decision 'No'),
//   cerradas (estado 'Cerrada sin presentar')
//   eur = suma de Number(importe) || 0 de esas filas
```

- [ ] **Step 1: test que falla** con un fixture de 8 licitaciones que cubra: Probable/Nueva pendiente (entra en porDecidir), Dudosa/Por decidir pendiente (entra), Revisar/Nueva pendiente (criba), No viable/Nueva (criba), Probable/Descartada (ninguna), Probable/Nueva decision 'OK' (aprobada, no decidible), Presentada, Contratada con importe. Comprobar orden por cierre, solvenciaTexto('? no se pudo…') === 'sin dato', embudo sin kpis (no hay detectadas) y con kpis (`{'lic.detectadas.n': {valor: 1500}}` -> primera fila detectadas n 1500).
- [ ] **Step 2:** `node --test public/hq/test/licitaciones.test.mjs` falla por módulo inexistente.
- [ ] **Step 3:** implementar `licitaciones.js` (sin DOM, sin imports de vistas).
- [ ] **Step 4:** test verde; suite completa verde.
- [ ] **Step 5:** commit `feat(hq-v2): funciones puras de licitaciones (decidibles, criba, embudo)`.

### Task 2: ficha completa y cola decidible en Reglas/Decisiones

**Files:**
- Modify: `public/hq/app/vistas/decisiones.js` (función `licitacion(l)` y la sección de la línea ~110)
- Modify: `public/hq/app/hq.css` (clases `.licitacion .datos`, `.pill.elegible-*`, `.enlaces-doc`)
- Test: `public/hq/test/decisiones.test.mjs` (añadir tests; los existentes siguen)

**Interfaces (Consumes):** `porDecidir`, `enCriba`, `solvenciaTexto` de `../licitaciones.js`; `el`, `eur`, `fecha` de ui.js como ya hace el fichero.

Ficha (`article.tarjeta.licitacion`), en este orden:
1. Fila: pill `codigo` con expediente + `strong` con resumen_corto || objeto.
2. `p.mudo`: organo · provincia · `eur(importe) + ' sin IVA'` · `'cierra ' + fecha(cierre)` · tipo · procedimiento (solo los presentes, separados por ' · ').
3. `div.datos` con hasta tres `p`: `Elegible: <pill class="pill elegible-<slug>">valor</pill>` (slug = valor en minúsculas sin acentos ni espacios: probable, dudosa, revisar, no-viable…), `Solvencia: solvenciaTexto(l)`, `Motivo: motivo_auto` (solo si hay).
4. `div.enlaces-doc` con enlaces `a.btn-enlace` (solo si la URL empieza por http): PCAP, PPT, Perfil (enlace), Drive (carpeta). Si no hay ninguno, no se pinta el div.
5. Los tres botones actuales (Descartar, Estudiar, Presentar) sin cambios.

Sección: `h2` "Licitaciones por decidir (N)" con N = porDecidir(d.licitaciones).length; debajo `p.mudo` "M en criba de Guillem (Revisar, No viable, Sin pliego): se deciden cuando estén analizadas" con enlace a `#operacion/licitaciones` (M = enCriba().length); luego las fichas; el enlace a v1 se mantiene.

- [ ] **Step 1: tests que fallan**: con un payload de 4 licitaciones (2 decidibles, 1 Revisar, 1 Descartada) el h2 dice "(2)", la línea de criba dice "1 en criba", la ficha contiene los textos "Elegible", "Solvencia", "sin dato" cuando toca, y los enlaces PCAP/PPT/Drive con href correctos; una URL `javascript:alert(1)` en pcap no produce ningún `a`.
- [ ] **Step 2:** fallan. **Step 3:** implementar. **Step 4:** suite verde. **Step 5:** commit `feat(hq-v2): ficha completa de licitación y cola solo con las decidibles`.

### Task 3: vista Operación/Licitaciones (embudo y criba)

**Files:**
- Create: `public/hq/app/vistas/licitaciones.js`
- Modify: `public/hq/app/rutas.js` (Operación gana `{ clave: 'operacion/licitaciones', nombre: 'Licitaciones' }` tras Expedientes; `CLAVES`/`DEFECTO` se derivan o se amplían igual que las demás)
- Modify: `public/hq/app/main.js` (registrar la vista en `VISTAS`)
- Modify: `public/hq/app/buscador.js` solo si `FUENTES` no incluye licitaciones: añadir fuente tipo 'licitación' (id = expediente, título = resumen_corto || objeto, href = '#reglas/decisiones')
- Modify: `public/hq/app/hq.css` (`.embudo` grid de minis: `repeat(auto-fill, minmax(140px, 1fr))`)
- Test: `public/hq/test/licitaciones-vista.test.mjs`, y `rutas.test.mjs`/`shell.test.mjs` si comprueban la lista de claves

**Interfaces (Consumes):** `embudo`, `enCriba`, `porElegible`, `porDecidir` de `../licitaciones.js`. Firma `export function render(raiz, S, arg, filtrosRuta = {})`.

Contenido (owner y agente lo ven igual):
1. `section.seccion` "Embudo": `div.embudo` con una `div.mini` por fila de `embudo(d.licitaciones, d.kpis)`: `div.v` con n (y `small` con `eur` si eur > 0), `div.l` con el nombre. Debajo `p.mudo` con "tasa de éxito X %" y "próximo cierre …" si existen en kpis, y "KPIs del barrido actualizados …" con `kpis['lic.actualizado'].texto` si existe.
2. `section.seccion` "Aprobadas y presentadas": lista `a.tarjeta.enlace` (href `#reglas/decisiones`) de las de estado Aprobada/Presentada ordenadas por cierre: expediente · resumen · `eur(importe) sin IVA` · cierra.
3. `section.seccion` "En criba de Guillem (M)": por cada grupo de `porElegible(enCriba(...))` un `details` con `summary` "<elegible> (n)" y dentro filas `p` con expediente · resumen_corto || objeto · cierra · importe sin IVA · enlace Perfil si hay. El primer grupo abierto (`open`).
Sin botones de acción: se decide en Reglas/Decisiones.

- [ ] **Step 1: tests que fallan**: la ruta `#operacion/licitaciones` resuelve a la clave; el render pinta el embudo con la fila "por decidir" correcta; los grupos de criba salen ordenados por tamaño; sin datos pinta "sin licitaciones".
- [ ] **Step 2:** fallan. **Step 3:** implementar. **Step 4:** suite verde. **Step 5:** commit `feat(hq-v2): vista Operación/Licitaciones con embudo y criba`.

### Task 4: menú con iconos y cómodo en el móvil

**Files:**
- Modify: `public/hq/app/rutas.js` (cada área gana `icono`: string SVG inline)
- Modify: `public/hq/app/shell.js` (`montarMenu` pinta el icono en el título del área y, para áreas de una sola vista, en el propio enlace; en el cajón móvil una cabecera con la marca "HQ" y un botón cerrar ✕ `aria-label="Cerrar menú"` que llama a `cerrarMenu()`)
- Modify: `public/hq/app/hq.css`
- Modify: `public/hq/index.html` solo si hace falta un contenedor para la cabecera del cajón
- Test: `public/hq/test/shell.test.mjs`

Iconos (uno por área, trazo simple, 24x24): hoy = sol (círculo r4 + 8 rayos), direccion = diana (tres círculos concéntricos), operacion = tablero (tres columnas: rect x3 y3 w5 h18, x10 y3 w5 h12, x17 y3 w4 h8), equipo = dos personas (círculos + arcos), recursos = servidor (dos rects apilados con punto), reglas = check en escudo (path escudo + polyline check).

CSS obligatorio:
- `.menu nav a` con `display:flex;align-items:center;gap:10px;min-height:44px;padding:0 12px;font-size:15px` (objetivo táctil de 44 px); `.ico{width:20px;height:20px;flex:none}`; `.area-titulo` con `display:flex;align-items:center;gap:8px`.
- Móvil (< 900): cajón de `min(84vw, 320px)`, cabecera `.menu-cab` (marca + ✕) sticky, sombra `0 0 32px rgba(0,0,0,.3)`, `overflow-y:auto`, `padding-bottom:env(safe-area-inset-bottom)`; el `#hamburguesa` con `min-width:44px;min-height:44px` y `aria-label="Abrir menú"`, `aria-expanded` sincronizado al abrir y cerrar.
- Escritorio plegado (`body.menu-plegado`): los enlaces muestran solo el icono (texto oculto con `.menu nav a span.txt{display:none}`), nunca `font-size:0`; `title` con el nombre.
- Al navegar (click en enlace del menú) el cajón se cierra (ya existe `cerrarMenu`; verificar que se llama y que `aria-expanded` vuelve a false).

- [ ] **Step 1: tests que fallan** en shell.test.mjs: cada `.area-titulo` contiene un `svg`; los enlaces tienen `span.txt` con el nombre; existe `.menu-cab` con botón `[aria-label="Cerrar menú"]`; tras `cablearShell` un click en el hamburguesa pone `aria-expanded="true"` y en el botón cerrar lo vuelve a `"false"`.
- [ ] **Step 2:** fallan. **Step 3:** implementar. **Step 4:** suite verde. **Step 5:** commit `feat(hq-v2): menú con iconos, objetivo táctil de 44 px y cajón móvil con cabecera`.
