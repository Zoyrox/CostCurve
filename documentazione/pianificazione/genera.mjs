// =====================================================================
// Generatore della documentazione di pianificazione (Fase 1)
// ---------------------------------------------------------------------
// Tutti i numeri del documento (ore, costi, cammino critico, Gantt,
// baseline) vengono CALCOLATI da qui, partendo dai dati delle attività.
// Così se cambio una stima, tutto il documento si aggiorna da solo.
//
// Uso:  node documentazione/pianificazione/genera.mjs
// Crea: pianificazione.html, gantt.svg, baseline.svg
// =====================================================================

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const QUI = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------
// 1. RISORSE (servizi richiesti dalla consegna) e tariffe IPOTIZZATE
// ---------------------------------------------------------------------
const RISORSE = {
  PM:   { nome: 'Project management',     chi: 'studente nel ruolo di project manager',                    tariffa: 40, colore: '#0072B2' },
  CONS: { nome: 'Servizi di consulenza',  chi: 'esperto LaTeX ed earned value (assistente AI, verifiche del docente)', tariffa: 50, colore: '#CC79A7' },
  ESE:  { nome: 'Esecuzione informatica', chi: 'sviluppo e test (studente con supporto AI)',                tariffa: 30, colore: '#009E73' },
};

// ---------------------------------------------------------------------
// 2. ATTIVITÀ di QUESTO progetto (ore per risorsa e precedenze)
// ---------------------------------------------------------------------
const ATTIVITA = [
  { id: 'A1',  wbs: '1.1', nome: 'Avvio e analisi dei requisiti',
    desc: 'Lettura della consegna, della lezione registrata e delle pagine 193-199 del libro; verifica delle formule CV, SV, %CV, %SV sull\'esempio numerico (mese 10: SV = -26.000, CV = -40.000).',
    ore: { PM: 0.5, CONS: 0.5 }, prec: [] },
  { id: 'A2',  wbs: '1.2', nome: 'Pianificazione (questo documento)',
    desc: 'WBS, stime bottom-up, Gantt, baseline, criteri di scelta, condizioni di realizzabilità, rischi. Consegnato a fine ora di laboratorio.',
    ore: { PM: 1.5 }, prec: ['A1'] },
  { id: 'A3',  wbs: '2.1', nome: 'Prototipo LaTeX (prova tecnica)',
    desc: 'Primo file .tex minimo con pgfplots: tre curve, una linea di rilevamento, un numero calcolato da una macro. Serve a ridurre subito il rischio "LaTeX sconosciuto".',
    ore: { CONS: 1, ESE: 0.5 }, prec: ['A1'] },
  { id: 'A4',  wbs: '2.2', nome: 'Progettazione di interfaccia e dati',
    desc: 'Schermate a passi (wireframe), modello dei dati in JSON, struttura dei file, specifica del .tex (sezione DATI separata dal DISEGNO).',
    ore: { ESE: 0.5, CONS: 0.5 }, prec: ['A2', 'A3'] },
  { id: 'A5',  wbs: '3.1', nome: 'Modulo di calcolo e test automatici',
    desc: 'BCWS cumulato, CV, SV, %CV, %SV, interpolazione monotona delle curve, controlli sui dati; test con i numeri del libro.',
    ore: { ESE: 1.5 }, prec: ['A4'] },
  { id: 'A6',  wbs: '3.2', nome: 'Generatore del file .tex',
    desc: 'Documento LaTeX autonomo e parametrico (calcoli fatti in LaTeX dalle macro), gestione dei caratteri speciali, verifica di compilazione con pdflatex.',
    ore: { ESE: 1.5, CONS: 1 }, prec: ['A5'] },
  { id: 'A7',  wbs: '3.3', nome: 'Anteprima SVG del diagramma',
    desc: 'Disegno nel browser delle tre curve, dei due rilevamenti, delle frecce CV e SV e della legenda, nello stile del grafico del libro.',
    ore: { ESE: 2 }, prec: ['A5'] },
  { id: 'A8',  wbs: '3.4', nome: 'Interfaccia, validazioni e salvataggio',
    desc: 'Flusso in 4 passi, messaggi di errore in linguaggio semplice, esempio precaricato, salvataggio automatico e su file.',
    ore: { ESE: 2 }, prec: ['A7'] },
  { id: 'A9',  wbs: '3.5', nome: 'Report PDF e stampa',
    desc: 'Foglio di stampa A4 e pulsante "Scarica PDF" con grafico vettoriale.',
    ore: { ESE: 1 }, prec: ['A8'] },
  { id: 'A10', wbs: '4.1', nome: 'Collaudo end-to-end',
    desc: 'Test 1-4 (libro, curva a S, caso positivo, casi limite); confronto di numeri e aspetto tra anteprima, PDF e .tex compilato.',
    ore: { ESE: 1, PM: 0.5 }, prec: ['A6', 'A9'] },
  { id: 'A11', wbs: '4.2', nome: 'Pubblicazione su GitHub Pages',
    desc: 'Caricamento del sito nel repository, attivazione di Pages, controllo del link su PC e telefono.',
    ore: { ESE: 0.5 }, prec: ['A10'] },
  { id: 'A12', wbs: '1.3', nome: 'Guida d\'uso, README e consegna',
    desc: 'Guida di una pagina per il PM, README, checklist rispetto alla consegna, pacchetto finale.',
    ore: { PM: 1 }, prec: ['A11'] },
];

