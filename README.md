# 77Δ

Web de 77 Delta. Astro 7 + Tailwind v4, desplegada en GitHub Pages.

```sh
pnpm install
pnpm dev        # http://localhost:4321/
pnpm build      # genera dist/
node scripts/check-links.mjs   # comprueba enlaces internos de dist/
```

Los datos de la web (email, sociedad, rutas del menú) están en `src/lib/site.ts`.
