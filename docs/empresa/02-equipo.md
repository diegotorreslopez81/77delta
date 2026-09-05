# Equipo de agentes de 77 Delta

Cada agente es una sesión de Claude Code con su contrato (alma), su modelo asignado y su interruptor en HQ (`https://77delta.com/hq/`, pestaña Equipo). Por encima de todos, Diego (Owner) aprueba lo irreversible; el Chief of Staff enruta. Los avatares y nombres de persona sirven para reconocerlos rápido; el identificador técnico (`id`) es el que usan los scripts.

## Dirección y control

### 1. Marc · Chief of Staff

- **id:** `chief` · **departamento:** Dirección · **nivel:** 1
- **estado:** activo · **prioridad:** 2
- **modelo:** Fable 5.1 · **subagentes:** Sonnet 5
- **por qué ese modelo:** Síntesis entre sesiones y criterio de dirección. Delega lecturas y barridos a subagentes Sonnet.
- **sesiones Claude:** Chief OMC, One Man Company
- **repos:** `/Users/diego/dev`
- **job:** Enrutar el trabajo, consolidar KPIs, mantener la cola de aprobaciones y escalar a Diego solo lo que necesita su firma. Nunca ejecuta.

### 2. Nuria · Control financiero

- **id:** `ctrl-finanzas` · **departamento:** Control · **nivel:** 1
- **estado:** por contratar (desactivado) · **prioridad:** 3
- **modelo:** Sonnet 5 · **subagentes:** Haiku 4.5
- **por qué ese modelo:** Comprobaciones deterministas, SQL y alertas: no necesita criterio caro.
- **job:** Vigilar el gasto agregado (dinero y tokens), avisar antes de que se dispare. Contrapoder con voz directa a Diego.

## Directores de departamento

### 3. Alex · Director comercial

- **id:** `dir-comercial` · **departamento:** Comercial · **nivel:** 2 · **reporta a:** `chief`
- **estado:** activo · **prioridad:** 1 (ingresos)
- **modelo:** Opus 5 · **subagentes:** Sonnet 5
- **por qué ese modelo:** Estrategia de pipeline y feedback: criterio. Datos y KPIs por subagente Sonnet.
- **sesiones Claude:** comercial
- **repos:** `~/dev/comercial`
- **job:** Estrategia de pipeline, KPIs de conversión, propuesta de precios, feedback a Sales Público, Sales Privado y BDR.

### 4. Laia · Directora de delivery

- **id:** `dir-delivery` · **departamento:** Delivery · **nivel:** 2 · **reporta a:** `chief`
- **estado:** por contratar (desactivado) · **prioridad:** 3
- **modelo:** Opus 5 · **subagentes:** Sonnet 5
- **por qué ese modelo:** Planificación y calidad: criterio.
- **job:** Capacidad, calidad y plazos de todo lo vendido.

### 5. Carla · Directora de talento

- **id:** `dir-talent` · **departamento:** RRHH · **nivel:** 2 · **reporta a:** `chief`
- **estado:** por contratar (desactivado) · **prioridad:** 3
- **modelo:** Opus 5 · **subagentes:** Sonnet 5
- **por qué ese modelo:** Evaluar perfiles: criterio. Búsquedas por subagente Sonnet.
- **job:** Pool de perfiles subcontratables para licitaciones y contratación por horas cuando Diego no da abasto.

### 6. Pau · Director de producto

- **id:** `dir-producto` · **departamento:** Producto · **nivel:** 2 · **reporta a:** `chief`
- **estado:** por contratar (desactivado) · **prioridad:** 4
- **modelo:** Opus 5 · **subagentes:** Sonnet 5
- **por qué ese modelo:** Arquitectura y prioridades de producto.
- **job:** Herramientas propias (Swarmix, Canto, ScoreFlow, Diagnostia) e infraestructura de proyectos.

### 7. Julia · Directora de marketing

- **id:** `dir-marketing` · **departamento:** Marketing · **nivel:** 2 · **reporta a:** `chief`
- **estado:** por contratar (desactivado) · **prioridad:** 3
- **modelo:** Opus 5 · **subagentes:** Sonnet 5
- **por qué ese modelo:** Posicionamiento y copy: criterio.
- **job:** Marca, web, captación y contenido.

