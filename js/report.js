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
  const grafico = (typeof module !== 'undefined' && module.exports) ? require('./grafico.js') : radice.CC.grafico;
  const { formatNumero: fN, formatPercentuale: fP, formatConSegno: fS } = numeri;

  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const classeSegno = v => (v < 0 ? 'neg' : v > 0 ? 'pos' : '');
  const indice = v => (v === null ? 'n.d.' : fN(v, 2));

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
    ['CPI, SPI, EAC', 'Indici e previsione (assunzioni)', 'Non nel libro: CPI = BCWP / ACWP, SPI = BCWP / BCWS, costo finale stimato EAC = BAC / CPI, fine stimata = durata / SPI (ultimo rilevamento).'],
  ];

  function legenda() {
    return '<dl class="legenda">' + LEGENDA.map(([sigla, nome, testo]) =>
      `<div><dt><span class="sigla">${esc(sigla)}</span> ${esc(nome)}</dt><dd>${esc(testo)}</dd></div>`).join('') + '</dl>';
  }

  /** Tabella degli indicatori ai due rilevamenti. */
  function tabellaIndicatori(m) {
    const [a, b] = m.rilevamenti;
    const ut = m.unitaTempo.singolare;
    const riga = (nome, fa, fb, cls) => `<tr${cls ? ` class="${cls}"` : ''}><th scope="row">${nome}</th><td>${fa}</td><td>${fb}</td></tr>`;
    const col = (v, testo) => `<span class="${classeSegno(v)}">${testo}</span>`;
    return `<table class="tabella-indicatori">
      <caption>Indicatori ai due rilevamenti (valori in ${esc(m.unitaMoneta.asse.toLowerCase())})</caption>
      <thead><tr><td></td><th scope="col">Rilevamento 1<br><small>${ut} ${a.t}</small></th><th scope="col">Rilevamento 2<br><small>${ut} ${b.t}</small></th></tr></thead>
      <tbody>
        ${riga('Pianificato a budget (BCWS)', fN(a.bcws), fN(b.bcws))}
        ${riga('Lavoro svolto a costi di budget (BCWP)', fN(a.bcwp), fN(b.bcwp))}
        ${riga('Costo effettivamente sostenuto (ACWP)', fN(a.acwp), fN(b.acwp))}
        ${riga('CV = BCWP − ACWP', col(a.cv, fS(a.cv)), col(b.cv, fS(b.cv)), 'sep')}
        ${riga('SV = BCWP − BCWS', col(a.sv, fS(a.sv)), col(b.sv, fS(b.sv)))}
        ${riga('%CV = CV / BCWS', col(a.cv, fP(a.pcv)), col(b.cv, fP(b.pcv)))}
        ${riga('%SV = SV / BCWS', col(a.sv, fP(a.psv)), col(b.sv, fP(b.psv)))}
        ${riga('CPI = BCWP / ACWP <em>(assunzione)</em>', indice(a.cpi), indice(b.cpi), 'sep')}
        ${riga('SPI = BCWP / BCWS <em>(assunzione)</em>', indice(a.spi), indice(b.spi))}
        ${riga('Stato', badge(a.stato), badge(b.stato), 'sep')}
      </tbody>
    </table>`;
  }

  /** Frasi di interpretazione e previsione. */
  function interpretazione(m) {
    const ut = m.unitaTempo;
    let h = m.rilevamenti.map(r =>
      `<p class="frase">${badge(r.stato)} <strong>Rilevamento ${r.n}</strong> (${ut.singolare} ${r.t}): ${esc(r.frasi.tempi)} ${esc(r.frasi.costi)}</p>`).join('');
    const p = m.previsione;
    if (p.visibile) {
      h += `<p class="frase previsione"><strong>Previsione</strong> <em>(assunzione, dal rilevamento 2)</em>: costo finale stimato EAC = ${fN(p.eac)} contro un budget di ${fN(m.bac)}; fine stimata al ${ut.singolare} ${fN(p.durataPrevista, 1)} contro ${m.durata} pianificati.</p>`;
    } else if (p.richiesta && p.motivo) {
      h += `<p class="frase previsione">${esc(p.motivo)}</p>`;
    }
    return h;
  }

  /** Tabella costi-tempi per periodo (righe dei rilevamenti evidenziate). */
  function tabellaCostiTempi(m) {
    const per = {};
    m.rilevamenti.forEach(r => { per[r.t] = r; });
    let righe = '';
    for (let i = 1; i <= m.durata; i++) {
      const r = per[i];
      righe += `<tr${r ? ' class="ril"' : ''}><th scope="row">${i}${r ? ` <span class="tag">ril. ${r.n}</span>` : ''}</th><td>${fN(m.costi[i - 1])}</td><td>${fN(m.bcwsCum[i])}</td>`
        + (r ? `<td>${fN(r.bcwp)}</td><td>${fN(r.acwp)}</td><td class="${classeSegno(r.cv)}">${fS(r.cv)}</td><td class="${classeSegno(r.sv)}">${fS(r.sv)}</td>`
             : '<td>–</td><td>–</td><td>–</td><td>–</td>') + '</tr>';
    }
    return `<div class="scorri"><table class="tabella-costi">
      <caption>Tabella costi-tempi (valori in ${esc(m.unitaMoneta.asse.toLowerCase())})</caption>
      <thead><tr><th scope="col">Periodo</th><th scope="col">Costo pianificato nel periodo</th><th scope="col">BCWS cumulato</th><th scope="col">BCWP</th><th scope="col">ACWP</th><th scope="col">CV</th><th scope="col">SV</th></tr></thead>
      <tbody>${righe}</tbody>
    </table></div>
    <p class="nota-tabella">BCWP, ACWP, CV e SV sono misurati solo ai due rilevamenti (righe evidenziate).</p>`;
  }

  /** Report completo (schermo e stampa). */
  function report(m, svg) {
    const d = m.dati;
    return `<div class="report-testa">
        <p class="report-sopra">Diagramma costi-tempi · earned value</p>
        <h2 class="report-titolo">${esc(m.titolo)}</h2>
        ${d.nota ? `<p class="report-nota">${esc(d.nota)}</p>` : ''}
        <p class="report-meta">Durata pianificata: <strong>${m.durata} ${esc(m.unitaTempo.plurale)}</strong> · Budget totale (BAC): <strong>${fN(m.bac)}</strong> (${esc(m.unitaMoneta.asse.toLowerCase())})</p>
      </div>
      <figure class="report-grafico solo-stampa">${svg || grafico.disegna(m)}</figure>
      <div class="report-griglia">
        <section><h3>Indicatori</h3>${tabellaIndicatori(m)}${interpretazione(m)}</section>
        <section><h3>Legenda dei parametri</h3>${legenda()}</section>
      </div>
      <section class="report-tabella"><h3>Tabella costi-tempi</h3>${tabellaCostiTempi(m)}</section>
      <section class="report-note"><h3>Nota sulle formule</h3>
        <p>Formule del libro (pagg. 198-199): CV = BCWP − ACWP, SV = BCWP − BCWS, %CV = CV / BCWS, %SV = SV / BCWS. In letteratura la %CV si calcola spesso su BCWP invece che su BCWS: qui si segue il libro. Le curve passano esattamente per i valori inseriti (BCWP e ACWP: origine e due rilevamenti) con un'interpolazione cubica monotona, quindi non scendono mai. Semaforo: <em>in linea</em> se CV e SV non sono negativi; <em>critico</em> se %CV o %SV sono sotto il −10% (soglia ipotizzata); altrimenti <em>attenzione</em>.</p>
        <p class="solo-stampa">Report generato dal browser con CostCurve. Il PDF "ufficiale" si ottiene compilando il file .tex.</p>
      </section>`;
  }

  /** Riepilogo per il passo 4: schede dei due rilevamenti. */
  function riepilogo(m) {
    const ut = m.unitaTempo.singolare;
    const kpi = (nome, valore, v) => `<div class="kpi"><span class="kpi-nome">${nome}</span><span class="kpi-val ${classeSegno(v)}">${valore}</span></div>`;
    return '<div class="schede-risultato">' + m.rilevamenti.map(r => `
      <article class="scheda-risultato bordo-${r.stato.colore}">
        <header><h3>Rilevamento ${r.n} <small>${ut} ${r.t}</small></h3>${badge(r.stato)}</header>
        <p>${esc(r.frasi.tempi)}<br>${esc(r.frasi.costi)}</p>
        <div class="kpi-griglia">
          ${kpi('SV', fS(r.sv), r.sv)}${kpi('%SV', fP(r.psv), r.sv)}
          ${kpi('CV', fS(r.cv), r.cv)}${kpi('%CV', fP(r.pcv), r.cv)}
        </div>
      </article>`).join('') + '</div>'
      + (m.previsione.visibile
        ? `<p class="previsione-breve"><strong>Previsione</strong> (assunzione): costo finale ≈ <strong>${fN(m.previsione.eac)}</strong> (budget ${fN(m.bac)}), fine ≈ ${ut} <strong>${fN(m.previsione.durataPrevista, 1)}</strong> (piano: ${m.durata}).</p>`
        : (m.previsione.richiesta && m.previsione.motivo ? `<p class="previsione-breve">${esc(m.previsione.motivo)}</p>` : ''));
  }

  /** Semafori compatti sotto l'anteprima. */
  function semafori(m) {
    return m.rilevamenti.map(r => `<div class="semaforo-mini">
      <span class="semaforo-mini-testa">Ril. ${r.n} · ${m.unitaTempo.singolare} ${r.t}</span> ${badge(r.stato)}
      <span class="semaforo-mini-dati"><span class="${classeSegno(r.sv)}">SV ${fP(r.psv)}</span> · <span class="${classeSegno(r.cv)}">CV ${fP(r.pcv)}</span></span>
    </div>`).join('');
  }

  const api = { report, riepilogo, semafori, legenda, tabellaIndicatori, tabellaCostiTempi, LEGENDA };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { radice.CC = radice.CC || {}; radice.CC.report = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this);
