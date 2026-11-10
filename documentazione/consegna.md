# Consegna: checklist, verifiche e domande del docente

**Data di consegna consigliata: venerdì 13 novembre 2026, al laboratorio.**
- Si consegna esattamente quel giorno, né prima né dopo: la penale di ritardo è del 2% al giorno e
  quella di anticipo del 5% al giorno, ancora da chiarire.
- Il lavoro è pronto dal 12: resta nel repository fino alla consegna.

## 1. Checklist rispetto alla consegna ufficiale

| Richiesta (.odt) | Stato | Dove |
|---|---|---|
| Diagramma costi-tempi con **due monitoraggi temporali** | ✅ | sito (anteprima), `.tex`, PDF |
| Curva dei costi **pianificati a budget** (BCWS) | ✅ | curva blu continua |
| Curva dei costi **erogati rispetto al budget** (BCWP) | ✅ | curva verde tratteggiata |
| Curva dei costi **effettivamente erogati** (ACWP) | ✅ | curva vermiglio tratto-punto |
| **Tabella** e diagramma completi di **legenda dei parametri** | ✅ | tabella costi-tempi, tabella indicatori, legenda (sito, PDF, `.tex`) |
| **Calcolo percentuale dell'andamento** | ✅ | %CV e %SV per ogni rilevamento, con frase e semaforo |
| **Output in formato .tex** | ✅ | pulsante "Scarica il file .tex"; esempi in `documentazione/esempio-tex/` |
| **Documentazione della pianificazione** con risorse (consulenza, project management, esecuzione informatica) e **stima dei tempi per attività** | ✅ | `documentazione/pianificazione/pianificazione.pdf` (+ `.odt`) |
| Tempi di consegna e penali | ✅ | sezione 8 della pianificazione |
| Prodotto "non statico" (richiesta del docente in lezione) | ✅ | il sito ricalcola tutto e il `.tex` ha la sezione DATI separata, con i calcoli fatti in LaTeX |

### Priorità della richiesta

**Obbligatorie: tutte fatte.**

**Consigliate: tutte fatte.**
- anteprima dal vivo;
- esempio del libro precaricato;
- validazione con messaggi semplici;
- salva/apri progetto;
- interpretazione a parole;
- responsive.

**Facoltative fatte:**
- curva a S automatica;
- CPI, SPI, EAC e fine stimata, dichiarati come assunzioni;
- download SVG;
- "Apri in Overleaf";
- PDF diretto con grafico vettoriale.

**Facoltativa non fatta (versione 1):** il tema scuro, poi aggiunto nella versione 2.


## 1b. Versione 2 (dopo la revisione con il project manager)

Richieste del project manager e cosa è stato fatto:

| Richiesta | Fatto |
|---|---|
| Poter ricreare **qualunque** grafico, anche quello del libro | BCWP/ACWP **per periodo**; **1 o 2** rilevamenti; piano come **totale progressivo**; previsione **inserita a mano**. Esempio "Grafico del libro" incluso. |
| **Zoom** per vedere meglio, restando veritiero | pulsanti − + ↺, Ctrl + rotellina, trascinamento, Maiusc + trascina (area), intervallo preciso, schermo intero; gli assi si ricalcolano e l'asse spezzato è segnalato (≈) |
| Grafico grande anche nel PDF, **a scelta** | finestra Esporta: pagina verticale oppure **orizzontale dedicata**, dimensione normale/grande/massima, vista intera o zoomata, proporzioni; vale per PDF, .tex e stampa |
| Stile meno "da AI", minimale e professionale | restyling completo: superfici neutre, un solo blu d'accento, font di sistema, niente decorazioni |
| Tema scuro | pulsante luna/sole, ricordato dal browser |
| Partenza da progetto vuoto (approvato) | riquadro "Inizia un nuovo progetto" con gli esempi a un clic |
| Date reali (facoltative) | data di inizio: le date compaiono sull'asse, nelle tabelle, nel PDF e nel .tex |
| Dati del resoconto (facoltativi) | project manager, azienda, data e commento nel report, nel PDF e nel .tex |
| Valori al passaggio del mouse | riquadro con i valori **veri** del periodo ("—" dove non rilevati) |
| Mostrare/nascondere le curve | menu "Mostra" (curve, frecce CV/SV, etichette), anche negli export |

