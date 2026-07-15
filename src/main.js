const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const Database = require('better-sqlite3');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');
const nodemailer = require('nodemailer');
const { spawn, execSync } = require('child_process');

const APP_VERSION = '2.3.1';
const APP_NAME = 'Handwerker-Software';

function xmlEsc(s) { return (s || '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;'); }
const COMPANY = 'Handwerker Software';
const LICENSE_SECRET = 'HW-K3y-2024-mN7pQ9xL';

let mainWindow;
let db;

const dataDir = path.join(app.getPath('userData'), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// ============ Lizenz-System ============

function getHardwareFingerprint() {
  const networkInterfaces = os.networkInterfaces();
  let mac = '';
  for (const name of Object.keys(networkInterfaces)) {
    for (const iface of networkInterfaces[name]) {
      if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
        mac = iface.mac;
        break;
      }
    }
    if (mac) break;
  }
  const hostname = os.hostname();
  const platform = os.platform();
  const cpus = os.cpus();
  const cpuModel = cpus.length > 0 ? cpus[0].model : 'unknown';
  const raw = `${hostname}|${mac}|${platform}|${cpuModel}`;
  return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 32);
}

function generateLicenseKey(fingerprint, tage) {
  const now = Date.now();
  const ablauf = now + (tage || 30) * 24 * 60 * 60 * 1000;
  const payload = `${fingerprint}|${ablauf}`;
  const hmac = crypto.createHmac('sha256', LICENSE_SECRET).update(payload).digest('hex').substring(0, 16);
  const b64 = Buffer.from(payload).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `HW-${b64}.${hmac}`;
}

function validateLicenseKey(key, fingerprint) {
  try {
    if (!key || !key.startsWith('HW-')) return { valid: false, grund: 'Ungültiger Lizenzschlüssel' };
    const parts = key.substring(3).split('.');
    if (parts.length !== 2) return { valid: false, grund: 'Ungültiges Format' };

    const b64 = parts[0].replace(/-/g, '+').replace(/_/g, '/');
    const payload = Buffer.from(b64, 'base64').toString('utf-8');
    const hmac = parts[1];

    const payloadHmac = crypto.createHmac('sha256', LICENSE_SECRET).update(payload).digest('hex').substring(0, 16);
    if (hmac !== payloadHmac) return { valid: false, grund: 'Lizenzschlüssel manipuliert' };

    const [keyFingerprint, ablaufStr] = payload.split('|');
    if (keyFingerprint !== fingerprint) return { valid: false, grund: 'Lizenz ist an einen anderen Computer gebunden' };

    const ablauf = parseInt(ablaufStr);
    if (Date.now() > ablauf) {
      const diff = Math.ceil((Date.now() - ablauf) / (1000 * 60 * 60 * 24));
      return { valid: false, grund: `Lizenz abgelaufen seit ${diff} Tag(en)` };
    }

    const tageRest = Math.ceil((ablauf - Date.now()) / (1000 * 60 * 60 * 24));
    return { valid: true, tageRest, ablaufDatum: new Date(ablauf).toLocaleDateString('de-DE') };
  } catch (e) {
    return { valid: false, grund: 'Lizenzschlüssel ungültig' };
  }
}

function getLicenseData() {
  const licensePath = path.join(dataDir, 'license.dat');
  if (fs.existsSync(licensePath)) {
    try {
      return JSON.parse(fs.readFileSync(licensePath, 'utf-8'));
    } catch { }
  }
  return { key: '', aktiviert: false };
}

