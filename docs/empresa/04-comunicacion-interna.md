# Comunicación interna y memoria de empresa (Engram)

Engram es la memoria corporativa. Obsidian ya no se usa. Todo lo que se decide en una sesión y afecta a otras tiene que estar en Engram el mismo día, y toda sesión lo lee al arrancar.

## Regla de oro

Lo que es **core** (afecta a más de un agente o a cómo trabaja la empresa) se guarda en el proyecto compartido `77delta` con el prefijo `[CORE]` en el título y tipo `decision`, `config` o `architecture`. Lo que solo afecta a un agente se guarda en su propio proyecto.

```
mem_save  title: "[CORE] <qué se ha decidido>"  project: "77delta"  type: decision
          content: **What** / **Why** / **Where** / **Learned**  (y a quién afecta)
```

Ejemplos de core: cambio de marca o de sociedad que factura, modelo asignado a un agente, una regla nueva de HQ, un plazo que mueve varios equipos, un cliente nuevo, un precio.

## Cómo llega la información

1. **Al arrancar cada sesión**, el hook de HQ inyecta las últimas novedades `[CORE]` de Engram. Nadie tiene que buscarlas.
2. **Cuando el chief decide algo que afecta a un agente concreto**, además de Engram le manda un mensaje entre sesiones (SendMessage) con lo que cambia para él.
3. **Cuando un agente descubre algo que afecta a otros** (un gotcha de infraestructura, una fecha, un dato de un cliente), lo guarda como `[CORE]` y avisa al chief.
4. **Antes de cerrar una sesión** (o cuando Diego cierra la tapa): `mem_session_summary` con objetivo, estado, bloqueos y próximos pasos, para que la siguiente sesión (o la misma tras compactar) retome sin pérdida.

## Qué NO va a Engram

Secretos (tokens, contraseñas, claves), datos personales de terceros que no hagan falta, y lo que ya está en el código o en git. Lo confidencial de la sesión `professional` se guarda sin nombres de empresa ni cifras sensibles.

## Herramientas

- MCP en cada sesión: `mem_save`, `mem_search` (con `project: "77delta"` o `all_projects: true`), `mem_context`, `mem_session_summary`.
- CLI: `engram search "[CORE]" --project 77delta --limit 10`, `engram context 77delta`.
- Sincronización entre máquinas: servidor Engram propio en VPS6 (Tailscale). La memoria de PCWork y del Mac es la misma.
- HQ muestra en la ficha de cada agente sus últimas observaciones (pestaña Equipo, "Qué está haciendo").
