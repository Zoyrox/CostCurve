// Genera un file .tex da un esempio o da un file JSON di progetto.
// Uso: node strumenti/genera-tex.mjs <id-esempio | file.json> <uscita.tex> [titolo-sostitutivo]
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const require = createRequire(import.meta.url);
const calcoli = require('../js/calcoli.js');
const latex = require('../js/latex.js');
const { trova } = require('../js/esempi.js');

const [, , sorgente, uscita, titolo] = process.argv;
const dati = existsSync(sorgente) ? JSON.parse(readFileSync(sorgente, 'utf8')) : JSON.parse(JSON.stringify(trova(sorgente).dati));
if (titolo) dati.titolo = titolo;
const modello = calcoli.calcola(dati);
if (!modello.valido) { console.error(modello.problemi); process.exit(1); }
writeFileSync(uscita, latex.genera(modello));
console.log('Scritto', uscita);
