# Contrato de datos: `omc_hq_v2(p_token)`

Tarea 16 del plan `2026-09-16-hq-v2-plan-1-base`. Lectura única para la interfaz nueva (plan 2): una llamada
RPC devuelve toda la cascada objetivo -> bloque -> frente -> encargo, más los datos auxiliares (kit, contactos,
expedientes, sesiones, agentes, pendientes, licitaciones, uso). Quien construya la UI puede trabajar entero
desde este documento, sin leer `scripts/hq/schema-v2.sql`.

Definida en `scripts/hq/schema-v2.sql` (sección "T16"), junto con la función auxiliar `omc_columna_kanban`.

## Cómo se llama

```
POST /rest/v1/rpc/omc_hq_v2
{ "p_token": "<token del owner o de un agente>" }
```

Devuelve un único objeto JSON. No hay paginación ni filtros: siempre trae todo lo que le corresponde ver a
ese token.

## Owner vs agente

- **`pendientes`**, **`pospuestas`**, **`hilos`**, **`licitaciones`** y **`uso`**: solo owner. Con token de
  agente llegan `[]`, `[]`, `{}`, `[]` y `{}` (la función interna `omc_hq(p_token)` y `omc_hq_uso(p_token)`
  son "solo owner" y lanzarían excepción si se llamaran con un token de agente; `omc_hq_v2` las evita en ese
  caso en vez de fallar entera). `pospuestas` y `hilos` se añaden en `2.0.6` (tarea 5 del plan 2, interfaz de
  Decisiones): la tarjeta de una pendiente pospuesta no vive en `pendientes` sino en `pospuestas`, y el hilo
  de mensajes de una pendiente no vive dentro de `pendientes[].mensajes` (esa clave no existe) sino en
  `hilos`, aparte.
- **`agentes[].sesion_url`** y **`sesion_url_fecha`**: un agente solo ve su propia `sesion_url` (comparando por
  `nombre` del token contra el `id` del agente); las de los demás agentes llegan sin esa clave. El owner ve
  todas.
- El resto de claves (`objetivos`, `bloques`, `frentes`, `encargos`, `avances`, `kit`, `contactos`,
  `expedientes`, `sesiones`) son iguales para owner y agente.

## Claves de la respuesta

### `version` (string), `rol` (string), `ahora` (timestamptz) y `empresa` (text)
`version` = `omc_v2_version()` (ej. `"2.0.3"`). `rol` = `'owner'` o `'agente'`, el del token usado. `ahora` es
el instante del servidor en el momento de la llamada (úsalo para calcular "hace cuánto" en el cliente en vez
de `Date.now()` del navegador). `empresa` = `t.empresa` (id de la empresa del token, de `omc_tokens.empresa`,
FK a `omc_empresas.id`); lo usa el cliente para el canal realtime `omc:<empresa>` (Tarea 1 de plan 2, esquema
2.0.5).

### `objetivos[]` (de `omc_plan_objetivo`, uno por horizonte/año)

| Campo | Tipo | Origen | Notas |
|---|---|---|---|
| `horizonte` | int | `omc_plan_objetivo.horizonte` | año objetivo, ej. `2026` |
| `titulo` | text | `omc_plan_objetivo.titulo` | ej. "Contratado a 31 de diciembre" |
| `meta` | numeric | `omc_plan_objetivo.meta` | la meta, en la unidad de `unidad` |
| `unidad` | text | `omc_plan_objetivo.unidad` | normalmente `'EUR'` |
| `fecha_limite` | date o null | `omc_plan_objetivo.fecha_limite` | |
| `contratado_eur` | numeric | calculado | suma de `omc_ingresos.importe` con `estado` en `('contratado','facturado','cobrado')` y `extract(year from fecha) = horizonte` |
| `presentado_eur` | numeric | calculado | suma de `omc_licitaciones.importe` con `upper(decision) in ('OK','APROBADA')` y año de `coalesce(fecha_decision, cierre)` = `horizonte` |

Nota: el brief original de la tarea nombraba estas columnas `meta_eur`, `kpi` y `texto`; no existen en el
esquema real (es `meta`, `unidad`, `titulo`). Se usan los nombres reales.

