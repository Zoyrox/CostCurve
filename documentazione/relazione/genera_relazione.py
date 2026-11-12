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
par('Periodo: da venerdì 6 a giovedì 12 novembre 2026')
par('Sito: zoyrox.github.io/CostCurve')

titolo('1. Di cosa si tratta')
par('Dalla pagina del libro (U4L3) il diagramma costi-tempi confronta tre curve: **BCWS** (costo pianificato), '
    '**BCWP** (valore del lavoro fatto) e **ACWP** (costo reale). Da queste si calcolano CV = BCWP − ACWP e '
    'SV = BCWP − BCWS, anche in percentuale. La teoria si capisce in poco tempo; il problema vero era capire '
    'come disegnarlo in LaTeX.')

titolo('2. Cosa chiedeva il compito')
elenco([
    'diagramma costi-tempi con due monitoraggi;',
    'curve BCWS, BCWP e ACWP, con tabella e legenda;',
    'calcolo percentuale dell\'andamento (%CV e %SV);',
    'output in formato .tex, riutilizzabile cambiando i dati;',
    'documentazione della pianificazione con risorse e tempi.',
])
par('La parte critica era il **.tex**: non conoscevo LaTeX, quindi all\'inizio non sapevo quanto tempo ci sarebbe '
    'voluto. Per questo la prima cosa da fare era una prova per vedere se riuscivo a disegnare un grafico in LaTeX.')

titolo('3. Domande che mi sono fatto')
elenco([
    'Il .tex deve avere i numeri già calcolati o deve ricalcolare tutto se cambio i dati? → Ho scelto la seconda: '
    'i dati sono in una parte separata.',
    'I monitoraggi devono essere due o un numero qualsiasi? → Due, come scritto.',
    'Con quali dati lo provo? → Con l\'esempio del libro, così posso controllare i risultati.',
    '%CV e %SV si calcolano su BCWS? → Sì, come nel libro.',
])

titolo('4. È un progetto?')
par('Sì: ha un obiettivo preciso, una scadenza (giovedì 12), dei vincoli (lavoro da solo, 2-3 ore al giorno, '
    'nessuna spesa prevista) e soprattutto una parte che non sapevo fare (LaTeX). Quindi serviva pianificarlo: '
    'attività, tempi, rischi.')

titolo('5. Pianificazione')
par('Il 6 novembre, nell\'ora in classe, ho fatto la pianificazione (documento a parte), poi l\'ho aggiornata '
    'durante la settimana. In breve:', keep=True)
elenco([
    '12 attività, **17 ore** stimate più **3 ore di riserva** (20 ore su circa 21 disponibili);',
    'prima attività importante: la prova di LaTeX, perché da lì dipendeva tutto il resto;',
    'risorse: io come project manager, consulenza (AI e libro) ed esecuzione informatica;',
    'costo figurativo delle ore: 695 € (con la riserva); spesa reale prevista: 0 €.',
])

titolo('6. Studio di fattibilità')
par('Il 6 novembre il progetto sembrava fattibile ma al limite: il tempo bastava appena e dovevo ancora capire se '
    'riuscivo con LaTeX. Il 7 e l\'8 ho provato con un\'AI gratuita, ma il risultato non andava bene e ho perso '
    'circa 4 ore. A quel punto, con il tempo rimasto, non riuscivo più a rispettare tutti i vincoli insieme.')

titolo('7. Soluzione alternativa')
par('Le possibilità erano tre: spostare la consegna (impossibile), fare meno di quanto richiesto (prodotto non '
    'conforme) oppure spendere qualcosa. Il 9 novembre ho scelto di **pagare un mese di Claude AI (25 €)**: ho '
    'cambiato il vincolo di costo, ma ho rispettato la scadenza e le richieste.')

titolo('8. Esecuzione')
tabella(['Giorno', 'Cosa ho fatto'], [
    ['ven 6', 'studio del libro, analisi delle richieste, pianificazione'],
    ['sab 7 – dom 8', 'tentativo con l\'AI gratuita (abbandonato)'],
    ['lun 9', 'abbonamento, prova LaTeX, prima versione funzionante, prime correzioni'],
    ['mar 10', 'seconda e terza versione, prove su PC e telefono, pubblicazione'],
    ['mer 11', 'prove finali e documentazione'],
    ['gio 12', 'consegna'],
], [3.2, 13.4])
par('Ore totali: circa **20,5** (di cui 4 perse con l\'AI gratuita). Lunedì e martedì ho lavorato più delle 2-3 '
    'ore previste, per recuperare.')

titolo('9. Rischi e problemi riscontrati')
par('**Rischi previsti nella pianificazione e cosa è successo:**', keep=True)
tabella(['Rischio', 'Com\'è andata'], [
    ['Non riuscire a fare il .tex (LaTeX sconosciuto)', 'Superato, ma solo con l\'AI a pagamento'],
    ['Formule sbagliate', 'Controllate con l\'esempio del libro: corrette'],
    ['Ritardo sulla consegna', 'Evitato, recuperando ore lunedì e martedì'],
    ['Aggiungere cose non richieste', '**Successo**: ho fatto molto più del necessario'],
    ['Sito e .tex con numeri diversi', 'Controllato: stessi numeri'],
], [8.0, 8.6])
par('**Problemi riscontrati:**', keep=True)
elenco([
    'l\'**AI gratuita** non era adatta: 4 ore perse e 25 € di spesa non prevista;',
    'la **prima versione** non permetteva di inserire i dati reali di un progetto: ho dovuto rifarne una parte;',
    'sul **telefono** il grafico era poco leggibile, corretto nella terza versione;',
    'dopo la pubblicazione il sito appariva "rotto" per un problema di aggiornamento dei file: corretto in giornata;',
    '**sono andato oltre la richiesta** (sito completo, tema scuro, presentazione, importazione da Excel): è stato '
    'un errore, perché ha preso tempo e ha portato altri problemi da correggere.',
])

titolo('10. Conformità e consegna')
par('Tutto quello che chiedeva il compito è presente: due monitoraggi, le tre curve, tabella e legenda, %CV e %SV, '
    'file .tex che si ricalcola cambiando i dati, pianificazione con risorse e tempi. Ho controllato i numeri con '
    'l\'esempio del libro e il .tex compila senza errori.')
par('Consegno: il file .tex con un esempio in PDF, la pianificazione, una guida d\'uso, il link al sito e questa '
    'relazione.')

titolo('Costi finali')
elenco([
    'spesa prevista: 0 € → spesa reale: **25 €** (abbonamento Claude AI);',
    'ore previste: 20 → ore reali: circa 20,5.',
])

titolo('Cosa ho imparato')
par('Che bisogna capire bene le richieste e le parti difficili prima di iniziare, e darsi un limite quando una '
    'strada non funziona (avrei dovuto lasciare l\'AI gratuita dopo un paio d\'ore, non dopo due giorni). E che '
    'fare più del richiesto non è un merito: costa tempo e aggiunge rischi.')

doc.core_properties.title = 'Relazione di progetto – CostCurve'
doc.core_properties.author = 'Matviy Kalistyy'
doc.save('relazione.docx')
print('DOCX creato: relazione.docx')
