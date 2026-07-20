# Changelog

## v2.3.6 (2026-07-20)

### 🎯 Lead-Import (MO! Leads)
- Neue Sidebar-Navigation "Lead-Import" mit Konfigurations-UI
- Verbindung zu MO! Leads via URL + Sync-Key konfigurierbar
- Automatischer Import von "Gewonnen"-Leads als Kunden in IMHWS
- Neue Kundenspalten: `website`, `branche`, `lead_status`, `lead_quelle`, `lead_id`, `lead_sync_datum`
- Neue `app_settings`-Tabelle für app-weite Konfiguration
- Sync-Zeit wird nach jedem Import gespeichert (nur neue/geänderte Leads seit letztem Sync)
- Duplikatschutz via `lead_id` — bereits importierte Leads werden übersprungen

### 🔧 Technische Änderungen
- `main.js`: DB-Migration für neue Kundenspalten + `app_settings`, IPC-Handler für Lead-Config (get/save/update-sync-time), `save-kunde` um neue Felder erweitert
- `preload.js`: Neue API-Methoden `getLeadConfig`, `saveLeadConfig`, `updateLeadSyncTime`
- `renderer.js`: `loadLeadImport()`, `saveLeadConfig()`, `syncGewonneneLeads()` mit Fetch gegen MO! Leads API
- `index.html`: Lead-Import-Seite mit URL/Sync-Key-Formular und Import-Button
- `styles.css`: Status-Badge-Klassen für Lead-Status (Neu, Kontaktiert, Interessiert, Angebot, Gewonnen, Verloren)

### 🌐 Website
- Homepage (index.html) komplett überarbeitet: Neues Hero-Design mit Gradient, Produktkarten, MO! Leads Banner
- Neues Corporate Design (dunkle Farben, Gradienten, Floating Shapes)
- demo.html aktualisiert
- Fokus auf Produkt-Showcase (IMHWS, ISMBS, MO! Leads) statt Feature-Liste

## v2.3.5 (2026-07-19)

- Homepage v2.3.5: Version, Features, Download-Links, Copyright aktualisiert
- fix: show version immediately, don't wait for GitHub fetch
- fix: dynamic version display in settings (read from package.json, not hardcoded)
- fix: read APP_VERSION from package.json instead of hardcoding
