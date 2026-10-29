// Configuración de Pitazo Clubs.
//
// API_URL: la URL /exec del Apps Script de Pitazo Clubs (NO la de Pitazo Final).
//   Mientras esté vacía, el sitio funciona en modo DEMO: usa data/demo-pirovano.json
//   y guarda los cambios solo en este navegador.
//
// PITAZO_API: la API pública de Pitazo Final. De ahí se leen fixture, resultados,
//   tabla, goleadores y noticias de la liga. Pitazo Clubs nunca escribe en Pitazo Final.
window.CONFIG = {
  API_URL: '',

  PITAZO_API: 'https://script.google.com/macros/s/AKfycbwnQBffCUCtToLGMtJupEoCZcxLfyj_gW059hGNc5oJ6ZcPi8-__mtDr9NZyNvuj8RN/exec',
  PITAZO_WEB: 'https://creamix-ds.github.io/ligasdefutbol/',

  // ID de cliente OAuth de Google para el panel (#/panel). Puede ser el mismo de Pitazo
  // Final o uno nuevo; el mismo valor va en backend/base.gs.
  GOOGLE_CLIENT_ID: '513742201235-79a1b7tnk46vt8db28e8t54rqbqhrk3p.apps.googleusercontent.com',

  // Cada club tiene su carpeta: pitazoclubs.com/pirovano/ (o .../Pitazoclubs/pirovano/ en GitHub).
  // CLUB: club que se abre en la raíz. Vacío = la raíz muestra la portada de Pitazo Clubs.
  CLUB: '',

  // Portada de Pitazo Clubs (en modo conectado la lista sale de la pestaña Clubes).
  CLUBES: [
    { slug: 'pirovano', nombre: 'Club Deportivo Pirovano', ciudad: 'Pirovano, partido de Bolívar', escudo: 'https://lh3.googleusercontent.com/d/1oMxLbfoEdBNMqrP8tEZHbgXsFIoHBwcP', color1: '#D7261E' }
  ],
  // WhatsApp para "Quiero la web de mi club" (con característica, sin 0 ni 15). Vacío = no se muestra.
  WHATSAPP_VENTAS: ''
};
