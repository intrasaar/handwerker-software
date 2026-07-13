const fs = require('fs');

// GAEB 85 — Leistungsverzeichnis (Vergabeformat)
// GAEB 90 — Angebot/Preisgabe
// Aufbau: Positionsnummer, Text, Menge, Einheit, (Preis bei GAEB 90)
// Trennzeichen: Tab oder |

function parseGAEB85(content) {
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  const leistungen = [];
  let kopf = { vergabenummer: '', titel: '', ersteller: '' };

  for (const line of lines) {
    const parts = line.split('\t').map(p => p.trim());

    // Kopfzeilen erkennen
    if (parts[0] && parts[0].startsWith('#')) {
      const key = parts[0].replace('#', '').toLowerCase().trim();
      if (key === 'vergabenummer') kopf.vergabenummer = parts[1] || '';
      if (key === 'titel') kopf.titel = parts[1] || '';
      if (key === 'ersteller') kopf.ersteller = parts[1] || '';
      if (key === 'kunde') kopf.kundenname = parts[1] || '';
      if (key === 'projekt') kopf.projekt = parts[1] || '';
      if (key === 'datum') kopf.datum = parts[1] || '';
      if (key === 'mwst') kopf.ust_satz = parseFloat(parts[1]) || 19;
      continue;
    }

    if (parts.length < 3) continue;

    // Positionsnummer erkennen (Punktnotation: 1, 1.1, 1.1.1)
    const posNr = parts[0];
    if (/^\d+(\.\d+)*$/.test(posNr)) {
      const tiefe = posNr.split('.').length;
      leistungen.push({
        position: posNr,
        text: parts[1] || '',
        menge: parseFloat(parts[2]) || 0,
        einheit: parts[3] || '',
        tiefe,
        preis: parts[4] ? parseFloat(parts[4]) : null,
        gesamt: null
      });
    }
  }

  // Gesamtpreise berechnen
  for (const l of leistungen) {
    if (l.preis !== null) {
      l.gesamt = l.menge * l.preis;
    }
  }

  return { kopf, leistungen };
}

function writeGAEB85(kopf, leistungen) {
  let lines = [];
  lines.push(`#Vergabenummer\t${kopf.vergabenummer || ''}`);
  lines.push(`#Titel\t${kopf.titel || ''}`);
  lines.push(`#Ersteller\t${kopf.ersteller || ''}`);
  lines.push(`#Format\tGAEB85`);
  lines.push('');

  for (const l of leistungen) {
    lines.push(`${l.position}\t${l.text}\t${l.menge}\t${l.einheit || ''}`);
  }

  return lines.join('\r\n') + '\r\n';
}

function parseGAEB90(content) {
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  const leistungen = [];
  let kopf = { kundenname: '', projekt: '', datum: '', ust_satz: 19 };

  for (const line of lines) {
    const parts = line.split('\t').map(p => p.trim());

    if (parts[0] && parts[0].startsWith('#')) {
      const key = parts[0].replace('#', '').toLowerCase().trim();
      if (key === 'kunde') kopf.kundenname = parts[1] || '';
      if (key === 'projekt') kopf.projekt = parts[1] || '';
      if (key === 'datum') kopf.datum = parts[1] || '';
      if (key === 'mwst') kopf.ust_satz = parseFloat(parts[1]) || 19;
      continue;
    }

    if (parts.length < 3) continue;

    const posNr = parts[0];
    if (/^\d+(\.\d+)*$/.test(posNr)) {
      const preis = parts[4] ? parseFloat(parts[4]) : 0;
      const menge = parseFloat(parts[2]) || 0;
      leistungen.push({
        position: posNr,
        text: parts[1] || '',
        menge,
        einheit: parts[3] || '',
        preis,
        gesamt: menge * preis,
        tiefe: posNr.split('.').length
      });
    }
  }

  return { kopf, leistungen };
}

function writeGAEB90(kopf, leistungen) {
  let lines = [];
  lines.push(`#Kunde\t${kopf.kundenname || ''}`);
  lines.push(`#Projekt\t${kopf.projekt || ''}`);
  lines.push(`#Datum\t${kopf.datum || new Date().toISOString().split('T')[0]}`);
  lines.push(`#MwSt\t${kopf.ust_satz || 19}`);
  lines.push(`#Format\tGAEB90`);
  lines.push('');

  for (const l of leistungen) {
    lines.push(`${l.position}\t${l.text}\t${l.menge}\t${l.einheit || ''}\t${l.preis.toFixed(2)}`);
  }

  return lines.join('\r\n') + '\r\n';
}

function gaebZuAngebot(gaebDaten) {
  const betragNetto = gaebDaten.leistungen.reduce((sum, l) => sum + (l.gesamt || 0), 0);
  const mwstSatz = gaebDaten.kopf.ust_satz || 19;
  const mwstBetrag = betragNetto * mwstSatz / 100;

  return {
    titel: gaebDaten.kopf.projekt || gaebDaten.kopf.titel || 'GAEB-Import',
    positionen: gaebDaten.leistungen.map((l, i) => ({
      position: i + 1,
      beschreibung: l.text,
      menge: l.menge,
      einheit: l.einheit,
      einzelpreis: l.preis || 0,
      gesamt: l.gesamt || 0
    })),
    betrag_netto: betragNetto,
    mwst_satz: mwstSatz,
    betrag_brutto: betragNetto + mwstBetrag
  };
}

function angebotZuGAEB(rechnung, positionen) {
  const kopf = {
    kundenname: rechnung.kunden_name || '',
    projekt: rechnung.titel || '',
    datum: rechnung.erstellt ? rechnung.erstellt.split(' ')[0] : new Date().toISOString().split('T')[0],
    ust_satz: rechnung.mwst_satz || 19
  };

  const leistungen = positionen.map((p, i) => ({
    position: `${i + 1}`,
    text: p.beschreibung,
    menge: p.menge,
    einheit: p.einheit,
    preis: p.einzelpreis,
    gesamt: p.gesamt,
    tiefe: 1
  }));

  return writeGAEB90(kopf, leistungen);
}

module.exports = { parseGAEB85, writeGAEB85, parseGAEB90, writeGAEB90, gaebZuAngebot, angebotZuGAEB };