Fix round 1 (revisor T16): en producción hay legado `'Aprobada'` (3 filas, 66.255 EUR) además de `'OK'`, y
también `'Descartada'`/`'Descartado'`/`'NOK'` que no son `'No'`. Parche mínimo en `presentado_eur`:
`upper(decision) in ('OK','APROBADA')`, sin normalizar la columna ni añadir un check (eso tocaría datos de
producción sin autorización). Pendiente plan 2: normalizar `omc_licitaciones.decision` y validar en
`omc_licitaciones_subir`.

### `bloques[]` (de `omc_plan_bloques`, T3)

| Campo | Tipo | Origen | Notas |
|---|---|---|---|
| `id` | bigint | `omc_plan_bloques.id` | |
| `letra` | text | `omc_plan_bloques.letra` | ej. `'A'` |
| `nombre` | text | `omc_plan_bloques.nombre` | |
| `meta_eur` | numeric | `omc_plan_bloques.meta_eur` | |
| `director` | text o null | `omc_plan_bloques.director` | |
| `orden` | int | `omc_plan_bloques.orden` | |
| `frentes_n` | int | calculado | nº de `omc_plan_lineas` activas con `bloque_id` = este bloque |
| `encargos_abiertos` | int | calculado | nº de `omc_encargos` en `('encolado','en_curso','bloqueado_diego')` cuyo frente cuelga de este bloque |
| `contratado_eur` | numeric | **siempre `0`** | **limitación conocida**: `omc_ingresos` no tiene `linea_id` ni `bloque_id`, no hay forma de atribuir un ingreso a un bloque con el esquema actual. La clave existe para que la UI no rompa, pero no lleva dato real hasta que se añada esa columna. El `contratado_eur` real por año está en `objetivos[]`. |

Pendiente plan 2: `omc_ingresos.linea_id`.

Solo bloques con `activo = true`.

### `frentes[]`
Es literalmente `omc_frentes_lista(p_token)` (T3, `schema-v2.sql:141-151`), sin cambios. Corregido en este
fix: la versión anterior de este contrato citaba campos que no existen (`bloque`, `semáforo`, `progreso`).

| Campo | Tipo | Origen | Notas |
|---|---|---|---|
| `id` | bigint | `omc_plan_lineas.id` | |
| `codigo` | text | `omc_plan_lineas.codigo` | ej. `'A1'` |
| `linea` | text | `omc_plan_lineas.linea` | |
| `kpi` | text | `omc_plan_lineas.kpi` | |
| `valor_actual` | numeric o null | `omc_plan_lineas.valor_actual` | |
| `meta` | numeric o null | `omc_plan_lineas.meta` | |
| `unidad` | text o null | `omc_plan_lineas.unidad` | |
| `responsable` | text o null | `omc_plan_lineas.responsable` | |
| `proximo_hito` | text o null | `omc_plan_lineas.proximo_hito` | |
| `fecha_hito` | date o null | `omc_plan_lineas.fecha_hito` | |
| `etiquetas` | text[] | `omc_plan_lineas.etiquetas` | |
| `orden` | int | `omc_plan_lineas.orden` | |
| `bloque_id` | bigint o null | `omc_plan_bloques.id` (join por `bloque_id`) | |
| `bloque_letra` | text o null | `omc_plan_bloques.letra` | |
| `bloque_nombre` | text o null | `omc_plan_bloques.nombre` | |
| `encargos_abiertos` | int | calculado | nº de `omc_encargos` en `('encolado','en_curso','bloqueado_diego')` con `linea_id` = este frente |

Solo frentes con `activa = true`.

### `encargos[]`

Incluye los vivos (`encolado`, `en_curso`, `bloqueado_diego`) más los `hecho`/`descartado` de los últimos 14
días (por `fecha_avance`, o `fecha` si no hay avance).

