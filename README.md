# Pitazo Clubs

Web del club + gestión de socios, vinculada a **Pitazo Final** solo por su API pública (lectura).
Es un sistema aparte: su propio repositorio, su propia planilla y su propio Apps Script.

- **Web pública**: portada con próximo partido y último resultado, fixture, tabla, fase final, goleadores y plantel (de Pitazo Final), noticias, actividades, cuotas y "Asociate".
- **Carnet del socio** (`#/socio`): entra con DNI + código de 4 números. Carnet con QR, cuotas, pago directo al club (alias/CBU o link de Mercado Pago del club) y subida de comprobante.
- **Panel** (`#/panel`): socios, grupo familiar, cuotas mensuales automáticas, pagos (confirmar comprobantes), control de acceso con cámara, solicitudes, noticias con crónica por IA desde Pitazo Final, resumen para la comisión, ajustes.

## Estructura
```
index.html  css/club.css
js/config.js   API_URL (vacío = DEMO), PITAZO_API, GOOGLE_CLIENT_ID
js/motor.js    lógica de socios/cuotas/pagos/acceso (la misma en el navegador y en Apps Script)
js/datos.js    DB (demo en el navegador o Apps Script) + PZ (lectura de Pitazo Final)
js/sitio.js  js/socio.js  js/panel.js  js/app.js
data/demo-pirovano.json   datos de ejemplo del club (socios ficticios)
data/pitazo-L01.json      copia de Pitazo Final por si su API no responde
backend/base.gs           API de Pitazo Clubs
backend/Code.gs           GENERADO = js/motor.js + backend/base.gs (lo que se pega en Apps Script)
```
Regenerar Code.gs después de tocar motor.js o base.gs:
`{ echo "/* ... */"; cat js/motor.js; echo; cat backend/base.gs; } > backend/Code.gs`

## Modo demo
Con `API_URL: ''` todo funciona en el navegador (los cambios quedan en ese navegador).
Socio de prueba: DNI **30111222**, código **1234**. Panel: botón "Entrar a la demo".

## Conectar (modo real)
1. Planilla nueva "Pitazo Clubs" > Extensiones > Apps Script > pegar `backend/Code.gs`.
2. Completar `GOOGLE_CLIENT_ID` en Code.gs y en `js/config.js` (agregar el origen https://creamix-ds.github.io en Google Cloud).
3. Ejecutar `crearPirovano()` una vez (crea la planilla del club y la registra en la pestaña Clubes).
4. Implementar como aplicación web (Ejecutar como: Yo · Acceso: Cualquier persona) y poner la URL en `API_URL`.
5. Opcional: propiedad del script `GEMINI_API_KEY` para crónicas y resumen con IA.

## Direcciones
- Raíz (`creamix-ds.github.io/Pitazoclubs/`, a futuro `pitazoclubs.com/`): portada de Pitazo Clubs con la lista de clubes.
- Cada club: `/<slug>/` (ej. `/pirovano/`), carnet en `/<slug>/#/socio`, panel en `/<slug>/#/panel`.
- La carpeta de cada club tiene solo `index.html` (copia del de la raíz con rutas `../`). Se arma con `./crear-club.sh <slug>`
  o en PowerShell: `New-Item -ItemType Directory <slug> -Force; (Get-Content index.html -Raw) -replace '(href|src)="(css|js|img)/','$1="../$2/' | Set-Content .\<slug>\index.html -Encoding utf8`
  Rehacerla cuando cambie el index.html de la raíz.
- `404.html`: si alguien entra a `/<slug>/` sin carpeta, lo manda a `?c=<slug>` (funciona igual, con otra dirección).

## Club nuevo
1. En Apps Script: `crearClub({slug, nombre, nombre_corto, lema, ciudad, pitazo_club_id, pitazo_liga_id, escudo, color1, color2, admin_email})`.
2. Crear la carpeta `<slug>/index.html` (ver arriba) y subirla.

## Dominio propio (pitazoclubs.com)
1. Comprar el dominio. En el DNS: 4 registros A a 185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153 y un CNAME `www` → `creamix-ds.github.io`.
2. GitHub > Settings > Pages > Custom domain: `pitazoclubs.com` (crea el archivo CNAME) y tildar Enforce HTTPS.
3. Google Cloud: agregar `https://pitazoclubs.com` a los orígenes autorizados del CLIENT_ID.
No hay que cambiar nada del código: las rutas se calculan solas.

Roles del panel (Ajustes > Quién entra al panel): `admin`, `tesorero`, `prensa`, `puerta`.
La plata la cobra el club directo; Pitazo Clubs solo registra los pagos.
