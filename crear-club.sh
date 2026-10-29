#!/bin/sh
# Crea la carpeta de un club: ./crear-club.sh pirovano  →  pirovano/index.html
# (es el index de la raíz con las rutas apuntando a ../). Volver a correrlo cuando cambie index.html.
set -e
[ -n "$1" ] || { echo "Uso: ./crear-club.sh <slug>"; exit 1; }
mkdir -p "$1"
sed -E 's#(href|src)="(css|js|img)/#\1="../\2/#g' index.html > "$1/index.html"
echo "Listo: $1/index.html"
