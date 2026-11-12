# Crea relazione.docx (modificabile). Il PDF si ricava dal DOCX con LibreOffice,
# così i due file sono identici:
#   python3 genera_relazione.py
#   soffice --headless --convert-to pdf relazione.docx
from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor
import re

FONT = 'Calibri'
BLU, GRIGIO, VUOTO = '0B5CAD', 'B8BEC6', 'F1F3F5'

doc = Document()
sez = doc.sections[0]
sez.page_width, sez.page_height = Cm(21), Cm(29.7)
sez.left_margin = sez.right_margin = Cm(2.2)
sez.top_margin = sez.bottom_margin = Cm(2.2)

st = doc.styles['Normal']
st.font.name = FONT
st.font.size = Pt(11)
st.element.rPr.rFonts.set(qn('w:eastAsia'), FONT)
st.paragraph_format.space_after = Pt(6)
st.paragraph_format.line_spacing = 1.15


def testo(p, s, size=None, colore=None):
    """Aggiunge testo con **grassetto** e _corsivo_."""
    for parte in re.split(r'(\*\*.+?\*\*|_.+?_)', s):
        if not parte:
            continue
        if parte.startswith('**'):
            r = p.add_run(parte[2:-2]); r.bold = True
        elif parte.startswith('_') and parte.endswith('_') and len(parte) > 2:
            r = p.add_run(parte[1:-1]); r.italic = True
        else:
            r = p.add_run(parte)
        if size: r.font.size = Pt(size)
        if colore: r.font.color.rgb = RGBColor.from_string(colore)
    return p


def par(s, dopo=6, size=None, colore=None, keep=False):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(dopo)
    if keep: p.paragraph_format.keep_with_next = True
    return testo(p, s, size, colore)


def titolo(s):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(14)
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.keep_with_next = True
    r = p.add_run(s); r.bold = True
    return p


def sottotitolo(s):
    p = titolo(s)
    p.paragraph_format.space_before = Pt(6)
    p.paragraph_format.space_after = Pt(3)
    return p


def elenco(voci, numerato=False):
    for i, v in enumerate(voci, 1):
        p = doc.add_paragraph()
        p.paragraph_format.left_indent = Cm(1.1)
        p.paragraph_format.first_line_indent = Cm(-0.5)
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.tab_stops.add_tab_stop(Cm(1.1))
        p.add_run(f'{i}.\t' if numerato else '•\t')
        testo(p, v)
    doc.paragraphs[-1].paragraph_format.space_after = Pt(8)


def nuova_pagina():
    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)


def sfondo(cella, colore):
    tcPr = cella._tc.get_or_add_tcPr()
    sh = OxmlElement('w:shd')
    sh.set(qn('w:val'), 'clear'); sh.set(qn('w:color'), 'auto'); sh.set(qn('w:fill'), colore)
    tcPr.append(sh)


def bordi(tabella, dentro_bianco=False):
    """Tabella senza bordi (come nel documento di riferimento)."""
    tblPr = tabella._tbl.tblPr
    b = OxmlElement('w:tblBorders')
    for lato in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'):
        e = OxmlElement(f'w:{lato}')
        if dentro_bianco and lato in ('insideH', 'insideV'):
            e.set(qn('w:val'), 'single'); e.set(qn('w:sz'), '24'); e.set(qn('w:color'), 'FFFFFF')
        else:
            e.set(qn('w:val'), 'nil')
        b.append(e)
    tblPr.append(b)


def riga_non_spezzata(riga):
    trPr = riga._tr.get_or_add_trPr()
    e = OxmlElement('w:cantSplit'); trPr.append(e)


def linea_sopra(cella):
    tcPr = cella._tc.get_or_add_tcPr()
    tb = OxmlElement('w:tcBorders'); t = OxmlElement('w:top')
    t.set(qn('w:val'), 'single'); t.set(qn('w:sz'), '6'); t.set(qn('w:color'), '999999')
    tb.append(t); tcPr.append(tb)


