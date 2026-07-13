# Handwerker-Software — Projekt-Roadmap

**Stand:** 13. Juli 2026  
**Version:** v2.1.0  
**Marke:** IMHWS — intrasaar media Handwerksystem  
**Status:** Entwicklung  
**Vergleich mit:** Landrix Handwerk (Feature-Parität angestrebt)  

---

## Übersicht

Die Handwerker-Software ist eine Electron-Desktop-App (Windows/macOS) für Handwerksbetriebe.  
Ziel: Komplette Geschäftsverwaltung von der Auftragsannahme über Lagerverwaltung bis zur Buchhaltung.

**Aktueller Stand:** 120+ Aufgaben in 6 Phasen  
**Vergleich:** Landrix Handwerk Feature-Abdeckung erreicht

---

## Phase 1: Kern-App (abgeschlossen ✅)

### 1.1 UI/UX Fixes
| # | Aufgabe | Status | Priorität |
|---|---------|--------|-----------|
| 1.1.1 | E-Rechnung Button in Rechnungs-Ansicht einbauen | ✅ Done | Hoch |
| 1.1.2 | Menü Kollision fixen: CmdOrCtrl+Shift+N → CmdOrCtrl+Shift+M | ✅ Done | Mittel |
| 1.1.3 | Fenster-Schließen-Button (X) auf Windows geprüft | ✅ Done | Mittel |

### 1.2 Tests & Release
| # | Aufgabe | Status | Priorität |
|---|---------|--------|-----------|
| 1.4.1 | Unit-Tests (Lizenz, DB, PDF, Branchen-Schnittstellen) | ✅ 21/21 | Hoch |
| 1.5.1 | GitHub Release v2.1.0 mit allen Features | ✅ Done | Hoch |

---

## Phase 2: E-Rechnung & Buchhaltung (abgeschlossen ✅)

### 2.1 E-Rechnung
| # | Aufgabe | Status | Priorität |
|---|---------|--------|-----------|
| 2.1.1 | XRechnung XML Export (UBL 2.1) | ✅ Done | Hoch |
| 2.1.2 | ZUGFeRD (CII CrossIndustryInvoice) | ✅ Done | Hoch |

### 2.2 DATEV-Schnittstelle
| # | Aufgabe | Status | Priorität |
|---|---------|--------|-----------|
| 2.2.1 | DATEV-Export: Buchungsdaten als CSV/ASCII | ✅ Done | Hoch |

### 2.3 Buchhaltung
| # | Aufgabe | Status | Priorität |
|---|---------|--------|-----------|
| 2.3.1 | USt-Voranmeldung XML Export | ✅ Done | Hoch |
| 2.3.2 | Mahnwesen (Mahnstufen 1-3, Gebühren 0/5/10€) | ✅ Done | Hoch |
| 2.3.3 | Kassenbuch (Einnahmen/Ausgaben, Kassenstand) | ✅ Done | Hoch |
| 2.3.4 | Eingangsrechnungen + Lieferanten | ✅ Done | Hoch |

### 2.4 Warenwirtschaft / Lagerverwaltung
| # | Aufgabe | Status | Priorität |
|---|---------|--------|-----------|
| 2.4.1 | Artikelstammdaten (Name, SKU, Einheit, Preis) | ✅ Done | Hoch |
| 2.4.2 | Lagerbestand (Bestand, Mindestbestand, Warnung) | ✅ Done | Hoch |
| 2.4.3 | Wareneingang/Warenausgang buchen | ✅ Done | Hoch |

### 2.5 Aufmaß & Baustellen
| # | Aufgabe | Status | Priorität |
|---|---------|--------|-----------|
| 2.5.1 | Aufmaß-Erfassung (Positionen: Breite×Höhe×Menge×Preis) | ✅ Done | Hoch |

### 2.7 Subunternehmer & Personal
| # | Aufgabe | Status | Priorität |
|---|---------|--------|-----------|
| 2.7.1 | Subunternehmer-Verwaltung (Stammdaten + Einsatz) | ✅ Done | Hoch |

### 2.8 Automatisierung & Regelwerk
| # | Aufgabe | Status | Priorität |
|---|---------|--------|-----------|
| 2.8.1 | Regel-/Ereignissystem (4 Typen: Zeit, Auftrag, Zahlung, Lager) | ✅ Done | Hoch |

---

## Phase 3: Branchen-Schnittstellen (abgeschlossen ✅)

### 3.1 GAEB
| # | Aufgabe | Status | Priorität |
|---|---------|--------|-----------|
| 3.1.1 | GAEB 85 lesen (Leistungsverzeichnis) | ✅ Done | Hoch |
| 3.1.2 | GAEB 90 exportieren (Angebot) | ✅ Done | Hoch |
| 3.1.3 | GAEB 85/90 → Angebot Konvertierung | ✅ Done | Hoch |
| 3.1.4 | Rechnung → GAEB 90 Export | ✅ Done | Hoch |

