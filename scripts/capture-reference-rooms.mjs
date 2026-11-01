import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { arrive, base, createPage, launchBrowser, metrics } from './capture-reference-atrium.mjs';

const phase = process.env.PALACE_PHASE || 'before';
assert.ok(['before', 'after'].includes(phase));
const artifactRoot = path.resolve(process.env.PALACE_ROOMS_ARTIFACTS || 'qa-artifacts/reference-atrium/rooms');
const out = path.join(artifactRoot, phase);
await mkdir(out, { recursive: true });
const selectedRooms = (process.env.PALACE_ROOMS || 'projects,research,music,wallpapers,basketball,cycling').split(',');
const baseline = phase === 'after' ? JSON.parse(await readFile(path.join(artifactRoot, 'before', 'capture.json'), 'utf8')) : null;
// 分阶段只更新当前两室；保留已经验收的房间及其各自采样时刻，避免后续阶段覆盖证据。
const previous = phase === 'after' ? await readFile(path.join(out, 'capture.json'), 'utf8').then(JSON.parse).catch(error => {
  if (error.code === 'ENOENT') return null;
  throw error;
}) : null;
const report = { phase, base, capturedAt: new Date().toISOString(), head: execFileSync('git', ['rev-parse', 'HEAD']).toString().trim(), browser: null, viewport: [1920, 1080], views: [], errors: [], uploads: [], passed: false,
  scope: 'Public-only static room reference; saved exact camera poses, not gameplay acceptance.',
  limitations: ['每室8秒静态 rAF 观察，仅用于同环境配对比较，不代表独占 GPU、热稳定基准或完整运动路线性能。', '开发服务器请求字节包含源码模块，不能视为生产包体积。'] };
