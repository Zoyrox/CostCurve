/* =====================================================================
 * grafico.js — disegno del diagramma costi-tempi in SVG
 * ---------------------------------------------------------------------
 * Legge SOLO il modello calcolato da calcoli.js (curve, assi, frecce,
 * etichette) e lo trasforma in un'immagine SVG vettoriale. Ogni elemento
 * corrisponde a uno del file .tex: stesse curve di Bézier, stessi assi,
 * stessi colori e tratti, stesse posizioni di frecce ed etichette.
 * Restituisce una stringa: funziona sia nel browser sia in Node.
 * ===================================================================== */
(function (radice) {
  'use strict';

  const numeri = (typeof module !== 'undefined' && module.exports)
    ? require('./numeri.js') : radice.CC.numeri;
  const fN = numeri.formatNumero;

  // ---- Stile (gli stessi valori di colore/tratto del file .tex) ---------
  const COLORI = {
    bcws: '#0072B2', bcwp: '#009E73', acwp: '#D55E00',
    inchiostro: '#1B2A3A', riquadro: '#56B4E9', griglia: '#E6E1D6',
    negativo: '#B34700', positivo: '#00775A', titolo: '#D55E00',
  };
  const TRATTI = {
    bcws: { w: 2.2, dash: '' },
    bcwp: { w: 2.2, dash: '9 4.5' },
    acwp: { w: 2.2, dash: '10 3.5 2 3.5' },
    prev: { w: 2, dash: '2 3.6' },
  };
  const FONT = "Helvetica, Arial, 'Liberation Sans', sans-serif";

  // ---- Geometria della figura (in unità SVG) ---------------------------
  const W = 900;                 // larghezza totale
  const L = 92, R = 128;         // margini: etichette asse y / etichetta asse x
  const T = 84, PH = 400;        // margine alto (titolo) e altezza area dati
  const PW = W - L - R;          // larghezza area dati

  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const r2 = v => Math.round(v * 100) / 100;
  const larghezzaTesto = (testo, size, grassetto) => String(testo).length * size * (grassetto ? 0.6 : 0.55);

  function testo(x, y, contenuto, o = {}) {
    const a = [`x="${r2(x)}"`, `y="${r2(y)}"`, `font-size="${o.size || 12}"`, `fill="${o.colore || COLORI.inchiostro}"`];
    if (o.anchor) a.push(`text-anchor="${o.anchor}"`);
    if (o.bold) a.push('font-weight="bold"');
    if (o.italic) a.push('font-style="italic"');
    return `<text ${a.join(' ')}>${esc(contenuto)}</text>`;
  }

  function linea(x1, y1, x2, y2, colore, w, dash) {
    return `<line x1="${r2(x1)}" y1="${r2(y1)}" x2="${r2(x2)}" y2="${r2(y2)}" stroke="${colore}" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
  }

  /** Punta di freccia (triangolo pieno) in (x,y) orientata secondo l'angolo. */
  function punta(x, y, angolo, colore, lung = 9, larg = 6) {
    const c = Math.cos(angolo), s = Math.sin(angolo);
    const bx = x - c * lung, by = y - s * lung;
    const p = [[x, y], [bx - s * larg / 2, by + c * larg / 2], [bx + s * larg / 2, by - c * larg / 2]];
    return `<polygon points="${p.map(q => q.map(r2).join(',')).join(' ')}" fill="${colore}"/>`;
  }

  /** Riquadro azzurro tratteggiato sui punti (come nel libro). */
  function riquadro(x, y, suggerimento) {
    return `<rect x="${r2(x - 5.5)}" y="${r2(y - 5.5)}" width="11" height="11" fill="${COLORI.riquadro}" fill-opacity="0.45" stroke="${COLORI.bcws}" stroke-width="1" stroke-dasharray="1.6 1.4"><title>${esc(suggerimento)}</title></rect>`;
  }

  /**
   * Disegna il diagramma completo dal modello.
   * Restituisce la stringa SVG (con titolo e descrizione accessibili).
   */
  function disegna(m) {
    const { xmax, ymax, xstep, ystep } = m.assi;
    const X = x => L + x / xmax * PW;
    const Y = y => T + PH - y / ymax * PH;
    const prev = m.previsione.visibile;
    const ut = m.unitaTempo;
    let s = '';

    // --- Titolo del grafico (riquadro rosso come nel libro) --------------
    const tit = 'Analisi dell\'avanzamento per periodo';
    const tw = larghezzaTesto(tit, 15, true) + 24;
    s += `<rect x="${r2(L + PW / 2 - tw / 2)}" y="14" width="${r2(tw)}" height="28" rx="4" fill="#fff" stroke="${COLORI.titolo}" stroke-width="1.2"/>`;
    s += testo(L + PW / 2, 33, tit, { size: 15, bold: true, anchor: 'middle', colore: COLORI.titolo });

    // --- Griglia, tacche ed etichette degli assi ------------------------
    for (let k = 0; k * ystep <= ymax + 1e-9 * ymax; k++) {
      const v = k * ystep, y = Y(v);
      if (k > 0) s += linea(L, y, L + PW, y, COLORI.griglia, 0.8);
      s += linea(L - 4, y, L, y, COLORI.inchiostro, 1);
      s += testo(L - 8, y + 4, fN(v), { size: 11, anchor: 'end' });
    }
    for (let k = 0; k * xstep <= xmax + 1e-9; k++) {
      const x = X(k * xstep);
      s += linea(x, T + PH, x, T + PH + 4, COLORI.inchiostro, 1);
      s += testo(x, T + PH + 18, fN(k * xstep), { size: 11, anchor: 'middle' });
    }
    // assi con freccia
    s += linea(L, T + PH, L + PW + 10, T + PH, COLORI.inchiostro, 1.4) + punta(L + PW + 16, T + PH, 0, COLORI.inchiostro);
    s += linea(L, T + PH, L, T - 12, COLORI.inchiostro, 1.4) + punta(L, T - 18, -Math.PI / 2, COLORI.inchiostro);
    s += testo(L + 8, T - 18, m.unitaMoneta.asse, { size: 13, colore: COLORI.titolo });
    s += testo(L + PW + 24, T + PH + 4, `Tempo (${ut.plurale})`, { size: 13, colore: COLORI.titolo });

    // --- Curve (stesse Bézier del file .tex) ---------------------------
    const percorso = tratti => tratti.length
      ? `M${r2(X(tratti[0].x0))} ${r2(Y(tratti[0].y0))}` + tratti.map(t => ` C${r2(X(t.c1x))} ${r2(Y(t.c1y))} ${r2(X(t.c2x))} ${r2(Y(t.c2y))} ${r2(X(t.x1))} ${r2(Y(t.y1))}`).join('')
      : '';
    const curva = (tratti, colore, tratto, nome) =>
      `<path d="${percorso(tratti)}" fill="none" stroke="${colore}" stroke-width="${tratto.w}" stroke-linecap="round"${tratto.dash ? ` stroke-dasharray="${tratto.dash}"` : ''}><title>${esc(nome)}</title></path>`;
    s += curva(m.curve.bcws, COLORI.bcws, TRATTI.bcws, 'Pianificato a budget (BCWS)');
    s += curva(m.curve.bcwp, COLORI.bcwp, TRATTI.bcwp, 'Lavoro svolto a costi di budget (BCWP)');
    s += curva(m.curve.acwp, COLORI.acwp, TRATTI.acwp, 'Costo effettivamente sostenuto (ACWP)');
    if (prev) s += curva([m.curve.previsione], COLORI.acwp, TRATTI.prev, 'Previsione dei costi fino a EAC (assunzione)');

    // --- Rilevamenti ---------------------------------------------------
    m.rilevamenti.forEach((r, i) => {
      const x = X(r.t), xSV = X(r.t + m.frecce.offSV), xCV = X(r.t + m.frecce.offCV);
      const yS = Y(r.bcws), yP = Y(r.bcwp), yA = Y(r.acwp);
      const yTop = Y(ymax * m.frecce.altEtichetta[i]);
      s += linea(x, T + PH, x, yTop, COLORI.inchiostro, 1, '4 3');
      s += testo(x, yTop - 17, `Rilevamento ${r.n}`, { size: 11, bold: true, anchor: 'middle' });
      s += testo(x, yTop - 4, `${ut.singolare} ${r.t}`, { size: 10.5, anchor: 'middle' });
      // linee guida orizzontali dai punti alle frecce
      s += linea(x, yS, xSV, yS, '#55606E', 0.8, '4 3');
      s += linea(x, yP, xCV, yP, '#55606E', 0.8, '4 3');
      s += linea(x, yA, xCV, yA, '#55606E', 0.8, '4 3');
      // frecce doppie SV e CV (solo se la differenza è visibile)
      const freccia = (xf, ya, yb) => {
        if (Math.abs(ya - yb) / PH <= 0.004) return '';
        const su = Math.min(ya, yb), giu = Math.max(ya, yb);
        return linea(xf, su + 6, xf, giu - 6, COLORI.inchiostro, 1.3) + punta(xf, su, -Math.PI / 2, COLORI.inchiostro, 7, 6) + punta(xf, giu, Math.PI / 2, COLORI.inchiostro, 7, 6);
      };
      s += freccia(xSV, yS, yP) + freccia(xCV, yA, yP);
      // riquadri sui punti
      s += riquadro(x, yS, `BCWS al ${ut.singolare} ${r.t}: ${fN(r.bcws)}`);
      s += riquadro(x, yP, `BCWP al ${ut.singolare} ${r.t}: ${fN(r.bcwp)}`);
      s += riquadro(x, yA, `ACWP al ${ut.singolare} ${r.t}: ${fN(r.acwp)}`);
      // etichette dei punti, distanziate (stesso algoritmo del .tex)
      const [eA, eS, eP] = r.etichette;
      s += testo(x - 9, Y(eA) + 4, 'ACWP', { size: 10.5, bold: true, anchor: 'end' });
      s += testo(x - 9, Y(eS) + 4, 'BCWS', { size: 10.5, bold: true, anchor: 'end' });
      s += testo(x - 9, Y(eP) + 4, 'BCWP', { size: 10.5, bold: true, anchor: 'end' });
      // valori di SV e CV a destra delle frecce
      const valore = (xf, yc, nome, v) => {
        const riga2 = numeri.formatBreve(v, true);
        const w = Math.max(larghezzaTesto(nome + r.n, 10.5, true), larghezzaTesto(riga2, 10.5)) + 6;
        const colore = v < 0 ? COLORI.negativo : v > 0 ? COLORI.positivo : COLORI.inchiostro;
        return `<rect x="${r2(xf + 3)}" y="${r2(yc - 15)}" width="${r2(w)}" height="29" fill="#fff" fill-opacity="0.85"/>`
          + `<text x="${r2(xf + 6)}" y="${r2(yc - 3)}" font-size="10.5" font-weight="bold" fill="${COLORI.inchiostro}">${nome}<tspan font-size="8" dy="2">${r.n}</tspan></text>`
          + testo(xf + 6, yc + 10, riga2, { size: 10.5, colore });
      };
      s += valore(xSV, (yS + yP) / 2, 'SV', r.sv);
      s += valore(xCV, (yA + yP) / 2, 'CV', r.cv);
    });

    // --- Previsione: EAC e date di fine ---------------------------------
    let fondo = T + PH + 30;
    if (prev) {
      const p = m.previsione, xe = X(p.durataPrevista), ye = Y(p.eac);
      s += riquadro(xe, ye, `EAC (costo finale stimato): ${fN(p.eac)}`);
      s += `<text x="${r2(xe + 10)}" y="${r2(ye + 4)}" font-size="11" fill="${COLORI.inchiostro}"><tspan font-weight="bold">EAC</tspan> ${esc(numeri.formatBreve(p.eac))}</text>`;
      const marcatore = (xm, colore, riga1, riga2) =>
        linea(xm, T + PH + 52, xm, T + PH + 32, colore, 1.6) + punta(xm, T + PH + 25, -Math.PI / 2, colore, 8, 7)
        + testo(xm, T + PH + 66, riga1, { size: 10.5, bold: true, anchor: 'middle', colore })
        + testo(xm, T + PH + 79, riga2, { size: 10.5, bold: true, anchor: 'middle', colore });
      s += marcatore(X(m.durata), COLORI.bcws, 'Fine', 'pianificata');
      s += marcatore(xe, COLORI.acwp, 'Fine', 'stimata');
      fondo = T + PH + 92;
    }

    // --- Legenda sotto il grafico, 2 colonne (come il .tex) --------------
    const voci = [
      { tipo: 'linea', colore: COLORI.bcws, tratto: TRATTI.bcws, testo: 'Pianificato a budget (BCWS)' },
      { tipo: 'linea', colore: COLORI.bcwp, tratto: TRATTI.bcwp, testo: 'Lavoro svolto a costi di budget (BCWP)' },
      { tipo: 'linea', colore: COLORI.acwp, tratto: TRATTI.acwp, testo: 'Costo effettivamente sostenuto (ACWP)' },
    ];
    if (prev) voci.push({ tipo: 'linea', colore: COLORI.acwp, tratto: TRATTI.prev, testo: 'Previsione dei costi fino a EAC' });
    voci.push({ tipo: 'testo', sigla: 'CV', testo: '= BCWP − ACWP (scostamento costi)' });
    voci.push({ tipo: 'testo', sigla: 'SV', testo: '= BCWP − BCWS (scostamento tempi)' });
    if (prev) voci.push({ tipo: 'testo', sigla: 'EAC', testo: '= costo finale stimato' });
    const righe = Math.ceil(voci.length / 2), colW = 330, lx = L, ly = fondo + 8;
    s += `<rect x="${lx}" y="${ly}" width="${colW * 2 + 20}" height="${righe * 21 + 14}" fill="#fff" stroke="${COLORI.griglia}" stroke-width="1"/>`;
    voci.forEach((v, k) => {
      const cx = lx + 12 + (k % 2) * colW, cy = ly + 21 + Math.floor(k / 2) * 21;
      if (v.tipo === 'linea') {
        s += `<line x1="${cx}" y1="${cy - 4}" x2="${cx + 34}" y2="${cy - 4}" stroke="${v.colore}" stroke-width="${v.tratto.w}"${v.tratto.dash ? ` stroke-dasharray="${v.tratto.dash}"` : ''}/>`;
        s += testo(cx + 44, cy, v.testo, { size: 11.5 });
      } else {
        s += `<text x="${cx + 44}" y="${cy}" font-size="11.5" fill="${COLORI.inchiostro}"><tspan font-weight="bold">${v.sigla}</tspan> ${esc(v.testo)}</text>`;
      }
    });
    const H = ly + righe * 21 + 14 + 6;

    const descrizione = m.rilevamenti.map(r => `Rilevamento ${r.n} al ${ut.singolare} ${r.t}: BCWS ${fN(r.bcws)}, BCWP ${fN(r.bcwp)}, ACWP ${fN(r.acwp)}, CV ${fN(r.cv)}, SV ${fN(r.sv)}.`).join(' ');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${r2(H)}" width="${W}" height="${r2(H)}" font-family="${FONT}" role="img" aria-labelledby="cc-tit cc-desc">`
      + `<title id="cc-tit">Diagramma costi-tempi: ${esc(m.titolo)}</title><desc id="cc-desc">${esc(descrizione)}</desc>`
      + `<rect width="${W}" height="${r2(H)}" fill="#fff"/>` + s + '</svg>';
  }

  /** Riquadro mostrato al posto del grafico quando i dati sono incompleti. */
  function segnaposto(messaggio) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 520" font-family="${FONT}" role="img" aria-label="Diagramma non ancora disponibile">`
      + '<rect width="900" height="520" fill="#fff"/>'
      + `<path d="M120 420 C 300 418, 380 260, 520 200 S 720 120, 780 110" fill="none" stroke="#D9D2C3" stroke-width="3" stroke-dasharray="8 6"/>`
      + linea(92, 440, 820, 440, '#C9C1B0', 1.4) + linea(92, 440, 92, 70, '#C9C1B0', 1.4)
      + testo(450, 250, 'Il diagramma comparirà qui', { size: 22, bold: true, anchor: 'middle', colore: '#55606E' })
      + testo(450, 282, messaggio, { size: 15, anchor: 'middle', colore: '#55606E' })
      + '</svg>';
  }

  const api = { disegna, segnaposto, COLORI, TRATTI };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { radice.CC = radice.CC || {}; radice.CC.grafico = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this);
