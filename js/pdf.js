/* =====================================================================
 * pdf.js — "Esporta → Report PDF": documento A4 creato nel browser
 * ---------------------------------------------------------------------
 * Usa jsPDF + svg2pdf.js (inclusi in /vendor, licenza MIT). Il grafico
 * è lo STESSO SVG dell'anteprima (in tema chiaro), convertito in vettori:
 * resta nitido anche ingrandito. Tabelle e frasi vengono dal modello
 * calcolato. Opzioni scelte dall'utente: pagina del grafico (verticale
 * con il resto oppure orizzontale dedicata) e dimensione del grafico.
 * ===================================================================== */
(function (radice) {
  'use strict';

  const CC = radice.CC;
  const { formatNumero: fN, formatPercentuale: fP, formatConSegno: fS } = CC.numeri;
  const MARGINE = 14;
  const FATTORE = { normale: 0.84, grande: 0.93, massima: 1 };
  const COL = {
    testo: [17, 24, 39], tenue: [107, 114, 128], accento: [11, 92, 173], ok: [0, 119, 90],
    att: [138, 90, 0], err: [180, 35, 24], neg: [179, 71, 0], linea: [227, 230, 234], fondo: [238, 244, 250], fondo2: [243, 244, 246],
  };

  function disponibile() {
    return Boolean(radice.jspdf && radice.jspdf.jsPDF && radice.jspdf.jsPDF.API && radice.jspdf.jsPDF.API.svg);
  }

  /** I font standard del PDF usano la codifica WinAnsi: sostituisco i simboli che non ha. */
  function t(s) {
    let x = String(s).replace(/−/g, '-').replace(/≈/g, '~').replace(/→/g, '->').replace(/[✓✕]/g, '');
    for (const c of CC.calcoli.caratteriNonSupportati(x)) x = x.split(c).join('');
    return x;
  }

  async function crea(m, opz) {
    const { jsPDF } = radice.jspdf;
    const orizzontale = opz.pagina === 'orizzontale';
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: orizzontale ? 'landscape' : 'portrait', compress: true });
    const ut = m.unitaTempo, rp = m.dati.report;
    let W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
    let LARG = W - 2 * MARGINE;
    let y = MARGINE;

    const colore = (c, tipo = 'text') => (tipo === 'text' ? doc.setTextColor(...c) : tipo === 'draw' ? doc.setDrawColor(...c) : doc.setFillColor(...c));
    const font = (stile, dim) => { doc.setFont('helvetica', stile); doc.setFontSize(dim); };
    const nuovaPagina = (orient = 'portrait') => {
      doc.addPage('a4', orient);
      W = doc.internal.pageSize.getWidth(); H = doc.internal.pageSize.getHeight(); LARG = W - 2 * MARGINE; y = MARGINE;
    };
    const spazio = h => { if (y + h > H - MARGINE) { nuovaPagina(); return true; } return false; };
    const paragrafo = (testo, dim = 9.5, stile = 'normal', c = COL.testo, interl = 1.38) => {
      font(stile, dim); colore(c);
      const righe = doc.splitTextToSize(t(testo), LARG);
      const h = dim * 0.3528 * interl;
      righe.forEach(r => { spazio(h); doc.text(r, MARGINE, y + h * 0.8); y += h; });
    };
    const titoloSezione = testo => {
      spazio(14); y += 4;
      font('bold', 11.5); colore(COL.testo); doc.text(t(testo), MARGINE, y + 4.5);
      y += 6.5; colore(COL.linea, 'draw'); doc.setLineWidth(0.3); doc.line(MARGINE, y, MARGINE + LARG, y); y += 2.5;
    };
    const coloreSegno = v => (v < 0 ? COL.neg : v > 0 ? COL.ok : COL.testo);
    const coloreStato = s => (s.colore === 'verde' ? COL.ok : s.colore === 'rosso' ? COL.err : COL.att);

    /** Tabella semplice con intestazione ripetuta a ogni pagina. */
    const tabella = (colonne, righe, o = {}) => {
      const hR = o.altezza || 5.6, hT = hR * (o.righeTitolo || 1);
      const scala = LARG / colonne.reduce((s, c) => s + c.w, 0);
      const cols = colonne.map(c => ({ ...c, w: c.w * scala }));
      const intestazione = () => {
        colore(COL.fondo2, 'fill'); doc.rect(MARGINE, y, LARG, hT, 'F');
        font('bold', 7.8); colore(COL.tenue);
        let x = MARGINE;
        cols.forEach(c => {
          String(c.titolo).split('\n').forEach((l, k) => doc.text(t(l), c.dx ? x + c.w - 1.5 : x + 1.5, y + 3.8 + k * 3.3, { align: c.dx ? 'right' : 'left' }));
          x += c.w;
        });
        y += hT;
      };
      spazio(hT + hR * 2); intestazione();
      righe.forEach((riga, i) => {
        if (spazio(hR)) intestazione();
        if (o.evidenzia && o.evidenzia(i)) { colore(COL.fondo, 'fill'); doc.rect(MARGINE, y, LARG, hR, 'F'); }
        let x = MARGINE;
        riga.forEach((cella, k) => {
          const c = cols[k];
          const v = typeof cella === 'object' && cella !== null ? cella : { testo: cella };
          font(v.grassetto ? 'bold' : 'normal', 8.4); colore(v.colore || COL.testo);
          doc.text(t(v.testo), c.dx ? x + c.w - 1.5 : x + 1.5, y + 3.8, { align: c.dx ? 'right' : 'left' });
          x += c.w;
        });
        y += hR;
        colore(COL.linea, 'draw'); doc.setLineWidth(0.15); doc.line(MARGINE, y, MARGINE + LARG, y);
      });
      y += 2;
    };

    /** Intestazione: titolo, nota, dati del resoconto. */
    const intestazione = (compatta) => {
      colore(COL.accento, 'fill'); doc.rect(MARGINE, y, LARG, 0.9, 'F'); y += 4;
      font('bold', 7.2); colore(COL.accento); doc.text('DIAGRAMMA COSTI-TEMPI  ·  EARNED VALUE', MARGINE, y + 2.4); y += 4.4;
      paragrafo(m.titolo, compatta ? 13 : 16, 'bold', COL.testo, 1.2);
      if (m.dati.nota) paragrafo(m.dati.nota, 8.8, 'italic', COL.tenue);
      const meta = [`Durata pianificata: ${m.durata} ${ut.plurale}`, `Budget totale (BAC): ${fN(m.bac)} ${m.unitaMoneta.breve}`];
      if (rp.pm) meta.push(`Project manager: ${rp.pm}`);
      if (rp.azienda) meta.push(`Azienda: ${rp.azienda}`);
      if (rp.data) meta.push(`Data: ${rp.data}`);
      paragrafo(meta.join('   ·   '), 8.8, 'normal', COL.tenue);
      y += 2;
    };

    // ---- Grafico vettoriale (stesso SVG dell'anteprima, in tema chiaro) ---
    intestazione(false);
    const contenitore = document.createElement('div');
    contenitore.style.cssText = 'position:fixed;left:-10000px;top:0;width:1100px';
    contenitore.innerHTML = opz.svg.replace(/−/g, '-');
    document.body.appendChild(contenitore);
    const svg = contenitore.querySelector('svg');
    const vb = svg.viewBox.baseVal;
    let wG = LARG * (FATTORE[opz.dimensione] || FATTORE.normale);
    let hG = wG * vb.height / vb.width;
    const hMax = H - MARGINE - y - (orizzontale ? 2 : 0);
    if (hG > hMax) { hG = hMax; wG = hG * vb.width / vb.height; }   // stesse proporzioni: il grafico resta veritiero
    if (!orizzontale && hG > hMax) spazio(hG);
    const xG = MARGINE + (LARG - wG) / 2, yG = y;
    try { await doc.svg(svg, { x: xG, y: yG, width: wG, height: hG }); }
    finally { contenitore.remove(); }
    y += hG + 3;
    if (m.previsione.modo !== 'no' && !m.previsione.visibile && m.previsione.motivo) paragrafo(m.previsione.motivo, 8.5, 'italic', COL.tenue);
    if (orizzontale) { nuovaPagina('portrait'); intestazione(true); }

    if (rp.commento) {
      spazio(12);
      colore(COL.accento, 'fill'); doc.rect(MARGINE, y + 0.5, 0.8, 4.5, 'F');
      font('bold', 9.3); colore(COL.testo); doc.text('Commento del project manager', MARGINE + 3, y + 4); y += 6;
      paragrafo(rp.commento, 9.3, 'normal', COL.testo);
    }

    // ---- Indicatori ------------------------------------------------------
    titoloSezione('Indicatori ai rilevamenti');
    const R = m.rilevamenti;
    const seg = (v, testo) => ({ testo, colore: coloreSegno(v), grassetto: true });
    const ind = v => (v === null ? 'n.d.' : fN(v, 2));
    const quando = r => `${ut.singolare} ${r.t}${r.data ? ` (${r.data})` : ''}`;
    const cols = [{ titolo: '', w: 90 }, ...R.map(r => ({ titolo: `Rilevamento ${r.n}\n${quando(r)}`, w: 45, dx: true }))];
    const riga = (nome, f) => [nome, ...R.map(f)];
    tabella(cols, [
      riga('Pianificato a budget (BCWS)', r => fN(r.bcws)),
      riga('Lavoro svolto a costi di budget (BCWP)', r => fN(r.bcwp)),
      riga('Costo effettivamente sostenuto (ACWP)', r => fN(r.acwp)),
      riga('CV = BCWP - ACWP', r => seg(r.cv, fS(r.cv))),
      riga('SV = BCWP - BCWS', r => seg(r.sv, fS(r.sv))),
      riga('%CV = CV / BCWS', r => seg(r.cv, fP(r.pcv))),
      riga('%SV = SV / BCWS', r => seg(r.sv, fP(r.psv))),
      riga('CPI = BCWP / ACWP (assunzione)', r => ind(r.cpi)),
      riga('SPI = BCWP / BCWS (assunzione)', r => ind(r.spi)),
      riga('Stato', r => ({ testo: r.stato.parola, colore: coloreStato(r.stato), grassetto: true })),
    ], { righeTitolo: 1.65 });

    for (const r of R) {
      spazio(10);
      font('bold', 9.3); colore(coloreStato(r.stato));
      doc.text(t(r.stato.parola.toUpperCase()), MARGINE, y + 3.6); y += 4.8;
      paragrafo(`Rilevamento ${r.n} (${quando(r)}): ${r.frasi.tempi} ${r.frasi.costi}`, 9.3);
      y += 1;
    }
    const p = m.previsione;
    if (p.visibile) paragrafo(`Previsione (${p.modo === 'manuale' ? 'inserita dal project manager' : 'assunzione, dall\'ultimo rilevamento'}): costo finale EAC = ${fN(p.eac)} contro un budget di ${fN(m.bac)}; fine al ${ut.singolare} ${fN(p.durataPrevista, 1)} contro ${m.durata} pianificati.`, 9.3, 'italic');

    // ---- Legenda -----------------------------------------------------------
    titoloSezione('Legenda dei parametri');
    for (const [sigla, nome, testo] of CC.report.LEGENDA) {
      spazio(9);
      font('bold', 9); colore(COL.testo); doc.text(t(`${sigla} - ${nome}`), MARGINE, y + 3.4); y += 4.6;
      paragrafo(testo, 8.6, 'normal', COL.tenue, 1.3);
      y += 1;
    }

    // ---- Tabella costi-tempi ---------------------------------------------
    titoloSezione(`Tabella costi-tempi (valori in ${m.unitaMoneta.asse.toLowerCase()})`);
    const perT = {}; R.forEach(r => { perT[r.t] = r; });
    const val = (k, i) => { const q = m.punti[k].find(x => x[0] === i); return q ? fN(q[1]) : '-'; };
    const righe = [];
    for (let i = 1; i <= m.durata; i++) {
      const r = perT[i];
      righe.push([
        { testo: `${i}${m.inizio ? '  ' + m.etichettaTempo(i) : ''}${r ? `  (ril. ${r.n})` : ''}`, grassetto: Boolean(r) },
        fN(m.costi[i - 1]), fN(m.bcwsCum[i]), val('bcwp', i), val('acwp', i),
        r ? seg(r.cv, fS(r.cv)) : '-', r ? seg(r.sv, fS(r.sv)) : '-',
      ]);
    }
    tabella([
      { titolo: 'Periodo', w: 30 }, { titolo: 'Costo pianificato\nnel periodo', w: 26, dx: true },
      { titolo: 'BCWS\ncumulato', w: 26, dx: true }, { titolo: 'BCWP', w: 24, dx: true },
      { titolo: 'ACWP', w: 24, dx: true }, { titolo: 'CV', w: 23, dx: true }, { titolo: 'SV', w: 23, dx: true },
    ], righe, { righeTitolo: 1.65, altezza: 5.1, evidenzia: i => Boolean(perT[i + 1]) });
    paragrafo('BCWP e ACWP compaiono nei periodi in cui sono stati rilevati; CV e SV ai rilevamenti (righe evidenziate).', 7.8, 'normal', COL.tenue);

    // ---- Nota sulle formule -------------------------------------------------
    titoloSezione('Nota sulle formule');
    paragrafo('Formule del libro (pagg. 198-199): CV = BCWP - ACWP, SV = BCWP - BCWS, %CV = CV / BCWS, %SV = SV / BCWS. In letteratura la %CV si calcola spesso su BCWP invece che su BCWS: qui si segue il libro. Le curve passano esattamente per i valori inseriti con un\'interpolazione cubica monotona, quindi non scendono mai. Semaforo: in linea se CV e SV non sono negativi; critico se %CV o %SV sono sotto il -10% (soglia ipotizzata); altrimenti attenzione.', 8.5, 'normal', COL.tenue);
    y += 2;
    paragrafo('Report generato dal browser con CostCurve. Il PDF "ufficiale" si ottiene compilando il file .tex.', 8.2, 'italic', COL.tenue);

    // ---- Numeri di pagina ---------------------------------------------------
    const n = doc.getNumberOfPages();
    for (let k = 1; k <= n; k++) {
      doc.setPage(k);
      const w = doc.internal.pageSize.getWidth(), h = doc.internal.pageSize.getHeight();
      font('normal', 7.2); colore(COL.tenue);
      doc.text(t(`${m.titolo.slice(0, 80)}  ·  pagina ${k} di ${n}`), w / 2, h - 6, { align: 'center' });
    }
    return doc.output('blob');
  }

  radice.CC = radice.CC || {};
  radice.CC.pdf = { disponibile, crea };
})(typeof globalThis !== 'undefined' ? globalThis : this);
