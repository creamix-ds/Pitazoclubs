// Configuración de Pitazo Club.
//
// API_URL: la URL /exec del Apps Script de Pitazo Club (NO la de Pitazo Final).
//   Mientras esté vacía, el sitio funciona en modo DEMO: usa data/demo-pirovano.json
//   y guarda los cambios solo en este navegador.
//
// PITAZO_API: la API pública de Pitazo Final. De ahí se leen fixture, resultados,
//   tabla, goleadores y noticias de la liga. Pitazo Club nunca escribe en Pitazo Final.
window.CONFIG = {
  API_URL: '',

  PITAZO_API: 'https://script.google.com/macros/s/AKfycbwnQBffCUCtToLGMtJupEoCZcxLfyj_gW059hGNc5oJ6ZcPi8-__mtDr9NZyNvuj8RN/exec',
  PITAZO_WEB: 'https://creamix-ds.github.io/ligasdefutbol/',

  // ID de cliente OAuth de Google para el panel (#/panel). Puede ser el mismo de Pitazo
  // Final o uno nuevo; el mismo valor va en backend/base.gs.
  GOOGLE_CLIENT_ID: '',

  // Club que se abre si la dirección no dice ?c=... (en modo demo siempre es Pirovano).
  CLUB: 'pirovano'
};
