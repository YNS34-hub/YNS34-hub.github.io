import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, readdir, mkdir, copyFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import path from 'node:path';

const root = 'qa-artifacts/release', docs = 'docs/design-references/memory-palace', evidence = docs + '/release-evidence';
const baseline = 'a86b3d243d24b6a669407f1a05b662ad2a9f3fe0';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = async file => JSON.parse(await readFile(file, 'utf8'));
const result = { at: new Date().toISOString(), baseline, sourceHead: execFileSync('git', ['rev-parse', 'HEAD']).toString().trim(), comparisons: [], performance: [], browser: [], passed: false };
const views = [], fields = ['position', 'quaternion', 'fov', 'quality', 'dpr', 'exposure', 'viewport'];
await mkdir(evidence, { recursive: true });
for (const part of ['atrium', 'rooms', 'details']) {
  const before = await read(`${root}/${part}/before/capture.json`), after = await read(`${root}/${part}/after/capture.json`);
  for (const report of [before, after]) { assert.equal(report.passed, true, part); assert.deepEqual(report.errors, []); assert.deepEqual(report.uploads, []); }
  for (const original of before.views) {
    const current = after.views.find(view => view.name === original.name); assert.ok(current);
    for (const field of fields) assert.deepEqual(current[field], original[field], original.name + ': ' + field);
    if (original.road) assert.deepEqual(current.road, original.road);
    const images = [];
    for (const [phase, view] of [['before', original], ['after', current]]) {
      const source = `${root}/${part}/${phase}/${view.file}`, target = `${evidence}/${part}/${phase}/${view.file}`, bytes = await readFile(source);
      assert.ok(bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')));
      assert.deepEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], view.viewport);
      await mkdir(path.dirname(target), { recursive: true }); await copyFile(source, target);
      images.push({ phase, path: target.slice(docs.length + 1), sha256: sha(bytes), bytes: bytes.length });
    }
    result.comparisons.push({ name: original.name, part, fields, beforeCamera: Object.fromEntries(fields.map(key => [key, original[key]])), images });
    views.push([original.name, original.name, '实际已发布主分支与整合候选；位置、朝向、视角、曝光和画质均匹配。', '', `release-evidence/${part}/`]);
    if (original.frameTimes && current.frameTimes) {
      for (const view of [original, current]) assert.ok(view.frameTimes.frames.every(value => value > 0));
      result.performance.push({ room: original.name, method: 'one 8-second static sample per version; shared device, not GPU timer',
        before: { fps: original.frameTimes.fps, p95: original.frameTimes.p95, render: original.render, memory: original.memory },
        after: { fps: current.frameTimes.fps, p95: current.frameTimes.p95, render: current.render, memory: current.memory } });
    }
  }
}
assert.equal(result.comparisons.length, 15);
for (const [name, relative] of [
  ['atrium', 'atrium/checks/results.json'], ['exhibits', 'checks/p2/results.json'], ['research', 'checks/p3-research/results.json'],
  ['music', 'checks/p3-music/results.json'], ['court', 'checks/court-lighting/validation.json'], ['public', 'public/results.json'],
]) {
  const report = await read(root + '/' + relative); assert.equal(report.passed, true, name); assert.equal(report.errors?.length || 0, 0, name); assert.equal(report.uploads?.length || 0, 0, name);
  result.browser.push({ name, checks: report.checks?.length, passed: true });
  await writeFile(`${evidence}/${name}-checks.json`, JSON.stringify(report, null, 2) + '\n');
}
const units = await read(root + '/unit-results.json'); assert.equal(units.success, true); assert.equal(units.numFailedTests, 0);
result.units = { passed: true, files: units.testResults.length, tests: units.numTotalTests };
for (const file of ['typecheck.log', 'lint.log']) assert.equal((await readFile(root + '/' + file, 'utf8')).trim(), '', file);
assert.match(await readFile(root + '/build-publish.log', 'utf8'), /built in/);
assert.match(await readFile(root + '/postbuild-publish.log', 'utf8'), /67 shareable routes/);
result.protected = [];
const protectedFiles = execFileSync('git', ['ls-tree', '-r', '--name-only', baseline], { encoding: 'utf8' }).trim().split('\n').filter(file =>
  file.startsWith('src/audio/') || file.startsWith('src/systems/') || file.startsWith('src/worlds/presence/') || file.startsWith('content/') ||
  /^(src\/worlds\/(road\/(route|model|physics|state)|court\/(controls|state))|src\/world\/(World|GlassSculpture)|package(?:-lock)?\.json|public\/assets\/memory-glass\.glb)/.test(file));
