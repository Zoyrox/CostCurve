/* =====================================================================
 * interfaccia.js — collega la pagina al modello e agli output
 * ---------------------------------------------------------------------
 * Flusso: l'utente scrive → i dati grezzi vengono salvati così come
 * sono stati scritti → calcoli.calcola() produce il modello UNA volta →
 * da quel modello si aggiornano grafico, messaggi, tabelle e, quando
 * si esporta, .tex, PDF e immagine.
 * ===================================================================== */
(function () {
  'use strict';

  const { numeri, calcoli, esempi, grafico, latex, report } = window.CC;
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  const CHIAVE = 'costcurve:v2';
  const CHIAVE_TEMA = 'costcurve:tema';

  let dati;                 // dati grezzi (stringhe come scritte dall'utente)
  let modello;              // ultimo modello calcolato
  let passo = 1;
  let esempioAttivo = null;
  let mostraTutti = false;  // mostra tutti gli errori (dopo "Risultati", "Esporta" o un file aperto)
  const toccati = new Set();
  let formatoEsporta = 'pdf';
  let timer = null;

  // ---------------------------------------------------------------------
  // Utilità
  // ---------------------------------------------------------------------
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const tema = () => (document.documentElement.getAttribute('data-tema') === 'scuro' ? 'scuro' : 'chiaro');
  const ut = () => calcoli.UNITA_TEMPO[dati.unitaTempo] || calcoli.UNITA_TEMPO.mesi;

  /** Valore da mostrare in un campo: 540000 -> "540.000" (le stringhe restano come sono). */
  function perCampo(v) {
    if (v === null || v === undefined) return '';
    // formato italiano senza perdere cifre: 2.675 -> "2,675", 540000 -> "540.000"
    if (typeof v === 'number') return Number.isFinite(v) ? numeri.formatNumero(v, Number.isInteger(v) ? 0 : 6).replace('−', '-').replace(/(,\d*?)0+$/, '$1').replace(/,$/, '') : '';
    return String(v);
  }
  const numero = v => { const x = numeri.leggiNumero(v); return typeof x === 'number' && Number.isFinite(x) ? x : null; };

  /** Copia "pulita" con numeri veri, per il salvataggio su file. */
  function datiPerFile() {
    const d = calcoli.normalizza(dati);
    const n = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);
    return {
      formato: 'costcurve', versione: 2, titolo: d.titolo, nota: d.nota, report: d.report,
      unitaTempo: d.unitaTempo, unitaMoneta: d.unitaMoneta, dataInizio: d.dataInizio,
      durata: n(d.durata), bac: n(d.bac), modoPiano: d.modoPiano, piano: d.piano.map(n),
      modoAvanzamento: d.modoAvanzamento, numeroRilevamenti: d.numeroRilevamenti,
      rilevamenti: d.rilevamenti.map(r => ({ periodo: n(r.periodo), bcwp: n(r.bcwp), acwp: n(r.acwp) })),
      avanzamento: d.avanzamento.map(a => ({ bcwp: n(a.bcwp), acwp: n(a.acwp) })),
      previsione: d.previsione, previsioneManuale: { eac: n(d.previsioneManuale.eac), fine: n(d.previsioneManuale.fine) },
      grafico: d.grafico, esporta: d.esporta,
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

  function salvaNelBrowser() {
    try { localStorage.setItem(CHIAVE, JSON.stringify({ dati, esempio: esempioAttivo, passo })); } catch (e) { /* memoria non disponibile */ }
  }
  function leggiDalBrowser() {
    try { const s = localStorage.getItem(CHIAVE) || localStorage.getItem('costcurve:v1'); return s ? JSON.parse(s) : null; } catch (e) { return null; }
  }

  // ---------------------------------------------------------------------
  // Caricamento dei dati nel modulo
  // ---------------------------------------------------------------------
  function carica(nuovi, idEsempio, opzioni = {}) {
    const d = calcoli.normalizza(nuovi);
    dati = {
      ...d,
      durata: perCampo(d.durata), bac: perCampo(d.bac),
      piano: d.piano.map(perCampo),
      rilevamenti: d.rilevamenti.map(r => ({ periodo: perCampo(r.periodo), bcwp: perCampo(r.bcwp), acwp: perCampo(r.acwp) })),
      avanzamento: d.avanzamento.map(a => ({ bcwp: perCampo(a.bcwp), acwp: perCampo(a.acwp) })),
      previsioneManuale: { eac: perCampo(d.previsioneManuale.eac), fine: perCampo(d.previsioneManuale.fine) },
    };
    if (opzioni.durataVuota) dati.durata = '';
    esempioAttivo = idEsempio || null;
    toccati.clear();
    mostraTutti = Boolean(opzioni.mostraTutti);
    riempiModulo();
    aggiorna();
  }

  function imposta(nome, valore) {
    const r = document.querySelector(`input[name="${nome}"][value="${valore}"]`);
    if (r) r.checked = true;
  }

  function riempiModulo() {
    $('#f-titolo').value = dati.titolo;
    $('#f-nota').value = dati.nota;
    $('#f-pm').value = dati.report.pm;
    $('#f-azienda').value = dati.report.azienda;
    $('#f-dataReport').value = dati.report.data;
    $('#f-commento').value = dati.report.commento;
    $('#dettagli-report').open = Boolean(dati.nota || dati.report.pm || dati.report.azienda || dati.report.data || dati.report.commento);
    $('#f-durata').value = dati.durata;
    $('#f-bac').value = dati.bac;
    const di = calcoli.leggiData(dati.dataInizio);
    $('#f-dataInizio').value = di ? di.toISOString().slice(0, 10) : '';
    imposta('unitaTempo', dati.unitaTempo);
    imposta('unitaMoneta', dati.unitaMoneta);
    imposta('modoPiano', dati.modoPiano);
    imposta('modoAvanzamento', dati.modoAvanzamento);
    imposta('numeroRilevamenti', String(dati.numeroRilevamenti));
    imposta('previsione', dati.previsione);
    dati.rilevamenti.forEach((r, i) => {
      $(`#f-ril-${i}-periodo`).value = r.periodo;
      $(`#f-ril-${i}-bcwp`).value = r.bcwp;
      $(`#f-ril-${i}-acwp`).value = r.acwp;
    });
    $('#f-prev-eac').value = dati.previsioneManuale.eac;
    $('#f-prev-fine').value = dati.previsioneManuale.fine;
    $$('[data-mostra]').forEach(c => { c.checked = dati.grafico.mostra[c.dataset.mostra] !== false; });
    $('#s-proporzioni').value = String(dati.grafico.proporzioni);
    costruisciTabelle();
    aggiornaVisibilita();
    aggiornaEtichetteUnita();
  }

  function durataValida() {
    const n = numeri.leggiNumero(dati.durata);
    return Number.isInteger(n) && n >= 1 && n <= calcoli.DURATA_MAX ? n : 0;
  }

  /** Etichetta di riga: numero del periodo e, se c'è la data di inizio, la data. */
  function testaRiga(i) {
    const inizio = calcoli.leggiData(dati.dataInizio);
    return `${i}${inizio ? `<small>${esc(calcoli.etichettaData(inizio, dati.unitaTempo, i))}</small>` : ''}`;
  }

  function costruisciTabelle() {
    const n = durataValida();
    const corpoP = $('#righe-piano'), corpoA = $('#righe-avanzamento');
    if (!n) {
      const vuoto = '<tr><td colspan="3" class="vuoto">Inserisci prima la durata nel passo 1.</td></tr>';
      corpoP.innerHTML = vuoto; corpoA.innerHTML = vuoto;
      return;
    }
    dati.piano = calcoli.adattaLista(dati.piano, n).map(v => (v === null ? '' : v));
    dati.avanzamento = calcoli.adattaLista(dati.avanzamento, n, () => ({ bcwp: '', acwp: '' })).map(a => a || { bcwp: '', acwp: '' });
    const s = ut().singolare;
    const cosa = dati.modoPiano === 'cumulato' ? 'Totale progressivo pianificato' : 'Costo pianificato';
    corpoP.innerHTML = dati.piano.map((v, i) => `<tr>
        <th scope="row">${testaRiga(i + 1)}</th>
        <td><input type="text" inputmode="decimal" autocomplete="off" data-i="${i}" id="f-costo-${i + 1}" aria-label="${cosa}, ${s} ${i + 1}" value="${esc(v)}"></td>
        <td class="cum" data-cum="${i}">—</td></tr>`).join('');
    corpoA.innerHTML = dati.avanzamento.map((a, i) => `<tr data-riga="${i + 1}">
        <th scope="row">${testaRiga(i + 1)}</th>
        <td><input type="text" inputmode="decimal" autocomplete="off" data-i="${i}" data-k="bcwp" id="f-av-${i + 1}-bcwp" aria-label="BCWP cumulato, ${s} ${i + 1}" value="${esc(a.bcwp)}"></td>
        <td><input type="text" inputmode="decimal" autocomplete="off" data-i="${i}" data-k="acwp" id="f-av-${i + 1}-acwp" aria-label="ACWP cumulato, ${s} ${i + 1}" value="${esc(a.acwp)}"></td></tr>`).join('');
    $('#th-piano').textContent = dati.modoPiano === 'cumulato' ? 'Totale progressivo' : 'Costo nel periodo';
    $('#th-piano-2').textContent = dati.modoPiano === 'cumulato' ? 'Nel periodo' : 'Totale';
  }

  function aggiornaVisibilita() {
    const perPeriodo = dati.modoAvanzamento === 'periodi';
    $$('.solo-ril').forEach(el => { el.hidden = perPeriodo; });
    $('.solo-per').hidden = !perPeriodo;
    $('.scheda-ril[data-ril="1"]').hidden = Number(dati.numeroRilevamenti) === 1;
    $('.solo-prev-man').hidden = dati.previsione !== 'manuale';
    $('#aiuto-modo-av').textContent = perPeriodo
      ? 'Scrivi BCWP e ACWP nella tabella per ogni periodo in cui li conosci (anche solo alcuni). Le curve passano per tutti i valori. Nei periodi dei rilevamenti servono entrambi.'
      : 'Scrivi BCWP e ACWP solo ai rilevamenti: le curve partono da zero e passano per quei punti.';
    $('#aiuto-previsione').textContent = {
      auto: 'Calcolata con l\'ultimo rilevamento: EAC = BAC / CPI e fine = durata / SPI (assunzione, non nel libro).',
      manuale: 'Scrivi tu il costo finale e quando prevedi di finire: la curva tratteggiata li raggiunge.',
      no: 'Il grafico non mostra né la previsione né le date di fine.',
    }[dati.previsione];
  }

  function aggiornaEtichetteUnita() {
    const u = ut();
    $$('[data-unita-tempo]').forEach(el => { el.textContent = `(${u.plurale})`; });
    $$('[data-unita-tempo-sing]').forEach(el => { el.textContent = u.singolare[0].toUpperCase() + u.singolare.slice(1); });
    $$('[data-unita-tempo-sing-min]').forEach(el => { el.textContent = u.singolare; });
    const n = durataValida();
    $$('#f-ril-0-periodo, #f-ril-1-periodo').forEach(inp => { if (n) inp.max = n; });
  }

  // ---------------------------------------------------------------------
  // Ricalcolo e aggiornamento
  // ---------------------------------------------------------------------
  function programmaAggiorna() {
    clearTimeout(timer);
    timer = setTimeout(aggiorna, 110);
  }

  const PASSO_DEL_CAMPO = c => (/^(titolo|durata|bac|dataInizio)$/.test(c) ? 1 : /^(costo-|piano)/.test(c) ? 2 : /^(ril-|av-|prev-|avanzamento)/.test(c) ? 3 : 1);
  const visibile = p => mostraTutti || toccati.has(p.campo) || (/^costo-/.test(p.campo) && toccati.has('piano')) || (/^av-/.test(p.campo) && toccati.has('avanzamento'));
  const haDati = () => Boolean(String(dati.titolo).trim() || String(dati.bac).trim() || dati.piano.some(v => String(v).trim() !== ''));

  function aggiorna() {
    modello = calcoli.calcola(dati);
    const errori = modello.problemi.filter(p => p.livello === 'errore');
    const avvisi = modello.problemi.filter(p => p.livello === 'avviso');

    // 1) messaggi accanto ai campi (solo per i campi già toccati)
    $$('.msg').forEach(el => { if (el.id !== 'msg-esporta') { el.textContent = ''; el.className = 'msg'; } });
    $$('[aria-invalid="true"]').forEach(el => el.removeAttribute('aria-invalid'));
    const perTabella = { piano: [], avanzamento: [] };
    for (const p of modello.problemi) {
      if (!visibile(p)) continue;
      const inp = document.getElementById('f-' + p.campo);
      if (inp && p.livello === 'errore') inp.setAttribute('aria-invalid', 'true');
      if (/^costo-|^piano$/.test(p.campo)) { perTabella.piano.push(p); continue; }
      if (/^av-/.test(p.campo)) { perTabella.avanzamento.push(p); continue; }
      const el = document.getElementById('msg-' + p.campo);
      if (el && !el.textContent) { el.textContent = p.messaggio; el.className = 'msg ' + p.livello; }
    }
    for (const [k, lista] of Object.entries(perTabella)) {
      const el = $('#msg-' + k);
      if (!lista.length) continue;
      const err = lista.filter(p => p.livello === 'errore');
      const l = err.length ? err : lista;
      el.textContent = l[0].messaggio + (l.length > 1 ? ` (e altri ${l.length - 1})` : '');
      el.className = 'msg ' + (err.length ? 'errore' : 'avviso');
    }

    // 2) stato dei passi
    for (let k = 1; k <= 3; k++) {
      const err = errori.filter(p => PASSO_DEL_CAMPO(p.campo) === k);
      $('#tab-' + k).dataset.stato = err.length ? (err.some(visibile) ? 'errore' : '') : 'ok';
    }
    $('#tab-4').dataset.stato = modello.valido ? 'ok' : '';

    // 3) tabelle: cumulati, somma, righe dei rilevamenti
    aggiornaPiano();
    const tRil = new Set(dati.rilevamenti.slice(0, Number(dati.numeroRilevamenti)).map(r => numeri.leggiNumero(r.periodo)));
    $$('#righe-avanzamento tr[data-riga]').forEach(tr => tr.classList.toggle('riga-evidenziata', tRil.has(Number(tr.dataset.riga))));
    const cum = cumulatiGrezzi();
    dati.rilevamenti.forEach((r, i) => {
      const t = numeri.leggiNumero(r.periodo);
      $(`#out-ril-${i}-bcws`).textContent = cum && Number.isInteger(t) && t >= 1 && t < cum.length ? numeri.formatNumero(cum[t]) : '—';
    });

    // 4) grafico e titoli
    $('#barra-titolo').textContent = dati.titolo || 'Nuovo progetto';
    $('#grafico-titolo').textContent = dati.titolo || 'Diagramma costi-tempi';
    disegnaGrafico(errori, avvisi);

    // 5) risultati e report
    if (modello.valido) {
      $('#riepilogo-risultati').innerHTML = report.riepilogo(modello);
      $('#report').innerHTML = report.report(modello, '');
      $('#report').hidden = false;
    } else {
      $('#riepilogo-risultati').innerHTML = `<div class="da-completare"><p>Mancano ancora alcuni dati</p><ul>${errori.slice(0, 6).map(p => `<li><button type="button" class="link" data-vai="${p.campo}">${esc(p.messaggio)}</button></li>`).join('')}</ul></div>`;
      $('#report').innerHTML = '';
      $('#report').hidden = true;
    }
    salvaNelBrowser();
  }

  function disegnaGrafico(errori, avvisi) {
    errori = errori || modello.problemi.filter(p => p.livello === 'errore');
    avvisi = avvisi || modello.problemi.filter(p => p.livello === 'avviso');
    const box = $('#problemi');
    const cont = $('#contenitore-grafico');
    $('#semafori').innerHTML = '';
    if (modello.valido) {
      $('#grafico').innerHTML = grafico.disegna(modello, { tema: tema() });
      $('#semafori').innerHTML = report.semafori(modello);
      box.innerHTML = avvisi.length ? `<ul class="lista-avvisi">${avvisi.map(p => `<li><button type="button" class="link" data-vai="${p.campo}">${esc(p.messaggio)}</button></li>`).join('')}</ul>` : '';
      const a = modello.assi, p = a.pieno;
      const livello = Math.round((p.xmax - p.xmin) / (a.xmax - a.xmin) * 100);
      $('#livello-zoom').textContent = livello + '%';
      $('#grafico-sottotitolo').textContent = a.zoomato
        ? `Vista: ${ut().plurale} ${numeri.formatNumero(a.xmin, 'auto')} – ${numeri.formatNumero(a.xmax, 'auto')}${a.assePezzato ? ' · asse dei costi da ' + numeri.formatNumero(a.ymin, a.decimaliY) : ''}`
        : `${modello.durata} ${ut().plurale} · budget ${numeri.formatNumero(modello.bac)} ${modello.unitaMoneta.breve}`;
      cont.classList.toggle('zoomato', a.zoomato);
      $('#aiuto-grafico').hidden = false;
    } else if (!haDati()) {
      $('#grafico').innerHTML = `<div class="vuoto-iniziale">
          <svg class="ico ico-grande"><use href="#i-grafico"/></svg>
          <h2>Inizia un nuovo progetto</h2>
          <p>Compila i dati a sinistra: titolo, durata e budget, poi il piano e i rilevamenti. Il diagramma compare qui mentre scrivi.</p>
          <div class="azioni-vuoto">
            <button type="button" class="btn btn-primario" data-esempio="grafico-libro">Apri il grafico del libro</button>
            <button type="button" class="btn btn-secondario" data-esempio="libro">Esempio numerico del libro</button>
          </div></div>`;
      box.innerHTML = '';
      $('#grafico-sottotitolo').textContent = '';
      $('#livello-zoom').textContent = '100%';
      cont.classList.remove('zoomato');
      $('#aiuto-grafico').hidden = true;
    } else {
      $('#grafico').innerHTML = grafico.segnaposto(errori.length === 1 ? 'Manca un solo dato.' : `Mancano ${errori.length} dati.`, tema());
      box.innerHTML = `<div class="da-completare"><p>Per vedere il diagramma completa:</p><ul>${errori.slice(0, 5).map(p => `<li><button type="button" class="link" data-vai="${p.campo}">${esc(p.messaggio)}</button></li>`).join('')}</ul>${errori.length > 5 ? `<p>…e altri ${errori.length - 5}.</p>` : ''}</div>`;
      $('#grafico-sottotitolo').textContent = '';
      cont.classList.remove('zoomato');
      $('#aiuto-grafico').hidden = true;
    }
  }

  /** Cumulati del piano dai valori scritti (null se il piano non è completo). */
  function cumulatiGrezzi() {
    const valori = dati.piano.map(numeri.leggiNumero);
    if (!valori.length || valori.some(v => v === null || !Number.isFinite(v) || v < 0)) return null;
    if (dati.modoPiano === 'cumulato') return [0, ...valori];
    const c = [0];
    valori.forEach(v => c.push(c[c.length - 1] + v));
    return c;
  }

  function aggiornaPiano() {
    const cumul = dati.modoPiano === 'cumulato';
    let somma = 0, prec = 0, completo = true;
    dati.piano.forEach((v, i) => {
      const x = numeri.leggiNumero(v);
      const cella = document.querySelector(`[data-cum="${i}"]`);
      const ok = typeof x === 'number' && Number.isFinite(x) && x >= 0;
      if (!ok) completo = false;
      let mostra = '—';
      if (ok && completo) {
        if (cumul) { mostra = numeri.formatNumero(x - prec); prec = x; somma = x; }
        else { somma += x; mostra = numeri.formatNumero(somma); }
      }
      if (cella) cella.textContent = mostra;
    });
    const bac = numeri.leggiNumero(dati.bac);
    const box = $('#somma-piano');
    if (!dati.piano.length || !dati.piano.some(v => String(v).trim() !== '')) { box.innerHTML = ''; return; }
    const pct = bac > 0 ? Math.min(100, somma / bac * 100) : 0;
    const uguale = bac > 0 && Math.abs(somma - bac) <= 0.005;
    box.className = 'somma' + (uguale ? ' ok' : '');
    box.innerHTML = `<div class="somma-testo"><span>Totale del piano <strong>${numeri.formatNumero(somma)}</strong>${bac > 0 ? ` su un budget di <strong>${numeri.formatNumero(bac)}</strong>` : ''}</span>
        ${uguale ? '<span class="ok-testo">✓ coincide con il budget</span>' : ''}</div>
      <div class="barra-avanz" aria-hidden="true"><span style="width:${pct.toFixed(1)}%"></span></div>
      ${completo && bac > 0 && !uguale && somma > 0 ? `<div class="correzioni">
        <button type="button" class="btn btn-secondario btn-piccolo" id="btn-bac-da-somma">Usa ${numeri.formatNumero(somma)} come budget</button>
        ${cumul ? '' : `<button type="button" class="btn btn-secondario btn-piccolo" id="btn-scala-piano">Adatta i costi a ${numeri.formatNumero(bac)}</button>`}</div>` : ''}`;
  }

  // ---------------------------------------------------------------------
  // Passi
  // ---------------------------------------------------------------------
  function mostraPasso(n, focus) {
    passo = Math.max(1, Math.min(4, n));
    if (passo === 4 && !mostraTutti) { mostraTutti = true; aggiorna(); }
    for (let k = 1; k <= 4; k++) {
      const attivo = k === passo;
      $('#tab-' + k).setAttribute('aria-selected', String(attivo));
      $('#tab-' + k).tabIndex = attivo ? 0 : -1;
      $('#passo-' + k).hidden = !attivo;
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
    if (el && el.offsetParent !== null) {
      el.focus({ preventScroll: true });
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }

  // ---------------------------------------------------------------------
  // Zoom, spostamento e valori al passaggio del mouse
  // ---------------------------------------------------------------------
  /** Geometria del grafico sullo schermo: da pixel a valori e viceversa. */
  function geom() {
    const svg = $('#grafico svg[data-l]');
    if (!svg || !modello.valido) return null;
    const r = svg.getBoundingClientRect(), c = $('#contenitore-grafico').getBoundingClientRect();
    const k = r.width / svg.viewBox.baseVal.width;
    const L = +svg.dataset.l * k, T = +svg.dataset.t * k, PW = +svg.dataset.pw * k, PH = +svg.dataset.ph * k;
    const a = modello.assi;
    return {
      ox: r.left - c.left, oy: r.top - c.top, L, T, PW, PH, r,
      x: cx => a.xmin + (cx - r.left - L) / PW * (a.xmax - a.xmin),
      y: cy => a.ymin + (r.top + T + PH - cy) / PH * (a.ymax - a.ymin),
      px: x => r.left - c.left + L + (x - a.xmin) / (a.xmax - a.xmin) * PW,
      dentro: (cx, cy) => cx >= r.left + L && cx <= r.left + L + PW && cy >= r.top + T && cy <= r.top + T + PH,
    };
  }

  function impostaVista(v) {
    const p = modello.assi.pieno;
    const nuova = { da: null, a: null, ymin: null, ymax: null, ...v };
    if (nuova.da !== null && nuova.a !== null) {
      const amp = Math.max(0.5, nuova.a - nuova.da);
      nuova.da = Math.max(p.xmin, nuova.da);
      nuova.a = Math.min(p.xmax, nuova.da + amp);
      nuova.da = Math.max(p.xmin, nuova.a - amp);
      if (nuova.da <= p.xmin + 1e-9 && nuova.a >= p.xmax - 1e-9 && nuova.ymin === null) { nuova.da = null; nuova.a = null; }
    }
    dati.grafico.vista = nuova;
    modello = calcoli.calcola(dati);
    disegnaGrafico();
    salvaNelBrowser();
  }

  function zoomAttorno(x, fattore) {
    const a = modello.assi;
    const da = x - (x - a.xmin) * fattore, fino = x + (a.xmax - x) * fattore;
    const v = dati.grafico.vista;
    const conY = v && Number.isFinite(v.ymin) && Number.isFinite(v.ymax);
    impostaVista({ da, a: fino, ymin: conY ? v.ymin : null, ymax: conY ? v.ymax : null });
  }

  function collegaZoom() {
    const cont = $('#contenitore-grafico');
    const sel = $('#selezione'), guida = $('#guida'), tip = $('#tooltip');
    let trascina = null;
    let timerAvviso = null;

    $('#z-piu').addEventListener('click', () => { if (modello.valido) zoomAttorno((modello.assi.xmin + modello.assi.xmax) / 2, 0.7); });
    $('#z-meno').addEventListener('click', () => { if (modello.valido) zoomAttorno((modello.assi.xmin + modello.assi.xmax) / 2, 1 / 0.7); });
    $('#z-adatta').addEventListener('click', () => { if (modello.valido) impostaVista({}); });

    cont.addEventListener('wheel', e => {
      const g = geom();
      if (!g) return;
      if (!(e.ctrlKey || e.metaKey)) {
        $('#avviso-zoom').hidden = false;
        clearTimeout(timerAvviso);
        timerAvviso = setTimeout(() => { $('#avviso-zoom').hidden = true; }, 1200);
        return;
      }
      e.preventDefault();
      zoomAttorno(g.x(e.clientX), Math.exp(e.deltaY * 0.0018));
    }, { passive: false });

    cont.addEventListener('dblclick', () => { if (modello.valido) impostaVista({}); });

    cont.addEventListener('pointerdown', e => {
      const g = geom();
      if (!g || e.button !== 0 || !g.dentro(e.clientX, e.clientY)) return;
      const v = dati.grafico.vista || {};
      trascina = { tipo: e.shiftKey ? 'area' : 'sposta', x0: e.clientX, y0: e.clientY, g, assi: { ...modello.assi }, conY: Number.isFinite(v.ymin) && Number.isFinite(v.ymax) };
      if (trascina.tipo === 'sposta' && !modello.assi.zoomato) { trascina = null; return; }
      cont.setPointerCapture(e.pointerId);
      if (trascina.tipo === 'sposta') cont.classList.add('trascina');
      tip.hidden = true; guida.hidden = true;
      e.preventDefault();
    });
    cont.addEventListener('pointermove', e => {
      if (trascina) {
        const t = trascina, g = t.g;
        if (t.tipo === 'area') {
          const c = cont.getBoundingClientRect();
          const x1 = Math.max(g.r.left + g.L, Math.min(e.clientX, g.r.left + g.L + g.PW)), y1 = Math.max(g.r.top + g.T, Math.min(e.clientY, g.r.top + g.T + g.PH));
          sel.hidden = false;
          Object.assign(sel.style, { left: Math.min(t.x0, x1) - c.left + 'px', top: Math.min(t.y0, y1) - c.top + 'px', width: Math.abs(x1 - t.x0) + 'px', height: Math.abs(y1 - t.y0) + 'px' });
        } else {
          const dx = (e.clientX - t.x0) / g.PW * (t.assi.xmax - t.assi.xmin);
          const dy = (e.clientY - t.y0) / g.PH * (t.assi.ymax - t.assi.ymin);
          impostaVista({ da: t.assi.xmin - dx, a: t.assi.xmax - dx, ymin: t.conY ? t.assi.ymin + dy : null, ymax: t.conY ? t.assi.ymax + dy : null });
          trascina.g = geom();
        }
        return;
      }
      mostraValori(e);
    });
    const fine = e => {
      if (!trascina) return;
      const t = trascina;
      trascina = null;
      cont.classList.remove('trascina');
      sel.hidden = true;
      if (t.tipo === 'area' && Math.abs(e.clientX - t.x0) > 12 && Math.abs(e.clientY - t.y0) > 12) {
        const g = t.g;
        const xa = g.x(t.x0), xb = g.x(e.clientX), ya = g.y(t.y0), yb = g.y(e.clientY);
        impostaVista({ da: Math.min(xa, xb), a: Math.max(xa, xb), ymin: Math.max(0, Math.min(ya, yb)), ymax: Math.max(ya, yb) });
      }
    };
    cont.addEventListener('pointerup', fine);
    cont.addEventListener('pointercancel', fine);
    cont.addEventListener('pointerleave', () => { if (!trascina) { tip.hidden = true; guida.hidden = true; } });

    /** Riquadro con i valori VERI del periodo sotto il mouse (mai valori inventati). */
    function mostraValori(e) {
      const g = geom();
      if (!g || !g.dentro(e.clientX, e.clientY)) { tip.hidden = true; guida.hidden = true; return; }
      const m = modello;
      const k = Math.round(g.x(e.clientX));
      if (k < 0 || k > m.durata || k < m.assi.xmin - 1e-9 || k > m.assi.xmax + 1e-9) { tip.hidden = true; guida.hidden = true; return; }
      const pt = s => { const p = m.punti[s].find(q => q[0] === k); return p ? p[1] : (k === 0 ? 0 : null); };
      const ril = m.rilevamenti.find(r => r.t === k);
      const C = grafico.TEMI[tema()];
      const riga = (colore, nome, v) => `<div class="tt-riga"><span><span class="tt-punto" style="background:${colore}"></span>${nome}</span><b>${v === null ? '—' : numeri.formatNumero(v)}</b></div>`;
      let h = `<div class="tt-titolo">${esc(ut().singolare[0].toUpperCase() + ut().singolare.slice(1))} ${k}${m.inizio ? ' · ' + esc(m.etichettaTempo(k)) : ''}${ril ? ` · rilevamento ${ril.n}` : ''}</div>`;
      h += riga(C.bcws, 'BCWS pianificato', m.bcwsCum[k]);
      h += riga(C.bcwp, 'BCWP lavoro svolto', pt('bcwp'));
      h += riga(C.acwp, 'ACWP costo effettivo', pt('acwp'));
      if (ril) {
        h += '<div class="tt-sep"></div>';
        h += `<div class="tt-riga"><span>CV</span><b class="${ril.cv < 0 ? 'neg' : ril.cv > 0 ? 'pos' : ''}">${numeri.formatConSegno(ril.cv)} (${numeri.formatPercentuale(ril.pcv)})</b></div>`;
        h += `<div class="tt-riga"><span>SV</span><b class="${ril.sv < 0 ? 'neg' : ril.sv > 0 ? 'pos' : ''}">${numeri.formatConSegno(ril.sv)} (${numeri.formatPercentuale(ril.psv)})</b></div>`;
      } else if (pt('bcwp') === null || pt('acwp') === null) {
        h += '<div class="tt-sep"></div><div class="tt-riga"><span>— = valore non rilevato in questo periodo</span></div>';
      }
      tip.innerHTML = h;
      tip.hidden = false;
      guida.hidden = false;
      const c = $('#contenitore-grafico').getBoundingClientRect();
      const xg = g.px(k);
      Object.assign(guida.style, { left: xg + 'px', top: g.oy + g.T + 'px', height: g.PH + 'px' });
      const w = tip.offsetWidth, hh = tip.offsetHeight;
      let left = e.clientX - c.left + 16;
      if (left + w > c.width - 8) left = e.clientX - c.left - w - 16;
      let top = e.clientY - c.top - hh / 2;
      top = Math.max(4, Math.min(top, c.height - hh - 4));
      Object.assign(tip.style, { left: left + 'px', top: top + 'px' });
    }

    // Intervallo preciso
    const popI = $('#m-intervallo');
    const apriIntervallo = () => {
      const v = dati.grafico.vista || {}, a = modello.valido ? modello.assi : null;
      $('#v-da').value = a && a.zoomato ? numeri.formatNumero(a.xmin, 'auto') : '';
      $('#v-a').value = a && a.zoomato ? numeri.formatNumero(a.xmax, 'auto') : '';
      $('#v-ymin').value = Number.isFinite(v.ymin) ? perCampo(v.ymin) : '';
      $('#v-ymax').value = Number.isFinite(v.ymax) ? perCampo(v.ymax) : '';
    };
    $('#v-applica').addEventListener('click', () => {
      if (!modello.valido) return;
      const da = numero($('#v-da').value), a = numero($('#v-a').value), y0 = numero($('#v-ymin').value), y1 = numero($('#v-ymax').value);
      const p = modello.assi.pieno;
      impostaVista({ da: da === null && a === null ? null : (da ?? p.xmin), a: da === null && a === null ? null : (a ?? p.xmax), ymin: y0 !== null && y1 !== null && y1 > y0 ? y0 : null, ymax: y0 !== null && y1 !== null && y1 > y0 ? y1 : null });
      chiudiMenu();
    });
    $('#v-reimposta').addEventListener('click', () => { if (modello.valido) impostaVista({}); chiudiMenu(); });

    // Menu a comparsa
    const menu = [['#b-intervallo', '#m-intervallo', apriIntervallo], ['#b-mostra', '#m-mostra', null]];
    function chiudiMenu() { menu.forEach(([b, m]) => { $(m).hidden = true; $(b).setAttribute('aria-expanded', 'false'); }); }
    menu.forEach(([b, m, apri]) => {
      $(b).addEventListener('click', e => {
        e.stopPropagation();
        const aperto = !$(m).hidden;
        chiudiMenu();
        if (!aperto) { if (apri) apri(); $(m).hidden = false; $(b).setAttribute('aria-expanded', 'true'); const f = $(m).querySelector('input, select'); if (f) f.focus(); }
      });
      $(m).addEventListener('click', e => e.stopPropagation());
    });
    document.addEventListener('click', chiudiMenu);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') chiudiMenu(); });
    popI.addEventListener('keydown', e => { if (e.key === 'Enter') $('#v-applica').click(); });

    // Mostra / nascondi e proporzioni
    $$('[data-mostra]').forEach(c => c.addEventListener('change', () => {
      dati.grafico.mostra[c.dataset.mostra] = c.checked;
      aggiorna();
    }));
    const opzProp = calcoli.PROPORZIONI.map(p => `<option value="${p.valore}">${p.nome}</option>`).join('');
    $('#s-proporzioni').innerHTML = opzProp;
    $('#e-proporzioni').innerHTML = opzProp;
    $('#s-proporzioni').addEventListener('change', e => { dati.grafico.proporzioni = Number(e.target.value); aggiorna(); });

    // Schermo intero
    $('#b-schermo').addEventListener('click', () => {
      const s = $('#scheda-grafico');
      if (document.fullscreenElement) document.exitFullscreen();
      else if (s.requestFullscreen) s.requestFullscreen().catch(() => {});
    });
  }

  // ---------------------------------------------------------------------
  // Finestra Esporta
  // ---------------------------------------------------------------------
  function apriEsporta() {
    if (!modello.valido) {
      mostraTutti = true; aggiorna();
      const primo = modello.problemi.find(p => p.livello === 'errore');
      if (primo) vaiACampo(primo.campo);
      return;
    }
    const e = dati.esporta;
    imposta('formato', formatoEsporta);
    imposta('pagina', e.pagina);
    imposta('dimensione', e.dimensione);
    const zoom = modello.assi.zoomato;
    $('#e-attuale').disabled = !zoom;
    imposta('vista', zoom ? e.vista : 'intera');
    $('#e-proporzioni').value = String(dati.grafico.proporzioni);
    $('#msg-esporta').textContent = '';
    aggiornaFinestra();
    $('#finestra-esporta').showModal();
  }

  function aggiornaFinestra() {
    const f = $('input[name="formato"]:checked').value;
    $('.azioni-tex').hidden = f !== 'tex';
    $('.opzioni-pagina').hidden = f === 'svg';
    $('#btn-scarica-testo').textContent = { pdf: 'Scarica PDF', tex: 'Scarica .tex', svg: 'Scarica SVG', stampa: 'Stampa' }[f];
  }

  function opzioniDaFinestra() {
    const val = n => $(`input[name="${n}"]:checked`).value;
    formatoEsporta = val('formato');
    dati.esporta = { pagina: val('pagina'), dimensione: val('dimensione'), vista: val('vista') };
    dati.grafico.proporzioni = Number($('#e-proporzioni').value);
    $('#s-proporzioni').value = String(dati.grafico.proporzioni);
    salvaNelBrowser();
    return calcoli.calcola(dati, { vistaIntera: dati.esporta.vista !== 'attuale' });
  }

  function messaggioEsporta(testo, tipo) {
    const el = $('#msg-esporta');
    el.textContent = testo; el.className = 'msg ' + (tipo || '');
  }

  async function esegui() {
    const m = opzioniDaFinestra();
    if (!m.valido) { messaggioEsporta('Ci sono dati da correggere.', 'errore'); return; }
    const nome = latex.nomeFile(m.titolo);
    const f = formatoEsporta;
    if (f === 'tex') {
      scarica(nome, latex.genera(m), 'application/x-tex;charset=utf-8');
      messaggioEsporta('File .tex scaricato: si compila con pdflatex o su Overleaf.', 'ok');
    } else if (f === 'svg') {
      scarica(nome.replace(/\.tex$/, '.svg'), grafico.disegna(m, { tema: 'chiaro' }), 'image/svg+xml');
      messaggioEsporta('Immagine SVG scaricata.', 'ok');
    } else if (f === 'stampa') {
      prepara_stampa(m);
      $('#finestra-esporta').close();
      setTimeout(() => window.print(), 60);
    } else {
      if (!window.CC.pdf || !window.CC.pdf.disponibile()) { messaggioEsporta('Il PDF diretto non è disponibile in questo browser: scegli "Stampa" e poi "Salva come PDF".', 'avviso'); return; }
      const b = $('#btn-scarica');
      b.disabled = true; messaggioEsporta('Preparo il PDF…');
      try {
        const blob = await window.CC.pdf.crea(m, { svg: grafico.disegna(m, { tema: 'chiaro', larghezza: dati.esporta.pagina === 'orizzontale' ? 1100 : 960 }), ...dati.esporta });
        scarica(nome.replace(/\.tex$/, '.pdf'), blob);
        messaggioEsporta('PDF scaricato.', 'ok');
      } catch (err) {
        console.error(err);
        messaggioEsporta('Non sono riuscito a creare il PDF: scegli "Stampa" e poi "Salva come PDF".', 'errore');
      } finally { b.disabled = false; }
    }
  }

  /** Stampa: report con il grafico in tema chiaro e la pagina scelta. */
  function prepara_stampa(m) {
    $('#report').innerHTML = report.report(m, grafico.disegna(m, { tema: 'chiaro' }), { graficoPrima: dati.esporta.pagina === 'orizzontale' });
    $('#report').hidden = false;
    document.body.dataset.stampaPagina = dati.esporta.pagina;
    document.body.dataset.stampaDimensione = dati.esporta.dimensione;
  }
  window.addEventListener('afterprint', () => { if (modello.valido) $('#report').innerHTML = report.report(modello, ''); });

  // ---------------------------------------------------------------------
  // Eventi
  // ---------------------------------------------------------------------
  function datoModificato(ricostruisci) {
    if (esempioAttivo) esempioAttivo = null;
    if (ricostruisci) costruisciTabelle();
    programmaAggiorna();
  }

  function incolla(e, colonne) {
    const inp = e.target;
    const i = Number(inp.dataset.i);
    const testo = (e.clipboardData || window.clipboardData).getData('text');
    const righe = testo.replace(/\r/g, '').split('\n').filter(r => r.trim() !== '');
    if (!Number.isInteger(i) || (righe.length < 2 && !(colonne && righe[0] && righe[0].includes('\t')))) return false;
    e.preventDefault();
    const n = durataValida();
    righe.slice(0, n - i).forEach((r, k) => {
      const celle = r.split(/\t|;/).map(c => c.trim());
      if (colonne) {
        const inizio = inp.dataset.k === 'acwp' ? 1 : 0;
        celle.slice(0, 2 - inizio).forEach((c, j) => { dati.avanzamento[i + k][['bcwp', 'acwp'][inizio + j]] = c; });
      } else dati.piano[i + k] = celle[0];
    });
    return true;
  }

  function collegaEventi() {
    // passo 1
    const testo = (id, f) => $(id).addEventListener('input', e => { f(e.target.value); datoModificato(); });
    testo('#f-titolo', v => { dati.titolo = v; });
    testo('#f-nota', v => { dati.nota = v; });
    testo('#f-pm', v => { dati.report.pm = v; });
    testo('#f-azienda', v => { dati.report.azienda = v; });
    testo('#f-dataReport', v => { dati.report.data = v; });
    testo('#f-commento', v => { dati.report.commento = v; });
    testo('#f-bac', v => { dati.bac = v; });
    $('#f-durata').addEventListener('input', e => { dati.durata = e.target.value; aggiornaEtichetteUnita(); datoModificato(true); });
    $('#f-dataInizio').addEventListener('change', e => { dati.dataInizio = e.target.value; datoModificato(true); });
    const radio = (nome, f) => $$(`input[name="${nome}"]`).forEach(r => r.addEventListener('change', e => f(e.target.value)));
    radio('unitaTempo', v => { dati.unitaTempo = v; aggiornaEtichetteUnita(); datoModificato(true); });
    radio('unitaMoneta', v => { dati.unitaMoneta = v; datoModificato(); });
    radio('modoPiano', v => {
      // conversione dei valori già scritti, così non si perde nulla
      const valori = dati.piano.map(numeri.leggiNumero);
      if (valori.every(x => typeof x === 'number' && Number.isFinite(x))) {
        let c = 0;
        dati.piano = v === 'cumulato' ? valori.map(x => perCampo(Math.round((c += x) * 1e6) / 1e6)) : valori.map((x, i) => perCampo(Math.round((x - (i ? valori[i - 1] : 0)) * 1e6) / 1e6));
      }
      dati.modoPiano = v; datoModificato(true);
    });
    radio('numeroRilevamenti', v => { dati.numeroRilevamenti = Number(v); aggiornaVisibilita(); datoModificato(); });
    radio('modoAvanzamento', v => {
      const n = durataValida();
      if (v === 'periodi' && n) {
        dati.avanzamento = calcoli.adattaLista(dati.avanzamento, n, () => ({ bcwp: '', acwp: '' }));
        dati.rilevamenti.forEach(r => {
          const t = numeri.leggiNumero(r.periodo);
          if (Number.isInteger(t) && t >= 1 && t <= n) {
            const a = dati.avanzamento[t - 1];
            if (String(a.bcwp).trim() === '') a.bcwp = r.bcwp;
            if (String(a.acwp).trim() === '') a.acwp = r.acwp;
          }
        });
      } else if (v === 'rilevamenti') {
        dati.rilevamenti.forEach((r, i) => {
          const t = numeri.leggiNumero(r.periodo), a = Number.isInteger(t) && dati.avanzamento[t - 1];
          if (a) { r.bcwp = a.bcwp; r.acwp = a.acwp; $(`#f-ril-${i}-bcwp`).value = r.bcwp; $(`#f-ril-${i}-acwp`).value = r.acwp; }
        });
      }
      dati.modoAvanzamento = v; aggiornaVisibilita(); datoModificato(true);
    });
    radio('previsione', v => { dati.previsione = v; aggiornaVisibilita(); datoModificato(); });
    testo('#f-prev-eac', v => { dati.previsioneManuale.eac = v; });
    testo('#f-prev-fine', v => { dati.previsioneManuale.fine = v; });

    // campi "toccati": gli errori compaiono quando esci da un campo, non mentre scrivi
    document.addEventListener('focusout', e => {
      const inp = e.target;
      if (!(inp instanceof HTMLInputElement)) return;
      if (inp.id && inp.id.startsWith('f-')) {
        const campo = inp.id.slice(2);
        toccati.add(/^costo-/.test(campo) ? 'piano' : /^av-/.test(campo) ? 'avanzamento' : campo);
        if (/^ril-/.test(campo)) toccati.add('avanzamento');
      }
      if (inp.getAttribute('inputmode') === 'decimal') {
        const v = numeri.leggiNumero(inp.value);
        if (typeof v === 'number' && Number.isFinite(v)) inp.value = perCampo(v);
      }
      programmaAggiorna();
    });

    // passo 2: piano
    const corpoP = $('#righe-piano');
    corpoP.addEventListener('input', e => {
      const i = Number(e.target.dataset.i);
      if (Number.isInteger(i)) { dati.piano[i] = e.target.value; datoModificato(); }
    });
    corpoP.addEventListener('paste', e => { if (incolla(e, false)) { toccati.add('piano'); datoModificato(true); } });
    const corpoA = $('#righe-avanzamento');
    corpoA.addEventListener('input', e => {
      const i = Number(e.target.dataset.i), k = e.target.dataset.k;
      if (Number.isInteger(i) && k) { dati.avanzamento[i][k] = e.target.value; datoModificato(); }
    });
    corpoA.addEventListener('paste', e => { if (incolla(e, true)) { toccati.add('avanzamento'); datoModificato(true); } });
    // frecce e Invio per muoversi nelle tabelle come in un foglio di calcolo
    [corpoP, corpoA].forEach(corpo => corpo.addEventListener('keydown', e => {
      if (!['Enter', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
      const t = e.target, col = t.dataset.k || '';
      const stessi = Array.from(corpo.querySelectorAll('input')).filter(x => (x.dataset.k || '') === col);
      const dest = stessi[stessi.indexOf(t) + (e.key === 'ArrowUp' ? -1 : 1)];
      if (dest) { e.preventDefault(); dest.focus(); dest.select(); }
    }));
    $('#btn-curva-s').addEventListener('click', () => {
      const bac = numeri.leggiNumero(dati.bac), n = durataValida();
      if (!(bac > 0) || !n) { const m = $('#msg-piano'); m.textContent = 'Per generare la curva servono la durata e il budget totale (passo 1).'; m.className = 'msg avviso'; return; }
      if (dati.piano.some(v => String(v).trim() !== '') && !confirm('La curva a S sostituisce i valori già scritti nel piano. Continuare?')) return;
      const costi = calcoli.generaCurvaS(bac, n);
      let c = 0;
      dati.piano = (dati.modoPiano === 'cumulato' ? costi.map(x => Math.round((c += x) * 100) / 100) : costi).map(perCampo);
      datoModificato(true);
    });
    $('#btn-azzera-piano').addEventListener('click', () => {
      if (!confirm('Vuoi svuotare tutto il piano?')) return;
      dati.piano = dati.piano.map(() => '');
      datoModificato(true);
    });
    $('#somma-piano').addEventListener('click', e => {
      const valori = dati.piano.map(numeri.leggiNumero);
      const somma = dati.modoPiano === 'cumulato' ? valori[valori.length - 1] : valori.reduce((s, v) => s + v, 0);
      if (e.target.id === 'btn-bac-da-somma') {
        dati.bac = perCampo(Math.round(somma * 100) / 100); $('#f-bac').value = dati.bac; datoModificato();
      } else if (e.target.id === 'btn-scala-piano') {
        const bac = numeri.leggiNumero(dati.bac);
        const arr = v => (Number.isInteger(bac) ? Math.round(v) : Math.round(v * 100) / 100);
        let cum = 0, cumPrec = 0;
        dati.piano = valori.map((v, i) => {
          cum += v;
          const nuovo = i === valori.length - 1 ? bac : arr(cum * bac / somma);
          const c = arr(nuovo - cumPrec); cumPrec = nuovo;
          return perCampo(c);
        });
        datoModificato(true);
      }
    });

    // passo 3: rilevamenti
    [0, 1].forEach(i => ['periodo', 'bcwp', 'acwp'].forEach(k => {
      $(`#f-ril-${i}-${k}`).addEventListener('input', e => { dati.rilevamenti[i][k] = e.target.value; datoModificato(); });
    }));

    // schede dei passi (anche da tastiera)
    $$('.passo').forEach((tab, k) => {
      tab.addEventListener('click', () => mostraPasso(k + 1));
      tab.addEventListener('keydown', e => {
        const mappa = { ArrowRight: passo + 1, ArrowLeft: passo - 1, Home: 1, End: 4 };
        if (e.key in mappa) { e.preventDefault(); mostraPasso(mappa[e.key], true); }
      });
    });
    $('#btn-avanti').addEventListener('click', () => mostraPasso(passo + 1));
    $('#btn-indietro').addEventListener('click', () => mostraPasso(passo - 1));

    // collegamenti dai messaggi ai campi; pulsanti degli esempi nel riquadro vuoto
    document.addEventListener('click', e => {
      const b = e.target.closest('[data-vai]');
      if (b) vaiACampo(b.dataset.vai);
      const es = e.target.closest('[data-esempio]');
      if (es) caricaEsempio(es.dataset.esempio);
    });

    // barra: esempi, nuovo, apri, salva, tema, esporta
    const sel = $('#scelta-esempio');
    esempi.ESEMPI.forEach(es => sel.insertAdjacentHTML('beforeend', `<option value="${es.id}">${esc(es.nome)}</option>`));
    sel.addEventListener('change', () => { const id = sel.value; sel.value = ''; if (id) caricaEsempio(id); });
    $('#btn-nuovo').addEventListener('click', () => {
      if (!esempioAttivo && haDati() && !confirm('Iniziare un progetto vuoto? I dati attuali verranno cancellati (se ti servono, prima usa "Salva").')) return;
      carica(calcoli.datiVuoti(), null, { durataVuota: true });
      mostraPasso(1);
      $('#f-titolo').focus();
    });
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
          if (!letto || typeof letto !== 'object' || (letto.formato !== 'costcurve' && !Array.isArray(letto.piano) && !Array.isArray(letto.costiPeriodo))) throw new Error('formato');
          carica(letto, null, { mostraTutti: true });
          mostraPasso(modello.valido ? 4 : 1);
        } catch (err) {
          alert('Questo file non è un progetto di CostCurve. Scegli un file .json salvato con "Salva".');
        }
      };
      lettore.readAsText(file);
    });
    $('#btn-tema').addEventListener('click', () => {
      const nuovo = tema() === 'scuro' ? 'chiaro' : 'scuro';
      document.documentElement.setAttribute('data-tema', nuovo);
      try { localStorage.setItem(CHIAVE_TEMA, nuovo); } catch (e) { /* niente */ }
      aggiornaPulsanteTema();
      if (modello) disegnaGrafico();
    });
    $('#btn-esporta').addEventListener('click', apriEsporta);
    $('#btn-esporta-2').addEventListener('click', apriEsporta);

    // finestra Esporta
    $$('#form-esporta input[name="formato"]').forEach(r => r.addEventListener('change', aggiornaFinestra));
    $('#btn-scarica').addEventListener('click', esegui);
    $('#btn-copia').addEventListener('click', async () => {
      const m = opzioniDaFinestra();
      const t = latex.genera(m);
      try { await navigator.clipboard.writeText(t); messaggioEsporta('Codice LaTeX copiato negli appunti.', 'ok'); }
      catch (e) { messaggioEsporta('Il browser non permette la copia automatica: usa "Scarica .tex".', 'avviso'); }
    });
    $('#btn-overleaf').addEventListener('click', () => {
      const m = opzioniDaFinestra();
      const form = document.createElement('form');
      form.method = 'post'; form.action = 'https://www.overleaf.com/docs'; form.target = '_blank';
      const ta = document.createElement('textarea'); ta.name = 'snip'; ta.value = latex.genera(m);
      const nome = document.createElement('input'); nome.type = 'hidden'; nome.name = 'snip_name'; nome.value = latex.nomeFile(m.titolo);
      form.append(ta, nome); form.hidden = true;
      document.body.appendChild(form); form.submit(); form.remove();
      messaggioEsporta('Apro Overleaf in una nuova scheda (il file .tex viene inviato a overleaf.com).', 'ok');
    });
  }

  function caricaEsempio(id) {
    const es = esempi.trova(id);
    if (!es) return;
    if (!esempioAttivo && haDati() && !confirm('Caricare l\'esempio sostituisce i dati attuali (se ti servono, prima usa "Salva"). Continuare?')) return;
    carica(JSON.parse(JSON.stringify(es.dati)), es.id, { mostraTutti: true });
    mostraPasso(4);
  }

  function aggiornaPulsanteTema() {
    const scuro = tema() === 'scuro';
    $('#btn-tema').setAttribute('aria-label', scuro ? 'Passa al tema chiaro' : 'Passa al tema scuro');
  }

  // ---------------------------------------------------------------------
  // Avvio
  // ---------------------------------------------------------------------
  function avvia() {
    collegaEventi();
    collegaZoom();
    aggiornaPulsanteTema();
    const salvato = leggiDalBrowser();
    if (salvato && salvato.dati) {
      carica(salvato.dati, salvato.esempio, { mostraTutti: true });
      mostraPasso(salvato.passo || 1);
    } else {
      // prima visita: progetto vuoto, con gli esempi a portata di clic
      carica(calcoli.datiVuoti(), null, { durataVuota: true });
      mostraPasso(1);
    }
  }

  avvia();
})();
