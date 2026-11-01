import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { lake, roadStops } from '../src/worlds/road/route.ts';
import { arrive, base, createPage, launchBrowser, metrics } from './capture-reference-atrium.mjs';

const phase = process.env.PALACE_PHASE || 'before';
assert.ok(['before', 'after'].includes(phase));
const artifactRoot = path.resolve(process.env.PALACE_DETAILS_ARTIFACTS || 'qa-artifacts/reference-rooms/details'), out = path.join(artifactRoot, phase);
await mkdir(out, { recursive: true });
const selected = (process.env.PALACE_DETAILS || 'research,music,basketball,cycling').split(',');
const baseline = phase === 'after' ? JSON.parse(await readFile(path.join(artifactRoot, 'before', 'capture.json'), 'utf8')) : null;
const previous = await readFile(path.join(out, 'capture.json'), 'utf8').then(JSON.parse).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
const report = { phase, base, capturedAt: new Date().toISOString(), head: execFileSync('git', ['rev-parse', 'HEAD']).toString().trim(), selectedRooms: selected,
  views: (previous?.views || []).filter(view => !selected.includes(view.roomId)), errors: [], uploads: [], passed: false,
  scope: 'Staged diagnostic detail cameras in the actual 3D scenes; no performance measurement or claim of native walking to camera coordinates.',
  limitations: ['体育场景同步原逻辑眼位；骑行使用现有合法LAKE EDGE存档及原生W接近、原生上车与P拍照，再只摆放观察朝向。', '同机位诊断截图不等于整条骑行路线、完整篮球运动或私人音频库验收。'] };
const configs = [
  { roomId: 'research', position: [3.8, 1.65, 8.8], target: [7.5, 1, 3], fov: 50 },
  { roomId: 'music', position: [5, 1.65, 4], target: [0, 3, -5], fov: 50 },
  { roomId: 'basketball', position: [2, 1.65, 3], target: [0, 0, 0], fov: 48 },
  { roomId: 'cycling', fov: 60, savedStop: roadStops[0] },
].filter(config => selected.includes(config.roomId));
assert.equal(configs.length, selected.length, 'All requested detail rooms exist');
const browser = await launchBrowser(); report.browser = browser.version();
try {
  for (const config of configs) {
    const { context, page, traffic } = await createPage(browser, report);
    page.setDefaultTimeout(90000);
    try {
      if (config.savedStop) await context.addInitScript(stop => {
        localStorage.setItem('memory-palace:road:v2', JSON.stringify({ route: 2, distance: stop.distance, gear: 7, comfort: true }));
      }, config.savedStop);
      await arrive(page, config.roomId);
      if (config.savedStop) {
        await page.keyboard.down('w');
        try { await page.waitForFunction(() => !document.querySelector('.road-mount')?.disabled); }
        finally { await page.keyboard.up('w'); }
        await page.getByRole('button', { name: 'Mount / ride · E', exact: true }).click();
        await page.waitForFunction(() => window.__ROAD_DEBUG__.view.mountProgress === 1 && window.__ROAD_DEBUG__.model.speed === 0);
        await page.keyboard.press('p');
        await page.waitForFunction(() => document.querySelector('.road-status')?.dataset.photo === 'true');
        // 观察目标取自现有地理模型 lake；不虚构新的湖岸位置或第二条路线。
        await page.evaluate(lake => {
          const view = window.__ROAD_DEBUG__.view, camera = window.__PALACE_DEBUG__.camera;
          const dx = lake.x - camera.position.x, dz = lake.z - camera.position.z;
          const targetYaw = Math.atan2(Math.sin(Math.atan2(-dx, -dz) - view.yaw), Math.cos(Math.atan2(-dx, -dz) - view.yaw));
          const pitch = -.14;
          view.baseYaw += view.headYaw - targetYaw; view.basePitch += view.headPitch - pitch;
          view.headYaw = targetYaw; view.headPitch = pitch; view.lookPending = false;
        }, lake);
        await page.evaluate(() => new Promise(resolve => { let frames = 0; const tick = () => ++frames >= 30 ? resolve() : requestAnimationFrame(tick); requestAnimationFrame(tick); }));
      }
      const saved = baseline?.views.find(view => view.roomId === config.roomId);
      if (baseline) assert.ok(saved, `Exact before detail exists: ${config.roomId}`);
      await page.evaluate(({ config, saved }) => {
        const state = window.__PALACE_DEV__.state.getState(), { camera } = window.__PALACE_DEBUG__, sports = window.__PRESENCE_DEBUG__;
        state.update({ overlay: 'guide' });
        const cameras = [camera];
        if (sports && ['basketball', 'cycling'].includes(config.roomId)) {
          sports.perspective.getState().setView(config.roomId, 'first'); cameras.push(sports.presence.camera);
        }
        for (const viewCamera of cameras) {
          if (saved) { viewCamera.position.fromArray(saved.position); viewCamera.quaternion.fromArray(saved.quaternion); }
          else if (config.position) { viewCamera.position.fromArray(config.position); viewCamera.lookAt(...config.target); }
          viewCamera.fov = saved?.fov || config.fov; viewCamera.updateProjectionMatrix();
        }
      }, { config, saved: saved || null });
      await page.addStyleTag({ content: '.dialog-backdrop{display:none!important}' });
      await page.evaluate(() => new Promise(resolve => { let frames = 0; const tick = () => ++frames >= 18 ? resolve() : requestAnimationFrame(tick); requestAnimationFrame(tick); }));
      const measured = await metrics(page);
      assert.equal(measured.roomId, config.roomId); assert.equal(measured.quality, 'medium'); assert.equal(measured.canvasCount, 1); assert.equal(measured.overflow, false); assert.equal(measured.pendingTextures, 0);
      if (saved) for (const key of ['position', 'quaternion', 'fov', 'quality', 'dpr', 'exposure', 'viewport']) assert.deepEqual(measured[key], saved[key], `${config.roomId}: exact detail ${key}`);
      const road = config.savedStop ? await page.evaluate(async () => { const d = window.__ROAD_DEBUG__, { useRoadRide } = await import('/src/worlds/road/state.ts'); return { distance: d.model.distance, length: d.model.geography.length, mounted: d.view.mounted, speed: d.model.speed, photo: useRoadRide.getState().photo }; }) : null;
      if (road) { assert.ok(road.mounted && road.photo); assert.equal(road.speed, 0); assert.ok(Math.abs(road.distance - config.savedStop.distance) < .01); }
      const file = `${config.roomId}-detail.png`;
      await page.screenshot({ path: path.join(out, file), animations: 'disabled' });
      report.views.push({ name: `${config.roomId}-detail`, file, capturedAt: new Date().toISOString(), requestedTarget: config.target || [lake.x, lake.y, lake.z], savedStop: config.savedStop || null, road, ...measured, traffic: { ...traffic } });
      await writeFile(path.join(out, 'capture.json'), JSON.stringify(report, null, 2));
      console.log(`DETAIL ${phase}/${file} ${JSON.stringify({ roomId: measured.roomId, position: measured.position, quaternion: measured.quaternion, fov: measured.fov, road })}`);
    } finally { await context.close(); }
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.uploads, []);
  report.completeReferenceSet = ['research', 'music', 'basketball', 'cycling'].every(roomId => report.views.some(view => view.roomId === roomId)); report.passed = true;
} catch (error) { report.failure = error.stack; process.exitCode = 1; console.error(error.stack); }
finally { await browser.close(); await writeFile(path.join(out, 'capture.json'), JSON.stringify(report, null, 2)); }
