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
p.paragraph_format.space_after = Pt(10)
r = p.add_run('PROGETTO – COSTCURVE (DIAGRAMMA COSTI-TEMPI IN LATEX)')
r.bold = True; r.font.size = Pt(18)

par('**Matviy Kalistyy – 5C INF – GPOI**', dopo=2)
par('Dal 6 al 12 novembre 2026')

titolo('Il progetto')
par('Il compito chiedeva un diagramma costi-tempi (BCWS, BCWP, ACWP) con due monitoraggi, tabella, legenda, '
    '%CV e %SV, con **output in formato .tex** riutilizzabile cambiando solo i dati.')

titolo('Il problema principale: il TeX')
par('La teoria del diagramma (libro, U4L3) si capisce in poco tempo. Il vero problema era il **TeX**, che non '
    'conoscevo per niente: non sapevo come si scrive, come si compila e tanto meno come si disegna un grafico. '
    'Quindi all\'inizio **non potevo nemmeno stimare** quanto tempo mi serviva: poteva essere un\'ora come settimane.')

titolo('Rischi')
elenco([
    '**Non riuscire a fare il .tex** in tempo, o farlo che non compila: era il rischio più grave, perché senza il '
    '.tex il compito non era consegnabile.',
    '**Fare un .tex sbagliato** (curve o formule errate) senza accorgermene, proprio perché non conoscevo il TeX.',
    '**Ritardo** sulla consegna di giovedì 12.',
    '**Puntare troppo in alto**, cioè fare più di quanto richiesto e perdere tempo sulle cose non richieste.',
])

titolo('Problemi che ho incontrato')
elenco([
    'Il 7 e l\'8 novembre ho usato un\'**AI gratuita**: riusciva a scrivermi il codice, ma non risolveva il problema '
    'vero, il TeX. In più io puntavo in alto (volevo un sito completo), quindi ho perso circa 4 ore su cose che il '
    'compito non chiedeva.',
    'Con il tempo rimasto non potevo più rispettare insieme scadenza, richieste e costo zero.',
    'Anche dopo, ho continuato ad aggiungere cose non richieste. È stato un errore: il rischio di “puntare troppo '
    'in alto” l\'avevo previsto e si è verificato.',
])

titolo('Come sono arrivato al risultato')
elenco([
    'Il 9 novembre ho deciso di **spendere 25 €** per un mese di Claude AI, cambiando il vincolo di costo per '
    'rispettare scadenza e richieste.',
    'L\'ho usato soprattutto come **consulente per il TeX**: prima una prova per vedere se il grafico si poteva '
    'disegnare, poi il .tex vero, diviso in una parte **DATI** (dove si cambiano i numeri) e una parte che disegna.',
    'Ho **controllato il risultato con l\'esempio del libro**: il .tex compila e i valori di CV, SV, %CV e %SV '
    'coincidono. Cambiando un dato e ricompilando, tutto si aggiorna.',
    'Ho consegnato nei tempi, con circa 20 ore di lavoro (4 perse) e 25 € di spesa invece di 0.',
])

titolo('Cosa ho imparato')
par('Il problema vero va capito subito: per me era il TeX, non il resto. E puntare più in alto del richiesto non '
    'aiuta: fa perdere tempo e aggiunge rischi.')

doc.core_properties.title = 'Relazione di progetto – CostCurve'
doc.core_properties.author = 'Matviy Kalistyy'
doc.save('relazione.docx')
print('DOCX creato: relazione.docx')
