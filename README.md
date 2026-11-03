# Haushaltsbuch (PWA)

Einfaches Haushaltsbuch für zwei – ohne Build-Schritt, reines HTML/CSS/JS.

- `index.html` – App-Hülle · `css/app.css` – Design (Light/Dark)
- `js/money.js` – Cent-Rechnung, Datum, Zeiträume · `js/store.js` – Speicher (austauschbarer Adapter für späteren Sync)
- `js/charts.js` – SVG-Diagramme · `js/app.js` – Seiten & Logik · `sw.js` – Offline

Lokal starten: `python3 -m http.server` und http://localhost:8000 öffnen.
Nach Änderungen `VERSION` in `sw.js` erhöhen.
