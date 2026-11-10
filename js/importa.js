/* =====================================================================
 * importa.js — importazione di una tabella da Excel o CSV
 * ---------------------------------------------------------------------
 * Accetta il testo copiato da Excel (colonne separate da tabulazioni)
 * oppure un file CSV (separatore ; o ,). Riconosce le colonne dalle
 * intestazioni (periodo/mese, BCWS/pianificato, costo nel periodo,
 * BCWP, ACWP); senza intestazioni usa l'ordine periodo, BCWS, BCWP, ACWP.
 * Restituisce una proposta di dati da unire al progetto, più un elenco
 * di avvisi in parole semplici. Modulo puro: si prova anche in Node.
 * ===================================================================== */
(function (radice) {
  'use strict';

  const numeri = (typeof module !== 'undefined' && module.exports) ? require('./numeri.js') : radice.CC.numeri;

  /** Divide il testo in righe e celle, indovinando il separatore. */
  function celle(testo) {
    const righe = String(testo || '').replace(/^﻿/, '').replace(/\r/g, '').split('\n').filter(r => r.trim() !== '');
    if (!righe.length) return [];
    const campione = righe.slice(0, 5).join('\n');
    const sep = campione.includes('\t') ? '\t' : (campione.split(';').length >= campione.split(',').length ? ';' : ',');
    return righe.map(r => r.split(sep).map(c => c.trim().replace(/^"(.*)"$/, '$1')));
  }

  const RICONOSCI = [
    ['periodo', /^(periodo|mese|mesi|settimana|settimane|giorno|giorni|t|tempo|n\.?|#)$/i],
    ['costo', /(costo|spesa).*(periodo|mese|settimana|giorno)|nel periodo|^costo$/i],
    ['bcws', /bcws|pianificat|budget|planned|baseline|\bpv\b/i],
    ['bcwp', /bcwp|svolto|earned|\bev\b/i],
    ['acwp', /acwp|effettiv|actual|sostenut|\bac\b/i],
  ];

  /**
   * Analizza il testo e restituisce:
   * { righe: [{periodo, bcws, costo, bcwp, acwp}], colonne, avvisi, errore }
   */
  function analizza(testo) {
    const t = celle(testo);
    if (!t.length) return { errore: 'Non c\'è niente da importare: incolla le celle o scegli un file.' };
    // intestazione: la prima riga ha almeno una cella che non è un numero?
    const prima = t[0];
    const intestata = prima.some(c => c !== '' && !Number.isFinite(numeri.leggiNumero(c)));
    let colonne = {};
    if (intestata) {
      prima.forEach((c, i) => {
        for (const [nome, re] of RICONOSCI) if (colonne[nome] === undefined && re.test(c)) { colonne[nome] = i; break; }
      });
      if (colonne.bcws === undefined && colonne.costo === undefined && colonne.bcwp === undefined && colonne.acwp === undefined) {
        return { errore: 'Non riconosco le colonne. Usa intestazioni come: mese; BCWS; BCWP; ACWP.' };
      }
    } else {
      colonne = prima.length >= 4 ? { periodo: 0, bcws: 1, bcwp: 2, acwp: 3 } : prima.length === 3 ? { bcws: 0, bcwp: 1, acwp: 2 } : { bcws: 0 };
    }
    const corpo = intestata ? t.slice(1) : t;
    const avvisi = [];
    const righe = [];
    corpo.forEach((r, k) => {
      const val = nome => {
        if (colonne[nome] === undefined) return null;
        const v = numeri.leggiNumero(r[colonne[nome]] ?? '');
        if (v === null) return null;
        if (!Number.isFinite(v)) { avvisi.push(`Riga ${k + (intestata ? 2 : 1)}: "${r[colonne[nome]]}" non è un numero e viene ignorato.`); return null; }
        return v;
      };
      const periodo = colonne.periodo !== undefined ? val('periodo') : k + 1;
      righe.push({ periodo: periodo === null ? k + 1 : periodo, bcws: val('bcws'), costo: val('costo'), bcwp: val('bcwp'), acwp: val('acwp') });
    });
    if (!righe.length) return { errore: 'C\'è solo la riga delle intestazioni: mancano i valori.' };
    // un periodo 0 iniziale (tutti zero) si scarta: le curve partono già da zero
    if (righe[0].periodo === 0) righe.shift();
    righe.sort((a, b) => a.periodo - b.periodo);
    const salti = righe.some((r, i) => r.periodo !== i + 1);
    if (salti) avvisi.push('I periodi non vanno da 1 in avanti senza buchi: li rinumero in ordine (1, 2, 3, …).');
    righe.forEach((r, i) => { r.periodo = i + 1; });
    if (righe.length > 120) return { errore: `Ci sono ${righe.length} periodi: al massimo se ne possono importare 120.` };
    const pianoCol = colonne.bcws !== undefined ? 'bcws' : colonne.costo !== undefined ? 'costo' : null;
    if (!pianoCol) avvisi.push('Non c\'è la colonna del piano (BCWS): importo solo BCWP e ACWP.');
    else if (righe.some(r => r[pianoCol] === null)) avvisi.push('In alcune righe manca il valore del piano: completalo nel passo 2.');
    return { righe, colonne, pianoCol, avvisi };
  }

  /**
   * Trasforma il risultato dell'analisi in dati da unire al progetto.
   * Sceglie i rilevamenti: l'ultimo periodo con BCWP e ACWP e, se ce ne
   * sono abbastanza, uno a metà strada. Si possono poi cambiare.
   */
  function inDati(a, esistenti) {
    const n = a.righe.length;
    const d = {
      durata: n,
      modoAvanzamento: 'periodi',
      avanzamento: a.righe.map(r => ({ bcwp: r.bcwp, acwp: r.acwp })),
    };
    if (a.pianoCol) {
      d.modoPiano = a.pianoCol === 'bcws' ? 'cumulato' : 'periodo';
      d.piano = a.righe.map(r => r[a.pianoCol]);
      const tot = a.pianoCol === 'bcws' ? a.righe[n - 1].bcws : a.righe.reduce((s, r) => s + (r.costo || 0), 0);
      const bac = esistenti && numeri.leggiNumero(esistenti.bac);
      if (!(bac > 0) && tot > 0) d.bac = tot;
    }
    const completi = a.righe.filter(r => r.bcwp !== null && r.acwp !== null).map(r => r.periodo);
    if (completi.length) {
      const ultimo = completi[completi.length - 1];
      const meta = completi.filter(t => t <= ultimo / 2 + 0.5);
      if (completi.length >= 2 && meta.length) {
        d.numeroRilevamenti = 2;
        d.rilevamenti = [{ periodo: meta[meta.length - 1] }, { periodo: ultimo }];
      } else {
        d.numeroRilevamenti = 1;
        d.rilevamenti = [{ periodo: ultimo }, { periodo: null }];
      }
    }
    return d;
  }

  /** Tabella costi-tempi in CSV per Excel italiano (separatore ;, virgola decimale). */
  function tabellaCSV(m) {
    const f = v => (v === null || v === undefined ? '' : numeri.formatNumero(v, 'auto').replace(/\./g, '').replace('−', '-'));
    const ril = {};
    m.rilevamenti.forEach(r => { ril[r.t] = r; });
    const valore = (k, t) => { const p = m.punti[k].find(q => q[0] === t); return p ? p[1] : null; };
    const righe = [['Periodo', 'Data', 'Costo pianificato nel periodo', 'BCWS cumulato', 'BCWP', 'ACWP', 'CV', 'SV', '%CV', '%SV', 'Rilevamento'].join(';')];
    for (let i = 1; i <= m.durata; i++) {
      const r = ril[i];
      righe.push([i, m.inizio ? m.etichettaTempo(i) : '', f(m.costi[i - 1]), f(m.bcwsCum[i]), f(valore('bcwp', i)), f(valore('acwp', i)),
        r ? f(r.cv) : '', r ? f(r.sv) : '', r && r.pcv !== null ? numeri.formatNumero(r.pcv, 1).replace('−', '-') : '', r && r.psv !== null ? numeri.formatNumero(r.psv, 1).replace('−', '-') : '', r ? r.n : ''].join(';'));
    }
    return '﻿' + righe.join('\r\n') + '\r\n';
  }

  const api = { celle, analizza, inDati, tabellaCSV };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { radice.CC = radice.CC || {}; radice.CC.importa = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this);
