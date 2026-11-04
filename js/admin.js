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
      <img src="${PC.RAIZ}img/logo.svg" alt="Pitazo Clubs" height="46" style="display:block;margin:0 auto">
      <h2 style="margin:14px 0 4px">Panel</h2>
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
      ${tarjetaPedidos()}
      <div class="tarjeta" style="margin-top:22px">
        <div class="seccion__titulo" style="margin-bottom:8px"><h3>Clubes</h3><button class="boton boton--chico" id="nuevo-club">+ Nuevo club</button></div>
        ${DATOS.clubes.map(x => `<div class="fila-accion"><span style="display:flex;gap:12px;align-items:center">${PC.escudo(M.url(x.escudo, true), x.nombre, 'escudo--chico')}<span><b>${e(x.nombre)}</b> <span class="chico">/${e(x.slug)}/${x.ciudad ? ' · ' + e(x.ciudad) : ''}</span></span></span>
          <span style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;align-items:center">${x.activo === 'NO' ? '<span class="estado estado--mal">Pausado</span>' : ''}
            <button class="boton boton--chico ${x.activo === 'NO' ? '' : 'boton--gris'}" data-pausa="${e(x.slug)}">${x.activo === 'NO' ? 'Reactivar' : 'Pausar'}</button>
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
    document.getElementById('nuevo-club').onclick = () => nuevoClub();
    main().querySelectorAll('[data-club]').forEach(b => b.onclick = () => editarClub(DATOS.clubes.find(x => x.slug === b.dataset.club)));
    main().querySelectorAll('[data-pausa]').forEach(b => b.onclick = () => pausar(DATOS.clubes.find(x => x.slug === b.dataset.pausa)));
    main().querySelectorAll('[data-pedido]').forEach(b => b.onclick = () => {
      const p = (DATOS.pedidos || []).find(x => x.id === b.dataset.pedido);
      if (b.dataset.accion === 'aprobar') nuevoClub(p); else rechazar(p);
    });
    const hist = document.getElementById('ver-resueltos'); if (hist) hist.onclick = () => { document.getElementById('resueltos').hidden = false; hist.remove(); };
  }

  // ---------- pedidos de web (formulario de la portada) ----------
  function tarjetaPedidos() {
    const l = DATOS.pedidos || [], pend = l.filter(p => p.estado === 'pendiente'), res = l.filter(p => p.estado !== 'pendiente');
    if (!l.length) return '';
    const vinculo = p => p.pitazo_club_id ? ` · Pitazo Final ${e(p.pitazo_club_id)}${p.pitazo_liga_id ? '/' + e(p.pitazo_liga_id) : ''}` : '';
    const fila = p => `<div class="pedido${p.estado === 'pendiente' ? '' : ' pedido--resuelto'}">
        <div class="pedido__club">${PC.escudo(M.url(p.escudo, true), p.nombre, 'escudo--chico')}<div><b>${e(p.nombre)}</b> <span class="chico">${e(p.ciudad)}${vinculo(p)}</span>
          <div class="chico">Pidió ${e(p.contacto_nombre)}${p.contacto_cargo ? ' (' + e(p.contacto_cargo) + ')' : ''} · ${e(p.fecha)}${p.slug ? ' · quiere /' + e(p.slug) + '/' : ''}</div>
          <div class="chico">${p.contacto_whatsapp ? `<a href="${e(u.wa(p.contacto_whatsapp, 'Hola ' + (p.contacto_nombre || '') + '! Te escribo de Pitazo Clubs por la web de ' + p.nombre + '.'))}" target="_blank" rel="noopener">WhatsApp ${e(p.contacto_whatsapp)}</a> · ` : ''}Administrador: ${e(p.admin_email)}</div>
          ${p.mensaje ? `<p class="pedido__msj">${e(p.mensaje)}</p>` : ''}
          ${p.estado === 'rechazado' && p.motivo ? `<div class="chico">Motivo: ${e(p.motivo)}</div>` : ''}</div></div>
        <div class="pedido__acciones">${p.estado === 'pendiente'
          ? `<button class="boton boton--chico" data-pedido="${e(p.id)}" data-accion="aprobar">Revisar y crear</button><button class="boton boton--gris boton--chico" data-pedido="${e(p.id)}" data-accion="rechazar">Rechazar</button>`
          : `<span class="estado ${p.estado === 'aprobado' ? 'estado--ok' : 'estado--gris'}">${p.estado === 'aprobado' ? 'Aprobado' : 'Rechazado'}</span>${p.club_slug ? `<a class="boton boton--gris boton--chico" href="${e(PC.RAIZ + p.club_slug + '/')}" target="_blank" rel="noopener">Web ↗</a>` : ''}`}</div></div>`;
    return `<div class="tarjeta" style="margin-top:22px">
      <div class="seccion__titulo" style="margin-bottom:8px"><h3>Pedidos de web ${pend.length ? `<span class="contador">${pend.length}</span>` : ''}</h3></div>
      ${pend.map(fila).join('') || '<p class="chico" style="margin:0">No hay pedidos pendientes.</p>'}
      ${res.length ? `<button class="boton boton--gris boton--chico" id="ver-resueltos" style="margin-top:10px">Ver resueltos (${res.length})</button><div id="resueltos" hidden>${res.map(fila).join('')}</div>` : ''}
      <p class="chico" style="margin:10px 0 0">Llegan desde "Quiero la web de mi club" en la portada. Al aprobar se crea el club con esos datos (los podés corregir antes).</p></div>`;
  }
  function rechazar(p) {
    const d = dialogo('Rechazar pedido · ' + e(p.nombre), `<form class="form" id="f-rech">
      <label class="campo"><span>Motivo <small>(solo lo ves vos)</small></span><textarea name="motivo" style="min-height:80px" placeholder="Ej.: no respondió, club duplicado…"></textarea></label>
      <div id="f-error"></div><button class="boton">Rechazar pedido</button></form>`);
    d.querySelector('#f-rech').onsubmit = async ev => {
      ev.preventDefault();
      try { DATOS = await DB.adminPedido(p.id, 'rechazar', null, ev.target.motivo.value); cerrar(); u.aviso('Pedido rechazado', 'ok'); pintar(); }
      catch (err) { d.querySelector('#f-error').innerHTML = `<div class="error">${e(err.message)}</div>`; }
    };
  }
  // Pausar: la web y el panel del club dejan de abrir (por ejemplo, por cuota atrasada). Reactivar lo vuelve todo a la normalidad.
  async function pausar(x) {
    const pausado = x.activo === 'NO';
    if (!pausado && !confirm(`¿Pausar ${x.nombre}?\n\nSu web y su panel dejan de abrir y la web muestra "pausada por el momento". No se borra nada: lo reactivás cuando quieras.`)) return;
    try { DATOS = await DB.adminClub({ slug: x.slug, activo: pausado ? 'SI' : 'NO' }); localStorage.removeItem('pc_portal'); u.aviso(pausado ? x.nombre + ' está activo otra vez' : x.nombre + ' quedó pausado', 'ok'); pintar(); }
    catch (err) { u.aviso(err.message, 'mal'); }
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
  // Club nuevo. Con "ped" (un pedido de la portada) el formulario viene completo y al crear se aprueba el pedido.
  function nuevoClub(ped) {
    const v = ped || { color1: '#D7261E', color2: '#FFFFFF', pitazo_liga_id: 'L01' };
    const hex = (x, def) => /^#[0-9a-f]{6}$/i.test(x || '') ? x : def;
    const usados = new Set((DATOS.clubes || []).map(c => String(c.slug).toLowerCase()));
    const d = dialogo(ped ? 'Aprobar pedido · ' + e(ped.nombre) : 'Nuevo club', `<form class="form" id="f-nuevo">
      ${ped ? `<p class="chico" style="margin:0">Pidió <b>${e(ped.contacto_nombre)}</b>${ped.contacto_cargo ? ' (' + e(ped.contacto_cargo) + ')' : ''} · ${e(ped.contacto_whatsapp)}. Revisá los datos: al crear, el pedido queda aprobado.</p>` : ''}
      <label class="campo"><span>Nombre completo</span><input name="nombre" required placeholder="Club Atlético Ejemplo" value="${e(v.nombre)}"></label>
      <label class="campo"><span>Dirección de su web</span><input name="slug" required pattern="[a-z0-9-]+" placeholder="ejemplo" value="${e(v.slug || aSlug(v.nombre))}"><small id="slug-ver"></small></label>
      <div class="form__fila"><label class="campo"><span>Nombre corto</span><input name="nombre_corto" placeholder="Atlético Ejemplo" value="${e(v.nombre_corto)}"></label><label class="campo"><span>Localidad</span><input name="ciudad" value="${e(v.ciudad)}"></label></div>
      <label class="campo"><span>Escudo <small>(link; uno de Drive se convierte solo)</small></span><input name="escudo" value="${e(v.escudo)}"></label>
      <div class="form__fila"><label class="campo"><span>Color principal</span><span class="color-fila"><input type="color" name="color1" value="${e(hex(v.color1, '#D7261E'))}"></span></label>
        <label class="campo"><span>Color secundario</span><span class="color-fila"><input type="color" name="color2" value="${e(hex(v.color2, '#FFFFFF'))}"></span></label></div>
      <div class="form__fila"><label class="campo"><span>Código en Pitazo Final <small>(ej. CL06)</small></span><input name="pitazo_club_id" value="${e(v.pitazo_club_id)}"></label><label class="campo"><span>Liga</span><input name="pitazo_liga_id" value="${e(v.pitazo_liga_id || 'L01')}"></label></div>
      <label class="campo"><span>Email de Google del administrador del club</span><input name="admin_email" type="email" value="${e(v.admin_email)}"><small>Esa cuenta entra al panel del club.</small></label>
      <div id="f-error"></div><button class="boton">${ped ? 'Crear club y aprobar' : 'Crear club'}</button></form>`);
    const f = d.querySelector('#f-nuevo'), ver = () => {
      const s = f.slug.value;
      d.querySelector('#slug-ver').innerHTML = !s ? '' : usados.has(s) ? '<b style="color:#B51E17">Esa dirección ya la usa otro club.</b>' : e(PC.RAIZ + s + '/');
    };
    let tocado = !!(ped && ped.slug);
    ver();
    f.nombre.oninput = () => { if (!tocado) { f.slug.value = aSlug(f.nombre.value); ver(); } };
    f.slug.oninput = () => { tocado = true; f.slug.value = f.slug.value.toLowerCase().replace(/[^a-z0-9-]/g, ''); ver(); };
    f.onsubmit = async ev => {
      ev.preventDefault();
      const b = f.querySelector('button'); b.disabled = true; b.textContent = 'Creando la planilla…';
      const datos = Object.fromEntries(new FormData(f).entries());
      try {
        DATOS = ped ? await DB.adminPedido(ped.id, 'aprobar', datos) : await DB.adminCrearClub(datos);
        localStorage.removeItem('pc_portal'); u.aviso('Club creado: su web ya está en /' + datos.slug + '/', 'ok'); pintar();
        if (ped && ped.contacto_whatsapp) {
          // Aviso listo para mandar a quien lo pidió.
          const link = PC.RAIZ + datos.slug + '/';
          const msj = `¡Hola ${ped.contacto_nombre || ''}! La web de ${datos.nombre} ya está lista: ${link}\n\nPara entrar al panel del club: ${link}#/panel con la cuenta de Google ${datos.admin_email}.`;
          dialogo('Club creado', `<p style="margin:0 0 12px">La web de <b>${e(datos.nombre)}</b> ya está en <a href="${e(link)}" target="_blank" rel="noopener">${e(link)}</a>.</p>
            <a class="boton" href="${e(u.wa(ped.contacto_whatsapp, msj))}" target="_blank" rel="noopener">Avisarle por WhatsApp a ${e(ped.contacto_nombre || 'quien lo pidió')}</a>`);
        } else cerrar();
      }
      catch (err) { d.querySelector('#f-error').innerHTML = `<div class="error">${e(err.message)}</div>`; b.disabled = false; b.textContent = ped ? 'Crear club y aprobar' : 'Crear club'; }
    };
  }

  // ---------- formulario público "Quiero la web de mi club" (#/pedir) ----------
  const normal = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  async function pedir() {
    const portal = DB.portalGuardado() || {};
    const usados = new Set((portal.clubes || []).map(c => String(c.slug).toLowerCase()));
    // Sin copia de la portada (link directo): se trae para los colores y las direcciones ya usadas.
    if (!DB.portalGuardado()) DB.portal().then(p => { (p.clubes || []).forEach(c => usados.add(String(c.slug).toLowerCase())); PC.temaPortal(p.config); }).catch(() => {});
    const tel = (portal.config || {}).whatsapp || CFG.WHATSAPP_VENTAS;
    main().innerHTML = `<section class="seccion contenedor" style="max-width:760px">
      <p class="chico" style="margin:0 0 6px"><a href="#/">← Volver</a></p>
      <h1 style="margin:0 0 6px">Quiero la web de mi club</h1>
      <p class="chico" style="margin:0 0 18px">Completá los datos y te avisamos por WhatsApp cuando la web esté lista. Lleva unos minutos.</p>
      <form class="form" id="f-pedir" novalidate>
        <div class="tarjeta form"><h3>Tu club</h3>
          ${CFG.PITAZO_API ? `<label class="campo"><span>¿Tu club está en Pitazo Final? Buscalo y se completa solo</span>
            <input id="pz-buscar" type="search" autocomplete="off" placeholder="Nombre del club o localidad"></label>
            <div id="pz-lista" class="pz-lista"></div><div id="pz-elegido"></div>` : ''}
          <input type="hidden" name="pitazo_club_id"><input type="hidden" name="pitazo_liga_id">
          <label class="campo"><span>Nombre completo del club *</span><input name="nombre" required placeholder="Club Atlético Ejemplo"></label>
          <div class="form__fila"><label class="campo"><span>Nombre corto</span><input name="nombre_corto" placeholder="Atlético Ejemplo"></label>
            <label class="campo"><span>Localidad *</span><input name="ciudad" required></label></div>
          <label class="campo"><span>Dirección que te gustaría para la web</span><input name="slug" pattern="[a-z0-9-]+" placeholder="ejemplo"><small id="slug-ver"></small></label>
          <label class="campo"><span>Escudo <small>(link a la imagen: puede ser de Google Drive, compartida con cualquiera que tenga el enlace)</small></span><input name="escudo" placeholder="https://drive.google.com/file/d/..."></label>
          <div class="form__fila"><label class="campo"><span>Color principal</span><span class="color-fila"><input type="color" name="color1" value="#D7261E"></span></label>
            <label class="campo"><span>Color secundario</span><span class="color-fila"><input type="color" name="color2" value="#FFFFFF"></span></label></div>
        </div>
        <div class="tarjeta form"><h3>Quién lo pide</h3>
          <div class="form__fila"><label class="campo"><span>Tu nombre y apellido *</span><input name="contacto_nombre" required autocomplete="name"></label>
            <label class="campo"><span>Cargo en el club</span><input name="contacto_cargo" placeholder="Presidente, secretario, prensa…"></label></div>
          <label class="campo"><span>WhatsApp *</span><input name="contacto_whatsapp" required inputmode="tel" autocomplete="tel" placeholder="2314 551234"><small>Con característica, sin 0 ni 15. Por acá te avisamos.</small></label>
          <label class="campo"><span>Email de Google de quien va a administrar la web *</span><input name="admin_email" type="email" required autocomplete="email" placeholder="club@gmail.com"><small>Con esa cuenta se entra al panel del club (socios, cuotas, noticias).</small></label>
          <label class="campo"><span>¿Algo más que quieras contarnos?</span><textarea name="mensaje" style="min-height:80px"></textarea></label>
          <label class="trampa" aria-hidden="true">No completar<input name="web2" tabindex="-1" autocomplete="off"></label>
        </div>
        <div id="f-error"></div>
        <button class="boton" type="submit">Enviar pedido</button>
        ${tel ? `<p class="chico" style="margin:10px 0 0">¿Dudas? <a href="${e(u.wa(tel, 'Hola! Tengo una consulta sobre la web para mi club.'))}" target="_blank" rel="noopener">Escribinos por WhatsApp</a>.</p>` : ''}
      </form></section>`;
    window.scrollTo(0, 0);
    const f = document.getElementById('f-pedir');
    let tocado = false;
    const ver = () => {
      const s = f.slug.value;
      document.getElementById('slug-ver').innerHTML = !s ? '' : usados.has(s) ? '<b style="color:#B51E17">Esa dirección ya la usa otro club: probá con otra.</b>' : 'Tu web quedaría en ' + e(PC.RAIZ + s + '/');
    };
    f.nombre.oninput = () => { if (!tocado) { f.slug.value = aSlug(f.nombre.value); ver(); } };
    f.slug.oninput = () => { tocado = true; f.slug.value = f.slug.value.toLowerCase().replace(/[^a-z0-9-]/g, ''); ver(); };
    // Buscador de clubes de Pitazo Final.
    const $b = document.getElementById('pz-buscar');
    if ($b) {
      let base = null;
      const $l = document.getElementById('pz-lista'), $el = document.getElementById('pz-elegido');
      const cargar = async () => { if (base) return base; $l.innerHTML = '<p class="chico">Buscando en Pitazo Final…</p>'; try { base = await PC.PZ.clubesTodos(); } catch (err) { base = { clubes: [], ligas: [] }; } return base; };
      const liga = id => ((base.ligas || []).find(l => l.id === id) || {}).nombre || '';
      const elegir = c => {
        f.pitazo_club_id.value = c.id; f.pitazo_liga_id.value = c.liga_id;
        if (!f.nombre.value) { f.nombre.value = c.nombre; f.nombre.oninput(); }
        if (!f.ciudad.value) f.ciudad.value = c.ciudad;
        if (!f.escudo.value && c.escudo) f.escudo.value = c.escudo;
        $l.innerHTML = ''; $b.value = '';
        $el.innerHTML = `<div class="pz-elegido">${PC.escudo(M.url(c.escudo, true), c.nombre, 'escudo--chico')}<div class="pz-elegido__txt"><b>${e(c.nombre)}</b><br><span class="chico">${e(liga(c.liga_id))} · los resultados salen solos</span></div><button type="button" class="boton boton--gris boton--chico" id="pz-quitar">Quitar</button></div>`;
        document.getElementById('pz-quitar').onclick = () => { f.pitazo_club_id.value = ''; f.pitazo_liga_id.value = ''; $el.innerHTML = ''; };
      };
      $b.onfocus = cargar;
      $b.oninput = async () => {
        await cargar();
        const q = normal($b.value.trim());
        if (q.length < 2) { $l.innerHTML = ''; return; }
        const r = base.clubes.filter(c => normal(c.nombre + ' ' + c.ciudad).includes(q)).slice(0, 8);
        $l.innerHTML = r.length ? r.map((c, i) => `<button type="button" class="pz-item" data-i="${i}">${PC.escudo(M.url(c.escudo, true), c.nombre, 'escudo--chico')}<span><b>${e(c.nombre)}</b> <span class="chico">${e(c.ciudad)} · ${e(liga(c.liga_id))}</span></span></button>`).join('')
          : '<p class="chico">No aparece. No pasa nada: completá los datos abajo.</p>';
        $l.querySelectorAll('[data-i]').forEach(x => x.onclick = () => elegir(r[x.dataset.i]));
      };
    }
    f.onsubmit = async ev => {
      ev.preventDefault();
      const err = document.getElementById('f-error');
      const falta = [...f.querySelectorAll('[required]')].find(x => !x.value.trim());
      if (falta) { err.innerHTML = '<div class="error">Completá los campos con *.</div>'; falta.focus(); return; }
      if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(f.admin_email.value.trim())) { err.innerHTML = '<div class="error">Revisá el email: tiene que ser una cuenta de Google.</div>'; f.admin_email.focus(); return; }
      if (f.slug.value && usados.has(f.slug.value)) { err.innerHTML = '<div class="error">Esa dirección ya la usa otro club: elegí otra o dejala vacía.</div>'; f.slug.focus(); return; }
      const b = f.querySelector('button[type=submit]'); b.disabled = true; b.textContent = 'Enviando…';
      try {
        await DB.pedirWeb(Object.fromEntries(new FormData(f).entries()));
        main().innerHTML = `<section class="seccion contenedor" style="max-width:640px;text-align:center">
          <div class="tarjeta" style="padding:34px 24px"><div style="font-size:2.6rem;line-height:1">✓</div>
            <h1 style="margin:10px 0 8px">¡Recibimos tu pedido!</h1>
            <p style="margin:0 0 18px">Vamos a armar la web de <b>${e(f.nombre.value)}</b> y te avisamos por WhatsApp al ${e(f.contacto_whatsapp.value)} cuando esté lista.</p>
            <a class="boton" href="#/">Volver a la portada</a></div></section>`;
        window.scrollTo(0, 0);
      } catch (x) { err.innerHTML = `<div class="error">${e(x.message)}</div>`; b.disabled = false; b.textContent = 'Enviar pedido'; }
    };
  }

  // Al entrar al panel desde otra página se vuelven a pedir los datos (pueden haber llegado pedidos nuevos).
  PC.admin = { ver, pedir, olvidar: () => { DATOS = null; } };
})();
