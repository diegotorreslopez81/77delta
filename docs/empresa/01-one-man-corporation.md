# One Man Corporation · Manual operativo de 77 Delta

> Visión, organigrama y contratos de la empresa de agentes de Diego.
> Fuente de verdad. Cualquier sesión Claude bajo `~/dev/` la lee antes de actuar en nombre de un puesto.
> Creado 2026-09-05. Owner: Diego Torres (Next Gen Academy SL · 77 Delta).

---

## 0. La visión: One Man Corporation (OMC)

Una empresa completa operada por una sola persona, donde cada "empleado" es un agente IA con su propio rol, responsabilidades y límites. Diego no ejecuta: **decide**. Los agentes hacen todo el trabajo reversible de forma autónoma y solo suben a Diego lo que necesita su firma (dinero, contacto con terceros, estrategia).

Dos usos del mismo método:
1. **Para Diego** (esta empresa, 77 Delta).
2. **Como producto** que se vende a clientes: a cada cliente se le monta su propia célula de agentes ("tu departamento AI"). Corpora.cat (Irene) es la primera célula replicada y el caso de éxito de venta.

**Nombre del concepto:** One Man Corporation. Nombre comercial del servicio: pendiente de decidir (candidatos: "One Man Corp", "Departamento AI", "OMC"). Naming es filtro duro de Diego (dominio + trademark).

---

## 1. La regla que ordena todo: la línea de reversibilidad

Validada por las 6 sesiones de negocio por separado, todas convergieron sola cada una a lo mismo:

- **Reversible y no sale de la máquina** -> lo hace el agente solo, sin pedir permiso.
- **Irreversible, toca a un tercero, o gasta dinero** -> lo aprueba Diego.

Ningún agente cruza esa línea sin OK. Nunca.

---

## 2. Los 4 niveles de mando

```
NIVEL 0 · DIEGO (Owner / CEO)
   decide, no ejecuta · vive en la cola de aprobaciones · recibe notificaciones

NIVEL 1 · CHIEF OF STAFF (agente coordinador)
   enruta trabajo · consolida KPIs · mantiene la cola de aprobaciones · escala a Diego · NO ejecuta

NIVEL 1·STAFF · CONTROL FINANCIERO / GUARDRAILS (agente de control)
   contrapoder transversal · vigila gasto agregado · alerta antes de que se dispare · reporta directo a Diego

NIVEL 2 · DIRECTORES DE DEPARTAMENTO (agentes-jefe)
   estrategia · KPIs · buscan oportunidades · dan feedback a sus ejecutores

NIVEL 3 · EJECUTORES (agentes-currito)
   trabajo reversible del día a día
```

---

## 3. Organigrama y plantilla actual

| Departamento | Dirección (N2) | Puesto ejecutor (N3) | Sesión | Estado |
|---|---|---|---|---|
| **Comercial** | Dir. Comercial | Sales Público (licitaciones) | `sales` | activo |
| | | Sales Privado (consultoría IA, Malt, directos) | — | crear |
| | | BDR / Outreach (genera leads) | `swarmixapp` | activo |
| **Delivery** | Dir. Delivery | Cupones ACCIÓ | `cuponsIA` | activo |
| | | Formación salud (ASICRE) | — | crear |
| | | LeakAI | `leakai` | activo |
| | | Ejecución de proyecto ganado (PM + devs) | — | crear |
| **RRHH / Talent** | Dir. Talent | Sourcing de perfiles (LinkedIn) | — | crear |
| | | Pool de subcontratables + contratación por horas | — | crear |
| **Producto & Tech** | Dir. Producto | Swarmix / Canto / ScoreFlow / Diagnostia | varias | activo |
| | | DevOps (infra, servidores de proyectos) | — | crear |
| **Marketing & Marca** | Dir. Marketing | Web + captación + analítica | `web77d` | activo |
| | | Contenido / LinkedIn | — | crear |
| **Admin & Finanzas** | Dir. Admin | Contabilidad, facturas, cobros, tesorería | `books` | activo |
| | | Fiscal / Legal (AEAT, contratos) | — | crear |
| **Estrategia & Corporate** | Chief of Staff + Diego | Financiación / grants | `grants` | activo |
| | | Estructura y transición (confidencial) | `professional` | activo |
| **Control** | — | Control Financiero / Guardrails | — | crear (prioritario) |

