const puppeteer = require('puppeteer-core');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/Users/hamodi/.cache/puppeteer/chrome/mac-150.0.7871.24/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
  });
  const page = await browser.newPage();
  const htmlPath = path.resolve(__dirname, 'bedienerhandbuch.html');
  await page.goto('file://' + htmlPath, { waitUntil: 'networkidle0' });
  await page.pdf({
    path: path.resolve(__dirname, 'bedienerhandbuch.pdf'),
    format: 'A4',
    printBackground: true,
    margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' }
  });
  await browser.close();
  console.log('PDF erstellt: bedienerhandbuch.pdf');
})();