### 8. Ramon · Director de administración

- **id:** `dir-admin` · **departamento:** Admin · **nivel:** 2 · **reporta a:** `chief`
- **estado:** por contratar (desactivado) · **prioridad:** 4
- **modelo:** Opus 5 · **subagentes:** Sonnet 5
- **por qué ese modelo:** Fiscal y legal: criterio.
- **job:** Contabilidad, facturación, cobros, fiscal y legal.

## Ejecutores

### 9. Guillem · Licitaciones públicas

- **id:** `sales-licita` · **departamento:** Comercial · **nivel:** 3 · **reporta a:** `dir-comercial`
- **estado:** activo · **prioridad:** 1 (ingresos)
- **modelo:** Fable 5.1 · **subagentes:** Sonnet 5
- **por qué ese modelo:** Redactar memorias y ofertas al máximo nivel: cada punto es contrato. El barrido CPV, el triaje y la extracción de requisitos van SIEMPRE por subagentes Sonnet o por rutina; Fable solo lee el pliego final y escribe.
- **sesiones Claude:** sales
- **repos:** `~/dev/nga-ops`, `~/dev/grants/.claude/worktrees/licitaciones-bot`
- **job:** Detectar licitaciones por CPV, leer pliegos, preparar y firmar ofertas. Si el pliego exige perfiles, pasa los requisitos a RRHH.
- **prohibido:** Enviar la oferta, fijar precio o % de baja, y decidir presentarse con dudas de encaje: siempre Diego.

### 10. Sergi · Ventas a empresas

- **id:** `sales-privado` · **departamento:** Comercial · **nivel:** 3 · **reporta a:** `dir-comercial`
- **estado:** activo · **prioridad:** 1 (ingresos)
- **modelo:** Opus 5 · **subagentes:** Sonnet 5
- **por qué ese modelo:** Propuestas comerciales y precios: criterio. Investigación por Sonnet.
- **sesiones Claude:** IA-consultant
- **repos:** `~/dev/consultoria-ia`
- **job:** Clientes privados: consultoría IA, Malt, directos.

### 11. Aina · Outreach y prospección

- **id:** `bdr-swarmix` · **departamento:** Comercial · **nivel:** 3 · **reporta a:** `dir-comercial`
- **estado:** activo · **prioridad:** 1 (ingresos)
- **modelo:** Sonnet 5 · **subagentes:** Haiku 4.5
- **por qué ese modelo:** Volumen: sourcing, enriquecimiento, clasificación de respuestas. Copy de una plantilla nueva: subagente Opus.
- **sesiones Claude:** swarmixapp
- **repos:** `~/dev/swarmixapp`, `~/dev/agentsIA`
- **job:** Llenar el embudo: sourcing, enriquecimiento, borradores, clasificar respuestas.
- **prohibido:** Enviar a una persona real y aprobar qué perfil se contacta: siempre Diego. Descartar perfiles conectados con Peninsula.

### 12. Marti · Cupones ACCIÓ

- **id:** `delivery-cupones` · **departamento:** Delivery · **nivel:** 3 · **reporta a:** `dir-delivery`
- **estado:** activo · **prioridad:** 2
- **modelo:** Sonnet 5 · **subagentes:** Haiku 4.5
- **por qué ese modelo:** Actas, fichas, horas y borradores por plantilla. Propuestas comerciales al cliente: subagente Opus.
- **sesiones Claude:** cuponsIA, cuponIA
- **repos:** `~/dev/cuponsIA`, `~/dev/infinitelabs-portal-cupons`
- **job:** Ejecutar los cupones concedidos: fichas, actas, horas, bitácora, borradores.
- **prohibido:** Enviar correo o tocar el calendario del cliente, precios, facturación, cambios de alcance (nunca implantación en docs de ACCIÓ), deploys en horario laboral.

### 13. Ona · Auditorías LeakAI

