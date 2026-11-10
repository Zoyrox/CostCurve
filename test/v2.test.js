// Test delle funzioni della versione 2: dati per periodo, 1 rilevamento,
// piano cumulato, previsione manuale, vista (zoom), date reali.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/calcoli.js');
const N = require('../js/numeri.js');
const { trova } = require('../js/esempi.js');
const copia = o => JSON.parse(JSON.stringify(o));
const errori = m => m.problemi.filter(p => p.livello === 'errore').map(p => p.campo);

test('Grafico del libro: un rilevamento, curve per periodo, previsione manuale', () => {
  const m = C.calcola(trova('grafico-libro').dati);
  assert.equal(m.valido, true, JSON.stringify(m.problemi));
  assert.equal(m.rilevamenti.length, 1);
  const r = m.rilevamenti[0];
  assert.equal(r.t, 5);
  assert.equal(r.bcws, 2.6);           // letto dal piano cumulato
  assert.equal(r.bcwp, 0.9);
  assert.equal(r.acwp, 5.35);
  assert.ok(Math.abs(r.cv - (0.9 - 5.35)) < 1e-12);
  assert.equal(m.previsione.visibile, true);
  assert.equal(m.previsione.eac, 7.2);
  assert.equal(m.previsione.durataPrevista, 7.9);
  // le curve passano esattamente per i valori della tabella
  assert.ok(Math.abs(C.valoreCurva(m.curve.acwp, 4) - 4) < 1e-12);
  assert.ok(Math.abs(C.valoreCurva(m.curve.bcwp, 3) - 0.3) < 1e-12);
  assert.ok(Math.abs(C.valoreCurva(m.curve.bcws, 6) - 3.35) < 1e-12);
});

test('Piano cumulato che cala: errore sul periodo giusto', () => {
  const d = copia(trova('grafico-libro').dati);
  d.piano[4] = 1;   // 1,6 -> 1: cala
  assert.deepEqual(errori(C.calcola(d)), ['costo-5']);
});

test('Tabella per periodo: manca un valore al rilevamento / valori che calano', () => {
  let d = copia(trova('grafico-libro').dati);
  d.avanzamento[4].acwp = null;
  assert.deepEqual(errori(C.calcola(d)), ['av-5-acwp']);
  d = copia(trova('grafico-libro').dati);
  d.avanzamento[3].bcwp = 0.1;     // 0,3 -> 0,1: cala
  assert.deepEqual(errori(C.calcola(d)), ['av-4-bcwp']);
});

test('Previsione manuale non valida', () => {
  const d = copia(trova('grafico-libro').dati);
  d.previsioneManuale = { eac: '', fine: 4 };
  assert.deepEqual(errori(C.calcola(d)), ['prev-eac']);
  d.previsioneManuale = { eac: 7, fine: 4 };     // fine prima dell'ultimo costo rilevato
  const m = C.calcola(d);
  assert.equal(m.valido, true);
  assert.equal(m.previsione.visibile, false);
  assert.match(m.previsione.motivo, /prima/);
});

test('Esempio in anticipo con tabella per periodo: stessi risultati di prima', () => {
  const m = C.calcola(trova('anticipo').dati);
  assert.equal(m.valido, true, JSON.stringify(m.problemi));
  assert.equal(N.formatPercentuale(m.rilevamenti[0].psv), '+14,8%');
  assert.equal(m.rilevamenti[1].cv, 7);
  assert.equal(m.rilevamenti[0].data, 'mag 27');      // 1 gennaio 2027 + 4 mesi
  assert.equal(m.etichettePeriodi[0], 'gen 27');
});

test('Vista (zoom): asse dei tempi ristretto, asse dei costi adattato in modo onesto', () => {
  const d = copia(trova('libro').dati);
  d.grafico = { vista: { da: 14, a: 18 } };
  const m = C.calcola(d);
  assert.equal(m.assi.xmin, 14);
  assert.equal(m.assi.xmax, 18);
  assert.equal(m.assi.zoomato, true);
  assert.ok(m.assi.ymin > 0 && m.assi.assePezzato, 'l\'asse non parte da 0 e lo segnala');
  // i valori visibili stanno dentro l'asse
  for (const x of [14, 15, 16, 17, 18]) {
    const y = C.valoreCurva(m.curve.acwp, x);
    if (y !== null && x <= 16) assert.ok(y >= m.assi.ymin && y <= m.assi.ymax);
  }
  // vista intera richiesta per l'esportazione
  const p = C.calcola(d, { vistaIntera: true });
  assert.equal(p.assi.xmin, 0);
  assert.equal(p.assi.ymin, 0);
});

test('Compatibilità: un progetto salvato con la versione 1 si apre ancora', () => {
  const v1 = { formato: 'costcurve', versione: 1, titolo: 'v1', durata: 3, bac: 30, costiPeriodo: [10, 10, 10], rilevamenti: [{ periodo: 1, bcwp: 8, acwp: 9 }, { periodo: 2, bcwp: 18, acwp: 21 }], mostraPrevisione: false };
  const m = C.calcola(v1);
  assert.equal(m.valido, true);
  assert.equal(m.previsione.modo, 'no');
  assert.equal(m.rilevamenti[1].sv, -2);
});

test('Date: formati e data non valida', () => {
  assert.equal(C.etichettaData(C.leggiData('2026-11-06'), 'settimane', 2), '20/11');
  assert.equal(C.etichettaData(C.leggiData('31/01/2027'), 'mesi', 1), 'feb 27');
  const d = copia(trova('libro').dati); d.dataInizio = '31/02/2027';
  assert.deepEqual(errori(C.calcola(d)), ['dataInizio']);
});

test('v3: note sul grafico, previsione nascosta, riassunto e tendenza', () => {
  const d = copia(trova('libro').dati);
  d.note = [{ periodo: 8, testo: 'Ritardo del fornitore' }, { periodo: 3, testo: 'Avvio lavori' }, { periodo: 99, testo: 'fuori' }, { periodo: '', testo: '' }];
  let m = C.calcola(d);
  assert.equal(m.valido, true);
  assert.deepEqual(m.note.map(n => [n.n, n.periodo]), [[1, 3], [2, 8]]);
  assert.ok(m.problemi.some(p => p.campo === 'nota-2'));
  assert.match(m.riassunto, /^Al mese 16 il progetto è in ritardo del 17,1% e costa il 22,6% in più/);
  assert.match(m.riassunto, /costerà circa 687\.272,73 € \(budget 540\.000 €\) e finirà al mese 27,7 invece che al 23/);
  assert.ok(m.tendenza.pcv > 0 && m.tendenza.psv < 0);
  d.grafico = { mostra: { previsione: false } };
  m = C.calcola(d);
  assert.equal(m.previsione.visibile, false);
  assert.equal(m.previsione.nascostaDaUtente, true);
  assert.match(m.riassunto, /costerà circa/);
});
