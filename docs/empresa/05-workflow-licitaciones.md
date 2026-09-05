# Workflow · licitaciones públicas (de la detección al proyecto ejecutado)

Responsable: **Guillem · sales-licita** (Comercial, prioridad 1). Modelo Fable 5.1 para leer el pliego final y redactar; todo el volumen por subagentes Sonnet. Panel de control: Sheet "Licitaciones · NGA · control" (embudo Detectado, Aprobado, Presentado, En juego, Contratado).

## 1. Detección (diaria, automática)

- Barrido por CPV en PLACSP y datos abiertos; clasificación por reglas; descarte de lo que está fuera de sector.
- Salida: fila en el Sheet con estado **Detectado** y resumen de encaje.

## 2. Encaje

- Lectura del pliego y extracción de requisitos (solvencia, perfiles, ISO, plazo de implantación, criterios de puntuación).
- Si el encaje es claro, sigue. Si hay duda, **`hq duda`** a Diego con la contradicción o el riesgo y el vencimiento. Regla de Diego: maximizar puntos minimizando impacto; no descartar por no tener producto si el plazo de implantación da margen.
- Si el pliego exige **perfiles adjuntos** (project manager, expertos certificados), Guillem pasa los requisitos a **RRHH (Clàudia · rrhh-sourcing)**, que busca en LinkedIn y mantiene el pool de subcontratables por horas. Sales y RRHH se comunican por Engram y por mensaje entre sesiones.

## 3. Oferta

- Memoria técnica y anexos por plantilla 77 Delta, perfiles adjuntos, declaraciones responsables, firma PAdES con el certificado.
- **Siempre Diego**: precio y porcentaje de baja, cualquier declaración responsable con hechos discutibles, y el **envío final** (irreversible). Se pide con `hq pedir --tipo contacto` (envío) o `--tipo estrategia` (precio), con `--vence` a la hora de cierre.
- El envío se hace pilotando la Herramienta Java de PLACSP; justificante al Sheet y a Drive (carpeta Licitaciones).

## 4. Adjudicación

- Seguimiento de la resolución; alertas de vencimiento de contratos ajenos para volver a concurrir.
- Si se gana: se abre el proyecto en HQ (agente **delivery-proyectos**) y se avisa a Diego.

## 5. Kick-off y ejecución

- **Diego es el PM y account manager**: habla con el cliente y hace el kick-off. Si el pliego pedía un equipo, los perfiles subcontratados (pagados por horas) se presentan ese día.
- Proyectos de desarrollo auto-arrancables: firmado el contrato, **Tech (Biel · tech-producto, Roc · tech-devops)** se coordina solo, levanta servidores y arranca el desarrollo. Lo reversible es autónomo.
- Todo gasto (infraestructura, subcontratación, licencias) pasa por `hq pedir --tipo gasto` y lo vigila Control Financiero.

## Registro y evidencia

- Sheet de control como panel; expediente y justificantes en Drive (`Licitaciones/<expediente>`); decisiones de encaje y aprendizajes en Engram (`[CORE]` si afectan a otros).
- Bloqueos conocidos (septiembre 2026): sesión PLACSP caduca y sin credenciales guardadas (el envío final sigue siendo de Diego); ROLECE con requerimiento de subsanación hasta que el Registro Mercantil califique las cuentas; VORTAL exige alta previa en la plataforma asturiana.
