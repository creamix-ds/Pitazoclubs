/**
 * Pitazo Clubs — API (Apps Script). Separada de Pitazo Final: tiene su propia planilla.
 * De Pitazo Final solo se leen datos públicos, desde la web (no desde acá).
 *
 * Instalación (una sola vez):
 *  1. Creá una planilla nueva en Drive llamada "Pitazo Clubs" > Extensiones > Apps Script.
 *  2. Pegá TODO Code.gs (motor + este archivo) y guardá.
 *  3. Completá GOOGLE_CLIENT_ID abajo (el mismo que va en js/config.js).
 *  4. Ejecutá prepararClubes() una vez y aceptá los permisos.
 *     Club nuevo (sin tocar este código): en la pestaña Clubes completá una fila (slug, nombre,
 *     colores, pitazo_club_id, admin_email...) con planilla_id vacío y usá el menú
 *     Pitazo Clubs > Crear clubes nuevos (o ejecutá crearClub()). Su web queda en .../<slug>/
 *  5. Implementar > Nueva implementación > Aplicación web.
 *     Ejecutar como: Yo. Quién tiene acceso: Cualquier persona.
 *  6. Copiá la URL /exec en API_URL de js/config.js.
 *  Opcional: Configuración del proyecto > Propiedades del script > GEMINI_API_KEY
 *  (la misma clave de Gemini de Pitazo Final sirve) para las crónicas y el resumen con IA.
 *
 * Cada club tiene su propia planilla (pestañas Config, Usuarios, Categorias, Actividades,
 * Socios, Cuotas, Pagos, Noticias, Sponsors, Accesos, Solicitudes, Partidos, Entradas). Las pestañas
 * que falten se crean solas. La planilla central solo tiene la pestaña Clubes.
 *
 * GET  ?r=publico&club=pirovano                    datos públicos de la web del club
 *      (NO usar ?c= ni ?sid=: Apps Script los reserva y corta el pedido)
 * GET  ?r=clubes                                  lista para la portada de Pitazo Clubs
 * GET  ?r=cambios&club=pirovano                   marca de la última modificación (la web la consulta cada 15 s)
 * GET  ?r=ping                                     {"ok":true,"servicio":"Pitazo Clubs"}
 * POST (texto JSON) {accion, club, ...}:
 *   solicitud {datos}                               formulario "Asociate"
 *   socio_ingresar {dni, pin}  -> {token, vista}    carnet digital
 *   socio_recuperar {dni, link}  -> {email oculto}  manda el código por mail (1 cada 10 min)
 *   socio_vista {socio_token}
 *   socio_informar {socio_token, datos:{cuotas, comprobante(dataURL)}}
 *   panel_sesion {token(Google)}                    -> {usuario}
 *   panel_datos {token}                             todas las tablas
 *   panel_op {token, op, args}                      -> {res, datos}
 *   panel_acceso {token, leido, lugar, cuantas}     escaneo rápido: devuelve solo el resultado
 *   entrada_comprar {datos}  entrada_ver {id, codigo}  entrada_pago {id, codigo, comprobante}
 *   socio_entrada {socio_token, partido_id, cantidad}   entrada con precio de socio
 * Portada de Pitazo Clubs (sin club; la edita el dueño de esta planilla o un email de Portal > admins):
 * GET  ?r=portal                                  textos, colores y logo de la portada + clubes
 * POST portal_sesion | portal_datos | portal_guardar {cambios} | portal_club {datos} | portal_crear_club {datos}
 */

const GOOGLE_CLIENT_ID = '513742201235-79a1b7tnk46vt8db28e8t54rqbqhrk3p.apps.googleusercontent.com'; // proyecto de Google Cloud pitazoclubs
const CARPETA_ARCHIVOS = 'Pitazo Clubs - archivos';
const SOCIO_DIAS = 60;                // cuánto dura la sesión del socio en el celular
const VERSION_API = '29oct-j';        // aparece en ?r=ping: sirve para saber qué código está publicado

// Qué puede hacer cada rol del panel (columna rol de la pestaña Usuarios).
const PERMISOS = {
  admin: '*',
  tesorero: ['guardar:Socios', 'borrar:Socios', 'guardar:Cuotas', 'borrar:Cuotas', 'generarCuotas', 'registrarPago', 'resolverPago', 'enviarCodigo',
    'aprobarSolicitud', 'rechazarSolicitud', 'validarAcceso', 'nuevoCodigo', 'resumenComision',
    'guardar:Partidos', 'borrar:Partidos', 'resolverEntrada', 'anularEntrada', 'venderEntrada'],
  prensa: ['guardar:Noticias', 'borrar:Noticias', 'redactar', 'subirArchivo'],
  puerta: ['validarAcceso', 'venderEntrada']
};

// ---------- planilla central y de cada club ----------
function central_() { return SpreadsheetApp.getActiveSpreadsheet(); }
function clubes_() {
  const sh = central_().getSheetByName('Clubes');
  if (!sh) return [];
  const v = sh.getDataRange().getValues(), h = v.shift().map(String);
  return v.filter(r => r[0]).map(r => { const o = {}; h.forEach((k, i) => o[k] = r[i]); return o; });
}
function clubPorSlug_(slug) {
  const c = clubes_().filter(x => String(x.slug).toLowerCase() === String(slug || '').toLowerCase() && String(x.activo || 'SI') !== 'NO')[0];
  if (!c) throw new Error('No existe el club "' + slug + '".');
  return c;
}

