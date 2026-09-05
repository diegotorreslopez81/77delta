# HQ · manual de uso

HQ es el panel de mando de la One Man Corporation: `https://77delta.com/hq/`. Es una web app para el móvil (se añade a la pantalla de inicio) que solo abre Diego con su enlace con token. Los agentes no la ven: escriben en ella con la CLI `hq`.

## Para Diego

- **Bandeja**: cada tarjeta es algo que espera tu decisión. Deslizar a la derecha aprueba, a la izquierda rechaza. El botón ✎ añade una nota para el agente (escrita o dictada con el micrófono). Las **dudas** se contestan con texto. Las tarjetas van ordenadas por prioridad (Comercial primero), vencimiento y antigüedad; las que vencen en menos de 24 h llevan borde rojo.
- **En ejecución**: lo aprobado que el agente aún no ha cerrado. **Historial**: lo cerrado. Tocar una fila abre el detalle y permite devolverla a pendiente.
- **Equipo**: el organigrama numerado. Cada tarjeta es un agente con su nombre, su rol, su modelo (con versión), su coste del mes y su latido (punto verde = activo en las últimas 36 h, ámbar = esta semana, gris = sin actividad). El interruptor lo activa o desactiva: un agente desactivado no trabaja. Tocar la tarjeta abre su ficha: contrato, qué está haciendo (últimas observaciones de Engram), sus solicitudes abiertas y el enlace a su sesión en claude.ai.
- **Costes**: consumo real del plan Max (ventana de 5 h y semana, con hora de reinicio), coste nocional a precio de API por equipo, agente y sesión, y dinero real aprobado por departamento. Las etiquetas rojas marcan un agente que usa un modelo distinto al asignado.
- **Menú ⋯**: activar avisos push en el móvil (en iPhone, antes añadir HQ a la pantalla de inicio), recargar, cerrar sesión.

## Para los agentes (CLI `hq`)

Configuración en `~/.config/77delta/hq.env` (nunca en el repo). El agente se identifica con `--agente <id>`, con el fichero `.claude/hq-agente` del repo o con el nombre de su sesión.

```
hq pedir --agente <id> --tipo gasto|contacto|publicacion|estrategia|accion|otro --titulo "..." [--detalle "..."] [--importe N] [--enlace URL] [--vence 2026-09-09T14:00] [--riesgo "..."] [--esperar]
hq duda  --agente <id> --titulo "..." --detalle "..."
hq estado <id>        hq esperar <id> [--timeout seg]        hq pendientes [agente]
hq hecho <id> [--nota "..."]        hq fallo <id> --nota "..."
hq activo [agente]    (código 0 activo, 2 desactivado por Diego, 3 sin alta)
```

Reglas: todo lo irreversible (gasto, contacto con terceros, publicar, decisiones de estrategia) pasa por `hq pedir` y se espera el veredicto; lo reversible se hace sin preguntar. Al ejecutar lo aprobado, `hq hecho`; si falla, `hq fallo`. El vencimiento (`--vence`) es obligatorio cuando existe un plazo real. En el título, lo esencial en una línea; en el detalle, lo que Diego necesita para decidir, sin relleno.

## Piezas técnicas

- Datos: Supabase propio, tablas `omc_*`, acceso solo por RPC con token (`scripts/hq/schema.sql`).
- App: `public/hq/` del repo `77delta` (GitHub Pages). La configuración pública la sirve `api.77delta.com/hq/config`.
- Avisos push: `api.77delta.com/hq/notificar` (Web Push, claves VAPID en Coolify).
- Cron en PCWork: `hq-uso.py` (tokens, cada hora), `hq-plan.py` (plan Max, cada 15 min), `hq-actividad.py` (Engram y latidos, cada 15 min).
- Hook `SessionStart` en Claude Code (`~/bin/hq-latido.sh`): comprueba el interruptor, deja latido y recuerda las reglas.
