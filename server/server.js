const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const crypto = require('crypto');

const PORT = process.env.PORT || 8443;
const API_KEY = process.env.API_KEY || crypto.randomBytes(32).toString('hex');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const TLS_DIR = path.join(DATA_DIR, 'tls');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(TLS_DIR)) fs.mkdirSync(TLS_DIR, { recursive: true });

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ============ API-Key-Auth ============

function authMiddleware(req, res, next) {
  const key = req.headers['x-api-key'] || req.query.apikey;
  if (key !== API_KEY) {
    return res.status(401).json({ error: 'Ungültiger API-Key' });
  }
  next();
}

app.use('/api', authMiddleware);

// ============ Datenbank ============

const dbPath = path.join(DATA_DIR, 'handwerker.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDatabase() {
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
      eingangsrechnungen_id INTEGER,
      lieferanten_id INTEGER,
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
      FOREIGN KEY (lieferanten_id) REFERENCES lieferanten(id)
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
      FOREIGN KEY (artikel_id) REFERENCES artikel(id)
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
      FOREIGN KEY (auftraege_id) REFERENCES auftraege(id)
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

    CREATE TABLE IF NOT EXISTS sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id TEXT NOT NULL,
      tabelle TEXT NOT NULL,
      operation TEXT NOT NULL,
      daten_id INTEGER,
      zeitstempel DATETIME DEFAULT CURRENT_TIMESTAMP,
      synchronisiert INTEGER DEFAULT 0
    );
  `);
}

// ============ Hilfsfunktionen ============

function query(sql, params = []) { return db.prepare(sql).all(...params); }
function get(sql, params = []) { return db.prepare(sql).get(...params); }
function run(sql, params = []) { return db.prepare(sql).run(...params); }

// ============ Health / Status ============

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', clients: connectedClients.size, uptime: process.uptime() });
});

app.get('/api/info', (req, res) => {
  const stats = {
    kunden: get('SELECT COUNT(*) as c FROM kunden').c,
    angebote: get('SELECT COUNT(*) as c FROM angebote').c,
    rechnungen: get('SELECT COUNT(*) as c FROM rechnungen').c,
    auftraege: get('SELECT COUNT(*) as c FROM auftraege').c,
    artikel: get('SELECT COUNT(*) as c FROM artikel').c,
  };
  res.json(stats);
});

// ============ Dashboard ============

app.get('/api/dashboard', (req, res) => {
  const kunden = get('SELECT COUNT(*) as anzahl FROM kunden');
  const offeneAngebote = get("SELECT COUNT(*) as anzahl, COALESCE(SUM(betrag_brutto),0) as betrag FROM angebote WHERE status='offen'");
  const offeneRechnungen = get("SELECT COUNT(*) as anzahl, COALESCE(SUM(betrag_brutto),0) as betrag FROM rechnungen WHERE status='offen'");
  const termineHeute = get("SELECT COUNT(*) as anzahl FROM termine WHERE datum = date('now')");
  const umsatzMonat = get("SELECT COALESCE(SUM(betrag_brutto),0) as betrag FROM rechnungen WHERE bezahlt_am IS NULL AND strftime('%Y-%m', erstellt) = strftime('%Y-%m', 'now')");
  const offeneAuftraege = get("SELECT COUNT(*) as anzahl FROM auftraege WHERE status != 'fertig'");
  res.json({
    kunden: kunden.anzahl,
    angebote: offeneAngebote,
    rechnungen: offeneRechnungen,
    termineHeute: termineHeute.anzahl,
    umsatzMonat: umsatzMonat.betrag,
    auftraege: offeneAuftraege.anzahl
  });
});

// ============ Generic CRUD ============

function createCrudRoutes(tableName, singular, plural) {
  app.get(`/api/${plural}`, (req, res) => {
    res.json(query(`SELECT * FROM ${tableName} ORDER BY id DESC`));
  });

  app.get(`/api/${plural}/:id`, (req, res) => {
    const item = get(`SELECT * FROM ${tableName} WHERE id = ?`, [req.params.id]);
    if (!item) return res.status(404).json({ error: 'Nicht gefunden' });
    res.json(item);
  });

  app.post(`/api/${plural}`, (req, res) => {
    const cols = Object.keys(req.body).filter(k => k !== 'id');
    const vals = cols.map(k => req.body[k]);
    const placeholders = cols.map(() => '?').join(', ');
    const result = run(`INSERT INTO ${tableName} (${cols.join(', ')}) VALUES (${placeholders})`, vals);
    logSync(req.headers['x-client-id'] || 'unknown', tableName, 'INSERT', result.lastInsertRowid);
    res.json({ id: result.lastInsertRowid });
  });

  app.put(`/api/${plural}/:id`, (req, res) => {
    const cols = Object.keys(req.body).filter(k => k !== 'id');
    const vals = cols.map(k => req.body[k]);
    const setClause = cols.map(k => `${k} = ?`).join(', ');
    run(`UPDATE ${tableName} SET ${setClause} WHERE id = ?`, [...vals, req.params.id]);
    logSync(req.headers['x-client-id'] || 'unknown', tableName, 'UPDATE', parseInt(req.params.id));
    res.json({ success: true });
  });

  app.delete(`/api/${plural}/:id`, (req, res) => {
    run(`DELETE FROM ${tableName} WHERE id = ?`, [req.params.id]);
    logSync(req.headers['x-client-id'] || 'unknown', tableName, 'DELETE', parseInt(req.params.id));
    res.json({ success: true });
  });
}

createCrudRoutes('kunden', 'kunde', 'kunden');
createCrudRoutes('lieferanten', 'lieferant', 'lieferanten');
createCrudRoutes('subunternehmer', 'sub', 'subunternehmer');
createCrudRoutes('artikel', 'art', 'artikel');
createCrudRoutes('kasse', 'kasse', 'kasse');
createCrudRoutes('regeln', 'regel', 'regeln');

// ============ Rechnungen (mit Positionen) ============

app.get('/api/rechnungen', (req, res) => {
  res.json(query(`SELECT r.*, k.name as kunden_name FROM rechnungen r LEFT JOIN kunden k ON r.kunden_id = k.id ORDER BY r.erstellt DESC`));
});

app.get('/api/rechnungen/:id', (req, res) => {
  const r = get(`SELECT r.*, k.name as kunden_name FROM rechnungen r LEFT JOIN kunden k ON r.kunden_id = k.id WHERE r.id = ?`, [req.params.id]);
  if (!r) return res.status(404).json({ error: 'Nicht gefunden' });
  r.positionen = query('SELECT * FROM rechnungen_positionen WHERE rechnungen_id = ? ORDER BY position', [r.id]);
  res.json(r);
});

app.post('/api/rechnungen', (req, res) => {
  const { rechnung, positionen } = req.body;
  let rechnungId;
  if (rechnung.id) {
    run('UPDATE rechnungen SET nummer=?, kunden_id=?, angebote_id=?, titel=?, beschreibung=?, betrag_netto=?, mwst_satz=?, betrag_brutto=?, status=?, faellig_am=?, bezahlt_am=? WHERE id=?',
      [rechnung.nummer, rechnung.kunden_id, rechnung.angebote_id, rechnung.titel, rechnung.beschreibung, rechnung.betrag_netto, rechnung.mwst_satz, rechnung.betrag_brutto, rechnung.status, rechnung.faellig_am, rechnung.bezahlt_am, rechnung.id]);
    rechnungId = rechnung.id;
    run('DELETE FROM rechnungen_positionen WHERE rechnungen_id = ?', [rechnungId]);
  } else {
    const result = run('INSERT INTO rechnungen (nummer, kunden_id, angebote_id, titel, beschreibung, betrag_netto, mwst_satz, betrag_brutto, status, faellig_am) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [rechnung.nummer, rechnung.kunden_id, rechnung.angebote_id, rechnung.titel, rechnung.beschreibung, rechnung.betrag_netto, rechnung.mwst_satz, rechnung.betrag_brutto, rechnung.status, rechnung.faellig_am]);
    rechnungId = result.lastInsertRowid;
  }
  if (positionen) {
    for (const pos of positionen) {
      run('INSERT INTO rechnungen_positionen (rechnungen_id, position, beschreibung, menge, einheit, einzelpreis, gesamt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [rechnungId, pos.position, pos.beschreibung, pos.menge, pos.einheit, pos.einzelpreis, pos.gesamt]);
    }
  }
  logSync(req.headers['x-client-id'] || 'unknown', 'rechnungen', rechnung.id ? 'UPDATE' : 'INSERT', rechnungId);
  res.json({ id: rechnungId });
});

// ============ Angebote (mit Positionen) ============

app.get('/api/angebote', (req, res) => {
  res.json(query(`SELECT a.*, k.name as kunden_name FROM angebote a LEFT JOIN kunden k ON a.kunden_id = k.id ORDER BY a.erstellt DESC`));
});

app.get('/api/angebote/:id', (req, res) => {
  const a = get(`SELECT a.*, k.name as kunden_name FROM angebote a LEFT JOIN kunden k ON a.kunden_id = k.id WHERE a.id = ?`, [req.params.id]);
  if (!a) return res.status(404).json({ error: 'Nicht gefunden' });
  a.positionen = query('SELECT * FROM angebote_positionen WHERE angebote_id = ? ORDER BY position', [a.id]);
  res.json(a);
});

app.post('/api/angebote', (req, res) => {
  const { angebot, positionen } = req.body;
  let angebotId;
  if (angebot.id) {
    run('UPDATE angebote SET nummer=?, kunden_id=?, titel=?, beschreibung=?, betrag_netto=?, mwst_satz=?, betrag_brutto=?, status=?, gueltig_bis=? WHERE id=?',
      [angebot.nummer, angebot.kunden_id, angebot.titel, angebot.beschreibung, angebot.betrag_netto, angebot.mwst_satz, angebot.betrag_brutto, angebot.status, angebot.gueltig_bis, angebot.id]);
    angebotId = angebot.id;
    run('DELETE FROM angebote_positionen WHERE angebote_id = ?', [angebotId]);
  } else {
    const result = run('INSERT INTO angebote (nummer, kunden_id, titel, beschreibung, betrag_netto, mwst_satz, betrag_brutto, status, gueltig_bis) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [angebot.nummer, angebot.kunden_id, angebot.titel, angebot.beschreibung, angebot.betrag_netto, angebot.mwst_satz, angebot.betrag_brutto, angebot.status, angebot.gueltig_bis]);
    angebotId = result.lastInsertRowid;
  }
  if (positionen) {
    for (const pos of positionen) {
      run('INSERT INTO angebote_positionen (angebote_id, position, beschreibung, menge, einheit, einzelpreis, gesamt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [angebotId, pos.position, pos.beschreibung, pos.menge, pos.einheit, pos.einzelpreis, pos.gesamt]);
    }
  }
  res.json({ id: angebotId });
});

// ============ Aufmaß (mit Positionen) ============

app.get('/api/aufmasse', (req, res) => {
  res.json(query(`SELECT af.*, k.name as kunden_name, a.titel as auftrag_titel FROM aufmasse af LEFT JOIN kunden k ON af.kunden_id = k.id LEFT JOIN auftraege a ON af.auftraege_id = a.id ORDER BY af.datum DESC`));
});

app.get('/api/aufmasse/:id', (req, res) => {
  const af = get(`SELECT af.*, k.name as kunden_name FROM aufmasse af LEFT JOIN kunden k ON af.kunden_id = k.id WHERE af.id = ?`, [req.params.id]);
  if (!af) return res.status(404).json({ error: 'Nicht gefunden' });
  af.positionen = query('SELECT * FROM aufmasse_positionen WHERE aufmasse_id = ? ORDER BY position', [af.id]);
  res.json(af);
});

app.post('/api/aufmasse', (req, res) => {
  const { aufmass, positionen } = req.body;
  let aufmassId;
  if (aufmass.id) {
    run('UPDATE aufmasse SET auftraege_id=?, kunden_id=?, titel=?, datum=?, notizen=? WHERE id=?',
      [aufmass.auftraege_id, aufmass.kunden_id, aufmass.titel, aufmass.datum, aufmass.notizen, aufmass.id]);
    aufmassId = aufmass.id;
    run('DELETE FROM aufmasse_positionen WHERE aufmasse_id = ?', [aufmassId]);
  } else {
    const result = run('INSERT INTO aufmasse (auftraege_id, kunden_id, titel, datum, notizen) VALUES (?, ?, ?, ?, ?)',
      [aufmass.auftraege_id, aufmass.kunden_id, aufmass.titel, aufmass.datum, aufmass.notizen]);
    aufmassId = result.lastInsertRowid;
  }
  if (positionen) {
    for (const pos of positionen) {
      run('INSERT INTO aufmasse_positionen (aufmasse_id, position, beschreibung, menge, einheit, breite, hoehe, flaeche, einzelpreis, gesamt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [aufmassId, pos.position, pos.beschreibung, pos.menge, pos.einheit, pos.breite, pos.hoehe, pos.flaeche, pos.einzelpreis, pos.gesamt]);
    }
  }
  res.json({ id: aufmassId });
});

// ============ Eingangsrechnungen ============

app.get('/api/eingangsrechnungen', (req, res) => {
  res.json(query(`SELECT e.*, l.name as lieferant_name FROM eingangsrechnungen e LEFT JOIN lieferanten l ON e.lieferanten_id = l.id ORDER BY e.erstellt DESC`));
});

app.post('/api/eingangsrechnungen', (req, res) => {
  const data = req.body;
  if (data.id) {
    run('UPDATE eingangsrechnungen SET nummer=?, lieferanten_id=?, titel=?, betrag_netto=?, mwst_satz=?, mwst_betrag=?, betrag_brutto=?, status=?, faellig_am=?, bezahlt_am=? WHERE id=?',
      [data.nummer, data.lieferanten_id, data.titel, data.betrag_netto, data.mwst_satz, data.mwst_betrag, data.betrag_brutto, data.status, data.faellig_am, data.bezahlt_am, data.id]);
    res.json({ id: data.id });
  } else {
    const result = run('INSERT INTO eingangsrechnungen (nummer, lieferanten_id, titel, betrag_netto, mwst_satz, mwst_betrag, betrag_brutto, status, faellig_am) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [data.nummer, data.lieferanten_id, data.titel, data.betrag_netto, data.mwst_satz, data.mwst_betrag, data.betrag_brutto, data.status, data.faellig_am]);
    res.json({ id: result.lastInsertRowid });
  }
});

// ============ Mahnungen ============

app.get('/api/mahnungen', (req, res) => {
  res.json(query(`SELECT m.*, r.nummer as rechnung_nummer, k.name as kunden_name FROM mahnungen m LEFT JOIN rechnungen r ON m.rechnungen_id = r.id LEFT JOIN kunden k ON r.kunden_id = k.id ORDER BY m.erstellt DESC`));
});

// ============ Buchungen ============

app.get('/api/buchungen', (req, res) => {
  let sql = 'SELECT b.*, k.name as kunden_name FROM buchungen b LEFT JOIN kunden k ON b.kunden_id = k.id WHERE 1=1';
  const params = [];
  if (req.query.von) { sql += ' AND b.datum >= ?'; params.push(req.query.von); }
  if (req.query.bis) { sql += ' AND b.datum <= ?'; params.push(req.query.bis); }
  if (req.query.typ) { sql += ' AND b.typ = ?'; params.push(req.query.typ); }
  sql += ' ORDER BY b.datum DESC';
  res.json(query(sql, params));
});

// ============ Lagerbewegungen ============

app.get('/api/artikel/:id/lagerbewegungen', (req, res) => {
  res.json(query('SELECT * FROM lagerbewegungen WHERE artikel_id = ? ORDER BY datum DESC, uhrzeit DESC', [req.params.id]));
});

app.post('/api/lagerbewegung', (req, res) => {
  const data = req.body;
  const artikel = get('SELECT * FROM artikel WHERE id = ?', [data.artikel_id]);
  if (!artikel) return res.status(404).json({ error: 'Artikel nicht gefunden' });
  const diff = data.typ === 'eingang' ? data.menge : (data.typ === 'ausgang' ? -data.menge : data.menge);
  run('UPDATE artikel SET bestand = bestand + ? WHERE id = ?', [diff, data.artikel_id]);
  run('INSERT INTO lagerbewegungen (artikel_id, typ, menge, datum, uhrzeit, grund, auftraege_id, rechnungen_id, mitarbeiter) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [data.artikel_id, data.typ, data.menge, data.datum, data.uhrzeit, data.grund, data.auftraege_id, data.rechnungen_id, data.mitarbeiter]);
  const updated = get('SELECT * FROM artikel WHERE id = ?', [data.artikel_id]);
  if (updated.bestand <= updated.mindestbestand) {
    return res.json({ warning: `Mindestbestand erreicht: ${updated.name}` });
  }
  res.json({ success: true });
});

// ============ Sync-Log ============

function logSync(clientId, tabelle, operation, datenId) {
  run('INSERT INTO sync_log (client_id, tabelle, operation, daten_id) VALUES (?, ?, ?, ?)', [clientId, tabelle, operation, datenId]);
}

app.get('/api/sync/:client_id/last', (req, res) => {
  const since = req.query.seit || '1970-01-01T00:00:00';
  const changes = query('SELECT * FROM sync_log WHERE client_id != ? AND zeitstempel > ? ORDER BY zeitstempel', [req.params.client_id, since]);
  res.json(changes);
});

// ============ Monteur-App Sync-API ============

// Monteur-DB Tabellen anlegen
db.exec(`
  CREATE TABLE IF NOT EXISTS monteur_zeiterfassung (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id TEXT,
    auftrags_id TEXT,
    mitarbeiter TEXT DEFAULT '',
    start DATETIME NOT NULL,
    ende DATETIME,
    pause_minuten INTEGER DEFAULT 0,
    tätigkeit TEXT DEFAULT '',
    notizen TEXT DEFAULT '',
    sync_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS monteur_rapporte (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id TEXT,
    auftrags_id TEXT,
    kunden_name TEXT DEFAULT '',
    adresse TEXT DEFAULT '',
    datum DATE NOT NULL,
    status TEXT DEFAULT 'offen',
    zusammenfassung TEXT DEFAULT '',
    sync_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS monteur_rapport_positionen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rapport_server_id INTEGER,
    client_id TEXT,
    artikel_nr TEXT DEFAULT '',
    bezeichnung TEXT DEFAULT '',
    menge REAL DEFAULT 0,
    einheit TEXT DEFAULT 'Stk',
    preis REAL DEFAULT 0,
    sync_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS monteur_rapport_fotos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rapport_server_id INTEGER,
    client_id TEXT,
    pfad TEXT NOT NULL,
    beschreibung TEXT DEFAULT '',
    bild_base64 TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    sync_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS monteur_inventur (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id TEXT,
    artikel_nr TEXT NOT NULL,
    bezeichnung TEXT DEFAULT '',
    lager TEXT DEFAULT '',
    menge REAL DEFAULT 0,
    einheit TEXT DEFAULT 'Stk',
    nfc_tag TEXT,
    letzte_pruefung DATETIME,
    sync_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS monteur_sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id TEXT NOT NULL,
    tabelle TEXT NOT NULL,
    daten_id INTEGER NOT NULL,
    aktion TEXT NOT NULL,
    payload TEXT,
    sync_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Sync: Monteur-Daten empfangen
app.post('/api/monteur/sync', (req, res) => {
  const { client_id, tabelle, daten_id, aktion, payload } = req.body;
  if (!client_id || !tabelle || !aktion) {
    return res.status(400).json({ error: 'Pflichtfelder fehlen: client_id, tabelle, aktion' });
  }

  const validTables = ['zeiterfassung', 'rapporte', 'rapport_positionen', 'rapport_fotos', 'inventur'];
  if (!validTables.includes(tabelle)) {
    return res.status(400).json({ error: `Ungültige Tabelle. Erlaubt: ${validTables.join(', ')}` });
  }

  const serverTable = `monteur_${tabelle}`;

  try {
    if (aktion === 'insert') {
      const cols = Object.keys(payload);
      const vals = Object.values(payload);
      const placeholders = cols.map(() => '?').join(', ');
      const result = db.prepare(
        `INSERT INTO ${serverTable} (client_id, ${cols.join(', ')}) VALUES (?, ${placeholders})`
      ).run(client_id, ...vals);

      db.prepare(
        `INSERT INTO monteur_sync_log (client_id, tabelle, daten_id, aktion, payload) VALUES (?, ?, ?, ?, ?)`
      ).run(client_id, tabelle, result.lastInsertRowid, aktion, JSON.stringify(payload));

      return res.json({ ok: true, server_id: result.lastInsertRowid });
    }

    if (aktion === 'update' && payload && Object.keys(payload).length > 0) {
      const cols = Object.keys(payload);
      const vals = Object.values(payload);
      const set = cols.map(c => `${c} = ?`).join(', ');

      db.prepare(
        `UPDATE ${serverTable} SET ${set}, sync_at = datetime('now') WHERE id = ? AND client_id = ?`
      ).run(...vals, daten_id, client_id);

      db.prepare(
        `INSERT INTO monteur_sync_log (client_id, tabelle, daten_id, aktion, payload) VALUES (?, ?, ?, ?, ?)`
      ).run(client_id, tabelle, daten_id, aktion, JSON.stringify(payload));

      return res.json({ ok: true });
    }

    res.status(400).json({ error: 'Unbekannte Aktion' });
  } catch (err) {
    console.error('Monteur-Sync-Fehler:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Sync: Monteur-Daten abrufen (seit letztem Sync)
app.get('/api/monteur/sync', (req, res) => {
  const { client_id, since } = req.query;
  if (!client_id) return res.status(400).json({ error: 'client_id erforderlich' });

  const sinceDate = since || '1970-01-01T00:00:00';

  try {
    const ergebnis = {};

    for (const tabelle of ['zeiterfassung', 'rapporte', 'rapport_positionen', 'rapport_fotos', 'inventur']) {
      const serverTable = `monteur_${tabelle}`;
      const rows = db.prepare(
        `SELECT * FROM ${serverTable} WHERE client_id != ? AND sync_at > ?`
      ).all(client_id, sinceDate);
      ergebnis[tabelle] = rows;
    }

    res.json(ergebnis);
  } catch (err) {
    console.error('Monteur-Abruf-Fehler:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Sync-Log anzeigen
app.get('/api/monteur/synclog', (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM monteur_sync_log ORDER BY sync_at DESC LIMIT 100'
  ).all();
  res.json(rows);
});

// ============ Config ============

app.get('/api/config', (req, res) => {
  const configPath = path.join(DATA_DIR, 'server-config.json');
  if (fs.existsSync(configPath)) {
    res.json(JSON.parse(fs.readFileSync(configPath, 'utf-8')));
  } else {
    res.json({ firmenname: '', port: PORT });
  }
});

// ============ TLS-Zertifikat generieren ============

function generateTLSCert() {
  const selfsigned = require('selfsigned');
  const attrs = [{ name: 'commonName', value: 'Handwerker-Software-Server' }];
  const pems = selfsigned.generate(attrs, { days: 3650, algorithm: 'sha256', keySize: 2048 });
  fs.writeFileSync(path.join(TLS_DIR, 'server.crt'), pems.cert);
  fs.writeFileSync(path.join(TLS_DIR, 'server.key'), pems.private);
  console.log('TLS-Zertifikat generiert:', TLS_DIR);
  return { cert: pems.cert, key: pems.private };
}

// ============ Server starten ============

initDatabase();

let server;
const certPath = path.join(TLS_DIR, 'server.crt');
const keyPath = path.join(TLS_DIR, 'server.key');

if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
  server = https.createServer({
    cert: fs.readFileSync(certPath),
    key: fs.readFileSync(keyPath)
  }, app);
  console.log('HTTPS-Server wird gestartet...');
} else {
  const certs = generateTLSCert();
  server = https.createServer({
    cert: certs.cert,
    key: certs.key
  }, app);
  console.log('TLS-Zertifikat erstellt, HTTPS-Server wird gestartet...');
}

const connectedClients = new Set();
const HTTP_PORT = process.env.HTTP_PORT || 8080;

function getLocalIP() {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

const localIP = getLocalIP();
const httpServer = http.createServer(app);

let httpsReady = false;
let httpReady = false;

function printBanner() {
  if (!httpsReady || !httpReady) return;
  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('  Handwerker-Software Server v1.0.0');
  console.log('═══════════════════════════════════════════════');
  console.log(`  HTTPS:      https://localhost:${PORT}/api/health`);
  console.log(`  HTTP:       http://${localIP}:${HTTP_PORT}/api/health`);
  console.log(`  API-Key:    ${API_KEY}`);
  console.log(`  Datenbank:  ${dbPath}`);
  console.log('═══════════════════════════════════════════════');
  console.log('');
}

httpServer.on('error', (err) => {
  console.error(`HTTP-Server Fehler auf Port ${HTTP_PORT}:`, err.message);
});

server.on('error', (err) => {
  console.error(`HTTPS-Server Fehler auf Port ${PORT}:`, err.message);
});

httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
  httpReady = true;
  console.log(`HTTP-Server aktiv auf Port ${HTTP_PORT}`);
  printBanner();
});

server.listen(PORT, '0.0.0.0', () => {
  httpsReady = true;
  console.log(`HTTPS-Server aktiv auf Port ${PORT}`);
  printBanner();
});

app.use((err, req, res, next) => {
  console.error('Unbehandelter Fehler:', err.message);
  res.status(500).json({ error: 'Interner Serverfehler', detail: err.message });
});

process.on('SIGINT', () => { db.close(); process.exit(0); });
process.on('SIGTERM', () => { db.close(); process.exit(0); });
process.on('uncaughtException', (err) => {
  console.error('Unbehandelte Ausnahme:', err.message);
});