/** Store sobre la planilla de un club: lo que necesita el motor. */
function store_(planillaId) {
  const ss = SpreadsheetApp.openById(planillaId);
  const cache = {};
  function hoja(t) {
    let sh = ss.getSheetByName(t);
    if (!sh) { sh = ss.insertSheet(t); sh.appendRow(MOTOR.TABLAS[t]); sh.setFrozenRows(1); formatoTexto_(sh, MOTOR.TABLAS[t]); }
    return sh;
  }
  function leer(t) {
    if (cache[t]) return cache[t];
    const sh = hoja(t), v = sh.getDataRange().getValues();
    const h = (v.shift() || []).map(String);
    const filas = v.map((r, i) => {
      const o = { _fila: i + 2 };
      h.forEach((k, j) => { if (k) o[k] = r[j] instanceof Date ? fechaTexto_(r[j], k) : r[j]; });
      return o;
    }).filter(o => h.some(k => k && String(o[k]) !== ''));
    cache[t] = { h: h, filas: filas, sh: sh };
    return cache[t];
  }
  function aFila(h, o) { return h.map(k => (o[k] === undefined || o[k] === null) ? '' : o[k]); }
  return {
    ss: ss,
    rows: t => leer(t).filas,
    insert: (t, o) => {
      const L = leer(t);
      MOTOR.TABLAS[t].forEach(k => { if (L.h.indexOf(k) < 0) { L.h.push(k); L.sh.getRange(1, L.h.length).setValue(k); } });
      const r = aFila(L.h, o);
      L.sh.appendRow(r.map(v => typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v)); // evita fórmulas inyectadas
      const nuevo = Object.assign({}, o, { _fila: L.sh.getLastRow() });
      L.filas.push(nuevo);
    },
    update: (t, o, clave) => {
      clave = clave || 'id';
      const L = leer(t), f = L.filas.filter(x => String(x[clave]) === String(o[clave]))[0];
      if (!f) throw new Error('No se encontró ' + o[clave] + ' en ' + t);
      Object.assign(f, o);
      const r = aFila(L.h, f).map(v => typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v);
      L.sh.getRange(f._fila, 1, 1, L.h.length).setValues([r]);
    },
    remove: (t, id, clave) => {
      clave = clave || 'id';
      const L = leer(t), f = L.filas.filter(x => String(x[clave]) === String(id))[0];
      if (!f) return;
      L.sh.deleteRow(f._fila);
      delete cache[t];
    },
    hoy: () => Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd'),
    ahora: () => Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd HH:mm')
  };
}
// DNI, PIN, códigos, teléfonos y horas como texto (que Sheets no los convierta en números o fechas).
const COLUMNAS_TEXTO = ['dni', 'pin', 'telefono', 'codigo_carnet', 'codigo', 'periodo', 'valor', 'numero', 'hora'];
function formatoTexto_(sh, cols) {
  COLUMNAS_TEXTO.forEach(k => { const j = cols.indexOf(k); if (j >= 0) sh.getRange(2, j + 1, 999, 1).setNumberFormat('@'); });
}
function fechaTexto_(d, campo) {
  if (campo === 'hora') return Utilities.formatDate(d, 'America/Argentina/Buenos_Aires', 'HH:mm');
  const f = /fecha_hora|ultimo_uso/.test(campo) ? 'yyyy-MM-dd HH:mm' : 'yyyy-MM-dd';
  return Utilities.formatDate(d, 'America/Argentina/Buenos_Aires', f);
}
function limpio_(o) { // saca _fila y el pin antes de mandar al navegador
  return JSON.parse(JSON.stringify(o, (k, v) => k === '_fila' ? undefined : v));
}
function tablas_(st, conPin) {
  const d = {};
  Object.keys(MOTOR.TABLAS).forEach(t => { d[t] = limpio_(st.rows(t)); });
  if (!conPin) d.Socios.forEach(s => delete s.pin);
  d.Config = d.Config.filter(c => ['mp_access_token', 'gemini', 'secreto'].indexOf(String(c.clave)) < 0);
  return d;
}

// ---------- HTTP ----------
function doGet(e) {
  try {
    const p = e.parameter || {};
    if (p.r === 'ping' || !p.r) return json_({ ok: true, servicio: 'Pitazo Clubs', version: VERSION_API });
    // Consulta liviana para "tiempo real": no abre ninguna planilla, solo lee una propiedad.
    if (p.r === 'cambios') return json_({ ok: true, data: marca_(String(p.club || '').toLowerCase()) });
    if (p.r === 'portal') {  // portada de Pitazo Clubs: textos, colores, logo y clubes
      const cache = CacheService.getScriptCache(), k = 'portal_' + version_('portal');
      const hit = cache.get(k);
      if (hit) return ContentService.createTextOutput(hit).setMimeType(ContentService.MimeType.JSON);
      const out = JSON.stringify({ ok: true, data: { config: portal_(), clubes: clubesPublicos_() } });
      cache.put(k, out, 300);
      return ContentService.createTextOutput(out).setMimeType(ContentService.MimeType.JSON);
    }
    if (p.r === 'clubes') {  // portada de Pitazo Clubs
      return json_({ ok: true, data: clubes_().filter(c => String(c.activo || 'SI') !== 'NO').map(c => ({ slug: c.slug, nombre: c.nombre, ciudad: c.ciudad || '', escudo: c.escudo || '', color1: c.color1 || '' })) });
    }
    if (p.r === 'publico') {
      const club = clubPorSlug_(p.club);
      const cache = CacheService.getScriptCache(), k = 'pub_' + club.slug + '_' + version_(club.slug);
      const hit = cache.get(k);
      if (hit) return ContentService.createTextOutput(hit).setMimeType(ContentService.MimeType.JSON);
      const out = JSON.stringify({ ok: true, data: limpio_(MOTOR.publico(store_(club.planilla_id))) });
      if (out.length < 95000) cache.put(k, out, 300);
      return ContentService.createTextOutput(out).setMimeType(ContentService.MimeType.JSON);
    }
    throw new Error('Pedido desconocido');
  } catch (err) { return json_({ ok: false, error: String(err.message || err) }); }
}