| Campo | Tipo | Origen | Notas |
|---|---|---|---|
| `id` | bigint | `omc_encargos.id` | |
| `codigo` | text o null | `omc_plan_lineas.codigo` (join por `linea_id`) | código del frente, ej. `'A1'` |
| `bloque_letra` | text o null | `omc_plan_bloques.letra` (join por `bloque_id` del frente) | |
| `texto` | text | `omc_encargos.texto` | |
| `interpretacion` | text | `omc_encargos.interpretacion` | |
| `estado` | text | `omc_encargos.estado` | `encolado`\|`en_curso`\|`bloqueado_diego`\|`hecho`\|`descartado` |
| `columna` | text | calculado, `omc_columna_kanban` | ver mapeo Kanban abajo. **Única fuente de verdad: la UI no lo recalcula.** |
| `prioridad` | int | `omc_encargos.prioridad` | 0 = alta ... valores altos = baja (convención, no hay tope duro) |
| `agente` / `responsable` | text | `omc_encargos.agente` | mismo valor en ambas claves (compatibilidad con nombres usados en distintos sitios de la UI) |
| `departamento` | text | `omc_encargos.departamento` | |
| `fecha_hito` | date o null | `omc_encargos.fecha_hito` | |
| `proximo_hito` | text | `omc_encargos.proximo_hito` | |
| `ultimo_avance` | text | `omc_encargos.ultimo_avance` | |
| `fecha_avance` | timestamptz o null | `omc_encargos.fecha_avance` | |
| `rojo` | bool | calculado | `true` solo si `estado = 'en_curso'` y `coalesce(fecha_avance, fecha) < ahora - 48h` |
| `etiquetas` | text[] | `omc_encargos.etiquetas` | |
| `enlaces` | jsonb | `omc_encargos.enlaces` | |
| `orden_kanban` | int | `omc_encargos.orden_kanban` | posición manual dentro de su columna |
| `origen` | text o null | `omc_encargos.origen` | |
| `expediente_id` | bigint o null | `omc_encargos.expediente_id` | |
| `fuente_cierre` | text o null | `omc_encargos.fuente_cierre` | |
| `entregable_url` | text o null | `omc_encargos.entregable_url` | |
| `motivo_descarte` | text o null | `omc_encargos.motivo_descarte` | solo relevante si `estado = 'descartado'` |
| `fecha` | timestamptz | `omc_encargos.fecha` | fecha de alta |
| `avances_n` | int | calculado | nº de filas en `omc_encargo_avances` para este encargo |

#### Mapeo Kanban (única definición: `omc_columna_kanban(estado, prioridad, fecha_hito)`)

| `estado` | condición extra | `columna` |
|---|---|---|
| `en_curso` | - | `en_curso` |
| `bloqueado_diego` | - | `bloqueado` |
| `hecho` | - | `hecho` |
| `descartado` | - | `hecho` |
| `encolado` | `fecha_hito is null` o `prioridad >= 8` | `backlog` |
| `encolado` | `fecha_hito` fijada y `prioridad < 8` | `por_hacer` |

### `avances[]`
= `omc_feed(p_token, ahora - 3 días)`. Cada item: `id`, `encargo_id`, `texto_encargo` (primeros 80 caracteres),
`codigo` (frente), `agente`, `autor`, `tipo`, `texto`, `fecha`. Ventana recortada de 7 a 3 días en esta tarea
por tamaño de respuesta (ver "Tamaño de la respuesta" más abajo).

### `kit[]`
= `omc_kit_lista(p_token)`: solo kit vigente (`vigente = true`).

| Campo | Tipo | Origen | Notas |
|---|---|---|---|
| `id` | bigint | `omc_kit.id` | |
| `empresa` | text | `omc_kit.empresa` | siempre la del token; no filtrar por esto en el cliente |
| `linea_id` | bigint o null | `omc_kit.linea_id` | null = kit general, no atado a un frente |
| `tipo` | text | `omc_kit.tipo` | `'plantilla'`\|`'oficial'`\|`'procedimiento'`\|`'regla'` |
| `nombre` | text | `omc_kit.nombre` | |
| `url` | text o null | `omc_kit.url` | |
| `texto` | text o null | `omc_kit.texto` | |
| `version` | text | `omc_kit.version` | |
| `vigente` | bool | `omc_kit.vigente` | siempre `true` en esta clave (la función ya filtra) |
| `actualizado_por` | text o null | `omc_kit.actualizado_por` | |
| `fecha` | timestamptz | `omc_kit.fecha` | |
| `codigo` | text o null | `omc_plan_lineas.codigo` (join por `linea_id`) | solo si `linea_id` no es null |

### `contactos[]`
Basado en `omc_contactos_lista(p_token, {})`, filtrado a: `fecha` en los últimos 14 días, **o** pendiente de
toque real (`estado = 'enviado'` y `proximo_toque <= hoy`). Recortado en esta tarea (antes devolvía el
historial completo sin límite) para acotar tamaño.

