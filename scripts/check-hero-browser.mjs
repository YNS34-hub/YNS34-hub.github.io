import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Optional GPU acceptance suite. Install Playwright separately or supply its
// module URL; ordinary CI intentionally does not claim GPU visual acceptance.
const { chromium } = await import(process.env.HERO_PLAYWRIGHT_MODULE || 'playwright');
const url = process.env.HERO_QA_URL || 'http://127.0.0.1:4173/';
const output = path.resolve(process.env.HERO_QA_OUTPUT || '../hero-evidence/browser');
await mkdir(output, { recursive: true });
const launch = { headless: true, ...(process.env.HERO_CHROME_PATH ? { executablePath: process.env.HERO_CHROME_PATH } : { channel: 'chrome' }) };
const browser = await chromium.launch(launch);
const report = { url, date: new Date().toISOString(), browser: browser.version(), checks: [], errors: [], warnings: [], responses: [] };
const state = page => page.evaluate(() => ({ ...document.querySelector('[data-sphere-stage]').dataset }));
const ready = async page => {
  await page.waitForFunction(() => document.querySelector('[data-sphere-stage]')?.dataset.renderMode === 'three-webgl');
  await page.waitForTimeout(1200);
};
const record = (name, data) => { report.checks.push({ name, ...data }); console.log(name, JSON.stringify(data)); };
const watch = page => {
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); if (m.type() === 'warning') report.warnings.push(m.text()); });
  page.on('response', r => { if (/sphere\.js|three\.(module|core)\.min\.js|RectAreaLightTexturesLib/.test(r.url())) report.responses.push({ url: r.url(), status: r.status() }); if (r.status() >= 400) report.errors.push(`${r.status()} ${r.url()}`); });
};
const screenshot = async (page, name, hero = false) => {
  assert.equal((await state(page)).renderMode, 'three-webgl', 'Refuse to label a fallback as WebGL evidence');
  if (hero) await page.locator('#top').screenshot({ path: path.join(output, `${name}.png`) });
  else await page.screenshot({ path: path.join(output, `${name}.png`) });
};

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const page = await context.newPage(); watch(page);
  await page.goto(url); await ready(page);
  const gpu = await page.evaluate(() => { const gl = document.querySelector('canvas').getContext('webgl2'); const ext = gl.getExtension('WEBGL_debug_renderer_info'); return { version: gl.getParameter(gl.VERSION), renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unavailable' }; });
  record('WebGL2', gpu); assert.match(gpu.version, /WebGL 2/);
  await screenshot(page, 'desktop');

  await page.evaluate(() => window.__NONLINEAR_SPHERE__.rotateTo(0, 0, 0));
  await page.waitForTimeout(100); await screenshot(page, 'angle-000');
  const box = await page.locator('canvas').boundingBox();
  const x = box.x + box.width * .3, y = box.y + box.height * .45;
  for (const angle of [90, 180]) {
    await page.mouse.move(x, y); await page.mouse.down();
    await page.mouse.move(x + Math.PI / 2 / .0065, y, { steps: 30 });
    await page.waitForTimeout(160); await page.mouse.up();
    const s = await state(page); record(`mouse-${angle}`, s);
    const actual = (Number(s.rotationY) + 360) % 360;
    assert(Math.abs(actual - angle) < 2, `Drag angle ${actual} != ${angle}`);
    await screenshot(page, `angle-${angle}`);
  }
  await page.evaluate(() => window.__NONLINEAR_SPHERE__.rotateTo(0, 0, 0));
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x, y + 120, { steps: 24 }); await page.waitForTimeout(160); await page.mouse.up();
  record('vertical-drag', await state(page)); assert(Number((await state(page)).rotationX) > 40);
  await screenshot(page, 'vertical');

  await page.evaluate(() => window.__NONLINEAR_SPHERE__.rotateTo(0, 0, 0));
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 120, y, { steps: 5 }); await page.mouse.up();
  const released = await state(page); await page.waitForTimeout(400); const coast = await state(page);
  assert(Math.abs(Number(coast.rotationY) - Number(released.rotationY)) > 1, 'No rotational inertia');
  record('inertia', { released, after400ms: coast });
  await page.waitForTimeout(3500); const idle1 = await state(page); await page.waitForTimeout(2000); const idle2 = await state(page);
  assert.equal(idle2.dragState, 'idle-rotation'); assert(Math.abs(Number(idle2.rotationY) - Number(idle1.rotationY)) > .5);
  record('idle-rotation', { before: idle1, after2s: idle2 });

  for (const width of [375, 390, 768]) {
    const mobile = width < 760;
    const device = await browser.newContext({ viewport: { width, height: mobile ? 844 : 1024 }, deviceScaleFactor: 1, hasTouch: mobile, isMobile: mobile });
    const p = await device.newPage(); watch(p);
    await p.addInitScript(() => { window.__qaPointers = []; document.addEventListener('pointerdown', e => window.__qaPointers.push({ type: e.pointerType, trusted: e.isTrusted }), true); });
    await p.goto(url); await ready(p);
    const layout = await p.evaluate(() => ({ width: innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
    assert.equal(layout.scrollWidth, layout.clientWidth, `Horizontal overflow at ${width}`);
    record(`responsive-${width}`, { ...layout, state: await state(p) });
    await screenshot(p, `hero-${width}`, true);
    if (mobile) {
      await p.locator('canvas').scrollIntoViewIfNeeded();
      const b = await p.locator('canvas').boundingBox();
      const tx = b.x + b.width * .2, ty = b.y + b.height * .45;
      const before = await state(p), cdp = await device.newCDPSession(p);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: tx, y: ty }] });
      for (let i = 1; i <= 20; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: tx + i * 7, y: ty + i * 2 }] });
      await p.waitForTimeout(160);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      const after = await state(p), pointers = await p.evaluate(() => window.__qaPointers);
      assert(pointers.some(e => e.type === 'touch' && e.trusted));
      assert(Math.abs(Number(after.rotationY) - Number(before.rotationY)) > 40);
      assert(Math.abs(Number(after.rotationX) - Number(before.rotationX)) > 5);
      record(`touch-${width}`, { before, after, pointers });
      await screenshot(p, `touch-${width}`);
    }
    await device.close();
  }

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => document.querySelector('[data-sphere-stage]').dataset.renderMode === 'reduced-motion-poster');
  record('live-reduced-motion', await state(page));
  await page.screenshot({ path: path.join(output, 'fallback-reduced-motion.png') });
  await page.reload(); await page.waitForTimeout(1000);
  assert.equal((await state(page)).renderMode, 'reduced-motion-poster');
  assert(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches));
  record('initial-reduced-motion', await state(page));
  await page.emulateMedia({ reducedMotion: 'no-preference' }); await page.reload(); await ready(page);
  await page.evaluate(() => document.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await page.waitForFunction(() => document.querySelector('[data-sphere-stage]').dataset.renderMode === 'context-lost-poster');
  record('real-context-loss', await state(page));
  await page.screenshot({ path: path.join(output, 'fallback-context-lost.png') });
  await page.reload(); await ready(page); record('reload-after-loss', await state(page));
  assert.equal(report.errors.length, 0, report.errors.join('\n'));
  assert(report.responses.every(r => r.status === 200 || r.status === 304));
  if (url.startsWith('https:')) {
    for (const module of ['sphere.js', 'three.module.min.js', 'three.core.min.js', 'RectAreaLightTexturesLib.js']) {
      assert(report.responses.some(r => new URL(r.url).pathname.endsWith(`/${module}`)), `Missing production module: ${module}`);
    }
  }
  await context.close();

  const disabled = await chromium.launch({ ...launch, args: ['--disable-webgl'] });
  try {
    const p = await disabled.newPage(); await p.goto(url);
    await p.waitForFunction(() => document.querySelector('[data-sphere-stage]').dataset.renderMode === 'webgl-unavailable-poster');
    record('webgl-disabled', await state(p));
    await p.screenshot({ path: path.join(output, 'fallback-webgl-disabled.png') });
  } finally { await disabled.close(); }
  report.passed = true;
} finally {
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
