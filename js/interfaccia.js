/* =====================================================================
 * interfaccia.js — collega la pagina al modello e agli output
 * ---------------------------------------------------------------------
 * Flusso: l'utente scrive → i dati grezzi vengono salvati così come
 * sono stati scritti → calcoli.calcola() produce il modello UNA volta →
 * da quel modello si aggiornano anteprima SVG, messaggi, tabelle,
 * codice LaTeX e (su richiesta) PDF.
 * ===================================================================== */
(function () {
  'use strict';

  const { numeri, calcoli, esempi, grafico, latex, report } = window.CC;
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  const CHIAVE = 'costcurve:v1';

  let dati;               // dati grezzi (stringhe come scritte dall'utente)
  let modello;            // ultimo modello calcolato
  let svgCorrente = '';   // ultimo SVG valido
  let passo = 1;
  let esempioAttivo = null;
  let timer = null;

  // ---------------------------------------------------------------------
  // Utilità
  // ---------------------------------------------------------------------
  /** Valore da mostrare in un campo: 540000 -> "540.000" (stringhe lasciate come sono). */
  function perCampo(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'number') return Number.isFinite(v) ? numeri.formatNumero(v).replace('−', '-') : '';
    return String(v);
  }

  /** Copia "pulita" dei dati con numeri veri (per il salvataggio su file). */
  function datiPerFile() {
    const d = calcoli.normalizza(dati);
    const n = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);
    return {
      formato: 'costcurve', versione: 1, titolo: d.titolo, unitaTempo: d.unitaTempo, unitaMoneta: d.unitaMoneta,
      durata: n(d.durata), bac: n(d.bac), costiPeriodo: d.costiPeriodo.map(n),
      rilevamenti: d.rilevamenti.map(r => ({ periodo: n(r.periodo), bcwp: n(r.bcwp), acwp: n(r.acwp) })),
      mostraPrevisione: d.mostraPrevisione, nota: d.nota,
    };
  }

  function scarica(nome, contenuto, tipo) {
    const blob = contenuto instanceof Blob ? contenuto : new Blob([contenuto], { type: tipo });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function messaggioAzione(testo, tipo) {
    const el = $('#msg-azione');
    el.textContent = testo;
    el.className = 'msg-azione' + (tipo ? ' ' + tipo : '');
    clearTimeout(messaggioAzione.t);
    if (testo) messaggioAzione.t = setTimeout(() => { el.textContent = ''; }, 7000);
  }

  function salvaNelBrowser() {
    try { localStorage.setItem(CHIAVE, JSON.stringify({ dati, esempio: esempioAttivo, passo })); } catch (e) { /* memoria non disponibile: si continua senza */ }
  }

  function leggiDalBrowser() {
    try { const s = localStorage.getItem(CHIAVE); return s ? JSON.parse(s) : null; } catch (e) { return null; }
  }

  // ---------------------------------------------------------------------
  // Caricamento dei dati nel modulo
  // ---------------------------------------------------------------------
  function carica(nuovi, idEsempio) {
    const d = calcoli.normalizza(nuovi);
    dati = {
      ...d,
      durata: perCampo(d.durata), bac: perCampo(d.bac),
      costiPeriodo: d.costiPeriodo.map(perCampo),
      rilevamenti: d.rilevamenti.map(r => ({ periodo: perCampo(r.periodo), bcwp: perCampo(r.bcwp), acwp: perCampo(r.acwp) })),
    };
    esempioAttivo = idEsempio || null;
    riempiModulo();
    aggiorna();
  }

  function riempiModulo() {
    $('#f-titolo').value = dati.titolo;
    $('#f-nota').value = dati.nota;
    $('#f-durata').value = dati.durata;
    $('#f-bac').value = dati.bac;
    $(`input[name="unitaTempo"][value="${dati.unitaTempo}"]`).checked = true;
    $(`input[name="unitaMoneta"][value="${dati.unitaMoneta}"]`).checked = true;
    dati.rilevamenti.forEach((r, i) => {
      $(`#f-ril-${i}-periodo`).value = r.periodo;
      $(`#f-ril-${i}-bcwp`).value = r.bcwp;
      $(`#f-ril-${i}-acwp`).value = r.acwp;
    });
    $('#f-previsione').checked = dati.mostraPrevisione;
    costruisciRighePiano();
    aggiornaEtichetteUnita();
    const banner = $('#avviso-esempio');
    const es = esempioAttivo && esempi.trova(esempioAttivo);
    banner.hidden = !es;
    if (es) $('#avviso-esempio-testo').textContent = es.descrizione;
  }

  /** Righe del piano: una per periodo (si ricostruiscono solo se cambia la durata). */
  function costruisciRighePiano() {
    const n = numeri.leggiNumero(dati.durata);
    const ok = Number.isInteger(n) && n >= 1 && n <= calcoli.DURATA_MAX;
    const corpo = $('#righe-piano');
    if (!ok) {
      corpo.innerHTML = '<tr><td colspan="3" class="vuoto">Inserisci prima la durata nel passo 1.</td></tr>';
      return;
    }
    dati.costiPeriodo = calcoli.adattaCosti(dati.costiPeriodo, n).map(v => (v === null ? '' : v));
    const ut = calcoli.UNITA_TEMPO[dati.unitaTempo].singolare;
    corpo.innerHTML = dati.costiPeriodo.map((v, i) => `<tr>
        <th scope="row">${i + 1}</th>
        <td><input type="text" inputmode="decimal" autocomplete="off" data-i="${i}" id="f-costo-${i + 1}" aria-label="Costo pianificato nel ${ut} ${i + 1}" value="${String(v).replace(/"/g, '&quot;')}"></td>
        <td class="cum" data-cum="${i}">—</td>
      </tr>`).join('');
  }

  function aggiornaEtichetteUnita() {
    const u = calcoli.UNITA_TEMPO[dati.unitaTempo];
    $$('[data-unita-tempo]').forEach(el => { el.textContent = `(${u.plurale})`; });
    $$('[data-unita-tempo-sing]').forEach(el => { el.textContent = u.singolare[0].toUpperCase() + u.singolare.slice(1); });
    $$('[data-unita-tempo-sing-min]').forEach(el => { el.textContent = u.singolare; });
    $$('#righe-piano input').forEach((inp, i) => inp.setAttribute('aria-label', `Costo pianificato nel ${u.singolare} ${i + 1}`));
    const n = numeri.leggiNumero(dati.durata);
    $$('#f-ril-0-periodo, #f-ril-1-periodo').forEach(inp => { if (Number.isInteger(n) && n > 0) inp.max = n; });
  }

  // ---------------------------------------------------------------------
  // Ricalcolo e aggiornamento di tutto ciò che si vede
  // ---------------------------------------------------------------------
  function programmaAggiorna() {
    clearTimeout(timer);
    timer = setTimeout(aggiorna, 120);
  }

  const PASSO_DEL_CAMPO = c => (/^(titolo|durata|bac)$/.test(c) ? 1 : /^(costo-|piano)/.test(c) ? 2 : /^ril-/.test(c) ? 3 : 1);

  function aggiorna() {
    modello = calcoli.calcola(dati);
    const errori = modello.problemi.filter(p => p.livello === 'errore');
    const avvisi = modello.problemi.filter(p => p.livello === 'avviso');

    // 1) messaggi accanto ai campi
    $$('.msg').forEach(el => { el.textContent = ''; el.className = 'msg'; });
    $$('[aria-invalid="true"]').forEach(el => el.removeAttribute('aria-invalid'));
    const msgPiano = [];
    for (const p of modello.problemi) {
      if (/^costo-/.test(p.campo)) {
        const inp = document.getElementById('f-' + p.campo);
        if (inp && p.livello === 'errore') inp.setAttribute('aria-invalid', 'true');
        msgPiano.push(p);
        continue;
      }
      if (p.campo === 'piano') { msgPiano.push(p); continue; }
      const el = document.getElementById('msg-' + p.campo);
      if (el && !el.textContent) {
        el.textContent = p.messaggio;
        el.className = 'msg ' + p.livello;
        const inp = document.getElementById('f-' + p.campo);
        if (inp && p.livello === 'errore') inp.setAttribute('aria-invalid', 'true');
      }
    }
    const mp = $('#msg-piano');
    if (msgPiano.length) {
      const soloErrori = msgPiano.filter(p => p.livello === 'errore');
      const lista = (soloErrori.length ? soloErrori : msgPiano);
      mp.textContent = lista.slice(0, 2).map(p => p.messaggio).join(' ') + (lista.length > 2 ? ` (e altri ${lista.length - 2} periodi da completare)` : '');
      mp.className = 'msg ' + (soloErrori.length ? 'errore' : 'avviso');
    }

    // 2) stato dei passi (pallino rosso se il passo ha errori)
    for (let k = 1; k <= 3; k++) {
      const err = errori.some(p => PASSO_DEL_CAMPO(p.campo) === k);
      $('#tab-' + k).dataset.stato = err ? 'errore' : 'ok';
    }
    $('#tab-4').dataset.stato = modello.valido ? 'ok' : 'attesa';

    // 3) piano: cumulati e somma
    aggiornaCumulati();

    // 4) BCWS letto dal piano nei rilevamenti
    const cum = cumulatiGrezzi();
    dati.rilevamenti.forEach((r, i) => {
      const t = numeri.leggiNumero(r.periodo);
      $(`#out-ril-${i}-bcws`).textContent = cum && Number.isInteger(t) && t >= 1 && t < cum.length ? numeri.formatNumero(cum[t]) : '—';
    });

    // 5) anteprima
    $('#anteprima-titolo').textContent = modello.titolo;
    const box = $('#problemi');
    if (modello.valido) {
      svgCorrente = grafico.disegna(modello);
      $('#grafico').innerHTML = svgCorrente;
      $('#semafori').innerHTML = report.semafori(modello);
      box.innerHTML = avvisi.length ? `<ul class="lista-avvisi">${avvisi.map(p => `<li><button type="button" class="link" data-vai="${p.campo}">${escapeHtml(p.messaggio)}</button></li>`).join('')}</ul>` : '';
    } else {
      $('#grafico').innerHTML = grafico.segnaposto(errori.length === 1 ? 'Manca solo un dato: guarda qui sopra.' : `Mancano o sono da correggere ${errori.length} dati.`);
      $('#semafori').innerHTML = '';
      const primi = errori.slice(0, 5);
      box.innerHTML = `<div class="da-correggere"><p><strong>Da completare o correggere</strong></p><ul>${primi.map(p => `<li><button type="button" class="link" data-vai="${p.campo}">${escapeHtml(p.messaggio)}</button></li>`).join('')}</ul>${errori.length > 5 ? `<p>…e altri ${errori.length - 5}.</p>` : ''}</div>`;
    }

    // 6) risultati, report, LaTeX
    if (modello.valido) {
      $('#riepilogo-risultati').innerHTML = report.riepilogo(modello);
      $('#report').innerHTML = report.report(modello, svgCorrente);
      $('#report').hidden = false;
      $('#codice-latex').value = latex.genera(modello);
    } else {
      $('#riepilogo-risultati').innerHTML = '<p class="msg errore">Completa i passi segnati in rosso: i risultati compariranno qui.</p>';
      $('#report').innerHTML = '';
      $('#report').hidden = true;
      $('#codice-latex').value = '';
    }
    $$('#btn-tex, #btn-pdf, #btn-copia, #btn-overleaf, #btn-stampa').forEach(b => b.setAttribute('aria-disabled', String(!modello.valido)));
    salvaNelBrowser();
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /** Cumulati del piano dai valori scritti (null se il piano non è completo). */
  function cumulatiGrezzi() {
    const valori = dati.costiPeriodo.map(numeri.leggiNumero);
    if (!valori.length || valori.some(v => v === null || !Number.isFinite(v) || v < 0)) return null;
    const c = [0];
    valori.forEach(v => c.push(c[c.length - 1] + v));
    return c;
  }

  function aggiornaCumulati() {
    let somma = 0, completo = true;
    dati.costiPeriodo.forEach((v, i) => {
      const x = numeri.leggiNumero(v);
      const cella = document.querySelector(`[data-cum="${i}"]`);
      if (x === null || !Number.isFinite(x) || x < 0) completo = false;
      else somma += x;
      if (cella) cella.textContent = completo ? numeri.formatNumero(somma) : '—';
    });
    const bac = numeri.leggiNumero(dati.bac);
    const box = $('#somma-piano');
    if (!dati.costiPeriodo.length) { box.innerHTML = ''; return; }
    const pct = bac > 0 ? Math.min(100, somma / bac * 100) : 0;
    const uguale = bac > 0 && Math.abs(somma - bac) <= 0.005;
    box.className = 'somma' + (uguale ? ' ok' : '');
    box.innerHTML = `<div class="somma-testo"><span>Totale del piano: <strong>${numeri.formatNumero(somma)}</strong>${bac > 0 ? ` su un budget di <strong>${numeri.formatNumero(bac)}</strong>` : ''}</span>
        ${uguale ? '<span class="ok-testo">✓ coincide con il budget</span>' : ''}</div>
      <div class="barra" aria-hidden="true"><span style="width:${pct.toFixed(1)}%"></span></div>
      ${completo && bac > 0 && !uguale && somma > 0 ? `<div class="correzioni">
        <button type="button" class="btn btn-piccolo" id="btn-bac-da-somma">Usa ${numeri.formatNumero(somma)} come budget</button>
        <button type="button" class="btn btn-piccolo" id="btn-scala-piano">Adatta i costi al budget di ${numeri.formatNumero(bac)}</button></div>` : ''}`;
  }

  // ---------------------------------------------------------------------
  // Passi (schede)
  // ---------------------------------------------------------------------
  function mostraPasso(n, focus) {
    passo = Math.max(1, Math.min(4, n));
    for (let k = 1; k <= 4; k++) {
      const tab = $('#tab-' + k), pan = $('#passo-' + k);
      const attivo = k === passo;
      tab.setAttribute('aria-selected', String(attivo));
      tab.tabIndex = attivo ? 0 : -1;
      pan.hidden = !attivo;
    }
    $('#btn-indietro').style.visibility = passo === 1 ? 'hidden' : 'visible';
    $('#btn-avanti').hidden = passo === 4;
    if (focus) $('#tab-' + passo).focus();
    salvaNelBrowser();
  }

  function vaiACampo(campo) {
    mostraPasso(PASSO_DEL_CAMPO(campo));
    let el = document.getElementById('f-' + campo);
    if (campo === 'piano') el = $('#righe-piano input');
    if (el) {
      el.focus({ preventScroll: true });
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }

  // ---------------------------------------------------------------------
  // Eventi
  // ---------------------------------------------------------------------
  function datoModificato() {
    if (esempioAttivo) { esempioAttivo = null; $('#avviso-esempio').hidden = true; }
    programmaAggiorna();
  }

  function collegaEventi() {
    // passo 1
    $('#f-titolo').addEventListener('input', e => { dati.titolo = e.target.value; datoModificato(); });
    $('#f-nota').addEventListener('input', e => { dati.nota = e.target.value; datoModificato(); });
    $('#f-bac').addEventListener('input', e => { dati.bac = e.target.value; datoModificato(); });
    $('#f-durata').addEventListener('input', e => {
      dati.durata = e.target.value;
      costruisciRighePiano(); aggiornaEtichetteUnita(); datoModificato();
    });
    $$('input[name="unitaTempo"]').forEach(r => r.addEventListener('change', e => { dati.unitaTempo = e.target.value; aggiornaEtichetteUnita(); datoModificato(); }));
    $$('input[name="unitaMoneta"]').forEach(r => r.addEventListener('change', e => { dati.unitaMoneta = e.target.value; datoModificato(); }));

    // riformattazione all'italiana quando si esce da un campo numerico
    document.addEventListener('focusout', e => {
      const inp = e.target;
      if (!(inp instanceof HTMLInputElement) || inp.getAttribute('inputmode') !== 'decimal') return;
      const v = numeri.leggiNumero(inp.value);
      if (typeof v === 'number' && Number.isFinite(v)) inp.value = numeri.formatNumero(v).replace('−', '-');
    });

    // passo 2: piano
    const corpo = $('#righe-piano');
    corpo.addEventListener('input', e => {
      const i = Number(e.target.dataset.i);
      if (Number.isInteger(i)) { dati.costiPeriodo[i] = e.target.value; datoModificato(); }
    });
    corpo.addEventListener('paste', e => {
      const i = Number(e.target.dataset.i);
      const testo = (e.clipboardData || window.clipboardData).getData('text');
      const valori = testo.split(/[\r\n\t;]+/).map(s => s.trim()).filter(Boolean);
      if (!Number.isInteger(i) || valori.length < 2) return; // incolla normale
      e.preventDefault();
      const inputs = $$('#righe-piano input');
      valori.slice(0, inputs.length - i).forEach((v, k) => { inputs[i + k].value = v; dati.costiPeriodo[i + k] = v; });
      if (valori.length > inputs.length - i) messaggioPiano(`Incollati ${inputs.length - i} valori: gli altri ${valori.length - (inputs.length - i)} superano la durata del progetto.`);
      datoModificato();
    });
    corpo.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const inputs = $$('#righe-piano input');
      const k = inputs.indexOf(e.target);
      if (k < 0) return;
      const dest = inputs[k + (e.key === 'ArrowUp' ? -1 : 1)];
      if (dest) { e.preventDefault(); dest.focus(); dest.select(); }
    });
    $('#btn-curva-s').addEventListener('click', () => {
      const bac = numeri.leggiNumero(dati.bac), n = numeri.leggiNumero(dati.durata);
      if (!(bac > 0) || !Number.isInteger(n) || n < 1 || n > calcoli.DURATA_MAX) {
        messaggioPiano('Per generare la curva servono la durata e il budget totale: completali nel passo 1.');
        return;
      }
      const pieno = dati.costiPeriodo.some(v => String(v).trim() !== '');
      if (pieno && !confirm('La curva a S sostituisce i costi già scritti nel piano. Continuare?')) return;
      dati.costiPeriodo = calcoli.generaCurvaS(bac, n).map(perCampo);
      costruisciRighePiano(); datoModificato();
    });
    $('#btn-azzera-piano').addEventListener('click', () => {
      if (!confirm('Vuoi svuotare tutti i costi del piano?')) return;
      dati.costiPeriodo = dati.costiPeriodo.map(() => '');
      costruisciRighePiano(); datoModificato();
    });
    $('#somma-piano').addEventListener('click', e => {
      const valori = dati.costiPeriodo.map(numeri.leggiNumero);
      const somma = valori.reduce((s, v) => s + v, 0);
      if (e.target.id === 'btn-bac-da-somma') {
        dati.bac = perCampo(Math.round(somma * 100) / 100); $('#f-bac').value = dati.bac; datoModificato();
      } else if (e.target.id === 'btn-scala-piano') {
        const bac = numeri.leggiNumero(dati.bac);
        const intero = Number.isInteger(bac);
        const arr = v => (intero ? Math.round(v) : Math.round(v * 100) / 100);
        // si scalano i cumulati e si rifanno le differenze: la somma torna esatta
        let cum = 0, cumPrec = 0;
        dati.costiPeriodo = valori.map((v, i) => {
          cum += v;
          const nuovo = i === valori.length - 1 ? bac : arr(cum * bac / somma);
          const c = arr(nuovo - cumPrec); cumPrec = nuovo;
          return perCampo(c);
        });
        costruisciRighePiano(); datoModificato();
      }
    });

    // passo 3: rilevamenti
    [0, 1].forEach(i => ['periodo', 'bcwp', 'acwp'].forEach(k => {
      $(`#f-ril-${i}-${k}`).addEventListener('input', e => { dati.rilevamenti[i][k] = e.target.value; datoModificato(); });
    }));
    $('#f-previsione').addEventListener('change', e => { dati.mostraPrevisione = e.target.checked; datoModificato(); });

    // schede dei passi (anche da tastiera: frecce, Home, End)
    $$('.passo').forEach((tab, k) => {
      tab.addEventListener('click', () => mostraPasso(k + 1));
      tab.addEventListener('keydown', e => {
        const mappa = { ArrowRight: passo + 1, ArrowLeft: passo - 1, Home: 1, End: 4 };
        if (e.key in mappa) { e.preventDefault(); mostraPasso(mappa[e.key], true); }
      });
    });
    $('#btn-avanti').addEventListener('click', () => { mostraPasso(passo + 1); $('#editor').scrollIntoView({ block: 'start', behavior: 'smooth' }); });
    $('#btn-indietro').addEventListener('click', () => { mostraPasso(passo - 1); $('#editor').scrollIntoView({ block: 'start', behavior: 'smooth' }); });

    // collegamenti dai messaggi ai campi
    document.addEventListener('click', e => {
      const b = e.target.closest('[data-vai]');
      if (b) vaiACampo(b.dataset.vai);
    });

    // testata: esempi, nuovo, apri, salva
    const sel = $('#scelta-esempio');
    esempi.ESEMPI.forEach(es => sel.insertAdjacentHTML('beforeend', `<option value="${es.id}">${escapeHtml(es.nome)}</option>`));
    sel.addEventListener('change', () => {
      const es = esempi.trova(sel.value);
      sel.value = '';
      if (!es) return;
      if (!esempioAttivo && haDati() && !confirm('Caricare l\'esempio sostituisce i dati attuali (se ti servono, prima usa "Salva progetto"). Continuare?')) return;
      carica(JSON.parse(JSON.stringify(es.dati)), es.id);
      mostraPasso(4);
    });
    const nuovo = () => {
      if (!esempioAttivo && haDati() && !confirm('Iniziare un progetto vuoto? I dati attuali verranno cancellati (se ti servono, prima usa "Salva progetto").')) return;
      carica(calcoli.datiVuoti(), null);
      mostraPasso(1);
      $('#f-titolo').focus();
    };
    $('#btn-nuovo').addEventListener('click', nuovo);
    $('#btn-nuovo-2').addEventListener('click', nuovo);
    $('#btn-salva').addEventListener('click', () => {
      const nome = latex.nomeFile(dati.titolo).replace(/^costi-tempi/, 'progetto').replace(/\.tex$/, '.json');
      scarica(nome, JSON.stringify(datiPerFile(), null, 2), 'application/json');
    });
    $('#btn-apri').addEventListener('click', () => $('#file-apri').click());
    $('#file-apri').addEventListener('change', e => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      const lettore = new FileReader();
      lettore.onload = () => {
        try {
          const letto = JSON.parse(lettore.result);
          if (!letto || typeof letto !== 'object' || (!Array.isArray(letto.costiPeriodo) && letto.formato !== 'costcurve')) throw new Error('formato');
          carica(letto, null);
          mostraPasso(modello.valido ? 4 : 1);
          avviso(`Progetto "${letto.titolo || file.name}" aperto.`);
        } catch (err) {
          avviso('Questo file non è un progetto di CostCurve. Scegli un file .json salvato con "Salva progetto".', true);
        }
      };
      lettore.readAsText(file);
    });

    // passo 4: output
    const serveValido = () => {
      if (modello.valido) return true;
      messaggioAzione('Prima completa i dati segnati in rosso: ti porto al primo da correggere.', 'errore');
      const primo = modello.problemi.find(p => p.livello === 'errore');
      if (primo) setTimeout(() => vaiACampo(primo.campo), 600);
      return false;
    };
    $('#btn-tex').addEventListener('click', () => {
      if (!serveValido()) return;
      scarica(latex.nomeFile(modello.titolo), latex.genera(modello), 'application/x-tex;charset=utf-8');
      messaggioAzione('File .tex scaricato. Aprilo su Overleaf o compilalo con pdflatex.', 'ok');
    });
    $('#btn-copia').addEventListener('click', async () => {
      if (!serveValido()) return;
      const testo = latex.genera(modello);
      try { await navigator.clipboard.writeText(testo); messaggioAzione('Codice LaTeX copiato negli appunti.', 'ok'); }
      catch (e) {
        const ta = $('#codice-latex');
        ta.closest('details').open = true; ta.focus(); ta.select();
        try { document.execCommand('copy'); messaggioAzione('Codice LaTeX copiato negli appunti.', 'ok'); }
        catch (e2) { messaggioAzione('Il browser non permette la copia automatica: il codice è selezionato, premi Ctrl+C.', 'avviso'); }
      }
    });
    $('#btn-stampa').addEventListener('click', () => { if (serveValido()) window.print(); });
    $('#btn-overleaf').addEventListener('click', () => {
      if (!serveValido()) return;
      const form = document.createElement('form');
      form.method = 'post'; form.action = 'https://www.overleaf.com/docs'; form.target = '_blank';
      const ta = document.createElement('textarea'); ta.name = 'snip'; ta.value = latex.genera(modello);
      const nome = document.createElement('input'); nome.type = 'hidden'; nome.name = 'snip_name'; nome.value = latex.nomeFile(modello.titolo);
      form.append(ta, nome); form.hidden = true;
      document.body.appendChild(form); form.submit(); form.remove();
      messaggioAzione('Apro Overleaf in una nuova scheda: il file .tex viene inviato a overleaf.com.', 'ok');
    });
    $('#btn-pdf').addEventListener('click', async () => {
      if (!serveValido()) return;
      if (!window.CC.pdf || !window.CC.pdf.disponibile()) {
        messaggioAzione('Il download diretto del PDF non è disponibile in questo browser: usa "Stampa / Salva come PDF".', 'avviso');
        return;
      }
      const b = $('#btn-pdf');
      b.disabled = true; messaggioAzione('Preparo il PDF…');
      try {
        const blob = await window.CC.pdf.crea(modello, svgCorrente);
        scarica(latex.nomeFile(modello.titolo).replace(/\.tex$/, '.pdf'), blob);
        messaggioAzione('PDF scaricato (report del browser). Il PDF "ufficiale" si ottiene compilando il .tex.', 'ok');
      } catch (err) {
        console.error(err);
        messaggioAzione('Non sono riuscito a creare il PDF: usa "Stampa / Salva come PDF", che funziona sempre.', 'errore');
      } finally { b.disabled = false; }
    });
  }

  function messaggioPiano(testo) {
    const mp = $('#msg-piano');
    mp.textContent = testo; mp.className = 'msg avviso';
  }

  function avviso(testo, errore) {
    const box = $('#problemi');
    const p = document.createElement('p');
    p.className = 'msg ' + (errore ? 'errore' : 'ok');
    p.setAttribute('role', 'status');
    p.textContent = testo;
    box.prepend(p);
    setTimeout(() => p.remove(), 6000);
  }

  function haDati() {
    return Boolean(String(dati.titolo).trim() || String(dati.bac).trim() || dati.costiPeriodo.some(v => String(v).trim() !== ''));
  }

  // ---------------------------------------------------------------------
  // Avvio
  // ---------------------------------------------------------------------
  function avvia() {
    collegaEventi();
    const salvato = leggiDalBrowser();
    if (salvato && salvato.dati) {
      carica(salvato.dati, salvato.esempio);
      mostraPasso(salvato.passo || 1);
    } else {
      // prima visita: si parte dall'esempio del libro, così si vede subito il risultato
      carica(JSON.parse(JSON.stringify(esempi.trova('libro').dati)), 'libro');
      mostraPasso(4);
    }
  }

  avvia();
})();
