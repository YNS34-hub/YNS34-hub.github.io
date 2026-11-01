import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { arrive, base, createPage, emptyMedia, launchBrowser, metrics } from './capture-reference-atrium.mjs';

const stage = process.env.PALACE_STAGE || 'p2';
const out = path.resolve(process.env.PALACE_CHECK_ARTIFACTS || 'qa-artifacts/reference-rooms/checks', stage);
await mkdir(out, { recursive: true });
const report = { stage, checkedAt: new Date().toISOString(), base, checks: [], errors: [], uploads: [], passed: false };
const record = (name, details = {}) => { report.checks.push({ name, passed: true, ...details }); console.log(`PASS ${name}`); };
const browser = await launchBrowser();
const roomDefinitions = JSON.parse(await readFile('content/rooms.json', 'utf8'));
const projectDefinitions = JSON.parse(await readFile('content/projects.json', 'utf8'));
const samePose = (actual, expected) => {
  for (const field of ['position', 'quaternion']) actual[field].forEach((value, index) => assert.ok(Math.abs(value - expected[field][index]) < 1e-6, `Exact return ${field}[${index}]`));
};
const pose = page => page.evaluate(() => { const c = window.__PALACE_DEBUG__.camera; return { position: c.position.toArray(), quaternion: c.quaternion.toArray() }; });
const start = page => page.evaluate(() => window.__PALACE_DEV__.state.getState().update({ started: true, overlay: null }));
async function travel(page, roomId) {
  await page.getByRole('button', { name: 'GUIDE', exact: true }).click();
  await page.getByRole('dialog', { name: 'Museum guide', exact: true }).waitFor();
  const target = roomDefinitions.find(room => room.id === roomId);
  assert.ok(target, `Actual guide route ${roomId}`);
  await page.locator('.room-link').filter({ has: page.locator('.room-link-title', { hasText: target.title }) }).click();
  await page.waitForFunction(id => window.__PALACE_DEBUG__?.roomId === id && document.querySelector('.world-ready'), roomId, { timeout: 90000 });
  await page.waitForFunction(() => !window.__PALACE_DEBUG__.textureStatus().pending);
}
async function sceneIds(page, prefix) {
  return page.evaluate(prefix => { const ids = []; window.__PALACE_DEBUG__.scene.traverse(object => { if (object.name.startsWith(prefix)) ids.push(object.name.slice(prefix.length)); }); return ids.sort(); }, prefix);
}
async function captionBounds(page, prefix) {
  await page.evaluate(() => document.fonts.ready);
  const panels = await page.evaluate(prefix => {
    const { scene } = window.__PALACE_DEBUG__; scene.updateMatrixWorld(true); const panels = [];
    scene.traverse(root => {
      if (!root.name.startsWith(prefix)) return;
      const inverse = root.matrixWorld.clone().invert(), meshes = [];
      root.traverse(mesh => {
        if (!mesh.isMesh || !mesh.geometry) return;
        mesh.geometry.computeBoundingBox();
        const box = mesh.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(mesh.matrixWorld));
        meshes.push({ mesh, box });
      });
      const plaque = meshes.find(({ mesh, box }) => mesh.material?.isMeshStandardMaterial && box.max.y < 0 && box.max.y - box.min.y >= .7 && box.max.y - box.min.y <= 1.1 && box.max.x - box.min.x > 1.2);
      if (!plaque) return;
      const labels = meshes.filter(({ mesh, box }) => box.max.y < 0 && mesh.material?.map?.isCanvasTexture && mesh.material.polygonOffset && !mesh.material.depthWrite);
      panels.push({ name: root.name, plaque: { min: plaque.box.min.toArray(), max: plaque.box.max.toArray() }, labels: labels.map(({ box }) => ({ min: box.min.toArray(), max: box.max.toArray() })) });
    });
    return panels;
  }, prefix);
  assert.ok(panels.length > 0, `${prefix}: physical caption plaques exist`);
  for (const panel of panels) {
    assert.equal(panel.labels.length, 2, `${panel.name}: actual title and metadata planes`);
    for (const label of panel.labels) for (const axis of [0, 1]) {
      assert.ok(label.min[axis] >= panel.plaque.min[axis] - .002, `${panel.name}: caption starts inside plaque axis ${axis}`);
      assert.ok(label.max[axis] <= panel.plaque.max[axis] + .002, `${panel.name}: caption ends inside plaque axis ${axis}`);
    }
  }
  record(`${prefix === 'project:' ? 'project' : 'archive'}-actual-font-planes-fit-physical-caption-plaques`, { panels });
}
async function faceAndClick(page, name, offset = [0, 0, 0]) {
  // 只摆放验收相机；激活由真实 Canvas 点击触发，后续严格核验应用实际打开的展品 ID。
  const point = await page.evaluate(({ name, offset }) => {
    const { camera, scene } = window.__PALACE_DEBUG__, object = scene.getObjectByName(name);
    if (!object) throw new Error(`Missing actual scene object: ${name}`);
    scene.updateMatrixWorld(true);
    const target = object.getWorldPosition(camera.position.clone()), normal = camera.position.clone().set(0, 0, 1).applyQuaternion(object.getWorldQuaternion(camera.quaternion.clone()));
    target.add(camera.position.clone().fromArray(offset).applyQuaternion(object.getWorldQuaternion(camera.quaternion.clone())));
    camera.position.copy(target).addScaledVector(normal, 7); camera.position.y = Math.max(1.65, target.y - .9); camera.lookAt(target); camera.updateMatrixWorld(true);
    const state = window.__PALACE_DEV__.state.getState();
    state.update({ started: true, overlay: null, travelSequence: state.travelSequence + 1, returnView: { roomId: state.roomId, position: camera.position.toArray(), quaternion: camera.quaternion.toArray() } });
    return { x: innerWidth / 2, y: innerHeight / 2 };
  }, { name, offset });
  // Player的返回姿态和R3F事件矩阵在下一帧提交；等实际渲染后再点击可见画面。
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.mouse.click(point.x, point.y);
}
async function p2() {
  const { context, page } = await createPage(browser, report);
  await context.tracing.start({ screenshots: true, snapshots: true });
  page.setDefaultTimeout(30000);
  try {
    await arrive(page, 'projects'); await start(page);
    const ids = await sceneIds(page, 'project:');
    for (const project of projectDefinitions) assert.ok(ids.includes(project.id), `Original project ${project.id}`);
    assert.ok(ids.includes('nonlinear-glass-study'));
    record('projects-preserve-all-original-ids-and-original-glass-study', { ids });
    await captionBounds(page, 'project:');
    for (const item of projectDefinitions) {
      await faceAndClick(page, `project:${item.id}`);
      const dialog = page.getByRole('dialog', { name: item.title, exact: true }); await dialog.waitFor();
      assert.equal(await page.evaluate(() => window.__PALACE_DEV__.state.getState().focus?.id), item.id);
      assert.equal(await page.evaluate(() => window.__PALACE_DEBUG__.roomId), 'projects');
      const saved = await pose(page);
      if (item.github) assert.equal(await dialog.getByRole('link', { name: 'SOURCE', exact: true }).getAttribute('href'), item.github);
      if (item.demo) assert.equal(await dialog.getByRole('link', { name: 'ENTER PROJECT', exact: true }).getAttribute('href'), item.demo);
      const image = dialog.locator('.focus-cover');
      assert.equal(await image.getAttribute('alt'), item.coverCaption || item.title);
      assert.equal(await image.getAttribute('loading'), 'lazy');
      await page.keyboard.down('w'); await page.waitForTimeout(220); await page.keyboard.up('w'); samePose(await pose(page), saved);
      assert.equal(await page.locator('iframe').count(), 0);
      await page.screenshot({ path: path.join(out, `project-${item.id}.png`) });
      await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' }); samePose(await pose(page), saved);
      record(`project-real-canvas-focus-links-and-modal-return-${item.id}`, { hrefVerifiedWithoutExternalNavigation: true });
    }
    await travel(page, 'wallpapers');
    const expected = await page.evaluate(async () => {
      const { worksForRoom } = await import('/src/systems/mediaPlacement.ts'), library = window.__PALACE_DEV__.library.getState();
      return worksForRoom([...library.wallpapers, ...library.personal.visuals], 'wallpapers').slice(0, 5).map(item => item.id).sort();
    });
    assert.deepEqual(await sceneIds(page, 'work:'), expected);
    assert.ok(expected.length > 0);
    record('image-archive-keeps-public-works-and-original-stable-ids', { ids: expected });
    await captionBounds(page, 'work:');
    const imageId = expected[0];
    await faceAndClick(page, `work:${imageId}`);
    await page.waitForFunction(() => window.__PALACE_DEBUG__?.roomId === 'cinema' && document.querySelector('.world-ready'), null, { timeout: 90000 });
    assert.equal(await page.evaluate(() => window.__PALACE_DEV__.state.getState().cinemaImage.id), imageId);
    const returnPose = await page.evaluate(async () => { const { cinemaReturn } = await import('/src/world/visitView.ts'); return cinemaReturn; });
    await page.getByRole('button', { name: 'Image metadata', exact: true }).click();
    await page.locator('.cinema-metadata').waitFor(); await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => window.__PALACE_DEBUG__.roomId), 'cinema'); assert.equal(await page.locator('.cinema-metadata').count(), 0);
    const favorite = page.getByRole('button', { name: 'Favorite image', exact: true });
    const originallyKept = await favorite.getAttribute('aria-pressed') === 'true';
    await favorite.click();
    await page.waitForFunction(({ id, expected }) => window.__PALACE_DEV__.library.getState().wallpapers.find(image => image.id === id)?.favorite === expected, { id: imageId, expected: !originallyKept });
    assert.equal(await favorite.getAttribute('aria-pressed'), String(!originallyKept));
    if (originallyKept) {
      await favorite.click();
      await page.waitForFunction(id => window.__PALACE_DEV__.library.getState().wallpapers.find(image => image.id === id)?.favorite === true, imageId);
    }
    assert.equal(await favorite.getAttribute('aria-pressed'), 'true');
    await page.getByRole('button', { name: 'Next image', exact: true }).click();
    await page.waitForFunction(id => window.__PALACE_DEV__.state.getState().cinemaImage.id !== id, imageId);
    await page.getByRole('button', { name: 'Previous image', exact: true }).click();
    await page.waitForFunction(id => window.__PALACE_DEV__.state.getState().cinemaImage.id === id, imageId);
    await page.screenshot({ path: path.join(out, 'cinema-favorite.png') });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__PALACE_DEBUG__?.roomId === 'wallpapers' && document.querySelector('.world-ready'), null, { timeout: 90000 });
    samePose(await pose(page), returnPose);
    record('real-image-click-cinema-metadata-favorite-next-previous-and-exact-return');
    await page.reload(); await arriveReady(page);
    assert.equal(await page.evaluate(id => window.__PALACE_DEV__.library.getState().wallpapers.find(image => image.id === id)?.favorite, imageId), true);
    record('favorite-persists-after-reload-without-private-media');
    await page.getByRole('button', { name: 'GUIDE', exact: true }).click();
    await page.getByRole('button', { name: 'Arrange / import works', exact: true }).click();
    const fixture = await readFile('public/media/generated/threshold.webp');
    await page.getByLabel('Import files into a room', { exact: true }).setInputFiles([
      { name: 'Reference QA one.webp', mimeType: 'image/webp', buffer: fixture },
      { name: 'Reference QA two.webp', mimeType: 'image/webp', buffer: fixture },
    ]);
    await page.getByLabel('Target gallery', { exact: true }).selectOption('wallpapers');
    await page.getByRole('button', { name: 'CONFIRM PLACEMENT', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('[data-placed="true"]').length === 2);
    await page.getByRole('button', { name: 'SEE IN THE ROOM →', exact: true }).click();
    await page.waitForFunction(() => window.__PALACE_DEBUG__?.roomId === 'wallpapers' && document.querySelector('.world-ready'));
    const all = await page.evaluate(async () => { const { worksForRoom } = await import('/src/systems/mediaPlacement.ts'), library = window.__PALACE_DEV__.library.getState(); return worksForRoom([...library.wallpapers, ...library.personal.visuals], 'wallpapers').map(image => image.id); });
    assert.equal(all.length, expected.length + 2);
    assert.deepEqual(await sceneIds(page, 'work:'), all.slice(0, 5).sort());
    const door = await page.evaluate(async () => { const { proximity } = await import('/src/world/proximity.ts'); return [...proximity.keys()].find(key => key.startsWith('door:wallpapers-page-2:')); });
    assert.ok(door, 'Further works door exists after sixth work');
    // 分页门由真实 Canvas 点击后原有步行接近流程完成；不直接写 pendingDoor 或路由。
    const doorPoint = await page.evaluate(async () => {
      const { proximity } = await import('/src/world/proximity.ts');
      const entry = [...proximity.entries()].find(([key]) => key.startsWith('door:wallpapers-page-2:'))[1];
      const { camera } = window.__PALACE_DEBUG__, target = entry.object.getWorldPosition(camera.position.clone());
      camera.position.set(0, 1.65, -11); camera.lookAt(target); camera.updateMatrixWorld(true);
      const state = window.__PALACE_DEV__.state.getState();
      state.update({ travelSequence: state.travelSequence + 1, returnView: { roomId: state.roomId, position: camera.position.toArray(), quaternion: camera.quaternion.toArray() } });
      target.project(camera); return { x: (target.x + 1) * innerWidth / 2, y: (1 - target.y) * innerHeight / 2 };
    });
    await page.mouse.click(doorPoint.x, doorPoint.y);
    await page.waitForFunction(() => window.__PALACE_DEV__.state.getState().pendingDoor === 'wallpapers-page-2' || window.__PALACE_DEBUG__.roomId === 'wallpapers-page-2');
    record('actual-further-works-door-click-sets-original-walking-navigation');
    await page.waitForFunction(() => window.__PALACE_DEBUG__?.roomId === 'wallpapers-page-2' && document.querySelector('.world-ready'), null, { timeout: 90000 });
    assert.deepEqual(await sceneIds(page, 'work:'), all.slice(5, 10).sort());
    await page.screenshot({ path: path.join(out, 'archive-second-page.png') });
    await page.reload(); await arriveReady(page);
    assert.deepEqual(await sceneIds(page, 'work:'), all.slice(5, 10).sort());
    record('public-fixture-import-stable-id-pagination-and-reload', { works: all.length, source: 'Existing public threshold.webp copied into disposable browser IndexedDB; no user media read.' });
    await travel(page, 'atrium'); assert.equal(new URL(page.url()).pathname, '/');
    record('guide-returns-from-procedural-gallery-page-to-atrium');
  } catch (error) {
    report.failureState = await page.evaluate(async () => {
      const state = window.__PALACE_DEV__?.state.getState(), debug = window.__PALACE_DEBUG__;
      const target = debug ? await import('/src/world/walkTarget.ts') : null;
      return { roomId: debug?.roomId, pathname: location.pathname, started: state?.started, overlay: state?.overlay, focus: state?.focus?.id, pendingDoor: state?.pendingDoor,
        camera: debug ? { position: debug.camera.position.toArray(), quaternion: debug.camera.quaternion.toArray() } : null,
        walkTarget: target?.walkTarget.toArray(), hasWalkTarget: target?.hasWalkTarget };
    }).catch(() => null);
    await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
    throw error;
  } finally { await context.tracing.stop({ path: path.join(out, 'trace.zip') }); await context.close(); }
  for (const roomId of ['projects', 'wallpapers']) {
    const { context, page } = await createPage(browser, report, { width: 390, height: 844 });
    try {
      await arrive(page, roomId); await start(page);
      const measured = await metrics(page); assert.equal(measured.overflow, false); assert.equal(measured.canvasCount, 1);
      const guide = page.getByRole('button', { name: 'GUIDE', exact: true }), bounds = await guide.boundingBox();
      assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 390 && bounds.y >= 0 && bounds.y + bounds.height <= 844);
      await guide.click(); await page.getByRole('dialog', { name: 'Museum guide', exact: true }).waitFor();
      await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({ state: 'hidden' });
      await page.screenshot({ path: path.join(out, `mobile-${roomId}.png`) });
      record(`mobile-native-controls-and-no-overflow-${roomId}`, { viewport: measured.viewport, guideBounds: bounds });
    } finally { await context.close(); }
  }
}
async function arriveReady(page) {
  await page.waitForFunction(() => document.querySelector('.world-ready') && window.__PALACE_DEV__?.library.getState().ready, null, { timeout: 90000 });
  await page.waitForFunction(() => !window.__PALACE_DEBUG__.textureStatus().pending);
  await start(page);
}
async function researchRoom() {
  const { context, page } = await createPage(browser, report);
  await context.tracing.start({ screenshots: true, snapshots: true });
  page.setDefaultTimeout(30000);
  try {
    await arrive(page, 'research'); await start(page);
    const architecture = await page.evaluate(() => {
      const { scene } = window.__PALACE_DEBUG__, furniture = scene.getObjectByName('reference-study-furniture');
      const result = { tori: 0, knots: 0, furnitureMeshes: 0, physicalMaterials: 0, furnitureBounds: null };
      scene.updateMatrixWorld(true);
      scene.traverse(mesh => { if (mesh.geometry?.type === 'TorusGeometry') result.tori++; if (mesh.geometry?.type === 'TorusKnotGeometry') result.knots++; });
      let union;
      furniture?.traverse(mesh => {
        if (!mesh.isMesh) return;
        result.furnitureMeshes++;
        if (mesh.material?.isMeshStandardMaterial) result.physicalMaterials++;
        let box;
        if (mesh.isInstancedMesh) { mesh.computeBoundingBox(); box = mesh.boundingBox.clone(); }
        else { mesh.geometry.computeBoundingBox(); box = mesh.geometry.boundingBox.clone(); }
        box.applyMatrix4(mesh.matrixWorld);
        if (union) union.union(box); else union = box;
      });
      if (union) result.furnitureBounds = { min: union.min.toArray(), max: union.max.toArray() };
      return result;
    });
    assert.equal(architecture.tori, 13); assert.equal(architecture.knots, 1);
    assert.ok(architecture.furnitureMeshes >= 3 && architecture.physicalMaterials >= 3, 'Reading furniture uses physical 3D meshes');
    const bounds = architecture.furnitureBounds;
    assert.ok(bounds && [...bounds.min, ...bounds.max].every(Number.isFinite));
    assert.ok(bounds.max[0] - bounds.min[0] > 4 && bounds.max[1] - bounds.min[1] > .7 && bounds.max[2] - bounds.min[2] > 1.5);
    record('research-keeps-thirteen-mathematical-rings-and-knot-with-physical-reading-furniture', architecture);
    await page.evaluate(() => {
      const camera = window.__PALACE_DEBUG__.camera, state = window.__PALACE_DEV__.state.getState();
      camera.position.set(7.5, 1.65, 8.8); camera.lookAt(7.5, 1.65, 0);
      state.update({ started: true, overlay: null, travelSequence: state.travelSequence + 1, returnView: { roomId: 'research', position: camera.position.toArray(), quaternion: camera.quaternion.toArray() } });
    });
    const before = await pose(page);
    await page.keyboard.down('w'); await page.waitForTimeout(2800); await page.keyboard.up('w');
    await page.evaluate(() => new Promise(resolve => { let n = 0; const tick = () => ++n >= 24 ? resolve() : requestAnimationFrame(tick); requestAnimationFrame(tick); }));
    const after = await pose(page);
    assert.ok(after.position[2] < before.position[2] - .8, 'Native movement approaches the desk');
    assert.ok(after.position[2] >= 4.85 && Math.abs(after.position[0] - 7.5) < .4, 'Native movement stops outside physical desk front');
    await page.screenshot({ path: path.join(out, 'research-native-desk-approach.png') });
    record('research-native-walking-approaches-but-cannot-cross-reading-desk', { before, after });
    const definitions = JSON.parse(await readFile('content/research.json', 'utf8')), audit = definitions.find(item => item.id === 'reviewer-first-audit');
    assert.ok(audit);
    await faceAndClick(page, 'project:' + audit.id);
    const dialog = page.getByRole('dialog', { name: audit.title, exact: true }); await dialog.waitFor();
    assert.equal(await page.evaluate(() => window.__PALACE_DEV__.state.getState().focus.id), audit.id);
    const readingPose = await pose(page);
    if (audit.github) assert.equal(await dialog.getByRole('link', { name: 'SOURCE', exact: true }).getAttribute('href'), audit.github);
    await page.keyboard.down('w'); await page.waitForTimeout(180); await page.keyboard.up('w'); samePose(await pose(page), readingPose);
    await page.screenshot({ path: path.join(out, 'research-original-work-focus.png') });
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' }); samePose(await pose(page), readingPose);
    record('research-original-audit-work-opens-by-canvas-and-returns-without-camera-drift');
    await travel(page, 'atrium'); assert.equal(new URL(page.url()).pathname, '/');
    record('research-guide-and-return-controls-preserved');
  } catch (error) { await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {}); throw error; }
  finally { await context.tracing.stop({ path: path.join(out, 'trace.zip') }); await context.close(); }
  const { context: mobileContext, page: mobile } = await createPage(browser, report, { width: 390, height: 844 });
  try {
    await arrive(mobile, 'research'); await start(mobile);
    const measured = await metrics(mobile); assert.equal(measured.overflow, false); assert.equal(measured.canvasCount, 1);
    await mobile.getByRole('button', { name: 'GUIDE', exact: true }).click(); await mobile.getByRole('dialog', { name: 'Museum guide', exact: true }).waitFor();
    await mobile.screenshot({ path: path.join(out, 'mobile-research-guide.png') });
    record('research-mobile-real-scene-and-guide-without-overflow', { viewport: measured.viewport });
  } finally { await mobileContext.close(); }
}
async function musicRoom() {
  const { context, page } = await createPage(browser, report);
  await context.addInitScript(() => {
    window.__QA_AUDIO__ = [];
    window.Audio = new Proxy(window.Audio, { construct(target, args) { const element = Reflect.construct(target, args); window.__QA_AUDIO__.push(element); return element; } });
  });
  await context.tracing.start({ screenshots: true, snapshots: true });
  page.setDefaultTimeout(30000);
  const title = 'Reference QA listening';
  try {
    await arrive(page, 'music'); await start(page);
    const instrument = await page.evaluate(() => {
      const fins = window.__PALACE_DEBUG__.scene.getObjectByName('audio-fins');
      return fins?.children.map(fin => ({ rotationZ: fin.rotation.z, positionY: fin.position.y, optical: fin.children.filter(mesh => mesh.material?.isMeshPhysicalMaterial).map(mesh => ({ transmission: mesh.material.transmission, ior: mesh.material.ior, thickness: mesh.material.thickness })) }));
    });
    assert.equal(instrument?.length, 7);
    instrument.forEach((fin, index) => { assert.ok(Math.abs(fin.rotationZ - (index - 3) * .055) < 1e-6); assert.equal(fin.optical.length, 1); assert.ok(fin.optical[0].transmission > .5 && fin.optical[0].ior === 1.46); });
    record('music-keeps-seven-physical-glass-fins-with-original-optical-model', { instrument });
    await faceAndClick(page, 'audio-fins', [0, 3, 0]);
    const dialog = page.getByRole('dialog'); await dialog.waitFor();
    await page.getByLabel('Import local audio files', { exact: true }).setInputFiles({ name: title + '.wav', mimeType: 'audio/wav', buffer: await readFile('public/media/generated/palace-study.wav') });
    const row = page.locator('.record-row').filter({ hasText: title }); await row.waitFor();
    await page.getByLabel('Crossfade duration', { exact: true }).selectOption('0');
    const volume = page.getByLabel('Music volume', { exact: true });
    await volume.focus(); await volume.press('Home'); for (let i = 0; i < 8; i++) await volume.press('ArrowRight');
    await page.evaluate(() => window.__PALACE_DEV__.state.getState().update({ reducedMotion: false }));
    await row.locator('.record-title').click();
    await page.waitForFunction(() => { const audio = window.__PALACE_DEV__.audio.getState(), signal = window.__PALACE_DEBUG__.audioSignal; return audio.playing && audio.duration > 0 && audio.progress > .1 && signal.available && signal.rms > 0; });
    const actualAudio = await page.evaluate(() => { const state = window.__PALACE_DEV__.audio.getState(), signal = window.__PALACE_DEBUG__.audioSignal; return { currentId: state.currentId, playing: state.playing, progress: state.progress, duration: state.duration, error: state.error, signal: { ...signal }, activeAudioElements: window.__QA_AUDIO__.filter(element => !element.paused && !element.ended && element.currentSrc).length }; });
    assert.equal(actualAudio.error, null); assert.equal(actualAudio.activeAudioElements, 1);
    record('music-native-public-wav-import-and-single-real-audio-element-playback', actualAudio);
    const response = await page.evaluate(() => new Promise(resolve => {
      const { scene, audioSignal } = window.__PALACE_DEBUG__, fins = scene.getObjectByName('audio-fins'), samples = []; let frames = 0;
      const tick = () => {
        samples.push({ rotations: fins.children.map(fin => fin.rotation.z), y: fins.children.map(fin => fin.position.y), signal: { ...audioSignal } });
        if (++frames >= 50) resolve(samples); else requestAnimationFrame(tick);
      }; requestAnimationFrame(tick);
    }));
    assert.ok(response.some(sample => sample.signal.available && sample.signal.rms > 0));
    assert.ok(response.some(sample => sample.rotations.some((rotation, index) => Math.abs(rotation - (index - 3) * .055) > 1e-5)), 'Actual audible signal reaches the rendered fin group');
    for (const sample of response) sample.rotations.forEach((rotation, index) => assert.ok(Math.abs(rotation - (index - 3) * .055) <= .056));
    record('music-real-analyser-drives-bounded-existing-fin-response', { samples: response.length, maxAngularDeparture: Math.max(...response.flatMap(sample => sample.rotations.map((rotation, index) => Math.abs(rotation - (index - 3) * .055)))) });
    await page.getByLabel('Import lyrics for current track', { exact: true }).setInputFiles({ name: 'reference-qa.lrc', mimeType: 'text/plain', buffer: Buffer.from('[00:00.00]A quiet reading\n[00:04.00]停在这束光里\n[00:08.00]The room keeps listening\n[00:12.00]A final interval') });
    await page.getByText('Synchronized wall lyrics', { exact: true }).waitFor();
    await dialog.getByRole('button', { name: 'Pause music', exact: true }).click();
    await page.waitForFunction(() => !window.__PALACE_DEV__.audio.getState().playing);
    const progress = page.getByLabel('Track progress', { exact: true });
    await progress.focus(); await progress.press('Home'); for (let i = 0; i < 50; i++) await progress.press('ArrowRight');
    const seeked = await page.evaluate(() => window.__PALACE_DEV__.audio.getState().progress); assert.ok(seeked >= 4.9 && seeked <= 5.1, 'Native seek range reaches five seconds');
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
    await page.evaluate(() => {
      const camera = window.__PALACE_DEBUG__.camera, state = window.__PALACE_DEV__.state.getState();
      camera.position.set(6, 1.65, -1.5); camera.lookAt(6.8, 4.4, -10.3);
      state.update({ travelSequence: state.travelSequence + 1, returnView: { roomId: 'music', position: camera.position.toArray(), quaternion: camera.quaternion.toArray() } });
    });
    await page.waitForFunction(() => document.querySelector('.lyric-wall')?.dataset.line === '1');
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.lyrics-projection')).visibility === 'visible');
    assert.equal(await page.locator('.lyric-line.is-current').innerText(), '停在这束光里');
    const paused = await page.evaluate(() => window.__PALACE_DEV__.audio.getState().progress);
    await page.waitForTimeout(450); assert.ok(Math.abs((await page.evaluate(() => window.__PALACE_DEV__.audio.getState().progress)) - paused) < .1);
    record('music-native-lyrics-import-seek-pause-and-chinese-active-line-preserved', { pausedPosition: paused });
    await page.evaluate(() => window.__PALACE_DEV__.state.getState().update({ reducedMotion: true }));
    await page.waitForFunction(() => {
      const { scene } = window.__PALACE_DEBUG__, fins = scene.getObjectByName('audio-fins'), rhythm = scene.getObjectByName('rhythm-light-details');
      return fins.children.every((fin, i) => Math.abs(fin.rotation.z - (i - 3) * .055) < .001 && Math.abs(fin.position.y) < .001) && rhythm.children.every(mesh => Math.abs(mesh.material.emissiveIntensity - .08) < .001);
    });
    await page.screenshot({ path: path.join(out, 'music-lyrics-paused-and-quiet.png') });
    record('music-paused-and-reduced-motion-settle-original-fins-and-rhythm-lights');
    const trackId = actualAudio.currentId;
    await page.reload(); await arriveReady(page);
    const restored = await page.evaluate(id => { const track = window.__PALACE_DEV__.library.getState().music.find(track => track.id === id); return track ? { id: track.id, title: track.title, src: track.src, lyrics: track.lyrics } : null; }, trackId);
    assert.ok(restored && restored.src.startsWith('blob:')); assert.equal(restored.title, title); assert.equal(restored.lyrics.lines.length, 4); assert.equal(restored.lyrics.synced, true);
    record('music-public-fixture-audio-blob-and-lyrics-persist-in-disposable-browser', { id: restored.id, lines: restored.lyrics.lines.length });
    await travel(page, 'atrium'); record('music-guide-and-return-controls-preserved');
  } catch (error) { await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {}); throw error; }
  finally { await context.tracing.stop({ path: path.join(out, 'trace.zip') }); await context.close(); }
  const { context: mobileContext, page: mobile } = await createPage(browser, report, { width: 390, height: 844 });
  try {
    await arrive(mobile, 'music'); await start(mobile);
    const measured = await metrics(mobile); assert.equal(measured.overflow, false); assert.equal(measured.canvasCount, 1);
    await mobile.getByRole('button', { name: /OPEN COLLECTION/ }).click(); await mobile.getByRole('dialog').waitFor();
    assert.equal(await mobile.getByLabel('Import local audio files', { exact: true }).count(), 1);
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await mobile.screenshot({ path: path.join(out, 'mobile-music-player.png') });
    await mobile.keyboard.press('Escape'); await mobile.getByRole('dialog').waitFor({ state: 'hidden' });
    record('music-mobile-original-listening-controls-and-import-remain-responsive', { viewport: measured.viewport });
  } finally { await mobileContext.close(); }
}
try {
  assert.deepEqual(await (await fetch(base + '/personal-media/manifest.json')).json(), emptyMedia);
  assert.equal((await (await fetch(base + '/personal-media/avatar.json')).json()).profile, null);
  record('actual-isolated-public-manifests-empty');
  if (stage === 'p2') await p2();
  else if (stage === 'p3-research') await researchRoom();
  else if (stage === 'p3-music') await musicRoom();
  else throw new Error(`Unsupported stage: ${stage}`);
  assert.deepEqual(report.errors, []); assert.deepEqual(report.uploads, []);
  record('no-browser-errors-or-network-uploads'); report.passed = true;
} catch (error) { report.failure = error.stack; process.exitCode = 1; console.error(error.stack); }
finally { await browser.close(); await writeFile(path.join(out, 'results.json'), JSON.stringify(report, null, 2)); }