### Verifiche della versione 2

| Prova | Risultato |
|---|---|
| Test automatici (`npm test`) | 23/23 superati (8 nuovi: dati per periodo, 1 rilevamento, piano cumulato, previsione manuale, zoom, date, compatibilità con i progetti salvati prima) |
| Sito ↔ `.tex` compilato (`strumenti/verifica-tex.mjs`) | 7 casi, fino a 33 valori ciascuno: **0 differenze**, 0 errori e 0 avvisi di LaTeX |
| Varianti del `.tex` | pagina orizzontale con dimensione massima, vista zoomata con asse spezzato, grafico alto senza BCWP, date, 2 e 120 periodi: tutte compilano senza avvisi |
| Flusso nel browser (`strumenti/prova-flusso.mjs`) | **24/24**: grafico del libro ricreato a mano, errori chiari, zoom con i 4 comandi, valori al passaggio del mouse, curve nascoste, export di .tex, PDF orizzontale e verticale, SVG, stampa, tema, salvataggio e apertura |
| Aspetto (`strumenti/prova-sito.mjs`) | PC chiaro e scuro, telefono: 0 errori in console, nessuno scorrimento orizzontale |
| PDF del sito e stampa | grafico vettoriale (0 immagini raster); pagina orizzontale dedicata quando scelta |

**Problemi trovati e risolti nella versione 2:**
- **Date:** "31 gennaio + 1 mese" dava marzo; ora dà fine febbraio.
- **Tacche dell'asse:** con passo 2,5 i decimali venivano tolti, ora sono giusti.
- **.tex in pagina orizzontale:** il grafico non ci stava; corretto lo spazio riservato.
- **Stampa orizzontale:** una pagina bianca iniziale in Chromium, risolta.
- **Tabella per periodo:** la riga del rilevamento era scomposta per un nome di stile in conflitto.
- **Etichetta EAC:** veniva tagliata al bordo del grafico.


## 1c. Versione 3 (visualizzazione e facilità d'uso)

Richiesta: il grafico "peccava" sul telefono e anche sul PC non si vedeva al massimo. Tutte le 19 migliorie proposte sono state approvate e fatte.

**Visualizzazione**
1. Grafico disegnato sulla misura vera dello schermo (scritte leggibili, tacche diradate, niente scorrimento laterale).
2. Legenda cliccabile fuori dal grafico.
3. Niente titolo ripetuto a schermo (resta negli export).
4. "Solo grafico" su PC.
5. Navigatore dello zoom.
6. Gesti sul telefono (due dita, un dito, tocco per i valori).
7. Telefono in orizzontale: grafico a tutto schermo.
8. Cartellini di CV/SV ed etichette che non si sovrappongono; versione compatta sugli schermi piccoli.

**Telefono**

9. Schede in basso: Dati, Grafico, Risultati.
10. Barra su una riga, con il menu ⋯.
11. App installabile (PWA), funziona offline.

**Utilità**

12. Cruscotto con 4 numeri e tendenza.
13. Frase di sintesi da copiare (anche nel report e nel PDF).
14. Link condivisibile (il progetto è dentro il link, compresso).
15. Importazione da Excel/CSV con anteprima.
16. Esportazione CSV.
17. Modalità presentazione.
18. Note sul grafico (anche nel PDF e nel .tex).
19. Annulla/ripristina.

