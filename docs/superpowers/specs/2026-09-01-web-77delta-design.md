# Web 77 Delta · diseño v1

> Fecha: 2026-09-01. Estado: aprobado por Diego en conversación.

## Qué es

La web de 77 Delta replica el mensaje de infinitelabs.co en español (la versión previa al cambio a inglés, recuperada del historial git de `~/dev/website`) con la identidad visual de 77 Delta. Consultoría de IA para pymes más productos propios. Factura Next Gen Academy SL.

## Fuente de la copy

- Landing: `git -C ~/dev/website show 6e02a2b:index.html`
- Subpáginas y legales: `git -C ~/dev/website show 15066dc:<ruta>/index.html`
- Extracto en texto plano en el scratchpad de la sesión (`copy-es/*.txt`).

## Adaptaciones obligatorias sobre la copy

| Antes | Ahora |
|---|---|
| Infinite Labs (marca) | 77 Delta |
| Infinite Labs OÜ, Tallinn, «oficinas en Barcelona y Tallinn» | Next Gen Academy SL · CIF B44861649 · Barcelona |
| hello@infinitelabs.co, LinkedIn de empresa | Email y LinkedIn en `src/lib/site.ts` (una sola fuente) |
| Sección blog | Eliminada |
| Enlaces a `/casos-de-uso/` y `/cupons/` | Sectores enlazan a su página; Cupó IA enlaza a contacto |
| «Sobre nosotros» narrativa IL | Misma estructura; añade el párrafo del nombre y la Δ (ver CLAUDE.md) |
| Equipo: Diego e Irene | Solo Diego en v1 (pendiente confirmar Irene) |
| Canto enlaza a canto.infinitelabs.co | Enlaza al VS Code Marketplace |

Reglas de marca: nunca explicar el 77, nunca añadir palabra de categoría al nombre, nunca «Infinite Labs», un solo acento (oro `#A7781B`), oro plano, sin serif, mucho vacío.

## Sitemap v1 (19 páginas)

```
/                         Inicio: hero, problema, cómo trabajamos, sectores, historias (5), seis razones, sobre, CTA, confianza
/servicios/               Diagnóstico, Transformación operativa, Partner tecnológico, recorrido, FAQ
/sectores/                Índice de 6 sectores
/sectores/<slug>/         clinicas · industria · distribucion · despachos · administracion · formacion
/historias-de-exito/      Índice de casos
/historias-de-exito/<slug>/  clinicas-dentales-barcelona · distribuidora-industrial · despacho-mercantil
/productos/               7 productos con estado, enlace externo cuando hay web
/sobre-nosotros/          Historia, nota del fundador, misión/visión/valores, acreditación ACCIÓ, equipo
/contacto/                Formulario (mailto), calendario, email, LinkedIn
/aviso-legal/  /politica-privacidad/  /politica-cookies/
```

Fuera de v1: casos de uso (7 familias), fichas de producto, cupons, blog, catalán.

## Identidad visual

Tokens en `src/styles/global.css` con `@theme` de Tailwind v4:

- Colores: tinta `#060B14`, tinta-honda `#03060D`, oro `#A7781B`, marfil `#EDEAE3`, pizarra `#8794A6`, linea `#15202E`.
- Tipografías (Google Fonts): Sora (display y monograma), IBM Plex Sans (texto), IBM Plex Mono (eyebrows y datos, mayúsculas, `letter-spacing: .18em`).
- Monograma `77Δ` en Sora 700, `letter-spacing: -0.055em`, Δ en oro. Δ suelta como favicon (SVG).
- Hero en Sora 200, titulares grandes, una idea por pantalla. Secciones aparecen al hacer scroll (IntersectionObserver, sin librerías) y los números de los casos cuentan al entrar. `prefers-reduced-motion` desactiva todo.

## Stack y estructura

- Astro 5, Tailwind v4 (`@tailwindcss/vite`), TypeScript strict, pnpm, Biome.
- Contenido en colecciones (`src/content.config.ts`, loader `glob`): `sectores`, `historias`, `productos`, `casos` (los 5 del carrusel).
- `src/lib/site.ts`: nombre, email, LinkedIn, calendario, sociedad, CIF, dirección y helper `href()` que antepone `import.meta.env.BASE_URL`.
- Layout único `src/layouts/Base.astro`: head con SEO y OG, nav, footer corporativo con Next Gen Academy SL.
- Componentes: `Nav`, `Footer`, `Monograma`, `Eyebrow`, `Boton`, `Seccion`, `Cta`, `Confianza` (logos), `Reveal` (scroll).
- Assets reutilizados de `~/dev/website`: `img/diego-profile.png`, `img/logos/*` (instituciones y partners), `img/products/*`.

## Deploy

- GitHub Pages desde `diegotorreslopez81/77delta` (público) con `withastro/action`.
- Hasta comprar el dominio: `site: https://diegotorreslopez81.github.io`, `base: /77delta`.
- Con dominio: fichero `public/CNAME` con `77delta.com`, `site` y `base: /`. Ambos valores salen de variables de entorno en el workflow.

## Pruebas

- `pnpm build` sin errores y sin enlaces rotos (script de comprobación de `href` internos contra `dist/`).
- Revisión visual con capturas de inicio, servicios, un sector, una historia, productos, sobre, contacto en escritorio y móvil.
- Contraste marfil sobre tinta y oro sobre tinta según CLAUDE.md.

## Pendientes que decide Diego

- Email de contacto y LinkedIn definitivos.
- Irene en el equipo o no.
- Compra del dominio, tras TMview.
