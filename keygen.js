#!/usr/bin/env node
const crypto = require('crypto');
const os = require('os');

const LICENSE_SECRET = 'HW-K3y-2024-mN7pQ9xL';

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
  return `HW-${Buffer.from(payload).toString('base64').replace(/[=+/]/g, '')}.${hmac}`;
}

// CLI
const args = process.argv.slice(2);
const fingerprint = args[0] || getHardwareFingerprint();
const tage = parseInt(args[1]) || 365;

console.log('');
console.log('  Handwerker-Software Lizenz-Key-Generator');
console.log('  =========================================');
console.log('');
console.log(`  Hardware-ID:    ${fingerprint}`);
console.log(`  Gültigkeit:     ${tage} Tage`);
console.log(`  Lizenzschlüssel: ${generateLicenseKey(fingerprint, tage)}`);
console.log('');
