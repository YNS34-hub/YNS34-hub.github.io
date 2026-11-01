import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

export const base = process.env.PALACE_URL || 'http://127.0.0.1:5198';
export const root = path.resolve(process.env.PALACE_ARTIFACTS || 'qa-artifacts/reference-atrium');
export const emptyMedia = { wallpapers: [], visuals: [], music: [], projects: [], research: [] };

export async function createPage(browser, report, { width = 1920, height = 1080, quality = 'medium' } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  await context.addInitScript(quality => localStorage.setItem('memory-palace:v3', JSON.stringify({ state: { quality, effectiveQuality: quality, reducedMotion: true, mute: true, tutorialDone: true, roomSoundtracks: false, mode: 'explore' }, version: 0 })), quality);
  // 独立浏览器上下文不读取用户收藏；私人接口固定为空，避免公开证据包含本地照片。
  await context.route('**/personal-media/manifest.json', route => route.fulfill({ json: emptyMedia }));
  await context.route('**/personal-media/avatar.json', route => route.fulfill({ json: { profile: null } }));
  const page = await context.newPage();
  const traffic = { encodedBytes: 0, requestCount: 0, requests: [] };
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  cdp.on('Network.loadingFinished', event => { traffic.encodedBytes += event.encodedDataLength; });
  page.on('request', request => {
    traffic.requestCount++;
    traffic.requests.push({ method: request.method(), url: request.url(), resourceType: request.resourceType() });
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) report.uploads.push({ method: request.method(), url: request.url() });
  });
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) report.errors.push(`${response.status()} ${response.url()}`); });
  return { context, page, traffic };
}

export async function arrive(page, room = 'atrium') {
  await page.goto(base + (room === 'atrium' ? '/' : `/${room}`));
  await page.waitForFunction(room => window.__PALACE_DEBUG__?.roomId === room && document.querySelector('.world-ready'), room, { timeout: 90000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => !window.__PALACE_DEBUG__.textureStatus().pending, null, { timeout: 90000 });
  // 纹理就绪后等待实际渲染帧，而不是把首次存在的 Canvas 当作完成状态。
  await page.evaluate(() => new Promise(resolve => { let frames = 0; const step = () => ++frames >= 18 ? resolve() : requestAnimationFrame(step); requestAnimationFrame(step); }));
}

export async function fixCamera(page, position, target, fov) {
  await page.evaluate(({ position, target, fov }) => {
    window.__PALACE_DEV__.state.getState().update({ overlay: 'guide' });
    const camera = window.__PALACE_DEBUG__.camera;
    camera.position.set(...position); camera.lookAt(...target); camera.fov = fov; camera.updateProjectionMatrix();
  }, { position, target, fov });
  await page.addStyleTag({ content: '.dialog-backdrop{display:none!important}' });
  await page.evaluate(() => new Promise(resolve => { let frames = 0; const step = () => ++frames >= 12 ? resolve() : requestAnimationFrame(step); requestAnimationFrame(step); }));
}

export async function metrics(page) {
  return page.evaluate(() => {
    const { camera, renderer, scene, roomId } = window.__PALACE_DEBUG__;
    const gl = renderer.getContext(), extension = gl.getExtension('WEBGL_debug_renderer_info');
    const glass = [];
    scene.traverse(object => {
      const material = object.material;
      if (object.isMesh && material?.isMeshPhysicalMaterial && material.transmission > .5)
        glass.push({ color: material.color.getHexString(), roughness: material.roughness, metalness: material.metalness, transmission: material.transmission, thickness: material.thickness, ior: material.ior, attenuationColor: material.attenuationColor.getHexString(), attenuationDistance: material.attenuationDistance, envMapIntensity: material.envMapIntensity });
    });
    return {
      roomId, position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), fov: camera.fov,
      quality: window.__PALACE_DEV__.state.getState().effectiveQuality, dpr: renderer.getPixelRatio(), exposure: renderer.toneMappingExposure,
      renderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      viewport: [innerWidth, innerHeight], memory: { ...renderer.info.memory }, render: { ...renderer.info.render },
      programs: renderer.info.programs.length, canvasCount: document.querySelectorAll('.world-stage canvas').length,
      overflow: document.documentElement.scrollWidth > innerWidth, pendingTextures: window.__PALACE_DEBUG__.textureStatus().pending,
      glass, hidden: document.hidden, focused: document.hasFocus(),
    };
  });
}

export async function launchBrowser() {
  // 只检查其他验收脚本，不停止任何进程；独立聊天的 GPU 检查优先完成。
  if (process.platform === 'win32') {
    const command = `@(Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object { $_.ProcessId -ne ${process.pid} -and $_.CommandLine -match 'scripts[\\/](?:capture-|check-|measure-)' } | Select-Object ProcessId,CommandLine) | ConvertTo-Json -Compress`;
    const output = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { encoding: 'utf8' }).trim();
    const parsed = output ? JSON.parse(output) : [];
    const otherChecks = Array.isArray(parsed) ? parsed : [parsed];
    assert.equal(otherChecks.length, 0, `Other QA process is active; defer GPU work: ${JSON.stringify(otherChecks)}`);
  }
  return chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--disable-features=CalculateNativeWinOcclusion'] });
}