| Verifica | Risultato |
|---|---|
| `npm test` | 28/28 (nuovi: note, sintesi, tendenza, importazione, CSV) |
| `strumenti/verifica-tex.mjs` | 7 casi, 0 differenze sito ↔ .tex, 0 avvisi LaTeX; .tex con note e caratteri speciali compila |
| `strumenti/prova-flusso.mjs` | **38/38** nel browser: legenda, navigatore, note, annulla/ripristina, cruscotto, sintesi, link (creazione e apertura), presentazione, importazione, CSV, oltre ai controlli precedenti |
| Telefono emulato (iPhone 13) | grafico intero nella schermata, tocco con i valori, schede, orizzontale a tutto schermo; nessun errore |
| App installabile | da un indirizzo web: service worker attivo, manifest con icone, il sito si riapre **senza rete** |

**Bug trovati e corretti:**
- **Menu "Altro":** le voci non facevano nulla, perché il menu bloccava i clic.
- **Link:** aperto nella stessa scheda, non veniva letto.
- **Etichette sovrapposte sul telefono:** etichette dei rilevamenti vicini, date di fine ed EAC.

## 2. Verifiche eseguite (Fase 5, versione 1)

| Prova | Risultato |
|---|---|
| Test automatici dei calcoli (`npm test`, 15 test) | 15/15 superati |
| Test 1 — libro, mese 10 (controllo a mano) | SV = 140.000 − 166.000 = **−26.000**; %SV = −26.000 / 166.000 = **−15,7%**; CV = 140.000 − 180.000 = **−40.000**; %CV = −40.000 / 166.000 = **−24,1%**. Il programma dà gli stessi valori. |
| Test 1 — mese 16 (dati inventati) | SV = 330.000 − 398.000 = −68.000 (−17,1%); CV = 330.000 − 420.000 = −90.000 (−22,6%) |
| Test 2 — curva a S di pag. 198 | BCWS cumulato 5, 10, 25, 55, 85, 120, 130, 140, 150: identico al libro |
| Test 3 — in anticipo e sotto budget | CV e SV positivi, segno +, valori verdi, frasi "In anticipo" e "Risparmio", semaforo verde |
| Test 4 — titolo `R&D 50% #1 _beta {x} ~ ^ \ $ "àèéìòù" € — prova 😀` | Il .tex compila e il titolo si stampa uguale. L'emoji viene tolta con un avviso. |
| Test 4 — 2 periodi, 120 periodi, 1 miliardo, decimali, senza previsione | tutti compilano; etichette brevi "mln"/"mld" nel grafico |
| Test 4 — campi vuoti, negativi, cumulati che calano, BCWP oltre il budget, rilevamenti coincidenti o invertiti | messaggio chiaro sul campo giusto, niente grafico finché non si corregge |
| Sito ↔ `.tex` compilato (`strumenti/verifica-tex.mjs`) | 7 casi, 17 valori ciascuno: **0 differenze**; 0 errori e 0 avvisi di LaTeX; compilazione unica |
| Sito nel browser (Chromium, `file://`, PC 1440 px e iPhone 13 emulato) | 0 errori in console, nessuno scorrimento orizzontale della pagina |
| Flusso completo nel browser (`strumenti/prova-flusso.mjs`) | 16/16 controlli superati: errori → correzione → curva a S → .tex, PDF e JSON scaricati → autosalvataggio → apri file |
| PDF del sito | 2 pagine A4, grafico **vettoriale** (0 immagini raster, testo selezionabile), accenti corretti |
| Stampa (media print) | 3 pagine A4, tabella non tagliata, intestazione ripetuta |

**Non verificato:**
- il pulsante "Apri in Overleaf": serve la connessione e un account Overleaf, quindi va provato a mano una volta;
- Firefox e Safari: provato solo Chromium;
- un telefono vero: provato solo in emulazione;
- la finestra di stampa reale del browser: provata la stampa emulata.

### Problemi trovati e risolti