def tabella(intest, righe, larghezze, size=11, destra=(), totale=False):
    t = doc.add_table(rows=1, cols=len(intest))
    t.alignment = WD_TABLE_ALIGNMENT.LEFT
    t.autofit = False
    bordi(t)
    for i, h in enumerate(intest):
        c = t.rows[0].cells[i]; c.text = ''
        r = c.paragraphs[0].add_run(h); r.bold = True; r.font.size = Pt(size)
    for riga in righe:
        cells = t.add_row().cells
        for i, v in enumerate(riga):
            cells[i].text = ''
            testo(cells[i].paragraphs[0], v, size)
    colonne(t, larghezze)
    for riga in t.rows:
        riga_non_spezzata(riga)
        for i, c in enumerate(riga.cells):
            for p in c.paragraphs:
                p.paragraph_format.space_after = Pt(3)
                p.paragraph_format.line_spacing = 1.05
                if i in destra: p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    # l'intestazione resta attaccata alla prima riga
    for p in t.rows[0].cells[0].paragraphs: p.paragraph_format.keep_with_next = True
    intera(t)
    if totale:
        for c in t.rows[-1].cells:
            linea_sopra(c)
            for r in c.paragraphs[0].runs: r.bold = True
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return t



def intera(t):
    """La tabella resta tutta sulla stessa pagina."""
    for riga in t.rows[:-1]:
        for c in riga.cells:
            for p in c.paragraphs:
                p.paragraph_format.keep_with_next = True


def colonne(t, cm):
    """Larghezze fisse delle colonne (Word e LibreOffice le rispettano)."""
    tblPr = t._tbl.tblPr
    lay = OxmlElement('w:tblLayout'); lay.set(qn('w:type'), 'fixed'); tblPr.append(lay)
    grid = t._tbl.tblGrid
    for i, gc in enumerate(grid.findall(qn('w:gridCol'))):
        gc.set(qn('w:w'), str(int(cm[i] * 567)))
    for riga in t.rows:
        for i, c in enumerate(riga.cells):
            c.width = Cm(cm[i])


def nota(s):
    t = doc.add_table(rows=1, cols=1)
    bordi(t)
    colonne(t, [16.6])
    c = t.rows[0].cells[0]
    tcPr = c._tc.get_or_add_tcPr()
    tb = OxmlElement('w:tcBorders'); l = OxmlElement('w:left')
    l.set(qn('w:val'), 'single'); l.set(qn('w:sz'), '18'); l.set(qn('w:color'), GRIGIO)
    tb.append(l); tcPr.append(tb)
    c.text = ''
    testo(c.paragraphs[0], s, 10.5, '333333')
    c.paragraphs[0].paragraph_format.space_after = Pt(2)
    riga_non_spezzata(t.rows[0])
    doc.add_paragraph().paragraph_format.space_after = Pt(2)


# ------------------------------------------------------------------ contenuto
p = doc.add_paragraph()
p.paragraph_format.space_after = Pt(14)
r = p.add_run('PROGETTO – COSTCURVE: DIAGRAMMA COSTI-TEMPI CON OUTPUT LATEX PARAMETRICO')
r.bold = True; r.font.size = Pt(20)

par('**Autore e project manager:** Matviy Kalistyy, classe 5C INF, materia GPOI – a.s. 2026/27', dopo=2)
par('**Periodo:** da venerdì 6 a giovedì 12 novembre 2026 (consegna)', dopo=2)
par('**Prodotto:** file .tex parametrico, report PDF e sito di supporto (zoyrox.github.io/CostCurve)')
par('La relazione segue, nell\'ordine, i 10 passi richiesti dal compito. L\'obiettivo non è descrivere il '
    'prodotto, ma il **ragionamento di gestione del progetto**: come ho capito le richieste, quali criticità ho '
    'individuato, come le ho trasformate in rischi, stime e pianificazione, e dove ho sbagliato.')

