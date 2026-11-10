/* =====================================================================
 * report.js — tabelle, legenda e interpretazione in HTML
 * ---------------------------------------------------------------------
 * Tutto viene generato dal modello calcolato (mai scritto a mano):
 * tabella costi-tempi, indicatori dei rilevamenti, legenda dei
 * parametri, frasi di interpretazione con semaforo. Gli stessi
 * contenuti stanno nel file .tex e nel PDF.
 * ===================================================================== */
(function (radice) {
  'use strict';

  const numeri = (typeof module !== 'undefined' && module.exports) ? require('./numeri.js') : radice.CC.numeri;
  const { formatNumero: fN, formatPercentuale: fP, formatConSegno: fS } = numeri;

  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const classeSegno = v => (v < 0 ? 'neg' : v > 0 ? 'pos' : '');
  const indice = v => (v === null ? 'n.d.' : fN(v, 2));
  const quando = (m, r) => `${m.unitaTempo.singolare} ${r.t}${r.data ? ` (${r.data})` : ''}`;

  /** Etichetta del semaforo: icona + parola + colore (mai solo colore). */
  function badge(stato) {
    return `<span class="semaforo semaforo-${stato.colore}"><span class="semaforo-ico" aria-hidden="true">${stato.icona}</span>${esc(stato.parola)}</span>`;
  }

  /** Legenda dei parametri: definizioni e formule (libro, pagg. 198-199). */
  const LEGENDA = [
    ['BCWS', 'Pianificato a budget', 'Budgeted Cost of Work Scheduled (baseline): quanto si doveva spendere fino a quel momento secondo il piano. Il valore finale è il budget totale (BAC).'],
    ['BCWP', 'Lavoro svolto a costi di budget', 'Budgeted Cost of Work Performed (earned value): quanto vale, ai prezzi del piano, il lavoro davvero fatto.'],
    ['ACWP', 'Costo effettivamente sostenuto', 'Actual Cost of Work Performed: quanto si è speso davvero per il lavoro fatto.'],
    ['CV', 'Scostamento dei costi', 'Cost Variance = BCWP − ACWP. Se è negativa si è speso più del valore del lavoro svolto (sforamento dei costi).'],
    ['SV', 'Scostamento dei tempi', 'Schedule Variance = BCWP − BCWS. Se è negativa si è fatto meno lavoro del previsto (ritardo), espresso in denaro.'],
    ['%CV, %SV', 'Andamento percentuale', '%CV(t) = CV(t) / BCWS(t) e %SV(t) = SV(t) / BCWS(t), come nel libro.'],
    ['CPI, SPI, EAC', 'Indici e previsione', 'Non nel libro (assunzioni): CPI = BCWP / ACWP, SPI = BCWP / BCWS, costo finale stimato EAC = BAC / CPI e fine stimata = durata / SPI, all\'ultimo rilevamento. In alternativa la previsione può essere inserita dal project manager.'],
  ];

  function legenda() {
    return '<dl class="legenda">' + LEGENDA.map(([sigla, nome, testo]) =>
      `<div><dt><span class="sigla">${esc(sigla)}</span> ${esc(nome)}</dt><dd>${esc(testo)}</dd></div>`).join('') + '</dl>';
  }

  /** Tabella degli indicatori ai rilevamenti (una colonna per rilevamento). */
  function tabellaIndicatori(m) {
    const R = m.rilevamenti;
    const riga = (nome, f, cls) => `<tr${cls ? ` class="${cls}"` : ''}><th scope="row">${nome}</th>${R.map(r => `<td>${f(r)}</td>`).join('')}</tr>`;
    const col = (v, testo) => `<span class="${classeSegno(v)}">${testo}</span>`;
    return `<table class="tabella-dati">
      <caption>Valori in ${esc(m.unitaMoneta.asse.toLowerCase())}</caption>
      <thead><tr><td></td>${R.map(r => `<th scope="col">Rilevamento ${r.n}<br><small>${esc(quando(m, r))}</small></th>`).join('')}</tr></thead>
      <tbody>
        ${riga('Pianificato a budget (BCWS)', r => fN(r.bcws))}
        ${riga('Lavoro svolto a costi di budget (BCWP)', r => fN(r.bcwp))}
        ${riga('Costo effettivamente sostenuto (ACWP)', r => fN(r.acwp))}
        ${riga('CV = BCWP − ACWP', r => col(r.cv, fS(r.cv)), 'sep')}
        ${riga('SV = BCWP − BCWS', r => col(r.sv, fS(r.sv)))}
        ${riga('%CV = CV / BCWS', r => col(r.cv, fP(r.pcv)))}
        ${riga('%SV = SV / BCWS', r => col(r.sv, fP(r.psv)))}
        ${riga('CPI = BCWP / ACWP <small>(assunzione)</small>', r => indice(r.cpi), 'sep')}
        ${riga('SPI = BCWP / BCWS <small>(assunzione)</small>', r => indice(r.spi))}
        ${riga('Stato', r => badge(r.stato), 'sep')}
      </tbody>
    </table>`;
  }

  function testoPrevisione(m) {
    const p = m.previsione, ut = m.unitaTempo;
    if (p.visibile) {
      const origine = p.modo === 'manuale' ? 'inserita dal project manager' : 'assunzione, dall\'ultimo rilevamento';
      return `<strong>Previsione</strong> <em>(${origine})</em>: costo finale EAC = ${fN(p.eac)} contro un budget di ${fN(m.bac)}; fine al ${ut.singolare} ${fN(p.durataPrevista, 1)} contro ${m.durata} pianificati.`;
    }
    return p.modo !== 'no' && p.motivo && !p.nascostaDaUtente ? esc(p.motivo) : '';
  }

  /** Frasi di interpretazione e previsione. */
  function interpretazione(m) {
    let h = m.rilevamenti.map(r =>
      `<p class="frase">${badge(r.stato)} <strong>Rilevamento ${r.n}</strong> (${esc(quando(m, r))}): ${esc(r.frasi.tempi)} ${esc(r.frasi.costi)}</p>`).join('');
    const p = testoPrevisione(m);
    if (p) h += `<p class="frase previsione">${p}</p>`;
    return h;
  }

  /** Tabella costi-tempi per periodo (righe dei rilevamenti evidenziate). */
  function tabellaCostiTempi(m) {
    const ril = {};
    m.rilevamenti.forEach(r => { ril[r.t] = r; });
    const valore = (k, t) => { const p = m.punti[k].find(q => q[0] === t); return p ? fN(p[1]) : '–'; };
    let righe = '';
    for (let i = 1; i <= m.durata; i++) {
      const r = ril[i];
      const data = m.inizio ? `<span class="data-tabella">${esc(m.etichettaTempo(i))}</span>` : '';
      righe += `<tr${r ? ' class="ril"' : ''}><th scope="row">${i}${data}${r ? ` <span class="tag">ril. ${r.n}</span>` : ''}</th>`
        + `<td>${fN(m.costi[i - 1])}</td><td>${fN(m.bcwsCum[i])}</td><td>${valore('bcwp', i)}</td><td>${valore('acwp', i)}</td>`
        + (r ? `<td class="${classeSegno(r.cv)}">${fS(r.cv)}</td><td class="${classeSegno(r.sv)}">${fS(r.sv)}</td>` : '<td>–</td><td>–</td>') + '</tr>';
    }
    return `<div class="scorri"><table class="tabella-dati">
      <caption>Valori in ${esc(m.unitaMoneta.asse.toLowerCase())}</caption>
      <thead><tr><th scope="col" style="text-align:left">Periodo</th><th scope="col">Costo pianificato<br>nel periodo</th><th scope="col">BCWS<br>cumulato</th><th scope="col">BCWP</th><th scope="col">ACWP</th><th scope="col">CV</th><th scope="col">SV</th></tr></thead>
      <tbody>${righe}</tbody>
    </table></div>
    <p class="nota-tabella">BCWP e ACWP compaiono nei periodi in cui sono stati rilevati; CV e SV ai rilevamenti (righe evidenziate).</p>`;
  }

  /** Intestazione del report con i dati facoltativi del resoconto. */
  function intestazione(m) {
    const d = m.dati, rp = d.report;
    const meta = [
      `Durata pianificata: <strong>${m.durata} ${esc(m.unitaTempo.plurale)}</strong>`,
      `Budget totale (BAC): <strong>${fN(m.bac)}</strong> ${esc(m.unitaMoneta.breve)}`,
      rp.pm && `Project manager: <strong>${esc(rp.pm)}</strong>`,
      rp.azienda && `Azienda: <strong>${esc(rp.azienda)}</strong>`,
      rp.data && `Data: <strong>${esc(rp.data)}</strong>`,
    ].filter(Boolean);
    return `<div class="report-testa">
        <p class="report-sopra">Diagramma costi-tempi · earned value</p>
        <h2 class="report-titolo">${esc(m.titolo)}</h2>
        ${d.nota ? `<p class="report-nota">${esc(d.nota)}</p>` : ''}
        <p class="report-meta">${meta.map(x => `<span>${x}</span>`).join('')}</p>
        ${rp.commento ? `<p class="report-commento"><strong>Commento del project manager.</strong> ${esc(rp.commento)}</p>` : ''}
        <p class="report-sintesi"><strong>In sintesi.</strong> ${esc(m.riassunto)}</p>
        ${m.note && m.note.length ? `<ol class="report-note-grafico">${m.note.map(nt => `<li><strong>${esc(m.unitaTempo.singolare)} ${esc(numeri.formatNumero(nt.periodo, 'auto'))}</strong>: ${esc(nt.testo)}</li>`).join('')}</ol>` : ''}
      </div>`;
  }

  /** Report completo (schermo e stampa). svgStampa = grafico in tema chiaro. */
  function report(m, svgStampa, opz = {}) {
    // stampa con pagina orizzontale: il grafico (con il titolo) è la prima pagina
    const figura = `<figure class="report-grafico solo-stampa">${opz.graficoPrima ? `<p class="report-titolo-grafico">${esc(m.titolo)}</p>` : ''}${svgStampa || ''}</figure>`;
    return `<div class="report-scheda">
      ${opz.graficoPrima ? figura : ''}
      ${intestazione(m)}
      ${opz.graficoPrima ? '' : figura}
      <div class="report-griglia">
        <section><h3>Indicatori ai rilevamenti</h3>${tabellaIndicatori(m)}${interpretazione(m)}</section>
        <section><h3>Legenda dei parametri</h3>${legenda()}</section>
      </div>
      <section class="report-tabella"><h3>Tabella costi-tempi</h3>${tabellaCostiTempi(m)}</section>
      <section class="report-note"><h3>Nota sulle formule</h3>
        <p>Formule del libro (pagg. 198-199): CV = BCWP − ACWP, SV = BCWP − BCWS, %CV = CV / BCWS, %SV = SV / BCWS. In letteratura la %CV si calcola spesso su BCWP invece che su BCWS: qui si segue il libro. Le curve passano esattamente per i valori inseriti con un'interpolazione cubica monotona, quindi non scendono mai. Semaforo: <em>in linea</em> se CV e SV non sono negativi; <em>critico</em> se %CV o %SV sono sotto il −10% (soglia ipotizzata); altrimenti <em>attenzione</em>.</p>
        <p class="solo-stampa">Report generato dal browser con CostCurve. Il PDF "ufficiale" si ottiene compilando il file .tex.</p>
      </section>
    </div>`;
  }

  /** Riepilogo per il passo 4: una scheda per rilevamento. */
  function riepilogo(m) {
    const kpi = (nome, valore, v) => `<div class="kpi"><span class="kpi-nome">${nome}</span><span class="kpi-val ${classeSegno(v)}">${valore}</span></div>`;
    const p = testoPrevisione(m);
    return '<div class="schede-risultato">' + m.rilevamenti.map(r => `
      <article class="scheda-risultato">
        <header><h3>Rilevamento ${r.n}<small>${esc(quando(m, r))}</small></h3>${badge(r.stato)}</header>
        <p>${esc(r.frasi.tempi)} ${esc(r.frasi.costi)}</p>
        <div class="kpi-griglia">
          ${kpi('SV', fS(r.sv), r.sv)}${kpi('%SV', fP(r.psv), r.sv)}
          ${kpi('CV', fS(r.cv), r.cv)}${kpi('%CV', fP(r.pcv), r.cv)}
        </div>
      </article>`).join('') + '</div>'
      + (p ? `<p class="previsione-breve">${p}</p>` : '');
  }

  /** Semafori compatti sotto il grafico. */
  function semafori(m) {
    return m.rilevamenti.map(r => `<div class="semaforo-mini">
      <span class="semaforo-mini-testa">Rilevamento ${r.n} · ${esc(quando(m, r))}</span> ${badge(r.stato)}
      <span class="semaforo-mini-dati"><span class="${classeSegno(r.sv)}">SV ${fS(r.sv)} (${fP(r.psv)})</span> · <span class="${classeSegno(r.cv)}">CV ${fS(r.cv)} (${fP(r.pcv)})</span></span>
    </div>`).join('');
  }

  const api = { report, riepilogo, semafori, legenda, tabellaIndicatori, tabellaCostiTempi, testoPrevisione, LEGENDA };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { radice.CC = radice.CC || {}; radice.CC.report = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this);
