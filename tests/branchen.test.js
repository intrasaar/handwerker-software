const { describe, it } = require('node:test');
const assert = require('node:assert');

const { parseDATANORM, writeDATANORM } = require('../src/datanorm');
const { parseGAEB85, writeGAEB85, parseGAEB90, writeGAEB90, gaebZuAngebot } = require('../src/gaeb');
const { parseBMEcat, writeBMEcat, erstelleBestellung, bestellungZuXml } = require('../src/ids-connect');

describe('DATANORM', () => {
  const sampleDATANORM = `KO  Test-Lieferant GmbH
AT  ART-001
BE  Schraube M8x40
EI  Stk
PR  00001250
UT  19
AT  ART-002
BE  Mutter M8
EI  Stk
PR  00000350
UT  19`;

  it('sollte DATANORM-Datei parsen', () => {
    const result = parseDATANORM(sampleDATANORM);
    assert.strictEqual(result.artikel.length, 2);
    assert.strictEqual(result.kopf.lieferant, 'Test-Lieferant GmbH');
    assert.strictEqual(result.artikel[0].nummer, 'ART-001');
    assert.strictEqual(result.artikel[0].bezeichnung, 'Schraube M8x40');
    assert.strictEqual(result.artikel[0].preis, 12.50);
    assert.strictEqual(result.artikel[0].einheit, 'Stk');
  });

  it('sollte DATANORM schreiben', () => {
    const output = writeDATANORM(
      { lieferant: 'Mein Betrieb' },
      [{ nummer: 'A1', bezeichnung: 'Test', einheit: 'kg', preis: 5.99, mwst: 19 }]
    );
    assert.ok(output.includes('KO  Mein Betrieb'));
    assert.ok(output.includes('AT  A1'));
    assert.ok(output.includes('BE  Test'));
    assert.ok(output.includes('PR  00000599'));
  });
});

describe('GAEB', () => {
  const sampleGAEB85 = `#Vergabenummer\tVB-2024-001
#Titel\tSanierung Dach
\t
1\tDachziegeln entfernen\t50\tm²
1.1\tAlte Ziegel abtragen\t50\tm²
1.2\tAbfallentsorgung\t5\tSack
2\tNeue Dachziegeln\t50\tm²`;

  const sampleGAEB90 = `#Kunde\tMustermann GmbH
#Projekt\tDach-Sanierung
#Datum\t2024-07-15
#MwSt\t19
\t
1\tDachziegeln entfernen\t50\tm²\t8.50
2\tNeue Dachziegeln\t50\tm²\t12.00
3\tEinbaukosten\t1\tPauschal\t500.00`;

  it('sollte GAEB 85 parsen', () => {
    const result = parseGAEB85(sampleGAEB85);
    assert.strictEqual(result.kopf.vergabenummer, 'VB-2024-001');
    assert.strictEqual(result.kopf.titel, 'Sanierung Dach');
    assert.strictEqual(result.leistungen.length, 4);
    assert.strictEqual(result.leistungen[0].text, 'Dachziegeln entfernen');
  });

  it('sollte GAEB 90 parsen', () => {
    const result = parseGAEB90(sampleGAEB90);
    assert.strictEqual(result.kopf.kundenname, 'Mustermann GmbH');
    assert.strictEqual(result.leistungen.length, 3);
    assert.strictEqual(result.leistungen[0].preis, 8.50);
    assert.strictEqual(result.leistungen[2].preis, 500.00);
  });

  it('sollte GAEB 85 schreiben', () => {
    const output = writeGAEB85(
      { vergabenummer: 'VB-001', titel: 'Test' },
      [{ position: '1', text: 'Arbeit', menge: 10, einheit: 'h' }]
    );
    assert.ok(output.includes('#Vergabenummer\tVB-001'));
    assert.ok(output.includes('1\tArbeit\t10\th'));
  });

  it('sollte GAEB 90 schreiben', () => {
    const output = writeGAEB90(
      { kundenname: 'Test-Kunde', projekt: 'Testprojekt', datum: '2024-07-15', ust_satz: 19 },
      [{ position: '1', text: 'Leistung', menge: 5, einheit: 'Stk', preis: 25.00 }]
    );
    assert.ok(output.includes('#Kunde\tTest-Kunde'));
    assert.ok(output.includes('1\tLeistung\t5\tStk\t25.00'));
  });

  it('sollte GAEB zu Angebot umwandeln', () => {
    const gaeb = parseGAEB90(sampleGAEB90);
    const angebot = gaebZuAngebot(gaeb);
    assert.ok(angebot.titel);
    assert.ok(angebot.betrag_netto > 0);
    assert.ok(angebot.positionen.length > 0);
  });
});

