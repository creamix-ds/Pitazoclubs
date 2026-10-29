/**
 * Pitazo Clubs — API (Apps Script). Separada de Pitazo Final: tiene su propia planilla.
 * De Pitazo Final solo se leen datos públicos, desde la web (no desde acá).
 *
 * Instalación (una sola vez):
 *  1. Creá una planilla nueva en Drive llamada "Pitazo Clubs" > Extensiones > Apps Script.
 *  2. Pegá TODO Code.gs (motor + este archivo) y guardá.
 *  3. Completá GOOGLE_CLIENT_ID abajo (el mismo que va en js/config.js).
 *  4. Ejecutá la función crearPirovano() una vez y aceptá los permisos.
 *     Crea la planilla del club, la registra en la pestaña Clubes y carga lo básico.
 *  5. Implementar > Nueva implementación > Aplicación web.
 *     Ejecutar como: Yo. Quién tiene acceso: Cualquier persona.
 *  6. Copiá la URL /exec en API_URL de js/config.js.
 *  Opcional: Configuración del proyecto > Propiedades del script > GEMINI_API_KEY
 *  (la misma clave de Gemini de Pitazo Final sirve) para las crónicas y el resumen con IA.
 *
 * Cada club tiene su propia planilla (pestañas Config, Usuarios, Categorias, Actividades,
 * Socios, Cuotas, Pagos, Noticias, Sponsors, Accesos, Solicitudes). La planilla central
 * solo tiene la pestaña Clubes: slug | nombre | planilla_id | activo.
 *
 * GET  ?r=publico&c=pirovano                       datos públicos de la web del club
 * GET  ?r=clubes                                  lista para la portada de Pitazo Clubs
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
 */

const GOOGLE_CLIENT_ID = '513742201235-79a1b7tnk46vt8db28e8t54rqbqhrk3p.apps.googleusercontent.com'; // proyecto de Google Cloud pitazoclubs
const CARPETA_ARCHIVOS = 'Pitazo Clubs - archivos';
const SOCIO_DIAS = 60;                // cuánto dura la sesión del socio en el celular