| Campo | Tipo | Origen | Notas |
|---|---|---|---|
| `id` | bigint | `omc_contactos.id` | |
| `empresa` | text | `omc_contactos.empresa` | |
| `persona` | text o null | `omc_contactos.persona` | |
| `email` | text o null | `omc_contactos.email` | |
| `organizacion` | text o null | `omc_contactos.organizacion` | |
| `canal` | text | `omc_contactos.canal` | `'correo'`\|`'linkedin'`\|`'formulario'`\|`'telefono'`\|`'plataforma'` |
| `motivo` | text | `omc_contactos.motivo` | |
| `linea_id` | bigint o null | `omc_contactos.linea_id` | |
| `encargo_id` | bigint o null | `omc_contactos.encargo_id` | |
| `expediente_id` | bigint o null | `omc_contactos.expediente_id` | |
| `solicitud_id` | bigint o null | `omc_contactos.solicitud_id` | |
| `agente` | text o null | `omc_contactos.agente` | |
| `fecha` | timestamptz | `omc_contactos.fecha` | |
| `toque` | int | `omc_contactos.toque` | número de toque (1, 2, ...) |
| `estado` | text | `omc_contactos.estado` | `'previsto'`\|`'enviado'`\|`'respondido'`\|`'reunion'`\|`'cerrado'`\|`'sin_respuesta'` |
| `proximo_toque` | date o null | `omc_contactos.proximo_toque` | |
| `respuesta_ref` | text o null | `omc_contactos.respuesta_ref` | |
| `respuesta_fecha` | timestamptz o null | `omc_contactos.respuesta_fecha` | |
| `updated_at` | timestamptz | `omc_contactos.updated_at` | |
| `codigo` | text o null | `omc_plan_lineas.codigo` (join por `linea_id`) | |
| `texto_encargo` | text o null | primeros 60 caracteres de `omc_encargos.texto` (join por `encargo_id`) | |

### `expedientes[]`
= `omc_expedientes_lista(p_token, {})`, sin filtro adicional (todos los `activo = true`).

| Campo | Tipo | Origen | Notas |
|---|---|---|---|
| `id` | bigint | `omc_expedientes.id` | |
| `empresa` | text | `omc_expedientes.empresa` | |
| `tipo` | text | `omc_expedientes.tipo` | `'cliente'`\|`'producto'`\|`'convocatoria'`\|`'licitacion'` |
| `nombre` | text | `omc_expedientes.nombre` | |
| `linea_id` | bigint o null | `omc_expedientes.linea_id` | |
| `responsable` | text o null | `omc_expedientes.responsable` | |
| `ficha_url` | text o null | `omc_expedientes.ficha_url` | |
| `carpeta_url` | text o null | `omc_expedientes.carpeta_url` | |
| `estado_funnel` | text o null | `omc_expedientes.estado_funnel` | |
| `entregables` | jsonb | `omc_expedientes.entregables` | |
| `importe` | numeric o null | `omc_expedientes.importe` | |
| `resumen_estado` | text o null | `omc_expedientes.resumen_estado` | |
| `resumen_fecha` | timestamptz o null | `omc_expedientes.resumen_fecha` | |
| `licitacion_expediente` | text o null | `omc_expedientes.licitacion_expediente` | |
| `activo` | bool | `omc_expedientes.activo` | siempre `true` en esta clave |
| `created_at` | timestamptz | `omc_expedientes.created_at` | |
| `updated_at` | timestamptz | `omc_expedientes.updated_at` | |
| `codigo` | text o null | `omc_plan_lineas.codigo` (join por `linea_id`) | |
| `encargos_abiertos` | int | calculado | nº de `omc_encargos` en `('encolado','en_curso','bloqueado_diego')` con `expediente_id` = este expediente |
| `sesion_abierta` | text o null | calculado | `agente` de la sesión abierta de este expediente, si hay una |

### `sesiones[]`
Sesiones en `('abierta', 'solicitada')`, construidas dentro de `omc_hq_v2` (no llama a una función `_lista`
propia):

| Campo | Tipo | Origen | Notas |
|---|---|---|---|
| `id` | bigint | `omc_sesiones.id` | |
| `expediente_id` | bigint | `omc_sesiones.expediente_id` | |
| `nombre` | text | `omc_expedientes.nombre` (join por `expediente_id`) | |
| `agente` | text | `omc_sesiones.agente` | |
| `estado` | text | `omc_sesiones.estado` | `'solicitada'`\|`'abierta'` (nunca `'cerrada'`, no entran en el filtro) |
| `abierta` | timestamptz o null | `omc_sesiones.abierta` | |
| `created_at` | timestamptz | `omc_sesiones.created_at` | |

