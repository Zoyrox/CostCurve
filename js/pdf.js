/* =====================================================================
 * pdf.js — "Scarica PDF" (livello 2): report A4 creato nel browser
 * ---------------------------------------------------------------------
 * Usa jsPDF + svg2pdf.js (inclusi in /vendor, licenza MIT). Il grafico
 * è lo STESSO SVG dell'anteprima, convertito in vettori (nitido anche
 * ingrandito). Tabelle e frasi vengono dal modello calcolato: stessi
 * numeri dell'anteprima e del .tex. Se le librerie mancano, il sito
 * offre comunque "Stampa / Salva come PDF".
 * ===================================================================== */
(function (radice) {
  'use strict';

  const CC = radice.CC;
  const { formatNumero: fN, formatPercentuale: fP, formatConSegno: fS } = CC.numeri;

  const MM = { pagina: [210, 297], margine: 15 };
  const LARG = MM.pagina[0] - 2 * MM.margine;
  const COL = {
    inchiostro: [27, 42, 58], grigio: [85, 96, 110], accento: [179, 71, 0], verde: [0, 119, 90],
    giallo: [110, 83, 0], linea: [220, 212, 196], fondo: [243, 239, 230], blu: [0, 114, 178],
  };

  function disponibile() {
    return Boolean(radice.jspdf && radice.jspdf.jsPDF && radice.jspdf.jsPDF.API && radice.jspdf.jsPDF.API.svg);
  }

  /** I font standard del PDF usano la codifica WinAnsi: sostituisco i simboli che non ha. */
  function t(s) {
    let x = String(s).replace(/−/g, '-').replace(/≈/g, '~').replace(/→/g, '->').replace(/✓/g, '').replace(/✕/g, '');
    for (const c of CC.calcoli.caratteriNonSupportati(x)) x = x.split(c).join('');
    return x;
  }

  function crea(modello, svgTesto) {
    const { jsPDF } = radice.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    const m = modello, ut = m.unitaTempo;
    const basso = MM.pagina[1] - MM.margine;
    let y = MM.margine;

    const colore = (c, tipo = 'text') => (tipo === 'text' ? doc.setTextColor(...c) : tipo === 'draw' ? doc.setDrawColor(...c) : doc.setFillColor(...c));
    const font = (stile, dim) => { doc.setFont('helvetica', stile); doc.setFontSize(dim); };
    const spazio = h => { if (y + h > basso) { doc.addPage(); y = MM.margine; return true; } return false; };
    const paragrafo = (testo, dim = 9.5, stile = 'normal', c = COL.inchiostro, interl = 1.38) => {
      font(stile, dim); colore(c);
      const righe = doc.splitTextToSize(t(testo), LARG);
      const h = dim * 0.3528 * interl;
      righe.forEach(r => { spazio(h); doc.text(r, MM.margine, y + h * 0.8); y += h; });
    };
    const titoloSezione = testo => {
      spazio(14); y += 3;
      font('bold', 12); colore(COL.inchiostro); doc.text(t(testo), MM.margine, y + 4.5);
      y += 6.5; colore(COL.inchiostro, 'draw'); doc.setLineWidth(0.4); doc.line(MM.margine, y, MM.margine + LARG, y); y += 2.5;
    };

    /** Tabella semplice con intestazione ripetuta a ogni pagina. */
    const tabella = (colonne, righe, opz = {}) => {
      const hR = opz.altezza || 5.6;
      const intestazione = () => {
        colore(COL.fondo, 'fill'); doc.rect(MM.margine, y, LARG, hR * (opz.righeTitolo || 1), 'F');
        font('bold', 8.2); colore(COL.inchiostro);
        let x = MM.margine;
        colonne.forEach(c => {
          const linee = String(c.titolo).split('\n');
          linee.forEach((l, k) => doc.text(t(l), c.allinea === 'right' ? x + c.w - 1.5 : x + 1.5, y + 3.9 + k * 3.4, { align: c.allinea === 'right' ? 'right' : 'left' }));
          x += c.w;
        });
        y += hR * (opz.righeTitolo || 1);
        colore(COL.inchiostro, 'draw'); doc.setLineWidth(0.35); doc.line(MM.margine, y, MM.margine + LARG, y);
      };
      spazio(hR * 3); intestazione();
      righe.forEach((riga, i) => {
        if (spazio(hR)) intestazione();
        if (opz.evidenzia && opz.evidenzia(i)) { colore(COL.fondo, 'fill'); doc.rect(MM.margine, y, LARG, hR, 'F'); }
        let x = MM.margine;
        riga.forEach((cella, k) => {
          const c = colonne[k];
          const v = typeof cella === 'object' && cella !== null ? cella : { testo: cella };
          font(v.grassetto ? 'bold' : 'normal', 8.6); colore(v.colore || COL.inchiostro);
          doc.text(t(v.testo), c.allinea === 'right' ? x + c.w - 1.5 : x + 1.5, y + 3.9, { align: c.allinea === 'right' ? 'right' : 'left' });
          x += c.w;
        });
        y += hR;
        colore(COL.linea, 'draw'); doc.setLineWidth(0.15); doc.line(MM.margine, y, MM.margine + LARG, y);
      });
      y += 2;
    };
    const coloreSegno = v => (v < 0 ? COL.accento : v > 0 ? COL.verde : COL.inchiostro);
    const coloreStato = s => (s.colore === 'verde' ? COL.verde : s.colore === 'rosso' ? COL.accento : COL.giallo);

    // ---- Intestazione ------------------------------------------------
    colore(COL.accento, 'fill'); doc.rect(MM.margine, y, LARG, 1.2, 'F'); y += 4;
    font('bold', 7.5); colore(COL.accento); doc.text('DIAGRAMMA COSTI-TEMPI  ·  EARNED VALUE', MM.margine, y + 2.5); y += 4.5;
    paragrafo(m.titolo, 17, 'bold', COL.inchiostro, 1.2);
    if (m.dati.nota) paragrafo(m.dati.nota, 9, 'italic', COL.grigio);
    paragrafo(`Durata pianificata: ${m.durata} ${ut.plurale}   ·   Budget totale (BAC): ${fN(m.bac)} (${m.unitaMoneta.asse.toLowerCase()})`, 9.5);
    y += 2;

    // ---- Grafico vettoriale (stesso SVG dell'anteprima) ----------------
    const contenitore = document.createElement('div');
    contenitore.style.cssText = 'position:fixed;left:-10000px;top:0;width:900px';
    contenitore.innerHTML = svgTesto.replace(/−/g, '-');
    document.body.appendChild(contenitore);
    const svg = contenitore.querySelector('svg');
    const vb = svg.viewBox.baseVal;
    const hGraf = LARG * vb.height / vb.width;
    spazio(hGraf);
    const yGraf = y;
    y += hGraf + 3;

    return doc.svg(svg, { x: MM.margine, y: yGraf, width: LARG, height: hGraf }).then(() => {
      contenitore.remove();

      // ---- Indicatori -------------------------------------------------
      titoloSezione('Indicatori ai due rilevamenti');
      const [a, b] = m.rilevamenti;
      const col3 = [{ titolo: '', w: 90 }, { titolo: `Rilevamento 1\n${ut.singolare} ${a.t}`, w: 45, allinea: 'right' }, { titolo: `Rilevamento 2\n${ut.singolare} ${b.t}`, w: 45, allinea: 'right' }];
      const seg = (v, testo) => ({ testo, colore: coloreSegno(v), grassetto: true });
      const ind = v => (v === null ? 'n.d.' : fN(v, 2));
      tabella(col3, [
        ['Pianificato a budget (BCWS)', fN(a.bcws), fN(b.bcws)],
        ['Lavoro svolto a costi di budget (BCWP)', fN(a.bcwp), fN(b.bcwp)],
        ['Costo effettivamente sostenuto (ACWP)', fN(a.acwp), fN(b.acwp)],
        ['CV = BCWP - ACWP', seg(a.cv, fS(a.cv)), seg(b.cv, fS(b.cv))],
        ['SV = BCWP - BCWS', seg(a.sv, fS(a.sv)), seg(b.sv, fS(b.sv))],
        ['%CV = CV / BCWS', seg(a.cv, fP(a.pcv)), seg(b.cv, fP(b.pcv))],
        ['%SV = SV / BCWS', seg(a.sv, fP(a.psv)), seg(b.sv, fP(b.psv))],
        ['CPI = BCWP / ACWP (assunzione)', ind(a.cpi), ind(b.cpi)],
        ['SPI = BCWP / BCWS (assunzione)', ind(a.spi), ind(b.spi)],
        ['Stato', { testo: a.stato.parola, colore: coloreStato(a.stato), grassetto: true }, { testo: b.stato.parola, colore: coloreStato(b.stato), grassetto: true }],
      ], { righeTitolo: 1.6 });

      // ---- Interpretazione --------------------------------------------
      for (const r of m.rilevamenti) {
        spazio(10);
        font('bold', 9.5); colore(coloreStato(r.stato));
        doc.text(t(`${r.stato.parola.toUpperCase()}`), MM.margine, y + 3.6);
        y += 4.8;
        paragrafo(`Rilevamento ${r.n} (${ut.singolare} ${r.t}): ${r.frasi.tempi} ${r.frasi.costi}`, 9.5);
        y += 1;
      }
      const p = m.previsione;
      if (p.visibile) paragrafo(`Previsione (assunzione, dal rilevamento 2): costo finale stimato EAC = ${fN(p.eac)} contro un budget di ${fN(m.bac)}; fine stimata al ${ut.singolare} ${fN(p.durataPrevista, 1)} contro ${m.durata} pianificati.`, 9.5, 'italic');
      else if (p.richiesta && p.motivo) paragrafo(p.motivo, 9, 'italic', COL.grigio);

      // ---- Legenda -------------------------------------------------------
      titoloSezione('Legenda dei parametri');
      for (const [sigla, nome, testo] of CC.report.LEGENDA) {
        spazio(9);
        font('bold', 9.2); colore(COL.inchiostro); doc.text(t(`${sigla} - ${nome}`), MM.margine, y + 3.4); y += 4.6;
        paragrafo(testo, 8.8, 'normal', COL.grigio, 1.3);
        y += 1;
      }

      // ---- Tabella costi-tempi -------------------------------------------
      titoloSezione(`Tabella costi-tempi (valori in ${m.unitaMoneta.asse.toLowerCase()})`);
      const perT = {}; m.rilevamenti.forEach(r => { perT[r.t] = r; });
      const righe = [];
      for (let i = 1; i <= m.durata; i++) {
        const r = perT[i];
        righe.push([
          { testo: `${i}${r ? `  (ril. ${r.n})` : ''}`, grassetto: Boolean(r) },
          fN(m.costi[i - 1]), fN(m.bcwsCum[i]),
          r ? { testo: fN(r.bcwp), grassetto: true } : '-', r ? { testo: fN(r.acwp), grassetto: true } : '-',
          r ? seg(r.cv, fS(r.cv)) : '-', r ? seg(r.sv, fS(r.sv)) : '-',
        ]);
      }
      tabella([
        { titolo: 'Periodo', w: 24 }, { titolo: 'Costo pianificato\nnel periodo', w: 28, allinea: 'right' },
        { titolo: 'BCWS\ncumulato', w: 28, allinea: 'right' }, { titolo: 'BCWP', w: 25, allinea: 'right' },
        { titolo: 'ACWP', w: 25, allinea: 'right' }, { titolo: 'CV', w: 25, allinea: 'right' }, { titolo: 'SV', w: 25, allinea: 'right' },
      ], righe, { righeTitolo: 1.6, altezza: 5.2, evidenzia: i => Boolean(perT[i + 1]) });
      paragrafo('BCWP, ACWP, CV e SV sono misurati solo ai due rilevamenti (righe evidenziate).', 8, 'normal', COL.grigio);

      // ---- Nota sulle formule ---------------------------------------------
      titoloSezione('Nota sulle formule');
      paragrafo('Formule del libro (pagg. 198-199): CV = BCWP - ACWP, SV = BCWP - BCWS, %CV = CV / BCWS, %SV = SV / BCWS. In letteratura la %CV si calcola spesso su BCWP invece che su BCWS: qui si segue il libro. Le curve passano esattamente per i valori inseriti con un\'interpolazione cubica monotona, quindi non scendono mai. Semaforo: in linea se CV e SV non sono negativi; critico se %CV o %SV sono sotto il -10% (soglia ipotizzata); altrimenti attenzione.', 8.8, 'normal', COL.grigio);
      y += 2;
      paragrafo('Report generato dal browser con CostCurve. Il PDF "ufficiale" si ottiene compilando il file .tex scaricato dal sito.', 8.5, 'italic', COL.grigio);

      // ---- Numeri di pagina -------------------------------------------
      const n = doc.getNumberOfPages();
      for (let k = 1; k <= n; k++) {
        doc.setPage(k); font('normal', 7.5); colore(COL.grigio);
        doc.text(t(`${m.titolo.slice(0, 80)}  ·  pagina ${k} di ${n}`), MM.pagina[0] / 2, MM.pagina[1] - 7, { align: 'center' });
      }
      return doc.output('blob');
    }).catch(err => { contenitore.remove(); throw err; });
  }

  radice.CC = radice.CC || {};
  radice.CC.pdf = { disponibile, crea };
})(typeof globalThis !== 'undefined' ? globalThis : this);
