// api.77delta.com · formulario de contacto de 77delta.com y avisos push de HQ.
// POST /contacto {nombre, empresa, email, sector, mensaje, web(honeypot)} -> email a MAIL_TO por SMTP.
// Sin SMTP configurado, el lead se guarda en LEADS_FILE y en el log, y se responde 200 igualmente.
// GET /hq/vapid -> clave pública VAPID. POST /hq/notificar {token, id} -> push a los móviles del owner de esa empresa.
import http from 'node:http';
import { appendFile } from 'node:fs/promises';
import nodemailer from 'nodemailer';
import webpush from 'web-push';

const PORT = Number(process.env.PORT || 3000);
const ORIGENES = (process.env.CORS_ORIGINS || 'https://77delta.com,https://www.77delta.com').split(',').map((s) => s.trim());
const MAIL_TO = process.env.MAIL_TO || 'hola@77delta.com';
const MAIL_FROM = process.env.MAIL_FROM || process.env.SMTP_USER || MAIL_TO;
const LEADS_FILE = process.env.LEADS_FILE || '/data/leads.jsonl';
const SMTP_OK = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

// HQ: Supabase propio (anon para validar tokens por RPC, service para leer suscripciones) y claves VAPID.
const HQ = {
  url: (process.env.HQ_SUPABASE_URL || '').replace(/\/$/, ''),
  anon: process.env.HQ_SUPABASE_ANON || '',
  service: process.env.HQ_SUPABASE_SERVICE || '',
  app: process.env.HQ_APP_URL || 'https://77delta.com/hq/',
};
const VAPID_OK = Boolean(process.env.VAPID_PUBLIC && process.env.VAPID_PRIVATE && HQ.url && HQ.anon && HQ.service);
// Dictado de HQ: el móvil graba y aquí se transcribe con Mistral (Voxtral), que es EU y sigue el formato OpenAI de /audio/transcriptions.
const STT_OK = Boolean(process.env.MISTRAL_API_KEY && HQ.url && HQ.anon);
const STT_MODEL = process.env.STT_MODEL || 'voxtral-mini-latest';
if (VAPID_OK) webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:hola@77delta.com', process.env.VAPID_PUBLIC, process.env.VAPID_PRIVATE);

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-HQ-Token');
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

async function leerBinario(req, max = 12_000_000) {
  const trozos = [];
  let total = 0;
  for await (const trozo of req) {
    total += trozo.length;
    if (total > max) throw new Error('audio demasiado grande');
    trozos.push(trozo);
  }
  return Buffer.concat(trozos);
}

async function transcribir(audio, tipo) {
  const ext = /mp4|m4a|aac/.test(tipo) ? 'm4a' : /webm/.test(tipo) ? 'webm' : /ogg|opus/.test(tipo) ? 'ogg' : /wav/.test(tipo) ? 'wav' : 'mp3';
  const form = new FormData();
  form.append('file', new Blob([audio], { type: tipo || 'application/octet-stream' }), `nota.${ext}`);
  form.append('model', STT_MODEL);
  form.append('language', 'es');
  const r = await fetch('https://api.mistral.ai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.MISTRAL_API_KEY}` },
    body: form,
    signal: AbortSignal.timeout(60_000),
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`mistral ${r.status} ${texto.slice(0, 200)}`);
  const json = JSON.parse(texto);
  return String(json.text || '').trim();
}

async function guardar(lead) {
  try {
    await appendFile(LEADS_FILE, JSON.stringify(lead) + '\n');
  } catch (e) {
    console.error('no se pudo escribir', LEADS_FILE, e.message);
  }
}

