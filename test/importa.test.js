// Test dell'importazione da Excel / CSV e dell'esportazione CSV.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const I = require('../js/importa.js');
const C = require('../js/calcoli.js');
const { trova } = require('../js/esempi.js');

test('Celle copiate da Excel (tabulazioni, intestazioni, numeri italiani)', () => {
  const testo = 'Mese\tBCWS\tBCWP\tACWP\n1\t4.000\t3.500\t4.200\n2\t10.000\t8.800\t11.000\n3\t18.000\t\t\n4\t29.000\t24.000\t31.500';
  const a = I.analizza(testo);
  assert.equal(a.errore, undefined);
  assert.equal(a.righe.length, 4);
  assert.equal(a.righe[3].acwp, 31500);
  assert.equal(a.righe[2].bcwp, null);
  const d = I.inDati(a, {});
  assert.equal(d.durata, 4);
  assert.equal(d.modoPiano, 'cumulato');
  assert.equal(d.bac, 29000);
  assert.deepEqual(d.rilevamenti.map(r => r.periodo), [2, 4]);
  const m = C.calcola({ titolo: 'x', ...d });
  assert.equal(m.valido, true, JSON.stringify(m.problemi));
  assert.equal(m.rilevamenti[1].cv, 24000 - 31500);
});

test('CSV con punto e virgola, costo per periodo, senza ACWP in alcune righe', () => {
  const a = I.analizza('periodo;costo nel periodo;BCWP;ACWP\n1;5;4;5\n2;5;9;10\n3;15;;');
  assert.equal(a.pianoCol, 'costo');
  const d = I.inDati(a, {});
  assert.equal(d.modoPiano, 'periodo');
  assert.equal(d.bac, 25);
  assert.deepEqual(d.rilevamenti.map(r => r.periodo), [1, 2]);
});

test('Senza intestazioni e con errori: messaggi chiari', () => {
  const a = I.analizza('1;10;8;9\n2;20;abc;19');
  assert.equal(a.righe[1].bcwp, null);
  assert.ok(a.avvisi.some(x => x.includes('abc')));
  assert.match(I.analizza('').errore, /niente da importare/);
  assert.match(I.analizza('nome;cognome\na;b').errore, /Non riconosco/);
});

test('Esporta CSV: una riga per periodo, separatore ;, virgola decimale', () => {
  const m = C.calcola(trova('libro').dati);
  const csv = I.tabellaCSV(m);
  const righe = csv.trim().split('\r\n');
  assert.equal(righe.length, 24);
  assert.match(righe[10], /^10;;32000;166000;140000;180000;-40000;-26000;-24,1;-15,7;1$/);
});