const WBS = [
  { codice: '1', nome: 'Gestione del progetto', attivita: ['A1', 'A2', 'A12'] },
  { codice: '2', nome: 'Progettazione',          attivita: ['A3', 'A4'] },
  { codice: '3', nome: 'Realizzazione',          attivita: ['A5', 'A6', 'A7', 'A8', 'A9'] },
  { codice: '4', nome: 'Collaudo e rilascio',    attivita: ['A10', 'A11'] },
];

// ---------------------------------------------------------------------
// 3. CALENDARIO: 1 persona, massimo 3 ore al giorno (vincolo dichiarato)
//    Ogni riga: [giorno, attività, ore] nell'ordine in cui si lavora.
// ---------------------------------------------------------------------
const GIORNI = [
  { data: '2026-11-06', etichetta: 'ven 6' },
  { data: '2026-11-07', etichetta: 'sab 7' },
  { data: '2026-11-08', etichetta: 'dom 8' },
  { data: '2026-11-09', etichetta: 'lun 9' },
  { data: '2026-11-10', etichetta: 'mar 10' },
  { data: '2026-11-11', etichetta: 'mer 11' },
  { data: '2026-11-12', etichetta: 'gio 12' },
  { data: '2026-11-13', etichetta: 'ven 13' },
];
const ORE_MAX_GIORNO = 3;
const PIANO = [
  [0, 'A1', 1], [0, 'A2', 1.5], [0, 'A3', 0.5],
  [1, 'A3', 1], [1, 'A4', 1],
  [2, 'A5', 1.5], [2, 'A6', 1],
  [3, 'A6', 1.5], [3, 'A7', 1],
  [4, 'A7', 1], [4, 'A8', 2],
  [5, 'A9', 1], [5, 'A10', 1.5],
  [6, 'A11', 0.5], [6, 'A12', 1],
];
// Riserva di gestione (management reserve), in ore di esecuzione informatica
const RISERVA = { ore: 3, risorsa: 'ESE', giorni: [[6, 1.5], [7, 1.5]] };

// ---------------------------------------------------------------------
// 4. CALCOLI
// ---------------------------------------------------------------------
const perId = Object.fromEntries(ATTIVITA.map(a => [a.id, a]));
for (const a of ATTIVITA) {
  a.oreTot = Object.values(a.ore).reduce((s, x) => s + x, 0);
  a.costo = Object.entries(a.ore).reduce((s, [r, h]) => s + h * RISORSE[r].tariffa, 0);
}
const oreTotali = ATTIVITA.reduce((s, a) => s + a.oreTot, 0);
const baselineEuro = ATTIVITA.reduce((s, a) => s + a.costo, 0);
const riservaEuro = RISERVA.ore * RISORSE[RISERVA.risorsa].tariffa;
const budgetBase = baselineEuro + riservaEuro;
const orePerRisorsa = Object.fromEntries(Object.keys(RISORSE).map(r =>
  [r, ATTIVITA.reduce((s, a) => s + (a.ore[r] || 0), 0)]));

// Cammino critico sulla rete logica (CPM, durate in ore, risorse illimitate)
const ordine = [...ATTIVITA]; // già in ordine topologico
for (const a of ordine) {
  a.ES = Math.max(0, ...a.prec.map(p => perId[p].EF));
  a.EF = a.ES + a.oreTot;
}
const durataLogica = Math.max(...ATTIVITA.map(a => a.EF));
for (const a of [...ordine].reverse()) {
  const succ = ATTIVITA.filter(b => b.prec.includes(a.id));
  a.LF = succ.length ? Math.min(...succ.map(b => b.LS)) : durataLogica;
  a.LS = a.LF - a.oreTot;
  a.slack = +(a.LS - a.ES).toFixed(2);
  a.critica = Math.abs(a.slack) < 1e-9;
}

// Posizionamento nel calendario reale + controlli di coerenza
const segmenti = [];
const oreGiorno = GIORNI.map(() => 0);
const oreFatte = {};
let cursore = 0; // ore lavorate in serie
for (const [g, id, h] of PIANO) {
  const inizio = oreGiorno[g];
  segmenti.push({ g, id, inizio, h });
  oreGiorno[g] += h;
  oreFatte[id] = (oreFatte[id] || 0) + h;
  perId[id].inizioSerie ??= cursore;
  cursore += h;
  perId[id].fineSerie = cursore;
  perId[id].primoGiorno ??= g;
  perId[id].ultimoGiorno = g;
}
const errori = [];
oreGiorno.forEach((h, g) => { if (h > ORE_MAX_GIORNO) errori.push(`${GIORNI[g].etichetta}: ${h} ore > ${ORE_MAX_GIORNO}`); });
for (const a of ATTIVITA) {
  if (Math.abs((oreFatte[a.id] || 0) - a.oreTot) > 1e-9) errori.push(`${a.id}: pianificate ${oreFatte[a.id]} ore su ${a.oreTot}`);
  for (const p of a.prec) {
    // la sovrapposizione A2/A3 è voluta: A3 dipende solo da A1
    if (perId[p].fineSerie > a.inizioSerie + 1e-9) errori.push(`${a.id} inizia prima della fine di ${p}`);
  }
}
for (const [g, h] of RISERVA.giorni) if (oreGiorno[g] + h > ORE_MAX_GIORNO) errori.push(`riserva oltre capacità il ${GIORNI[g].etichetta}`);
if (errori.length) { console.error('ERRORI NEL PIANO:\n' + errori.join('\n')); process.exit(1); }

// Baseline costi-tempi: costo cumulato a fine giornata
const costoGiorno = GIORNI.map(() => 0);
for (const s of segmenti) {
  const a = perId[s.id];
  costoGiorno[s.g] += s.h * (a.costo / a.oreTot);
}
let cum = 0;
const baselineCum = costoGiorno.map(c => (cum += c));

