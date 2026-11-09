// Crea la copia modificabile .odt della pianificazione:
// 1) converte le figure SVG in PNG (Chromium), 2) sostituisce gli SVG in linea
// con le immagini PNG, 3) usa pandoc per produrre il file .odt.
// Uso: node strumenti/odt-pianificazione.mjs
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const DIR = 'documentazione/pianificazione';
const browser = await chromium.launch();
const pagina = await browser.newPage({ deviceScaleFactor: 2 });
for (const nome of ['gantt', 'baseline']) {
  await pagina.goto(pathToFileURL(`${process.cwd()}/${DIR}/${nome}.svg`).href);
  await pagina.locator('svg').screenshot({ path: `${DIR}/${nome}.png` });
}
await browser.close();

let html = readFileSync(`${DIR}/pianificazione.html`, 'utf8');
const figure = ['gantt.png', 'baseline.png'];
let i = 0;
html = html.replace(/<svg[\s\S]*?<\/svg>/g, () => `<img src="${figure[i++]}" style="width:16cm">`);
writeFileSync(`${DIR}/_odt.html`, html);
execFileSync('pandoc', ['_odt.html', '-f', 'html', '-t', 'odt', '-o', 'pianificazione.odt'], { cwd: DIR });
rmSync(`${DIR}/_odt.html`);
console.log('ODT creato:', `${DIR}/pianificazione.odt`);
