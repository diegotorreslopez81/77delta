# Modelos y ventanas del plan Max


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

