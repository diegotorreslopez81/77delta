/**
 * Datos de la web en un solo sitio. Todo lo que cambie con el dominio,
 * el email o la sociedad se toca aquí y en ningún otro fichero.
 */
export const site = {
  nombre: '77 Delta',
  claim: 'Aplicamos la IA para ahorrar costes a tu empresa',
  descripcion:
    'Consultora tecnológica especializada en pymes. Diagnóstico gratuito, transformación operativa con IA, auditoría de seguridad de asistentes y partner tecnológico. Barcelona.',
  ciudad: 'Barcelona',
  // Pendiente: activar el buzón cuando se compre el dominio.
  email: 'hola@77delta.com',
  calendario: 'https://calendar.app.google/3nhQL1Fp3EW9YhBj6',
  /** El mismo calendario en su forma incrustable, para el iframe de /contacto/. */
  calendarioIncrustado:
    'https://calendar.google.com/calendar/appointments/schedules/AcZssZ19nS10xCn7247I-0Oo6XBzmvsAUqfXGe1F44Ty1IW2iY7Rk7X7Qx76fmwd32sbdawpNV22e8og?gv=true',
  /** Endpoint del formulario de contacto (carpeta api/ del repo). Si falla, el formulario cae a mailto. */
  formulario: 'https://api.77delta.com/contacto',
  linkedin: 'https://www.linkedin.com/in/diegotorreslopez',
  /** Con prefijo internacional, solo dígitos (34XXXXXXXXX). Vacío = sin botón flotante. */
  whatsapp: '34622436789',
  sociedad: 'Next Gen Academy SL',
  cif: 'B44861649',
  direccion: 'Carrer Penedès 27, 08184 Palau-solità i Plegamans, Barcelona',
  anio: 2026,
} as const;

/** Antepone el `base` de Astro a una ruta interna. Usar en todos los enlaces internos. */
export function href(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  if (path === '/' || path === '') return `${base}/`;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export const nav = [
  { texto: 'Sectores', ruta: '/sectores/' },
  { texto: 'Servicios', ruta: '/servicios/' },
  { texto: 'Seguridad IA', ruta: '/servicios/seguridad-ia/' },
  { texto: 'Casos de uso', ruta: '/casos-de-uso/' },
  { texto: 'Historias de éxito', ruta: '/historias-de-exito/' },
  { texto: 'Productos', ruta: '/productos/' },
  { texto: 'Sobre nosotros', ruta: '/sobre-nosotros/' },
  { texto: 'Contacto', ruta: '/contacto/' },
] as const;

/** Analítica sin cookies (Umami). Vacío = sin script. */
export const umami = {
  script: 'https://stats.77delta.com/script.js',
  websiteId: '0847eaa4-a0ce-47ee-9acf-8e796160bdd9',
} as const;

/** Verificación de Google Search Console. En cuanto haya token, se pega aquí. */
export const searchConsole = '';

export const cta = { texto: 'Reservar diagnóstico', ruta: '/contacto/' } as const;
