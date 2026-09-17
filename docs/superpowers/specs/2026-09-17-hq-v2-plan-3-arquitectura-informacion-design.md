# HQ v2 · Plan 3: arquitectura de la información por pregunta del CEO

Fecha: 2026-09-17. Autor: chief. Estado: aprobado en conversación por Diego el 17-sep ~07:20 ("Me encaja completamente"), pendiente de su lectura de este texto.
Spec madre: `docs/superpowers/specs/2026-09-16-hq-fuente-unica-cascada-design.md` (secciones 2.5 a 2.8 y 5). Este documento la desarrolla y donde choque, manda este.
Contrato del payload: `docs/superpowers/specs/2026-09-16-hq-v2-contrato-omc_hq_v2.md` (se amplía en la sección 4).

## 0. Por qué

Diego, 17-sep, tras navegar la v2 publicada (2.0.1):

- "Lo veo muy operativo a nivel de gestión de tareas y no tengo claro si se repiten entre pestañas." Las vistas Inicio, Plan, Tablero y Equipo enseñan las mismas tarjetas con filtros distintos.
- Faltan KPIs, embudo de licitaciones por estado y tipología, consumo de tokens, organigrama, agentes activos y sus fichas.
- "Estás replicando la v1 sin repensar la v2." Equipo/organigrama en un sitio; gastos, cuentas y tokens en otro, con el gasto de cada agente individualizado.
- Navegación por tabs no escala: hamburguesa u otro sistema para añadir muchas más vistas.
- CRM: gestión de clientes visible en la web, ficha por cliente con su carpeta de Drive como fuente de la verdad, cada expediente del cliente individualizado, y captación/outreach de nuevos clientes.

El plan 3 no añade datos nuevos a la BD salvo los que se listan en la sección 4. Reorganiza la interfaz alrededor de seis preguntas que se hace el CEO y da a cada dato una sola casa.

## 1. Principios

1. **Cada dato tiene una casa.** Una tarjeta, una licitación, un agente o un euro se ven en detalle en un solo sitio. El resto de vistas enlazan a esa casa, nunca la duplican. Los contadores agregados (número de tarjetas, euros) sí pueden aparecer en varias vistas.
2. **Navegación por pregunta, no por tabla.** El menú responde a "¿qué necesito hoy?", "¿vamos bien?", "¿qué está en marcha?", "¿quién hace qué?", "¿qué gastamos?", "¿con qué reglas?". Ninguna vista se llama como una tabla de la BD.
3. **Carpeta de Drive = archivo; HQ = estado.** Los documentos de un cliente o expediente viven en su carpeta de Drive. HQ guarda estado, fechas, importes, responsable y el enlace a la carpeta. HQ no almacena documentos.
4. **La interfaz no calcula.** Sumas, embudos, rankings y series salen del payload de `omc_hq_v2`. El navegador solo pinta y filtra. Si un número no está en el payload, no se enseña.
5. **Móvil primero.** Todo funciona a 390 px. El menú lateral se pliega a hamburguesa por debajo de 900 px.
6. **Token de agente ve, token de owner actúa.** Igual que en la v2 actual: `conf.rol` decide qué botones se pintan; el servidor vuelve a comprobarlo en cada RPC.
7. **Todo enlazable.** Cada vista y cada ficha tiene ruta `#area/vista/id` estable, apta para tarjetas, correos internos y push.
8. **Nada sensible en HQ.** Ni DNI, ni IBAN, ni móviles, ni palabras clave del Sobre Digital, ni asuntos privados de Diego (sección 9 de la spec madre).

## 2. Navegación

### 2.1 Barra superior (siempre visible)