function doPost(e) {
  try {
    const b = JSON.parse(e.postData.contents || '{}');
    if (/^portal_/.test(String(b.accion))) return json_({ ok: true, data: accionPortal_(b) });
    const club = clubPorSlug_(b.club);
    const r = accion_(club, b);
    return json_({ ok: true, data: r });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

function accion_(club, b) {
  const st = () => store_(club.planilla_id);
  switch (b.accion) {
    case 'solicitud': return conLock_(() => { const r = MOTOR.solicitud(st(), b.datos || {}); tocar_(club.slug); return r; });
    case 'socio_ingresar': {
      const s = st(), socio = MOTOR.ingresarSocio(s, b.dni, b.pin);
      return { token: tokenSocio_(club.slug, socio.id), vista: limpio_(MOTOR.vistaSocio(s, socio.id)) };
    }
    case 'socio_recuperar': {
      // Máximo un mail cada 10 minutos por DNI, para que no se use para molestar a nadie.
      const cache = CacheService.getScriptCache(), k = 'rec_' + club.slug + '_' + String(b.dni || '').replace(/\D/g, '');
      if (cache.get(k)) throw new Error('Ya te mandamos el código hace un rato. Revisá tu correo (y la carpeta de spam).');
      const s = st(), r = MOTOR.paraRecuperar(s, b.dni);
      enviarCodigo_(club, s, r.socio, b.link);
      cache.put(k, '1', 600);
      return { email: r.oculto };
    }
    case 'socio_vista': return limpio_(MOTOR.vistaSocio(st(), socioDeToken_(club.slug, b.socio_token)));
    case 'socio_informar': return conLock_(() => {
      const s = st(), id = socioDeToken_(club.slug, b.socio_token), d = b.datos || {};
      if (d.comprobante && /^data:/.test(d.comprobante)) d.comprobante = guardarArchivo_(club, d.comprobante, 'comprobante-' + id, s, false);
      MOTOR.informarPago(s, id, d);
      marcar_(club.slug);
      return limpio_(MOTOR.vistaSocio(s, id));
    });
    // ----- entradas (web pública, sin login: se accede con el link id + código) -----
    case 'entrada_comprar': return conLock_(() => {
      const s = st(), e = MOTOR.comprarEntrada(s, b.datos || {}, null, false);
      tocar_(club.slug);
      return limpio_(MOTOR.vistaEntrada(s, e, true));
    });
    case 'entrada_ver': { const s = st(); return limpio_(MOTOR.vistaEntrada(s, MOTOR.entradaPorCodigo(s, b.id, b.codigo), true)); }
    case 'entrada_pago': return conLock_(() => {
      const s = st();
      MOTOR.entradaPorCodigo(s, b.id, b.codigo);
      let comp = b.comprobante;
      if (comp && /^data:/.test(comp)) comp = guardarArchivo_(club, comp, 'entrada-' + b.id, s, false);
      const e = MOTOR.informarEntrada(s, b.id, b.codigo, comp, b.medio);
      marcar_(club.slug);
      return limpio_(MOTOR.vistaEntrada(s, e, true));
    });
    case 'socio_entrada': return conLock_(() => {
      const s = st(), id = socioDeToken_(club.slug, b.socio_token);
      const e = MOTOR.comprarEntrada(s, { partido_id: b.partido_id, cantidad: b.cantidad }, id, false);
      tocar_(club.slug);
      return { entrada: limpio_(MOTOR.vistaEntrada(s, e, true)), vista: limpio_(MOTOR.vistaSocio(s, id)) };
    });
    // Escaneo en la puerta: valida, registra y devuelve solo el resultado (sin recargar todas las tablas).
    case 'panel_acceso': return conLock_(() => {
      const s = st(), ses = sesion_(club, b.token, s);
      permitir_(ses.usuario, 'validarAcceso', {});
      const r = MOTOR.validarAcceso(s, b.leido, b.lugar, b.cuantas);
      marcar_(club.slug);  // las otras puertas y el carnet se enteran del ingreso
      return limpio_(r);
    });
    case 'panel_sesion': return { usuario: sesion_(club, b.token, st()).usuario };
    case 'panel_datos': {
      const s = st(), ses = sesion_(club, b.token, s);
      const d = tablas_(s, ses.usuario.rol === 'admin' || ses.usuario.rol === 'tesorero');
      d._usuario = ses.usuario;
      return d;
    }
    case 'panel_op': return conLock_(() => {
      const s = st(), ses = sesion_(club, b.token, s), a = b.args || {};
      permitir_(ses.usuario, b.op, a);
      const res = op_(club, s, b.op, a, ses.usuario.email);
      tocar_(club.slug);
      const datos = tablas_(s, ses.usuario.rol === 'admin' || ses.usuario.rol === 'tesorero');
      datos._usuario = ses.usuario;
      return { res: limpio_(res === undefined ? null : res), datos: datos };
    });
  }
  throw new Error('Acción desconocida');
}

function op_(club, s, op, a, quien) {
  switch (op) {
    case 'guardar': return MOTOR.guardar(s, a.tabla, a.fila || {}, quien);
    case 'borrar': return MOTOR.borrar(s, a.tabla, a.id);
    case 'eliminarSocio': return MOTOR.eliminarSocio(s, a.id);
    case 'eliminarPartido': return MOTOR.eliminarPartido(s, a.id);
    case 'guardarConfig': {
      const c = Object.assign({}, a.cambios || {});
      ['mp_access_token', 'gemini', 'secreto'].forEach(k => delete c[k]);
      return MOTOR.guardarConfig(s, c);
    }
    case 'generarCuotas': return MOTOR.generarCuotas(s, a.periodo);
    case 'registrarPago': return MOTOR.registrarPago(s, a.pago || {}, quien);
    case 'resolverPago': return MOTOR.resolverPago(s, a.id, !!a.aprobar, quien, a.motivo);
    case 'aprobarSolicitud': return MOTOR.aprobarSolicitud(s, a.id);
    case 'rechazarSolicitud': {
      const sol = s.rows('Solicitudes').filter(x => x.id === a.id)[0];
      if (!sol) throw new Error('No se encontró la solicitud.');
      sol.estado = 'Rechazada'; s.update('Solicitudes', sol); return sol;
    }
    case 'validarAcceso': return MOTOR.validarAcceso(s, a.leido, a.lugar, a.cuantas);
    case 'venderEntrada': return MOTOR.comprarEntrada(s, a.datos || {}, null, true, quien);
    case 'resolverEntrada': return MOTOR.resolverEntrada(s, a.id, !!a.aprobar, quien, a.motivo);
    case 'anularEntrada': return MOTOR.anularEntrada(s, a.id);
    case 'nuevoCodigo': return MOTOR.nuevoCodigo(s, a.id, a.que);
    case 'enviarCodigo': {
      const soc = s.rows('Socios').filter(x => x.id === a.id)[0];
      if (!soc) throw new Error('No se encontró el socio.');
      const r = MOTOR.paraRecuperar(s, soc.dni);
      enviarCodigo_(club, s, r.socio, a.link);
      return { email: r.email };
    }
    case 'subirArchivo': return { url: guardarArchivo_(club, a.dataUrl, a.nombre || 'imagen', s, true) };
    case 'redactar': {
      const base = MOTOR.borradorCronica(a.pz, a.notas);
      try {
        const t = gemini_(MOTOR.promptCronica(a.pz, a.notas, a.club || club.nombre), true);
        const j = JSON.parse(t);
        if (j.titulo && j.cuerpo) return { titulo: j.titulo, resumen: j.resumen || base.resumen, cuerpo: j.cuerpo, ia: true };
      } catch (err) { console.warn('Gemini (crónica): ' + err); }
      return Object.assign(base, { ia: false });
    }
    case 'resumenComision': {
      const r = MOTOR.resumen(s, a.periodo);
      try { return { texto: gemini_(MOTOR.promptResumenComision(r, club.nombre), false).trim(), ia: true }; }
      catch (err) { console.warn('Gemini (resumen): ' + err); return { texto: MOTOR.resumenComisionSinIA(r), ia: false }; }
    }
  }
  throw new Error('Operación desconocida: ' + op);
}

function permitir_(usuario, op, a) {
  const p = PERMISOS[usuario.rol] || PERMISOS.admin;
  if (p === '*') return;
  const clave = (op === 'guardar' || op === 'borrar') ? op + ':' + a.tabla : op;
  if (p.indexOf(clave) < 0) throw new Error('Tu usuario (' + usuario.rol + ') no puede hacer eso. Pedíselo a un administrador del club.');
}

// ---------- sesiones ----------
function sesion_(club, token, s) {
  const info = cuentaGoogle_(token);
  const devs = String(PropertiesService.getScriptProperties().getProperty('ADMINS') || '').toLowerCase().split(',').map(x => x.trim());
  const u = s.rows('Usuarios').filter(x => String(x.email).toLowerCase().trim() === info.email && String(x.activo || 'SI') !== 'NO')[0];
  if (!u && devs.indexOf(info.email) < 0) throw new Error('La cuenta ' + info.email + ' no tiene acceso al panel de ' + club.nombre + '. Pedile a un administrador que la agregue en Ajustes > Quién entra al panel.');
  return { usuario: { email: info.email, nombre: (u && u.nombre) || info.nombre, rol: u ? String(u.rol || 'admin') : 'admin' } };
}
/** Verifica el ingreso con Google y devuelve { email, nombre }. */
function cuentaGoogle_(token) {
  if (!GOOGLE_CLIENT_ID) throw new Error('Falta GOOGLE_CLIENT_ID en Code.gs.');
  if (!token) throw new Error('Sesión vencida. Volvé a ingresar.');
  const cache = CacheService.getScriptCache(), k = 'tk_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token)).slice(0, 40);
  let info = cache.get(k) ? JSON.parse(cache.get(k)) : null;
  if (!info) {
    const res = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token), { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) throw new Error('Sesión vencida. Volvé a ingresar.');
    const t = JSON.parse(res.getContentText());
    if (t.aud !== GOOGLE_CLIENT_ID) throw new Error('El ingreso no corresponde a este sitio.');
    if (String(t.email_verified) !== 'true') throw new Error('La cuenta de Google no tiene el email verificado.');
    const vence = Number(t.exp) * 1000;
    if (vence < Date.now()) throw new Error('Sesión vencida. Volvé a ingresar.');
    info = { email: String(t.email).toLowerCase(), nombre: t.name || '' };
    cache.put(k, JSON.stringify(info), Math.max(1, Math.min(900, Math.floor((vence - Date.now()) / 1000))));
  }
  return info;
}

// ---------- portada de Pitazo Clubs (pestaña Portal de esta planilla: clave | valor) ----------
const PORTAL_BASE = {
  nombre: 'Pitazo Clubs', logo: '', kicker: 'De la familia de Pitazo Final',
  titulo: 'La web y los socios\nde tu club, en un solo lugar',
  subtitulo: 'Página propia, carnet digital, cuotas, entradas, control de acceso y resultados de la liga actualizados solos.',
  color1: '#18181B', color_boton: '#F05A1A', color_boton_texto: '#18181B', color_fondo: '#FAFAF7',
  whatsapp: '', instagram: 'creamixds', email: '',
  rasgos: ['Web del club: Noticias, actividades, cuota social y formulario para asociarse, con los colores y el escudo del club.',
    'Resultados solos: Fixture, tabla, fase final y goleadores salen de Pitazo Final: no se carga nada dos veces.',
    'Carnet digital: Cada socio tiene su carnet con QR en el celular y ve si está al día.',
    'Cuotas sin vueltas: Se generan solas cada mes. El socio paga directo al club y sube el comprobante.',
    'Entradas por partido: Precio general y precio socio, con QR que se habilita antes del partido.',
    'Con inteligencia artificial: La crónica del partido y el resumen para la comisión, escritos con los datos reales.'].join('\n'),
  admins: ''
};
function hojaPortal_() {
  let sh = central_().getSheetByName('Portal');
  if (!sh) { sh = central_().insertSheet('Portal'); sh.appendRow(['clave', 'valor']); sh.setFrozenRows(1); sh.getRange('A1:B1').setFontWeight('bold'); }
  return sh;
}
function portal_(conAdmins) {
  const c = Object.assign({}, PORTAL_BASE);
  const sh = central_().getSheetByName('Portal');
  if (sh) sh.getDataRange().getValues().slice(1).forEach(r => { const k = String(r[0] || '').trim(); if (k && k in PORTAL_BASE) c[k] = String(r[1] === undefined ? '' : r[1]); });
  if (!conAdmins) delete c.admins;
  return c;
}
function clubesPublicos_() {
  return clubes_().filter(c => String(c.activo || 'SI') !== 'NO' && c.planilla_id).map(c => ({ slug: c.slug, nombre: c.nombre, ciudad: c.ciudad || '', escudo: c.escudo || '', color1: c.color1 || '' }));
}
// Quién edita la portada: el dueño de esta planilla, la propiedad ADMINS o los emails de Portal > admins.
function sesionPortal_(token) {
  const info = cuentaGoogle_(token);
  let duenio = '';
  try { duenio = String(central_().getOwner().getEmail() || '').toLowerCase(); } catch (err) {}
  const lista = (String(PropertiesService.getScriptProperties().getProperty('ADMINS') || '') + ',' + portal_(true).admins + ',' + duenio)
    .toLowerCase().split(/[,;\s]+/).filter(Boolean);
  if (lista.indexOf(info.email) < 0) throw new Error('La cuenta ' + info.email + ' no administra Pitazo Clubs.');
  return { email: info.email, nombre: info.nombre };
}
function datosPortal_(usuario) {
  return {
    usuario: usuario, config: portal_(true),
    clubes: clubes_().map(c => ({ slug: c.slug, nombre: c.nombre, ciudad: c.ciudad || '', escudo: c.escudo || '', color1: c.color1 || '', activo: String(c.activo || 'SI'),
      planilla_id: c.planilla_id || '', pitazo_club_id: c.pitazo_club_id || '', pitazo_liga_id: c.pitazo_liga_id || '', admin_email: c.admin_email || '' }))
  };
}
const CAMPOS_CLUB_EDITABLES = ['nombre', 'ciudad', 'escudo', 'color1', 'activo'];
function accionPortal_(b) {
  const u = sesionPortal_(b.token);
  switch (b.accion) {
    case 'portal_sesion': return { usuario: u };
    case 'portal_datos': return datosPortal_(u);
    case 'portal_guardar': return conLock_(() => {
      const sh = hojaPortal_(), v = sh.getDataRange().getValues(), cambios = b.cambios || {};
      Object.keys(cambios).filter(k => k in PORTAL_BASE).forEach(k => {
        const val = ['logo'].indexOf(k) >= 0 ? MOTOR.url(cambios[k], true) : String(cambios[k] === undefined ? '' : cambios[k]).trim();
        const i = v.findIndex((r, j) => j > 0 && String(r[0]).trim() === k);
        if (i > 0) sh.getRange(i + 1, 2).setValue(val); else { sh.appendRow([k, val]); v.push([k, val]); }
      });
      tocar_('portal');
      return datosPortal_(u);
    });
    case 'portal_club': return conLock_(() => {   // cambia nombre, localidad, escudo, color o activo de un club
      const d = b.datos || {}, { sh, h } = hojaClubes_();
      const filas = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, h.length).getValues() : [];
      const i = filas.findIndex(r => String(r[h.indexOf('slug')]).toLowerCase() === String(d.slug || '').toLowerCase());
      if (i < 0) throw new Error('No existe el club ' + d.slug);
      CAMPOS_CLUB_EDITABLES.forEach(k => { if (d[k] !== undefined) sh.getRange(i + 2, h.indexOf(k) + 1).setValue(k === 'escudo' ? MOTOR.url(d[k], true) : k === 'activo' ? (String(d[k]).toUpperCase() === 'NO' ? 'NO' : 'SI') : String(d[k]).trim()); });
      tocar_('portal');
      return datosPortal_(u);
    });
    case 'portal_crear_club': return conLock_(() => {
      const d = Object.assign({}, b.datos || {});
      d.slug = String(d.slug || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
      if (!d.slug || !String(d.nombre || '').trim()) throw new Error('Completá el nombre y la dirección (slug) del club.');
      if (['js', 'css', 'img', 'data', 'backend', 'herramientas', 'admin', 'www'].indexOf(d.slug) >= 0) throw new Error('"' + d.slug + '" está reservado: elegí otra dirección para el club.');
      if (d.escudo) d.escudo = MOTOR.url(d.escudo, true);
      crearClub(d);
      tocar_('portal');
      return datosPortal_(u);
    });
  }
  throw new Error('Acción desconocida');
}
function secreto_() {
  const pr = PropertiesService.getScriptProperties();
  let s = pr.getProperty('SECRETO');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); pr.setProperty('SECRETO', s); }
  return s;
}
function firma_(texto) { return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(texto, secreto_())).replace(/=+$/, ''); }
function tokenSocio_(slug, socioId) {
  const datos = slug + '|' + socioId + '|' + (Date.now() + SOCIO_DIAS * 864e5);
  return Utilities.base64EncodeWebSafe(datos).replace(/=+$/, '') + '.' + firma_(datos);
}
function socioDeToken_(slug, token) {
  const p = String(token || '').split('.');
  if (p.length !== 2) throw new Error('Sesión vencida. Volvé a entrar con tu DNI y código.');
  const datos = Utilities.newBlob(Utilities.base64DecodeWebSafe(p[0] + '==='.slice((p[0].length + 3) % 4))).getDataAsString();
  if (firma_(datos) !== p[1]) throw new Error('Sesión vencida. Volvé a entrar con tu DNI y código.');
  const d = datos.split('|');
  if (d[0] !== slug || Number(d[2]) < Date.now()) throw new Error('Sesión vencida. Volvé a entrar con tu DNI y código.');
  return d[1];
}