// ---------------------------------------------------------------------
// 5. FORMATTAZIONE (numeri all'italiana)
// ---------------------------------------------------------------------
const fmtOre = h => (Number.isInteger(h) ? String(h) : h.toFixed(1).replace('.', ',')) + (h === 1 ? ' ora' : ' ore');
const fmtEuro = x => x.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---------------------------------------------------------------------
// 6. FIGURA: GANTT (SVG)
// ---------------------------------------------------------------------
function gantt() {
  const sx = 210, larGiorno = 66, oreW = larGiorno / ORE_MAX_GIORNO;
  const top = 46, rigaH = 22;
  const righe = [...ATTIVITA.map(a => ({ tipo: 'att', a })), { tipo: 'ris' }, { tipo: 'mil', nome: 'Consegna documentazione', g: 0, ora: 2.5 }, { tipo: 'mil', nome: 'Consegna prodotto (lab.)', g: 7, ora: 0.2 }];
  const W = sx + larGiorno * GIORNI.length + 12, H = top + righe.length * rigaH + 40;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Helvetica, Arial, sans-serif" role="img" aria-label="Diagramma di Gantt del progetto">`;
  s += `<rect width="${W}" height="${H}" fill="#fff"/>`;
  // colonne dei giorni
  GIORNI.forEach((d, g) => {
    const x = sx + g * larGiorno;
    s += `<rect x="${x}" y="${top - 26}" width="${larGiorno}" height="${righe.length * rigaH + 26}" fill="${g % 2 ? '#f6f3ec' : '#fbfaf6'}"/>`;
    s += `<text x="${x + larGiorno / 2}" y="${top - 10}" font-size="11" text-anchor="middle" fill="#1b2a3a" font-weight="bold">${d.etichetta}</text>`;
    for (let k = 1; k < ORE_MAX_GIORNO; k++) s += `<line x1="${x + k * oreW}" y1="${top}" x2="${x + k * oreW}" y2="${top + righe.length * rigaH}" stroke="#e4ded0" stroke-width="0.6"/>`;
    s += `<line x1="${x}" y1="${top - 26}" x2="${x}" y2="${top + righe.length * rigaH}" stroke="#cfc6b3" stroke-width="0.8"/>`;
  });
  s += `<text x="8" y="${top - 10}" font-size="11" fill="#5b6675">Attività (ore)</text>`;
  righe.forEach((r, i) => {
    const y = top + i * rigaH;
    if (i % 2 === 0) s += `<rect x="0" y="${y}" width="${sx}" height="${rigaH}" fill="#f6f3ec"/>`;
    if (r.tipo === 'att') {
      const a = r.a;
      s += `<text x="8" y="${y + 15}" font-size="10.5" fill="#1b2a3a"><tspan font-weight="bold">${a.id}</tspan> ${esc(a.nome.length > 30 ? a.nome.slice(0, 29) + '…' : a.nome)} (${String(a.oreTot).replace('.', ',')})</text>`;
      for (const sg of segmenti.filter(z => z.id === a.id)) {
        const x = sx + sg.g * larGiorno + sg.inizio * oreW;
        s += `<rect x="${x + 0.8}" y="${y + 4}" width="${sg.h * oreW - 1.6}" height="${rigaH - 8}" rx="2.5" fill="${a.critica ? '#D55E00' : '#0072B2'}"/>`;
      }
    } else if (r.tipo === 'ris') {
      s += `<text x="8" y="${y + 15}" font-size="10.5" fill="#1b2a3a" font-style="italic">Riserva di gestione (${RISERVA.ore})</text>`;
      for (const [g, h] of RISERVA.giorni) {
        const x = sx + g * larGiorno + oreGiorno[g] * oreW;
        s += `<rect x="${x + 0.8}" y="${y + 4}" width="${h * oreW - 1.6}" height="${rigaH - 8}" rx="2.5" fill="url(#tratteggio)" stroke="#5b6675" stroke-width="0.8" stroke-dasharray="3 2"/>`;
      }
    } else {
      const x = sx + r.g * larGiorno + r.ora * oreW, cy = y + rigaH / 2;
      s += `<text x="8" y="${y + 15}" font-size="10.5" fill="#1b2a3a" font-weight="bold">◆ ${esc(r.nome)}</text>`;
      s += `<path d="M${x} ${cy - 7} L${x + 7} ${cy} L${x} ${cy + 7} L${x - 7} ${cy} Z" fill="#1b2a3a"/>`;
    }
  });
  s += `<defs><pattern id="tratteggio" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#fff"/><line x1="0" y1="0" x2="0" y2="6" stroke="#9aa3ad" stroke-width="2"/></pattern></defs>`;
  // legenda
  const ly = top + righe.length * rigaH + 22;
  s += `<rect x="8" y="${ly - 9}" width="16" height="10" rx="2" fill="#D55E00"/><text x="30" y="${ly}" font-size="10.5" fill="#1b2a3a">attività critica (scorrimento 0)</text>`;
  s += `<rect x="210" y="${ly - 9}" width="16" height="10" rx="2" fill="#0072B2"/><text x="232" y="${ly}" font-size="10.5" fill="#1b2a3a">attività con scorrimento</text>`;
  s += `<rect x="380" y="${ly - 9}" width="16" height="10" rx="2" fill="url(#tratteggio)" stroke="#5b6675" stroke-width="0.8" stroke-dasharray="3 2"/><text x="402" y="${ly}" font-size="10.5" fill="#1b2a3a">riserva</text>`;
  s += `<text x="470" y="${ly}" font-size="10.5" fill="#5b6675">ogni giorno = ${ORE_MAX_GIORNO} ore di capacità</text>`;
  return s + '</svg>';
}

