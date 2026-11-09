// Salva SVG + PNG di un esempio (controllo visivo).
// Uso: node strumenti/svg-di-prova.mjs <id-esempio | file.json> <uscita> [tema] [vistaJSON]
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const calcoli = require('../js/calcoli.js');
const grafico = require('../js/grafico.js');
const { trova } = require('../js/esempi.js');
const { chromium } = require('playwright');
const [, , sorgente, uscita, tema, vista] = process.argv;
const dati = JSON.parse(JSON.stringify(existsSync(sorgente) ? JSON.parse(readFileSync(sorgente, 'utf8')) : trova(sorgente).dati));
if (vista) dati.grafico = Object.assign(dati.grafico || {}, JSON.parse(vista));
const m = calcoli.calcola(dati);
if (!m.valido) { console.error(m.problemi); process.exit(1); }
writeFileSync(uscita + '.svg', grafico.disegna(m, { tema }));
const b = await chromium.launch(); const p = await b.newPage();
await p.goto('file://' + resolve(uscita + '.svg'));
await p.locator('svg').screenshot({ path: uscita + '.png' });
await b.close();
