import puppeteer from 'puppeteer';
import { mkdir } from 'fs/promises';
import { join } from 'path';

async function main() {
  const dir = join(import.meta.dir, '..', 'screenshots');
  await mkdir(dir, { recursive: true });

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 900 });

  // Capture console output
  const logs: string[] = [];
  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => logs.push(`[error] ${err.message}`));

  // Normal screenshot
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: join(dir, 'app.png'), fullPage: true });
  console.log('Normal screenshot saved');

  // Debug screenshot
  await page.goto('http://localhost:3000?debug=true', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: join(dir, 'app-debug.png'), fullPage: true });
  console.log('Debug screenshot saved');

  // Print any console output
  if (logs.length > 0) {
    console.log('\nBrowser console:');
    for (const log of logs) {
      console.log('  ' + log);
    }
  }

  await browser.close();
}

main().catch(console.error);