**Célula hermana · Corpora.cat (Irene):** mismo esqueleto, su propio Chief of Staff y su propio equipo. Opera independiente, comparte metodología y herramientas. Es el primer cliente-piloto del producto OMC.

---

## 4. El "soul" de cada puesto (contrato de agente)

Cada sesión-agente arranca con un contrato de 7 campos. Sin los 7 completos, el puesto no existe:

1. **Job** — el outcome del que es dueño (no la tarea, el resultado).
2. **Sources** — de dónde saca la verdad (repos, Supabase, Sheets, Drive, APIs). Reabre la fuente antes de cada acción consecuente; nunca sustituye por memoria.
3. **Judgment** — cómo decide bueno / malo / completo.
4. **Output** — exactamente qué entrega y a quién (siguiente puesto).
5. **Forbidden** — lo que nunca toca. El campo que previene el 80% de los incidentes.
6. **Comunicación** — ver §5.
7. **KPIs** — qué mide su director y qué consolida el Chief.

El contrato vive como cabecera del `CLAUDE.md` de cada sesión/repo.

---

## 5. Reglas de comunicación

- **Solo los agentes que hablan con Diego usan modo ejecutivo:** la decisión o el dato en la primera línea, mínima información, un solo punto a decidir. Diego es un CEO ocupado; cada línea de más le cuesta.
- **Comunicación interna entre agentes:** puede ser detallada. El contexto pesado viaja por ficheros (HANDOFF.md, workspace), no por chat.
- **Todos consultan a Diego las dudas estratégicas.** Él resuelve. Quiere ir desbloqueando dudas de sus agentes, es parte de su trabajo como Owner.
- **Proactividad máxima.** Todo lo que se pueda hacer automáticamente, se hace. No se pregunta lo que ya está decidido.
- **Configuración inicial:** la primera vez la hace Diego (instalar un programa, autenticar, dar un permiso), igual que en `sales` con la Herramienta Java de PLACSP. A partir de ahí, todo lo que pueda ser autónomo lo es. Los agentes hacen sus propias instalaciones cuando pueden.

---

## 6. Regla financiera (dura)

- **Pagar dinero SIEMPRE pasa por Diego.** Ningún agente compra, contrata ni firma un gasto sin su OK explícito.
- **Control Financiero / Guardrails** es un puesto de contrapoder: vigila el gasto agregado de toda la empresa, avisa antes de que algo se dispare, y tiene "voz de alarma" directa a Diego por encima de cualquier director. Es el guardarraíl que impide que la autonomía de los agentes se vaya de madre.
- Todo gasto aprobado queda en el ACTION_LOG.

---

## 7. Acciones en el mundo real y decisión de contratar humanos

Los agentes viven en la máquina. Cuando una tarea exige un humano, **el agente se la pide a Diego** en vez de intentarla. Ejemplos:
- Fichar a una persona para que hable con un cliente cuando Diego no da abasto.
- Presentarse físicamente a un kick-off.
- Firmar algo presencialmente, pagar, gestionar una cuenta personal.

**Estas peticiones se registran y se cuantifican.** Cuando la cola de "acciones que requieren humano" de un tipo concreto supera un umbral recurrente (Diego saturado), RRHH activa la contratación por horas de un perfil que absorba esa carga. Así la empresa sabe *con datos* cuándo deja de ser one-man y contrata gente.

---

## 8. Flujo end-to-end de una licitación (caso central del negocio)

