#!/usr/bin/env node
const crypto = require('crypto');

const LICENSE_SECRET = 'HW-K3y-2024-mN7pQ9xL';

function generateLicenseKey(fingerprint, tage) {
  const now = Date.now();
  const ablauf = now + (tage || 3650) * 24 * 60 * 60 * 1000;
  const payload = `${fingerprint}|${ablauf}`;
  const hmac = crypto.createHmac('sha256', LICENSE_SECRET).update(payload).digest('hex').substring(0, 16);
  const b64 = Buffer.from(payload).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `HW-${b64}.${hmac}`;
}

const fp = process.argv[2];
const tage = parseInt(process.argv[3]) || 3650;

if (!fp) {
  console.log('Verwendung: node generate-license.js <Hardware-ID> [Tage]');
  console.log('Beispiel:   node generate-license.js a1b2c3d4e5f6... 3650');
  console.log('');
  console.log('Standard: 3650 Tage (10 Jahre)');
  process.exit(1);
}

const key = generateLicenseKey(fp, tage);
const ablaufDatum = new Date(Date.now() + tage * 24 * 60 * 60 * 1000).toLocaleDateString('de-DE');

console.log('');
console.log('  Lizenzschlüssel generiert:');
console.log(`  ${key}`);
console.log('');
console.log(`  Gültig für: ${tage} Tage (bis ${ablaufDatum})`);
console.log('');