### `agentes[]`
= `omc_agentes_lista(p_token)`, con `sesion_url`/`sesion_url_fecha` ocultas a un agente si no son las suyas
(ver "Owner vs agente" arriba).

| Campo | Tipo | Origen | Notas |
|---|---|---|---|
| `id` | text | `omc_agentes.id` | |
| `nombre` | text | `omc_agentes.nombre` | |
| `depto` | text | `omc_agentes.depto` | |
| `nivel` | int | `omc_agentes.nivel` | |
| `modelo` | text o null | `omc_agentes.contrato->>'modelo'` | |
| `activo` | bool | `omc_agentes.activo` | |
| `frentes` | text[] | `omc_agentes.frentes` | |
| `frentes_codigos` | text[] | `omc_agentes.frentes` | mismo valor que `frentes`, clave duplicada por compatibilidad con la UI |
| `cuenta` | text o null | `omc_agentes.cuenta` | |
| `avatar_url` | text o null | `omc_agentes.avatar_url` | |
| `sesion_url` | text o null | `omc_agentes.sesion_url` | **oculta (clave ausente) para un agente que consulta otro agente distinto de sí mismo** |
| `sesion_url_fecha` | timestamptz o null | `omc_agentes.sesion_url_fecha` | misma ocultación que `sesion_url` |
| `ultima_actividad` | timestamptz o null | `omc_agentes.ultima_actividad` | |
| `encargos_abiertos` | int | calculado | nº de `omc_encargos` en `('encolado','en_curso','bloqueado_diego')` cuyo `agente` contiene el `id` de este agente |
| `sesion_abierta` | bigint o null | calculado | `expediente_id` de la sesión abierta de este agente, si hay una |

### `pendientes[]`
Solo owner (agente: `[]`). = `omc_hq(p_token).pendientes`: solicitudes de `omc_solicitudes` pendientes para
Diego. Fecha límite en la clave `vence`, no `fecha_limite`. Columnas reales de `omc_solicitudes`: `id`,
`empresa`, `agente`, `depto`, `tipo`, `titulo`, `detalle`, `importe`, `riesgo`, `enlace`, `vence`,
`prioridad`, `estado`, `respuesta`, `resultado`, `created_at`, `resolved_at`, `done_at`, `pospuesta_hasta`.
No incluye `pendientes[].mensajes`: ese campo no existe en ningún nivel de `omc_hq_v2`, ver `hilos` más abajo.
No incluye las solicitudes ya pospuestas (`pospuesta_hasta` en el futuro): esas viajan en `pospuestas[]`, no
aquí (ver debajo).

### `pospuestas[]` (añadida en `2.0.6`)
Solo owner (agente: `[]`). Mismas columnas que `pendientes[]` (misma tabla `omc_solicitudes`, mismo filtro de
`omc_hq(p_token)` salvo que estas SÍ tienen `pospuesta_hasta` fijado en el futuro). Añadida por ruling del
controlador en la tarea 5 (interfaz de Decisiones): sin esta clave, la UI no tenía forma de listar por
separado lo que Diego pospuso a propósito, ni de recuperarlo cuando `pospuesta_hasta` vence. La UI trata una
fila de `pospuestas[]` igual que una de `pendientes[]` (misma tarjeta, mismo `agrupar()`); la única diferencia
es de dónde viene, no de forma.

### `hilos` (añadida en `2.0.6`)
Solo owner (agente: `{}`). Mapa `solicitud_id -> [{id, autor, texto, ts}]`, copiado de la clave `hilos` que ya
devuelve `omc_hq(p_token)` en v1 (`omc_mensajes` agrupados por `solicitud_id`). Añadida por ruling del
controlador en la tarea 5: el brief original de esa tarea asumía que el hilo de una pendiente viajaba anidado
como `pendientes[].mensajes`, pero esa forma no existe en ningún esquema real; el hilo siempre vivió aparte,
igual que en v1. La UI busca el hilo de una tarjeta con `(hilos[solicitud_id] || [])`, nunca con
`pendiente.mensajes`.

### `licitaciones[]`
Solo owner (agente: `[]`). Basado en `omc_hq(p_token).licitaciones`, con dos recortes por ruling del
controlador (tarea 16, ajuste tras el informe):

