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

  // PDF
  exportPdf: (data) => ipcRenderer.invoke('export-pdf', data),

  // Buchungen (Einnahmen/Ausgaben)
  getBuchungen: (filters) => ipcRenderer.invoke('get-buchungen', filters),
  getBuchung: (id) => ipcRenderer.invoke('get-buchung', id),
  saveBuchung: (buchung) => ipcRenderer.invoke('save-buchung', buchung),
  deleteBuchung: (id) => ipcRenderer.invoke('delete-buchung', id),
  getBuchungenStatistik: (monat) => ipcRenderer.invoke('get-buchungen-statistik', monat),
  getUstVoranmeldung: (monat) => ipcRenderer.invoke('get-ust-voranmeldung', monat),

  // E-Rechnung
  exportEREchnung: (rechnungId) => ipcRenderer.invoke('export-erechnung', rechnungId),
  rechnungZuBuchung: (rechnungId) => ipcRenderer.invoke('rechnung-zu-buchung', rechnungId),

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
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),

  // Navigation (Menu)
  onNavigate: (callback) => ipcRenderer.on('navigate', (event, page) => callback(page)),
  onShowLicense: (callback) => ipcRenderer.on('show-license', () => callback()),
  onToggleSidebar: (callback) => ipcRenderer.on('toggle-sidebar', () => callback())
});