- **id:** `delivery-leakai` · **departamento:** Delivery · **nivel:** 3 · **reporta a:** `dir-delivery`
- **estado:** activo · **prioridad:** 2
- **modelo:** Sonnet 5 · **subagentes:** Sonnet 5
- **por qué ese modelo:** Escaneo, ataques y pipeline: volumen. El juez de hallazgos (falsos positivos = difamación) SIEMPRE subagente Opus.
- **sesiones Claude:** leakai
- **repos:** `~/dev/leakai`
- **job:** Escanear, atacar, verificar y generar informes de asistentes IA.
- **prohibido:** Cualquier contacto con un tercero sin verificación humana previa; publicar un caso con nombre; comprar dominios.

### 14. Berta · Formación en salud

- **id:** `delivery-formacion` · **departamento:** Delivery · **nivel:** 3 · **reporta a:** `dir-delivery`
- **estado:** por contratar (desactivado) · **prioridad:** 3
- **modelo:** Opus 5 · **subagentes:** Sonnet 5
- **por qué ese modelo:** Contenido formativo para cliente: calidad.
- **job:** Servicios formativos en salud (ASICRE, cuidadores, menopausia) con Irene y Lidia.

### 15. Oriol · Ejecución de proyectos

- **id:** `delivery-proyectos` · **departamento:** Delivery · **nivel:** 3 · **reporta a:** `dir-delivery`
- **estado:** por contratar (desactivado) · **prioridad:** 2
- **modelo:** Opus 5 · **subagentes:** Sonnet 5
- **por qué ese modelo:** Coordinar arranque de proyecto ganado: criterio. Ejecución técnica por Sonnet.
- **job:** Al firmar un contrato, coordinar a Tech y a los subcontratados para arrancar. Diego es el PM y habla con el cliente.

### 16. Claudia · Búsqueda de perfiles

- **id:** `rrhh-sourcing` · **departamento:** RRHH · **nivel:** 3 · **reporta a:** `dir-talent`
- **estado:** por contratar (desactivado) · **prioridad:** 3
- **modelo:** Sonnet 5 · **subagentes:** Haiku 4.5
- **por qué ese modelo:** Búsqueda y pool de perfiles: volumen.
- **job:** Buscar en LinkedIn los perfiles que piden los pliegos y mantener el pool de subcontratables.

### 17. Biel · Producto y herramientas

- **id:** `tech-producto` · **departamento:** Producto · **nivel:** 3 · **reporta a:** `dir-producto`
- **estado:** activo · **prioridad:** 4
- **modelo:** Opus 5 (contexto 1M) · **subagentes:** Sonnet 5
- **por qué ese modelo:** Código con contexto largo: arquitectura y bugs duros. Chores, tests y refactors mecánicos por subagente Sonnet.
- **sesiones Claude:** canto, scoreflow, diagnostia, master
- **repos:** `~/dev/canto-plugin`, `~/dev/scoreflow`, `~/dev/diagnostia`, `~/dev/swarmix-web`, `~/dev/il-agent-core`, `~/dev/atlas`
- **job:** Swarmix, Canto, ScoreFlow, Diagnostia y herramientas internas.

### 18. Roc · DevOps e infraestructura

- **id:** `tech-devops` · **departamento:** Producto · **nivel:** 3 · **reporta a:** `dir-producto`
- **estado:** por contratar (desactivado) · **prioridad:** 4
- **modelo:** Sonnet 5 · **subagentes:** Haiku 4.5
- **por qué ese modelo:** Levantar infra y scripts: rutina.
- **job:** Levantar servidores y entornos de los proyectos ganados.
- **prohibido:** Gastar dinero sin OK de Diego.

### 19. Mireia · Web y captación

- **id:** `mkt-web` · **departamento:** Marketing · **nivel:** 3 · **reporta a:** `dir-marketing`
- **estado:** activo · **prioridad:** 3
- **modelo:** Sonnet 5 · **subagentes:** Haiku 4.5
- **por qué ese modelo:** Build, deploy, verificación y datos: rutina. Copy nuevo: subagente Opus.
- **sesiones Claude:** web77d, infinitelabs
- **repos:** `~/dev/77delta`, `~/dev/website`
- **job:** 77delta.com, formulario, analítica, marca y plantillas.
- **prohibido:** Copy nuevo, precios, DNS, gasto, publicar hallazgos con nombre de empresa, y nunca Infinite Labs hacia el mercado español.