describe('IDS-Connect / BMEcat', () => {
  const sampleBMEcat = `<?xml version="1.0" encoding="UTF-8"?>
<BMECAT xmlns="http://www.bme.de/2005/BMEcat" version="2005">
  <T_NEW_CATALOG>
    <CATALOG>
      <CATALOG_NAME>Testkatalog</CATALOG_NAME>
      <SUPPLIER_NAME>Elektro-Großhandel AG</SUPPLIER_NAME>
      <CATALOG_DATE>2024-07-15</CATALOG_DATE>
    </CATALOG>
    <PRODUCT>
      <PRODUCT_ID>E-L-001</PRODUCT_ID>
      <PRODUCT_NAME>NYM-J 3x1,5</PRODUCT_NAME>
      <ORDER_UNIT>m</ORDER_UNIT>
      <PRICE>1.85</PRICE>
      <TAX>19</TAX>
      <EAN>4012345678901</EAN>
    </PRODUCT>
    <PRODUCT>
      <PRODUCT_ID>E-L-002</PRODUCT_ID>
      <PRODUCT_NAME>Steckdose weiß</PRODUCT_NAME>
      <ORDER_UNIT>Stk</ORDER_UNIT>
      <PRICE>2.50</PRICE>
      <TAX>19</TAX>
    </PRODUCT>
  </T_NEW_CATALOG>
</BMEcat>`;

  it('sollte BMEcat parsen', () => {
    const result = parseBMEcat(sampleBMEcat);
    assert.strictEqual(result.kopf.lieferant, 'Elektro-Großhandel AG');
    assert.strictEqual(result.artikel.length, 2);
    assert.strictEqual(result.artikel[0].nummer, 'E-L-001');
    assert.strictEqual(result.artikel[0].bezeichnung, 'NYM-J 3x1,5');
    assert.strictEqual(result.artikel[0].preis, 1.85);
    assert.strictEqual(result.artikel[0].ean, '4012345678901');
  });

  it('sollte BMEcat schreiben', () => {
    const output = writeBMEcat(
      { lieferant: 'Mein Betrieb', name: 'Katalog', datum: '2024-07-15' },
      [{ nummer: 'A1', bezeichnung: 'Testartikel', einheit: 'Stk', preis: 9.99, mwst: 19, ean: '123456789' }]
    );
    assert.ok(output.includes('<SUPPLIER_NAME>Mein Betrieb</SUPPLIER_NAME>'));
    assert.ok(output.includes('<PRODUCT_ID>A1</PRODUCT_ID>'));
    assert.ok(output.includes('<PRICE>9.99</PRICE>'));
  });

  it('sollte Bestellung erstellen', () => {
    const bestellung = erstelleBestellung(
      'Eigener Betrieb',
      [{ sku: 'E-L-001', name: 'NYM-J 3x1,5', menge: 100, preis: 1.85, einheit: 'm' }],
      'Elektro-Großhandel AG'
    );
    assert.ok(bestellung.bestell_nr.startsWith('BEST-'));
    assert.strictEqual(bestellung.netto, 185.00);
    assert.strictEqual(bestellung.positionen.length, 1);
  });

  it('sollte Bestellung als XML schreiben', () => {
    const bestellung = erstelleBestellung('Test', [{ sku: 'A1', name: 'Artikel', menge: 10, preis: 5.00 }], 'Lieferant');
    const xml = bestellungZuXml(bestellung);
    assert.ok(xml.includes('<PurchaseOrder'));
    assert.ok(xml.includes('<SupplierArticleNumber>A1</SupplierArticleNumber>'));
    assert.ok(xml.includes('<Quantity>10</Quantity>'));
    assert.ok(xml.includes('<UnitPrice>5.00</UnitPrice>'));
  });
});
