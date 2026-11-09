// Converte una pagina HTML in PDF A4 usando il browser Chromium (Playwright).
// Uso: node strumenti/pdf-da-html.mjs <file.html> <file.pdf>
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const [, , ingresso, uscita] = process.argv;
const browser = await chromium.launch();
const pagina = await browser.newPage();
await pagina.goto(pathToFileURL(resolve(ingresso)).href, { waitUntil: 'load' });
await pagina.pdf({ path: uscita, format: 'A4', preferCSSPageSize: true, printBackground: true });
await browser.close();
console.log('PDF creato:', uscita);
