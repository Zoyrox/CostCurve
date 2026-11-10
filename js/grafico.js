/* =====================================================================
 * grafico.js — disegno del diagramma costi-tempi in SVG
 * ---------------------------------------------------------------------
 * Legge SOLO il modello calcolato da calcoli.js (curve, assi, vista,
 * frecce, etichette) e lo trasforma in un'immagine vettoriale. Ogni
 * elemento corrisponde a uno del file .tex: stesse curve di Bézier,
 * stessi assi e tacche, stessi colori e tratti, stesse posizioni.
 *
 * Opzioni: tema ('chiaro' | 'scuro', solo per lo schermo: gli export
 * sono sempre chiari), larghezza (unità SVG).
 * Lo zoom è "vero": gli assi vengono ricalcolati sulla vista scelta e
 * le curve tagliate ai bordi; se l'asse dei costi non parte da zero
 * lo si segnala con il simbolo di asse spezzato.
 * ===================================================================== */
(function (radice) {
  'use strict';

  const numeri = (typeof module !== 'undefined' && module.exports)
    ? require('./numeri.js') : radice.CC.numeri;
  const fN = numeri.formatNumero;

  // ---- Colori (chiaro = gli stessi del .tex) ---------------------------
  const TEMI = {
    chiaro: {
      fondo: '#FFFFFF', testo: '#1F2937', tenue: '#6B7280', griglia: '#E5E7EB', asse: '#374151',
      bcws: '#0072B2', bcwp: '#009E73', acwp: '#D55E00', riquadro: '#56B4E9', bordoRiquadro: '#0072B2',
      negativo: '#B34700', positivo: '#00775A', guida: '#9CA3AF', etichettaFondo: '#FFFFFF',
    },
    scuro: {
      fondo: '#161B22', testo: '#E6EAF0', tenue: '#9AA4B2', griglia: '#262D37', asse: '#AAB3C0',
      bcws: '#3E9FD6', bcwp: '#25A876', acwp: '#D9733A', riquadro: '#3E9FD6', bordoRiquadro: '#7CC4F0',
      negativo: '#F2A272', positivo: '#5FD3A6', guida: '#5B6676', etichettaFondo: '#161B22',
    },
  };
  const TRATTI = {
    bcws: { w: 2.2, dash: '' },
    bcwp: { w: 2.2, dash: '9 4.5' },
    acwp: { w: 2.2, dash: '10 3.5 2 3.5' },
    prev: { w: 2, dash: '2 3.6' },
  };
  const FONT = "Helvetica, Arial, 'Liberation Sans', sans-serif";

  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const r2 = v => Math.round(v * 100) / 100;
  const larghezzaTesto = (testo, size, grassetto) => String(testo).length * size * (grassetto ? 0.58 : 0.53);

  /** Geometria della figura: serve anche all'interfaccia per lo zoom col mouse. */
  function geometria(m, opz = {}) {
    const W = opz.larghezza || 960;
    const L = 86, R = 118, T = 58;
    const PW = W - L - R;
    const PH = Math.round(PW / (m.proporzioni || 1.6));
    return { W, L, R, T, PW, PH };
  }

  function disegna(m, opz = {}) {
    const C = TEMI[opz.tema === 'scuro' ? 'scuro' : 'chiaro'];
    const { W, L, T, PW, PH } = geometria(m, opz);
    const { xmin, xmax, ymin, ymax, xstep, ystep } = m.assi;
    const X = x => L + (x - xmin) / (xmax - xmin) * PW;
    const Y = y => T + PH - (y - ymin) / (ymax - ymin) * PH;
    const dentroX = x => x >= xmin - 1e-9 && x <= xmax + 1e-9;
    const mostra = m.mostra;
    const prev = m.previsione.visibile;
    const ut = m.unitaTempo;
    const id = 'cc' + Math.random().toString(36).slice(2, 8);   // id unici: più grafici nella stessa pagina

    const testo = (x, y, contenuto, o = {}) => {
      const a = [`x="${r2(x)}"`, `y="${r2(y)}"`, `font-size="${o.size || 12}"`, `fill="${o.colore || C.testo}"`];
      if (o.anchor) a.push(`text-anchor="${o.anchor}"`);
      if (o.bold) a.push('font-weight="bold"');
      if (o.italic) a.push('font-style="italic"');
      return `<text ${a.join(' ')}>${esc(contenuto)}</text>`;
    };
    const linea = (x1, y1, x2, y2, colore, w, dash) =>
      `<line x1="${r2(x1)}" y1="${r2(y1)}" x2="${r2(x2)}" y2="${r2(y2)}" stroke="${colore}" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
    const punta = (x, y, angolo, colore, lung = 9, larg = 6) => {
      const c = Math.cos(angolo), s = Math.sin(angolo);
      const bx = x - c * lung, by = y - s * lung;
      const p = [[x, y], [bx - s * larg / 2, by + c * larg / 2], [bx + s * larg / 2, by - c * larg / 2]];
      return `<polygon points="${p.map(q => q.map(r2).join(',')).join(' ')}" fill="${colore}"/>`;
    };
    const riquadro = (x, y, suggerimento) =>
      `<rect x="${r2(x - 5.5)}" y="${r2(y - 5.5)}" width="11" height="11" fill="${C.riquadro}" fill-opacity="0.4" stroke="${C.bordoRiquadro}" stroke-width="1" stroke-dasharray="1.6 1.4"><title>${esc(suggerimento)}</title></rect>`;

    let fuori = '';   // elementi fuori dall'area dati (assi, etichette)
    let dentro = '';  // elementi tagliati ai bordi dell'area dati (con una fascia in alto per le scritte)
    let curve = '';   // curve: tagliate esattamente ai bordi dell'area dati

    // --- Titolo del grafico --------------------------------------------
    fuori += testo(L + PW / 2, 24, 'Analisi dell\'avanzamento per periodo', { size: 15, bold: true, anchor: 'middle' });

    // --- Griglia e tacche ------------------------------------------------
    const dec = m.assi.decimaliY;
    for (let k = Math.ceil(ymin / ystep - 1e-9); k * ystep <= ymax + 1e-9 * Math.abs(ymax); k++) {
      const v = k * ystep, y = Y(v);
      if (v > ymin + 1e-9) fuori += linea(L, y, L + PW, y, C.griglia, 1);
      fuori += linea(L - 4, y, L, y, C.asse, 1);
      fuori += testo(L - 8, y + 4, fN(v, dec), { size: 11, anchor: 'end', colore: C.tenue });
    }
    for (let k = Math.ceil(xmin / xstep - 1e-9); k * xstep <= xmax + 1e-9; k++) {
      const x = X(k * xstep);
      fuori += linea(x, T + PH, x, T + PH + 4, C.asse, 1);
      fuori += testo(x, T + PH + 18, m.etichettaTempo(k * xstep), { size: 11, anchor: 'middle', colore: C.tenue });
    }
    fuori += linea(L, T + PH, L + PW + 10, T + PH, C.asse, 1.3) + punta(L + PW + 16, T + PH, 0, C.asse);
    fuori += linea(L, T + PH, L, T - 10, C.asse, 1.3) + punta(L, T - 16, -Math.PI / 2, C.asse);
    fuori += testo(L + 8, T - 14, m.unitaMoneta.asse, { size: 12.5, bold: true, colore: C.tenue });
    fuori += testo(L + PW + 24, T + PH + 4, `Tempo (${ut.plurale})`, { size: 12.5, bold: true, colore: C.tenue });
    if (m.assi.assePezzato) {
      // simbolo di asse spezzato: l'asse dei costi non parte da zero
      const yb = T + PH - 14;
      fuori += `<rect x="${L - 7}" y="${yb - 5}" width="14" height="8" fill="${C.fondo}"/>`;
      fuori += linea(L - 7, yb + 1, L + 7, yb - 5, C.asse, 1.3) + linea(L - 7, yb + 6, L + 7, yb, C.asse, 1.3);
    }

    // --- Curve ------------------------------------------------------------
    const percorso = tratti => tratti.length
      ? `M${r2(X(tratti[0].x0))} ${r2(Y(tratti[0].y0))}` + tratti.map(t => ` C${r2(X(t.c1x))} ${r2(Y(t.c1y))} ${r2(X(t.c2x))} ${r2(Y(t.c2y))} ${r2(X(t.x1))} ${r2(Y(t.y1))}`).join('')
      : '';
    const curva = (tratti, colore, tratto, nome) =>
      `<path d="${percorso(tratti)}" fill="none" stroke="${colore}" stroke-width="${tratto.w}" stroke-linecap="round" stroke-linejoin="round"${tratto.dash ? ` stroke-dasharray="${tratto.dash}"` : ''}><title>${esc(nome)}</title></path>`;
    if (mostra.bcws) curve += curva(m.curve.bcws, C.bcws, TRATTI.bcws, 'Pianificato a budget (BCWS)');
    if (mostra.bcwp) curve += curva(m.curve.bcwp, C.bcwp, TRATTI.bcwp, 'Lavoro svolto a costi di budget (BCWP)');
    if (mostra.acwp) curve += curva(m.curve.acwp, C.acwp, TRATTI.acwp, 'Costo effettivamente sostenuto (ACWP)');
    if (prev) curve += curva([m.curve.previsione], C.acwp, TRATTI.prev, 'Previsione dei costi fino a EAC');

    // --- Rilevamenti ----------------------------------------------------
    m.rilevamenti.forEach((r, i) => {
      const x = X(r.t), xSV = X(r.t + m.frecce.offSV), xCV = X(r.t + m.frecce.offCV);
      const yS = Y(r.bcws), yP = Y(r.bcwp), yA = Y(r.acwp);
      const yTop = Y(ymin + (ymax - ymin) * m.frecce.altEtichetta[i]);
      dentro += linea(x, T + PH, x, yTop, C.testo, 1, '4 3');
      dentro += testo(x, yTop - 17, `Rilevamento ${r.n}`, { size: 11, bold: true, anchor: 'middle' });
      dentro += testo(x, yTop - 4, r.data ? `${ut.singolare} ${r.t} · ${r.data}` : `${ut.singolare} ${r.t}`, { size: 10.5, anchor: 'middle', colore: C.tenue });
      if (mostra.frecce) {
        dentro += linea(x, yS, xSV, yS, C.guida, 0.9, '4 3');
        dentro += linea(x, yP, xCV, yP, C.guida, 0.9, '4 3');
        dentro += linea(x, yA, xCV, yA, C.guida, 0.9, '4 3');
        const freccia = (xf, ya, yb) => {
          if (Math.abs(ya - yb) / PH <= 0.004) return '';
          const su = Math.min(ya, yb), giu = Math.max(ya, yb);
          return linea(xf, su + 6, xf, giu - 6, C.testo, 1.3) + punta(xf, su, -Math.PI / 2, C.testo, 7, 6) + punta(xf, giu, Math.PI / 2, C.testo, 7, 6);
        };
        dentro += freccia(xSV, yS, yP) + freccia(xCV, yA, yP);
        const valore = (xf, yc, nome, v) => {
          const riga2 = numeri.formatBreve(v, true);
          const w = Math.max(larghezzaTesto(nome + r.n, 10.5, true), larghezzaTesto(riga2, 10.5)) + 6;
          const colore = v < 0 ? C.negativo : v > 0 ? C.positivo : C.testo;
          return `<rect x="${r2(xf + 3)}" y="${r2(yc - 15)}" width="${r2(w)}" height="29" fill="${C.etichettaFondo}" fill-opacity="0.88"/>`
            + `<text x="${r2(xf + 6)}" y="${r2(yc - 3)}" font-size="10.5" font-weight="bold" fill="${C.testo}">${nome}<tspan font-size="8" dy="2">${r.n}</tspan></text>`
            + testo(xf + 6, yc + 10, riga2, { size: 10.5, colore });
        };
        dentro += valore(xSV, (yS + yP) / 2, 'SV', r.sv);
        dentro += valore(xCV, (yA + yP) / 2, 'CV', r.cv);
      }
      if (mostra.bcws) dentro += riquadro(x, yS, `BCWS al ${ut.singolare} ${r.t}: ${fN(r.bcws)}`);
      if (mostra.bcwp) dentro += riquadro(x, yP, `BCWP al ${ut.singolare} ${r.t}: ${fN(r.bcwp)}`);
      if (mostra.acwp) dentro += riquadro(x, yA, `ACWP al ${ut.singolare} ${r.t}: ${fN(r.acwp)}`);
      if (mostra.etichette) {
        const [eA, eS, eP] = r.etichette;
        if (mostra.acwp) dentro += testo(x - 9, Y(eA) + 4, 'ACWP', { size: 10.5, bold: true, anchor: 'end' });
        if (mostra.bcws) dentro += testo(x - 9, Y(eS) + 4, 'BCWS', { size: 10.5, bold: true, anchor: 'end' });
        if (mostra.bcwp) dentro += testo(x - 9, Y(eP) + 4, 'BCWP', { size: 10.5, bold: true, anchor: 'end' });
      }
    });

    // --- Note sul grafico: numero cerchiato appoggiato all'asse dei tempi ---
    for (const nt of m.note || []) {
      if (!dentroX(nt.periodo)) continue;
      const xn = X(nt.periodo);
      dentro += linea(xn, T + PH, xn, T + PH - 26, C.tenue, 0.9, '2 2');
      dentro += `<circle cx="${r2(xn)}" cy="${r2(T + PH - 34)}" r="8" fill="${C.fondo}" stroke="${C.testo}" stroke-width="1.2"><title>${esc(nt.testo)}</title></circle>`;
      dentro += testo(xn, T + PH - 30.5, String(nt.n), { size: 10, bold: true, anchor: 'middle' });
    }

    // --- Previsione: EAC e date di fine ---------------------------------
    let fondo = T + PH + 30;
    if (prev) {
      const p = m.previsione, xe = X(p.durataPrevista), ye = Y(p.eac);
      dentro += riquadro(xe, ye, `EAC (costo finale stimato): ${fN(p.eac)}`);
      if (mostra.etichette) dentro += `<text x="${r2(xe + 10)}" y="${r2(ye + 4)}" font-size="11" fill="${C.testo}"><tspan font-weight="bold">EAC</tspan> ${esc(numeri.formatBreve(p.eac))}</text>`;
      const marcatore = (xm, colore, riga1, riga2, anchor) =>
        linea(xm, T + PH + 52, xm, T + PH + 32, colore, 1.6) + punta(xm, T + PH + 25, -Math.PI / 2, colore, 8, 7)
        + testo(xm, T + PH + 66, riga1, { size: 10.5, bold: true, anchor, colore })
        + testo(xm, T + PH + 79, riga2, { size: 10.5, bold: true, anchor, colore });
      let ancP = 'middle', ancS = 'middle';
      if (Math.abs(p.durataPrevista - m.durata) / (xmax - xmin) < 0.12) {
        if (p.durataPrevista < m.durata) { ancP = 'start'; ancS = 'end'; } else { ancP = 'end'; ancS = 'start'; }
      }
      if (dentroX(m.durata)) fuori += marcatore(X(m.durata), C.bcws, 'Fine', 'pianificata', ancP);
      if (dentroX(p.durataPrevista)) fuori += marcatore(xe, C.acwp, 'Fine', p.modo === 'manuale' ? 'prevista' : 'stimata', ancS);
      fondo = T + PH + 92;
    }

    // --- Legenda sotto il grafico, 2 colonne (come il .tex) --------------
    const voci = [];
    if (mostra.bcws) voci.push({ colore: C.bcws, tratto: TRATTI.bcws, testo: 'Pianificato a budget (BCWS)' });
    if (mostra.bcwp) voci.push({ colore: C.bcwp, tratto: TRATTI.bcwp, testo: 'Lavoro svolto a costi di budget (BCWP)' });
    if (mostra.acwp) voci.push({ colore: C.acwp, tratto: TRATTI.acwp, testo: 'Costo effettivamente sostenuto (ACWP)' });
    if (prev) voci.push({ colore: C.acwp, tratto: TRATTI.prev, testo: 'Previsione dei costi fino a EAC' });
    if (mostra.frecce) {
      voci.push({ sigla: 'CV', testo: '= BCWP − ACWP (scostamento costi)' });
      voci.push({ sigla: 'SV', testo: '= BCWP − BCWS (scostamento tempi)' });
    }
    if (prev) voci.push({ sigla: 'EAC', testo: '= costo finale stimato' });
    if (m.assi.assePezzato) voci.push({ sigla: '≈', testo: `asse dei costi da ${fN(ymin, dec)} (non da zero)` });
    const righe = Math.ceil(voci.length / 2), colW = Math.max(320, PW / 2), ly = fondo + 8;
    fuori += `<rect x="${L}" y="${ly}" width="${r2(Math.min(colW * 2, PW + 20))}" height="${righe * 21 + 14}" fill="none" stroke="${C.griglia}" stroke-width="1" rx="4"/>`;
    voci.forEach((v, k) => {
      const cx = L + 12 + (k % 2) * colW, cy = ly + 21 + Math.floor(k / 2) * 21;
      if (v.tratto) {
        fuori += `<line x1="${cx}" y1="${cy - 4}" x2="${cx + 34}" y2="${cy - 4}" stroke="${v.colore}" stroke-width="${v.tratto.w}"${v.tratto.dash ? ` stroke-dasharray="${v.tratto.dash}"` : ''}/>`;
        fuori += testo(cx + 44, cy, v.testo, { size: 11.5 });
      } else {
        fuori += `<text x="${cx + 44}" y="${cy}" font-size="11.5" fill="${C.testo}"><tspan font-weight="bold">${esc(v.sigla)}</tspan> ${esc(v.testo)}</text>`;
      }
    });
    let H = ly + righe * 21 + 14 + 6;
    // elenco delle note sotto la legenda
    (m.note || []).forEach((nt, k) => {
      const yy = H + 10 + k * 18;
      const t = `${ut.singolare} ${numeri.formatNumero(nt.periodo, 'auto')}: ${nt.testo}`;
      fuori += `<circle cx="${L + 20}" cy="${yy - 4}" r="7" fill="none" stroke="${C.testo}" stroke-width="1.1"/>` + testo(L + 20, yy - 0.5, String(nt.n), { size: 9.5, bold: true, anchor: 'middle' });
      fuori += testo(L + 34, yy, t.length > 110 ? t.slice(0, 109) + '…' : t, { size: 11.5 });
    });
    if ((m.note || []).length) H += 10 + m.note.length * 18;

    const descrizione = m.rilevamenti.map(r => `Rilevamento ${r.n} al ${ut.singolare} ${r.t}: BCWS ${fN(r.bcws)}, BCWP ${fN(r.bcwp)}, ACWP ${fN(r.acwp)}, CV ${fN(r.cv)}, SV ${fN(r.sv)}.`).join(' ');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${r2(H)}" width="${W}" height="${r2(H)}" font-family="${FONT}" role="img" aria-labelledby="${id}-t ${id}-d" data-l="${L}" data-t="${T}" data-pw="${PW}" data-ph="${PH}">`
      + `<title id="${id}-t">Diagramma costi-tempi: ${esc(m.titolo)}</title><desc id="${id}-d">${esc(descrizione)}</desc>`
      + `<defs><clipPath id="${id}-area"><rect x="${L}" y="${T - 40}" width="${PW + 84}" height="${PH + 40}"/></clipPath>`
      + `<clipPath id="${id}-curve"><rect x="${L}" y="${T}" width="${PW + 1}" height="${PH}"/></clipPath></defs>`
      + `<rect width="${W}" height="${r2(H)}" fill="${C.fondo}"/>`
      + fuori + `<g clip-path="url(#${id}-curve)">${curve}</g><g clip-path="url(#${id}-area)">${dentro}</g></svg>`;
  }

  // =====================================================================
  // GRAFICO PER LO SCHERMO
  // ---------------------------------------------------------------------
  // Disegnato sulla misura VERA del riquadro (pixel), non rimpicciolito:
  // le scritte restano leggibili, le tacche si diradano sugli schermi
  // stretti, i cartellini di CV e SV si spostano per non sovrapporsi.
  // Titolo e legenda stanno fuori (in HTML): più spazio alle curve.
  // Usa le stesse curve, la stessa vista e gli stessi colori dell'export.
  // =====================================================================
  function disegnaSchermo(m, opz = {}) {
    const C = TEMI[opz.tema === 'scuro' ? 'scuro' : 'chiaro'];
    const W = Math.max(280, Math.round(opz.larghezza || 900));
    const H = Math.max(220, Math.round(opz.altezza || W / 1.7));
    const compatto = W < 600;
    const fs = compatto ? 11 : 12;
    const { xmin, xmax, ymin, ymax } = m.assi;
    const mostra = m.mostra;
    const prev = m.previsione.visibile;
    const ut = m.unitaTempo;
    const ev = opz.evidenzia || null;      // presentazione: una parte in primo piano
    const opac = parte => (!ev || ev === parte ? 1 : 0.16);
    const id = 'cs' + Math.random().toString(36).slice(2, 8);
    const larg = (t, f = fs, b) => String(t).length * f * (b ? 0.6 : 0.56);

    // margini e tacche calcolati sullo spazio disponibile
    const T = 24;
    const sotto = 24 + (prev ? 30 : 0) + 4;
    const PH = H - T - sotto;
    const nY = Math.max(3, Math.min(9, Math.round(PH / 58)));
    const ystep = passoBello((ymax - ymin) / nY);
    const dec = decimaliDi(ystep);
    const tY = [];
    for (let k = Math.ceil(ymin / ystep - 1e-9); k * ystep <= ymax + 1e-9 * Math.abs(ymax); k++) tY.push(k * ystep);
    const L = Math.max(...tY.map(v => larg(fN(v, dec)))) + 16;
    const R = compatto ? 12 : 18;
    const PW = W - L - R;
    const conDate = Boolean(m.inizio);
    const nX = Math.max(2, Math.floor(PW / (conDate ? (compatto ? 62 : 70) : (compatto ? 46 : 64))));
    const xstep = passoInteroPer((xmax - xmin) / nX);
    const X = x => L + (x - xmin) / (xmax - xmin) * PW;
    const Y = y => T + PH - (y - ymin) / (ymax - ymin) * PH;
    const dentroX = x => x >= xmin - 1e-9 && x <= xmax + 1e-9;

    const testo = (x, y, contenuto, o = {}) => {
      const a = [`x="${r2(x)}"`, `y="${r2(y)}"`, `font-size="${o.size || fs}"`, `fill="${o.colore || C.testo}"`];
      if (o.anchor) a.push(`text-anchor="${o.anchor}"`);
      if (o.bold) a.push('font-weight="600"');
      if (o.op !== undefined && o.op < 1) a.push(`opacity="${o.op}"`);
      return `<text ${a.join(' ')}>${esc(contenuto)}</text>`;
    };
    const linea = (x1, y1, x2, y2, colore, w, dash, op) =>
      `<line x1="${r2(x1)}" y1="${r2(y1)}" x2="${r2(x2)}" y2="${r2(y2)}" stroke="${colore}" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ''}${op !== undefined && op < 1 ? ` opacity="${op}"` : ''}/>`;
    const punta = (x, y, su, colore, op) => {
      const d = su ? -1 : 1;
      return `<polygon points="${r2(x)},${r2(y)} ${r2(x - 4)},${r2(y - 7 * d)} ${r2(x + 4)},${r2(y - 7 * d)}" fill="${colore}"${op < 1 ? ` opacity="${op}"` : ''}/>`;
    };

    let s = '';
    // griglia e tacche
    for (const v of tY) {
      const y = Y(v);
      if (v > ymin + 1e-9) s += linea(L, y, L + PW, y, C.griglia, 1);
      s += testo(L - 8, y + 4, fN(v, dec), { anchor: 'end', colore: C.tenue });
    }
    for (let k = Math.ceil(xmin / xstep - 1e-9); k * xstep <= xmax + 1e-9; k++) {
      const x = X(k * xstep);
      s += linea(x, T + PH, x, T + PH + 4, C.asse, 1);
      s += testo(x, T + PH + 17, m.etichettaTempo(k * xstep), { anchor: 'middle', colore: C.tenue });
    }
    s += linea(L, T + PH, L + PW, T + PH, C.asse, 1.2) + linea(L, T + PH, L, T - 4, C.asse, 1.2);
    s += testo(L, T - 10, m.unitaMoneta.asse, { colore: C.tenue, bold: true, size: fs - 0.5 });
    if (m.assi.assePezzato) {
      const yb = T + PH - 12;
      s += `<rect x="${L - 6}" y="${yb - 5}" width="12" height="9" fill="${C.fondo}"/>` + linea(L - 6, yb + 1, L + 6, yb - 4, C.asse, 1.2) + linea(L - 6, yb + 5, L + 6, yb, C.asse, 1.2);
    }

    // curve
    const percorso = tratti => tratti.length
      ? `M${r2(X(tratti[0].x0))} ${r2(Y(tratti[0].y0))}` + tratti.map(t => ` C${r2(X(t.c1x))} ${r2(Y(t.c1y))} ${r2(X(t.c2x))} ${r2(Y(t.c2y))} ${r2(X(t.x1))} ${r2(Y(t.y1))}`).join('')
      : '';
    const spessore = compatto ? 2.4 : 2.6;
    const curva = (tratti, colore, tratto, parte) =>
      `<path d="${percorso(tratti)}" fill="none" stroke="${colore}" stroke-width="${ev === parte ? spessore + 1.2 : spessore}" stroke-linecap="round" stroke-linejoin="round"${tratto.dash ? ` stroke-dasharray="${tratto.dash}"` : ''} opacity="${opac(parte)}"/>`;
    let curve = '';
    if (mostra.bcws) curve += curva(m.curve.bcws, C.bcws, TRATTI.bcws, 'bcws');
    if (mostra.bcwp) curve += curva(m.curve.bcwp, C.bcwp, TRATTI.bcwp, 'bcwp');
    if (mostra.acwp) curve += curva(m.curve.acwp, C.acwp, TRATTI.acwp, 'acwp');
    if (prev) curve += curva([m.curve.previsione], C.acwp, TRATTI.prev, 'previsione');

    // rilevamenti: linee, frecce e cartellini che non si sovrappongono
    let dentro = '';
    const occupati = [];
    const libero = (x, y, w, h) => {
      let yy = Math.max(T + 2, Math.min(y, T + PH - h - 2));
      for (let giro = 0; giro < 20; giro++) {
        const urto = occupati.find(o => x < o.x + o.w + 3 && x + w + 3 > o.x && yy < o.y + o.h + 3 && yy + h + 3 > o.y);
        if (!urto) break;
        yy = urto.y + urto.h + 4;
        if (yy + h > T + PH) { yy = Math.max(T + 2, urto.y - h - 4); }
      }
      occupati.push({ x, y: yy, w, h });
      return yy;
    };
    const gap = 15 / PH * (ymax - ymin);
    m.rilevamenti.forEach(r => {
      if (!dentroX(r.t)) return;
      const x = X(r.t), yS = Y(r.bcws), yP = Y(r.bcwp), yA = Y(r.acwp);
      dentro += linea(x, T + PH, x, T + 14, C.testo, 1, '4 3', ev ? 0.5 : 1);
      const titolo = compatto ? `Ril. ${r.n}` : `Rilevamento ${r.n} · ${ut.singolare} ${r.t}`;
      const wt = larg(titolo, fs - 0.5, true) + 12;
      // se tocca l'etichetta del rilevamento precedente, scende di una riga
      let yp = T - 2;
      if (occupati.some(o => o.pill && x - wt / 2 < o.x + o.w + 4 && x + wt / 2 + 4 > o.x && o.y === yp)) yp = T + 18;
      dentro += `<rect x="${r2(x - wt / 2)}" y="${yp}" width="${r2(wt)}" height="17" rx="8.5" fill="${C.fondo}" stroke="${C.griglia}"/>`;
      dentro += testo(x, yp + 12, titolo, { anchor: 'middle', bold: true, size: fs - 0.5 });
      occupati.push({ x: x - wt / 2, y: yp, w: wt, h: 17, pill: true });
      const xSV = x + 13;
      const etSV = compatto ? `SV${r.n}` : `SV${r.n} ${numeri.formatBreve(r.sv, true)}`;
      const etCV = compatto ? `CV${r.n}` : `CV${r.n} ${numeri.formatBreve(r.cv, true)}`;
      const wSV = larg(etSV, fs - 0.5, true) + 12, wCV = larg(etCV, fs - 0.5, true) + 12;
      const xCV = xSV + wSV + 14;
      if (mostra.frecce) {
        const opSV = opac('sv'), opCV = opac('cv');
        dentro += linea(x, yS, xSV, yS, C.guida, 1, '3 3', opSV) + linea(x, yP, xCV, yP, C.guida, 1, '3 3', Math.max(opSV, opCV)) + linea(x, yA, xCV, yA, C.guida, 1, '3 3', opCV);
        const freccia = (xf, ya, yb, op) => {
          if (Math.abs(ya - yb) < 5) return '';
          const su = Math.min(ya, yb), giu = Math.max(ya, yb);
          return linea(xf, su + 6, xf, giu - 6, C.testo, ev ? 2 : 1.4, '', op) + punta(xf, su, true, C.testo, op) + punta(xf, giu, false, C.testo, op);
        };
        dentro += freccia(xSV, yS, yP, opSV) + freccia(xCV, yA, yP, opCV);
        const cartellino = (xf, yc, testoC, v, w, op) => {
          const yy = libero(xf + 4, yc - 10, w, 20);
          const col = v < 0 ? C.negativo : v > 0 ? C.positivo : C.testo;
          return `<g opacity="${op}"><rect x="${r2(xf + 4)}" y="${r2(yy)}" width="${r2(w)}" height="20" rx="5" fill="${C.etichettaFondo}" stroke="${col}" stroke-width="1"/>`
            + testo(xf + 10, yy + 14, testoC, { bold: true, size: fs - 0.5, colore: col }) + '</g>';
        };
        dentro += cartellino(xSV, (yS + yP) / 2, etSV, r.sv, wSV, opSV);
        dentro += cartellino(xCV, (yA + yP) / 2, etCV, r.cv, wCV, opCV);
      }
      const quadro = (y, parte) => (mostra[parte] ? `<rect x="${r2(x - 4.5)}" y="${r2(y - 4.5)}" width="9" height="9" rx="2" fill="${C[parte]}" stroke="${C.fondo}" stroke-width="1.5" opacity="${opac(parte)}"/>` : '');
      dentro += quadro(yS, 'bcws') + quadro(yP, 'bcwp') + quadro(yA, 'acwp');
      if (mostra.etichette && !compatto) {
        const pos = posizioniEtichette([r.acwp, r.bcws, r.bcwp], gap);
        [['acwp', 'ACWP', pos[0]], ['bcws', 'BCWS', pos[1]], ['bcwp', 'BCWP', pos[2]]].forEach(([parte, nome, v]) => {
          if (mostra[parte]) dentro += testo(x - 8, Y(v) + 4, nome, { anchor: 'end', bold: true, size: fs - 1, colore: C[parte], op: opac(parte) });
        });
      }
    });

    // previsione: EAC e date di fine
    if (prev) {
      const p = m.previsione, xe = X(p.durataPrevista), ye = Y(p.eac), op = opac('previsione');
      dentro += `<rect x="${r2(xe - 4.5)}" y="${r2(ye - 4.5)}" width="9" height="9" rx="2" fill="${C.acwp}" stroke="${C.fondo}" stroke-width="1.5" opacity="${op}"/>`;
      if (mostra.etichette) {
        const t = `EAC ${numeri.formatBreve(p.eac)}`;
        const wE = larg(t, fs - 0.5, true);
        const destra = xe + wE + 14 < L + PW + R;
        const xb = destra ? xe + 9 : xe - 9 - wE;
        const yb = libero(xb, ye + (destra ? -8 : -21), wE, 16);   // non si sovrappone a etichette e cartellini
        dentro += testo(destra ? xe + 9 : xe - 9, yb + 12, t, { anchor: destra ? 'start' : 'end', bold: true, size: fs - 0.5, op });
      }
      // le due scritte non escono dal riquadro e, se si toccano, la seconda va una riga sotto
      const scritte = [];
      const fine = (xm, colore, t, anc) => {
        const w = larg(t, fs - 1, true);
        if (anc === 'middle' && xm + w / 2 > W - 2) anc = 'end';
        if (anc === 'middle' && xm - w / 2 < 2) anc = 'start';
        if (anc === 'start' && xm + 4 + w > W - 2) anc = 'end';
        const x0 = anc === 'end' ? xm - 4 - w : anc === 'start' ? xm + 4 : xm - w / 2;
        const sotto2 = scritte.some(o => x0 < o.x + o.w + 6 && x0 + w + 6 > o.x);
        scritte.push({ x: x0, w });
        const yy = T + PH + 36 + (sotto2 ? 14 : 0);
        return linea(xm, T + PH, xm, yy - 13, colore, 1.6) + testo(xm + (anc === 'end' ? -4 : anc === 'start' ? 4 : 0), yy, t, { anchor: anc, bold: true, size: fs - 1, colore });
      };
      let aP = 'middle', aS = 'middle';
      if (Math.abs(X(p.durataPrevista) - X(m.durata)) < 90) { if (p.durataPrevista < m.durata) { aP = 'start'; aS = 'end'; } else { aP = 'end'; aS = 'start'; } }
      if (dentroX(m.durata)) s += fine(X(m.durata), C.bcws, compatto ? 'fine pian.' : 'fine pianificata', aP);
      if (dentroX(p.durataPrevista)) s += fine(xe, C.acwp, compatto ? (p.modo === 'manuale' ? 'fine prev.' : 'fine stim.') : (p.modo === 'manuale' ? 'fine prevista' : 'fine stimata'), aS);
    }

    // note: numero cerchiato appoggiato all'asse dei tempi
    for (const nt of m.note || []) {
      if (!dentroX(nt.periodo)) continue;
      const xn = X(nt.periodo);
      dentro += linea(xn, T + PH, xn, T + PH - 22, C.tenue, 1, '2 2');
      dentro += `<g class="nota" data-nota="${nt.n}"><circle cx="${r2(xn)}" cy="${r2(T + PH - 31)}" r="9" fill="${C.fondo}" stroke="${C.testo}" stroke-width="1.3"/>`
        + testo(xn, T + PH - 27, String(nt.n), { anchor: 'middle', bold: true, size: 10.5 }) + `<title>${esc(nt.testo)}</title></g>`;
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="${FONT}" role="img" aria-label="${esc('Diagramma costi-tempi: ' + m.titolo)}" data-l="${r2(L)}" data-t="${T}" data-pw="${r2(PW)}" data-ph="${r2(PH)}" data-compatto="${compatto ? 1 : 0}">`
      + `<defs><clipPath id="${id}-c"><rect x="${r2(L)}" y="${T}" width="${r2(PW + 1)}" height="${r2(PH)}"/></clipPath>`
      + `<clipPath id="${id}-d"><rect x="${r2(L)}" y="${T - 4}" width="${r2(PW + R)}" height="${r2(PH + 4)}"/></clipPath></defs>`
      + s + `<g clip-path="url(#${id}-c)">${curve}</g><g clip-path="url(#${id}-d)">${dentro}</g></svg>`;
  }

  /**
   * Navigatore dello zoom: tutto il progetto in miniatura con il riquadro
   * della parte che si sta guardando. Allineato al grafico (stessi L e PW).
   */
  function disegnaNavigatore(m, opz = {}) {
    const C = TEMI[opz.tema === 'scuro' ? 'scuro' : 'chiaro'];
    const W = Math.round(opz.larghezza || 900), H = opz.altezza || 46;
    const L = opz.L || 40, PW = opz.PW || W - 60;
    const p = m.assi.pieno, a = m.assi;
    const X = x => L + (x - p.xmin) / (p.xmax - p.xmin) * PW;
    const Y = y => H - 5 - (y - p.ymin) / (p.ymax - p.ymin) * (H - 10);
    const percorso = tratti => tratti.length ? `M${r2(X(tratti[0].x0))} ${r2(Y(tratti[0].y0))}` + tratti.map(t => ` C${r2(X(t.c1x))} ${r2(Y(t.c1y))} ${r2(X(t.c2x))} ${r2(Y(t.c2y))} ${r2(X(t.x1))} ${r2(Y(t.y1))}`).join('') : '';
    let s = `<rect x="${L}" y="1" width="${r2(PW)}" height="${H - 2}" rx="6" fill="${C.fondo}" stroke="${C.griglia}"/>`;
    const curva = (t, col) => `<path d="${percorso(t)}" fill="none" stroke="${col}" stroke-width="1.4" opacity="0.85"/>`;
    if (m.mostra.bcws) s += curva(m.curve.bcws, C.bcws);
    if (m.mostra.bcwp) s += curva(m.curve.bcwp, C.bcwp);
    if (m.mostra.acwp) s += curva(m.curve.acwp, C.acwp);
    if (m.previsione.visibile) s += curva([m.curve.previsione], C.acwp);
    const x0 = X(Math.max(p.xmin, a.xmin)), x1 = X(Math.min(p.xmax, a.xmax));
    s += `<path d="M${L} 1 H${r2(x0)} V${H - 1} H${L} Z M${r2(x1)} 1 H${r2(L + PW)} V${H - 1} H${r2(x1)} Z" fill="${C.testo}" opacity="0.08"/>`;
    s += `<rect class="finestra-zoom" x="${r2(x0)}" y="1" width="${r2(Math.max(6, x1 - x0))}" height="${H - 2}" rx="5" fill="${C.riquadro}" fill-opacity="0.12" stroke="${C.bordoRiquadro}" stroke-width="1.5"/>`;
    for (const xm of [x0, x1]) s += `<rect x="${r2(xm - 3)}" y="${H / 2 - 9}" width="6" height="18" rx="3" fill="${C.bordoRiquadro}"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" data-l="${L}" data-pw="${r2(PW)}" role="img" aria-label="Navigatore: tutto il progetto, con la parte ingrandita evidenziata">${s}</svg>`;
  }

  // piccoli aiuti per le tacche dello schermo
  function passoBello(v) {
    if (!(v > 0)) return 1;
    const e = Math.floor(Math.log10(v)), p = Math.pow(10, e), fr = v / p;
    return (fr <= 1 ? 1 : fr <= 2 ? 2 : fr <= 2.5 ? 2.5 : fr <= 5 ? 5 : 10) * p;
  }
  function passoInteroPer(v) {
    for (const b of [1, 10, 100, 1000]) for (const k of [1, 2, 5]) if (k * b >= v - 1e-9) return k * b;
    return 10000;
  }
  function decimaliDi(passo) {
    for (let d = 0; d <= 6; d++) if (Math.abs(Math.round(passo * Math.pow(10, d)) / Math.pow(10, d) - passo) <= 1e-9 * Math.max(1, passo)) return d;
    return 6;
  }
  function posizioniEtichette(valori, gap) {
    const rango = valori.map((v, i) => valori.filter((w, j) => w < v || (w === v && j < i)).length);
    const ord = []; valori.forEach((v, i) => { ord[rango[i]] = v; });
    const y = [ord[0]];
    for (let k = 1; k < ord.length; k++) y.push(Math.max(ord[k], y[k - 1] + gap));
    return rango.map(r => y[r]);
  }

  /** Riquadro mostrato al posto del grafico quando i dati sono incompleti. */
  function segnaposto(messaggio, tema) {
    const C = TEMI[tema === 'scuro' ? 'scuro' : 'chiaro'];
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 520" font-family="${FONT}" role="img" aria-label="Diagramma non ancora disponibile">`
      + `<rect width="960" height="520" fill="${C.fondo}"/>`
      + `<path d="M120 420 C 300 418, 400 260, 540 200 S 760 120, 820 110" fill="none" stroke="${C.griglia}" stroke-width="3" stroke-dasharray="8 6"/>`
      + `<line x1="92" y1="440" x2="860" y2="440" stroke="${C.griglia}" stroke-width="1.5"/><line x1="92" y1="440" x2="92" y2="70" stroke="${C.griglia}" stroke-width="1.5"/>`
      + `<text x="480" y="250" font-size="20" font-weight="bold" text-anchor="middle" fill="${C.tenue}">${esc('Il diagramma comparirà qui')}</text>`
      + `<text x="480" y="282" font-size="14" text-anchor="middle" fill="${C.tenue}">${esc(messaggio)}</text></svg>`;
  }

  const api = { disegna, disegnaSchermo, disegnaNavigatore, segnaposto, geometria, TEMI, TRATTI };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { radice.CC = radice.CC || {}; radice.CC.grafico = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this);
