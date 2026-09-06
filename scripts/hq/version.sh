#!/bin/sh
# Sube la versión de HQ (parche) y estampa fecha y hora de publicación en index.html. Ejecutar antes de cada commit de public/hq.
set -e
cd "$(dirname "$0")/../.."
f=public/hq/index.html
v=$(grep -oE "HQ_VERSION = \{ v: '[0-9.]+'" "$f" | grep -oE "[0-9]+\.[0-9]+\.[0-9]+")
mayor=${v%%.*}; resto=${v#*.}; menor=${resto%%.*}; parche=${resto#*.}
nueva="$mayor.$menor.$((parche+1))"
sed -i "s|HQ_VERSION = { v: '[0-9.]*', fecha: '[^']*' }|HQ_VERSION = { v: '$nueva', fecha: '$(date '+%Y-%m-%d %H:%M')' }|" "$f"
echo "HQ v$nueva · $(date '+%Y-%m-%d %H:%M')"
