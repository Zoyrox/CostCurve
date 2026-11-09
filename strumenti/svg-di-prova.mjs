// Salva l'SVG di un esempio e ne fa uno screenshot PNG (per controllo visivo).
// Uso: node strumenti/svg-di-prova.mjs <id-esempio | file.json> <uscita senza estensione>
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const calcoli = require('../js/calcoli.js');
const grafico = require('../js/grafico.js');
const { trova } = require('../js/esempi.js');
const { chromium } = require('playwright');
const [, , sorgente, uscita] = process.argv;
const dati = existsSync(sorgente) ? JSON.parse(readFileSync(sorgente, 'utf8')) : trova(sorgente).dati;
const svg = grafico.disegna(calcoli.calcola(dati));
writeFileSync(uscita + '.svg', svg);
const b = await chromium.launch(); const p = await b.newPage();
await p.goto('file://' + resolve(uscita + '.svg'));
await p.locator('svg').screenshot({ path: uscita + '.png' });
await b.close();
