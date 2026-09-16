#!/bin/sh
# Copia brand/tokens.css a public/hq/app/tokens.css (GitHub Pages solo sirve public/). Ejecutar cuando cambien los tokens.
set -e; cd "$(dirname "$0")/../.."
{ echo "/* GENERADO por scripts/hq/sincronizar-tokens.sh desde brand/tokens.css: no editar aquí */"; cat brand/tokens.css; } > public/hq/app/tokens.css
echo "tokens: $(wc -c < public/hq/app/tokens.css) bytes"
