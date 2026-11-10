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
r = p.add_run('PROGETTO – COSTCURVE: STRUMENTO WEB PER IL DIAGRAMMA COSTI-TEMPI')
r.bold = True; r.font.size = Pt(20)

titolo('1. Introduzione')
par('**Nome del progetto: CostCurve**')
par('**Project manager e autore:** Matviy Kalistyy, classe 5C INF, materia GPOI – a.s. 2026/27')
par('**Scopo del progetto**', keep=True)
par('Realizzare un **sito web** in cui un project manager inserisce i dati del proprio progetto e ottiene il '
    '**diagramma costi-tempi** (curve BCWS, BCWP e ACWP), gli scostamenti **CV** e **SV** anche in percentuale '
    'per uno o due monitoraggi, la tabella dei valori, un **report PDF** e un **file LaTeX (.tex)** parametrico.')
par('Ho lavorato da solo, nel ruolo di project manager, usando un assistente di intelligenza artificiale come '
    'sviluppatore. Io ho definito requisiti, priorità e scelte, e ho collaudato il prodotto. Il codice è stato '
    'scritto dall\'AI. Lo dichiaro subito perché condiziona sia i rischi sia la valutazione critica (sezioni 12 e 14).')
par('Il sito è pubblicato su **GitHub Pages**: **zoyrox.github.io/CostCurve**.')

titolo('2. Motivazioni e bisogni')
par('Il diagramma costi-tempi studiato in classe (libro di testo, pagg. 198-199) è facile da capire ma lento da '
    'costruire. A mano o in Excel bisogna cumulare i costi periodo per periodo, disegnare tre curve e misurare gli '
    'scostamenti. È facile sbagliare, e se il grafico è piccolo le differenze non si leggono.')
par('Lo strumento doveva quindi:', keep=True)
elenco([
    'partire dai dati che un project manager ha davvero (piano dei costi e valori rilevati);',
    'applicare le formule del libro senza calcoli a mano;',
    'mostrare un grafico ingrandibile senza deformare i dati;',
    'produrre documenti da consegnare (PDF e .tex);',
    'essere gratuito da usare e da pubblicare, anche da telefono.',
])

titolo('3. Obiettivi del progetto')
par('L\'obiettivo principale è **pubblicare entro giovedì 12 novembre un sito che, dati il piano e i rilevamenti, '
    'produca il diagramma costi-tempi e il resoconto**. Gli obiettivi specifici sono:', keep=True)
elenco([
    'studiare formule e grafico del libro;',
    'scrivere un documento dei requisiti (brief) per l\'AI;',
    'restare entro 2-3 ore di lavoro al giorno;',
    'spendere il meno possibile (obiettivo iniziale: 0 €);',
    'realizzare calcoli, grafico, tabella, report PDF e file .tex;',
    'verificare che sito e .tex diano gli stessi numeri;',
    'pubblicare e collaudare su PC e telefono.',
], numerato=True)

titolo('4. Requisiti di alto livello')
elenco([
    'inserimento guidato dei dati (Progetto, Piano, Avanzamento, Risultati);',
    'piano come costo per periodo o come totale progressivo;',
    'uno o due rilevamenti con BCWP e ACWP;',
    'CV = BCWP − ACWP, SV = BCWP − BCWS, %CV = CV / BCWS, %SV = SV / BCWS;',
    'grafico con le tre curve, frecce di CV e SV, legenda e previsione del costo finale;',
    'zoom veritiero, sul sito e (a scelta) nel PDF;',
    'esportazione in PDF, LaTeX, SVG, stampa e CSV;',
    'uso comodo da telefono;',
    'dati salvati solo sul dispositivo dell\'utente;',
    'pubblicazione gratuita.',
])

titolo('5. Metodo di lavoro e scelta dello strumento AI')
sottotitolo('Primo tentativo: AI gratuita (7-8 novembre)')
par('Il piano iniziale prevedeva **costo zero**, quindi il 7 e l\'8 novembre ho provato con un assistente AI '
    'gratuito. Il risultato non mi ha soddisfatto e ho deciso di cambiare strumento. In due sessioni ho perso circa '
    '4 ore senza ottenere un risultato riutilizzabile.')