// ---------- mail con el código del carnet ----------
function enviarCodigo_(club, s, socio, link) {
  const cfg = MOTOR.config(s, false);
  link = /^https:\/\//.test(String(link || '')) ? String(link) : '';
  const m = MOTOR.mailCodigo(cfg, socio, link || 'la web del club');
  if (MailApp.getRemainingDailyQuota() < 1) throw new Error('Hoy no se pueden mandar más mails. Pedí tu código en el club.');
  MailApp.sendEmail({ to: socio.email, subject: m.asunto, body: m.texto, htmlBody: m.html, name: cfg.nombre_corto || cfg.nombre || 'Pitazo Clubs', noReply: true });
}

// ---------- archivos (escudo, fotos de noticias, comprobantes) ----------
function guardarArchivo_(club, dataUrl, nombre, s, publico) {
  const m = String(dataUrl || '').match(/^data:([\w/+.-]+);base64,(.+)$/);
  if (!m) throw new Error('Archivo inválido.');
  if (!/^(image\/(jpeg|png|webp|gif)|application\/pdf)$/.test(m[1])) throw new Error('Solo imágenes o PDF.');
  const bytes = Utilities.base64Decode(m[2]);
  if (bytes.length > 4e6) throw new Error('El archivo pesa demasiado (máximo 4 MB).');
  const raiz = carpeta_(DriveApp.getRootFolder(), CARPETA_ARCHIVOS), carpeta = carpeta_(raiz, club.slug + (publico ? '' : ' - comprobantes'));
  const ext = m[1] === 'application/pdf' ? '.pdf' : '.jpg';
  const f = carpeta.createFile(Utilities.newBlob(bytes, m[1], nombre.replace(/[^\w.-]+/g, '_').slice(0, 60) + '-' + Date.now() + ext));
  if (publico) {
    f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return 'https://lh3.googleusercontent.com/d/' + f.getId();
  }
  // Comprobantes: privados. Los ven solo los usuarios del panel del club.
  const mails = s.rows('Usuarios').filter(u => String(u.activo || 'SI') !== 'NO').map(u => String(u.email).trim()).filter(Boolean);
  mails.forEach(m2 => { try { f.addViewer(m2); } catch (err) { console.warn('No se pudo compartir con ' + m2); } });
  return 'https://drive.google.com/file/d/' + f.getId() + '/view';
}
function carpeta_(padre, nombre) {
  const it = padre.getFoldersByName(nombre);
  return it.hasNext() ? it.next() : padre.createFolder(nombre);
}

