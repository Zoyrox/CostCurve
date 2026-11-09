# Guida d'uso di CostCurve (1 pagina)

**A cosa serve.** Ottenere in pochi minuti il diagramma costi-tempi di un progetto, con le tre curve
del libro e i rilevamenti, poi la tabella, gli indicatori, il report PDF e il file LaTeX.
Non serve conoscere LaTeX.

## 1. Inserire i dati: 4 passi
1. **Progetto.** Titolo, unità di misura, durata pianificata e budget totale (BAC).
   - *Facoltativi:* la **data di inizio**, che fa comparire le date sull'asse ("ott 26").
   - *Facoltativi:* i **dati del resoconto**, cioè project manager, azienda, data e commento.
2. **Piano (BCWS).** Scegli come inserire il piano:
   - il **costo di ogni periodo**;
   - il **totale progressivo**, comodo se leggi i valori da un grafico.

   Puoi anche generare una curva a S dal budget, oppure incollare una colonna da Excel.
3. **Avanzamento.** Scegli **uno o due rilevamenti** e come inserire BCWP e ACWP:
   - **ai rilevamenti**: solo i valori in quei periodi;
   - **per periodo**: una tabella in cui scrivi i valori che conosci, e le curve passano per tutti.

   La **previsione** del costo finale (EAC) può essere:
   - **calcolata** con le formule, come assunzione;
   - **inserita da te**, scrivendo EAC e fine prevista;
   - **nessuna**.
4. **Risultati.** Semaforo, frasi e indicatori per ogni rilevamento.

Gli errori compaiono quando esci da un campo, e cliccando il messaggio vai al campo da correggere.
Il diagramma si aggiorna mentre scrivi.

## 2. Guardare meglio il grafico (zoom)
- **Pulsanti − e +:** riducono o ingrandiscono l'asse dei tempi. L'asse dei costi si adatta a ciò che si vede.
- **Ctrl + rotellina** (⌘ + rotellina su Mac): zoom attorno al punto del mouse.
- **Trascina** il grafico per spostarti. **Maiusc + trascina** per ingrandire un'area precisa.
- **Doppio clic** o il pulsante ↺ per tornare a tutto il progetto.
- **Intervallo:** scrivi esattamente da quale periodo a quale e, se vuoi, i limiti dei costi.
- **Mostra:** accendi o spegni le curve, le frecce CV/SV e le etichette, e scegli le **proporzioni**. Un grafico più alto rende più visibili le differenze verticali.
- **Schermo intero** con il pulsante ⛶.

Lo zoom è **veritiero**: gli assi vengono ricalcolati con le tacche vere. Se l'asse dei costi non
parte da zero, il grafico lo segnala con il simbolo ≈ sull'asse e una riga nella legenda.

Passando il mouse sul grafico vedi i valori **veri** del periodo. Dove un dato non è stato
rilevato compare "—": non vengono mai mostrati valori inventati.

## 3. Leggere CV e SV

| Indicatore | Formula | Se è negativo | Se è positivo |
|---|---|---|---|
| **CV**, scostamento costi | BCWP − ACWP | hai speso più del valore del lavoro fatto | hai risparmiato |
| **SV**, scostamento tempi | BCWP − BCWS | sei **in ritardo** | sei in anticipo |
| **%CV**, **%SV** | CV / BCWS, SV / BCWS | stesso significato, in percentuale | |

**Semaforo:**
- **✓ In linea**: CV e SV non sono negativi.
- **✕ Critico**: %CV o %SV sotto il −10% (soglia ipotizzata).
- **! Attenzione**: tutti gli altri casi.

## 4. Esportare (pulsante "Esporta" in alto)
Scegli:
- **il formato:** Report PDF, File LaTeX (.tex), Immagine SVG o Stampa;
- **la pagina del grafico:** verticale insieme al resto, oppure **orizzontale dedicata**;
- **la dimensione:** normale, grande o massima;
- **la parte:** tutto il progetto, oppure come lo vedi ora con lo zoom;
- **le proporzioni.**

Per il `.tex` puoi anche copiare il codice o aprirlo su Overleaf.

**Compilare il .tex:** su Overleaf fai *New Project → Upload Project* e poi **Recompile**. In
alternativa, con LaTeX installato, compila una volta sola:

```bash
pdflatex costi-tempi-nome-progetto.tex
```

Per cambiare i numeri senza il sito modifica solo la sezione `=== DATI ===`. Usa il punto
decimale e niente separatore delle migliaia. Poi ricompila.

## 5. Altro
- **Salva** e **Apri**: il progetto in un file `.json`. Il browser ricorda comunque l'ultimo progetto.
- **Esempi**: il grafico del libro (pag. 199), l'esempio numerico del libro e altri casi.
- **Luna e sole** in alto a destra: tema scuro o chiaro.
- I dati non lasciano mai il tuo computer, tranne se usi "Apri in Overleaf".