# 1 -----------------------------------------------------------------------------------------------
titolo('1. Conoscenza curricolare (libro, U4L3)')
par('La pagina del libro descrive il **controllo di un progetto con il diagramma costi-tempi** (earned value). '
    'Nel tempo si confrontano tre curve di costo cumulato:')
tabella(['Curva', 'Significato', 'Domanda a cui risponde'], [
    ['**BCWS**', 'costo pianificato a budget', 'quanto dovevo spendere fino a oggi secondo il piano?'],
    ['**BCWP**', 'valore a budget del lavoro svolto', 'quanto vale, ai prezzi del piano, il lavoro fatto?'],
    ['**ACWP**', 'costo effettivamente sostenuto', 'quanto ho speso davvero?'],
], [2.2, 6.0, 8.4])
par('A ogni monitoraggio si calcolano:', keep=True)
elenco([
    '**CV = BCWP − ACWP** (scostamento dei costi): se è negativo sto spendendo più del valore prodotto;',
    '**SV = BCWP − BCWS** (scostamento dei tempi): se è negativo sono in ritardo;',
    '**%CV = CV / BCWS** e **%SV = SV / BCWS**: l\'andamento in percentuale.',
])
par('**Tempo per capirlo:** circa 1 ora, perché la teoria occupa poche pagine. Il punto che conta per il progetto, '
    'però, non è “cos\'è” il diagramma ma **come si disegna**, e soprattutto come si disegna in LaTeX (passo 2).')

# 2 -----------------------------------------------------------------------------------------------
titolo('2. Analisi delle richieste')
par('Ho riscritto le richieste del compito una per una, separando ciò che è **scritto** da ciò che **serve '
    'capire** per eseguirlo:', keep=True)
tabella(['Richiesta scritta', 'Cosa implica per chi esegue'], [
    ['Diagramma costi-tempi con **due monitoraggi**', 'due istanti di controllo scelti dall\'utente, non a caso'],
    ['Curve BCWS, BCWP, ACWP', 'tre serie di dati cumulati per periodo'],
    ['Tabella e diagramma con **legenda dei parametri**', 'tabella dei valori, legenda delle curve, spiegazione dei simboli'],
    ['**Calcolo percentuale** dell\'andamento', '%CV e %SV a ogni monitoraggio'],
    ['**Output in formato .tex**', 'un sorgente LaTeX che si compila e disegna il grafico: tecnologia che non conoscevo'],
    ['Utilizzabile per **progetti futuri**', 'il .tex deve essere parametrico: si cambiano i dati, non il disegno'],
    ['Documentazione della pianificazione con **risorse** e **stima dei tempi**', 'WBS, stime per attività, Gantt, budget, rischi'],
    ['Tempi di consegna e **penali**', 'consegna giovedì 12 novembre; penali per ritardo (e, forse, per anticipo)'],
], [7.0, 9.6])
sottotitolo('La criticità principale: il formato .tex')
par('Una richiesta può essere scritta in italiano ma usare una terminologia che chi esegue non conosce: è il primo '
    'rischio, quello di **chiarezza e comprensione**. Nel mio caso “output in formato .tex” era esattamente questo. '
    'Non sapendo cosa comporta disegnare un grafico in LaTeX, **non potevo stimare** il lavoro: poteva richiedere '
    'un\'ora come settimane. Per questo la prima attività da pianificare non era studiare le curve, ma fare una '
    '**prova tecnica in LaTeX** per capire quanto costa disegnarle (attività A3 della pianificazione).')
par('Il secondo aspetto è che il .tex deve funzionare come un modulo da compilare: una struttura fissa (il '
    'disegno) e una zona in cui si inseriscono i valori (i dati). Chi lo riusa per un altro progetto deve sapere '
    'esattamente dove mettere i numeri.')

# 3 -----------------------------------------------------------------------------------------------
titolo('3. Domande sulle ambiguità')
par('Prima di pianificare ho annotato i punti non chiari. Per ognuno ho scritto l\'ipotesi adottata, in attesa di '
    'conferma:', keep=True)