// ---------------------------------------------------------------------
// 7. FIGURA: BASELINE COSTI-TEMPI DEL NOSTRO PROGETTO (SVG)
// ---------------------------------------------------------------------
function figuraBaseline() {
  const W = 640, H = 270, L = 64, R = 150, T = 22, B = 40;
  const pw = W - L - R, ph = H - T - B;
  const ymax = Math.ceil(budgetBase * 1.1 / 100) * 100;
  const X = i => L + (i + 1) * pw / GIORNI.length;
  const Y = v => T + ph - v / ymax * ph;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Helvetica, Arial, sans-serif" role="img" aria-label="Baseline costi-tempi del progetto">`;
  s += `<rect width="${W}" height="${H}" fill="#fff"/>`;
  for (let v = 0; v <= ymax; v += 100) {
    s += `<line x1="${L}" y1="${Y(v)}" x2="${L + pw}" y2="${Y(v)}" stroke="#ece6d9" stroke-width="0.8"/>`;
    s += `<text x="${L - 8}" y="${Y(v) + 4}" font-size="10" text-anchor="end" fill="#5b6675">${v.toLocaleString('it-IT')} €</text>`;
  }
  s += `<line x1="${L}" y1="${T + ph}" x2="${L + pw + 8}" y2="${T + ph}" stroke="#1b2a3a" stroke-width="1.2"/>`;
  s += `<line x1="${L}" y1="${T + ph}" x2="${L}" y2="${T - 6}" stroke="#1b2a3a" stroke-width="1.2"/>`;
  GIORNI.forEach((d, i) => s += `<text x="${X(i)}" y="${T + ph + 16}" font-size="10" text-anchor="middle" fill="#1b2a3a">${d.etichetta}</text>`);
  // budget di base e baseline totale
  s += `<line x1="${L}" y1="${Y(budgetBase)}" x2="${L + pw}" y2="${Y(budgetBase)}" stroke="#5b6675" stroke-dasharray="5 3"/>`;
  s += `<text x="${L + pw + 6}" y="${Y(budgetBase) + 4}" font-size="10" fill="#1b2a3a">budget di base ${fmtEuro(budgetBase)}</text>`;
  s += `<line x1="${L}" y1="${Y(baselineEuro)}" x2="${L + pw}" y2="${Y(baselineEuro)}" stroke="#0072B2" stroke-dasharray="2 3"/>`;
  s += `<text x="${L + pw + 6}" y="${Y(baselineEuro) + 14}" font-size="10" fill="#0072B2">baseline ${fmtEuro(baselineEuro)}</text>`;
  // curva cumulata (spezzata con punti, come la figura di pag. 198)
  const pts = [[L, Y(0)], ...baselineCum.map((v, i) => [X(i), Y(v)])];
  s += `<polyline points="${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="#0072B2" stroke-width="2.2"/>`;
  baselineCum.forEach((v, i) => {
    s += `<circle cx="${X(i)}" cy="${Y(v)}" r="3.2" fill="#fff" stroke="#0072B2" stroke-width="1.6"/>`;
    s += `<text x="${X(i) - 4}" y="${Y(v) - 8}" font-size="9.5" text-anchor="end" fill="#1b2a3a">${Math.round(v)}</text>`;
  });
  // rilevamenti previsti sul nostro progetto
  for (const g of [3, 5]) {
    s += `<line x1="${X(g)}" y1="${T + ph}" x2="${X(g)}" y2="${T}" stroke="#D55E00" stroke-dasharray="4 3"/>`;
    s += `<text x="${X(g) + 4}" y="${T + 10}" font-size="9.5" fill="#D55E00">rilevamento ${g === 3 ? 1 : 2}</text>`;
  }
  s += `<text x="${L}" y="${T - 8}" font-size="10" fill="#1b2a3a" font-weight="bold">Costo cumulato pianificato (BCWS)</text>`;
  return s + '</svg>';
}

// ---------------------------------------------------------------------
// 8. TESTO DEL DOCUMENTO (HTML, stampabile in A4)
// ---------------------------------------------------------------------
const critiche = ATTIVITA.filter(a => a.critica).map(a => a.id);
// attività critiche in parallelo (stesso inizio) scritte come "A2 ∥ A3"
const gruppiCritici = [];
for (const a of ATTIVITA.filter(x => x.critica).sort((x, y) => x.ES - y.ES)) {
  const ultimo = gruppiCritici[gruppiCritici.length - 1];
  if (ultimo && Math.abs(ultimo.ES - a.ES) < 1e-9) ultimo.ids.push(a.id); else gruppiCritici.push({ ES: a.ES, ids: [a.id] });
}
const camminoTesto = gruppiCritici.map(g => g.ids.length > 1 ? '(' + g.ids.join(' ∥ ') + ')' : g.ids[0]).join(' → ');
const lista = arr => arr.map(x => `<li>${x}</li>`).join('');

const attivitaHtml = WBS.map(w => `
  <li class="wbs"><strong>${w.codice} · ${w.nome}</strong>
    <ul>${w.attivita.map(id => {
      const a = perId[id];
      const ris = Object.entries(a.ore).map(([r, h]) => `${RISORSE[r].nome} ${fmtOre(h)}`).join(' + ');
      return `<li><strong>${a.id} — ${esc(a.nome)}</strong> (WBS ${a.wbs}). ${esc(a.desc)}<br>
        <span class="meta">Risorse: ${ris} · Stima: <b>${fmtOre(a.oreTot)}</b> · Precedenze: ${a.prec.length ? a.prec.join(', ') : 'nessuna'} · Costo: <b>${fmtEuro(a.costo)}</b>${a.critica ? ' · <span class="crit">critica</span>' : ` · scorrimento ${fmtOre(a.slack)}`}</span></li>`;
    }).join('')}</ul></li>`).join('');

