# HQ v2 · una sola fuente de la verdad en cascada

Fecha: 16-sep-2026. Autor: Marc-Chief con Diego (chat del 16-sep, 14:00 a 16:30). Estado: borrador para validar por Diego.

## 0. Por qué

Auditoría de la semana 9-16 sep: 274 mensajes de Diego, 14 temas pedidos más de una vez (23 % de los mensajes), 256 encargos en HQ de los que 224 están "fuera de plan" y 115 llevan más de 48 h sin avance. Siete entregables salieron fuera de plantilla. La causa que se repite: cada agente, el chief incluido, arranca de cero porque el estado y las reglas viven en memorias privadas, ficheros sueltos y en la cabeza de Diego, no en un sitio que todos lean y que nadie pueda saltarse.

Palabras de Diego que fijan el objetivo: "una única fuente de la verdad, y que sea HQ"; "todo lo que te pido tiene que caber en una línea estratégica"; "que no se sobreescriban ni se arreglen las cosas, que lo nuevo se construya sobre la base"; "la próxima semana hacemos un checkpoint".

## 1. Principios (no negociables)

1. **HQ es la fuente de la verdad del estado.** Plan, bloques, frentes, encargos, contactos, licitaciones, clientes, decisiones, equipo y kit viven en la base de datos de HQ. Lo que no está en HQ no existe para los agentes.
2. **Drive es la fuente de la verdad del contenido.** Documentos, plantillas, memorias oficiales, actas y fichas de cliente viven en Google Drive con la estructura de carpetas actual. HQ guarda el enlace y marca la versión vigente. Nadie crea un documento si HQ ya apunta a uno.
3. **Todo lo demás es salida y se regenera.** Informe de las 07:00, docs de empresa, dossiers, memoria de cada agente, Engram. Si una salida contradice HQ, gana HQ. La memoria personal de un agente es caché: lo que afecte a más de uno va al kit del frente.
4. **Nada fuera del plan.** Todo encargo nace con bloque y frente. Si una petición no cabe, se crea un frente nuevo con Diego o se descarta con motivo. La base de datos lo impone, no la buena voluntad.
5. **Puertas duras, no recordatorios.** Cerrar un encargo exige citar la fuente canónica usada. Enviar a un tercero exige una fila de contacto. Adjuntar un .html o .md a un cliente se rechaza. Lo que no pasa la puerta no sale.
6. **Entrada única por el chief.** Diego pide, prioriza y decide con el chief. Trabaja directo con un responsable solo por expediente concreto, y esa sesión termina con avance escrito en la tarjeta. El chief se entera por HQ, no por el chat.
7. **Lo nuevo se construye sobre la base.** Toda mejora de HQ es migración + CLI + interfaz en este repo, con especificación previa en `docs/superpowers/specs/`. Ningún script paralelo, ningún fichero de estado fuera de la base.

## 2. La cascada

```
Objetivo (horizonte)  →  Bloque estratégico  →  Frente (meta, KPI, hitos, kit)  →  Encargo (tarjeta Kanban)  →  Avances, contactos, documentos
```

### 2.1 Objetivos

| Horizonte | Objetivo | Medida |
|---|---|---|
| 2026 | 300.000 EUR contratados a 31-dic-2026 | suma de ingresos en estado contratado o superior + licitaciones adjudicadas |
| 2027 | 3.000.000 EUR contratados, con licitaciones europeas | igual, más TED |

KPI semanal que manda en 2026: **euros presentados** (a un 20 % de éxito, 300k exigen presentar 1,3 M en 15 semanas, unos 90k por semana). HQ enseña el hueco cada semana.

### 2.2 Bloques y frentes (borrador para que Diego lo corrija)

Las 8 líneas actuales del plan se conservan como frentes dentro de su bloque (entre corchetes, el número de línea actual). Meta en euros solo donde hay ingreso directo.