// Qué puede hacer cada rol del panel (columna rol de la pestaña Usuarios).
const PERMISOS = {
  admin: '*',
  tesorero: ['guardar:Socios', 'borrar:Socios', 'guardar:Cuotas', 'borrar:Cuotas', 'generarCuotas', 'registrarPago', 'resolverPago', 'enviarCodigo',
    'aprobarSolicitud', 'rechazarSolicitud', 'validarAcceso', 'nuevoCodigo', 'resumenComision'],
  prensa: ['guardar:Noticias', 'borrar:Noticias', 'redactar', 'subirArchivo'],
  puerta: ['validarAcceso']
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
    if (!sh) { sh = ss.insertSheet(t); sh.appendRow(MOTOR.TABLAS[t]); sh.setFrozenRows(1); }
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
function fechaTexto_(d, campo) {
  const f = /hora|fecha_hora/.test(campo) ? 'yyyy-MM-dd HH:mm' : 'yyyy-MM-dd';
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
    if (p.r === 'ping' || !p.r) return json_({ ok: true, servicio: 'Pitazo Clubs' });
    if (p.r === 'clubes') {  // portada de Pitazo Clubs
      return json_({ ok: true, data: clubes_().filter(c => String(c.activo || 'SI') !== 'NO').map(c => ({ slug: c.slug, nombre: c.nombre, ciudad: c.ciudad || '', escudo: c.escudo || '', color1: c.color1 || '' })) });
    }
    if (p.r === 'publico') {
      const club = clubPorSlug_(p.c);
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
      return limpio_(MOTOR.vistaSocio(s, id));
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
    case 'validarAcceso': return MOTOR.validarAcceso(s, a.leido, a.lugar);
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
  const devs = String(PropertiesService.getScriptProperties().getProperty('ADMINS') || '').toLowerCase().split(',').map(x => x.trim());
  const u = s.rows('Usuarios').filter(x => String(x.email).toLowerCase().trim() === info.email && String(x.activo || 'SI') !== 'NO')[0];
  if (!u && devs.indexOf(info.email) < 0) throw new Error('La cuenta ' + info.email + ' no tiene acceso al panel de ' + club.nombre + '. Pedile a un administrador que la agregue en Ajustes > Quién entra al panel.');
  return { usuario: { email: info.email, nombre: (u && u.nombre) || info.nombre, rol: u ? String(u.rol || 'admin') : 'admin' } };
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
function tocar_(slug) { PropertiesService.getScriptProperties().setProperty('v_' + slug, String(Date.now())); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// ---------- alta de clubes ----------
/**
 * Crea la planilla de un club nuevo, con todas las pestañas, y la registra en Clubes.
 * datos: { slug, nombre, nombre_corto, pitazo_club_id, pitazo_liga_id, escudo, color1, color2, admin_email }
 */
function crearClub(datos) {
  if (!datos || !datos.slug) throw new Error('Falta el slug (la palabra que va en ?c=...).');
  let cl = central_().getSheetByName('Clubes');
  if (!cl) { cl = central_().insertSheet('Clubes'); cl.appendRow(['slug', 'nombre', 'planilla_id', 'activo', 'ciudad', 'escudo', 'color1']); cl.setFrozenRows(1); }
  if (clubes_().some(c => String(c.slug).toLowerCase() === datos.slug.toLowerCase())) throw new Error('Ya existe un club con slug ' + datos.slug);
  const ss = SpreadsheetApp.create('Pitazo Clubs - ' + datos.nombre);
  Object.keys(MOTOR.TABLAS).forEach((t, i) => {
    const sh = i === 0 ? ss.getSheets()[0].setName(t) : ss.insertSheet(t);
    sh.getRange(1, 1, 1, MOTOR.TABLAS[t].length).setValues([MOTOR.TABLAS[t]]).setFontWeight('bold');
    sh.setFrozenRows(1);
    // DNI, CBU, PIN y teléfonos como texto (que no se coman los ceros).
    ['dni', 'pin', 'telefono', 'codigo_carnet', 'periodo', 'valor', 'numero'].forEach(k => {
      const j = MOTOR.TABLAS[t].indexOf(k);
      if (j >= 0) sh.getRange(2, j + 1, 999, 1).setNumberFormat('@');
    });
  });
  // Mover a la carpeta de Pitazo Clubs.
  try { const f = DriveApp.getFileById(ss.getId()); carpeta_(DriveApp.getRootFolder(), CARPETA_ARCHIVOS).addFile(f); DriveApp.getRootFolder().removeFile(f); } catch (err) {}
  const s = store_(ss.getId());
  const cfg = {
    nombre: datos.nombre, nombre_corto: datos.nombre_corto || datos.nombre, lema: datos.lema || '', pitazo_club_id: datos.pitazo_club_id || '',
    pitazo_liga_id: datos.pitazo_liga_id || '', escudo: datos.escudo || '', color1: datos.color1 || '#D7261E', color2: datos.color2 || '#FFFFFF',
    ciudad: datos.ciudad || '', cuota_vence_dia: '10'
  };
  Object.keys(cfg).forEach(k => s.insert('Config', { clave: k, valor: cfg[k] }));
  [['Activo', 8000, 'Mayores de 18.'], ['Cadete', 5000, 'Menores de 18.'], ['Grupo familiar', 15000, 'Titular + familia que vive en la misma casa.']]
    .forEach((c, i) => MOTOR.guardar(s, 'Categorias', { nombre: c[0], monto: c[1], descripcion: c[2], orden: i + 1 }));
  if (datos.admin_email) s.insert('Usuarios', { email: datos.admin_email.toLowerCase(), nombre: '', rol: 'admin', activo: 'SI' });
  cl.appendRow([datos.slug.toLowerCase(), datos.nombre, ss.getId(), 'SI', datos.ciudad || '', datos.escudo || '', datos.color1 || '']);
  return ss.getUrl();
}

/** Ejecutá esta función una vez para dar de alta a Pirovano. */
function crearPirovano() {
  const url = crearClub({
    slug: 'pirovano', nombre: 'Club Deportivo Pirovano', nombre_corto: 'Deportivo Pirovano', lema: 'Pirovano está',
    pitazo_club_id: 'CL06', pitazo_liga_id: 'L01', ciudad: 'Pirovano, partido de Bolívar',
    escudo: 'https://lh3.googleusercontent.com/d/1oMxLbfoEdBNMqrP8tEZHbgXsFIoHBwcP', color1: '#D7261E', color2: '#FFFFFF',
    admin_email: 'creamixds@gmail.com'
  });
  console.log('Planilla de Pirovano: ' + url);
}