const RISCHI = [
  { n: 'LaTeX sconosciuto: non riuscire a scrivere un .tex parametrico che compila', p: 3, i: 3,
    m: 'prova tecnica A3 già il primo giorno; consulenza LaTeX (assistente AI) e Overleaf come ambiente pronto; solo pacchetti standard.', r: 'PM + consulente' },
  { n: 'Errori di compilazione o di disegno del .tex con certi dati', p: 2, i: 3,
    m: 'compilazione con pdflatex a ogni milestone; caso di prova con titolo "R&D 50% #1 _beta", durate corte/lunghe e numeri grandi.', r: 'esecuzione' },
  { n: 'Segni o formule sbagliati (CV e SV invertiti, percentuali sulla base sbagliata)', p: 2, i: 3,
    m: 'test automatici con l\'esempio del libro (SV = -26.000, -15,7%; CV = -40.000, -24,1%) e con un caso positivo.', r: 'esecuzione + PM' },
  { n: 'Ritardo nella consegna (penale 2% al giorno)', p: 2, i: 3,
    m: `riserva di ${RISERVA.ore} ore; prodotto "congelato" giovedì sera; due rilevamenti costi-tempi (lun e mer) per accorgersi in tempo e tagliare dal basso.`, r: 'PM' },
  { n: 'Scope creep: aggiungere funzioni "belle" al sito prima di finire quelle obbligatorie', p: 3, i: 2,
    m: 'tre livelli di priorità (obbligatorio, consigliato, facoltativo); le facoltative si fanno solo a base finita e testata.', r: 'PM' },
  { n: 'Anteprima nel browser e .tex diversi (numeri o aspetto)', p: 2, i: 2,
    m: 'un solo modello dati calcolato una volta; stesso algoritmo di interpolazione e di scala degli assi nei due mondi; confronto nel collaudo.', r: 'esecuzione' },
  { n: 'Dipendenza dall\'assistente AI (codice non capito, servizio non disponibile)', p: 2, i: 2,
    m: 'codice commentato in italiano e spiegato a ogni fase; tutto salvato su git; il progetto non usa l\'AI a runtime.', r: 'PM' },
  { n: 'Problemi di pubblicazione su GitHub Pages (pagina bianca, file non trovati)', p: 1, i: 2,
    m: 'solo percorsi relativi, nessun server; prova in locale; guida passo passo; in emergenza si consegna lo zip.', r: 'esecuzione' },
  { n: 'Rilavorazione dovuta all\'avvio del prototipo prima della fine della pianificazione', p: 2, i: 1,
    m: 'il prototipo A3 è "usa e getta" e dura solo mezz\'ora prima della fine di A2.', r: 'PM' },
].map(r => ({ ...r, g: r.p * r.i })).sort((a, b) => b.g - a.g);
const livello = v => ['', 'bassa', 'media', 'alta'][v];
const livelloI = v => ['', 'basso', 'medio', 'alto'][v];

