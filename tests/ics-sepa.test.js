const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

const { termineZuICS, escapeICS, formatICSDate } = require('../src/ics-export');
const { sepaÜberweisungenCSV, sepaLastschriftCSV } = require('../src/sepa-csv');
const { parseDATANORM, writeDATANORM } = require('../src/datanorm');
const { parseGAEB85, parseGAEB90, writeGAEB85, writeGAEB90, gaebZuAngebot } = require('../src/gaeb');
const { parseBMEcat, writeBMEcat, erstelleBestellung, bestellungZuXml } = require('../src/ids-connect');

describe('ICS Kalender-Export', () => {
  it('sollte ICS aus Terminen generieren', () => {
    const termine = [{
      id: 1,
      titel: 'Kundenbesuch',
      beschreibung: 'Neues Angebot besprechen',
      start: '2026-07-15T10:00:00',
      ende: '2026-07-15T11:00:00',
      ort: 'Musterstraße 1, Berlin',
      kunde: 'Mustermann GmbH',
      status: 'offen',
    }];
    const ics = termineZuICS(termine);
    assert.ok(ics.includes('BEGIN:VCALENDAR'));
    assert.ok(ics.includes('BEGIN:VEVENT'));
    assert.ok(ics.includes('SUMMARY:Kundenbesuch'));
    assert.ok(ics.includes('LOCATION:Musterstraße 1\\, Berlin'));
    assert.ok(ics.includes('DESCRIPTION:Kunde: Mustermann GmbH'));
    assert.ok(ics.includes('END:VEVENT'));
    assert.ok(ics.includes('END:VCALENDAR'));
  });

  it('sollte ICS mit Timezone erstellen', () => {
    const ics = termineZuICS([{ id: 2, titel: 'Test', start: '2026-07-15T14:00:00' }]);
    assert.ok(ics.includes('VTIMEZONE'));
    assert.ok(ics.includes('TZID:Europe/Berlin'));
    assert.ok(ics.includes('DTSTART;TZID=Europe/Berlin:'));
  });

  it('sollte Sonderzeichen escapen', () => {
    assert.strictEqual(escapeICS('Test;Komma,Back\\slash'), 'Test\\;Komma\\,Back\\\\slash');
  });

  it('sollte ICS-Datum formatieren', () => {
    const result = formatICSDate('2026-07-15T10:30:00');
    assert.ok(result.startsWith('2026'));
    assert.ok(result.includes('T'));
    assert.ok(result.length >= 15);
  });

  it('sollte leeres ICS bei leerer Liste erstellen', () => {
    const ics = termineZuICS([]);
    assert.ok(ics.includes('BEGIN:VCALENDAR'));
    assert.ok(ics.includes('END:VCALENDAR'));
    assert.ok(!ics.includes('BEGIN:VEVENT'));
  });
});

describe('SEPA CSV Export', () => {
  it('sollte Überweisungen als CSV formatieren', () => {
    const csv = sepaÜberweisungenCSV([
      { iban: 'DE89370400440532013000', bic: 'COBADEFFXXX', betrag: 150.50, empfänger: 'Test GmbH', verwendungszweck: 'RE-2024-001' },
    ]);
    assert.ok(csv.includes('DE89370400440532013000'));
    assert.ok(csv.includes('150,50'));
    assert.ok(csv.includes('Test GmbH'));
    assert.ok(csv.includes('RE-2024-001'));
    assert.ok(csv.includes('EUR'));
  });

  it('sollte Lastschriften als CSV formatieren', () => {
    const csv = sepaLastschriftCSV([
      { mandatsreferenz: 'M-001', iban: 'DE89370400440532013000', bic: 'COBADEFFXXX', betrag: 99.99, name: 'Kunde AG', verwendungszweck: 'R-123' },
    ]);
    assert.ok(csv.includes('M-001'));
    assert.ok(csv.includes('99,99'));
    assert.ok(csv.includes('Kunde AG'));
    assert.ok(csv.includes('CORE'));
  });

  it('sollte Semikolon-getrennten CSV-Header erzeugen', () => {
    const csv = sepaÜberweisungenCSV([]);
    const header = csv.split('\r\n')[0];
    assert.ok(header.includes('Empfängerkonto'));
    assert.ok(header.includes('Betrag'));
    assert.ok(header.includes('Begünstigter'));
  });
});