1. **Detección** — Sales Público barre CPV en PLACSP/datos abiertos, triaje por reglas.
2. **Encaje** — si hay duda de encaje, decide Diego. Si el pliego **exige perfiles adjuntos** (project manager, experto certificado, etc.), Sales Público pasa los requisitos a **RRHH**.
3. **RRHH** busca esos perfiles en LinkedIn, contacta y mantiene un **pool de subcontratables** (CVs, certificaciones, experiencia) listo para adjuntar. Sales y RRHH se comunican y hacen las solicitudes entre ellos.
4. **Oferta** — memoria y anexos por plantilla, perfiles adjuntos, firma PAdES con el certificado. **El envío final lo aprueba Diego** (irreversible).
5. **Adjudicación** — si se gana, se abre el proyecto.
6. **Kick-off** — Diego es el **PM / Account Manager**: habla con el cliente, hace el kick-off. Si el pliego pedía un equipo, los 2-3 perfiles subcontratados (pagados por horas) se presentan ese día.
7. **Ejecución** — para proyectos de desarrollo auto-arrancables: firmado el contrato, los agentes de **Tech/DevOps se coordinan solos** y empiezan (levantan servidores, montan gestiones, arrancan el desarrollo). Todo lo reversible, autónomo.
8. **Gasto** — cualquier coste (infra, subcontratación, licencias) lo aprueba Diego y lo vigila Control Financiero.

---

## 9. HQ: el panel de mando (construido el 2026-09-05)

**`https://77delta.com/hq/`** (PWA para el móvil; se abre con el enlace con token de Diego y se añade a la pantalla de inicio). Datos en el Supabase propio (`omc_*`), acceso solo por RPC con token. Código: `~/dev/77delta/public/hq/` (app), `~/dev/77delta/scripts/hq/` (esquema, semilla, CLI, agregador de uso), `~/dev/77delta/api/` (config pública y avisos push).

Cuatro pestañas:
- **Negocio** (añadida el 2026-09-05 por la tarde): KPIs financieros. Comprometido, facturado, cobrado y pendiente de cobrar; ingresos por línea; embudo de licitaciones (número y euros por estado, tasa de éxito, próximo cierre) leído cada hora del Sheet de control de Sales; cupones ACCIÓ y libro de ingresos. **Quién lo alimenta:** el libro de ingresos es de Teresa (admin-books) con `hq ingreso`; el embudo es de Guillem (sales-licita) manteniendo la columna Estado y el Importe € de su Sheet. Fuente futura de facturado/cobrado: FacturaScripts (books.77delta.com).
- **Bandeja**: una tarjeta por petición, ordenadas por prioridad (Comercial primero), vencimiento y antigüedad. Deslizar derecha aprueba, izquierda rechaza; nota escrita o dictada. Las **dudas** se responden con texto. Debajo, "En ejecución" (aprobadas que el agente aún no ha cerrado) e historial. Deshacer en 6 s.
- **Equipo**: organigrama por niveles y departamentos con interruptor on/off por agente, latido (última actividad), coste del mes y % del total; al tocar, el contrato del puesto y sus solicitudes.
- **Costes**: coste nocional a precio de API del mes, veces el precio del plan Max, proyección, por equipo, por agente, por sesión, y dinero real aprobado por departamento.

**Cómo lo usan los agentes** (CLI `hq`, enlazada en `~/bin/hq`; configuración en `~/.config/77delta/hq.env`, nunca en el repo):
```
hq pedir --tipo gasto|contacto|publicacion|estrategia|accion|otro --titulo "..." [--detalle ...] [--importe 48] [--enlace ...] [--vence 2026-09-09T14:00] [--esperar]
hq duda --titulo "..." --detalle "..."        # pregunta a Diego; la respuesta llega en 'respuesta'
hq esperar <id>  ·  hq estado <id>  ·  hq hecho <id> [--nota ...]  ·  hq fallo <id> --nota ...
hq activo [agente]   # código 2 = desactivado por Diego: no trabajar
```
El agente se identifica por el fichero `.claude/hq-agente` en la raíz del repo (id del puesto, p. ej. `sales-licita`), por `HQ_AGENTE` o por el nombre de la carpeta. Un hook `SessionStart` (`~/bin/hq-latido.sh`) consulta el interruptor al arrancar cada sesión y deja el latido.