// ---------- Gemini ----------
function gemini_(prompt, comoJson) {
  const pr = PropertiesService.getScriptProperties(), clave = pr.getProperty('GEMINI_API_KEY');
  if (!clave) throw new Error('Sin GEMINI_API_KEY');
  const modelos = [pr.getProperty('GEMINI_MODELO'), 'gemini-3.8-flash', 'gemini-3.6-flash'].filter(Boolean);
  let ultimo = '';
  for (let i = 0; i < modelos.length; i++) {
    const res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + modelos[i] + ':generateContent?key=' + clave, {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      payload: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: Object.assign({ temperature: 0.6 }, comoJson ? { responseMimeType: 'application/json' } : {}) })
    });
    if (res.getResponseCode() === 200) {
      const j = JSON.parse(res.getContentText());
      const t = j.candidates && j.candidates[0] && j.candidates[0].content.parts.map(p => p.text || '').join('');
      if (t) return t;
    }
    ultimo = res.getResponseCode() + ' ' + res.getContentText().slice(0, 200);
  }
  throw new Error('Gemini no respondió: ' + ultimo);
}

// ---------- utilidades ----------
function conLock_(fn) {
  const l = LockService.getScriptLock();
  l.waitLock(20000);
  try { return fn(); } finally { l.releaseLock(); }
}
function version_(slug) { return PropertiesService.getScriptProperties().getProperty('v_' + slug) || '0'; }
// v_: versión de los datos públicos (invalida la caché de ?r=publico). m_: cualquier cambio (para el "tiempo real").
function tocar_(slug) { const t = String(Date.now()); PropertiesService.getScriptProperties().setProperties({ ['v_' + slug]: t, ['m_' + slug]: t }); }
function marcar_(slug) { PropertiesService.getScriptProperties().setProperty('m_' + slug, String(Date.now())); }
function marca_(slug) { return PropertiesService.getScriptProperties().getProperty('m_' + slug) || '0'; }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// ---------- alta de clubes (sin tocar el código) ----------
// En la pestaña Clubes de esta planilla, completá una fila por club y dejá planilla_id vacío:
//   slug | nombre | planilla_id | activo | ciudad | escudo | color1 | color2 | nombre_corto | lema | pitazo_club_id | pitazo_liga_id | admin_email
// Después: menú Pitazo Clubs > Crear clubes nuevos (o ejecutá crearClub() desde el editor).
// La web del club queda sola en .../Pitazoclubs/<slug>/
const COLUMNAS_CLUBES = ['slug', 'nombre', 'planilla_id', 'activo', 'ciudad', 'escudo', 'color1', 'color2', 'nombre_corto', 'lema', 'pitazo_club_id', 'pitazo_liga_id', 'admin_email'];

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Pitazo Clubs')
    .addItem('Crear clubes nuevos', 'crearClub')
    .addItem('Preparar la pestaña Clubes', 'prepararClubes')
    .addItem('Diagnóstico', 'diagnostico')
    .addToUi();
}
function hojaClubes_() {
  let cl = central_().getSheetByName('Clubes');
  if (!cl) { cl = central_().insertSheet('Clubes'); cl.setFrozenRows(1); }
  const h = cl.getLastColumn() ? cl.getRange(1, 1, 1, cl.getLastColumn()).getValues()[0].map(String) : [];
  COLUMNAS_CLUBES.forEach(k => { if (h.indexOf(k) < 0) { h.push(k); cl.getRange(1, h.length).setValue(k).setFontWeight('bold'); } });
  return { sh: cl, h: h };
}
/** Agrega a la pestaña Clubes las columnas que falten (no borra nada). */
function prepararClubes() { hojaClubes_(); aviso_('Pestaña Clubes lista. Completá una fila por club, con planilla_id vacío, y usá "Crear clubes nuevos".'); }

