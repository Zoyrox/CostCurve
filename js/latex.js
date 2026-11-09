/* =====================================================================
 * latex.js — generatore del file .tex (l'OUTPUT UFFICIALE)
 * ---------------------------------------------------------------------
 * Il file prodotto è un documento LaTeX completo e autonomo:
 *   - sezione DATI: solo numeri e testi (macro) da modificare a mano;
 *   - sezione DISEGNO: fissa, uguale per ogni progetto. Fa TUTTI i
 *     calcoli in LaTeX (BCWS cumulato, CV, SV, %CV, %SV, previsione,
 *     assi, curve, tabelle, frasi), con le stesse formule e lo stesso
 *     algoritmo di js/calcoli.js. Se cambi un numero nei DATI e
 *     ricompili, grafico e tabelle si aggiornano da soli.
 * Si compila con pdflatex (anche su Overleaf), una sola volta.
 * ===================================================================== */
(function (radice) {
  'use strict';

  const numeri = (typeof module !== 'undefined' && module.exports)
    ? require('./numeri.js') : radice.CC.numeri;
  const calcoli = (typeof module !== 'undefined' && module.exports)
    ? require('./calcoli.js') : radice.CC.calcoli;
  const L = numeri.perLatex;

  /**
   * Rende "sicuro" un testo per LaTeX: i caratteri speciali diventano
   * comandi (R&D 50% #1 _beta -> R\&D 50\% \#1 \_beta) e i simboli che
   * pdflatex non sa stampare (es. emoji) vengono tolti.
   */
  function testoLatex(testo) {
    const strani = new Set(calcoli.caratteriNonSupportati(testo));
    const sostituzioni = {
      '\\': '\\textbackslash{}', '{': '\\{', '}': '\\}', '$': '\\$', '&': '\\&',
      '#': '\\#', '^': '\\textasciicircum{}', '_': '\\_', '~': '\\textasciitilde{}',
      '%': '\\%', '"': '\\textquotedbl{}', '<': '\\textless{}', '>': '\\textgreater{}',
      '|': '\\textbar{}', '€': '\\texteuro{}',
    };
    let out = '';
    for (const c of String(testo || '').normalize('NFC')) {
      if (strani.has(c)) continue;
      out += sostituzioni[c] !== undefined ? sostituzioni[c] : c;
    }
    return out.replace(/\s+/g, ' ').trim();
  }

  /** Nome del file: "Esempio del libro" -> "costi-tempi-esempio-del-libro.tex" */
  function nomeFile(titolo) {
    const base = String(titolo || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
    return 'costi-tempi' + (base ? '-' + base : '') + '.tex';
  }

  // ---------------------------------------------------------------------
  // Parte fissa del documento (DISEGNO). È un testo "grezzo": le barre
  // rovesciate sono quelle di LaTeX. Non contiene dati del progetto.
  // ---------------------------------------------------------------------
  const DISEGNO = String.raw`
% =====================================================================
% === DISEGNO (non modificare) ========================================
% =====================================================================
% Da qui in giù non ci sono numeri del progetto: tutto viene calcolato
% a partire dai DATI qui sopra.

\usepackage[T1]{fontenc}
\usepackage{lmodern}
\usepackage[italian]{babel}
\usepackage[a4paper,margin=16mm,top=14mm,bottom=16mm]{geometry}
\usepackage[table]{xcolor}
\usepackage{amssymb}
\usepackage{pgfplots}
\pgfplotsset{compat=1.18}
\usetikzlibrary{arrows.meta}
\usepackage{booktabs}
\usepackage{longtable}
\usepackage{array}
\usepackage{siunitx}
\sisetup{output-decimal-marker={,}, group-separator={.}, group-minimum-digits=4,
         round-mode=places, round-precision=2, drop-zero-decimal=true}
\renewcommand{\familydefault}{\sfdefault}
\setlength{\parindent}{0pt}
\setlength{\parskip}{3pt}
\pagestyle{plain}

% Colori (palette Okabe-Ito, adatta ai daltonici)
\definecolor{ccBCWS}{HTML}{0072B2}
\definecolor{ccBCWP}{HTML}{009E73}
\definecolor{ccACWP}{HTML}{D55E00}
\definecolor{ccInk}{HTML}{1B2A3A}
\definecolor{ccBox}{HTML}{56B4E9}
\definecolor{ccNeg}{HTML}{B34700}
\definecolor{ccPos}{HTML}{00775A}
\definecolor{ccGrid}{HTML}{E6E1D6}
\definecolor{ccRiga}{HTML}{F3EFE6}
\definecolor{ccGiallo}{HTML}{8A6A00}

% ---------------------------------------------------------------------
% CALCOLI (in expl3: numeri decimali a doppia precisione, anche grandi)
% ---------------------------------------------------------------------
\ExplSyntaxOn
\msg_new:nnn { costcurve } { dati } { Errore~nei~DATI:~#1 }
\cs_new_protected:Npn \cc_errore:n #1 { \msg_error:nnn { costcurve } { dati } {#1} }
\cs_new:Npn \cc_fp:n #1 { \fp_eval:n {#1} }
\cs_new:Npn \cc_v:n #1 { \tl_use:c { g_cc_ #1 _tl } }
% valore arrotondato a 2 decimali (come si stampa): siunitx va in errore se deve arrotondare numeri lunghi
\cs_new:Npn \cc_r:n #1 { \fp_eval:n { round( \cc_v:n { #1 } , 2 ) } }
% arrotondamento UNICO alle cifre mostrate (evita il doppio arrotondamento 8,0459 -> 8,05 -> 8,1)
\cs_new:Npn \cc_r:nn #1 #2 { \fp_eval:n { round( \cc_v:n { #1 } , #2 ) } }
\cs_new_protected:Npn \cc_set:nn #1 #2 { \tl_gset:cx { g_cc_ #1 _tl } {#2} }
\fp_new:N \l_cc_a_fp
\fp_new:N \l_cc_b_fp
\fp_new:N \l_cc_c_fp

% --- 1. Piano a budget: BCWS cumulato periodo per periodo -------------
\clist_new:N \g_cc_costi_clist
\clist_gset:Nx \g_cc_costi_clist { \PianoCosti }
\int_new:N \g_cc_n_int
\int_gset:Nn \g_cc_n_int { \clist_count:N \g_cc_costi_clist }
\fp_compare:nNnF { \Durata } = { \g_cc_n_int }
  { \cc_errore:n { PianoCosti~contiene~\int_use:N \g_cc_n_int \c_space_tl valori~ma~Durata~vale~\Durata.~Devono~coincidere. } }
\fp_new:N \g_cc_cum_fp
\cc_set:nn { bcws0 } { 0 }
\int_step_inline:nn { \g_cc_n_int }
  {
    \fp_compare:nNnT { \clist_item:Nn \g_cc_costi_clist {#1} } < { 0 }
      { \cc_errore:n { il~costo~del~periodo~#1~e'~negativo. } }
    \fp_gadd:Nn \g_cc_cum_fp { \clist_item:Nn \g_cc_costi_clist {#1} }
    \cc_set:nn { bcws#1 } { \fp_use:N \g_cc_cum_fp }
    \cc_set:nn { costo#1 } { \fp_eval:n { \clist_item:Nn \g_cc_costi_clist {#1} } }
  }
\cc_set:nn { totale } { \fp_use:N \g_cc_cum_fp }
\cs_new:Npn \cc_bcws:n #1 { \cc_v:n { bcws \int_eval:n {#1} } }

% --- 2. Indicatori di un rilevamento (formule del libro, pag. 199) ---
\cs_new_protected:Npn \cc_rilevamento:nnnn #1 #2 #3 #4
  {
    % #1 = A o B, #2 = periodo, #3 = BCWP, #4 = ACWP
    \bool_if:nF { \fp_compare_p:n { #2 = round(#2) } && \fp_compare_p:n { #2 >= 1 } && \fp_compare_p:n { #2 <= \g_cc_n_int } }
      { \cc_errore:n { il~periodo~del~rilevamento~#1~deve~essere~un~intero~tra~1~e~\int_use:N \g_cc_n_int. } }
    \cc_set:nn { t#1 } { \int_eval:n { \fp_eval:n { round(#2) } } }
    \cc_set:nn { bcws#1 } { \cc_bcws:n { \cc_v:n { t#1 } } }
    \cc_set:nn { bcwp#1 } { \fp_eval:n {#3} }
    \cc_set:nn { acwp#1 } { \fp_eval:n {#4} }
    \cc_set:nn { cv#1 } { \fp_eval:n { (#3) - (#4) } }                    % CV = BCWP - ACWP
    \cc_set:nn { sv#1 } { \fp_eval:n { (#3) - \cc_v:n { bcws#1 } } }      % SV = BCWP - BCWS
    \fp_compare:nNnTF { \cc_v:n { bcws#1 } } > { 0 }
      {
        \cc_set:nn { pcv#1 } { \fp_eval:n { \cc_v:n { cv#1 } / \cc_v:n { bcws#1 } * 100 } }  % %CV = CV / BCWS
        \cc_set:nn { psv#1 } { \fp_eval:n { \cc_v:n { sv#1 } / \cc_v:n { bcws#1 } * 100 } }  % %SV = SV / BCWS
        \cc_set:nn { spi#1 } { \fp_eval:n { (#3) / \cc_v:n { bcws#1 } } }                    % SPI (assunzione)
        \cc_set:nn { haperc#1 } { 1 }
      }
      { \cc_set:nn { haperc#1 } { 0 } \cc_set:nn { spi#1 } { nd } }
    \fp_compare:nNnTF { #4 } > { 0 }
      { \cc_set:nn { cpi#1 } { \fp_eval:n { (#3) / (#4) } } }                                  % CPI (assunzione)
      { \cc_set:nn { cpi#1 } { nd } }
  }
\cc_rilevamento:nnnn { A } { \TempoA } { \BCWPA } { \ACWPA }
\cc_rilevamento:nnnn { B } { \TempoB } { \BCWPB } { \ACWPB }
\int_compare:nNnF { \cc_v:n { tA } } < { \cc_v:n { tB } }
  { \cc_errore:n { TempoB~deve~essere~maggiore~di~TempoA. } }
\fp_compare:nNnT { \BCWPB } < { \BCWPA } { \cc_errore:n { BCWPB~non~puo'~essere~minore~di~BCWPA~(valori~cumulati). } }
\fp_compare:nNnT { \ACWPB } < { \ACWPA } { \cc_errore:n { ACWPB~non~puo'~essere~minore~di~ACWPA~(valori~cumulati). } }

% --- 3. Previsione (assunzioni: EAC = BAC / CPI, fine = Durata / SPI) --
\bool_new:N \g_cc_prev_bool
\cc_set:nn { motivo } { }
\str_if_eq:eeTF { \cc_v:n { cpiB } } { nd }
  { \cc_set:nn { motivo } { Previsione~non~calcolabile:~servono~BCWP,~ACWP~e~BCWS~maggiori~di~zero~all'ultimo~rilevamento. } }
  {
    \bool_if:nTF { \str_if_eq_p:ee { \cc_v:n { spiB } } { nd } || \fp_compare_p:n { \cc_v:n { cpiB } <= 0 } || \fp_compare_p:n { \cc_v:n { spiB } <= 0 } }
      { \cc_set:nn { motivo } { Previsione~non~calcolabile:~servono~BCWP,~ACWP~e~BCWS~maggiori~di~zero~all'ultimo~rilevamento. } }
      {
        \cc_set:nn { eac } { \fp_eval:n { \BAC / \cc_v:n { cpiB } } }
        \cc_set:nn { fine } { \fp_eval:n { \g_cc_n_int / \cc_v:n { spiB } } }
        \fp_compare:nNnTF { \cc_v:n { fine } } < { \cc_v:n { tB } + 0.000000001 }
          { \cc_set:nn { motivo } { La~fine~stimata~cade~prima~dell'ultimo~rilevamento:~la~curva~di~previsione~non~si~disegna. } }
          {
            \fp_compare:nNnTF { \cc_v:n { fine } } > { 3 * \g_cc_n_int }
              { \cc_set:nn { motivo } { La~fine~stimata~supera~il~triplo~della~durata~pianificata:~la~curva~di~previsione~non~si~disegna. } }
              { \int_compare:nNnT { \MostraPrevisione } = { 1 } { \bool_gset_true:N \g_cc_prev_bool } }
          }
      }
  }

% --- 4. Assi: stesso algoritmo del sito ------------------------------
\cs_new_protected:Npn \cc_passo_bello:nn #1 #2
  {
    % #1 = nome del risultato, #2 = valore
    \fp_set:Nn \l_cc_a_fp {#2}
    \fp_compare:nNnTF \l_cc_a_fp > 0
      {
        \fp_set:Nn \l_cc_b_fp { 10 ^ floor( ln(\l_cc_a_fp) / ln(10) ) }
        \fp_set:Nn \l_cc_c_fp { \l_cc_a_fp / \l_cc_b_fp }
        \cc_set:nn {#1} { \fp_eval:n { ( \l_cc_c_fp <= 1 + 1e-9 ? 1 : ( \l_cc_c_fp <= 2 + 1e-9 ? 2 : ( \l_cc_c_fp <= 2.5 + 1e-9 ? 2.5 : ( \l_cc_c_fp <= 5 + 1e-9 ? 5 : 10 ) ) ) ) * \l_cc_b_fp } }
      }
      { \cc_set:nn {#1} { 1 } }
  }
\cc_set:nn { ydati } { \fp_eval:n { max( \BAC , \cc_v:n { totale } , \cc_v:n { bcwpA } , \cc_v:n { acwpA } , \cc_v:n { bcwpB } , \cc_v:n { acwpB } , \bool_if:NTF \g_cc_prev_bool { \cc_v:n { eac } } { 0 } ) } }
\cc_passo_bello:nn { ystep } { \cc_v:n { ydati } / 6 }
\cc_set:nn { ymax } { \fp_eval:n { ceil( \cc_v:n { ydati } * 1.15 / \cc_v:n { ystep } - 1e-9 ) * \cc_v:n { ystep } } }
\cc_set:nn { xdati } { \fp_eval:n { max( \g_cc_n_int , \bool_if:NTF \g_cc_prev_bool { \cc_v:n { fine } } { 0 } ) } }
\cc_set:nn { xstep } { 10000 }
\clist_map_inline:nn { 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000 }
  {
    \fp_compare:nNnT { #1 } > { \cc_v:n { xdati } / 12 - 1e-9 }
      { \cc_set:nn { xstep } { #1 } \clist_map_break: }
  }
\cc_set:nn { xmax } { \fp_eval:n { \cc_v:n { xdati } * 1.14 } }
\cc_set:nn { offSV } { \fp_eval:n { 0.045 * \cc_v:n { xmax } } }
\cc_set:nn { offCV } { \fp_eval:n { 0.13 * \cc_v:n { xmax } } }

% --- 4b. Etichette ACWP, BCWS, BCWP distanziate (come nel sito) -------
\int_new:N \l_cc_r_int
\cs_new_protected:Npn \cc_etichette:n #1
  {
    \tl_set:cx { l_cc_e1_tl } { \cc_v:n { acwp#1 } }
    \tl_set:cx { l_cc_e2_tl } { \cc_v:n { bcws#1 } }
    \tl_set:cx { l_cc_e3_tl } { \cc_v:n { bcwp#1 } }
    \int_step_inline:nn { 3 }
      {
        \int_zero:N \l_cc_r_int
        \int_step_inline:nn { 3 }
          {
            \bool_if:nT
              {
                \fp_compare_p:n { \tl_use:c { l_cc_e####1_tl } < \tl_use:c { l_cc_e##1_tl } } ||
                ( \fp_compare_p:n { \tl_use:c { l_cc_e####1_tl } = \tl_use:c { l_cc_e##1_tl } } && \int_compare_p:n { ####1 < ##1 } )
              }
              { \int_incr:N \l_cc_r_int }
          }
        \tl_set:cx { l_cc_rango##1_tl } { \int_use:N \l_cc_r_int }
        \tl_set:cx { l_cc_ord \int_use:N \l_cc_r_int _tl } { \tl_use:c { l_cc_e##1_tl } }
      }
    \tl_set:cx { l_cc_y0_tl } { \tl_use:c { l_cc_ord0_tl } }
    \tl_set:cx { l_cc_y1_tl } { \fp_eval:n { max( \tl_use:c { l_cc_ord1_tl } , \tl_use:c { l_cc_y0_tl } + 0.05 * \cc_v:n { ymax } ) } }
    \tl_set:cx { l_cc_y2_tl } { \fp_eval:n { max( \tl_use:c { l_cc_ord2_tl } , \tl_use:c { l_cc_y1_tl } + 0.05 * \cc_v:n { ymax } ) } }
    \cc_set:nn { lacwp#1 } { \tl_use:c { l_cc_y \tl_use:c { l_cc_rango1_tl } _tl } }
    \cc_set:nn { lbcws#1 } { \tl_use:c { l_cc_y \tl_use:c { l_cc_rango2_tl } _tl } }
    \cc_set:nn { lbcwp#1 } { \tl_use:c { l_cc_y \tl_use:c { l_cc_rango3_tl } _tl } }
  }
\cc_etichette:n { A }
\cc_etichette:n { B }

% --- 5. Curve: Bézier monotone (Fritsch-Butland), come nel sito ------
\seq_new:N \l_cc_x_seq
\seq_new:N \l_cc_y_seq
\int_new:N \l_cc_k_int
\tl_new:N \l_cc_path_tl
\cs_new:Npn \cc_x:n #1 { \seq_item:Nn \l_cc_x_seq { #1 } }
\cs_new:Npn \cc_y:n #1 { \seq_item:Nn \l_cc_y_seq { #1 } }
\cs_new:Npn \cc_h:n #1 { \tl_use:c { l_cc_h #1 _tl } }
\cs_new:Npn \cc_d:n #1 { \tl_use:c { l_cc_d #1 _tl } }
\cs_new:Npn \cc_m:n #1 { \tl_use:c { l_cc_m #1 _tl } }
\cs_new_protected:Npn \cc_bezier:n #1
  {
    % usa i nodi in \l_cc_x_seq e \l_cc_y_seq e salva il percorso come g_cc_path#1_tl
    \int_set:Nn \l_cc_k_int { \seq_count:N \l_cc_x_seq - 1 }
    \int_step_inline:nn { \l_cc_k_int }
      {
        \tl_set:cx { l_cc_h##1_tl } { \fp_eval:n { \cc_x:n { ##1 + 1 } - \cc_x:n { ##1 } } }
        \tl_set:cx { l_cc_d##1_tl } { \fp_eval:n { ( \cc_y:n { ##1 + 1 } - \cc_y:n { ##1 } ) / \cc_h:n { ##1 } } }
      }
    \tl_set:cn { l_cc_m1_tl } { 0 }
    \tl_set:cx { l_cc_m \int_eval:n { \l_cc_k_int + 1 } _tl } { \cc_d:n { \int_use:N \l_cc_k_int } }
    \int_step_inline:nnn { 2 } { \l_cc_k_int }
      {
        \fp_compare:nNnTF { \cc_d:n { \int_eval:n { ##1 - 1 } } * \cc_d:n { ##1 } } > { 0 }
          {
            \tl_set:cx { l_cc_m##1_tl } { \fp_eval:n {
              3 * ( \cc_h:n { \int_eval:n { ##1 - 1 } } + \cc_h:n { ##1 } ) /
              ( ( 2 * \cc_h:n { ##1 } + \cc_h:n { \int_eval:n { ##1 - 1 } } ) / \cc_d:n { \int_eval:n { ##1 - 1 } }
              + ( \cc_h:n { ##1 } + 2 * \cc_h:n { \int_eval:n { ##1 - 1 } } ) / \cc_d:n { ##1 } ) } }
          }
          { \tl_set:cn { l_cc_m##1_tl } { 0 } }
      }
    \tl_set:Nx \l_cc_path_tl { ( \cc_x:n { 1 } , \cc_y:n { 1 } ) }
    \int_step_inline:nn { \l_cc_k_int }
      {
        \tl_put_right:Nx \l_cc_path_tl
          {
            \c_space_tl .. \c_space_tl controls \c_space_tl
            ( \fp_eval:n { \cc_x:n { ##1 } + \cc_h:n { ##1 } / 3 } , \fp_eval:n { \cc_y:n { ##1 } + \cc_m:n { ##1 } * \cc_h:n { ##1 } / 3 } )
            \c_space_tl and \c_space_tl
            ( \fp_eval:n { \cc_x:n { ##1 + 1 } - \cc_h:n { ##1 } / 3 } , \fp_eval:n { \cc_y:n { ##1 + 1 } - \cc_m:n { \int_eval:n { ##1 + 1 } } * \cc_h:n { ##1 } / 3 } )
            \c_space_tl .. \c_space_tl
            ( \cc_x:n { ##1 + 1 } , \cc_y:n { ##1 + 1 } )
          }
      }
    \tl_gset_eq:cN { g_cc_path#1_tl } \l_cc_path_tl
  }
% BCWS: un nodo per periodo
\seq_clear:N \l_cc_x_seq \seq_clear:N \l_cc_y_seq
\int_step_inline:nnn { 0 } { \g_cc_n_int }
  { \seq_put_right:Nn \l_cc_x_seq { #1 } \seq_put_right:Nx \l_cc_y_seq { \cc_bcws:n { #1 } } }
\cc_bezier:n { BCWS }
% BCWP e ACWP: origine e due rilevamenti
\clist_map_inline:nn { bcwp, acwp }
  {
    \seq_clear:N \l_cc_x_seq \seq_clear:N \l_cc_y_seq
    \seq_put_right:Nn \l_cc_x_seq { 0 } \seq_put_right:Nn \l_cc_y_seq { 0 }
    \seq_put_right:Nx \l_cc_x_seq { \cc_v:n { tA } } \seq_put_right:Nx \l_cc_y_seq { \cc_v:n { #1A } }
    \seq_put_right:Nx \l_cc_x_seq { \cc_v:n { tB } } \seq_put_right:Nx \l_cc_y_seq { \cc_v:n { #1B } }
    \cc_bezier:n { #1 }
  }
% Previsione: da (tB, ACWP) a (fine stimata, EAC), tangente finale 0
\bool_if:NT \g_cc_prev_bool
  {
    \fp_set:Nn \l_cc_a_fp { \cc_v:n { fine } - \cc_v:n { tB } }                                       % h
    \fp_set:Nn \l_cc_b_fp { max( 0 , min( ( \cc_v:n { acwpB } - \cc_v:n { acwpA } ) / ( \cc_v:n { tB } - \cc_v:n { tA } ) ,
                                         3 * ( \cc_v:n { eac } - \cc_v:n { acwpB } ) / \l_cc_a_fp ) ) }   % m
    \cc_set:nn { pathPrev }
      {
        ( \cc_v:n { tB } , \cc_v:n { acwpB } ) \c_space_tl .. \c_space_tl controls \c_space_tl
        ( \fp_eval:n { \cc_v:n { tB } + \l_cc_a_fp / 3 } , \fp_eval:n { \cc_v:n { acwpB } + \l_cc_b_fp * \l_cc_a_fp / 3 } )
        \c_space_tl and \c_space_tl
        ( \fp_eval:n { \cc_v:n { fine } - \l_cc_a_fp / 3 } , \cc_v:n { eac } )
        \c_space_tl .. \c_space_tl ( \cc_v:n { fine } , \cc_v:n { eac } )
      }
  }

% --- 6. Comandi usati nel documento ---------------------------------
\cs_new:Npn \CCv #1 { \cc_v:n { #1 } }                      % valore grezzo
\cs_new:Npn \CCr #1 { \cc_r:n { #1 } }                      % valore arrotondato (per \num)
\cs_new_protected:Npn \CCdisegna #1 #2                      % disegna un percorso calcolato
  { \use:x { \exp_not:N \draw [ \exp_not:n { #1 } ] \cc_v:n { #2 } ; } }
\cs_new_protected:Npn \CCse #1 #2 #3 { \bool_if:NTF #1 { #2 } { #3 } }
\cs_new_protected:Npn \CCprevisione #1 #2 { \bool_if:NTF \g_cc_prev_bool { #1 } { #2 } }
% importo all'italiana: 540.000 oppure 694.285,71
\cs_new_protected:Npn \CCsoldi #1 { \num { \cc_r:n { #1 } } }
% importo con segno esplicito (+/-)
\cs_new_protected:Npn \CCsegno #1
  { \fp_compare:nNnT { \cc_v:n { #1 } } > { 0 } { + } \num { \cc_r:n { #1 } } }
% forma breve per le etichette nel grafico: 193,8 mln / 1,1 mld (come il sito)
\cs_new_protected:Npn \CCbreve #1
  {
    \fp_compare:nNnTF { abs( \cc_v:n { #1 } ) } < { 1e6 }
      { \num { \cc_r:n { #1 } } }
      {
        \fp_compare:nNnTF { abs( \cc_v:n { #1 } ) } < { 1e9 }
          { \num [ round-precision = 1 , drop-zero-decimal = false ] { \fp_eval:n { round( \cc_v:n { #1 } / 1e6 , 1 ) } } ~mln }
          { \num [ round-precision = 1 , drop-zero-decimal = false ] { \fp_eval:n { round( \cc_v:n { #1 } / 1e9 , 1 ) } } ~mld }
      }
  }
\cs_new_protected:Npn \CCbreveSegno #1
  { \fp_compare:nNnT { \cc_v:n { #1 } } > { 0 } { + } \CCbreve { #1 } }
% percentuale con 1 decimale e segno, oppure n.d.
\cs_new_protected:Npn \CCperc #1 #2
  {
    \int_compare:nNnTF { \cc_v:n { haperc #2 } } = { 1 }
      {
        \fp_compare:nNnT { \cc_v:n { #1 #2 } } > { 0 } { + }
        \num [ round-precision = 1 , drop-zero-decimal = false ] { \cc_r:nn { #1 #2 } { 1 } } \,\%
      }
      { n.d. }
  }
% indice (CPI, SPI) con 2 decimali oppure n.d.
\cs_new_protected:Npn \CCindice #1
  { \str_if_eq:eeTF { \cc_v:n { #1 } } { nd } { n.d. } { \num [ drop-zero-decimal = false ] { \cc_r:n { #1 } } } }
% frasi di interpretazione (stesse del sito)
\cs_new_protected:Npn \cc_quanto:nn #1 #2
  {
    \int_compare:nNnTF { \cc_v:n { haperc #2 } } = { 1 }
      { \num [ round-precision = 1 , drop-zero-decimal = false ] { \fp_eval:n { round( abs( \cc_v:n { p #1 #2 } ) , 1 ) } } \% }
      { \num { \fp_eval:n { round( abs( \cc_v:n { #1 #2 } ) , 2 ) } } }
  }
\cs_new_protected:Npn \CCfrasi #1
  {
    \fp_compare:nNnTF { abs( \cc_v:n { sv#1 } ) } < { 1e-9 }
      { In~linea~con~i~tempi:~il~lavoro~svolto~è~pari~al~pianificato. }
      {
        \fp_compare:nNnTF { \cc_v:n { sv#1 } } < { 0 }
          { In~ritardo:~il~lavoro~svolto~è~inferiore~al~pianificato~del~\cc_quanto:nn { sv } { #1 }. }
          { In~anticipo:~il~lavoro~svolto~supera~il~pianificato~del~\cc_quanto:nn { sv } { #1 }. }
      }
    \c_space_tl
    \fp_compare:nNnTF { abs( \cc_v:n { cv#1 } ) } < { 1e-9 }
      { Costi~in~linea~con~il~valore~del~lavoro~svolto. }
      {
        \fp_compare:nNnTF { \cc_v:n { cv#1 } } < { 0 }
          { Sforamento~dei~costi~del~\cc_quanto:nn { cv } { #1 }. }
          { Risparmio~sui~costi~del~\cc_quanto:nn { cv } { #1 }. }
      }
  }
% semaforo: verde se CV e SV >= 0, rosso se %CV o %SV < -10%, altrimenti giallo
\cs_new_protected:Npn \CCsemaforo #1
  {
    \bool_if:nTF { \fp_compare_p:n { \cc_v:n { cv#1 } > -1e-9 } && \fp_compare_p:n { \cc_v:n { sv#1 } > -1e-9 } }
      { \textcolor{ccPos}{\textbf{$\checkmark$~In~linea}} }
      {
        \bool_if:nTF { \int_compare_p:n { \cc_v:n { haperc#1 } = 1 } && ( \fp_compare_p:n { \cc_v:n { pcv#1 } < -10 } || \fp_compare_p:n { \cc_v:n { psv#1 } < -10 } ) }
          { \textcolor{ccNeg}{\textbf{$\times$~Critico}} }
          { \textcolor{ccGiallo}{\textbf{!~Attenzione}} }
      }
  }
% colore dei valori: rosso scuro se negativi, verde scuro se positivi
\cs_new_protected:Npn \CCcolore #1 #2
  {
    \fp_compare:nNnTF { \cc_v:n { #1 } } < { 0 } { \textcolor{ccNeg}{#2} }
      { \fp_compare:nNnTF { \cc_v:n { #1 } } > { 0 } { \textcolor{ccPos}{#2} } { #2 } }
  }
% righe della tabella costi-tempi, generate dalla lista dei costi
\tl_new:N \g_cc_righe_tl
\int_step_inline:nn { \g_cc_n_int }
  {
    \bool_set_false:N \l_tmpa_bool
    \tl_clear:N \l_tmpa_tl
    \int_compare:nNnT { #1 } = { \cc_v:n { tA } } { \bool_set_true:N \l_tmpa_bool \tl_set:Nn \l_tmpa_tl { A } }
    \int_compare:nNnT { #1 } = { \cc_v:n { tB } } { \bool_set_true:N \l_tmpa_bool \tl_set:Nn \l_tmpa_tl { B } }
    \tl_gput_right:Nx \g_cc_righe_tl
      {
        \bool_if:NT \l_tmpa_bool { \exp_not:N \rowcolor { ccRiga } }
        #1 \bool_if:NT \l_tmpa_bool { \c_space_tl \exp_not:N \textbf { (ril.~ \int_eval:n { \str_if_eq:VnTF \l_tmpa_tl { A } { 1 } { 2 } } ) } }
        & \exp_not:N \num { \cc_r:n { costo#1 } }
        & \exp_not:N \num { \cc_r:n { bcws#1 } }
        & \bool_if:NTF \l_tmpa_bool { \exp_not:N \CCsoldi { bcwp \l_tmpa_tl } } { -- }
        & \bool_if:NTF \l_tmpa_bool { \exp_not:N \CCsoldi { acwp \l_tmpa_tl } } { -- }
        & \bool_if:NTF \l_tmpa_bool { \exp_not:N \CCcolore { cv \l_tmpa_tl } { \exp_not:N \CCsegno { cv \l_tmpa_tl } } } { -- }
        & \bool_if:NTF \l_tmpa_bool { \exp_not:N \CCcolore { sv \l_tmpa_tl } { \exp_not:N \CCsegno { sv \l_tmpa_tl } } } { -- }
        \exp_not:N \\
      }
  }
\cs_new:Npn \CCrighe { \g_cc_righe_tl }
% stampa #2 solo se il testo #1 non è vuoto
\cs_new_protected:Npn \CCseNonVuoto #1 #2 { \tl_if_blank:oF {#1} {#2} }
\cs_new_protected:Npn \CCmotivo { \tl_if_blank:eF { \cc_v:n { motivo } } { { \footnotesize\itshape \cc_v:n { motivo } } \par } }
\ExplSyntaxOff

% Stili delle curve: colore E tratto diversi (leggibili anche in bianco e nero)
\tikzset{
  ccbcws/.style={ccBCWS, line width=1.5pt},
  ccbcwp/.style={ccBCWP, line width=1.5pt, dash pattern=on 6pt off 3pt},
  ccacwp/.style={ccACWP, line width=1.5pt, dash pattern=on 7pt off 2.5pt on 1.5pt off 2.5pt},
  ccprev/.style={ccACWP, line width=1.4pt, dash pattern=on 1.5pt off 2.5pt},
  ccril/.style={ccInk, line width=0.6pt, dash pattern=on 3pt off 2pt},
  ccguida/.style={ccInk!70, line width=0.5pt, dash pattern=on 3pt off 2pt},
  ccfreccia/.style={ccInk, line width=0.9pt, {Stealth[length=4pt]}-{Stealth[length=4pt]}},
  ccriquadro/.style={draw=ccBCWS, densely dotted, fill=ccBox!45, minimum size=7pt, inner sep=0pt},
  ccetichetta/.style={font=\scriptsize\bfseries, text=ccInk},
  ccvalore/.style={font=\scriptsize, fill=white, fill opacity=0.85, text opacity=1, inner sep=1.2pt, align=left, text=ccInk, anchor=west, xshift=2pt},
}

% Disegno degli elementi di un rilevamento (#1 = A o B, #2 = 1 o 2, #3 = altezza etichetta)
% pgfplots esegue i comandi di disegno alla FINE dell'asse: per questo i numeri
% vengono "congelati" subito con \edef (\noexpand lascia i comandi per dopo).
\newcommand{\CCdisegnaRilevamento}[3]{%
  \edef\ccT{\CCv{t#1}}\edef\ccS{\CCv{bcws#1}}\edef\ccP{\CCv{bcwp#1}}\edef\ccA{\CCv{acwp#1}}%
  \edef\ccXSV{\fpeval{\ccT+\CCv{offSV}}}\edef\ccXCV{\fpeval{\ccT+\CCv{offCV}}}%
  \edef\ccTop{\fpeval{\CCv{ymax}*#3}}%
  \edef\ccTmp{%
    \noexpand\draw[ccril] (\ccT,0) -- (\ccT,\ccTop);
    \noexpand\node[ccetichetta, anchor=south, align=center] at (\ccT,\ccTop) {Rilevamento #2\noexpand\\[-1pt]\noexpand\mdseries \UnitaTempoSingolare\space\ccT};
    \noexpand\draw[ccguida] (\ccT,\ccS) -- (\ccXSV,\ccS);
    \noexpand\draw[ccguida] (\ccT,\ccP) -- (\ccXCV,\ccP);
    \noexpand\draw[ccguida] (\ccT,\ccA) -- (\ccXCV,\ccA);
    \ifdim\fpeval{abs(\ccS-\ccP)/\CCv{ymax}}pt>0.004pt
      \noexpand\draw[ccfreccia] (\ccXSV,\ccS) -- (\ccXSV,\ccP);
    \fi
    \ifdim\fpeval{abs(\ccA-\ccP)/\CCv{ymax}}pt>0.004pt
      \noexpand\draw[ccfreccia] (\ccXCV,\ccA) -- (\ccXCV,\ccP);
    \fi
    \noexpand\node[ccriquadro] at (\ccT,\ccS) {};
    \noexpand\node[ccriquadro] at (\ccT,\ccP) {};
    \noexpand\node[ccriquadro] at (\ccT,\ccA) {};
    \noexpand\node[ccetichetta, anchor=east, xshift=-5pt] at (\ccT,\CCv{lacwp#1}) {ACWP};
    \noexpand\node[ccetichetta, anchor=east, xshift=-5pt] at (\ccT,\CCv{lbcws#1}) {BCWS};
    \noexpand\node[ccetichetta, anchor=east, xshift=-5pt] at (\ccT,\CCv{lbcwp#1}) {BCWP};
    \noexpand\node[ccvalore] at (\ccXSV,\fpeval{(\ccS+\ccP)/2}) {\noexpand\textbf{SV\noexpand\textsubscript{#2}}\noexpand\\\noexpand\CCcolore{sv#1}{\noexpand\CCbreveSegno{sv#1}}};
    \noexpand\node[ccvalore] at (\ccXCV,\fpeval{(\ccA+\ccP)/2}) {\noexpand\textbf{CV\noexpand\textsubscript{#2}}\noexpand\\\noexpand\CCcolore{cv#1}{\noexpand\CCbreveSegno{cv#1}}};
  }\ccTmp
}

\begin{document}

% ---------------------------------------------------------------------
% TITOLO
% ---------------------------------------------------------------------
{\color{ccACWP}\rule{\linewidth}{2.5pt}}\par\vspace{2pt}
{\scriptsize\bfseries\color{ccACWP}DIAGRAMMA COSTI-TEMPI \textperiodcentered{} EARNED VALUE}\par
{\LARGE\bfseries\color{ccInk}\Titolo}\par
\CCseNonVuoto{\Nota}{{\small\itshape\color{ccInk!75}\Nota}\par}
{\small Durata pianificata: \textbf{\Durata~\UnitaTempo} \quad Budget totale (BAC): \textbf{\num{\fpeval{round(\BAC,2)}}} (\UnitaMoneta)}
\vspace{4pt}

% ---------------------------------------------------------------------
% DIAGRAMMA
% ---------------------------------------------------------------------
\begin{center}
\begin{tikzpicture}
\begin{axis}[
  width=0.84\linewidth, height=9.2cm, scale only axis=false,
  xmin=0, xmax=\CCv{xmax}, ymin=0, ymax=\CCv{ymax},
  xtick distance=\CCv{xstep}, ytick distance=\CCv{ystep},
  axis lines=left, axis line style={ccInk, line width=0.9pt, -{Stealth[length=6pt]}},
  tick style={ccInk}, tick align=outside, major tick length=3pt,
  ymajorgrids, grid style={ccGrid, line width=0.4pt},
  clip=false,
  scaled y ticks=false,
  yticklabel style={font=\scriptsize, /pgf/number format/.cd, fixed, use comma, 1000 sep={.}},
  xticklabel style={font=\scriptsize},
  title={Analisi dell'avanzamento per periodo},
  title style={font=\bfseries\color{ccACWP}, draw=ccACWP, line width=0.6pt, rounded corners=2pt, inner sep=4pt, yshift=8pt},
  ylabel={\UnitaMoneta}, xlabel={Tempo (\UnitaTempo)},
  every axis y label/.style={at={(ticklabel* cs:1.0)}, anchor=south west, xshift=4pt, font=\small\color{ccACWP}},
  every axis x label/.style={at={(ticklabel* cs:1.0)}, anchor=west, xshift=8pt, font=\small\color{ccACWP}},
  legend style={at={(axis description cs:0,0)}, anchor=north west, yshift=-21mm, draw=ccGrid, font=\scriptsize, cells={anchor=west}, row sep=1pt, column sep=8pt, inner sep=4pt, legend columns=2},
  legend cell align=left,
]
% legenda
\addlegendimage{ccbcws}\addlegendentry{Pianificato a budget (BCWS)}
\addlegendimage{ccbcwp}\addlegendentry{Lavoro svolto a costi di budget (BCWP)}
\addlegendimage{ccacwp}\addlegendentry{Costo effettivamente sostenuto (ACWP)}
\CCprevisione{\addlegendimage{ccprev}\addlegendentry{Previsione dei costi fino a EAC}}{}
\addlegendimage{empty legend}\addlegendentry{\textbf{CV} = BCWP $-$ ACWP (scostamento costi)}
\addlegendimage{empty legend}\addlegendentry{\textbf{SV} = BCWP $-$ BCWS (scostamento tempi)}
\CCprevisione{\addlegendimage{empty legend}\addlegendentry{\textbf{EAC} = costo finale stimato}}{}
% curve
\CCdisegna{ccbcws}{pathBCWS}
\CCdisegna{ccbcwp}{pathbcwp}
\CCdisegna{ccacwp}{pathacwp}
\CCprevisione{\CCdisegna{ccprev}{pathPrev}}{}
% rilevamenti
\CCdisegnaRilevamento{A}{1}{0.93}
\edef\ccAlt{\fpeval{(\CCv{tB}-\CCv{tA})/\CCv{xmax} < 0.18 ? 0.80 : 0.93}}
\CCdisegnaRilevamento{B}{2}{\ccAlt}
% previsione: EAC e date di fine (se le due date sono vicine, le scritte si allontanano)
\def\ccAncP{north}\def\ccAncS{north}
\CCprevisione{%
  \ifdim\fpeval{abs(\CCv{fine}-\Durata)/\CCv{xmax}}pt<0.08pt
    \ifdim\fpeval{\CCv{fine}-\Durata}pt<0pt \def\ccAncP{north west}\def\ccAncS{north east}%
    \else \def\ccAncP{north east}\def\ccAncS{north west}\fi
  \fi}{}
\CCprevisione{%
  \node[ccriquadro] at (\CCv{fine},\CCv{eac}) {};
  \node[ccetichetta, anchor=west, xshift=4pt] at (\CCv{fine},\CCv{eac}) {EAC \mdseries\CCbreve{eac}};
  \draw[ccBCWS, line width=1pt, -{Stealth[length=5pt]}] ([yshift=-11mm]axis cs:\Durata,0) -- ([yshift=-6.5mm]axis cs:\Durata,0);
  \node[font=\scriptsize\bfseries, text=ccBCWS, anchor=\ccAncP, align=center] at ([yshift=-11mm]axis cs:\Durata,0) {Fine\\pianificata};
  \draw[ccACWP, line width=1pt, -{Stealth[length=5pt]}] ([yshift=-11mm]axis cs:\CCv{fine},0) -- ([yshift=-6.5mm]axis cs:\CCv{fine},0);
  \node[font=\scriptsize\bfseries, text=ccACWP, anchor=\ccAncS, align=center] at ([yshift=-11mm]axis cs:\CCv{fine},0) {Fine\\stimata};
}{}
\end{axis}
\end{tikzpicture}
\end{center}
\CCprevisione{}{\CCmotivo}

% ---------------------------------------------------------------------
% LEGENDA DEI PARAMETRI
% ---------------------------------------------------------------------
\section*{\large Legenda dei parametri}
\begin{small}
\begin{description}\setlength{\itemsep}{1pt}
  \item[BCWS] \emph{Budgeted Cost of Work Scheduled} -- pianificato a budget (baseline): quanto si doveva spendere fino a quel momento secondo il piano. Il valore finale è il budget totale (BAC).
  \item[BCWP] \emph{Budgeted Cost of Work Performed} -- lavoro svolto a costi di budget (\emph{earned value}): quanto vale, ai prezzi del piano, il lavoro davvero fatto.
  \item[ACWP] \emph{Actual Cost of Work Performed} -- costo effettivamente sostenuto per il lavoro fatto.
  \item[CV] \emph{Cost Variance} $=$ BCWP $-$ ACWP. Negativa: si è speso più del valore del lavoro svolto (sforamento dei costi).
  \item[SV] \emph{Schedule Variance} $=$ BCWP $-$ BCWS. Negativa: si è fatto meno lavoro del previsto (ritardo), espresso in denaro.
  \item[\%CV, \%SV] \%CV(\textit{t}) $=$ CV(\textit{t}) / BCWS(\textit{t}) e \%SV(\textit{t}) $=$ SV(\textit{t}) / BCWS(\textit{t}): andamento percentuale nel tempo (formule del libro).
  \item[CPI, SPI, EAC] \emph{Assunzioni, non nel libro}: CPI $=$ BCWP/ACWP, SPI $=$ BCWP/BCWS, costo finale stimato EAC $=$ BAC/CPI, fine stimata $=$ durata/SPI (calcolati all'ultimo rilevamento).
\end{description}
\end{small}

% ---------------------------------------------------------------------
% INDICATORI AI DUE RILEVAMENTI
% ---------------------------------------------------------------------
\section*{\large Indicatori ai due rilevamenti}
\begin{center}\small
\begin{tabular}{@{}l r r@{}}
\toprule
 & \textbf{Rilevamento 1} & \textbf{Rilevamento 2} \\
 & \UnitaTempoSingolare~\CCv{tA} & \UnitaTempoSingolare~\CCv{tB} \\
\midrule
Pianificato a budget (BCWS) & \CCsoldi{bcwsA} & \CCsoldi{bcwsB} \\
Lavoro svolto a costi di budget (BCWP) & \CCsoldi{bcwpA} & \CCsoldi{bcwpB} \\
Costo effettivamente sostenuto (ACWP) & \CCsoldi{acwpA} & \CCsoldi{acwpB} \\
\midrule
CV $=$ BCWP $-$ ACWP & \CCcolore{cvA}{\CCsegno{cvA}} & \CCcolore{cvB}{\CCsegno{cvB}} \\
SV $=$ BCWP $-$ BCWS & \CCcolore{svA}{\CCsegno{svA}} & \CCcolore{svB}{\CCsegno{svB}} \\
\%CV $=$ CV / BCWS & \CCcolore{cvA}{\CCperc{pcv}{A}} & \CCcolore{cvB}{\CCperc{pcv}{B}} \\
\%SV $=$ SV / BCWS & \CCcolore{svA}{\CCperc{psv}{A}} & \CCcolore{svB}{\CCperc{psv}{B}} \\
\midrule
CPI $=$ BCWP / ACWP \textit{(assunzione)} & \CCindice{cpiA} & \CCindice{cpiB} \\
SPI $=$ BCWP / BCWS \textit{(assunzione)} & \CCindice{spiA} & \CCindice{spiB} \\
\midrule
Stato & \CCsemaforo{A} & \CCsemaforo{B} \\
\bottomrule
\end{tabular}
\end{center}
\begin{small}
\textbf{Rilevamento 1} (\UnitaTempoSingolare~\CCv{tA}): \CCfrasi{A}\par
\textbf{Rilevamento 2} (\UnitaTempoSingolare~\CCv{tB}): \CCfrasi{B}\par
\CCprevisione{\textbf{Previsione} \textit{(assunzione, dal rilevamento 2)}: costo finale stimato EAC $=$ \num{\CCr{eac}} contro un budget di \num{\fpeval{round(\BAC,2)}}; fine stimata al \UnitaTempoSingolare~\num[round-precision=1,drop-zero-decimal=false]{\fpeval{round(\CCv{fine},1)}} contro \Durata~pianificati.\par}{}
\end{small}

% ---------------------------------------------------------------------
% TABELLA COSTI-TEMPI (generata dalla lista PianoCosti)
% ---------------------------------------------------------------------
\section*{\large Tabella costi-tempi}
{\footnotesize
% colonne a larghezza fissa: così basta una sola compilazione
\begin{longtable}{@{}>{\raggedright\arraybackslash}p{2.0cm} *{6}{>{\raggedleft\arraybackslash}p{2.1cm}}@{}}
\toprule
\textbf{Periodo} & \textbf{Costo pianificato} & \textbf{BCWS} & \textbf{BCWP} & \textbf{ACWP} & \textbf{CV} & \textbf{SV} \\
 & \textbf{nel periodo} & \textbf{cumulato} & & & & \\
\midrule
\endhead
\bottomrule
\endfoot
\CCrighe
\end{longtable}}
\vspace{-6pt}{\footnotesize Valori in \UnitaMoneta. BCWP, ACWP, CV e SV sono misurati solo ai due rilevamenti (righe evidenziate).}

% ---------------------------------------------------------------------
% NOTA SULLE FORMULE
% ---------------------------------------------------------------------
\section*{\large Nota sulle formule}
{\footnotesize
Formule del libro (pagg.~198--199): CV $=$ BCWP $-$ ACWP, SV $=$ BCWP $-$ BCWS, \%CV $=$ CV/BCWS, \%SV $=$ SV/BCWS. In letteratura la \%CV si calcola spesso su BCWP invece che su BCWS: qui si segue il libro.
Le curve passano esattamente per i valori inseriti (BCWP e ACWP: origine e due rilevamenti) con un'interpolazione cubica monotona (Fritsch--Butland), quindi non scendono mai.
Semaforo: \emph{in linea} se CV e SV non sono negativi; \emph{critico} se \%CV o \%SV sono sotto il $-10\%$ (soglia ipotizzata); altrimenti \emph{attenzione}.
Documento generato con CostCurve: per cambiare i dati modifica solo la sezione DATI del file .tex e ricompila.\par}

\end{document}
`;

  /** Genera il testo completo del file .tex a partire dal modello calcolato. */
  function genera(modello) {
    if (!modello || !modello.valido) throw new Error('Dati non validi: correggi gli errori prima di esportare.');
    const d = modello.dati;
    const ut = modello.unitaTempo, um = modello.unitaMoneta;
    const [r1, r2] = d.rilevamenti;
    const righeCosti = [];
    for (let i = 0; i < modello.costi.length; i += 10) {
      righeCosti.push('  ' + modello.costi.slice(i, i + 10).map(L).join(', '));
    }
    const oggi = new Date().toISOString().slice(0, 10);
    const intestazione = String.raw`% =====================================================================
% Diagramma costi-tempi (earned value) generato con CostCurve
% Data di creazione: ${oggi}
% ---------------------------------------------------------------------
% COME SI USA
%   1. Compila con pdflatex (oppure caricalo su Overleaf e premi "Recompile").
%   2. Per cambiare i dati modifica SOLO la sezione DATI qui sotto e
%      ricompila: grafico, tabelle, percentuali e frasi si aggiornano da soli.
%   Numeri: usa il PUNTO per i decimali (2.5) e nessun separatore delle
%   migliaia (540000, non 540.000).
% =====================================================================
\documentclass[a4paper,10pt]{article}

% =====================================================================
% === DATI (modifica solo questa parte) ===============================
% =====================================================================
% Titolo e nota (caratteri speciali come & % # _ vanno scritti \& \% \# \_)
\newcommand{\Titolo}{${testoLatex(modello.titolo)}}
\newcommand{\Nota}{${testoLatex(d.nota)}}
% Unità di misura (solo testo per le etichette)
\newcommand{\UnitaTempo}{${ut.plurale}}
\newcommand{\UnitaTempoSingolare}{${ut.singolare}}
\newcommand{\UnitaMoneta}{${um.asse}}
% Durata pianificata (numero di periodi) e budget totale (BAC)
\newcommand{\Durata}{${modello.durata}}
\newcommand{\BAC}{${L(modello.bac)}}
% Piano a budget: costo pianificato in ciascun periodo, separato da virgole
% (devono essere esattamente \Durata valori; il programma li cumula = BCWS)
\newcommand{\PianoCosti}{%
${righeCosti.join(',\n')}%
}
% Rilevamento 1: periodo (intero), BCWP e ACWP cumulati a quella data
\newcommand{\TempoA}{${r1.periodo}}
\newcommand{\BCWPA}{${L(r1.bcwp)}}
\newcommand{\ACWPA}{${L(r1.acwp)}}
% Rilevamento 2: periodo successivo al primo
\newcommand{\TempoB}{${r2.periodo}}
\newcommand{\BCWPB}{${L(r2.bcwp)}}
\newcommand{\ACWPB}{${L(r2.acwp)}}
% Previsione del costo finale (EAC) e della fine stimata: 1 = sì, 0 = no
\newcommand{\MostraPrevisione}{${d.mostraPrevisione ? 1 : 0}}
`;
    return intestazione + DISEGNO;
  }

  const api = { genera, testoLatex, nomeFile };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { radice.CC = radice.CC || {}; radice.CC.latex = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this);
