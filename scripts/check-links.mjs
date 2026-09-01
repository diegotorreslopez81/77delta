// Comprueba que todos los enlaces y recursos internos de dist/ existen.
// Uso: node scripts/check-links.mjs [base]   (base por defecto: /)
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const dist = resolve(process.env.DIST ?? 'dist');
const base = (process.argv[2] ?? process.env.SITE_BASE ?? '/').replace(/\/$/, '');

function* html(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) yield* html(p);
    else if (p.endsWith('.html')) yield p;
  }
}

const rotos = [];
let total = 0;
for (const fichero of html(dist)) {
  const src = readFileSync(fichero, 'utf8');
  for (const m of src.matchAll(/\b(?:href|src)="([^"#?]+)(?:[#?][^"]*)?"/g)) {
    const url = m[1];
    if (/^(https?:|mailto:|tel:|data:|\/\/)/.test(url)) continue;
    total++;
    if (!url.startsWith(base + '/') && url !== base) {
      rotos.push(`${fichero}: enlace sin base -> ${url}`);
      continue;
    }
    const rel = url.slice(base.length);
    const candidatos = rel.endsWith('/') ? [join(dist, rel, 'index.html')] : [join(dist, rel), join(dist, rel, 'index.html')];
    if (!candidatos.some((c) => existsSync(c))) rotos.push(`${fichero}: no existe -> ${url}`);
  }
}

if (rotos.length) {
  console.error(`✗ ${rotos.length} enlaces rotos de ${total}:\n` + rotos.map((r) => '  ' + r.replace(dist + '/', '')).join('\n'));
  process.exit(1);
}
console.log(`✓ ${total} enlaces internos correctos (base ${base})`);