1. **Filtro por fecha**: solo filas con `cierre` nulo o `cierre >= hace 7 días`. Lo cerrado hace más de una
   semana no va al tablero; el histórico completo se sirve en plan 2 con una RPC paginada aparte (todavía
   no existe, ver más abajo). Medido en producción: esto solo baja de 1641 a 1603 filas, porque la mayoría
   de las `'Pendiente'` tiene `cierre` futuro o nulo, no pasado.
2. **Campos mínimos**: se quitan todos los campos salvo los ocho siguientes (no solo los de texto largo).

| Campo | Tipo | Notas |
|---|---|---|
| `expediente` | text | identificador (PK junto a empresa); hace de `id` |
| `organo` | text | |
| `objeto` | text | título largo original |
| `resumen_corto` | text | **título a mostrar en tarjeta/lista** (preferir sobre `objeto` si no está vacío) |
| `importe` | numeric o null | |
| `cierre` | date o null | **fecha límite de la licitación** (no hay `fecha_limite`) |
| `enlace` | text | hace de `url` |
| `decision` | text | `'OK'` \| `'No'` \| `'Pendiente'` (no `'presentar'`) |

Campos que **ya no están** en `omc_hq_v2` (estaban en la primera versión de esta clave): `provincia`, `tipo`,
`procedimiento`, `elegible`, `detectada`, `estado`, `fecha_decision`, `progreso`, además de los de texto
largo (`resumen`, `comentarios`, `motivo_auto`, `solvencia`, `pcap`, `ppt`, `carpeta`, `motivo_texto`,
`progreso_nota`, `decidido_por`, `motivos`, `sincronizado`, `pestana`). Si la UI necesita cualquiera de estos
(para filtrar, para la ficha de detalle, o para el histórico de lo cerrado hace más de 7 días), pedirlos
aparte con `omc_licitaciones_lista(p_token, boolean)` o el hilo de `omc_lic_comentar`/`omc_lic_hilo`; no
están en `omc_hq_v2`.

### `uso`
Solo owner (agente: `{}`). = `omc_hq_uso(p_token)` si la función existe (comprobado con
`exists (select 1 from pg_proc where proname = 'omc_hq_uso')`, no `to_regproc`, porque una sobrecarga futura
haría fallar `to_regproc`). Estructura: ver `omc_hq_uso` en `schema.sql` (mes, mes_anterior, por_agente,
por_sesion, por_agente_modelo, dias, plan, plan_serie).

## Tamaño de la respuesta (medido en producción, empresa `77delta`, owner)

| Momento | Bytes totales |
|---|---|
| Antes de recortar (T16 sin Step 4) | 3 840 539 (~3,84 MB) |
| Tras recortar `licitaciones` (campos), `avances` (3 días) y `contactos` (14 días + pendientes) | 2 404 741 (~2,40 MB) |
| Ajuste por ruling, paso 1: `licitaciones` filtrada por `cierre` nulo o `>= hace 7 días` (1641 → 1603 filas) | 2 373 381 (~2,37 MB) |
| Ajuste por ruling, paso 2: `licitaciones` recortada a 8 campos mínimos | **2 042 555 (~2,04 MB)** |

El paso 1 (filtro por fecha) apenas movió el número: de 1641 a 1603 filas, porque la inmensa mayoría de las
`'Pendiente'` tiene `cierre` futuro o nulo, no pasado (no es un histórico estacional, es pipeline abierto).
El paso 2 (campos mínimos) sí importó: `licitaciones` sola bajó de 1,87 MB a 1,49 MB, ya por debajo de 1,5
MB.

**El total sigue por encima de 1,5 MB (2,04 MB) pese a aplicar los dos pasos del ruling**, porque con
`licitaciones` ya en 1,49 MB el resto de claves no cabe en los ~10 KB que quedarían: `encargos` (352 KB, 258
filas) y `uso` (137 KB) son ahora los siguientes bloques más pesados. Ninguno de los dos estaba dentro del
alcance del ruling (que solo tocaba `licitaciones`), así que no se han recortado; queda anotado aquí para
quien decida si el objetivo de 1,5 MB sigue siendo el límite a perseguir o si 2,04 MB es aceptable para
plan 2.

## RPC de escritura que usará la interfaz (firmas)

Todas `security definer`, primer argumento siempre `p_token text`.

Firmas verificadas literalmente contra `scripts/hq/schema.sql` y `scripts/hq/schema-v2.sql` (no copiadas del
brief, que traía varias equivocadas: sin `p_tipo` en `omc_encargo_avance`, otro orden de argumentos en
`omc_encargo_hecho`/`omc_encargo_estado`, otros nombres de parámetro en `omc_resolver`/`omc_comentar`).