**A · Licitaciones públicas** (meta 2026: 150.000 contratado; director: Biel; ejecutan Guillem, Ariadna, Joana, Quim, Ona)
- A1 Detección y fuentes: PLACSP, 17 CCAA, menores, calendario de fuentes. Encargos #245, #209, #14.
- A2 Cribado y elegibilidad: motor, art. 76 (medios personales), ROLECE/RELI vigentes, checklist #108. Encargo #247, backlog 26.
- A3 Ofertas en curso [2, 8]: funnel por decidir → aprobada → en preparación → presentada → adjudicada / perdida / desierta. Encargos #258, #216, #217; backlog 27, 34-37.
- A4 Solvencia técnica, colaboradores y UTE: base de colaboradores (#257), acuerdos UTE al 5-7 %, doc 47 y 52.
- A5 Licitaciones europeas 2027: TED, consorcios, requisitos. Nace vacío con el objetivo 2027.

**B · Subvenciones y ayudas** (director: Helena)
- B1 ACCIÓ Exploració Tecnològica 2026 [1]: 75.000; plazo 21-sep; memorias con la plantilla oficial de ACCIÓ, nunca inventadas.
- B2 Cupons IA d'ACCIÓ: acreditación, 5 concedidos (40.000), funnel por cliente concedido → kickoff → diagnosis → memoria → facturado → cobrado; actas con la plantilla Google Doc de 77 Delta.
- B3 Subvenciones estatales y europeas: encargo #249 (absorbe #231).
- B4 FUNDAE y formación bonificada [4]: 30.000; solo áreas con formador acreditable.

**C · Comercial directo** (meta 2026: 60.000; director: Biel; ejecutan Aina, Ona, Marina, Nil)
- C1 Ayuntamientos catalanes de más de 15.000 habitantes: campaña #4 (absorbe #27).
- C2 Contratos menores [3]: 40.000; 17 organismos.
- C3 Consultoría y clientes actuales: Peninsula 5.000 al mes, propuestas desde Atlas.
- C4 Ciberseguridad donde no va nadie [7].
- C5 Prospección y seguimiento: registro de todos los toques salientes (correo, LinkedIn, formulario), máximo dos toques, segundo toque obligatorio.

**D · Producto** (director: Ariadna como PO de Licita; Marina en Regulia)
- D1 Licita como producto [5]: 9.000; demo, dos precios.
- D2 Regulia, módulo ENS y Stripe.
- D3 Otros SaaS: solo enlace al repo, no se gestionan desde HQ.

**E · Empresa y capacidades** (director: Jordi-COO)
- E1 Habilitaciones y certificaciones: ROLECE, RELI, FUNDAE, epígrafes IAE de telecomunicaciones (encargo nuevo hoy), ENS, ISO 27001 e ISO 42001, certificaciones personales de Diego, colaboradores con título. Cada una con fecha objetivo y con los tipos de licitación que desbloquea.
- E2 Solvencia económica y finanzas [6]: NGA 200.000, capitalización antes del 31-dic, cobros, libro de ingresos (Teresa).
- E3 Equipo de agentes y cuentas: organigrama, onboarding, modelos, consumo por cuenta.
- E4 HQ y fuente de la verdad: este rediseño, kit de cada frente, plantillas, docs de empresa (Nuria verifica, chief construye).
- E5 Marca, web y comunicación 77 Delta.

### 2.3 Encargo (tarjeta)

Campos: título (verbo primero), interpretación del chief, bloque y frente (obligatorios), etiquetas, departamento, responsable (agente existente, validado), prioridad, estado Kanban, hito y fecha, hilo de avances (append-only, con autor), enlaces (Drive, expediente, tarjeta HQ), contactos ligados, fuente citada al cerrar, origen (mensaje de Diego con fecha, tarjeta, agente), creado por.

Estados Kanban y correspondencia con los actuales:

| Kanban | Estado actual | Significado |
|---|---|---|
| Backlog | encolado sin hito | aceptado, sin fecha |
| Por hacer | encolado con hito | tiene fecha y responsable |
| En curso | en_curso | con al menos un avance; sin avance en 48 h pasa a rojo |
| Bloqueado | bloqueado_diego, espera | dice qué espera y de quién |
| Hecho | hecho | con fuente citada y, si aplica, enlace al entregable |
| Descartado | descartado | con motivo; se archiva, no se ve en el tablero |

Diego edita cualquier tarjeta desde la web (título, prioridad, etiquetas, hito, comentario). Su comentario llega al responsable en su ventana y al chief en el feed; la respuesta vuelve a la tarjeta.

### 2.4 Kit del frente

Cada frente tiene una lista de fuentes canónicas, cada una con tipo, nombre, enlace, versión vigente y fecha:
- **plantilla**: Google Doc plantilla 77 Delta, plantilla de acta, firma de correo, guía de tono.
- **oficial**: memoria oficial de ACCIÓ, pliego tipo, bases de la convocatoria.
- **procedimiento**: checklist #108 de licitaciones, calendario de fuentes, runbook de Sobre Digital.
- **regla**: las reglas duras que aplican (catalán a entidades catalanas, decisión 80 y 81, ningún .html a cliente).

El encargo hereda el kit de su frente. Al tomar un encargo la CLI lo imprime con los últimos avances y los contactos ligados. Al cerrarlo, la fuente citada tiene que ser una entrada del kit o un documento de Drive; si no, la CLI se niega.

Primer inventario del kit: lo hace el chief el 17-sep desde las memorias privadas actuales (plantillas 77 Delta, docs siempre en Drive, tono de Diego, reglas 36-40, decisiones 79-81) y de `docs/empresa/`. A partir de entonces las memorias privadas dejan de ser fuente.

### 2.5 Contactos

Una fila por toque saliente: persona, empresa, canal (correo, LinkedIn, formulario, teléfono), motivo, frente, encargo, agente, fecha, número de toque, estado (enviado, respondido, reunión, cerrado, sin respuesta), próximo toque con fecha, referencia de la respuesta entrante. El candado de envío no dispara sin fila. hq-correo casa la respuesta entrante con la fila y actualiza el estado. Los 80 envíos del JSON local desde el 10-sep se migran como semilla.

### 2.6 Licitaciones y clientes (funnels)

Licitación: ficha rica con estados completos hasta el desenlace (adjudicada, perdida, desierta, retirada), órgano, importe, cierre, veredicto, solvencia, medios del art. 76, enlaces (anuncio, pliegos, carpeta de Drive, expediente), etiquetas de tipo de proyecto, próximo hito y responsable. Cuelga del frente A3. Cubre el backlog 27, 28, 29, 34, 35, 36, 37.

Cliente y cupón: ficha con estado del funnel B2, carpeta de Drive, actas, próximo hito, importe, estado de ingreso. Cuelga del frente B2. Cubre el backlog 30. Fase 2.

### 2.7 Equipo

Ficha por agente: nombre, rol, bloque y frentes que sirve, jefe, modelo, cuenta, avatar (estilo icono, no logo), contrato, kit que lee, encargos abiertos, coste del mes, latido, enlace a su sesión. Onboarding por comando: `hq agente alta` crea ficha, avatar, ventana, reglas y sitio en el organigrama; ningún agente existe sin ficha. Los avatares con logo se regeneran.

### 2.8 Expedientes y sesiones de trabajo (Diego, 16-sep 15:10)

Hay trabajo que no cabe en tarjetas autónomas: avanzar Regulia, cerrar los entregables de un cliente de cupones, redactar una memoria de ACCIÓ. Eso se hace chateando con el responsable, y la solución es que el contexto venga de HQ, no de la memoria del chat.

**Expediente**: objeto de HQ que agrupa todo lo de un cliente, producto o convocatoria. Campos: tipo (cliente, producto, convocatoria, licitación), nombre, frente, responsable, ficha en Drive (enlace; para cupones, la ficha del Cupó IA que ya existe), carpeta de Drive, estado del funnel, entregables pendientes (lista con fecha), encargos ligados, contactos ligados, decisiones, último resumen de estado (escrito por el agente al cerrar la sesión) y fecha.

**Sesión de trabajo**: desde la ficha del expediente en la web, el botón "Trabajar en esto" envía al responsable `hq sesion abrir --expediente <id>`; el agente carga ficha, entregables, encargos, avances, contactos y kit del frente, escribe "al día con <expediente>: N entregables pendientes" y Diego abre su chat (enlace de la sesión desde la ficha del agente). Cambiar de expediente es `hq sesion abrir` con otro id en la misma ventana.

**Cierre obligatorio**: `hq sesion cerrar` exige avance en cada encargo tocado, alta de los encargos nuevos con su frente, actualización del resumen de estado y de los entregables del expediente; si la sesión anterior no se cerró, la nueva no abre. El chief se entera por el feed. Responsables iniciales: Martí en cupones y clientes, Marina en Regulia, Helena en ACCIÓ, Guillem en licitaciones.

Tabla nueva `omc_expedientes` y `omc_sesiones` (expediente, agente, abierta, cerrada, resumen). Vista web: Expedientes (fase 1 para clientes de cupones y ACCIÓ, porque hay entregables esta semana; producto en fase 2).

## 3. Datos (migración sobre el esquema actual, sin romper lo que funciona)

- `omc_plan_objetivo`: añadir `horizonte` (2026, 2027) y dos filas.
- Nueva `omc_plan_bloques`: id, letra, nombre, meta_eur, director, orden, activo.
- `omc_plan_lineas` pasa a ser el frente: añadir `bloque_id` (obligatorio), `etiquetas`, `orden`. Se conservan los 8 ids actuales.
- `omc_encargos`: `linea_id` obligatorio (constraint tras migrar los 224 huérfanos), `etiquetas text[]`, `enlaces jsonb`, `fuente_cierre`, `orden_kanban`; `agente` validado contra `omc_agentes` (backlog 17 y 21).
- Nueva `omc_encargo_avances`: append-only, id, encargo_id, autor, texto, fecha, tipo (avance, comentario_diego, estado). `ultimo_avance` se mantiene como cache.
- Nueva `omc_kit`: id, linea_id, tipo, nombre, url, version, vigente, actualizado_por, fecha.
- Nueva `omc_contactos`: campos del punto 2.5.
- `omc_licitaciones`: estados tras Presentada, `medios_art76`, `etiquetas`, `proximo_hito`, `responsable`.
- `omc_agentes`: `frentes text[]`, `cuenta`, `avatar_url`, `sesion_url`.
- Nuevas `omc_expedientes` y `omc_sesiones` (punto 2.8); `omc_encargos.expediente_id` y `omc_contactos.expediente_id` opcionales.
- Funciones RPC nuevas o cambiadas: `omc_encargo_alta` rechaza sin línea; `omc_encargo_hecho` exige fuente; `omc_contacto_alta`; `omc_encargo_tomar` devuelve kit + avances + contactos; `omc_feed` (novedades desde una fecha, para el chief).

Migración de los 224 encargos sin línea: el chief los asigna a frente con un script asistido el 17-sep (lote por palabras clave y responsable, revisión manual de los dudosos, descarte con motivo de los muertos). Objetivo: 0 fuera de plan el 18-sep.

## 4. CLI (`hq.py`)

Nuevos o cambiados: `encargo alta --frente` (obligatorio), `encargo tomar <id>`, `encargo hecho <id> --fuente <url> [--entregable <url>]`, `contacto alta|estado|lista`, `kit lista <frente>|alta|vigente`, `bloques`, `frentes`, `feed --desde`, `agente alta` (onboarding), `expediente alta|ficha|lista`, `sesion abrir --expediente <id>` y `sesion cerrar`. `enviar-con-lock.sh` exige `--contacto <id>` y rechaza adjuntos .html y .md salvo destinatario órgano de contratación. El latido de arranque inyecta a cada agente sus encargos abiertos con kit y próximos hitos.

Lo que hoy hace el chief a mano y pasa a script: `hq-parados` (07:00 y 15:00: reclamo a 48 h, escalado a 72 h), informe de las 07:00 generado desde HQ (primero lo pedido por Diego esta semana con estado, luego lo que depende de él con hora, la actividad al final), casado de respuestas entrantes con contactos.

## 5. Interfaz v2

De cero, sobre la misma base, en `public/hq/` como módulos ES separados por vista (sin build, tokens de `brand/tokens.css`, móvil primero, la v1 queda en `public/hq/v1/` hasta el 30-sep). Vistas:

1. **Inicio**: objetivo 2026 y 2027 con el hueco, bloques con euros y porcentaje, alertas (hitos caducados, encargos rojos, decisiones que esperan a Diego).
2. **Plan**: cascada desplegable objetivo → bloque → frente → encargos, con KPI y kit por frente.
3. **Tablero**: Kanban filtrable por bloque, frente, departamento, agente y etiqueta; tarjetas editables por Diego; hilo por tarjeta.
4. **Licitaciones**: funnel con fichas ricas y decisión desde la ficha.
5. **Contactos**: por frente, "12 contactados, 3 respondieron, 1 reunión", próximos toques.
6. **Decisiones**: la bandeja actual (aprobar, rechazar, dudas), ordenada por vencimiento.
7. **Equipo**: fichas, organigrama, onboarding, consumo por cuenta.
8. **Expedientes**: clientes de cupones y ACCIÓ en fase 1 (ficha, entregables, botón "Trabajar en esto"); productos y consultoría en fase 2.
9. Botón "Hablar con el chief": abre la sesión activa; el chief actualiza el enlace al cambiar de cuenta. El chat embebido no entra en la v1 (Diego, 16-sep).

**Cambio de cuenta Max (diego@ ↔ team@) sin rotura, requisito de la v1:** todo el estado vive en HQ, nunca en la sesión; los hooks, la configuración de `hq.env` y las reglas son idénticos en los dos `CLAUDE_CONFIG_DIR`; `chief-cuenta.sh` actualiza en HQ el enlace de la sesión activa y deja un avance en el encargo abierto antes de cambiar; al arrancar en la otra cuenta el latido carga los encargos abiertos con kit. Criterio del checkpoint: un cambio de cuenta en mitad de un encargo no pierde ni una tarjeta ni un avance.

Producto: la base ya es multiempresa (`omc_empresas`, `omc_tokens`); la interfaz lee bloques y frentes de la base, sin nada de 77 Delta en el código salvo el tema visual.

## 6. Comunicación

- Diego ↔ chief: chat, entrada única. Toda petición se convierte en tarjeta el mismo día, con "Diego dd-mm hh:mm" como origen; si Diego repite algo, se contesta con el número y el estado, nunca se abre otra.
- Diego ↔ agente: comentario en la tarjeta (llega a su ventana) o sesión directa por expediente que termina con avance en la tarjeta.
- Chief ↔ agentes: encargos y feed de HQ; tmux-decir solo para urgencias.
- Agentes entre sí: tarjeta o hilo; nada por chat que no quede en HQ.

## 7. Fases y checkpoint

- **Miércoles 17 a martes 22 sep**: migración de datos, RPC y CLI con puertas, kit inventariado, 224 encargos asignados, contactos sembrados, hq-parados en cron, interfaz v2 con Inicio, Plan, Tablero, Decisiones y Equipo; prueba de extremo a extremo con una petición simulada el sábado 19.
- **Miércoles 23 sep, checkpoint con Diego.** Criterios: 0 encargos fuera de plan; 100 % de las peticiones de Diego de la semana con tarjeta el mismo día; 0 entregables fuera de plantilla; 0 envíos sin fila de contacto; 0 "hecho" sin fuente; menos de 20 encargos en rojo; informe de las 07:00 generado desde HQ desde el lunes 21.
- **24 a 30 sep**: Licitaciones y Contactos en la interfaz, Clientes y cupones, onboarding de agentes, avatares regenerados.
- **Después**: chat embebido con el Agent SDK (medir coste, pasa a API), interfaz enseñable a terceros.

## 8. Quién

Construye el chief (Fable) con subagentes para lo mecánico; Nuria (po-hq) verifica cada criterio de aceptación y mantiene el backlog dentro del frente E4; Pol despliega base y RPC. Los 37 puntos del backlog de Nuria se reetiquetan a su frente y los que este diseño cubre se cierran citándolo.

## 9. Fuera de alcance

Regularización fiscal y asuntos privados de Diego (no entran en HQ). Otros SaaS. Rehacer el motor de licitaciones. Cambiar de proveedor de base de datos.
