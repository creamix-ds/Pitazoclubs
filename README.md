# Pitazo Club

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
backend/base.gs           API de Pitazo Club
backend/Code.gs           GENERADO = js/motor.js + backend/base.gs (lo que se pega en Apps Script)
```
Regenerar Code.gs después de tocar motor.js o base.gs:
`{ echo "/* ... */"; cat js/motor.js; echo; cat backend/base.gs; } > backend/Code.gs`

## Modo demo
Con `API_URL: ''` todo funciona en el navegador (los cambios quedan en ese navegador).
Socio de prueba: DNI **30111222**, código **1234**. Panel: botón "Entrar a la demo".

## Conectar (modo real)
1. Planilla nueva "Pitazo Club" > Extensiones > Apps Script > pegar `backend/Code.gs`.
2. Completar `GOOGLE_CLIENT_ID` en Code.gs y en `js/config.js` (agregar el origen https://creamix-ds.github.io en Google Cloud).
3. Ejecutar `crearPirovano()` una vez (crea la planilla del club y la registra en la pestaña Clubes).
4. Implementar como aplicación web (Ejecutar como: Yo · Acceso: Cualquier persona) y poner la URL en `API_URL`.
5. Opcional: propiedad del script `GEMINI_API_KEY` para crónicas y resumen con IA.

Cada club nuevo: `crearClub({slug, nombre, pitazo_club_id, pitazo_liga_id, escudo, color1, color2, admin_email})` y su web queda en `.../pitazoclub/?c=<slug>`.

Roles del panel (Ajustes > Quién entra al panel): `admin`, `tesorero`, `prensa`, `puerta`.
La plata la cobra el club directo; Pitazo Club solo registra los pagos.