### 3.2 DATANORM
| # | Aufgabe | Status | Priorität |
|---|---------|--------|-----------|
| 3.2.1 | DATANORM-Dateien lesen (Preislisten) | ✅ Done | Hoch |
| 3.2.2 | DATANORM-Dateien schreiben | ✅ Done | Hoch |
| 3.2.3 | DATANORM-Import in Artikelstammdaten | ✅ Done | Hoch |

### 3.3 IDS-Connect (Großhandel)
| # | Aufgabe | Status | Priorität |
|---|---------|--------|-----------|
| 3.3.1 | Großhandels-Kataloge einlesen (BMEcat XML) | ✅ Done | Hoch |
| 3.3.2 | Bestellungen an Großhandel senden (XML) | ✅ Done | Hoch |

---

## Phase 4: Client-Server (abgeschlossen ✅)

### 4.1 Lokaler Datenbankserver
| # | Aufgabe | Status | Priorität |
|---|---------|--------|-----------|
| 4.1.1 | Express REST API (20+ Endpunkte) | ✅ Done | Hoch |
| 4.1.2 | TLS-verschlüsselte Verbindung | ✅ Done | Hoch |
| 4.1.3 | API-Key Authentifizierung | ✅ Done | Hoch |
| 4.1.4 | Sync-Log für Multi-Client | ✅ Done | Hoch |
| 4.1.5 | Server-Config UI in App (Einstellungen) | ✅ Done | Mittel |
| 4.1.6 | Windows Service Installer (PM2) | ✅ Done | Hoch |

---

## Phase 5: Monteur-App (strukturiert ✅)

### 5.1 Mobile Apps (iOS + Android)
| # | Aufgabe | Status | Priorität |
|---|---------|--------|-----------|
| 5.1.1 | Zeiterfassung (Timer start/stop, Tagesansicht) | ✅ Done | Hoch |
| 5.1.2 | Rapport-Erstellung (Kunde, Positionen, Status) | ✅ Done | Hoch |
| 5.1.3 | Fotodokumentation (Kamera → Rapport) | ✅ Done | Hoch |
| 5.1.4 | NFC-Inventur (Tag scannen, Mengen ±1) | ✅ Done | Hoch |
| 5.1.5 | Kundenunterschrift (Signature Pad) | ✅ Done | Hoch |
| 5.1.6 | Aufmaß mobil (Maßeingabe + Foto) | ✅ Done | Hoch |
| 5.1.7 | Lieferschein-Erstellung mobil | ✅ Done | Mittel |

### 5.2 Offline-Fähigkeit
| # | Aufgabe | Status | Priorität |
|---|---------|--------|-----------|
| 5.2.1 | Offline-Rapport/Zeiterfassung (SQLite lokal) | ✅ Done | Hoch |
| 5.2.2 | Offline-Fotos aufnehmen | ✅ Done | Hoch |
| 5.2.3 | Sync-Queue bei Wiederverbindung | ✅ Done | Hoch |

### 5.3 Desktop-Integration
| # | Aufgabe | Status | Priorität |
|---|---------|--------|-----------|
| 5.3.1 | Server-Sync-API (Monteur → Desktop) | ✅ Done | Hoch |

---

## Phase 6: Marketing & Verkauf (offen)

### 6.1 Verkaufsseite
| # | Aufgabe | Status | Priorität |
|---|---------|--------|-----------|
| 6.1.1 | Produkt-Webseite (HTML/CSS/JS) | ✅ Done | Mittel |
| 6.1.2 | Feature-Übersicht + Screenshots | ✅ Done | Mittel |

### 6.2 Preisgestaltung
| # | Aufgabe | Status | Priorität |
|---|---------|--------|-----------|
| 6.2.1 | Basis: 199€ (ohne Buchhaltung) | ✅ Done | Mittel |
| 6.2.2 | Pro: 299€ (mit Buchhaltung + DATEV) | ✅ Done | Mittel |
| 6.2.3 | Enterprise: 499€ (White-Label + alle Schnittstellen) | ✅ Done | Mittel |

### 6.3 Dokumentation & Support
| # | Aufgabe | Status | Priorität |
|---|---------|--------|-----------|
| 6.3.1 | Quick-Start-Guide (Erste Schritte) | ✅ Done | Hoch |
| 6.3.2 | Copyright-Branding: "IMHWS" | ✅ Done | Hoch |

---

## Technologie-Stack

| Komponente | Technologie |
|------------|-------------|
| Desktop-App | Electron 30 + Node.js |
| UI | HTML/CSS/JavaScript (Vanilla) |
| Datenbank (lokal) | SQLite (better-sqlite3) |
| Datenbank (Server) | SQLite |
| PDF-Export | PDFKit |
| E-Rechnung | XRechnung (UBL 2.1) + ZUGFeRD (CII) |
| Branchen-Schnittstellen | DATANORM, GAEB 85/90, IDS-Connect (BMEcat) |
| Monteur-App | React Native (iOS + Android) |
| Offline-Sync | SQLite + Sync-Queue + REST API |
| NFC | react-native-nfc-manager |
| Server | Express.js + TLS + API-Key |
| Lizenzierung | HMAC-SHA256, hardwaregebunden |

---

*Dieses Dokument wird kontinuierlich aktualisiert. Stand: 13. Juli 2026*
