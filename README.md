# 🔧 Handwerker-Software

Desktop-Anwendung für Handwerker — Angebote, Rechnungen, Terminplanung, Kundenverwaltung.

## Features

- **Dashboard** — Umsatz, offene Angebote, anstehende Termine auf einen Blick
- **Kundenverwaltung** — Kontakte, Adressen, Telefon, E-Mail, Notizen
- **Angebote erstellen** — Positionen, MwSt-Berechnung, PDF-Export
- **Rechnungen erstellen** — USt berechnen, PDF-Export, Zahlungsstatus
- **Terminplanung** — Kalenderansicht mit Farbmarkierung
- **Auftragsverwaltung** — Status-Tracking, Prioritäten
- **Einstellungen** — Firmendaten, Bankverbindung, USt-IdNr.

## Voraussetzungen

- [Node.js](https://nodejs.org/) (Version 18+)
- npm (wird mit Node.js installiert)

## Installation

```bash
# Node.js installieren (falls nicht vorhanden)
# macOS:
brew install node

# Windows:
# https://nodejs.org herunterladen und installieren

# Abhängigkeiten installieren
npm install

# App starten
npm start
```

## Build für Windows

```bash
npm run build
```

Die fertige `.exe`-Datei wird im `dist/`-Ordner erstellt.

## Projektstruktur

```
handwerker-software/
├── package.json          # Projektkonfiguration
└── src/
    ├── main.js           # Electron Main Process
    ├── preload.js        # IPC Bridge
    ├── index.html        # UI HTML
    ├── styles.css        # Design
    └── renderer.js       # Frontend-Logik
```

## Speicher

Daten werden lokal in einer SQLite-Datenbank gespeichert:
- **macOS:** `~/Library/Application Support/handwerker-software/data/`
- **Windows:** `%APPDATA%/handwerker-software/data/`

## Technologien

- **Electron** — Desktop-App Framework
- **SQLite** — Lokale Datenbank (better-sqlite3)
- **PDFKit** — PDF-Export
- **Vanilla JS** — Schnelle, dependency-freie Logik

## Lizenz

MIT
