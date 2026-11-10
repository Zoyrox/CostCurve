# CostCurve — diagramma costi-tempi con export LaTeX

Sito web per il **project manager**: inserisci il piano a budget e i rilevamenti e ottieni subito
il diagramma costi-tempi (curve **BCWS**, **BCWP**, **ACWP**), la tabella, la legenda dei parametri,
gli indicatori **CV, SV, %CV, %SV**, il report PDF e il file **.tex** pronto da compilare.

Progetto di GPOI (Gestione Progetto e Organizzazione d'Impresa). Formule dal libro di testo, pagg. 198-199.

- **Apri il sito**: `index.html` (doppio clic, funziona anche offline) oppure il link di GitHub Pages.
- **Guida d'uso (1 pagina)**: [`documentazione/guida-uso.md`](documentazione/guida-uso.md)
- **Pianificazione del progetto**: [`documentazione/pianificazione/pianificazione.pdf`](documentazione/pianificazione/pianificazione.pdf) (copia modificabile `.odt`)
- **Progettazione**: [`documentazione/progettazione.md`](documentazione/progettazione.md)
- **Consegna, verifiche e domande**: [`documentazione/consegna.md`](documentazione/consegna.md)
- **Esempi di .tex compilati**: [`documentazione/esempio-tex/`](documentazione/esempio-tex/), compreso il grafico del libro ricreato

## Cosa fa

| Richiesta della consegna | Dove si trova |
|---|---|
| Diagramma con 3 curve e 2 monitoraggi | grafico del sito, PDF, file .tex (anche 1 solo rilevamento, se serve) |
| Tabella e legenda dei parametri | report sotto il grafico, PDF, file .tex |
| Calcolo percentuale dell'andamento | %CV e %SV per ogni rilevamento, con semaforo e frase |
| Output in formato .tex | pulsante **Esporta → File LaTeX** |
| Pianificazione con risorse e tempi | `documentazione/pianificazione/` |

In più:
- **Dati:** BCWP e ACWP si inseriscono ai rilevamenti oppure periodo per periodo, quindi qualunque grafico si può ricreare (anche quello del libro). La previsione si può calcolare o inserire a mano, e sull'asse ci possono essere le date reali.
- **Grafico:** zoom veritiero (pulsanti, Ctrl + rotellina, trascinamento, Maiusc + trascina, intervallo preciso, schermo intero), valori veri al passaggio del mouse, curve attivabili e proporzioni a scelta.
- **Esportazione:** report PDF, `.tex`, SVG o stampa, con la pagina del grafico verticale oppure orizzontale dedicata, la dimensione del grafico e la vista intera o zoomata.
- **Aspetto:** tema chiaro o scuro.
- **Versione 3:**
  - grafico disegnato sulla misura vera dello schermo, con cruscotto, legenda cliccabile e navigatore dello zoom;
  - modalità "solo grafico" su PC; su telefono schede Dati · Grafico · Risultati, gesti con le dita e grafico a tutto schermo in orizzontale;
  - note sul grafico, frase di sintesi da copiare, annulla e ripristina;
  - link da condividere, importazione da Excel/CSV ed esportazione CSV;
  - modalità presentazione e app installabile che funziona offline.

Il file .tex è **parametrico**: ha una sezione `DATI` (numeri da modificare) separata dalla sezione
`DISEGNO`, e tutti i calcoli (CV, SV, percentuali, curve, assi, tabelle) li fa LaTeX. Se cambi un numero
nei DATI e ricompili, cambia tutto il documento.

## Struttura dei file

```
index.html            la pagina del sito
css/                  stile.css (schermo), stampa.css (stampa / Salva come PDF)
js/numeri.js          numeri all'italiana (540.000; 15,7%)
js/calcoli.js         modello, formule, controlli, curve, assi (puro, senza pagina)
js/grafico.js         disegno SVG del diagramma
js/latex.js           generatore del file .tex
js/report.js          tabelle, legenda, frasi
js/pdf.js             report PDF (usa le librerie in vendor/)
js/importa.js         importazione da Excel/CSV ed esportazione CSV
js/presentazione.js   modalità presentazione
manifest.webmanifest, sw.js, icone/   app installabile (PWA), funziona offline
js/esempi.js          esempi precaricati
js/interfaccia.js     collega pagina, modello e output
vendor/               jsPDF 4.2.1 e svg2pdf.js 2.9.0 (MIT), inclusi: niente CDN
esempi/               progetti di esempio da aprire con "Apri progetto"
test/                 test automatici e casi di prova
strumenti/            script di verifica (browser, compilazione LaTeX, documenti)
documentazione/       pianificazione, progettazione, guida, consegna, esempi .tex
```

Gli script sono "classici" (non moduli ES) perché i browser bloccano i moduli ES quando la pagina
si apre con un doppio clic: così il sito funziona anche **offline** e senza server.
**Nessun dato lascia il browser**: il salvataggio automatico usa la memoria del browser e
"Salva progetto" scarica un file `.json` sul tuo computer.

## Verifiche (per chi sviluppa)

Servono Node.js; per le ultime due anche Playwright e pdflatex.

```bash
npm test
```

```bash
node strumenti/verifica-tex.mjs
```

```bash
node strumenti/prova-flusso.mjs test/output
```

Il primo esegue i test dei calcoli (esempio del libro, segni, interpolazione, casi limite).
Il secondo compila il .tex di ogni esempio e controlla che i numeri del PDF siano **identici** a quelli del sito.
Il terzo prova il sito in un browser vero (dati sbagliati, correzioni, download, salvataggio).

---

## Pubblicare il sito su GitHub Pages (guida per principianti)

GitHub Pages pubblica gratis i file del repository come sito web. Il sito non ha bisogno di server:
bastano i file così come sono.

### 1. Avere i file nel repository
- **Se il repository c'è già** (`zoyrox/costcurve`): il lavoro è sul branch
  `claude/gpoi-costi-tempi-site-ovbyzx`. Su GitHub apri il repository, compare il riquadro
  giallo *"Compare & pull request"*: cliccalo, poi **Create pull request** e **Merge pull request**.
  Così i file finiscono sul branch `main`.
- **Se parti da zero**: su github.com premi **+ → New repository**, scegli un nome (es. `costcurve`),
  spunta *Public* e premi **Create repository**. Poi **Add file → Upload files**, trascina **tutto il
  contenuto** della cartella (non la cartella stessa: `index.html` deve stare in cima) e premi
  **Commit changes**.

### 2. Attivare Pages
1. Nel repository apri **Settings** (in alto a destra).
2. Nel menu a sinistra scegli **Pages**.
3. In *Build and deployment → Source* scegli **Deploy from a branch**.
4. In *Branch* scegli **main** e la cartella **/ (root)**, poi **Save**.

### 3. Controllare il link
Dopo 1-2 minuti, in alto nella stessa pagina compare *"Your site is live at …"*.
Il link ha la forma `https://NOME-UTENTE.github.io/NOME-REPOSITORY/`
(qui: `https://zoyrox.github.io/costcurve/`). Aprilo da PC e da telefono.

### 4. Problemi comuni
- **Errore 404**: aspetta ancora un paio di minuti e ricarica. Controlla che `index.html` sia
  nella cartella principale del branch scelto (non dentro una sottocartella).
- **Pagina senza colori o grafico vuoto**: i file `css/` e `js/` non sono stati caricati, oppure sono
  in una sottocartella. Ricarica tutto il contenuto mantenendo le cartelle.
- **Vedo ancora la versione vecchia**: ricarica forzando (Ctrl+F5) o apri in una finestra anonima.
- **Repository privato**: con un account gratuito Pages funziona solo con repository pubblici.
- **Il file `.nojekyll`** serve a pubblicare i file così come sono: non cancellarlo.

## Licenze
Codice del progetto: MIT. Librerie incluse in `vendor/`: jsPDF e svg2pdf.js, licenza MIT (vedi `vendor/LEGGIMI.md`).