// ---- HQ ----
async function supa(ruta, opciones = {}, clave = HQ.anon) {
  const r = await fetch(HQ.url + ruta, {
    ...opciones,
    headers: { apikey: clave, Authorization: `Bearer ${clave}`, 'Content-Type': 'application/json', ...(opciones.headers || {}) },
    signal: AbortSignal.timeout(15_000),
  });
  const texto = await r.text();
  let json = null;
  try { json = texto ? JSON.parse(texto) : null; } catch { json = texto; }
  if (!r.ok) throw new Error(`${ruta} ${r.status} ${typeof json === 'object' && json?.message ? json.message : String(texto).slice(0, 200)}`);
  return json;
}
const rpc = (fn, args) => supa(`/rest/v1/rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) });
const TIPO = { gasto: 'Gasto', contacto: 'Contacto', publicacion: 'Publicación', estrategia: 'Estrategia', duda: 'Duda', accion: 'Acción humana', otro: 'Aprobación' };

async function notificar(token, id, texto = '') {
  const info = await rpc('omc_token_info', { p_token: token });
  const s = await rpc('omc_estado', { p_token: token, p_id: id });
  const subs = await supa(`/rest/v1/omc_push?empresa=eq.${encodeURIComponent(info.empresa)}&select=id,endpoint,sub`, {}, HQ.service);
  let importe = s.importe;
  if (importe == null) {
    // Sin importe explícito: se busca la licitación citada por expediente en el título o el detalle.
    try {
      const lics = await supa(`/rest/v1/omc_licitaciones?empresa=eq.${encodeURIComponent(info.empresa)}&select=expediente,importe`, {}, HQ.service);
      const txt = `${s.titulo} ${s.detalle}`.toLowerCase();
      const l = (lics || []).find((x) => x.expediente && x.expediente.length > 4 && txt.includes(String(x.expediente).toLowerCase()));
      if (l && l.importe != null) importe = l.importe;
    } catch {}
  }
  const extra = [importe != null ? `${Number(importe).toLocaleString('es-ES')} €` : '', s.vence ? `vence ${new Date(s.vence).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''].filter(Boolean).join(' · ');
  const carga = JSON.stringify({
    title: texto ? `${s.agente} responde · #${s.id}` : `${TIPO[s.tipo] || 'HQ'} · ${s.agente}`,
    body: texto ? String(texto).slice(0, 300) : s.titulo + (extra ? `\n${extra}` : ''),
    url: `${HQ.app}?id=${s.id}`,
    tag: `hq-${s.id}`,
    id: s.id,
  });
  let enviados = 0, fallidos = 0;
  for (const fila of subs) {
    try {
      await webpush.sendNotification(fila.sub, carga, { TTL: 3600, urgency: 'high' });
      enviados++;
    } catch (e) {
      fallidos++;
      if (e.statusCode === 404 || e.statusCode === 410) {
        await supa(`/rest/v1/omc_push?id=eq.${fila.id}`, { method: 'DELETE' }, HQ.service).catch(() => {});
      } else console.error('push error', e.statusCode, e.message);
    }
  }
  return { enviados, fallidos, dispositivos: subs.length };
}

// Mismo patrón que notificar(), pero para el hilo de una licitación (no tiene solicitud asociada): la resuelve por expediente.
async function notificarLic(token, expediente, texto = '') {
  const info = await rpc('omc_token_info', { p_token: token });
  const lics = await supa(`/rest/v1/omc_licitaciones?empresa=eq.${encodeURIComponent(info.empresa)}&expediente=eq.${encodeURIComponent(expediente)}&select=expediente,organo,importe`, {}, HQ.service);
  const l = lics[0];
  if (!l) throw new Error('licitación no encontrada');
  const subs = await supa(`/rest/v1/omc_push?empresa=eq.${encodeURIComponent(info.empresa)}&select=id,endpoint,sub`, {}, HQ.service);
  const extra = l.importe != null ? `${Number(l.importe).toLocaleString('es-ES')} €` : '';
  const carga = JSON.stringify({
    title: `Licitación ${l.expediente} responde`,
    body: texto ? String(texto).slice(0, 300) : (l.organo || l.expediente) + (extra ? `\n${extra}` : ''),
    url: `${HQ.app}?lic=${encodeURIComponent(l.expediente)}`,
    tag: `hq-lic-${l.expediente}`,
    lic: l.expediente,
  });
  let enviados = 0, fallidos = 0;
  for (const fila of subs) {
    try {
      await webpush.sendNotification(fila.sub, carga, { TTL: 3600, urgency: 'high' });
      enviados++;
    } catch (e) {
      fallidos++;
      if (e.statusCode === 404 || e.statusCode === 410) {
        await supa(`/rest/v1/omc_push?id=eq.${fila.id}`, { method: 'DELETE' }, HQ.service).catch(() => {});
      } else console.error('push error', e.statusCode, e.message);
    }
  }
  return { enviados, fallidos, dispositivos: subs.length };
}