function saveLicenseData(data) {
  const licensePath = path.join(dataDir, 'license.dat');
  fs.writeFileSync(licensePath, JSON.stringify(data, null, 2));
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

    CREATE TABLE IF NOT EXISTS lieferanten (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      ansprechpartner TEXT,
      strasse TEXT,
      plz TEXT,
      ort TEXT,
      telefon TEXT,
      email TEXT,
      iban TEXT,
      ust_id TEXT,
      notizen TEXT,
      erstellt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS eingangsrechnungen (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nummer TEXT UNIQUE NOT NULL,
      lieferanten_id INTEGER NOT NULL,
      titel TEXT,
      betrag_netto REAL DEFAULT 0,
      mwst_satz REAL DEFAULT 19,
      mwst_betrag REAL DEFAULT 0,
      betrag_brutto REAL DEFAULT 0,
      status TEXT DEFAULT 'offen',
      faellig_am DATE,
      bezahlt_am DATE,
      buchungen_id INTEGER,
      erechnung_xml TEXT,
      erstellt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lieferanten_id) REFERENCES lieferanten(id),
      FOREIGN KEY (buchungen_id) REFERENCES buchungen(id)
    );

    CREATE TABLE IF NOT EXISTS mahnungen (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rechnungen_id INTEGER NOT NULL,
      mahnstufe INTEGER NOT NULL DEFAULT 1,
      datum DATE NOT NULL,
      faellig_bis DATE,
      betrag REAL NOT NULL,
      gebuehr REAL DEFAULT 0,
      status TEXT DEFAULT 'offen',
      notizen TEXT,
      erstellt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (rechnungen_id) REFERENCES rechnungen(id)
    );

    CREATE TABLE IF NOT EXISTS gutschriften (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rechnungen_id INTEGER NOT NULL,
      betrag REAL NOT NULL,
      grund TEXT,
      datum DATE NOT NULL,
      erstellt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (rechnungen_id) REFERENCES rechnungen(id)
    );

    CREATE TABLE IF NOT EXISTS kasse (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      typ TEXT NOT NULL CHECK(typ IN ('einnahme', 'ausgabe')),
      betrag REAL NOT NULL,
      datum DATE NOT NULL,
      uhrzeit TEXT,
      beschreibung TEXT,
      kategorie TEXT,
      beleg_nummer TEXT,
      mitarbeiter TEXT,
      erstellt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS artikel (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sku TEXT UNIQUE,
      einheit TEXT DEFAULT 'Stk',
      einkaufspreis REAL DEFAULT 0,
      verkaufspreis REAL DEFAULT 0,
      mwst_satz REAL DEFAULT 19,
      bestand INTEGER DEFAULT 0,
      mindestbestand INTEGER DEFAULT 0,
      lagerplatz TEXT,
      barcode TEXT,
      kategorie TEXT,
      notizen TEXT,
      erstellt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS lagerbewegungen (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      artikel_id INTEGER NOT NULL,
      typ TEXT NOT NULL CHECK(typ IN ('eingang', 'ausgang', 'inventur', 'korrektur')),
      menge INTEGER NOT NULL,
      datum DATE NOT NULL,
      uhrzeit TEXT,
      grund TEXT,
      auftraege_id INTEGER,
      rechnungen_id INTEGER,
      mitarbeiter TEXT,
      erstellt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (artikel_id) REFERENCES artikel(id),
      FOREIGN KEY (auftraege_id) REFERENCES auftraege(id),
      FOREIGN KEY (rechnungen_id) REFERENCES rechnungen(id)
    );

    CREATE TABLE IF NOT EXISTS subunternehmer (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      ansprechpartner TEXT,
      strasse TEXT,
      plz TEXT,
      ort TEXT,
      telefon TEXT,
      email TEXT,
      iban TEXT,
      ust_id TEXT,
      stundensatz REAL DEFAULT 0,
      notizen TEXT,
      erstellt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS subunternehmer_einsatz (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subunternehmer_id INTEGER NOT NULL,
      auftraege_id INTEGER NOT NULL,
      datum DATE NOT NULL,
      stunden REAL DEFAULT 0,
      Beschreibung TEXT,
      betrag REAL DEFAULT 0,
      leistungsnachweis TEXT,
      status TEXT DEFAULT 'offen',
      rechnungen_id INTEGER,
      erstellt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (subunternehmer_id) REFERENCES subunternehmer(id),
      FOREIGN KEY (auftraege_id) REFERENCES auftraege(id),
      FOREIGN KEY (rechnungen_id) REFERENCES rechnungen(id)
    );

    CREATE TABLE IF NOT EXISTS aufmasse (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      auftraege_id INTEGER,
      kunden_id INTEGER,
      titel TEXT NOT NULL,
      datum DATE NOT NULL,
      notizen TEXT,
      fotos TEXT,
      erstellt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (auftraege_id) REFERENCES auftraege(id),
      FOREIGN KEY (kunden_id) REFERENCES kunden(id)
    );

    CREATE TABLE IF NOT EXISTS aufmasse_positionen (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      aufmasse_id INTEGER NOT NULL,
      position INTEGER NOT NULL,
      beschreibung TEXT NOT NULL,
      menge REAL DEFAULT 1,
      einheit TEXT DEFAULT 'm',
      breite REAL DEFAULT 0,
      hoehe REAL DEFAULT 0,
      flaeche REAL DEFAULT 0,
      einzelpreis REAL DEFAULT 0,
      gesamt REAL DEFAULT 0,
      FOREIGN KEY (aufmasse_id) REFERENCES aufmasse(id)
    );

    CREATE TABLE IF NOT EXISTS regeln (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      typ TEXT NOT NULL,
      bedingung TEXT NOT NULL,
      aktion TEXT NOT NULL,
      aktiv INTEGER DEFAULT 1,
      letzte_ausfuehrung DATETIME,
      erstellt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS aufgaben (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titel TEXT NOT NULL,
      beschreibung TEXT DEFAULT '',
      zustandig TEXT DEFAULT '',
      prioritaet TEXT DEFAULT 'normal',
      status TEXT DEFAULT 'offen',
      faelligkeit DATE,
      wiederholdung TEXT,
      quelle TEXT DEFAULT 'manuell',
      quelle_id INTEGER,
      erledigt_am DATETIME,
      erstellt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS konto_bewegungen (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      konto_nr TEXT NOT NULL,
      konto_name TEXT DEFAULT '',
      typ TEXT DEFAULT 'Soll',
      betrag REAL NOT NULL,
      gegenkonto TEXT DEFAULT '',
      buchungstitel TEXT DEFAULT '',
      beleg_nr TEXT DEFAULT '',
      buchungsdatum DATE NOT NULL,
      buchungstyp TEXT DEFAULT 'manuell',
      quelle_id INTEGER,
      quelle_tabelle TEXT,
      erstellt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS konto_kontenrahmen (
      konto_nr TEXT PRIMARY KEY,
      konto_name TEXT NOT NULL,
      kontoart TEXT DEFAULT 'Aktivkonto',
      ebene INTEGER DEFAULT 1,
      eltern_konto TEXT
    );
  `);
}

function createMenu() {
  const template = [
    {
      label: 'Datei',
      submenu: [
        {
          label: 'Neues Angebot',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow.webContents.send('navigate', 'angebote')
        },
        {
          label: 'Neue Rechnung',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: () => mainWindow.webContents.send('navigate', 'rechnungen')
        },
        { type: 'separator' },
        {
          label: 'CSV-Import...',
          click: () => mainWindow.webContents.send('navigate', 'import')
        },
        { type: 'separator' },
        {
          label: 'Einstellungen',
          accelerator: 'CmdOrCtrl+,',
          click: () => mainWindow.webContents.send('navigate', 'einstellungen')
        },
        { type: 'separator' },
        {
          label: 'Beenden',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Alt+F4',
          click: () => app.quit()
        }
      ]
    },
    {
      label: 'Bearbeiten',
      submenu: [
        { label: 'Rückgängig', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: 'Wiederholen', accelerator: 'CmdOrCtrl+Shift+Z', role: 'redo' },
        { type: 'separator' },
        { label: 'Ausschneiden', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: 'Kopieren', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: 'Einfügen', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { label: 'Alles auswählen', accelerator: 'CmdOrCtrl+A', role: 'selectAll' }
      ]
    },
    {
      label: 'Ansicht',
      submenu: [
        { label: 'Neu laden', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: 'Entwickler-Tools', accelerator: 'F12', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: 'Vergrößern', accelerator: 'CmdOrCtrl+=', role: 'zoomIn' },
        { label: 'Verkleinern', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { label: 'Standardgröße', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { type: 'separator' },
        { label: 'Vollbild', accelerator: 'F11', role: 'togglefullscreen' },
        { type: 'separator' },
        { label: 'Seitenleiste ein/aus', accelerator: 'CmdOrCtrl+B', click: () => mainWindow.webContents.send('toggle-sidebar') }
      ]
    },
    {
      label: 'Fenster',
      submenu: [
        { label: 'Minimieren', accelerator: 'CmdOrCtrl+M', role: 'minimize' },
        { label: 'Schließen', accelerator: 'CmdOrCtrl+W', role: 'close' },
        { type: 'separator' },
        { label: 'Neues Fenster', accelerator: 'CmdOrCtrl+Shift+M', role: 'newWindow' }
      ]
    },
    {
      label: 'Hilfe',
      submenu: [
        {
          label: `${APP_NAME} Hilfe`,
          click: () => shell.openExternal('https://software.intrasaar.de/IMHWS/docs/bedienerhandbuch.html')
        },
        { type: 'separator' },
        {
          label: 'Lizenz anzeigen',
          click: () => mainWindow.webContents.send('show-license')
        },
        {
          label: 'Über ' + APP_NAME,
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: `Über ${APP_NAME}`,
              message: APP_NAME,
              detail: `Version: ${APP_VERSION}\n${COMPANY}\n© ${new Date().getFullYear()} ${COMPANY}. Alle Rechte vorbehalten.\n\nLizenzierte Software. Weitergabe verboten.`
            });
          }
        }
      ]
    }
  ];

  if (process.platform === 'darwin') {
    template.unshift({
      label: APP_NAME,
      submenu: [
        { label: `Über ${APP_NAME}`, role: 'about' },
        { type: 'separator' },
        { label: 'Einstellungen', accelerator: 'Cmd+,', click: () => mainWindow.webContents.send('navigate', 'einstellungen') },
        { type: 'separator' },
        { label: `${APP_NAME} ausblenden`, accelerator: 'Cmd+H', role: 'hide' },
        { label: 'Alle ausblenden', accelerator: 'Cmd+Alt+H', role: 'hideOthers' },
        { type: 'separator' },
        { label: 'Beenden', accelerator: 'Cmd+Q', click: () => app.quit() }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
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
    titleBarStyle: process.platform === 'darwin' ? 'hidden' : 'default',
    backgroundColor: '#0f0f23'
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  createMenu();
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
  const umsatzMonat = db.prepare("SELECT COALESCE(SUM(betrag_brutto),0) as betrag FROM rechnungen WHERE strftime('%Y-%m', erstellt) = strftime('%Y-%m', 'now')").get();
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
  try {
    const angebot = db.prepare('SELECT * FROM angebote WHERE id = ?').get(angebotId);
    if (!angebot) {
      console.error('angebot-zu-rechnung: Angebot nicht gefunden, id=', angebotId);
      return null;
    }

    const nummer = 'RE-' + String(Date.now()).slice(-6);
    const faelligAm = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const result = db.prepare('INSERT INTO rechnungen (nummer, kunden_id, titel, beschreibung, betrag_netto, mwst_satz, betrag_brutto, status, faellig_am) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(nummer, angebot.kunden_id, angebot.titel, angebot.beschreibung, angebot.betrag_netto, angebot.mwst_satz, angebot.betrag_brutto, 'offen', faelligAm);
    const rechnungId = result.lastInsertRowid;

    const positionen = db.prepare('SELECT * FROM angebote_positionen WHERE angebote_id = ?').all(angebotId);
    const insert = db.prepare('INSERT INTO rechnungen_positionen (rechnungen_id, position, beschreibung, menge, einheit, einzelpreis, gesamt) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const pos of positionen) {
      insert.run(rechnungId, pos.position, pos.beschreibung, pos.menge, pos.einheit, pos.einzelpreis, pos.gesamt);
    }

    db.prepare("UPDATE angebote SET status = 'rechnung' WHERE id = ?").run(angebotId);
    return rechnungId;
  } catch (err) {
    console.error('angebot-zu-rechnung Fehler:', err.message);
    return null;
  }
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

// ============ PDF Export mit Briefkopf ============

function drawBriefkopf(doc, inst, y) {
  const left = 50;
  const right = doc.page.width - 50;
  const farbe = inst.briefkopf_farbe || '#1a1d27';

  // Logo (falls vorhanden)
  if (inst.briefkopf_logo) {
    try {
      const logoBuf = Buffer.from(inst.briefkopf_logo.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      const logoWidth = right - left;
      doc.image(logoBuf, left, y, { width: logoWidth, fit: [logoWidth, 80] });
      y += 88;
    } catch (e) { /* Logo-Laden fehlgeschlagen */ }
  }

  // Firmenname
  doc.fontSize(18).fillColor(farbe).text(inst.firma || '', left, y, { width: right - left });
  y = doc.y + 4;

  // Adresse
  doc.fontSize(9).fillColor('#444');
  const addrParts = [inst.anschrift, inst.plz_ort].filter(Boolean);
  if (addrParts.length) { doc.text(addrParts.join(', '), left, y, { width: right - left }); y = doc.y + 2; }

  // Kontakt
  const contactParts = [];
  if (inst.telefon) contactParts.push(`Tel: ${inst.telefon}`);
  if (inst.email) contactParts.push(inst.email);
  if (inst.website) contactParts.push(inst.website);
  if (contactParts.length) { doc.text(contactParts.join(' | '), left, y, { width: right - left }); y = doc.y + 2; }

  // USt-IdNr. rechts
  if (inst.ust_id) {
    doc.fontSize(8).fillColor('#888').text(`USt-IdNr.: ${inst.ust_id}`, right - 160, y - 14, { width: 160, align: 'right' });
  }

  // Trennlinie
  y = doc.y + 6;
  doc.moveTo(left, y).lineTo(right, y).lineWidth(1.5).strokeColor(farbe).stroke();
  y += 14;

  // Kopfzeile (falls vorhanden)
  if (inst.briefkopf_kopfzeile) {
    doc.fontSize(8).fillColor('#666').text(inst.briefkopf_kopfzeile, left, y, { width: right - left });
    y = doc.y + 8;
  }

  doc.fillColor('#000');
  return y;
}

function drawBrieffuss(doc, inst) {
  const left = 50;
  const right = doc.page.width - 50;
  const fussY = doc.page.height - 90;

  doc.fontSize(7).fillColor('#aaa');
  doc.moveTo(left, fussY).lineTo(right, fussY).lineWidth(0.5).strokeColor('#ddd').stroke();

  const fussParts = [];
  if (inst.firma) fussParts.push(inst.firma);
  if (inst.anschrift) fussParts.push(inst.anschrift);
  if (inst.plz_ort) fussParts.push(inst.plz_ort);
  if (fussParts.length) {
    const text = fussParts.join(' · ');
    const tw = doc.widthOfString(text);
    doc.text(text, (left + right) / 2 - tw / 2, fussY + 6, { lineBreak: false, continued: false });
  }

  const kontoParts = [];
  if (inst.iban) kontoParts.push(`IBAN: ${inst.iban}`);
  if (inst.bic) kontoParts.push(`BIC: ${inst.bic}`);
  if (kontoParts.length) {
    const text = kontoParts.join(' | ');
    const tw = doc.widthOfString(text);
    doc.text(text, (left + right) / 2 - tw / 2, fussY + 16, { lineBreak: false, continued: false });
  }

  if (inst.briefkopf_fusszeile) {
    const text = inst.briefkopf_fusszeile;
    const tw = doc.widthOfString(text);
    doc.text(text, (left + right) / 2 - tw / 2, fussY + 26, { lineBreak: false, continued: false });
  }
}

function generatePdfBuffer(data) {
  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks = [];
  doc.on('data', chunk => chunks.push(chunk));

  let inst;
  try {
    inst = JSON.parse(fs.readFileSync(path.join(dataDir, 'einstellungen.json'), 'utf-8'));
  } catch (e) {
    inst = {};
  }

  // Briefkopf zeichnen
  let y = drawBriefkopf(doc, inst, 50);

  // Dokumenttyp + Nummer
  const typName = data.titel.split(' ')[0] || 'Dokument';
  doc.fontSize(22).fillColor(inst.briefkopf_farbe || '#1a1d27').text(typName, 50, y, { align: 'left' });
  y = doc.y + 2;
  doc.fontSize(12).fillColor('#666').text(`Nr. ${data.nummer}`, 50, y);
  y = doc.y + 4;

  // Datum + Fälligkeit
  doc.fontSize(10).fillColor('#333');
  doc.text(`Datum: ${data.datum}`, 50, y);
  if (data.faellig_am) doc.text(`Fällig: ${data.faellig_am}`, 50, doc.y + 2);
  y = doc.y + 10;

  // Rechnungsempfänger
  if (data.kunden_name) {
    doc.fontSize(10).fillColor('#333').text('Empfänger:', 50, y);
    y = doc.y + 2;
    doc.fontSize(10).text(data.kunden_name, 50, y);
    if (data.kunden_strasse) { doc.text(data.kunden_strasse, 50, doc.y + 1); }
    if (data.kunden_plz || data.kunden_ort) { doc.text(`${data.kunden_plz || ''} ${data.kunden_ort || ''}`.trim(), 50, doc.y + 1); }
    y = doc.y + 12;
  }

  // Titel + Beschreibung
  if (data.untertitel) {
    doc.fontSize(11).fillColor('#333').text(data.untertitel, 50, y, { width: doc.page.width - 100 });
    y = doc.y + 4;
  }
  if (data.beschreibung) {
    doc.fontSize(9).fillColor('#555').text(data.beschreibung, 50, y, { width: doc.page.width - 100 });
    y = doc.y + 8;
  }

  // Positionstabelle
  if (data.positionen && data.positionen.length > 0) {
    const tableTop = y;
    const cols = { nr: 50, desc: 75, qty: 340, unit: 380, price: 420, total: 490 };
    const farbe = inst.briefkopf_farbe || '#1a1d27';

    // Header
    doc.fontSize(8).fillColor('#fff').rect(50, tableTop, doc.page.width - 100, 18).fill(farbe);
    doc.fillColor('#fff').text('#', cols.nr + 2, tableTop + 4, { width: 20 });
    doc.text('Beschreibung', cols.desc, tableTop + 4, { width: 260 });
    doc.text('Menge', cols.qty, tableTop + 4, { width: 35, align: 'right' });
    doc.text('Einh.', cols.unit, tableTop + 4, { width: 35 });
    doc.text('Einzelpreis', cols.price, tableTop + 4, { width: 65, align: 'right' });
    doc.text('Gesamt', cols.total, tableTop + 4, { width: 65, align: 'right' });

    y = tableTop + 22;
    doc.fillColor('#000');

    for (const pos of data.positionen) {
      if (y > doc.page.height - 120) {
        doc.addPage();
        y = 50;
      }
      doc.fontSize(9).fillColor('#333');
      doc.text(String(pos.position), cols.nr + 2, y, { width: 20 });
      doc.text(pos.beschreibung || '', cols.desc, y, { width: 260 });
      doc.text(String(pos.menge), cols.qty, y, { width: 35, align: 'right' });
      doc.text(pos.einheit || '', cols.unit, y, { width: 35 });
      doc.text(`${(pos.einzelpreis || 0).toFixed(2)} €`, cols.price, y, { width: 65, align: 'right' });
      doc.text(`${(pos.gesamt || 0).toFixed(2)} €`, cols.total, y, { width: 65, align: 'right' });
      y = doc.y + 3;
      doc.moveTo(50, y).lineTo(doc.page.width - 50, y).lineWidth(0.3).strokeColor('#ddd').stroke();
      y += 4;
    }
    y += 6;
  }

  // Summen
  const sumX = 350;
  doc.fontSize(10).fillColor('#333');
  doc.text(`Nettobetrag:`, sumX, y, { width: 90, align: 'left' });
  doc.text(`${(data.betrag_netto || 0).toFixed(2)} €`, 450, y, { width: 100, align: 'right' });
  y = doc.y + 4;
  doc.text(`MwSt. ${data.mwst_satz || 19}%:`, sumX, y, { width: 90, align: 'left' });
  doc.text(`${((data.betrag_brutto || 0) - (data.betrag_netto || 0)).toFixed(2)} €`, 450, y, { width: 100, align: 'right' });
  y = doc.y + 6;

  const farbe = inst.briefkopf_farbe || '#1a1d27';
  doc.moveTo(sumX, y).lineTo(doc.page.width - 50, y).lineWidth(1).strokeColor(farbe).stroke();
  y += 6;

  doc.fontSize(13).fillColor(farbe).font('Helvetica-Bold');
  doc.text(`Gesamtbetrag:`, sumX, y, { width: 90, align: 'left' });
  doc.text(`${(data.betrag_brutto || 0).toFixed(2)} €`, 440, y, { width: 110, align: 'right' });
  doc.font('Helvetica');
  y = doc.y + 14;

  // Zahlungshinweis
  if (inst.iban) {
    doc.fontSize(9).fillColor('#444');
    doc.text('Zahlungsdaten:', 50, y);
    y = doc.y + 2;
    doc.text(`IBAN: ${inst.iban}`, 50, y);
    if (inst.bic) doc.text(`BIC: ${inst.bic}`, 50, doc.y + 1);
    if (inst.firma) doc.text(`Kontoinhaber: ${inst.firma}`, 50, doc.y + 1);
    doc.text(`Verwendungszweck: ${data.nummer}`, 50, doc.y + 2);
  }

  // Fußzeile
  drawBrieffuss(doc, inst);

  return new Promise(resolve => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.end();
  });
}

ipcMain.handle('export-pdf', async (event, data) => {
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'PDF speichern',
    defaultPath: `${data.nummer}.pdf`,
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  if (!filePath) return false;

  const buffer = await generatePdfBuffer(data);
  fs.writeFileSync(filePath, buffer);
  return true;
});

ipcMain.handle('preview-pdf', async (event, data) => {
  try {
    const buffer = await generatePdfBuffer(data);
    const tmpPath = path.join(os.tmpdir(), `${data.nummer || 'vorschau'}.pdf`);
    fs.writeFileSync(tmpPath, buffer);
    shell.openPath(tmpPath);
    return true;
  } catch (err) {
    console.error('preview-pdf Fehler:', err.message);
    return false;
  }
});

ipcMain.handle('print-pdf', async (event, data) => {
  try {
    const buffer = await generatePdfBuffer(data);
    const tmpPath = path.join(os.tmpdir(), `${data.nummer || 'druck'}.pdf`);
    fs.writeFileSync(tmpPath, buffer);
    shell.openPath(tmpPath);
    return true;
  } catch (err) {
    console.error('print-pdf Fehler:', err.message);
    return false;
  }
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
    waehrung: '€',
    website: '',
    briefkopf_farbe: '#1a1d27',
    briefkopf_kopfzeile: '',
    briefkopf_fusszeile: '',
    briefkopf_logo: null
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

// ============ Lieferanten ============

ipcMain.handle('get-lieferanten', () => {
  return db.prepare('SELECT * FROM lieferanten ORDER BY name').all();
});

ipcMain.handle('get-lieferant', (event, id) => {
  return db.prepare('SELECT * FROM lieferanten WHERE id = ?').get(id);
});

ipcMain.handle('save-lieferant', (event, lieferant) => {
  if (lieferant.id) {
    db.prepare('UPDATE lieferanten SET name=?, ansprechpartner=?, strasse=?, plz=?, ort=?, telefon=?, email=?, iban=?, ust_id=?, notizen=? WHERE id=?')
      .run(lieferant.name, lieferant.ansprechpartner, lieferant.strasse, lieferant.plz, lieferant.ort, lieferant.telefon, lieferant.email, lieferant.iban, lieferant.ust_id, lieferant.notizen, lieferant.id);
    return lieferant.id;
  } else {
    const result = db.prepare('INSERT INTO lieferanten (name, ansprechpartner, strasse, plz, ort, telefon, email, iban, ust_id, notizen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(lieferant.name, lieferant.ansprechpartner, lieferant.strasse, lieferant.plz, lieferant.ort, lieferant.telefon, lieferant.email, lieferant.iban, lieferant.ust_id, lieferant.notizen);
    return result.lastInsertRowid;
  }
});

ipcMain.handle('delete-lieferant', (event, id) => {
  db.prepare('DELETE FROM lieferanten WHERE id = ?').run(id);
  return true;
});

// ============ Eingangsrechnungen ============

ipcMain.handle('get-eingangsrechnungen', () => {
  return db.prepare(`SELECT e.*, l.name as lieferant_name FROM eingangsrechnungen e LEFT JOIN lieferanten l ON e.lieferanten_id = l.id ORDER BY e.erstellt DESC`).all();
});

ipcMain.handle('get-eingangsrechnung', (event, id) => {
  return db.prepare(`SELECT e.*, l.name as lieferant_name FROM eingangsrechnungen e LEFT JOIN lieferanten l ON e.lieferanten_id = l.id WHERE e.id = ?`).get(id);
});

ipcMain.handle('save-eingangsrechnung', (event, data) => {
  if (data.id) {
    db.prepare('UPDATE eingangsrechnungen SET nummer=?, lieferanten_id=?, titel=?, betrag_netto=?, mwst_satz=?, mwst_betrag=?, betrag_brutto=?, status=?, faellig_am=?, bezahlt_am=? WHERE id=?')
      .run(data.nummer, data.lieferanten_id, data.titel, data.betrag_netto, data.mwst_satz, data.mwst_betrag, data.betrag_brutto, data.status, data.faellig_am, data.bezahlt_am, data.id);
    return data.id;
  } else {
    const result = db.prepare('INSERT INTO eingangsrechnungen (nummer, lieferanten_id, titel, betrag_netto, mwst_satz, mwst_betrag, betrag_brutto, status, faellig_am) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(data.nummer, data.lieferanten_id, data.titel, data.betrag_netto, data.mwst_satz, data.mwst_betrag, data.betrag_brutto, data.status, data.faellig_am);
    return result.lastInsertRowid;
  }
});

ipcMain.handle('delete-eingangsrechnung', (event, id) => {
  db.prepare('DELETE FROM eingangsrechnungen WHERE id = ?').run(id);
  return true;
});

ipcMain.handle('eingangsrechnung-zu-buchung', (event, id) => {
  const ein = db.prepare('SELECT * FROM eingangsrechnungen WHERE id = ?').get(id);
  if (!ein || ein.status !== 'bezahlt') return false;
  const existing = db.prepare('SELECT id FROM buchungen WHERE beleg_nummer = ? AND kategorie = ?').get(ein.nummer, 'Eingangsrechnung');
  if (existing) return false;
  const lieferant = db.prepare('SELECT name FROM lieferanten WHERE id = ?').get(ein.lieferanten_id);
  db.prepare('INSERT INTO buchungen (typ, kategorie, betrag, datum, beschreibung, beleg_nummer, mwst_satz, mwst_betrag, kunden_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run('ausgabe', 'Eingangsrechnung', ein.betrag_brutto, ein.bezahlt_am || ein.erstellt.split(' ')[0], `Eingang: ${lieferant ? lieferant.name : ''} ${ein.nummer}`, ein.nummer, ein.mwst_satz, ein.mwst_betrag, null);
  return true;
});

// ============ ZUGFeRD / E-Rechnung erweitern ============

ipcMain.handle('export-zugferd', async (event, rechnungId) => {
  const r = db.prepare(`SELECT r.*, k.name as kunden_name, k.strasse, k.plz, k.ort, k.email as kunden_email, k.telefon as kunden_telefon FROM rechnungen r LEFT JOIN kunden k ON r.kunden_id = k.id WHERE r.id = ?`).get(rechnungId);
  if (!r) return null;
  r.positionen = db.prepare('SELECT * FROM rechnungen_positionen WHERE rechnungen_id = ? ORDER BY position').all(rechnungId);
  const s = JSON.parse(fs.readFileSync(path.join(dataDir, 'einstellungen.json'), 'utf-8'));
  const now = new Date();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateComponents:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100"
  xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:ContextParameterID>urn:cen.eu:en16931:2017#compliant#urn:cen.eu:d16b:extended#2020</ram:ContextParameterID>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${r.nummer}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${r.erstellt.split(' ')[0].replace(/-/g, '')}</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:ApplicableHeaderTradeAgreement>
    <ram:BuyerReference>
      <ram:BuyerAssignedURI>${r.nummer}</ram:BuyerAssignedURI>
    </ram:BuyerReference>
    <ram:SellerTradeParty>
      <ram:Name>${xmlEsc(s.firma)}</ram:Name>
      <ram:PostalTradeAddress>
        <ram:StreetName>${xmlEsc(s.anschrift)}</ram:StreetName>
        <ram:Postcode>${xmlEsc(s.plz_ort.split(' ')[0])}</ram:Postcode>
        <ram:CityName>${xmlEsc(s.plz_ort.split(' ').slice(1).join(' '))}</ram:CityName>
        <ram:CountryID>DE</ram:CountryID>
      </ram:PostalTradeAddress>
      <ram:TaxRegistration>
        <ram:ID schemeID="9955">${xmlEsc(s.ust_id)}</ram:ID>
      </ram:TaxRegistration>
    </ram:SellerTradeParty>
    <ram:BuyerTradeParty>
      <ram:Name>${xmlEsc(r.kunden_name)}</ram:Name>
      ${r.strasse ? `<ram:PostalTradeAddress><ram:StreetName>${xmlEsc(r.strasse)}</ram:StreetName>${r.plz ? `<ram:Postcode>${xmlEsc(r.plz)}</ram:Postcode>` : ''}${r.ort ? `<ram:CityName>${xmlEsc(r.ort)}</ram:CityName>` : ''}<ram:CountryID>DE</ram:CountryID></ram:PostalTradeAddress>` : ''}
    </ram:BuyerTradeParty>
  </rsm:ApplicableHeaderTradeAgreement>
  <rsm:ApplicableHeaderTradeDelivery>
    <ram:ActualDeliveryDate>
      <udt:DateTimeString format="102">${r.erstellt.split(' ')[0].replace(/-/g, '')}</udt:DateTimeString>
    </ram:ActualDeliveryDate>
  </rsm:ApplicableHeaderTradeDelivery>
  <rsm:ApplicableHeaderTradePayment>
    <ram:DueDateDateTime>
      <udt:DateTimeString format="102">${(r.faellig_am || r.erstellt.split(' ')[0]).replace(/-/g, '')}</udt:DateTimeString>
    </ram:DueDateDateTime>
    <ram:ApplicableTradePaymentTerms>
      <ram:Description>${r.faellig_am ? xmlEsc(`Zahlbar bis ${r.faellig_am}`) : 'Zahlbar innerhalb 30 Tagen'}</ram:Description>
    </ram:ApplicableTradePaymentTerms>
    <ram:ApplicableTradeSettlementFinancialAccount>
      <ram:IBANID>${xmlEsc(s.iban)}</ram:IBANID>
    </ram:ApplicableTradeSettlementFinancialAccount>
  </rsm:ApplicableHeaderTradePayment>
  <rsm:ApplicableHeaderTradeApplicableHeaderTradeAgreement>
    <ram:BuyerReference>
      <ram:BuyerAssignedURI>${r.nummer}</ram:BuyerAssignedURI>
    </ram:BuyerReference>
  </rsm:ApplicableHeaderTradeApplicableHeaderTradeAgreement>
  <rsm:ApplicableHeaderTradeTax>
    <ram:CalculatedAmount>${(r.betrag_brutto - r.betrag_netto).toFixed(2)}</ram:CalculatedAmount>
    <ram:BasisAmount>${r.betrag_netto.toFixed(2)}</ram:BasisAmount>
    <ram:CategoryCode>S</ram:CategoryCode>
    <ram:RateApplicablePercent>${r.mwst_satz}</ram:RateApplicablePercent>
    <ram:TypeCode>VAT</ram:TypeCode>
  </rsm:ApplicableHeaderTradeTax>
  <rsm:ApplicableHeaderTradeMonetarySummation>
    <ram:LineTotalAmount currencyID="EUR">${r.betrag_netto.toFixed(2)}</ram:LineTotalAmount>
    <ram:ChargeTotalAmount currencyID="EUR">0.00</ram:ChargeTotalAmount>
    <ram:AllowanceTotalAmount currencyID="EUR">0.00</ram:AllowanceTotalAmount>
    <ram:TaxBasisTotalAmount currencyID="EUR">${r.betrag_netto.toFixed(2)}</ram:TaxBasisTotalAmount>
    <ram:TaxTotalAmount currencyID="EUR">${(r.betrag_brutto - r.betrag_netto).toFixed(2)}</ram:TaxTotalAmount>
    <ram:GrandTotalAmount currencyID="EUR">${r.betrag_brutto.toFixed(2)}</ram:GrandTotalAmount>
  </rsm:ApplicableHeaderTradeMonetarySummation>
  <rsm:ApplicableHeaderTradeSettlementPaymentMeans>
    <ram:TypeCode>30</ram:TypeCode>
    <ram:Information>Überweisung</ram:Information>
  </rsm:ApplicableHeaderTradeSettlementPaymentMeans>
  <rsm:SupplyChainTradeTransaction>
    ${r.positionen.map((pos, idx) => `
    <ram:ApplicableHeaderTradeAgreement>
      <ram:BuyerReference>
        <ram:BuyerAssignedURI>${r.nummer}</ram:BuyerAssignedURI>
      </ram:BuyerReference>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery>
      <ram:ActualDeliveryDate>
        <udt:DateTimeString format="102">${r.erstellt.split(' ')[0].replace(/-/g, '')}</udt:DateTimeString>
      </ram:ActualDeliveryDate>
    </ram:ApplicableHeaderTradeDelivery>
    <ram:ApplicableHeaderTradeTax>
      <ram:CalculatedAmount>${(pos.gesamt * r.mwst_satz / (100 + r.mwst_satz)).toFixed(2)}</ram:CalculatedAmount>
      <ram:BasisAmount>${(pos.gesamt * 100 / (100 + r.mwst_satz)).toFixed(2)}</ram:BasisAmount>
      <ram:CategoryCode>S</ram:CategoryCode>
      <ram:RateApplicablePercent>${r.mwst_satz}</ram:RateApplicablePercent>
      <ram:TypeCode>VAT</ram:TypeCode>
    </ram:ApplicableHeaderTradeTax>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:ApplicableTradeSettlementFinancialAccount>
        <ram:IBANID>${xmlEsc(s.iban)}</ram:IBANID>
      </ram:ApplicableTradeSettlementFinancialAccount>
    </ram:ApplicableHeaderTradeSettlement>
    <ram:ApplicableHeaderTradeSettlementPaymentMeans>
      <ram:TypeCode>30</ram:TypeCode>
      <ram:Information>Überweisung</ram:Information>
    </ram:ApplicableHeaderTradeSettlementPaymentMeans>
    <ram:SpecifiedLineTradeAgreement>
      <ram:NetPriceApplicableTradePrice>
        <ram:ChargeAmount>${pos.einzelpreis.toFixed(2)}</ram:ChargeAmount>
        <ram:BasisQuantity unitCode="STK">1</ram:BasisQuantity>
      </ram:NetPriceApplicableTradePrice>
    </ram:SpecifiedLineTradeAgreement>
    <ram:SpecifiedLineTradeDelivery>
      <ram:BilledQuantity unitCode="STK">${pos.menge}</ram:BilledQuantity>
    </ram:SpecifiedLineTradeDelivery>
    <ram:SpecifiedLineTradeSettlement>
      <ram:LineNetAmount currencyID="EUR">${pos.gesamt.toFixed(2)}</ram:LineNetAmount>
    </ram:SpecifiedLineTradeSettlement>
    <ram:SpecifiedTradeProduct>
      <ram:Name>${xmlEsc(pos.beschreibung)}</ram:Name>
    </ram:SpecifiedTradeProduct>
    <ram:AssociatedDocumentLineDocument>
      <ram:LineID>${idx + 1}</ram:LineID>
    </ram:AssociatedDocumentLineDocument>`).join('\n    ')}
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;

  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'ZUGFeRD-Rechnung speichern',
    defaultPath: `${r.nummer}_ZUGFeRD.xml`,
    filters: [{ name: 'XML', extensions: ['xml'] }]
  });
  if (!filePath) return false;
  fs.writeFileSync(filePath, xml, 'utf-8');
  return true;
});

// ============ DATEV-Export ============

ipcMain.handle('export-datev', async (event, monat) => {
  const buchungen = db.prepare(`SELECT b.*, k.name as kunden_name FROM buchungen b LEFT JOIN kunden k ON b.kunden_id = k.id WHERE strftime('%Y-%m', b.datum) = ? ORDER BY b.datum`).all(monat);
  if (buchungen.length === 0) return { error: 'Keine Buchungen für diesen Monat gefunden' };

  const settings = JSON.parse(fs.readFileSync(path.join(dataDir, 'einstellungen.json'), 'utf-8'));
  let csv = 'Umsatz;Soll/Haben;Konto;Gegenkonto;Belegdatum;Buchungstext;Belegnummer\n';
  
  for (const b of buchungen) {
    const betrag = b.typ === 'einnahme' ? b.betrag.toFixed(2) : (-b.betrag).toFixed(2);
    const sh = b.typ === 'einnahme' ? 'H' : 'S';
    const konto = b.typ === 'einnahme' ? '8400' : '6200';
    const gegenkonto = b.typ === 'einnahme' ? '1200' : '3320';
    const buchungstext = `${b.beschreibung}${b.kunden_name ? ' (' + b.kunden_name + ')' : ''}`.replace(/;/g, ',');
    
    csv += `${betrag};${sh};${konto};${gegenkonto};${b.datum};${buchungstext};${b.beleg_nummer || ''}\n`;
  }

  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'DATEV-Export speichern',
    defaultPath: `DATEV_${monat}.csv`,
    filters: [{ name: 'CSV', extensions: ['csv'] }]
  });
  if (!filePath) return false;
  fs.writeFileSync(filePath, csv, 'utf-8');
  return true;
});

ipcMain.handle('export-ust-voranmeldung', async (event, monat) => {
  const buchungen = db.prepare(`SELECT * FROM buchungen WHERE strftime('%Y-%m', datum) = ?`).all(monat);
  let umsatzNetto = 0, ustUmsatz = 0, vorsteuer = 0;
  for (const b of buchungen) {
    if (b.typ === 'einnahme') {
      umsatzNetto += b.betrag / (1 + b.mwst_satz / 100);
      if (b.mwst_satz === 19) ustUmsatz += b.betrag / (1 + b.mwst_satz / 100);
    } else {
      vorsteuer += b.mwst_betrag;
    }
  }
  const ustBetrag = ustUmsatz * 0.19;
  const zahlbar = ustBetrag - vorsteuer;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ust:UStVA xmlns:ust="http://www.bundesfinanzministerium.de/Export" version="2024">
  <ust:ZusammenfassendeMeldung>
    <ust:Zeitraum>${monat}</ust:Zeitraum>
    <ust:Umsaetze>
      <ust:UmsatzArt code="1"><ust:Betrag>${umsatzNetto.toFixed(2)}</ust:Betrag></ust:UmsatzArt>
    </ust:Umsaetze>
    <ust:Steuer>
      <ust:SteuerArt code="1"><ust:Betrag>${ustBetrag.toFixed(2)}</ust:Betrag></ust:SteuerArt>
    </ust:Steuer>
    <ust:Vorauszahlung>${zahlbar.toFixed(2)}</ust:Vorauszahlung>
  </ust:ZusammenfassendeMeldung>
</ust:UStVA>`;

  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'USt-Voranmeldung speichern',
    defaultPath: `USt-Voranmeldung_${monat}.xml`,
    filters: [{ name: 'XML', extensions: ['xml'] }]
  });
  if (!filePath) return false;
  fs.writeFileSync(filePath, xml, 'utf-8');
  return true;
});

// ============ Mahnwesen ============

ipcMain.handle('get-mahnungen', () => {
  return db.prepare(`SELECT m.*, r.nummer as rechnung_nummer, k.name as kunden_name FROM mahnungen m LEFT JOIN rechnungen r ON m.rechnungen_id = r.id LEFT JOIN kunden k ON r.kunden_id = k.id ORDER BY m.erstellt DESC`).all();
});

ipcMain.handle('mahnung-erstellen', (event, rechnungId) => {
  const rechnung = db.prepare('SELECT * FROM rechnungen WHERE id = ?').get(rechnungId);
  if (!rechnung || rechnung.status === 'bezahlt') return null;

  const letzteMahnung = db.prepare('SELECT MAX(mahnstufe) as stufe FROM mahnungen WHERE rechnungen_id = ?').get(rechnungId);
  const neueStufe = (letzteMahnung.stufe || 0) + 1;
  if (neueStufe > 3) return null;

  const gebuehren = { 1: 0, 2: 5, 3: 10 };
  const now = new Date();
  const faelligBis = new Date(now);
  faelligBis.setDate(faelligBis.getDate() + (neueStufe === 1 ? 14 : neueStufe === 2 ? 7 : 3));

  const result = db.prepare('INSERT INTO mahnungen (rechnungen_id, mahnstufe, datum, faellig_bis, betrag, gebuehr, status) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(rechnungId, neueStufe, now.toISOString().split('T')[0], faelligBis.toISOString().split('T')[0], rechnung.betrag_brutto, gebuehren[neueStufe], 'offen');
  return result.lastInsertRowid;
});

ipcMain.handle('mahnung-bezahlen', (event, id) => {
  db.prepare("UPDATE mahnungen SET status = 'bezahlt' WHERE id = ?").run(id);
  return true;
});

// ============ Gutschriften (Rechnungskorrekturen) ============

ipcMain.handle('get-gutschriften', (event, rechnungId) => {
  if (rechnungId) {
    return db.prepare('SELECT * FROM gutschriften WHERE rechnungen_id = ? ORDER BY erstellt DESC').all(rechnungId);
  }
  return db.prepare(`SELECT g.*, r.nummer as rechnung_nummer, k.name as kunden_name FROM gutschriften g LEFT JOIN rechnungen r ON g.rechnungen_id = r.id LEFT JOIN kunden k ON r.kunden_id = k.id ORDER BY g.erstellt DESC`).all();
});

ipcMain.handle('gutschrift-erstellen', (event, data) => {
  const { rechnungen_id, betrag, grund } = data;
  const rechnung = db.prepare('SELECT * FROM rechnungen WHERE id = ?').get(rechnungen_id);
  if (!rechnung) return { error: 'Rechnung nicht gefunden' };
  if (rechnung.status === 'bezahlt') return { error: 'Rechnung ist bereits bezahlt' };
  if (betrag <= 0) return { error: 'Betrag muss positiv sein' };

  const offenerBetrag = rechnung.betrag_brutto;
  const tatsaechlicherBetrag = Math.min(betrag, offenerBetrag);
  const neuerBetrag = Math.max(0, offenerBetrag - tatsaechlicherBetrag);
  const neuerNetto = rechnung.betrag_netto * (neuerBetrag / offenerBetrag);
  const neuerStatus = neuerBetrag <= 0 ? 'bezahlt' : rechnung.status;

  db.prepare('INSERT INTO gutschriften (rechnungen_id, betrag, grund, datum) VALUES (?, ?, ?, date(\'now\'))')
    .run(rechnungen_id, tatsaechlicherBetrag, grund || '');
  db.prepare('UPDATE rechnungen SET betrag_brutto = ?, betrag_netto = ?, status = ?, bezahlt_am = CASE WHEN ? = \'bezahlt\' THEN date(\'now\') ELSE bezahlt_am END WHERE id = ?')
    .run(neuerBetrag, neuerNetto, neuerStatus, neuerStatus, rechnungen_id);

  return { success: true, tatsaechlicherBetrag, neuerBetrag, neuerStatus };
});

// ============ Kassenbuch ============

ipcMain.handle('get-kasse', (event, filters = {}) => {
  let sql = 'SELECT * FROM kasse WHERE 1=1';
  const params = [];
  if (filters.von) { sql += ' AND datum >= ?'; params.push(filters.von); }
  if (filters.bis) { sql += ' AND datum <= ?'; params.push(filters.bis); }
  if (filters.typ) { sql += ' AND typ = ?'; params.push(filters.typ); }
  sql += ' ORDER BY datum DESC, uhrzeit DESC';
  return db.prepare(sql).all(...params);
});

ipcMain.handle('save-kasse', (event, eintrag) => {
  if (eintrag.id) {
    db.prepare('UPDATE kasse SET typ=?, betrag=?, datum=?, uhrzeit=?, beschreibung=?, kategorie=?, beleg_nummer=?, mitarbeiter=? WHERE id=?')
      .run(eintrag.typ, eintrag.betrag, eintrag.datum, eintrag.uhrzeit, eintrag.beschreibung, eintrag.kategorie, eintrag.beleg_nummer, eintrag.mitarbeiter, eintrag.id);
    return eintrag.id;
  } else {
    const result = db.prepare('INSERT INTO kasse (typ, betrag, datum, uhrzeit, beschreibung, kategorie, beleg_nummer, mitarbeiter) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(eintrag.typ, eintrag.betrag, eintrag.datum, eintrag.uhrzeit, eintrag.beschreibung, eintrag.kategorie, eintrag.beleg_nummer, eintrag.mitarbeiter);
    return result.lastInsertRowid;
  }
});

ipcMain.handle('delete-kasse', (event, id) => {
  db.prepare('DELETE FROM kasse WHERE id = ?').run(id);
  return true;
});

ipcMain.handle('kasse-stand', () => {
  const einnahmen = db.prepare("SELECT COALESCE(SUM(betrag),0) as summe FROM kasse WHERE typ='einnahme'").get();
  const ausgaben = db.prepare("SELECT COALESCE(SUM(betrag),0) as summe FROM kasse WHERE typ='ausgabe'").get();
  return { einnahmen: einnahmen.summe, ausgaben: ausgaben.summe, kassenstand: einnahmen.summe - ausgaben.summe };
});

// ============ Warenwirtschaft / Artikel ============

ipcMain.handle('get-artikel', () => {
  return db.prepare('SELECT * FROM artikel ORDER BY name').all();
});

ipcMain.handle('get-artikel-einzel', (event, id) => {
  return db.prepare('SELECT * FROM artikel WHERE id = ?').get(id);
});

ipcMain.handle('save-artikel', (event, data) => {
  if (data.id) {
    db.prepare('UPDATE artikel SET name=?, sku=?, einheit=?, einkaufspreis=?, verkaufspreis=?, mwst_satz=?, bestand=?, mindestbestand=?, lagerplatz=?, barcode=?, kategorie=?, notizen=? WHERE id=?')
      .run(data.name, data.sku, data.einheit, data.einkaufspreis, data.verkaufspreis, data.mwst_satz, data.bestand, data.mindestbestand, data.lagerplatz, data.barcode, data.kategorie, data.notizen, data.id);
    return data.id;
  } else {
    const result = db.prepare('INSERT INTO artikel (name, sku, einheit, einkaufspreis, verkaufspreis, mwst_satz, bestand, mindestbestand, lagerplatz, barcode, kategorie, notizen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(data.name, data.sku, data.einheit, data.einkaufspreis, data.verkaufspreis, data.mwst_satz, data.bestand, data.mindestbestand, data.lagerplatz, data.barcode, data.kategorie, data.notizen);
    return result.lastInsertRowid;
  }
});

ipcMain.handle('delete-artikel', (event, id) => {
  db.prepare('DELETE FROM artikel WHERE id = ?').run(id);
  return true;
});

ipcMain.handle('lagerbewegung', (event, data) => {
  const artikel = db.prepare('SELECT * FROM artikel WHERE id = ?').get(data.artikel_id);
  if (!artikel) return null;

  const diff = data.typ === 'eingang' ? data.menge : (data.typ === 'ausgang' ? -data.menge : (data.typ === 'korrektur' ? data.menge : 0));
  db.prepare('UPDATE artikel SET bestand = bestand + ? WHERE id = ?').run(diff, data.artikel_id);

  db.prepare('INSERT INTO lagerbewegungen (artikel_id, typ, menge, datum, uhrzeit, grund, auftraege_id, rechnungen_id, mitarbeiter) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(data.artikel_id, data.typ, data.menge, data.datum, data.uhrzeit, data.grund, data.auftraege_id, data.rechnungen_id, data.mitarbeiter);

  if (artikel.bestand + diff <= artikel.mindestbestand) {
    return { warning: `Mindestbestand erreicht: ${artikel.name} (${artikel.bestand + diff} ${artikel.einheit})` };
  }
  return true;
});

ipcMain.handle('get-lagerbewegungen', (event, artikelId) => {
  return db.prepare('SELECT * FROM lagerbewegungen WHERE artikel_id = ? ORDER BY datum DESC, uhrzeit DESC').all(artikelId);
});

ipcMain.handle('mindestbestand-warnung', () => {
  return db.prepare('SELECT * FROM artikel WHERE bestand <= mindestbestand AND mindestbestand > 0 ORDER BY name').all();
});

// ============ Subunternehmer ============

ipcMain.handle('get-subunternehmer', () => {
  return db.prepare('SELECT * FROM subunternehmer ORDER BY name').all();
});

ipcMain.handle('get-subunternehmer-einzel', (event, id) => {
  return db.prepare('SELECT * FROM subunternehmer WHERE id = ?').get(id);
});

ipcMain.handle('save-subunternehmer', (event, data) => {
  if (data.id) {
    db.prepare('UPDATE subunternehmer SET name=?, ansprechpartner=?, strasse=?, plz=?, ort=?, telefon=?, email=?, iban=?, ust_id=?, stundensatz=?, notizen=? WHERE id=?')
      .run(data.name, data.ansprechpartner, data.strasse, data.plz, data.ort, data.telefon, data.email, data.iban, data.ust_id, data.stundensatz, data.notizen, data.id);
    return data.id;
  } else {
    const result = db.prepare('INSERT INTO subunternehmer (name, ansprechpartner, strasse, plz, ort, telefon, email, iban, ust_id, stundensatz, notizen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(data.name, data.ansprechpartner, data.strasse, data.plz, data.ort, data.telefon, data.email, data.iban, data.ust_id, data.stundensatz, data.notizen);
    return result.lastInsertRowid;
  }
});

ipcMain.handle('delete-subunternehmer', (event, id) => {
  db.prepare('DELETE FROM subunternehmer WHERE id = ?').run(id);
  return true;
});

ipcMain.handle('save-sub-einsatz', (event, data) => {
  if (data.id) {
    db.prepare('UPDATE subunternehmer_einsatz SET subunternehmer_id=?, auftraege_id=?, datum=?, stunden=?, Beschreibung=?, betrag=?, status=? WHERE id=?')
      .run(data.subunternehmer_id, data.auftraege_id, data.datum, data.stunden, data.Beschreibung, data.betrag, data.status, data.id);
    return data.id;
  } else {
    const result = db.prepare('INSERT INTO subunternehmer_einsatz (subunternehmer_id, auftraege_id, datum, stunden, Beschreibung, betrag, status) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(data.subunternehmer_id, data.auftraege_id, data.datum, data.stunden, data.Beschreibung, data.betrag, data.status);
    return result.lastInsertRowid;
  }
});

ipcMain.handle('get-sub-einsaetze', (event, subId) => {
  return db.prepare(`SELECT se.*, su.name as sub_name, a.titel as auftrag_titel FROM subunternehmer_einsatz se LEFT JOIN subunternehmer su ON se.subunternehmer_id = su.id LEFT JOIN auftraege a ON se.auftraege_id = a.id WHERE se.subunternehmer_id = ? ORDER BY se.datum DESC`).all(subId);
});

// ============ Aufmaß ============

ipcMain.handle('get-aufmasse', () => {
  return db.prepare(`SELECT af.*, k.name as kunden_name, a.titel as auftrag_titel FROM aufmasse af LEFT JOIN kunden k ON af.kunden_id = k.id LEFT JOIN auftraege a ON af.auftraege_id = a.id ORDER BY af.datum DESC`).all();
});

ipcMain.handle('get-aufmass-einzel', (event, id) => {
  const af = db.prepare(`SELECT af.*, k.name as kunden_name, a.titel as auftrag_titel FROM aufmasse af LEFT JOIN kunden k ON af.kunden_id = k.id LEFT JOIN auftraege a ON af.auftraege_id = a.id WHERE af.id = ?`).get(id);
  if (af) {
    af.positionen = db.prepare('SELECT * FROM aufmasse_positionen WHERE aufmasse_id = ? ORDER BY position').all(id);
  }
  return af;
});

ipcMain.handle('save-aufmass', (event, data) => {
  const { aufmass, positionen } = data;
  let aufmassId;
  if (aufmass.id) {
    db.prepare('UPDATE aufmasse SET auftraege_id=?, kunden_id=?, titel=?, datum=?, notizen=? WHERE id=?')
      .run(aufmass.auftraege_id, aufmass.kunden_id, aufmass.titel, aufmass.datum, aufmass.notizen, aufmass.id);
    aufmassId = aufmass.id;
    db.prepare('DELETE FROM aufmasse_positionen WHERE aufmasse_id = ?').run(aufmassId);
  } else {
    const result = db.prepare('INSERT INTO aufmasse (auftraege_id, kunden_id, titel, datum, notizen) VALUES (?, ?, ?, ?, ?)')
      .run(aufmass.auftraege_id, aufmass.kunden_id, aufmass.titel, aufmass.datum, aufmass.notizen);
    aufmassId = result.lastInsertRowid;
  }
  const insert = db.prepare('INSERT INTO aufmasse_positionen (aufmasse_id, position, beschreibung, menge, einheit, breite, hoehe, flaeche, einzelpreis, gesamt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  for (const pos of positionen) {
    insert.run(aufmassId, pos.position, pos.beschreibung, pos.menge, pos.einheit, pos.breite, pos.hoehe, pos.flaeche, pos.einzelpreis, pos.gesamt);
  }
  return aufmassId;
});

ipcMain.handle('delete-aufmass', (event, id) => {
  db.prepare('DELETE FROM aufmasse_positionen WHERE aufmasse_id = ?').run(id);
  db.prepare('DELETE FROM aufmasse WHERE id = ?').run(id);
  return true;
});

// ============ Regel-/Ereignissystem ============

ipcMain.handle('get-regeln', () => {
  return db.prepare('SELECT * FROM regeln ORDER BY name').all();
});

ipcMain.handle('save-regel', (event, data) => {
  if (data.id) {
    db.prepare('UPDATE regeln SET name=?, typ=?, bedingung=?, aktion=?, aktiv=? WHERE id=?')
      .run(data.name, data.typ, data.bedingung, data.aktion, data.aktiv, data.id);
    return data.id;
  } else {
    const result = db.prepare('INSERT INTO regeln (name, typ, bedingung, aktion, aktiv) VALUES (?, ?, ?, ?, ?)')
      .run(data.name, data.typ, data.bedingung, data.aktion, data.aktiv);
    return result.lastInsertRowid;
  }
});

ipcMain.handle('delete-regel', (event, id) => {
  db.prepare('DELETE FROM regeln WHERE id = ?').run(id);
  return true;
});

// ============ DATANORM ============

const { parseDATANORM, writeDATANORM, importDATANORMInDB } = require('./datanorm');

ipcMain.handle('import-datanorm', async (event) => {
  const { filePath } = await dialog.showOpenDialog(mainWindow, {
    title: 'DATANORM-Datei auswählen',
    filters: [{ name: 'DATANORM', extensions: ['dno', 'dat', 'txt'] }],
    properties: ['openFile']
  });
  if (!filePath || filePath.length === 0) return null;
  return importDATANORMInDB(filePath[0], db);
});

ipcMain.handle('export-datanorm', async (event, artikel) => {
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'DATANORM-Datei speichern',
    defaultPath: 'export.dno',
    filters: [{ name: 'DATANORM', extensions: ['dno'] }]
  });
  if (!filePath) return false;

  const lieferant = JSON.parse(fs.readFileSync(path.join(dataDir, 'einstellungen.json'), 'utf-8')) || {};
  const daten = artikel || db.prepare('SELECT * FROM artikel ORDER BY name').all();

  const datanormArtikel = daten.map(a => ({
    nummer: a.sku || a.barcode || `ART-${a.id}`,
    bezeichnung: a.name,
    einheit: a.einheit || 'Stk',
    preis: a.einkaufspreis || 0,
    mwst: a.mwst_satz || 19,
    lieferbar: a.bestand > 0
  }));

  const content = writeDATANORM({ lieferant: lieferant.firma || 'Export' }, datanormArtikel);
  fs.writeFileSync(filePath, content, 'utf-8');
  return true;
});

// ============ GAEB ============

const { parseGAEB85, writeGAEB85, parseGAEB90, writeGAEB90, gaebZuAngebot, angebotZuGAEB } = require('./gaeb');

ipcMain.handle('import-gaeb85', async () => {
  const { filePath } = await dialog.showOpenDialog(mainWindow, {
    title: 'GAEB 85 Leistungsverzeichnis',
    filters: [{ name: 'GAEB', extensions: ['csv', 'txt', 'lb'] }],
    properties: ['openFile']
  });
  if (!filePath || filePath.length === 0) return null;
  const content = fs.readFileSync(filePath[0], 'utf-8');
  return parseGAEB85(content);
});

ipcMain.handle('import-gaeb90', async () => {
  const { filePath } = await dialog.showOpenDialog(mainWindow, {
    title: 'GAEB 90 Angebot',
    filters: [{ name: 'GAEB', extensions: ['csv', 'txt', 'ab'] }],
    properties: ['openFile']
  });
  if (!filePath || filePath.length === 0) return null;
  const content = fs.readFileSync(filePath[0], 'utf-8');
  return parseGAEB90(content);
});

ipcMain.handle('export-gaeb85', async (event, kopf, leistungen) => {
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'GAEB 85 speichern',
    defaultPath: 'leistungsverzeichnis.csv',
    filters: [{ name: 'GAEB', extensions: ['csv'] }]
  });
  if (!filePath) return false;
  fs.writeFileSync(filePath, writeGAEB85(kopf, leistungen), 'utf-8');
  return true;
});

ipcMain.handle('export-gaeb90', async (event, kopf, leistungen) => {
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'GAEB 90 speichern',
    defaultPath: 'angebot.csv',
    filters: [{ name: 'GAEB', extensions: ['csv'] }]
  });
  if (!filePath) return false;
  fs.writeFileSync(filePath, writeGAEB90(kopf, leistungen), 'utf-8');
  return true;
});

ipcMain.handle('gaeb-zu-angebot', (event, gaebDaten) => {
  return gaebZuAngebot(gaebDaten);
});

ipcMain.handle('rechnung-zu-gaeb90', (event, rechnungId) => {
  const r = db.prepare('SELECT * FROM rechnungen WHERE id = ?').get(rechnungId);
  if (!r) return null;
  const positionen = db.prepare('SELECT * FROM rechnungen_positionen WHERE rechnungen_id = ? ORDER BY position').all(rechnungId);
  const kunde = db.prepare('SELECT name FROM kunden WHERE id = ?').get(r.kunden_id);
  return angebotZuGAEB({ ...r, kunden_name: kunde ? kunde.name : '' }, positionen);
});

// ============ IDS-Connect / BMEcat ============

const { parseBMEcat, writeBMEcat, erstelleBestellung, bestellungZuXml, importKatalogInDB } = require('./ids-connect');

ipcMain.handle('import-bmecat', async () => {
  const { filePath } = await dialog.showOpenDialog(mainWindow, {
    title: 'BMEcat-Katalog importieren',
    filters: [{ name: 'BMEcat/XML', extensions: ['xml'] }],
    properties: ['openFile']
  });
  if (!filePath || filePath.length === 0) return null;
  return importKatalogInDB(filePath[0], db);
});

ipcMain.handle('export-bmecat', async () => {
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'BMEcat-Katalog speichern',
    defaultPath: 'katalog.xml',
    filters: [{ name: 'BMEcat/XML', extensions: ['xml'] }]
  });
  if (!filePath) return false;
  const artikel = db.prepare('SELECT * FROM artikel ORDER BY name').all();
  const einstellungen = JSON.parse(fs.readFileSync(path.join(dataDir, 'einstellungen.json'), 'utf-8')) || {};
  const xml = writeBMEcat({ lieferant: einstellungen.firma || '', name: 'Artikelkatalog', datum: new Date().toISOString().split('T')[0] }, artikel.map(a => ({
    nummer: a.sku || `ART-${a.id}`, bezeichnung: a.name, einheit: a.einheit, preis: a.einkaufspreis || 0, mwst: a.mwst_satz || 19, ean: a.barcode || '', kategorie: a.kategorie || ''
  })));
  fs.writeFileSync(filePath, xml, 'utf-8');
  return true;
});

ipcMain.handle('bestellung-erstellen', (event, data) => {
  const bestellung = erstelleBestellung(data.kunde, data.positionen, data.lieferant);
  const xml = bestellungZuXml(bestellung);

  dialog.showSaveDialog(mainWindow, {
    title: 'Bestellung speichern',
    defaultPath: `${bestellung.bestell_nr}.xml`,
    filters: [{ name: 'XML', extensions: ['xml'] }]
  }).then(({ filePath }) => {
    if (filePath) fs.writeFileSync(filePath, xml, 'utf-8');
  });

  return bestellung;
});

ipcMain.handle('lieferanten-kataloge', () => {
  return db.prepare("SELECT DISTINCT kategorie as name FROM artikel WHERE kategorie != '' ORDER BY kategorie").all();
});

ipcMain.handle('artikel-nach-kategorie', (event, kategorie) => {
  if (kategorie) {
    return db.prepare('SELECT * FROM artikel WHERE kategorie = ? ORDER BY name').all(kategorie);
  }
  return db.prepare('SELECT * FROM artikel ORDER BY name').all();
});

// ============ Lizenz IPC ============

ipcMain.handle('get-fingerprint', () => {
  return getHardwareFingerprint();
});

ipcMain.handle('check-license', () => {
  const license = getLicenseData();
  if (!license.key || !license.aktiviert) {
    return { valid: false, grund: 'Nicht aktiviert' };
  }
  const fp = getHardwareFingerprint();
  return validateLicenseKey(license.key, fp);
});

ipcMain.handle('activate-license', (event, key) => {
  const fp = getHardwareFingerprint();
  const result = validateLicenseKey(key, fp);
  if (result.valid) {
    saveLicenseData({ key, aktiviert: true, aktiviertAm: new Date().toISOString() });
  }
  return result;
});

ipcMain.handle('get-app-info', () => {
  return { version: APP_VERSION, name: APP_NAME, company: COMPANY };
});

// ============ Aufgabenverwaltung ============

ipcMain.handle('get-aufgaben', (event, filters = {}) => {
  let sql = 'SELECT * FROM aufgaben WHERE 1=1';
  const params = [];
  if (filters.status) { sql += ' AND status = ?'; params.push(filters.status); }
  if (filters.zustandig) { sql += ' AND zustandig = ?'; params.push(filters.zustandig); }
  if (filters.prioritaet) { sql += ' AND prioritaet = ?'; params.push(filters.prioritaet); }
  sql += ' ORDER BY CASE prioritaet WHEN \'dringend\' THEN 1 WHEN \'hoch\' THEN 2 WHEN \'normal\' THEN 3 ELSE 4 END, faelligkeit ASC';
  return db.prepare(sql).all(...params);
});

ipcMain.handle('save-aufgabe', (event, data) => {
  if (data.id) {
    db.prepare(`UPDATE aufgaben SET titel=?, beschreibung=?, zustandig=?, prioritaet=?, status=?, faelligkeit=?, wiederholdung=?, erledigt_am=? WHERE id=?`)
      .run(data.titel, data.beschreibung || '', data.zustandig || '', data.prioritaet || 'normal', data.status || 'offen', data.faelligkeit || null, data.wiederholdung || null, data.status === 'erledigt' ? new Date().toISOString() : null, data.id);
    return data.id;
  } else {
    const result = db.prepare(`INSERT INTO aufgaben (titel, beschreibung, zustandig, prioritaet, status, faelligkeit, wiederholdung) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(data.titel, data.beschreibung || '', data.zustandig || '', data.prioritaet || 'normal', data.status || 'offen', data.faelligkeit || null, data.wiederholdung || null);
    return result.lastInsertRowid;
  }
});

ipcMain.handle('delete-aufgabe', (event, id) => {
  db.prepare('DELETE FROM aufgaben WHERE id = ?').run(id);
});

ipcMain.handle('get-aufgaben-statistik', () => {
  const offen = db.prepare("SELECT COUNT(*) as c FROM aufgaben WHERE status = 'offen'").get().c;
  const inArbeit = db.prepare("SELECT COUNT(*) as c FROM aufgaben WHERE status = 'in-arbeit'").get().c;
  const erledigt = db.prepare("SELECT COUNT(*) as c FROM aufgaben WHERE status = 'erledigt'").get().c;
  const ueberfaellig = db.prepare("SELECT COUNT(*) as c FROM aufgaben WHERE status != 'erledigt' AND faelligkeit < date('now')").get().c;
  return { offen, inArbeit, erledigt, ueberfaellig };
});

// ============ ICS Kalender-Export ============

ipcMain.handle('export-ics', async (event) => {
  const { termineZuICS, icsDateiSpeichern } = require('./ics-export');
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Kalender exportieren',
    defaultPath: 'imhws-termine.ics',
    filters: [{ name: 'iCalendar', extensions: ['ics'] }],
  });
  if (result.canceled) return null;
  const termine = db.prepare('SELECT * FROM termine ORDER BY datum ASC').all();
  const icsTermine = termine.map(t => {
    const startDT = t.datum ? (t.uhrzeit_von ? `${t.datum}T${t.uhrzeit_von}:00` : `${t.datum}T09:00:00`) : null;
    const endeDT = t.datum ? (t.uhrzeit_bis ? `${t.datum}T${t.uhrzeit_bis}:00` : null) : null;
    const kunde = t.kunden_id ? (db.prepare('SELECT name FROM kunden WHERE id = ?').get(t.kunden_id)?.name || '') : '';
    return {
      id: t.id,
      titel: t.titel || '',
      beschreibung: t.beschreibung || '',
      start: startDT,
      ende: endeDT,
      ort: '',
      kunde: kunde,
      mitarbeiter: '',
      status: t.status || 'geplant',
    };
  });
  icsDateiSpeichern(result.filePath, icsTermine);
  return result.filePath;
});

// ============ SEPA CSV Export ============

ipcMain.handle('export-sepa-ueberweisungen', async (event) => {
  const { sepaÜberweisungenCSV, csvSpeichern } = require('./sepa-csv');
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'SEPA-Überweisungen exportieren',
    defaultPath: 'sepa-ueberweisungen.csv',
    filters: [{ name: 'CSV', extensions: ['csv'] }],
  });
  if (result.canceled) return null;
  const buchungen = db.prepare("SELECT * FROM buchungen WHERE typ = 'ausgabe' ORDER BY datum ASC").all();
  const csv = sepaÜberweisungenCSV(buchungen.map(b => ({
    iban: '',
    bic: '',
    betrag: b.betrag || 0,
    empfänger: b.beschreibung || '',
    verwendungszweck: b.buchungstitel || b.beleg_nummer || b.beschreibung || '',
  })));
  csvSpeichern(result.filePath, csv);
  return result.filePath;
});

ipcMain.handle('export-sepa-lastschrift', async (event) => {
  const { sepaLastschriftCSV, csvSpeichern } = require('./sepa-csv');
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'SEPA-Lastschrift exportieren',
    defaultPath: 'sepa-lastschrift.csv',
    filters: [{ name: 'CSV', extensions: ['csv'] }],
  });
  if (result.canceled) return null;
  const rechnungen = db.prepare("SELECT r.*, k.name as name, k.strasse as straße, k.plz, k.ort, k.iban, k.bic FROM rechnungen r LEFT JOIN kunden k ON r.kunden_id = k.id WHERE r.bezahlt_am IS NULL ORDER BY r.erstellt ASC").all();
  const csv = sepaLastschriftCSV(rechnungen.map(r => ({
    mandatsreferenz: '',
    iban: r.iban || '',
    bic: r.bic || '',
    betrag: r.betrag_brutto || 0,
    name: r.name || '',
    straße: r.straße || '',
    plz: r.plz || '',
    ort: r.ort || '',
    verwendungszweck: r.nummer || '',
  })));
  csvSpeichern(result.filePath, csv);
  return result.filePath;
});

// ============ Doppelte Buchführung (Soll/Haben) ============

ipcMain.handle('get-kontenrahmen', () => {
  const rows = db.prepare('SELECT * FROM konto_kontenrahmen ORDER BY konto_nr ASC').all();
  if (rows.length === 0) {
    // Standard-SKR03 initialisieren
    const standardKonten = [
      ['1000', 'Bank', 'Aktivkonto', 1],
      ['1200', 'Kasse', 'Aktivkonto', 1],
      ['1300', 'Forderungen aus Lieferungen', 'Aktivkonto', 1],
      ['1400', 'Warenbestand', 'Aktivkonto', 1],
      ['2000', 'Verbindlichkeiten aus Lieferungen', 'Passivkonto', 1],
      ['2200', 'Umsatzsteuer', 'Passivkonto', 1],
      ['2800', 'Sonstige Verbindlichkeiten', 'Passivkonto', 1],
      ['3000', 'Umsatzerlöse', 'Erlöskonto', 1],
      ['3400', 'Umsatzerlöse 19% USt', 'Erlöskonto', 1],
      ['4000', 'Wareneinsatz', 'Aufwandskonto', 1],
      ['5000', 'Löhne und Gehälter', 'Aufwandskonto', 1],
      ['6000', 'Miete', 'Aufwandskonto', 1],
      ['6100', 'Versicherungen', 'Aufwandskonto', 1],
      ['6200', 'Reparaturen', 'Aufwandskonto', 1],
      ['6600', 'Sonstige Betriebsausgaben', 'Aufwandskonto', 1],
      ['7000', 'Kapital', 'Eigenkapital', 1],
      ['8000', 'Vorsteuer', 'Aktivkonto', 1],
    ];
    const insert = db.prepare('INSERT OR IGNORE INTO konto_kontenrahmen (konto_nr, konto_name, kontoart, ebene) VALUES (?, ?, ?, ?)');
    for (const k of standardKonten) insert.run(...k);
    return db.prepare('SELECT * FROM konto_kontenrahmen ORDER BY konto_nr ASC').all();
  }
  return rows;
});

ipcMain.handle('get-buchungen-soll-haben', (event, filters = {}) => {
  let sql = 'SELECT * FROM konto_bewegungen WHERE 1=1';
  const params = [];
  if (filters.konto) { sql += ' AND konto_nr = ?'; params.push(filters.konto); }
  if (filters.von) { sql += ' AND buchungsdatum >= ?'; params.push(filters.von); }
  if (filters.bis) { sql += ' AND buchungsdatum <= ?'; params.push(filters.bis); }
  sql += ' ORDER BY buchungsdatum ASC, id ASC';
  return db.prepare(sql).all(...params);
});

ipcMain.handle('save-buchung-soll-haben', (event, data) => {
  if (data.id) {
    db.prepare(`UPDATE konto_bewegungen SET konto_nr=?, konto_name=?, typ=?, betrag=?, gegenkonto=?, buchungstitel=?, beleg_nr=?, buchungsdatum=? WHERE id=?`)
      .run(data.konto_nr, data.konto_name || '', data.typ || 'Soll', data.betrag, data.gegenkonto || '', data.buchungstitel || '', data.beleg_nr || '', data.buchungsdatum, data.id);
    return data.id;
  } else {
    const result = db.prepare(`INSERT INTO konto_bewegungen (konto_nr, konto_name, typ, betrag, gegenkonto, buchungstitel, beleg_nr, buchungsdatum, buchungstyp, quelle_id, quelle_tabelle) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(data.konto_nr, data.konto_name || '', data.typ || 'Soll', data.betrag, data.gegenkonto || '', data.buchungstitel || '', data.beleg_nr || '', data.buchungsdatum, data.buchungstyp || 'manuell', data.quelle_id || null, data.quelle_tabelle || null);
    return result.lastInsertRowid;
  }
});

ipcMain.handle('delete-buchung-soll-haben', (event, id) => {
  db.prepare('DELETE FROM konto_bewegungen WHERE id = ?').run(id);
});

ipcMain.handle('get-konten-saldo', (event, kontoNr) => {
  const soll = db.prepare("SELECT COALESCE(SUM(betrag), 0) as summe FROM konto_bewegungen WHERE konto_nr = ? AND typ = 'Soll'").get(kontoNr);
  const haben = db.prepare("SELECT COALESCE(SUM(betrag), 0) as summe FROM konto_bewegungen WHERE konto_nr = ? AND typ = 'Haben'").get(kontoNr);
  return { konto: kontoNr, soll: soll.summe, haben: haben.summe, saldo: soll.summe - haben.summe };
});

ipcMain.handle('get-kontenraeume-summe', () => {
  return db.prepare(`
    SELECT kb.konto_nr, kb.konto_name,
      COALESCE(SUM(CASE WHEN kb2.typ = 'Soll' THEN kb2.betrag ELSE 0 END), 0) as soll,
      COALESCE(SUM(CASE WHEN kb2.typ = 'Haben' THEN kb2.betrag ELSE 0 END), 0) as haben
    FROM konto_bewegungen kb2
    LEFT JOIN konto_kontenrahmen kb ON kb2.konto_nr = kb.konto_nr
    GROUP BY kb2.konto_nr
    ORDER BY kb2.konto_nr ASC
  `).all();
});

// ============ E-Mail / SMTP ============

let mailTransporter = null;

function createMailTransporter(config) {
  return nodemailer.createTransport({
    host: config.host,
    port: parseInt(config.port) || 587,
    secure: config.port === '465',
    auth: {
      user: config.user,
      pass: config.pass
    },
    tls: { rejectUnauthorized: config.tls !== false }
  });
}

ipcMain.handle('send-mail', async (event, data) => {
  try {
    const settingsPath = path.join(dataDir, 'einstellungen.json');
    let einstellungen = {};
    if (fs.existsSync(settingsPath)) {
      einstellungen = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    }
    const smtpConfig = einstellungen.smtp || {};
    if (!smtpConfig.host || !smtpConfig.user) {
      return { success: false, error: 'Keine SMTP-Einstellungen konfiguriert.' };
    }
    mailTransporter = createMailTransporter(smtpConfig);
    const fromAddress = smtpConfig.fromEmail || einstellungen.email || 'noreply@imhws.de';
    const fromName = smtpConfig.fromName || einstellungen.firma || 'IMHWS';
    const info = await mailTransporter.sendMail({
      from: `"${fromName}" <${fromAddress}>`,
      to: data.to,
      subject: data.subject,
      html: data.html,
      attachments: data.attachments || []
    });
    return { success: true, messageId: info.messageId, to: data.to };
  } catch (err) {
    console.error('Mail send error:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('save-smtp-config', (event, config) => {
  const settingsPath = path.join(dataDir, 'einstellungen.json');
  let settings = {};
  if (fs.existsSync(settingsPath)) {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
  }
  settings.smtp = config;
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  return true;
});

// ============ Server-Sync ============

const https_node = require('https');
const http_node = require('http');

function getServerConfig() {
  const settingsPath = path.join(dataDir, 'einstellungen.json');
  if (!fs.existsSync(settingsPath)) return null;
  const s = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
  if (!s.server_url || s.modus !== 'server') return null;
  return { url: s.server_url, key: s.server_key || '', clientId: s.client_id || 'desktop-01' };
}

function serverRequest(method, endpoint, body) {
  const config = getServerConfig();
  if (!config) return Promise.resolve(null);
  const url = new URL(endpoint, config.url);
  const isHttps = url.protocol === 'https:';
  const mod = isHttps ? https_node : http_node;
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.key,
        'X-Client-Id': config.clientId
      }
    };
    const req = mod.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch(e) { resolve(null); }
      });
    });
    req.on('error', (e) => { console.error('Server-Sync error:', e.message); resolve(null); });
    req.setTimeout(10000, () => { req.destroy(); resolve(null); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

const SYNC_TABLES = ['kunden', 'angebote', 'rechnungen', 'artikel', 'lieferanten', 'subunternehmer', 'kasse', 'eingangsrechnungen'];

async function pushToServer() {
  const config = getServerConfig();
  if (!config) return;
  for (const table of SYNC_TABLES) {
    try {
      const localItems = db.prepare(`SELECT * FROM ${table}`).all();
      const serverItems = await serverRequest('GET', `/api/${table}`);
      if (!serverItems) continue;
      const serverMap = new Map(serverItems.map(i => [i.id, i]));
      for (const item of localItems) {
        const serverItem = serverMap.get(item.id);
        if (!serverItem) {
          await serverRequest('POST', `/api/${table}`, item);
        }
      }
    } catch (e) {
      console.error(`Push ${table} error:`, e.message);
    }
  }
}

async function pullFromServer() {
  const config = getServerConfig();
  if (!config) return;
  for (const table of SYNC_TABLES) {
    try {
      const serverItems = await serverRequest('GET', `/api/${table}`);
      if (!serverItems || !Array.isArray(serverItems)) continue;
      const localIds = new Set(
        db.prepare(`SELECT id FROM ${table}`).all().map(r => r.id)
      );
      for (const item of serverItems) {
        if (localIds.has(item.id)) {
          const cols = Object.keys(item).filter(k => k !== 'id');
          if (cols.length > 0) {
            const setClause = cols.map(k => `${k} = ?`).join(', ');
            const vals = cols.map(k => item[k]);
            db.prepare(`UPDATE ${table} SET ${setClause} WHERE id = ?`).run(...vals, item.id);
          }
        } else {
          const cols = Object.keys(item).filter(k => k !== 'id');
          const vals = cols.map(k => item[k]);
          const placeholders = cols.map(() => '?').join(', ');
          db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`).run(...vals);
        }
      }
    } catch (e) {
      console.error(`Pull ${table} error:`, e.message);
    }
  }
}

ipcMain.handle('sync-push', async () => {
  await pushToServer();
  return { success: true, timestamp: new Date().toISOString() };
});

ipcMain.handle('sync-pull', async () => {
  await pullFromServer();
  return { success: true, timestamp: new Date().toISOString() };
});

ipcMain.handle('sync-full', async () => {
  await pushToServer();
  await pullFromServer();
  return { success: true, timestamp: new Date().toISOString() };
});

ipcMain.handle('get-sync-status', () => {
  const config = getServerConfig();
  return {
    modus: config ? 'server' : 'lokal',
    serverUrl: config ? config.url : null,
    clientId: config ? config.clientId : null
  };
});

// Auto-Sync: Alle 60 Sekunden wenn Server-Modus aktiv
setInterval(async () => {
  const config = getServerConfig();
  if (config) {
    try {
      await pushToServer();
      await pullFromServer();
    } catch (e) {}
  }
}, 60000);

// ============ Integrierter Server ============

let serverProcess = null;
const SERVER_HTTP_PORT = 8080;
const SERVER_HTTPS_PORT = 8443;

function getServerDir() {
  return path.join(app.getAppPath(), 'server');
}

async function installServerDeps() {
  const serverDir = getServerDir();
  const nodeModulesPath = path.join(serverDir, 'node_modules');
  if (fs.existsSync(nodeModulesPath)) return true;

  try {
    console.log('Server-Dependencies werden installiert...');
    execSync('npm install --production', { cwd: serverDir, stdio: 'pipe', timeout: 120000 });
    console.log('Server-Dependencies installiert.');
    return true;
  } catch (e) {
    console.error('Server npm install fehlgeschlagen:', e.message);
    return false;
  }
}

function startServer() {
  if (serverProcess) {
    console.log('Server läuft bereits (PID:', serverProcess.pid, ')');
    return true;
  }

  const serverDir = getServerDir();
  if (!fs.existsSync(path.join(serverDir, 'server.js'))) {
    console.error('server.js nicht gefunden:', serverDir);
    return false;
  }

  const nodePath = process.execPath;
  serverProcess = spawn(nodePath, [path.join(serverDir, 'server.js')], {
    cwd: serverDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PORT: SERVER_HTTPS_PORT,
      HTTP_PORT: SERVER_HTTPS_PORT,
      DATA_DIR: path.join(dataDir, 'server-data')
    }
  });

  serverProcess.stdout.on('data', (data) => {
    const msg = data.toString();
    console.log('[Server]', msg.trim());
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('server-log', msg.trim());
    }
  });

  serverProcess.stderr.on('data', (data) => {
    console.error('[Server-Fehler]', data.toString().trim());
  });

  serverProcess.on('exit', (code) => {
    console.log('Server beendet mit Code:', code);
    serverProcess = null;
  });

  return true;
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
    console.log('Server gestoppt.');
  }
}

async function ensureServerRunning() {
  const config = getServerConfig();
  if (config && config.url) return true;

  const installed = await installServerDeps();
  if (!installed) return false;

  startServer();

  const settingsPath = path.join(dataDir, 'einstellungen.json');
  let settings = {};
  if (fs.existsSync(settingsPath)) {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
  }
  settings.modus = 'server';
  settings.server_url = `http://localhost:${SERVER_HTTPS_PORT}`;
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

  return true;
}

ipcMain.handle('start-server', async () => {
  const installed = await installServerDeps();
  if (!installed) return { success: false, error: 'npm install fehlgeschlagen' };
  startServer();
  return { success: true };
});

ipcMain.handle('stop-server', async () => {
  stopServer();
  return { success: true };
});

ipcMain.handle('get-server-log', () => {
  return serverProcess ? { running: true, pid: serverProcess.pid } : { running: false };
});

app.on('before-quit', () => {
  stopServer();
});
