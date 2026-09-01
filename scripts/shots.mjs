// Capturas de página completa en escritorio y móvil.
// Uso: OUT=carpeta node scripts/shots.mjs http://127.0.0.1:4321/77delta / /servicios/ ...
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const exe = process.env.CHROME ?? `${process.env.HOME}/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`;
const base = (process.argv[2] ?? 'http://127.0.0.1:4321/77delta').replace(/\/$/, '');
const rutas = process.argv.length > 3 ? process.argv.slice(3) : ['/'];
const out = process.env.OUT ?? 'shots';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
for (const [nombre, width] of [
  ['escritorio', 1440],
  ['movil', 390],
]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  for (const r of rutas) {
    await page.goto(base + r, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    // Recorre la página para que carguen las imágenes lazy antes de la captura completa.
    await page.evaluate(async () => {
      const paso = 600;
      for (let y = 0; y < document.body.scrollHeight; y += paso) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 40));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForLoadState('networkidle');
    const slug = r === '/' ? 'inicio' : r.replace(/^\/|\/$/g, '').replace(/\//g, '-');
    const path = `${out}/${slug}-${nombre}.png`;
    await page.screenshot({ path, fullPage: true });
    console.log(path);
  }
  await ctx.close();
}
await browser.close();