- Izquierda: botón hamburguesa (solo < 900 px) y logotipo "HQ" que lleva a `#hoy`.
- Centro: buscador global. Acepta un número (`#996`, `996`, `L1234`) o texto. Busca sobre el payload ya cargado: encargos, licitaciones, contactos, clientes, expedientes, agentes, decisiones. Muestra hasta 12 resultados agrupados por tipo; Enter en el primero navega a su casa.
- Derecha: contador "Depende de ti" (número de tarjetas en `pendiente_diego` + decisiones abiertas; lleva a `#hoy/depende`), semáforo de cuentas (verde < 80 %, ámbar 80-94 %, rojo ≥ 95 % de la ventana de la cuenta más cargada; lleva a `#recursos/computo`), avatar del rol (owner o nombre del agente) con "Salir".
- Con token de agente el contador "Depende de ti" se sustituye por "Tus tarjetas" (encargos donde es responsable).

### 2.2 Menú lateral

- ≥ 900 px: columna fija de 232 px a la izquierda, plegable a 56 px (solo iconos) con un botón; el estado se recuerda en `localStorage` `hq_menu`.
- < 900 px: drawer que se abre con la hamburguesa, cierra al navegar o al tocar fuera.
- Seis áreas, cada una con sus vistas debajo. El área activa se expande; las demás muestran solo el título. Cada vista puede llevar un contador pequeño a la derecha (por ejemplo, Tablero muestra tarjetas activas).
- Al pie del menú: versión `HQ_VERSION`, enlace "v1 (hasta 30-sep)" mientras exista, y "Trabajar con Martí" (abre sesión, solo owner).

### 2.3 Rutas

Formato `#area/vista/id`. Las rutas anteriores redirigen: `#inicio` → `#hoy`, `#plan` → `#direccion/objetivo`, `#tablero` → `#operacion/tablero`, `#decisiones/N` → `#reglas/decisiones/N`, `#equipo` → `#equipo/organigrama`, `#expedientes/ID` → `#operacion/expedientes/ID`, `?id=N` → `#reglas/decisiones/N`. El `sw.js` al pulsar una notificación abre `d.url` si empieza por `/hq/`; si no, `/hq/#hoy`.

Filtros de lista van en la query del hash: `#operacion/tablero?frente=A1&agente=sales-motor`. El botón "Copiar enlace" de cada ficha y lista copia el hash completo.

## 3. Áreas y vistas

### 3.1 Hoy (`#hoy`)

Pregunta: ¿qué necesito hoy?

- **Depende de ti** (`#hoy/depende`): tarjetas en `pendiente_diego` ordenadas por antigüedad, con los tres botones de siempre (Aprobar, Rechazar, Posponer) y el enlace a la tarjeta. Máximo visible 20; el resto detrás de "Ver todas".
- **Tres semáforos**: objetivo (euros contratados vs meta prorrateada a la fecha), embudo (euros presentados en la semana vs 90.000), capacidad (% de la ventana de la cuenta más cargada). Cada semáforo enlaza a su casa en Dirección o Recursos. No repiten números que ya estén más abajo.
- **Tus peticiones de la semana**: los encargos con `de_diego = true` creados en los últimos 7 días, con estado y responsable. Es la vista "Lo que pediste esta semana" del informe de las 07:00.
- **Sesiones abiertas**: agentes con sesión viva (`omc_agentes.sesion_url_fecha` < 2 h) y su frente.
- Con token de agente: sustituye "Depende de ti" por "Tus tarjetas" y quita las peticiones.
- No hay tarjetas del tablero en Hoy salvo las de `pendiente_diego`. Hoy no es un tablero.

### 3.2 Dirección (`#direccion`)

Pregunta: ¿vamos bien?

