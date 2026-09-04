# api.77delta.com

Endpoint del formulario de contacto de 77delta.com. Node 22 sin framework, `nodemailer` para el SMTP.

- `POST /contacto` con JSON `{nombre, empresa, email, sector, mensaje, web}` (`web` es el honeypot, debe ir vacío).
- `GET /health` devuelve `{ok, smtp}`.
- Cada lead se guarda en `LEADS_FILE` y, si hay SMTP, se envía a `MAIL_TO` con `Reply-To` del remitente.

Variables: `SMTP_HOST`, `SMTP_PORT` (465), `SMTP_SECURE` (true), `SMTP_USER`, `SMTP_PASS`, `MAIL_TO`, `MAIL_FROM`, `CORS_ORIGINS`.
Desplegado con Coolify (VPS6) desde esta carpeta.

## Despliegue

Vive en Coolify (VPS6, proyecto «77delta», app `api-77delta`). El repo es público, así que Coolify lo clona sin llave.

- **Los pushes no despliegan solos.** Hay que lanzar el deploy: `GET /api/v1/deploy?uuid=<uuid de la app>&force=true` con el token de Coolify, o el botón Deploy en el panel.
- **SMTP por el puerto 587 con STARTTLS.** El 465 está bloqueado en salida en ese servidor, y con él el envío se queda colgado hasta agotar el tiempo.
- **El correo sale en segundo plano.** La respuesta al visitante no espera al SMTP: primero se guarda el lead, luego se envía.
- **`/data` no es un volumen persistente todavía.** Cada redeploy vacía `leads.jsonl`. El correo es el canal bueno; el fichero es solo respaldo. Para hacerlo persistente: en la app, Persistent Storage, volumen nuevo montado en `/data`.
