// Prova del sito nel browser (Chromium headless), aperto con file:// come un doppio clic.
// Controlla gli errori in console e salva screenshot (PC chiaro/scuro, telefono).
// Uso: node strumenti/prova-sito.mjs <cartella-uscita>
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const out = process.argv[2] || 'test/output';
mkdirSync(out, { recursive: true });
const url = 'file://' + resolve('index.html');
const browser = await chromium.launch();
const errori = [];
const casi = [
  ['pc-vuoto', { viewport: { width: 1440, height: 900 } }, null, 'light'],
  ['pc-libro', { viewport: { width: 1440, height: 900 } }, 'grafico-libro', 'light'],
  ['pc-scuro', { viewport: { width: 1440, height: 900 }, colorScheme: 'dark' }, 'anticipo', 'dark'],
  ['telefono', { ...devices['iPhone 13'] }, 'libro', 'light'],
];
for (const [nome, opz, esempio] of casi) {
  const ctx = await browser.newContext(opz);
  const p = await ctx.newPage();
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errori.push(`[${nome}] ${m.type()}: ${m.text()}`); });
  p.on('pageerror', e => errori.push(`[${nome}] pageerror: ${e.message}`));
  await p.goto(url);
  if (esempio) await p.selectOption('#scelta-esempio', esempio);
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${out}/sito-${nome}.png` });
  if (nome === 'pc-libro') await p.screenshot({ path: `${out}/sito-${nome}-intero.png`, fullPage: true });
  const largo = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  if (largo) errori.push(`[${nome}] la pagina scorre in orizzontale`);
  await ctx.close();
}
await browser.close();
console.log(errori.length ? errori.join('\n') : 'Nessun errore in console.');
