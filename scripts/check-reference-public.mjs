import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { launchBrowser, emptyMedia } from './capture-reference-atrium.mjs';
const origin = process.env.PALACE_PUBLIC_URL || 'http://127.0.0.1:5200', out = process.env.PALACE_PUBLIC_ARTIFACTS || 'qa-artifacts/reference-rooms/public';
await mkdir(out, { recursive: true });
const rooms = JSON.parse(await readFile('content/rooms.json', 'utf8'));
const report = { origin, checkedAt: new Date().toISOString(), checks: [], requests: [], errors: [], uploads: [], passed: false };
assert.deepEqual(await (await fetch(origin + '/personal-media/manifest.json')).json(), emptyMedia);
assert.equal((await (await fetch(origin + '/personal-media/avatar.json')).json()).profile, null);
const browser = await launchBrowser();
try {
  for (const width of [1920, 390]) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1080 }, deviceScaleFactor: 1 });
    await context.addInitScript(() => localStorage.setItem('memory-palace:v3', JSON.stringify({ state: { quality: 'medium', tutorialDone: true, reducedMotion: true, mute: true, roomSoundtracks: false }, version: 0 })));
    const page = await context.newPage(); page.setDefaultTimeout(90000);
    page.on('pageerror', e => report.errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
    page.on('response', r => { if (r.status() >= 400) report.errors.push(r.status() + ' ' + r.url()); });
    page.on('request', r => { const url = new URL(r.url()); report.requests.push(url.pathname); if (!['GET', 'HEAD', 'OPTIONS'].includes(r.method())) report.uploads.push(r.method() + ' ' + r.url()); });
    try {
      for (const id of width === 1920 ? ['atrium', 'projects', 'research', 'music', 'wallpapers', 'basketball', 'cycling'] : ['basketball', 'cycling']) {
        await page.goto(origin + (id === 'atrium' ? '/' : '/' + id + '/'));
        await page.locator('.world-ready canvas').waitFor(); await page.evaluate(() => document.fonts.ready);
        assert.equal(await page.evaluate(() => !!window.__PALACE_DEV__ || !!window.__PALACE_DEBUG__), false, 'Production has no development state exports');
        if (id === 'atrium') { await page.getByRole('button', { name: 'ENTER THE PALACE', exact: true }).click(); await page.getByRole('button', { name: 'ENTER THE PALACE', exact: true }).waitFor({ state: 'hidden' }); }
        else {
          const title = rooms.find(room => room.id === id).title.toUpperCase();
          assert.ok((await page.locator('.room-caption').innerText()).toUpperCase().includes(title), 'Actual production room: ' + id);
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        const guide = page.getByRole('button', { name: 'GUIDE', exact: true });
        const bounds = await guide.boundingBox(); assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width);
        await guide.click(); const dialog = page.getByRole('dialog', { name: 'Museum guide', exact: true }); await dialog.waitFor();
        assert.ok(await dialog.getByRole('button').count() >= 24);
        await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
        await page.screenshot({ path: `${out}/${id}-${width}.png` });
        report.checks.push({ id, width, productionRoomVisible: true, originalGuide: true, noOverflow: true }); console.log(`PUBLIC ${id}/${width}`);
      }
    } finally { await context.close(); }
  }
  assert.ok(!report.requests.some(file => file.startsWith('/src/') || file.includes('design-references') || file.includes('generated-boards')));
  assert.ok(!report.requests.some(file => file.startsWith('/personal-media/') && !['/personal-media/manifest.json', '/personal-media/avatar.json'].includes(file)));
  assert.deepEqual(report.errors, []); assert.deepEqual(report.uploads, []); report.passed = true;
} catch (error) { report.failure = error.stack; process.exitCode = 1; console.error(error.stack); }
finally { await browser.close(); await writeFile(out + '/results.json', JSON.stringify(report, null, 2)); }
