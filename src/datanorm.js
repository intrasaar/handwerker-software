const fs = require('fs');
const path = require('path');

// DATANORM 5 — Aufbau: 5 Zeichen Typ + 1 Leerzeichen + Daten
// Typen: K/KO Kopf, A/AT Artikel, P/PR Preis, E/EI Einheit, V/EV Verpackungseinheit,
//        T/TX Text, B/BE Bezugsquelle, N/NE Netto, U/UT Umsatzsteuer, L/LI Lieferbar
//        S/SK Skonto, R/RG Rabattgruppe, F/FT傅 Text (Fortsetzung)

const DATANORM_HEADER_LENGTH = 4;

function parseDATANORM(content) {
  const lines = content.split(/\r?\n/);
  const artikel = [];
  let aktueller = null;
  let kopf = {};

  for (const line of lines) {
    if (line.length < 2) continue;
    const typ = line.substring(0, 2).trim();
    const datenStart = line.indexOf('  ') > 0 ? line.indexOf('  ') + 2 : 2;
    const daten = line.substring(datenStart).trim();

    switch (typ) {
      case 'K': case 'KO':
        kopf = { lieferant: daten };
        break;

      case 'A': case 'AT':
        if (aktueller) artikel.push(aktueller);
        aktueller = {
          nummer: daten,
          bezeichnung: '',
          einheit: '',
          preis: 0,
          mwst: 19,
          lieferbar: true,
          verpackungseinheit: 1,
          skonto: 0,
          netto: 0
        };
        break;

      case 'B': case 'BE':
        if (aktueller) aktueller.bezeichnung = daten;
        break;

      case 'P': case 'PR':
        if (aktueller) {
          // Format: VorKommaNachKomma (z.B. 00001250 = 12.50)
          aktueller.preis = parseFloat(daten) / 100;
        }
        break;

      case 'E': case 'EI':
        if (aktueller) aktueller.einheit = daten;
        break;

      case 'V': case 'EV':
        if (aktueller) aktueller.verpackungseinheit = parseInt(daten) || 1;
        break;

      case 'T': case 'TX':
        if (aktueller) aktueller.bezeichnung += (aktueller.bezeichnung ? ' ' : '') + daten;
        break;

      case 'N': case 'NE':
        if (aktueller) aktueller.netto = parseFloat(daten) / 100;
        break;

      case 'U': case 'UT':
        if (aktueller) aktueller.mwst = parseFloat(daten) / 100;
        break;

      case 'L': case 'LI':
        if (aktueller) aktueller.lieferbar = daten === 'J' || daten === '1';
        break;

      case 'S': case 'SK':
        if (aktueller) aktueller.skonto = parseFloat(daten) / 100;
        break;
    }
  }
  if (aktueller) artikel.push(aktueller);
  return { kopf, artikel };
}

function writeDATANORM(kopf, artikel) {
  let lines = [];
  lines.push(`KO  ${kopf.lieferant || 'Unbekannt'}`);

  for (const a of artikel) {
    lines.push(`AT  ${a.nummer}`);
    if (a.bezeichnung) lines.push(`BE  ${a.bezeichnung}`);
    if (a.einheit) lines.push(`EI  ${a.einheit}`);
    if (a.preis) lines.push(`PR  ${String(Math.round(a.preis * 100)).padStart(8, '0')}`);
    if (a.mwst) lines.push(`UT  ${String(Math.round(a.mwst * 100)).padStart(3, '0')}`);
    if (a.verpackungseinheit && a.verpackungseinheit !== 1) lines.push(`EV  ${a.verpackungseinheit}`);
    if (a.skonto) lines.push(`SK  ${String(Math.round(a.skonto * 100)).padStart(3, '0')}`);
    if (a.lieferbar === false) lines.push('LI  N');
  }

  return lines.join('\r\n') + '\r\n';
}

function importDATANORMInDB(filePath, db) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const parsed = parseDATANORM(content);
  let importiert = 0;
  let aktualisiert = 0;

  const insert = db.prepare(`INSERT INTO artikel (name, sku, einheit, einkaufspreis, verkaufspreis, mwst_satz, barcode, kategorie, notizen)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(sku) DO UPDATE SET name=excluded.name, einkaufspreis=excluded.einkaufspreis, mwst_satz=excluded.mwst_satz`);

  for (const a of parsed.artikel) {
    const exists = db.prepare('SELECT id FROM artikel WHERE sku = ?').get(a.nummer);
    insert.run(a.bezeichnung || a.nummer, a.nummer, a.einheit || 'Stk', a.preis, a.preis * 1.19, a.mwst || 19, a.nummer, parsed.kopf.lieferant || '', a.bezeichnung);
    if (exists) aktualisiert++; else importiert++;
  }

  return { importiert, aktualisiert, gesamt: parsed.artikel.length, lieferant: parsed.kopf.lieferant };
}

module.exports = { parseDATANORM, writeDATANORM, importDATANORMInDB };