**Uso de tokens**: `scripts/hq/hq-uso.py` lee las transcripciones locales (`~/.claude/projects/**/*.jsonl`, sin los duplicados sync-conflict), deduplica por `requestId`, agrega por día, sesión y modelo, valora a precio de API y sube por RPC. Cron horario en PCWork (`17 * * * *`). Cada sesión se atribuye a un agente por su nombre (`customTitle`) o por su `cwd` (`omc_agentes.sesiones` / `rutas`).

**Avisos push**: `api.77delta.com/hq/notificar` (lo llama `hq pedir`) envía Web Push a los móviles suscritos desde el menú de la app. Claves VAPID en `~/.config/77delta/vapid.json` y en las variables de Coolify de `api-77delta`.

**Pendiente de v2**: reglas de auto-aprobación aprendidas, informe semanal del lunes, tarjetas "acción humana" a Google Tasks, PIN para aprobar dinero, ROI por equipo, alta de agente desde la app (kit de instalación para Irene), contratos completos de 7 campos por puesto.

**Equipo con nombre y cara (2026-09-05):** cada agente tiene nombre de persona y avatar (`public/hq/avatares/<id>.svg`, generados con DiceBear) para reconocerlo de un vistazo: Marc (chief), Nuria (control), Alex, Laia, Carla, Pau, Julia, Ramon (directores), Guillem (licitaciones), Sergi (ventas), Aina (outreach), Martí (cupones), Ona (LeakAI), Berta (formación), Oriol (proyectos), Clàudia (RRHH), Biel (producto), Roc (devops), Mireia (web), Arnau (contenido), Teresa (contabilidad), Jordi (fiscal), Helena (grants), Ferran (estructura). La lista numerada completa está en `docs/empresa/02-equipo.md`. En HQ, la ficha de cada agente muestra su modelo con versión, su coste, qué está haciendo (Engram) y el enlace a su sesión en claude.ai.

**Documentación de empresa:** `~/dev/77delta/docs/empresa/` (Markdown, fuente de verdad) con copia en la carpeta de Drive "77 Delta · Empresa" (cuenta de Next Gen Academy). Se regenera con `scripts/hq/docs-empresa.py` y la sube el chief.

**Memoria de empresa:** Engram, no Obsidian. Lo que afecta a más de un agente se guarda en el proyecto `77delta` con título `[CORE] ...`; el hook de arranque lo inyecta en toda sesión. Detalle en `docs/empresa/04-comunicacion-interna.md`.

## 9a. Modelos y ventanas del plan Max (decidido 2026-09-05)

El plan Claude Max 20x no se mide en dinero: tiene una **ventana rotatoria de 5 h** y una **semanal** (se reinicia el viernes 22:00 UTC), y cada modelo las consume según su precio (Fable ~2× Opus, Opus ~2,5× Sonnet). HQ lee el consumo real de ambas cada 15 minutos (`scripts/hq/hq-plan.py`, endpoint de uso OAuth) y lo muestra en Costes junto al reparto por agente.

**Regla:** el modelo principal de cada agente es el mínimo que garantiza la calidad de su output; todo lo pesado (barridos, lecturas largas, clasificación) se delega a subagentes más baratos. Se fuerza por repo en `.claude/settings.json` (`model` + `env.CLAUDE_CODE_SUBAGENT_MODEL`) y queda en el contrato (`contrato.modelo`, `subagentes`, `modelo_por_que`, `ventana`). HQ avisa si un agente usa un modelo distinto al asignado.

| Modelo | Agentes | Por qué |
|---|---|---|
| Fable 5.1 | chief, **sales-licita** (redacción de memorias y ofertas) | máximo criterio; cada punto de una memoria es contrato |
| Opus 5 | directores, sales-privado, admin-fiscal, mkt-contenido, estrategia-grants, estrategia-estructura, delivery-formacion, delivery-proyectos, tech-producto (`opus[1m]`) | juicio, redacción para terceros, código difícil |
| Sonnet 5 | bdr-swarmix, delivery-cupones, delivery-leakai, rrhh-sourcing, tech-devops, mkt-web, admin-books, ctrl-finanzas, personal | volumen, plantillas, mantenimiento |
| Haiku 4.5 | subagentes de rutina, hooks, cron | tareas de segundos |