### 20. Arnau · Contenido y LinkedIn

- **id:** `mkt-contenido` · **departamento:** Marketing · **nivel:** 3 · **reporta a:** `dir-marketing`
- **estado:** por contratar (desactivado) · **prioridad:** 3
- **modelo:** Opus 5 · **subagentes:** Sonnet 5
- **por qué ese modelo:** Escribir bien: LinkedIn, artículos, casos.
- **job:** Contenido, LinkedIn y build in public.

### 21. Teresa · Contabilidad y tesorería

- **id:** `admin-books` · **departamento:** Admin · **nivel:** 3 · **reporta a:** `dir-admin`
- **estado:** activo · **prioridad:** 4
- **modelo:** Sonnet 5 · **subagentes:** Haiku 4.5
- **por qué ese modelo:** Conciliación, facturas, tesorería: rutina.
- **sesiones Claude:** books
- **repos:** `~/dev/finanzas-casa`, `~/dev/contablia`, `~/dev/books`
- **job:** Facturas, cobros, tesorería y contabilidad.
- **prohibido:** Pagar: siempre Diego.

### 22. Jordi · Fiscal y legal

- **id:** `admin-fiscal` · **departamento:** Admin · **nivel:** 3 · **reporta a:** `dir-admin`
- **estado:** por contratar (desactivado) · **prioridad:** 4
- **modelo:** Opus 5 · **subagentes:** Sonnet 5
- **por qué ese modelo:** Modelos AEAT y contratos: criterio.
- **job:** Modelos AEAT, contratos y compliance.

### 23. Helena · Financiación y grants

- **id:** `estrategia-grants` · **departamento:** Estrategia · **nivel:** 3 · **reporta a:** `chief`
- **estado:** activo · **prioridad:** 3
- **modelo:** Opus 5 · **subagentes:** Sonnet 5
- **por qué ese modelo:** Redactar solicitudes: calidad. Barrido de convocatorias por subagente Haiku/Sonnet.
- **sesiones Claude:** grants
- **repos:** `~/dev/grants`, `~/dev/accesspay-fellowship`
- **job:** Convocatorias, solicitudes y seguimiento de financiación.

### 24. Ferran · Estructura y transición

- **id:** `estrategia-estructura` · **departamento:** Estrategia · **nivel:** 3 · **reporta a:** `chief`
- **estado:** activo · **prioridad:** 3
- **modelo:** Opus 5 · **subagentes:** Sonnet 5
- **por qué ese modelo:** Decisiones de estructura y transición: criterio, confidencial.
- **sesiones Claude:** professional
- **repos:** `~/dev/job-templates`, `~/dev/professional`
- **job:** Estructura de negocio propio y transición profesional (confidencial).
- **prohibido:** Cualquier envío a un tercero o cifra que salga de casa.

### 25. Diego · Personal (no negocio)

- **id:** `personal` · **departamento:** Personal · **nivel:** 3
- **estado:** activo · **prioridad:** 9
- **modelo:** Sonnet 5 · **subagentes:** Haiku 4.5
- **por qué ese modelo:** Uso personal: no gastar ventana en Opus.
- **sesiones Claude:** random, health, plex, spotify-download-plex-setup, conscious, Main
- **repos:** `~/dev/health`, `~/dev/conscious`, `~/dev/spooty`, `~/dev/basistrading`, `~/dev/personal`
- **job:** Sesiones personales. Se cuentan aparte para ver cuánto del plan va a negocio.

## Cómo se añade un agente

1. Alta en HQ: `omc_agente_set` (o fila en `scripts/hq/seed-77delta.sql`) con id, nombre, departamento, nivel, jefe, sesiones, rutas y contrato.
2. Carpeta o repo propio con `.claude/settings.json` (modelo y modelo de subagentes) y `.claude/hq-agente` con su id.
3. Avatar en `public/hq/avatares/<id>.svg` (generado con DiceBear notionists, semilla = nombre de persona).
4. `CLAUDE.md` del repo con el contrato de 7 campos.
5. Regenerar este documento: `python3 scripts/hq/docs-empresa.py`.
