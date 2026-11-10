/* =====================================================================
 * esempi.js — progetti di esempio
 * ---------------------------------------------------------------------
 * Scritti qui (e non letti dalla rete) perché il sito deve funzionare
 * anche aperto con un doppio clic, senza server. Gli stessi esempi sono
 * anche file .json nella cartella /esempi (per "Apri progetto").
 * ===================================================================== */
(function (radice) {
  'use strict';

  const ESEMPI = [
    {
      id: 'grafico-libro',
      nome: 'Grafico del libro (pag. 199, figura)',
      descrizione: 'Ricrea la figura "Period breakdown of progress analysis": un rilevamento al tempo 5, curve inserite periodo per periodo, previsione disegnata a mano. Valori letti dalla figura (approssimati).',
      dati: {
        formato: 'costcurve', versione: 2,
        titolo: 'Period breakdown of progress analysis',
        nota: 'Valori letti dalla figura del libro, pag. 199 (approssimati al decimo).',
        unitaTempo: 'mesi', unitaMoneta: 'migliaia',
        durata: 7, bac: 3.7,
        modoPiano: 'cumulato',
        piano: [0, 0.25, 0.75, 1.6, 2.6, 3.35, 3.7],
        modoAvanzamento: 'periodi',
        numeroRilevamenti: 1,
        rilevamenti: [{ periodo: 5 }, { periodo: null }],
        avanzamento: [
          { bcwp: 0, acwp: 0 }, { bcwp: 0.12, acwp: 0.65 }, { bcwp: 0.3, acwp: 1.9 },
          { bcwp: 0.6, acwp: 4 }, { bcwp: 0.9, acwp: 5.35 }, { bcwp: null, acwp: null }, { bcwp: null, acwp: null },
        ],
        previsione: 'manuale', previsioneManuale: { eac: 7.2, fine: 7.9 },
      },
    },
    {
      id: 'libro',
      nome: 'Esempio numerico del libro (23 mesi, 540.000 €)',
      descrizione: 'Pag. 199: al mese 10 BCWS 166.000, BCWP 140.000, ACWP 180.000. Il piano mese per mese e il secondo rilevamento sono dati inventati.',
      dati: {
        formato: 'costcurve', versione: 2,
        titolo: 'Esempio del libro (pag. 199)',
        nota: 'Rilevamento 1: dati del libro (pag. 199). Piano mensile e rilevamento 2: dati inventati.',
        unitaTempo: 'mesi', unitaMoneta: 'euro',
        durata: 23, bac: 540000,
        // Dati inventati, ma coerenti col libro: cumulato 166.000 al mese 10, 540.000 al mese 23
        modoPiano: 'periodo',
        piano: [4000, 6000, 8000, 11000, 14000, 17000, 21000, 25000, 28000, 32000,
          35000, 38000, 40000, 41000, 40000, 38000, 35000, 31000, 26000, 20000, 14000, 10000, 6000],
        modoAvanzamento: 'rilevamenti',
        numeroRilevamenti: 2,
        rilevamenti: [
          { periodo: 10, bcwp: 140000, acwp: 180000 },   // dati del libro
          { periodo: 16, bcwp: 330000, acwp: 420000 },   // dati inventati
        ],
        previsione: 'auto',
      },
    },
    {
      id: 'curva-s',
      nome: 'Curva a S del libro (9 settimane)',
      descrizione: 'Pag. 198: BCWS cumulato 5, 10, 25, 55, 85, 120, 130, 140, 150. I rilevamenti sono dati inventati.',
      dati: {
        formato: 'costcurve', versione: 2,
        titolo: 'Planned Value (S curve) - pag. 198',
        nota: 'Piano: dati del libro (pag. 198). Rilevamenti: dati inventati.',
        unitaTempo: 'settimane', unitaMoneta: 'euro',
        durata: 9, bac: 150,
        modoPiano: 'cumulato',
        piano: [5, 10, 25, 55, 85, 120, 130, 140, 150],
        modoAvanzamento: 'rilevamenti',
        numeroRilevamenti: 2,
        rilevamenti: [{ periodo: 4, bcwp: 50, acwp: 60 }, { periodo: 7, bcwp: 120, acwp: 140 }],
        previsione: 'auto',
      },
    },
    {
      id: 'anticipo',
      nome: 'In anticipo e sotto budget (12 mesi)',
      descrizione: 'Caso con CV e SV positivi, con le date reali sull\'asse dei tempi. Dati inventati.',
      dati: {
        formato: 'costcurve', versione: 2,
        titolo: 'Nuovo gestionale di magazzino',
        nota: 'Dati inventati.',
        report: { pm: 'Mario Rossi', azienda: 'Logistica Nord S.r.l.', data: '', commento: '' },
        unitaTempo: 'mesi', unitaMoneta: 'migliaia', dataInizio: '2027-01-01',
        durata: 12, bac: 120,
        modoPiano: 'periodo',
        piano: [3, 5, 8, 11, 14, 16, 16, 14, 12, 9, 7, 5],
        modoAvanzamento: 'periodi',
        numeroRilevamenti: 2,
        rilevamenti: [{ periodo: 4 }, { periodo: 8 }],
        avanzamento: [
          { bcwp: 3.5, acwp: 3.2 }, { bcwp: 9, acwp: 8.3 }, { bcwp: 19, acwp: 17.5 }, { bcwp: 31, acwp: 28 },
          { bcwp: 46, acwp: 42 }, { bcwp: 62, acwp: 57 }, { bcwp: 79, acwp: 73 }, { bcwp: 95, acwp: 88 },
          { bcwp: null, acwp: null }, { bcwp: null, acwp: null }, { bcwp: null, acwp: null }, { bcwp: null, acwp: null },
        ],
        previsione: 'auto',
      },
    },
  ];

  const api = { ESEMPI, trova: id => ESEMPI.find(e => e.id === id) };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { radice.CC = radice.CC || {}; radice.CC.esempi = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this);
