# Workflow · Cupó IA d'ACCIÓ (de la concesión a la justificación)

Responsable: **Martí · delivery-cupones** (Delivery). Modelo Sonnet 5 para actas, fichas, horas y borradores; las propuestas comerciales y los documentos de criterio por subagente Opus. Repo `~/dev/cuponsIA`; captación y trámite en `~/dev/infinitelabs-portal-cupons`.

## Marco

- 8.000 € al 100 %, 80 h a 100 €/h; IVA no subvencionable. Financia **diagnosis estratégica y técnica más hoja de ruta**: nunca implantación, desarrollo ni compra de tecnología. La palabra "implantación" no puede aparecer en factura ni memoria.
- Siete entregables obligatorios (Resolución EMT/1297/2026, anexo 2, apartado 5). El beneficiario paga, justifica y ACCIÓ reembolsa (mínimo 80 % justificado). Factura a nombre de Diego Torres, persona física (acreditación nominal).
- Ventana de ejecución hasta el 30/07/2027.

## Flujo por cliente

1. **Kick-off** con el cliente (Diego). Se crea la ficha viva en `77delta.com/<slug>/?t=<token>` (plataforma propia: shell en el repo 77delta, datos en Supabase por RPC con token). Dos enlaces: editor (Diego) y cliente.
2. **Cuestionarios por área** en Google Docs (nunca inline en email) y carpeta de ficheros del cliente en Drive (`0. Marketing/Sales/Cupons ACCIO/<cliente>/`, ocho subcarpetas estándar).
3. **Reuniones de seguimiento**: grabación con Fathom; acta con plantilla 77 Delta (`scripts/gen-reunion-doc.py`); registro de horas (`scripts/horas.py`) y bitácora (`scripts/bitacora.py`) en el repo; `push-ficha.py` publica.
4. **Entregables**: diagnosis por áreas, hoja de ruta, evidencia para ACCIÓ en `docs/` del cliente. Propuestas fuera del cupón (radar de licitaciones, Swarmix por polígonos, acompañamiento) en la pestaña Propuestas de la ficha; siempre con OK de Diego.
5. **Cierre**: memoria técnica y factura (Diego), justificación en la sede de ACCIÓ.

## Qué pasa por HQ

- Enviar correo al cliente o tocar su calendario: `hq pedir --tipo contacto`. Precios y propuestas: `--tipo estrategia`. Cambios de alcance del cupón: `--tipo estrategia` (y nunca "implantación"). Facturación y cobro: `--tipo gasto` o `otro`. Deploys de apps live: fuera del horario laboral, con `--vence` a la noche.
- Lo reversible sin preguntar: registrar horas y bitácora, actas, actualizar fichas y tareas, verificación e2e, informes de situación del radar, borradores de correo (`scripts/gmail-draft.py`, nunca enviar).

## Evidencia y registro

- Fuente única de horas y bitácora en CSV del repo; en la web son solo lectura.
- Decisiones y aprendizajes en Engram; los que afectan a otros cupones o a la empresa, como `[CORE]`.
