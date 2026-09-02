/**
 * Datos de la web en un solo sitio. Todo lo que cambie con el dominio,
 * el email o la sociedad se toca aquí y en ningún otro fichero.
 */
export const site = {
  nombre: '77 Delta',
  claim: 'Aplicamos la IA para ahorrar costes a tu empresa',
  descripcion:
    'Consultora tecnológica especializada en pymes. Diagnóstico gratuito, transformación operativa con IA y partner tecnológico. Barcelona.',
  ciudad: 'Barcelona',
  // Pendiente: activar el buzón cuando se compre el dominio.
  email: 'hola@77delta.com',
  calendario: 'https://calendar.app.google/3nhQL1Fp3EW9YhBj6',
  linkedin: 'https://www.linkedin.com/in/diegotorreslopez',
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
  { texto: 'Servicios', ruta: '/servicios/' },
  { texto: 'Sectores', ruta: '/sectores/' },
  { texto: 'Casos', ruta: '/historias-de-exito/' },
  { texto: 'Productos', ruta: '/productos/' },
] as const;

/** Enlaces que solo van en el menú móvil y en el footer. */
export const navSecundaria = [
  { texto: 'Sobre nosotros', ruta: '/sobre-nosotros/' },
  { texto: 'Contacto', ruta: '/contacto/' },
] as const;

export const cta = { texto: 'Reservar diagnóstico', ruta: '/contacto/' } as const;
