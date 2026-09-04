// api.77delta.com · formulario de contacto de 77delta.com.
// POST /contacto {nombre, empresa, email, sector, mensaje, web(honeypot)} -> email a MAIL_TO por SMTP.
// Sin SMTP configurado, el lead se guarda en LEADS_FILE y en el log, y se responde 200 igualmente.
import http from 'node:http';
import { appendFile } from 'node:fs/promises';
import nodemailer from 'nodemailer';

const PORT = Number(process.env.PORT || 3000);
const ORIGENES = (process.env.CORS_ORIGINS || 'https://77delta.com,https://www.77delta.com').split(',').map((s) => s.trim());
const MAIL_TO = process.env.MAIL_TO || 'hola@77delta.com';
const MAIL_FROM = process.env.MAIL_FROM || process.env.SMTP_USER || MAIL_TO;
const LEADS_FILE = process.env.LEADS_FILE || '/data/leads.jsonl';
const SMTP_OK = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

const transporte = SMTP_OK
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 465),
      secure: (process.env.SMTP_SECURE || 'true') !== 'false',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      // Tiempos cortos: si el SMTP no responde, no bloquea al visitante (el envío es asíncrono).
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    })
  : null;

// Límite sencillo por IP: 5 envíos cada 10 minutos.
const cubos = new Map();
function permitido(ip) {
  const ahora = Date.now();
  const c = (cubos.get(ip) || []).filter((t) => ahora - t < 600_000);
  if (c.length >= 5) return false;
  c.push(ahora);
  cubos.set(ip, c);
  return true;
}

const limpiar = (v, max) => String(v ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);
const esEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

function cors(req, res) {
  const origen = req.headers.origin;
  if (origen && ORIGENES.includes(origen)) res.setHeader('Access-Control-Allow-Origin', origen);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function responder(res, codigo, cuerpo) {
  res.writeHead(codigo, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(cuerpo));
}

async function leerJson(req) {
  let datos = '';
  for await (const trozo of req) {
    datos += trozo;
    if (datos.length > 20_000) throw new Error('demasiado grande');
  }
  return JSON.parse(datos || '{}');
}

async function guardar(lead) {
  try {
    await appendFile(LEADS_FILE, JSON.stringify(lead) + '\n');
  } catch (e) {
    console.error('no se pudo escribir', LEADS_FILE, e.message);
  }
}

const servidor = http.createServer(async (req, res) => {
  cors(req, res);
  const ruta = new URL(req.url, 'http://x').pathname;
  if (req.method === 'OPTIONS') return void res.writeHead(204).end();
  if (req.method === 'GET' && (ruta === '/' || ruta === '/health')) return responder(res, 200, { ok: true, smtp: SMTP_OK });
  if (req.method !== 'POST' || ruta !== '/contacto') return responder(res, 404, { ok: false, error: 'no encontrado' });

  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  if (!permitido(ip)) return responder(res, 429, { ok: false, error: 'Demasiados envíos. Prueba en unos minutos.' });

  let cuerpo;
  try {
    cuerpo = await leerJson(req);
  } catch {
    return responder(res, 400, { ok: false, error: 'Cuerpo no válido.' });
  }

  // Honeypot: los bots rellenan el campo oculto.
  if (cuerpo.web) return responder(res, 200, { ok: true });

  const lead = {
    fecha: new Date().toISOString(),
    nombre: limpiar(cuerpo.nombre, 120),
    empresa: limpiar(cuerpo.empresa, 120),
    email: limpiar(cuerpo.email, 160),
    sector: limpiar(cuerpo.sector, 80),
    mensaje: String(cuerpo.mensaje ?? '').trim().slice(0, 5000),
    origen: limpiar(cuerpo.origen, 200),
    ip,
  };
  if (!lead.nombre || !lead.empresa || !lead.mensaje || !esEmail(lead.email)) {
    return responder(res, 400, { ok: false, error: 'Faltan datos o el email no es válido.' });
  }

  await guardar(lead);
  console.log('lead', JSON.stringify({ ...lead, mensaje: lead.mensaje.slice(0, 80) }));

  // El lead ya está a salvo: respondemos ya y el correo sale en segundo plano.
  responder(res, 200, { ok: true, enviado: Boolean(transporte) });
  if (!transporte) return;

  const texto = [
    `Nombre: ${lead.nombre}`,
    `Empresa: ${lead.empresa}`,
    `Email: ${lead.email}`,
    `Sector: ${lead.sector}`,
    `Origen: ${lead.origen || '77delta.com/contacto'}`,
    '',
    lead.mensaje,
  ].join('\n');

  transporte
    .sendMail({
      from: `"77 Delta · web" <${MAIL_FROM}>`,
      to: MAIL_TO,
      replyTo: `"${lead.nombre}" <${lead.email}>`,
      subject: `Contacto web · ${lead.empresa}`,
      text: texto,
    })
    .then((info) => console.log('smtp ok', info.messageId, lead.email))
    .catch((e) => console.error('smtp error', e.message, '· lead guardado en', LEADS_FILE));
});

servidor.listen(PORT, () => console.log(`api.77delta.com en :${PORT} · smtp=${SMTP_OK} · leads=${LEADS_FILE}`));
