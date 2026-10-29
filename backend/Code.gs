/* Pitazo Clubs — Code.gs GENERADO: js/motor.js + backend/base.gs. Pegá TODO en un solo archivo de Apps Script. */
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
    Accesos: ['id', 'fecha_hora', 'socio_id', 'nombre', 'resultado', 'motivo', 'lugar'],
    Solicitudes: ['id', 'fecha', 'nombre', 'apellido', 'dni', 'nacimiento', 'telefono', 'email', 'categoria_id', 'actividades', 'mensaje', 'estado', 'socio_id']
  };
  var PREFIJO = { Categorias: 'CAT', Actividades: 'ACT', Socios: 'S', Cuotas: 'C', Pagos: 'PG', Noticias: 'NC', Sponsors: 'SP', Accesos: 'AC', Solicitudes: 'SOL' };
  var DIGITOS = { Socios: 4, Cuotas: 5, Pagos: 4, Accesos: 5, Solicitudes: 4 };

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
      var v = txt(cambios[k]);
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

  // ---------- Control de acceso ----------
  // El QR del carnet dice PC1:<club>:<socio>:<código>. También se puede buscar por DNI.
  function validarAcceso(store, leido, lugar) {
    var t = txt(leido), s = null, motivo = '';
    var m = t.match(/^PC1:[^:]*:([^:]+):([A-Z0-9]+)$/i);
    if (m) {
      s = porId(store, 'Socios', m[1]);
      if (s && txt(s.codigo_carnet).toUpperCase() !== m[2].toUpperCase()) { s = null; motivo = 'Carnet viejo o falso: el código no coincide.'; }
    } else if (/^\d{7,9}$/.test(soloDigitos(t)) && soloDigitos(t) === t.replace(/[.\s]/g, '')) {
      s = store.rows('Socios').filter(function (x) { return soloDigitos(x.dni) === soloDigitos(t); })[0] || null;
    }
    var r;
    if (!s) r = { ok: false, motivo: motivo || 'No es un carnet de este club.' };
    else {
      var e = estadoConTitular(store, s);
      var cat = porId(store, 'Categorias', s.categoria_id);
      r = {
        ok: e.alDia, motivo: e.alDia ? 'Al día' : e.etiqueta + (e.deuda ? ' · ' + plata(e.deuda) : ''),
        socio: { id: s.id, nombre: nombreDe(s), numero: s.numero, categoria: cat ? cat.nombre : '', foto: s.foto, titular: e.titular || '' }
      };
    }
    store.insert('Accesos', {
      id: nuevoId(store, 'Accesos'), fecha_hora: ahora(store), socio_id: s ? s.id : '', nombre: s ? nombreDe(s) : t.slice(0, 40),
      resultado: r.ok ? 'Permitido' : 'Rechazado', motivo: r.motivo, lugar: txt(lugar)
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
      socios: store.rows('Socios').filter(function (s) { return txt(s.estado || 'Activo') === 'Activo'; }).length
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
  var EDITABLES = ['Categorias', 'Actividades', 'Noticias', 'Sponsors', 'Usuarios', 'Cuotas'];
  function guardar(store, tabla, fila, usuario) {
    if (tabla === 'Socios') return guardarSocio(store, fila);
    if (EDITABLES.indexOf(tabla) < 0) throw err('No se puede editar ' + tabla + ' desde acá.');
    var f = {};
    TABLAS[tabla].forEach(function (k) { if (fila[k] !== undefined) f[k] = typeof fila[k] === 'number' ? fila[k] : txt(fila[k]); });
    if (tabla === 'Usuarios') {
      f.email = txt(f.email).toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) throw err('Revisá el email.');
      f.rol = f.rol || 'admin'; f.activo = f.activo || 'SI';
      var ya = store.rows('Usuarios').some(function (u) { return txt(u.email).toLowerCase() === f.email; });
      if (ya) store.update('Usuarios', f, 'email'); else store.insert('Usuarios', f);
      return f;
    }
    if (!f.nombre && !f.titulo && tabla !== 'Cuotas') throw err('Falta el nombre.');
    if (tabla === 'Noticias') { f.fecha = f.fecha || hoyISO(store); f.autor = f.autor || txt(usuario); f.publicada = f.publicada || 'SI'; }
    if (f.id && porId(store, tabla, f.id)) {
      var previo = porId(store, tabla, f.id);
      Object.keys(previo).forEach(function (k) { if (f[k] === undefined) f[k] = previo[k]; });
      store.update(tabla, f);
    } else { f.id = nuevoId(store, tabla); store.insert(tabla, f); }
    return f;
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
    if (EDITABLES.indexOf(tabla) < 0) throw err('No se puede borrar en ' + tabla + '.');
    store.remove(tabla, id, tabla === 'Usuarios' ? 'email' : 'id');
    return { id: id };
  }
  function nuevoCodigo(store, socioId, queCosa) {
    var s = porId(store, 'Socios', socioId);
    if (!s) throw err('No se encontró el socio.');
    if (queCosa === 'pin') s.pin = azar(4, '0123456789'); else s.codigo_carnet = azar(8);
    store.update('Socios', s);
    return s;
  }

  return {
    TABLAS: TABLAS, txt: txt, num: num, lista: lista, fechaISO: fechaISO, plata: plata, nombrePeriodo: nombrePeriodo, nombreDe: nombreDe,
    config: config, guardarConfig: guardarConfig,
    estadoDe: estadoDe, estadoConTitular: estadoConTitular, cuotasDe: cuotasDe, montoMensual: montoMensual,
    guardarSocio: guardarSocio, ingresarSocio: ingresarSocio, vistaSocio: vistaSocio, nuevoCodigo: nuevoCodigo,
    generarCuotas: generarCuotas, registrarPago: registrarPago, informarPago: informarPago, resolverPago: resolverPago,
    solicitud: solicitud, aprobarSolicitud: aprobarSolicitud, validarAcceso: validarAcceso,
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
 *   socio_vista {socio_token}
 *   socio_informar {socio_token, datos:{cuotas, comprobante(dataURL)}}
 *   panel_sesion {token(Google)}                    -> {usuario}
 *   panel_datos {token}                             todas las tablas
 *   panel_op {token, op, args}                      -> {res, datos}
 */

const GOOGLE_CLIENT_ID = '';          // ← pegá acá el ID de cliente OAuth (termina en .apps.googleusercontent.com)
const CARPETA_ARCHIVOS = 'Pitazo Clubs - archivos';
const SOCIO_DIAS = 60;                // cuánto dura la sesión del socio en el celular

// Qué puede hacer cada rol del panel (columna rol de la pestaña Usuarios).
const PERMISOS = {
  admin: '*',
  tesorero: ['guardar:Socios', 'borrar:Socios', 'guardar:Cuotas', 'borrar:Cuotas', 'generarCuotas', 'registrarPago', 'resolverPago',
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
