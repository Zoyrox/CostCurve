// Prova end-to-end del flusso di un project manager nel browser (versione 2).
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const out = process.argv[2] || 'test/output';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 }, acceptDownloads: true });
const p = await ctx.newPage();
const log = [], errori = [];
p.on('pageerror', e => errori.push('pageerror: ' + e.message));
p.on('console', m => { if (m.type() === 'error') errori.push('console: ' + m.text()); });
p.on('dialog', d => d.accept());
const ok = (c, t) => log.push((c ? 'OK   ' : 'FAIL ') + t);
const attesa = () => p.waitForTimeout(250);

await p.goto('file://' + resolve('index.html'));
ok(await p.isVisible('.vuoto-iniziale'), 'Prima apertura: progetto vuoto con "Inizia un nuovo progetto"');
ok((await p.textContent('#msg-durata')) === '', 'Nessun errore rosso prima di aver scritto');

// --- ricreo il grafico del libro a mano: 1 rilevamento, dati per periodo, piano cumulato, previsione manuale
await p.fill('#f-titolo', 'Period breakdown of progress analysis');
await p.click('label[for="um-migliaia"]');
await p.fill('#f-durata', '7');
await p.fill('#f-bac', '3,7');
await p.click('#f-titolo');
await p.click('#tab-2');
await p.click('label[for="mp-cumulato"]');
const piano = ['0', '0,25', '0,75', '1,6', '2,6', '3,35', '3,7'];
for (let i = 0; i < 7; i++) await p.fill(`#f-costo-${i + 1}`, piano[i]);
await attesa();
ok((await p.textContent('#somma-piano')).includes('coincide'), 'Piano cumulato: il totale coincide con il budget');
await p.click('#tab-3');
await p.click('label[for="nr-1"]');
await p.click('label[for="ma-per"]');
ok(await p.isHidden('.scheda-ril[data-ril="1"]'), 'Un solo rilevamento: la seconda scheda sparisce');
await p.fill('#f-ril-0-periodo', '5');
const av = [['0', '0'], ['0,12', '0,65'], ['0,3', '1,9'], ['0,6', '4'], ['0,9', '5,35']];
for (let i = 0; i < 5; i++) { await p.fill(`#f-av-${i + 1}-bcwp`, av[i][0]); await p.fill(`#f-av-${i + 1}-acwp`, av[i][1]); }
await p.click('label[for="pv-man"]');
await p.fill('#f-prev-eac', '7,2');
await p.fill('#f-prev-fine', '7,9');
await attesa();
ok(await p.isVisible('#grafico svg path'), 'Il grafico del libro si ricrea inserendo i dati a mano');
ok((await p.textContent('#out-ril-0-bcws')).trim() === '2,60', 'BCWS al mese 5 letto dal piano: 2,60');

// --- errore: ACWP che cala nella tabella
await p.fill('#f-av-3-acwp', '0,1');
await p.keyboard.press('Tab');
await attesa();
ok((await p.textContent('#msg-avanzamento')).includes('non può diminuire'), 'ACWP che cala: messaggio chiaro sotto la tabella');
await p.fill('#f-av-3-acwp', '1,9');
await p.keyboard.press('Tab');
await attesa();

// --- zoom: pulsanti, Ctrl+rotellina, intervallo, adatta
await p.click('#z-piu');
await attesa();
ok((await p.textContent('#livello-zoom')) !== '100%', 'Pulsante +: lo zoom cambia (' + await p.textContent('#livello-zoom') + ')');
await p.click('#z-adatta');
await attesa();
ok((await p.textContent('#livello-zoom')) === '100%', 'Pulsante adatta: torna a tutto il progetto');
const box = await p.locator('#grafico svg').boundingBox();
await p.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.4);
await p.keyboard.down('Control');
await p.mouse.wheel(0, -400);
await p.keyboard.up('Control');
await attesa();
ok((await p.textContent('#livello-zoom')) !== '100%', 'Ctrl + rotellina: zoom attorno al mouse (' + await p.textContent('#livello-zoom') + ')');
await p.click('#b-intervallo');
await p.fill('#v-da', '3'); await p.fill('#v-a', '6'); await p.fill('#v-ymin', ''); await p.fill('#v-ymax', '');
await p.click('#v-applica');
await attesa();
ok((await p.textContent('#grafico-sottotitolo')).includes('3 – 6'), 'Intervallo preciso: mesi 3–6');
await p.screenshot({ path: `${out}/flusso-zoom.png` });