tabella(['Domanda', 'Ipotesi adottata'], [
    ['“Output in formato .tex”: basta un file con i numeri già calcolati o deve ricalcolare tutto se cambio i dati?', 'Parametrico: sezione DATI separata dal DISEGNO, calcoli fatti da LaTeX'],
    ['I monitoraggi devono essere esattamente due o un numero qualsiasi?', 'Due, come scritto. Non generalizzo a N: costerebbe tempo non richiesto'],
    ['Dove si collocano i due monitoraggi?', 'Li sceglie l\'utente come dato di input, non sono fissi nel disegno'],
    ['Con quali dati si prova il lavoro?', 'Con l\'esempio numerico del libro, così i risultati sono verificabili'],
    ['“Legenda dei parametri”: legenda del grafico o spiegazione dei simboli?', 'Entrambe: legenda delle curve e tabella che spiega CV, SV, %CV, %SV'],
    ['%CV e %SV si calcolano su BCWS o su BCWP?', 'Su BCWS, come nel libro'],
    ['Serve uno strumento per inserire i dati o basta modificare il .tex a mano?', 'Il requisito è il .tex; uno strumento di inserimento è un mezzo, non un obbligo'],
    ['Esiste davvero una penale per la consegna in anticipo?', 'La considero valida: consegna esattamente il 12'],
], [9.2, 7.4], size=10.5)

# 4 -----------------------------------------------------------------------------------------------
titolo('4. In che misura è un progetto')
par('Un compito come “calcola 3 + 5” non è un progetto: si sa già come farlo, non ci sono incertezze né scelte da '
    'pianificare. Questo lavoro invece lo è, perché ha tutte le caratteristiche di un progetto:', keep=True)
elenco([
    '**obiettivo unico** e definito: un diagramma costi-tempi parametrico in LaTeX;',
    '**durata limitata**: dal 6 al 12 novembre;',
    '**vincoli** di tempo (una persona, al massimo 2-3 ore al giorno), di costo (nessuna spesa prevista) e di qualità;',
    '**incertezza**: una tecnologia mai usata (LaTeX), quindi una stima non immediata;',
    '**criticità** che possono diventare rischi.',
])
par('Una **criticità diventa un rischio** quando può avere un impatto sui **tempi** o sui **costi**. In questo '
    'progetto, dove all\'inizio non era prevista alcuna spesa, l\'impatto principale era sul tempo.')
par('Come progetto ha bisogno di: definizione dell\'obiettivo e dei requisiti, scomposizione in attività (WBS), '
    'stima dei tempi, calendario (Gantt), budget, analisi dei rischi, studio di fattibilità, controllo '
    'dell\'avanzamento e documentazione finale.')

# 5 -----------------------------------------------------------------------------------------------
nuova_pagina()
titolo('5. Pianificazione')
par('La pianificazione (documento separato, versione 1.0) è stata fatta nell\'ora iniziale di venerdì 6 novembre '
    'e poi aggiornata durante la settimana, come previsto dal compito. Qui riporto i punti essenziali.')
