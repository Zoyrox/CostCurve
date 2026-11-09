# CostCurve: progettazione (Fase 2)

Questo documento fissa le scelte tecniche **prima** di scrivere il codice.
Ogni decisione presa al posto dello studente è segnata con **[DECISIONE]**.

---

## 1. Schermate (wireframe testuale)

### PC e tablet orizzontale (≥ 1000 px)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ◣ CostCurve  Diagramma costi-tempi   [Esempi ▾] [Nuovo] [Apri] [Salva]       │
│   🔒 I dati restano nel tuo browser                                          │
├───────────────────────────────────┬──────────────────────────────────────────┤
│ ① Progetto ② Piano ③ Rilevamenti ④ Risultati │  ANTEPRIMA (sempre visibile) │
│ ───────────────────────────────── │  ┌──────────────────────────────────────┐│
│  campi del passo attivo           │  │  titolo                              ││
│  ogni campo:                      │  │  grafico SVG: 3 curve, 2 rilevam.,   ││
│   Etichetta (ACRONIMO)            │  │  frecce CV/SV, legenda a destra      ││
│   [ valore      ]                 │  └──────────────────────────────────────┘│
│   ⓘ Cosa scrivo qui? + esempio    │  ┌ Ril. 1 ───────┐ ┌ Ril. 2 ───────┐     │
│   ⚠ messaggio se c'è un problema  │  │ ✕ Critico     │ │ ! Attenzione  │     │
│                                   │  │ SV −15,7 %    │ │ ...           │     │
│        [◀ Indietro] [Avanti ▶]    │  └───────────────┘ └───────────────┘     │
├───────────────────────────────────┴──────────────────────────────────────────┤
│ REPORT (è anche quello che si stampa)                                        │
│  Tabella costi-tempi per periodo · Indicatori dei rilevamenti · Legenda       │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Telefono (< 1000 px)
La colonna si dispone in verticale: passi e campi, poi l'anteprima, poi il report.
Le schede dei passi diventano una barra scorrevole.

### I 4 passi
1. **Progetto**: titolo, unità di tempo (giorni, settimane, mesi), unità monetaria
   (euro, migliaia di euro), durata pianificata (n. periodi), budget totale (BAC).
2. **Piano a budget (BCWS)**: una riga per periodo con il *costo pianificato nel periodo*.
   Il programma mostra il cumulato. Pulsante facoltativo "Genera curva a S dal budget".
   Se la somma è diversa dal BAC compare un avviso con due correzioni in un clic.
3. **Rilevamenti**: due schede uguali con periodo del rilevamento, BCWS letto dal piano
   (sola lettura), BCWP e ACWP. Interruttore "Mostra la previsione (EAC)".
4. **Risultati**: semaforo e frase per ogni rilevamento; pulsanti **Scarica .tex**,
   **Scarica PDF**, **Stampa**, **Copia LaTeX**, **Apri in Overleaf**.

## 2. Modello dei dati (file JSON "Salva progetto")

```json
{
  "formato": "costcurve",
  "versione": 1,
  "titolo": "Esempio del libro (pag. 199)",
  "unitaTempo": "mesi",
  "unitaMoneta": "euro",
  "durata": 23,
  "bac": 540000,
  "costiPeriodo": [3000, 5000, "... un valore per periodo ..."],
  "rilevamenti": [
    { "periodo": 10, "bcwp": 140000, "acwp": 180000 },
    { "periodo": 16, "bcwp": 300000, "acwp": 370000 }
  ],
  "mostraPrevisione": true,
  "nota": "testo libero, es. 'dati inventati'"
}
```

- I valori sono nell'unità scelta (se l'unità è "migliaia di euro" si scrive 540, non 540000).
- **[DECISIONE]** Un rilevamento cade **a fine periodo** (numero intero da 1 alla durata).
  Così il BCWS del rilevamento si legge esattamente dal piano, senza approssimazioni,
  come nell'esempio del libro ("dopo 10 mesi").
- **[DECISIONE]** Modalità rapida: BCWP e ACWP sono noti solo ai due rilevamenti.
  Le curve passano per l'origine (0;0) e per i due punti. La modalità dettagliata
  per periodo è esclusa (facoltativa, fuori perimetro).

### Modello calcolato (una sola volta, da `calcola(dati)`)
Da questo oggetto derivano **anteprima SVG, tabelle, .tex e PDF**: è l'unica fonte di verità.

```
{
  dati,                         // dati normalizzati
  problemi: [{livello: 'errore'|'avviso', campo, messaggio}],
  valido,                       // false se c'è almeno un errore
  bcwsCum: [0, c1, c1+c2, ...], // indice = periodo
  rilevamenti: [{n, t, bcws, bcwp, acwp, cv, sv, pcv, psv, cpi, spi, stato, frasi}],
  previsione: {visibile, eac, durataPrevista, motivo},
  curve: {bcws, bcwp, acwp, previsione},   // segmenti di Bézier già calcolati
  assi:  {xmax, xstep, ymax, ystep}
}
```

