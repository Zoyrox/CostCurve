/* =====================================================================
 * esempi.js — progetti di esempio precaricati
 * ---------------------------------------------------------------------
 * Sono scritti qui (e non in file .json letti dalla rete) perché il sito
 * deve funzionare anche aperto con un doppio clic, senza server.
 * Gli stessi esempi si trovano come file in /esempi (per "Apri progetto").
 * ===================================================================== */
(function (radice) {
  'use strict';

  const ESEMPI = [
    {
      id: 'libro',
      nome: 'Esempio del libro (23 mesi, 540.000 €)',
      descrizione: 'Pag. 199: al mese 10 BCWS 166.000, BCWP 140.000, ACWP 180.000. Il piano mese per mese e il secondo rilevamento sono dati inventati.',
      dati: {
        formato: 'costcurve', versione: 1,
        titolo: 'Esempio del libro (pag. 199)',
        unitaTempo: 'mesi', unitaMoneta: 'euro',
        durata: 23, bac: 540000,
        // Dati inventati, ma coerenti col libro: cumulato 166.000 al mese 10, 540.000 al mese 23
        costiPeriodo: [4000, 6000, 8000, 11000, 14000, 17000, 21000, 25000, 28000, 32000,
          35000, 38000, 40000, 41000, 40000, 38000, 35000, 31000, 26000, 20000, 14000, 10000, 6000],
        rilevamenti: [
          { periodo: 10, bcwp: 140000, acwp: 180000 },   // dati del libro
          { periodo: 16, bcwp: 330000, acwp: 420000 },   // dati inventati
        ],
        mostraPrevisione: true,
        nota: 'Rilevamento 1: dati del libro (pag. 199). Piano mensile e rilevamento 2: dati inventati.',
      },
    },
    {
      id: 'curva-s',
      nome: 'Curva a S del libro (9 settimane)',
      descrizione: 'Pag. 198: BCWS cumulato 5, 10, 25, 55, 85, 120, 130, 140, 150. I rilevamenti sono dati inventati.',
      dati: {
        formato: 'costcurve', versione: 1,
        titolo: 'Planned Value (S curve) - pag. 198',
        unitaTempo: 'settimane', unitaMoneta: 'euro',
        durata: 9, bac: 150,
        costiPeriodo: [5, 5, 15, 30, 30, 35, 10, 10, 10],
        rilevamenti: [
          { periodo: 4, bcwp: 50, acwp: 60 },     // dati inventati
          { periodo: 7, bcwp: 120, acwp: 140 },   // dati inventati
        ],
        mostraPrevisione: true,
        nota: 'Piano: dati del libro (pag. 198). Rilevamenti: dati inventati.',
      },
    },
    {
      id: 'anticipo',
      nome: 'In anticipo e sotto budget (12 mesi)',
      descrizione: 'Caso con CV e SV positivi, per vedere frecce, segni e frasi "buone". Dati inventati.',
      dati: {
        formato: 'costcurve', versione: 1,
        titolo: 'Nuovo gestionale di magazzino',
        unitaTempo: 'mesi', unitaMoneta: 'migliaia',
        durata: 12, bac: 120,
        costiPeriodo: [3, 5, 8, 11, 14, 16, 16, 14, 12, 9, 7, 5],
        rilevamenti: [
          { periodo: 4, bcwp: 31, acwp: 28 },
          { periodo: 8, bcwp: 95, acwp: 88 },
        ],
        mostraPrevisione: true,
        nota: 'Dati inventati.',
      },
    },
    {
      id: 'nostro',
      nome: 'Il nostro progetto CostCurve (7 giorni)',
      descrizione: 'Baseline della nostra pianificazione (605 €). I valori dei rilevamenti sono ipotetici: sostituiscili con quelli reali.',
      dati: {
        formato: 'costcurve', versione: 1,
        titolo: 'Progetto CostCurve - monitoraggio',
        unitaTempo: 'giorni', unitaMoneta: 'euro',
        durata: 7, bac: 605,
        // costo pianificato per giorno, dalla documentazione di pianificazione (arrotondato)
        costiPeriodo: [127, 83, 83, 87, 90, 80, 55],
        rilevamenti: [
          { periodo: 4, bcwp: 350, acwp: 395 },   // valori ipotetici
          { periodo: 6, bcwp: 540, acwp: 590 },   // valori ipotetici
        ],
        mostraPrevisione: true,
        nota: 'Piano: baseline della pianificazione. Rilevamenti: valori ipotetici da sostituire con quelli reali.',
      },
    },
  ];

  const api = { ESEMPI, trova: id => ESEMPI.find(e => e.id === id) };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { radice.CC = radice.CC || {}; radice.CC.esempi = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this);
