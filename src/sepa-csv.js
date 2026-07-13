// SEPA-Überweisungen — CSV-Export für Online-Banking
const fs = require('fs');

function sepaÜberweisungenCSV(überweisungen) {
  const header = [
    'Auftragskonto',
    'Empfängerkonto',
    'BLZ Empfänger',
    'Betrag',
    'Währung',
    'Begünstigter',
    'Verwendungszweck',
    'Kostentraeger',
    'Express',
  ].join(';');

  const zeilen = überweisungen.map(u => [
    u.ownIban || '',
    u.iban || '',
    u.bic || '',
    (u.betrag || 0).toFixed(2).replace('.', ','),
    u.währung || 'EUR',
    u.empfänger || u.name || '',
    u.verwendungszweck || u.rechnungsnr || '',
    'SHAR',
    'N',
  ].join(';'));

  return [header, ...zeilen].join('\r\n');
}

function sepaLastschriftCSV(einzüge) {
  const header = [
    'Kennung',
    'Mandatsreferenz',
    'Mandatsdatum',
    'IBAN',
    'BIC',
    'Betrag',
    'Währung',
    'Name Schuldner',
    'Straße',
    'PLZ',
    'Ort',
    'Verwendungszweck',
  ].join(';');

  const zeilen = einzüge.map(e => [
    e.sepaKennung || 'CORE',
    e.mandatsreferenz || '',
    e.mandatsdatum || '',
    e.iban || '',
    e.bic || '',
    (e.betrag || 0).toFixed(2).replace('.', ','),
    'EUR',
    e.name || '',
    e.straße || '',
    e.plz || '',
    e.ort || '',
    e.verwendungszweck || '',
  ].join(';'));

  return [header, ...zeilen].join('\r\n');
}

function csvSpeichern(pfad, csv) {
  const BOM = '\uFEFF';
  fs.writeFileSync(pfad, BOM + csv, 'utf-8');
  return pfad;
}

module.exports = { sepaÜberweisungenCSV, sepaLastschriftCSV, csvSpeichern };
