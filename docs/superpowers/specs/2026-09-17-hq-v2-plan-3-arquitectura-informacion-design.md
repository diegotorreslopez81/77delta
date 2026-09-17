# HQ v2 · Plan 3: arquitectura de la información por pregunta del CEO (MVP)

Fecha: 2026-09-17. Autor: chief. Estado: arquitectura aprobada por Diego el 17-sep ~07:20 ("Me encaja completamente"); recortada a MVP por orden suya el 17-sep ~08:00 ("concepto MVP, siempre: pequeñito, funcional y mejoramos con feedback").
Spec madre: `docs/superpowers/specs/2026-09-16-hq-fuente-unica-cascada-design.md` (secciones 2.5 a 2.8 y 5). Este documento la desarrolla y donde choque, manda este.
Contrato del payload: `docs/superpowers/specs/2026-09-16-hq-v2-contrato-omc_hq_v2.md` (se amplía en la sección 4).

## 0. Por qué

Diego, 17-sep, tras navegar la v2 publicada (2.0.1):

- Muy operativa en tareas, pero las vistas Inicio, Plan, Tablero y Equipo repiten las mismas tarjetas con filtros distintos.
- Faltan KPIs, embudo de licitaciones por estado y tipología, consumo de tokens, organigrama, agentes activos y sus fichas.
- "Estás replicando la v1 sin repensar la v2." Equipo/organigrama en un sitio; gastos, cuentas y tokens en otro, con el gasto de cada agente individualizado.
- Navegación por tabs no escala: hamburguesa u otro sistema.
- CRM: gestión de clientes visible en la web, ficha por cliente con su carpeta de Drive como fuente de la verdad, expedientes del cliente individualizados, y captación de nuevos clientes.
- **MVP siempre.** "No tiene que ser un CRM como HubSpot. Algo básico, muy básico, que cubra el mínimo indispensable de ahora mismo." Cada vista sale con lo mínimo que responde a la pregunta; lo demás va a la sección 9 y se hace solo si el uso lo pide.

## 1. Principios

0. **MVP.** Cada vista es una lista o una ficha con los campos que ya existen. Nada de paneles, ratios ni series que nadie ha pedido con fecha. Si una vista necesita una tabla nueva para existir, se pospone salvo que esté en la sección 4.
1. **Cada dato tiene una casa.** Una tarjeta, una licitación, un agente o un euro se ven en detalle en un solo sitio. El resto enlaza. Los contadores agregados sí pueden repetirse.
2. **Navegación por pregunta, no por tabla.** Seis áreas: hoy, dirección, operación, equipo, recursos, reglas.
3. **Carpeta de Drive = archivo; HQ = estado.** Los documentos de un cliente viven en su carpeta de Drive. HQ guarda estado, fechas, responsable y el enlace.
4. **La interfaz no calcula.** Sumas, embudos y rankings salen del payload de `omc_hq_v2`. Si un número no está en el payload, no se enseña.
5. **Móvil primero.** Todo funciona a 390 px; menú lateral plegado a hamburguesa por debajo de 900 px.
6. **Token de agente ve, token de owner actúa.** `conf.rol` decide qué botones se pintan; el servidor vuelve a comprobarlo en cada RPC.
7. **Todo enlazable.** Ruta `#area/vista/id` estable.
8. **Nada sensible en HQ.** Ni DNI, ni IBAN, ni móviles, ni palabras clave del Sobre Digital, ni asuntos privados de Diego.

## 2. Navegación

### 2.1 Barra superior

- Izquierda: hamburguesa (< 900 px) y "HQ" que lleva a `#hoy`.
- Centro: buscador global sobre el payload cargado. Acepta número (`996`, `#996`) o texto; busca en encargos, licitaciones, contactos, clientes, expedientes, agentes y decisiones; hasta 12 resultados agrupados por tipo; Enter navega al primero.
- Derecha: contador "Depende de ti" (tarjetas `pendiente_diego` + decisiones abiertas; lleva a `#hoy`), semáforo de cuentas (verde < 80 %, ámbar 80-94 %, rojo ≥ 95 % de la ventana de la cuenta más cargada; lleva a `#recursos/computo`), rol y "Salir". Con token de agente el contador pasa a "Tus tarjetas".

### 2.2 Menú lateral

- ≥ 900 px: columna de 232 px, plegable a 56 px (iconos); estado en `localStorage` `hq_menu`.
- < 900 px: drawer que abre la hamburguesa y cierra al navegar o tocar fuera.
- Seis áreas con sus vistas debajo; el área activa se expande. Al pie: `HQ_VERSION`, enlace "v1 (hasta 30-sep)" y "Trabajar con Martí" (owner).

