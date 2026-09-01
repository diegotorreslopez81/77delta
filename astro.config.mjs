// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// Hasta comprar el dominio la web vive en GitHub Pages bajo /77delta.
// Con dominio: SITE_URL=https://77delta.com y SITE_BASE=/ (y public/CNAME).
const site = process.env.SITE_URL ?? 'https://diegotorreslopez81.github.io';
const base = process.env.SITE_BASE ?? '/77delta';

export default defineConfig({
  site,
  base,
  trailingSlash: 'always',
  build: { format: 'directory' },
  vite: { plugins: [tailwindcss()] },
});
