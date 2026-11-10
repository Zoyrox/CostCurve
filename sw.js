/* =====================================================================
 * sw.js — fa funzionare CostCurve come app installata, anche offline.
 * Tiene in memoria i file del sito; se c'è la rete, li aggiorna.
 * Cambia VERSIONE quando pubblichi una nuova versione del sito.
 * ===================================================================== */
const VERSIONE = 'costcurve-v3.0';
const FILE = [
  './', 'index.html', 'manifest.webmanifest', 'css/stile.css', 'css/stampa.css',
  'js/numeri.js', 'js/calcoli.js', 'js/esempi.js', 'js/grafico.js', 'js/latex.js', 'js/report.js',
  'js/importa.js', 'js/pdf.js', 'js/interfaccia.js', 'js/presentazione.js',
  'vendor/jspdf-4.2.1.umd.min.js', 'vendor/svg2pdf-2.9.0.umd.min.js',
  'icone/icona.svg', 'icone/icona-192.png', 'icone/icona-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSIONE).then(c => c.addAll(FILE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(chiavi => Promise.all(chiavi.filter(k => k !== VERSIONE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// prima la rete (versione più recente), se manca si usa la copia salvata
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(r => {
      const copia = r.clone();
      caches.open(VERSIONE).then(c => c.put(e.request, copia));
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html')))
  );
});
