// Genera un file .tex da un esempio o da un file JSON di progetto.
// Uso: node strumenti/genera-tex.mjs <id-esempio | file.json> <uscita.tex> [opzioniJSON]
// opzioniJSON: es. '{"esporta":{"pagina":"orizzontale"},"grafico":{"vista":{"da":14,"a":18}}}'
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const require = createRequire(import.meta.url);
const calcoli = require('../js/calcoli.js');
const latex = require('../js/latex.js');
const { trova } = require('../js/esempi.js');

const [, , sorgente, uscita, extra] = process.argv;
const dati = JSON.parse(JSON.stringify(existsSync(sorgente) ? JSON.parse(readFileSync(sorgente, 'utf8')) : trova(sorgente).dati));
if (extra) { const e = JSON.parse(extra); for (const k of Object.keys(e)) dati[k] = Object.assign({}, dati[k] || {}, e[k]); }
const d = calcoli.normalizza(dati);
const modello = calcoli.calcola(dati, { vistaIntera: d.esporta.vista !== 'attuale' });
if (!modello.valido) { console.error(modello.problemi); process.exit(1); }
writeFileSync(uscita, latex.genera(modello));
console.log('Scritto', uscita);