for (const file of protectedFiles) {
  const before = execFileSync('git', ['show', baseline + ':' + file], { maxBuffer: 10 * 1024 * 1024 }), after = await readFile(file);
  const normalized = bytes => bytes.toString('utf8').replace(/\r\n/g, '\n');
  assert.ok(before.equals(after) || !file.endsWith('.glb') && normalized(before) === normalized(after), 'Protected released source: ' + file);
  result.protected.push({ file, sha256: sha(after) });
}
const refs = await read(docs + '/asset-manifest.json');
const images = [];
async function walk(directory) { for (const item of await readdir(directory, { withFileTypes: true })) { const file = path.join(directory, item.name); if (item.isDirectory()) await walk(file); else if (file.endsWith('.png')) images.push(file); } }
await walk(docs + '/boards'); await walk(docs + '/standalone-studies');
assert.equal(images.length, 17); const hashes = [];
for (const file of images) { const digest = sha(await readFile(file)); assert.ok(JSON.stringify(refs).includes(digest)); hashes.push(digest); }
assert.equal(new Set(hashes).size, 14); result.references = { files: 17, unique: 14, productionArtworkApproved: false };
const dist = 'dist-release-final-publish';
for (const directory of ['public/personal-media', dist + '/personal-media']) {
  assert.deepEqual((await readdir(directory)).sort(), ['avatar.json', 'manifest.json']);
  assert.ok(Object.values(await read(directory + '/manifest.json')).every(items => Array.isArray(items) && !items.length));
  assert.equal((await read(directory + '/avatar.json')).profile, null);
}
const html = await readFile(dist + '/index.html', 'utf8'), entry = html.match(/<script[^>]+src="([^"]+\.js)"/)[1].replace(/^\//, '');
const queue = [entry], seen = new Set(), chunks = [];
while (queue.length) {
  const file = queue.pop(); if (seen.has(file)) continue; seen.add(file); const bytes = await readFile(dist + '/' + file);
  chunks.push({ file, sha256: sha(bytes), bytes: bytes.length, gzipBytes: gzipSync(bytes).length });
  for (const match of bytes.toString('utf8').matchAll(/["']((?:\.{1,2}\/|\/?assets\/)[^"'\s?]+\.js)["']/g)) {
    const dependency = match[1].startsWith('.') ? path.posix.normalize(path.posix.join(path.posix.dirname(file), match[1])) : match[1].replace(/^\//, ''); if (!seen.has(dependency)) queue.push(dependency);
  }
}
assert.deepEqual((await readdir(dist + '/assets')).filter(file => file.endsWith('.js') && !seen.has('assets/' + file)), []);
result.bundle = { entry, chunks, bytes: chunks.reduce((sum, item) => sum + item.bytes, 0), gzipBytes: chunks.reduce((sum, item) => sum + item.gzipBytes, 0) };
let review = await readFile(docs + '/review-release.html', 'utf8');
review = review.replace('V1 → V2 同机位审阅', '已发布主分支 → 视觉升级').replace(/const views=\[[\s\S]*?\n\];/, 'const views=' + JSON.stringify(views, null, 2) + ';')
  .replace('The Memory Palace · 第二轮视觉审阅', 'The Memory Palace · 发布画面对照')
  .replace("const atrium='../../../qa-artifacts/reference-v2/atrium/';", "const atrium='release-evidence/atrium/';")
  .replace('15组真实浏览器截图。左侧是第二轮开始前冻结的V1，右侧是V2候选。拖动滑杆或使用方向键比较；测试通过与用户视觉认可分别记录。', '15组真实浏览器截图。左侧为发布前主分支，右侧为本次整合版本；匹配相机和画质。拖动滑杆或用方向键比较。')
  .replace('<a href="VISUAL_REFINEMENT.md">第二轮实施台账</a> 和 <a href="FINAL_REPORT_V2.md">第二轮报告</a>', '<a href="RELEASE_20261101.md">发布整合记录</a>');
await writeFile(docs + '/review-release.html', review);
result.passed = true;
await writeFile(root + '/release-validation.json', JSON.stringify(result, null, 2) + '\n');
await writeFile(evidence + '/validation.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ passed: true, tests: result.units.tests, comparisons: result.comparisons.length, protected: result.protected.length, chunks: chunks.length }));
