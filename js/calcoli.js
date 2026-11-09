/* =====================================================================
 * calcoli.js — il "cervello" di CostCurve (modulo PURO, senza pagina)
 * ---------------------------------------------------------------------
 * Riceve i dati inseriti dal project manager e calcola UNA SOLA VOLTA
 * il modello completo: piano cumulato (BCWS), punti di BCWP e ACWP,
 * indicatori dei rilevamenti (CV, SV, %CV, %SV, ...), previsione,
 * curve, assi e vista (zoom). Anteprima SVG, file .tex e PDF leggono
 * tutti questo stesso modello: i numeri non possono divergere.
 *
 * Formule del libro (pagg. 198-199):
 *   CV  = BCWP - ACWP        (negativo = sforamento dei costi)
 *   SV  = BCWP - BCWS        (negativo = ritardo)
 *   %CV = CV / BCWS          %SV = SV / BCWS
 * Assunzioni dichiarate (non nel libro): CPI = BCWP/ACWP, SPI = BCWP/BCWS,
 *   EAC = BAC/CPI, durata prevista = durata pianificata / SPI.
 * ===================================================================== */
(function (radice) {
  'use strict';

  const numeri = (typeof module !== 'undefined' && module.exports)
    ? require('./numeri.js') : radice.CC.numeri;
  const f = numeri.formatNumero;

  // ---- Costanti (tutte in un posto solo) ------------------------------
  const DURATA_MAX = 120;              // periodi al massimo
  const VALORE_MAX = 1e12;             // limite ragionevole per gli importi
  const SOGLIA_CRITICA = -10;          // % sotto cui il semaforo è rosso (assunzione)
  const EPS = 1e-9;
  const PROPORZIONI = [                // larghezza / altezza dell'area del grafico
    { valore: 2, nome: 'Larga (2:1)' },
    { valore: 1.6, nome: 'Standard (16:10)' },
    { valore: 1.333, nome: 'Classica (4:3)' },
    { valore: 1, nome: 'Quadrata (1:1)' },
    { valore: 0.75, nome: 'Alta (3:4)' },
  ];

  const UNITA_TEMPO = {
    giorni:    { singolare: 'giorno',    plurale: 'giorni' },
    settimane: { singolare: 'settimana', plurale: 'settimane' },
    mesi:      { singolare: 'mese',      plurale: 'mesi' },
  };
  const UNITA_MONETA = {
    euro:     { asse: 'Euro',             breve: '€' },
    migliaia: { asse: 'Migliaia di euro', breve: 'migliaia di €' },
  };
  const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

  // Caratteri che pdflatex (T1 + utf8) sa stampare senza pacchetti extra:
  // ASCII stampabile, Latin-1, euro, virgolette e trattini tipografici.
  const AMMESSI = /[ -~ -ÿ€‘’“”–—…ŒœŠšŽžŸ]/u;

  /** Restituisce i caratteri del testo che LaTeX non saprebbe stampare. */
  function caratteriNonSupportati(testo) {
    const fuori = new Set();
    for (const c of String(testo || '').normalize('NFC')) if (!AMMESSI.test(c)) fuori.add(c);
    return [...fuori];
  }

  // ---- Dati di partenza ------------------------------------------------
  function datiVuoti(durata = 12) {
    return {
      formato: 'costcurve', versione: 2,
      titolo: '', nota: '',
      report: { pm: '', azienda: '', data: '', commento: '' },
      unitaTempo: 'mesi', unitaMoneta: 'euro', dataInizio: '',
      durata, bac: null,
      modoPiano: 'periodo', piano: new Array(durata).fill(null),
      modoAvanzamento: 'rilevamenti',
      numeroRilevamenti: 2,
      rilevamenti: [{ periodo: null, bcwp: null, acwp: null }, { periodo: null, bcwp: null, acwp: null }],
      avanzamento: new Array(durata).fill(null).map(() => ({ bcwp: null, acwp: null })),
      previsione: 'auto', previsioneManuale: { eac: null, fine: null },
      grafico: {
        proporzioni: 1.6,
        vista: { da: null, a: null, ymin: null, ymax: null },
        mostra: { bcws: true, bcwp: true, acwp: true, frecce: true, etichette: true },
      },
      esporta: { pagina: 'stessa', dimensione: 'normale', vista: 'intera' },
    };
  }

  /** Converte un valore qualsiasi (testo o numero) in numero o null/NaN. */
  const num = v => numeri.leggiNumero(v);
  const testo = v => String(v === null || v === undefined ? '' : v);

  /**
   * Mette i dati in forma "pulita": numeri veri, campi mancanti riempiti,
   * progetti salvati con la versione 1 convertiti alla versione 2.
   */
  function normalizza(grezzi) {
    const g = grezzi || {};
    const base = datiVuoti();
    const d = Object.assign(base, g);
    // compatibilità con la versione 1
    if (!Array.isArray(g.piano) && Array.isArray(g.costiPeriodo)) { d.piano = g.costiPeriodo; d.modoPiano = 'periodo'; }
    if (g.previsione === undefined && g.mostraPrevisione !== undefined) d.previsione = g.mostraPrevisione === false ? 'no' : 'auto';

    d.titolo = testo(d.titolo).replace(/\s+/g, ' ').trim();
    d.nota = testo(d.nota);
    d.report = Object.assign({ pm: '', azienda: '', data: '', commento: '' }, g.report || {});
    for (const k of Object.keys(d.report)) d.report[k] = testo(d.report[k]).trim();
    if (!UNITA_TEMPO[d.unitaTempo]) d.unitaTempo = 'mesi';
    if (!UNITA_MONETA[d.unitaMoneta]) d.unitaMoneta = 'euro';
    d.dataInizio = testo(d.dataInizio).trim();
    d.durata = num(d.durata);
    d.bac = num(d.bac);
    d.modoPiano = d.modoPiano === 'cumulato' ? 'cumulato' : 'periodo';
    d.piano = (Array.isArray(d.piano) ? d.piano : []).map(num);
    d.modoAvanzamento = d.modoAvanzamento === 'periodi' ? 'periodi' : 'rilevamenti';
    d.numeroRilevamenti = Number(d.numeroRilevamenti) === 1 ? 1 : 2;
    const r = Array.isArray(d.rilevamenti) ? d.rilevamenti : [];
    d.rilevamenti = [0, 1].map(i => ({ periodo: num(r[i] && r[i].periodo), bcwp: num(r[i] && r[i].bcwp), acwp: num(r[i] && r[i].acwp) }));
    d.avanzamento = (Array.isArray(d.avanzamento) ? d.avanzamento : []).map(a => ({ bcwp: num(a && a.bcwp), acwp: num(a && a.acwp) }));
    d.previsione = ['auto', 'manuale', 'no'].includes(d.previsione) ? d.previsione : 'auto';
    const pm = d.previsioneManuale || {};
    d.previsioneManuale = { eac: num(pm.eac), fine: num(pm.fine) };
    const gr = g.grafico || {};
    const vista = gr.vista || {};
    const prop = num(gr.proporzioni);
    d.grafico = {
      proporzioni: Number.isFinite(prop) && prop >= 0.5 && prop <= 3 ? prop : 1.6,
      vista: { da: num(vista.da), a: num(vista.a), ymin: num(vista.ymin), ymax: num(vista.ymax) },
      mostra: Object.assign({ bcws: true, bcwp: true, acwp: true, frecce: true, etichette: true }, gr.mostra || {}),
    };
    for (const k of Object.keys(d.grafico.mostra)) d.grafico.mostra[k] = d.grafico.mostra[k] !== false;
    const es = g.esporta || {};
    d.esporta = {
      pagina: es.pagina === 'orizzontale' ? 'orizzontale' : 'stessa',
      dimensione: ['normale', 'grande', 'massima'].includes(es.dimensione) ? es.dimensione : 'normale',
      vista: es.vista === 'attuale' ? 'attuale' : 'intera',
    };
    delete d.costiPeriodo; delete d.mostraPrevisione;
    d.versione = 2;
    return d;
  }

  /** Allunga o accorcia una lista quando cambia la durata. */
  function adattaLista(lista, n, vuoto = () => null) {
    const out = (lista || []).slice(0, n);
    while (out.length < n) out.push(vuoto());
    return out;
  }
  const adattaCosti = (costi, n) => adattaLista(costi, n);

  /**
   * Curva a S automatica (funzione facoltativa): distribuisce il budget
   * sui periodi seguendo s(p) = 3p² - 2p³. Restituisce i costi per
   * periodo; la somma è esattamente il budget.
   */
  function generaCurvaS(bac, n) {
    const intero = Number.isInteger(bac) && bac >= n * 10;
    const arr = v => intero ? Math.round(v) : Math.round(v * 100) / 100;
    const cum = [0];
    for (let i = 1; i <= n; i++) {
      const p = i / n;
      cum.push(i === n ? bac : arr(bac * p * p * (3 - 2 * p)));
    }
    const costi = [];
    for (let i = 1; i <= n; i++) costi.push(arr(cum[i] - cum[i - 1]));
    return costi;
  }

  // ---- Date reali (facoltative) -----------------------------------------
  /** Legge "AAAA-MM-GG" (o "GG/MM/AAAA"); restituisce una Date UTC o null. */
  function leggiData(s) {
    const t = testo(s).trim();
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
    let a, me, g;
    if (m) { a = +m[1]; me = +m[2]; g = +m[3]; }
    else if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t))) { g = +m[1]; me = +m[2]; a = +m[3]; }
    else return null;
    const d = new Date(Date.UTC(a, me - 1, g));
    return d.getUTCFullYear() === a && d.getUTCMonth() === me - 1 && d.getUTCDate() === g ? d : null;
  }

  /** Etichetta del periodo k (0 = inizio): "12/11" per giorni e settimane, "nov 26" per i mesi. */
  function etichettaData(inizio, unita, k) {
    const d = new Date(inizio.getTime());
    if (unita === 'giorni') d.setUTCDate(d.getUTCDate() + k);
    else if (unita === 'settimane') d.setUTCDate(d.getUTCDate() + 7 * k);
    else {
      // +k mesi senza "sforare": 31 gennaio + 1 mese = 28/29 febbraio, non 3 marzo
      const giorno = d.getUTCDate();
      d.setUTCDate(1);
      d.setUTCMonth(d.getUTCMonth() + k);
      const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
      d.setUTCDate(Math.min(giorno, ultimo));
    }
    const gg = String(d.getUTCDate()).padStart(2, '0'), mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    return unita === 'mesi' ? `${MESI[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}` : `${gg}/${mm}`;
  }

  // ---- Matematica delle curve (identica nel file .tex) -----------------

  /**
   * Tangenti per l'interpolazione monotona (Fritsch-Butland).
   * Primo nodo: tangente 0 (partenza "piatta" della curva a S).
   * Ultimo nodo: pendenza dell'ultimo tratto. Nodi interni: media
   * armonica pesata delle pendenze, 0 se la pendenza cambia segno.
   */
  function tangenti(nodi) {
    const n = nodi.length - 1;
    const h = [], d = [];
    for (let i = 0; i < n; i++) {
      h.push(nodi[i + 1][0] - nodi[i][0]);
      d.push((nodi[i + 1][1] - nodi[i][1]) / h[i]);
    }
    const m = new Array(n + 1).fill(0);
    m[0] = 0;
    m[n] = n > 0 ? d[n - 1] : 0;
    for (let i = 1; i < n; i++) {
      if (d[i - 1] * d[i] <= 0) m[i] = 0;
      else m[i] = 3 * (h[i - 1] + h[i]) / ((2 * h[i] + h[i - 1]) / d[i - 1] + (h[i] + 2 * h[i - 1]) / d[i]);
    }
    return m;
  }

  /** Nodi -> tratti di Bézier cubiche {x0,y0,c1x,c1y,c2x,c2y,x1,y1}. */
  function bezierMonotona(nodi) {
    if (nodi.length < 2) return [];
    const m = tangenti(nodi);
    const tratti = [];
    for (let i = 0; i < nodi.length - 1; i++) {
      const [x0, y0] = nodi[i], [x1, y1] = nodi[i + 1], h = x1 - x0;
      tratti.push({ x0, y0, c1x: x0 + h / 3, c1y: y0 + m[i] * h / 3, c2x: x1 - h / 3, c2y: y1 - m[i + 1] * h / 3, x1, y1 });
    }
    return tratti;
  }

  /**
   * Valore di una curva al tempo x. I punti di controllo stanno a 1/3 e
   * 2/3 dell'intervallo, quindi il parametro della Bézier è proprio
   * (x - x0) / h: il valore è esatto, non approssimato.
   */
  function valoreCurva(tratti, x) {
    for (const s of tratti || []) {
      if (x >= s.x0 - EPS && x <= s.x1 + EPS) {
        const t = Math.min(1, Math.max(0, (x - s.x0) / (s.x1 - s.x0))), u = 1 - t;
        return u * u * u * s.y0 + 3 * u * u * t * s.c1y + 3 * u * t * t * s.c2y + t * t * t * s.y1;
      }
    }
    return null;
  }

  /** Passo "bello" per le tacche di un asse: 1, 2, 2,5, 5 o 10 × 10^e. */
  function passoBello(v) {
    if (!(v > 0)) return 1;
    const e = Math.floor(Math.log10(v));
    const p = Math.pow(10, e);
    const fr = v / p;
    const nf = fr <= 1 + EPS ? 1 : fr <= 2 + EPS ? 2 : fr <= 2.5 + EPS ? 2.5 : fr <= 5 + EPS ? 5 : 10;
    return nf * p;
  }

  /** Passo intero per l'asse dei tempi: il primo tra 1, 2, 5, 10, 20, 50... */
  function passoTempo(ampiezza) {
    const obiettivo = ampiezza / 12;
    for (const base of [1, 10, 100, 1000]) for (const k of [1, 2, 5]) if (k * base >= obiettivo - EPS) return k * base;
    return 10000;
  }

  /** Cifre decimali da mostrare sulle tacche dell'asse dei costi (passo 0,5 -> 1 decimale). */
  function decimaliPasso(passo) {
    // il minimo numero di decimali che scrive il passo esattamente (2,5 -> 1; 25 -> 0; 0,25 -> 2)
    for (let d = 0; d <= 6; d++) if (Math.abs(Math.round(passo * Math.pow(10, d)) / Math.pow(10, d) - passo) <= 1e-9 * Math.max(1, passo)) return d;
    return 6;
  }

  /**
   * Posizioni verticali delle tre etichette di un rilevamento [ACWP, BCWS,
   * BCWP]: si ordinano i valori e si spingono verso l'alto quelle troppo
   * vicine (distanza minima "gap"). Stesso algoritmo nel file .tex.
   */
  function posizioniEtichette(valori, gap) {
    const rango = valori.map((v, i) => valori.filter((w, j) => w < v || (w === v && j < i)).length);
    const ordinati = [];
    valori.forEach((v, i) => { ordinati[rango[i]] = v; });
    const y = [ordinati[0]];
    for (let k = 1; k < ordinati.length; k++) y.push(Math.max(ordinati[k], y[k - 1] + gap));
    return rango.map(r => y[r]);
  }

  // ---- Interpretazione a parole ---------------------------------------
  const segno = v => (Math.abs(v) < EPS ? 0 : v > 0 ? 1 : -1);

  function frasi(r) {
    const quanto = (p, valore) => p !== null ? numeri.formatNumero(Math.abs(p), 1) + '%' : f(Math.abs(valore));
    const tempi = segno(r.sv) < 0 ? `In ritardo: il lavoro svolto è inferiore al pianificato del ${quanto(r.psv, r.sv)}.`
      : segno(r.sv) > 0 ? `In anticipo: il lavoro svolto supera il pianificato del ${quanto(r.psv, r.sv)}.`
      : 'In linea con i tempi: il lavoro svolto è pari al pianificato.';
    const costi = segno(r.cv) < 0 ? `Sforamento dei costi del ${quanto(r.pcv, r.cv)}.`
      : segno(r.cv) > 0 ? `Risparmio sui costi del ${quanto(r.pcv, r.cv)}.`
      : 'Costi in linea con il valore del lavoro svolto.';
    return { tempi, costi };
  }

  function semaforo(r) {
    if (segno(r.cv) >= 0 && segno(r.sv) >= 0) return { colore: 'verde', icona: '✓', parola: 'In linea' };
    const critico = (r.pcv !== null && r.pcv < SOGLIA_CRITICA) || (r.psv !== null && r.psv < SOGLIA_CRITICA);
    return critico ? { colore: 'rosso', icona: '✕', parola: 'Critico' } : { colore: 'giallo', icona: '!', parola: 'Attenzione' };
  }

  // ---- Calcolo del modello --------------------------------------------

  /**
   * Il cuore del programma: dai dati al modello completo.
   * opzioni.vistaIntera = true ignora lo zoom (per esportare tutto il progetto).
   * Restituisce sempre un oggetto; se ci sono errori, valido = false e
   * "problemi" dice in parole semplici cosa correggere.
   */
  function calcola(grezzi, opzioni = {}) {
    const d = normalizza(grezzi);
    const problemi = [];
    const errore = (campo, messaggio) => problemi.push({ livello: 'errore', campo, messaggio });
    const avviso = (campo, messaggio) => problemi.push({ livello: 'avviso', campo, messaggio });
    const ok = v => typeof v === 'number' && Number.isFinite(v);
    const ut = UNITA_TEMPO[d.unitaTempo];
    const nomiRil = ['rilevamento 1', 'rilevamento 2'];

    // 1) Progetto
    if (!d.titolo) avviso('titolo', 'Manca il titolo: nel diagramma comparirà «Progetto senza titolo».');
    const testiStampati = [d.titolo, d.nota, ...Object.values(d.report)].join(' ');
    const strani = caratteriNonSupportati(testiStampati);
    if (strani.length) avviso('titolo', `Questi simboli non si possono stampare in LaTeX e verranno tolti dal file .tex: ${strani.join(' ')}`);
    let inizio = null;
    if (d.dataInizio) {
      inizio = leggiData(d.dataInizio);
      if (!inizio) errore('dataInizio', 'La data di inizio non è valida: scrivila come 15/01/2027 oppure lasciala vuota.');
    }

    const durataOk = ok(d.durata) && Number.isInteger(d.durata) && d.durata >= 1 && d.durata <= DURATA_MAX;
    if (!durataOk) errore('durata', `La durata deve essere un numero intero di ${ut.plurale}, da 1 a ${DURATA_MAX}.`);

    if (d.bac === null) errore('bac', 'Scrivi il budget totale (BAC): quanto costa in tutto il progetto secondo il piano.');
    else if (!ok(d.bac)) errore('bac', 'Il budget totale (BAC) deve essere un numero, per esempio 540.000.');
    else if (d.bac <= 0) errore('bac', 'Il budget totale (BAC) deve essere maggiore di zero.');
    else if (d.bac > VALORE_MAX) errore('bac', 'Il budget è troppo grande: usa l\'unità «migliaia di euro».');

    // 2) Piano a budget (costi per periodo oppure valori cumulati)
    const n = durataOk ? d.durata : 0;
    const piano = adattaLista(d.piano, n);
    let pianoOk = durataOk;
    const cumulato = d.modoPiano === 'cumulato';
    piano.forEach((c, i) => {
      const campo = 'costo-' + (i + 1);
      const cosa = cumulato ? `il valore cumulato (BCWS) del ${ut.singolare} ${i + 1}` : `il costo pianificato del ${ut.singolare} ${i + 1}`;
      if (c === null) { pianoOk = false; errore(campo, `Manca ${cosa} (scrivi 0 se non è previsto nulla).`); }
      else if (!ok(c)) { pianoOk = false; errore(campo, `Controlla ${cosa}: deve essere un numero.`); }
      else if (c < 0) { pianoOk = false; errore(campo, `${cosa[0].toUpperCase() + cosa.slice(1)} non può essere negativo.`); }
      else if (c > VALORE_MAX) { pianoOk = false; errore(campo, `${cosa[0].toUpperCase() + cosa.slice(1)} è troppo grande.`); }
    });
    let costi = piano;
    if (pianoOk && cumulato) {
      costi = piano.map((v, i) => v - (i ? piano[i - 1] : 0));
      const k = costi.findIndex(c => c < -EPS);
      if (k >= 0) { pianoOk = false; errore('costo-' + (k + 1), `Il BCWS è cumulato e non può diminuire: al ${ut.singolare} ${k + 1} deve essere almeno ${f(piano[k - 1])}.`); }
      costi = costi.map(c => Math.max(0, c));
    }
    const bcwsCum = [0];
    if (pianoOk) costi.forEach(c => bcwsCum.push(cumulato ? piano[bcwsCum.length - 1] : bcwsCum[bcwsCum.length - 1] + c));
    const totalePiano = pianoOk ? bcwsCum[n] : null;
    if (pianoOk && totalePiano <= 0) { pianoOk = false; errore('piano', 'Il piano a budget è tutto a zero: inserisci almeno un valore maggiore di zero.'); }
    if (pianoOk && ok(d.bac) && d.bac > 0 && Math.abs(totalePiano - d.bac) > 0.005) {
      avviso('piano', `Il piano arriva a ${f(totalePiano)} ma il budget totale è ${f(d.bac)}. Di solito devono coincidere.`);
    }

    // 3) Rilevamenti e punti di BCWP/ACWP
    const nr = d.numeroRilevamenti;
    const ril = d.rilevamenti.slice(0, nr);
    const rilOk = ril.map(() => true);
    ril.forEach((r, i) => {
      const pre = 'ril-' + i + '-';
      if (r.periodo === null) { rilOk[i] = false; errore(pre + 'periodo', `Scegli il ${ut.singolare} del ${nomiRil[i]}.`); }
      else if (!ok(r.periodo) || !Number.isInteger(r.periodo) || r.periodo < 1 || (durataOk && r.periodo > n)) {
        rilOk[i] = false; errore(pre + 'periodo', `Il ${ut.singolare} del ${nomiRil[i]} deve essere un numero intero tra 1 e ${durataOk ? n : 'la durata'}.`);
      }
    });
    if (nr === 2 && rilOk[0] && rilOk[1]) {
      if (ril[0].periodo === ril[1].periodo) { rilOk[1] = false; errore('ril-1-periodo', `I due rilevamenti cadono nello stesso ${ut.singolare} (${ril[0].periodo}): sposta il rilevamento 2 più avanti.`); }
      else if (ril[1].periodo < ril[0].periodo) { rilOk[1] = false; errore('ril-1-periodo', `Il rilevamento 2 deve venire dopo il rilevamento 1 (ora sono ai ${ut.plurale} ${ril[0].periodo} e ${ril[1].periodo}).`); }
    }

    const NOMI = { bcwp: 'lavoro svolto a costi di budget (BCWP)', acwp: 'costo effettivamente sostenuto (ACWP)' };
    const punti = { bcwp: [], acwp: [] };       // [[periodo, valore], ...] in ordine di tempo
    const controllaValore = (campo, v, nome) => {
      if (!ok(v)) { errore(campo, `Il ${nome} deve essere un numero.`); return false; }
      if (v < 0) { errore(campo, `Il ${nome} non può essere negativo.`); return false; }
      if (v > VALORE_MAX) { errore(campo, `Il ${nome} è troppo grande.`); return false; }
      return true;
    };
    if (d.modoAvanzamento === 'rilevamenti') {
      ril.forEach((r, i) => {
        for (const k of ['bcwp', 'acwp']) {
          const campo = `ril-${i}-${k}`;
          if (r[k] === null) { rilOk[i] = false; errore(campo, `Scrivi il ${NOMI[k]} del ${nomiRil[i]}.`); }
          else if (!controllaValore(campo, r[k], `${NOMI[k]} del ${nomiRil[i]}`)) rilOk[i] = false;
          else if (rilOk[i] && ok(r.periodo)) punti[k].push([r.periodo, r[k]]);
        }
      });
    } else if (durataOk) {
      const av = adattaLista(d.avanzamento, n, () => ({ bcwp: null, acwp: null }));
      av.forEach((a, i) => {
        for (const k of ['bcwp', 'acwp']) {
          if (a[k] === null) continue;
          if (controllaValore(`av-${i + 1}-${k}`, a[k], `${NOMI[k]} del ${ut.singolare} ${i + 1}`)) punti[k].push([i + 1, a[k]]);
        }
      });
      ril.forEach((r, i) => {
        if (!rilOk[i]) return;
        const manca = ['bcwp', 'acwp'].filter(k => !punti[k].some(p => p[0] === r.periodo));
        if (manca.length) { rilOk[i] = false; errore(`av-${r.periodo}-${manca[0]}`, `Al ${ut.singolare} ${r.periodo} c'è il ${nomiRil[i]}: nella tabella servono sia BCWP sia ACWP di quel ${ut.singolare}.`); }
      });
    }
    // i valori cumulati non possono diminuire nel tempo
    for (const k of ['bcwp', 'acwp']) {
      punti[k].sort((a, b) => a[0] - b[0]);
      for (let i = 1; i < punti[k].length; i++) {
        if (punti[k][i][1] < punti[k][i - 1][1]) {
          const [t, v] = punti[k][i - 1];
          const campo = d.modoAvanzamento === 'periodi' ? `av-${punti[k][i][0]}-${k}` : `ril-${punti[k][i][0] === (ril[1] && ril[1].periodo) ? 1 : 0}-${k}`;
          errore(campo, `Il ${k.toUpperCase()} è un valore cumulato e non può diminuire: al ${ut.singolare} ${punti[k][i][0]} deve essere almeno ${f(v)} (valore del ${ut.singolare} ${t}).`);
          break;
        }
      }
    }
    if (ok(d.bac) && d.bac > 0) {
      const oltre = punti.bcwp.find(p => p[1] > d.bac + 0.005);
      if (oltre) errore(d.modoAvanzamento === 'periodi' ? `av-${oltre[0]}-bcwp` : `ril-${oltre[0] === (ril[1] && ril[1].periodo) ? 1 : 0}-bcwp`, `Il lavoro svolto (BCWP = ${f(oltre[1])}) supera l'intero budget (${f(d.bac)}): non è possibile, controlla il valore.`);
    }

    // 4) Previsione manuale
    if (d.previsione === 'manuale') {
      const pm = d.previsioneManuale;
      if (pm.eac === null || !ok(pm.eac) || pm.eac <= 0) errore('prev-eac', 'Scrivi il costo finale stimato (EAC): un numero maggiore di zero.');
      if (pm.fine === null || !ok(pm.fine) || pm.fine <= 0) errore('prev-fine', `Scrivi la fine stimata, in ${ut.plurale} dall'inizio (anche con decimali, es. 25,5).`);
      else if (durataOk && pm.fine > 5 * n) errore('prev-fine', `La fine stimata è troppo lontana: al massimo ${5 * n} ${ut.plurale}.`);
    }

    const valido = !problemi.some(p => p.livello === 'errore');
    const modello = { dati: d, problemi, valido, unitaTempo: ut, unitaMoneta: UNITA_MONETA[d.unitaMoneta] };
    modello.titolo = d.titolo || 'Progetto senza titolo';
    if (!valido) return modello;

    // ---- Da qui i dati sono coerenti: indicatori ------------------------
    modello.durata = n;
    modello.bac = d.bac;
    modello.costi = costi;
    modello.bcwsCum = bcwsCum;
    modello.totalePiano = totalePiano;
    modello.punti = punti;
    modello.inizio = inizio;
    modello.etichettaTempo = k => (inizio && Number.isInteger(k) ? etichettaData(inizio, d.unitaTempo, k) : numeri.formatNumero(k));
    const valoreA = (k, t) => (punti[k].find(p => p[0] === t) || [null, null])[1];

    modello.rilevamenti = ril.map((r, i) => {
      const t = r.periodo, bcws = bcwsCum[t];
      const x = { n: i + 1, t, bcws, bcwp: valoreA('bcwp', t), acwp: valoreA('acwp', t) };
      x.data = inizio ? etichettaData(inizio, d.unitaTempo, t) : null;
      x.cv = x.bcwp - x.acwp;
      x.sv = x.bcwp - x.bcws;
      x.pcv = bcws > 0 ? x.cv / bcws * 100 : null;
      x.psv = bcws > 0 ? x.sv / bcws * 100 : null;
      x.cpi = x.acwp > 0 ? x.bcwp / x.acwp : null;
      x.spi = bcws > 0 ? x.bcwp / bcws : null;
      x.stato = semaforo(x);
      x.frasi = frasi(x);
      if (bcws <= 0) avviso('ril-' + i + '-periodo', `Al ${ut.singolare} ${t} il piano prevede ancora 0: le percentuali del ${nomiRil[i]} non si possono calcolare (n.d.).`);
      return x;
    });

    // Curve
    const nodiBCWS = bcwsCum.map((v, i) => [i, v]);
    const nodi = k => [[0, 0], ...punti[k].filter(p => p[0] > 0)];
    modello.curve = {
      bcws: bezierMonotona(nodiBCWS),
      bcwp: bezierMonotona(nodi('bcwp')),
      acwp: bezierMonotona(nodi('acwp')),
      previsione: null,
    };

    // Previsione: automatica (assunzione) o scritta dall'utente
    const ultimo = modello.rilevamenti[modello.rilevamenti.length - 1];
    const ultimoACWP = punti.acwp[punti.acwp.length - 1];
    const prev = { modo: d.previsione, visibile: false, eac: null, durataPrevista: null, motivo: '' };
    if (d.previsione === 'auto') {
      if (ultimo.cpi && ultimo.cpi > 0) prev.eac = d.bac / ultimo.cpi;
      if (ultimo.spi && ultimo.spi > 0) prev.durataPrevista = n / ultimo.spi;
      if (prev.eac === null || prev.durataPrevista === null) prev.motivo = 'Previsione non calcolabile: servono BCWP, ACWP e BCWS maggiori di zero all\'ultimo rilevamento.';
    } else if (d.previsione === 'manuale') {
      prev.eac = d.previsioneManuale.eac;
      prev.durataPrevista = d.previsioneManuale.fine;
    }
    if (d.previsione !== 'no' && !prev.motivo) {
      if (prev.durataPrevista <= ultimoACWP[0] + EPS) prev.motivo = `La fine stimata (${numeri.formatNumero(prev.durataPrevista, 1)}) cade prima dell'ultimo costo rilevato: la curva di previsione non si disegna.`;
      else if (prev.eac < ultimoACWP[1] - EPS) prev.motivo = `Il costo finale stimato (${f(prev.eac)}) è minore di quanto già speso (${f(ultimoACWP[1])}): la curva di previsione non si disegna.`;
      else if (d.previsione === 'auto' && prev.durataPrevista > 3 * n) prev.motivo = `La fine stimata (${numeri.formatNumero(prev.durataPrevista, 1)} ${ut.plurale}) supera il triplo della durata pianificata: la curva di previsione non si disegna.`;
      else prev.visibile = true;
    }
    if (prev.visibile) {
      const [tU, aU] = ultimoACWP;
      const penultimo = punti.acwp.length > 1 ? punti.acwp[punti.acwp.length - 2] : [0, 0];
      const h = prev.durataPrevista - tU;
      const pendFine = (aU - penultimo[1]) / (tU - penultimo[0]);
      const pendMedia = (prev.eac - aU) / h;
      const m = Math.max(0, Math.min(pendFine, 3 * pendMedia));
      modello.curve.previsione = { x0: tU, y0: aU, c1x: tU + h / 3, c1y: aU + m * h / 3, c2x: prev.durataPrevista - h / 3, c2y: prev.eac, x1: prev.durataPrevista, y1: prev.eac };
    }
    modello.previsione = prev;

    // ---- Assi e vista (zoom). Stesso algoritmo del .tex ---------------
    const mostra = d.grafico.mostra;
    const yDati = Math.max(d.bac, totalePiano, ...punti.bcwp.map(p => p[1]), ...punti.acwp.map(p => p[1]), prev.visibile ? prev.eac : 0);
    const xDati = Math.max(n, prev.visibile ? prev.durataPrevista : 0);
    const pienoX = [0, xDati * 1.14];
    const passoPieno = passoBello(yDati / 6);
    const pienoY = [0, Math.ceil(yDati * 1.15 / passoPieno - EPS) * passoPieno];
    const v = opzioni.vistaIntera ? { da: null, a: null, ymin: null, ymax: null } : d.grafico.vista;
    let [xmin, xmax] = pienoX;
    let zoomato = false;
    if (ok(v.da) || ok(v.a)) {
      const da = ok(v.da) ? Math.max(0, v.da) : 0, a = ok(v.a) ? v.a : pienoX[1];
      if (a - da > 0.2) { xmin = da; xmax = a; zoomato = true; }
      else avviso('vista', 'L\'intervallo di tempo scelto è troppo piccolo: mostro tutto il progetto.');
    }
    let ymin, ymax;
    if (ok(v.ymin) && ok(v.ymax) && v.ymax > v.ymin) { ymin = v.ymin; ymax = v.ymax; zoomato = true; }
    else if (zoomato) {
      // asse dei costi adattato a ciò che si vede (in modo onesto: tacche vere, asse spezzato segnalato)
      let lo = Infinity, hi = -Infinity;
      const curveVisibili = [mostra.bcws && modello.curve.bcws, mostra.bcwp && modello.curve.bcwp, mostra.acwp && modello.curve.acwp, prev.visibile && [modello.curve.previsione]].filter(Boolean);
      for (const c of curveVisibili) {
        for (let k = 0; k <= 200; k++) {
          const x = xmin + (xmax - xmin) * k / 200;
          const y = valoreCurva(c, x);
          if (y !== null) { lo = Math.min(lo, y); hi = Math.max(hi, y); }
        }
      }
      if (!(hi > lo)) { lo = 0; hi = pienoY[1]; }
      const passo = passoBello((hi - lo) / 6);
      ymin = Math.max(0, Math.floor((lo - (hi - lo) * 0.05) / passo + EPS) * passo);
      ymax = Math.ceil((hi + (hi - lo) * 0.15) / passo - EPS) * passo;
      if (ymin < (ymax - ymin) * 0.25) ymin = 0;   // se manca poco allo zero, si parte da zero
    } else { [ymin, ymax] = pienoY; }
    const ystep = passoBello((ymax - ymin) / 6);
    const ampX = xmax - xmin, ampY = ymax - ymin;
    modello.assi = {
      xmin, xmax, ymin, ymax, ystep, xstep: passoTempo(ampX), decimaliY: decimaliPasso(ystep),
      xDati, yDati, zoomato, assePezzato: ymin > 0,
      pieno: { xmin: pienoX[0], xmax: pienoX[1], ymin: pienoY[0], ymax: pienoY[1] },
    };
    modello.frecce = {
      offSV: 0.045 * ampX, offCV: 0.13 * ampX,
      altEtichetta: [0.93, nr === 2 && (ril[1].periodo - ril[0].periodo) / ampX < 0.18 ? 0.80 : 0.93],
    };
    for (const r of modello.rilevamenti) r.etichette = posizioniEtichette([r.acwp, r.bcws, r.bcwp], 0.05 * ampY);
    modello.proporzioni = d.grafico.proporzioni;
    modello.mostra = mostra;
    // etichette dei periodi da 0 alla fine dell'asse completo (servono al .tex)
    modello.etichettePeriodi = inizio ? Array.from({ length: Math.ceil(Math.max(pienoX[1], xmax)) + 1 }, (_, k) => etichettaData(inizio, d.unitaTempo, k)) : [];
    return modello;
  }

  const api = {
    DURATA_MAX, SOGLIA_CRITICA, UNITA_TEMPO, UNITA_MONETA, PROPORZIONI,
    datiVuoti, normalizza, adattaLista, adattaCosti, generaCurvaS, caratteriNonSupportati,
    leggiData, etichettaData, tangenti, bezierMonotona, valoreCurva, passoBello, passoTempo,
    decimaliPasso, posizioniEtichette, calcola,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { radice.CC = radice.CC || {}; radice.CC.calcoli = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this);
