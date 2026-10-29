/* Pitazo Clubs — portal del socio: carnet digital con QR, estado de cuenta y pago. */
window.PC = window.PC || {};
(function () {
  'use strict';
  const { u, DB } = PC;
  const e = u.esc;
  const main = () => document.getElementById('contenido');
  let VISTA = null, PESTANA = 'carnet', SEL = null, COMPROBANTE = '';

  function qrSvg(texto, tam) {
    if (!window.qrcode) return `<div class="chico">${e(texto)}</div>`;
    const q = window.qrcode(0, 'M'); q.addData(texto); q.make();
    return q.createSvgTag({ cellSize: 6, margin: 2, scalable: true }).replace('<svg ', `<svg width="${tam || 210}" height="${tam || 210}" role="img" aria-label="Código QR del carnet" `);
  }
  PC.qrSvg = qrSvg;

  function claseEstado(est) {
    if (!est.activo) return 'gris';
    if (est.alDia) return est.aConfirmar ? 'espera' : 'ok';
    return 'mal';
  }

  async function ver(tab) {
    PESTANA = tab || PESTANA || 'carnet';
    if (!DB.socioActivo()) return ingreso();
    if (!VISTA) {
      main().innerHTML = '<section class="seccion contenedor"><p class="cargando">Cargando tu carnet…</p></section>';
      try { VISTA = await DB.socioVista(); } catch (err) { DB.socioSalir(); VISTA = null; return ingreso(err.message); }
    }
    pintar();
  }

  function ingreso(msj) {
    const c = PC.ctx.cfg;
    main().innerHTML = `<section class="seccion contenedor" style="max-width:460px">
      <div class="tarjeta" style="text-align:center">
        ${PC.escudo(c.escudo, c.nombre, 'escudo--partido')}
        <h2 style="margin:12px 0 4px">Mi carnet de socio</h2>
        <p class="chico">Entrá con tu DNI y el código de 4 números que te dio el club.</p>
        <form class="form" id="f-ingreso" style="text-align:left;margin-top:14px">
          <label class="campo"><span>DNI</span><input name="dni" inputmode="numeric" autocomplete="username" required></label>
          <label class="campo"><span>Código</span><input name="pin" inputmode="numeric" maxlength="6" autocomplete="current-password" required></label>
          <div id="f-error">${msj ? `<div class="error">${e(msj)}</div>` : ''}</div>
          <button class="boton" type="submit">Entrar</button>
          <button class="link" type="button" id="olvide" style="justify-self:center">¿Olvidaste tu código?</button>
        </form>
        <p class="chico" style="margin:14px 0 0">¿No tenés código? Pedilo en el club${c.whatsapp ? ` o por <a href="${e(u.wa(c.whatsapp, 'Hola! Necesito mi código para el carnet digital. Mi DNI es '))}" target="_blank" rel="noopener">WhatsApp</a>` : ''}. ¿Todavía no sos socio? <a href="#/asociate">Asociate</a>.</p>
        ${DB.demo ? '<p class="chico" style="margin:10px 0 0;background:#FAF9F7;border-radius:8px;padding:8px">Demo: DNI <b>30111222</b> · código <b>1234</b></p>' : ''}
      </div></section>`;
    const f = document.getElementById('f-ingreso');
    document.getElementById('olvide').onclick = () => recuperar(f.dni.value);
    f.addEventListener('submit', async ev => {
      ev.preventDefault();
      const b = f.querySelector('button'); b.disabled = true;
      try {
        VISTA = await DB.socioIngresar(f.dni.value, f.pin.value);
        PESTANA = PESTANA === 'entradas' ? 'entradas' : 'carnet'; pintar();
      } catch (err) { document.getElementById('f-error').innerHTML = `<div class="error">${e(err.message)}</div>`; b.disabled = false; }
    });
  }

  // Pide el código por email (al que el socio tiene cargado en el club).
  function recuperar(dni) {
    const c = PC.ctx.cfg;
    main().innerHTML = `<section class="seccion contenedor" style="max-width:460px">
      <div class="tarjeta">
        <h2 style="margin-bottom:6px">Recuperar mi código</h2>
        <p class="chico">Escribí tu DNI. Te mandamos el código al email que tenés cargado en el club.</p>
        <form class="form" id="f-rec" style="margin-top:12px">
          <label class="campo"><span>DNI</span><input name="dni" inputmode="numeric" value="${e(dni || '')}" required></label>
          <div id="f-error"></div>
          <button class="boton" type="submit">Mandarme el código</button>
          <button class="link" type="button" id="volver" style="justify-self:center">← Volver</button>
        </form>
        <p class="chico" style="margin:14px 0 0">¿No tenés email cargado o no te llega? Pedí tu código en el club${c.whatsapp ? ` o por <a href="${e(u.wa(c.whatsapp, 'Hola! Necesito mi código para el carnet digital. Mi DNI es '))}" target="_blank" rel="noopener">WhatsApp</a>` : ''}.</p>
      </div></section>`;
    const f = document.getElementById('f-rec');
    document.getElementById('volver').onclick = () => ingreso();
    f.onsubmit = async ev => {
      ev.preventDefault();
      const b = f.querySelector('button[type=submit]'); b.disabled = true; b.textContent = 'Enviando…';
      try {
        const r = await DB.socioRecuperar(f.dni.value);
        f.outerHTML = `<div class="exito" style="margin-top:12px">Listo. Te mandamos el código a <b>${e(r.email)}</b>. Revisá también la carpeta de spam.</div>
          ${r.demo_pin ? `<p class="chico" style="margin:10px 0 0;background:#FAF9F7;border-radius:8px;padding:8px">Demo: no se mandan mails de verdad. El código es <b>${e(r.demo_pin)}</b>.</p>` : ''}
          <button class="boton boton--ancho" style="margin-top:12px" id="a-ingreso">Entrar con mi código</button>`;
        document.getElementById('a-ingreso').onclick = () => ingreso();
      } catch (x) { document.getElementById('f-error').innerHTML = `<div class="error">${e(x.message)}</div>`; b.disabled = false; b.textContent = 'Mandarme el código'; }
    };
  }

  function pintar() {
    const v = VISTA, s = v.socio;
    const pend = v.cuotas.filter(c => c.estado === 'Pendiente');
    const tk = v.tickets || { entradas: [], partidos: [] };
    const tabs = [['carnet', 'Carnet'], ['cuenta', pend.length ? `Cuotas (${pend.length})` : 'Cuotas'], ['pagos', 'Mis pagos']];
    if (tk.partidos.length || tk.entradas.length) tabs.splice(1, 0, ['entradas', tk.entradas.some(x => x.qr) ? 'Entradas 🟢' : 'Entradas']);
    if (v.grupo.length > 1) tabs.push(['grupo', 'Familia']);
    let cuerpo = '';
    if (PESTANA === 'cuenta') cuerpo = cuenta(v);
    else if (PESTANA === 'pagos') cuerpo = historial(v);
    else if (PESTANA === 'grupo') cuerpo = grupo(v);
    else if (PESTANA === 'entradas') cuerpo = entradas(v);
    else cuerpo = carnet(v);
    main().innerHTML = `<section class="contenedor" style="max-width:640px;padding-bottom:30px">
      <div class="socio-cab"><div><h2>Hola, ${e(s.nombre)}</h2><span class="chico">Socio N° ${e(s.numero)}${v.categoria ? ' · ' + e(v.categoria) : ''}</span></div>
        <button class="boton boton--gris boton--chico" id="salir">Salir</button></div>
      <div class="pestanas" role="tablist">${tabs.map(([k, n]) => `<button role="tab" data-tab="${k}" aria-selected="${PESTANA === k}">${n}</button>`).join('')}</div>
      ${cuerpo}
    </section>`;
    main().querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { PESTANA = b.dataset.tab; location.hash = '#/socio/' + PESTANA; });
    document.getElementById('salir').onclick = () => { DB.socioSalir(); VISTA = null; ingreso(); };
    if (PESTANA === 'cuenta') conectarCuenta(v);
    if (PESTANA === 'entradas') conectarEntradas(v);
    if (PESTANA === 'carnet') { const b = document.getElementById('ir-pagar'); if (b) b.onclick = () => { location.hash = '#/socio/cuenta'; }; }
    const ie = document.getElementById('ir-entrada'); if (ie) ie.onclick = () => { location.hash = '#/socio/entradas'; };
  }

  function carnet(v) {
    const c = PC.ctx.cfg, s = v.socio, est = v.estado;
    const ahora = new Date().toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    return `<div class="carnet">
        <div class="carnet__cab">${PC.escudo(c.escudo, c.nombre, 'escudo--chico')}<div class="carnet__club"><small>Carnet de socio</small>${e(c.nombre_corto || c.nombre)}</div></div>
        <div class="carnet__nombre">${e(s.nombre)}<br>${e(s.apellido)}</div>
        <div class="carnet__datos"><span>N° <b>${e(s.numero)}</b></span><span>DNI ${e(s.dni)}</span>${v.categoria ? `<span>${e(v.categoria)}</span>` : ''}</div>
        <div class="carnet__qr">
          ${qrSvg(v.qr)}
          <span class="estado estado--${claseEstado(est)}">${e(est.etiqueta)}</span>
          ${v.titular ? `<span class="chico">Grupo familiar de ${e(v.titular)}</span>` : ''}
          <span class="carnet__hora">Actualizado ${e(ahora)}</span>
        </div>
      </div>
      ${(v.tickets && v.tickets.entradas.some(x => x.qr)) ? `<button class="aviso-entradas" id="ir-entrada" style="margin-top:16px;width:100%;text-align:left"><span>🎟️</span><div><b>Tu entrada ya está habilitada</b><small>Tocá para ver el QR del partido</small></div><span class="aviso-entradas__ir">Ver →</span></button>` : ''}
      ${!est.alDia && est.activo ? `<div class="tarjeta" style="margin-top:16px;text-align:center"><p style="margin-bottom:10px">Tenés ${est.vencidas === 1 ? 'una cuota vencida' : est.vencidas + ' cuotas vencidas'} (${u.plata(est.deuda)}). Ponete al día para entrar con el carnet.</p><button class="boton" id="ir-pagar">Pagar ahora</button></div>` : ''}
      ${v.actividades.length ? `<div class="tarjeta" style="margin-top:16px"><h3 style="margin-bottom:8px">Mis actividades</h3>${v.actividades.map(a => `<div class="fila-accion"><b>${e(a.nombre)}</b><span class="chico">${e([a.dias, a.horario].filter(Boolean).join(' · '))}</span></div>`).join('')}</div>` : ''}
      <p class="chico" style="text-align:center;margin-top:14px">Mostrá este QR en la entrada. Tip: agregá esta página a la pantalla de inicio del celular.</p>`;
  }

  function cuenta(v) {
    const pend = v.cuotas.filter(c => c.estado === 'Pendiente');
    const espera = v.cuotas.filter(c => c.estado === 'A confirmar');
    if (SEL === null) SEL = new Set(pend.map(c => c.id));
    if (v.titular) return `<div class="tarjeta"><p style="margin:0">Las cuotas de tu grupo familiar las paga <b>${e(v.titular)}</b>. Estado: <span class="estado estado--${claseEstado(v.estado)}">${e(v.estado.etiqueta)}</span></p></div>`;
    const cb = v.cobro;
    const hayCuenta = cb.alias || cb.cbu;
    return `
      ${espera.length ? `<div class="tarjeta" style="margin-bottom:14px"><span class="estado estado--espera">Pago a confirmar</span><p class="chico" style="margin:8px 0 0">El club está revisando tu comprobante de ${espera.map(c => u.periodo(c.periodo)).join(', ')}. Cuando lo confirme vas a figurar al día.</p></div>` : ''}
      <div class="tarjeta">
        ${pend.length ? `<h3 style="margin-bottom:6px">Cuotas a pagar</h3>
          <ul class="cuotas">${pend.map(c => `<li><input type="checkbox" data-cuota="${e(c.id)}" ${SEL.has(c.id) ? 'checked' : ''} aria-label="Pagar ${e(u.periodo(c.periodo))}">
            <div class="cuotas__txt"><b>${e(u.periodo(c.periodo))}</b><span class="chico">${e(c.concepto)} · vence ${e(u.corta(c.vence))}${u.iso(c.vence) < u.hoy() ? ' · <span style="color:var(--mal);font-weight:700">vencida</span>' : ''}</span></div>
            <span class="cuotas__monto">${u.plata(c.monto)}</span></li>`).join('')}</ul>
          <div class="total-pagar"><span>Total a pagar</span><b id="total">${u.plata(pend.filter(c => SEL.has(c.id)).reduce((s, c) => s + u.num(c.monto), 0))}</b></div>`
        : espera.length ? `<p class="chico" style="margin:0">No tenés otras cuotas para pagar.</p>` : `<div class="exito">¡Estás al día! No tenés cuotas pendientes.</div>`}
      </div>
      ${pend.length ? `<div class="tarjeta" style="margin-top:14px"><h3 style="margin-bottom:12px">Cómo pagar</h3>
        <div class="pasos">
          <div class="paso"><div>
            <b>Pagale directo al club</b>
            <p class="chico" style="margin:2px 0 10px">La plata va a la cuenta del club. Pitazo Clubs no cobra comisión.</p>
            ${cb.mp_link ? `<a class="boton boton--ancho" href="${e(cb.mp_link)}" target="_blank" rel="noopener" style="margin-bottom:10px;background:#009EE3">Pagar con Mercado Pago</a>` : ''}
            ${hayCuenta ? `${cb.alias ? datoCobro('Alias', cb.alias) : ''}${cb.cbu ? datoCobro('CBU / CVU', cb.cbu) : ''}
              <p class="chico" style="margin:4px 0 0">${e([cb.titular, cb.banco, cb.cuit ? 'CUIT ' + cb.cuit : ''].filter(Boolean).join(' · '))}</p>` : ''}
            ${!cb.mp_link && !hayCuenta ? '<p class="chico">El club todavía no cargó sus datos para transferencias: pagá en la secretaría.</p>' : ''}
          </div></div>
          <div class="paso"><div>
            <b>Subí el comprobante</b>
            <label class="subir" style="margin-top:8px"><input type="file" id="archivo" accept="image/*,application/pdf" hidden>
              <span id="vista-comp">${COMPROBANTE ? vistaComp() : '📎 Tocá para elegir la foto o el PDF'}</span></label>
          </div></div>
          <div class="paso"><div>
            <b>Avisale al club</b>
            <div id="f-error" style="margin-top:8px"></div>
            <button class="boton boton--ancho" id="informar" style="margin-top:8px">Informar pago</button>
          </div></div>
        </div></div>` : ''}`;
  }
  const datoCobro = (k, v) => `<div class="dato-cobro"><div><small>${e(k)}</small><b>${e(v)}</b></div><button class="boton boton--suave boton--chico" data-copiar="${e(v)}">Copiar</button></div>`;
  const vistaComp = () => COMPROBANTE.startsWith('data:application/pdf') ? '📄 PDF listo para enviar' : `<img src="${e(COMPROBANTE)}" alt="Comprobante">Cambiar`;

  function conectarCuenta(v) {
    const pend = v.cuotas.filter(c => c.estado === 'Pendiente');
    main().querySelectorAll('[data-cuota]').forEach(ch => ch.onchange = () => {
      ch.checked ? SEL.add(ch.dataset.cuota) : SEL.delete(ch.dataset.cuota);
      document.getElementById('total').textContent = u.plata(pend.filter(c => SEL.has(c.id)).reduce((s, c) => s + u.num(c.monto), 0));
    });
    main().querySelectorAll('[data-copiar]').forEach(b => b.onclick = () => u.copiar(b.dataset.copiar));
    const a = document.getElementById('archivo');
    if (a) a.onchange = async () => {
      const f = a.files[0]; if (!f) return;
      try { COMPROBANTE = await u.achicar(f, 1100); document.getElementById('vista-comp').innerHTML = vistaComp(); }
      catch (err) { u.aviso(err.message, 'mal'); }
    };
    const b = document.getElementById('informar');
    if (b) b.onclick = async () => {
      const err = document.getElementById('f-error'); err.innerHTML = '';
      b.disabled = true; b.textContent = 'Enviando…';
      try {
        VISTA = await DB.socioInformar({ cuotas: [...SEL], comprobante: COMPROBANTE, medio: 'Transferencia' });
        COMPROBANTE = ''; SEL = null;
        u.aviso('¡Listo! El club va a confirmar tu pago.', 'ok');
        pintar();
      } catch (x) { err.innerHTML = `<div class="error">${e(x.message)}</div>`; b.disabled = false; b.textContent = 'Informar pago'; }
    };
  }

  function historial(v) {
    if (!v.pagos.length) return '<div class="tarjeta"><p class="vacio" style="padding:8px 0">Todavía no hay pagos registrados.</p></div>';
    const cl = { Confirmado: 'ok', 'A confirmar': 'espera', Rechazado: 'mal' };
    return `<div class="tarjeta"><ul class="cuotas">${v.pagos.map(p => {
      const per = String(p.cuotas || '').split(',').map(id => v.cuotas.find(c => c.id === id.trim())).filter(Boolean).map(c => u.periodo(c.periodo)).join(', ');
      return `<li><div class="cuotas__txt"><b>${e(per || 'Pago')}</b><span class="chico">${e(u.corta(p.fecha))} · ${e(p.medio)}</span></div>
        <span class="cuotas__monto">${u.plata(p.monto)}</span><span class="estado estado--${cl[p.estado] || 'gris'}">${e(p.estado)}</span></li>`;
    }).join('')}</ul></div>`;
  }
  // ---------- Entradas de los partidos (precio de socio, una por integrante del grupo familiar) ----------
  function entradas(v) {
    const tk = v.tickets, E = PC.entradas, c = PC.ctx.cfg;
    const compra = tk.partidos.map(p => {
      const ya = tk.entradas.filter(x => x.partido && x.partido.id === p.id);
      const s = p.socio;
      let accion;
      if (!s.alDia) accion = `<p class="chico" style="margin:8px 0 0">Para el precio de socio tenés que estar al día. <a href="#/socio/cuenta">Ver mis cuotas</a> · o sacá la <a href="#/entradas">entrada general</a>.</p>`;
      else if (!s.quedan) accion = `<p class="chico" style="margin:8px 0 0">Tu grupo familiar ya sacó ${s.grupo === 1 ? 'su entrada' : 'sus ' + s.grupo + ' entradas'} de socio para este partido.</p>`;
      else if (p.disponibles === 0) accion = '<div class="error">Entradas agotadas.</div>';
      else accion = `<div class="form__fila" style="margin-top:10px;align-items:end"><label class="campo"><span>${s.grupo > 1 ? `Cuántas (tu grupo familiar: ${s.grupo})` : 'Cantidad'}</span>
          <select data-cant="${e(p.id)}">${Array.from({ length: s.quedan }, (_, i) => `<option value="${i + 1}" ${i + 1 === s.quedan ? 'selected' : ''}>${i + 1}</option>`).join('')}</select></label>
          <button class="boton" data-sacar="${e(p.id)}" data-precio="${p.precio_socio}">Sacar ${s.quedan} · ${p.precio_socio ? u.plata(p.precio_socio * s.quedan) : 'gratis'}</button></div>`;
      return `<div class="tarjeta" style="margin-bottom:14px"><div class="partido-venta__cab"><div><small>${e(p.torneo || 'Partido')}</small><h3>${e(c.nombre_corto || c.nombre)} vs ${e(p.rival)}</h3><span class="chico">${e(E.cuando(p))}${p.lugar ? ' · ' + e(p.lugar) : ''}</span></div></div>
        <div class="precios-entrada"><div class="precios-entrada__socio"><small>Tu precio de socio</small><b>${p.precio_socio ? u.plata(p.precio_socio) : 'Gratis'}</b><span>General ${u.plata(p.precio_general)}</span></div></div>
        ${ya.length && !s.quedan ? '' : accion}</div>`;
    }).join('');
    const mias = tk.entradas.map(x => `<div style="margin-bottom:16px">${E.ticketHtml(x)}<div data-pago="${e(x.entrada.id)}">${E.pagoHtml(x)}</div></div>`).join('');
    return (mias ? `<h3 style="margin:4px 0 10px">Mis entradas</h3>${mias}` : '') + (compra ? `<h3 style="margin:${mias ? '22px' : '4px'} 0 10px">Partidos con entradas</h3>${compra}` : '')
      + '<p class="chico" style="text-align:center">El QR de la entrada se habilita antes del partido y pasa una vez por cada entrada.</p>';
  }
  function conectarEntradas(v) {
    const E = PC.entradas;
    main().querySelectorAll('[data-cant]').forEach(sel => sel.onchange = () => {
      const b = main().querySelector(`[data-sacar="${sel.dataset.cant}"]`), n = Number(sel.value), pr = Number(b.dataset.precio);
      b.textContent = `Sacar ${n} · ${pr ? u.plata(pr * n) : 'gratis'}`;
    });
    main().querySelectorAll('[data-sacar]').forEach(b => b.onclick = async () => {
      const n = Number(main().querySelector(`[data-cant="${b.dataset.sacar}"]`).value);
      b.disabled = true; b.textContent = 'Reservando…';
      try { const r = await DB.socioEntrada(b.dataset.sacar, n); VISTA = r.vista; u.aviso(r.entrada.entrada.total ? 'Reservada. Pagá y subí el comprobante.' : '¡Listo! Ya tenés tus entradas.', 'ok'); pintar(); }
      catch (x) { u.aviso(x.message, 'mal'); b.disabled = false; b.textContent = 'Reintentar'; }
    });
    v.tickets.entradas.forEach(x => {
      const box = main().querySelector(`[data-pago="${x.entrada.id}"]`);
      if (box) E.conectarPago(box, x, async () => { VISTA = await DB.socioVista(); pintar(); });
      E.relojHabilita(x, async () => { if (location.hash.indexOf('socio') >= 0) { VISTA = await DB.socioVista(); pintar(); } });
    });
  }

  function grupo(v) {
    return `<div class="tarjeta"><h3 style="margin-bottom:6px">Grupo familiar</h3>${v.grupo.map(g => `<div class="fila-accion"><b>${e(g.nombre)}</b><span class="chico">Socio N° ${e(g.numero)}</span></div>`).join('')}
      <p class="chico" style="margin:10px 0 0">Cada integrante entra con su propio DNI y código para ver su carnet.</p></div>`;
  }

  PC.socio = { ver, reset() { VISTA = null; SEL = null; COMPROBANTE = ''; } };
})();
