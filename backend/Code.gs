/* Pitazo Clubs — motor.
 * La misma lógica corre en el navegador (modo demo) y en Apps Script (Code.gs se arma
 * pegando este archivo + backend/base.gs). No usa nada del navegador ni de Google:
 * recibe un "store" con rows(t), insert(t, fila), update(t, fila), remove(t, id).
 */
var MOTOR = (function () {
  'use strict';

  // ---------- Tablas (una pestaña por tabla en la planilla del club) ----------
  var TABLAS = {
    Config: ['clave', 'valor'],
    Usuarios: ['email', 'nombre', 'rol', 'activo'],
    Categorias: ['id', 'nombre', 'monto', 'descripcion', 'orden'],
    Actividades: ['id', 'nombre', 'dias', 'horario', 'lugar', 'profesor', 'monto', 'descripcion', 'imagen', 'publica'],
    Socios: ['id', 'numero', 'nombre', 'apellido', 'dni', 'nacimiento', 'telefono', 'email', 'direccion',
      'categoria_id', 'titular_id', 'actividades', 'alta', 'estado', 'pin', 'codigo_carnet', 'foto', 'observaciones'],
    Cuotas: ['id', 'socio_id', 'periodo', 'concepto', 'monto', 'vence', 'estado', 'pago_id'],
    Pagos: ['id', 'socio_id', 'fecha', 'monto', 'medio', 'cuotas', 'comprobante', 'estado', 'registrado_por', 'observaciones'],
    Noticias: ['id', 'fecha', 'titulo', 'resumen', 'cuerpo', 'imagen', 'partido_id', 'publicada', 'autor'],
    Sponsors: ['id', 'nombre', 'logo', 'link', 'orden'],
    Accesos: ['id', 'fecha_hora', 'socio_id', 'nombre', 'resultado', 'motivo', 'lugar', 'entrada_id'],
    Solicitudes: ['id', 'fecha', 'nombre', 'apellido', 'dni', 'nacimiento', 'telefono', 'email', 'categoria_id', 'actividades', 'mensaje', 'estado', 'socio_id'],
    // Partidos con venta de entradas (los arma el club; se pueden traer de Pitazo Final).
    Partidos: ['id', 'fecha', 'hora', 'rival', 'torneo', 'lugar', 'precio_general', 'precio_socio', 'cupo', 'estado', 'pitazo_partido_id', 'observaciones'],
    Entradas: ['id', 'partido_id', 'fecha_hora', 'tipo', 'socio_id', 'nombre', 'dni', 'telefono', 'email', 'cantidad', 'precio_unit', 'total',
      'estado', 'medio', 'comprobante', 'codigo', 'usadas', 'ultimo_uso', 'registrado_por', 'observaciones']
  };
  var PREFIJO = { Categorias: 'CAT', Actividades: 'ACT', Socios: 'S', Cuotas: 'C', Pagos: 'PG', Noticias: 'NC', Sponsors: 'SP', Accesos: 'AC', Solicitudes: 'SOL', Partidos: 'PT', Entradas: 'EN' };
  var DIGITOS = { Socios: 4, Cuotas: 5, Pagos: 4, Accesos: 5, Solicitudes: 4, Partidos: 3, Entradas: 5 };

  // Claves de Config que nunca salen en la web pública.
  var PRIVADAS = ['mp_access_token', 'gemini', 'secreto', 'cobro_', 'mp_link'];  // los datos de cobro los ve solo el socio que entró

  // ---------- utilidades ----------
  function txt(v) { return v === null || v === undefined ? '' : String(v).trim(); }
  function num(v) {
    if (typeof v === 'number') return v;
    var s = txt(v).replace(/\$/g, '').replace(/\s/g, '');
    if (!s) return 0;
    if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(/[.,](?=\d{3}(\D|$))/g, '');
    var n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }
  function lista(v) { return txt(v).split(',').map(function (x) { return x.trim(); }).filter(Boolean); }
  function pad(n, d) { var s = String(n); while (s.length < d) s = '0' + s; return s; }
  function hoyISO(store) { return store.hoy ? store.hoy() : new Date().toISOString().slice(0, 10); }
  function ahora(store) { return store.ahora ? store.ahora() : new Date().toISOString().slice(0, 16).replace('T', ' '); }
  function fechaISO(v) {
    var s = txt(v);
    var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return m[3] + '-' + pad(m[2], 2) + '-' + pad(m[1], 2);
    return s.slice(0, 10);
  }
  function azar(n, alfabeto) {
    var a = alfabeto || 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = '';
    for (var i = 0; i < n; i++) s += a.charAt(Math.floor(Math.random() * a.length));
    return s;
  }
  function err(m) { var e = new Error(m); e.usuario = true; return e; }
  function porId(store, t, id) {
    var r = store.rows(t);
    for (var i = 0; i < r.length; i++) if (txt(r[i].id) === txt(id)) return r[i];
    return null;
  }
  function nuevoId(store, t) {
    var p = PREFIJO[t] || t.slice(0, 2).toUpperCase(), max = 0;
    store.rows(t).forEach(function (r) {
      var m = txt(r.id).match(/(\d+)$/);
      if (m && txt(r.id).indexOf(p) === 0) max = Math.max(max, parseInt(m[1], 10));
    });
    return p + pad(max + 1, DIGITOS[t] || 3);
  }
  function soloDigitos(v) { return txt(v).replace(/\D/g, ''); }
  function nombreDe(s) { return s ? (txt(s.nombre) + ' ' + txt(s.apellido)).trim() : ''; }
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  function nombrePeriodo(p) { var m = txt(p).match(/^(\d{4})-(\d{2})$/); return m ? MESES[parseInt(m[2], 10) - 1] + ' ' + m[1] : txt(p); }
  // Links que carga el club: "creamixds.com" -> "https://creamixds.com", y los de Google Drive
  // (drive.google.com/file/d/ID/...) -> https://lh3.googleusercontent.com/d/ID para que se vean como imagen.
  function url(v, esImagen) {
    var s = txt(v);
    if (!s || /^(data:|mailto:|tel:|#)/i.test(s)) return s;
    var d = s.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]{20,})/) || s.match(/lh3\.googleusercontent\.com\/d\/([\w-]{20,})/);
    if (d && esImagen) return 'https://lh3.googleusercontent.com/d/' + d[1];
    if (/^\/\//.test(s)) return 'https:' + s;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(s) && /^[\w-]+(\.[\w-]+)+([\/?#:].*)?$/.test(s)) return 'https://' + s.replace(/^[^\/?#]+/, function (h) { return h.toLowerCase(); });
    return s;
  }
  var CAMPOS_LINK = { link: false, logo: true, imagen: true, foto: true };
  var CONFIG_LINK = { escudo: true, facebook: false, mp_link: false };
  function plata(n) { return '$' + Math.round(num(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

  // ---------- Config ----------
  function config(store, conPrivadas) {
    var c = {};
    store.rows('Config').forEach(function (r) {
      var k = txt(r.clave);
      if (!k) return;
      if (!conPrivadas && PRIVADAS.some(function (p) { return k.indexOf(p) === 0; })) return;
      c[k] = txt(r.valor);
    });
    return c;
  }
  function guardarConfig(store, cambios) {
    var filas = store.rows('Config');
    Object.keys(cambios || {}).forEach(function (k) {
      var fila = null;
      filas.forEach(function (r) { if (txt(r.clave) === k) fila = r; });
      var v = k in CONFIG_LINK ? url(cambios[k], CONFIG_LINK[k]) : txt(cambios[k]);
      if (fila) { if (txt(fila.valor) !== v) store.update('Config', { clave: k, valor: v }, 'clave'); }
      else store.insert('Config', { clave: k, valor: v });
    });
    return config(store, false);
  }

  // ---------- Socios ----------
  function cuotasDe(store, socioId) {
    return store.rows('Cuotas').filter(function (c) { return txt(c.socio_id) === txt(socioId) && txt(c.estado) !== 'Anulada'; })
      .sort(function (a, b) { return txt(a.periodo) < txt(b.periodo) ? -1 : 1; });
  }
  // Estado de cuenta: al día si no tiene cuotas pendientes vencidas.
  function estadoDe(store, socio, cuotas) {
    var hoy = hoyISO(store);
    cuotas = cuotas || cuotasDe(store, socio.id);
    var pend = cuotas.filter(function (c) { return txt(c.estado) === 'Pendiente'; });
    var aConfirmar = cuotas.filter(function (c) { return txt(c.estado) === 'A confirmar'; });
    var vencidas = pend.filter(function (c) { return fechaISO(c.vence) && fechaISO(c.vence) < hoy; });
    var deuda = pend.reduce(function (s, c) { return s + num(c.monto); }, 0);
    var activo = txt(socio.estado || 'Activo') === 'Activo';
    var etiqueta = !activo ? txt(socio.estado) : vencidas.length ? (vencidas.length === 1 ? 'Debe 1 cuota' : 'Debe ' + vencidas.length + ' cuotas')
      : aConfirmar.length ? 'Pago a confirmar' : 'Al día';
    return {
      activo: activo, alDia: activo && !vencidas.length, deuda: deuda,
      pendientes: pend.length, vencidas: vencidas.length, aConfirmar: aConfirmar.length, etiqueta: etiqueta
    };
  }
  // Un integrante del grupo familiar sigue al titular.
  function estadoConTitular(store, socio) {
    var t = txt(socio.titular_id) ? porId(store, 'Socios', socio.titular_id) : null;
    if (!t) return estadoDe(store, socio);
    var e = estadoDe(store, t);
    var propio = txt(socio.estado || 'Activo') === 'Activo';
    e.activo = e.activo && propio; e.alDia = e.alDia && propio;
    if (!propio) e.etiqueta = txt(socio.estado);
    e.titular = nombreDe(t);
    return e;
  }

  function guardarSocio(store, fila) {
    var s = {};
    TABLAS.Socios.forEach(function (k) { if (fila[k] !== undefined) s[k] = txt(fila[k]); });
    if (!s.nombre || !s.apellido) throw err('Falta el nombre y el apellido.');
    s.dni = soloDigitos(s.dni);
    if (s.dni.length < 7 || s.dni.length > 9) throw err('El DNI tiene que tener entre 7 y 9 números.');
    var otro = store.rows('Socios').filter(function (x) { return soloDigitos(x.dni) === s.dni && txt(x.id) !== txt(s.id); })[0];
    if (otro) throw err('Ya hay un socio con ese DNI: ' + nombreDe(otro) + ' (N° ' + otro.numero + ').');
    if (s.titular_id && s.titular_id === s.id) throw err('Un socio no puede ser su propio titular.');
    if (s.id && porId(store, 'Socios', s.id)) {
      var previo = porId(store, 'Socios', s.id);
      Object.keys(previo).forEach(function (k) { if (s[k] === undefined) s[k] = previo[k]; });
      store.update('Socios', s);
    } else {
      s.id = nuevoId(store, 'Socios');
      var max = 0;
      store.rows('Socios').forEach(function (x) { max = Math.max(max, num(x.numero)); });
      s.numero = s.numero || String(max + 1);
      s.alta = s.alta || hoyISO(store);
      s.estado = s.estado || 'Activo';
      s.pin = s.pin || azar(4, '0123456789');
      s.codigo_carnet = azar(8);
      if (!s.categoria_id) { var cat = store.rows('Categorias')[0]; s.categoria_id = cat ? cat.id : ''; }
      store.insert('Socios', s);
    }
    return s;
  }

  // El club le pasa al socio un PIN de 4 números (lo ve en su ficha y lo puede mandar por WhatsApp).
  function ingresarSocio(store, dni, pin) {
    dni = soloDigitos(dni); pin = soloDigitos(pin);
    var s = store.rows('Socios').filter(function (x) { return soloDigitos(x.dni) === dni; })[0];
    if (!s || !pin || soloDigitos(s.pin) !== pin) throw err('El DNI o el código no coinciden. Pedí tu código en el club.');
    if (txt(s.estado) === 'Baja') throw err('Tu socio figura dado de baja. Consultá en el club.');
    return s;
  }

  function vistaSocio(store, socioId) {
    var s = porId(store, 'Socios', socioId);
    if (!s) throw err('No se encontró el socio.');
    var titular = txt(s.titular_id) ? porId(store, 'Socios', s.titular_id) : null;
    var paga = titular || s;
    var cuotas = cuotasDe(store, paga.id);
    var pagos = store.rows('Pagos').filter(function (p) { return txt(p.socio_id) === txt(paga.id); })
      .sort(function (a, b) { return txt(a.fecha) < txt(b.fecha) ? 1 : -1; });
    var cfg = config(store, true);
    var cat = porId(store, 'Categorias', s.categoria_id);
    var acts = lista(s.actividades).map(function (id) { return porId(store, 'Actividades', id); }).filter(Boolean);
    var grupo = store.rows('Socios').filter(function (x) { return txt(x.titular_id) === txt(paga.id) || txt(x.id) === txt(paga.id); });
    var limpio = {};
    Object.keys(s).forEach(function (k) { if (k !== 'pin') limpio[k] = s[k]; });
    return {
      socio: limpio,
      categoria: cat ? cat.nombre : '',
      actividades: acts.map(function (a) { return { id: a.id, nombre: a.nombre, dias: a.dias, horario: a.horario }; }),
      estado: estadoConTitular(store, s),
      titular: titular ? nombreDe(titular) : '',
      grupo: grupo.map(function (x) { return { id: x.id, nombre: nombreDe(x), numero: x.numero }; }),
      cuotas: cuotas, pagos: pagos.slice(0, 20),
      qr: 'PC1:' + txt(cfg.pitazo_club_id || 'CLUB') + ':' + s.id + ':' + txt(s.codigo_carnet),
      tickets: entradasDelSocio(store, s),
      cobro: {
        alias: cfg.cobro_alias || '', cbu: cfg.cobro_cbu || '', titular: cfg.cobro_titular || '',
        banco: cfg.cobro_banco || '', cuit: cfg.cobro_cuit || '', mp_link: cfg.mp_link || '', whatsapp: cfg.whatsapp || ''
      }
    };
  }

  // ---------- Cuotas ----------
  function montoMensual(store, socio) {
    if (txt(socio.titular_id)) return 0; // paga el titular
    var cat = porId(store, 'Categorias', socio.categoria_id);
    var total = cat ? num(cat.monto) : 0;
    lista(socio.actividades).forEach(function (id) { var a = porId(store, 'Actividades', id); if (a) total += num(a.monto); });
    // Actividades de los integrantes del grupo familiar también las paga el titular.
    store.rows('Socios').filter(function (x) { return txt(x.titular_id) === txt(socio.id) && txt(x.estado || 'Activo') === 'Activo'; })
      .forEach(function (x) { lista(x.actividades).forEach(function (id) { var a = porId(store, 'Actividades', id); if (a) total += num(a.monto); }); });
    return total;
  }
  function generarCuotas(store, periodo) {
    if (!/^\d{4}-\d{2}$/.test(txt(periodo))) throw err('Elegí el mes (por ejemplo 2026-11).');
    var cfg = config(store, true);
    var dia = Math.min(28, Math.max(1, num(cfg.cuota_vence_dia) || 10));
    var vence = periodo + '-' + pad(dia, 2);
    var ya = {};
    store.rows('Cuotas').forEach(function (c) { if (txt(c.periodo) === periodo && txt(c.concepto) === 'Cuota social' && txt(c.estado) !== 'Anulada') ya[txt(c.socio_id)] = true; });
    var creadas = [], total = 0, sinMonto = 0;
    store.rows('Socios').forEach(function (s) {
      if (txt(s.estado || 'Activo') !== 'Activo' || txt(s.titular_id) || ya[txt(s.id)]) return;
      var m = montoMensual(store, s);
      if (!m) { sinMonto++; return; }
      var c = { id: nuevoId(store, 'Cuotas'), socio_id: s.id, periodo: periodo, concepto: 'Cuota social', monto: m, vence: vence, estado: 'Pendiente', pago_id: '' };
      store.insert('Cuotas', c); creadas.push(c); total += m;
    });
    return { creadas: creadas.length, total: total, yaTenian: Object.keys(ya).length, sinMonto: sinMonto };
  }

  // ---------- Pagos ----------
  // El dinero va directo a la cuenta del club (alias/CBU o Mercado Pago del club).
  // Pitazo Clubs solo registra el pago: lo carga el tesorero o lo informa el socio con su comprobante.
  function registrarPago(store, d, usuario) {
    var socio = porId(store, 'Socios', d.socio_id);
    if (!socio) throw err('Elegí el socio.');
    if (txt(socio.titular_id)) socio = porId(store, 'Socios', socio.titular_id) || socio;
    var ids = Array.isArray(d.cuotas) ? d.cuotas : lista(d.cuotas);
    var cuotas = ids.map(function (id) { return porId(store, 'Cuotas', id); }).filter(Boolean);
    cuotas.forEach(function (c) {
      if (txt(c.socio_id) !== txt(socio.id)) throw err('Una de las cuotas no es de este socio.');
      if (txt(c.estado) === 'Pagada') throw err('La cuota de ' + nombrePeriodo(c.periodo) + ' ya está pagada.');
    });
    var monto = d.monto !== undefined && txt(d.monto) !== '' ? num(d.monto) : cuotas.reduce(function (s, c) { return s + num(c.monto); }, 0);
    if (monto <= 0) throw err('El monto tiene que ser mayor a cero.');
    var estado = d.estado === 'A confirmar' ? 'A confirmar' : 'Confirmado';
    var p = {
      id: nuevoId(store, 'Pagos'), socio_id: socio.id, fecha: d.fecha || ahora(store), monto: monto,
      medio: txt(d.medio) || 'Efectivo', cuotas: cuotas.map(function (c) { return c.id; }).join(', '),
      comprobante: txt(d.comprobante), estado: estado, registrado_por: txt(usuario), observaciones: txt(d.observaciones)
    };
    store.insert('Pagos', p);
    cuotas.forEach(function (c) { c.estado = estado === 'Confirmado' ? 'Pagada' : 'A confirmar'; c.pago_id = p.id; store.update('Cuotas', c); });
    return p;
  }
  function informarPago(store, socioId, d) {
    var socio = porId(store, 'Socios', socioId);
    if (!socio) throw err('Sesión vencida.');
    var ids = Array.isArray(d.cuotas) ? d.cuotas : lista(d.cuotas);
    if (!ids.length) throw err('Marcá qué cuotas pagaste.');
    if (!txt(d.comprobante)) throw err('Subí la foto o el PDF del comprobante.');
    return registrarPago(store, { socio_id: socioId, cuotas: ids, medio: d.medio || 'Transferencia', comprobante: d.comprobante, estado: 'A confirmar', observaciones: d.observaciones }, 'socio');
  }
  function resolverPago(store, pagoId, aprobar, usuario, motivo) {
    var p = porId(store, 'Pagos', pagoId);
    if (!p) throw err('No se encontró el pago.');
    if (txt(p.estado) !== 'A confirmar') throw err('Ese pago ya fue revisado.');
    p.estado = aprobar ? 'Confirmado' : 'Rechazado';
    p.registrado_por = txt(usuario);
    if (motivo) p.observaciones = (txt(p.observaciones) ? txt(p.observaciones) + ' · ' : '') + txt(motivo);
    store.update('Pagos', p);
    lista(p.cuotas).forEach(function (id) {
      var c = porId(store, 'Cuotas', id);
      if (!c) return;
      c.estado = aprobar ? 'Pagada' : 'Pendiente';
      c.pago_id = aprobar ? p.id : '';
      store.update('Cuotas', c);
    });
    return p;
  }

  // ---------- Solicitudes ("Asociate" de la web) ----------
  function solicitud(store, d) {
    var s = {};
    TABLAS.Solicitudes.forEach(function (k) { if (d[k] !== undefined) s[k] = txt(d[k]); });
    if (!s.nombre || !s.apellido) throw err('Completá nombre y apellido.');
    s.dni = soloDigitos(s.dni);
    if (s.dni.length < 7 || s.dni.length > 9) throw err('Revisá el DNI.');
    if (soloDigitos(s.telefono).length < 8) throw err('Dejanos un teléfono para avisarte.');
    if (store.rows('Socios').some(function (x) { return soloDigitos(x.dni) === s.dni && txt(x.estado) !== 'Baja'; }))
      throw err('Ya figurás como socio. Si no tenés tu código, pedilo en el club.');
    if (store.rows('Solicitudes').some(function (x) { return soloDigitos(x.dni) === s.dni && txt(x.estado) === 'Nueva'; }))
      throw err('Ya recibimos tu solicitud. Te vamos a contactar.');
    s.id = nuevoId(store, 'Solicitudes'); s.fecha = ahora(store); s.estado = 'Nueva'; s.socio_id = '';
    store.insert('Solicitudes', s);
    return { id: s.id };
  }
  function aprobarSolicitud(store, id) {
    var sol = porId(store, 'Solicitudes', id);
    if (!sol) throw err('No se encontró la solicitud.');
    if (txt(sol.estado) !== 'Nueva') throw err('La solicitud ya fue resuelta.');
    var socio = guardarSocio(store, {
      nombre: sol.nombre, apellido: sol.apellido, dni: sol.dni, nacimiento: sol.nacimiento, telefono: sol.telefono,
      email: sol.email, categoria_id: sol.categoria_id, actividades: sol.actividades
    });
    sol.estado = 'Aprobada'; sol.socio_id = socio.id;
    store.update('Solicitudes', sol);
    return socio;
  }

  // ---------- Entradas por partido ----------
  // Cada partido tiene precio general y precio socio. El socio al día paga el precio socio, y puede
  // sacar tantas entradas como integrantes activos tenga su grupo familiar (1 si es individual).
  // El QR de la entrada se habilita X horas antes del partido (Config entradas_horas_antes, 24 por defecto)
  // y se puede escanear tantas veces como entradas tenga.
  var ESTADOS_VIVOS = ['Sin pagar', 'A confirmar', 'Pagada'];
  function minutosDe(s) {
    var m = txt(s).match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?/);
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)) / 60000 : null;
  }
  function diaHora(s) { var m = txt(s).match(/^\d{4}-(\d{2})-(\d{2})(?: (\d{2}:\d{2}))?/); return m ? (+m[2]) + '/' + (+m[1]) + (m[3] ? ' ' + m[3] + ' h' : '') : txt(s); }
  function textoMinutos(n) { return new Date(n * 60000).toISOString().slice(0, 16).replace('T', ' '); }
  function horaDe(v) { var m = txt(v).match(/(\d{1,2})[:.](\d{2})/); return m ? pad(m[1], 2) + ':' + m[2] : ''; }
  function ventana(store, p) {
    var cfg = config(store, true);
    var antes = txt(cfg.entradas_horas_antes) === '' ? 24 : num(cfg.entradas_horas_antes);
    var fecha = fechaISO(p.fecha), hora = horaDe(p.hora);
    var ini = minutosDe(fecha + ' ' + (hora || '00:00'));
    if (ini === null) return { abierta: false, antes: true, paso: false, habilita: '', vence: '', inicio: '' };
    var desde = ini - antes * 60, hasta = Math.max(ini + 6 * 60, minutosDe(fecha + ' 23:59'));
    var ya = minutosDe(ahora(store));
    return { abierta: ya >= desde && ya <= hasta, antes: ya < desde, paso: ya > hasta, habilita: textoMinutos(desde), vence: textoMinutos(hasta), inicio: fecha + ' ' + (hora || ''), horas: antes };
  }
  function entradasDe(store, partidoId) {
    return store.rows('Entradas').filter(function (x) { return txt(x.partido_id) === txt(partidoId) && ESTADOS_VIVOS.indexOf(txt(x.estado)) >= 0; });
  }
  function infoPartido(store, p) {
    var vendidas = entradasDe(store, p.id).reduce(function (a, x) { return a + num(x.cantidad); }, 0);
    var cupo = num(p.cupo);
    return {
      id: p.id, fecha: fechaISO(p.fecha), hora: horaDe(p.hora), rival: txt(p.rival), torneo: txt(p.torneo), lugar: txt(p.lugar),
      precio_general: num(p.precio_general), precio_socio: num(p.precio_socio), cupo: cupo,
      disponibles: cupo ? Math.max(0, cupo - vendidas) : null, ventana: ventana(store, p), pitazo_partido_id: txt(p.pitazo_partido_id)
    };
  }
  // Partidos con entradas a la venta (los que todavía no pasaron).
  function partidosEnVenta(store) {
    return store.rows('Partidos').filter(function (p) { return txt(p.estado || 'Venta') === 'Venta'; })
      .map(function (p) { return infoPartido(store, p); })
      .filter(function (p) { return p.fecha && !p.ventana.paso; })
      .sort(function (a, b) { return (a.fecha + a.hora) < (b.fecha + b.hora) ? -1 : 1; });
  }
  // Grupo que comparte las entradas de socio: el titular y sus integrantes activos.
  function grupoDe(store, socio) {
    var tid = txt(socio.titular_id) || txt(socio.id);
    return store.rows('Socios').filter(function (x) {
      return (txt(x.id) === tid || txt(x.titular_id) === tid) && txt(x.estado || 'Activo') === 'Activo';
    });
  }
  function cupoSocio(store, socio, partidoId) {
    var ids = grupoDe(store, socio).map(function (x) { return txt(x.id); });
    var ya = entradasDe(store, partidoId).filter(function (x) { return txt(x.tipo) === 'Socio' && ids.indexOf(txt(x.socio_id)) >= 0; })
      .reduce(function (a, x) { return a + num(x.cantidad); }, 0);
    return { grupo: Math.max(1, ids.length), ya: ya, quedan: Math.max(0, Math.max(1, ids.length) - ya) };
  }
  // d = { partido_id, cantidad, nombre, apellido, dni, telefono, email, medio, estado }
  // socioId: si compra un socio desde su carnet. porPanel: venta en la puerta/secretaría (queda Pagada).
  function comprarEntrada(store, d, socioId, porPanel, usuario) {
    var p = porId(store, 'Partidos', d.partido_id);
    if (!p || txt(p.estado || 'Venta') !== 'Venta') throw err('Ese partido no tiene entradas a la venta.');
    var info = infoPartido(store, p);
    if (info.ventana.paso) throw err('Ese partido ya se jugó.');
    var cant = Math.floor(num(d.cantidad) || 1);
    if (cant < 1 || cant > 20) throw err('Elegí entre 1 y 20 entradas.');
    if (info.disponibles !== null && cant > info.disponibles) throw err(info.disponibles ? 'Quedan solo ' + info.disponibles + ' entradas.' : 'Se agotaron las entradas.');
    var e = { id: nuevoId(store, 'Entradas'), partido_id: p.id, fecha_hora: ahora(store), cantidad: cant, codigo: azar(8), usadas: 0, ultimo_uso: '',
      medio: txt(d.medio), comprobante: '', registrado_por: txt(usuario || (socioId ? 'socio' : 'web')), observaciones: txt(d.observaciones) };
    var s = socioId ? porId(store, 'Socios', socioId) : null;
    if (!s && porPanel && txt(d.socio_id)) s = porId(store, 'Socios', d.socio_id);
    if (socioId && !s) throw err('Sesión vencida.');
    var esSocio = false;
    if (s) {
      var est = estadoConTitular(store, s), c = cupoSocio(store, s, p.id);
      if (est.alDia && c.quedan >= cant) esSocio = true;
      else if (porPanel) esSocio = false; // en la puerta, si no le corresponde el precio de socio, paga general
      else if (est.alDia && c.quedan > 0) throw err('Con el precio de socio podés sacar ' + c.quedan + (c.quedan === 1 ? ' entrada' : ' entradas') + ' más (una por integrante del grupo familiar).');
      else if (est.alDia) throw err('Tu grupo familiar ya sacó sus ' + c.grupo + (c.grupo === 1 ? ' entrada' : ' entradas') + ' de socio para este partido.');
      else if (socioId) throw err('Para el precio de socio tenés que estar al día (' + est.etiqueta + '). Ponete al día o sacá la entrada general desde la web.');
      e.socio_id = s.id; e.nombre = nombreDe(s); e.dni = soloDigitos(s.dni); e.telefono = txt(s.telefono); e.email = txt(s.email);
    } else {
      e.nombre = (txt(d.nombre) + ' ' + txt(d.apellido)).trim(); e.dni = soloDigitos(d.dni); e.telefono = txt(d.telefono); e.email = txt(d.email).toLowerCase();
      if (!txt(d.nombre) || (!porPanel && !txt(d.apellido))) throw err('Completá nombre y apellido.');
      if (!porPanel && (e.dni.length < 7 || e.dni.length > 9)) throw err('Revisá el DNI.');
      if (!porPanel && soloDigitos(e.telefono).length < 8) throw err('Dejanos un celular por si hay que avisarte algo.');
      e.socio_id = '';
    }
    e.tipo = esSocio ? 'Socio' : 'General';
    e.precio_unit = esSocio ? info.precio_socio : info.precio_general;
    e.total = e.precio_unit * cant;
    e.estado = porPanel || e.total === 0 ? 'Pagada' : 'Sin pagar';
    if (porPanel && !e.medio) e.medio = 'Efectivo';
    store.insert('Entradas', e);
    return e;
  }
  function entradaPorCodigo(store, id, codigo) {
    var e = porId(store, 'Entradas', id);
    if (!e || txt(e.codigo).toUpperCase() !== txt(codigo).toUpperCase()) throw err('No encontramos esa entrada. Revisá el link.');
    return e;
  }
  function informarEntrada(store, id, codigo, comprobante, medio) {
    var e = entradaPorCodigo(store, id, codigo);
    if (['Sin pagar', 'Rechazada'].indexOf(txt(e.estado)) < 0) throw err(txt(e.estado) === 'Pagada' ? 'Esa entrada ya está paga.' : 'El club ya está revisando ese pago.');
    if (!txt(comprobante)) throw err('Subí la foto o el PDF del comprobante.');
    e.comprobante = txt(comprobante); e.medio = txt(medio) || 'Transferencia'; e.estado = 'A confirmar';
    store.update('Entradas', e);
    return e;
  }
  function resolverEntrada(store, id, aprobar, usuario, motivo) {
    var e = porId(store, 'Entradas', id);
    if (!e) throw err('No se encontró la entrada.');
    if (txt(e.estado) === 'Pagada' && aprobar) throw err('Esa entrada ya estaba confirmada.');
    e.estado = aprobar ? 'Pagada' : 'Rechazada';
    e.registrado_por = txt(usuario);
    if (motivo) e.observaciones = (txt(e.observaciones) ? txt(e.observaciones) + ' · ' : '') + txt(motivo);
    store.update('Entradas', e);
    return e;
  }
  function anularEntrada(store, id) {
    var e = porId(store, 'Entradas', id);
    if (!e) throw err('No se encontró la entrada.');
    if (num(e.usadas) > 0) throw err('Esa entrada ya se usó: no se puede anular.');
    e.estado = 'Anulada'; store.update('Entradas', e);
    return e;
  }
  // Lo que ve quien tiene el link de la entrada (o el socio en su carnet).
  function vistaEntrada(store, e, conCobro) {
    var p = porId(store, 'Partidos', e.partido_id);
    var info = p ? infoPartido(store, p) : null;
    var cfg = config(store, true);
    var v = {
      entrada: { id: e.id, codigo: e.codigo, partido_id: e.partido_id, tipo: e.tipo, nombre: e.nombre, cantidad: num(e.cantidad), usadas: num(e.usadas),
        precio_unit: num(e.precio_unit), total: num(e.total), estado: e.estado, fecha_hora: e.fecha_hora, observaciones: e.observaciones, socio_id: e.socio_id },
      partido: info,
      // El QR recién viaja cuando está pagada y abrió la ventana (X horas antes del partido).
      qr: txt(e.estado) === 'Pagada' && info && info.ventana.abierta && num(e.usadas) < num(e.cantidad) ? 'PE1:' + txt(cfg.pitazo_club_id || 'CLUB') + ':' + e.id + ':' + e.codigo : ''
    };
    if (conCobro && ['Sin pagar', 'Rechazada'].indexOf(txt(e.estado)) >= 0) v.cobro = { alias: cfg.cobro_alias || '', cbu: cfg.cobro_cbu || '', titular: cfg.cobro_titular || '', banco: cfg.cobro_banco || '', cuit: cfg.cobro_cuit || '', mp_link: cfg.mp_link || '', whatsapp: cfg.whatsapp || '' };
    return v;
  }
  // Entradas del grupo familiar del socio + partidos en venta con su precio.
  function entradasDelSocio(store, socio) {
    var ids = grupoDe(store, socio).map(function (x) { return txt(x.id); });
    if (ids.indexOf(txt(socio.id)) < 0) ids.push(txt(socio.id));
    var est = estadoConTitular(store, socio);
    var mias = store.rows('Entradas').filter(function (x) { return ids.indexOf(txt(x.socio_id)) >= 0 && ['Anulada'].indexOf(txt(x.estado)) < 0; })
      .map(function (x) { return vistaEntrada(store, x, true); })
      .filter(function (v) { return v.partido && !v.partido.ventana.paso; });
    var partidos = partidosEnVenta(store).map(function (p) { var c = cupoSocio(store, socio, p.id); p.socio = { grupo: c.grupo, ya: c.ya, quedan: est.alDia ? c.quedan : 0, alDia: est.alDia }; return p; });
    return { entradas: mias, partidos: partidos };
  }

  // ---------- Control de acceso ----------
  // Carnet: PC1:<club>:<socio>:<código> (o el DNI). Entrada: PE1:<club>:<entrada>:<código>.
  // cuantas: en una entrada familiar, cuántas personas pasan con esa lectura (1 por defecto).
  function validarAcceso(store, leido, lugar, cuantas) {
    var t = txt(leido), s = null, motivo = '', r;
    var me = t.match(/^PE1:[^:]*:([^:]+):([A-Z0-9]+)$/i);
    if (me) return validarEntrada(store, me[1], me[2], lugar, cuantas);
    var m = t.match(/^PC1:[^:]*:([^:]+):([A-Z0-9]+)$/i);
    if (m) {
      s = porId(store, 'Socios', m[1]);
      if (s && txt(s.codigo_carnet).toUpperCase() !== m[2].toUpperCase()) { s = null; motivo = 'Carnet viejo o falso: el código no coincide.'; }
    } else if (/^\d{7,9}$/.test(soloDigitos(t)) && soloDigitos(t) === t.replace(/[.\s]/g, '')) {
      s = store.rows('Socios').filter(function (x) { return soloDigitos(x.dni) === soloDigitos(t); })[0] || null;
    }
    if (!s) r = { ok: false, tipo: 'carnet', motivo: motivo || 'No es un carnet ni una entrada de este club.' };
    else {
      var e = estadoConTitular(store, s);
      var cat = porId(store, 'Categorias', s.categoria_id);
      var hoy = hoyISO(store);
      var antes = store.rows('Accesos').filter(function (a) { return txt(a.socio_id) === txt(s.id) && !txt(a.entrada_id) && txt(a.resultado) === 'Permitido' && txt(a.fecha_hora).slice(0, 10) === hoy && txt(a.lugar) === txt(lugar); })[0];
      r = {
        ok: e.alDia, tipo: 'carnet', motivo: e.alDia ? 'Socio al día' + (antes ? ' · ya había entrado hoy a las ' + txt(antes.fecha_hora).slice(11, 16) : '') : e.etiqueta + (e.deuda ? ' · ' + plata(e.deuda) : ''),
        socio: { id: s.id, nombre: nombreDe(s), numero: s.numero, categoria: cat ? cat.nombre : '', foto: s.foto, titular: e.titular || '' }
      };
    }
    store.insert('Accesos', {
      id: nuevoId(store, 'Accesos'), fecha_hora: ahora(store), socio_id: s ? s.id : '', nombre: s ? nombreDe(s) : t.slice(0, 40),
      resultado: r.ok ? 'Permitido' : 'Rechazado', motivo: r.motivo, lugar: txt(lugar), entrada_id: ''
    });
    return r;
  }
  function validarEntrada(store, id, codigo, lugar, cuantas) {
    var e = porId(store, 'Entradas', id), r;
    var p = e ? porId(store, 'Partidos', e.partido_id) : null;
    if (!e || txt(e.codigo).toUpperCase() !== txt(codigo).toUpperCase()) r = { ok: false, motivo: 'Entrada falsa o anulada: el código no coincide.' };
    else {
      var cant = num(e.cantidad), usadas = num(e.usadas), v = p ? ventana(store, p) : null;
      var quiere = Math.max(1, Math.floor(num(cuantas) || 1));
      if (txt(e.estado) !== 'Pagada') r = { ok: false, motivo: txt(e.estado) === 'A confirmar' ? 'Pago sin confirmar todavía' : 'Entrada ' + txt(e.estado).toLowerCase() };
      else if (!v) r = { ok: false, motivo: 'El partido de esta entrada ya no existe.' };
      else if (v.antes) r = { ok: false, motivo: 'Todavía no: es para el partido del ' + diaHora(v.inicio) + '. Se habilita el ' + diaHora(v.habilita) + '.' };
      else if (v.paso) r = { ok: false, motivo: 'Vencida: era para el partido del ' + diaHora(v.inicio) + '.' };
      else if (usadas >= cant) r = { ok: false, motivo: cant === 1 ? 'Ya se usó a las ' + txt(e.ultimo_uso).slice(11, 16) : 'Ya entraron las ' + cant + ' personas (última ' + txt(e.ultimo_uso).slice(11, 16) + ').' };
      else {
        var pasan = Math.min(quiere, cant - usadas);
        e.usadas = usadas + pasan; e.ultimo_uso = ahora(store);
        store.update('Entradas', e);
        r = { ok: true, motivo: cant === 1 ? 'Entrada válida' : (pasan === 1 ? 'Entra 1 · ' : 'Entran ' + pasan + ' · ') + e.usadas + ' de ' + cant + (cant - e.usadas ? ' (quedan ' + (cant - e.usadas) + ')' : ' (completa)'), pasan: pasan };
      }
      r.entrada = { id: e.id, nombre: e.nombre, tipo: e.tipo, cantidad: cant, usadas: num(e.usadas), quedan: Math.max(0, cant - num(e.usadas)), ultimo_uso: e.ultimo_uso, partido: p ? 'vs ' + txt(p.rival) : '' };
    }
    r.tipo = 'entrada';
    store.insert('Accesos', {
      id: nuevoId(store, 'Accesos'), fecha_hora: ahora(store), socio_id: e ? txt(e.socio_id) : '', nombre: e ? txt(e.nombre) + ' (entrada)' : 'Entrada ' + txt(id),
      resultado: r.ok ? 'Permitido' : 'Rechazado', motivo: r.motivo, lugar: txt(lugar), entrada_id: e ? e.id : ''
    });
    return r;
  }

  // ---------- Panel: resumen ----------
  function resumen(store, periodo) {
    periodo = periodo || hoyISO(store).slice(0, 7);
    var socios = store.rows('Socios').filter(function (s) { return txt(s.estado || 'Activo') === 'Activo'; });
    var alDia = 0, deuda = 0, deudores = [];
    socios.forEach(function (s) {
      if (txt(s.titular_id)) return;
      var e = estadoDe(store, s);
      if (e.alDia) alDia++; else deudores.push({ id: s.id, nombre: nombreDe(s), deuda: e.deuda, vencidas: e.vencidas });
      deuda += e.deuda;
    });
    var pagadores = socios.filter(function (s) { return !txt(s.titular_id); }).length;
    var pagosMes = store.rows('Pagos').filter(function (p) { return txt(p.estado) === 'Confirmado' && fechaISO(p.fecha).slice(0, 7) === periodo; });
    var cobrado = pagosMes.reduce(function (s, p) { return s + num(p.monto); }, 0);
    var porMedio = {};
    pagosMes.forEach(function (p) { porMedio[txt(p.medio)] = (porMedio[txt(p.medio)] || 0) + num(p.monto); });
    var cuotasMes = store.rows('Cuotas').filter(function (c) { return txt(c.periodo) === periodo && txt(c.estado) !== 'Anulada'; });
    var esperado = cuotasMes.reduce(function (s, c) { return s + num(c.monto); }, 0);
    var altas = store.rows('Socios').filter(function (s) { return fechaISO(s.alta).slice(0, 7) === periodo; }).length;
    var porCategoria = {};
    socios.forEach(function (s) { var c = porId(store, 'Categorias', s.categoria_id); var k = c ? c.nombre : 'Sin categoría'; porCategoria[k] = (porCategoria[k] || 0) + 1; });
    var porActividad = {};
    socios.forEach(function (s) { lista(s.actividades).forEach(function (id) { var a = porId(store, 'Actividades', id); if (a) porActividad[a.nombre] = (porActividad[a.nombre] || 0) + 1; }); });
    return {
      periodo: periodo, nombrePeriodo: nombrePeriodo(periodo),
      socios: socios.length, pagadores: pagadores, alDia: alDia, deuda: deuda,
      deudores: deudores.sort(function (a, b) { return b.deuda - a.deuda; }),
      cobrado: cobrado, esperado: esperado, porMedio: porMedio, altas: altas,
      porCategoria: porCategoria, porActividad: porActividad,
      aConfirmar: store.rows('Pagos').filter(function (p) { return txt(p.estado) === 'A confirmar'; }).length,
      solicitudes: store.rows('Solicitudes').filter(function (s) { return txt(s.estado) === 'Nueva'; }).length,
      accesosMes: store.rows('Accesos').filter(function (a) { return txt(a.fecha_hora).slice(0, 7) === periodo; }).length
    };
  }

  // ---------- Web pública ----------
  function publico(store) {
    var orden = function (a, b) { return num(a.orden) - num(b.orden); };
    return {
      config: config(store, false),
      categorias: store.rows('Categorias').slice().sort(orden).map(function (c) { return { id: c.id, nombre: c.nombre, monto: num(c.monto), descripcion: c.descripcion }; }),
      actividades: store.rows('Actividades').filter(function (a) { return txt(a.publica || 'SI') !== 'NO'; }),
      sponsors: store.rows('Sponsors').slice().sort(orden),
      noticias: store.rows('Noticias').filter(function (n) { return txt(n.publicada) === 'SI'; })
        .sort(function (a, b) { return fechaISO(a.fecha) < fechaISO(b.fecha) ? 1 : -1; }).slice(0, 30),
      socios: store.rows('Socios').filter(function (s) { return txt(s.estado || 'Activo') === 'Activo'; }).length,
      partidos: partidosEnVenta(store)
    };
  }

  // ---------- Crónicas desde los datos de Pitazo Final ----------
  // pz = { partido, local, visitante, torneo, goles:[{jugador, equipo:'local'|'visitante', en_contra}], club:'local'|'visitante' }
  function datosCronica(pz) {
    var p = pz.partido, gl = txt(p.goles_local), gv = txt(p.goles_visitante);
    var hayGoles = gl !== '' && gv !== '';
    var nuestro = pz.club === 'local' ? pz.local : pz.visitante, rival = pz.club === 'local' ? pz.visitante : pz.local;
    var gN = pz.club === 'local' ? num(gl) : num(gv), gR = pz.club === 'local' ? num(gv) : num(gl);
    var pen = txt(p.penales).match(/^(\d+)\s*-\s*(\d+)$/);
    var pN = pen ? num(pz.club === 'local' ? pen[1] : pen[2]) : null, pR = pen ? num(pz.club === 'local' ? pen[2] : pen[1]) : null;
    var man = txt(p.resultado_manual).toUpperCase();
    var ganoManual = man === 'L' ? 'local' : man === 'V' ? 'visitante' : '';
    var res = !hayGoles ? (ganoManual ? (ganoManual === pz.club ? 'G' : 'P') : '') : gN > gR ? 'G' : gN < gR ? 'P' : pen ? (pN > pR ? 'G' : 'P') : ganoManual ? (ganoManual === pz.club ? 'G' : 'P') : 'E';
    var mios = (pz.goles || []).filter(function (g) { return g.equipo === pz.club && !g.en_contra && g.jugador; }).map(function (g) { return g.jugador; });
    var deEllos = (pz.goles || []).filter(function (g) { return g.equipo !== pz.club && !g.en_contra && g.jugador; }).map(function (g) { return g.jugador; });
    return { nuestro: nuestro, rival: rival, gN: gN, gR: gR, hayGoles: hayGoles, pN: pN, pR: pR, res: res, mios: mios, deEllos: deEllos, condicion: pz.club === 'local' ? 'local' : 'visitante' };
  }
  function contar(nombres) {
    var c = {}, orden = [];
    nombres.filter(Boolean).forEach(function (n) { if (!c[n]) { c[n] = 0; orden.push(n); } c[n]++; });
    var partes = orden.map(function (n) { return c[n] > 1 ? n + ' (' + c[n] + ')' : n; });
    return partes.length > 1 ? partes.slice(0, -1).join(', ') + ' y ' + partes[partes.length - 1] : partes[0] || '';
  }
  // Borrador sin IA (se usa en la demo o si falla la IA). Solo usa datos reales del partido.
  function borradorCronica(pz, notas) {
    var d = datosCronica(pz), p = pz.partido;
    var torneo = txt(pz.torneo).replace(/^fase final( de( la)?)?\s+/i, '');
    var deTorneo = torneo ? (/^(torneo|campeonato|regional)/i.test(torneo) ? ' del ' : ' de la ') + torneo : '';
    var fase = txt(p.fase), art = /^(semi|final)/i.test(fase) ? (/^semi/i.test(fase) ? 'las ' : 'la ') : 'los ';
    var instancia = fase ? art + fase.toLowerCase() : (p.fecha_nro ? 'la fecha ' + p.fecha_nro : '');
    var marcador = d.hayGoles ? d.gN + ' a ' + d.gR : '';
    var titulo, t = [];
    if (d.res === 'G') titulo = d.pN !== null ? d.nuestro + ' pasó por penales ante ' + d.rival : 'Triunfo de ' + d.nuestro + (marcador ? ' ' + d.gN + '-' + d.gR : '') + ' ante ' + d.rival;
    else if (d.res === 'P') titulo = d.pN !== null ? 'Se escapó en los penales ante ' + d.rival : 'Derrota ante ' + d.rival + (marcador ? ' ' + d.gN + '-' + d.gR : '');
    else if (d.res === 'E') titulo = 'Empate ' + (marcador ? d.gN + '-' + d.gR + ' ' : '') + 'con ' + d.rival;
    else titulo = d.nuestro + ' vs ' + d.rival;
    var donde = d.condicion === 'local' ? 'en casa' : 'de visitante';
    var abre = (instancia || deTorneo ? 'Por ' + instancia + (instancia ? deTorneo : deTorneo.replace(/^ de la | del /, '')) + ', ' : '') + d.nuestro + ' jugó ' + donde + ' ante ' + d.rival;
    if (d.res === 'G' && d.pN === null) t.push(abre + (marcador ? ' y ganó ' + marcador : ' y se quedó con la victoria') + '.');
    else if (d.res === 'P' && d.pN === null) t.push(abre + (marcador ? ' y cayó ' + d.gR + ' a ' + d.gN : ' y no pudo sumar') + '.');
    else if (d.pN !== null) t.push(abre + '. Igualaron ' + marcador + ' en los 90 minutos y la serie se definió desde el punto penal: ' + (d.res === 'G' ? 'ganó ' + d.nuestro + ' ' + d.pN + ' a ' + d.pR : 'se impuso ' + d.rival + ' ' + d.pR + ' a ' + d.pN) + '.');
    else if (d.res === 'E') t.push(abre + ' e igualaron ' + (marcador || '') + '.');
    else t.push(abre + '.');
    if (d.mios.length) t.push((d.mios.length === 1 ? 'El gol de ' + d.nuestro + ' lo marcó ' : 'Los goles de ' + d.nuestro + ' los ' + (contar(d.mios).indexOf(' y ') > 0 ? 'marcaron ' : 'marcó ')) + contar(d.mios) + '.');
    if (d.deEllos.length) t.push('Para ' + d.rival + ' ' + (contar(d.deEllos).indexOf(' y ') > 0 ? 'convirtieron ' : 'convirtió ') + contar(d.deEllos) + '.');
    if (txt(notas)) t.push(txt(notas));
    return { titulo: titulo, resumen: t[0], cuerpo: t.join('\n\n') };
  }
  function promptCronica(pz, notas, club) {
    var d = datosCronica(pz), p = pz.partido;
    return [
      'Sos el prensa de ' + club + ', un club de fútbol amateur de Argentina. Escribí la crónica del partido para la web del club.',
      'Usá SOLO estos datos. No inventes jugadas, minutos, nombres, sensaciones del público ni nada que no esté acá. Si un dato falta, no lo menciones.',
      'Datos:',
      '- Torneo: ' + txt(pz.torneo) + (txt(p.fase) ? ' — ' + txt(p.fase) : p.fecha_nro ? ' — fecha ' + p.fecha_nro : ''),
      '- Fecha: ' + fechaISO(p.fecha_jugada || p.fecha_programada),
      '- ' + d.nuestro + ' jugó de ' + d.condicion + ' contra ' + d.rival,
      d.hayGoles ? '- Resultado: ' + d.nuestro + ' ' + d.gN + ', ' + d.rival + ' ' + d.gR : '- Marcador no publicado' + (d.res ? (d.res === 'G' ? ' (ganó ' + d.nuestro + ')' : ' (ganó ' + d.rival + ')') : ''),
      d.pN !== null ? '- Penales: ' + d.nuestro + ' ' + d.pN + ', ' + d.rival + ' ' + d.pR : '',
      d.mios.length ? '- Goles de ' + d.nuestro + ': ' + contar(d.mios) : '',
      d.deEllos.length ? '- Goles de ' + d.rival + ': ' + contar(d.deEllos) : '',
      txt(notas) ? '- Notas del club (podés usarlas, son reales): ' + txt(notas) : '',
      'Estilo: castellano rioplatense, cálido y de pueblo, sin exagerar. 2 a 4 párrafos cortos.',
      'Respondé SOLO con JSON: {"titulo": "...", "resumen": "una oración", "cuerpo": "párrafos separados por \\n\\n"}'
    ].filter(Boolean).join('\n');
  }
  function promptResumenComision(r, club) {
    return [
      'Sos el asistente de la tesorería de ' + club + ', un club de barrio de Argentina.',
      'Escribí un resumen breve (5 a 8 renglones, sin títulos ni viñetas largas) para leer en la reunión de comisión directiva. Usá solo estos números y no inventes nada:',
      JSON.stringify({
        mes: r.nombrePeriodo, socios_activos: r.socios, socios_que_pagan: r.pagadores, al_dia: r.alDia, deuda_total: r.deuda,
        cobrado_en_el_mes: r.cobrado, esperado_del_mes: r.esperado, cobrado_por_medio: r.porMedio, altas_del_mes: r.altas,
        pagos_por_confirmar: r.aConfirmar, solicitudes_nuevas: r.solicitudes, socios_por_categoria: r.porCategoria, socios_por_actividad: r.porActividad,
        mayores_deudores: r.deudores.slice(0, 5).map(function (x) { return x.nombre + ' ' + x.deuda; })
      }),
      'Montos en pesos con formato $12.345. Tono claro y concreto. Respondé solo con el texto.'
    ].join('\n');
  }
  function resumenComisionSinIA(r) {
    var pct = r.pagadores ? Math.round(r.alDia * 100 / r.pagadores) : 0;
    var t = ['Resumen de ' + r.nombrePeriodo + ': el club tiene ' + r.socios + ' socios activos (' + r.pagadores + ' cuentas que pagan) y ' + r.alDia + ' están al día (' + pct + '%).'];
    t.push('Se cobraron ' + plata(r.cobrado) + (r.esperado ? ' de ' + plata(r.esperado) + ' generados en cuotas del mes' : '') + '.');
    var medios = Object.keys(r.porMedio).map(function (k) { return k + ' ' + plata(r.porMedio[k]); });
    if (medios.length) t.push('Por medio de pago: ' + medios.join(', ') + '.');
    t.push('La deuda acumulada es de ' + plata(r.deuda) + (r.deudores.length ? ', repartida en ' + r.deudores.length + ' socios' : '') + '.');
    if (r.altas) t.push('Hubo ' + r.altas + (r.altas === 1 ? ' alta nueva.' : ' altas nuevas.'));
    if (r.aConfirmar) t.push('Quedan ' + r.aConfirmar + ' pagos informados por confirmar.');
    if (r.solicitudes) t.push('Hay ' + r.solicitudes + ' solicitudes de asociación esperando respuesta.');
    return t.join(' ');
  }

  // ---------- Operaciones genéricas del panel ----------
  var EDITABLES = ['Categorias', 'Actividades', 'Noticias', 'Sponsors', 'Usuarios', 'Cuotas', 'Partidos'];
  function guardar(store, tabla, fila, usuario) {
    if (tabla === 'Socios') return guardarSocio(store, fila);
    if (EDITABLES.indexOf(tabla) < 0) throw err('No se puede editar ' + tabla + ' desde acá.');
    var f = {};
    TABLAS[tabla].forEach(function (k) { if (fila[k] !== undefined) f[k] = typeof fila[k] === 'number' ? fila[k] : k in CAMPOS_LINK ? url(fila[k], CAMPOS_LINK[k]) : txt(fila[k]); });
    if (tabla === 'Usuarios') {
      f.email = txt(f.email).toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) throw err('Revisá el email.');
      f.rol = f.rol || 'admin'; f.activo = f.activo || 'SI';
      var ya = store.rows('Usuarios').some(function (u) { return txt(u.email).toLowerCase() === f.email; });
      if (ya) store.update('Usuarios', f, 'email'); else store.insert('Usuarios', f);
      return f;
    }
    if (tabla === 'Partidos') {
      if (!txt(f.rival)) throw err('Falta el rival.');
      f.fecha = fechaISO(f.fecha);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(f.fecha)) throw err('Falta la fecha del partido.');
      if (txt(f.hora)) { f.hora = horaDe(f.hora); if (!f.hora) throw err('La hora va así: 16:00'); }
      f.precio_general = num(f.precio_general); f.precio_socio = num(f.precio_socio); f.cupo = num(f.cupo) || '';
      f.estado = f.estado || 'Venta';
    } else if (!f.nombre && !f.titulo && tabla !== 'Cuotas') throw err('Falta el nombre.');
    if (tabla === 'Noticias') { f.fecha = f.fecha || hoyISO(store); f.autor = f.autor || txt(usuario); f.publicada = f.publicada || 'SI'; }
    if (f.id && porId(store, tabla, f.id)) {
      var previo = porId(store, tabla, f.id);
      Object.keys(previo).forEach(function (k) { if (f[k] === undefined) f[k] = previo[k]; });
      store.update(tabla, f);
    } else { f.id = nuevoId(store, tabla); store.insert(tabla, f); }
    return f;
  }
  // Eliminar del todo (solo admin): borra al socio, sus cuotas, pagos, accesos y su solicitud.
  // Los integrantes de su grupo familiar quedan como socios sueltos (pagan su propia cuota).
  function eliminarSocio(store, id) {
    var s = porId(store, 'Socios', id);
    if (!s) throw err('No se encontró el socio.');
    var cuenta = function (t, campo) { return store.rows(t).filter(function (x) { return txt(x[campo]) === txt(id); }).map(function (x) { return x.id; }); };
    var cuotas = cuenta('Cuotas', 'socio_id'), pagos = cuenta('Pagos', 'socio_id'), accesos = cuenta('Accesos', 'socio_id');
    // De abajo hacia arriba, así no se corren las filas al borrar.
    cuotas.reverse().forEach(function (x) { store.remove('Cuotas', x); });
    pagos.reverse().forEach(function (x) { store.remove('Pagos', x); });
    accesos.reverse().forEach(function (x) { store.remove('Accesos', x); });
    store.rows('Socios').filter(function (x) { return txt(x.titular_id) === txt(id); }).forEach(function (x) { x.titular_id = ''; store.update('Socios', x); });
    store.rows('Solicitudes').filter(function (x) { return txt(x.socio_id) === txt(id); }).forEach(function (x) { x.socio_id = ''; x.estado = 'Rechazada'; store.update('Solicitudes', x); });
    store.remove('Socios', id);
    return { id: id, nombre: nombreDe(s), cuotas: cuotas.length, pagos: pagos.length };
  }

  // Eliminar del todo un partido con sus entradas (solo admin). Los ingresos quedan en Accesos como historial.
  function eliminarPartido(store, id) {
    var p = porId(store, 'Partidos', id);
    if (!p) throw err('No se encontró el partido.');
    var ents = store.rows('Entradas').filter(function (x) { return txt(x.partido_id) === txt(id); }).map(function (x) { return x.id; });
    ents.reverse().forEach(function (x) { store.remove('Entradas', x); });
    store.remove('Partidos', id);
    return { id: id, rival: txt(p.rival), entradas: ents.length };
  }

  function borrar(store, tabla, id) {
    if (tabla === 'Socios') {
      var s = porId(store, 'Socios', id);
      if (!s) throw err('No se encontró el socio.');
      s.estado = 'Baja'; store.update('Socios', s); // nunca se borra: queda su historial
      return s;
    }
    if (tabla === 'Cuotas') {
      var c = porId(store, 'Cuotas', id);
      if (c && txt(c.estado) === 'Pagada') throw err('No se puede anular una cuota pagada.');
      if (c) { c.estado = 'Anulada'; store.update('Cuotas', c); }
      return c;
    }
    if (tabla === 'Partidos' && store.rows('Entradas').some(function (x) { return txt(x.partido_id) === txt(id) && txt(x.estado) !== 'Anulada'; }))
      throw err('Ese partido ya tiene entradas vendidas: en vez de borrarlo, cerrá la venta.');
    if (EDITABLES.indexOf(tabla) < 0) throw err('No se puede borrar en ' + tabla + '.');
    store.remove(tabla, id, tabla === 'Usuarios' ? 'email' : 'id');
    return { id: id };
  }
  // "¿Olvidaste tu código?": busca al socio por DNI y devuelve a qué email mandarlo.
  function ocultarEmail(m) {
    var p = txt(m).split('@');
    if (p.length !== 2) return '';
    var u = p[0], d = p[1].split('.');
    return u.charAt(0) + '***' + (u.length > 3 ? u.slice(-1) : '') + '@' + d[0].charAt(0) + '***.' + d.slice(1).join('.');
  }
  function paraRecuperar(store, dni) {
    dni = soloDigitos(dni);
    if (dni.length < 7) throw err('Escribí tu DNI, solo números.');
    var s = store.rows('Socios').filter(function (x) { return soloDigitos(x.dni) === dni && txt(x.estado) !== 'Baja'; })[0];
    if (!s) throw err('No encontramos un socio con ese DNI. Si te asociaste hace poco, puede que el club todavía no haya aprobado tu solicitud.');
    var mail = txt(s.email).toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) throw err('Tu ficha de socio no tiene un email cargado. Pedí tu código en el club.');
    if (!txt(s.pin)) { s.pin = azar(4, '0123456789'); store.update('Socios', s); }
    return { socio: s, email: mail, oculto: ocultarEmail(mail) };
  }
  function mailCodigo(cfg, s, link) {
    var club = cfg.nombre_corto || cfg.nombre || 'el club';
    return {
      asunto: 'Tu código para el carnet digital de ' + club,
      texto: 'Hola ' + txt(s.nombre) + ':\n\nTu código para entrar al carnet digital de ' + club + ' es: ' + txt(s.pin) +
        '\n\nEntrá en ' + link + ' con tu DNI (' + txt(s.dni) + ') y este código.\n\nSi no lo pediste, ignorá este mensaje.',
      html: '<div style="font-family:Arial,sans-serif;max-width:480px">' +
        '<p>Hola ' + txt(s.nombre) + ':</p><p>Tu código para entrar al carnet digital de <b>' + club + '</b> es:</p>' +
        '<p style="font-size:32px;font-weight:bold;letter-spacing:8px;margin:12px 0">' + txt(s.pin) + '</p>' +
        '<p><a href="' + link + '" style="background:' + (cfg.color1 || '#D7261E') + ';color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">Abrir mi carnet</a></p>' +
        '<p style="color:#777;font-size:13px">Entrá con tu DNI (' + txt(s.dni) + ') y este código. Si no lo pediste, ignorá este mensaje.</p></div>'
    };
  }

  function nuevoCodigo(store, socioId, queCosa) {
    var s = porId(store, 'Socios', socioId);
    if (!s) throw err('No se encontró el socio.');
    if (queCosa === 'pin') s.pin = azar(4, '0123456789'); else s.codigo_carnet = azar(8);
    store.update('Socios', s);
    return s;
  }

  return {
    TABLAS: TABLAS, txt: txt, num: num, url: url, lista: lista, fechaISO: fechaISO, plata: plata, nombrePeriodo: nombrePeriodo, nombreDe: nombreDe,
    config: config, guardarConfig: guardarConfig,
    estadoDe: estadoDe, estadoConTitular: estadoConTitular, cuotasDe: cuotasDe, montoMensual: montoMensual,
    guardarSocio: guardarSocio, eliminarSocio: eliminarSocio, eliminarPartido: eliminarPartido, ingresarSocio: ingresarSocio, paraRecuperar: paraRecuperar, mailCodigo: mailCodigo, ocultarEmail: ocultarEmail, vistaSocio: vistaSocio, nuevoCodigo: nuevoCodigo,
    generarCuotas: generarCuotas, registrarPago: registrarPago, informarPago: informarPago, resolverPago: resolverPago,
    solicitud: solicitud, aprobarSolicitud: aprobarSolicitud, validarAcceso: validarAcceso,
    ventana: ventana, partidosEnVenta: partidosEnVenta, infoPartido: infoPartido, comprarEntrada: comprarEntrada, informarEntrada: informarEntrada,
    resolverEntrada: resolverEntrada, anularEntrada: anularEntrada, vistaEntrada: vistaEntrada, entradaPorCodigo: entradaPorCodigo, entradasDelSocio: entradasDelSocio, cupoSocio: cupoSocio,
    resumen: resumen, publico: publico, guardar: guardar, borrar: borrar,
    borradorCronica: borradorCronica, promptCronica: promptCronica, promptResumenComision: promptResumenComision, resumenComisionSinIA: resumenComisionSinIA
  };
})();
if (typeof module !== 'undefined') module.exports = MOTOR;

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
