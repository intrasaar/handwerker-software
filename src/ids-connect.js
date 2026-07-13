const fs = require('fs');

// IDS-Connect: Großhandels-Schnittstelle
// Basiert auf BMEcat 2005 / ETIM / GS1
// Lies Kataloge, erstelle Bestellungen

function parseBMEcat(xmlContent) {
  // Einfacher BMEcat-Parser (kein externes XML-Modul nötig)
  const artikel = [];
  const kopf = { lieferant: '', datum: '', version: '' };

  // Kopf extrahieren
  const supplierMatch = xmlContent.match(/<SUPPLIER_NAME>(.*?)<\/SUPPLIER_NAME>/i);
  if (supplierMatch) kopf.lieferant = supplierMatch[1];

  const dateMatch = xmlContent.match(/<CATALOG_DATE>(.*?)<\/CATALOG_DATE>/i);
  if (dateMatch) kopf.datum = dateMatch[1];

  // Artikel extrahieren
  const articleMatches = xmlContent.match(/<PRODUCT>([\s\S]*?)<\/PRODUCT>/gi) || [];
  for (const match of articleMatches) {
    const get = (tag) => {
      const m = match.match(new RegExp(`<${tag}>(.*?)<\\/${tag}>`, 'i'));
      return m ? m[1].trim() : '';
    };

    artikel.push({
      nummer: get('PRODUCT_ID') || get('SUPPLIER_PID'),
      bezeichnung: get('PRODUCT_NAME') || get('DESCRIPTION_SHORT'),
      beschreibung: get('DESCRIPTION_LONG'),
      einheit: get('ORDER_UNIT') || 'Stk',
      preis: parseFloat(get('PRICE') || '0'),
      mwst: parseFloat(get('TAX') || '19'),
      verfuegbar: get('ON_STOCK') !== '0',
      hersteller: get('MANUFACTURER_PID') || get('MANUFACTURER_NAME'),
      kategorie: get('PRODUCT_GROUP'),
      ean: get('EAN') || get('GTIN'),
      lieferzeit: get('DELIVERY_TIME')
    });
  }

  return { kopf, artikel };
}