## 3. Formule (libro, pagg. 198-199)

| Simbolo | Formula | Significato |
|---|---|---|
| BCWS(t) | Σ costi pianificati fino a t | quanto avrei dovuto spendere secondo il piano |
| BCWP(t) | dato | valore a budget del lavoro davvero svolto |
| ACWP(t) | dato | quanto ho davvero speso |
| CV | BCWP − ACWP | < 0: sforamento dei costi |
| SV | BCWP − BCWS | < 0: ritardo |
| %CV | CV / BCWS | come nel libro (in letteratura spesso CV / BCWP) |
| %SV | SV / BCWS | come nel libro |
| CPI | BCWP / ACWP | **[ASSUNZIONE]**, facoltativo |
| SPI | BCWP / BCWS | **[ASSUNZIONE]**, facoltativo |
| EAC | BAC / CPI | costo finale stimato **[ASSUNZIONE]** |
| Durata prevista | durata / SPI | fine stimata **[ASSUNZIONE]** |

La previsione usa l'**ultimo** rilevamento. Non viene disegnata se BCWP o ACWP valgono 0,
se la fine stimata cade prima del rilevamento o se supera 3 volte la durata pianificata.
In questi casi una frase spiega il motivo.

**Semaforo [DECISIONE]**: verde ✓ "In linea" se CV ≥ 0 e SV ≥ 0; rosso ✕ "Critico" se
%CV o %SV sono sotto −10%; altrimenti giallo ! "Attenzione". La soglia del 10% è un'assunzione.

## 4. Curve: interpolazione monotona (identica in JavaScript e in LaTeX)

Dati i nodi (xᵢ, yᵢ) con hᵢ = xᵢ₊₁ − xᵢ e dᵢ = (yᵢ₊₁ − yᵢ)/hᵢ:

- tangente al primo nodo: m₀ = 0 (partenza "piatta", tipica della curva a S);
- tangente all'ultimo nodo: mₙ = dₙ₋₁;
- tangenti interne (Fritsch–Butland): se dᵢ₋₁·dᵢ ≤ 0 allora mᵢ = 0, altrimenti
  mᵢ = 3(hᵢ₋₁ + hᵢ) / ((2hᵢ + hᵢ₋₁)/dᵢ₋₁ + (hᵢ + 2hᵢ₋₁)/dᵢ).

Ogni tratto è una cubica di Bézier con punti di controllo
(xᵢ + hᵢ/3, yᵢ + mᵢhᵢ/3) e (xᵢ₊₁ − hᵢ/3, yᵢ₊₁ − mᵢ₊₁hᵢ/3).
Con queste tangenti mᵢ/dᵢ ≤ 3, quindi per il teorema di Fritsch–Carlson la curva
**non scende mai e non oscilla**, e passa esattamente per i punti dati.
SVG e TikZ disegnano le stesse Bézier, quindi le curve sono identiche.

**Previsione (tratteggiata)**: da (t₂, ACWP₂) a (fine stimata, EAC), con la tangente
iniziale uguale alla pendenza dell'ultimo tratto di ACWP (limitata a 3 volte la pendenza
media) e la tangente finale 0: la curva "si appiattisce" verso l'EAC come nel grafico del libro.

## 5. Assi (stesso algoritmo in JavaScript e in LaTeX)

- `passoBello(v)`: 10ᵉ con e = ⌊log₁₀ v⌋, f = v/10ᵉ, passo = (1, 2, 2,5, 5 o 10)·10ᵉ.
- Asse y: massimo dei dati = max(BAC, ACWP, BCWP, EAC visibile); passo = passoBello(max/6);
  ymax = ⌈max·1,15/passo⌉·passo.
- Asse x: massimo = max(durata, fine stimata visibile); passo = il primo tra 1, 2, 5, 10,
  20, 50… ≥ max/12; xmax = max·1,14 (spazio a destra per le frecce).
- Frecce: SV a t + 0,045·xmax, CV a t + 0,10·xmax.

## 6. Il file .tex esportato

