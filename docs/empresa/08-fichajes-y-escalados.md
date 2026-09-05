# Fichajes y escalados

Cómo nace un puesto nuevo en la One Man Corporation y cómo sube al chief una petición que se sale del ámbito de un agente.

## Escalado (de un agente al chief)

Un agente escala cuando lo que se le pide no es suyo: un producto nuevo, un puesto nuevo, algo que cruza departamentos, o cuando Diego responde con "escala", "fichad", "producto" o "@chief" en una tarjeta.

1. El agente lee la respuesta de Diego (`hq esperar <id>` o `hq activo` al arrancar, que lo avisa).
2. Reenvía la petición al chief por mensaje entre sesiones (sesión **Chief OMC**), con el id de la tarjeta, lo que pidió y lo que Diego contestó.
3. Cierra su tarjeta con `hq hecho <id> --nota "escalado al chief"`.
4. El chief la recoge y decide: asignar a un agente existente, o proponer un fichaje.

El chief además revisa `hq escaladas` cada vez que Diego habla con él: lista las tarjetas respondidas por Diego que contienen una orden de escalar y que nadie ha cerrado.

## Fichaje (alta de un puesto)

1. **Necesidad**: llega por escalado, por Diego, o porque el chief ve que un trabajo no tiene dueño.
2. **Definición**: el chief escribe el contrato del puesto (job, fuentes, criterio, output, prohibido, modelo y subagentes, KPIs), lo sitúa en el organigrama (departamento, nivel, a quién reporta), le da nombre de persona y estima carga (modelo y consumo esperado).
3. **Aprobación**: el chief sube a Diego UNA tarjeta `hq pedir --agente chief --tipo estrategia --titulo "Fichaje: <persona> · <puesto>"` con el contrato resumido. Nada arranca sin ese OK.
4. **Alta (el mismo día del OK)**: `omc_agente_set` en HQ (o fila en `seed-77delta.sql`), avatar en `public/hq/avatares/<id>.svg`, carpeta o repo con `CLAUDE.md` (contrato completo), `.claude/settings.json` (modelo y subagentes) y `.claude/hq-agente`, línea en `~/bin/equipo`, sesión arrancada con su nombre, primer encargo por mensaje, `docs/empresa/02-equipo.md` regenerado.
5. **Activación**: interruptor en HQ a activo cuando el hook responde, el agente ha escrito su primer parte y ha cerrado su primera tarjeta. Hasta entonces figura "por contratar".
6. **Traspaso**: si el trabajo lo hacía otro agente, ese agente escribe un parte de traspaso (qué hay hecho, dónde está, qué falta) y el nuevo lo confirma.

## Baja o cambio

Desactivar en HQ (interruptor) deja el puesto en el organigrama sin trabajo; para eliminarlo, borrar la fila y su carpeta. Cambiar de modelo o de jefe es editar el contrato y `.claude/settings.json`.
