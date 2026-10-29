/* Pitazo Clubs — panel de gestión del club (#/panel). */
window.PC = window.PC || {};
(function () {
  'use strict';
  const { u, DB, PZ } = PC;
  const M = window.MOTOR, CFG = window.CONFIG;
  const e = u.esc;
  const main = () => document.getElementById('contenido');
  let DATA = null, USUARIO = null, SECCION = 'inicio';
  const F = { busca: '', filtro: 'todos', periodo: u.hoy().slice(0, 7), pagos: 'A confirmar' };

  // Store de solo lectura sobre los datos cargados, para calcular estados con el motor.
  const ro = () => ({ rows: t => DATA[t] || [], hoy: () => u.hoy(), insert() {}, update() {}, remove() {} });
  const tabla = t => DATA[t] || [];
  const socio = id => tabla('Socios').find(s => s.id === id);
  const cat = id => tabla('Categorias').find(c => c.id === id);
  const nombre = s => s ? M.nombreDe(s) : '—';
  const cfg = () => M.config(ro(), true);

  async function op(nombre, args, okMsj) {
    try {
      const r = await DB.op(nombre, args);
      DATA = r.datos;
      if (okMsj) u.aviso(typeof okMsj === 'function' ? okMsj(r.res) : okMsj, 'ok');
      return r.res;
    } catch (err) { u.aviso(err.message, 'mal'); throw err; }
  }

  // ---------- diálogo ----------
  function dialogo(titulo, html, alAbrir) {
    const d = document.getElementById('dialogo');
    d.innerHTML = `<div class="dialogo__cab"><h3>${titulo}</h3><button class="dialogo__cerrar" aria-label="Cerrar" data-cerrar>✕</button></div><div class="dialogo__cuerpo">${html}</div>`;
    d.querySelector('[data-cerrar]').onclick = () => d.close();
    if (!d.open) d.showModal();
    if (alAbrir) alAbrir(d);
    return d;
  }
  const cerrar = () => { const d = document.getElementById('dialogo'); if (d.open) d.close(); };

  // ---------- entrada ----------
  async function ver(seccion, extra) {
    document.body.classList.add('en-panel');
    SECCION = seccion || 'inicio';
    if (!DB.panelActivo()) return login();
    if (!DATA) {
      main().innerHTML = '<div class="login"><div class="tarjeta"><p class="cargando">Cargando el panel…</p></div></div>';
      try { DATA = await DB.panelDatos(); if (!USUARIO) USUARIO = DATA._usuario || (DB.demo ? { nombre: 'Tesorería (demo)', email: 'demo' } : { nombre: '' }); }
      catch (err) { DB.panelSalir(); DATA = null; return login(err.message); }
    }
    marco(extra);
  }

  function login(msj) {
    const c = PC.ctx.cfg;
    main().innerHTML = `<div class="login"><div class="tarjeta">
      ${PC.escudo(c.escudo, c.nombre, 'escudo--partido')}
      <h2 style="margin:12px 0 4px">Panel del club</h2>
      <p class="chico">${e(c.nombre || '')}</p>
      <div id="login-zona" style="margin:18px 0 6px;display:grid;justify-items:center;gap:10px"></div>
      <div id="f-error">${msj ? `<div class="error">${e(msj)}</div>` : ''}</div>
      <p class="chico" style="margin:12px 0 0"><a href="#/">← Volver a la web</a></p>
    </div></div>`;
    const zona = document.getElementById('login-zona');
    if (DB.demo) {
      zona.innerHTML = `<button class="boton" id="entrar-demo">Entrar a la demo</button><span class="chico">En la demo los cambios quedan solo en este navegador.</span>`;
      document.getElementById('entrar-demo').onclick = async () => { USUARIO = (await DB.panelIngresar()).usuario; ver(SECCION); };
      return;
    }
    if (!CFG.GOOGLE_CLIENT_ID) { zona.innerHTML = '<div class="error">Falta GOOGLE_CLIENT_ID en js/config.js.</div>'; return; }
    const arrancar = () => {
      google.accounts.id.initialize({
        client_id: CFG.GOOGLE_CLIENT_ID,
        callback: async r => {
          zona.innerHTML = '<p class="cargando">Verificando…</p>';
          try { USUARIO = (await DB.panelIngresar(r.credential)).usuario; DATA = null; ver(SECCION); }
          catch (err) { login(err.message); }
        }
      });
      google.accounts.id.renderButton(zona, { theme: 'outline', size: 'large', text: 'signin_with', locale: 'es' });
    };
    if (window.google && google.accounts) arrancar();
    else { const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.onload = arrancar; document.head.appendChild(s); }
  }

  const MENU = [
    ['inicio', 'Inicio', '🏠'], ['socios', 'Socios', '👥'], ['cuotas', 'Cuotas', '🧾'], ['pagos', 'Pagos', '💵'],
    ['acceso', 'Control de acceso', '📷'], ['solicitudes', 'Solicitudes', '✉️'], ['noticias', 'Noticias', '📰'], ['club', 'Ajustes del club', '⚙️']
  ];
  function marco(extra) {
    const c = cfg();
    const burbuja = {
      pagos: tabla('Pagos').filter(p => p.estado === 'A confirmar').length,
      solicitudes: tabla('Solicitudes').filter(s => s.estado === 'Nueva').length
    };
    main().innerHTML = `<div class="panel">
      <aside class="panel__lado">
        <a class="panel__club" href="#/">${PC.escudo(c.escudo, c.nombre, 'escudo--chico')}<span>${e(c.nombre_corto || c.nombre)}<small>Ver la web ↗</small></span></a>
        ${MENU.map(([k, n, i]) => `<a class="item ${SECCION === k ? 'activo' : ''}" href="#/panel/${k}"><span aria-hidden="true">${i}</span>${n}${burbuja[k] ? `<span class="burbuja">${burbuja[k]}</span>` : ''}</a>`).join('')}
        <div class="pie-lado">${e(USUARIO && (USUARIO.nombre || USUARIO.email) || '')}<br><button class="link" id="salir" style="color:#ccc">Salir</button>${DB.demo ? ' · <button class="link" id="reiniciar" style="color:#ccc">Reiniciar demo</button>' : ''}</div>
      </aside>
      <nav class="panel__movil">${MENU.map(([k, n]) => `<a class="${SECCION === k ? 'activo' : ''}" href="#/panel/${k}">${n}${burbuja[k] ? ' (' + burbuja[k] + ')' : ''}</a>`).join('')}<a href="#/">Web ↗</a></nav>
      <div class="panel__main" id="pm"></div>
    </div>`;
    document.getElementById('salir').onclick = () => { DB.panelSalir(); DATA = null; USUARIO = null; login(); };
    const rd = document.getElementById('reiniciar');
    if (rd) rd.onclick = () => { if (confirm('¿Volver los datos de la demo al estado inicial?')) { DB.reiniciarDemo(); DATA = null; location.reload(); } };
    const fn = { inicio, socios, cuotas, pagos, acceso, solicitudes, noticias, club }[SECCION] || inicio;
    fn(document.getElementById('pm'), extra);
  }
  const titulo = (t, acciones) => `<div class="panel__titulo"><h1>${t}</h1><div style="display:flex;gap:8px;flex-wrap:wrap">${acciones || ''}</div></div>`;

  // ---------- Inicio ----------
  function inicio(el) {
    const r = M.resumen(ro(), u.hoy().slice(0, 7));
    const pct = r.pagadores ? Math.round(r.alDia * 100 / r.pagadores) : 0;
    const pctCobro = r.esperado ? Math.min(100, Math.round(r.cobrado * 100 / r.esperado)) : 0;
    const aConf = tabla('Pagos').filter(p => p.estado === 'A confirmar');
    const sols = tabla('Solicitudes').filter(s => s.estado === 'Nueva');
    el.innerHTML = titulo('Inicio', `<a class="boton boton--suave" href="#/panel/acceso">📷 Control de acceso</a><button class="boton" id="nuevo-socio">+ Nuevo socio</button>`) + `
      <div class="kpis">
        <div class="kpi"><small>Socios activos</small><b>${r.socios}</b><span>${r.altas ? r.altas + ' altas en ' + e(r.nombrePeriodo.split(' ')[0]) : '&nbsp;'}</span></div>
        <div class="kpi"><small>Al día</small><b>${pct}%</b><span>${r.alDia} de ${r.pagadores} cuentas</span><div class="barra"><i style="width:${pct}%"></i></div></div>
        <div class="kpi"><small>Cobrado en ${e(r.nombrePeriodo.split(' ')[0])}</small><b>${u.plata(r.cobrado)}</b><span>${r.esperado ? 'de ' + u.plata(r.esperado) + ' en cuotas del mes' : 'Todavía no generaste las cuotas'}</span>${r.esperado ? `<div class="barra"><i style="width:${pctCobro}%"></i></div>` : ''}</div>
        <div class="kpi"><small>Deuda total</small><b style="color:var(--mal)">${u.plata(r.deuda)}</b><span>${r.deudores.length} socios con deuda</span></div>
      </div>
      <div class="grilla-2">
        <div class="tarjeta">
          <div class="seccion__titulo" style="margin-bottom:8px"><h3>Pagos para confirmar</h3><a href="#/panel/pagos">Ver todos</a></div>
          ${aConf.length ? aConf.slice(0, 5).map(filaPagoConfirmar).join('') : '<p class="chico" style="margin:0">No hay pagos informados por confirmar.</p>'}
        </div>
        <div class="tarjeta">
          <div class="seccion__titulo" style="margin-bottom:8px"><h3>Solicitudes nuevas</h3><a href="#/panel/solicitudes">Ver todas</a></div>
          ${sols.length ? sols.slice(0, 4).map(s => `<div class="fila-accion"><div><b>${e(s.nombre + ' ' + s.apellido)}</b><div class="chico">${e(cat(s.categoria_id) ? cat(s.categoria_id).nombre : '')} · ${e(u.corta(s.fecha))}</div></div><a class="boton boton--suave boton--chico" href="#/panel/solicitudes">Revisar</a></div>`).join('') : '<p class="chico" style="margin:0">No hay solicitudes nuevas.</p>'}
        </div>
        <div class="tarjeta">
          <div class="seccion__titulo" style="margin-bottom:8px"><h3>Los que más deben</h3><a href="#/panel/socios?f=deuda">Ver lista</a></div>
          ${r.deudores.slice(0, 5).map(d => { const s = socio(d.id); return `<div class="fila-accion"><button class="link" data-socio="${e(d.id)}">${e(d.nombre)}</button><span><b>${u.plata(d.deuda)}</b> <a class="boton boton--gris boton--chico" target="_blank" rel="noopener" href="${e(u.wa(s && s.telefono, recordatorio(s, d.deuda)))}">WhatsApp</a></span></div>`; }).join('') || '<p class="chico">Nadie debe cuotas vencidas. 🎉</p>'}
        </div>
        <div class="tarjeta ia-caja">
          <span class="ia-etq">✨ Resumen para la comisión</span>
          <p class="chico" style="margin:6px 0 10px">Un texto con los números del mes para leer en la reunión de comisión directiva.</p>
          <div id="res-ia"></div>
          <button class="boton boton--suave" id="btn-ia">Armar resumen de ${e(r.nombrePeriodo)}</button>
        </div>
      </div>
      <div class="tarjeta" style="margin-top:18px" id="pz-panel"><p class="chico">Buscando el próximo partido en Pitazo Final…</p></div>`;
    document.getElementById('nuevo-socio').onclick = () => fichaSocio(null);
    conectarPagosConfirmar(el);
    el.querySelectorAll('[data-socio]').forEach(b => b.onclick = () => fichaSocio(b.dataset.socio));
    document.getElementById('btn-ia').onclick = async ev => {
      ev.target.disabled = true; ev.target.textContent = 'Escribiendo…';
      try {
        const res = await op('resumenComision', { periodo: r.periodo });
        document.getElementById('res-ia').innerHTML = `<p style="white-space:pre-line;background:#fff;border-radius:8px;padding:12px;margin:0 0 10px">${e(res.texto)}</p>${res.ia ? '' : '<p class="chico">Demo: texto armado con los números, sin IA. Conectado, lo redacta Gemini con los mismos datos.</p>'}`;
        ev.target.textContent = 'Copiar texto'; ev.target.disabled = false; ev.target.onclick = () => u.copiar(res.texto);
      } catch (x) { ev.target.disabled = false; ev.target.textContent = 'Reintentar'; }
    };
    proximoPanel();
  }
  async function proximoPanel() {
    const box = document.getElementById('pz-panel');
    const c = cfg();
    if (!c.pitazo_club_id) { box.innerHTML = '<p class="chico" style="margin:0">Vinculá el club con Pitazo Final en <a href="#/panel/club">Ajustes</a> para ver fixture y resultados.</p>'; return; }
    try { await PZ.cargar(c.pitazo_club_id, c.pitazo_liga_id || 'L01'); } catch (x) { box.innerHTML = ''; return; }
    if (!document.getElementById('pz-panel')) return;
    const p = PZ.proximo(c.pitazo_club_id);
    box.innerHTML = p ? `<div class="seccion__titulo" style="margin-bottom:10px"><h3>Próximo partido</h3><span class="chico">${e(PZ.origen)}</span></div><div style="max-width:520px">${PC.sitio.tarjetaPartido(p, c.pitazo_club_id, 'Próximo partido')}</div>` : '<p class="chico" style="margin:0">No hay partidos programados en Pitazo Final.</p>';
  }
  function recordatorio(s, deuda) {
    const c = cfg();
    return `Hola ${s ? s.nombre : ''}! Te escribimos del ${c.nombre_corto || c.nombre}. Te recordamos que tenés cuotas pendientes por ${u.plata(deuda)}. ` +
      (c.cobro_alias ? `Podés transferir al alias ${c.cobro_alias} y subir el comprobante en tu carnet digital: ` : 'Podés ver el detalle en tu carnet digital: ') + linkWeb('#/socio') + ' ¡Gracias por bancar al club!';
  }
  const linkWeb = h => location.origin + location.pathname + location.search + h;

  // ---------- Socios ----------
  function socios(el, extra) {
    if (extra && extra.f) F.filtro = extra.f;
    const st = ro();
    const lista = tabla('Socios').map(s => ({ s, est: M.estadoConTitular(st, s) }));
    const filtros = [['todos', 'Activos'], ['aldia', 'Al día'], ['deuda', 'Con deuda'], ['baja', 'Bajas']];
    const q = F.busca.toLowerCase().trim();
    const vis = lista.filter(({ s, est }) => {
      if (F.filtro === 'baja' ? s.estado !== 'Baja' : s.estado === 'Baja') return false;
      if (F.filtro === 'aldia' && !est.alDia) return false;
      if (F.filtro === 'deuda' && est.alDia) return false;
      return !q || (nombre(s) + ' ' + s.dni + ' ' + s.numero).toLowerCase().includes(q);
    }).sort((a, b) => u.num(a.s.numero) - u.num(b.s.numero));
    el.innerHTML = titulo('Socios', `<button class="boton boton--gris" id="exportar">Descargar CSV</button><button class="boton" id="nuevo">+ Nuevo socio</button>`) + `
      <div class="barra-herr"><input class="buscar" type="search" placeholder="Buscar por nombre, DNI o número" value="${e(F.busca)}" id="busca">
        <div class="pestanas" style="margin:0">${filtros.map(([k, n]) => `<button data-f="${k}" aria-selected="${F.filtro === k}">${n}</button>`).join('')}</div></div>
      <div class="tabla-envoltorio"><table class="tabla"><thead><tr><th>N°</th><th>Socio</th><th class="opc">DNI</th><th class="opc">Categoría</th><th>Estado</th><th class="der opc">Debe</th></tr></thead>
      <tbody>${vis.map(({ s, est }) => `<tr class="clic" data-id="${e(s.id)}"><td>${e(s.numero)}</td><td><b>${e(nombre(s))}</b>${s.titular_id ? `<div class="chico">Familia de ${e(nombre(socio(s.titular_id)))}</div>` : ''}</td><td class="opc">${e(s.dni)}</td><td class="opc">${e(cat(s.categoria_id) ? cat(s.categoria_id).nombre : '')}</td>
        <td><span class="estado estado--${!est.activo ? 'gris' : est.alDia ? (est.aConfirmar ? 'espera' : 'ok') : 'mal'}">${e(est.etiqueta)}</span></td><td class="der opc">${est.deuda && !s.titular_id ? u.plata(est.deuda) : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="chico">No hay socios con ese filtro.</td></tr>'}</tbody></table></div>
      <p class="chico">${vis.length} socios</p>`;
    const b = document.getElementById('busca');
    b.oninput = () => { F.busca = b.value; socios(el); const n = document.getElementById('busca'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
    el.querySelectorAll('[data-f]').forEach(x => x.onclick = () => { F.filtro = x.dataset.f; socios(el); });
    el.querySelectorAll('tr[data-id]').forEach(tr => tr.onclick = () => fichaSocio(tr.dataset.id));
    document.getElementById('nuevo').onclick = () => fichaSocio(null);
    document.getElementById('exportar').onclick = () => {
      const cols = ['numero', 'apellido', 'nombre', 'dni', 'telefono', 'email', 'categoria', 'estado', 'deuda'];
      const filas = vis.map(({ s, est }) => [s.numero, s.apellido, s.nombre, s.dni, s.telefono, s.email, cat(s.categoria_id) ? cat(s.categoria_id).nombre : '', est.etiqueta, est.deuda]);
      const csv = [cols].concat(filas).map(f => f.map(v => '"' + String(v === undefined ? '' : v).replace(/"/g, '""') + '"').join(';')).join('\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })); a.download = 'socios.csv'; a.click();
    };
  }

  function fichaSocio(id, pestana) {
    const s = id ? socio(id) : null;
    pestana = pestana || (s ? 'cuenta' : 'datos');
    const st = ro();
    const est = s ? M.estadoConTitular(st, s) : null;
    const tabs = s ? [['cuenta', 'Cuenta'], ['datos', 'Datos'], ['carnet', 'Carnet y código']] : [];
    let cuerpo = '';
    if (pestana === 'datos') cuerpo = formSocio(s);
    else if (pestana === 'carnet') {
      const v = M.vistaSocio(st, s.id);
      cuerpo = `<div style="text-align:center">${PC.qrSvg(v.qr, 190)}<p style="margin:8px 0 2px">Código para entrar al carnet digital: <b style="font-size:1.4rem;letter-spacing:.15em">${e(s.pin)}</b></p>
        <p class="chico">El socio entra en <b>${e(linkWeb('#/socio'))}</b> con su DNI y este código.</p>
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:10px">
          ${s.telefono ? `<a class="boton" target="_blank" rel="noopener" href="${e(u.wa(s.telefono, `Hola ${s.nombre}! Ya tenés tu carnet digital del ${cfg().nombre_corto || cfg().nombre}. Entrá a ${linkWeb('#/socio')} con tu DNI y el código ${s.pin}.`))}">Mandar por WhatsApp</a>` : ''}
          <button class="boton boton--gris" data-cod="pin">Nuevo código</button><button class="boton boton--gris" data-cod="qr">Invalidar QR</button></div>
        <p class="chico" style="margin-top:10px">"Invalidar QR" sirve si alguien le sacó foto al carnet: el QR viejo deja de funcionar.</p></div>`;
    } else {
      const titular = s.titular_id ? socio(s.titular_id) : null;
      const paga = titular || s;
      const cuotas = M.cuotasDe(st, paga.id);
      const pend = cuotas.filter(c => c.estado === 'Pendiente');
      cuerpo = `${titular ? `<p class="chico">Integrante del grupo familiar de <button class="link" data-ir="${e(titular.id)}">${e(nombre(titular))}</button>, que paga las cuotas.</p>` : ''}
        <p>Estado: <span class="estado estado--${!est.activo ? 'gris' : est.alDia ? 'ok' : 'mal'}">${e(est.etiqueta)}</span> ${est.deuda ? ' · debe <b>' + u.plata(est.deuda) + '</b>' : ''}</p>
        ${!titular ? `<p class="chico" style="margin-top:-4px">Cuota mensual: <b>${u.plata(M.montoMensual(st, s))}</b> (categoría + actividades)</p>` : ''}
        ${pend.length ? `<h4 style="margin:14px 0 4px">Registrar un pago</h4>
          <ul class="cuotas">${pend.map(c => `<li><input type="checkbox" data-c="${e(c.id)}" checked><div class="cuotas__txt"><b>${e(u.periodo(c.periodo))}</b><span class="chico">vence ${e(u.corta(c.vence))}</span></div><span class="cuotas__monto">${u.plata(c.monto)}</span></li>`).join('')}</ul>
          <div class="form__fila" style="margin-top:8px"><label class="campo"><span>Medio</span><select id="medio"><option>Efectivo</option><option>Transferencia</option><option>Mercado Pago</option><option>Débito/Crédito</option></select></label>
          <label class="campo"><span>Monto</span><input id="monto" inputmode="numeric" value="${pend.reduce((a, c) => a + u.num(c.monto), 0)}"></label></div>
          <button class="boton boton--ok boton--ancho" id="registrar" style="margin-top:10px">Registrar pago</button>
          ${s.telefono && !titular ? `<a class="boton boton--gris boton--ancho" style="margin-top:8px" target="_blank" rel="noopener" href="${e(u.wa(paga.telefono, recordatorio(paga, est.deuda)))}">Recordatorio por WhatsApp</a>` : ''}` : '<div class="exito" style="margin-top:10px">No tiene cuotas pendientes.</div>'}
        <h4 style="margin:18px 0 4px">Historial</h4>
        <ul class="cuotas">${cuotas.slice().reverse().slice(0, 12).map(c => `<li><div class="cuotas__txt"><b>${e(u.periodo(c.periodo))}</b><span class="chico">${e(c.concepto)}</span></div><span class="cuotas__monto">${u.plata(c.monto)}</span><span class="estado estado--${c.estado === 'Pagada' ? 'ok' : c.estado === 'A confirmar' ? 'espera' : 'mal'}">${e(c.estado)}</span></li>`).join('') || '<li class="chico">Sin cuotas generadas todavía.</li>'}</ul>`;
    }
    const d = dialogo(s ? e(nombre(s)) + ` <span class="chico">N° ${e(s.numero)}</span>` : 'Nuevo socio',
      (tabs.length ? `<div class="pestanas">${tabs.map(([k, n]) => `<button data-t="${k}" aria-selected="${pestana === k}">${n}</button>`).join('')}</div>` : '') + cuerpo);
    d.querySelectorAll('[data-t]').forEach(b => b.onclick = () => fichaSocio(id, b.dataset.t));
    d.querySelectorAll('[data-ir]').forEach(b => b.onclick = () => fichaSocio(b.dataset.ir));
    d.querySelectorAll('[data-cod]').forEach(b => b.onclick = async () => { await op('nuevoCodigo', { id, que: b.dataset.cod }, b.dataset.cod === 'pin' ? 'Código nuevo generado' : 'QR anterior invalidado'); fichaSocio(id, 'carnet'); });
    const reg = d.querySelector('#registrar');
    if (reg) {
      const total = () => { d.querySelector('#monto').value = [...d.querySelectorAll('[data-c]:checked')].reduce((a, ch) => a + u.num((tabla('Cuotas').find(c => c.id === ch.dataset.c) || {}).monto), 0); };
      d.querySelectorAll('[data-c]').forEach(ch => ch.onchange = total);
      reg.onclick = async () => {
        const cuotas = [...d.querySelectorAll('[data-c]:checked')].map(x => x.dataset.c);
        if (!cuotas.length) return u.aviso('Marcá al menos una cuota', 'mal');
        reg.disabled = true;
        try { await op('registrarPago', { pago: { socio_id: id, cuotas, medio: d.querySelector('#medio').value, monto: d.querySelector('#monto').value } }, 'Pago registrado'); fichaSocio(id, 'cuenta'); refrescar(); }
        catch (x) { reg.disabled = false; }
      };
    }
    const f = d.querySelector('#f-socio');
    if (f) conectarFormSocio(f, s);
  }
  function formSocio(s) {
    s = s || {};
    const acts = M.lista(s.actividades);
    const titulares = tabla('Socios').filter(x => x.estado !== 'Baja' && !x.titular_id && x.id !== s.id);
    return `<form class="form" id="f-socio">
      <div class="form__fila"><label class="campo"><span>Nombre</span><input name="nombre" value="${e(s.nombre)}" required></label><label class="campo"><span>Apellido</span><input name="apellido" value="${e(s.apellido)}" required></label></div>
      <div class="form__fila"><label class="campo"><span>DNI</span><input name="dni" inputmode="numeric" value="${e(s.dni)}" required></label><label class="campo"><span>Nacimiento</span><input name="nacimiento" type="date" value="${e(u.iso(s.nacimiento))}"></label></div>
      <div class="form__fila"><label class="campo"><span>Celular</span><input name="telefono" inputmode="tel" value="${e(s.telefono)}"></label><label class="campo"><span>Email</span><input name="email" type="email" value="${e(s.email)}"></label></div>
      <label class="campo"><span>Dirección</span><input name="direccion" value="${e(s.direccion)}"></label>
      <div class="form__fila"><label class="campo"><span>Categoría</span><select name="categoria_id">${tabla('Categorias').map(c => `<option value="${e(c.id)}" ${c.id === s.categoria_id ? 'selected' : ''}>${e(c.nombre)} · ${u.plata(c.monto)}</option>`).join('')}</select></label>
        <label class="campo"><span>Grupo familiar de</span><select name="titular_id"><option value="">— Paga su propia cuota —</option>${titulares.map(t => `<option value="${e(t.id)}" ${t.id === s.titular_id ? 'selected' : ''}>${e(nombre(t))} (N° ${e(t.numero)})</option>`).join('')}</select></label></div>
      <div class="campo"><span>Actividades</span><div class="checks">${tabla('Actividades').map(a => `<label class="check"><input type="checkbox" name="actividades" value="${e(a.id)}" ${acts.includes(a.id) ? 'checked' : ''}>${e(a.nombre)}${u.num(a.monto) ? ' +' + u.plata(a.monto) : ''}</label>`).join('')}</div></div>
      ${s.id ? `<label class="campo"><span>Estado</span><select name="estado">${['Activo', 'Suspendido', 'Baja'].map(x => `<option ${x === (s.estado || 'Activo') ? 'selected' : ''}>${x}</option>`).join('')}</select></label>` : ''}
      <label class="campo"><span>Observaciones</span><textarea name="observaciones" style="min-height:70px">${e(s.observaciones)}</textarea></label>
      <div id="f-error"></div>
      <button class="boton" type="submit">${s.id ? 'Guardar cambios' : 'Dar de alta'}</button>
    </form>`;
  }
  function conectarFormSocio(f, s) {
    f.onsubmit = async ev => {
      ev.preventDefault();
      const fd = new FormData(f), fila = Object.fromEntries(fd.entries());
      fila.actividades = fd.getAll('actividades').join(', ');
      if (s) fila.id = s.id;
      try {
        const r = await op('guardar', { tabla: 'Socios', fila }, s ? 'Cambios guardados' : 'Socio dado de alta');
        fichaSocio(r.id, s ? 'datos' : 'carnet'); refrescar();
      } catch (x) { f.querySelector('#f-error').innerHTML = `<div class="error">${e(x.message)}</div>`; }
    };
  }
  // Repinta la sección de atrás sin cerrar el diálogo.
  function refrescar() { const pm = document.getElementById('pm'); if (!pm) return; const fn = { inicio, socios, cuotas, pagos, acceso, solicitudes, noticias, club }[SECCION]; if (fn && SECCION !== 'acceso') fn(pm); }

  // ---------- Cuotas ----------
  function cuotas(el) {
    const cs = tabla('Cuotas').filter(c => c.periodo === F.periodo && c.estado !== 'Anulada');
    const pag = cs.filter(c => c.estado === 'Pagada'), conf = cs.filter(c => c.estado === 'A confirmar');
    const tot = cs.reduce((a, c) => a + u.num(c.monto), 0), cob = pag.reduce((a, c) => a + u.num(c.monto), 0);
    const periodos = [...new Set(tabla('Cuotas').map(c => c.periodo).concat([u.hoy().slice(0, 7), sumarMes(u.hoy().slice(0, 7), 1)]))].sort().reverse();
    el.innerHTML = titulo('Cuotas') + `
      <div class="barra-herr"><label class="campo" style="min-width:200px"><span>Mes</span><select id="periodo">${periodos.map(p => `<option value="${p}" ${p === F.periodo ? 'selected' : ''}>${e(u.periodo(p))}</option>`).join('')}</select></label>
        <button class="boton" id="generar" style="align-self:end">Generar cuotas de ${e(u.periodo(F.periodo))}</button></div>
      <div class="kpis">
        <div class="kpi"><small>Cuotas</small><b>${cs.length}</b><span>${u.plata(tot)}</span></div>
        <div class="kpi"><small>Pagadas</small><b style="color:var(--ok)">${pag.length}</b><span>${u.plata(cob)}</span></div>
        <div class="kpi"><small>A confirmar</small><b style="color:var(--espera)">${conf.length}</b><span>comprobantes subidos</span></div>
        <div class="kpi"><small>Pendientes</small><b style="color:var(--mal)">${cs.length - pag.length - conf.length}</b><span>${u.plata(tot - cob - conf.reduce((a, c) => a + u.num(c.monto), 0))}</span></div>
      </div>
      <p class="chico">Las cuotas se generan para cada socio activo que paga (los integrantes de un grupo familiar los paga el titular). El monto es la categoría más las actividades. Vencen el día ${e(cfg().cuota_vence_dia || '10')} de cada mes.</p>
      <div class="tabla-envoltorio"><table class="tabla"><thead><tr><th>Socio</th><th class="der">Monto</th><th>Estado</th><th></th></tr></thead><tbody>
      ${cs.sort((a, b) => nombre(socio(a.socio_id)).localeCompare(nombre(socio(b.socio_id)))).map(c => `<tr><td><button class="link" data-socio="${e(c.socio_id)}">${e(nombre(socio(c.socio_id)))}</button></td><td class="der">${u.plata(c.monto)}</td><td><span class="estado estado--${c.estado === 'Pagada' ? 'ok' : c.estado === 'A confirmar' ? 'espera' : 'mal'}">${e(c.estado)}</span></td>
        <td class="der">${c.estado === 'Pendiente' ? `<button class="boton boton--gris boton--chico" data-anular="${e(c.id)}">Anular</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="4" class="chico">No hay cuotas de este mes. Tocá "Generar cuotas".</td></tr>'}
      </tbody></table></div>`;
    document.getElementById('periodo').onchange = ev => { F.periodo = ev.target.value; cuotas(el); };
    document.getElementById('generar').onclick = async () => {
      if (!confirm('¿Generar las cuotas de ' + u.periodo(F.periodo) + ' para todos los socios activos que todavía no la tienen?')) return;
      await op('generarCuotas', { periodo: F.periodo }, r => r.creadas ? `Se generaron ${r.creadas} cuotas por ${u.plata(r.total)}` : 'No había cuotas para generar: todos ya la tenían.');
      cuotas(el);
    };
    el.querySelectorAll('[data-socio]').forEach(b => b.onclick = () => fichaSocio(b.dataset.socio));
    el.querySelectorAll('[data-anular]').forEach(b => b.onclick = async () => { if (confirm('¿Anular esta cuota?')) { await op('borrar', { tabla: 'Cuotas', id: b.dataset.anular }, 'Cuota anulada'); cuotas(el); } });
  }
  function sumarMes(p, n) { const [a, m] = p.split('-').map(Number); const d = new Date(a, m - 1 + n, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }

  // ---------- Pagos ----------
  function filaPagoConfirmar(p) {
    const s = socio(p.socio_id);
    const per = M.lista(p.cuotas).map(id => tabla('Cuotas').find(c => c.id === id)).filter(Boolean).map(c => u.periodo(c.periodo)).join(', ');
    return `<div class="fila-accion"><div><b>${e(nombre(s))}</b> · ${u.plata(p.monto)}<div class="chico">${e(per)} · ${e(p.medio)} · ${e(u.corta(p.fecha))}</div></div>
      <span style="display:flex;gap:6px">${p.comprobante ? `<button class="boton boton--gris boton--chico" data-ver="${e(p.id)}">Ver comprobante</button>` : ''}<button class="boton boton--ok boton--chico" data-ok="${e(p.id)}">Confirmar</button><button class="boton boton--gris boton--chico" data-no="${e(p.id)}">Rechazar</button></span></div>`;
  }
  function conectarPagosConfirmar(el) {
    el.querySelectorAll('[data-ver]').forEach(b => b.onclick = () => {
      const p = tabla('Pagos').find(x => x.id === b.dataset.ver);
      // Imagen embebida (demo) o link a Drive (conectado: el archivo es privado y lo ven solo los usuarios del panel).
      if (!/^(https?:|data:)/.test(p.comprobante)) p.comprobante = PC.RAIZ + p.comprobante;
      const esImg = /^data:image\//.test(p.comprobante) || /\.(svg|png|jpe?g)$/i.test(p.comprobante);
      dialogo('Comprobante · ' + e(nombre(socio(p.socio_id))), `${!esImg ? `<p><a class="boton" href="${e(p.comprobante)}" target="_blank" rel="noopener">Abrir comprobante ↗</a></p>` : `<img src="${e(p.comprobante)}" alt="Comprobante" style="width:100%;border-radius:8px">`}
        <p style="margin-top:12px">Informó <b>${u.plata(p.monto)}</b> por ${e(p.medio)}. Fijate que el monto haya entrado en la cuenta del club antes de confirmar.</p>
        <div style="display:flex;gap:8px"><button class="boton boton--ok" data-ok="${e(p.id)}">Confirmar</button><button class="boton boton--gris" data-no="${e(p.id)}">Rechazar</button></div>`, d => conectarPagosConfirmar(d));
    });
    el.querySelectorAll('[data-ok]').forEach(b => b.onclick = async () => { await op('resolverPago', { id: b.dataset.ok, aprobar: true }, 'Pago confirmado: el socio ya figura al día'); cerrar(); marco(); });
    el.querySelectorAll('[data-no]').forEach(b => b.onclick = async () => {
      const motivo = prompt('¿Por qué se rechaza? (lo ve el socio)', 'No encontramos la transferencia');
      if (motivo === null) return;
      await op('resolverPago', { id: b.dataset.no, aprobar: false, motivo }, 'Pago rechazado'); cerrar(); marco();
    });
  }
  function pagos(el) {
    const aConf = tabla('Pagos').filter(p => p.estado === 'A confirmar');
    const lista = tabla('Pagos').filter(p => p.estado !== 'A confirmar').sort((a, b) => a.fecha < b.fecha ? 1 : -1);
    const mes = u.hoy().slice(0, 7);
    const delMes = lista.filter(p => p.estado === 'Confirmado' && u.iso(p.fecha).slice(0, 7) === mes);
    const porMedio = {}; delMes.forEach(p => { porMedio[p.medio] = (porMedio[p.medio] || 0) + u.num(p.monto); });
    el.innerHTML = titulo('Pagos', '<button class="boton" id="cargar">+ Registrar pago</button>') + `
      <div class="tarjeta" style="margin-bottom:18px"><h3 style="margin-bottom:6px">Informados por los socios, para confirmar</h3>
        ${aConf.length ? aConf.map(filaPagoConfirmar).join('') : '<p class="chico" style="margin:0">No hay comprobantes para revisar.</p>'}</div>
      <div class="kpis">${Object.entries(porMedio).map(([k, v]) => `<div class="kpi"><small>${e(k)} · ${e(u.periodo(mes).split(' ')[0])}</small><b>${u.plata(v)}</b></div>`).join('')}</div>
      <div class="tabla-envoltorio"><table class="tabla"><thead><tr><th>Fecha</th><th>Socio</th><th class="opc">Medio</th><th class="der">Monto</th><th>Estado</th></tr></thead><tbody>
        ${lista.slice(0, 150).map(p => `<tr><td>${e(u.corta(p.fecha))}</td><td><button class="link" data-socio="${e(p.socio_id)}">${e(nombre(socio(p.socio_id)))}</button></td><td class="opc">${e(p.medio)}</td><td class="der">${u.plata(p.monto)}</td><td><span class="estado estado--${p.estado === 'Confirmado' ? 'ok' : 'mal'}">${e(p.estado)}</span></td></tr>`).join('')}
      </tbody></table></div>
      <p class="chico">La plata entra directo en la cuenta del club. Acá queda el registro para saber quién pagó.</p>`;
    conectarPagosConfirmar(el);
    el.querySelectorAll('[data-socio]').forEach(b => b.onclick = () => fichaSocio(b.dataset.socio));
    document.getElementById('cargar').onclick = () => elegirSocio(id => fichaSocio(id, 'cuenta'));
  }
  function elegirSocio(alElegir) {
    const lista = tabla('Socios').filter(s => s.estado !== 'Baja');
    const d = dialogo('Elegí el socio', `<input class="buscar" id="bs" placeholder="Nombre, DNI o número" autofocus><div id="rs" style="margin-top:10px"></div>`);
    const pintar = () => {
      const q = d.querySelector('#bs').value.toLowerCase();
      d.querySelector('#rs').innerHTML = lista.filter(s => !q || (nombre(s) + ' ' + s.dni + ' ' + s.numero).toLowerCase().includes(q)).slice(0, 12)
        .map(s => `<div class="fila-accion"><span><b>${e(nombre(s))}</b> <span class="chico">N° ${e(s.numero)} · DNI ${e(s.dni)}</span></span><button class="boton boton--suave boton--chico" data-id="${e(s.id)}">Elegir</button></div>`).join('');
      d.querySelectorAll('[data-id]').forEach(b => b.onclick = () => alElegir(b.dataset.id));
    };
    d.querySelector('#bs').oninput = pintar; pintar();
  }

  // ---------- Control de acceso ----------
  let STREAM = null, LEYENDO = false, ULTIMO = { t: '', h: 0 };
  function pararCamara() { LEYENDO = false; if (STREAM) { STREAM.getTracks().forEach(t => t.stop()); STREAM = null; } }
  window.addEventListener('hashchange', pararCamara);
  function acceso(el) {
    const hoy = tabla('Accesos').filter(a => String(a.fecha_hora).slice(0, 10) === u.hoy()).sort((a, b) => a.fecha_hora < b.fecha_hora ? 1 : -1);
    el.innerHTML = titulo('Control de acceso') + `
      <div class="grilla-2">
        <div>
          <div class="lector" id="lector"><video id="video" playsinline muted></video><div class="lector__marco"></div></div>
          <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button class="boton" id="camara">📷 Abrir cámara</button>
            <label class="campo" style="flex:1;min-width:160px"><input id="lugar" placeholder="Lugar (ej: Cancha, Pileta)" value="${e(sessionStorage.getItem('pc_lugar') || 'Entrada')}"></label></div>
          <form id="f-dni" style="display:flex;gap:8px;margin-top:10px"><input class="buscar" id="dni" inputmode="numeric" placeholder="O escribí el DNI"><button class="boton boton--gris">Buscar</button></form>
        </div>
        <div>
          <div id="resultado"><div class="tarjeta"><p class="chico" style="margin:0">Apuntá la cámara al QR del carnet digital del socio. Si está al día se pone verde; si debe cuotas, rojo.</p></div></div>
          <div class="tarjeta" style="margin-top:14px"><h3 style="margin-bottom:6px">Ingresos de hoy (${hoy.length})</h3>
            <div id="log">${hoy.slice(0, 12).map(a => `<div class="fila-accion"><span><b>${e(a.nombre)}</b> <span class="chico">${e(String(a.fecha_hora).slice(11, 16))} · ${e(a.lugar)}</span></span><span class="estado estado--${a.resultado === 'Permitido' ? 'ok' : 'mal'}">${e(a.resultado)}</span></div>`).join('') || '<p class="chico" style="margin:0">Todavía nadie.</p>'}</div></div>
        </div>
      </div>`;
    document.getElementById('lugar').onchange = ev => sessionStorage.setItem('pc_lugar', ev.target.value);
    document.getElementById('f-dni').onsubmit = ev => { ev.preventDefault(); const v = document.getElementById('dni').value; if (v) validar(v); };
    document.getElementById('camara').onclick = abrirCamara;
  }
  async function validar(leido) {
    const ahora = Date.now();
    if (leido === ULTIMO.t && ahora - ULTIMO.h < 4000) return; // mismo QR seguido
    ULTIMO = { t: leido, h: ahora };
    try {
      const r = await op('validarAcceso', { leido, lugar: document.getElementById('lugar') ? document.getElementById('lugar').value : '' });
      try { navigator.vibrate && navigator.vibrate(r.ok ? 80 : [80, 60, 80]); } catch (x) {}
      pitido(r.ok);
      const box = document.getElementById('resultado');
      if (box) box.innerHTML = `<div class="resultado-acceso resultado-acceso--${r.ok ? 'ok' : 'mal'}">
        <div class="avatar" style="background:rgba(255,255,255,.2);width:64px;height:64px">${r.socio ? e(u.iniciales(r.socio.nombre)) : '?'}</div>
        <div><b>${r.ok ? 'ADELANTE' : 'NO PASA'}</b><div style="font-size:1.15rem;font-weight:700;margin-top:6px">${r.socio ? e(r.socio.nombre) + ' · N° ' + e(r.socio.numero) : ''}</div>
        <div>${e(r.motivo)}${r.socio && r.socio.categoria ? ' · ' + e(r.socio.categoria) : ''}</div>
        ${r.socio && !r.ok ? `<button class="boton boton--blanco boton--chico" style="margin-top:8px" data-socio="${e(r.socio.id)}">Cobrar ahora</button>` : ''}</div></div>`;
      if (box) box.querySelectorAll('[data-socio]').forEach(b => b.onclick = () => fichaSocio(b.dataset.socio, 'cuenta'));
      const log = document.getElementById('log');
      if (log) { const vacio = log.querySelector('p.chico'); if (vacio) vacio.remove(); }
      if (log) log.insertAdjacentHTML('afterbegin', `<div class="fila-accion"><span><b>${e(r.socio ? r.socio.nombre : 'Desconocido')}</b> <span class="chico">${u.ahora().slice(11)}</span></span><span class="estado estado--${r.ok ? 'ok' : 'mal'}">${r.ok ? 'Permitido' : 'Rechazado'}</span></div>`);
    } catch (x) { /* el aviso ya se mostró */ }
  }
  function pitido(ok) {
    try {
      const a = new (window.AudioContext || window.webkitAudioContext)(), o = a.createOscillator(), g = a.createGain();
      o.frequency.value = ok ? 880 : 220; o.connect(g); g.connect(a.destination); g.gain.value = .08; o.start(); o.stop(a.currentTime + (ok ? .15 : .4));
    } catch (x) {}
  }
  async function abrirCamara() {
    const video = document.getElementById('video');
    try { STREAM = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false }); }
    catch (x) { return u.aviso('No se pudo abrir la cámara. Revisá el permiso del navegador.', 'mal'); }
    video.srcObject = STREAM; await video.play();
    document.getElementById('camara').textContent = 'Cámara abierta';
    let detector = null;
    if ('BarcodeDetector' in window) { try { detector = new BarcodeDetector({ formats: ['qr_code'] }); } catch (x) { detector = null; } }
    if (!detector && !window.jsQR) await new Promise(ok => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js'; s.onload = ok; s.onerror = ok; document.head.appendChild(s); });
    const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d', { willReadFrequently: true });
    LEYENDO = true;
    const ciclo = async () => {
      if (!LEYENDO || !document.getElementById('video')) return pararCamara();
      try {
        let texto = '';
        if (detector) { const r = await detector.detect(video); if (r[0]) texto = r[0].rawValue; }
        else if (window.jsQR && video.videoWidth) {
          canvas.width = video.videoWidth; canvas.height = video.videoHeight; ctx.drawImage(video, 0, 0);
          const r = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' });
          if (r) texto = r.data;
        }
        if (texto) await validar(texto);
      } catch (x) {}
      setTimeout(ciclo, 250);
    };
    ciclo();
  }

  // ---------- Solicitudes ----------
  function solicitudes(el) {
    const ss = tabla('Solicitudes').slice().sort((a, b) => a.fecha < b.fecha ? 1 : -1);
    const nuevas = ss.filter(s => s.estado === 'Nueva'), otras = ss.filter(s => s.estado !== 'Nueva');
    const acts = v => M.lista(v).map(id => (tabla('Actividades').find(a => a.id === id) || {}).nombre).filter(Boolean).join(', ');
    el.innerHTML = titulo('Solicitudes de asociación') + `
      <p class="chico">Llegan desde el botón "Asociate" de la web. Al aprobar se crea el socio con su número y su código para el carnet digital.</p>
      ${nuevas.map(s => `<div class="tarjeta" style="margin-bottom:12px"><div class="fila-accion" style="border:0;padding:0">
        <div><h3>${e(s.nombre + ' ' + s.apellido)}</h3><div class="chico">DNI ${e(s.dni)} · ${e(s.telefono)}${s.email ? ' · ' + e(s.email) : ''} · ${e(u.corta(s.fecha))}</div>
        <div style="margin-top:6px">${e(cat(s.categoria_id) ? cat(s.categoria_id).nombre : '')}${acts(s.actividades) ? ' · ' + e(acts(s.actividades)) : ''}</div>
        ${s.mensaje ? `<p class="chico" style="margin:6px 0 0">"${e(s.mensaje)}"</p>` : ''}</div>
        <div style="display:flex;gap:8px"><button class="boton boton--ok" data-ap="${e(s.id)}">Aprobar</button><button class="boton boton--gris" data-re="${e(s.id)}">Rechazar</button></div></div></div>`).join('') || '<div class="tarjeta"><p class="chico" style="margin:0">No hay solicitudes nuevas.</p></div>'}
      ${otras.length ? `<h3 style="margin:22px 0 8px">Resueltas</h3><div class="tabla-envoltorio"><table class="tabla"><tbody>${otras.map(s => `<tr><td>${e(s.nombre + ' ' + s.apellido)}</td><td class="opc">${e(u.corta(s.fecha))}</td><td><span class="estado estado--${s.estado === 'Aprobada' ? 'ok' : 'gris'}">${e(s.estado)}</span></td></tr>`).join('')}</tbody></table></div>` : ''}`;
    el.querySelectorAll('[data-ap]').forEach(b => b.onclick = async () => { const s = await op('aprobarSolicitud', { id: b.dataset.ap }, 'Socio creado'); marco(); fichaSocio(s.id, 'carnet'); });
    el.querySelectorAll('[data-re]').forEach(b => b.onclick = async () => { if (confirm('¿Rechazar la solicitud?')) { await op('rechazarSolicitud', { id: b.dataset.re }, 'Solicitud rechazada'); marco(); } });
  }

  // ---------- Noticias ----------
  function noticias(el) {
    const ns = tabla('Noticias').slice().sort((a, b) => u.iso(a.fecha) < u.iso(b.fecha) ? 1 : -1);
    el.innerHTML = titulo('Noticias', '<button class="boton" id="nueva">+ Nueva noticia</button>') + `
      <div class="ia-caja" style="margin-bottom:18px"><span class="ia-etq">✨ Crónica desde Pitazo Final</span>
        <p style="margin:6px 0 0">Elegí un partido y la IA escribe la nota con el resultado y los goleadores que ya están cargados en Pitazo Final. Vos la revisás y la publicás.</p></div>
      <div class="tabla-envoltorio"><table class="tabla"><thead><tr><th>Fecha</th><th>Título</th><th>Estado</th></tr></thead><tbody>
        ${ns.map(n => `<tr class="clic" data-id="${e(n.id)}"><td>${e(u.corta(n.fecha))}</td><td><b>${e(n.titulo)}</b></td><td><span class="estado estado--${n.publicada === 'SI' ? 'ok' : 'gris'}">${n.publicada === 'SI' ? 'Publicada' : 'Borrador'}</span></td></tr>`).join('') || '<tr><td colspan="3" class="chico">Todavía no hay noticias del club.</td></tr>'}
      </tbody></table></div>
      <p class="chico">En la web también aparecen las noticias de la liga que nombran al club (las trae Pitazo Final).</p>`;
    document.getElementById('nueva').onclick = () => editorNoticia(null);
    el.querySelectorAll('tr[data-id]').forEach(tr => tr.onclick = () => editorNoticia(tr.dataset.id));
  }
  async function editorNoticia(id) {
    const n = id ? tabla('Noticias').find(x => x.id === id) : { publicada: 'SI', fecha: u.hoy() };
    const c = cfg();
    let partidos = [];
    if (c.pitazo_club_id) { try { await PZ.cargar(c.pitazo_club_id, c.pitazo_liga_id || 'L01'); partidos = PZ.partidosDelClub(c.pitazo_club_id).filter(p => PZ.resultado(p).jugado).reverse(); } catch (x) {} }
    const etq = p => { const v = PZ.paraClub(p, c.pitazo_club_id), r = v.r; return `${u.corta(PZ.fechaDe(p))} · ${v.lado === 'local' ? 'vs' : 'en'} ${PZ.nombreEquipo(v.rival)}${r.hay ? ' (' + (v.lado === 'local' ? r.gl + '-' + r.gv : r.gv + '-' + r.gl) + ')' : ''}${p.fase ? ' · ' + p.fase : ''}`; };
    const d = dialogo(id ? 'Editar noticia' : 'Nueva noticia', `
      ${partidos.length ? `<div class="ia-caja" style="margin-bottom:14px"><span class="ia-etq">✨ Escribir con IA</span>
        <label class="campo" style="margin-top:8px"><span>Partido</span><select id="ia-partido">${partidos.map(p => `<option value="${e(p.id)}" ${p.id === n.partido_id ? 'selected' : ''}>${e(etq(p))}</option>`).join('')}</select></label>
        <label class="campo" style="margin-top:8px"><span>Algo que quieras que diga <small>(opcional)</small></span><textarea id="ia-notas" style="min-height:60px" placeholder="Ej: el gol del empate fue en el último minuto, la gente llenó la cancha"></textarea></label>
        <button class="boton boton--suave" id="ia-btn" style="margin-top:8px">Escribir la crónica</button><span class="chico" id="ia-msj"></span></div>` : ''}
      <form class="form" id="f-nota">
        <label class="campo"><span>Título</span><input name="titulo" value="${e(n.titulo)}" required></label>
        <label class="campo"><span>Resumen <small>(se ve en la portada)</small></span><input name="resumen" value="${e(n.resumen)}"></label>
        <label class="campo"><span>Texto</span><textarea name="cuerpo" style="min-height:180px">${e(n.cuerpo)}</textarea></label>
        <div class="form__fila"><label class="campo"><span>Fecha</span><input name="fecha" type="date" value="${e(u.iso(n.fecha))}"></label>
          <label class="campo"><span>Foto</span><input type="file" id="foto" accept="image/*"><small id="foto-msj">${n.imagen ? 'Tiene foto. Elegí otra para cambiarla.' : ''}</small></label></div>
        <input type="hidden" name="imagen" value="${e(n.imagen)}"><input type="hidden" name="partido_id" value="${e(n.partido_id)}">
        <label class="check" style="justify-self:start"><input type="checkbox" name="publicada" ${n.publicada === 'SI' ? 'checked' : ''}> Publicada en la web</label>
        <div style="display:flex;gap:8px;justify-content:space-between"><button class="boton" type="submit">Guardar</button>${id ? '<button class="boton boton--gris" type="button" id="borrar">Borrar</button>' : ''}</div>
      </form>`);
    const f = d.querySelector('#f-nota');
    const ia = d.querySelector('#ia-btn');
    if (ia) ia.onclick = async () => {
      const pid = d.querySelector('#ia-partido').value, pz = PZ.paraCronica(pid, c.pitazo_club_id);
      ia.disabled = true; ia.textContent = 'Escribiendo…';
      try {
        const r = await op('redactar', { pz, notas: d.querySelector('#ia-notas').value, club: c.nombre_corto || c.nombre });
        f.titulo.value = r.titulo; f.resumen.value = r.resumen; f.cuerpo.value = r.cuerpo; f.partido_id.value = pid;
        d.querySelector('#ia-msj').textContent = r.ia ? ' Listo. Revisalo antes de publicar.' : ' Demo: borrador armado con los datos del partido (conectado lo escribe Gemini).';
      } catch (x) {} finally { ia.disabled = false; ia.textContent = 'Escribir de nuevo'; }
    };
    d.querySelector('#foto').onchange = async ev => {
      const file = ev.target.files[0]; if (!file) return;
      d.querySelector('#foto-msj').textContent = 'Subiendo…';
      try { const url = await u.achicar(file, 1400); const r = await DB.op('subirArchivo', { dataUrl: url, nombre: file.name }); f.imagen.value = r.res.url; d.querySelector('#foto-msj').textContent = 'Foto lista ✓'; }
      catch (x) { d.querySelector('#foto-msj').textContent = x.message; }
    };
    f.onsubmit = async ev => {
      ev.preventDefault();
      const fila = Object.fromEntries(new FormData(f).entries());
      fila.publicada = f.publicada.checked ? 'SI' : 'NO';
      if (id) fila.id = id;
      await op('guardar', { tabla: 'Noticias', fila }, 'Noticia guardada');
      cerrar(); marco();
    };
    const br = d.querySelector('#borrar');
    if (br) br.onclick = async () => { if (confirm('¿Borrar la noticia?')) { await op('borrar', { tabla: 'Noticias', id }, 'Noticia borrada'); cerrar(); marco(); } };
  }

  // ---------- Ajustes del club ----------
  function club(el) {
    const c = cfg();
    const campo = (k, n, extra) => `<label class="campo"><span>${n}</span><input name="${k}" value="${e(c[k])}" ${extra || ''}></label>`;
    el.innerHTML = titulo('Ajustes del club') + `
      <form id="f-club" class="grilla-2" style="align-items:start">
        <div class="tarjeta form"><h3>Identidad</h3>
          ${campo('nombre', 'Nombre completo')}${campo('nombre_corto', 'Nombre corto')}${campo('lema', 'Lema (grande en la portada)')}
          <label class="campo"><span>Escudo</span><input type="file" id="escudo-file" accept="image/*"><input name="escudo" value="${e(c.escudo)}" placeholder="o pegá el link de la imagen"></label>
          <div class="form__fila"><label class="campo"><span>Color principal</span><span class="color-fila"><input type="color" name="color1" value="${e(c.color1 || '#D7261E')}"></span></label>
            <label class="campo"><span>Color secundario</span><span class="color-fila"><input type="color" name="color2" value="${e(c.color2 || '#FFFFFF')}"></span></label></div>
          <label class="campo"><span>Historia / presentación</span><textarea name="historia">${e(c.historia)}</textarea></label>
        </div>
        <div style="display:grid;gap:18px">
          <div class="tarjeta form"><h3>Cobros</h3>
            <p class="chico" style="margin:0">Los socios le pagan directo al club. Cargá los datos de la cuenta del club (banco, billetera o Mercado Pago).</p>
            ${campo('cobro_alias', 'Alias')}${campo('cobro_cbu', 'CBU / CVU', 'inputmode="numeric"')}
            <div class="form__fila">${campo('cobro_titular', 'Titular')}${campo('cobro_banco', 'Banco o billetera')}</div>
            <div class="form__fila">${campo('cobro_cuit', 'CUIT')}${campo('cuota_vence_dia', 'Día de vencimiento', 'inputmode="numeric"')}</div>
            ${campo('mp_link', 'Link de pago de Mercado Pago <small>(opcional)</small>', 'placeholder="https://mpago.la/..."')}
          </div>
          <div class="tarjeta form"><h3>Vínculo con Pitazo Final</h3>
            <p class="chico" style="margin:0">De Pitazo Final se leen el fixture, los resultados, la tabla y los goleadores. Pitazo Clubs no modifica nada allá.</p>
            <div class="form__fila">${campo('pitazo_club_id', 'Código del club', 'placeholder="CL06"')}${campo('pitazo_liga_id', 'Código de la liga', 'placeholder="L01"')}</div>
            <button type="button" class="boton boton--suave" id="probar">Probar vínculo</button><span class="chico" id="probar-msj"></span>
          </div>
          <div class="tarjeta form"><h3>Contacto</h3>
            ${campo('ciudad', 'Localidad')}${campo('direccion', 'Dirección de la sede')}
            <div class="form__fila">${campo('whatsapp', 'WhatsApp')}${campo('telefono', 'Teléfono')}</div>
            <div class="form__fila">${campo('email', 'Email')}${campo('instagram', 'Instagram')}</div>
            ${campo('facebook', 'Facebook (link)')}
          </div>
        </div>
        <div style="grid-column:1/-1;position:sticky;bottom:12px;z-index:5"><button class="boton" type="submit" style="box-shadow:0 6px 20px rgba(0,0,0,.2)">Guardar ajustes</button></div>
      </form>
      <div class="grilla-2" style="margin-top:22px;align-items:start">
        ${editorLista('Categorias', 'Categorías y cuota', [['nombre', 'Nombre'], ['monto', 'Cuota mensual'], ['descripcion', 'Descripción']])}
        ${editorLista('Actividades', 'Actividades', [['nombre', 'Nombre'], ['dias', 'Días'], ['horario', 'Horario'], ['lugar', 'Lugar'], ['monto', 'Cuota extra'], ['descripcion', 'Descripción']])}
        ${editorLista('Sponsors', 'Sponsors', [['nombre', 'Nombre'], ['logo', 'Link del logo'], ['link', 'Link']])}
        ${editorLista('Usuarios', 'Quién entra al panel', [['email', 'Email de Google'], ['nombre', 'Nombre'], ['rol', 'Rol (admin, tesorero, prensa, puerta)']], 'email')}
      </div>`;
    const f = document.getElementById('f-club');
    f.onsubmit = async ev => {
      ev.preventDefault();
      await op('guardarConfig', { cambios: Object.fromEntries(new FormData(f).entries()) }, 'Ajustes guardados');
      PC.ctx.cfg = Object.assign(PC.ctx.cfg, M.config(ro(), false)); PC.aplicarMarca(); marco();
    };
    document.getElementById('escudo-file').onchange = async ev => {
      const file = ev.target.files[0]; if (!file) return;
      try { const url = await u.achicar(file, 400); const r = await DB.op('subirArchivo', { dataUrl: url, nombre: file.name }); f.escudo.value = r.res.url; u.aviso('Escudo cargado. Tocá Guardar.'); } catch (x) { u.aviso(x.message, 'mal'); }
    };
    document.getElementById('probar').onclick = async () => {
      const m = document.getElementById('probar-msj'); m.textContent = ' Buscando…';
      try {
        PZ.datos = null;
        await PZ.cargar(f.pitazo_club_id.value.trim(), f.pitazo_liga_id.value.trim() || 'L01');
        const cl = PZ.club(f.pitazo_club_id.value.trim());
        m.textContent = cl ? ` ✓ ${cl.nombre} · ${PZ.partidosDelClub(cl.id).length} partidos (${PZ.origen})` : ' No se encontró ese club en esa liga.';
      } catch (x) { m.textContent = ' ' + x.message; }
    };
    el.querySelectorAll('[data-lista]').forEach(conectarLista);
  }
  function editorLista(t, tit, cols, clave) {
    clave = clave || 'id';
    return `<div class="tarjeta" data-lista="${t}" data-clave="${clave}"><h3 style="margin-bottom:8px">${tit}</h3>
      ${tabla(t).map(r => `<div class="fila-accion"><span><b>${e(r[cols[0][0]])}</b> <span class="chico">${e(cols.slice(1, 3).map(([k]) => k === 'monto' ? (u.num(r[k]) ? u.plata(r[k]) : '') : r[k]).filter(Boolean).join(' · '))}</span></span>
        <span style="display:flex;gap:6px"><button class="boton boton--gris boton--chico" data-ed="${e(r[clave])}">Editar</button></span></div>`).join('') || '<p class="chico">Vacío.</p>'}
      <button class="boton boton--suave boton--chico" data-ed="" style="margin-top:10px">+ Agregar</button>
      <template>${JSON.stringify(cols)}</template></div>`;
  }
  function conectarLista(box) {
    const t = box.dataset.lista, clave = box.dataset.clave, cols = JSON.parse(box.querySelector('template').innerHTML);
    box.querySelectorAll('[data-ed]').forEach(b => b.onclick = () => {
      const r = b.dataset.ed ? tabla(t).find(x => String(x[clave]) === b.dataset.ed) : {};
      const d = dialogo(b.dataset.ed ? 'Editar' : 'Agregar', `<form class="form" id="f-l">${cols.map(([k, n]) => `<label class="campo"><span>${n}</span>${k === 'descripcion' ? `<textarea name="${k}" style="min-height:70px">${e(r[k])}</textarea>` : `<input name="${k}" value="${e(r[k])}" ${k === 'monto' ? 'inputmode="numeric"' : ''}>`}</label>`).join('')}
        <div style="display:flex;justify-content:space-between;gap:8px"><button class="boton">Guardar</button>${b.dataset.ed ? '<button type="button" class="boton boton--gris" id="del">Borrar</button>' : ''}</div></form>`);
      d.querySelector('#f-l').onsubmit = async ev => {
        ev.preventDefault();
        const fila = Object.assign({}, r, Object.fromEntries(new FormData(ev.target).entries()));
        if (fila.monto !== undefined) fila.monto = u.num(fila.monto);
        await op('guardar', { tabla: t, fila }, 'Guardado'); cerrar(); marco();
      };
      const del = d.querySelector('#del');
      if (del) del.onclick = async () => { if (confirm('¿Borrar?')) { await op('borrar', { tabla: t, id: b.dataset.ed }, 'Borrado'); cerrar(); marco(); } };
    });
  }

  PC.panel = { ver, salirVista() { document.body.classList.remove('en-panel'); pararCamara(); } };
})();
