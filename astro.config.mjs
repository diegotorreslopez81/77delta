// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// Dominio propio (public/CNAME). Para una previsualización bajo otra ruta, exportar SITE_URL y SITE_BASE.
const site = process.env.SITE_URL ?? 'https://77delta.com';
const base = process.env.SITE_BASE ?? '/';

export default defineConfig({
  site,
  base,
  trailingSlash: 'always',
  // La seguridad de IA vivió unas horas en la raíz antes de pasar a ser un servicio más.
  redirects: { '/seguridad-ia': '/servicios/seguridad-ia/' },
  build: { format: 'directory' },
  // Castellano en la raíz (no rompe URLs ya indexadas), catalán bajo /ca/.
  i18n: {
    defaultLocale: 'es',
    locales: ['es', 'ca'],
    routing: { prefixDefaultLocale: false },
  },
  integrations: [
    sitemap({
      i18n: {
        defaultLocale: 'es',
        locales: { es: 'es-ES', ca: 'ca-ES' },
      },
    }),
  ],
  vite: { plugins: [tailwindcss()] },
});