function writeBMEcat(kopf, artikel) {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<BMECAT xmlns="http://www.bme.de/2005/BMEcat" version="2005">
  <T_NEW_CATALOG>
    <CATALOG>
      <CATALOG_NAME>${kopf.name || 'Katalog'}</CATALOG_NAME>
      <SUPPLIER_NAME>${kopf.lieferant || ''}</SUPPLIER_NAME>
      <CATALOG_DATE>${kopf.datum || new Date().toISOString().split('T')[0]}</CATALOG_DATE>
    </CATALOG>
`;

  for (const a of artikel) {
    xml += `    <PRODUCT>
      <PRODUCT_ID>${a.nummer}</PRODUCT_ID>
      <PRODUCT_NAME>${escXml(a.bezeichnung)}</PRODUCT_NAME>
      ${a.beschreibung ? `<DESCRIPTION_LONG>${escXml(a.beschreibung)}</DESCRIPTION_LONG>` : ''}
      <ORDER_UNIT>${a.einheit || 'Stk'}</ORDER_UNIT>
      <PRICE>${a.preis}</PRICE>
      <TAX>${a.mwst || 19}</TAX>
      ${a.ean ? `<EAN>${a.ean}</EAN>` : ''}
      ${a.hersteller ? `<MANUFACTURER_NAME>${escXml(a.hersteller)}</MANUFACTURER_NAME>` : ''}
      ${a.kategorie ? `<PRODUCT_GROUP>${escXml(a.kategorie)}</PRODUCT_GROUP>` : ''}
    </PRODUCT>
`;
  }

  xml += `  </T_NEW_CATALOG>
</BMECAT>`;
  return xml;
}

function erstelleBestellung(kunde, positionen, lieferant) {
  const now = new Date();
  const bestellNr = `BEST-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${String(Math.floor(Math.random()*999)).padStart(3,'0')}`;

  return {
    bestell_nr: bestellNr,
    datum: now.toISOString().split('T')[0],
    kunde,
    lieferant,
    positionen: positionen.map((p, i) => ({
      pos: i + 1,
      artikel_nr: p.sku || p.nummer,
      bezeichnung: p.name || p.bezeichnung,
      menge: p.menge,
      einheit: p.einheit || 'Stk',
      einzelpreis: p.preis || p.einkaufspreis || 0,
      gesamt: (p.menge || 1) * (p.preis || p.einkaufspreis || 0)
    })),
    netto: positionen.reduce((sum, p) => sum + ((p.menge || 1) * (p.preis || p.einkaufspreis || 0)), 0)
  };
}

function bestellungZuXml(bestellung) {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<PurchaseOrder xmlns="urn:ids:connect:bestellung:1.0">
  <OrderHeader>
    <OrderNumber>${bestellung.bestell_nr}</OrderNumber>
    <OrderDate>${bestellung.datum}</OrderDate>
    <SupplierName>${escXml(bestellung.lieferant)}</SupplierName>
    <BuyerName>${escXml(bestellung.kunde)}</BuyerName>
  </OrderHeader>
  <OrderPositions>
`;

  for (const p of bestellung.positionen) {
    xml += `    <OrderPosition>
      <LineNumber>${p.pos}</LineNumber>
      <SupplierArticleNumber>${escXml(p.artikel_nr)}</SupplierArticleNumber>
      <Description>${escXml(p.bezeichnung)}</Description>
      <Quantity>${p.menge}</Quantity>
      <Unit>${p.einheit}</Unit>
      <UnitPrice>${p.einzelpreis.toFixed(2)}</UnitPrice>
      <LineTotal>${p.gesamt.toFixed(2)}</LineTotal>
    </OrderPosition>
`;
  }

  xml += `  </OrderPositions>
  <OrderSummary>
    <NetTotal>${bestellung.netto.toFixed(2)}</NetTotal>
    <Currency>EUR</Currency>
  </OrderSummary>
</PurchaseOrder>`;
  return xml;
}

function escXml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function importKatalogInDB(filePath, db) {
  const content = fs.readFileSync(filePath, 'utf-8');
  let parsed;

  if (content.trim().startsWith('<?xml') || content.trim().startsWith('<BMEcat') || content.trim().startsWith('<')) {
    parsed = parseBMEcat(content);
  } else {
    throw new Error('Unbekanntes Dateiformat. Nur BMEcat/XML wird unterstützt.');
  }

  let importiert = 0;
  let aktualisiert = 0;

  const insert = db.prepare(`INSERT INTO artikel (name, sku, einheit, einkaufspreis, verkaufspreis, mwst_satz, barcode, kategorie, notizen)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(sku) DO UPDATE SET name=excluded.name, einkaufspreis=excluded.einkaufspreis, mwst_satz=excluded.mwst_satz, barcode=excluded.barcode`);

  for (const a of parsed.artikel) {
    const exists = db.prepare('SELECT id FROM artikel WHERE sku = ?').get(a.nummer);
    insert.run(
      a.bezeichnung || a.nummer,
      a.nummer,
      a.einheit || 'Stk',
      a.preis,
      a.preis * (1 + (a.mwst || 19) / 100),
      a.mwst || 19,
      a.ean || '',
      a.kategorie || parsed.kopf.lieferant || '',
      `Import: ${parsed.kopf.lieferant || 'Katalog'}`
    );
    if (exists) aktualisiert++; else importiert++;
  }

  return { importiert, aktualisiert, gesamt: parsed.artikel.length, lieferant: parsed.kopf.lieferant };
}

module.exports = { parseBMEcat, writeBMEcat, erstelleBestellung, bestellungZuXml, importKatalogInDB };
