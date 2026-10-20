import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import {createHash} from "node:crypto";

const base = process.env.PALACE_URL || "http://127.0.0.1:5194";
const out = path.resolve(process.env.PALACE_ARTIFACTS || "qa-artifacts/basketball-packages");
const journeyScope = process.env.PALACE_JOURNEYS || "all";
const personal = process.env.PALACE_PERSONAL==="1";
const sourceFiles=["src/worlds/ActivityHud.tsx","src/worlds/BasketballCourt.tsx","src/worlds/CourtArchitecture.tsx","src/worlds/court/Environment.tsx","src/worlds/court/finishing.ts","src/worlds/court/CourtVenue.tsx","src/worlds/court/courtSets.ts","src/worlds/court/motionPacks.ts","src/worlds/court/packagePreferences.ts","src/worlds/presence/Avatar.tsx","src/worlds/presence/Wardrobe.tsx","src/worlds/presence/dribblePose.ts","src/worlds/presence/dribbleMotion.ts","src/worlds/presence/shotPose.ts","src/worlds/presence/state.ts","src/worlds/presence/wardrobe.css","src/worlds/worldConfig.ts"];
sourceFiles.push('src/worlds/presence/math.ts','src/worlds/presence/CameraRig.tsx','src/worlds/presence/Controls.tsx','src/worlds/presence/courtFraming.ts','src/worlds/presence/CourtFootContact.tsx');
const sourceHash=async file=>createHash("sha256").update(await readFile(file)).digest("hex");
const sourceHashes=Object.fromEntries(await Promise.all(sourceFiles.map(async file=>[file,await sourceHash(file)])));
assert.ok(["all", "remaining"].includes(journeyScope), "PALACE_JOURNEYS must be all or remaining");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--use-angle=d3d11"] });
const report = {
  startedAt: new Date().toISOString(),
  sha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  dirty: !!execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim(),
  base, browser: browser.version(), quality: "medium", viewport: [1920, 1080], personal, sourceHashes, journeyScope,
  scope: "Neutral public avatar and empty private-media catalog. Only logical camera starting positions are staged through the existing development return-view adapter. Package selection, E pickup/dribble, X hand switches, 5 layups and Enter + W + 5 dunks are native browser inputs. No ball velocity, score, animation phase, package store or source hand is injected. Samples use actual browser requestAnimationFrame timing, not a claimed 120 fps benchmark. Screenshots are requested about every 100 ms; actual capture state and wall timing are included.",
  checks: [], fixtures: [], frames: [], journeys: [], errors: [], uploads: [],
};
let flushQueue = Promise.resolve();
const flush = () => { flushQueue = flushQueue.then(() => writeFile(path.join(out, "validation.json"), JSON.stringify(report, null, 2))); return flushQueue; };
const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]);
const publishReport = async () => {
  report.finishedAt = new Date().toISOString();
  report.durationSeconds = (Date.parse(report.finishedAt) - Date.parse(report.startedAt)) / 1000;
  await flush();
  const failure = report.failure ? `<testcase name="Incomplete native journey"><failure message="Native browser assertion failed">${escapeHtml(report.failure)}</failure></testcase>` : "";
  const junit = `<?xml version="1.0" encoding="UTF-8"?><testsuite name="Basketball native action packages" tests="${report.checks.length + Number(!!report.failure)}" failures="${Number(!!report.failure)}" time="${report.durationSeconds}">${report.checks.map(check => `<testcase name="${escapeHtml(check.name)}"/>`).join("")}${failure}</testsuite>`;
  await writeFile(path.join(out, "junit.xml"), junit);
  const html = `<!doctype html><meta charset="utf-8"><title>Basketball package verification</title><style>body{font:16px system-ui;background:#101b20;color:#dce7ed;max-width:1100px;margin:40px auto;line-height:1.55}a{color:#9dcad7}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#142630;padding:14px}li{margin:10px 0}img{max-width:100%}</style><h1>Basketball action packages: ${report.passed ? "PASS" : "FAIL"}</h1><p>${report.checks.length} completed journeys · ${report.frames.length} screenshots · ${report.durationSeconds.toFixed(1)} seconds · Edge ${escapeHtml(report.browser)}</p><p>${escapeHtml(report.scope)}</p><p><a href="validation.json">Full JSON</a> · <a href="junit.xml">JUnit XML</a>${report.contactSheet ? ' · <a href="contact-sheet.html">Contact sheet</a>' : ""}</p><ol>${report.checks.map(check => `<li>${escapeHtml(check.name)}</li>`).join("")}</ol>${report.failure ? `<h2>Failure</h2><pre>${escapeHtml(report.failure)}</pre><img src="failure.png">` : '<img src="contact-sheet.png">'}<h2>Continuous rendered-frame samples</h2><ul>${report.journeys.map(journey => `<li><a href="${journey.file}">${escapeHtml(journey.name)}</a>: ${journey.samples} samples; actual maximum frame interval ${journey.frameIntervalMax.toFixed(1)} ms; left wrist max ${journey.leftWristMax.toFixed(4)} m, right wrist max ${journey.rightWristMax.toFixed(4)} m</li>`).join("")}</ul>`;
  await writeFile(path.join(out, "verification-report.html"), html);
};
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const packIds = { shot: ["quick", "classic", "high-release"], hands: ["natural", "protect"], dribble: ["balanced", "low", "wide"], layup: ["standard", "scoop", "euro"], dunk: ["one-hand", "two-hand"] };
const legends = { shot: "投篮包", hands: "双手动作包", dribble: "运球包", layup: "上篮包", dunk: "扣篮包" };
const courtIds = ["park", "blacktop", "retro-arena", "practice-gym", "rooftop"];

