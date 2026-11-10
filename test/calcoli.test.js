// Test automatici del modulo di calcolo (M1).
// Avvio: npm test   (oppure: node --test test/)
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/calcoli.js');
const N = require('../js/numeri.js');
const { ESEMPI, trova } = require('../js/esempi.js');

const vicino = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} non è ≈ ${b}`);
const copia = o => JSON.parse(JSON.stringify(o));

test('Test 1 — esempio del libro, mese 10 (pag. 199)', () => {
  const m = C.calcola(trova('libro').dati);
  assert.equal(m.valido, true, JSON.stringify(m.problemi));
  const r = m.rilevamenti[0];
  assert.equal(r.t, 10);
  assert.equal(r.bcws, 166000);           // letto dal piano cumulato
  assert.equal(r.sv, -26000);             // SV = BCWP - BCWS
  assert.equal(r.cv, -40000);             // CV = BCWP - ACWP
  assert.equal(N.formatPercentuale(r.psv), '−15,7%');
  assert.equal(N.formatPercentuale(r.pcv), '−24,1%');
  assert.equal(r.stato.colore, 'rosso');
  assert.match(r.frasi.tempi, /In ritardo.*15,7%/);
  assert.match(r.frasi.costi, /Sforamento dei costi del 24,1%/);
  assert.equal(m.bcwsCum[23], 540000);
});

test('Test 1 — secondo rilevamento (dati inventati) e previsione', () => {
  const m = C.calcola(trova('libro').dati);
  const r = m.rilevamenti[1];
  assert.equal(r.bcws, 398000);
  assert.equal(r.sv, -68000);
  assert.equal(r.cv, -90000);
  vicino(m.previsione.eac, 540000 * 420000 / 330000);
  vicino(m.previsione.durataPrevista, 23 * 398000 / 330000);
  assert.equal(m.previsione.visibile, true);
});

test('Test 2 — curva a S del libro (9 settimane)', () => {
  const m = C.calcola(trova('curva-s').dati);
  assert.equal(m.valido, true);
  assert.deepEqual(m.bcwsCum.slice(1), [5, 10, 25, 55, 85, 120, 130, 140, 150]);
});

test('Test 3 — in anticipo e sotto budget: segni positivi e semaforo verde', () => {
  const m = C.calcola(trova('anticipo').dati);
  for (const r of m.rilevamenti) {
    assert.ok(r.cv > 0 && r.sv > 0);
    assert.equal(r.stato.colore, 'verde');
    assert.match(r.frasi.tempi, /^In anticipo/);
    assert.match(r.frasi.costi, /^Risparmio/);
  }
  assert.equal(N.formatPercentuale(m.rilevamenti[0].psv), '+14,8%');
});

test('Tutti gli esempi sono validi', () => {
  for (const e of ESEMPI) assert.equal(C.calcola(e.dati).valido, true, e.id);
});

test('Interpolazione monotona: le curve non scendono mai e passano per i nodi', () => {
  const casi = [
    [[0, 0], [10, 140000], [16, 330000]],
    [[0, 0], [1, 100], [2, 100], [3, 101], [4, 500]],      // tratti piatti
    [[0, 0], [1, 0], [2, 0], [3, 1000]],
    [[0, 0], [9, 1], [10, 1000000]],                          // salto brusco
  ];
  for (const nodi of casi) {
    const tratti = C.bezierMonotona(nodi);
    tratti.forEach((s, i) => {
      assert.deepEqual([s.x0, s.y0], nodi[i]);
      assert.deepEqual([s.x1, s.y1], nodi[i + 1]);
      let prec = -Infinity;
      for (let k = 0; k <= 200; k++) {        // campiono la Bézier
        const t = k / 200, u = 1 - t;
        const y = u * u * u * s.y0 + 3 * u * u * t * s.c1y + 3 * u * t * t * s.c2y + t * t * t * s.y1;
        assert.ok(y >= prec - 1e-6, `la curva scende nel tratto ${i}`);
        assert.ok(y >= Math.min(s.y0, s.y1) - 1e-6 && y <= Math.max(s.y0, s.y1) + 1e-6, 'oscillazione fuori dai nodi');
        prec = y;
      }
    });
  }
});

test('Passo degli assi', () => {
  assert.equal(C.passoBello(1000), 1000);
  assert.equal(C.passoBello(103500), 200000);
  assert.equal(C.passoBello(90000), 100000);
  assert.equal(C.passoBello(23), 25);
  assert.equal(C.passoTempo(23), 2);
  assert.equal(C.passoTempo(9), 1);
  assert.equal(C.passoTempo(120), 10);
});

test('Numeri all\'italiana', () => {
  assert.equal(N.leggiNumero('540.000'), 540000);
  assert.equal(N.leggiNumero('1.234,5'), 1234.5);
  assert.equal(N.leggiNumero('2,5'), 2.5);
  assert.equal(N.leggiNumero('2.5'), 2.5);
  assert.equal(N.leggiNumero(''), null);
  assert.ok(Number.isNaN(N.leggiNumero('abc')));
  assert.equal(N.formatNumero(540000), '540.000');
  assert.equal(N.formatNumero(1000), '1.000');
  assert.equal(N.formatNumero(694285.7142857), '694.285,71');
  assert.equal(N.formatNumero(-26000), '−26.000');
});

test('Curva a S automatica: somma esatta e monotona', () => {
  for (const [bac, n] of [[540000, 23], [150, 9], [7.5, 3], [1e9, 120]]) {
    const c = C.generaCurvaS(bac, n);
    assert.equal(c.length, n);
    vicino(c.reduce((s, x) => s + x, 0), bac, 1e-6 * bac);
    assert.ok(c.every(x => x >= 0));
  }
});

// ---- Test 4: casi limite e dati sbagliati -----------------------------
const base = () => copia(trova('libro').dati);
const errori = m => m.problemi.filter(p => p.livello === 'errore').map(p => p.campo);

test('Test 4 — rilevamenti coincidenti o in ordine sbagliato', () => {
  const d = base(); d.rilevamenti[1].periodo = 10;
  assert.deepEqual(errori(C.calcola(d)), ['ril-1-periodo']);
  d.rilevamenti[1].periodo = 5;
  assert.deepEqual(errori(C.calcola(d)), ['ril-1-periodo']);
});

test('Test 4 — cumulati che calano, negativi, BCWP oltre il budget, campi vuoti', () => {
  let d = base(); d.rilevamenti[1].acwp = 100000;
  assert.deepEqual(errori(C.calcola(d)), ['ril-1-acwp']);
  d = base(); d.piano[3] = -5;
  assert.deepEqual(errori(C.calcola(d)), ['costo-4']);
  d = base(); d.rilevamenti[1].bcwp = 600000; d.rilevamenti[1].acwp = 700000;
  assert.deepEqual(errori(C.calcola(d)), ['ril-1-bcwp']);
  d = base(); d.bac = ''; d.piano[0] = ''; d.rilevamenti[0].acwp = '';
  assert.deepEqual(errori(C.calcola(d)).sort(), ['bac', 'costo-1', 'ril-0-acwp'].sort());
});

test('Test 4 — durate estreme e valori grandi', () => {
  const corto = { titolo: 'x', durata: 2, bac: 10, costiPeriodo: [4, 6], rilevamenti: [{ periodo: 1, bcwp: 3, acwp: 5 }, { periodo: 2, bcwp: 8, acwp: 9 }] };
  assert.equal(C.calcola(corto).valido, true);
  const lungo = { titolo: 'x', durata: 120, bac: 1e9, costiPeriodo: C.generaCurvaS(1e9, 120), rilevamenti: [{ periodo: 30, bcwp: 1e8, acwp: 1.2e8 }, { periodo: 90, bcwp: 6e8, acwp: 7e8 }] };
  const m = C.calcola(lungo);
  assert.equal(m.valido, true);
  assert.ok(m.assi.ymax >= m.assi.yDati * 1.15 - 1e-6);
  assert.equal(C.calcola({ ...corto, durata: 121 }).valido, false);
  assert.equal(C.calcola({ ...corto, durata: 2.5 }).valido, false);
});

test('Test 4 — titolo con caratteri speciali ed emoji', () => {
  const d = base(); d.titolo = 'R&D 50% #1 _beta 😀';
  const m = C.calcola(d);
  assert.equal(m.valido, true);
  assert.ok(m.problemi.some(p => p.campo === 'titolo' && p.messaggio.includes('😀')));
  assert.deepEqual(C.caratteriNonSupportati('R&D 50% #1 _beta àèéìòù €'), []);
});

test('BCWS a zero al rilevamento: percentuali n.d. senza errori', () => {
  const d = { titolo: 'x', durata: 4, bac: 10, costiPeriodo: [0, 0, 5, 5], rilevamenti: [{ periodo: 1, bcwp: 0, acwp: 1 }, { periodo: 3, bcwp: 4, acwp: 6 }] };
  const m = C.calcola(d);
  assert.equal(m.valido, true);
  assert.equal(m.rilevamenti[0].pcv, null);
  assert.equal(N.formatPercentuale(m.rilevamenti[0].pcv), 'n.d.');
});

test('Arrotondamento unico e "come su carta" (uguale a LaTeX)', () => {
  assert.equal(N.formatNumero(1.005), '1,01');
  assert.equal(N.formatNumero(8.0459770, 1), '8,0');
  assert.equal(N.formatPercentuale(7 / 87 * 100), '+8,0%');
  assert.equal(N.formatNumero(2.675), '2,68');
  assert.equal(N.formatBreve(-193750000, true), '−193,8 mln');
  assert.equal(N.formatBreve(26000, true), '+26.000');
});