Excepciones dentro de un agente Sonnet: el juez de hallazgos de LeakAI, las propuestas comerciales de cupones y el copy nuevo de la web van por subagente Opus.

**Ventanas:** lo pesado al abrir ventana fresca y de madrugada; los picos (memorias) al principio de la semana de consumo. Si el límite de 5 h para a un agente, programa él mismo (CronCreate/ScheduleWakeup) un "continúa donde lo dejaste" a la hora de reinicio y sigue solo.

**Segunda cuenta Max (capa de ejecución):** cuando la semana pase del 80 % dos semanas seguidas. Se monta con un `CLAUDE_CONFIG_DIR` separado (`~/.claude-exec`), wrapper `claude-exec`, y HQ lee las dos cuentas (`hq-plan.py` ya contempla `ejecucion`). La capa de dirección (chief, estrategia, sales-licita) sigue en la cuenta principal; el volumen (Swarmix, cupones, LeakAI, web) pasa a la de ejecución.

**Sesiones de la raíz `~/dev`:** `books`, `professional` y `personal` tienen carpeta propia desde el 2026-09-05 (con su `CLAUDE.md`, modelo y `hq-agente`); se retoman abriendo Claude desde ahí. La raíz queda para el chief (Fable).

## 9b. Otras piezas pendientes

1. **Control Financiero / Guardrails** — el puesto de contrapoder del gasto (definido en HQ como `ctrl-finanzas`, por activar).
2. **ACTION_LOG por empresa** — hoy lo cubre el historial de HQ; falta el registro de acciones que no pasan por aprobación.
3. **RRHH / pool de subcontratables** — para cumplir requisitos de perfiles en licitaciones.

---

## 10. Reglas duras heredadas (todas las sesiones)

- Nunca "Infinite Labs" hacia el mercado español. Siempre **Next Gen Academy SL** con su CIF en documentos legales.
- **leakai:** verificación humana antes de CUALQUIER contacto con un tercero (el juez automático dio 10 falsos positivos frente a 7 reales; automatizar el contacto = difamar).
- **cuponsIA:** nunca la palabra "implantación" en documentos de ACCIÓ. No desplegar apps live en horario laboral (9-19h).
- **swarmix:** descartar de outreach cualquier perfil conectado con Peninsula.
- Nunca em-dash en ningún texto. Guión normal.

---

## 11. Producto: OMC como servicio a clientes

Lo que se monta para Diego se empaqueta y se vende:
- A cada cliente (empezando por los del cupón ACCIÓ) se le monta su **mini-célula**: 1 Chief + 2-3 agentes según su negocio.
- Es la evolución del Radar de licitaciones (ya a 690 €/mes): del cupón puntual al **retainer mensual de "tu empresa de agentes gestionada"**.
- **Piloto con Irene / Corpora.cat:** se instala el kit en su ordenador como si fuera cliente externo, y sirve para ensayar la venta y el onboarding del servicio.
- **Web:** publicar en la página el "equipo" de 77 Delta mostrando cada agente IA con su job description, explicando la visión One Man Corporation. Es el mejor escaparate del propio producto.

---

## 12. Convención de sesiones y censo de plantilla

- **Nombres:** `dept-rol` en minúscula (ej. `sales-licita`, `sales-privado`, `admin-books`, `rrhh-sourcing`, `ctrl-finanzas`, `chief`).
- **Censo pendiente:** la lista de sesiones está con duplicados y ruido (`cuponsIA` vs `cuponIA`, `web77d` vs `infinitelabs`, varias `random`). Primer trabajo de RRHH interno: mapear cada sesión a un puesto, fusionar duplicados y jubilar las muertas.

---

## Estado

- 2026-09-05 · Documento creado a partir del diseño validado por Diego. Consultadas las 6 sesiones de negocio activas.
- Siguiente: montar la cola de aprobaciones única + el puesto de Control Financiero, y redactar los contratos de los 3 departamentos con gente (Comercial, Delivery, Admin).