// --- valori al passaggio del mouse
const b2 = await p.locator('#grafico svg').boundingBox();
const g = await p.evaluate(() => { const s = document.querySelector('#grafico svg'); return { l: +s.dataset.l, pw: +s.dataset.pw, t: +s.dataset.t, ph: +s.dataset.ph, w: s.viewBox.baseVal.width }; });
const k = b2.width / g.w;
await p.mouse.move(b2.x + (g.l + g.pw * (5 - 3) / 3) * k, b2.y + (g.t + g.ph / 2) * k);
await attesa();
const tt = await p.textContent('#tooltip');
ok(tt.includes('rilevamento 1') && tt.includes('5,35'), 'Mouse sul mese 5: riquadro con i valori veri (ACWP 5,35)');
await p.screenshot({ path: `${out}/flusso-tooltip.png` });
await p.click('#z-adatta');

// --- mostra / nascondi
await p.click('#b-mostra');
await p.uncheck('[data-mostra="bcwp"]');
await attesa();
ok(!(await p.innerHTML('#grafico')).includes('Lavoro svolto a costi di budget (BCWP)</title>'), 'Mostra: la curva BCWP si può nascondere');
await p.check('[data-mostra="bcwp"]');
await p.keyboard.press('Escape');

// --- esporta: tex, pdf (orizzontale, massima), svg, stampa
const esporta = async (formato, extra) => {
  await p.click('#btn-esporta');
  await p.check(`input[name="formato"][value="${formato}"]`);
  if (extra) await extra();
  const [d] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.click('#btn-scarica')]);
  return d;
};
let d = await esporta('tex');
await d.saveAs(`${out}/flusso.tex`);
ok(d.suggestedFilename().endsWith('.tex'), 'Esporta .tex: ' + d.suggestedFilename());
await p.click('#form-esporta button[value="annulla"]');
d = await esporta('pdf', async () => { await p.click('label[for="e-orizz"]'); await p.click('label[for="e-massima"]'); });
await d.saveAs(`${out}/flusso-orizzontale.pdf`);
ok(d.suggestedFilename().endsWith('.pdf'), 'Esporta PDF orizzontale, dimensione massima');
await p.click('#form-esporta button[value="annulla"]');
d = await esporta('pdf', async () => { await p.click('label[for="e-stessa"]'); await p.click('label[for="e-normale"]'); });
await d.saveAs(`${out}/flusso-verticale.pdf`);
ok(true, 'Esporta PDF verticale, dimensione normale');
await p.click('#form-esporta button[value="annulla"]');
d = await esporta('svg');
await d.saveAs(`${out}/flusso.svg`);
ok(d.suggestedFilename().endsWith('.svg'), 'Esporta SVG');
await p.click('#form-esporta button[value="annulla"]');
// stampa (emulata): pagina orizzontale dedicata
await p.evaluate(() => { document.body.dataset.stampaPagina = 'orizzontale'; document.body.dataset.stampaDimensione = 'massima'; });
await p.evaluate(() => { const r = document.getElementById('report'); const m = window.CC.calcoli.calcola(JSON.parse(localStorage.getItem('costcurve:v2')).dati, { vistaIntera: true }); r.innerHTML = window.CC.report.report(m, window.CC.grafico.disegna(m, { tema: 'chiaro' }), { graficoPrima: true }); });
await p.emulateMedia({ media: 'print' });
await p.pdf({ path: `${out}/flusso-stampa.pdf`, preferCSSPageSize: true, printBackground: true });
await p.emulateMedia({ media: 'screen' });
ok(true, 'Stampa emulata salvata');

// --- tema scuro, salvataggio, riapertura
await p.click('#btn-tema');
ok((await p.getAttribute('html', 'data-tema')) === 'scuro', 'Pulsante luna: tema scuro');
await p.screenshot({ path: `${out}/flusso-scuro.png` });
const [dj] = await Promise.all([p.waitForEvent('download'), p.click('#btn-salva')]);
await dj.saveAs(`${out}/flusso.json`);
await p.reload(); await attesa();
ok((await p.getAttribute('html', 'data-tema')) === 'scuro', 'Il tema scelto resta dopo il ricaricamento');
ok((await p.inputValue('#f-titolo')) === 'Period breakdown of progress analysis', 'Salvataggio automatico: i dati restano');
await p.click('#btn-nuovo');
ok(await p.isVisible('.vuoto-iniziale'), 'Nuovo: torna il progetto vuoto');
await p.setInputFiles('#file-apri', `${out}/flusso.json`);
await attesa();
ok((await p.inputValue('#f-titolo')) === 'Period breakdown of progress analysis', 'Apri: il file .json ricarica il progetto');
ok((await p.inputValue('#f-av-5-acwp')) === '5,35', 'Apri: anche la tabella per periodo è stata ricaricata');
await browser.close();
console.log(log.join('\n'));
console.log(errori.length ? 'ERRORI:\n' + errori.join('\n') : 'Nessun errore in console.');