class CourtPage {
  constructor(page) { this.page = page; this.dialog = page.getByRole("dialog", { name: /^(人物与穿搭|人物、穿搭与球场动作)$/ }); }
  async ready() {
    await this.page.waitForFunction(() => window.__PALACE_DEBUG__?.roomId === "basketball" && window.__PRESENCE_DEBUG__ && !window.__PRESENCE_DEBUG__.activity.getState().warming && document.querySelector(".world-ready"));
    await this.page.waitForFunction(() => window.__PALACE_DEBUG__.scene.getObjectByName("visitor-athlete")?.visible);
  }
  async openWardrobe() {
    await this.page.getByRole("button", { name: "人物 / 穿搭", exact: true }).click();
    await this.dialog.waitFor();
  }
  field(category) { return this.dialog.locator("fieldset").filter({ has: this.page.locator("legend", { hasText: legends[category] }) }); }
  async select(category, id) {
    const buttons = this.field(category).getByRole("button");
    assert.equal(await buttons.count(), packIds[category].length, `${category} package choices`);
    const button = buttons.nth(packIds[category].indexOf(id));
    await button.click();
    assert.equal(await button.getAttribute("aria-pressed"), "true", `${category}/${id} selected natively`);
    return (await button.innerText()).trim();
  }
  async selected() {
    const result = {};
    for (const [category, ids] of Object.entries(packIds)) {
      const buttons = this.field(category).getByRole("button");
      for (let i = 0; i < ids.length; i++) if (await buttons.nth(i).getAttribute("aria-pressed") === "true") result[category] = ids[i];
    }
    return result;
  }
  async preferredHand(side) {
    const field = this.dialog.locator("fieldset").filter({ has: this.page.locator("legend", { hasText: "起始持球手" }) });
    const button = field.getByRole("button", { name: side === 1 ? "右手" : "左手", exact: true });
    await button.click(); assert.equal(await button.getAttribute("aria-pressed"), "true");
  }
  venueField() { return this.dialog.locator("fieldset").filter({ has: this.page.locator("legend", { hasText: "球场风格" }) }); }
  async venue(id) {
    const buttons = this.venueField().getByRole("button"); assert.equal(await buttons.count(), courtIds.length);
    const button = buttons.nth(courtIds.indexOf(id)); await button.click();
    assert.equal(await button.getAttribute("aria-pressed"), "true", `${id} venue selected natively`);
    return (await button.innerText()).trim();
  }
  async closeWardrobe() {
    await this.dialog.getByRole("button", { name: "应用并返回场景", exact: true }).click();
    await this.dialog.waitFor({ state: "hidden" });
    // Native keyboard focus avoids an unintended mouse-release shot during a held-ball test.
    await this.page.locator("canvas").focus();
  }
  async start(position, target, label) {
    report.fixtures.push({ label, position, target, kind: "development return-view initial position only" });
    await this.page.evaluate(({ position, target }) => {
      const s = window.__PALACE_DEV__.state.getState(), c = window.__PRESENCE_DEBUG__.presence.camera;
      c.position.set(...position); c.lookAt(...target);
      s.update({ returnView: { roomId: s.roomId, position: c.position.toArray(), quaternion: c.quaternion.toArray() }, travelSequence: s.travelSequence + 1 });
    }, { position, target });
    await this.page.waitForFunction(position => {
      const c = window.__PRESENCE_DEBUG__.presence.camera.position;
      return Math.hypot(c.x - position[0], c.y - position[1], c.z - position[2]) < .0001;
    }, position);
    await this.page.locator("canvas").focus();
    await this.page.keyboard.press("r");
    await this.page.waitForFunction(() => window.__PRESENCE_DEBUG__.activity.getState().mode === "ground");
    await this.page.keyboard.press("e");
    await this.page.waitForFunction(() => window.__PRESENCE_DEBUG__.presence.held);
  }
  async dribble() {
    if (!(await this.read()).dribbling) await this.page.keyboard.press("e");
    await this.page.waitForFunction(() => window.__PRESENCE_DEBUG__.presence.dribbling);
  }
  async hand(side) {
    await this.dribble();
    if ((await this.read()).hand !== side) await this.page.keyboard.press("x");
    await this.page.waitForFunction(side => window.__PRESENCE_DEBUG__.presence.hand === side && window.__PRESENCE_DEBUG__.presence.crossover < .02, side);
  }
  async read() { return this.page.evaluate(() => window.__BASKETBALL_QA__.read()); }
  async capture(name) {
    const before = await this.read(), at = Date.now(), file = `${name}.jpg`;
    await this.page.screenshot({ path: path.join(out, file), type: "jpeg", quality: 88 });
    const after = await this.read();
    report.frames.push({ file, captureWallTime: at, screenshotDuration: Date.now() - at, before, after });
    await flush();
    return file;
  }
  async record(name) { await this.page.evaluate(name => window.__BASKETBALL_QA__.start(name), name); }
  async finishRecord(name) {
    const samples = await this.page.evaluate(() => window.__BASKETBALL_QA__.stop());
    const deltas = samples.slice(1).map((s, i) => s.time - samples[i].time);
    const summary = { samples: samples.length, sampledWallDuration: samples.at(-1)?.time - samples[0]?.time, frameIntervalMin: Math.min(...deltas), frameIntervalMax: Math.max(...deltas), leftWristMax: Math.max(...samples.map(s => s.leftWristError)), rightWristMax: Math.max(...samples.map(s => s.rightWristError)), phases: [...new Set(samples.map(s => s.finishPhase).filter(Boolean))], hands: [...new Set(samples.map(s => s.hand))] };
    const file = `${name}-samples.json`;
    await writeFile(path.join(out, file), JSON.stringify(samples, null, 2));
    report.journeys.push({ name, file, ...summary }); await flush();
    assert.ok(samples.length > 15, `${name}: continuous actual rendered-frame samples`);
    assert.ok(samples.every(s => Number.isFinite(s.leftWristError) && Number.isFinite(s.rightWristError)), `${name}: both actual wrist residuals present`);
    return samples;
  }
}

