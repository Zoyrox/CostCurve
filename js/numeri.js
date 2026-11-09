/* =====================================================================
 * numeri.js — lettura e scrittura dei numeri "all'italiana"
 * ---------------------------------------------------------------------
 * Nell'interfaccia: virgola per i decimali, punto per le migliaia
 * (es. 540.000 e 15,7). Nel file .tex si usa invece il punto decimale.
 * Il raggruppamento delle migliaia parte già da 4 cifre (1.000), come
 * fa il pacchetto siunitx nel .tex: così i numeri sono identici.
 * ===================================================================== */
(function (radice) {
  'use strict';

  /**
   * Trasforma il testo scritto dall'utente in numero.
   * Accetta: "540000", "540.000", "1.234,5", "2,5", "2.5", " 12 ".
   * Restituisce null se il campo è vuoto, NaN se non è un numero.
   */
  function leggiNumero(testo) {
    if (typeof testo === 'number') return Number.isFinite(testo) ? testo : NaN;
    if (testo === null || testo === undefined) return null;
    let s = String(testo).trim().replace(/\s| |€/g, '').replace(/−/g, '-');
    if (s === '') return null;
    if (s.includes(',')) {
      // con la virgola: i punti sono separatori delle migliaia
      s = s.replace(/\./g, '').replace(',', '.');
    } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
      // solo punti a gruppi di 3 cifre: sono migliaia (540.000)
      s = s.replace(/\./g, '');
    }
    if (!/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
    return Number(s);
  }

  /** Raggruppa le cifre intere con il punto: 540000 -> "540.000". */
  function raggruppa(cifre) {
    return cifre.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  /**
   * Scrive un numero all'italiana.
   * decimali = 'auto': nessun decimale se (arrotondato a 2 cifre) è intero,
   * altrimenti 2 decimali (stessa regola di siunitx con drop-zero-decimal).
   */
  function formatNumero(x, decimali) {
    if (x === null || x === undefined || !Number.isFinite(x)) return 'n.d.';
    let d = decimali;
    if (d === undefined || d === 'auto') {
      d = Math.abs(Math.round(x * 100) % 100) === 0 ? 0 : 2;
    }
    const arrotondato = Math.round(Math.abs(x) * Math.pow(10, d)) / Math.pow(10, d);
    const [intera, frazione] = arrotondato.toFixed(d).split('.');
    const segno = x < 0 && arrotondato !== 0 ? '−' : '';
    return segno + raggruppa(intera) + (frazione ? ',' + frazione : '');
  }

  /** Percentuale con 1 decimale e segno: -15.66 -> "−15,7%". */
  function formatPercentuale(p) {
    if (p === null || p === undefined || !Number.isFinite(p)) return 'n.d.';
    const s = formatNumero(p, 1);
    return (p > 0 && s !== '0,0' ? '+' : '') + s + '%';
  }

  /** Numero con segno esplicito (+ per i positivi): utile per CV e SV. */
  function formatConSegno(x) {
    const s = formatNumero(x);
    return (x > 0 && s !== '0' ? '+' : '') + s;
  }

  /**
   * Forma breve per le etichette dentro il grafico (spazio poco):
   * da un milione in su "193,8 mln", da un miliardo "1,1 mld".
   * Nelle tabelle si usa sempre il numero completo.
   */
  function formatBreve(x, conSegno) {
    if (!Number.isFinite(x)) return 'n.d.';
    const a = Math.abs(x);
    let s;
    if (a >= 1e9) s = formatNumero(x / 1e9, 1) + ' mld';
    else if (a >= 1e6) s = formatNumero(x / 1e6, 1) + ' mln';
    else s = formatNumero(x);
    return (conSegno && x > 0 && !/^0(,0)?( |$)/.test(s) ? '+' : '') + s;
  }

  /** Numero per il file .tex: punto decimale, nessun separatore, max 6 decimali. */
  function perLatex(x) {
    if (!Number.isFinite(x)) return '0';
    const r = Math.round(x * 1e6) / 1e6;
    return String(r);
  }

  const api = { leggiNumero, formatNumero, formatPercentuale, formatConSegno, formatBreve, perLatex };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { radice.CC = radice.CC || {}; radice.CC.numeri = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this);
