const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const Database = require('better-sqlite3');
const fs = require('fs');

let mainWindow;
let db;

const dataDir = path.join(app.getPath('userData'), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function initDatabase() {
  const dbPath = path.join(dataDir, 'handwerker.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS kunden (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      ansprechpartner TEXT,
      strasse TEXT,
      plz TEXT,
      ort TEXT,
      telefon TEXT,
      email TEXT,
      notizen TEXT,
      erstellt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS angebote (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nummer TEXT UNIQUE NOT NULL,
      kunden_id INTEGER NOT NULL,
      titel TEXT NOT NULL,
      beschreibung TEXT,
      betrag_netto REAL DEFAULT 0,
      mwst_satz REAL DEFAULT 19,
      betrag_brutto REAL DEFAULT 0,
      status TEXT DEFAULT 'offen',
      gueltig_bis DATE,
      erstellt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (kunden_id) REFERENCES kunden(id)
    );

    CREATE TABLE IF NOT EXISTS angebote_positionen (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      angebote_id INTEGER NOT NULL,
      position INTEGER NOT NULL,
      beschreibung TEXT NOT NULL,
      menge REAL DEFAULT 1,
      einheit TEXT DEFAULT 'Stk',
      einzelpreis REAL DEFAULT 0,
      gesamt REAL DEFAULT 0,
      FOREIGN KEY (angebote_id) REFERENCES angebote(id)
    );

    CREATE TABLE IF NOT EXISTS rechnungen (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nummer TEXT UNIQUE NOT NULL,
      kunden_id INTEGER NOT NULL,
      angebote_id INTEGER,
      titel TEXT NOT NULL,
      beschreibung TEXT,
      betrag_netto REAL DEFAULT 0,
      mwst_satz REAL DEFAULT 19,
      betrag_brutto REAL DEFAULT 0,
      status TEXT DEFAULT 'offen',
      faellig_am DATE,
      bezahlt_am DATE,
      erstellt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (kunden_id) REFERENCES kunden(id),
      FOREIGN KEY (angebote_id) REFERENCES angebote(id)
    );

    CREATE TABLE IF NOT EXISTS rechnungen_positionen (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rechnungen_id INTEGER NOT NULL,
      position INTEGER NOT NULL,
      beschreibung TEXT NOT NULL,
      menge REAL DEFAULT 1,
      einheit TEXT DEFAULT 'Stk',
      einzelpreis REAL DEFAULT 0,
      gesamt REAL DEFAULT 0,
      FOREIGN KEY (rechnungen_id) REFERENCES rechnungen(id)
    );

    CREATE TABLE IF NOT EXISTS termine (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kunden_id INTEGER,
      titel TEXT NOT NULL,
      beschreibung TEXT,
      datum DATE NOT NULL,
      uhrzeit_von TEXT,
      uhrzeit_bis TEXT,
      status TEXT DEFAULT 'geplant',
      farbe TEXT DEFAULT '#3b82f6',
      FOREIGN KEY (kunden_id) REFERENCES kunden(id)
    );

    CREATE TABLE IF NOT EXISTS auftraege (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nummer TEXT UNIQUE NOT NULL,
      kunden_id INTEGER NOT NULL,
      rechnungen_id INTEGER,
      titel TEXT NOT NULL,
      beschreibung TEXT,
      status TEXT DEFAULT 'offen',
      prioritaet TEXT DEFAULT 'normal',
      start_datum DATE,
      end_datum DATE,
      erstellt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (kunden_id) REFERENCES kunden(id),
      FOREIGN KEY (rechnungen_id) REFERENCES rechnungen(id)
    );

    CREATE TABLE IF NOT EXISTS buchungen (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      typ TEXT NOT NULL CHECK(typ IN ('einnahme', 'ausgabe')),
      kategorie TEXT NOT NULL,
      betrag REAL NOT NULL,
      datum DATE NOT NULL,
      beschreibung TEXT,
      beleg_nummer TEXT,
      mwst_satz REAL DEFAULT 19,
      mwst_betrag REAL DEFAULT 0,
      kunden_id INTEGER,
      rechnungen_id INTEGER,
      erstellt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (kunden_id) REFERENCES kunden(id),
      FOREIGN KEY (rechnungen_id) REFERENCES rechnungen(id)
    );
  `);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: 'hidden',
    backgroundColor: '#0f0f23'
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  initDatabase();
  createWindow();
});

app.on('window-all-closed', () => {
  if (db) db.close();
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// ============ IPC Handlers ============

ipcMain.handle('get-dashboard-data', () => {
  const kunden = db.prepare('SELECT COUNT(*) as anzahl FROM kunden').get();
  const offeneAngebote = db.prepare("SELECT COUNT(*) as anzahl, COALESCE(SUM(betrag_brutto),0) as betrag FROM angebote WHERE status='offen'").get();
  const offeneRechnungen = db.prepare("SELECT COUNT(*) as anzahl, COALESCE(SUM(betrag_brutto),0) as betrag FROM rechnungen WHERE status='offen'").get();
  const termineHeute = db.prepare("SELECT COUNT(*) as anzahl FROM termine WHERE datum = date('now')").get();
  const umsatzMonat = db.prepare("SELECT COALESCE(SUM(betrag_brutto),0) as betrag FROM rechnungen WHERE bezahlt_am IS NULL AND strftime('%Y-%m', erstellt) = strftime('%Y-%m', 'now')").get();
  const offeneAuftraege = db.prepare("SELECT COUNT(*) as anzahl FROM auftraege WHERE status != 'fertig'").get();

  return {
    kunden: kunden.anzahl,
    angebote: offeneAngebote,
    rechnungen: offeneRechnungen,
    termineHeute: termineHeute.anzahl,
    umsatzMonat: umsatzMonat.betrag,
    auftraege: offeneAuftraege.anzahl
  };
});

// ============ Kunden ============

ipcMain.handle('get-kunden', () => {
  return db.prepare('SELECT * FROM kunden ORDER BY name').all();
});

ipcMain.handle('get-kunde', (event, id) => {
  return db.prepare('SELECT * FROM kunden WHERE id = ?').get(id);
});

ipcMain.handle('save-kunde', (event, kunde) => {
  if (kunde.id) {
    db.prepare('UPDATE kunden SET name=?, ansprechpartner=?, strasse=?, plz=?, ort=?, telefon=?, email=?, notizen=? WHERE id=?')
      .run(kunde.name, kunde.ansprechpartner, kunde.strasse, kunde.plz, kunde.ort, kunde.telefon, kunde.email, kunde.notizen, kunde.id);
    return kunde.id;
  } else {
    const result = db.prepare('INSERT INTO kunden (name, ansprechpartner, strasse, plz, ort, telefon, email, notizen) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(kunde.name, kunde.ansprechpartner, kunde.strasse, kunde.plz, kunde.ort, kunde.telefon, kunde.email, kunde.notizen);
    return result.lastInsertRowid;
  }
});

ipcMain.handle('delete-kunde', (event, id) => {
  db.prepare('DELETE FROM kunden WHERE id = ?').run(id);
  return true;
});

// ============ Angebote ============

ipcMain.handle('get-angebote', () => {
  return db.prepare(`SELECT a.*, k.name as kunden_name FROM angebote a LEFT JOIN kunden k ON a.kunden_id = k.id ORDER BY a.erstellt DESC`).all();
});

ipcMain.handle('get-angebot', (event, id) => {
  const angebot = db.prepare(`SELECT a.*, k.name as kunden_name, k.strasse, k.plz, k.ort, k.email as kunden_email, k.telefon as kunden_telefon FROM angebote a LEFT JOIN kunden k ON a.kunden_id = k.id WHERE a.id = ?`).get(id);
  if (angebot) {
    angebot.positionen = db.prepare('SELECT * FROM angebote_positionen WHERE angebote_id = ? ORDER BY position').all(id);
  }
  return angebot;
});

ipcMain.handle('save-angebot', (event, data) => {
  const { angebot, positionen } = data;
  let angebotId;

  if (angebot.id) {
    db.prepare('UPDATE angebote SET nummer=?, kunden_id=?, titel=?, beschreibung=?, betrag_netto=?, mwst_satz=?, betrag_brutto=?, status=?, gueltig_bis=? WHERE id=?')
      .run(angebot.nummer, angebot.kunden_id, angebot.titel, angebot.beschreibung, angebot.betrag_netto, angebot.mwst_satz, angebot.betrag_brutto, angebot.status, angebot.gueltig_bis, angebot.id);
    angebotId = angebot.id;
    db.prepare('DELETE FROM angebote_positionen WHERE angebote_id = ?').run(angebotId);
  } else {
    const result = db.prepare('INSERT INTO angebote (nummer, kunden_id, titel, beschreibung, betrag_netto, mwst_satz, betrag_brutto, status, gueltig_bis) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(angebot.nummer, angebot.kunden_id, angebot.titel, angebot.beschreibung, angebot.betrag_netto, angebot.mwst_satz, angebot.betrag_brutto, angebot.status, angebot.gueltig_bis);
    angebotId = result.lastInsertRowid;
  }

  const insert = db.prepare('INSERT INTO angebote_positionen (angebote_id, position, beschreibung, menge, einheit, einzelpreis, gesamt) VALUES (?, ?, ?, ?, ?, ?, ?)');
  for (const pos of positionen) {
    insert.run(angebotId, pos.position, pos.beschreibung, pos.menge, pos.einheit, pos.einzelpreis, pos.gesamt);
  }

  return angebotId;
});

ipcMain.handle('delete-angebot', (event, id) => {
  db.prepare('DELETE FROM angebote_positionen WHERE angebote_id = ?').run(id);
  db.prepare('DELETE FROM angebote WHERE id = ?').run(id);
  return true;
});

ipcMain.handle('angebot-akzeptiert', (event, id) => {
  db.prepare("UPDATE angebote SET status = 'akzeptiert' WHERE id = ?").run(id);
  return true;
});

// ============ Rechnungen ============

ipcMain.handle('get-rechnungen', () => {
  return db.prepare(`SELECT r.*, k.name as kunden_name FROM rechnungen r LEFT JOIN kunden k ON r.kunden_id = k.id ORDER BY r.erstellt DESC`).all();
});

ipcMain.handle('get-rechnung', (event, id) => {
  const rechnung = db.prepare(`SELECT r.*, k.name as kunden_name, k.strasse, k.plz, k.ort, k.email as kunden_email, k.telefon as kunden_telefon FROM rechnungen r LEFT JOIN kunden k ON r.kunden_id = k.id WHERE r.id = ?`).get(id);
  if (rechnung) {
    rechnung.positionen = db.prepare('SELECT * FROM rechnungen_positionen WHERE rechnungen_id = ? ORDER BY position').all(id);
  }
  return rechnung;
});

ipcMain.handle('save-rechnung', (event, data) => {
  const { rechnung, positionen } = data;
  let rechnungId;

  if (rechnung.id) {
    db.prepare('UPDATE rechnungen SET nummer=?, kunden_id=?, angebote_id=?, titel=?, beschreibung=?, betrag_netto=?, mwst_satz=?, betrag_brutto=?, status=?, faellig_am=?, bezahlt_am=? WHERE id=?')
      .run(rechnung.nummer, rechnung.kunden_id, rechnung.angebote_id, rechnung.titel, rechnung.beschreibung, rechnung.betrag_netto, rechnung.mwst_satz, rechnung.betrag_brutto, rechnung.status, rechnung.faellig_am, rechnung.bezahlt_am, rechnung.id);
    rechnungId = rechnung.id;
    db.prepare('DELETE FROM rechnungen_positionen WHERE rechnungen_id = ?').run(rechnungId);
  } else {
    const result = db.prepare('INSERT INTO rechnungen (nummer, kunden_id, angebote_id, titel, beschreibung, betrag_netto, mwst_satz, betrag_brutto, status, faellig_am) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(rechnung.nummer, rechnung.kunden_id, rechnung.angebote_id, rechnung.titel, rechnung.beschreibung, rechnung.betrag_netto, rechnung.mwst_satz, rechnung.betrag_brutto, rechnung.status, rechnung.faellig_am);
    rechnungId = result.lastInsertRowid;
  }

  const insert = db.prepare('INSERT INTO rechnungen_positionen (rechnungen_id, position, beschreibung, menge, einheit, einzelpreis, gesamt) VALUES (?, ?, ?, ?, ?, ?, ?)');
  for (const pos of positionen) {
    insert.run(rechnungId, pos.position, pos.beschreibung, pos.menge, pos.einheit, pos.einzelpreis, pos.gesamt);
  }

  return rechnungId;
});

ipcMain.handle('delete-rechnung', (event, id) => {
  db.prepare('DELETE FROM rechnungen_positionen WHERE rechnungen_id = ?').run(id);
  db.prepare('DELETE FROM rechnungen WHERE id = ?').run(id);
  return true;
});

ipcMain.handle('rechnung-bezahlt', (event, id) => {
  db.prepare("UPDATE rechnungen SET status = 'bezahlt', bezahlt_am = date('now') WHERE id = ?").run(id);
  return true;
});

ipcMain.handle('angebot-zu-rechnung', (event, angebotId) => {
  const angebot = db.prepare('SELECT * FROM angebote WHERE id = ?').get(angebotId);
  if (!angebot) return null;

  const nummer = 'RE-' + String(Date.now()).slice(-6);
  const result = db.prepare('INSERT INTO rechnungen (nummer, kunden_id, titel, beschreibung, betrag_netto, mwst_satz, betrag_brutto, status, faellig_am) VALUES (?, ?, ?, ?, ?, ?, ?, ?, date("now", "+30 days"))')
    .run(nummer, angebot.kunden_id, angebot.titel, angebot.beschreibung, angebot.betrag_netto, angebot.mwst_satz, angebot.betrag_brutto, 'offen');
  const rechnungId = result.lastInsertRowid;

  const positionen = db.prepare('SELECT * FROM angebote_positionen WHERE angebote_id = ?').all(angebotId);
  const insert = db.prepare('INSERT INTO rechnungen_positionen (rechnungen_id, position, beschreibung, menge, einheit, einzelpreis, gesamt) VALUES (?, ?, ?, ?, ?, ?, ?)');
  for (const pos of positionen) {
    insert.run(rechnungId, pos.position, pos.beschreibung, pos.menge, pos.einheit, pos.einzelpreis, pos.gesamt);
  }

  db.prepare("UPDATE angebote SET status = 'rechnung' WHERE id = ?").run(angebotId);
  return rechnungId;
});

// ============ Termine ============

ipcMain.handle('get-termine', (event, monat) => {
  if (monat) {
    return db.prepare(`SELECT t.*, k.name as kunden_name FROM termine t LEFT JOIN kunden k ON t.kunden_id = k.id WHERE strftime('%Y-%m', t.datum) = ? ORDER BY t.datum, t.uhrzeit_von`).all(monat);
  }
  return db.prepare(`SELECT t.*, k.name as kunden_name FROM termine t LEFT JOIN kunden k ON t.kunden_id = k.id ORDER BY t.datum DESC, t.uhrzeit_von`).all();
});

ipcMain.handle('save-termin', (event, termin) => {
  if (termin.id) {
    db.prepare('UPDATE termine SET kunden_id=?, titel=?, beschreibung=?, datum=?, uhrzeit_von=?, uhrzeit_bis=?, status=?, farbe=? WHERE id=?')
      .run(termin.kunden_id, termin.titel, termin.beschreibung, termin.datum, termin.uhrzeit_von, termin.uhrzeit_bis, termin.status, termin.farbe, termin.id);
    return termin.id;
  } else {
    const result = db.prepare('INSERT INTO termine (kunden_id, titel, beschreibung, datum, uhrzeit_von, uhrzeit_bis, status, farbe) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(termin.kunden_id, termin.titel, termin.beschreibung, termin.datum, termin.uhrzeit_von, termin.uhrzeit_bis, termin.status, termin.farbe);
    return result.lastInsertRowid;
  }
});

ipcMain.handle('delete-termin', (event, id) => {
  db.prepare('DELETE FROM termine WHERE id = ?').run(id);
  return true;
});

// ============ Aufträge ============

ipcMain.handle('get-auftraege', () => {
  return db.prepare(`SELECT a.*, k.name as kunden_name FROM auftraege a LEFT JOIN kunden k ON a.kunden_id = k.id ORDER BY a.start_datum`).all();
});

ipcMain.handle('save-auftrag', (event, auftrag) => {
  if (auftrag.id) {
    db.prepare('UPDATE auftraege SET nummer=?, kunden_id=?, rechnungen_id=?, titel=?, beschreibung=?, status=?, prioritaet=?, start_datum=?, end_datum=? WHERE id=?')
      .run(auftrag.nummer, auftrag.kunden_id, auftrag.rechnungen_id, auftrag.titel, auftrag.beschreibung, auftrag.status, auftrag.prioritaet, auftrag.start_datum, auftrag.end_datum, auftrag.id);
    return auftrag.id;
  } else {
    const result = db.prepare('INSERT INTO auftraege (nummer, kunden_id, rechnungen_id, titel, beschreibung, status, prioritaet, start_datum, end_datum) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(auftrag.nummer, auftrag.kunden_id, auftrag.rechnungen_id, auftrag.titel, auftrag.beschreibung, auftrag.status, auftrag.prioritaet, auftrag.start_datum, auftrag.end_datum);
    return result.lastInsertRowid;
  }
});

ipcMain.handle('delete-auftrag', (event, id) => {
  db.prepare('DELETE FROM auftraege WHERE id = ?').run(id);
  return true;
});

// ============ PDF Export ============

ipcMain.handle('export-pdf', async (event, data) => {
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'PDF speichern',
    defaultPath: `${data.nummer}.pdf`,
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  if (!filePath) return false;

  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  doc.fontSize(20).text(data.titel, { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Nummer: ${data.nummer}`);
  doc.text(`Datum: ${data.datum}`);
  doc.text(`Kunde: ${data.kunden_name}`);
  doc.moveDown();

  if (data.positionen && data.positionen.length > 0) {
    doc.fontSize(14).text('Positionen:');
    doc.moveDown(0.5);
    doc.fontSize(10);
    for (const pos of data.positionen) {
      doc.text(`${pos.position}. ${pos.beschreibung} — ${pos.menge} ${pos.einheit} × ${pos.einzelpreis.toFixed(2)} € = ${pos.gesamt.toFixed(2)} €`);
    }
    doc.moveDown();
  }

  doc.fontSize(12).text(`Nettobetrag: ${data.betrag_netto.toFixed(2)} €`);
  doc.text(`MwSt. ${data.mwst_satz}%: ${(data.betrag_brutto - data.betrag_netto).toFixed(2)} €`);
  doc.fontSize(14).text(`Gesamtbetrag: ${data.betrag_brutto.toFixed(2)} €`, { continued: false });

  doc.end();
  return new Promise(resolve => stream.on('finish', () => resolve(true)));
});

