import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { launchBrowser } from './capture-reference-atrium.mjs';
const out = process.env.PALACE_ARTIFACTS || 'qa-artifacts/reference-rooms/review'; await mkdir(out, { recursive: true });
const report = { checkedAt: new Date().toISOString(), views: [], errors: [], passed: false };
const browser = await launchBrowser(), page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', error => report.errors.push(error.message));
try {
  await page.goto(process.env.PALACE_REVIEW_URL || 'http://127.0.0.1:5198/docs/design-references/memory-palace/review.html');
  const select = page.locator('#scene'), slider = page.locator('#amount');
  assert.equal(await select.locator('option').count(), 15);
  for (const option of await select.locator('option').all()) {
    await select.selectOption(await option.getAttribute('value'));
    await page.waitForFunction(() => [...document.querySelectorAll('.comparison img')].every(img => img.complete && img.naturalWidth > 0));
    const state = await page.locator('.comparison').evaluate(stage => ({ mobile: stage.dataset.mobile === 'true', width: stage.clientWidth, height: stage.clientHeight, images: [...stage.querySelectorAll('img')].map(img => ({ width: img.width, height: img.height, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight })) }));
    assert.deepEqual(state.images[0], state.images[1]);
    assert.ok(Math.abs(state.width / state.height - state.images[0].naturalWidth / state.images[0].naturalHeight) < .005);
    if (state.mobile) assert.ok(state.width <= 390);
    await slider.focus(); await slider.press('Home'); for (let i = 0; i < 25; i++) await slider.press('ArrowRight');
    assert.equal(await slider.inputValue(), '25'); assert.equal(await page.locator('#value').innerText(), '25%');
    assert.ok((await page.locator('#before').evaluate(img => getComputedStyle(img).clipPath)).includes('75%'));
    report.views.push({ title: await option.innerText(), ...state });
  }
  await select.selectOption('0'); await page.screenshot({ path: out + '/review-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: out + '/review-mobile.png', fullPage: true });
  assert.deepEqual(report.errors, []); report.passed = true;
} catch (error) { report.failure = error.stack; process.exitCode = 1; console.error(error.stack); }
finally { await browser.close(); await writeFile(out + '/results.json', JSON.stringify(report, null, 2)); }
