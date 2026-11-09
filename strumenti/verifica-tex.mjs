// Verifica che il .tex compilato e il sito diano GLI STESSI numeri.
// Per ogni caso: genera il .tex, lo compila con pdflatex, estrae il testo del
// PDF e cerca i valori calcolati da calcoli.js (CV, SV, %CV, %SV, EAC...).
// Uso: node strumenti/verifica-tex.mjs   (serve pdflatex installato)
import { createRequire } from 'node:module';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const C = require('../js/calcoli.js'), T = require('../js/latex.js'), N = require('../js/numeri.js');
const { ESEMPI } = require('../js/esempi.js');
const dir = 'test/output'; mkdirSync(dir, { recursive: true });
const casi = ESEMPI.map(e => [e.id, e.dati]);
for (const f of ['stress-corto', 'stress-lungo', 'stress-decimali']) {
  try { casi.push([f, JSON.parse(readFileSync(`test/casi/${f}.json`, 'utf8'))]); } catch (e) { /* caso non presente */ }
}
let falliti = 0;
const pulisci = s => s.replace(/[\s  ]/g, '');
for (const [nome, dati] of casi) {
  const m = C.calcola(dati, { vistaIntera: true });
  writeFileSync(`${dir}/v-${nome}.tex`, T.genera(m));
  try { execFileSync('pdflatex', ['-interaction=nonstopmode', '-halt-on-error', `v-${nome}.tex`], { cwd: dir, stdio: 'ignore' }); }
  catch (e) { console.log(`FAIL ${nome}: non compila`); falliti++; continue; }
  const log = readFileSync(`${dir}/v-${nome}.log`, 'utf8');
  const avvisi = (log.match(/Overfull|LaTeX Warning|Package \w+ Warning/g) || []).length;
  const testo = pulisci(execFileSync('pdftotext', [`${dir}/v-${nome}.pdf`, '-']).toString());
  const attesi = [];
  for (const r of m.rilevamenti) {
    attesi.push(N.formatNumero(r.bcws), N.formatConSegno(r.cv), N.formatConSegno(r.sv), N.formatPercentuale(r.pcv), N.formatPercentuale(r.psv));
    if (r.cpi !== null) attesi.push(N.formatNumero(r.cpi, 2));
    if (r.spi !== null) attesi.push(N.formatNumero(r.spi, 2));
  }
  if (m.previsione.visibile) attesi.push(N.formatNumero(m.previsione.eac), N.formatNumero(m.previsione.durataPrevista, 1));
  attesi.push(N.formatNumero(m.totalePiano));
  for (const k of ['bcwp', 'acwp']) for (const [, v] of m.punti[k]) attesi.push(N.formatNumero(v));
  const mancanti = attesi.filter(a => a !== 'n.d.' && !testo.includes(pulisci(a)));
  const esito = mancanti.length === 0 && avvisi === 0;
  if (!esito) falliti++;
  console.log(`${esito ? 'OK  ' : 'FAIL'} ${nome}: ${attesi.length} valori confrontati, ${mancanti.length} diversi${mancanti.length ? ' (' + mancanti.join(' | ') + ')' : ''}, avvisi LaTeX ${avvisi}`);
}
process.exit(falliti ? 1 : 0);