sottotitolo('Risorse e tariffe (ipotizzate)')
tabella(['Risorsa', 'Chi', 'Tariffa'], [
    ['Project management', 'io, nel ruolo di project manager', '40 €/h'],
    ['Consulenza (LaTeX, earned value)', 'assistente AI e verifiche sul libro', '50 €/h'],
    ['Esecuzione informatica', 'sviluppo e test (io con supporto AI)', '30 €/h'],
], [5.2, 8.4, 3.0], destra=(2,))
par('Le tariffe servono a valutare il **costo figurativo** delle ore; non sono soldi spesi.', size=10, colore='444444')
sottotitolo('Attività e stima dei tempi (stima bottom-up)')
tabella(['Id', 'Attività', 'Ore', 'Precedenze'], [
    ['A1', 'Avvio e analisi dei requisiti', '1', '—'],
    ['A2', 'Pianificazione (documento della prima ora)', '1,5', 'A1'],
    ['A3', '**Prototipo LaTeX (prova tecnica)**', '1,5', 'A1'],
    ['A4', 'Progettazione di interfaccia e dati', '1', 'A2, A3'],
    ['A5', 'Modulo di calcolo e test automatici', '1,5', 'A4'],
    ['A6', 'Generatore del file .tex', '2,5', 'A5'],
    ['A7', 'Anteprima del diagramma', '2', 'A5'],
    ['A8', 'Interfaccia, validazioni e salvataggio', '2', 'A7'],
    ['A9', 'Report PDF e stampa', '1', 'A8'],
    ['A10', 'Collaudo completo', '1,5', 'A6, A9'],
    ['A11', 'Pubblicazione', '0,5', 'A10'],
    ['A12', 'Guida d\'uso e consegna', '1', 'A11'],
    ['', 'Totale attività + riserva di 3 ore', '17 + 3', ''],
], [1.4, 9.6, 2.2, 3.4], destra=(2,), totale=True, size=10.5)
par('Il prototipo LaTeX (A3) parte il primo giorno, in parallelo alla pianificazione: è la criticità più grave, e '
    'conviene scoprire subito quanto costa, perché da A3 dipende la stima di A6. Ho fissato tre livelli di priorità '
    '(obbligatorio, consigliato, facoltativo): se il tempo manca si taglia dal basso.')
sottotitolo('Budget di base (costo figurativo delle ore)')
tabella(['Voce', 'Importo'], [
    ['Baseline delle attività (17 ore)', '605 €'],
    ['Riserva di gestione (3 ore di esecuzione)', '90 €'],
    ['Budget di base', '695 €'],
    ['Spesa in denaro prevista', '0 € (strumenti gratuiti)'],
], [10.0, 5.0], destra=(1,))

sottotitolo('Rischi (dalla pianificazione, gravità = probabilità × impatto, scala 1-3)')
tabella(['Rischio', 'P', 'I', 'Gravità', 'Risposta pianificata'], [
    ['LaTeX sconosciuto: non riuscire a scrivere un .tex parametrico che compila', '3', '3', '**9**', 'Prototipo A3 il primo giorno; consulenza'],
    ['Errori di compilazione o di disegno del .tex con certi dati', '2', '3', '6', 'Compilare automaticamente tutti i casi di prova'],
    ['Formule sbagliate (CV e SV invertiti, percentuale sulla base sbagliata)', '2', '3', '6', 'Test sull\'esempio numerico del libro'],
    ['Ritardo nella consegna (penale 2% al giorno)', '2', '3', '6', 'Priorità, riserva, prodotto congelato mercoledì sera'],
    ['Scope creep: aggiungere funzioni “belle” prima di finire quelle obbligatorie', '3', '2', '6', 'Prima tutto l\'obbligatorio, poi il resto'],
    ['Anteprima e .tex con numeri o aspetto diversi', '2', '2', '4', 'Un solo modello di calcolo per tutti gli output'],
    ['Problemi di pubblicazione online', '1', '2', '2', 'Prova in locale; consegna in zip come piano B'],
], [7.0, 0.8, 0.8, 1.6, 6.4], size=10)

# 6 -----------------------------------------------------------------------------------------------
titolo('6. Studio di fattibilità')
par('Il documento che serve a decidere se il progetto si può svolgere rispettando i vincoli è lo **studio di '
    'fattibilità**. Ho verificato le **condizioni necessarie** (senza le quali il progetto fallisce) e quelle '
    '**sufficienti** (che, insieme alle necessarie, ne garantiscono la riuscita).', keep=True)