/** Crea la planilla de cada club de la pestaña Clubes que todavía no tiene planilla_id. */
function crearClub(datos) {
  if (datos && datos.slug) {   // uso desde código: crearClub({ slug, nombre, ... })
    if (clubes_().some(c => String(c.slug).toLowerCase() === String(datos.slug).toLowerCase())) throw new Error('Ya existe un club con slug ' + datos.slug);
    const id = crearPlanillaClub_(datos), { sh, h } = hojaClubes_();
    sh.appendRow(h.map(k => k === 'planilla_id' ? id : k === 'activo' ? 'SI' : (datos[k] || '')));
    return id;
  }
  const { sh, h } = hojaClubes_();
  const filas = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, h.length).getValues() : [];
  const col = k => h.indexOf(k);
  const hechos = [], errores = [];
  filas.forEach((r, i) => {
    const d = {}; h.forEach((k, j) => d[k] = String(r[j] === undefined ? '' : r[j]).trim());
    if (!d.slug || d.planilla_id) return;
    try {
      d.slug = d.slug.toLowerCase().replace(/[^a-z0-9-]/g, '');
      if (!d.nombre) throw new Error('falta el nombre');
      if (filas.some((o, k) => k !== i && String(o[col('slug')]).trim().toLowerCase() === d.slug)) throw new Error('el slug está repetido');
      const id = crearPlanillaClub_(d);
      sh.getRange(i + 2, col('slug') + 1).setValue(d.slug);
      sh.getRange(i + 2, col('planilla_id') + 1).setValue(id);
      if (!d.activo) sh.getRange(i + 2, col('activo') + 1).setValue('SI');
      hechos.push(d.nombre + ' → /' + d.slug + '/');
    } catch (err) { errores.push((d.nombre || d.slug) + ': ' + (err.message || err)); }
  });
  const msj = (hechos.length ? 'Clubes creados:\n' + hechos.join('\n') : 'No había clubes nuevos (filas con slug y sin planilla_id).') + (errores.length ? '\n\nCon problemas:\n' + errores.join('\n') : '');
  aviso_(msj);
  return msj;
}
function aviso_(m) { console.log(m); try { SpreadsheetApp.getUi().alert(m); } catch (err) {} }