// Push agrupado (8-sep, ruido de notificaciones): un único aviso cuando hq-notificar.py encuentra varias
// tarjetas pendientes sin notificar a la vez, en vez de una por tarjeta. tag fijo 'hq-lote' para que un
// segundo aviso agrupado sustituya al anterior en vez de apilarse en la bandeja del móvil.
async function notificarLote(token, ids) {
  const info = await rpc('omc_token_info', { p_token: token });
  const subs = await supa(`/rest/v1/omc_push?empresa=eq.${encodeURIComponent(info.empresa)}&select=id,endpoint,sub`, {}, HQ.service);
  const filtro = ids.map((x) => Number(x)).filter(Number.isInteger).join(',');
  const filas = await supa(`/rest/v1/omc_solicitudes?empresa=eq.${encodeURIComponent(info.empresa)}&id=in.(${filtro})&select=id,tipo,titulo,agente&order=created_at.asc`, {}, HQ.service);
  const resumen = (filas || []).slice(0, 4).map((f) => `${TIPO[f.tipo] || f.tipo} · ${f.agente}: ${f.titulo}`).join('\n');
  const carga = JSON.stringify({
    title: `${filas.length} tarjetas pendientes de tu decisión`,
    body: resumen + (filas.length > 4 ? `\n… y ${filas.length - 4} más` : ''),
    url: HQ.app,
    tag: 'hq-lote',
  });
  let enviados = 0, fallidos = 0;
  for (const fila of subs) {
    try {
      await webpush.sendNotification(fila.sub, carga, { TTL: 3600, urgency: 'high' });
      enviados++;
    } catch (e) {
      fallidos++;
      if (e.statusCode === 404 || e.statusCode === 410) {
        await supa(`/rest/v1/omc_push?id=eq.${fila.id}`, { method: 'DELETE' }, HQ.service).catch(() => {});
      } else console.error('push error', e.statusCode, e.message);
    }
  }
  return { enviados, fallidos, dispositivos: subs.length, tarjetas: filas.length };
}