| # | Problema | Soluzione |
|---|---|---|
| 1 | I browser bloccano i moduli ES aperti con doppio clic (`file://`) | script classici in un oggetto `CC`: funziona offline |
| 2 | pgfplots disegna gli elementi alla fine del grafico, quindi i valori del primo rilevamento venivano sovrascritti | valori "congelati" subito con `\edef` |
| 3 | Il motore matematico di TikZ si ferma a 16.383 | calcoli in `expl3` (`\fp_eval:n`), a doppia precisione |
| 4 | siunitx andava in errore su numeri con molte cifre (caso da 1 miliardo) | arrotondamento prima della stampa |
| 5 | **Doppio arrotondamento**: %CV +8,0% sul sito ma +8,1% nel .tex (Test 3), trovato dalla verifica automatica | un solo arrotondamento, alle cifre mostrate; arrotondamento robusto anche in JavaScript (1,005 → 1,01) |
| 6 | Etichette ACWP/BCWS/BCWP sovrapposte quando i valori sono vicini | algoritmo che le distanzia, uguale nei due mondi |
| 7 | Etichette di CV/SV sovrapposte con numeri lunghi; "Fine stimata/pianificata" attaccate | forma breve "193,8 mln"; scritte allontanate se le date sono vicine |
| 8 | longtable chiedeva una seconda compilazione | colonne a larghezza fissa |
| 9 | Grafico poco leggibile sul telefono | il grafico scorre dentro il suo riquadro |

## 3. Possibili domande del docente (con risposta)

**1. Quali sono le condizioni necessarie e sufficienti per la riuscita?**
- **Necessarie** (senza queste il progetto fallisce):
  - formule chiare e verificate;
  - un ambiente LaTeX con pgfplots;
  - un browser moderno;
  - tempo disponibile ≥ tempo stimato (20 ore con la riserva, contro 21 disponibili);
  - un account GitHub;
  - dati di input coerenti.
- **Sufficienti** (insieme alle necessarie):
  - un'unica fonte di verità, cioè un modello calcolato una volta da cui escono anteprima, .tex e PDF;
  - test superati;
  - priorità rispettate;
  - controllo dell'avanzamento con due rilevamenti e la riserva.

Ognuna ha la sua verifica (sezione 6 della pianificazione).

**2. Perché la %CV è calcolata su BCWS e non su BCWP?**
Perché il libro (pag. 199) definisce %CV(t) = CV(t) / BCWS(t). In letteratura spesso si usa BCWP:
lo scriviamo nella nota sulle formule. Cambiarla sarebbe una riga sia nel sito sia nel .tex.

**3. Se SV è in euro, come fa a misurare un ritardo?**
SV = BCWP − BCWS confronta il valore del lavoro fatto con quello che si doveva fare a quella data.
Se è negativo manca lavoro rispetto al piano, quindi si è in ritardo: la "quantità di ritardo" è
espressa con il valore del lavoro mancante. Per una stima in tempo usiamo SPI = BCWP / BCWS e la fine
stimata = durata / SPI, dichiarandole come assunzione.

**4. In che senso il file .tex non è statico?**
Ha due sezioni: DATI (macro con durata, budget, piano, valori dei rilevamenti) e DISEGNO.
Nel DISEGNO non ci sono numeri: LaTeX calcola CV, SV, percentuali, assi, curve, tabelle e frasi.
Lo abbiamo provato: cambiando a mano l'ACWP del rilevamento 1 da 180.000 a 130.000 e ricompilando,
la CV diventa +10.000 (+6,0%) in tabella, nel grafico e nelle frasi.

**5. Possono partire attività prima che la pianificazione sia finita? Ci sono rischi?**
Sì, ed è voluto: il prototipo LaTeX (A3) è partito il primo giorno, in parallelo alla pianificazione
(pianificazione a onde successive), perché LaTeX era il rischio più grave e conveniva scoprirlo subito.
Il rischio è la rilavorazione: l'abbiamo limitato con un prototipo usa e getta di mezz'ora e una
riserva di 3 ore.

**6. Lo zoom non "falsa" il grafico?**
No. Non è un ingrandimento dell'immagine: il programma ricalcola gli assi sull'intervallo scelto, con le
tacche vere, e taglia le curve ai bordi. Se l'asse dei costi non parte più da zero, il grafico lo
dichiara con il simbolo ≈ sull'asse e una riga nella legenda ("asse dei costi da 200.000"). La stessa
vista, se si sceglie, finisce identica nel PDF e nel .tex.