report.selectedRooms = selectedRooms;
report.views = (previous?.views || []).filter(view => !selectedRooms.includes(view.roomId));
const browser = await launchBrowser();
report.browser = browser.version();
try {
  for (const roomId of selectedRooms) {
    const { context, page, traffic } = await createPage(browser, report);
    try {
      await arrive(page, roomId);
      const saved = baseline?.views.find(view => view.roomId === roomId);
      if (baseline) assert.ok(saved, `${roomId}: exact baseline pose exists`);
      await page.evaluate(({ roomId, saved }) => {
        const state = window.__PALACE_DEV__.state.getState(), debug = window.__PALACE_DEBUG__;
        state.update({ overlay: 'guide' });
        const sports = window.__PRESENCE_DEBUG__;
        if (sports && ['basketball', 'cycling'].includes(roomId)) {
          // 体育镜头每帧跟随逻辑眼位；固定第一人称并同步该眼位，避免只写渲染相机下一帧又被覆盖。
          sports.perspective.getState().setView(roomId, 'first');
          if (saved) {
            sports.presence.camera.position.fromArray(saved.position);
            sports.presence.camera.quaternion.fromArray(saved.quaternion);
            sports.presence.camera.fov = saved.fov;
            sports.presence.camera.updateProjectionMatrix();
          }
        }
        if (saved) {
          debug.camera.position.fromArray(saved.position); debug.camera.quaternion.fromArray(saved.quaternion);
          debug.camera.fov = saved.fov; debug.camera.updateProjectionMatrix();
        }
      }, { roomId, saved: saved || null });
      await page.addStyleTag({ content: '.dialog-backdrop{display:none!important}' });
      await page.evaluate(() => new Promise(resolve => { let frames = 0; const tick = () => ++frames >= 18 ? resolve() : requestAnimationFrame(tick); requestAnimationFrame(tick); }));
      const measured = await metrics(page);
      assert.equal(measured.roomId, roomId); assert.equal(measured.quality, 'medium');
      assert.equal(measured.canvasCount, 1); assert.equal(measured.overflow, false); assert.equal(measured.pendingTextures, 0);
      if (saved) for (const key of ['position', 'quaternion', 'fov', 'quality', 'dpr', 'exposure', 'viewport']) assert.deepEqual(measured[key], saved[key], `${roomId}: exact ${key}`);
      const scene = await page.evaluate(() => {
        const { scene } = window.__PALACE_DEBUG__; let meshes = 0, lights = 0;
        scene.traverse(object => { if (object.isMesh) meshes++; if (object.isLight) lights++; });
        const sports = window.__PRESENCE_DEBUG__;
        return { meshes, lights, fog: scene.fog ? { color: scene.fog.color.getHexString(), near: scene.fog.near ?? null, far: scene.fog.far ?? null, density: scene.fog.density ?? null } : null,
          environmentIntensity: scene.environmentIntensity, sportsPerspective: sports ? sports.perspective.getState().views[window.__PALACE_DEBUG__.roomId] : null };
      });
      assert.ok(scene.meshes > 0, `${roomId}: actual geometry is present`);
      const file = `${roomId}.png`;
      await page.screenshot({ path: path.join(out, file), animations: 'disabled' });
      const frameTimes = await page.evaluate(() => new Promise(resolve => {
        const frames = []; let start, previous;
        const tick = now => {
          if (previous === undefined) { start = previous = now; requestAnimationFrame(tick); return; }
          frames.push(now - previous); previous = now;
          if (now - start >= 8000) {
            const sorted = [...frames].sort((a, b) => a - b), elapsed = now - start;
            resolve({ timingMethod: 'consecutive-positive-raf-timestamps-v2', frames, elapsed, fps: frames.length * 1000 / elapsed, p50: sorted[Math.floor(sorted.length * .5)], p95: sorted[Math.floor(sorted.length * .95)] });
          } else requestAnimationFrame(tick);
        }; requestAnimationFrame(tick);
      }));
      assert.ok(frameTimes.frames.every(interval => interval > 0), `${roomId}: positive rAF intervals`);
      report.views.push({ name: roomId, file, capturedAt: new Date().toISOString(), ...measured, scene, frameTimes, traffic: { ...traffic } });
      await writeFile(path.join(out, 'capture.json'), JSON.stringify(report, null, 2));
      console.log(`CAPTURED ${phase}/${file} ${JSON.stringify({ roomId: measured.roomId, position: measured.position, quaternion: measured.quaternion, fov: measured.fov, quality: measured.quality, render: measured.render })}`);
    } finally { await context.close(); }
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.uploads, []);
  report.completeReferenceSet = baseline ? baseline.views.every(view => report.views.some(after => after.roomId === view.roomId)) : selectedRooms.every(roomId => report.views.some(view => view.roomId === roomId));
  if (baseline) {
    const comparison = report.views.map(after => {
      const before = baseline.views.find(view => view.roomId === after.roomId);
      return { roomId: after.roomId, beforeFps: before.frameTimes.fps, afterFps: after.frameTimes.fps,
        fpsChangePercent: (after.frameTimes.fps / before.frameTimes.fps - 1) * 100,
        beforeP95ms: before.frameTimes.p95, afterP95ms: after.frameTimes.p95,
        drawCalls: [before.render.calls, after.render.calls], triangles: [before.render.triangles, after.render.triangles],
        geometries: [before.memory.geometries, after.memory.geometries], textures: [before.memory.textures, after.memory.textures],
        matchedFields: ['position', 'quaternion', 'fov', 'quality', 'dpr', 'exposure', 'viewport'],
        caveat: 'Single 8-second static paired observation; not an exclusive-GPU benchmark or gameplay throughput.' };
    });
    await writeFile(path.join(artifactRoot, 'performance-comparison.json'), JSON.stringify(comparison, null, 2));
  }
  report.passed = true;
} catch (error) { report.failure = error.stack; process.exitCode = 1; console.error(error.stack); }
finally { await browser.close(); await writeFile(path.join(out, 'capture.json'), JSON.stringify(report, null, 2)); }
