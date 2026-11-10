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
    const H = ly + righe * 21 + 14 + 6;

    const descrizione = m.rilevamenti.map(r => `Rilevamento ${r.n} al ${ut.singolare} ${r.t}: BCWS ${fN(r.bcws)}, BCWP ${fN(r.bcwp)}, ACWP ${fN(r.acwp)}, CV ${fN(r.cv)}, SV ${fN(r.sv)}.`).join(' ');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${r2(H)}" width="${W}" height="${r2(H)}" font-family="${FONT}" role="img" aria-labelledby="${id}-t ${id}-d" data-l="${L}" data-t="${T}" data-pw="${PW}" data-ph="${PH}">`
      + `<title id="${id}-t">Diagramma costi-tempi: ${esc(m.titolo)}</title><desc id="${id}-d">${esc(descrizione)}</desc>`
      + `<defs><clipPath id="${id}-area"><rect x="${L}" y="${T - 40}" width="${PW + 84}" height="${PH + 40}"/></clipPath>`
      + `<clipPath id="${id}-curve"><rect x="${L}" y="${T}" width="${PW + 1}" height="${PH}"/></clipPath></defs>`
      + `<rect width="${W}" height="${r2(H)}" fill="${C.fondo}"/>`
      + fuori + `<g clip-path="url(#${id}-curve)">${curve}</g><g clip-path="url(#${id}-area)">${dentro}</g></svg>`;
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

  const api = { disegna, segnaposto, geometria, TEMI, TRATTI };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { radice.CC = radice.CC || {}; radice.CC.grafico = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this);
