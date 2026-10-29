/* Pitazo Club — web pública del club. */
window.PC = window.PC || {};
(function () {
  'use strict';
  const { u, PZ, DB } = PC;
  const e = u.esc;
  const main = () => document.getElementById('contenido');

  // ---------- piezas ----------
  function escudo(url, nombre, clase) {
    const ini = e(u.iniciales(nombre));
    return `<span class="escudo ${clase || ''}" aria-hidden="true">${url ? `<img src="${e(url)}" alt="" loading="lazy" onerror="this.replaceWith(document.createTextNode('${ini}'))">` : ini}</span>`;
  }
  PC.escudo = escudo;

  function tarjetaPartido(p, clubId, titulo) {
    if (!p) return '';
    const v = PZ.paraClub(p, clubId), r = v.r, t = PZ.torneo(p.torneo_id);
    const L = p.local_id, V = p.visitante_id;
    const lado = id => `<div class="partido__equipo ${id === (v.lado === 'local' ? L : V) ? 'partido__equipo--nuestro' : ''}">
      ${escudo(PZ.escudoEquipo(id), PZ.nombreEquipo(id), 'escudo--partido')}<span>${e(PZ.nombreEquipo(id))}</span></div>`;
    let centro;
    if (r.jugado) {
      centro = `<div class="partido__marcador">${r.hay ? r.gl + ' - ' + r.gv : (v.res === 'G' ? 'Ganó' : v.res === 'P' ? 'Perdió' : 'Empate')}</div>`;
      if (r.penales) { const [a, b] = r.penales.split('-'); centro += `<div class="partido__nota">Penales ${a} - ${b}</div>`; }
      else if (!r.hay) centro += '<div class="partido__nota">Marcador no publicado</div>';
    } else {
      centro = `<div class="partido__vs">VS</div>${p.hora ? `<div class="partido__nota">${e(p.hora)} h</div>` : ''}`;
    }
    const instancia = p.fase || (p.fecha_nro ? 'Fecha ' + p.fecha_nro : '');
    const fecha = PZ.fechaDe(p);
    const goles = r.jugado ? PZ.goles(p.id).filter(g => g.equipo === v.lado && !g.en_contra).map(g => g.jugador).filter(Boolean) : [];
    return `<article class="partido">
      <div class="partido__cabeza"><span>${e(titulo)}</span><span>${e(instancia)}</span></div>
      <div class="partido__cuerpo">${lado(L)}<div class="partido__centro">${centro}</div>${lado(V)}</div>
      <div class="partido__pie"><span>${fecha ? e(u.fecha(fecha, true)) : 'Fecha a confirmar'}${p.cancha ? ' · ' + e(p.cancha) : ''}</span><span>${e(t ? t.nombre : '')}</span></div>
      ${goles.length ? `<div class="partido__pie"><span>⚽ ${e(contarNombres(goles))}</span></div>` : ''}
    </article>`;
  }
  function contarNombres(lista) {
    const c = {}; lista.forEach(n => { c[n] = (c[n] || 0) + 1; });
    return Object.entries(c).map(([n, k]) => k > 1 ? `${n} (${k})` : n).join(', ');
  }

  function tarjetaNoticia(n, destacada) {
    const propia = !n.liga_id;
    const href = '#/noticia/' + encodeURIComponent(n.id);
    const img = n.imagen ? `<div class="noticia__img" style="background-image:url('${e(n.imagen)}')"></div>`
      : `<div class="noticia__img noticia__img--vacia"><span>${e(PC.ctx.cfg.nombre_corto || '')}</span></div>`;
    return `<a class="noticia ${destacada ? 'noticia--destacada' : ''}" href="${href}">
      ${img}
      <div class="noticia__texto">
        <span class="noticia__fecha">${e(u.fecha(n.fecha))}</span>
        <h3>${e(n.titulo)}</h3>
        ${n.resumen ? `<p class="chico">${e(recortar(n.resumen, 150))}</p>` : ''}
        <span class="noticia__fuente">${propia ? 'Club' : 'Pitazo Final' + (n.fuente ? ' · ' + e(n.fuente) : '')}</span>
      </div></a>`;
  }
  function recortar(t, n) { t = String(t || ''); return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + '…' : t; }

  // Noticias propias del club + las de la liga que lo mencionan (Pitazo Final), sin repetir títulos.
  function todasLasNoticias() {
    const propias = (PC.ctx.pub.noticias || []);
    const liga = PZ.datos ? PZ.noticiasDelClub(PC.ctx.clubId) : [];
    const vistos = new Set(propias.map(n => n.titulo.toLowerCase().trim()));
    return propias.concat(liga.filter(n => !vistos.has(String(n.titulo).toLowerCase().trim())))
      .sort((a, b) => u.iso(a.fecha) < u.iso(b.fecha) ? 1 : -1);
  }

  async function conPitazo() {
    const c = PC.ctx.cfg;
    if (!c.pitazo_club_id) return null;
    try { await PZ.cargar(c.pitazo_club_id, c.pitazo_liga_id || 'L01'); }
    catch (err) { console.warn(err); return null; }
    document.getElementById('pie-origen').textContent = PZ.origen;
    return PZ.datos;
  }

  // ---------- Inicio ----------
  async function inicio() {
    const c = PC.ctx.cfg, pub = PC.ctx.pub;
    main().innerHTML = `
      <section class="hero">
        <div class="contenedor hero__grilla">
          <div>
            <div class="hero__club">
              ${escudo(c.escudo, c.nombre, 'escudo--grande')}
              <div>
                <div class="hero__kicker">${e(c.ciudad || '')}</div>
                <h1>${e(c.lema || c.nombre_corto || c.nombre)}</h1>
              </div>
            </div>
            <p class="hero__sub">${e(recortar(c.historia || '', 170))}</p>
            <div class="hero__acciones">
              <a class="boton boton--blanco" href="#/asociate">Asociate</a>
              <a class="boton boton--borde" href="#/socio">Mi carnet de socio</a>
            </div>
          </div>
          <div class="hero__partidos" id="hero-partidos"><p class="cargando">Buscando los partidos en Pitazo Final…</p></div>
        </div>
      </section>
      <section class="seccion contenedor" id="sec-noticias">
        <div class="seccion__titulo"><h2>Noticias</h2><a href="#/noticias">Ver todas</a></div>
        <div class="noticias" id="lista-noticias">${(pub.noticias || []).slice(0, 3).map((n, i) => tarjetaNoticia(n, false)).join('')}</div>
      </section>
      <section class="seccion contenedor" style="padding-top:0">
        <div class="banda">
          <div>
            <h2>Hacete socio del ${e(c.nombre_corto || 'club')}</h2>
            <p style="opacity:.85;margin:6px 0 0">Te anotás online, pagás directo al club y tenés tu carnet digital en el celular.</p>
            <div class="precios">${(pub.categorias || []).filter(x => x.monto).map(x => `<span class="precio">${e(x.nombre)} <b>${u.plata(x.monto)}</b>/mes</span>`).join('')}</div>
          </div>
          <a class="boton boton--blanco" href="#/asociate">Quiero asociarme</a>
        </div>
      </section>
      ${(pub.actividades || []).length ? `<section class="seccion contenedor" style="padding-top:0">
        <div class="seccion__titulo"><h2>Actividades</h2><a href="#/club">Horarios y más</a></div>
        <div class="grilla-3">${pub.actividades.slice(0, 6).map(tarjetaActividad).join('')}</div>
      </section>` : ''}
      ${(pub.sponsors || []).length ? `<section class="seccion contenedor" style="padding-top:0">
        <div class="seccion__titulo"><h2>Nos acompañan</h2></div>
        <div class="sponsors">${pub.sponsors.map(s => `<a class="sponsor" ${s.link ? `href="${e(s.link)}" target="_blank" rel="noopener"` : ''}>${s.logo ? `<img src="${e(s.logo)}" alt="${e(s.nombre)}">` : e(s.nombre)}</a>`).join('')}</div>
      </section>` : ''}`;

    const d = await conPitazo();
    const caja = document.getElementById('hero-partidos');
    if (!caja) return;
    if (!d) { caja.innerHTML = ''; return; }
    const prox = PZ.proximo(c.pitazo_club_id), ult = PZ.ultimo(c.pitazo_club_id);
    caja.innerHTML = (prox ? tarjetaPartido(prox, c.pitazo_club_id, 'Próximo partido') : '') +
      (ult ? tarjetaPartido(ult, c.pitazo_club_id, 'Último resultado') : '') +
      `<a class="boton boton--blanco" href="#/futbol">Fixture, tabla y goleadores</a>`;
    const ln = document.getElementById('lista-noticias');
    if (ln) ln.innerHTML = todasLasNoticias().slice(0, 6).map(n => tarjetaNoticia(n)).join('');
  }

  function tarjetaActividad(a) {
    return `<div class="tarjeta actividad">
      <h3>${e(a.nombre)}</h3>
      ${a.descripcion ? `<p class="chico">${e(a.descripcion)}</p>` : ''}
      <dl>${a.dias ? `<dt>Días</dt><dd>${e(a.dias)}</dd>` : ''}${a.horario ? `<dt>Hora</dt><dd>${e(a.horario)}</dd>` : ''}${a.lugar ? `<dt>Lugar</dt><dd>${e(a.lugar)}</dd>` : ''}${u.num(a.monto) ? `<dt>Cuota</dt><dd>${u.plata(a.monto)} extra por mes</dd>` : ''}</dl>
    </div>`;
  }

  // ---------- Fútbol ----------
  async function futbol(tab) {
    const c = PC.ctx.cfg, cid = c.pitazo_club_id;
    main().innerHTML = `<section class="seccion contenedor"><p class="cargando">Cargando datos de Pitazo Final…</p></section>`;
    const d = await conPitazo();
    if (!d) { main().innerHTML = `<section class="seccion contenedor"><p class="vacio">Este club todavía no está vinculado con Pitazo Final.</p></section>`; return; }
    const partidos = PZ.partidosDelClub(cid);
    const torneos = [...new Set(partidos.map(p => p.torneo_id))].map(id => PZ.torneo(id)).filter(Boolean);
    const conTabla = torneos.filter(t => t.tipo !== 'llave' && partidos.filter(p => p.torneo_id === t.id && PZ.resultado(p).jugado).length >= 3);
    const llaves = torneos.filter(t => t.tipo === 'llave' || partidos.some(p => p.torneo_id === t.id && p.fase));
    const tabs = [['partidos', 'Partidos'], ...(conTabla.length ? [['tabla', 'Tabla']] : []), ...(llaves.length ? [['llave', 'Fase final']] : []), ['goleadores', 'Goleadores'], ['plantel', 'Plantel']];
    tab = tabs.some(t => t[0] === tab) ? tab : 'partidos';
    let cuerpo = '';
    if (tab === 'partidos') {
      const jugados = partidos.filter(p => PZ.resultado(p).jugado);
      const racha = jugados.slice(-5).map(p => PZ.paraClub(p, cid).res).filter(Boolean);
      const proximos = partidos.filter(p => !PZ.resultado(p).jugado);
      cuerpo = `
        ${proximos.length ? `<h3 style="margin:4px 0 8px">Próximos</h3><div class="tarjeta" style="padding:4px 16px;margin-bottom:22px"><ul class="lista-partidos">${proximos.map(p => filaPartido(p, cid)).join('')}</ul></div>` : ''}
        <div class="seccion__titulo" style="margin-bottom:8px"><h3>Resultados</h3>${racha.length ? `<div class="racha" title="Últimos partidos">${racha.map(r => `<span class="res res--${r}">${r}</span>`).join('')}</div>` : ''}</div>
        <div class="tarjeta" style="padding:4px 16px"><ul class="lista-partidos">${jugados.slice().reverse().map(p => filaPartido(p, cid)).join('') || '<li>Sin partidos jugados.</li>'}</ul></div>`;
    } else if (tab === 'tabla') {
      cuerpo = conTabla.map(t => `<div class="tarjeta" style="margin-bottom:18px"><h3 style="margin-bottom:10px">${e(t.nombre)}</h3>${tablaHtml(PZ.tabla(t.id), cid)}</div>`).join('');
    } else if (tab === 'llave') {
      cuerpo = llaves.map(t => llaveHtml(t, cid)).join('');
    } else if (tab === 'goleadores') {
      const g = PZ.goleadoresDelClub(cid);
      cuerpo = `<div class="tarjeta" style="max-width:560px"><ol class="ranking">${g.map((x, i) => `<li><span class="pos">${i + 1}</span><span>${e(x.nombre)}</span><b>${x.goles}</b></li>`).join('') || '<li>Sin goles cargados.</li>'}</ol>
        <p class="chico" style="margin:10px 0 0">Goles cargados en Pitazo Final. Algunos partidos no tienen goleadores publicados.</p></div>`;
    } else {
      const pl = PZ.plantel(cid);
      cuerpo = pl.length ? `<div class="plantel">${pl.map(j => `<div class="jugador">${escudo(c.escudo, c.nombre, 'escudo--mini')}<div><div class="jugador__ap">${e(j.apellido)}</div><div class="chico">${e(j.nombre)}${j.numero ? ' · #' + e(j.numero) : ''}${j.posicion ? ' · ' + e(j.posicion) : ''}</div></div></div>`).join('')}</div>` : '<p class="vacio">Todavía no hay jugadores cargados.</p>';
    }
    main().innerHTML = `<section class="seccion contenedor">
      <div class="seccion__titulo"><h2>Fútbol</h2><a href="${e(PZ.urlClub(cid))}" target="_blank" rel="noopener">Ver en Pitazo Final ↗</a></div>
      <div class="pestanas" role="tablist">${tabs.map(([k, n]) => `<a href="#/futbol/${k}" role="tab" aria-selected="${k === tab}">${n}</a>`).join('')}</div>
      ${cuerpo}
    </section>`;
  }
  function filaPartido(p, cid) {
    const v = PZ.paraClub(p, cid), r = v.r, f = PZ.fechaDe(p), t = PZ.torneo(p.torneo_id);
    const instancia = p.fase || (p.fecha_nro ? 'Fecha ' + p.fecha_nro : '');
    let marcador = '';
    if (r.jugado) {
      const nos = v.lado === 'local' ? r.gl : r.gv, ell = v.lado === 'local' ? r.gv : r.gl;
      marcador = r.hay ? `${nos} - ${ell}` : '—';
      if (r.penales) { const [a, b] = r.penales.split('-'); marcador += `<small>pen. ${v.lado === 'local' ? a + '-' + b : b + '-' + a}</small>`; }
      else if (!r.hay) marcador += '<small>sin marcador</small>';
    } else marcador = `<small>${p.hora ? e(p.hora) + ' h' : 'a confirmar'}</small>`;
    return `<li>
      <div class="lp__fecha"><b>${f ? u.corta(f) : '—'}</b>${e(instancia)}</div>
      <div class="lp__rival">${escudo(PZ.escudoEquipo(v.rival), PZ.nombreEquipo(v.rival), 'escudo--mini')}<span>${v.lado === 'local' ? 'vs' : 'en'} ${e(PZ.nombreEquipo(v.rival))}<small>${e(t ? t.nombre : '')}</small></span></div>
      <div class="lp__marcador">${marcador}</div>
      ${v.res ? `<span class="res res--${v.res}">${v.res}</span>` : '<span></span>'}
    </li>`;
  }
  function tablaHtml(filas, cid) {
    const nuestros = new Set(PZ.equiposDelClub(cid).map(x => x.id));
    return `<div style="overflow-x:auto"><table class="tabla-pos"><thead><tr><th>#</th><th class="eq">Equipo</th><th>Pts</th><th>PJ</th><th class="opc">G</th><th class="opc">E</th><th class="opc">P</th><th class="opc">GF</th><th class="opc">GC</th><th>DIF</th></tr></thead><tbody>
      ${filas.map((f, i) => `<tr class="${nuestros.has(f.id) ? 'nuestro' : ''}"><td>${i + 1}</td><td class="eq"><span class="eq__in">${escudo(PZ.escudoEquipo(f.id), PZ.nombreEquipo(f.id), 'escudo--mini')}${e(PZ.nombreEquipo(f.id))}</span></td><td class="pts">${f.pts}</td><td>${f.pj}</td><td class="opc">${f.g}</td><td class="opc">${f.e}</td><td class="opc">${f.p}</td><td class="opc">${f.gf}</td><td class="opc">${f.gc}</td><td>${f.gf - f.gc > 0 ? '+' : ''}${f.gf - f.gc}</td></tr>`).join('')}
    </tbody></table></div><p class="chico" style="margin:8px 0 0">Algunos partidos tienen ganador pero no marcador publicado: suman puntos pero no goles.</p>`;
  }
  function llaveHtml(t, cid) {
    const ps = (PZ.datos.partidos || []).filter(p => p.torneo_id === t.id);
    const fases = [];
    ps.forEach(p => { const f = p.fase || ('Fecha ' + p.fecha_nro); if (!fases.includes(f)) fases.push(f); });
    const nuestros = new Set(PZ.equiposDelClub(cid).map(x => x.id));
    const rondas = fases.map(f => {
      const delaFase = ps.filter(p => (p.fase || ('Fecha ' + p.fecha_nro)) === f);
      const porLlave = {};
      delaFase.forEach(p => { const k = p.llave || p.id; (porLlave[k] = porLlave[k] || []).push(p); });
      const cruces = Object.values(porLlave).map(grupo => {
        const p = grupo[0], r = PZ.resultado(p);
        const fila = (id, goles, gana) => `<div class="cruce__fila ${gana ? 'gana' : ''} ${nuestros.has(id) ? 'nuestro' : ''}">${escudo(PZ.escudoEquipo(id), PZ.nombreEquipo(id), 'escudo--mini')}<span>${e(PZ.nombreEquipo(id))}</span><b>${goles === null ? '' : goles}</b></div>`;
        const pie = r.jugado ? (r.penales ? 'Penales ' + r.penales : grupo.length > 1 ? 'Ida' : 'Final del partido') : (PZ.fechaDe(p) ? u.fecha(PZ.fechaDe(p), true) : 'A confirmar') + (grupo.length > 1 || /semi|final/i.test(f) ? ' · ida' : '');
        return `<div class="cruce">${fila(p.local_id, r.jugado ? r.gl : null, r.gana === 'L')}${fila(p.visitante_id, r.jugado ? r.gv : null, r.gana === 'V')}<div class="cruce__pie">${e(pie)}</div></div>`;
      }).join('');
      return `<div class="llave__ronda"><h3>${e(f)}</h3>${cruces}</div>`;
    }).join('');
    return `<div class="tarjeta" style="margin-bottom:18px"><h3>${e(t.nombre)}</h3>${t.formato ? `<p class="chico" style="margin:4px 0 14px">${e(t.formato)}</p>` : ''}<div class="llave">${rondas}</div></div>`;
  }

  // ---------- Noticias ----------
  async function noticias() {
    main().innerHTML = `<section class="seccion contenedor"><div class="seccion__titulo"><h2>Noticias</h2></div><div class="noticias" id="lista-noticias">${(PC.ctx.pub.noticias || []).map(n => tarjetaNoticia(n)).join('')}</div></section>`;
    await conPitazo();
    const l = document.getElementById('lista-noticias');
    if (l) l.innerHTML = todasLasNoticias().map(n => tarjetaNoticia(n)).join('') || '<p class="vacio">Todavía no hay noticias.</p>';
  }
  async function noticia(id) {
    await conPitazo();
    const n = todasLasNoticias().find(x => String(x.id) === String(id));
    if (!n) { main().innerHTML = `<section class="seccion contenedor"><p class="vacio">No encontramos esa noticia. <a href="#/noticias">Ver todas</a></p></section>`; return; }
    const propia = !n.liga_id;
    const pid = n.partido_id;
    const p = pid && PZ.datos ? (PZ.datos.partidos || []).find(x => x.id === pid) : null;
    main().innerHTML = `<article class="seccion contenedor nota">
      <a href="#/noticias">← Noticias</a>
      <h1>${e(n.titulo)}</h1>
      <p class="chico">${e(u.fecha(n.fecha, true))}${propia ? '' : ' · Pitazo Final' + (n.fuente ? ' · ' + e(n.fuente) : '')}</p>
      ${n.imagen ? `<img class="nota__img" src="${e(n.imagen)}" alt="">` : ''}
      ${p ? `<div style="margin:16px 0 22px">${tarjetaPartido(p, PC.ctx.cfg.pitazo_club_id, PZ.resultado(p).jugado ? 'Resultado' : 'Partido')}</div>` : ''}
      <div class="nota__cuerpo">${e(n.cuerpo || n.resumen || '')}</div>
      ${n.url ? `<p style="margin-top:18px"><a href="${e(n.url)}" target="_blank" rel="noopener">Leer la nota completa${n.fuente ? ' en ' + e(n.fuente) : ''} ↗</a></p>` : ''}
    </article>`;
  }

  // ---------- El club ----------
  function club() {
    const c = PC.ctx.cfg, pub = PC.ctx.pub;
    const contacto = [
      c.direccion && ['Dirección', e(c.direccion)],
      c.ciudad && ['Localidad', e(c.ciudad)],
      c.whatsapp && ['WhatsApp', `<a href="${e(u.wa(c.whatsapp, 'Hola! Les escribo desde la web del club.'))}" target="_blank" rel="noopener">${e(c.whatsapp)}</a>`],
      c.telefono && ['Teléfono', `<a href="tel:${e(c.telefono)}">${e(c.telefono)}</a>`],
      c.email && ['Email', `<a href="mailto:${e(c.email)}">${e(c.email)}</a>`],
      c.instagram && ['Instagram', `<a href="https://instagram.com/${e(c.instagram.replace('@', ''))}" target="_blank" rel="noopener">${e(c.instagram)}</a>`],
      c.facebook && ['Facebook', `<a href="${e(c.facebook)}" target="_blank" rel="noopener">Página del club</a>`]
    ].filter(Boolean);
    main().innerHTML = `<section class="seccion contenedor">
      <div class="seccion__titulo"><h2>El club</h2></div>
      <div class="grilla-2">
        <div class="tarjeta"><div class="ficha-cab">${escudo(c.escudo, c.nombre, 'escudo--partido')}<div><h3>${e(c.nombre)}</h3><span class="chico">${pub.socios ? pub.socios + ' socios activos' : ''}</span></div></div>
          <p>${e(c.historia || '')}</p></div>
        <div class="tarjeta"><h3 style="margin-bottom:10px">Contacto</h3>
          ${contacto.length ? `<dl style="display:grid;grid-template-columns:auto 1fr;gap:6px 14px;margin:0">${contacto.map(([k, v]) => `<dt class="chico">${k}</dt><dd style="margin:0;font-weight:600">${v}</dd>`).join('')}</dl>` : '<p class="chico">El club todavía no cargó sus datos de contacto.</p>'}
        </div>
      </div>
    </section>
    ${(pub.actividades || []).length ? `<section class="seccion contenedor" style="padding-top:0"><div class="seccion__titulo"><h2>Actividades y horarios</h2></div><div class="grilla-3">${pub.actividades.map(tarjetaActividad).join('')}</div></section>` : ''}
    <section class="seccion contenedor" style="padding-top:0"><div class="seccion__titulo"><h2>Cuota social</h2><a href="#/asociate">Asociate</a></div>
      <div class="grilla-3">${(pub.categorias || []).map(x => `<div class="tarjeta"><h3>${e(x.nombre)}</h3><p style="font-size:1.8rem;font-weight:900;font-stretch:72%;margin:6px 0">${x.monto ? u.plata(x.monto) + '<span class="chico"> /mes</span>' : 'Sin cargo'}</p><p class="chico" style="margin:0">${e(x.descripcion || '')}</p></div>`).join('')}</div>
    </section>`;
  }

  // ---------- Asociate ----------
  function asociate() {
    const c = PC.ctx.cfg, pub = PC.ctx.pub;
    main().innerHTML = `<section class="seccion contenedor" style="max-width:720px">
      <div class="seccion__titulo"><h2>Asociate al ${e(c.nombre_corto || 'club')}</h2></div>
      <div class="tarjeta">
        <form class="form" id="f-asociate" novalidate>
          <div class="form__fila">
            <label class="campo"><span>Nombre</span><input name="nombre" autocomplete="given-name" required></label>
            <label class="campo"><span>Apellido</span><input name="apellido" autocomplete="family-name" required></label>
          </div>
          <div class="form__fila">
            <label class="campo"><span>DNI</span><input name="dni" inputmode="numeric" required></label>
            <label class="campo"><span>Fecha de nacimiento</span><input name="nacimiento" type="date"></label>
          </div>
          <div class="form__fila">
            <label class="campo"><span>Celular (WhatsApp)</span><input name="telefono" inputmode="tel" autocomplete="tel" required><small>Con característica, sin 0 ni 15.</small></label>
            <label class="campo"><span>Email <small>(opcional)</small></span><input name="email" type="email" autocomplete="email"></label>
          </div>
          <div class="campo"><span>Categoría</span><div class="checks">${(pub.categorias || []).map((x, i) => `<label class="check"><input type="radio" name="categoria_id" value="${e(x.id)}" ${i === 0 ? 'checked' : ''}>${e(x.nombre)}${x.monto ? ' · ' + u.plata(x.monto) : ''}</label>`).join('')}</div></div>
          ${(pub.actividades || []).length ? `<div class="campo"><span>¿Querés sumarte a alguna actividad? <small>(opcional)</small></span><div class="checks">${pub.actividades.map(a => `<label class="check"><input type="checkbox" name="actividades" value="${e(a.id)}">${e(a.nombre)}</label>`).join('')}</div></div>` : ''}
          <label class="campo"><span>Mensaje <small>(opcional)</small></span><textarea name="mensaje" rows="3" style="min-height:80px"></textarea></label>
          <div id="f-error"></div>
          <button class="boton" type="submit">Enviar solicitud</button>
          <p class="chico" style="margin:0">El club revisa tu solicitud y te avisa por WhatsApp. La cuota se paga directo al club (transferencia, Mercado Pago o en la secretaría).</p>
        </form>
      </div></section>`;
    const f = document.getElementById('f-asociate');
    f.addEventListener('submit', async ev => {
      ev.preventDefault();
      const fd = new FormData(f), d = Object.fromEntries(fd.entries());
      d.actividades = fd.getAll('actividades').join(', ');
      const b = f.querySelector('button[type=submit]'); b.disabled = true; b.textContent = 'Enviando…';
      try {
        await DB.solicitud(d);
        f.outerHTML = `<div class="exito"><h3>¡Listo, ${e(d.nombre)}!</h3><p style="margin:6px 0 0">Recibimos tu solicitud. El club te va a escribir al ${e(d.telefono)} con tu número de socio y tu código para entrar al carnet digital.</p></div>`;
      } catch (err) {
        document.getElementById('f-error').innerHTML = `<div class="error">${e(err.message)}</div>`;
        b.disabled = false; b.textContent = 'Enviar solicitud';
      }
    });
  }

  PC.sitio = { inicio, futbol, noticias, noticia, club, asociate, tarjetaPartido, conPitazo };
})();
