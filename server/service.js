const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const SERVICE_NAME = 'HandwerkerServer';
const SERVICE_DISPLAY = 'Handwerker-Software Server';
const SERVICE_DESC = 'Lokaler Datenbankserver für Handwerker-Software';

const args = process.argv[2];
const serverPath = path.join(__dirname, 'server.js');

if (args === 'install') {
  try {
    const pm2Path = path.join(__dirname, 'node_modules', '.bin', 'pm2');
    if (!fs.existsSync(pm2Path)) {
      console.log('PM2 wird installiert...');
      execSync('npm install pm2 pm2-windows-startup -g', { stdio: 'inherit' });
    }
    console.log('Service wird installiert...');
    execSync(`pm2 start "${serverPath}" --name "${SERVICE_NAME}"`, { stdio: 'inherit' });
    execSync(`pm2 save`, { stdio: 'inherit' });
    console.log(`Service "${SERVICE_NAME}" installiert.`);
    console.log('Starten mit: node service.js start');
  } catch (e) {
    console.error('Fehler:', e.message);
  }
} else if (args === 'uninstall') {
  try {
    execSync(`pm2 delete "${SERVICE_NAME}"`, { stdio: 'inherit' });
    execSync('pm2 save', { stdio: 'inherit' });
    console.log(`Service "${SERVICE_NAME}" entfernt.`);
  } catch (e) {
    console.error('Fehler:', e.message);
  }
} else if (args === 'start') {
  try {
    execSync(`pm2 start "${SERVICE_NAME}"`, { stdio: 'inherit' });
    console.log(`Service "${SERVICE_NAME}" gestartet.`);
  } catch (e) {
    console.error('Fehler:', e.message);
  }
} else if (args === 'stop') {
  try {
    execSync(`pm2 stop "${SERVICE_NAME}"`, { stdio: 'inherit' });
    console.log(`Service "${SERVICE_NAME}" gestoppt.`);
  } catch (e) {
    console.error('Fehler:', e.message);
  }
} else {
  console.log('Usage: node service.js [install|uninstall|start|stop]');
}