const installReadOnlyRecorder = page => page.evaluate(() => {
  let active = false, samples = [], label = "", lastNativeRelease = null;
  const read = () => {
    const d = window.__PRESENCE_DEBUG__, p = d.presence, a = d.activity.getState(), root = window.__PALACE_DEBUG__.scene.getObjectByName("visitor-athlete");
    const position = name => { const bone = root?.getObjectByName(name); return bone ? bone.getWorldPosition(p.ball.clone()).toArray() : null; };
    const pose = p.finishPose, scene = window.__PALACE_DEBUG__.scene, ballShells = [], hoops = [];
    scene.getObjectByName("basketball-practice-world")?.traverse(object => {
      if (!object.isMesh) return;
      let visible = true, ancestor = object; while (ancestor) { if (!ancestor.visible) visible = false; ancestor = ancestor.parent; }
      if (!visible) return;
      if (object.geometry?.type === "SphereGeometry") {
        const scale = object.getWorldScale(p.ball.clone()), radius = object.geometry.parameters.radius * Math.max(scale.x, scale.y, scale.z);
        if (radius > .10 && radius < .14) ballShells.push({ name: object.name, parent: object.parent?.name, position: object.getWorldPosition(p.ball.clone()).toArray() });
      }
      if (object.geometry?.type === "TorusGeometry" && Math.abs(object.geometry.parameters.radius - .225) < .00001) hoops.push(object.getWorldPosition(p.ball.clone()).toArray());
    });
    return {
      label, time: performance.now(), body: p.camera.position.toArray(), hand: p.hand, held: p.held, dribbling: p.dribbling,
      ball: p.ball.toArray(), courtStance:p.courtStance,dribbleBlend:p.dribbleBlend, holdBlend: p.holdBlend, dribblePhase: p.dribblePhase, crossover: p.crossover, leftPalm: p.dribbleLeftPalm?.toArray(), rightPalm: p.dribbleRightPalm?.toArray(),
      leftWrist: position("Bip01_L_Hand"), rightWrist: position("Bip01_R_Hand"), leftWristError: root?.userData.basketballLeftWristError, rightWristError: root?.userData.basketballRightWristError,
      packages: root?.userData.basketballPackages, speed: p.speed, turboHeld: p.turboHeld, charge: p.charge, jump: p.jump, finishing: p.finish, shotRemaining: p.shot, shotPack: p.shotPack, releaseHand: p.releaseHand.toArray(), shotJump: p.shotJump,
      finishPhase: pose?.phase, finishElapsed: pose?.elapsed, finishPackage: pose?.package, twoHands: pose?.twoHands, guide: pose?.guide, release: !!pose?.release,
      leftFoot: p.leftFoot.toArray(), rightFoot: p.rightFoot.toArray(), mode: a.mode, shots: a.shots, made: a.made, result: a.result,
      ballShells, hoops, courtSet: localStorage.getItem("memory-palace:court-set:v1") || "park",
      drawingBuffer: [window.__PALACE_DEBUG__.renderer.domElement.width, window.__PALACE_DEBUG__.renderer.domElement.height],
    };
  };
  const loop = () => { if (!active) return; samples.push(read()); requestAnimationFrame(loop); };
  // Installed after the real runtime key handlers. This observer reads the
  // existing rendered wrist exactly when trusted native key-up launches the ball;
  // it never sets a hand, animation phase, ball velocity or score.
  document.addEventListener("keyup", event => {
    if (!active || !event.isTrusted || !["Digit5", "Numpad5"].includes(event.code)) return;
    const sample = read(); sample.inputEvent = `trusted keyup ${event.code}`;
    sample.nativeShotRelease = sample.mode === "flight" && sample.shotRemaining === .65;
    samples.push(sample); if (sample.nativeShotRelease) lastNativeRelease = sample;
  });
  window.__BASKETBALL_QA__ = { read, lastRelease: () => lastNativeRelease, start(name) { label = name; samples = []; lastNativeRelease = null; active = true; requestAnimationFrame(loop); }, stop() { active = false; return samples; } };
});