tabella(['Condizione', 'Tipo', 'Al 6 novembre', 'Al 9 novembre'], [
    ['Formule chiare e verificate', 'Necessaria', 'Sì', 'Sì'],
    ['Saper produrre un .tex con pgfplots che compila', 'Necessaria', 'Da verificare (A3)', 'Sì, con l\'AI a pagamento'],
    ['Tempo disponibile ≥ tempo stimato (20 ore ≤ 21)', 'Necessaria', 'Sì, al limite', '**No**, con lo strumento gratuito'],
    ['Costo in denaro = 0 €', 'Vincolo', 'Sì', '**No**, se si vuole rispettare il tempo'],
    ['Browser, account GitHub, LaTeX online (Overleaf)', 'Necessaria', 'Sì', 'Sì'],
    ['Un solo modello di calcolo per sito, .tex e PDF', 'Sufficiente', 'Previsto', 'Sì'],
    ['Priorità rispettate e controllo dell\'avanzamento', 'Sufficiente', 'Previsto', 'In parte (vedi punto 9)'],
], [6.4, 2.4, 3.4, 4.4], size=10.5)
par('**Esito al 6 novembre:** fattibile, a condizione di superare la prova tecnica in LaTeX, con un margine di tempo '
    'molto stretto (20 ore su 21).')
par('**Esito al 9 novembre:** il 7 e l\'8 novembre ho provato a lavorare con un assistente AI gratuito, come '
    'previsto dal vincolo di costo zero. Il risultato non era soddisfacente e ho perso circa 4 ore. Con il tempo '
    'rimasto, **non era più possibile rispettare insieme** il vincolo di tempo, quello di costo e i requisiti.')

# 7 -----------------------------------------------------------------------------------------------
titolo('7. Soluzione alternativa')
par('Non potendo rispettare tutti i vincoli, ho confrontato tre alternative, ognuna delle quali altera un vincolo:',
    keep=True)
tabella(['Alternativa', 'Vincolo alterato', 'Conseguenza', 'Scelta'], [
    ['Spostare la consegna', 'Tempo', 'Impossibile: data fissa e penale del 2% al giorno', 'No'],
    ['Ridurre i requisiti (es. .tex non parametrico)', 'Qualità / ambito', 'Prodotto non conforme alla richiesta principale', 'No'],
    ['Abbonamento a un\'AI a pagamento (Claude, 25 € per un mese)', 'Costo: da 0 € a 25 €', 'Requisiti e data rispettati, spesa contenuta e fissa', '**Sì**'],
], [5.2, 3.4, 6.0, 2.0], size=10.5)
par('Ho scelto di **rilassare il vincolo di costo**, perché era l\'unico con un impatto limitato e prevedibile. È una '
    'revisione del piano (versione 1.1 del 9 novembre): la spesa passa da 0 € a 25 €.')

# 8 -----------------------------------------------------------------------------------------------
nuova_pagina()
titolo('8. Esecuzione')
sottotitolo('Gantt a consuntivo')
par('In **blu** il lavoro utile, in **grigio** il tentativo con l\'AI gratuita, poi abbandonato.', keep=True)
giorni = ['ven 6', 'sab 7', 'dom 8', 'lun 9', 'mar 10', 'mer 11', 'gio 12']
attivita = [
    ('A1-A2 Requisiti e pianificazione', 'b......'),
    ('Tentativo con AI gratuita', '.rr....'),
    ('A3 Prototipo LaTeX', '...b...'),
    ('A4-A9 Realizzazione (v1)', '...b...'),
    ('Revisione v2', '...bb..'),
    ('Revisione v3 (oltre la richiesta)', '....b..'),
    ('A10 Collaudo (PC e telefono)', '...bbb.'),
    ('A11-A12 Pubblicazione e consegna', '....bbb'),
]
g = doc.add_table(rows=1, cols=8)
bordi(g, dentro_bianco=True)
for i, h in enumerate(['Attività'] + giorni):
    c = g.rows[0].cells[i]; c.text = ''
    r = c.paragraphs[0].add_run(h); r.bold = True; r.font.size = Pt(9 if i else 11)
    if i: c.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
for nome, barre in attivita:
    cells = g.add_row().cells
    cells[0].text = ''; cells[0].paragraphs[0].add_run(nome).font.size = Pt(10.5)
    for k, ch in enumerate(barre, 1):
        cells[k].text = ''
        sfondo(cells[k], {'b': BLU, 'r': GRIGIO}.get(ch, VUOTO))