- **Objetivo** (`#direccion/objetivo`): cuadro 2026 (300.000 EUR contratados a 31-dic) y 2027 (3 M): contratado, presentado, en análisis, cobrado, meta prorrateada, desviación. Debajo, los 5 bloques con sus frentes y el KPI de cada frente (valor actual, meta, tendencia de 4 semanas). Es la única casa del plan estratégico; sustituye a la vista Plan. La edición de KPI y líneas se mantiene con los RPC actuales (`omc_kpi_linea`, `hq.py plan-linea`).
- **Embudo** (`#direccion/embudo`): dos embudos. Licitaciones por estado (detectada, cribada, en análisis, presentada, adjudicada, perdida, desierta) con número e importe, filtrable por tipología (`omc_licitaciones.tipo`: servicios, suministros, formación, software, otros) y por frente. Clientes por `estado_funnel` de `omc_expedientes` tipo cliente (contacto, propuesta, aceptado, en curso, cerrado). Cada barra enlaza a la lista filtrada en Operación.
- **Ingresos** (`#direccion/ingresos`): ingresos por mes y por bloque (`omc_ingresos`) contra la meta prorrateada, y la proyección lineal a 31-dic. Solo lectura; el alta de ingresos sigue en `hq.py ingreso`.
- **Serie semanal**: cada frente guarda una foto semanal (tabla nueva `omc_kpi_semana`, sección 4). La tendencia de 4 semanas del cuadro objetivo sale de ahí. Hasta que haya cuatro fotos, la tendencia se pinta como "sin serie".

### 3.3 Operación (`#operacion`)

Pregunta: ¿qué está en marcha?