const html = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<title>Pianificazione del progetto CostCurve</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  @page { size: A4; margin: 11mm 12mm 12mm; }
  :root { --inchiostro:#1b2a3a; --carta:#f6f3ec; --blu:#0072B2; --verm:#D55E00; --verde:#00775A; --grigio:#5b6675; }
  * { box-sizing: border-box; }
  body { font-family: "Charter", "Bitstream Charter", "Georgia", "DejaVu Serif", serif; color: var(--inchiostro); font-size: 9.1pt; line-height: 1.34; margin: 0; background:#fff; }
  .pagina { max-width: 186mm; margin: 0 auto; padding: 2mm 0; }
  header.testata { border-top: 6px solid var(--inchiostro); padding: 8px 0 10px; margin-bottom: 10px; display: grid; grid-template-columns: 1fr auto; gap: 8px 16px; align-items: end; }
  header .sopra { font: 600 8.5pt/1 "Helvetica Neue", Arial, sans-serif; letter-spacing: .14em; text-transform: uppercase; color: var(--verm); }
  h1 { font-size: 20pt; line-height: 1.1; margin: 4px 0 2px; }
  header .sotto { color: var(--grigio); font-size: 10pt; }
  header .scheda { font: 8.6pt/1.5 "Helvetica Neue", Arial, sans-serif; text-align: right; color: var(--grigio); border-left: 2px solid var(--carta); padding-left: 10px; }
  header .scheda b { color: var(--inchiostro); }
  .numeri { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin: 8px 0 12px; font-family: "Helvetica Neue", Arial, sans-serif; }
  .numeri div { background: var(--carta); border-radius: 6px; padding: 6px 9px; }
  .numeri b { display: block; font-size: 13pt; }
  .numeri span { font-size: 8pt; color: var(--grigio); text-transform: uppercase; letter-spacing: .06em; }
  h2 { font: 700 11pt/1.2 "Helvetica Neue", Arial, sans-serif; margin: 10px 0 4px; padding-bottom: 2px; border-bottom: 1.5px solid var(--inchiostro); break-after: avoid; }
  h2 .n { color: var(--verm); margin-right: 6px; }
  h3 { font: 700 10.2pt/1.2 "Helvetica Neue", Arial, sans-serif; margin: 9px 0 3px; break-after: avoid; }
  p { margin: 4px 0; }
  ul { margin: 3px 0 4px; padding-left: 17px; }
  li { margin: 2px 0; }
  li.wbs { list-style: none; margin-left: -17px; margin-top: 6px; }
  li.wbs > strong { font-family: "Helvetica Neue", Arial, sans-serif; font-size: 9.6pt; background: var(--carta); padding: 1px 6px; border-radius: 4px; }
  .meta { font: 8.4pt/1.4 "Helvetica Neue", Arial, sans-serif; color: var(--grigio); }
  .crit { color: var(--verm); font-weight: 700; }
  figure { margin: 8px 0; break-inside: avoid; }
  figure img, figure svg { width: 100%; max-height: 92mm; height: auto; display: block; border: 1px solid #e4ded0; border-radius: 6px; }
  figcaption { font: 8.4pt/1.35 "Helvetica Neue", Arial, sans-serif; color: var(--grigio); margin-top: 3px; }
  .ipotesi { font-family: "Helvetica Neue", Arial, sans-serif; font-size: 7.6pt; font-weight: 700; color: #fff; background: var(--grigio); border-radius: 3px; padding: 0 4px; vertical-align: 1px; }
  .riquadro { background: var(--carta); border-left: 3px solid var(--blu); padding: 6px 10px; margin: 6px 0; border-radius: 0 6px 6px 0; break-inside: avoid; }
  .due { columns: 2; column-gap: 16px; }
  ul.due { padding-left: 15px; }
  ul.due li.wbs { break-inside: auto; }
  ul.due li.wbs li { break-inside: avoid; }
  .due > li, .due > div { break-inside: avoid; }
  .rischio b.g { font-family: "Helvetica Neue", Arial, sans-serif; display: inline-block; min-width: 1.6em; text-align: center; border-radius: 3px; color: #fff; font-size: 8.5pt; margin-right: 4px; }
  footer { margin-top: 12px; font: 8pt/1.4 "Helvetica Neue", Arial, sans-serif; color: var(--grigio); border-top: 1px solid #e4ded0; padding-top: 5px; }
  .salto { break-before: page; }
  .affianca { display: grid; grid-template-columns: 1.55fr 1fr; gap: 12px; align-items: start; }
  .affianca .riquadro { margin-top: 8px; }
</style>
</head>
<body><div class="pagina">

<header class="testata">
  <div>
    <div class="sopra">GPOI · Documentazione di pianificazione</div>
    <h1>CostCurve — strumento per il diagramma costi-tempi</h1>
    <div class="sotto">Sito web che disegna le curve BCWS, BCWP e ACWP con due rilevamenti ed esporta il file LaTeX (.tex)</div>
  </div>
  <div class="scheda">Autore: <b>____________</b><br>Classe: <b>______</b><br>Periodo: <b>6 – 13 novembre 2026</b><br>Versione 1.0 (baseline)</div>
</header>

<div class="numeri">
  <div><span>Ore stimate</span><b>${fmtOre(oreTotali)}</b></div>
  <div><span>Baseline</span><b>${fmtEuro(baselineEuro)}</b></div>
  <div><span>Budget di base</span><b>${fmtEuro(budgetBase)}</b></div>
  <div><span>Consegna prodotto</span><b>ven 13/11</b></div>
</div>

<h2><span class="n">1</span>Obiettivo, perimetro e deliverable</h2>
<p><b>Obiettivo.</b> Costruire entro il 13 novembre un programma web che permetta a un project manager di inserire pochi dati (piano a budget e due rilevamenti) e di ottenere subito il diagramma costi-tempi con le curve BCWS, BCWP e ACWP, la tabella, la legenda dei parametri, il calcolo percentuale dell'andamento (%CV, %SV) e il file <b>.tex</b> pronto da compilare. Il progetto monitorato dal diagramma è generico: il prodotto è lo <i>strumento</i>.</p>
<div class="due"><div>
<p><b>Incluso</b></p><ul>
<li>sito statico in italiano, utilizzabile da PC e telefono, anche senza connessione;</li>
<li>inserimento guidato dei dati con controlli e messaggi chiari;</li>
<li>diagramma con 3 curve e 2 rilevamenti, tabella, legenda, CV, SV, %CV, %SV;</li>
<li>export di un .tex autonomo e parametrico; report PDF;</li>
<li>pubblicazione su GitHub Pages e guida d'uso.</li></ul>
</div><div>
<p><b>Escluso</b></p><ul>
<li>server, account utente, salvataggio online (i dati restano nel browser);</li>
<li>più di due rilevamenti, importazione da Excel o MS Project;</li>
<li>gestione di più valute o di calendari con festività.</li></ul>
<p><b>Deliverable</b></p><ul>
<li>D1 questo documento (fine laboratorio del 6/11);</li>
<li>D2 sito pubblicato e codice nel repository;</li>
<li>D3 file .tex di esempio e relativo PDF compilato;</li>
<li>D4 guida d'uso e README (consegna 13/11).</li></ul>
</div></div>

<h2><span class="n">2</span>WBS e attività</h2>
<p>Le attività sono quelle di <i>questo</i> progetto. Le tre risorse richieste sono: <b>${RISORSE.PM.nome}</b> (${RISORSE.PM.chi}, ${RISORSE.PM.tariffa} €/h), <b>${RISORSE.CONS.nome}</b> (${RISORSE.CONS.chi}, ${RISORSE.CONS.tariffa} €/h) ed <b>${RISORSE.ESE.nome}</b> (${RISORSE.ESE.chi}, ${RISORSE.ESE.tariffa} €/h). <span class="ipotesi">IPOTESI</span> Le tariffe sono ipotizzate, a soli fini di calcolo: servono a trasformare le ore in costi, come chiede il diagramma costi-tempi.</p>
<ul class="due">${attivitaHtml}</ul>
<p class="meta">Totale ore per risorsa: ${Object.entries(orePerRisorsa).map(([r, h]) => `${RISORSE[r].nome} ${fmtOre(h)} (${fmtEuro(h * RISORSE[r].tariffa)})`).join(' · ')}.</p>

<h2><span class="n">3</span>Calendario e cammino critico</h2>
<figure>${gantt()}<figcaption>Figura 1 — Gantt in ore di lavoro: ogni giorno è diviso in ${ORE_MAX_GIORNO} ore (capacità massima dichiarata di una persona). Le attività arancioni sono sul cammino critico della rete logica.</figcaption></figure>
<p><b>Cammino critico.</b> Sulla rete delle precedenze (metodo CPM, risorse illimitate) la durata minima è di ${fmtOre(durataLogica)} e il cammino critico è <b>${camminoTesto}</b> (∥ = attività in parallelo, entrambe critiche). Solo A6 (generatore .tex) ha scorrimento: ${fmtOre(perId.A6.slack)}, perché può procedere in parallelo all'anteprima SVG. Con <b>una sola persona</b> però le attività si eseguono una dopo l'altra: la durata reale è di ${fmtOre(oreTotali)} distribuite su 7 giorni, e un ritardo su qualunque attività sposta la consegna. Per questo la riserva è messa alla fine (giovedì e venerdì mattina).</p>
<p><b>Attività avviate prima della fine della pianificazione.</b> Sì, è possibile ed è voluto: il prototipo LaTeX (A3) parte venerdì mentre la pianificazione (A2) è ancora in corso (pianificazione "a onde successive"). Motivo: il rischio principale è LaTeX, e conviene scoprire subito se è un problema, perché cambierebbe le stime di A6. Il prezzo è un possibile rischio di rilavorazione, limitato perché il prototipo è usa e getta e dura solo mezz'ora prima della fine di A2.</p>

<h2><span class="n">4</span>Baseline costi-tempi e budget di base</h2>
<div class="affianca"><figure>${figuraBaseline()}<figcaption>Figura 2 — Baseline (BCWS) del nostro progetto: costo cumulato pianificato a fine giornata. Ha la tipica forma a S: pochi costi all'inizio, il grosso in mezzo, pochi alla fine. Le linee tratteggiate sono i due rilevamenti con cui monitoreremo il progetto usando il nostro stesso strumento.</figcaption></figure>
<div class="riquadro"><b>Budget di base = baseline + management reserve</b> (libro, pag. 197): ${fmtEuro(baselineEuro)} + ${fmtEuro(riservaEuro)} = <b>${fmtEuro(budgetBase)}</b>. La riserva è di ${RISERVA.ore} ore di esecuzione informatica (${RISORSE.ESE.tariffa} €/h), pari al ${Math.round(riservaEuro / baselineEuro * 100)}% della baseline, e copre la rilavorazione e i rischi del punto 7. Ore totali con riserva: ${fmtOre(oreTotali + RISERVA.ore)}, sotto il limite di 21 ore (7 giorni × 3 ore). Il margine di guadagno non si applica (progetto scolastico) <span class="ipotesi">IPOTESI</span>.</div></div>
<p><b>Monitoraggio.</b> Faremo due rilevamenti: lunedì 9 sera (BCWS pianificato ${fmtEuro(baselineCum[3])}) e mercoledì 11 sera (${fmtEuro(baselineCum[5])}). Calcoleremo CV e SV: se SV è negativo si taglia dal basso della lista delle priorità.</p>

<h2><span class="n">5</span>Criteri di scelta e giustificazione</h2>
<ul>
<li><b>Sito statico invece di un programma da installare</b> (alternative: programma Python o desktop, foglio Excel con macro). Criterio: il PM deve usarlo subito, senza installare nulla e senza costi. Il sito si apre da qualsiasi browser, anche dal telefono, e si pubblica gratis.</li>
<li><b>JavaScript puro invece di un framework</b> (alternative: React, Vue). Criteri: durata di una settimana e una sola persona. Niente fase di build, niente librerie da imparare, meno cose che possono rompersi; i moduli ES bastano per separare calcoli, disegno, LaTeX e interfaccia.</li>
<li><b>GitHub Pages</b> (alternative: Netlify, hosting scolastico, consegna via zip). Criteri: gratuito, HTTPS, collegato a git, quindi ogni versione resta salvata. Lo zip resta il piano B.</li>
<li><b>File .tex con i DATI separati dal DISEGNO e i calcoli fatti in LaTeX</b> (alternativa: un .tex "fotografia" con i numeri già calcolati). Criterio: il docente vuole uno strumento parametrico, non statico. Chi cambia un numero nella sezione DATI vede ricalcolati CV, SV, percentuali, frecce e tabella, anche senza il sito.</li>
<li><b>Interpolazione monotona delle curve</b> (alternative: spezzata, spline cubica naturale). Criterio: i costi cumulati non possono mai calare. La spline naturale può oscillare e "scendere", la spezzata non ha la forma a S; la cubica monotona passa per i punti dati, non oscilla ed è identica nell'anteprima e nel .tex.</li>
<li><b>Stima bottom-up invece che per analogia</b> (libro, pag. 197). Criterio: non abbiamo progetti storici simili (è la prima volta con LaTeX), quindi la stima per analogia sarebbe poco affidabile. Si stimano le singole attività della WBS e si sommano; l'esperienza di precedenti lavori web scolastici serve solo come controllo.</li>
<li><b>Assegnazione delle risorse</b>. Organizzazione a task force (libro, pag. 193): una persona dedicata al progetto per la settimana, nel ruolo di PM. Si chiede la consulenza solo dove manca la competenza (LaTeX, earned value), perché è la risorsa più costosa; l'esecuzione informatica copre sviluppo e test.</li>
<li><b>Tre livelli di priorità</b> (obbligatorio, consigliato, facoltativo). Criterio: la penale per ritardo pesa più di qualunque funzione in più. Se il tempo manca si taglia dal basso, e quello che è obbligatorio per la consegna viene fatto e testato per primo.</li>
</ul>

<h2><span class="n">6</span>Realizzabilità: condizioni necessarie e sufficienti</h2>
<p>Una condizione <b>necessaria</b> è una condizione senza la quale il progetto sicuramente fallisce; le condizioni <b>sufficienti</b>, aggiunte alle necessarie, ne garantiscono la riuscita. Per ognuna indichiamo come la verifichiamo.</p>
<h3>Necessarie</h3>
<ul>
<li><b>N1 Formule chiare e verificate.</b> CV = BCWP − ACWP, SV = BCWP − BCWS, %CV = CV/BCWS, %SV = SV/BCWS. <i>Verifica:</i> test automatico sull'esempio del libro.</li>
<li><b>N2 Ambiente LaTeX con pgfplots funzionante</b> (Overleaf o TeX Live). <i>Verifica:</i> il prototipo A3 compila.</li>
<li><b>N3 Browser moderno con JavaScript</b> (moduli ES, SVG). <i>Verifica:</i> prova su Chrome e Firefox, su PC e telefono.</li>
<li><b>N4 Tempo disponibile ≥ tempo stimato:</b> ${fmtOre(oreTotali + RISERVA.ore)} (con riserva) ≤ 21 ore. <i>Verifica:</i> i due rilevamenti costi-tempi.</li>
<li><b>N5 Account e repository GitHub.</b> <i>Verifica:</i> il link di Pages si apre.</li>
<li><b>N6 Dati di input coerenti</b> (cumulati che non calano, rilevamenti in ordine). <i>Verifica:</i> controlli automatici del sito.</li>
</ul>
<h3>Sufficienti (insieme alle necessarie)</h3>
<ul>
<li><b>S1 Una sola fonte di verità:</b> il modello dei dati è calcolato una volta e da lì derivano anteprima, .tex e PDF. <i>Verifica:</i> stessi numeri nei tre output durante il collaudo.</li>
<li><b>S2 Test superati:</b> Test 1-4 sui calcoli, compilazione del .tex senza errori, nessun errore nella console del browser.</li>
<li><b>S3 Priorità rispettate:</b> tutte le funzioni obbligatorie sono finite e testate prima di iniziare quelle consigliate.</li>
<li><b>S4 Controllo dell'avanzamento:</b> SV non peggiore del −10% al rilevamento di mercoledì, altrimenti si usa la riserva e si tagliano le funzioni facoltative. Il prodotto viene congelato giovedì sera.</li>
</ul>

<h2><span class="n">7</span>Rischi di fallimento (dal più grave)</h2>
<p class="meta">Gravità = probabilità × impatto (scala 1-3).</p>
<ul class="rischio due">${RISCHI.map(r => `<li><b class="g" style="background:${r.g >= 6 ? '#D55E00' : r.g >= 4 ? '#B8860B' : '#5b6675'}">${r.g}</b><b>${esc(r.n)}.</b> Probabilità ${livello(r.p)}, impatto ${livelloI(r.i)}. <i>Mitigazione:</i> ${esc(r.m)} <span class="meta">Responsabile: ${r.r}.</span></li>`).join('')}</ul>

<h2><span class="n">8</span>Piano di consegna e penali</h2>
<ul>
<li><b>Documentazione:</b> a fine ora del laboratorio di venerdì 6 novembre (milestone ◆ nel Gantt).</li>
<li><b>Prodotto completo:</b> al laboratorio di <b>venerdì 13 novembre</b>, la data di scadenza indicata.</li>
<li><b>Penale per ritardo:</b> 2% del punteggio per ogni giorno di ritardo. Per questo il prodotto è congelato giovedì 12 sera e la riserva copre giovedì e venerdì mattina.</li>
<li><b>Penale per anticipo:</b> <span class="ipotesi">DA CHIARIRE</span> su Classroom compare una penale del 5% al giorno per la consegna in anticipo; prudenzialmente la consideriamo valida. Quindi si consegna <b>esattamente il 13 novembre</b>, né prima né dopo: il lavoro finito giovedì resta nel repository fino al laboratorio.</li>
<li><b>Giorno di consegna consigliato:</b> venerdì 13 novembre, durante il laboratorio, con link al sito, file .tex di esempio, PDF e guida d'uso.</li>
</ul>

<footer>Documento generato da <code>documentazione/pianificazione/genera.mjs</code>: ore, costi, cammino critico, Gantt e baseline sono calcolati dai dati delle attività, non scritti a mano. Le voci segnate IPOTESI sono assunzioni dichiarate.</footer>
</div></body></html>`;

writeFileSync(join(QUI, 'pianificazione.html'), html);
writeFileSync(join(QUI, 'gantt.svg'), gantt());
writeFileSync(join(QUI, 'baseline.svg'), figuraBaseline());

console.log(`OK: ${ATTIVITA.length} attività, ${oreTotali} ore, baseline ${baselineEuro} €, riserva ${riservaEuro} €, budget di base ${budgetBase} €`);
console.log(`Cammino critico (rete logica): ${camminoTesto} — durata ${durataLogica} ore`);
console.log('Ore per giorno:', oreGiorno.join(' '), '| Baseline cumulata:', baselineCum.map(Math.round).join(' '));
