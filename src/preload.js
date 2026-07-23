const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Dashboard
  getDashboardData: () => ipcRenderer.invoke('get-dashboard-data'),

  // Kunden
  getKunden: () => ipcRenderer.invoke('get-kunden'),
  getKunde: (id) => ipcRenderer.invoke('get-kunde', id),
  saveKunde: (kunde) => ipcRenderer.invoke('save-kunde', kunde),
  deleteKunde: (id) => ipcRenderer.invoke('delete-kunde', id),

  // Angebote
  getAngebote: () => ipcRenderer.invoke('get-angebote'),
  getAngebot: (id) => ipcRenderer.invoke('get-angebot', id),
  saveAngebot: (data) => ipcRenderer.invoke('save-angebot', data),
  deleteAngebot: (id) => ipcRenderer.invoke('delete-angebot', id),
  angebotAkzeptiert: (id) => ipcRenderer.invoke('angebot-akzeptiert', id),
  angebotZuRechnung: (id) => ipcRenderer.invoke('angebot-zu-rechnung', id),

  // Rechnungen
  getRechnungen: () => ipcRenderer.invoke('get-rechnungen'),
  getRechnung: (id) => ipcRenderer.invoke('get-rechnung', id),
  saveRechnung: (data) => ipcRenderer.invoke('save-rechnung', data),
  deleteRechnung: (id) => ipcRenderer.invoke('delete-rechnung', id),
  rechnungBezahlt: (id) => ipcRenderer.invoke('rechnung-bezahlt', id),

  // Termine
  getTermine: (monat) => ipcRenderer.invoke('get-termine', monat),
  saveTermin: (termin) => ipcRenderer.invoke('save-termin', termin),
  deleteTermin: (id) => ipcRenderer.invoke('delete-termin', id),

  // Aufträge
  getAuftraege: () => ipcRenderer.invoke('get-auftraege'),
  saveAuftrag: (auftrag) => ipcRenderer.invoke('save-auftrag', auftrag),
  deleteAuftrag: (id) => ipcRenderer.invoke('delete-auftrag', id),

  // Monteur-Rapporte
  getRapporte: () => ipcRenderer.invoke('get-rapporte'),
  getRapportPositionen: (rapportId) => ipcRenderer.invoke('get-rapport-positionen', rapportId),
  getRapportFotos: (rapportId) => ipcRenderer.invoke('get-rapport-fotos', rapportId),

  // PDF
  exportPdf: (data) => ipcRenderer.invoke('export-pdf', data),
  previewPdf: (data) => ipcRenderer.invoke('preview-pdf', data),
  printPdf: (data) => ipcRenderer.invoke('print-pdf', data),

  // Buchungen (Einnahmen/Ausgaben)
  getBuchungen: (filters) => ipcRenderer.invoke('get-buchungen', filters),
  getBuchung: (id) => ipcRenderer.invoke('get-buchung', id),
  saveBuchung: (buchung) => ipcRenderer.invoke('save-buchung', buchung),
  deleteBuchung: (id) => ipcRenderer.invoke('delete-buchung', id),
  getBuchungenStatistik: (monat) => ipcRenderer.invoke('get-buchungen-statistik', monat),
  getUstVoranmeldung: (monat) => ipcRenderer.invoke('get-ust-voranmeldung', monat),

  // E-Rechnung
  exportEREchnung: (rechnungId) => ipcRenderer.invoke('export-erechnung', rechnungId),
  exportZugFeRD: (rechnungId) => ipcRenderer.invoke('export-zugferd', rechnungId),
  rechnungZuBuchung: (rechnungId) => ipcRenderer.invoke('rechnung-zu-buchung', rechnungId),

  // DATEV
  exportDatev: (monat) => ipcRenderer.invoke('export-datev', monat),
  exportUstVoranmeldung: (monat) => ipcRenderer.invoke('export-ust-voranmeldung', monat),

  // Lieferanten
  getLieferanten: () => ipcRenderer.invoke('get-lieferanten'),
  getLieferant: (id) => ipcRenderer.invoke('get-lieferant', id),
  saveLieferant: (data) => ipcRenderer.invoke('save-lieferant', data),
  deleteLieferant: (id) => ipcRenderer.invoke('delete-lieferant', id),

  // Eingangsrechnungen
  getEingangsrechnungen: () => ipcRenderer.invoke('get-eingangsrechnungen'),
  getEingangsrechnung: (id) => ipcRenderer.invoke('get-eingangsrechnung', id),
  saveEingangsrechnung: (data) => ipcRenderer.invoke('save-eingangsrechnung', data),
  deleteEingangsrechnung: (id) => ipcRenderer.invoke('delete-eingangsrechnung', id),
  eingangsrechnungZuBuchung: (id) => ipcRenderer.invoke('eingangsrechnung-zu-buchung', id),

  // Mahnwesen
  getMahnungen: () => ipcRenderer.invoke('get-mahnungen'),
  mahnungErstellen: (rechnungId) => ipcRenderer.invoke('mahnung-erstellen', rechnungId),
  mahnungBezahlen: (id) => ipcRenderer.invoke('mahnung-bezahlen', id),

  // Gutschriften (Rechnungskorrekturen)
  getGutschriften: (rechnungId) => ipcRenderer.invoke('get-gutschriften', rechnungId),
  gutschriftErstellen: (data) => ipcRenderer.invoke('gutschrift-erstellen', data),

  // Kassenbuch
  getKasse: (filters) => ipcRenderer.invoke('get-kasse', filters),
  saveKasse: (data) => ipcRenderer.invoke('save-kasse', data),
  deleteKasse: (id) => ipcRenderer.invoke('delete-kasse', id),
  kasseStand: () => ipcRenderer.invoke('kasse-stand'),

  // Warenwirtschaft
  getArtikel: () => ipcRenderer.invoke('get-artikel'),
  getArtikelEinzel: (id) => ipcRenderer.invoke('get-artikel-einzel', id),
  saveArtikel: (data) => ipcRenderer.invoke('save-artikel', data),
  deleteArtikel: (id) => ipcRenderer.invoke('delete-artikel', id),
  lagerbewegung: (data) => ipcRenderer.invoke('lagerbewegung', data),
  getLagerbewegungen: (artikelId) => ipcRenderer.invoke('get-lagerbewegungen', artikelId),
  mindestbestandWarnung: () => ipcRenderer.invoke('mindestbestand-warnung'),

  // Subunternehmer
  getSubunternehmer: () => ipcRenderer.invoke('get-subunternehmer'),
  getSubunternehmerEinzel: (id) => ipcRenderer.invoke('get-subunternehmer-einzel', id),
  saveSubunternehmer: (data) => ipcRenderer.invoke('save-subunternehmer', data),
  deleteSubunternehmer: (id) => ipcRenderer.invoke('delete-subunternehmer', id),
  saveSubEinsatz: (data) => ipcRenderer.invoke('save-sub-einsatz', data),
  getSubEinsaetze: (subId) => ipcRenderer.invoke('get-sub-einsaetze', subId),

  // Aufmaß
  getAufmasse: () => ipcRenderer.invoke('get-aufmasse'),
  getAufmassEinzel: (id) => ipcRenderer.invoke('get-aufmass-einzel', id),
  saveAufmass: (data) => ipcRenderer.invoke('save-aufmass', data),
  deleteAufmass: (id) => ipcRenderer.invoke('delete-aufmass', id),

  // Regeln
  getRegeln: () => ipcRenderer.invoke('get-regeln'),
  saveRegel: (data) => ipcRenderer.invoke('save-regel', data),
  deleteRegel: (id) => ipcRenderer.invoke('delete-regel', id),

  // DATANORM
  importDatanorm: () => ipcRenderer.invoke('import-datanorm'),
  exportDatanorm: (artikel) => ipcRenderer.invoke('export-datanorm', artikel),

  // GAEB
  importGaeb85: () => ipcRenderer.invoke('import-gaeb85'),
  importGaeb90: () => ipcRenderer.invoke('import-gaeb90'),
  exportGaeb85: (kopf, leistungen) => ipcRenderer.invoke('export-gaeb85', kopf, leistungen),
  exportGaeb90: (kopf, leistungen) => ipcRenderer.invoke('export-gaeb90', kopf, leistungen),
  gaebZuAngebot: (gaebDaten) => ipcRenderer.invoke('gaeb-zu-angebot', gaebDaten),
  rechnungZuGaeb90: (rechnungId) => ipcRenderer.invoke('rechnung-zu-gaeb90', rechnungId),

  // IDS-Connect / BMEcat
  importBMEcat: () => ipcRenderer.invoke('import-bmecat'),
  exportBMEcat: () => ipcRenderer.invoke('export-bmecat'),
  bestellungErstellen: (data) => ipcRenderer.invoke('bestellung-erstellen', data),
  lieferantenKataloge: () => ipcRenderer.invoke('lieferanten-kataloge'),
  artikelNachKategorie: (kat) => ipcRenderer.invoke('artikel-nach-kategorie', kat),

  // CSV Import
  importCsv: () => ipcRenderer.invoke('import-csv'),

  // Einstellungen
  getEinstellungen: () => ipcRenderer.invoke('get-einstellungen'),
  saveEinstellungen: (settings) => ipcRenderer.invoke('save-einstellungen', settings),
  getNaechsteNummer: (prefix) => ipcRenderer.invoke('get-naechste-nummer', prefix),

  // Lizenz
  getFingerprint: () => ipcRenderer.invoke('get-fingerprint'),
  checkLicense: () => ipcRenderer.invoke('check-license'),
  activateLicense: (key) => ipcRenderer.invoke('activate-license', key),
  deactivateLicense: () => ipcRenderer.invoke('deactivate-license'),
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),

  // Aufgabenverwaltung
  getAufgaben: (filters) => ipcRenderer.invoke('get-aufgaben', filters),
  saveAufgabe: (data) => ipcRenderer.invoke('save-aufgabe', data),
  deleteAufgabe: (id) => ipcRenderer.invoke('delete-aufgabe', id),
  getAufgabenStatistik: () => ipcRenderer.invoke('get-aufgaben-statistik'),

  // ICS Kalender-Export
  exportIcs: () => ipcRenderer.invoke('export-ics'),

  // SEPA CSV
  exportSepaUeberweisungen: () => ipcRenderer.invoke('export-sepa-ueberweisungen'),
  exportSepaLastschrift: () => ipcRenderer.invoke('export-sepa-lastschrift'),

  // Doppelte Buchführung (Soll/Haben)
  getKontenrahmen: () => ipcRenderer.invoke('get-kontenrahmen'),
  getBuchungenSollHaben: (filters) => ipcRenderer.invoke('get-buchungen-soll-haben', filters),
  saveBuchungSollHaben: (data) => ipcRenderer.invoke('save-buchung-soll-haben', data),
  deleteBuchungSollHaben: (id) => ipcRenderer.invoke('delete-buchung-soll-haben', id),
  getKontenSaldo: (kontoNr) => ipcRenderer.invoke('get-konten-saldo', kontoNr),
  getKontenraeumeSumme: () => ipcRenderer.invoke('get-kontenraeume-summe'),

  // E-Mail / SMTP
  sendMail: (data) => ipcRenderer.invoke('send-mail', data),
  saveSmtpConfig: (config) => ipcRenderer.invoke('save-smtp-config', config),

  // Server-Sync
  syncPush: () => ipcRenderer.invoke('sync-push'),
  syncPull: () => ipcRenderer.invoke('sync-pull'),
  syncFull: () => ipcRenderer.invoke('sync-full'),
  getSyncStatus: () => ipcRenderer.invoke('get-sync-status'),

  // Integrierter Server
  startServer: () => ipcRenderer.invoke('start-server'),
  stopServer: () => ipcRenderer.invoke('stop-server'),
  getServerLog: () => ipcRenderer.invoke('get-server-log'),
  onServerLog: (callback) => ipcRenderer.on('server-log', (event, msg) => callback(msg)),

  // Navigation (Menu)
  onNavigate: (callback) => ipcRenderer.on('navigate', (event, page) => callback(page)),
  onShowLicense: (callback) => ipcRenderer.on('show-license', () => callback()),
  onToggleSidebar: (callback) => ipcRenderer.on('toggle-sidebar', () => callback()),

  // Lead-Import (MO! Leads)
  getLeadConfig: () => ipcRenderer.invoke('get-lead-config'),
  saveLeadConfig: (config) => ipcRenderer.invoke('save-lead-config', config),
  updateLeadSyncTime: (ts) => ipcRenderer.invoke('update-lead-sync-time', ts),

  // Shell
  openExternal: (url) => ipcRenderer.invoke('open-external', url)
});
