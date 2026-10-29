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
    TABLAS: TABLAS, txt: txt, num: num, lista: lista, fechaISO: fechaISO, plata: plata, nombrePeriodo: nombrePeriodo, nombreDe: nombreDe,
    config: config, guardarConfig: guardarConfig,
    estadoDe: estadoDe, estadoConTitular: estadoConTitular, cuotasDe: cuotasDe, montoMensual: montoMensual,
    guardarSocio: guardarSocio, eliminarSocio: eliminarSocio, ingresarSocio: ingresarSocio, paraRecuperar: paraRecuperar, mailCodigo: mailCodigo, ocultarEmail: ocultarEmail, vistaSocio: vistaSocio, nuevoCodigo: nuevoCodigo,
    generarCuotas: generarCuotas, registrarPago: registrarPago, informarPago: informarPago, resolverPago: resolverPago,
    solicitud: solicitud, aprobarSolicitud: aprobarSolicitud, validarAcceso: validarAcceso,
    resumen: resumen, publico: publico, guardar: guardar, borrar: borrar,
    borradorCronica: borradorCronica, promptCronica: promptCronica, promptResumenComision: promptResumenComision, resumenComisionSinIA: resumenComisionSinIA
  };
})();
if (typeof module !== 'undefined') module.exports = MOTOR;