// ============ Einstellungen ============

ipcMain.handle('get-einstellungen', () => {
  const settingsPath = path.join(dataDir, 'einstellungen.json');
  if (fs.existsSync(settingsPath)) {
    return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
  }
  return {
    firma: 'Meine Firma',
    anschrift: 'Musterstraße 1',
    plz_ort: '12345 Musterstadt',
    telefon: '0123 / 456789',
    email: 'info@firma.de',
    ust_id: 'DE123456789',
    iban: 'DE89 3704 0044 0532 0130 00',
    bic: 'COBADEFFXXX',
    waehrung: '€'
  };
});

ipcMain.handle('save-einstellungen', (event, settings) => {
  const settingsPath = path.join(dataDir, 'einstellungen.json');
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  return true;
});

// ============ Nummernkreise ============

ipcMain.handle('get-naechste-nummer', (event, prefix) => {
  const table = prefix === 'AN' ? 'angebote' : 'rechnungen';
  const row = db.prepare(`SELECT nummer FROM ${table} ORDER BY id DESC LIMIT 1`).get();
  if (row && row.nummer) {
    const num = parseInt(row.nummer.split('-')[1]) + 1;
    return `${prefix}-${String(num).padStart(5, '0')}`;
  }
  return `${prefix}-00001`;
});