### 2.3 Rutas

`#area/vista/id`. Redirecciones: `#inicio` → `#hoy`, `#plan` → `#direccion/objetivo`, `#tablero` → `#operacion/tablero`, `#decisiones/N` → `#reglas/decisiones/N`, `#equipo` → `#equipo/organigrama`, `#expedientes/ID` → `#operacion/expedientes/ID`, `?id=N` → `#reglas/decisiones/N`. `sw.js` al pulsar una notificación abre `d.url` si empieza por `/hq/`; si no, `/hq/#hoy`. Filtros en la query del hash: `#operacion/tablero?frente=A1`. Cada ficha y lista tiene "Copiar enlace".

## 3. Áreas y vistas (alcance MVP)

### 3.1 Hoy (`#hoy`)

¿Qué necesito hoy? Una sola vista, tres bloques:

- **Depende de ti:** tarjetas `pendiente_diego` por antigüedad, con Aprobar, Rechazar, Posponer y enlace a la tarjeta. 20 visibles, "Ver todas".
- **Tus peticiones de la semana:** encargos `de_diego = true` de los últimos 7 días con estado y responsable (lo mismo que la primera sección del informe de las 07:00).
- **Sesiones abiertas:** agentes con `sesion_url_fecha` < 2 h y su frente.

Con token de agente: "Tus tarjetas" en lugar de "Depende de ti" y sin peticiones. Hoy no es un tablero.

### 3.2 Dirección (`#direccion`)

¿Vamos bien?

- **Objetivo** (`#direccion/objetivo`): cuadro 2026 (300.000 EUR contratados a 31-dic) y 2027 (3 M): contratado, presentado, en análisis, cobrado, meta prorrateada a la fecha, desviación. Debajo, los 5 bloques con sus frentes y el KPI de cada frente (valor y meta, sin tendencia). Única casa del plan; sustituye a la vista Plan. La edición sigue en los RPC y CLI actuales.
- **Embudo** (`#direccion/embudo`): licitaciones por estado (detectada, cribada, en análisis, presentada, adjudicada, perdida, desierta) con número e importe, filtro por tipología (`omc_licitaciones.tipo`) y frente; clientes por `estado_funnel`. Cada barra enlaza a la lista filtrada en Operación.

### 3.3 Operación (`#operacion`)

¿Qué está en marcha?

