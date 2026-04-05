import puppeteer from 'puppeteer';
import { join } from 'path';
import { mkdir } from 'fs/promises';

async function main() {
  const dir = join(import.meta.dir, '..', 'screenshots');
  await mkdir(dir, { recursive: true });

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 900 });

  // Capture ALL console output
  const logs: string[] = [];
  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => logs.push(`[PAGE ERROR] ${err.message}`));

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));

  // Take initial screenshot
  await page.screenshot({ path: join(dir, 'calc-0-initial.png') });
  console.log('Initial screenshot taken');

  // The canvas is centered in the page. Find its position.
  const canvasBox = await page.evaluate(() => {
    const canvas = document.getElementById('glyphis-root');
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  });

  if (!canvasBox) {
    console.log('ERROR: Canvas not found!');
    await browser.close();
    return;
  }

  console.log('Canvas bounds:', canvasBox);

  // Calculate button positions based on iOS Calculator layout
  // The calculator has buttons at the bottom portion of the 390x844 canvas
  // Button grid starts roughly at y=420 (after display area)
  // Each button is ~80px, with ~12px gaps, 16px side padding
  // Row positions (from top of canvas):
  // Row 1 (AC, +/-, %, ÷): y ≈ 430
  // Row 2 (7, 8, 9, ×): y ≈ 522
  // Row 3 (4, 5, 6, −): y ≈ 614
  // Row 4 (1, 2, 3, +): y ≈ 706
  // Row 5 (0, ., =): y ≈ 770
  // Column centers: col1≈56, col2≈148, col3≈242, col4≈334

  // Helper: click at position relative to canvas
  async function clickCanvas(relX: number, relY: number, label: string) {
    const x = canvasBox!.left + relX;
    const y = canvasBox!.top + relY;
    console.log(`Clicking "${label}" at canvas (${relX}, ${relY}) → page (${x}, ${y})`);
    await page.mouse.click(x, y);
    await new Promise(r => setTimeout(r, 500)); // Wait for re-render
  }

  // Let's determine exact button positions by checking where the buttons are
  // First, let me click digit "1" and check display
  // Button "1" should be in row 4, col 1
  // With 390px width: 4 columns with 16px padding, 80px buttons, space-between
  // Available width = 390 - 32 = 358. 4 buttons = 320. Gaps = 38. Gap = 38/3 ≈ 12.67
  // Col centers: 16+40=56, 56+80+12.67=148.67, 148.67+80+12.67=241.33, 241.33+80+12.67=334

  // For rows, the calculator uses justifyContent: 'flex-end' with paddingBottom: 32
  // Rows from bottom: row5 at bottom, then row4, row3, row2, row1
  // Each row is 80px + 12px margin = 92px
  // Row 5 bottom: 844 - 32 = 812, top: 812 - 80 = 732
  // Row 4: 732 - 12 = 720, top: 720 - 80 = 640
  // Row 3: 640 - 12 = 628, top: 628 - 80 = 548
  // Row 2: 548 - 12 = 536, top: 536 - 80 = 456
  // Row 1: 456 - 12 = 444, top: 444 - 80 = 364

  // Click "1" (row 4, col 1) - center at (56, 680)
  await clickCanvas(56, 680, '1');
  await page.screenshot({ path: join(dir, 'calc-1-after-1.png') });

  // Click "+" (row 4, col 4) - center at (334, 680)
  await clickCanvas(334, 680, '+');
  await page.screenshot({ path: join(dir, 'calc-2-after-plus.png') });

  // Click "2" (row 4, col 2) - center at (149, 680)
  await clickCanvas(149, 680, '2');
  await page.screenshot({ path: join(dir, 'calc-3-after-2.png') });

  // Click "+" again (row 4, col 4)
  await clickCanvas(334, 680, '+ again');
  await page.screenshot({ path: join(dir, 'calc-4-after-plus2.png') });

  // Click "3" (row 4, col 3) - center at (241, 680)
  await clickCanvas(241, 680, '3');
  await page.screenshot({ path: join(dir, 'calc-5-after-3.png') });

  // Print all console logs
  console.log('\n=== Browser Console ===');
  for (const log of logs) {
    console.log(log);
  }

  await browser.close();
}

main().catch(console.error);
