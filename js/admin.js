/* Pitazo Clubs — panel de la portada (raíz del sitio, #/admin).
 * Textos, colores y logo de la portada, y los clubes: editarlos, pausarlos o crear uno nuevo
 * (crea su planilla y su web en .../<slug>/ sin tocar el código).
 * Entra el dueño de la planilla central de Pitazo Clubs o un email de la lista "Quién más entra".
 */
window.PC = window.PC || {};
(function () {
  'use strict';
  const { u, DB } = PC;
  const e = u.esc, M = window.MOTOR, CFG = window.CONFIG;
  const main = () => document.getElementById('contenido');
  let DATOS = null;

  // Las 4 paletas del diseño (la 4 es la elegida y la que viene por defecto).
  const PALETAS = [
    { nombre: 'Naranja silbato', color1: '#18181B', color_boton: '#F05A1A', color_boton_texto: '#18181B', color_fondo: '#FAFAF7' },
    { nombre: 'Rojo pitazo', color1: '#D7261E', color_boton: '#FFFFFF', color_boton_texto: '#B51E17', color_fondo: '#F6F4F1' },
    { nombre: 'Cancha de noche', color1: '#0E3B2E', color_boton: '#C6F432', color_boton_texto: '#0B1F18', color_fondo: '#F1F4EE' },
    { nombre: 'Árbitro', color1: '#14213D', color_boton: '#FFC300', color_boton_texto: '#14213D', color_fondo: '#F4F5F8' }
  ];
  const COLORES = [['color1', 'Principal (portada)'], ['color_boton', 'Botón'], ['color_boton_texto', 'Texto del botón'], ['color_fondo', 'Fondo de la página']];

  function dialogo(titulo, html) {
    const d = document.getElementById('dialogo');
    d.innerHTML = `<div class="dialogo__cab"><h3>${titulo}</h3><button class="dialogo__cerrar" aria-label="Cerrar" data-cerrar>✕</button></div><div class="dialogo__cuerpo">${html}</div>`;
    d.querySelector('[data-cerrar]').onclick = () => d.close();
    if (!d.open) d.showModal();
    return d;
  }
  const cerrar = () => { const d = document.getElementById('dialogo'); if (d.open) d.close(); };

  async function ver() {
    if (!DB.adminActivo()) return login();
    if (!DATOS) {
      main().innerHTML = '<div class="login"><div class="tarjeta"><p class="cargando">Cargando…</p></div></div>';
      try { DATOS = await DB.adminDatos(); } catch (err) { DB.adminSalir(); return login(err.message); }
    }
    pintar();
  }

  function login(msj) {
    main().innerHTML = `<div class="login"><div class="tarjeta">
      ${PC.escudo(PC.RAIZ + 'img/icono.svg', 'Pitazo Clubs', 'escudo--partido')}
      <h2 style="margin:12px 0 4px">Panel de Pitazo Clubs</h2>
      <p class="chico">Portada, colores, logo y clubes.</p>
      <div id="login-zona" style="margin:18px 0 6px;display:grid;justify-items:center;gap:10px"></div>
      ${msj ? `<div class="error">${e(msj)}</div>` : ''}
      <p class="chico" style="margin:12px 0 0"><a href="#/">← Volver a la portada</a></p></div></div>`;
    const zona = document.getElementById('login-zona');
    if (DB.demo) {
      zona.innerHTML = '<button class="boton" id="entrar-demo">Entrar a la demo</button>';
      document.getElementById('entrar-demo').onclick = async () => { await DB.adminIngresar(); DATOS = null; ver(); };
      return;
    }
    const arrancar = () => {
      google.accounts.id.initialize({
        client_id: CFG.GOOGLE_CLIENT_ID,
        callback: async r => {
          zona.innerHTML = '<p class="cargando">Verificando…</p>';
          try { await DB.adminIngresar(r.credential); DATOS = null; ver(); } catch (err) { login(err.message); }
        }
      });
      google.accounts.id.renderButton(zona, { theme: 'outline', size: 'large', text: 'signin_with', locale: 'es' });
    };
    if (window.google && google.accounts) arrancar();
    else { const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.onload = arrancar; document.head.appendChild(s); }
  }

  const campo = (c, k, n, extra) => `<label class="campo"><span>${n}</span><input name="${k}" value="${e(c[k])}" ${extra || ''}></label>`;
  const area = (c, k, n, alto, ayuda) => `<label class="campo"><span>${n}</span><textarea name="${k}" style="min-height:${alto}px">${e(c[k])}</textarea>${ayuda ? `<small>${ayuda}</small>` : ''}</label>`;

  function pintar() {
    const c = DATOS.config;
    main().innerHTML = `<div class="contenedor" style="padding:26px 0 90px;max-width:1100px">
      <div class="panel__titulo"><h1>Panel de Pitazo Clubs</h1>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><span class="chico">${e(DATOS.usuario.email)}</span>
          <a class="boton boton--gris boton--chico" href="#/" target="_blank" rel="noopener">Ver portada ↗</a><button class="boton boton--gris boton--chico" id="salir">Salir</button></div></div>
      <form id="f-portal" class="grilla-2" style="align-items:start">
        <div class="tarjeta form"><h3>Colores</h3>
          <div class="paletas">${PALETAS.map((p, i) => `<button type="button" class="paleta" data-paleta="${i}" aria-label="Paleta ${e(p.nombre)}"><span class="paleta__muestra"><i style="background:${p.color1}"></i><i style="background:${p.color_boton}"></i><i style="background:${p.color_fondo}"></i></span>${e(p.nombre)}</button>`).join('')}</div>
          <div class="form__fila">${COLORES.slice(0, 2).map(([k, n]) => `<label class="campo"><span>${n}</span><span class="color-fila"><input type="color" name="${k}" value="${e(c[k])}"></span></label>`).join('')}</div>
          <div class="form__fila">${COLORES.slice(2).map(([k, n]) => `<label class="campo"><span>${n}</span><span class="color-fila"><input type="color" name="${k}" value="${e(c[k])}"></span></label>`).join('')}</div>
          <div id="muestra" class="muestra-portal"></div>
        </div>
        <div class="tarjeta form"><h3>Marca y textos</h3>
          ${campo(c, 'nombre', 'Nombre')}
          ${campo(c, 'logo', 'Logo <small>(link de la imagen; uno de Drive se convierte solo · vacío = el logo de Pitazo Clubs)</small>', 'placeholder="https://drive.google.com/file/d/..."')}
          ${campo(c, 'kicker', 'Texto chico de arriba')}
          ${area(c, 'titulo', 'Título grande', 70, 'Cada renglón es una línea del título.')}
          ${area(c, 'subtitulo', 'Bajada', 70)}
        </div>
        <div class="tarjeta form"><h3>Qué incluye</h3>
          ${area(c, 'rasgos', 'Una tarjeta por renglón', 220, 'Formato: <b>Título: descripción</b>.')}
        </div>
        <div class="tarjeta form"><h3>Contacto y acceso</h3>
          ${campo(c, 'whatsapp', 'WhatsApp para "Quiero la web de mi club" <small>(con característica, sin 0 ni 15)</small>', 'inputmode="tel"')}
          <div class="form__fila">${campo(c, 'instagram', 'Instagram', 'placeholder="@creamixds"')}${campo(c, 'email', 'Email', 'type="email"')}</div>
          ${campo(c, 'admins', 'Quién más entra a este panel <small>(emails de Google, separados por coma)</small>')}
          <p class="chico" style="margin:0">El dueño de la planilla central siempre puede entrar.</p>
        </div>
        <div style="grid-column:1/-1;position:sticky;bottom:12px;z-index:5"><button class="boton" type="submit" style="box-shadow:0 6px 20px rgba(0,0,0,.2)">Guardar portada</button></div>
      </form>
      <div class="tarjeta" style="margin-top:22px">
        <div class="seccion__titulo" style="margin-bottom:8px"><h3>Clubes</h3><button class="boton boton--chico" id="nuevo-club">+ Nuevo club</button></div>
        ${DATOS.clubes.map(x => `<div class="fila-accion"><span style="display:flex;gap:12px;align-items:center">${PC.escudo(M.url(x.escudo, true), x.nombre, 'escudo--chico')}<span><b>${e(x.nombre)}</b> <span class="chico">/${e(x.slug)}/${x.ciudad ? ' · ' + e(x.ciudad) : ''}</span></span></span>
          <span style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;align-items:center">${x.activo === 'NO' ? '<span class="estado estado--gris">Pausado</span>' : ''}
            <a class="boton boton--gris boton--chico" href="${e(PC.RAIZ + x.slug + '/')}" target="_blank" rel="noopener">Web ↗</a>
            ${/^[\w-]{20,}$/.test(x.planilla_id) ? `<a class="boton boton--gris boton--chico" href="https://docs.google.com/spreadsheets/d/${e(x.planilla_id)}/edit" target="_blank" rel="noopener">Planilla ↗</a>` : ''}
            <button class="boton boton--suave boton--chico" data-club="${e(x.slug)}">Editar</button></span></div>`).join('') || '<p class="chico">Todavía no hay clubes.</p>'}
        <p class="chico" style="margin:10px 0 0">Al crear un club se arma su planilla y su web queda en <b>${e(PC.RAIZ)}&lt;dirección&gt;/</b>. Lo demás (socios, cuotas, colores del club) se maneja desde el panel de cada club.</p>
      </div></div>`;
    document.getElementById('salir').onclick = () => { DB.adminSalir(); DATOS = null; login(); };
    const f = document.getElementById('f-portal');
    const muestra = () => {
      const v = Object.fromEntries(new FormData(f).entries());
      const logo = v.logo ? M.url(v.logo, true) : PC.RAIZ + 'img/icono.svg';
      document.getElementById('muestra').innerHTML = `<div style="background:${e(v.color1)};color:${claro(v.color1) ? '#1A1A1A' : '#fff'};border-radius:10px 10px 0 0;padding:16px 18px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">${PC.escudo(logo, v.nombre, 'escudo--chico')}<b>${e(v.nombre)}</b></div>
          <div style="font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;opacity:.8">${e(v.kicker)}</div>
          <div style="font-weight:900;font-size:1.25rem;line-height:1.1;margin:4px 0 10px">${e(v.titulo).replace(/\n/g, '<br>')}</div>
          <span style="display:inline-block;background:${e(v.color_boton)};color:${e(v.color_boton_texto)};font-weight:800;padding:8px 14px;border-radius:8px;font-size:.9rem">Quiero la web de mi club</span></div>
        <div style="background:${e(v.color_fondo)};padding:12px 18px;border-radius:0 0 10px 10px"><div style="background:#fff;border-radius:8px;padding:10px 12px;border-top:4px solid ${e(v.color_boton)}"><b style="font-size:.9rem">Carnet digital</b></div></div>`;
    };
    f.oninput = muestra; muestra();
    f.querySelectorAll('[data-paleta]').forEach(b => b.onclick = () => { const p = PALETAS[b.dataset.paleta]; COLORES.forEach(([k]) => { f[k].value = p[k]; }); muestra(); });
    f.onsubmit = async ev => {
      ev.preventDefault();
      const btn = f.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Guardando…';
      try { DATOS = await DB.adminGuardar(Object.fromEntries(new FormData(f).entries())); localStorage.removeItem('pc_portal'); u.aviso('Portada guardada. Puede tardar hasta 5 minutos en verse para todos.', 'ok'); pintar(); }
      catch (x) { u.aviso(x.message, 'mal'); btn.disabled = false; btn.textContent = 'Guardar portada'; }
    };
    document.getElementById('nuevo-club').onclick = nuevoClub;
    main().querySelectorAll('[data-club]').forEach(b => b.onclick = () => editarClub(DATOS.clubes.find(x => x.slug === b.dataset.club)));
  }
  const claro = hex => { const m = String(hex || '').match(/^#(..)(..)(..)$/); if (!m) return false; const [R, G, B] = m.slice(1).map(x => parseInt(x, 16)); return (R * 299 + G * 587 + B * 114) / 1000 > 165; };

  function editarClub(x) {
    const d = dialogo('Editar · ' + e(x.nombre), `<form class="form" id="f-club">
      ${campo(x, 'nombre', 'Nombre')}${campo(x, 'ciudad', 'Localidad')}
      ${campo(x, 'escudo', 'Escudo para la portada <small>(link; uno de Drive se convierte solo)</small>')}
      <div class="form__fila"><label class="campo"><span>Color</span><span class="color-fila"><input type="color" name="color1" value="${e(/^#[0-9a-f]{6}$/i.test(x.color1) ? x.color1 : '#D7261E')}"></span></label>
        <label class="campo"><span>En la portada</span><select name="activo"><option value="SI" ${x.activo !== 'NO' ? 'selected' : ''}>Visible</option><option value="NO" ${x.activo === 'NO' ? 'selected' : ''}>Pausado (su web deja de abrir)</option></select></label></div>
      <p class="chico" style="margin:0">Esto es solo lo que muestra la portada. El escudo y los colores de la web del club se cambian en su panel: <a href="${e(PC.RAIZ + x.slug + '/#/panel/club')}" target="_blank" rel="noopener">Ajustes del club ↗</a></p>
      <div id="f-error"></div><button class="boton">Guardar</button></form>`);
    d.querySelector('#f-club').onsubmit = async ev => {
      ev.preventDefault();
      try { DATOS = await DB.adminClub(Object.assign({ slug: x.slug }, Object.fromEntries(new FormData(ev.target).entries()))); localStorage.removeItem('pc_portal'); cerrar(); u.aviso('Club actualizado', 'ok'); pintar(); }
      catch (err) { d.querySelector('#f-error').innerHTML = `<div class="error">${e(err.message)}</div>`; }
    };
  }

  const aSlug = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\b(club|atletico|deportivo|social|y|de|del|la|el)\b/g, ' ').trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  function nuevoClub() {
    const d = dialogo('Nuevo club', `<form class="form" id="f-nuevo">
      <label class="campo"><span>Nombre completo</span><input name="nombre" required placeholder="Club Atlético Ejemplo"></label>
      <label class="campo"><span>Dirección de su web</span><input name="slug" required pattern="[a-z0-9-]+" placeholder="ejemplo"><small id="slug-ver"></small></label>
      <div class="form__fila"><label class="campo"><span>Nombre corto</span><input name="nombre_corto" placeholder="Atlético Ejemplo"></label><label class="campo"><span>Localidad</span><input name="ciudad"></label></div>
      <label class="campo"><span>Escudo <small>(link; uno de Drive se convierte solo)</small></span><input name="escudo"></label>
      <div class="form__fila"><label class="campo"><span>Color principal</span><span class="color-fila"><input type="color" name="color1" value="#D7261E"></span></label>
        <label class="campo"><span>Color secundario</span><span class="color-fila"><input type="color" name="color2" value="#FFFFFF"></span></label></div>
      <div class="form__fila"><label class="campo"><span>Código en Pitazo Final <small>(ej. CL06)</small></span><input name="pitazo_club_id"></label><label class="campo"><span>Liga</span><input name="pitazo_liga_id" value="L01"></label></div>
      <label class="campo"><span>Email de Google del administrador del club</span><input name="admin_email" type="email"><small>Esa cuenta entra al panel del club.</small></label>
      <div id="f-error"></div><button class="boton">Crear club</button></form>`);
    const f = d.querySelector('#f-nuevo'), ver = () => { d.querySelector('#slug-ver').textContent = f.slug.value ? PC.RAIZ + f.slug.value + '/' : ''; };
    let tocado = false;
    f.nombre.oninput = () => { if (!tocado) { f.slug.value = aSlug(f.nombre.value); ver(); } };
    f.slug.oninput = () => { tocado = true; f.slug.value = f.slug.value.toLowerCase().replace(/[^a-z0-9-]/g, ''); ver(); };
    f.onsubmit = async ev => {
      ev.preventDefault();
      const b = f.querySelector('button'); b.disabled = true; b.textContent = 'Creando la planilla…';
      try { DATOS = await DB.adminCrearClub(Object.fromEntries(new FormData(f).entries())); localStorage.removeItem('pc_portal'); cerrar(); u.aviso('Club creado: su web ya está en /' + f.slug.value + '/', 'ok'); pintar(); }
      catch (err) { d.querySelector('#f-error').innerHTML = `<div class="error">${e(err.message)}</div>`; b.disabled = false; b.textContent = 'Crear club'; }
    };
  }

  PC.admin = { ver };
})();
