/* Pitazo Clubs — entradas de los partidos.
 *  #/entradas            partidos con entradas a la venta (precio general y precio socio)
 *  #/entrada/ID-CODIGO   la entrada: pago, estado y el QR (se habilita X horas antes del partido)
 * El socio las saca desde su carnet (#/socio/entradas) con el precio de socio.
 */
window.PC = window.PC || {};
(function () {
  'use strict';
  const { u, DB } = PC;
  const e = u.esc;
  const main = () => document.getElementById('contenido');
  let COMP = '', RELOJ = null;

  const cuando = p => `${u.fecha(p.fecha, true)}${p.hora ? ' · ' + p.hora + ' h' : ''}`;
  const habilitaTxt = v => {
    const dia = v.habilita.slice(0, 10), hora = v.habilita.slice(11);
    return (dia === u.hoy() ? 'hoy' : 'el ' + u.fecha(dia, true).toLowerCase()) + ' a las ' + hora;
  };

  // ---------- la entrada (tarjeta) ----------
  function ticketHtml(v) {
    const c = PC.ctx.cfg, x = v.entrada, p = v.partido;
    if (!p) return `<div class="tarjeta"><p style="margin:0">El partido de esta entrada ya no está disponible. Consultá en el club.</p></div>`;
    const usada = x.usadas >= x.cantidad;
    let centro;
    if (x.estado === 'Pagada' && v.qr) centro = `${PC.qrSvg(v.qr, 200)}<span class="estado estado--ok">Habilitada</span>${x.cantidad > 1 ? `<span class="chico">Ingresaron ${x.usadas} de ${x.cantidad}</span>` : ''}`;
    else if (x.estado === 'Pagada' && usada) centro = `<div class="entrada__candado">✓</div><b>Entrada usada</b><span class="chico">${x.cantidad > 1 ? 'Ya ingresaron las ' + x.cantidad + ' personas.' : 'Ya se usó para entrar.'}</span>`;
    else if (x.estado === 'Pagada' && p.ventana.antes) centro = `<div class="entrada__candado">🔒</div><b>El QR se habilita ${e(habilitaTxt(p.ventana))}</b><span class="chico">${p.ventana.horas} h antes del partido. Volvé a abrir esta página ese día.</span>`;
    else if (x.estado === 'Pagada') centro = `<div class="entrada__candado">⌛</div><b>Vencida</b><span class="chico">El partido ya pasó.</span>`;
    else if (x.estado === 'A confirmar') centro = `<div class="entrada__candado">⏳</div><b>El club está revisando tu pago</b><span class="chico">Cuando lo confirme, acá aparece tu QR.</span>`;
    else if (x.estado === 'Rechazada') centro = `<div class="entrada__candado">✕</div><b>Pago rechazado</b><span class="chico">${e(x.observaciones || '')}</span>`;
    else if (x.estado === 'Anulada') centro = `<div class="entrada__candado">✕</div><b>Entrada anulada</b>`;
    else centro = `<div class="entrada__candado">💳</div><b>Falta pagar</b><span class="chico">Pagá y subí el comprobante abajo.</span>`;
    return `<div class="entrada">
      <div class="entrada__cab">${PC.escudo(c.escudo, c.nombre, 'escudo--chico')}<div><small>Entrada ${x.tipo === 'Socio' ? 'de socio' : 'general'}</small>${e(c.nombre_corto || c.nombre)}</div><span class="entrada__n">${x.cantidad > 1 ? x.cantidad + ' personas' : '1 persona'}</span></div>
      <div class="entrada__rival">vs ${e(p.rival)}</div>
      <div class="entrada__datos"><span>${e(cuando(p))}</span>${p.lugar ? `<span>${e(p.lugar)}</span>` : ''}${p.torneo ? `<span>${e(p.torneo)}</span>` : ''}</div>
      <div class="entrada__qr">${centro}</div>
      <div class="entrada__pie"><span>${e(x.nombre)}</span><span>${x.id} · ${u.plata(x.total)}</span></div>
    </div>`;
  }

  // Bloque para pagar (datos de la cuenta del club + comprobante).
  function pagoHtml(v) {
    if (!v.cobro) return '';
    const cb = v.cobro, hay = cb.alias || cb.cbu, dato = (k, val) => `<div class="dato-cobro"><div><small>${e(k)}</small><b>${e(val)}</b></div><button class="boton boton--suave boton--chico" data-copiar="${e(val)}">Copiar</button></div>`;
    return `<div class="tarjeta" style="margin-top:14px"><h3 style="margin-bottom:4px">Pagá ${u.plata(v.entrada.total)}</h3>
      <p class="chico" style="margin:0 0 10px">La plata va directo a la cuenta del club. Después subí el comprobante.</p>
      ${cb.mp_link ? `<a class="boton boton--ancho" href="${e(cb.mp_link)}" target="_blank" rel="noopener" style="margin-bottom:10px;background:#009EE3">Pagar con Mercado Pago</a>` : ''}
      ${hay ? (cb.alias ? dato('Alias', cb.alias) : '') + (cb.cbu ? dato('CBU / CVU', cb.cbu) : '') + `<p class="chico" style="margin:4px 0 0">${e([cb.titular, cb.banco, cb.cuit ? 'CUIT ' + cb.cuit : ''].filter(Boolean).join(' · '))}</p>` : ''}
      ${!cb.mp_link && !hay ? '<p class="chico">El club todavía no cargó sus datos para transferencias: pagá en la secretaría o en la boletería.</p>' : ''}
      <label class="subir" style="margin-top:12px"><input type="file" data-comp accept="image/*,application/pdf" hidden><span data-comp-vista>📎 Tocá para elegir la foto o el PDF del comprobante</span></label>
      <div data-error style="margin-top:8px"></div>
      <button class="boton boton--ancho" data-informar style="margin-top:8px">Enviar comprobante</button></div>`;
  }
  function conectarPago(box, v, alListo) {
    COMP = '';
    box.querySelectorAll('[data-copiar]').forEach(b => b.onclick = () => u.copiar(b.dataset.copiar));
    const a = box.querySelector('[data-comp]');
    if (a) a.onchange = async () => {
      const f = a.files[0]; if (!f) return;
      try { COMP = await u.achicar(f, 1100); box.querySelector('[data-comp-vista]').innerHTML = COMP.startsWith('data:application/pdf') ? '📄 PDF listo para enviar' : `<img src="${e(COMP)}" alt="Comprobante">Cambiar`; }
      catch (err) { u.aviso(err.message, 'mal'); }
    };
    const b = box.querySelector('[data-informar]');
    if (b) b.onclick = async () => {
      const er = box.querySelector('[data-error]'); er.innerHTML = '';
      if (!COMP) { er.innerHTML = '<div class="error">Elegí la foto o el PDF del comprobante.</div>'; return; }
      b.disabled = true; b.textContent = 'Enviando…';
      try { const nv = await DB.entradaPago(v.entrada.id, v.entrada.codigo, COMP); COMP = ''; u.aviso('¡Listo! El club va a confirmar tu pago.', 'ok'); alListo(nv); }
      catch (x) { er.innerHTML = `<div class="error">${e(x.message)}</div>`; b.disabled = false; b.textContent = 'Enviar comprobante'; }
    };
  }
  // Cuando la entrada está paga pero el QR todavía no se habilitó, la página se actualiza sola a esa hora.
  function relojHabilita(v, alAbrir) {
    clearTimeout(RELOJ);
    if (!v.partido || v.entrada.estado !== 'Pagada' || !v.partido.ventana.antes) return;
    const [d, h] = v.partido.ventana.habilita.split(' ');
    const falta = new Date(d + 'T' + h + ':00').getTime() - Date.now() + 2000;
    if (falta > 0 && falta < 864e5 * 2) RELOJ = setTimeout(alAbrir, falta);
  }

  // ---------- #/entrada/ID-CODIGO ----------
  async function entrada(token) {
    const [id, codigo] = String(token || '').split('-');
    main().innerHTML = '<section class="seccion contenedor" style="max-width:520px"><p class="cargando">Buscando tu entrada…</p></section>';
    let v;
    try { v = await DB.entradaVer(id, codigo); } catch (err) {
      main().innerHTML = `<section class="seccion contenedor" style="max-width:520px"><div class="error">${e(err.message)}</div><p style="margin-top:12px"><a href="#/entradas">Ver las entradas a la venta</a></p></section>`; return;
    }
    DB.recordarEntrada(v.entrada);
    pintarEntrada(v);
  }
  function pintarEntrada(v) {
    const link = DB.linkEntrada(v.entrada);
    main().innerHTML = `<section class="seccion contenedor" style="max-width:520px">
      ${ticketHtml(v)}
      <div id="pago">${pagoHtml(v)}</div>
      <div class="tarjeta" style="margin-top:14px"><p class="chico" style="margin:0 0 8px">Guardá este link: con él volvés a ver tu entrada y el QR. También queda guardada en este celular, en <a href="#/entradas">Entradas</a>.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="boton boton--suave boton--chico" id="copiar-link">Copiar link</button>
        <a class="boton boton--gris boton--chico" target="_blank" rel="noopener" href="${e('https://wa.me/?text=' + encodeURIComponent('Mi entrada: ' + link))}">Mandármela por WhatsApp</a>
        <button class="boton boton--gris boton--chico" id="actualizar">Actualizar</button></div></div>
      ${v.entrada.cantidad > 1 && v.qr ? '<p class="chico" style="text-align:center;margin-top:12px">En la entrada se escanea este QR una vez por persona (o todos juntos).</p>' : ''}
    </section>`;
    conectarPago(document.getElementById('pago'), v, pintarEntrada);
    document.getElementById('copiar-link').onclick = () => u.copiar(link);
    document.getElementById('actualizar').onclick = () => entrada(v.entrada.id + '-' + v.entrada.codigo);
    relojHabilita(v, () => { if (location.hash.indexOf(v.entrada.id) >= 0) entrada(v.entrada.id + '-' + v.entrada.codigo); });
  }

  // ---------- #/entradas ----------
  async function lista() {
    const c = PC.ctx.cfg, ps = PC.ctx.pub.partidos || [];
    const mias = DB.misEntradas();
    main().innerHTML = `<section class="seccion contenedor" style="max-width:820px">
      <div class="seccion__titulo"><h2>Entradas</h2></div>
      <div id="mias"></div>
      ${ps.map(p => `<div class="tarjeta partido-venta" style="margin-bottom:14px">
        <div class="partido-venta__cab"><div><small>${e(p.torneo || 'Partido')}</small><h3>${e(c.nombre_corto || c.nombre)} vs ${e(p.rival)}</h3><span class="chico">${e(cuando(p))}${p.lugar ? ' · ' + e(p.lugar) : ''}</span></div></div>
        <div class="precios-entrada">
          <div><small>General</small><b>${u.plata(p.precio_general)}</b></div>
          <div class="precios-entrada__socio"><small>Socio al día</small><b>${p.precio_socio ? u.plata(p.precio_socio) : 'Gratis'}</b><span>1 por integrante del grupo familiar</span></div>
        </div>
        ${p.disponibles === 0 ? '<div class="error">Entradas agotadas.</div>' : `<div style="display:flex;gap:8px;flex-wrap:wrap">
          <a class="boton" href="#/socio/entradas">Soy socio: sacarla con descuento</a>
          <button class="boton boton--gris" data-comprar="${e(p.id)}">Entrada general</button></div>
          <p class="chico" style="margin:10px 0 0">El QR se habilita ${p.ventana.horas} h antes del partido${p.disponibles ? ` · quedan ${p.disponibles}` : ''}.</p>`}
        <div data-form="${e(p.id)}"></div></div>`).join('') || '<div class="tarjeta"><p class="vacio" style="padding:8px 0">Por ahora no hay entradas a la venta.</p></div>'}
    </section>`;
    main().querySelectorAll('[data-comprar]').forEach(b => b.onclick = () => formGeneral(ps.find(p => p.id === b.dataset.comprar)));
    if (mias.length) {
      const vs = (await Promise.all(mias.slice(0, 6).map(m => DB.entradaVer(m.id, m.codigo).catch(() => null)))).filter(v => v && v.partido && !v.partido.ventana.paso);
      const box = document.getElementById('mias');
      if (box && vs.length) box.innerHTML = `<div class="tarjeta" style="margin-bottom:16px"><h3 style="margin-bottom:6px">Mis entradas en este celular</h3>${vs.map(v => `<a class="fila-accion" href="#/entrada/${e(v.entrada.id + '-' + v.entrada.codigo)}" style="color:inherit;text-decoration:none"><span><b>vs ${e(v.partido.rival)}</b> <span class="chico">${e(cuando(v.partido))} · ${v.entrada.cantidad} ${v.entrada.cantidad === 1 ? 'entrada' : 'entradas'}</span></span><span class="estado estado--${v.qr ? 'ok' : v.entrada.estado === 'Pagada' ? 'gris' : 'espera'}">${v.qr ? 'Ver QR' : v.entrada.estado === 'Pagada' ? '🔒 ' + e(habilitaTxt(v.partido.ventana)) : e(v.entrada.estado)}</span></a>`).join('')}</div>`;
    }
  }
  function formGeneral(p) {
    const box = main().querySelector(`[data-form="${p.id}"]`);
    box.innerHTML = `<form class="form" id="f-gral" style="margin-top:14px;border-top:1px solid var(--linea);padding-top:14px">
      <div class="form__fila"><label class="campo"><span>Nombre</span><input name="nombre" autocomplete="given-name" required></label><label class="campo"><span>Apellido</span><input name="apellido" autocomplete="family-name" required></label></div>
      <div class="form__fila"><label class="campo"><span>DNI</span><input name="dni" inputmode="numeric" required></label><label class="campo"><span>Celular</span><input name="telefono" inputmode="tel" autocomplete="tel" required></label></div>
      <div class="form__fila"><label class="campo"><span>Email <small>(opcional)</small></span><input name="email" type="email" autocomplete="email"></label><label class="campo"><span>Cantidad</span><input name="cantidad" type="number" min="1" max="20" value="1"></label></div>
      <div class="total-pagar"><span>Total</span><b id="g-total">${u.plata(p.precio_general)}</b></div>
      <div id="f-error"></div>
      <button class="boton" type="submit">Seguir al pago</button></form>`;
    const f = box.querySelector('form');
    f.cantidad.oninput = () => { box.querySelector('#g-total').textContent = u.plata(p.precio_general * Math.max(1, u.num(f.cantidad.value) || 1)); };
    f.nombre.focus();
    f.onsubmit = async ev => {
      ev.preventDefault();
      const d = Object.fromEntries(new FormData(f).entries()); d.partido_id = p.id;
      const b = f.querySelector('button'); b.disabled = true; b.textContent = 'Reservando…';
      try { const v = await DB.entradaComprar(d); location.hash = '#/entrada/' + v.entrada.id + '-' + v.entrada.codigo; }
      catch (x) { f.querySelector('#f-error').innerHTML = `<div class="error">${e(x.message)}</div>`; b.disabled = false; b.textContent = 'Seguir al pago'; }
    };
  }

  PC.entradas = { lista, entrada, ticketHtml, pagoHtml, conectarPago, relojHabilita, cuando, habilitaTxt };
})();
