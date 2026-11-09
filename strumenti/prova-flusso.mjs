// Prova end-to-end del flusso di un project manager nel browser.
// Nuovo progetto -> dati con errori -> correzione -> curva a S -> rilevamenti
// -> download di .tex, PDF e JSON; stampa (media print) in PDF.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const out = process.argv[2] || 'test/output';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
const p = await ctx.newPage();
const log = [];
const errori = [];
p.on('pageerror', e => errori.push('pageerror: ' + e.message));
p.on('console', m => { if (m.type() === 'error') errori.push('console: ' + m.text()); });
p.on('dialog', d => d.accept());
const ok = (cond, testo) => { log.push((cond ? 'OK   ' : 'FAIL ') + testo); };

await p.goto('file://' + resolve('index.html'));
await p.click('#btn-nuovo');
ok(await p.isVisible('#passo-1'), 'Nuovo progetto apre il passo 1');
ok((await p.textContent('#problemi')).includes('Da completare'), 'Con dati vuoti compare "Da completare"');

// errori tipici
await p.fill('#f-titolo', 'R&D 50% #1 _beta');
await p.fill('#f-durata', '0');
await p.waitForTimeout(250);
ok((await p.textContent('#msg-durata')).includes('da 1 a 120'), 'Durata 0: messaggio chiaro');
await p.fill('#f-durata', '10');
await p.fill('#f-bac', '200.000');
await p.click('#tab-2');
await p.click('#btn-curva-s');
await p.waitForTimeout(250);
const somma = await p.textContent('#somma-piano');
ok(somma.includes('200.000') && somma.includes('coincide'), 'Curva a S: la somma coincide con il budget');
await p.click('#tab-3');
await p.fill('#f-ril-0-periodo', '6');
await p.fill('#f-ril-0-bcwp', '90000');
await p.fill('#f-ril-0-acwp', '100.000');
await p.fill('#f-ril-1-periodo', '4');          // errore: prima del rilevamento 1
await p.fill('#f-ril-1-bcwp', '150000');
await p.fill('#f-ril-1-acwp', '150000');
await p.waitForTimeout(250);
ok((await p.textContent('#msg-ril-1-periodo')).includes('dopo il rilevamento 1'), 'Rilevamenti in ordine sbagliato: messaggio chiaro');
ok((await p.getAttribute('#tab-3', 'data-stato')) === 'errore', 'Il passo 3 è segnato in rosso');
await p.fill('#f-ril-1-periodo', '8');
await p.fill('#f-ril-1-acwp', '90000');          // errore: ACWP che cala
await p.waitForTimeout(250);
ok((await p.textContent('#msg-ril-1-acwp')).includes('non può diminuire'), 'ACWP che cala: messaggio chiaro');
await p.fill('#f-ril-1-acwp', '165000');
await p.waitForTimeout(250);
ok(await p.isVisible('#grafico svg path'), 'Dati corretti: compare il grafico');
const bcws = await p.textContent('#out-ril-0-bcws');
ok(/\d/.test(bcws), 'BCWS letto dal piano: ' + bcws);
await p.click('#tab-4');
ok((await p.textContent('#riepilogo-risultati')).includes('Rilevamento 2'), 'Passo 4 mostra il riepilogo');

// download .tex
const [dTex] = await Promise.all([p.waitForEvent('download'), p.click('#btn-tex')]);
await dTex.saveAs(`${out}/flusso.tex`);
ok(dTex.suggestedFilename().endsWith('.tex'), 'Scarica .tex: ' + dTex.suggestedFilename());
// download PDF
const [dPdf] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.click('#btn-pdf')]);
await dPdf.saveAs(`${out}/flusso-sito.pdf`);
ok(dPdf.suggestedFilename().endsWith('.pdf'), 'Scarica PDF: ' + dPdf.suggestedFilename());
// salva progetto
const [dJson] = await Promise.all([p.waitForEvent('download'), p.click('#btn-salva')]);
await dJson.saveAs(`${out}/flusso.json`);
ok(dJson.suggestedFilename().endsWith('.json'), 'Salva progetto: ' + dJson.suggestedFilename());
// stampa (media print) -> PDF
await p.emulateMedia({ media: 'print' });
await p.pdf({ path: `${out}/flusso-stampa.pdf`, format: 'A4', printBackground: true });
await p.emulateMedia({ media: 'screen' });
// autosalvataggio: ricarico la pagina e i dati restano
await p.reload();
await p.waitForTimeout(300);
ok((await p.inputValue('#f-titolo')) === 'R&D 50% #1 _beta', 'Autosalvataggio: il titolo resta dopo il ricaricamento');
// apri progetto da file
await p.click('#btn-nuovo');
await p.setInputFiles('#file-apri', `${out}/flusso.json`);
await p.waitForTimeout(400);
ok((await p.inputValue('#f-titolo')) === 'R&D 50% #1 _beta', 'Apri progetto: dati ricaricati dal file JSON');
// esempio "in anticipo": frasi positive
await p.selectOption('#scelta-esempio', 'anticipo');
await p.waitForTimeout(300);
ok((await p.textContent('#riepilogo-risultati')).includes('In anticipo'), 'Esempio in anticipo: frase positiva');
writeFileSync(`${out}/flusso-ultimo.svg`, await p.innerHTML('#grafico'));
await browser.close();
console.log(log.join('\n'));
console.log(errori.length ? 'ERRORI:\n' + errori.join('\n') : 'Nessun errore in console.');
