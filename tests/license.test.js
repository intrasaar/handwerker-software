const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const LICENSE_SECRET = 'HW-K3y-2024-mN7pQ9xL';

function hmacSign(data) {
  return crypto.createHmac('sha256', LICENSE_SECRET).update(data).digest('hex').substring(0, 16);
}

function generateKey(fingerprint, days = 365) {
  const ablauf = Math.floor(Date.now() / 1000) + (days * 86400);
  const payload = `${fingerprint}|${ablauf}`;
  const encoded = Buffer.from(payload).toString('base64');
  const signature = hmacSign(encoded);
  return `HW-${encoded}.${signature}`;
}

function verifyKey(key, expectedFingerprint) {
  if (!key || !key.startsWith('HW-')) return { valid: false, error: 'Ungültiges Format' };
  const parts = key.substring(3).split('.');
  if (parts.length !== 2) return { valid: false, error: 'Ungültiges Format' };
  const [encoded, sig] = parts;
  const expectedSig = hmacSign(encoded);
  if (sig !== expectedSig) return { valid: false, error: 'Ungültige Signatur' };
  const payload = Buffer.from(encoded, 'base64').toString();
  const [fingerprint, ablaufStr] = payload.split('|');
  const ablauf = parseInt(ablaufStr, 10);
  if (fingerprint !== expectedFingerprint) return { valid: false, error: 'Falsche Hardware-ID' };
  if (Date.now() / 1000 > ablauf) return { valid: false, error: 'Abgelaufen' };
  return { valid: true, fingerprint, ablauf: new Date(ablauf * 1000) };
}

describe('Lizenz-System', () => {
  const testFingerprint = 'AA:BB:CC:DD:EE:FF-testpc';

  it('sollte einen gültigen Schlüssel generieren', () => {
    const key = generateKey(testFingerprint);
    assert.ok(key.startsWith('HW-'), 'Schlüssel beginnt mit HW-');
    assert.ok(key.length > 20, 'Schlüssel ist lang genug');
  });

  it('sollte einen gültigen Schlüssel verifizieren', () => {
    const key = generateKey(testFingerprint);
    const result = verifyKey(key, testFingerprint);
    assert.ok(result.valid, 'Schlüssel ist gültig');
    assert.strictEqual(result.fingerprint, testFingerprint);
    assert.ok(result.ablauf instanceof Date, 'Ablaufdatum ist ein Date');
  });

  it('sollte bei falscher Hardware-ID fehlschlagen', () => {
    const key = generateKey('falsche-id');
    const result = verifyKey(key, testFingerprint);
    assert.ok(!result.valid, 'Schlüssel ist ungültig');
    assert.ok(result.error.includes('Hardware-ID'), 'Fehler auf Hardware-ID hinweist');
  });

  it('sollte bei manipuliertem Schlüssel fehlschlagen', () => {
    const key = generateKey(testFingerprint);
    const manipulated = key + 'x';
    const result = verifyKey(manipulated, testFingerprint);
    assert.ok(!result.valid, 'Manipulierter Schlüssel ist ungültig');
  });

  it('sollte bei abgelaufenem Schlüssel fehlschlagen', () => {
    const key = generateKey(testFingerprint, -1);
    const result = verifyKey(key, testFingerprint);
    assert.ok(!result.valid, 'Abgelaufener Schlüssel ist ungültig');
  });

  it('sollte bei ungültigem Format fehlschlagen', () => {
    assert.ok(!verifyKey('', testFingerprint).valid);
    assert.ok(!verifyKey('Ungültig', testFingerprint).valid);
    assert.ok(!verifyKey('HW-', testFingerprint).valid);
  });

  it('sollte verschiedene Schlüssel für verschiedene Fingerprints generieren', () => {
    const key1 = generateKey('fp-1');
    const key2 = generateKey('fp-2');
    assert.notStrictEqual(key1, key2, 'Schlüssel sind verschieden');
  });
});

describe('Datenbank-Initialisierung', () => {
  it('sollte better-sqlite3 laden können', () => {
    const Database = require('better-sqlite3');
    assert.ok(Database, 'better-sqlite3 ist verfügbar');
  });

  it('sollte eine temporäre Datenbank erstellen können', () => {
    const Database = require('better-sqlite3');
    const db = new Database(':memory:');
    db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
    db.prepare('INSERT INTO test (name) VALUES (?)').run('Test');
    const row = db.prepare('SELECT * FROM test').get();
    assert.strictEqual(row.name, 'Test');
    db.close();
  });
});

describe('PDF-Generierung', () => {
  it('sollte PDFKit laden können', () => {
    const PDFDocument = require('pdfkit');
    assert.ok(PDFDocument, 'PDFKit ist verfügbar');
  });
});
