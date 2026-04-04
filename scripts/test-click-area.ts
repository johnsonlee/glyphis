import puppeteer from 'puppeteer';
import { mkdir } from 'fs/promises';
import { join } from 'path';

async function main() {
  const dir = join(import.meta.dir, '..', 'screenshots');
  await mkdir(dir, { recursive: true });

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 900 });

  // Capture browser console output
  const logs: string[] = [];
  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => logs.push(`[PAGE ERROR] ${err.message}`));

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));

  // Get canvas position on the page
  const canvasBox = await page.evaluate(() => {
    const canvas = document.getElementById('glyph-root');
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

  // Helper: click at a position relative to the canvas origin
  async function clickCanvas(relX: number, relY: number, label: string) {
    const x = canvasBox!.left + relX;
    const y = canvasBox!.top + relY;
    console.log(`  Clicking "${label}" at canvas (${relX}, ${relY}) -> page (${x}, ${y})`);
    await page.mouse.click(x, y);
    await new Promise(r => setTimeout(r, 500));
  }

  // ------------------------------------------------------------------
  // Button layout calculations (from app.tsx and devserver HTML):
  //
  // Canvas: 390x844
  // Side padding: 16px, so usable width = 358
  // 4 columns of 80px buttons with space-between -> gap = (358 - 320) / 3 = 12.67
  // Column centers: col1=56, col2=149, col3=241, col4=334
  //
  // Rows from bottom (paddingBottom: 32, each row 80px + 12px marginBottom):
  //   Row 5 bottom edge: 844 - 32 = 812, center Y = 772
  //   Row 4: top = 640, center Y = 680
  //   Row 3: top = 548, center Y = 588
  //   Row 2: top = 456, center Y = 496
  //   Row 1: top = 364, center Y = 404
  //
  // Button "5": row 3, col 2 -> center at canvas (149, 588)
  //   Left edge: 109, Right edge: 189, Top edge: 548, Bottom edge: 628
  //
  // AC button: row 1, col 1 -> center at canvas (56, 404)
  // ------------------------------------------------------------------

  const screenshotIndex = { n: 0 };
  async function screenshot(name: string) {
    screenshotIndex.n++;
    const filename = `click-area-${screenshotIndex.n}-${name}.png`;
    await page.screenshot({ path: join(dir, filename) });
    console.log(`  Screenshot saved: ${filename}`);
  }

  // Take initial screenshot
  await screenshot('initial');

  // ── Test 1: Click near top-left corner of button "5" ──────────────
  console.log('\n--- Test 1: Click near TOP-LEFT corner of button "5" ---');
  // Button "5" top-left is at canvas (109, 548). Click a few pixels inside: (115, 555)
  await clickCanvas(115, 555, '5 top-left corner');
  await screenshot('after-5-topleft');

  // Check display by reading a screenshot (visual verification)
  // We will also try to read the display from the canvas pixel data
  const display1 = await page.evaluate(() => {
    // The display value is rendered on the canvas; we cannot read DOM text.
    // We rely on screenshots for verification.
    return null;
  });
  console.log('  Expected: display shows "5"');

  // Reset
  console.log('\n  Resetting with AC...');
  await clickCanvas(56, 404, 'AC');
  await new Promise(r => setTimeout(r, 300));
  await screenshot('after-reset-1');

  // ── Test 2: Click near bottom-right corner of button "5" ──────────
  console.log('\n--- Test 2: Click near BOTTOM-RIGHT corner of button "5" ---');
  // Button "5" bottom-right is at canvas (189, 628). Click a few pixels inside: (183, 622)
  await clickCanvas(183, 622, '5 bottom-right corner');
  await screenshot('after-5-bottomright');
  console.log('  Expected: display shows "5"');

  // Reset
  console.log('\n  Resetting with AC...');
  await clickCanvas(56, 404, 'AC');
  await new Promise(r => setTimeout(r, 300));
  await screenshot('after-reset-2');

  // ── Test 3: Click in the gap between buttons "5" and "6" ──────────
  console.log('\n--- Test 3: Click in GAP between buttons "5" and "6" ---');
  // Button "5" right edge: 189. Button "6" left edge: 201 (241-40).
  // Gap center: ~195. Click at canvas (215, 588) per spec, which is actually
  // inside button "6" area (201-281). Let's use the true gap: (195, 588).
  // Actually, let's compute more carefully:
  //   col2 center = 149, so col2 right = 149+40 = 189
  //   col3 center = 241, so col3 left = 241-40 = 201
  //   gap is 189..201, midpoint = 195
  // The user specified (215, 588), but that is inside button "6".
  // Use (195, 588) for the true gap.
  await clickCanvas(195, 588, 'gap between 5 and 6');
  await screenshot('after-gap-click');
  console.log('  Expected: display still shows "0" (gap click should NOT register)');

  // ── Summary ───────────────────────────────────────────────────────
  console.log('\n=== Summary ===');
  console.log('Test 1 (top-left edge of "5"):      check screenshot click-area-2-after-5-topleft.png');
  console.log('Test 2 (bottom-right edge of "5"):   check screenshot click-area-5-after-5-bottomright.png');
  console.log('Test 3 (gap between "5" and "6"):    check screenshot click-area-8-after-gap-click.png');
  console.log('');
  console.log('If Tests 1 & 2 show "5" on the display, edge clicks register correctly.');
  console.log('If Test 3 shows "0" on the display, gap clicks are correctly ignored.');

  // Print browser console logs if any
  if (logs.length > 0) {
    console.log('\n=== Browser Console ===');
    for (const log of logs) {
      console.log('  ' + log);
    }
  }

  await browser.close();
}

main().catch(console.error);