- **Tablero** (`#operacion/tablero`): el tablero Kanban de la v2 tal cual (arrastre, filtros por frente, agente, bloque, texto). Única casa de las tarjetas de encargo. Las fichas de tarjeta (`#operacion/tablero/ID`) mantienen el detalle actual.
- **Expedientes** (`#operacion/expedientes`): la vista de la v2, filtrada a los tipos que no son cliente (licitación, subvención, interno). Ficha `#operacion/expedientes/ID`.
- **Licitaciones** (`#operacion/licitaciones`): absorbe la v1. Lista paginada (50 por página, desde el servidor) con filtros por estado, tipología, CCAA, importe, frente y texto. Tiles de cabecera con los mismos contadores que la v1 (Por decidir, En análisis, Presentadas, Adjudicadas, Perdidas). Ficha `#operacion/licitaciones/ID` con resumen corto, solvencia, medios personales art. 76, enlace a la plataforma, hilo y la decisión desde la propia ficha (`omc_licitacion_decidir`). Etiqueta nueva `desierto` como valor de `decision` y filtro "Desiertos" (encargos #997 y #998). Requisitos de Nuria (po-hq, specs #35/#36/#37 del backlog) que entran aquí: la cola "En análisis" visible con responsable y días; la bandeja "Por decidir" solo la ve el owner; una licitación "Presentada" queda muda (sin avisos ni contadores de pendiente). No se normalizan los valores legados de `decision`.
- **Clientes** (`#operacion/clientes`): CRM. Lista de clientes (expedientes tipo `cliente`) con organización, sector, estado del embudo, ingresos acumulados, próxima acción y fecha. Ficha `#operacion/clientes/ID` con: cabecera (organización, web, sector, origen, responsable), enlace grande a la carpeta de Drive `Empresa/Clientes/<Cliente>/` (`carpeta_url`) que es el archivo del cliente; contactos y toques (`omc_contactos` con `expediente_id` = este cliente o sus hijos); expedientes hijos (cupones, formación, proyectos) con sus entregables y estado; ingresos (`omc_ingresos` del cliente); próxima acción editable (owner) y último resumen. Un expediente hijo se abre en `#operacion/expedientes/ID`. Alta de cliente desde `hq.py expediente alta --tipo cliente` o desde "Convertir en cliente" en Captación.
- **Captación** (`#operacion/captacion`): contactos de prospección (`omc_contactos` sin `expediente_id` de cliente) agrupados por campaña y frente, con toques (máximo dos por regla), respuestas, reuniones y próximos toques vencidos. Embudo de prospección (contactado, respondió, reunión, propuesta). Botón "Convertir en cliente" (owner) que crea el expediente cliente y cuelga de él el contacto y su hilo (`omc_contacto_convertir`, sección 4). Enlaza a la campaña de Swarmix si existe `respuesta_ref`.
- **Peticiones** (`#operacion/peticiones`): registro de todo lo que pidió Diego (`de_diego = true`) sin límite de fecha, con estado, responsable, hito, último avance y días sin avance. Es la casa de "Diego repite porque nadie persigue". Filtro por semana y por estado.

### 3.4 Equipo (`#equipo`)

Pregunta: ¿quién hace qué?

- **Organigrama** (`#equipo/organigrama`): árbol por `omc_agentes.jefe`, con avatar, nombre, puesto, frentes, estado (activo, pausado, sin sesión), cuenta (diego@ o team@) y carga (tarjetas en curso). Sin euros: los euros viven en Recursos. Clic abre la ficha.
- **Capacidad** (`#equipo/capacidad`): tabla de agentes con tarjetas en curso, encoladas, bloqueadas, últimos 7 días hechos, días sin actividad. Ordenable. Aviso cuando un agente supera 8 tarjetas en curso o lleva más de 3 días sin actividad con tarjetas asignadas.
- **Ficha de agente** (`#equipo/agente/ID`): cabecera (avatar, nombre, puesto, jefe, cuenta, modelo, nivel); frentes y su kit; carga actual con enlace al tablero filtrado; últimos 10 hechos; sesión (URL y hora, botón "Abrir sesión" para owner); consumo de 7 y 30 días por modelo (tokens y coste nocional) con aviso si supera su asignación, y euros presentados o contratados si tiene frente comercial. Acciones owner: editar frentes (`omc_agente_frentes_set`), pausar o reactivar (`omc_agente_pausar`, sección 4), abrir sesión (`omc_sesion_solicitar`).

### 3.5 Recursos (`#recursos`)

Pregunta: ¿qué gastamos y qué nos queda?

- **Dinero** (`#recursos/dinero`): ingresos por mes y bloque (misma fuente que Dirección/Ingresos, aquí con el detalle por fila), gastos aprobados (tarjetas de tipo gasto aprobadas, con importe), proyección de caja a 3 meses. Solo lectura.
- **Cómputo** (`#recursos/computo`): cuentas diego@ y team@ con % de ventana de 5 h y % de semana (tabla nueva `omc_cuentas_estado`, escrita por hq-ahorro), agentes pausados por ahorro; mes en curso a precio API (`omc_uso.coste_usd`), 30 días; ranking por agente (individualizado, con modelos), por bloque y frente, por sesión (top 15), por modelo contra el modelo asignado; ratio de coste nocional por tarjeta hecha y por euro presentado; alertas (agente que dobla su media semanal, sesión sin asignar a agente, modelo distinto del asignado). Sustituye a la vista Costes de la v1 y a `hq-calidad.py` en lo que enseña. La atribución de sesión a agente pasa de "por ruta" a `omc_uso.agente`, rellenado por el latido de sesión (sección 4).

### 3.6 Reglas (`#reglas`)

Pregunta: ¿con qué reglas jugamos?

- **Kit por frente** (`#reglas/kit`): el kit de cada frente (`omc_kit`), editable por owner (`omc_kit_set`).
- **Reglas de agente** (`#reglas/agentes`): las reglas de `docs/empresa/reglas-agente-hq.md` cargadas en tabla `omc_reglas` (sección 4), numeradas y editables por owner (`omc_regla_set`). El fichero markdown se regenera desde la tabla con `hq.py reglas exportar`; la tabla manda.
- **Decisiones** (`#reglas/decisiones`): la vista Decisiones de la v2 tal cual, ficha `#reglas/decisiones/N`.
- **Manuales** (`#reglas/manuales`): enlaces a los documentos de empresa en Drive (OMC, metodología, plantillas). Lista mantenida en `omc_kit` con frente `manuales`.

## 4. Datos y RPC nuevos

Esquema pasa de 2.0.7 a 2.1.0. Todo se aplica con `bash scripts/hq/aplicar-schema.sh`; los implementadores no escriben en la BD.

Tablas nuevas:

- `omc_kpi_semana(empresa, semana date, frente text, valor numeric, meta numeric, presentado_eur numeric, contratado_eur numeric, created_at)`, clave `(empresa, semana, frente)`. La escribe `omc_kpi_foto(p_token)` (owner o cron con token de solo lectura no vale: la foto escribe, así que la dispara `hq-informe.py` los lunes 07:00 con el token del chief).
- `omc_cuentas_estado(empresa, cuenta text, pct_ventana int, pct_semana int, ventana_fin timestamptz, pausados text[], updated_at)`, clave `(empresa, cuenta)`. La escribe `hq-ahorro` en cada pasada (hoy escribe `~/.config/77delta/hq-ahorro.json`; pasa a escribir los dos).
- `omc_reglas(empresa, num int, texto text, ambito text, activa bool, updated_at)`, clave `(empresa, num)`. Carga inicial desde el markdown con `hq.py reglas importar`.

Columnas nuevas (todas con default, no se tocan filas existentes):

- `omc_expedientes`: `organizacion text`, `web text`, `sector text`, `origen text`, `proxima_accion text`, `proxima_fecha date`, `padre_id int` (expediente cliente del que cuelga).
- `omc_uso`: `agente text` (id de `omc_agentes`), rellenado por `hq-latido.sh` al registrar la sesión; las filas viejas se atribuyen como hasta ahora por ruta.
- `omc_agentes`: `pausado_hasta timestamptz`, `pausado_motivo text`. hq-ahorro respeta `pausado_hasta` (no reactiva a quien pausó el owner).
- `omc_licitaciones.decision`: se admite el valor `desierto`. Sin check nuevo.

RPC nuevos (todos `security definer`, comprueban token y rol como los actuales):

- `omc_agente_pausar(p_token, p_agente, p_hasta timestamptz, p_motivo)`: owner. `p_hasta` null reactiva.
- `omc_contacto_convertir(p_token, p_contacto_id, p_nombre_cliente)`: owner. Crea expediente tipo `cliente` con `organizacion` = `omc_contactos.organizacion`, `origen` = canal del contacto, `estado_funnel` = 'contacto', y pone `expediente_id` del contacto y de todos los contactos de la misma `organizacion` sin expediente. Devuelve el id.
- `omc_kit_set(p_token, p_frente, p_texto)`: owner.
- `omc_regla_set(p_token, p_num, p_texto, p_activa)`: owner.
- `omc_kpi_foto(p_token)`: owner. Inserta o actualiza la fila de la semana en curso por frente a partir de `omc_plan_lineas` y de `omc_licitaciones`.
- `omc_licitaciones_pagina(p_token, p_filtros jsonb, p_pagina int)`: cualquier rol. Devuelve 50 filas y el total.

Payload `omc_hq_v2` ampliado (el contrato se actualiza en su fichero): añade `licitaciones_resumen` (contadores por estado y tipología, no las filas), `contactos`, `clientes` (expedientes tipo cliente con hijos, ingresos y contactos agregados), `peticiones`, `uso` (agregados 7 y 30 días por agente, modelo, sesión, frente), `cuentas`, `kpi_semana` (últimas 8 semanas), `decisiones`, `kit`, `reglas`, `manuales`. Las filas de licitaciones no van en el payload: se piden a `omc_licitaciones_pagina`. Tamaño objetivo del payload: menos de 400 KB con gzip; si se supera, `uso` por sesión se recorta al top 15.

## 5. Seguridad y roles

- Tokens por agente (aparcado del plan 1) entra aquí: cada agente tiene su fila en `omc_tokens` con rol `agente`; el payload para rol agente omite `contactos`, `clientes`, `uso` de otros agentes, `cuentas` y `peticiones`.
- Toda URL externa pasa por `urlSegura` (solo http(s)).
- Ningún campo del CRM admite DNI, IBAN ni móvil: la ficha de cliente guarda organización, web y sector; las personas van en `omc_contactos` con email profesional. La validación es del RPC de alta (rechaza cadenas con formato de IBAN o de DNI).
- Los asuntos privados de Diego, la regularización fiscal y moncon/Xolo siguen fuera de HQ.

## 6. Retirada de la v1

`public/hq/v1/` se retira el 30-sep si Licitaciones en v2 tiene cola "En análisis", bandeja "Por decidir", decisión desde la ficha y los tres fixes de Nuria del viernes 18. Hasta entonces el menú enlaza la v1. Al retirarla, `v1/sw.js` se sustituye por uno que se desregistra y borra `hq-v1-*`.

## 7. Fases

Todas las tandas se ejecutan con SDD en un worktree `.worktrees/hq-v3`, rama `hq-v3`, y se publican en main al cerrar cada tanda con `sh scripts/hq/version.sh` y verificación `verificar-hq-web.sh`.

- **Tanda 1, jueves 17 tarde a viernes 18:** shell nuevo (barra superior, menú lateral, drawer, rutas y redirecciones, buscador global), Hoy completo, Dirección/Objetivo y Dirección/Ingresos con los datos actuales, Operación/Tablero y Expedientes y Reglas/Decisiones movidos a sus rutas. Sin esquema nuevo.
- **Tanda 2, sábado 19 a lunes 21:** esquema 2.1.0 (columnas de cliente, `omc_uso.agente`, `desierto`, `omc_licitaciones_pagina`, `omc_contacto_convertir`), Operación/Licitaciones, Clientes, Captación y Peticiones, Dirección/Embudo.
- **Tanda 3, martes 22:** Equipo (organigrama, capacidad, ficha con consumo), Recursos (dinero, cómputo con `omc_cuentas_estado` y hq-ahorro escribiendo la tabla), `omc_agente_pausar`.
- **Checkpoint miércoles 23:** Diego ve tandas 1 a 3 publicadas.
- **Tanda 4, jueves 24 a viernes 25:** Reglas (kit, reglas, manuales), `omc_kpi_semana` y `omc_kpi_foto` en el informe del lunes, tokens por agente, NITs aparcados del plan 2 (orden `?t&id` en api.js/main.js), retirada de la v1 preparada para el 30.

## 8. Criterios de aceptación

- Ninguna tarjeta de encargo se pinta en detalle fuera de `#operacion/tablero`; ningún euro de ingreso se detalla fuera de `#recursos/dinero`; ningún coste de tokens fuera de `#recursos/computo` y de la ficha del agente.
- Todas las rutas antiguas redirigen a la nueva y el push a `#decisiones/N` sigue abriendo la decisión.
- A 390 px el menú es un drawer, ninguna vista desborda horizontalmente salvo tablas con scroll propio.
- Con token de agente no aparece ningún botón de owner y el payload no contiene `contactos`, `clientes`, `cuentas` ni `peticiones` (test de contrato).
- El buscador encuentra por número un encargo, una licitación, una decisión y un cliente, y por texto un agente.
- "Convertir en cliente" crea el expediente, cuelga el contacto y navega a la ficha nueva.
- Consumo por agente de 30 días coincide con la suma de `omc_uso` (test SQL contra el payload en el tenant `pruebas`).
- Tests: los 22 actuales siguen en verde y cada tanda añade los suyos con el shim DOM (`scratchpad/humo-*.mjs`); objetivo al cierre del plan: 45 o más.
- Publicación verificada con `verificar-hq-web.sh` y `curl` de `HQ_VERSION` antes de decir "publicado".

## 9. Fuera de alcance

Chat embebido, tiempo real, rehacer el motor de licitaciones (eso son #996 a #998), cambios de esquema fuera de la sección 4, normalizar `decision` legada, edición de ingresos desde la interfaz, notificaciones nuevas, asuntos fiscales y privados.

## 10. Quién

Chief ejecuta con SDD (implementer sonnet, reviewer sonnet, revisión final opus). Nuria (po-hq) verifica cada tanda publicada contra la sección 8 y lleva el backlog de la v1 hasta el 30-sep. Diego valida en el checkpoint del 23.
