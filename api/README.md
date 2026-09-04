# api.77delta.com

Endpoint del formulario de contacto de 77delta.com. Node 22 sin framework, `nodemailer` para el SMTP.

- `POST /contacto` con JSON `{nombre, empresa, email, sector, mensaje, web}` (`web` es el honeypot, debe ir vacío).
- `GET /health` devuelve `{ok, smtp}`.
- Cada lead se guarda en `LEADS_FILE` y, si hay SMTP, se envía a `MAIL_TO` con `Reply-To` del remitente.

Variables: `SMTP_HOST`, `SMTP_PORT` (465), `SMTP_SECURE` (true), `SMTP_USER`, `SMTP_PASS`, `MAIL_TO`, `MAIL_FROM`, `CORS_ORIGINS`.
Desplegado con Coolify (VPS6) desde esta carpeta.