/** Arma la planilla del club con todas las pestañas y lo básico. Devuelve su id. */
function crearPlanillaClub_(datos) {
  const ss = SpreadsheetApp.create('Pitazo Clubs - ' + datos.nombre);
  Object.keys(MOTOR.TABLAS).forEach((t, i) => {
    const sh = i === 0 ? ss.getSheets()[0].setName(t) : ss.insertSheet(t);
    sh.getRange(1, 1, 1, MOTOR.TABLAS[t].length).setValues([MOTOR.TABLAS[t]]).setFontWeight('bold');
    sh.setFrozenRows(1);
    formatoTexto_(sh, MOTOR.TABLAS[t]);
  });
  try { const f = DriveApp.getFileById(ss.getId()); carpeta_(DriveApp.getRootFolder(), CARPETA_ARCHIVOS).addFile(f); DriveApp.getRootFolder().removeFile(f); } catch (err) {}
  const s = store_(ss.getId());
  const cfg = {
    nombre: datos.nombre, nombre_corto: datos.nombre_corto || datos.nombre, lema: datos.lema || '', pitazo_club_id: datos.pitazo_club_id || '',
    pitazo_liga_id: datos.pitazo_liga_id || 'L01', escudo: datos.escudo || '', color1: datos.color1 || '#D7261E', color2: datos.color2 || '#FFFFFF',
    ciudad: datos.ciudad || '', cuota_vence_dia: '10', entradas_horas_antes: '24'
  };
  Object.keys(cfg).forEach(k => s.insert('Config', { clave: k, valor: cfg[k] }));
  [['Activo', 8000, 'Mayores de 18.'], ['Cadete', 5000, 'Menores de 18.'], ['Grupo familiar', 15000, 'Titular + familia que vive en la misma casa.']]
    .forEach((c, i) => MOTOR.guardar(s, 'Categorias', { nombre: c[0], monto: c[1], descripcion: c[2], orden: i + 1 }));
  String(datos.admin_email || '').split(/[,;\s]+/).filter(Boolean).forEach(m => s.insert('Usuarios', { email: m.toLowerCase(), nombre: '', rol: 'admin', activo: 'SI' }));
  return ss.getId();
}