// ============ Buchungen (Einnahmen/Ausgaben) ============

ipcMain.handle('get-buchungen', (event, filters = {}) => {
  let sql = 'SELECT b.*, k.name as kunden_name FROM buchungen b LEFT JOIN kunden k ON b.kunden_id = k.id WHERE 1=1';
  const params = [];
  
  if (filters.typ) {
    sql += ' AND b.typ = ?';
    params.push(filters.typ);
  }
  if (filters.von) {
    sql += ' AND b.datum >= ?';
    params.push(filters.von);
  }
  if (filters.bis) {
    sql += ' AND b.datum <= ?';
    params.push(filters.bis);
  }
  if (filters.kategorie) {
    sql += ' AND b.kategorie = ?';
    params.push(filters.kategorie);
  }
  
  sql += ' ORDER BY b.datum DESC, b.id DESC';
  return db.prepare(sql).all(...params);
});

ipcMain.handle('get-buchung', (event, id) => {
  return db.prepare('SELECT b.*, k.name as kunden_name FROM buchungen b LEFT JOIN kunden k ON b.kunden_id = k.id WHERE b.id = ?').get(id);
});

ipcMain.handle('save-buchung', (event, buchung) => {
  const mwstBetrag = buchung.betrag * buchung.mwst_satz / 100;
  
  if (buchung.id) {
    db.prepare('UPDATE buchungen SET typ=?, kategorie=?, betrag=?, datum=?, beschreibung=?, beleg_nummer=?, mwst_satz=?, mwst_betrag=?, kunden_id=?, rechnungen_id=? WHERE id=?')
      .run(buchung.typ, buchung.kategorie, buchung.betrag, buchung.datum, buchung.beschreibung, buchung.beleg_nummer, buchung.mwst_satz, mwstBetrag, buchung.kunden_id, buchung.rechnungen_id, buchung.id);
    return buchung.id;
  } else {
    const result = db.prepare('INSERT INTO buchungen (typ, kategorie, betrag, datum, beschreibung, beleg_nummer, mwst_satz, mwst_betrag, kunden_id, rechnungen_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(buchung.typ, buchung.kategorie, buchung.betrag, buchung.datum, buchung.beschreibung, buchung.beleg_nummer, buchung.mwst_satz, mwstBetrag, buchung.kunden_id, buchung.rechnungen_id);
    return result.lastInsertRowid;
  }
});

ipcMain.handle('delete-buchung', (event, id) => {
  db.prepare('DELETE FROM buchungen WHERE id = ?').run(id);
  return true;
});

ipcMain.handle('get-buchungen-statistik', (event, monat) => {
  const einnahmen = db.prepare("SELECT COALESCE(SUM(betrag),0) as summe, COALESCE(SUM(mwst_betrag),0) as mwst FROM buchungen WHERE typ = 'einnahme' AND strftime('%Y-%m', datum) = ?").get(monat);
  const ausgaben = db.prepare("SELECT COALESCE(SUM(betrag),0) as summe, COALESCE(SUM(mwst_betrag),0) as mwst FROM buchungen WHERE typ = 'ausgabe' AND strftime('%Y-%m', datum) = ?").get(monat);
  const rechnungenUmsatz = db.prepare("SELECT COALESCE(SUM(betrag_netto),0) as netto, COALESCE(SUM(betrag_brutto - betrag_netto),0) as mwst FROM rechnungen WHERE status = 'bezahlt' AND strftime('%Y-%m', bezahlt_am) = ?").get(monat);
  
  return {
    einnahmen: einnahmen.summe,
    einnahmenMwSt: einnahmen.mwst,
    ausgaben: ausgaben.summe,
    ausgabenMwSt: ausgaben.mwst,
    bilanz: einnahmen.summe - ausgaben.summe,
    rechnungenNetto: rechnungenUmsatz.netto,
    rechnungenMwSt: rechnungenUmsatz.mwst
  };
});

ipcMain.handle('get-ust-voranmeldung', (event, monat) => {
  const rechnungen = db.prepare("SELECT COALESCE(SUM(betrag_netto),0) as netto, COALESCE(SUM(betrag_brutto - betrag_netto),0) as mwst FROM rechnungen WHERE strftime('%Y-%m', erstellt) = ?").get(monat);
  const vorsteuer = db.prepare("SELECT COALESCE(SUM(mwst_betrag),0) as betrag FROM buchungen WHERE typ = 'ausgabe' AND strftime('%Y-%m', datum) = ?").get(monat);
  
  const ustPflichtig = rechnungen.netto;
  const ustBetrag = rechnungen.mwst;
  const vorsteuerAbzug = vorsteuer.betrag;
  const zahlbar = ustBetrag - vorsteuerAbzug;
  
  return {
    monat,
    ustPflichtig,
    ustBetrag,
    vorsteuerAbzug,
    zahlbar,
    rechnungenNetto: rechnungen.netto,
    rechnungenMwSt: rechnungen.mwst
  };
});

// ============ E-Rechnung (XRechnung XML) ============

ipcMain.handle('export-erechnung', async (event, rechnungId) => {
  const rechnung = db.prepare(`SELECT r.*, k.name as kunden_name, k.strasse, k.plz, k.ort, k.email as kunden_email, k.telefon as kunden_telefon FROM rechnungen r LEFT JOIN kunden k ON r.kunden_id = k.id WHERE r.id = ?`).get(rechnungId);
  if (!rechnung) return null;
  
  rechnung.positionen = db.prepare('SELECT * FROM rechnungen_positionen WHERE rechnungen_id = ? ORDER BY position').all(rechnungId);
  const settings = JSON.parse(fs.readFileSync(path.join(dataDir, 'einstellungen.json'), 'utf-8'));
  
  const now = new Date();
  const uuid = `urn:uuid:${now.getTime()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ID>${rechnung.nummer}</cbc:ID>
  <cbc:IssueDate>${rechnung.erstellt.split(' ')[0]}</cbc:IssueDate>
  <cbc:DueDate>${rechnung.faellig_am || ''}</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  
  <cac:OrderReference>
    <cbc:ID>${rechnung.nummer}</cbc:ID>
  </cac:OrderReference>
  
  <cac:SupplierParty>
    <cac:Party>
      <cac:PartyName>
        <cbc:Name>${settings.firma}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${settings.anschrift}</cbc:StreetName>
        <cbc:PostalZone>${settings.plz_ort.split(' ')[0]}</cbc:PostalZone>
        <cbc:CityName>${settings.plz_ort.split(' ').slice(1).join(' ')}</cbc:CityName>
        <cac:Country>
          <cbc:IdentificationCode>DE</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${settings.ust_id}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${settings.firma}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:SupplierParty>
  
  <cac:CustomerParty>
    <cac:Party>
      <cac:PartyName>
        <cbc:Name>${rechnung.kunden_name}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        ${rechnung.strasse ? `<cbc:StreetName>${rechnung.strasse}</cbc:StreetName>` : ''}
        ${rechnung.plz ? `<cbc:PostalZone>${rechnung.plz}</cbc:PostalZone>` : ''}
        ${rechnung.ort ? `<cbc:CityName>${rechnung.ort}</cbc:CityName>` : ''}
        <cac:Country>
          <cbc:IdentificationCode>DE</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      ${rechnung.kunden_email ? `<cac:Contact><cbc:ElectronicMail>${rechnung.kunden_email}</cbc:ElectronicMail></cac:Contact>` : ''}
    </cac:Party>
  </cac:CustomerParty>
  
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>
    <cbc:PaymentDueDate>${rechnung.faellig_am || ''}</cbc:PaymentDueDate>
    <cac:PayeeFinancialAccount>
      <cbc:ID>${settings.iban}</cbc:ID>
      <cbc:Name>${settings.firma}</cbc:Name>
      <cac:FinancialInstitutionBranch>
        <cbc:ID>${settings.bic}</cbc:ID>
      </cac:FinancialInstitutionBranch>
    </cac:PayeeFinancialAccount>
  </cac:PaymentMeans>
  
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="EUR">${(rechnung.betrag_brutto - rechnung.betrag_netto).toFixed(2)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="EUR">${rechnung.betrag_netto.toFixed(2)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="EUR">${(rechnung.betrag_brutto - rechnung.betrag_netto).toFixed(2)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>${rechnung.mwst_satz}</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="EUR">${rechnung.betrag_netto.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="EUR">${rechnung.betrag_netto.toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">${rechnung.betrag_brutto.toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="EUR">${rechnung.betrag_brutto.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  
  ${rechnung.positionen.map((pos, idx) => `
  <cac:InvoiceLine>
    <cbc:ID>${idx + 1}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="STK">${pos.menge}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="EUR">${pos.gesamt.toFixed(2)}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>${pos.beschreibung}</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>${rechnung.mwst_satz}</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="EUR">${pos.einzelpreis.toFixed(2)}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>`).join('')}
  
</Invoice>`;

  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'E-Rechnung speichern',
    defaultPath: `${rechnung.nummer}_XRechnung.xml`,
    filters: [{ name: 'XML', extensions: ['xml'] }]
  });
  
  if (!filePath) return false;
  fs.writeFileSync(filePath, xml, 'utf-8');
  return true;
});

