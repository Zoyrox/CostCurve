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

  const { numeri, calcoli, esempi, grafico, latex, report, importa } = window.CC;
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
  // annulla / ripristina: istantanee dei dati
  const storia = [], futuro = [];
  let ultimoStato = null, timerStoria = null;
  let valoriFissi = null;   // valori mostrati con un tocco (telefono)

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
      note: d.note.map(nt => ({ periodo: n(nt.periodo), testo: nt.testo })).filter(nt => nt.testo || nt.periodo !== null),
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
      note: d.note.map(nt => ({ periodo: perCampo(nt.periodo), testo: nt.testo })),
    };
    if (opzioni.durataVuota) dati.durata = '';
    if (!opzioni.daStoria) { storia.length = 0; futuro.length = 0; ultimoStato = JSON.stringify(dati); aggiornaPulsantiStoria(); }
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
    costruisciNote();
    $('#dettagli-note').open = dati.note.length > 0;
    aggiornaVisibilita();
    aggiornaEtichetteUnita();
  }

  /** Editor delle note: una riga per nota (periodo + testo). */
  function costruisciNote() {
    const s = ut().singolare;
    $('#elenco-note').innerHTML = dati.note.map((nt, i) => `<div class="riga-nota" data-i="${i}">
        <span class="num-nota">${i + 1}</span>
        <label class="nascosto" for="f-nota-${i}-periodo">${s} della nota ${i + 1}</label>
        <input id="f-nota-${i}-periodo" class="nota-periodo" type="text" inputmode="decimal" placeholder="${s}" value="${esc(nt.periodo)}" data-k="periodo">
        <label class="nascosto" for="f-nota-${i}-testo">Testo della nota ${i + 1}</label>
        <input id="f-nota-${i}-testo" type="text" maxlength="140" placeholder="es. ritardo del fornitore" value="${esc(nt.testo)}" data-k="testo">
        <button type="button" class="btn btn-icona btn-senza-bordo" data-togli-nota="${i}" aria-label="Elimina la nota ${i + 1}"><svg class="ico"><use href="#i-chiudi"/></svg></button>
      </div>`).join('');
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
    $('#sintesi').hidden = !modello.valido;
    if (modello.valido) $('#testo-sintesi').textContent = modello.riassunto;
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

  /** Misure del grafico sullo schermo: larghezza vera del riquadro, altezza adatta alla finestra. */
  function misureGrafico() {
    const cont = $('#contenitore-grafico');
    const w = Math.max(280, Math.floor(cont.clientWidth || 800));
    const vh = window.innerHeight;
    const mobile = window.matchMedia('(max-width: 900px)').matches;
    let h;
    if (document.body.classList.contains('grafico-pieno')) h = vh - 96;
    else if (document.body.classList.contains('solo-grafico')) h = Math.max(320, vh - 300);
    else if (mobile) h = Math.max(260, Math.min(w / 1.05, vh * 0.58));
    else h = Math.max(300, Math.min((w - 90) / (dati.grafico.proporzioni || 1.6) + 70, vh - 330));
    return { w, h: Math.round(h) };
  }

  function disegnaGrafico(errori, avvisi) {
    errori = errori || modello.problemi.filter(p => p.livello === 'errore');
    avvisi = avvisi || modello.problemi.filter(p => p.livello === 'avviso');
    const box = $('#problemi');
    const cont = $('#contenitore-grafico');
    const nav = $('#navigatore');
    if (modello.valido) {
      const { w, h } = misureGrafico();
      $('#grafico').innerHTML = grafico.disegnaSchermo(modello, { larghezza: w, altezza: h, tema: tema() });
      const svg = $('#grafico svg');
      nav.innerHTML = grafico.disegnaNavigatore(modello, { larghezza: w, L: +svg.dataset.l, PW: +svg.dataset.pw, tema: tema() });
      nav.hidden = false;
      $('#legenda-grafico').innerHTML = legendaHTML();
      $('#cruscotto').innerHTML = cruscottoHTML();
      box.innerHTML = avvisi.length ? `<ul class="lista-avvisi">${avvisi.map(p => `<li><button type="button" class="link" data-vai="${p.campo}">${esc(p.messaggio)}</button></li>`).join('')}</ul>` : '';
      const a = modello.assi, p = a.pieno;
      $('#livello-zoom').textContent = Math.round((p.xmax - p.xmin) / (a.xmax - a.xmin) * 100) + '%';
      $('#grafico-sottotitolo').textContent = a.zoomato
        ? `Vista: ${ut().plurale} ${numeri.formatNumero(a.xmin, 'auto')} – ${numeri.formatNumero(a.xmax, 'auto')}${a.assePezzato ? ' · asse dei costi da ' + numeri.formatNumero(a.ymin, a.decimaliY) : ''}`
        : `${modello.durata} ${ut().plurale} · budget ${numeri.formatNumero(modello.bac)} ${modello.unitaMoneta.breve}`;
      cont.classList.toggle('zoomato', a.zoomato);
      $('#aiuto-grafico').hidden = false;
      if (valoriFissi !== null) mostraValoriPeriodo(valoriFissi);
    } else {
      nav.innerHTML = ''; nav.hidden = true;
      $('#legenda-grafico').innerHTML = '';
      $('#cruscotto').innerHTML = '';
      $('#grafico-sottotitolo').textContent = '';
      $('#livello-zoom').textContent = '100%';
      cont.classList.remove('zoomato');
      $('#aiuto-grafico').hidden = true;
      if (!haDati()) {
        $('#grafico').innerHTML = `<div class="vuoto-iniziale">
            <svg class="ico ico-grande"><use href="#i-grafico"/></svg>
            <h2>Inizia un nuovo progetto</h2>
            <p>Compila i dati: titolo, durata e budget, poi il piano e i rilevamenti. Il diagramma compare qui mentre scrivi. Hai già i dati in Excel? Importali.</p>
            <div class="azioni-vuoto">
              <button type="button" class="btn btn-primario" data-esempio="grafico-libro">Apri il grafico del libro</button>
              <button type="button" class="btn btn-secondario" data-esempio="libro">Esempio numerico</button>
              <button type="button" class="btn btn-secondario" data-azione="importa">Importa da Excel</button>
            </div></div>`;
        box.innerHTML = '';
      } else {
        $('#grafico').innerHTML = grafico.segnaposto(errori.length === 1 ? 'Manca un solo dato.' : `Mancano ${errori.length} dati.`, tema());
        box.innerHTML = `<div class="da-completare"><p>Per vedere il diagramma completa:</p><ul>${errori.slice(0, 5).map(p => `<li><button type="button" class="link" data-vai="${p.campo}">${esc(p.messaggio)}</button></li>`).join('')}</ul>${errori.length > 5 ? `<p>…e altri ${errori.length - 5}.</p>` : ''}</div>`;
      }
    }
  }

  /** Legenda cliccabile: tocca una curva per mostrarla o nasconderla. */
  function legendaHTML() {
    const C = grafico.TEMI[tema()], mo = dati.grafico.mostra, pv = modello.previsione;
    const voce = (k, nome, colore, tratto) => `<button type="button" class="voce-legenda" data-curva="${k}" aria-pressed="${mo[k] !== false}" title="${mo[k] !== false ? 'Nascondi' : 'Mostra'}: ${esc(nome)}">
        <svg width="26" height="10" aria-hidden="true"><line x1="1" y1="5" x2="25" y2="5" stroke="${colore}" stroke-width="2.6" stroke-linecap="round"${tratto ? ` stroke-dasharray="${tratto}"` : ''}/></svg>${esc(nome)}</button>`;
    let h = voce('bcws', 'Pianificato (BCWS)', C.bcws, '') + voce('bcwp', 'Lavoro svolto (BCWP)', C.bcwp, '6 3') + voce('acwp', 'Costo effettivo (ACWP)', C.acwp, '7 3 2 3');
    if (pv.modo !== 'no' && pv.eac !== null && (pv.visibile || pv.nascostaDaUtente)) h += voce('previsione', 'Previsione (EAC)', C.acwp, '2 3');
    if (modello.assi.assePezzato) h += `<span class="voce-info" title="L'asse dei costi non parte da zero">≈ costi da ${numeri.formatNumero(modello.assi.ymin, modello.assi.decimaliY)}</span>`;
    for (const nt of modello.note) h += `<span class="voce-info voce-nota"><b>${nt.n}</b>${esc(ut().singolare)} ${esc(numeri.formatNumero(nt.periodo, 'auto'))}: ${esc(nt.testo)}</span>`;
    return h;
  }

  /** Cruscotto: i numeri che contano, con la tendenza dal rilevamento precedente. */
  function cruscottoHTML() {
    const m = modello, r = m.rilevamenti[m.rilevamenti.length - 1], t = m.tendenza, pv = m.previsione;
    const freccia = d => (d === null || d === undefined || Math.abs(d) < 0.05 ? ''
      : `<span class="tendenza ${d > 0 ? 'meglio' : 'peggio'}" title="Rispetto al rilevamento precedente: ${d > 0 ? 'migliora' : 'peggiora'} di ${numeri.formatNumero(Math.abs(d), 1)} punti">${d > 0 ? '▲' : '▼'} ${numeri.formatNumero(Math.abs(d), 1)} pt</span>`);
    const cl = v => (v < 0 ? 'neg' : v > 0 ? 'pos' : '');
    const tessera = (nome, valore, sotto, extra, classe) => `<div class="tessera"><span class="tessera-nome">${nome}</span><span class="tessera-valore ${classe || ''}">${valore}</span><span class="tessera-sotto">${sotto}${extra || ''}</span></div>`;
    let h = tessera('Tempi (SV)', numeri.formatPercentuale(r.psv), `${numeri.formatConSegno(r.sv)} ${m.unitaMoneta.breve} `, freccia(t && t.psv), cl(r.sv));
    h += tessera('Costi (CV)', numeri.formatPercentuale(r.pcv), `${numeri.formatConSegno(r.cv)} ${m.unitaMoneta.breve} `, freccia(t && t.pcv), cl(r.cv));
    if (pv.eac !== null && pv.durataPrevista !== null && pv.modo !== 'no') {
      const dEac = (pv.eac - m.bac) / m.bac * 100, dFine = pv.durataPrevista - m.durata;
      h += tessera('Costo finale stimato', numeri.formatBreve(pv.eac), `budget ${numeri.formatBreve(m.bac)} · ${numeri.formatPercentuale(dEac)}`, '', dEac > 0.05 ? 'neg' : dEac < -0.05 ? 'pos' : '');
      h += tessera('Fine stimata', `${ut().singolare} ${numeri.formatNumero(pv.durataPrevista, 1)}`, `piano: ${m.durata} · ${dFine > 0 ? '+' : ''}${numeri.formatNumero(dFine, 1)}`, '', dFine > 0.05 ? 'neg' : dFine < -0.05 ? 'pos' : '');
    } else {
      h += tessera('Stato', `${r.stato.icona} ${r.stato.parola}`, `rilevamento ${r.n} · ${ut().singolare} ${r.t}`, '', r.stato.colore === 'verde' ? 'pos' : r.stato.colore === 'rosso' ? 'neg' : '');
    }
    return h;
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

  /** Riquadro con i valori VERI del periodo k (mai valori inventati). */
  function mostraValoriPeriodo(k, cx, cy) {
    const tip = $('#tooltip'), guida = $('#guida');
    const g = geom();
    const m = modello;
    if (!g || k < 0 || k > m.durata || k < m.assi.xmin - 1e-9 || k > m.assi.xmax + 1e-9) { tip.hidden = true; guida.hidden = true; return; }
    const pt = s => { const p = m.punti[s].find(q => q[0] === k); return p ? p[1] : (k === 0 ? 0 : null); };
    const ril = m.rilevamenti.find(r => r.t === k);
    const nota = m.note.find(nt => Math.round(nt.periodo) === k);
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
      h += '<div class="tt-sep"></div><div class="tt-riga tt-nota"><span>— = non rilevato in questo periodo</span></div>';
    }
    if (nota) h += `<div class="tt-sep"></div><div class="tt-riga tt-nota"><span><b>Nota ${nota.n}:</b> ${esc(nota.testo)}</span></div>`;
    tip.innerHTML = h;
    tip.hidden = false;
    guida.hidden = false;
    const c = $('#contenitore-grafico').getBoundingClientRect();
    const xg = g.px(k);
    Object.assign(guida.style, { left: xg + 'px', top: g.oy + g.T + 'px', height: g.PH + 'px' });
    const w = tip.offsetWidth, hh = tip.offsetHeight;
    const xr = cx === undefined ? c.left + xg : cx;
    let left = xr - c.left + 16;
    if (left + w > c.width - 6) left = xr - c.left - w - 16;
    left = Math.max(4, left);
    let top = cy === undefined ? g.oy + g.T + 8 : cy - c.top - hh / 2;
    top = Math.max(4, Math.min(top, c.height - hh - 4));
    Object.assign(tip.style, { left: left + 'px', top: top + 'px' });
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

    // Puntatori attivi: mouse, penna o dita (due dita = pizzico per lo zoom)
    const dita = new Map();
    let pizzico = null, tocco = null;
    const distanza = () => { const [a, b] = [...dita.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
    const centroX = () => { const [a, b] = [...dita.values()]; return (a.x + b.x) / 2; };

    cont.addEventListener('pointerdown', e => {
      const g = geom();
      if (!g) return;
      if (e.pointerType !== 'mouse') {
        dita.set(e.pointerId, { x: e.clientX, y: e.clientY });
        cont.setPointerCapture(e.pointerId);
        if (dita.size === 2) {
          tocco = null;
          pizzico = { d0: distanza(), cx: g.x(centroX()), assi: { ...modello.assi } };
        } else if (dita.size === 1) {
          tocco = { x0: e.clientX, y0: e.clientY, t0: Date.now(), mosso: false, g, assi: { ...modello.assi } };
        }
        return;
      }
      if (e.button !== 0 || !g.dentro(e.clientX, e.clientY)) return;
      const v = dati.grafico.vista || {};
      trascina = { tipo: e.shiftKey ? 'area' : 'sposta', x0: e.clientX, y0: e.clientY, g, assi: { ...modello.assi }, conY: Number.isFinite(v.ymin) && Number.isFinite(v.ymax) };
      if (trascina.tipo === 'sposta' && !modello.assi.zoomato) { trascina = null; return; }
      cont.setPointerCapture(e.pointerId);
      if (trascina.tipo === 'sposta') cont.classList.add('trascina');
      tip.hidden = true; guida.hidden = true;
      e.preventDefault();
    });
    cont.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') {
        if (!dita.has(e.pointerId)) return;
        dita.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pizzico && dita.size === 2) {
          const f = pizzico.d0 / Math.max(10, distanza());
          const a = pizzico.assi, c = pizzico.cx;
          impostaVista({ da: c - (c - a.xmin) * f, a: c + (a.xmax - c) * f });
        } else if (tocco) {
          const dx = e.clientX - tocco.x0;
          if (Math.abs(dx) > 6 || Math.abs(e.clientY - tocco.y0) > 6) tocco.mosso = true;
          if (tocco.mosso && tocco.assi.zoomato) {
            const sp = dx / tocco.g.PW * (tocco.assi.xmax - tocco.assi.xmin);
            impostaVista({ da: tocco.assi.xmin - sp, a: tocco.assi.xmax - sp });
          }
        }
        return;
      }
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
      if (valoriFissi === null) mostraValori(e);
    });
    const fine = e => {
      if (e.pointerType !== 'mouse') {
        const era = tocco;
        dita.delete(e.pointerId);
        if (dita.size < 2) pizzico = null;
        if (dita.size === 0) tocco = null;
        // tocco breve senza movimento = mostra i valori di quel periodo (restano finché non tocchi altrove)
        if (era && !era.mosso && Date.now() - era.t0 < 500) {
          const g = geom();
          if (g && g.dentro(e.clientX, e.clientY)) { valoriFissi = Math.round(g.x(e.clientX)); mostraValoriPeriodo(valoriFissi); }
          else { valoriFissi = null; tip.hidden = true; guida.hidden = true; }
        }
        return;
      }
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
    cont.addEventListener('pointercancel', e => { dita.delete(e.pointerId); pizzico = null; tocco = null; if (trascina) fine(e); });
    cont.addEventListener('pointerleave', e => { if (!trascina && e.pointerType === 'mouse' && valoriFissi === null) { tip.hidden = true; guida.hidden = true; } });

    function mostraValori(e) {
      const g = geom();
      if (!g || !g.dentro(e.clientX, e.clientY)) { tip.hidden = true; guida.hidden = true; return; }
      mostraValoriPeriodo(Math.round(g.x(e.clientX)), e.clientX, e.clientY);
    }

    // Navigatore: trascina il riquadro, allargalo dai bordi o clicca per spostarti
    const nav = $('#navigatore');
    let navT = null;
    const navDati = cx => {
      const svg = nav.querySelector('svg');
      const r = svg.getBoundingClientRect(), k = r.width / svg.viewBox.baseVal.width;
      const L = +svg.dataset.l * k, PW = +svg.dataset.pw * k, p = modello.assi.pieno;
      return { x: p.xmin + (cx - r.left - L) / PW * (p.xmax - p.xmin), perPx: (p.xmax - p.xmin) / PW };
    };
    nav.addEventListener('pointerdown', e => {
      if (!modello.valido || !nav.querySelector('svg')) return;
      const { x, perPx } = navDati(e.clientX), a = modello.assi;
      const bordo = 12 * perPx;
      let tipo = 'sposta';
      if (Math.abs(x - a.xmin) < bordo) tipo = 'sinistra';
      else if (Math.abs(x - a.xmax) < bordo) tipo = 'destra';
      else if (x < a.xmin || x > a.xmax) {
        const amp = a.xmax - a.xmin;
        impostaVista({ da: x - amp / 2, a: x + amp / 2 });
      }
      navT = { tipo, x0: x, assi: { ...modello.assi } };
      nav.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    nav.addEventListener('pointermove', e => {
      if (!navT) return;
      const { x } = navDati(e.clientX), a = navT.assi, d = x - navT.x0;
      if (navT.tipo === 'sposta') impostaVista({ da: a.xmin + d, a: a.xmax + d });
      else if (navT.tipo === 'sinistra') impostaVista({ da: Math.min(a.xmin + d, a.xmax - 0.5), a: a.xmax });
      else impostaVista({ da: a.xmin, a: Math.max(a.xmax + d, a.xmin + 0.5) });
    });
    const navFine = () => { navT = null; };
    nav.addEventListener('pointerup', navFine);
    nav.addEventListener('pointercancel', navFine);

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
    const menu = [['#b-intervallo', '#m-intervallo', apriIntervallo], ['#b-mostra', '#m-mostra', null], ['#b-altro', '#m-altro', null]];
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
    document.addEventListener('click', e => {
      chiudiMenu();
      // un tocco fuori dal grafico nasconde i valori fissati
      if (valoriFissi !== null && !e.target.closest('#contenitore-grafico')) { valoriFissi = null; $('#tooltip').hidden = true; $('#guida').hidden = true; }
    });
    $('#m-altro').addEventListener('click', e => { if (e.target.closest('.voce')) chiudiMenu(); });
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
    $('.opzioni-pagina').hidden = f === 'svg' || f === 'csv';
    $('#btn-scarica-testo').textContent = { pdf: 'Scarica PDF', tex: 'Scarica .tex', svg: 'Scarica SVG', stampa: 'Stampa', csv: 'Scarica CSV' }[f];
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
    } else if (f === 'csv') {
      scarica(nome.replace(/\.tex$/, '.csv'), importa.tabellaCSV(m), 'text/csv;charset=utf-8');
      messaggioEsporta('Tabella CSV scaricata: si apre con Excel.', 'ok');
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
    registraStoria();
  }

  // ---------------------------------------------------------------------
  // Annulla / ripristina
  // ---------------------------------------------------------------------
  function registraStoria() {
    clearTimeout(timerStoria);
    timerStoria = setTimeout(() => {
      const ora = JSON.stringify(dati);
      if (ora === ultimoStato) return;
      if (ultimoStato) storia.push(ultimoStato);
      if (storia.length > 100) storia.shift();
      futuro.length = 0;
      ultimoStato = ora;
      aggiornaPulsantiStoria();
    }, 450);
  }
  function aggiornaPulsantiStoria() {
    const a = $('#btn-annulla'), r = $('#btn-ripristina');
    if (a) a.disabled = storia.length === 0;
    if (r) r.disabled = futuro.length === 0;
  }
  function viaggia(da, verso) {
    clearTimeout(timerStoria);
    const ora = JSON.stringify(dati);
    if (ora !== ultimoStato && ultimoStato) { da.push(ultimoStato); ultimoStato = ora; }
    if (!da.length) return;
    verso.push(ultimoStato);
    ultimoStato = da.pop();
    dati = JSON.parse(ultimoStato);
    riempiModulo();
    aggiorna();
    aggiornaPulsantiStoria();
  }
  const annulla = () => viaggia(storia, futuro);
  const ripristina = () => viaggia(futuro, storia);

  // ---------------------------------------------------------------------
  // Link da condividere (il progetto viaggia nel link, dopo il #:
  // la parte dopo il # non viene mai inviata al server)
  // ---------------------------------------------------------------------
  const b64 = bytes => { let bin = ''; bytes.forEach(c => { bin += String.fromCharCode(c); }); return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const daB64 = t => Uint8Array.from(atob(t.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  async function codifica(oggetto) {
    const testo = new TextEncoder().encode(JSON.stringify(oggetto));
    if (window.CompressionStream) {
      const flusso = new Blob([testo]).stream().pipeThrough(new CompressionStream('deflate-raw'));
      return 'z' + b64(new Uint8Array(await new Response(flusso).arrayBuffer()));
    }
    return 'b' + b64(testo);
  }
  async function decodifica(t) {
    const bytes = daB64(t.slice(1));
    if (t[0] === 'z') {
      const flusso = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return JSON.parse(await new Response(flusso).text());
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  }
  async function creaLink() { return location.href.split('#')[0] + '#p=' + await codifica(datiPerFile()); }
  async function copiaLink() {
    let url;
    try { url = await creaLink(); } catch (e) { avviso('Non sono riuscito a creare il link in questo browser.', true); return; }
    try { await navigator.clipboard.writeText(url); avviso('Link copiato: chi lo apre vede questo progetto (i dati sono dentro il link).'); }
    catch (e) { window.prompt('Copia questo link:', url); }
  }
  async function apriDaLink() {
    const m = /#p=([A-Za-z0-9_-]+)/.exec(location.hash);
    if (!m) return false;
    try {
      const d = await decodifica(m[1]);
      history.replaceState(null, '', location.pathname + location.search);
      carica(d, null, { mostraTutti: true });
      mostraPasso(4);
      if (window.matchMedia('(max-width: 900px)').matches) vaiAScheda('grafico');
      avviso('Progetto aperto dal link.');
      return true;
    } catch (e) { avviso('Il link non contiene un progetto valido.', true); return false; }
  }

  // ---------------------------------------------------------------------
  // Messaggi brevi (in basso)
  // ---------------------------------------------------------------------
  function avviso(testo, errore) {
    let el = $('#avviso-breve');
    if (!el) { el = document.createElement('div'); el.id = 'avviso-breve'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = testo;
    el.className = 'avviso-breve visibile' + (errore ? ' errore' : '');
    clearTimeout(avviso.t);
    avviso.t = setTimeout(() => { el.className = 'avviso-breve' + (errore ? ' errore' : ''); }, 4200);
  }

  // ---------------------------------------------------------------------
  // Importazione da Excel / CSV
  // ---------------------------------------------------------------------
  let analisiImporta = null;
  function apriImporta() {
    $('#testo-importa').value = '';
    $('#anteprima-importa').innerHTML = '';
    $('#btn-conferma-importa').disabled = true;
    analisiImporta = null;
    $('#finestra-importa').showModal();
  }
  function analizzaImporta(testo) {
    const a = importa.analizza(testo);
    analisiImporta = a.errore ? null : a;
    $('#btn-conferma-importa').disabled = !analisiImporta;
    if (a.errore) { $('#anteprima-importa').innerHTML = `<p class="msg errore">${esc(a.errore)}</p>`; return; }
    const v = x => (x === null ? '<span class="vuoto-cella">—</span>' : numeri.formatNumero(x));
    const colPiano = a.pianoCol === 'costo' ? 'Costo nel periodo' : 'BCWS';
    $('#anteprima-importa').innerHTML = `<p class="aiuto-breve">Trovati <strong>${a.righe.length} periodi</strong>. Anteprima:</p>
      <div class="scorri"><table class="tabella-dati tabella-anteprima"><thead><tr><th>Periodo</th><th>${colPiano}</th><th>BCWP</th><th>ACWP</th></tr></thead><tbody>
      ${a.righe.slice(0, 6).map(r => `<tr><td>${r.periodo}</td><td>${v(a.pianoCol ? r[a.pianoCol] : null)}</td><td>${v(r.bcwp)}</td><td>${v(r.acwp)}</td></tr>`).join('')}
      ${a.righe.length > 6 ? `<tr><td colspan="4">… altri ${a.righe.length - 6}</td></tr>` : ''}</tbody></table></div>
      ${a.avvisi.map(x => `<p class="msg avviso">${esc(x)}</p>`).join('')}`;
  }
  function confermaImporta() {
    if (!analisiImporta) return;
    const proposta = importa.inDati(analisiImporta, dati);
    const base = datiPerFile();
    carica({ ...base, ...proposta, titolo: base.titolo || 'Progetto importato' }, null, { mostraTutti: true });
    $('#finestra-importa').close();
    mostraPasso(modello.valido ? 4 : 3);
    if (window.matchMedia('(max-width: 900px)').matches) vaiAScheda(modello.valido ? 'grafico' : 'dati');
    avviso(`Importati ${analisiImporta.righe.length} periodi. Controlla i rilevamenti scelti nel passo 3.`);
  }

  // ---------------------------------------------------------------------
  // Telefono: schede in basso e grafico a tutto schermo in orizzontale
  // ---------------------------------------------------------------------
  let passoDati = 1, pienoChiuso = false;
  function vaiAScheda(nome) {
    const prima = document.body.dataset.scheda;
    document.body.dataset.scheda = nome;
    $$('.schede-mobile button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.scheda === nome)));
    if (nome === 'risultati') { if (passo !== 4) passoDati = passo; mostraPasso(4); }
    else if (nome === 'dati' && prima === 'risultati') mostraPasso(passoDati === 4 ? 1 : passoDati);
    controllaOrizzontale();
    if (modello) requestAnimationFrame(() => disegnaGrafico());
    if (window.matchMedia('(max-width: 900px)').matches) window.scrollTo({ top: 0 });
  }
  const mqOrizz = window.matchMedia('(orientation: landscape) and (max-height: 520px)');
  function controllaOrizzontale() {
    const pieno = Boolean(mqOrizz.matches && !pienoChiuso && document.body.dataset.scheda === 'grafico' && modello && modello.valido);
    if (pieno !== document.body.classList.contains('grafico-pieno')) {
      document.body.classList.toggle('grafico-pieno', pieno);
      $('#chiudi-pieno').hidden = !pieno;
      requestAnimationFrame(() => disegnaGrafico());
    }
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

    // note sul grafico
    $('#btn-aggiungi-nota').addEventListener('click', () => {
      dati.note.push({ periodo: '', testo: '' });
      costruisciNote();
      $(`#f-nota-${dati.note.length - 1}-periodo`).focus();
      datoModificato();
    });
    $('#elenco-note').addEventListener('input', e => {
      const riga = e.target.closest('.riga-nota');
      if (!riga) return;
      dati.note[Number(riga.dataset.i)][e.target.dataset.k] = e.target.value;
      datoModificato();
    });
    $('#elenco-note').addEventListener('click', e => {
      const b = e.target.closest('[data-togli-nota]');
      if (!b) return;
      dati.note.splice(Number(b.dataset.togliNota), 1);
      costruisciNote();
      datoModificato();
    });

    // legenda cliccabile: mostra / nascondi le curve
    $('#legenda-grafico').addEventListener('click', e => {
      const b = e.target.closest('[data-curva]');
      if (!b) return;
      const k = b.dataset.curva;
      dati.grafico.mostra[k] = dati.grafico.mostra[k] === false;
      registraStoria();
      aggiorna();
    });

    // solo grafico (PC): il pannello dei dati si richiude
    $('#b-focus').addEventListener('click', () => {
      const on = !document.body.classList.contains('solo-grafico');
      document.body.classList.toggle('solo-grafico', on);
      $('#b-focus').setAttribute('aria-pressed', String(on));
      $('#b-focus').title = on ? 'Mostra di nuovo il pannello dei dati' : 'Solo grafico: nasconde il pannello dei dati';
      try { localStorage.setItem('costcurve:solo-grafico', on ? '1' : '0'); } catch (err) { /* niente */ }
      requestAnimationFrame(() => disegnaGrafico());
    });

    // schede del telefono e grafico in orizzontale
    $$('.schede-mobile button').forEach(b => b.addEventListener('click', () => vaiAScheda(b.dataset.scheda)));
    mqOrizz.addEventListener('change', () => { pienoChiuso = false; controllaOrizzontale(); });
    $('#chiudi-pieno').addEventListener('click', () => { pienoChiuso = true; controllaOrizzontale(); });

    // ridisegno quando cambia la larghezza (finestra, rotazione, pannello)
    let ultimaLarghezza = 0;
    new ResizeObserver(voci => {
      const w = Math.round(voci[0].contentRect.width);
      if (Math.abs(w - ultimaLarghezza) < 2 || !modello) return;
      ultimaLarghezza = w;
      requestAnimationFrame(() => disegnaGrafico());
    }).observe($('#contenitore-grafico'));
    let timerAltezza = null;
    window.addEventListener('resize', () => { clearTimeout(timerAltezza); timerAltezza = setTimeout(() => { if (modello) { controllaOrizzontale(); disegnaGrafico(); } }, 150); });

    // annulla / ripristina (scorciatoie fuori dai campi: dentro un campo vale l'annulla del campo)
    $('#btn-annulla').addEventListener('click', annulla);
    $('#btn-ripristina').addEventListener('click', ripristina);
    document.addEventListener('keydown', e => {
      if (!(e.ctrlKey || e.metaKey) || document.body.classList.contains('in-presentazione')) return;
      if (e.target.closest && e.target.closest('input, textarea, select')) return;
      const tasto = e.key.toLowerCase();
      if (tasto === 'z' && !e.shiftKey) { e.preventDefault(); annulla(); }
      else if (tasto === 'y' || (tasto === 'z' && e.shiftKey)) { e.preventDefault(); ripristina(); }
    });

    // sintesi da copiare
    $('#btn-copia-sintesi').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(modello.riassunto); avviso('Frase copiata negli appunti.'); }
      catch (err) { avviso('Il browser non permette la copia automatica: seleziona la frase e copiala.', true); }
    });

    // menu "Altro" e pulsanti con un'azione
    let richiestaInstallazione = null;
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); richiestaInstallazione = e; $('[data-azione="installa"]').hidden = false; });
    const eseguiAzione = b => {
      const a = b.dataset.azione;
      if (a === 'annulla') annulla();
      else if (a === 'ripristina') ripristina();
      else if (a === 'nuovo') $('#btn-nuovo').click();
      else if (a === 'apri') $('#btn-apri').click();
      else if (a === 'salva') $('#btn-salva').click();
      else if (a === 'importa') apriImporta();
      else if (a === 'link') copiaLink();
      else if (a === 'presenta') window.CC.presentazione.apri();
      else if (a === 'installa' && richiestaInstallazione) { richiestaInstallazione.prompt(); richiestaInstallazione = null; b.hidden = true; }
    };
    // i pulsanti con un'azione (anche dentro il menu "Altro", che ferma la propagazione dei clic)
    document.addEventListener('click', e => { const b = e.target.closest('[data-azione]'); if (b && !b.closest('#m-altro')) eseguiAzione(b); });
    $('#m-altro').addEventListener('click', e => { const b = e.target.closest('[data-azione]'); if (b) eseguiAzione(b); });

    // finestra Importa
    $('#testo-importa').addEventListener('input', e => analizzaImporta(e.target.value));
    const leggiFile = file => { const r = new FileReader(); r.onload = () => { $('#testo-importa').value = r.result; analizzaImporta(r.result); }; r.readAsText(file); };
    $('#file-importa').addEventListener('change', e => { if (e.target.files[0]) leggiFile(e.target.files[0]); e.target.value = ''; });
    const zona = $('#zona-file');
    zona.addEventListener('dragover', e => { e.preventDefault(); zona.classList.add('sopra'); });
    zona.addEventListener('dragleave', () => zona.classList.remove('sopra'));
    zona.addEventListener('drop', e => { e.preventDefault(); zona.classList.remove('sopra'); if (e.dataTransfer.files[0]) leggiFile(e.dataTransfer.files[0]); });
    $('#btn-conferma-importa').addEventListener('click', confermaImporta);

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
    if (window.matchMedia('(max-width: 900px)').matches) vaiAScheda('grafico');
  }

  function aggiornaPulsanteTema() {
    const scuro = tema() === 'scuro';
    $('#btn-tema').setAttribute('aria-label', scuro ? 'Passa al tema chiaro' : 'Passa al tema scuro');
  }

  // ---------------------------------------------------------------------
  // Avvio
  // ---------------------------------------------------------------------
  async function avvia() {
    collegaEventi();
    collegaZoom();
    aggiornaPulsanteTema();
    document.body.dataset.scheda = 'dati';
    try { if (localStorage.getItem('costcurve:solo-grafico') === '1') { document.body.classList.add('solo-grafico'); $('#b-focus').setAttribute('aria-pressed', 'true'); } } catch (e) { /* niente */ }
    window.CC.app = { dati: () => dati, modello: () => modello, avviso, creaLink };
    // app installabile (funziona da un sito web, non aprendo il file con un doppio clic)
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
    const salvato = leggiDalBrowser();
    if (salvato && salvato.dati) {
      carica(salvato.dati, salvato.esempio, { mostraTutti: true });
      mostraPasso(salvato.passo || 1);
    } else {
      // prima visita: progetto vuoto, con gli esempi a portata di clic
      carica(calcoli.datiVuoti(), null, { durataVuota: true });
      mostraPasso(1);
    }
    // un progetto condiviso con un link ha la precedenza (anche se il link si apre nella stessa scheda)
    const daLink = async () => {
      if (!/#p=/.test(location.hash)) return;
      if (!haDati() || esempioAttivo || confirm('Aprire il progetto contenuto nel link? Sostituisce quello attuale (se ti serve, prima salvalo).')) await apriDaLink();
    };
    window.addEventListener('hashchange', daLink);
    await daLink();
  }

  avvia();
})();