sottotitolo('Decisione: abbonamento a pagamento (9 novembre)')
par('Il 9 novembre ho valutato due alternative:', keep=True)
elenco([
    'restare sull\'AI gratuita e ridurre i requisiti;',
    'spendere 25 € per un mese di abbonamento a **Claude** e mantenere i requisiti.',
], numerato=True)
par('Con 3 giorni rimasti, ho scelto la seconda strada: 25 € erano accettabili, mentre perdere altri giorni avrebbe '
    'messo a rischio la consegna. È stata una **modifica del piano dei costi**: lo scostamento è spiegato nella '
    'sezione 13.')
sottotitolo('Ciclo di lavoro')
elenco([
    '**Richiesta:** descrivo cosa voglio ottenere e i vincoli.',
    '**Proposte:** chiedo più soluzioni, senza che vengano applicate.',
    '**Decisione:** scelgo quali approvare, modificare o scartare.',
    '**Realizzazione:** l\'AI scrive il codice e le prove automatiche.',
    '**Collaudo:** provo il sito su PC e telefono con i dati del libro.',
    '**Correzioni:** segnalo i problemi e il ciclo riparte.',
], numerato=True)
par('Ho fissato una regola: nessuna modifica va online senza il mio OK. Ogni versione è passata da una pull request '
    'su GitHub che ho approvato io.')

sottotitolo('Decisioni principali')
tabella(['Data', 'Decisione o segnalazione', 'Conseguenza'], [
    ['7-8 nov', 'Tentativo con AI gratuita, poi abbandonato', 'Circa 4 ore perse, piano dei costi rivisto'],
    ['9 nov', 'Acquisto dell\'abbonamento (25 €) e brief completo: formule e grafico del libro, dati di prova, vincolo di tempo', 'Prima versione completa in giornata'],
    ['9 nov', 'Il .tex deve essere parametrico e compilabile da solo', 'I numeri si cambiano in un\'unica sezione DATI'],
    ['9 nov', 'Collaudo della v1: non si potevano inserire i dati reali di un project manager e il grafico del libro non era ricreabile', 'Versione 2: dati per periodo, 1-2 rilevamenti, previsione manuale'],
    ['9 nov', 'Zoom solo se “veritiero al 100%”; stile più sobrio; tema chiaro/scuro', 'Assi ricalcolati, simbolo ≈, restyling'],
    ['10 nov', 'Il grafico era poco leggibile sul telefono e non sfruttava lo schermo del PC', 'Versione 3: grafico a misura di schermo, schede da telefono'],
    ['10 nov', 'Approvate tutte le 19 migliorie proposte', 'Più funzioni, ma anche più codice da verificare (vedi rischi)'],
    ['10 nov', 'Dopo la pubblicazione il sito appariva “rotto” sul mio browser', 'Correzione della cache (v3.0.1)'],
], [2.0, 8.4, 6.2])

titolo('6. Stakeholder')
tabella(['Stakeholder', 'Ruolo'], [
    ['Io', 'Project manager, committente e collaudatore'],
    ['Professore di GPOI', 'Cliente finale e valutatore'],
    ['Compagni di classe', 'Possibili utilizzatori'],
    ['AI gratuita (scartata)', 'Primo fornitore valutato, non adeguato'],
    ['Claude (Anthropic)', 'Fornitore a pagamento: codice, prove automatiche, bozze dei documenti'],
    ['GitHub', 'Archivio del codice, versioni e hosting gratuito'],
    ['Overleaf', 'Compilazione online del file .tex'],
], [4.6, 12.0])

titolo('7. Deliverable')
elenco([
    '**Pianificazione:** brief, pianificazione (WBS, calendario, baseline, rischi), progettazione.',
    '**Prodotto:** sito pubblicato, report PDF, file .tex parametrico con esempi compilati.',
    '**Chiusura:** guida d\'uso, checklist di consegna, questa relazione.',
])

nuova_pagina()
titolo('8. WBS – Work Breakdown Structure')
wbs = """1. COSTCURVE
├── 1.1 Avvio
│     ├── 1.1.1 Studio di formule e grafico (pagg. 198-199)
│     └── 1.1.2 Scelta dello strumento AI (tentativo gratuito, poi abbonamento)
├── 1.2 Pianificazione e progettazione
│     ├── 1.2.1 Brief per l'AI
│     ├── 1.2.2 WBS, calendario e rischi
│     └── 1.2.3 Scelta della tecnologia (sito statico, hosting gratuito)
├── 1.3 Realizzazione v1
│     ├── 1.3.1 Calcolo di curve e indicatori
│     ├── 1.3.2 Generatore del file .tex
│     └── 1.3.3 Interfaccia, grafico e report PDF
├── 1.4 Versione 2 (dati reali, zoom, stile)
├── 1.5 Versione 3 (telefono, PC, funzioni aggiuntive)
├── 1.6 Test
│     ├── 1.6.1 Prove automatiche dei calcoli
│     ├── 1.6.2 Confronto sito ↔ .tex
│     └── 1.6.3 Prove su PC e telefono
└── 1.7 Chiusura
      ├── 1.7.1 Pubblicazione su GitHub Pages
      ├── 1.7.2 Documentazione
      └── 1.7.3 Consegna"""
