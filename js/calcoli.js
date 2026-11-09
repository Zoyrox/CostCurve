/* =====================================================================
 * calcoli.js — il "cervello" di CostCurve (modulo PURO, senza pagina)
 * ---------------------------------------------------------------------
 * Riceve i dati inseriti dal project manager e calcola UNA SOLA VOLTA
 * il modello completo: piano cumulato (BCWS), indicatori dei due
 * rilevamenti (CV, SV, %CV, %SV, ...), previsione, curve e assi.
 * Anteprima SVG, file .tex e PDF leggono tutti questo stesso modello:
 * è l'unica fonte di verità, così i numeri non possono divergere.
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

  const UNITA_TEMPO = {
    giorni:    { singolare: 'giorno',    plurale: 'giorni' },
    settimane: { singolare: 'settimana', plurale: 'settimane' },
    mesi:      { singolare: 'mese',      plurale: 'mesi' },
  };
  const UNITA_MONETA = {
    euro:     { asse: 'Euro',             breve: '€' },
    migliaia: { asse: 'Migliaia di euro', breve: 'migliaia di €' },
  };

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
  function datiVuoti() {
    return {
      formato: 'costcurve', versione: 1,
      titolo: '', unitaTempo: 'mesi', unitaMoneta: 'euro',
      durata: 12, bac: null,
      costiPeriodo: new Array(12).fill(null),
      rilevamenti: [{ periodo: null, bcwp: null, acwp: null }, { periodo: null, bcwp: null, acwp: null }],
      mostraPrevisione: true, nota: '',
    };
  }

  /** Converte un valore qualsiasi (testo o numero) in numero o null/NaN. */
  const num = v => numeri.leggiNumero(v);

  /** Mette i dati in forma "pulita" (numeri veri, campi mancanti riempiti). */
  function normalizza(grezzi) {
    const d = Object.assign(datiVuoti(), grezzi || {});
    d.titolo = String(d.titolo || '').replace(/\s+/g, ' ').trim();
    if (!UNITA_TEMPO[d.unitaTempo]) d.unitaTempo = 'mesi';
    if (!UNITA_MONETA[d.unitaMoneta]) d.unitaMoneta = 'euro';
    d.durata = num(d.durata);
    d.bac = num(d.bac);
    d.costiPeriodo = (Array.isArray(d.costiPeriodo) ? d.costiPeriodo : []).map(num);
    const r = Array.isArray(d.rilevamenti) ? d.rilevamenti : [];
    d.rilevamenti = [0, 1].map(i => ({
      periodo: num(r[i] && r[i].periodo),
      bcwp: num(r[i] && r[i].bcwp),
      acwp: num(r[i] && r[i].acwp),
    }));
    d.mostraPrevisione = d.mostraPrevisione !== false;
    d.nota = String(d.nota || '');
    return d;
  }

  /** Allunga o accorcia la lista dei costi quando cambia la durata. */
  function adattaCosti(costi, n) {
    const out = (costi || []).slice(0, n);
    while (out.length < n) out.push(null);
    return out;
  }

  /**
   * Curva a S automatica (funzione facoltativa): distribuisce il budget
   * sui periodi seguendo s(p) = 3p² - 2p³, che parte piano, accelera a
   * metà e rallenta alla fine. I cumulati vengono arrotondati, poi si
   * fanno le differenze: la somma è esattamente il budget.
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

  /**
   * Trasforma i nodi in tratti di Bézier cubiche (uno per intervallo).
   * Ogni tratto: {x0,y0, c1x,c1y, c2x,c2y, x1,y1}. SVG e TikZ disegnano
   * esattamente queste curve.
   */
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
  function passoTempo(xDati) {
    const obiettivo = xDati / 12;
    for (const base of [1, 10, 100, 1000]) for (const k of [1, 2, 5]) if (k * base >= obiettivo - EPS) return k * base;
    return 10000;
  }

  /**
   * Posizioni verticali delle tre etichette di un rilevamento, nell'ordine
   * [ACWP, BCWS, BCWP]. Si ordinano i valori (a parità vince l'ordine
   * dell'elenco) e si spingono verso l'alto quelle troppo vicine, con
   * distanza minima "gap". Stesso algoritmo nel file .tex.
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
   * Restituisce sempre un oggetto; se ci sono errori, valido = false e
   * l'elenco "problemi" dice in parole semplici cosa correggere.
   */
  function calcola(grezzi) {
    const d = normalizza(grezzi);
    const problemi = [];
    const errore = (campo, messaggio) => problemi.push({ livello: 'errore', campo, messaggio });
    const avviso = (campo, messaggio) => problemi.push({ livello: 'avviso', campo, messaggio });
    const ok = v => typeof v === 'number' && Number.isFinite(v);
    const ut = UNITA_TEMPO[d.unitaTempo];

    // 1) Progetto
    if (!d.titolo) avviso('titolo', 'Manca il titolo: nel diagramma comparirà «Progetto senza titolo».');
    const strani = caratteriNonSupportati(d.titolo);
    if (strani.length) avviso('titolo', `Questi simboli del titolo non si possono stampare in LaTeX e verranno tolti dal file .tex: ${strani.join(' ')}`);

    const durataOk = ok(d.durata) && Number.isInteger(d.durata) && d.durata >= 1 && d.durata <= DURATA_MAX;
    if (!durataOk) errore('durata', `La durata deve essere un numero intero di ${ut.plurale}, da 1 a ${DURATA_MAX}.`);

    if (d.bac === null) errore('bac', 'Scrivi il budget totale (BAC): quanto costa in tutto il progetto secondo il piano.');
    else if (!ok(d.bac)) errore('bac', 'Il budget totale (BAC) deve essere un numero, per esempio 540.000.');
    else if (d.bac <= 0) errore('bac', 'Il budget totale (BAC) deve essere maggiore di zero.');
    else if (d.bac > VALORE_MAX) errore('bac', 'Il budget è troppo grande: usa l\'unità «migliaia di euro».');

    // 2) Piano a budget
    const n = durataOk ? d.durata : 0;
    const costi = adattaCosti(d.costiPeriodo, n);
    let pianoOk = durataOk;
    costi.forEach((c, i) => {
      const campo = 'costo-' + (i + 1);
      if (c === null) { pianoOk = false; errore(campo, `Manca il costo pianificato del ${ut.singolare} ${i + 1} (scrivi 0 se in quel periodo non è previsto nulla).`); }
      else if (!ok(c)) { pianoOk = false; errore(campo, `Il costo del ${ut.singolare} ${i + 1} deve essere un numero.`); }
      else if (c < 0) { pianoOk = false; errore(campo, `Il costo del ${ut.singolare} ${i + 1} non può essere negativo.`); }
      else if (c > VALORE_MAX) { pianoOk = false; errore(campo, `Il costo del ${ut.singolare} ${i + 1} è troppo grande.`); }
    });
    const bcwsCum = [0];
    if (pianoOk) costi.forEach(c => bcwsCum.push(bcwsCum[bcwsCum.length - 1] + c));
    const totalePiano = pianoOk ? bcwsCum[n] : null;
    if (pianoOk && totalePiano <= 0) { pianoOk = false; errore('piano', 'Il piano a budget è tutto a zero: inserisci il costo previsto in almeno un periodo.'); }
    if (pianoOk && ok(d.bac) && d.bac > 0 && Math.abs(totalePiano - d.bac) > 0.005) {
      avviso('piano', `La somma dei costi per periodo (${f(totalePiano)}) è diversa dal budget totale (${f(d.bac)}). Di solito devono coincidere: la curva BCWS arriva a ${f(totalePiano)}.`);
    }

    // 3) Rilevamenti
    const nomi = ['rilevamento 1', 'rilevamento 2'];
    const rilOk = [true, true];
    d.rilevamenti.forEach((r, i) => {
      const pre = 'ril-' + i + '-';
      if (r.periodo === null) { rilOk[i] = false; errore(pre + 'periodo', `Scegli il ${ut.singolare} del ${nomi[i]}.`); }
      else if (!ok(r.periodo) || !Number.isInteger(r.periodo) || r.periodo < 1 || (durataOk && r.periodo > n)) {
        rilOk[i] = false; errore(pre + 'periodo', `Il ${ut.singolare} del ${nomi[i]} deve essere un numero intero tra 1 e ${durataOk ? n : 'la durata'}.`);
      }
      for (const [k, nome] of [['bcwp', 'lavoro svolto a costi di budget (BCWP)'], ['acwp', 'costo effettivamente sostenuto (ACWP)']]) {
        if (r[k] === null) { rilOk[i] = false; errore(pre + k, `Scrivi il ${nome} del ${nomi[i]}.`); }
        else if (!ok(r[k])) { rilOk[i] = false; errore(pre + k, `Il ${nome} del ${nomi[i]} deve essere un numero.`); }
        else if (r[k] < 0) { rilOk[i] = false; errore(pre + k, `Il ${nome} del ${nomi[i]} non può essere negativo.`); }
        else if (r[k] > VALORE_MAX) { rilOk[i] = false; errore(pre + k, `Il ${nome} del ${nomi[i]} è troppo grande.`); }
      }
      if (rilOk[i] && ok(d.bac) && d.bac > 0 && r.bcwp > d.bac + 0.005) {
        rilOk[i] = false; errore(pre + 'bcwp', `Nel ${nomi[i]} il lavoro svolto (BCWP = ${f(r.bcwp)}) supera l'intero budget (${f(d.bac)}): non è possibile, controlla il valore.`);
      }
    });
    const [r1, r2] = d.rilevamenti;
    if (rilOk[0] && rilOk[1]) {
      if (r1.periodo === r2.periodo) { rilOk[1] = false; errore('ril-1-periodo', `I due rilevamenti cadono nello stesso ${ut.singolare} (${r1.periodo}): sposta il rilevamento 2 più avanti.`); }
      else if (r2.periodo < r1.periodo) { rilOk[1] = false; errore('ril-1-periodo', `Il rilevamento 2 deve venire dopo il rilevamento 1 (ora sono ai ${ut.plurale} ${r1.periodo} e ${r2.periodo}): scambiali o correggi i periodi.`); }
      else {
        if (r2.bcwp < r1.bcwp) { rilOk[1] = false; errore('ril-1-bcwp', `Il BCWP è un valore cumulato e non può diminuire: al rilevamento 2 deve essere almeno ${f(r1.bcwp)}.`); }
        if (r2.acwp < r1.acwp) { rilOk[1] = false; errore('ril-1-acwp', `L'ACWP è un costo cumulato e non può diminuire: al rilevamento 2 deve essere almeno ${f(r1.acwp)}.`); }
      }
    }

    const valido = !problemi.some(p => p.livello === 'errore');
    const modello = { dati: d, problemi, valido, unitaTempo: ut, unitaMoneta: UNITA_MONETA[d.unitaMoneta] };
    modello.titolo = d.titolo || 'Progetto senza titolo';
    if (!valido) return modello;

    // ---- Da qui i dati sono coerenti: calcolo degli indicatori ----------
    modello.durata = n;
    modello.bac = d.bac;
    modello.costi = costi;
    modello.bcwsCum = bcwsCum;
    modello.totalePiano = totalePiano;

    modello.rilevamenti = d.rilevamenti.map((r, i) => {
      const t = r.periodo, bcws = bcwsCum[t];
      const x = { n: i + 1, t, bcws, bcwp: r.bcwp, acwp: r.acwp };
      x.cv = x.bcwp - x.acwp;
      x.sv = x.bcwp - x.bcws;
      x.pcv = bcws > 0 ? x.cv / bcws * 100 : null;
      x.psv = bcws > 0 ? x.sv / bcws * 100 : null;
      x.cpi = x.acwp > 0 ? x.bcwp / x.acwp : null;
      x.spi = bcws > 0 ? x.bcwp / bcws : null;
      x.stato = semaforo(x);
      x.frasi = frasi(x);
      if (bcws <= 0) avviso('ril-' + i + '-periodo', `Al ${ut.singolare} ${t} il piano prevede ancora 0: le percentuali del ${nomi[i]} non si possono calcolare (n.d.).`);
      return x;
    });

    // Previsione (assunzione dichiarata), basata sull'ultimo rilevamento
    const u = modello.rilevamenti[1], pre = modello.rilevamenti[0];
    const prev = { richiesta: d.mostraPrevisione, visibile: false, eac: null, durataPrevista: null, motivo: '' };
    if (u.cpi && u.cpi > 0) prev.eac = d.bac / u.cpi;
    if (u.spi && u.spi > 0) prev.durataPrevista = n / u.spi;
    if (prev.eac === null || prev.durataPrevista === null) prev.motivo = 'Previsione non calcolabile: servono BCWP, ACWP e BCWS maggiori di zero all\'ultimo rilevamento.';
    else if (prev.durataPrevista <= u.t + EPS) prev.motivo = `La fine stimata (${numeri.formatNumero(prev.durataPrevista, 1)}) cade prima dell'ultimo rilevamento: la curva di previsione non si disegna.`;
    else if (prev.durataPrevista > 3 * n) prev.motivo = `La fine stimata (${numeri.formatNumero(prev.durataPrevista, 1)} ${ut.plurale}) supera il triplo della durata pianificata: la curva di previsione non si disegna.`;
    else prev.visibile = d.mostraPrevisione;
    modello.previsione = prev;

    // Curve (nodi e tratti di Bézier)
    const nodiBCWS = bcwsCum.map((v, i) => [i, v]);
    const nodiBCWP = [[0, 0], [pre.t, pre.bcwp], [u.t, u.bcwp]];
    const nodiACWP = [[0, 0], [pre.t, pre.acwp], [u.t, u.acwp]];
    modello.curve = {
      bcws: bezierMonotona(nodiBCWS),
      bcwp: bezierMonotona(nodiBCWP),
      acwp: bezierMonotona(nodiACWP),
      previsione: null,
    };
    if (prev.visibile) {
      const h = prev.durataPrevista - u.t;
      const pendFine = (u.acwp - pre.acwp) / (u.t - pre.t);
      const pendMedia = (prev.eac - u.acwp) / h;
      const m = Math.max(0, Math.min(pendFine, 3 * pendMedia));
      modello.curve.previsione = { x0: u.t, y0: u.acwp, c1x: u.t + h / 3, c1y: u.acwp + m * h / 3, c2x: prev.durataPrevista - h / 3, c2y: prev.eac, x1: prev.durataPrevista, y1: prev.eac };
    }

    // Assi (stesso algoritmo del .tex)
    const yDati = Math.max(d.bac, totalePiano, r1.bcwp, r1.acwp, r2.bcwp, r2.acwp, prev.visibile ? prev.eac : 0);
    const ystep = passoBello(yDati / 6);
    const ymax = Math.ceil(yDati * 1.15 / ystep - EPS) * ystep;
    const xDati = Math.max(n, prev.visibile ? prev.durataPrevista : 0);
    modello.assi = { xDati, xmax: xDati * 1.14, xstep: passoTempo(xDati), yDati, ymax, ystep };
    modello.frecce = { offSV: 0.045 * modello.assi.xmax, offCV: 0.13 * modello.assi.xmax };
    // Etichette dei punti (ACWP, BCWS, BCWP) distanziate se i valori sono vicini
    for (const r of modello.rilevamenti) r.etichette = posizioniEtichette([r.acwp, r.bcws, r.bcwp], 0.05 * ymax);
    // Se i due rilevamenti sono vicini, l'etichetta del secondo scende un po'
    modello.frecce.altEtichetta = [0.93, (r2.periodo - r1.periodo) / modello.assi.xmax < 0.18 ? 0.80 : 0.93];
    modello.problemi = problemi;
    return modello;
  }

  const api = {
    DURATA_MAX, SOGLIA_CRITICA, UNITA_TEMPO, UNITA_MONETA,
    datiVuoti, normalizza, adattaCosti, generaCurvaS, caratteriNonSupportati,
    tangenti, bezierMonotona, passoBello, passoTempo, posizioniEtichette, calcola,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { radice.CC = radice.CC || {}; radice.CC.calcoli = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this);
