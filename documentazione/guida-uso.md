# Guida d'uso di CostCurve (1 pagina)

**A cosa serve.** Ottenere in pochi minuti il diagramma costi-tempi di un progetto, con le tre curve
del libro, i due rilevamenti, la tabella, gli indicatori e il file LaTeX. Non serve conoscere LaTeX.

## 1. Inserire i dati: 4 passi
1. **Progetto.** Scrivi il titolo e scegli le unità di misura (mesi o settimane; euro o migliaia di euro).
   Poi inserisci la durata pianificata (numero di periodi) e il budget totale (BAC).
2. **Piano a budget (BCWS).** Per ogni periodo scrivi *quanto prevedi di spendere in quel periodo*.
   Il programma fa le somme. Scorciatoie:
   - **Genera una curva a S dal budget** crea un piano tipico, che poi puoi correggere;
   - puoi **incollare** una colonna di numeri copiata da Excel;
   - se la somma non coincide con il budget, un pulsante la sistema in un clic.
3. **Rilevamenti.** Per ognuno dei due rilevamenti indica il periodo e due valori cumulati, cioè
   dall'inizio del progetto. Il BCWS lo legge il programma dal piano.
   - **BCWP:** quanto vale *a prezzi di budget* il lavoro completato.
   - **ACWP:** quanto hai *speso davvero*.
4. **Risultati.** Leggi il semaforo e le frasi, poi scarica gli output.

Se un dato manca o è incoerente (per esempio un valore cumulato che diminuisce), il campo diventa
rosso e un messaggio spiega cosa correggere. Clicca il messaggio per andare al campo.

## 2. Leggere CV e SV

| Indicatore | Formula | Se è negativo | Se è positivo |
|---|---|---|---|
| **CV**, scostamento costi | BCWP − ACWP | hai speso più del valore del lavoro fatto | hai risparmiato |
| **SV**, scostamento tempi | BCWP − BCWS | sei **in ritardo**: hai fatto meno lavoro del previsto | sei in anticipo |
| **%CV**, **%SV** | CV / BCWS, SV / BCWS | stesso significato, in percentuale | |

SV è in euro, non in giorni: misura *il valore del lavoro che manca* rispetto al piano.
Nel diagramma la freccia **SV** va dal punto BCWS al punto BCWP, la freccia **CV** dal punto ACWP al punto BCWP.

**Semaforo:**

- **✓ In linea**: CV e SV non sono negativi.
- **✕ Critico**: %CV o %SV sono sotto il −10% (soglia ipotizzata).
- **! Attenzione**: tutti gli altri casi.

**Previsione** (facoltativa, è un'assunzione): costo finale stimato EAC = BAC / CPI e fine
stimata = durata / SPI, calcolati con l'ultimo rilevamento.

## 3. Scaricare e compilare il .tex

1. Passo 4 → **Scarica il file .tex**.
2. Su **Overleaf** (gratuito):
   1. *New Project → Upload Project*;
   2. carica il file;
   3. premi **Recompile**.

   In alternativa usa il pulsante **Apri in Overleaf**, che però invia il file a overleaf.com.
   Con LaTeX installato sul computer:

   ```bash
   pdflatex costi-tempi-nome-progetto.tex
   ```

   Basta compilare una volta sola.
3. Per cambiare i numeri senza il sito, apri il .tex e modifica **solo** la sezione
   `=== DATI (modifica solo questa parte) ===`:
   - nei numeri usa il punto decimale (es. 2.5);
   - non usare il separatore delle migliaia (scrivi 540000).

   Ricompila: grafico, tabelle, percentuali e frasi si aggiornano da soli.

## 4. Altri pulsanti
- **Scarica PDF**: report A4 creato dal browser, con il grafico vettoriale. Il PDF "ufficiale" è
  quello che si ottiene compilando il .tex.
- **Stampa / Salva come PDF**: la stampa del browser. Funziona sempre, anche senza librerie.
- **Salva progetto** e **Apri progetto**: un file `.json` per riprendere il lavoro.
  In più, il browser ricorda da solo l'ultimo progetto.
- **Carica esempio**: l'esempio del libro (pag. 199), la curva a S (pag. 198) e altri casi.