for i, riga in enumerate(wbs.split('\n')):
    p = doc.add_paragraph(riga)
    p.paragraph_format.space_after = Pt(1)
    p.paragraph_format.keep_with_next = True

titolo('9. Gantt (consuntivo)')
par('Finestra disponibile: da venerdì 6 a giovedì 12 novembre (consegna), al massimo 2-3 ore al giorno. In '
    '**blu** il lavoro utile, in **grigio** il tentativo con l\'AI gratuita, poi abbandonato.', keep=True)
giorni = ['ven 6', 'sab 7', 'dom 8', 'lun 9', 'mar 10', 'mer 11', 'gio 12']
attivita = [
    ('1.1.1 Studio di formule e grafico', 'b......'),
    ('1.1.2 Tentativo con AI gratuita', '.rr....'),
    ('1.2 Brief, piano e progettazione', '...b...'),
    ('1.3 Realizzazione v1', '...b...'),
    ('1.4 Versione 2', '...bb..'),
    ('1.5 Versione 3', '....b..'),
    ('1.6 Test (PC e telefono)', '...bbb.'),
    ('1.7 Chiusura e consegna', '....bbb'),
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

tabella(['Fase', 'Ore'], [
    ['Studio di formule e grafico del libro', '2'],
    ['Tentativo con AI gratuita (lavoro perso)', '4'],
    ['Brief, piano e progettazione', '2,5'],
    ['Realizzazione v1, v2 e v3 (richieste, scelte, controllo)', '6'],
    ['Test su PC e telefono', '3'],
    ['Chiusura, documentazione e consegna', '3'],
    ['Totale', '20,5 ore'],
], [10.5, 2.5], destra=(1,), totale=True)
nota('Il lavoro reale si è concentrato tra il 9 e il 10 novembre, oltre le 2-3 ore al giorno previste: è stato il '
     'prezzo dei due giorni persi. Sul totale il limite è rispettato (20,5 ore su un massimo di circa 21 nei 7 '
     'giorni disponibili), ma la distribuzione no.')

titolo('10. Iterazioni del prodotto')
tabella(['Versione', 'Contenuto', 'Motivo'], [
    ['**v1**', 'Calcolo delle curve, grafico, tabella, report PDF, .tex, pubblicazione', 'Brief iniziale'],
    ['**v2**', 'Dati per periodo, 1-2 rilevamenti, previsione manuale, zoom veritiero, nuovo stile, tema scuro', 'La v1 non rispondeva al bisogno reale: brief incompleto'],
    ['**v3**', 'Grafico a misura di schermo, schede da telefono, gesti, cruscotto, sintesi, note, link, Excel/CSV, presentazione, app installabile', 'Leggibilità scarsa su telefono e PC'],
    ['**v3.0.1**', 'Il browser non usa più file vecchi dopo un aggiornamento', 'Errore visibile solo sul sito pubblicato'],
], [2.0, 9.4, 5.2])

f = doc.add_table(rows=2, cols=2)
bordi(f)
colonne(f, [12.2, 4.4])
f.rows[0].cells[0].paragraphs[0].add_run().add_picture('sito-pc.png', width=Cm(11.8))
f.rows[0].cells[1].paragraphs[0].add_run().add_picture('sito-telefono.png', width=Cm(4.1))
for c, s in zip(f.rows[1].cells, ['Figura 1 – CostCurve su PC con l\'esempio del libro.', 'Figura 2 – La scheda “Grafico” sul telefono.']):
    c.text = ''; r = c.paragraphs[0].add_run(s); r.font.size = Pt(9); r.font.color.rgb = RGBColor(0x55, 0x55, 0x55)
for riga in f.rows:
    riga_non_spezzata(riga)
    for c in riga.cells: c.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
f.rows[0].cells[0].paragraphs[0].paragraph_format.keep_with_next = True

titolo('11. Test e controllo qualità')
tabella(['Verifica', 'Risultato'], [
    ['Prove automatiche dei calcoli', '28 su 28 superate'],
    ['Numeri del sito confrontati con il .tex compilato', '7 casi, 0 differenze'],
    ['Prova completa nel browser', '38 controlli su 38'],
    ['Esempio numerico del libro (pag. 199)', 'Valori coincidenti con quelli del libro'],
    ['Prove su telefono (verticale e orizzontale)', 'Superate: grafico, schede, gesti, schermo intero'],
    ['App installata, senza rete', 'Funzionante'],
], [9.0, 7.6])
nota('Le prove automatiche le ha scritte la stessa AI che ha scritto il codice: un errore di interpretazione delle '
     'formule potrebbe trovarsi in entrambi. Per questo il confronto con i valori dell\'esempio del libro è la '
     'verifica più importante, non i numeri “28/28” e “38/38”.')
par('**Difetti trovati in collaudo:**', keep=True)
elenco([
    'il grafico di esempio del libro non era ricreabile nella v1;',
    'sul telefono il grafico finiva fuori dallo schermo e le etichette si sovrapponevano;',
    'le voci del menu “⋯” non rispondevano ai clic;',
    '**un difetto è arrivato online:** dopo la pubblicazione della v3 il browser mescolava file nuovi e vecchi. '
    'Mancava una prova sul sito pubblicato prima di considerare chiusa la versione.',
])

nuova_pagina()
titolo('12. Analisi dei rischi')
par('Seguendo l\'impostazione del libro: probabilità e impatto, poi la valutazione. La colonna “Esito” indica se il '
    'rischio si è verificato davvero.', keep=True)
tabella(['Rischio', 'Prob.', 'Impatto', 'Valut.', 'Prevenzione / risposta', 'Esito'], [
    ['Strumento gratuito non adeguato', 'Alta', 'Alto', 'Alto', 'Alternativa a pagamento con un tetto di spesa (1 mese)', '**Verificato:** 4 ore perse, +25 €'],
    ['Calcoli sbagliati dall\'AI, non riconosciuti da me', 'Media', 'Alto', 'Alto', 'Formule del libro nel brief, confronto con l\'esempio numerico del libro, sito ↔ .tex', 'Non verificato finora'],
    ['Requisiti incompleti o capiti male', 'Alta', 'Medio', 'Alto', 'Collaudo subito dopo la v1, iterazioni brevi', '**Verificato:** v1 da rifare in parte'],
    ['Tempo insufficiente dopo il ritardo iniziale', 'Media', 'Alto', 'Alto', 'Concentrare il lavoro il 9-10 novembre, tenere 11-12 come margine', 'Assorbito, con giorni più lunghi'],
    ['Aggiunta continua di funzioni (scope creep)', 'Media', 'Medio', 'Medio', 'Proposte solo dopo il collaudo, approvazione esplicita', 'Parzialmente verificato: 19 migliorie in un colpo'],
    ['Difetti visibili solo online', 'Media', 'Medio', 'Medio', 'Prova del sito pubblicato dopo ogni rilascio', '**Verificato:** cache, corretto in v3.0.1'],
    ['Codice che non so modificare da solo', 'Alta', 'Medio', 'Alto', 'Codice commentato in italiano, guida d\'uso, .tex modificabile solo nella sezione DATI', 'Rischio ancora aperto'],
    ['Fine dell\'abbonamento prima della consegna', 'Bassa', 'Medio', 'Basso', 'Tutto il codice su GitHub, il sito non dipende dall\'AI per funzionare', 'Non verificato'],
    ['Problemi su browser per PC diversi da Chrome', 'Media', 'Basso', 'Medio', 'Tecnologie web standard, nessuna libreria esterna online', 'Aperto: non provati in modo sistematico'],
], [3.4, 1.4, 1.5, 1.4, 5.0, 3.9], size=9.5)
par('**Rischi più importanti.**', keep=True)
elenco([
    '**Calcoli sbagliati non riconosciuti.** È l\'unico rischio che renderebbe inutile il prodotto, e il controllo '
    'dipende dalle mie conoscenze delle formule.',
    '**Codice che non so modificare da solo.** È il rischio che resta aperto dopo la consegna: oggi non saprei '
    'correggere da solo un errore complesso nel codice del grafico.',
])

titolo('13. Budget di progetto')
par('**Preventivo iniziale** (6 novembre, con AI gratuita)', keep=True)
tabella(['Voce', 'Best case', 'Most likely', 'Worst case'], [
    ['Strumento AI', '€ 0', '€ 0', '€ 25'],
    ['Hosting (GitHub Pages)', '€ 0', '€ 0', '€ 0'],
    ['Dominio personalizzato', '€ 0', '€ 0', '€ 12'],
    ['Software (editor, LaTeX, Overleaf)', '€ 0', '€ 0', '€ 0'],
    ['Hardware (PC e telefono già posseduti)', '€ 0', '€ 0', '€ 0'],
    ['Totale', '€ 0', '€ 0', '€ 37'],
], [7.6, 2.6, 2.8, 2.8], destra=(1, 2, 3), totale=True)
par('**Consuntivo**', keep=True)
tabella(['Voce', 'Previsto', 'Speso', 'Scostamento'], [
    ['Abbonamento mensile Claude (acquistato il 9 nov)', '€ 0', '€ 25', '+ € 25'],
    ['Hosting, software, hardware', '€ 0', '€ 0', '€ 0'],
    ['Totale', '€ 0', '€ 25', '+ € 25'],
], [8.6, 2.4, 2.4, 2.8], destra=(1, 2, 3), totale=True)
par('Rispetto al caso _most likely_ il progetto è **andato oltre il budget di 25 €**, restando comunque entro il '
    '_worst case_. La causa è il rischio “strumento gratuito non adeguato”, che si è verificato. Le ore di lavoro '
    'non sono state pagate e non compaiono nel budget, ma il tentativo fallito ne ha fatte perdere circa 4.')

titolo('14. Valutazione critica')
par('**Cosa ha funzionato**', keep=True)
elenco([
    'Avere una regola chiara di approvazione: niente è stato pubblicato senza il mio OK.',
    'Chiedere proposte prima delle modifiche, così ho potuto scegliere invece di accettare tutto.',
    'Il confronto automatico tra sito e .tex, che ha trovato errori di arrotondamento prima della consegna.',
    'Le prove sul telefono, che hanno fatto emergere i problemi di leggibilità corretti nella v3.',
])
par('**Cosa non ha funzionato**', keep=True)
elenco([
    '**Due giorni persi** con lo strumento gratuito. Avrei dovuto stabilire prima un criterio per abbandonarlo, per '
    'esempio “se dopo 2 ore non funziona, cambio”.',
    '**Brief iniziale incompleto.** Non avevo scritto che il project manager deve inserire i propri dati periodo per '
    'periodo: la v1 è stata da rifare in parte.',
    '**Troppe funzioni insieme** nella v3. Utili, ma 19 cambiamenti insieme rendono più difficile controllare tutto.',
    '**Nessuna prova sul sito pubblicato** prima di chiudere la v3: l\'errore della cache l\'ho visto io da utente, '
    'non durante il collaudo.',
])
par('**Limiti del prodotto**', keep=True)
elenco([
    'I browser per PC diversi da Chrome non sono stati provati in modo sistematico.',
    'I dati restano nel browser: se si cancella la cronologia senza aver salvato il file, si perdono.',
    'La previsione del costo finale (EAC = BAC / CPI) è un\'ipotesi semplice, valida solo se l\'andamento resta uguale.',
    'Il codice è stato scritto dall\'AI: lo capisco nelle linee generali, non in ogni dettaglio.',
])

titolo('15. Conclusioni')
par('Il sito è pubblicato e funziona su PC e telefono: dai dati di un progetto produce il diagramma costi-tempi, gli '
    'indicatori, il report PDF e il file LaTeX.')
par('Rispetto al piano iniziale ci sono stati tre scostamenti: **+25 € di costi**, **circa 4 ore perse** e un '
    '**difetto arrivato online**, corretto in giornata. La scadenza di giovedì 12 novembre è rispettata.')
par('L\'esperienza mi ha mostrato in pratica cosa significa controllare un progetto: un rischio messo in tabella '
    '(lo strumento gratuito) si è verificato davvero, ha spostato costi e tempi, e averlo previsto ha reso più '
    'veloce la decisione su come rispondere.')

doc.core_properties.title = 'Relazione di progetto – CostCurve'
doc.core_properties.author = 'Matviy Kalistyy'
doc.save('relazione.docx')
print('DOCX creato: relazione.docx')
