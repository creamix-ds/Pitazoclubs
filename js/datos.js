/* Pitazo Club — datos.
 *  - DB: datos propios del club (socios, cuotas, pagos, noticias...). Modo demo (este
 *    navegador) o modo conectado (Apps Script de Pitazo Club, con su propia planilla).
 *  - PZ: datos deportivos leídos de la API pública de Pitazo Final (solo lectura).
 */
window.PC = window.PC || {};
(function () {
  'use strict';
  const CFG = window.CONFIG, M = window.MOTOR;
  const params = new URLSearchParams(location.search);
  const SLUG = (params.get('c') || CFG.CLUB || 'demo').toLowerCase();
  const DEMO = !CFG.API_URL;

  // ---------- utilidades de la interfaz ----------
  const u = {
    esc: s => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    plata: n => M.plata(n),
    num: M.num, txt: M.txt, iso: M.fechaISO,
    hoy() { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); },
    ahora() { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16).replace('T', ' '); },
    fecha(v, conDia) {
      const s = M.fechaISO(v);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return M.txt(v);
      const d = new Date(s + 'T12:00:00');
      const dia = d.toLocaleDateString('es-AR', { weekday: 'long' });
      const f = d.getDate() + ' de ' + d.toLocaleDateString('es-AR', { month: 'long' });
      return conDia ? dia.charAt(0).toUpperCase() + dia.slice(1) + ' ' + f : f + (s.slice(0, 4) !== u.hoy().slice(0, 4) ? ' de ' + s.slice(0, 4) : '');
    },
    corta(v) { const s = M.fechaISO(v); const m = s.match(/^\d{4}-(\d{2})-(\d{2})/); return m ? Number(m[2]) + '/' + Number(m[1]) : M.txt(v); },
    periodo: M.nombrePeriodo,
    iniciales(n) { const p = String(n || '').split(/\s+/).filter(w => !/^(de|del|la|el|y|club|deportivo|atlético)$/i.test(w)); return ((p[0] || '?')[0] + (p[1] ? p[1][0] : '')).toUpperCase(); },
    aviso(texto, tipo) {
      const el = document.getElementById('aviso');
      el.textContent = texto; el.className = 'aviso' + (tipo ? ' aviso--' + tipo : ''); el.hidden = false;
      clearTimeout(u.aviso.t); u.aviso.t = setTimeout(() => { el.hidden = true; }, 4200);
    },
    copiar(t) {
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => u.aviso('Copiado: ' + t), () => {
        const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select();
        try { document.execCommand('copy'); u.aviso('Copiado: ' + t); } catch (e) { u.aviso('No se pudo copiar'); }
        a.remove();
      });
    },
    // Achica una foto antes de guardarla o mandarla (los comprobantes pesan poco así).
    achicar(file, max) {
      max = max || 1200;
      return new Promise((ok, mal) => {
        if (file.type === 'application/pdf') {
          if (file.size > 3e6) return mal(new Error('El PDF pesa más de 3 MB.'));
          const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = mal; r.readAsDataURL(file); return;
        }
        const img = new Image();
        img.onload = () => {
          const k = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          ok(c.toDataURL('image/jpeg', 0.72)); URL.revokeObjectURL(img.src);
        };
        img.onerror = () => mal(new Error('No se pudo leer la imagen.'));
        img.src = URL.createObjectURL(file);
      });
    },
    wa(tel, texto) {
      let t = String(tel || '').replace(/\D/g, '');
      if (t && !t.startsWith('54')) t = '549' + t.replace(/^0/, '');
      return 'https://wa.me/' + t + '?text=' + encodeURIComponent(texto);
    }
  };
  PC.u = u;

  // ---------- modo demo: todo en este navegador ----------
  const CLAVE = 'pc_demo_' + SLUG + '_v1';
  let BD = null;
  function guardarDemo() {
    try { localStorage.setItem(CLAVE, JSON.stringify(BD)); }
    catch (e) { u.aviso('El navegador no tiene más lugar para la demo. Usá "Reiniciar demo".', 'mal'); }
  }
  async function cargarDemo() {
    if (BD) return;
    try { BD = JSON.parse(localStorage.getItem(CLAVE)); } catch (e) { BD = null; }
    if (!BD) {
      const r = await fetch('data/demo-pirovano.json', { cache: 'no-cache' });
      BD = await r.json(); guardarDemo();
    }
  }
  const store = {
    rows: t => BD[t] || (BD[t] = []),
    insert: (t, r) => { store.rows(t).push(Object.assign({}, r)); },
    update: (t, r, k) => { k = k || 'id'; const a = store.rows(t); const i = a.findIndex(x => String(x[k]) === String(r[k])); if (i >= 0) a[i] = Object.assign({}, a[i], r); },
    remove: (t, id, k) => { k = k || 'id'; BD[t] = store.rows(t).filter(x => String(x[k]) !== String(id)); },
    hoy: () => u.hoy(), ahora: () => u.ahora()
  };
  const copia = o => JSON.parse(JSON.stringify(o));

  // ---------- modo conectado: Apps Script de Pitazo Club ----------
  async function post(accion, datos) {
    const body = Object.assign({ accion, club: SLUG }, datos || {});
    const tp = sessionStorage.getItem('pc_token'); if (tp && !body.token) body.token = tp;
    const ts = localStorage.getItem('pc_socio_' + SLUG); if (ts && !body.socio_token) body.socio_token = ts;
    const res = await fetch(CFG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
    const j = await res.json();
    if (!j.ok) throw new Error(j.error || 'No se pudo completar.');
    return j.data;
  }
  async function get(r) {
    const url = new URL(CFG.API_URL); url.searchParams.set('r', r); url.searchParams.set('c', SLUG);
    const j = await (await fetch(url.toString())).json();
    if (!j.ok) throw new Error(j.error || 'Error de la API');
    return j.data;
  }
  // En demo, cada operación corre el motor acá y guarda en el navegador.
  function local(fn) {
    return cargarDemo().then(() => {
      const r = fn();
      guardarDemo();
      return copia(r === undefined ? null : r);
    });
  }

  const DB = {
    demo: DEMO, slug: SLUG,
    reiniciarDemo() { localStorage.removeItem(CLAVE); sessionStorage.removeItem('pc_socio_demo'); BD = null; },

    async publico() {
      if (DEMO) { await cargarDemo(); return copia(M.publico(store)); }
      const k = 'pc_pub_' + SLUG;
      try { const d = await get('publico'); localStorage.setItem(k, JSON.stringify(d)); return d; }
      catch (e) { const c = localStorage.getItem(k); if (c) return JSON.parse(c); throw e; }
    },
    solicitud: d => DEMO ? local(() => M.solicitud(store, d)) : post('solicitud', { datos: d }),

    // ----- socio -----
    async socioIngresar(dni, pin) {
      if (DEMO) return local(() => { const s = M.ingresarSocio(store, dni, pin); sessionStorage.setItem('pc_socio_demo', s.id); return M.vistaSocio(store, s.id); });
      const r = await post('socio_ingresar', { dni, pin });
      localStorage.setItem('pc_socio_' + SLUG, r.token);
      return r.vista;
    },
    socioActivo: () => DEMO ? !!sessionStorage.getItem('pc_socio_demo') : !!localStorage.getItem('pc_socio_' + SLUG),
    socioVista() {
      if (DEMO) return local(() => M.vistaSocio(store, sessionStorage.getItem('pc_socio_demo')));
      return post('socio_vista');
    },
    socioInformar(d) {
      if (DEMO) return local(() => { M.informarPago(store, sessionStorage.getItem('pc_socio_demo'), d); return M.vistaSocio(store, sessionStorage.getItem('pc_socio_demo')); });
      return post('socio_informar', { datos: d });
    },
    socioSalir() { sessionStorage.removeItem('pc_socio_demo'); localStorage.removeItem('pc_socio_' + SLUG); },

    // ----- panel -----
    async panelIngresar(googleToken) {
      if (DEMO) { sessionStorage.setItem('pc_panel_demo', '1'); return { usuario: { email: 'demo@pitazoclub', nombre: 'Tesorería (demo)', rol: 'admin' } }; }
      sessionStorage.setItem('pc_token', googleToken);
      try { return await post('panel_sesion'); } catch (e) { sessionStorage.removeItem('pc_token'); throw e; }
    },
    panelActivo: () => DEMO ? !!sessionStorage.getItem('pc_panel_demo') : !!sessionStorage.getItem('pc_token'),
    panelSalir() { sessionStorage.removeItem('pc_panel_demo'); sessionStorage.removeItem('pc_token'); },
    async panelDatos() {
      if (DEMO) { await cargarDemo(); return copia(BD); }
      return post('panel_datos');
    },
    /** Operaciones del panel. Devuelven { res, datos } con las tablas actualizadas. */
    async op(nombre, args) {
      args = args || {};
      if (!DEMO) return post('panel_op', { op: nombre, args });
      await cargarDemo();
      const quien = 'tesoreria@demo';
      const ops = {
        guardar: () => M.guardar(store, args.tabla, args.fila, quien),
        borrar: () => M.borrar(store, args.tabla, args.id),
        guardarConfig: () => M.guardarConfig(store, args.cambios),
        generarCuotas: () => M.generarCuotas(store, args.periodo),
        registrarPago: () => M.registrarPago(store, args.pago, quien),
        resolverPago: () => M.resolverPago(store, args.id, args.aprobar, quien, args.motivo),
        aprobarSolicitud: () => M.aprobarSolicitud(store, args.id),
        rechazarSolicitud: () => { const s = store.rows('Solicitudes').find(x => x.id === args.id); if (s) { s.estado = 'Rechazada'; } return s; },
        validarAcceso: () => M.validarAcceso(store, args.leido, args.lugar),
        nuevoCodigo: () => M.nuevoCodigo(store, args.id, args.que),
        // Sin IA en la demo: borrador armado solo con los datos reales del partido.
        redactar: () => Object.assign(M.borradorCronica(args.pz, args.notas), { ia: false }),
        resumenComision: () => ({ texto: M.resumenComisionSinIA(M.resumen(store, args.periodo)), ia: false }),
        subirArchivo: () => ({ url: args.dataUrl })
      };
      if (!ops[nombre]) throw new Error('Operación desconocida: ' + nombre);
      const res = ops[nombre]();
      guardarDemo();
      return { res: copia(res === undefined ? null : res), datos: copia(BD) };
    }
  };
  PC.DB = DB;

  // ---------- Pitazo Final (solo lectura) ----------
  const PZ_CACHE = 'pc_pz_';
  async function pzGet(r, extra) {
    const url = new URL(CFG.PITAZO_API); url.searchParams.set('r', r);
    Object.entries(extra || {}).forEach(([k, v]) => url.searchParams.set(k, v));
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 12000);
    try {
      const j = await (await fetch(url.toString(), { signal: ctrl.signal })).json();
      if (!j.ok) throw new Error(j.error || 'Error en Pitazo Final');
      return j.data;
    } finally { clearTimeout(t); }
  }

  const PZ = {
    datos: null, origen: '',
    /** Trae de Pitazo Final la liga del club. Si no responde, usa la última copia o la del sitio. */
    async cargar(clubId, ligaId) {
      if (this.datos && this.datos._club === clubId) return this.datos;
      let d = null;
      if (CFG.PITAZO_API) {
        try {
          const [base, liga] = await Promise.all([pzGet('base'), pzGet('liga', { id: ligaId })]);
          d = {
            ligas: (base.ligas || []).filter(l => l.id === ligaId), clubes: (base.clubes || []).filter(c => c.liga_id === ligaId),
            equipos: base.equipos || [], torneos: (base.torneos || []).filter(t => t.liga_id === ligaId),
            jugadores: liga.jugadores || [], partidos: liga.partidos || [], eventos: liga.eventos || [], noticias: liga.noticias || []
          };
          const clubIds = new Set(d.clubes.map(c => c.id));
          d.equipos = d.equipos.filter(e => clubIds.has(e.club_id) || d.partidos.some(p => p.local_id === e.id || p.visitante_id === e.id));
          d.clubes = (base.clubes || []).filter(c => clubIds.has(c.id) || d.equipos.some(e => e.club_id === c.id));
          this.origen = 'Datos en vivo de Pitazo Final';
          try { localStorage.setItem(PZ_CACHE + ligaId, JSON.stringify({ f: Date.now(), d })); } catch (e) {}
        } catch (e) {
          console.warn('Pitazo Final no respondió, uso una copia.', e);
          try { const c = JSON.parse(localStorage.getItem(PZ_CACHE + ligaId)); if (c) { d = c.d; this.origen = 'Copia de Pitazo Final del ' + new Date(c.f).toLocaleDateString('es-AR'); } } catch (e2) {}
        }
      }
      if (!d) {
        try {
          d = await (await fetch('data/pitazo-' + ligaId + '.json', { cache: 'no-cache' })).json();
          this.origen = 'Copia de Pitazo Final del ' + u.corta(d.generado);
        } catch (e) { d = { ligas: [], clubes: [], equipos: [], torneos: [], jugadores: [], partidos: [], eventos: [], noticias: [] }; this.origen = 'Sin datos de Pitazo Final'; }
      }
      d._club = clubId;
      this.datos = d;
      return d;
    },
    club(id) { return (this.datos.clubes || []).find(c => c.id === id) || null; },
    equipo(id) { return (this.datos.equipos || []).find(e => e.id === id) || null; },
    clubDeEquipo(eid) { const e = this.equipo(eid); return e ? this.club(e.club_id) : null; },
    nombreEquipo(eid) {
      const e = this.equipo(eid), c = e ? this.club(e.club_id) : null;
      return c ? c.nombre : (e && e.club) || 'Rival a confirmar';
    },
    escudoEquipo(eid) { const c = this.clubDeEquipo(eid); return c ? c.escudo : ''; },
    torneo(id) { return (this.datos.torneos || []).find(t => t.id === id) || null; },
    equiposDelClub(clubId) { return (this.datos.equipos || []).filter(e => e.club_id === clubId); },
    fechaDe: p => M.fechaISO(p.fecha_jugada) || M.fechaISO(p.fecha_programada) || '',
    /** Resultado normalizado de un partido. */
    resultado(p) {
      const gl = M.txt(p.goles_local), gv = M.txt(p.goles_visitante);
      const hay = gl !== '' && gv !== '';
      const man = M.txt(p.resultado_manual).toUpperCase(), res = M.txt(p.resultado).toUpperCase();
      const pen = M.txt(p.penales).match(/^(\d+)\s*-\s*(\d+)$/);
      let gana = '';
      if (hay && Number(gl) !== Number(gv)) gana = Number(gl) > Number(gv) ? 'L' : 'V';
      else if (['L', 'V', 'E'].includes(man)) gana = man;
      else if (pen) gana = Number(pen[1]) > Number(pen[2]) ? 'L' : 'V';
      else if (hay) gana = 'E';
      else if (['L', 'V', 'E'].includes(res)) gana = res;
      const jugado = M.txt(p.estado) === 'Finalizado' || hay || !!gana;
      return { jugado, hay, gl: hay ? Number(gl) : null, gv: hay ? Number(gv) : null, gana, penales: pen ? pen[1] + '-' + pen[2] : '' };
    },
    partidosDelClub(clubId) {
      const eids = new Set(this.equiposDelClub(clubId).map(e => e.id));
      // Se omiten los partidos sin fecha contra un rival que todavía no está cargado en Pitazo Final.
      return (this.datos.partidos || []).filter(p => (eids.has(p.local_id) || eids.has(p.visitante_id)) &&
        (this.fechaDe(p) || (this.equipo(p.local_id) && this.equipo(p.visitante_id))))
        .sort((a, b) => (this.fechaDe(a) || '9999') < (this.fechaDe(b) || '9999') ? -1 : 1);
    },
    /** Desde el punto de vista del club: G/E/P, lado, rival. */
    paraClub(p, clubId) {
      const eids = new Set(this.equiposDelClub(clubId).map(e => e.id));
      const lado = eids.has(p.local_id) ? 'local' : 'visitante';
      const r = this.resultado(p);
      let res = '';
      if (r.jugado && r.gana) res = r.gana === 'E' ? 'E' : (r.gana === 'L') === (lado === 'local') ? 'G' : 'P';
      // Empate con penales: cuenta como ganado o perdido por penales.
      if (r.gana === 'E' && r.penales) { const [a, b] = r.penales.split('-').map(Number); res = (a > b) === (lado === 'local') ? 'G' : 'P'; }
      return { lado, rival: lado === 'local' ? p.visitante_id : p.local_id, res, r };
    },
    proximo(clubId) {
      const hoy = u.hoy();
      return this.partidosDelClub(clubId).find(p => !this.resultado(p).jugado && this.fechaDe(p) && this.fechaDe(p) >= hoy) || null;
    },
    ultimo(clubId) {
      const j = this.partidosDelClub(clubId).filter(p => this.resultado(p).jugado);
      return j[j.length - 1] || null;
    },
    goles(pid) {
      const p = (this.datos.partidos || []).find(x => x.id === pid);
      return (this.datos.eventos || []).filter(e => e.partido_id === pid && /^gol/i.test(e.tipo)).map(e => {
        const j = (this.datos.jugadores || []).find(x => x.id === e.jugador_id);
        const enContra = /contra/i.test(e.tipo);
        const lado = e.equipo_id === (p && p.local_id) ? 'local' : 'visitante';
        return { jugador: j ? (j.nombre + ' ' + j.apellido).trim() : '', equipo: enContra ? (lado === 'local' ? 'visitante' : 'local') : lado, en_contra: enContra, equipo_id: e.equipo_id };
      });
    },
    /** Tabla de posiciones de un torneo "todos contra todos" (los partidos con fase son playoffs y no cuentan). */
    tabla(tid) {
      const filas = {};
      const fila = id => filas[id] || (filas[id] = { id, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 });
      (this.datos.partidos || []).filter(p => p.torneo_id === tid && !M.txt(p.fase)).forEach(p => {
        const r = this.resultado(p);
        fila(p.local_id); fila(p.visitante_id);
        if (!r.jugado || !r.gana) return;
        const L = fila(p.local_id), V = fila(p.visitante_id);
        L.pj++; V.pj++;
        if (r.hay) { L.gf += r.gl; L.gc += r.gv; V.gf += r.gv; V.gc += r.gl; }
        if (r.gana === 'L') { L.g++; V.p++; L.pts += 3; } else if (r.gana === 'V') { V.g++; L.p++; V.pts += 3; } else { L.e++; V.e++; L.pts++; V.pts++; }
      });
      return Object.values(filas).filter(f => this.equipo(f.id) || f.pj)
        .sort((a, b) => b.pts - a.pts || (b.gf - b.gc) - (a.gf - a.gc) || b.gf - a.gf || this.nombreEquipo(a.id).localeCompare(this.nombreEquipo(b.id)));
    },
    goleadoresDelClub(clubId) {
      const eids = new Set(this.equiposDelClub(clubId).map(e => e.id));
      const c = {};
      (this.datos.eventos || []).filter(e => /^gol$/i.test(M.txt(e.tipo)) && eids.has(e.equipo_id) && e.jugador_id).forEach(e => { c[e.jugador_id] = (c[e.jugador_id] || 0) + 1; });
      return Object.entries(c).map(([id, n]) => { const j = (this.datos.jugadores || []).find(x => x.id === id); return { id, nombre: j ? j.nombre + ' ' + j.apellido : id, goles: n }; })
        .sort((a, b) => b.goles - a.goles || a.nombre.localeCompare(b.nombre));
    },
    plantel(clubId) {
      const eids = new Set(this.equiposDelClub(clubId).map(e => e.id));
      return (this.datos.jugadores || []).filter(j => eids.has(j.equipo_id) && M.txt(j.activo || 'SI') !== 'NO')
        .sort((a, b) => (a.apellido || '').localeCompare(b.apellido || ''));
    },
    noticiasDelClub(clubId) {
      const c = this.club(clubId);
      if (!c) return [];
      const palabras = c.nombre.split(/\s+/).filter(w => w.length > 4 && !/deportivo|atl[eé]tico|club|social/i.test(w));
      const re = new RegExp(palabras.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') || c.nombre, 'i');
      return (this.datos.noticias || []).filter(n => re.test((n.titulo || '') + ' ' + (n.resumen || '')))
        .sort((a, b) => M.fechaISO(a.fecha) < M.fechaISO(b.fecha) ? 1 : -1);
    },
    /** Datos que necesita la crónica (motor.borradorCronica / Gemini). */
    paraCronica(pid, clubId) {
      const p = (this.datos.partidos || []).find(x => x.id === pid);
      if (!p) return null;
      const t = this.torneo(p.torneo_id);
      return {
        partido: p, local: this.nombreEquipo(p.local_id), visitante: this.nombreEquipo(p.visitante_id),
        torneo: t ? t.nombre : '', goles: this.goles(pid), club: this.paraClub(p, clubId).lado
      };
    },
    urlClub: clubId => CFG.PITAZO_WEB + '#/club/' + clubId
  };
  PC.PZ = PZ;
})();
