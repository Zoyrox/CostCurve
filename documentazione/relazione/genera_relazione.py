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
def codice(righe):
    for i, riga in enumerate(righe):
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(0)
        p.paragraph_format.line_spacing = 1.0
        p.paragraph_format.left_indent = Cm(0.6)
        p.paragraph_format.keep_with_next = i < len(righe) - 1
        r = p.add_run(riga if riga else ' ')
        r.font.name = 'Courier New'; r.font.size = Pt(9)
        r.element.rPr.rFonts.set(qn('w:eastAsia'), 'Courier New')
    doc.add_paragraph().paragraph_format.space_after = Pt(2)


p = doc.add_paragraph()
p.paragraph_format.space_after = Pt(10)
r = p.add_run('PROGETTO – COSTCURVE (DIAGRAMMA COSTI-TEMPI IN LATEX)')
r.bold = True; r.font.size = Pt(18)

par('**Matviy Kalistyy – 5C INF – GPOI**', dopo=2)
par('Dal 6 al 12 novembre 2026 · sito: zoyrox.github.io/CostCurve')

titolo('1. Il progetto')
par('Il compito chiedeva di produrre il **diagramma costi-tempi** di un progetto con le curve BCWS (costo '
    'pianificato), BCWP (valore del lavoro svolto) e ACWP (costo reale), due monitoraggi, una tabella con la legenda '
    'dei parametri e il calcolo di CV, SV, %CV e %SV. L\'output doveva essere in **formato .tex**, cioè un sorgente '
    'LaTeX, e doveva poter essere riusato per altri progetti cambiando solo i dati.')
par('Ho lavorato da solo, nel ruolo di project manager, con al massimo 2-3 ore al giorno e la consegna fissata a '
    'giovedì 12 novembre. Come strumento di sviluppo e di consulenza ho usato l\'intelligenza artificiale.')

titolo('2. Il problema principale: il TeX')
par('La teoria del diagramma (libro, U4L3) era chiara: sono poche pagine e le formule sono semplici. Il vero '
    'ostacolo era il **TeX**, che non conoscevo per niente. Non sapevo come si scrive un file .tex, come si compila, '
    'né come si disegna un grafico con delle curve. In più il file non doveva contenere un grafico “fisso”, ma '
    'ricalcolare da solo curve e indicatori quando cambiano i dati.')
par('Questo significava che all\'inizio **non potevo stimare** quanto tempo mi serviva: una persona che conosce '
    'LaTeX lo fa in poche ore, io potevo metterci settimane. Per questo nella pianificazione del 6 novembre ho messo '
    'come prima attività una **prova tecnica in LaTeX**, per capire subito se e come si poteva fare.')

titolo('3. Rischi')
par('Nella pianificazione ho individuato questi rischi principali:', keep=True)
tabella(['Rischio', 'Perché era un rischio', 'Come l\'ho gestito'], [
    ['Non riuscire a fare il .tex', 'Senza il .tex il compito non è consegnabile, e non conoscevo LaTeX', 'Prova tecnica all\'inizio; AI usata come consulente per il TeX'],
    ['.tex con errori o calcoli sbagliati', 'Non conoscendo il TeX, non mi sarei accorto facilmente degli errori', 'Controllo con l\'esempio numerico del libro'],
    ['Ritardo sulla consegna', 'Poco tempo (2-3 ore al giorno) e una scadenza fissa', 'Riserva di 3 ore e priorità sulle parti obbligatorie'],
    ['Fare più del richiesto', 'Le parti in più consumano tempo e portano nuovi errori', 'Previsto, ma non l\'ho rispettato fino in fondo (punto 5)'],
], [4.2, 6.2, 6.2], size=10.5)

titolo('4. Come si è svolto il lavoro')
par('**Venerdì 6.** Ho letto il compito e il libro, ho scritto i requisiti e le domande sulle parti poco chiare (per '
    'esempio se il .tex doveva ricalcolare i valori o solo mostrarli) e ho fatto la pianificazione: 12 attività, 17 '
    'ore stimate più 3 di riserva, su circa 21 disponibili.')
par('**Sabato 7 e domenica 8.** Ho provato con un\'**AI gratuita**. Riusciva a scrivermi il codice, ma il problema '
    'vero restava il TeX, che non mi risolveva. Inoltre puntavo in alto: invece di concentrarmi sul .tex, cercavo '
    'di farmi fare un sito completo. Risultato: circa 4 ore perse e nessun .tex funzionante.')
par('**Lunedì 9.** Con il tempo rimasto non potevo più rispettare insieme scadenza, richieste e costo zero. Dovevo '
    'scegliere quale vincolo cambiare: spostare la consegna non era possibile, ridurre le richieste avrebbe reso il '
    'lavoro non conforme. Ho scelto di **spendere 25 €** per un mese di Claude AI. Con questo ho fatto prima la prova '
    'in LaTeX, poi il .tex vero e la prima versione completa. Provandola mi sono accorto che non permetteva di '
    'inserire i dati di un progetto reale, quindi ho fatto una seconda versione.')