colonne(g, [6.4] + [1.45] * 7)
for riga in g.rows:
    riga_non_spezzata(riga)
    for i, c in enumerate(riga.cells):
        for p in c.paragraphs: p.paragraph_format.space_after = Pt(1)
intera(g)
doc.add_paragraph().paragraph_format.space_after = Pt(2)

tabella(['Fase', 'Previste', 'Effettive'], [
    ['Requisiti e pianificazione', '2,5', '2,5'],
    ['Tentativo con AI gratuita (non previsto)', '0', '4'],
    ['Realizzazione e revisioni', '11,5', '8'],
    ['Collaudo, pubblicazione e consegna', '3', '6'],
    ['Riserva', '3', '—'],
    ['Totale ore', '20', '20,5'],
], [9.0, 2.6, 2.6], destra=(1, 2), totale=True)
nota('Il totale è quasi uguale al previsto, ma la distribuzione no: le 4 ore perse sono state recuperate solo '
     'grazie all\'AI a pagamento, che ha ridotto il tempo di realizzazione. Lunedì 9 e martedì 10 ho superato le '
     '2-3 ore al giorno previste.')

sottotitolo('Revisioni del prodotto')
tabella(['Versione', 'Contenuto', 'Motivo', 'Richiesta?'], [
    ['v1', '.tex parametrico, calcoli, grafico, tabella, report PDF', 'Requisiti del compito', 'Sì'],
    ['v2', 'Dati per periodo, 1-2 monitoraggi, zoom fedele ai dati, export a scelta', 'Il .tex non permetteva di inserire i dati reali di un progetto', 'In parte'],
    ['v3', 'Grafico per telefono, cruscotto, presentazione, import da Excel, app installabile', 'Leggibilità su telefono, poi molte aggiunte', '**No**'],
    ['v3.0.1', 'Correzione di un errore di aggiornamento del sito', 'Difetto trovato dopo la pubblicazione', '—'],
], [1.8, 6.6, 5.6, 2.6], size=10.5)

f = doc.add_table(rows=2, cols=2)
bordi(f)
colonne(f, [12.2, 4.4])
f.rows[0].cells[0].paragraphs[0].add_run().add_picture('sito-pc.png', width=Cm(11.8))
f.rows[0].cells[1].paragraphs[0].add_run().add_picture('sito-telefono.png', width=Cm(4.1))
for c, s in zip(f.rows[1].cells, ['Figura 1 – Il sito con l\'esempio del libro.', 'Figura 2 – Il grafico sul telefono.']):
    c.text = ''; r = c.paragraphs[0].add_run(s); r.font.size = Pt(9); r.font.color.rgb = RGBColor(0x55, 0x55, 0x55)
for riga in f.rows:
    riga_non_spezzata(riga)
    for c in riga.cells: c.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
f.rows[0].cells[0].paragraphs[0].paragraph_format.keep_with_next = True

# 9 -----------------------------------------------------------------------------------------------
titolo('9. Conformità del prodotto alle specifiche')
tabella(['Specifica', 'Esito', 'Verifica'], [
    ['Diagramma con due monitoraggi', 'Conforme', 'Esempio del libro ricostruito'],
    ['Curve BCWS, BCWP, ACWP', 'Conforme', 'Grafico nel .tex compilato e nel PDF'],
    ['Tabella e legenda dei parametri', 'Conforme', 'Presenti nel .tex, nel PDF e nel sito'],
    ['%CV e %SV', 'Conforme', 'Valori uguali all\'esempio numerico del libro'],
    ['Output .tex parametrico', 'Conforme', 'Cambiando un dato nella sezione DATI e ricompilando, tutti i valori si aggiornano'],
    ['Sito e .tex danno gli stessi numeri', 'Conforme', '7 casi di prova, 0 differenze, 0 avvisi LaTeX'],
    ['Pianificazione con risorse e stime', 'Conforme', 'Documento di pianificazione (PDF e ODT)'],
    ['Consegna il 12 novembre', 'Conforme', '—'],
], [5.6, 2.2, 8.8], size=10.5)
sottotitolo('Oltre la richiesta: un errore di gestione')
par('Il prodotto consegnato fa **molto più di quanto richiesto**: un sito completo, tema scuro, modalità '
    'presentazione, importazione da Excel, app installabile. In un progetto andare oltre la richiesta è un **errore**, '
    'anche se il risultato è bello:')