// ============ CSV Import ============

ipcMain.handle('import-csv', async (event, options = {}) => {
  const { filePath } = await dialog.showOpenDialog(mainWindow, {
    title: 'CSV-Datei auswählen',
    filters: [{ name: 'CSV', extensions: ['csv'] }],
    properties: ['openFile']
  });
  
  if (!filePath || filePath.length === 0) return null;
  
  const content = fs.readFileSync(filePath[0], 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  
  if (lines.length < 2) return { error: 'CSV-Datei ist leer oder hat keine Datenzeilen' };
  
  // Trennzeichen erkennen
  const firstLine = lines[0];
  let delimiter = ';';
  if (firstLine.split(',').length > firstLine.split(';').length) {
    delimiter = ',';
  }
  
  // Header analysieren
  const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase().replace(/"/g, ''));
  
  // Spalten-Mapping
  const mapping = {};
  const knownFields = {
    'rechnungsnr': 'rechnungsnr', 'rechnungsnummer': 'rechnungsnr', 'nr': 'rechnungsnr', 'nummer': 'rechnungsnr',
    'datum': 'datum', 'rechnungsdatum': 'datum', 'belegdatum': 'datum',
    'kunde': 'kunde', 'kundenname': 'kunde', 'kunden_name': 'kunde', 'firma': 'kunde',
    'betrag': 'betrag', 'brutto': 'betrag', 'gesamtbetrag': 'betrag', 'rechnungsbetrag': 'betrag',
    'netto': 'netto', 'nettobetrag': 'netto',
    'mwst': 'mwst', 'ust': 'mwst', 'steuer': 'mwst',
    'status': 'status', 'rechnungsstatus': 'status'
  };
  
  headers.forEach((h, idx) => {
    for (const [key, field] of Object.entries(knownFields)) {
      if (h.includes(key)) {
        mapping[field] = idx;
        break;
      }
    }
  });
  
  // Daten parsen
  const imported = [];
  const errors = [];
  
  for (let i = 1; i < lines.length; i++) {
    try {
      const cols = lines[i].split(delimiter).map(c => c.trim().replace(/"/g, ''));
      
      const parseDate = (str) => {
        if (!str) return null;
        // DD.MM.YYYY
        const match = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
        if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
        // YYYY-MM-DD
        if (str.match(/^\d{4}-\d{2}-\d{2}$/)) return str;
        return null;
      };
      
      const parseEuro = (str) => {
        if (!str) return 0;
        // 1.234,56 → 1234.56
        return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
      };
      
      const row = {
        rechnungsnr: cols[mapping.rechnungsnr] || `CSV-${String(i).padStart(5, '0')}`,
        datum: parseDate(cols[mapping.datum]) || new Date().toISOString().split('T')[0],
        kunde: cols[mapping.kunde] || 'Unbekannt',
        betrag: parseEuro(cols[mapping.betrag]) || parseEuro(cols[mapping.netto]) || 0,
        mwst_satz: parseEuro(cols[mapping.mwst]) || 19,
        status: cols[mapping.status] || 'offen'
      };
      
      // Kunde finden oder erstellen
      let kundenId = null;
      const existingKunde = db.prepare('SELECT id FROM kunden WHERE name = ?').get(row.kunde);
      if (existingKunde) {
        kundenId = existingKunde.id;
      } else if (row.kunde !== 'Unbekannt') {
        const result = db.prepare('INSERT INTO kunden (name) VALUES (?)').run(row.kunde);
        kundenId = result.lastInsertRowid;
      }
      
      // Rechnung erstellen
      const betragNetto = row.betrag / (1 + row.mwst_satz / 100);
      const betragBrutto = row.betrag;
      
      const result = db.prepare('INSERT INTO rechnungen (nummer, kunden_id, titel, betrag_netto, mwst_satz, betrag_brutto, status, faellig_am, erstellt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(row.rechnungsnr, kundenId, `Import: ${row.rechnungsnr}`, betragNetto, row.mwst_satz, betragBrutto, row.status, row.datum, row.datum + ' 00:00:00');
      
      imported.push({ nr: row.rechnungsnr, betrag: betragBrutto });
    } catch (err) {
      errors.push({ zeile: i + 1, fehler: err.message });
    }
  }
  
  return { imported, errors, anzahlImportiert: imported.length, fehler: errors.length };
});

// ============ Einnahmen/Ausgaben automatisch aus Rechnungen ============

ipcMain.handle('rechnung-zu-buchung', (event, rechnungId) => {
  const rechnung = db.prepare('SELECT * FROM rechnungen WHERE id = ?').get(rechnungId);
  if (!rechnung || rechnung.status !== 'bezahlt') return false;
  
  // Prüfen ob bereits gebucht
  const existing = db.prepare('SELECT id FROM buchungen WHERE rechnungen_id = ?').get(rechnungId);
  if (existing) return false;
  
  db.prepare('INSERT INTO buchungen (typ, kategorie, betrag, datum, beschreibung, beleg_nummer, mwst_satz, mwst_betrag, kunden_id, rechnungen_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run('einnahme', 'Rechnung', rechnung.betrag_brutto, rechnung.bezahlt_am || rechnung.erstellt.split(' ')[0], `Rechnung ${rechnung.nummer}`, rechnung.nummer, rechnung.mwst_satz, rechnung.betrag_brutto - rechnung.betrag_netto, rechnung.kunden_id, rechnungId);
  
  return true;
});
