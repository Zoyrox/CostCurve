/* =====================================================================
 * presentazione.js — modalità presentazione (per proiettare in classe)
 * ---------------------------------------------------------------------
 * Grafico a tutto schermo, testo grande. Con le frecce (o i pulsanti)
 * si passa da un elemento all'altro: BCWS, BCWP, ACWP, SV e CV di ogni
 * rilevamento, previsione, sintesi. L'elemento spiegato è in primo
 * piano, il resto sfuma. I numeri sono quelli del modello calcolato.
 * ===================================================================== */
(function () {
  'use strict';

  const { numeri, calcoli, grafico } = window.CC;
  const $ = s => document.querySelector(s);
  const fN = numeri.formatNumero, fS = numeri.formatConSegno, fP = numeri.formatPercentuale;
  let passi = [], indice = 0, modello = null, aperta = false;

  /** I passi del racconto, costruiti dal modello. */
  function costruisciPassi(m) {
    const ut = m.unitaTempo, u = m.unitaMoneta.breve;
    const p = [];
    p.push({ ev: null, titolo: 'Il diagramma costi-tempi', testo: `Tre curve cumulate nel tempo (${ut.plurale}): quanto si doveva spendere secondo il piano, quanto vale il lavoro fatto e quanto si è speso davvero. Durata pianificata ${m.durata} ${ut.plurale}, budget ${fN(m.bac)} ${u}.` });
    if (m.mostra.bcws) p.push({ ev: 'bcws', titolo: 'Pianificato a budget (BCWS)', testo: `È la baseline: il costo cumulato previsto periodo per periodo. Ha la tipica forma a S e arriva a ${fN(m.totalePiano)} ${u} al ${ut.singolare} ${m.durata}.` });
    if (m.mostra.bcwp) p.push({ ev: 'bcwp', titolo: 'Lavoro svolto a costi di budget (BCWP)', testo: 'Quanto vale, ai prezzi del piano, il lavoro davvero completato (earned value). Se sta sotto la curva blu, si è fatto meno lavoro del previsto.' });
    if (m.mostra.acwp) p.push({ ev: 'acwp', titolo: 'Costo effettivamente sostenuto (ACWP)', testo: 'Quanto si è speso davvero per il lavoro fatto. Se sta sopra la curva verde, il lavoro è costato più del previsto.' });
    for (const r of m.rilevamenti) {
      const quando = `${ut.singolare} ${r.t}${r.data ? ` (${r.data})` : ''}`;
      p.push({ ev: 'sv', titolo: `SV al rilevamento ${r.n} · ${quando}`, testo: `SV = BCWP − BCWS = ${fN(r.bcwp)} − ${fN(r.bcws)} = ${fS(r.sv)} ${u} (${fP(r.psv)}). ${r.frasi.tempi}` });
      p.push({ ev: 'cv', titolo: `CV al rilevamento ${r.n} · ${quando}`, testo: `CV = BCWP − ACWP = ${fN(r.bcwp)} − ${fN(r.acwp)} = ${fS(r.cv)} ${u} (${fP(r.pcv)}). ${r.frasi.costi}` });
    }
    if (m.previsione.visibile) {
      const pr = m.previsione;
      p.push({ ev: 'previsione', titolo: 'Previsione', testo: `${pr.modo === 'manuale' ? 'Stimata dal project manager' : 'Con l\'ultimo rilevamento (EAC = BAC / CPI, fine = durata / SPI)'}: costo finale ${fN(pr.eac)} ${u} contro ${fN(m.bac)}, fine al ${ut.singolare} ${fN(pr.durataPrevista, 1)} contro ${m.durata}.` });
    }
    p.push({ ev: null, titolo: 'In sintesi', testo: m.riassunto });
    return p;
  }

  function disegna() {
    if (!aperta) return;
    const passo = passi[indice];
    const box = $('#pres-grafico');
    const r = box.getBoundingClientRect();
    box.innerHTML = grafico.disegnaSchermo(modello, { larghezza: r.width, altezza: r.height, tema: 'scuro', evidenzia: passo.ev });
    $('#pres-titolo').textContent = passo.titolo;
    $('#pres-testo').textContent = passo.testo;
    $('#pres-contatore').textContent = `${indice + 1} / ${passi.length}`;
    $('#pres-prima').disabled = indice === 0;
    $('#pres-dopo').disabled = indice === passi.length - 1;
  }

  function apri() {
    const dati = window.CC.app && window.CC.app.dati();
    if (!dati) return;
    modello = calcoli.calcola(dati, { vistaIntera: true });
    if (!modello.valido) { window.CC.app.avviso('Completa prima i dati: la presentazione usa il diagramma.'); return; }
    passi = costruisciPassi(modello);
    indice = 0;
    aperta = true;
    $('#pres-progetto').textContent = modello.titolo;
    $('#presentazione').hidden = false;
    document.body.classList.add('in-presentazione');
    const el = $('#presentazione');
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    requestAnimationFrame(disegna);
    $('#pres-dopo').focus();
  }

  function chiudi() {
    if (!aperta) return;
    aperta = false;
    $('#presentazione').hidden = true;
    document.body.classList.remove('in-presentazione');
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    const b = $('#b-presenta'); if (b) b.focus();
  }

  const vai = d => { indice = Math.max(0, Math.min(passi.length - 1, indice + d)); disegna(); };

  $('#pres-chiudi').addEventListener('click', chiudi);
  $('#pres-prima').addEventListener('click', () => vai(-1));
  $('#pres-dopo').addEventListener('click', () => vai(1));
  document.addEventListener('keydown', e => {
    if (!aperta) return;
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); vai(1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); vai(-1); }
    else if (e.key === 'Escape') { e.preventDefault(); chiudi(); }
  });
  // scorrimento col dito sul grafico: avanti / indietro
  let x0 = null;
  $('#pres-grafico').addEventListener('pointerdown', e => { x0 = e.clientX; });
  $('#pres-grafico').addEventListener('pointerup', e => { if (x0 !== null && Math.abs(e.clientX - x0) > 50) vai(e.clientX < x0 ? 1 : -1); x0 = null; });
  window.addEventListener('resize', () => requestAnimationFrame(disegna));
  document.addEventListener('fullscreenchange', () => { if (aperta && !document.fullscreenElement) requestAnimationFrame(disegna); });

  window.CC.presentazione = { apri, chiudi, costruisciPassi };
  $('#b-presenta').addEventListener('click', apri);
})();