par('**Martedì 10.** Ho sistemato la visualizzazione su telefono e ho pubblicato il sito. Qui sono andato oltre '
    'il richiesto, aggiungendo funzioni che il compito non chiedeva. Dopo la pubblicazione il sito appariva “rotto” '
    'sul mio browser per un problema di aggiornamento dei file: l\'ho corretto in giornata.')
par('**Mercoledì 11.** Prove finali su PC e telefono e documentazione.')
par('**Giovedì 12.** Consegna.')

titolo('5. Il risultato')
sottotitolo('Il file .tex')
par('Il file è diviso in due parti. Nella parte **DATI** ci sono solo i numeri del progetto: durata, budget, costi '
    'pianificati, valori rilevati e i due monitoraggi. Per esempio:', keep=True)
codice([
    r'\newcommand{\Durata}{23}',
    r'\newcommand{\BAC}{540000}',
    r'\newcommand{\PuntiBCWP}{10/140000, 16/330000}',
    r'\newcommand{\PuntiACWP}{10/180000, 16/420000}',
    r'\newcommand{\TempoA}{10}   % primo monitoraggio',
    r'\newcommand{\TempoB}{16}   % secondo monitoraggio',
])
par('Nella parte **DISEGNO** non ci sono numeri: è LaTeX a calcolare le curve, CV, SV, le percentuali, la tabella e '
    'le frasi di commento. Per un altro progetto basta cambiare i dati e ricompilare, anche su Overleaf.')

f = doc.add_paragraph()
f.alignment = WD_ALIGN_PARAGRAPH.CENTER
f.paragraph_format.keep_with_next = True
f.add_run().add_picture('grafico-tex.png', width=Cm(12.5))
c = par('Figura 1 – Il grafico prodotto dal .tex compilato, con l\'esempio del libro (pag. 199).',
        size=9, colore='555555')
c.alignment = WD_ALIGN_PARAGRAPH.CENTER

sottotitolo('Il sito')
par('Per non dover scrivere i dati a mano nel .tex ho fatto anche un sito: si inseriscono i dati, si vede '
    'l\'anteprima del grafico e si scarica il .tex con quei valori già inseriti, oppure il report in PDF. Il sito '
    'è un supporto, il prodotto richiesto resta il .tex.')

sottotitolo('Controlli')
elenco([
    'il .tex compila senza errori;',
    'con i dati dell\'esempio del libro, CV, SV, %CV e %SV coincidono con quelli del libro (per esempio al mese 10: '
    'CV = −40.000, SV = −26.000);',
    'cambiando a mano un valore nella parte DATI e ricompilando, grafico, tabella e frasi si aggiornano;',
    'il sito e il .tex danno gli stessi numeri;',
    'il sito funziona su PC e telefono.',
])

titolo('6. Problemi incontrati')
elenco([
    '**Il TeX:** era la parte che non conoscevo e quella da cui dipendeva tutto. L\'ho superato solo con un aiuto '
    'esterno (l\'AI usata come consulente).',
    '**L\'AI gratuita:** scriveva codice, ma non risolveva il problema del TeX; due giorni con poco risultato.',
    '**Puntare troppo in alto:** ho speso tempo su un sito completo e su funzioni non richieste, invece di '
    'concentrarmi subito sul .tex.',
    '**Prima versione incompleta:** non permetteva di inserire i dati reali di un progetto, ho dovuto rifarne una parte.',
    '**Errore dopo la pubblicazione:** il sito non si aggiornava bene nel browser; corretto in giornata.',
])

titolo('7. Tempi e costi')
elenco([
    'ore previste: 20 (17 + 3 di riserva); ore reali: circa 20,5, di cui 4 perse con l\'AI gratuita. Lunedì e '
    'martedì ho lavorato più delle 2-3 ore previste per recuperare;',
    'spesa prevista: 0 €; spesa reale: **25 €** (abbonamento Claude AI).',
])

titolo('8. Conclusione')
par('Il progetto è stato consegnato in tempo e il .tex fa quello che chiedeva il compito. La difficoltà vera non '
    'era il diagramma, ma il TeX: se l\'avessi riconosciuto subito come unico punto critico, invece di inseguire un '
    'sito completo, avrei risparmiato due giorni e probabilmente anche i 25 €.')

doc.core_properties.title = 'Relazione di progetto – CostCurve'
doc.core_properties.author = 'Matviy Kalistyy'
doc.save('relazione.docx')
print('DOCX creato: relazione.docx')
