/* Pitazo Clubs — arranque y rutas.
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
    document.title = c.nombre_corto || c.nombre || 'Pitazo Clubs';
    document.querySelector('meta[name=theme-color]').setAttribute('content', c.color1 || '#D7261E');
    document.getElementById('marca-nombre').textContent = c.nombre_corto || c.nombre || 'Pitazo Clubs';
    document.getElementById('marca-escudo').outerHTML = PC.escudo(c.escudo, c.nombre, 'escudo--chico').replace('class="escudo', 'id="marca-escudo" class="escudo');
    document.getElementById('pie-nombre').textContent = c.nombre || '';
    document.getElementById('pie-ciudad').textContent = c.ciudad || '';
    if (c.pitazo_club_id) document.getElementById('pie-pitazo').href = PC.PZ.urlClub(c.pitazo_club_id);
  };

  // Portada de Pitazo Clubs (pitazoclubs.com/): qué es y la lista de clubes.
  async function portada() {
    const e = u.esc, CFG = window.CONFIG;
    document.body.classList.add('en-portada'); document.title = 'Pitazo Clubs';
    document.getElementById('nav').style.display = 'none'; document.getElementById('menu-boton').style.display = 'none';
    document.getElementById('marca-nombre').textContent = 'Pitazo Clubs';
    document.getElementById('marca-escudo').outerHTML = PC.escudo(PC.RAIZ + 'img/icono.svg', 'Pitazo Clubs', 'escudo--chico').replace('class="escudo', 'id="marca-escudo" class="escudo');
    document.getElementById('pie-nombre').textContent = 'Pitazo Clubs';
    document.getElementById('pie-ciudad').textContent = 'La web y la gestión de socios de tu club.';
    document.querySelector('.pie__links').innerHTML = `<a href="${e(CFG.PITAZO_WEB)}" target="_blank" rel="noopener">Pitazo Final</a>`;
    const clubes = await DB.clubes();
    const wa = CFG.WHATSAPP_VENTAS ? u.wa(CFG.WHATSAPP_VENTAS, 'Hola! Quiero la web y la gestión de socios para mi club.') : '';
    const rasgos = [
      ['Web del club', 'Noticias, actividades, cuota social y formulario para asociarse. Con los colores y el escudo del club.'],
      ['Resultados solos', 'Fixture, tabla, fase final y goleadores salen de Pitazo Final: no se carga nada dos veces.'],
      ['Carnet digital', 'Cada socio tiene su carnet con QR en el celular y ve si está al día.'],
      ['Cuotas sin vueltas', 'Se generan solas cada mes. El socio paga directo al club y sube el comprobante.'],
      ['Control de acceso', 'En la puerta se escanea el QR con el celular: verde pasa, rojo debe.'],
      ['Con inteligencia artificial', 'La crónica del partido y el resumen para la comisión, escritos con los datos reales.']
    ];
    document.getElementById('contenido').innerHTML = `
      <section class="hero"><div class="contenedor hero__grilla" style="grid-template-columns:1fr">
        <div><div class="hero__kicker">De la familia de Pitazo Final</div>
          <h1>La web y los socios<br>de tu club, en un solo lugar</h1>
          <p class="hero__sub" style="max-width:60ch">Página propia, carnet digital, cuotas, control de acceso y resultados de la liga actualizados solos.</p>
          <div class="hero__acciones">${wa ? `<a class="boton boton--blanco" href="${e(wa)}" target="_blank" rel="noopener">Quiero la web de mi club</a>` : ''}${clubes[0] ? `<a class="boton boton--borde" href="${e(PC.RAIZ + clubes[0].slug + '/')}">Ver un ejemplo</a>` : ''}</div></div>
      </div></section>
      <section class="seccion contenedor"><div class="seccion__titulo"><h2>Clubes</h2></div>
        <div class="grilla-3">${clubes.map(c => `<a class="tarjeta" href="${e(PC.RAIZ + c.slug + '/')}" style="display:flex;gap:14px;align-items:center;text-decoration:none;color:inherit;border-top:5px solid ${/^#[0-9a-f]{6}$/i.test(c.color1 || '') ? c.color1 : 'var(--c1)'}">
          ${PC.escudo(c.escudo, c.nombre, 'escudo--partido')}<div><h3>${e(c.nombre)}</h3><span class="chico">${e(c.ciudad || '')}</span></div></a>`).join('') || '<p class="vacio">Pronto.</p>'}</div>
      </section>
      <section class="seccion contenedor" style="padding-top:0"><div class="seccion__titulo"><h2>Qué incluye</h2></div>
        <div class="grilla-3">${rasgos.map(([t, d]) => `<div class="tarjeta actividad"><h3>${t}</h3><p class="chico" style="margin:6px 0 0">${d}</p></div>`).join('')}</div>
      </section>`;
  }

  async function arrancar() {
    if (!PC.SLUG) return portada();
    try {
      const pub = await DB.publico();
      PC.ctx = { pub, cfg: pub.config || {}, clubId: (pub.config || {}).pitazo_club_id };
    } catch (err) {
      document.getElementById('contenido').innerHTML = `<section class="seccion contenedor"><div class="error">No se pudo cargar el club: ${u.esc(err.message)}</div><p style="margin-top:12px"><a href="${u.esc(PC.RAIZ)}">Ver todos los clubes</a></p></section>`;
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