const servidor = http.createServer(async (req, res) => {
  cors(req, res);
  const ruta = new URL(req.url, 'http://x').pathname;
  if (req.method === 'OPTIONS') return void res.writeHead(204).end();
  if (req.method === 'GET' && (ruta === '/' || ruta === '/health')) return responder(res, 200, { ok: true, smtp: SMTP_OK, push: VAPID_OK, stt: STT_OK });

  if (ruta === '/hq/transcribir' && req.method === 'POST') {
    if (!STT_OK) return responder(res, 503, { ok: false, error: 'dictado no configurado' });
    const token = limpiar(req.headers['x-hq-token'], 120);
    if (!token) return responder(res, 401, { ok: false, error: 'falta token' });
    try {
      const info = await rpc('omc_token_info', { p_token: token });
      if (info.rol !== 'owner') return responder(res, 403, { ok: false, error: 'solo owner' });
      const audio = await leerBinario(req);
      if (audio.length < 1000) return responder(res, 400, { ok: false, error: 'audio vacío' });
      const text = await transcribir(audio, String(req.headers['content-type'] || ''));
      console.log('hq stt', audio.length, 'bytes ->', text.length, 'chars');
      return responder(res, 200, { ok: true, text });
    } catch (e) {
      console.error('hq transcribir', e.message);
      return responder(res, /token/i.test(e.message) ? 403 : 502, { ok: false, error: e.message });
    }
  }

  if (ruta === '/hq/config' && req.method === 'GET') {
    // Configuración pública de la app (URL y clave anon de Supabase): así el repo público no lleva ninguna clave.
    if (!HQ.url || !HQ.anon) return responder(res, 503, { ok: false, error: 'HQ no configurado' });
    return responder(res, 200, { ok: true, url: HQ.url, anon: HQ.anon, publicKey: process.env.VAPID_PUBLIC || null });
  }
  if (ruta === '/hq/vapid' && req.method === 'GET') {
    if (!VAPID_OK) return responder(res, 503, { ok: false, error: 'avisos no configurados' });
    return responder(res, 200, { ok: true, publicKey: process.env.VAPID_PUBLIC });
  }
  if (ruta === '/hq/notificar' && req.method === 'POST') {
    if (!VAPID_OK) return responder(res, 503, { ok: false, error: 'avisos no configurados' });
    let cuerpo;
    try { cuerpo = await leerJson(req); } catch { return responder(res, 400, { ok: false, error: 'Cuerpo no válido.' }); }
    const token = limpiar(cuerpo.token, 120), id = Number(cuerpo.id);
    if (!token || !Number.isInteger(id)) return responder(res, 400, { ok: false, error: 'Faltan token o id.' });
    try {
      const r = await notificar(token, id, String(cuerpo.texto ?? '').trim().slice(0, 300));
      console.log('hq push', id, JSON.stringify(r));
      return responder(res, 200, { ok: true, ...r });
    } catch (e) {
      console.error('hq notificar', e.message);
      return responder(res, /token|encontrada/i.test(e.message) ? 403 : 502, { ok: false, error: e.message });
    }
  }
  if (ruta === '/hq/notificar-lote' && req.method === 'POST') {
    // Lo llama solo hq-notificar.py (cron), nunca un agente directamente.
    if (!VAPID_OK) return responder(res, 503, { ok: false, error: 'avisos no configurados' });
    let cuerpo;
    try { cuerpo = await leerJson(req); } catch { return responder(res, 400, { ok: false, error: 'Cuerpo no válido.' }); }
    const token = limpiar(cuerpo.token, 120), ids = Array.isArray(cuerpo.ids) ? cuerpo.ids : [];
    if (!token || !ids.length) return responder(res, 400, { ok: false, error: 'Faltan token o ids.' });
    try {
      const r = await notificarLote(token, ids);
      console.log('hq push lote', ids.length, JSON.stringify(r));
      return responder(res, 200, { ok: true, ...r });
    } catch (e) {
      console.error('hq notificar-lote', e.message);
      return responder(res, /token/i.test(e.message) ? 403 : 502, { ok: false, error: e.message });
    }
  }
  if (ruta === '/hq/notificar-lic' && req.method === 'POST') {
    // Avisa a Diego cuando un agente responde en el hilo de una licitación (no tiene solicitud asociada, por eso va aparte de /hq/notificar).
    if (!VAPID_OK) return responder(res, 503, { ok: false, error: 'avisos no configurados' });
    let cuerpo;
    try { cuerpo = await leerJson(req); } catch { return responder(res, 400, { ok: false, error: 'Cuerpo no válido.' }); }
    const token = limpiar(cuerpo.token, 120), expediente = limpiar(cuerpo.expediente, 120);
    if (!token || !expediente) return responder(res, 400, { ok: false, error: 'Faltan token o expediente.' });
    try {
      const r = await notificarLic(token, expediente, String(cuerpo.texto ?? '').trim().slice(0, 300));
      console.log('hq push lic', expediente, JSON.stringify(r));
      return responder(res, 200, { ok: true, ...r });
    } catch (e) {
      console.error('hq notificar-lic', e.message);
      return responder(res, /token|encontrada/i.test(e.message) ? 403 : 502, { ok: false, error: e.message });
    }
  }

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

servidor.listen(PORT, () => console.log(`api.77delta.com en :${PORT} · smtp=${SMTP_OK} · push=${VAPID_OK} · leads=${LEADS_FILE}`));
