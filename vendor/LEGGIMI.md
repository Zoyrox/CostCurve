# Librerie incluse (vendored)

Copiate qui dal registro npm per far funzionare il sito **senza CDN e anche offline**.
Servono solo al pulsante "Scarica PDF". Se mancassero, il sito funziona comunque:
resta "Stampa / Salva come PDF" del browser.

| File | Libreria | Versione | Licenza |
|---|---|---|---|
| `jspdf-4.2.1.umd.min.js` | [jsPDF](https://github.com/parallax/jsPDF) | 4.2.1 | MIT (`LICENSE-jspdf.txt`) |
| `svg2pdf-2.9.0.umd.min.js` | [svg2pdf.js](https://github.com/yWorks/svg2pdf.js) | 2.9.0 | MIT (`LICENSE-svg2pdf.txt`) |

Origine: `npm pack jspdf@4.2.1 svg2pdf.js@2.9.0`, file `dist/*.umd.min.js` non modificati.