let context, page;
const contactFrames = [];
let actionCaptures = [];
const startCapture = (court, name) => { const promise = court.capture(name); actionCaptures.push(promise); promise.catch(() => {}); return promise; };
const settleCaptures = async () => { const pending = actionCaptures; actionCaptures = []; return Promise.all(pending); };
try {
  context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await context.route("**/personal-media/manifest.json", r => r.fulfill({ json: { wallpapers: [], visuals: [], music: [], projects: [], research: [] } }));
  if(!personal)await context.route("**/personal-media/avatar.json", r => r.fulfill({ json: { profile: null } }));
  await context.addInitScript(() => localStorage.setItem("memory-palace:v3", JSON.stringify({ state: { quality: "medium", tutorialDone: true, roomSoundtracks: false }, version: 0 })));
  page = await context.newPage(); page.setDefaultTimeout(45000);
  page.on("pageerror", e => report.errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") report.errors.push(m.text()); });
  page.on("request", r => { if (r.method() === "POST") report.uploads.push(r.url()); });
  const court = new CourtPage(page);
  await page.goto(`${base}/basketball?view=third`); await court.ready(); await installReadOnlyRecorder(page);
  await court.start([0, 1.65, 3], [0, 1.75, -12.1], "stationary package and crossover test");
  await court.openWardrobe();
  const selectionLabels = {};
  for (const [category, ids] of Object.entries(packIds)) for (const id of ids) selectionLabels[`${category}/${id}`] = await court.select(category, id);
  for (const id of courtIds) selectionLabels[`court/${id}`] = await court.venue(id);
  await court.preferredHand(1); await court.preferredHand(-1);
  const selected = await court.selected(), beforePause = await court.read();
  await page.keyboard.down("w"); await page.keyboard.down("Enter"); await page.keyboard.press("5"); await page.keyboard.press("x");
  await page.waitForTimeout(350); await page.keyboard.up("w"); await page.keyboard.up("Enter");
  const afterPause = await court.read();
  assert.ok(distance(beforePause.body, afterPause.body) < .0001, "wardrobe pauses locomotion");
  assert.equal(afterPause.shots, beforePause.shots, "wardrobe blocks game shots");
  assert.equal(afterPause.hand, beforePause.hand, "wardrobe blocks X hand switches");
  contactFrames.push({ file: await court.capture("wardrobe-package-selection"), label: "Native package selection / neutral public avatar" });
  await court.closeWardrobe();
  await page.reload(); await court.ready(); await installReadOnlyRecorder(page); await court.openWardrobe();
  assert.deepEqual(await court.selected(), selected, "every chosen package persists across browser reload");
  assert.equal(await court.dialog.getByRole("button", { name: "左手", exact: true }).getAttribute("aria-pressed"), "true", "preferred starting hand persists across reload");
  assert.equal(await court.venueField().getByRole("button").nth(courtIds.length-1).getAttribute("aria-pressed"), "true", "last natively selected court set persists across reload");
  report.checks.push({ name: "native selection / preferred left hand / wardrobe gameplay pause / reload persistence", selected, selectionLabels });
  await court.closeWardrobe();
  await page.waitForFunction(() => window.__PRESENCE_DEBUG__.presence.hand === -1);

  let referenceHoops;
  for (const id of courtIds) {
    await court.openWardrobe(); await court.venue(id); await court.closeWardrobe();
    await page.waitForFunction(id => {
      const scene = window.__PALACE_DEBUG__.scene;
      return id === "park" ? !["blacktop", "retro-arena", "practice-gym"].some(set => scene.getObjectByName("court-set-" + set)) : !!scene.getObjectByName("court-set-" + id);
    }, id);
    await court.start([5.8, 1.65, 6.4], [0, 2, -5], `${id} native venue physical scene capture`);
    await page.waitForTimeout(450);
    const sceneState = await court.read(); assert.equal(sceneState.courtSet, id);
    assert.equal(sceneState.hoops.length, 2, "both regulation rims retained");
    sceneState.hoops.sort((a, b) => a[2] - b[2]);
    referenceHoops ??= sceneState.hoops;
    assert.deepEqual(sceneState.hoops, referenceHoops, `${id}: native venue preserves exact physical rim positions`);
    contactFrames.push({ file: await court.capture(`venue-${id}`), label: `${id} / actual 3D venue / native selection` });
    report.checks.push({ name: `native ${id} court set / rendered 3D venue / original rims preserved`, sceneState });
  }
  await court.openWardrobe(); await court.venue("park"); await court.closeWardrobe();

  const handPackStates = [];
  for (const id of packIds.hands) {
    await court.openWardrobe(); await court.select("hands", id); await court.closeWardrobe();
    await court.start([0, 1.65, 3], [0, 1.75, -12.1], `${id} actual two-hand held-ball stance`);
    await page.waitForFunction(() => window.__PRESENCE_DEBUG__.presence.holdBlend === 1);
    const state = await court.read();
    assert.equal(state.packages.hands, id);
    assert.ok(state.leftWristError < .035 && state.rightWristError < .035, `${id}: both real rendered wrists meet genuine steady held-ball contact targets within 3.5 cm`);
    handPackStates.push({ id, ball: state.ball, wrists: [state.leftWrist, state.rightWrist], wristTargetResiduals: [state.leftWristError, state.rightWristError], wristPivotDistancesFromBallCenter: [distance(state.leftWrist, state.ball), distance(state.rightWrist, state.ball)] });
    contactFrames.push({ file: await court.capture(`hands-${id}`), label: `${id} / actual two-hand held ball / native package` });
    report.checks.push({ name: `native ${id} two-hand held-ball stance / real wrist contact`, state });
  }
  assert.ok(distance(handPackStates[0].ball, handPackStates[1].ball) > .07, "two hand packages produce distinct held-ball positions");
  report.handPackStates = handPackStates;

  const shotReleaseStates = [];
  for (const id of journeyScope === "remaining" ? [] : packIds.shot) {
    await court.openWardrobe(); await court.select("shot", id); await court.closeWardrobe();
    await court.start([0, 1.65, -4.8], [0, 3.05, -12.1], `${id} native jump shot from original arc-assist range`);
    const before = await court.read(), name = `shot-${id}`;
    await court.record(name); await page.keyboard.down("5");
    await page.waitForFunction(() => window.__PRESENCE_DEBUG__.presence.charge >= .10 && window.__PRESENCE_DEBUG__.presence.charge < .28);
    if (id === "quick") {
      await page.keyboard.press("e"); const stillCharging = await court.read();
      assert.ok(stillCharging.charge > .05 && stillCharging.held && !stillCharging.dribbling, "native E while holding 5 preserves charge and does not start dribbling");
      report.checks.push({ name: "native E while 5 held / charge preserved / no dribble", state: stillCharging });
    }
    startCapture(court, `${name}-load`);
    await page.waitForFunction(() => window.__PRESENCE_DEBUG__.presence.charge >= .35 && window.__PRESENCE_DEBUG__.presence.charge < .60);
    startCapture(court, `${name}-lift`);
    await page.waitForFunction(() => window.__PRESENCE_DEBUG__.presence.charge >= .63 && window.__PRESENCE_DEBUG__.presence.charge <= .67);
    const green = await court.read(); await page.keyboard.up("5");
    const launchContact = await page.evaluate(() => window.__BASKETBALL_QA__.lastRelease());
    assert.ok(launchContact?.nativeShotRelease, `${id}: actual trusted native key-up physical launch observed`);
    assert.ok((launchContact.hand < 0 ? launchContact.leftWristError : launchContact.rightWristError) < .035, `${id}: real shooting wrist meets actual launch contact target within 3.5 cm`);
    await page.waitForFunction(() => window.__PRESENCE_DEBUG__.presence.shot > .40 && !window.__PRESENCE_DEBUG__.presence.held);
    const release = await court.read();
    shotReleaseStates.push({ id, greenCharge: green.charge, releaseHand: release.releaseHand, jump: release.shotJump });
    const releaseCapture = startCapture(court, `${name}-release`);
    if (id === "quick") {
      await court.openWardrobe(); const paused = await court.read();
      assert.ok(paused.shotRemaining > 0, "native wardrobe opens during the actual followthrough");
      await court.preferredHand(-release.hand); await court.closeWardrobe(); const resumed = await court.read();
      assert.equal(resumed.hand, release.hand, "preferred-hand change during paused followthrough keeps the original shooting hand");
      assert.ok(resumed.shotRemaining > 0, "native followthrough resumes instead of being replaced");
      await page.waitForFunction(() => window.__PRESENCE_DEBUG__.presence.shot === 0);
      await page.waitForFunction(side => window.__PRESENCE_DEBUG__.presence.hand === side, -release.hand);
      report.checks.push({ name: "native followthrough wardrobe preference change / dominant shooting hand frozen until recovery ends", oldHand: release.hand, newHand: -release.hand, paused, resumed });
    }
    await page.waitForFunction(() => window.__PRESENCE_DEBUG__.presence.shot === 0);
    startCapture(court, `${name}-land`);
    await settleCaptures();
    await releaseCapture;
    const liftFrame = report.frames.find(frame => frame.file === `${name}-lift.jpg`);
    contactFrames.push({ file: liftFrame.file, label: `${id} / native 5 lift / charge ${liftFrame.before.charge.toFixed(2)}–${liftFrame.after.charge.toFixed(2)}` });
    await page.waitForFunction(n => window.__PRESENCE_DEBUG__.activity.getState().shots === n, before.shots + 1);
    await page.waitForFunction(n => window.__PRESENCE_DEBUG__.activity.getState().made === n, before.made + 1);
    const samples = await court.finishRecord(name);
    assert.ok(samples.some(s => s.charge > .05 && s.charge < .30) && samples.some(s => s.charge > .30 && s.charge < .65), `${id}: real native load and lift frames`);
    assert.ok(samples.some(s => s.shotRemaining > .40 && !s.held) && samples.some(s => s.shotRemaining === 0 && !s.held), `${id}: actual release and landed recovery observed`);
    assert.ok(samples.filter(s=>s.shotRemaining>0).every(s=>s.leftWristError<.035&&s.rightWristError<.035), `${id}: both actual followthrough arm goals remain reachable during landing within 3.5 cm`);
    assert.ok(samples.some(s => s.shotPack === id && s.charge > .05), `${id}: selected shot package exercised`);
    assert.ok(samples.every(s => s.ballShells.length === 1 && s.ballShells[0].parent === "practice-ball"), `${id}: exactly one visible physical basketball, no ghost ball`);
    assert.equal((await court.read()).shots, before.shots + 1, `${id}: original shot physics counts one launch`);
    assert.equal((await court.read()).made, before.made + 1, `${id}: green arc-assisted shot scores only through original ball physics`);
    report.checks.push({ name: `native ${id} shot / load-lift-green-release-land / physical ball / no ghost`, greenCharge: green.charge, launchContact, release, samples: samples.length });
  }
  if (journeyScope === "all") assert.ok(shotReleaseStates[0].releaseHand[1] < shotReleaseStates[1].releaseHand[1] && shotReleaseStates[1].releaseHand[1] < shotReleaseStates[2].releaseHand[1], "three real rendered shot profiles have ordered, distinct release heights");
  report.shotReleaseStates = shotReleaseStates;

  await court.openWardrobe();await court.select("dribble","low");await court.closeWardrobe();
  await court.start([0,1.65,3],[0,1.75,-12.1],"native first-person low dribble then third-person early shot");
  await page.keyboard.press("v");
  await page.waitForFunction(()=>!window.__PALACE_DEBUG__.scene.getObjectByName("visitor-athlete").visible);
  await court.dribble();await page.waitForTimeout(700);await court.record("first-person-gather");
  await page.keyboard.down("5");await page.waitForFunction(()=>window.__PRESENCE_DEBUG__.presence.charge>.025);
  await page.keyboard.press("v");
  await page.waitForFunction(()=>window.__PALACE_DEBUG__.scene.getObjectByName("visitor-athlete").visible);
  const firstShown=await court.read();assert.ok(firstShown.charge>0,"native first-person charge remains active when shown");
  await page.keyboard.up("5");await page.waitForFunction(()=>window.__PRESENCE_DEBUG__.presence.shot>0&&!window.__PRESENCE_DEBUG__.presence.held);await page.waitForFunction(()=>window.__PRESENCE_DEBUG__.presence.shot===0);
  const viewSamples=await court.finishRecord("first-person-gather");
  for(let i=1;i<viewSamples.length;i++){
    const dt=Math.min(.06,(viewSamples[i].time-viewSamples[i-1].time)/1000);
    for(const key of ["leftWrist","rightWrist"])assert.ok(distance(viewSamples[i][key],viewSamples[i-1][key])<.04+9*dt,"hidden-to-visible current wrist seeds stay continuous");
  }
  assert.ok(viewSamples.filter(s=>s.shotRemaining>0).every(s=>s.leftWristError<.035&&s.rightWristError<.035),"early shot recovery targets remain reachable after native view change");
  report.checks.push({name:"native first-person low dribble / early 5 charge / V third-person continuity / recovery reach",samples:viewSamples.length,firstShown});

  await court.start([0, 1.65, 3], [0, 1.75, -12.1], "native E queued dribble stop then recall and automatic sprint dribble");
  await court.dribble(); await page.waitForFunction(() => window.__PRESENCE_DEBUG__.presence.dribblePhase > .18 && window.__PRESENCE_DEBUG__.presence.dribblePhase < .60);
  await page.keyboard.press("e"); await page.keyboard.press("r");
  await page.waitForFunction(() => window.__PRESENCE_DEBUG__.activity.getState().mode === "ground");
  await page.keyboard.press("e"); await page.waitForFunction(() => window.__PRESENCE_DEBUG__.presence.held);
  const beforeSprint = await court.read(); await court.record("input-queued-stop-recall-sprint");
  await page.keyboard.down("Enter"); await page.keyboard.down("w");
  await page.waitForFunction(() => window.__PRESENCE_DEBUG__.presence.speed > 3.4 && window.__PRESENCE_DEBUG__.presence.dribbling);
  startCapture(court, "input-queued-stop-recall-sprint"); await page.waitForTimeout(1300);
  await page.keyboard.up("w"); await page.keyboard.up("Enter"); await settleCaptures();
  const sprintSamples = await court.finishRecord("input-queued-stop-recall-sprint");
  const sustained = sprintSamples.filter(s => s.turboHeld && s.speed > 3.4 && s.time - sprintSamples[0].time > 350);
  assert.ok(sustained.length > 10 && sustained.every(s => s.dribbling), "recall clears queued E stop before native automatic sprint dribble across catches");
  assert.equal((await court.read()).shots, beforeSprint.shots, "native recall / sprint adds no shot");
  report.checks.push({ name: "native queued E stop / R recall / E pickup / Enter W automatic dribble remains active", samples: sustained.length });

  for (const style of packIds.dribble) {
    await court.openWardrobe(); await court.select("dribble", style); await court.select("hands", style === "low" ? "protect" : "natural"); await court.closeWardrobe();
    await court.start([0, 1.65, 3], [0, 1.75, -12.1], `${style} stationary left/right continuous dribble`);
    await court.hand(1); await court.record(`dribble-${style}`);
    for (const side of [1, -1]) {
      if (side === -1) await page.keyboard.press("x");
      await page.waitForFunction(side => window.__PRESENCE_DEBUG__.presence.hand === side && window.__PRESENCE_DEBUG__.presence.crossover < .02, side);
      for (let i = 0; i < 7; i++) {
        const file = await court.capture(`dribble-${style}-${side > 0 ? "right" : "left"}-${i}`);
        if (i === 2) contactFrames.push({ file, label: `${style} / ${side > 0 ? "right" : "left"} hand / actual phase captured` });
        await page.waitForTimeout(100);
      }
    }
    const samples = await court.finishRecord(`dribble-${style}`);
    assert.deepEqual([...new Set(samples.map(s => s.hand))].sort(), [-1, 1]);
    assert.ok(samples.every(s => s.leftPalm?.length === 3 && s.rightPalm?.length === 3), "both authored dribble palm targets observed");
    const settledPoses=samples.filter(s=>s.dribbleBlend===1&&s.time-samples[0].time>650);
    assert.ok(settledPoses.length>10&&settledPoses.every(s=>s.leftWristError<.035&&s.rightWristError<.035), `${style}: both active and guard arm goals stay reachable through the full bounce and crossover within 3.5 cm`);
    for (let i = 1; i < samples.length; i++) {
      const dt = Math.min(.06, (samples[i].time - samples[i - 1].time) / 1000);
      for (const key of ["ball", "leftPalm", "rightPalm"]) assert.ok(distance(samples[i][key], samples[i - 1][key]) < .02 + 9 * dt, `${style}/${key} continuous across actual native X hand change`);
    }
    const catches = samples.filter(s => s.dribblePhase < .04 || s.dribblePhase > .94);
    const contactStats = {};
    for (const side of [-1, 1]) {
      // The source-hand flag commits at the end of a crossover. Near that catch,
      // the receiving palm already touches the ball while the old hand guards it.
      // Classify genuine contact by each actual authored palm's ball proximity.
      const sideCatches = catches.filter(s => distance(side < 0 ? s.leftPalm : s.rightPalm, s.ball) < .12);
      assert.ok(sideCatches.length >= 3, `${style}/${side}: genuine native catch frames sampled`);
      const residuals = sideCatches.map(s => side < 0 ? s.leftWristError : s.rightWristError);
      assert.ok(residuals.every(error => error < .035), `${style}/${side}: real catch contact wrist residual below 3.5 cm`);
      contactStats[side < 0 ? "left" : "right"] = { samples: sideCatches.length, maximumContactWristError: Math.max(...residuals) };
    }
    report.checks.push({ name: `native ${style} dribble / right and left / continuous X transition / true catch contact within 3.5 cm`, samples: samples.length, contactStats });
  }

  for (const kind of ["layup", "dunk"]) for (const id of packIds[kind]) for (const side of [1, -1]) {
    await court.openWardrobe(); await court.select(kind, id); await court.closeWardrobe();
    await court.start([-.35 * side, 1.65, kind === "dunk" ? -7.6 : -9.55], [0, 3.05, -12.1], `${kind}/${id}/${side}: native near-rim start and original physical scoring`);
    await court.hand(side);
    const before = await court.read(), name = `${kind}-${id}-${side > 0 ? "right" : "left"}`;
    await court.record(name);
    if (kind === "dunk") {
      await page.keyboard.down("Enter"); await page.keyboard.down("w");
      await page.waitForFunction(() => { const p = window.__PRESENCE_DEBUG__.presence; return p.speed > 3.2 && p.camera.position.z < -9.6 && p.camera.position.z > -11.1; });
    }
    await page.keyboard.press("5");
    if (kind === "dunk") { await page.keyboard.up("w"); await page.keyboard.up("Enter"); }
    await page.waitForFunction(kind => window.__PRESENCE_DEBUG__.presence.finish === kind, kind);
    for (let i = 0; i < 7; i++) {
      startCapture(court, `${name}-${i}`);
      await page.waitForTimeout(100);
    }
    await settleCaptures();
    if (kind === "layup" && side === 1 || kind === "dunk" && id === "two-hand") {
      const allFrames = report.frames.filter(frame => frame.file.startsWith(`${name}-`));
      const risingFrames = allFrames.filter(frame => frame.before.finishPhase === "rise" && frame.after.finishPhase === "rise");
      const candidates = risingFrames.length ? risingFrames : allFrames.filter(frame => frame.before.finishPhase === "rise" || frame.after.finishPhase === "rise");
      const midpoint = frame => ((frame.before.finishElapsed ?? frame.after.finishElapsed) + (frame.after.finishElapsed ?? frame.before.finishElapsed)) / 2;
      candidates.sort((a, b) => Math.abs(midpoint(a) - .69) - Math.abs(midpoint(b) - .69));
      const chosen = candidates[0]; assert.ok(chosen, `${name}: native rendered rise screenshot present`);
      const interval = chosen.before.finishElapsed != null && chosen.after.finishElapsed != null ? `${chosen.before.finishElapsed.toFixed(2)}–${chosen.after.finishElapsed.toFixed(2)}s` : `${chosen.before.finishPhase ?? "idle"} → ${chosen.after.finishPhase ?? "idle"}`;
      contactFrames.push({ file: chosen.file, label: `${kind} / ${id} / ${side > 0 ? "right" : "left"} / native rise ${interval}` });
    }
    await page.waitForFunction(n => window.__PRESENCE_DEBUG__.activity.getState().made === n, before.made + 1);
    await page.waitForFunction(() => window.__PRESENCE_DEBUG__.presence.finish === "idle");
    const after = await court.read(), samples = await court.finishRecord(name);
    assert.equal(after.shots, before.shots + 1, `${name}: exactly one original physics release`);
    assert.equal(after.made, before.made + 1, `${name}: original physical score`);
    assert.ok(samples.some(s => s.finishPackage === id), `${name}: chosen package exercised`);
    assert.ok(samples.some(s => s.finishPhase === "rise") && samples.some(s => s.finishPhase === "release"), `${name}: actual authored rise and release observed`);
    const release = samples.find(s => s.release);
    assert.ok(release, `${name}: actual launch-frame observed`);
    assert.equal(release.hand, side, `${name}: native X source hand used at physical release`);
    assert.equal(release.made, before.made, `${name}: score waits for descending rim crossing`);
    // The existing HUD publishes physics counters every 120 ms, so do not require
    // its shot counter to update on the exact one-render-frame release snapshot.
    assert.ok(samples.some(s => s.time >= release.time && s.time - release.time < 250 && s.shots === before.shots + 1), `${name}: the original HUD publishes one physical attempt after release`);
    if (kind === "dunk" && id === "two-hand") {
      const support = samples.filter(s => s.finishPhase === "rise" || s.release);
      assert.ok(release.twoHands > .95, `${name}: both hands support the ball at its actual release frame`);
      assert.ok(release.leftWristError < .035 && release.rightWristError < .035, `${name}: both real rendered wrists meet genuine ball contact targets within 3.5 cm at actual release`);
      const trueSupport = support.filter(s => s.twoHands > .95);
      assert.ok(trueSupport.every(s => s.leftWristError < .035 && s.rightWristError < .035), `${name}: both actual wrists meet intended two-hand support contact targets within 3.5 cm`);
    }
    report.checks.push({ name: `native ${name} / original release and downward-crossing score`, before: { shots: before.shots, made: before.made }, after: { shots: after.shots, made: after.made }, release });
  }
  assert.deepEqual(report.errors, [], "no browser runtime/console errors");
  assert.deepEqual(report.uploads, [], "no private-data uploads");
  const cells = [];
  for (const { file, label } of contactFrames) cells.push(`<figure><figcaption>${label}</figcaption><img src="data:image/jpeg;base64,${(await readFile(path.join(out, file))).toString("base64")}"></figure>`);
  const html = `<!doctype html><meta charset="utf-8"><title>Basketball native package evidence</title><style>body{margin:0;background:#101b20;color:#dce7ed;font:16px Arial}header{padding:24px}h1{font-size:24px;margin:0 0 8px}main{display:grid;grid-template-columns:repeat(3,640px)}figure{margin:0}figcaption{height:36px;padding:8px 12px;box-sizing:border-box;font-size:13px}img{width:640px;height:360px;display:block}p{margin:0;font-size:14px}</style><header><h1>Basketball / native action packages</h1><p>Neutral public avatar · medium · Edge · real keyboard inputs · staged initial position only · actual capture phase varies</p></header><main>${cells.join("")}</main>`;
  await writeFile(path.join(out, "contact-sheet.html"), html);
  const sheet = await context.newPage(); await sheet.setViewportSize({ width: 1920, height: 1080 }); await sheet.setContent(html);
  await sheet.screenshot({ path: path.join(out, "contact-sheet.png"), fullPage: true }); await sheet.close();
  report.sourceDrift=[];for(const file of sourceFiles)if(await sourceHash(file)!==sourceHashes[file])report.sourceDrift.push(file);
  assert.deepEqual(report.sourceDrift,[],"runtime source remains unchanged throughout native verification");
  report.passed = true; report.contactSheet = "contact-sheet.png"; await publishReport();
  console.log(JSON.stringify({ passed: true, journeyScope, checks: report.checks.length, frames: report.frames.length, journeys: report.journeys.length, out }));
} catch (error) {
  report.failure = error.stack;
  await Promise.allSettled(actionCaptures);
  if (page && !page.isClosed()) {
    const samples = await page.evaluate(() => window.__BASKETBALL_QA__?.stop()).catch(() => null);
    if (samples?.length) { await writeFile(path.join(out, "failure-samples.json"), JSON.stringify(samples, null, 2)); report.failureSamples = "failure-samples.json"; }
  }
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(out, "failure.png") }).catch(() => {});
  await publishReport(); throw error;
} finally { await context?.close(); await browser.close(); }
