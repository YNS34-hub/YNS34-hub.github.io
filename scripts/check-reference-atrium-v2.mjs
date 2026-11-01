import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { arrive, base, createPage, emptyMedia, launchBrowser, metrics, root } from './capture-reference-atrium.mjs';

const out = path.join(root, 'checks');
await mkdir(out, { recursive: true });
const report = { checkedAt: new Date().toISOString(), checks: [], errors: [], uploads: [], passed: false };
const record = (name, details = {}) => { report.checks.push({ name, passed: true, ...details }); console.log(`PASS ${name}`); };
const browser = await launchBrowser();
try {
  const snapshot = JSON.parse(await readFile(process.env.PALACE_SOURCE_SNAPSHOT || 'qa-artifacts/reference-atrium/source-snapshot.json', 'utf8'));
  const fixture = JSON.parse(await readFile('tests/fixtures/reference-visual-adapters.json', 'utf8'));
  for (const file of ['content/rooms.json', 'src/rooms/Atrium.tsx', 'src/world/World.tsx', 'src/world/artDirection.ts', 'src/world/GlassSculpture.tsx']) {
    const expected = snapshot.Files.find(entry => entry.Path === file);
    assert.ok(expected, file + ': initial snapshot exists');
    const bytes = await readFile(file), digest = value => createHash('sha256').update(value).digest('hex');
    if (digest(bytes).toUpperCase() !== expected.SHA256) {
      assert.ok(['src/rooms/Atrium.tsx', 'src/world/artDirection.ts'].includes(file));
      let restored = bytes.toString('utf8').replace(/\r\n/g, '\n');
      for (const patch of fixture.files[file]) { assert.equal(restored.split(patch.after).length, 2); restored = restored.replace(patch.after, patch.before); }
      assert.equal(digest(restored), fixture.baselineSha256[file]);
      assert.ok([restored, restored.replace(/\n/g, '\r\n')].some(value => digest(value).toUpperCase() === expected.SHA256));
    }
  }
  record('routing-original-glass-and-complete-original-atrium-and-lighting-protected', { files: 5, authorizedVisualDifferenceIsPreciselyReversible: true });
  // 页面拦截保证截图隐私，同时直接 HTTP 核验隔离副本实际输出也是空清单。
  const actualMedia = await (await fetch(base + '/personal-media/manifest.json')).json();
  const actualAvatar = await (await fetch(base + '/personal-media/avatar.json')).json();
  assert.deepEqual(actualMedia, emptyMedia); assert.equal(actualAvatar.profile, null);
  record('isolated-private-media-manifests-empty');
  const rooms = JSON.parse(await readFile('content/rooms.json', 'utf8'));
  const { context, page } = await createPage(browser, report);
  try {
    await arrive(page);
    await page.getByRole('button', { name: 'ENTER THE PALACE', exact: true }).click();
    await page.waitForFunction(() => window.__PALACE_DEV__.state.getState().started && document.querySelector('.hud.is-exploring'));
    record('enter-palace-using-visible-control');

    const doors = await page.evaluate(async () => {
      const { proximity } = await import('/src/world/proximity.ts');
      const ids = [...proximity.keys()].filter(key => key.startsWith('door:')).map(key => key.split(':')[1]);
      const worldPortal = !!window.__PALACE_DEBUG__.scene.getObjectByName('world-portal:worlds');
      return { ids: [...new Set(ids)].sort(), worldPortal };
    });
    for (const id of ['projects', 'research', 'music', 'wallpapers', 'archive', 'corridor', 'private-gym']) assert.ok(doors.ids.includes(id), `Existing released door remains: ${id}`);
    assert.equal(doors.worldPortal, true);
    record('existing-atrium-doors-and-worlds-portal-remain', doors);

    // 相机靠近展品是测试准备；显影由实际 Canvas 点击触发，不直接写显影状态。
    await page.evaluate(() => { const camera = window.__PALACE_DEBUG__.camera; camera.position.set(0, 1.65, 8); });
    await page.waitForFunction(() => window.__PALACE_DEV__.state.getState().coreNear);
    for (const targetName of ['memory-core-optical-finish', 'memory-glass-ribbon']) {
    const point = await page.evaluate(async targetName => {
      const { Raycaster, Vector2, Vector3 } = await import('/node_modules/three/build/three.core.js');
      const { scene, camera } = window.__PALACE_DEBUG__, root = scene.getObjectByName(targetName);
      if (!root) return null;
      scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
      const meshes = []; root.traverse(object => { if (object.isMesh) meshes.push(object); });
      const ray = new Raycaster(), vertex = new Vector3(), centroid = new Vector3();
      for (const mesh of meshes) {
        const position = mesh.geometry.attributes.position, index = mesh.geometry.index, count = index?.count || position.count;
        const step = Math.max(1, Math.floor(count / 450)) * 3;
        for (let i = 0; i + 2 < count; i += step) {
          centroid.set(0, 0, 0);
          for (let n = 0; n < 3; n++) centroid.add(vertex.fromBufferAttribute(position, index ? index.getX(i + n) : i + n));
          centroid.divideScalar(3).applyMatrix4(mesh.matrixWorld).project(camera);
          if (Math.abs(centroid.x) > .8 || Math.abs(centroid.y) > .75 || Math.abs(centroid.z) >= 1) continue;
          ray.setFromCamera(new Vector2(centroid.x, centroid.y), camera);
          const hit = ray.intersectObjects(scene.children, true).find(hit => { for (let object = hit.object; object; object = object.parent) if (!object.visible) return false; return true; });
          let own = false; for (let object = hit?.object; object; object = object.parent) if (object === root) own = true;
          if (own) return { x: (centroid.x + 1) * innerWidth / 2, y: (1 - centroid.y) * innerHeight / 2 };
        }
      }
      return null;
    }, targetName);
    assert.ok(point, 'A visible point on actual optical geometry exists');
    await page.mouse.click(point.x, point.y);
    await page.waitForFunction(() => window.__PALACE_DEV__.state.getState().memoryReveal);
    await page.screenshot({ path: path.join(out, targetName === 'memory-glass-ribbon' ? 'ribbon-memory-reveal.png' : 'memory-reveal.png') });
    record(targetName === 'memory-glass-ribbon' ? 'actual-3d-ribbon-click-opens-memory-reveal' : 'actual-3d-original-glass-click-opens-memory-reveal', { point });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !window.__PALACE_DEV__.state.getState().memoryReveal);
    record(targetName === 'memory-glass-ribbon' ? 'escape-closes-ribbon-memory-reveal' : 'escape-closes-original-memory-reveal');
    }

    await page.getByRole('button', { name: 'GUIDE', exact: true }).click();
    await page.getByRole('dialog', { name: 'Museum guide', exact: true }).waitFor();
    const titles = await page.locator('.room-link-title').evaluateAll(elements => elements.map(element => element.childNodes[0].textContent.trim()));
    assert.deepEqual([...titles].sort(), rooms.filter(room => !room.hidden && room.id !== 'cinema').map(room => room.title).sort());
    record('guide-preserves-all-visible-room-targets', { count: titles.length });
    await page.locator('.room-link').filter({ hasText: 'GLASS LIFE ROOM' }).click();
    await page.waitForFunction(() => window.__PALACE_DEBUG__?.roomId === 'glass-life' && document.querySelector('.world-ready'), null, { timeout: 90000 });
    assert.equal(new URL(page.url()).pathname, '/glass-life');
    record('guide-opens-actual-glass-life-route');
    await page.getByRole('button', { name: 'GUIDE', exact: true }).click();
    await page.getByRole('dialog', { name: 'Museum guide', exact: true }).waitFor();
    await page.locator('.room-link').filter({ has: page.locator('.room-link-title', { hasText: rooms.find(room => room.id === 'atrium').title }) }).click();
    await page.waitForFunction(() => window.__PALACE_DEBUG__?.roomId === 'atrium' && document.querySelector('.world-ready'), null, { timeout: 90000 });
    assert.equal(new URL(page.url()).pathname, '/');
    record('guide-atrium-title-returns-to-root');
  } finally { await context.close(); }

  for (const config of [{ width: 390, height: 844, quality: 'medium' }, { width: 1366, height: 768, quality: 'low' }]) {
    const { context, page } = await createPage(browser, report, config);
    try {
      await arrive(page);
      const measured = await metrics(page);
      assert.equal(measured.quality, config.quality); assert.equal(measured.overflow, false); assert.equal(measured.canvasCount, 1);
      const enter = page.getByRole('button', { name: 'ENTER THE PALACE', exact: true });
      const bounds = await enter.boundingBox();
      assert.ok(bounds && bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= config.width && bounds.y + bounds.height <= config.height);
      await enter.click();
      await page.waitForFunction(() => window.__PALACE_DEV__.state.getState().started);
      await page.screenshot({ path: path.join(out, config.quality === 'low' ? 'quality-low.png' : 'mobile-entered.png') });
      record(config.quality === 'low' ? 'quality-low-renders-and-enters-without-crash' : 'mobile-visible-controls-and-no-overflow', { viewport: measured.viewport, quality: measured.quality, enterBounds: bounds, render: measured.render });
    } finally { await context.close(); }
  }

  // 第二轮15组审阅图由 check-reference-review.mjs 独立核验，不重复检查V1静态页。
  assert.deepEqual(report.errors, []); assert.deepEqual(report.uploads, []);
  record('no-browser-errors-and-no-uploads'); report.passed = true;
} catch (error) { report.failure = error.stack; process.exitCode = 1; console.error(error.stack); }
finally { await browser.close(); await writeFile(path.join(out, 'results.json'), JSON.stringify(report, null, 2)); }
