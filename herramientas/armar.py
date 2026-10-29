#!/usr/bin/env python3
"""Arma 404.html (y las carpetas de club opcionales) a partir de index.html.
404.html: GitHub Pages lo muestra para cualquier dirección que no existe, así que
.../Pitazoclubs/<club>/ abre la web de ese club sin crear ninguna carpeta.
Uso: python3 herramientas/armar.py [slug ...]   (los slugs crean <slug>/index.html, opcional)"""
import re, sys, os
os.chdir(os.path.join(os.path.dirname(__file__), '..'))
idx = open('index.html', encoding='utf-8').read()

# 404.html: las rutas css/js/img se arman desde la raíz del sitio (en GitHub: /<repo>/).
locales = re.findall(r'<(?:link[^>]*href|script[^>]*src)="((?:css|js|img)/[^"]+)"', idx)
cab = """<script>
  // Raíz del sitio: /Pitazoclubs/ en GitHub Pages, / en un dominio propio (pitazoclubs.com).
  (function () {
    var p = location.pathname.split('/').filter(Boolean);
    window.PC_RAIZ = /\\.github\\.io$/.test(location.hostname) && p.length ? '/' + p[0] + '/' : '/';
  })();
  document.write('<link rel="icon" href="' + PC_RAIZ + 'img/icono.svg" type="image/svg+xml"><link rel="stylesheet" href="' + PC_RAIZ + '%s">');
</script>""" % [x for x in locales if x.startswith('css/')][0]
s = re.sub(r'\s*<link rel="icon"[^>]*>', '', idx)
s = re.sub(r'<link rel="stylesheet" href="css/[^"]+">', cab, s)
js = [x for x in locales if x.startswith('js/')]
s = re.sub(r'(\s*<script src="js/[^"]+"></script>)+', '\n  <script>\n' + ''.join("    document.write('<script src=\"' + PC_RAIZ + '%s\"><\\/script>');\n" % x for x in js) + '  </script>', s)
s = s.replace('<title>Pitazo Clubs</title>', '<title>Pitazo Clubs</title>\n  <meta name="robots" content="noindex">')
open('404.html', 'w', encoding='utf-8').write(s)
print('404.html listo')

for slug in sys.argv[1:]:
    os.makedirs(slug, exist_ok=True)
    open(slug + '/index.html', 'w', encoding='utf-8').write(re.sub(r'(href|src)="(css|js|img)/', r'\1="../\2/', idx))
    print(slug + '/index.html listo')