/** Ejecutala una vez desde el editor cuando Google pida permisos nuevos (Gmail, Drive, conexiones externas). */
function autorizar() {
  console.log('Mails disponibles hoy: ' + MailApp.getRemainingDailyQuota());
  console.log('Drive: ' + DriveApp.getRootFolder().getName() + ' · Planilla: ' + SpreadsheetApp.getActiveSpreadsheet().getName());
  UrlFetchApp.fetch('https://www.google.com', { muteHttpExceptions: true });
  console.log('Permisos OK. Ahora: Implementar > Gestionar implementaciones > editar > Nueva versión.');
}

/** Hace los mismos pedidos que la web y muestra la respuesta en el registro. */
function diagnostico() {
  console.log('Versión del código guardado: ' + VERSION_API);
  console.log('Planilla central: ' + central_().getName() + ' · pestañas: ' + central_().getSheets().map(x => x.getName()).join(', '));
  const primero = (clubes_()[0] || {}).slug || 'pirovano';
  [['ping', {}], ['clubes', {}], ['publico', { club: primero }]].forEach(([r, extra]) => {
    try {
      const out = doGet({ parameter: Object.assign({ r: r }, extra) }).getContent();
      console.log('?r=' + r + ' → ' + out.slice(0, 400));
    } catch (err) { console.log('?r=' + r + ' → ERROR: ' + (err.stack || err)); }
  });
  clubes_().forEach(c => {
    try {
      const ss = SpreadsheetApp.openById(c.planilla_id);
      console.log(c.slug + ': ' + ss.getName() + ' · socios: ' + (ss.getSheetByName('Socios').getLastRow() - 1));
    } catch (err) { console.log(c.slug + ' → ERROR: ' + (err.message || err)); }
  });
}