| Función | Firma | Para qué |
|---|---|---|
| `omc_encargo_alta` | `(p_token text, p jsonb)` | crear un encargo (`texto`, `frente`, `responsable`, `prioridad`, `fecha_hito`, `etiquetas`, `enlaces`, `origen`...) |
| `omc_encargo_editar` | `(p_token text, p_id bigint, p jsonb)` | editar campos de un encargo existente |
| `omc_encargo_tomar` | `(p_token text, p_id bigint, p_agente text default null)` | pasar un encargo de `encolado`/`bloqueado_diego` a `en_curso` |
| `omc_encargo_hecho` | `(p_token text, p_id bigint, p_fuente text, p_entregable text default '', p_agente text default null)` | cerrar un encargo como `hecho` (`p_fuente` = `fuente_cierre`, `p_entregable` = `entregable_url`) |
| `omc_encargo_estado` | `(p_token text, p_id bigint, p_estado text, p_agente text default null, p_motivo text default '')` | cambio de estado explícito (ej. `bloqueado_diego`, `descartado` con `p_motivo`) |
| `omc_encargo_avance` | `(p_token text, p_id bigint, p_texto text, p_agente text default null)` | anotar un avance de texto libre (aparece en `avances[]` vía `omc_feed`); no tiene parámetro de tipo, siempre inserta tipo `'avance'` |
| `omc_comentar` | `(p_token text, p_id bigint, p_texto text, p_agente text default null)` | comentario en el hilo de una solicitud |
| `omc_resolver` | `(p_token text, p_id bigint, p_estado text, p_respuesta text default '')` | resolver una solicitud/pendiente |
| `omc_licitacion_decidir` | `(p_token text, p_expediente text, p_decision text, p_motivos jsonb default '[]', p_texto text default '')` | decidir una licitación; `p_decision` en `('OK','No','Pendiente')`, nunca `'presentar'` |
| `omc_sesion_solicitar` | `(p_token text, p_expediente bigint)` | pedir abrir una sesión de agente sobre un expediente |
| `omc_expediente_set` | `(p_token text, p jsonb)` | crear/editar un expediente |
| `omc_kit_set` | `(p_token text, p jsonb)` | crear/editar/retirar una pieza de kit |
| `omc_contacto_alta` | `(p_token text, p jsonb)` | registrar un contacto/envío |
| `omc_contacto_estado` | `(p_token text, p_id bigint, p_estado text, p_ref text default null, p_proximo date default null)` | actualizar estado de un contacto (`p_proximo` = próximo toque) |
| `omc_agente_set` | `(p_token text, p_id text, p_patch jsonb)` | crear/editar un agente |
| `omc_guardar_push` | `(p_token text, p_sub jsonb)` | registrar suscripción push |

## Realtime

**Corrección sobre el brief de la tarea 16**: el brief pedía documentar "el canal realtime `omc:<empresa>`
evento `cambio`", pero ese canal no existe en el esquema: no hay ningún `pg_notify` ni broadcast de Supabase
con ese nombre en `schema.sql` ni `schema-v2.sql`. La tarea 14 (T14, comentario en `schema-v2.sql` ~línea
868) ya dejó anotado que la interfaz v1 se refresca con el realtime de tabla nativo de Supabase
(`postgres_changes`) sobre `omc_solicitudes`/`omc_mensajes`, sin `pg_notify` a mano, y que ninguna RPC de
este fichero lo usa.

Para plan 2, dos caminos, ninguno construido en esta tarea:
1. Igual que v1: suscribirse con `postgres_changes` a las tablas relevantes (`omc_encargos`,
   `omc_encargo_avances`, `omc_solicitudes`, `omc_licitaciones`...) y, al recibir un cambio, volver a pedir
   `omc_hq_v2` para refrescar la vista completa.
2. Si se quiere un canal único `omc:<empresa>` con evento `cambio` como pide el brief, hay que crearlo:
   trigger(s) que hagan `pg_notify` o `realtime.broadcast_changes` en las tablas que cambian, tarea aparte
   no cubierta por T16.

Mientras no exista ninguno de los dos, la única forma fiable de refrescar es re-llamar a `omc_hq_v2` por
polling o tras cada acción de escritura propia.
