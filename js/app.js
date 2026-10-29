/* Pitazo Club — arranque y rutas.
 *  #/                 portada        #/futbol[/tabla|llave|goleadores|plantel]
 *  #/noticias         #/noticia/ID   #/club   #/asociate
 *  #/socio[/cuenta|pagos|grupo]      carnet digital del socio
 *  #/panel[/socios|cuotas|pagos|acceso|solicitudes|noticias|club]
 */
window.PC = window.PC || {};
(function () {
  'use strict';
  const { u, DB } = PC;

  // Colores y nombre del club en toda la página.
  PC.aplicarMarca = function () {
    const c = PC.ctx.cfg, r = document.documentElement.style;
    if (/^#[0-9a-f]{6}$/i.test(c.color1 || '')) r.setProperty('--c1', c.color1);
    if (/^#[0-9a-f]{6}$/i.test(c.color2 || '')) r.setProperty('--c2', c.color2);
    // Texto sobre el color principal: blanco salvo que el color sea muy claro.
    const hex = (c.color1 || '#D7261E').replace('#', ''), [R, G, B] = [0, 2, 4].map(i => parseInt(hex.substr(i, 2), 16));
    r.setProperty('--sobre-c1', (R * 299 + G * 587 + B * 114) / 1000 > 165 ? '#1A1A1A' : '#fff');
    document.title = c.nombre_corto || c.nombre || 'Pitazo Club';
    document.querySelector('meta[name=theme-color]').setAttribute('content', c.color1 || '#D7261E');
    document.getElementById('marca-nombre').textContent = c.nombre_corto || c.nombre || 'Pitazo Club';
    document.getElementById('marca-escudo').outerHTML = PC.escudo(c.escudo, c.nombre, 'escudo--chico').replace('class="escudo', 'id="marca-escudo" class="escudo');
    document.getElementById('pie-nombre').textContent = c.nombre || '';
    document.getElementById('pie-ciudad').textContent = c.ciudad || '';
    if (c.pitazo_club_id) document.getElementById('pie-pitazo').href = PC.PZ.urlClub(c.pitazo_club_id);
  };

  async function arrancar() {
    try {
      const pub = await DB.publico();
      PC.ctx = { pub, cfg: pub.config || {}, clubId: (pub.config || {}).pitazo_club_id };
    } catch (err) {
      document.getElementById('contenido').innerHTML = `<section class="seccion contenedor"><div class="error">No se pudo cargar el club: ${u.esc(err.message)}</div></section>`;
      return;
    }
    PC.aplicarMarca();
    if (DB.demo) {
      const b = document.getElementById('demo-barra');
      b.innerHTML = 'Versión de demostración: socios y pagos son de ejemplo; los partidos son los reales de Pitazo Final. <button id="demo-reset">Reiniciar demo</button>';
      b.hidden = false;
      document.getElementById('demo-reset').onclick = () => { DB.reiniciarDemo(); location.hash = '#/'; location.reload(); };
    }
    const boton = document.getElementById('menu-boton'), nav = document.getElementById('nav');
    boton.onclick = () => { const a = nav.classList.toggle('abierto'); boton.setAttribute('aria-expanded', a); };
    window.addEventListener('hashchange', ruta);
    ruta();
  }

  function ruta() {
    const partes = location.hash.replace(/^#\/?/, '').split('?')[0].split('/').map(decodeURIComponent);
    const extra = Object.fromEntries(new URLSearchParams(location.hash.split('?')[1] || ''));
    const [p0, p1] = partes;
    document.getElementById('nav').classList.remove('abierto');
    document.querySelectorAll('#nav a').forEach(a => a.toggleAttribute('aria-current', a.dataset.ruta === (p0 === 'noticia' ? 'noticias' : p0 || '')));
    if (a11y.ultimo !== p0) window.scrollTo(0, 0);
    a11y.ultimo = p0;
    if (p0 !== 'panel') PC.panel.salirVista();
    const S = PC.sitio;
    const r = {
      '': () => S.inicio(), futbol: () => S.futbol(p1), noticias: () => S.noticias(), noticia: () => S.noticia(p1),
      club: () => S.club(), asociate: () => S.asociate(), socio: () => PC.socio.ver(p1), panel: () => PC.panel.ver(p1, extra)
    }[p0 || ''] || (() => S.inicio());
    Promise.resolve(r()).catch(err => { console.error(err); u.aviso(err.message, 'mal'); });
  }
  const a11y = { ultimo: null };

  arrancar();
})();