async function main() {
  const phase = process.env.PALACE_PHASE || 'before';
  const captureOnly = process.env.PALACE_CAPTURE_ONLY === '1';
  assert.ok(['before', 'after'].includes(phase));
  const out = path.join(root, phase);
  await mkdir(out, { recursive: true });
  const browser = await launchBrowser();
  const report = { phase, base, capturedAt: new Date().toISOString(), head: execFileSync('git', ['rev-parse', 'HEAD']).toString().trim(), browser: browser.version(), headless: true, scope: captureOnly ? 'screenshots-only' : 'screenshots-and-performance', timingMethod: 'consecutive-positive-raf-timestamps-v2', performanceMeasured: !captureOnly, views: [], performance: [], errors: [], uploads: [], passed: false,
    limitations: ['Headless Edge / D3D11 的 rAF 帧率可能受刷新率上限影响，不等于 GPU 最大吞吐。', '没有 GPU timer、温度或独占 GPU 控制；其他聊天可能并行使用设备。', '网络字节来自开发服务器的 CDP 统计，包含模块请求，不能视为生产包体积。'] };
  try {
    for (const config of [
      { width: 1920, height: 1080, room: 'atrium', views: [
        { name: 'welcome', position: [0, 1.65, 23], target: [0, 3.5, -1], fov: 48 },
        { name: 'auxiliary', position: [0, 1.72, 16.5], target: [0, 3.5, -1], fov: 48 },
        { name: 'glass-closeup', position: [4.8, 2.6, 8.8], target: [0, 3.7, 0], fov: 48 },
      ] },
      { width: 390, height: 844, room: 'atrium', views: [{ name: 'mobile-welcome', position: [0, 1.65, 23], target: [0, 3.5, -1], fov: 48 }] },
      { width: 1920, height: 1080, room: 'glass-life', views: [{ name: 'glass-life', position: [0, 1.65, 13.8], target: [0, 3.15, -8], fov: 60 }] },
    ]) {
      const { context, page, traffic } = await createPage(browser, report, config);
      try {
        await arrive(page, config.room);
        for (const view of config.views) {
          await fixCamera(page, view.position, view.target, view.fov);
          const measured = await metrics(page), file = `${view.name}.png`;
          assert.equal(measured.roomId, config.room); assert.equal(measured.canvasCount, 1); assert.equal(measured.overflow, false); assert.equal(measured.pendingTextures, 0);
          await page.screenshot({ path: path.join(out, file), animations: 'disabled' });
          report.views.push({ name: view.name, file, target: view.target, ...measured, traffic: { ...traffic } });
          await writeFile(path.join(out, 'capture.json'), JSON.stringify(report, null, 2));
          console.log(`CAPTURED ${phase}/${file} ${JSON.stringify({ position: measured.position, fov: measured.fov, quality: measured.quality })}`);
        }
      } finally { await context.close(); }
    }
    // 性能只在截图关闭后串行采样；每次新上下文保持相同画质、视口和相机。
    for (let run = 1; run <= (captureOnly ? 0 : 3); run++) {
      const { context, page, traffic } = await createPage(browser, report);
      try {
        await arrive(page);
        await fixCamera(page, [0, 1.65, 23], [0, 3.5, -1], 48);
        await page.evaluate(() => new Promise(resolve => { const start = performance.now(); const frame = now => now - start >= 1600 ? resolve() : requestAnimationFrame(frame); requestAnimationFrame(frame); }));
        const conditions = await metrics(page);
        const sample = await page.evaluate(() => new Promise((resolve, reject) => {
          const frames = [], visibility = []; let start, previous;
          const tick = now => {
            // 首个 rAF 时间戳作为共同起点，避免与另一时钟取样点相减产生负首帧。
            if (previous === undefined) { start = now; previous = now; requestAnimationFrame(tick); return; }
            const interval = now - previous;
            if (!(interval > 0)) { reject(new Error('Expected a positive animation-frame interval')); return; }
            frames.push(interval); previous = now;
            if (document.hidden) visibility.push(frames.length);
            if (now - start >= 8000) {
              const sorted = [...frames].sort((a, b) => a - b), elapsed = frames.reduce((sum, frame) => sum + frame, 0);
              resolve({ elapsed, frameCount: frames.length, fps: frames.length * 1000 / elapsed, p50: sorted[Math.floor(sorted.length * .5)], p95: sorted[Math.floor(sorted.length * .95)], p99: sorted[Math.floor(sorted.length * .99)], over50: frames.filter(frame => frame > 50).length, hiddenFrames: visibility.length, frames });
            } else requestAnimationFrame(tick);
          }; requestAnimationFrame(tick);
        }));
        assert.equal(conditions.quality, 'medium'); assert.equal(sample.hiddenFrames, 0);
        report.performance.push({ run, conditions, traffic: { ...traffic }, ...sample });
        console.log(`PERF ${phase} ${run}: ${sample.fps.toFixed(2)} FPS, P50 ${sample.p50.toFixed(2)} ms, P95 ${sample.p95.toFixed(2)} ms`);
      } finally { await context.close(); }
    }
    if (phase === 'after') {
      const before = JSON.parse(await readFile(path.join(root, 'before', 'capture.json'), 'utf8'));
      for (const view of report.views) {
        const original = before.views.find(item => item.name === view.name);
        for (const key of ['position', 'quaternion', 'fov', 'quality', 'dpr', 'exposure', 'viewport']) assert.deepEqual(view[key], original[key], `${view.name}: matching ${key}`);
        if (view.name === 'glass-life') assert.deepEqual(view.glass, original.glass, '共享 Glass Life 材质保持原值');
      }
    }
    assert.deepEqual(report.errors, []); assert.deepEqual(report.uploads, []); report.passed = true;
  } catch (error) { report.failure = error.stack; process.exitCode = 1; console.error(error.stack); }
  finally { await browser.close(); await writeFile(path.join(out, 'capture.json'), JSON.stringify(report, null, 2)); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