```
\documentclass[a4paper,10pt]{article}
... pacchetti standard: geometry, babel[italian], fontenc[T1], lmodern, xcolor,
    pgfplots (compat=1.18), booktabs, longtable, siunitx, xfp, array

% =========== DATI (modifica solo questa parte) ===========
\newcommand{\Titolo}{R\&D 50\% \#1 \_beta}
\newcommand{\UnitaTempo}{mesi}         \newcommand{\UnitaMoneta}{Euro}
\newcommand{\Durata}{23}               \newcommand{\BAC}{540000}
\newcommand{\PianoCosti}{3000, 5000, ...}   % costo pianificato per periodo
\newcommand{\TempoA}{10} \newcommand{\BCWPA}{140000} \newcommand{\ACWPA}{180000}
\newcommand{\TempoB}{16} \newcommand{\BCWPB}{...}    \newcommand{\ACWPB}{...}
\newcommand{\MostraPrevisione}{1}

% =========== DISEGNO (non modificare) ===========
calcoli in expl3 (\fp_eval:n, a doppia precisione decimale): BCWS cumulati,
CV, SV, %CV, %SV, CPI, SPI, EAC, durata prevista, assi, tangenti e Bézier,
controlli sui dati (\msg_error in italiano)
\begin{document}
  titolo · diagramma (pgfplots) · legenda dei parametri · tabella costi-tempi
  (longtable, generata dalla lista) · tabella indicatori · frasi di interpretazione
  · nota sulle formule
\end{document}
```

- **[DECISIONE]** I calcoli in LaTeX usano `\fp_eval:n` di expl3 (incluso nel kernel LaTeX),
  perché il motore matematico di TikZ si ferma a 16383 e non regge 540000.
- Numeri: punto decimale nel .tex; `siunitx` li stampa con virgola e separatore delle
  migliaia (anche a 4 cifre, come il sito).
- Caratteri speciali `& % _ # $ { } ~ ^ \` sostituiti con i comandi LaTeX corrispondenti;
  lettere accentate scritte in UTF-8 (supportate da pdflatex moderno). Caratteri non
  stampabili da pdflatex (es. emoji) vengono tolti con un avviso.

## 7. Struttura dei file

```
index.html                 pagina unica del sito
css/stile.css              aspetto a schermo
css/stampa.css             foglio per la stampa / "Salva come PDF"
js/numeri.js               lettura e scrittura dei numeri all'italiana
js/calcoli.js              modello, formule, validazioni, curve, assi (PURO, senza DOM)
js/grafico.js              disegno SVG dal modello
js/latex.js                generatore del file .tex dal modello
js/pdf.js                  report PDF (jsPDF + svg2pdf, inclusi in vendor/)
js/esempi.js               esempi precaricati
js/interfaccia.js          collegamento tra pagina, modello e output
vendor/                    librerie incluse (con licenza), nessun CDN
esempi/*.json              gli stessi esempi come file da "Apri progetto"
test/                      test automatici (Node) e casi di prova
documentazione/            pianificazione, progettazione, guida d'uso
strumenti/                 script di supporto (PDF dei documenti, verifiche)
```

**[DECISIONE] Script classici invece di moduli ES.** I browser bloccano i moduli ES
quando la pagina viene aperta con un doppio clic (`file://`), e uno dei requisiti è
"funziona anche offline aprendo i file". Ogni file resta un modulo separato, registrato
in un unico oggetto globale `CC` (`CC.calcoli`, `CC.grafico`, …). Il modulo dei
calcoli si carica anche in Node per i test automatici.

## 8. Design

- **Idea**: un quaderno di progetto, con carta calda, inchiostro blu notte e un solo
  colore d'accento. L'anteprima sta su un foglio a quadretti leggeri, come un disegno
  tecnico. Niente gradienti viola né card tutte uguali.
- **Font**: solo font di sistema (nessun font esterno). Titoli in serif (Charter, Georgia),
  interfaccia in `system-ui`, numeri con cifre tabellari.
- **Colori del grafico** (Okabe-Ito, adatti ai daltonici), distinti **anche per tratto**:

| Curva | Colore | Tratto |
|---|---|---|
| BCWS (pianificato) | blu #0072B2 | continuo |
| BCWP (lavoro svolto a budget) | verde-blu #009E73 | tratteggiato |
| ACWP (costo effettivo) | vermiglio #D55E00 | tratto-punto |
| Previsione verso EAC | vermiglio #D55E00 | puntinato |

- Riquadri azzurri sui punti, linee tratteggiate ai rilevamenti, frecce doppie CV e SV
  con il valore: lo stile del grafico del libro, ma con i nomi in italiano.
- **Accessibilità**: etichette `<label for>` su tutti i campi, focus visibile,
  tastiera, contrasto ≥ 4,5:1 per il testo, semaforo con icona e parola (non solo colore),
  `aria-live` sui messaggi, misure in `rem` (testo ridimensionabile).

## 9. Report PDF (due livelli)

1. **Stampa**: `css/stampa.css` nasconde l'interfaccia e stampa il report A4
   (titolo, grafico, tabelle, legenda, frasi). Funziona sempre.
2. **Scarica PDF**: jsPDF 4.2.1 + svg2pdf.js 2.9.0 (licenza MIT, file in `vendor/`).
   Il grafico viene convertito in **vettori** dallo stesso SVG dell'anteprima.

La pagina dichiara che il PDF del sito è un report del browser e che il PDF "ufficiale"
si ottiene compilando il .tex.