elenco([
    'aumenta **tempi e costi** (martedì 10 è stato quasi interamente dedicato alla v3, non richiesta);',
    'aumenta il codice da verificare, e infatti un difetto è arrivato online (v3.0.1);',
    'il rischio “scope creep”, previsto nella pianificazione con gravità 6, **si è verificato**: la risposta '
    'pianificata (prima l\'obbligatorio, poi il resto) l\'ho rispettata solo in parte.',
])
par('Un\'osservazione onesta: avere a disposizione un\'AI potente mi ha permesso di **risolvere** il problema, ma '
    'il merito di gestione non sta nel prodotto. Sta nell\'aver capito prima la criticità del .tex, averla '
    'trasformata in un rischio stimato e aver deciso consapevolmente come rispondere quando il piano non reggeva.')

# 10 ----------------------------------------------------------------------------------------------
titolo('10. Consegna')
par('Giovedì 12 novembre consegno:', keep=True)
elenco([
    'il **file .tex parametrico** con un esempio già compilato in PDF;',
    'il **documento di pianificazione** (versione 1.0 del 6 novembre, aggiornata il 9);',
    'la **guida d\'uso** di una pagina;',
    'il link al **sito**: zoyrox.github.io/CostCurve;',
    'questa **relazione**.',
])

sottotitolo('Consuntivo dei costi')
tabella(['Voce', 'Previsto', 'Effettivo', 'Scostamento'], [
    ['Spesa in denaro (abbonamento AI)', '0 €', '25 €', '+25 €'],
    ['Ore di lavoro', '20 (con riserva)', '20,5', '+0,5'],
    ['di cui ore perse (tentativo gratuito)', '0', '4', '+4'],
], [7.6, 3.0, 2.6, 2.8], destra=(1, 2, 3), size=10.5)

sottotitolo('Valutazione critica')
elenco([
    '**Ho fatto bene** a mettere il prototipo LaTeX all\'inizio: era la criticità principale e lo studio di '
    'fattibilità dipendeva da lì.',
    '**Ho sbagliato** a non fissare un limite al tentativo con l\'AI gratuita (per esempio “se dopo 2 ore non '
    'funziona, cambio”): ho perso due giorni prima di rivedere il piano.',
    '**Ho sbagliato** ad andare oltre la richiesta con la v3: tempo e rischi in più senza un requisito che lo '
    'chiedesse.',
    '**Ho sbagliato** a non provare il sito pubblicato prima di chiudere la v3.',
    '**Limite che resta:** il codice è stato scritto dall\'AI e lo capisco nelle linee generali; la parte che '
    'conosco meglio, e che so modificare, è la sezione DATI del .tex.',
])

titolo('Conclusioni')
par('Il progetto è stato consegnato nei tempi e conforme alle specifiche, con uno scostamento di 25 € sui costi '
    'dovuto a una decisione presa consapevolmente con lo studio di fattibilità. La cosa più importante che ho imparato è '
    'che il valore di un progetto non si misura da quanto il prodotto è ricco, ma da quanto si è capito il '
    'problema prima di risolverlo: requisiti chiari, criticità riconosciute, rischi stimati e un piano che si '
    'aggiorna quando la realtà cambia.')

doc.core_properties.title = 'Relazione di progetto – CostCurve'
doc.core_properties.author = 'Matviy Kalistyy'
doc.save('relazione.docx')
print('DOCX creato: relazione.docx')