- **Tablero** (`#operacion/tablero`): el Kanban de la v2 tal cual. Única casa de las tarjetas. Ficha `#operacion/tablero/ID`.
- **Expedientes** (`#operacion/expedientes`): la vista de la v2, sin los de tipo `cliente`. Ficha `#operacion/expedientes/ID`.
- **Licitaciones** (`#operacion/licitaciones`): absorbe la v1. Lista paginada desde el servidor (50 por página) con filtros por estado, tipología, CCAA, importe y texto. Tiles de cabecera con los contadores de la v1 (Por decidir, En análisis, Presentadas, Adjudicadas, Perdidas, Desiertas). Ficha `#operacion/licitaciones/ID` con resumen corto, solvencia, medios personales art. 76, enlace a la plataforma, hilo y decisión desde la ficha (`omc_licitacion_decidir`). Valor nuevo `desierto` en `decision` (encargos #997 y #998). Requisitos de Nuria (po-hq, specs #35/#36/#37): cola "En análisis" visible con responsable y días; bandeja "Por decidir" solo para owner; "Presentada" muda (sin avisos ni contadores de pendiente). No se normalizan los valores legados.
- **Clientes** (`#operacion/clientes`), CRM mínimo: lista de expedientes tipo `cliente` con organización, estado del embudo, responsable, próxima acción y fecha. Ficha `#operacion/clientes/ID` con cuatro cosas: enlace grande a la carpeta de Drive `Empresa/Clientes/<Cliente>/` (`carpeta_url`, es el archivo), contactos y toques del cliente (`omc_contactos` con `expediente_id` del cliente o de sus hijos), expedientes hijos con estado y entregables (`padre_id`), y próxima acción con fecha, editables por owner (`omc_expediente_set`). Nada más: ni ingresos, ni sector, ni origen, ni web, ni historial. Alta con `hq.py expediente alta --tipo cliente` o con "Convertir en cliente".
- **Captación** (`#operacion/captacion`), mínimo: contactos sin cliente (`omc_contactos` con `expediente_id` null o de expediente no cliente) en una lista con organización, canal, frente, toques (fecha del último y número, tope dos), estado, próximo toque y respuesta. Filtro por frente y estado; los vencidos primero. Botón "Convertir en cliente" (owner) → `omc_contacto_convertir`. Sin embudo propio, sin campañas: eso es Swarmix.
- **Peticiones** (`#operacion/peticiones`): lista de encargos `de_diego = true` sin límite de fecha: estado, responsable, hito, último avance, días sin avance. Filtro por estado. Es donde se ve si alguien persigue lo que pidió Diego.

### 3.4 Equipo (`#equipo`)

¿Quién hace qué?

- **Organigrama** (`#equipo/organigrama`): árbol por `omc_agentes.jefe`: avatar, nombre, puesto, frentes, estado (activo, pausado, sin sesión), cuenta, tarjetas en curso. Sin euros. Clic abre la ficha.
- **Ficha de agente** (`#equipo/agente/ID`): cabecera (avatar, puesto, jefe, cuenta, modelo); frentes; tarjetas en curso, encoladas y bloqueadas con enlace al tablero filtrado; últimos 10 hechos; sesión (URL y hora; "Abrir sesión" para owner); consumo de 7 y 30 días por modelo (tokens y coste nocional). Acciones owner: editar frentes (`omc_agente_frentes_set`), pausar o reactivar (`omc_agente_pausar`), abrir sesión (`omc_sesion_solicitar`).

### 3.5 Recursos (`#recursos`)

¿Qué gastamos y qué nos queda?

- **Dinero** (`#recursos/dinero`): ingresos por mes y por bloque (`omc_ingresos`) contra la meta prorrateada, y las tarjetas de gasto aprobadas con importe. Solo lectura; el alta sigue en `hq.py ingreso`.
- **Cómputo** (`#recursos/computo`): cuentas diego@ y team@ con % de ventana y % de semana (`omc_cuentas_estado`) y agentes pausados por ahorro; mes en curso y 30 días a precio API (`omc_uso.coste_usd`); ranking por agente individualizado con desglose por modelo; por sesión (top 15). Sustituye a la vista Costes de la v1. La atribución de sesión a agente pasa a `omc_uso.agente`, rellenado por el latido; las filas viejas se atribuyen por ruta como hasta ahora.

### 3.6 Reglas (`#reglas`)

¿Con qué reglas jugamos?

- **Kit por frente** (`#reglas/kit`): el kit de cada frente (`omc_kit`), solo lectura; se edita con `hq.py kit`.
- **Decisiones** (`#reglas/decisiones`): la vista Decisiones de la v2 tal cual. Ficha `#reglas/decisiones/N`.
- **Manuales** (`#reglas/manuales`): tres enlaces fijos a Drive (reglas de agente, manual OMC, plantillas), definidos en `omc_kit` con frente `manuales`.

## 4. Datos y RPC nuevos

Esquema 2.0.7 → 2.1.0, aplicado con `bash scripts/hq/aplicar-schema.sh` por el controlador. Los implementadores no escriben en la BD.

Tabla nueva (una):

- `omc_cuentas_estado(empresa, cuenta text, pct_ventana int, pct_semana int, ventana_fin timestamptz, pausados text[], updated_at)`, clave `(empresa, cuenta)`. La escribe `hq-ahorro` en cada pasada, además del json actual.

Columnas nuevas, todas con default, sin tocar filas existentes:

- `omc_expedientes`: `organizacion text`, `proxima_accion text`, `proxima_fecha date`, `padre_id int`.
- `omc_uso`: `agente text`, rellenado por `hq-latido.sh` al registrar la sesión.
- `omc_agentes`: `pausado_hasta timestamptz`, `pausado_motivo text`. hq-ahorro no reactiva a quien pausó el owner.
- `omc_licitaciones.decision` admite `desierto`. Sin check nuevo.

RPC nuevos (security definer, comprueban token y rol como los actuales):

- `omc_agente_pausar(p_token, p_agente, p_hasta timestamptz, p_motivo)`: owner; `p_hasta` null reactiva.
- `omc_contacto_convertir(p_token, p_contacto_id, p_nombre_cliente)`: owner. Crea el expediente tipo `cliente` con `organizacion` del contacto y `estado_funnel` = 'contacto', cuelga de él el contacto y los demás contactos de la misma `organizacion` sin expediente, devuelve el id.
- `omc_licitaciones_pagina(p_token, p_filtros jsonb, p_pagina int)`: cualquier rol; 50 filas y el total.

Payload `omc_hq_v2` ampliado (se actualiza el contrato): `licitaciones_resumen` (contadores por estado y tipología, no filas), `contactos`, `clientes` (expedientes tipo cliente con hijos y contactos agregados), `peticiones`, `uso` (agregados 7 y 30 días por agente y modelo, top 15 sesiones), `cuentas`, `decisiones`, `kit`. Las filas de licitaciones no van en el payload. Objetivo: menos de 400 KB con gzip.

## 5. Seguridad y roles

- Con rol `agente` el payload omite `contactos`, `clientes`, `cuentas`, `peticiones` y el `uso` de otros agentes. Los tokens por agente (aparcado del plan 1) se dan de alta en `omc_tokens` al cerrar la tanda 3.
- Toda URL externa pasa por `urlSegura`.
- La ficha de cliente guarda organización; las personas van en `omc_contactos` con email profesional. Ningún campo admite DNI, IBAN ni móvil.
- Asuntos privados de Diego, regularización fiscal y moncon/Xolo siguen fuera de HQ.

## 6. Retirada de la v1

`public/hq/v1/` se retira el 30-sep si Licitaciones en v2 tiene cola "En análisis", bandeja "Por decidir", decisión desde la ficha y los tres fixes de Nuria del viernes 18. Hasta entonces el menú enlaza la v1. Al retirar, `v1/sw.js` pasa a uno que se desregistra y borra `hq-v1-*`.

## 7. Fases

SDD en worktree `.worktrees/hq-v3`, rama `hq-v3`; cada tanda se publica en main con `sh scripts/hq/version.sh` y se verifica con `verificar-hq-web.sh`. Cada tanda es un plan propio en `docs/superpowers/plans/`.

- **Tanda 1, jueves 17 tarde a viernes 18:** shell (barra superior, menú lateral, drawer, rutas y redirecciones, buscador), Hoy, Dirección/Objetivo con los datos actuales, Tablero, Expedientes y Decisiones movidos a sus rutas. Sin esquema nuevo.
- **Tanda 2, sábado 19 a lunes 21:** esquema 2.1.0, Licitaciones, Clientes, Captación, Peticiones, Embudo.
- **Tanda 3, martes 22:** Equipo, Recursos, Reglas, `omc_agente_pausar`, tokens por agente.
- **Checkpoint miércoles 23:** Diego ve las tres tandas publicadas y decide qué se amplía de la sección 9.

## 8. Criterios de aceptación

- Ninguna tarjeta se detalla fuera de `#operacion/tablero`; ningún coste de tokens fuera de `#recursos/computo` y de la ficha del agente; ningún ingreso fuera de `#recursos/dinero`.
- Todas las rutas antiguas redirigen y el push a `#decisiones/N` sigue abriendo la decisión.
- A 390 px el menú es un drawer y ninguna vista desborda horizontalmente salvo tablas con scroll propio.
- Con token de agente no aparece ningún botón de owner y el payload no contiene `contactos`, `clientes`, `cuentas` ni `peticiones` (test de contrato).
- El buscador encuentra por número un encargo, una licitación, una decisión y un cliente, y por texto un agente.
- "Convertir en cliente" crea el expediente, cuelga el contacto y navega a la ficha nueva.
- Consumo de 30 días por agente coincide con la suma de `omc_uso` (test SQL contra el payload en el tenant `pruebas`).
- Los 22 tests actuales siguen en verde; cada tanda añade los suyos con el shim DOM.
- "Publicado" solo tras `verificar-hq-web.sh` y `curl` de `HQ_VERSION`.

## 9. Después, solo si el uso lo pide (fuera del MVP)

Serie semanal de KPIs (`omc_kpi_semana`, `omc_kpi_foto`) y tendencias; reglas de agente editables en tabla (`omc_reglas`); edición de kit desde la web; vista Capacidad con alertas; ratios de coste por hecho y por euro presentado; alertas de consumo; proyección de caja; ingresos por cliente en la ficha; campos web, sector y origen del cliente; embudo de captación por campaña; edición de ingresos desde la interfaz; chat embebido; tiempo real; normalizar `decision` legada; notificaciones nuevas. El motor de licitaciones no se toca aquí (#996 a #998).

## 10. Quién

Chief ejecuta con SDD (implementer sonnet, reviewer sonnet, revisión final opus). Nuria (po-hq) verifica cada tanda contra la sección 8 y lleva el backlog de la v1 hasta el 30-sep. Diego valida en el checkpoint del 23.
