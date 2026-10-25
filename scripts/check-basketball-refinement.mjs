import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import {createHash} from "node:crypto";

const base = process.env.PALACE_URL || "http://127.0.0.1:5194";
const out = path.resolve(process.env.PALACE_ARTIFACTS || "qa-artifacts/basketball-packages/refinement-browser");
const journeyScope = "refinement";
const refinementStage=process.env.PALACE_REFINEMENT_STAGE||"all";
const refinementSingle=process.env.PALACE_REFINEMENT_SINGLE||"";
const freeFocused=process.env.PALACE_REFINEMENT_FREE_FOCUSED==="1";
const refinementMoves=(process.env.PALACE_REFINEMENT_MOVES||"").split(",").filter(Boolean);
assert.ok(refinementMoves.every(name=>/^(creative-(balanced|low|wide)|sprint)-(left|right)-(between-legs|behind-back|hesitation)$/.test(name)));
assert.ok(!refinementMoves.length||refinementStage==="moves");
assert.ok(["","quick-left-clean"].includes(refinementSingle));
assert.ok(["all","shots","moves","finishes","free-arms"].includes(refinementStage));
assert.ok(!freeFocused||refinementStage==="free-arms");
const collectFailures=process.env.PALACE_REFINEMENT_COLLECT_FAILURES==="1";
const personal = process.env.PALACE_PERSONAL==="1";
const sourceFiles=["src/worlds/basketballPhysics.ts","src/worlds/activity.ts","src/worlds/ActivityHud.tsx","src/worlds/BasketballCourt.tsx","src/worlds/CourtArchitecture.tsx","src/worlds/court/Environment.tsx","src/worlds/court/finishing.ts","src/worlds/court/CourtVenue.tsx","src/worlds/court/courtSets.ts","src/worlds/court/motionPacks.ts","src/worlds/court/packagePreferences.ts","src/worlds/presence/Avatar.tsx","src/worlds/presence/Wardrobe.tsx","src/worlds/presence/dribblePose.ts","src/worlds/presence/dribbleMotion.ts","src/worlds/presence/shotPose.ts","src/worlds/presence/state.ts","src/worlds/presence/wardrobe.css","src/worlds/worldConfig.ts"];
const sourceHash=async file=>createHash("sha256").update(await readFile(file)).digest("hex");
sourceFiles.push("src/world/Player.tsx","src/worlds/court/controls.ts","src/worlds/presence/dribblePalm.ts","src/worlds/presence/courtLocomotion.ts","src/worlds/presence/basketballFootwork.ts","src/worlds/presence/shotHandRotation.ts","src/worlds/presence/shotGather.ts","src/worlds/presence/dribbleArm.ts","src/worlds/presence/animationContinuity.ts","src/worlds/presence/basketballAppearance.ts","src/worlds/court/basketballSurface.ts");
sourceFiles.push('src/worlds/presence/courtTorso.ts');
sourceFiles.push('src/worlds/presence/math.ts','src/worlds/presence/CameraRig.tsx','src/worlds/presence/Controls.tsx','src/worlds/presence/courtFraming.ts','src/worlds/presence/CourtFootContact.tsx');
sourceFiles.push('src/worlds/court/ballSpin.ts','src/worlds/worlds.css');
sourceFiles.push('src/world/World.tsx','src/worlds/presence/clarity.ts','src/worlds/presence/appearanceRig.ts','src/worlds/presence/appearance.ts','src/worlds/presence/assets.ts','public/media/presence/athlete.gltf','public/media/presence/athlete.bin','public/media/presence/athlete-detail.gltf','public/media/presence/athlete-detail.bin','public/media/presence/body-color.webp','public/media/presence/body-normal.webp','public/media/presence/head-color.webp','public/media/presence/head-normal.webp');
sourceFiles.push('src/ui/Hud.tsx');
const sourceHashes=Object.fromEntries(await Promise.all(sourceFiles.map(async file=>[file,await sourceHash(file)])));

await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--use-angle=d3d11"] });
const report = {
  startedAt: new Date().toISOString(),
  sha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  dirty: !!execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim(),
  base, browser: browser.version(), quality: "medium", viewport: [1920, 1080], personal, sourceHashes, journeyScope, refinementStage, refinementSingle, collectFailures, refinementMoves, freeFocused, acceptanceEligible:!collectFailures&&!refinementMoves.length&&!refinementSingle&&!freeFocused,
  scope: [
    refinementMoves.length?"Targeted diagnostic only: "+refinementMoves.join(", ")+". This filtered run is not eligible for full acceptance.":"Unfiltered native matrix.",
    "Neutral public avatar, empty private-media routes and medium app quality. Only logical camera starting positions use the existing development return-view adapter.",
    refinementMoves.length ? "Filtered native creative-dribble journeys reuse every original physical clearance, contact, continuity and hand-orientation gate for the named actions. Cancellation and outfit-remount journeys are covered only by an unfiltered run." : refinementSingle ? "One targeted native quick/left near-clean release retry at requested charge .61; actual release charge is recorded. It supplements the separately retained full native shot run." : refinementStage === "free-arms" ? "Native free-arm matrix: actual zero-influence wrists and elbows inherit the same-frame animated idle/walk/run pose, hand orientations follow the real animation with 10rad/s continuity, native X and creative transfer, blacktop full-body evidence. Filtered eight-case diagnostics are not final acceptance." : refinementStage === "finishes" ? "Ten native layup and dunk journeys: three layup and two dunk profiles on both hands, real release/contact/physics score, two-hand support and actual SO3 continuity through entry and exit." : refinementStage === "moves" ? "Twenty-four native creative-dribble journeys: three profiles, both hands, Z/C/Q stationary plus both hands at sprint speed; native wardrobe pause, recall and pointer-blur cancellation." : refinementStage === "shots" ? "Thirty-two native shot journeys: three profiles, both hands and five actual early/clean/late releases, plus both hands moving behind-back into a quick stop gather. Actual hand SO3, palm normals and physical ball-facing alignment are verified." : "Full native creative-dribble and jump-shot journeys with actual release timing coverage.",
    "Native wardrobe selections exercise all six original outfits and front/orbit detail captures. Samples read actual scene bones, physical ball, same-pose avatar root, R3F clock and requestAnimationFrame timing; no animation phase, hand, score, ball velocity or package store is injected. Screenshots record actual capture phase and wall duration; these traces are not an fps benchmark."
    ,"Night refinement adds actual applied torso continuity at 4.5rad/s. Held-ball, limbs, palm contact, orientation and collision-frame continuity gates are unchanged. Free flight is checked against the authoritative 120Hz simulation time, velocity, response count and ballistic position with residual below 1e-5m, because released shots legitimately exceed the authored hand-motion speed. Initial return-view fixtures finish native recall/pickup before recording an action."
  ].join(" "),
  checks: [], fixtures: [], frames: [], journeys: [], errors: [], uploads: [],
};
let flushQueue = Promise.resolve();
const flush = () => { flushQueue = flushQueue.then(() => writeFile(path.join(out, "validation.json"), JSON.stringify(report, null, 2))); return flushQueue; };
const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]);
const publishReport = async () => {
  report.finishedAt = new Date().toISOString();
  report.durationSeconds = (Date.parse(report.finishedAt) - Date.parse(report.startedAt)) / 1000;
  await flush();
  const hardFailures=report.hardFailures||[];
  const hardFailureCases=hardFailures.map(item=>`<testcase name="${escapeHtml(item.name)}"><failure message="Native journey assertion failed">${escapeHtml(item.stack)}</failure></testcase>`).join("");
  const failure = report.failure ? `<testcase name="Incomplete native journey"><failure message="Native browser assertion failed">${escapeHtml(report.failure)}</failure></testcase>` : "";
  const junit = `<?xml version="1.0" encoding="UTF-8"?><testsuite name="Basketball native action packages" tests="${report.checks.length + hardFailures.length + Number(!!report.failure)}" failures="${hardFailures.length + Number(!!report.failure)}" time="${report.durationSeconds}">${report.checks.map(check => `<testcase name="${escapeHtml(check.name)}"/>`).join("")}${hardFailureCases}${failure}</testsuite>`;
  await writeFile(path.join(out, "junit.xml"), junit);
  const html = `<!doctype html><meta charset="utf-8"><title>Basketball package verification</title><style>body{font:16px system-ui;background:#101b20;color:#dce7ed;max-width:1100px;margin:40px auto;line-height:1.55}a{color:#9dcad7}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#142630;padding:14px}li{margin:10px 0}img{max-width:100%}</style><h1>Basketball action packages: ${report.passed ? "PASS" : "FAIL"}</h1><p>${report.checks.length} completed journeys · ${report.frames.length} screenshots · ${report.durationSeconds.toFixed(1)} seconds · Edge ${escapeHtml(report.browser)}</p><p>${escapeHtml(report.scope)}</p><p><a href="validation.json">Full JSON</a> · <a href="junit.xml">JUnit XML</a>${report.contactSheet ? ' · <a href="contact-sheet.html">Contact sheet</a>' : ""}</p><ol>${report.checks.map(check => `<li>${escapeHtml(check.name)}</li>`).join("")}</ol>${report.failure ? `<h2>Failure</h2><pre>${escapeHtml(report.failure)}</pre><img src="failure.png">` : '<img src="contact-sheet.png">'}<h2>Collected hard failures</h2><ol>${hardFailures.map(item=>`<li>${escapeHtml(item.name)}<pre>${escapeHtml(item.stack)}</pre></li>`).join("")}</ol><h2>Continuous rendered-frame samples</h2><ul>${report.journeys.map(journey => `<li><a href="${journey.file}">${escapeHtml(journey.name)}</a>: ${journey.samples} samples; actual maximum frame interval ${journey.frameIntervalMax.toFixed(1)} ms; left wrist max ${journey.leftWristMax.toFixed(4)} m, right wrist max ${journey.rightWristMax.toFixed(4)} m</li>`).join("")}</ul>`;
  await writeFile(path.join(out, "verification-report.html"), html);
};
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const quaternionAngle=(a,b)=>2*Math.acos(Math.max(0,Math.min(1,Math.abs(a.reduce((sum,v,i)=>sum+v*b[i],0))/(Math.hypot(...a)*Math.hypot(...b)))));
const vectorAngle=(a,b)=>Math.acos(Math.max(-1,Math.min(1,a.reduce((sum,v,i)=>sum+v*b[i],0)/(Math.hypot(...a)*Math.hypot(...b)))));
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
    // The return-view fixture can cross the whole court. Complete its native
    // recall/pickup before measuring the following action, rather than treating
    // an unfinished fixture transfer as part of a dribble or shot journey.
    await this.page.waitForFunction(() => {const p=window.__PRESENCE_DEBUG__.presence;return p.held&&!p.dribbling&&p.holdBlend===1&&p.ball.distanceTo(p.camera.position)<1.2;});
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
    assert.ok(samples.every(s=>Number.isFinite(s.renderTime)), `${name}: exact existing engine clock is finite in every recorded sample`);
    assert.ok(samples.length > 15, `${name}: continuous actual rendered-frame samples`);
    assert.ok(samples.every(s => Number.isFinite(s.leftWristError) && Number.isFinite(s.rightWristError)), `${name}: both actual wrist residuals present`);
    return samples;
  }
}

const installReadOnlyRecorder = page => page.evaluate(() => {
  let active = false, samples = [], label = "", lastNativeRelease = null,lastCreativeInput=null,creativeBefore=null;
  const read = () => {
    const d = window.__PRESENCE_DEBUG__, p = d.presence, a = d.activity.getState(), root = window.__PALACE_DEBUG__.scene.getObjectByName("visitor-athlete");
    const position = name => { const bone = root?.getObjectByName(name); return bone ? bone.getWorldPosition(p.ball.clone()).toArray() : null; };
    const orientation=name=>{const bone=root?.getObjectByName(name);return bone?bone.getWorldQuaternion(p.camera.quaternion.clone()).toArray():null;};
    const palmNormal=name=>{const bone=root?.getObjectByName(name);return bone?p.ball.clone().set(0,1,0).applyQuaternion(bone.getWorldQuaternion(p.camera.quaternion.clone())).toArray():null;};
    const animatedArm=side=>{const a=root?.userData[side<0?"basketballLeftAnimatedArm":"basketballRightAnimatedArm"];return a?{wrist:a.wrist.toArray(),elbow:a.elbow.toArray(),rotation:a.rotation.toArray()}:null;};
  const pose = p.finishPose, scene = window.__PALACE_DEBUG__.scene, ballShells = [], hoops = [];
    const physics=scene.getObjectByName('practice-ball')?.userData.basketballPhysics;
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
      label, time: performance.now(), renderTime: scene.__r3f?.root?.getState?.()?.clock?.elapsedTime, body: p.camera.position.toArray(), shotLanded:p.shotLanded, releasedCharge:p.shotChargeAtRelease, hand: p.hand, held: p.held, dribbling: p.dribbling,
      ball: p.ball.toArray(), courtStance:p.courtStance,dribbleBlend:p.dribbleBlend, holdBlend: p.holdBlend, dribblePhase: p.dribblePhase, leftParticipation:p.dribbleLeftWeight,rightParticipation:p.dribbleRightWeight, crossover: p.crossover, leftPalm: p.dribbleLeftPalm?.toArray(), rightPalm: p.dribbleRightPalm?.toArray(),
      physics:physics?{time:physics.elapsed,position:[physics.position.x,physics.position.y,physics.position.z],velocity:[physics.velocity.x,physics.velocity.y,physics.velocity.z],responses:physics.responses,shot:physics.stats.shots,mode:physics.mode}:null,
      torso:root?.userData.basketballTorso?{...root.userData.basketballTorso}:null,
      leftHandBoneId:root?.getObjectByName("Bip01_L_Hand")?.uuid,rightHandBoneId:root?.getObjectByName("Bip01_R_Hand")?.uuid,leftPalmNormal:palmNormal("Bip01_L_Hand"),rightPalmNormal:palmNormal("Bip01_R_Hand"),leftHandQuaternion:orientation("Bip01_L_Hand"),rightHandQuaternion:orientation("Bip01_R_Hand"),leftWrist: position("Bip01_L_Hand"), rightWrist: position("Bip01_R_Hand"), leftWristError: root?.userData.basketballLeftWristError, rightWristError: root?.userData.basketballRightWristError,
      leftAnimatedArm:animatedArm(-1),rightAnimatedArm:animatedArm(1),leftInfluence:p.dribbleLeftInfluence,rightInfluence:p.dribbleRightInfluence,armBlend:root?.userData.basketballDribbleArmBlend,velocity:p.velocity.toArray(),
      packages: root?.userData.basketballPackages, speed: p.speed, turboHeld: p.turboHeld, charge: p.charge, shotGather:p.shotGather,shotGatherDuration:p.shotGatherDuration, jump: p.jump, finishing: p.finish, shotRemaining: p.shot, shotPack: p.shotPack, releaseHand: p.releaseHand.toArray(), shotJump: p.shotJump,
      finishPhase: pose?.phase, finishElapsed: pose?.elapsed, finishPackage: pose?.package, twoHands: pose?.twoHands, guide: pose?.guide, release: !!pose?.release,
      leftShoulder:position("Bip01_L_UpperArm"),rightShoulder:position("Bip01_R_UpperArm"),leftElbow:position("Bip01_L_Forearm"),rightElbow:position("Bip01_R_Forearm"),
      leftFoot: position("Bip01_L_Foot"), rightFoot: position("Bip01_R_Foot"), leftKnee: position("Bip01_L_Calf"), rightKnee: position("Bip01_R_Calf"), leftHip:position("Bip01_L_Thigh"),rightHip:position("Bip01_R_Thigh"), footwork: root?.userData.basketballFootwork ? structuredClone(root.userData.basketballFootwork) : null, dribbleMove:p.dribbleMove, forward:p.camera.getWorldDirection(p.ball.clone()).toArray(), rootPosition:root?.position.toArray(), mode: a.mode, shots: a.shots, made: a.made, result: a.result,
      ballShells, hoops, courtSet: localStorage.getItem("memory-palace:court-set:v1") || "park",
      drawingBuffer: [window.__PALACE_DEBUG__.renderer.domElement.width, window.__PALACE_DEBUG__.renderer.domElement.height],
    };
  };
  const loop = frameTime => { if (!active) return; const sample=read(); sample.frameTime=frameTime; samples.push(sample); requestAnimationFrame(loop); };
  // Installed after the real runtime key handlers. This observer reads the
  // existing rendered wrist exactly when trusted native key-up launches the ball;
  // it never sets a hand, animation phase, ball velocity or score.
  document.addEventListener("keyup", event => {
    if (!active || !event.isTrusted || !["Digit5", "Numpad5"].includes(event.code)) return;
    const sample = read(); sample.inputEvent = `trusted keyup ${event.code}`;
    sample.nativeShotRelease = sample.mode === "flight" && sample.shotRemaining === .65;
    samples.push(sample); if (sample.nativeShotRelease) lastNativeRelease = sample;
  });
  const creativeInput=event=>event.isTrusted&&(event.type==='keydown'?['KeyZ','KeyC','KeyQ'].includes(event.code):event.target instanceof Element&&/^[ZCQ] · /.test(event.target.closest('button')?.textContent||''));
  for(const type of ['keydown','click']){
    document.addEventListener(type,event=>{if(active&&creativeInput(event))creativeBefore=read();},true);
    document.addEventListener(type,event=>{if(active&&creativeInput(event)){lastCreativeInput={before:creativeBefore,after:read(),trusted:true,type};}},false);
  }
  window.__BASKETBALL_QA__ = { read, freeFrames:side=>samples.filter(s=>s.armBlend===1&&(side<0?s.leftInfluence:s.rightInfluence)===0).length,lastCreative:()=>lastCreativeInput,lastRelease: () => lastNativeRelease, start(name) { label = name; samples = []; lastNativeRelease = null;lastCreativeInput=null;creativeBefore=null; active = true; requestAnimationFrame(loop); }, stop() { active = false; return samples; } };
});

let context, page;
const contactFrames = [];
const check = (name, extra = {}) => report.checks.push({name,...extra});
const localBall = sample => {
  const dx=sample.ball[0]-sample.body[0],dz=sample.ball[2]-sample.body[2];
  const scale=Math.hypot(sample.forward[0],sample.forward[2]);
  const fx=sample.forward[0]/scale,fz=sample.forward[2]/scale;
  return [dx*-fz+dz*fx,sample.ball[1],-(dx*fx+dz*fz)];
};
const pointSegmentDistance = (point,a,b) => {
  const ab=b.map((v,i)=>v-a[i]),ap=point.map((v,i)=>v-a[i]);
  const t=Math.max(0,Math.min(1,ab.reduce((sum,v,i)=>sum+v*ap[i],0)/ab.reduce((sum,v)=>sum+v*v,0)));
  return distance(point,ab.map((v,i)=>a[i]+t*v));
};
const kneeAngle = (hip,knee,foot) => {
  const a=hip.map((v,i)=>v-knee[i]),b=foot.map((v,i)=>v-knee[i]);
  return Math.acos(Math.max(-1,Math.min(1,a.reduce((sum,v,i)=>sum+v*b[i],0)/(Math.hypot(...a)*Math.hypot(...b)))))*180/Math.PI;
};
function measureFreeArms(samples,name,{requireFree=true,requireMovement=false,requirePalmPress=true}={}){
  const frames=samples.filter(s=>!s.inputEvent),angle=quaternionAngle,rows=[];
  for(let index=0;index<frames.length;index++){
    const s=frames[index];if(!s.dribbling||s.dribbleBlend!==1||s.armBlend!==1)continue;
    assert.ok(s.leftWristError<.035&&s.rightWristError<.035,name+': both actual wrists remain reachable within the original 3.5cm during mature standing/walking/running/strafe contact');
    for(const side of ['left','right']){
      const influence=s[side+'Influence'];assert.ok(Number.isFinite(influence)&&influence>=0&&influence<=1,name+': actual contact influence stays within [0,1]');
      if(influence!==0)continue;
      const base=s[side+'AnimatedArm'];assert.ok(base&&[base.wrist,base.elbow,base.rotation].every(v=>v.every(Number.isFinite)),name+': same-frame animated arm cache exists');
      const wristError=distance(s[side+'Wrist'],base.wrist),elbowError=distance(s[side+'Elbow'],base.elbow),rotationError=angle(s[side+'HandQuaternion'],base.rotation);
      assert.ok(wristError<=1e-5&&elbowError<=1e-5,name+': zero influence inherits actual animated wrist/elbow exactly; '+JSON.stringify({index,side,wristError,elbowError}));
      const previous=frames[index-1],dt=previous?s.renderTime-previous.renderTime:0;
      let expectedRotationError=null;
      if(previous&&dt>.003&&dt<=.06&&previous.dribbling){expectedRotationError=Math.max(0,angle(previous[side+'HandQuaternion'],base.rotation)-10*dt);assert.ok(Math.abs(rotationError-expectedRotationError)<=5e-4,name+': free hand follows current animated world rotation at original 10rad/s; '+JSON.stringify({index,side,dt,rotationError,expectedRotationError}));}
      rows.push({index,side,wristError,elbowError,rotationError,expectedRotationError,renderTime:s.renderTime,worldWrist:s[side+'Wrist'],localWrist:s[side+'Wrist'].map((v,i)=>v-s.rootPosition[i]),palmNormal:s[side+'PalmNormal'],shoulderDrop:s[side+'Shoulder'][1]-s[side+'Elbow'][1],animatedShoulderDrop:s[side+'Shoulder'][1]-base.elbow[1]});
    }
  }
  if(requireFree)assert.ok(rows.length>=12,name+': actual zero-influence animated arm frames sampled');
  const perSide=Object.fromEntries(['left','right'].map(side=>{const r=rows.filter(r=>r.side===side),extent=r.length?Math.hypot(...[0,1,2].map(i=>Math.max(...r.map(v=>v.localWrist[i]))-Math.min(...r.map(v=>v.localWrist[i])))):0;return[side,{samples:r.length,localWristExtent:extent,maximumRotationError:Math.max(0,...r.map(v=>v.rotationError)),minimumShoulderDrop:Math.min(...r.map(v=>v.shoulderDrop))}];}));
  if(requireMovement)assert.ok(Object.values(perSide).some(r=>r.samples>=12&&r.localWristExtent>1e-4),name+': free arm inherits a genuinely changing local gait animation');
  const palmPress=[];
  for(const s of frames){
    if(!s.dribbling||s.dribbleBlend!==1||s.armBlend!==1||s.dribbleMove!=='crossover')continue;
    const previous=frames.filter(p=>p.renderTime<=s.renderTime&&p.renderTime>=s.renderTime-.40);
    if(!previous.length||s.renderTime-previous[0].renderTime<.35||previous.some(p=>!p.held||!p.dribbling||p.hand!==s.hand||p.dribbleMove!=='crossover'))continue;
    const side=s.hand<0?'left':'right';if(s[side+'Influence']!==1)continue;
    const normal=s[side+'PalmNormal'],cosine=-normal[1]/Math.hypot(...normal);
    assert.ok(cosine>.5,name+': settled physical palm presses downward without a hand-side multiplier; '+JSON.stringify({side,cosine,renderTime:s.renderTime}));
    palmPress.push({side,cosine,renderTime:s.renderTime});
  }
  if(requirePalmPress)assert.ok(palmPress.length>=12,name+': settled actual active-palm direction is sampled');
  return{samples:rows.length,maximumWristError:Math.max(0,...rows.map(r=>r.wristError)),maximumElbowError:Math.max(0,...rows.map(r=>r.elbowError)),perSide,palmPress:{samples:palmPress.length,minimumDownwardCosine:Math.min(...palmPress.map(p=>p.cosine))},orientation:measureShotHandOrientation(frames,name,{neutral:true})};
}

function measureShotPalmAlignment(samples,name) {
  const held=samples.filter(s=>s.held&&s.charge>0&&s.shotRemaining===0).map(s=>{
    const side=s.hand<0?'left':'right',normal=s[side+'PalmNormal'],wrist=s[side+'Wrist'],direction=s.ball.map((v,i)=>v-wrist[i]),distance=Math.hypot(...direction);
    assert.ok(distance>.001&&Number.isFinite(distance),name+': actual held ball and dominant wrist define a finite palm-facing direction');
    // Both actual finger hierarchies curl into hand-local +Y. Do not mirror twice.
    const cosine=Math.max(-1,Math.min(1,normal.reduce((sum,v,i)=>sum+v*direction[i]/distance,0)));
    return {renderTime:s.renderTime,charge:s.charge,side,cosine,angle:Math.acos(cosine),distance};
  });
  const mature=held.filter(s=>s.charge>=.30);
  assert.ok(mature.length>=3,name+': mature native gather palm alignment is sampled');
  assert.ok(mature.every(s=>s.cosine>0),name+': mature dominant physical +Y palm faces the held ball; minimum cosine '+Math.min(...mature.map(s=>s.cosine)));
  return {axis:'both hands +localY',samples:held.length,matureSamples:mature.length,minimumCosine:Math.min(...held.map(s=>s.cosine)),matureMinimumCosine:Math.min(...mature.map(s=>s.cosine)),matureMaximumAngle:Math.max(...mature.map(s=>s.angle)),lastHeld:held.at(-1),chargeSamples:[.10,.20,.30,.40,.50,.55,.65,.75].filter(charge=>charge<=held.at(-1).charge+.02).map(charge=>held.reduce((a,b)=>Math.abs(a.charge-charge)<Math.abs(b.charge-charge)?a:b))};
}

function measureShotGatherContact(samples,name){
  const collected=samples.filter(s=>!s.inputEvent&&s.held&&s.charge>0&&s.charge<.34&&s.shotGather>=.9);
  assert.ok(collected.length>=3,name+': actual late-gather ball/wrist contact is sampled');
  const rows=collected.flatMap(s=>[-1,1].map(side=>({side,progress:s.shotGather,distance:distance(side<0?s.leftWrist:s.rightWrist,s.ball)})));
  assert.ok(rows.every(r=>Number.isFinite(r.distance)&&r.distance<.25),name+': both real wrists meet the collected ball within ball radius plus palm length and IK tolerance; '+JSON.stringify(rows.find(r=>r.distance>=.25)));
  return{samples:collected.length,maximumWristBallDistance:Math.max(...rows.map(r=>r.distance)),minimumProgress:Math.min(...collected.map(s=>s.shotGather)),axis:'actual world wrist to physical ball, independent of IK goal residual'};
}

function measureShotHandOrientation(samples,name,{finish=false,neutral=false}={}) {
  // Trusted input observers preserve launch contact evidence, but have no new rendered pose.
  // Compare consecutive real requestAnimationFrame poses for SO3 continuity and entry/exit coverage.
  const inputSnapshotsExcluded=samples.filter(s=>s.inputEvent).length;samples=samples.filter(s=>!s.inputEvent);
  const pairs=[],skipped=[];let releaseCrossings=0,tailEndCrossings=0,finishEntryCrossings=0,finishExitCrossings=0,finishReleaseCrossings=0;
  const classify=(a,b)=>finish?(a.finishing==='idle'&&b.finishing!=='idle'?'finish-entry':a.finishing!=='idle'&&b.finishing==='idle'?'finish-exit':b.release?'finish-release':b.finishing!=='idle'?(b.finishPhase||b.finishing):'post-finish'):a.charge>0&&b.charge===0?'release':a.shotRemaining>0&&b.shotRemaining===0?'tail-end':b.charge>0?'charge':b.shotRemaining>0?'followthrough':'post-shot';
  for(let index=1;index<samples.length;index++){
    const a=samples[index-1],b=samples[index],dt=b.renderTime-a.renderTime,segment=classify(a,b);
    if(dt<=.003||dt>.12){skipped.push({index,dt,segment});continue;}
    if(finish&&!a.release&&b.release)finishReleaseCrossings++;
    if(segment==='finish-entry')finishEntryCrossings++;
    if(segment==='finish-exit')finishExitCrossings++;
    if(segment==='release')releaseCrossings++;
    if(segment==='tail-end')tailEndCrossings++;
    for(const side of ['left','right']){
      const q=b[side+'HandQuaternion'],r=a[side+'HandQuaternion'],n=b[side+'PalmNormal'],m=a[side+'PalmNormal'];
      assert.ok([q,r].every(v=>v?.length===4&&v.every(Number.isFinite))&&[n,m].every(v=>v?.length===3&&v.every(Number.isFinite)),name+': actual shot quaternion and palm normal exist');
      const angle=quaternionAngle(q,r);
      const normalAngle=vectorAngle(n,m);
      assert.ok([q,r,n,m].every(v=>Math.abs(Math.hypot(...v)-1)<=1e-3),name+': actual hand quaternion and palm normal are unit length within 1e-3 at sample '+index);
      const limit=.08+12*Math.min(.06,dt);
      pairs.push({index,side,segment,dt,angle,normalAngle,limit});
    }
  }
  const violations=pairs.filter(pair=>pair.angle>pair.limit||pair.normalAngle>pair.limit);
  assert.ok(pairs.length>=20,name+': actual adjacent rendered shot hand orientation pairs exist');
  if(neutral){}else if(finish){assert.ok(finishReleaseCrossings>=1,name+': actual physical finish release has an adjacent valid rendered engine-clock orientation pair');assert.ok(finishEntryCrossings>=1,name+': finish entry has an adjacent valid engine-clock orientation pair');assert.ok(finishExitCrossings>=1,name+': finish exit has an adjacent valid engine-clock orientation pair');}
  else{assert.ok(releaseCrossings>=1,name+': shot release has an adjacent valid engine-clock orientation pair');assert.ok(tailEndCrossings>=1,name+': shot end has an adjacent valid engine-clock orientation pair');}
  assert.ok(violations.length===0,name+': actual two-hand SO3 quaternion / palm normal continuity through load, release and recovery; '+violations.length+' invalid pairs; first '+JSON.stringify(violations[0]));
  return {inputSnapshotsExcluded,validIntervals:pairs.length/2,pairs:pairs.length,skipped,releaseCrossings,tailEndCrossings,finishEntryCrossings,finishExitCrossings,finishReleaseCrossings,maximumAngle:Math.max(...pairs.map(pair=>pair.angle)),maximumNormalAngle:Math.max(...pairs.map(pair=>pair.normalAngle)),maximumInterval:Math.max(...pairs.map(pair=>pair.dt))};
}

function measureTorso(samples,name){
 let intervals=0,maximumRate=0;
 for(let i=1;i<samples.length;i++){
  const a=samples[i-1],b=samples[i],dt=b.renderTime-a.renderTime;if(dt<=.003||dt>.12)continue;
  assert.ok(a.torso&&b.torso,name+': actual applied torso pose exists');
  for(const key of ['pitch','turn','roll']){
   const step=Math.abs(b.torso[key]-a.torso[key]);assert.ok(step<=4.5*Math.min(.06,dt)+1e-6,name+': torso '+key+' continues through action transitions');maximumRate=Math.max(maximumRate,step/dt);
  }
  intervals++;
 }
 assert.ok(intervals>=12,name+': actual torso transition intervals sampled');return{intervals,maximumRate};
}

function measure(samples,name,{shot=false}={}) {
  const rotations=[];
  let ballisticPairs=0,ballisticResidualMax=0;
  const velocities={leftFoot:[],rightFoot:[],leftWrist:[],rightWrist:[],ball:[]};
  for(let i=1;i<samples.length;i++){
    const dt=samples[i].renderTime-samples[i-1].renderTime;
    if(dt<=.003||dt>.12)continue;
    for(const key of ["leftHandQuaternion","rightHandQuaternion"]){const q=samples[i][key],r=samples[i-1][key],dot=q.reduce((sum,v,j)=>sum+v*r[j],0);rotations.push({key,angle:2*Math.acos(Math.max(0,Math.min(1,Math.abs(dot)))),dt});}
    for(const field of Object.keys(velocities)){
      const d=distance(samples[i][field],samples[i-1][field]);velocities[field].push(d/dt);
      const a=samples[i-1],b=samples[i],physical=field==='ball'&&!a.held&&!b.held&&a.physics&&b.physics&&a.physics.shot===b.physics.shot&&a.physics.responses===b.physics.responses;
      if(physical){
        // A released three-point shot can legitimately exceed 9m/s. Verify
        // exact fixed-step ballistic motion instead of applying an authored
        // hand-speed envelope to it. Held-ball and contact-frame gates below
        // remain unchanged; even a 0.1mm free-flight teleport fails this check.
        const elapsed=b.physics.time-a.physics.time;
        assert.ok(elapsed>=0&&elapsed<=Math.min(.06,dt)+1/120+1e-6,name+': actual physics clock stays inside the real rendered interval plus one fixed quantum');
        assert.ok(Math.abs(elapsed*120-Math.round(elapsed*120))<1e-6,name+': actual flight uses the original 120Hz clock');
        assert.ok(distance(a.ball,a.physics.position)<1e-8&&distance(b.ball,b.physics.position)<1e-8,name+': rendered ball samples read the authoritative physical position');
        const expected=a.physics.position.map((v,j)=>v+a.physics.velocity[j]*elapsed-(j===1?4.905*elapsed*elapsed:0));
        const residual=distance(b.ball,expected);assert.ok(residual<1e-5,name+': free-flight ballistic residual below 0.01mm at sample '+i+'; '+residual);
        ballisticPairs++;ballisticResidualMax=Math.max(ballisticResidualMax,residual);continue;
      }
      // Real runner foot speed includes body translation. Check articulation
      // relative to the actual body during locomotion, retaining world velocity.
      const movingFoot=field.endsWith("Foot")&&Math.max(samples[i].speed,samples[i-1].speed)>.3;
      const checked=movingFoot?distance(samples[i][field].map((v,j)=>j===1?v:v-samples[i].rootPosition[j]),samples[i-1][field].map((v,j)=>j===1?v:v-samples[i-1].rootPosition[j])):d;
      // The existing physical simulation advances at 1/120 s. A high-refresh
      // render can contain one full pending physics step, even when render dt is shorter.
      const fixedQuantum=field==="ball"&&!samples[i].held&&!samples[i-1].held?1/120:0;
      assert.ok(checked<(field.endsWith("Foot")?.012+6*dt:.025+9*(dt+fixedQuantum)),`${name}: ${field} continuity at sample ${i}; step ${d.toFixed(4)}m / ${(dt*1000).toFixed(1)}ms`);
    }
  }
  const knees=samples.flatMap(s=>[-1,1].map(side=>kneeAngle(side<0?s.leftHip:s.rightHip,side<0?s.leftKnee:s.rightKnee,side<0?s.leftFoot:s.rightFoot)));
  assert.ok(knees.every(Number.isFinite),`${name}: actual knee angles are finite`);
  const metrics={torso:measureTorso(samples,name),maximumHandRotationRadians:Math.max(...rotations.map(r=>r.angle)),maximumHandRotationRate:Math.max(...rotations.map(r=>r.angle/r.dt)),physicsFixedStep:1/120,ballisticPairs,ballisticResidualMax,maximumVelocity:Object.fromEntries(Object.entries(velocities).map(([field,list])=>[field,Math.max(0,...list)])),kneeAngleMin:Math.min(...knees),kneeAngleMax:Math.max(...knees)};
  if(shot){
    metrics.shotHandOrientation=measureShotHandOrientation(samples,name);
    metrics.shotPalmAlignment=measureShotPalmAlignment(samples,name);
    const footSamples=samples.filter(s=>s.footwork&&s.charge>0||s.footwork&&s.shotRemaining>0);
    const constrainedFeet=footSamples;
    const residuals=constrainedFeet.flatMap(s=>[-1,1].map(side=>{const p=side<0?s.footwork.left:s.footwork.right;return distance(side<0?s.leftFoot:s.rightFoot,[p.x,p.y,p.z]);}));
    metrics.footGoalMaximum=Math.max(...residuals);
    metrics.footPhases=[...new Set(footSamples.map(s=>s.footwork.phase))];
    metrics.plantSamples=footSamples.filter(s=>s.footwork.phase==='plant').length;
    metrics.floorAnkleMin=Math.min(...samples.flatMap(s=>[s.leftFoot[1],s.rightFoot[1]]));
    if(samples.some(s=>s.charge>=.60))assert.ok(metrics.plantSamples>2,`${name}: actual planted charging phase sampled`);
    assert.ok(residuals.every(v=>v<.035),`${name}: actual ankle goal residual below 3.5cm, maximum ${metrics.footGoalMaximum.toFixed(4)}m`);
    assert.ok(metrics.floorAnkleMin>.075,`${name}: actual ankles do not sink below court floor`);
    const tailStart=samples.findIndex(s=>s.shotRemaining>0&&s.shotRemaining<=.12),tailSteps=[];
    assert.ok(tailStart>=0,`${name}: actual final followthrough tail sampled`);
    const firstEnded=samples.slice(tailStart).find(s=>s.shotRemaining===0);
    assert.ok(firstEnded,`${name}: actual shot end sampled`);
    let tailEndCrossings=0;const skippedTailIntervals=[];
    for(let i=tailStart+1;i<samples.length;i++){
      if(samples[i].renderTime>firstEnded.renderTime+.12)break;
      const elapsed=samples[i].renderTime-samples[i-1].renderTime;if(elapsed<=.003||elapsed>.12){skippedTailIntervals.push(elapsed);continue;}
      if(samples[i-1].shotRemaining>0&&samples[i].shotRemaining===0)tailEndCrossings++;
      for(const field of ['leftFoot','rightFoot']){const step=distance(samples[i][field],samples[i-1][field]);tailSteps.push({field,step,elapsed});assert.ok(step<=.008+2.8*Math.min(.06,elapsed),`${name}: late ${field} has no recovery snap: ${step.toFixed(4)}m / ${(elapsed*1000).toFixed(1)}ms`);}
    }
    assert.ok(tailSteps.length>=4,`${name}: at least two valid distinct engine-clock tail intervals observed`);
    assert.ok(tailEndCrossings>=1,`${name}: shot end is captured by an adjacent valid >0 to 0 rendered-frame pair`);
    metrics.tailEndCrossings=tailEndCrossings;metrics.tailValidIntervals=tailSteps.length/2;metrics.tailSkippedIntervals=skippedTailIntervals;metrics.tailSamples=tailSteps.length;metrics.tailMaximumStep=Math.max(...tailSteps.map(s=>s.step));metrics.tailMaximumInterval=Math.max(...tailSteps.map(s=>s.elapsed));metrics.tailMaximumVelocity=Math.max(...tailSteps.map(s=>s.step/s.elapsed));
    const planted=footSamples.filter(s=>s.footwork.phase==='plant');
    for(let i=1;i<planted.length;i++)for(const field of ['leftFoot','rightFoot'])assert.ok(distance(planted[i][field],planted[i-1][field])<.006,`${name}: planted foot remains anchored while loading`);
  }
  return metrics;
}
async function runMove(...args){
  try{await drainMove(...args);}catch(error){
    if(!collectFailures||error.code!=="ERR_ASSERTION")throw error;
    const name=args[3],samples=await page.evaluate(()=>window.__BASKETBALL_QA__.stop());
    if(args[4]?.running){await page.keyboard.up('w');await page.keyboard.up('Enter');}
    if(samples?.length)await writeFile(path.join(out,name+'-diagnostic-failure-samples.json'),JSON.stringify(samples,null,2));
    report.hardFailures??=[];report.hardFailures.push({name,message:error.message,stack:error.stack});
    await flush();console.error(name+': hard failure retained for full diagnostic matrix: '+error.message);
  }
}
async function drainMove(court,move,side,name,{running=false,button=false,leadIn=0}={}){
  await court.hand(side);await court.record(name);
  if(running){await page.keyboard.down('Enter');await page.keyboard.down('w');await page.waitForFunction(()=>{const p=window.__PRESENCE_DEBUG__.presence;return p.turboHeld&&p.speed>5.0;});}
  if(leadIn>0){const start=(await court.read()).renderTime;await page.waitForFunction(({start,leadIn})=>window.__PALACE_DEBUG__.scene.__r3f.root.getState().clock.elapsedTime-start>=leadIn,{start,leadIn});}
  await page.waitForFunction(()=>{const p=window.__PRESENCE_DEBUG__.presence;return p.dribbleMove==='crossover'&&p.dribblePhase>.18&&p.dribblePhase<.65;});
  const before=await court.read();
  if(running)assert.ok(before.turboHeld&&before.speed>5.0,name+": native Enter stays held and ordinary sprint exceeds 5 m/s before creative gather");
  if(button){await page.getByRole('button',{name:move==='between-legs'?'Z · 胯下换手':move==='behind-back'?'C · 背后换手':'Q · 迟疑运球',exact:true}).click();await page.locator('canvas').focus();}
  else await page.keyboard.press(move==='between-legs'?'z':move==='behind-back'?'c':'q');
  const commandInput=await page.evaluate(()=>window.__BASKETBALL_QA__.lastCreative());
  assert.ok(commandInput?.trusted&&commandInput.before,name+': actual trusted creative input has synchronous before/after observations');
  const queued=commandInput.after;
  assert.equal(queued.renderTime,commandInput.before.renderTime,name+': queue assertion uses the same rendered frame as native input rather than a later browser round trip');
  assert.equal(queued.dribbleMove,'crossover',`${name}: creative move queues until next catch`);
  assert.equal(queued.hand,before.hand,`${name}: queued move does not instantly switch hands`);
  await page.waitForFunction(move=>window.__PRESENCE_DEBUG__.presence.dribbleMove===move,move);
  await page.waitForFunction(()=>{const p=window.__PRESENCE_DEBUG__.presence;return p.dribblePhase>.40&&p.dribblePhase<.58;});
  const middle=await court.read();
  if(running)assert.ok(middle.turboHeld&&middle.speed<=3.4,name+": native turbo intent remains held while creative gather physically slows to 3.4 m/s or less");
  contactFrames.push({file:await court.capture(name+'-route'),label:`${name} / actual ${move} mid bounce`});
  await page.waitForFunction(()=>window.__PRESENCE_DEBUG__.presence.dribbleMove==='crossover');
  await page.waitForTimeout(500);
  let recovered=null;
  if(running){await page.waitForFunction(()=>{const p=window.__PRESENCE_DEBUG__.presence;return p.turboHeld&&p.speed>5.0;});recovered=await court.read();assert.ok(recovered.turboHeld&&recovered.speed>5.0,name+": native sprint recovers above 5 m/s after creative gather while Enter remains held");await page.keyboard.up('w');await page.keyboard.up('Enter');}
  const after=await court.read(),samples=await court.finishRecord(name);
  const active=samples.filter(s=>s.dribbleMove===move),settled=samples.filter(s=>s.dribbleBlend===1&&s.dribbling);
  assert.ok(active.length>12,`${name}: creative move rendered over actual frames`);
  assert.equal(after.hand,move==='hesitation'?side:-side,`${name}: hand commits at catch`);
  assert.ok(active.every(s=>s.hand===side),`${name}: source hand remains frozen during creative transfer`);
  assert.ok(settled.every(s=>s.leftWristError<.035&&s.rightWristError<.035),`${name}: both real wrists reachable within 3.5cm during whole creative move; max ${Math.max(...settled.map(s=>Math.max(s.leftWristError,s.rightWristError))).toFixed(4)}`);
  assert.ok(samples.every(s=>s.ballShells.length===1),`${name}: exactly one visible physical ball`);
  const local=active.map(localBall),routeExtent=Math.max(...local.map(p=>p[2]));
  const ordinaryMid=samples.filter(s=>s.dribbleMove==='crossover'&&s.dribblePhase>.40&&s.dribblePhase<.60&&(!running||s.speed>3.4));
  const ordinaryZ=ordinaryMid.map(localBall).map(p=>p[2]),baselineFront=ordinaryZ.reduce((sum,v)=>sum+v,0)/ordinaryZ.length;
  const routeSeparation=routeExtent-baselineFront;
  if(move==='behind-back')assert.ok(routeExtent>0&&routeSeparation>.53,`${name}: actual ball passes behind hip and separates >53cm from ordinary mid-bounce`);
  if(move==='between-legs'){
    const floorPass=active.filter(s=>Math.abs(s.dribblePhase-.44)<.03);
    assert.ok(floorPass.length>=2&&Math.min(...floorPass.map(s=>s.ball[1]))<.20&&floorPass.every(s=>s.ball[0]>Math.min(s.leftFoot[0],s.rightFoot[0])&&s.ball[0]<Math.max(s.leftFoot[0],s.rightFoot[0])),`${name}: actual low bounce passes between the two real planted ankles, with the physical .12 m ball near the floor`);
  }
  const catches=samples.filter(s=>s.dribblePhase<.04||s.dribblePhase>.94).filter(s=>Math.min(distance(s.leftPalm,s.ball),distance(s.rightPalm,s.ball))<.12);
  assert.ok(catches.length>2,`${name}: real catch contact frames sampled`);
  for(const s of catches){const left=distance(s.leftPalm,s.ball)<distance(s.rightPalm,s.ball);assert.ok((left?s.leftWristError:s.rightWristError)<.035,`${name}: true catch wrist residual <3.5cm`);}
  const clearance={calf:Math.min(...active.flatMap(s=>[pointSegmentDistance(s.ball,s.leftKnee,s.leftFoot),pointSegmentDistance(s.ball,s.rightKnee,s.rightFoot)])),thigh:Math.min(...active.flatMap(s=>[pointSegmentDistance(s.ball,s.leftHip,s.leftKnee),pointSegmentDistance(s.ball,s.rightHip,s.rightKnee)])),ankle:Math.min(...active.flatMap(s=>[distance(s.ball,s.leftFoot),distance(s.ball,s.rightFoot)]))};
  assert.ok(clearance.calf>=.165&&clearance.thigh>=.175&&clearance.ankle>=.185,`${name}: physical ball plus conservative calf/thigh/shoe radius clears actual leg skeleton; ${JSON.stringify(clearance)}`);
  if(move==='between-legs'){assert.ok(clearance.calf>=.165,`${name}: physical ball clears actual calf segment by 4.5cm radius, minimum ${clearance.calf.toFixed(4)}m`);assert.ok(clearance.ankle>=.185,`${name}: physical ball clears actual shoe/ankle allowance of 6.5cm, minimum ${clearance.ankle.toFixed(4)}m`);}
  const catchOrientations=[];
  for(let i=1;i<samples.length;i++){
    const a=samples[i-1],b=samples[i],dt=b.renderTime-a.renderTime;
    if(dt<=.003||dt>.12||a.dribbleBlend<1||b.dribbleBlend<1)continue;
    const nearCatch=a.dribblePhase>.90||b.dribblePhase<.10||a.hand!==b.hand;
    if(!nearCatch)continue;
    for(const side of [-1,1]){
      const q=side<0?b.leftHandQuaternion:b.rightHandQuaternion,r=side<0?a.leftHandQuaternion:a.rightHandQuaternion;
      const rotation=2*Math.acos(Math.max(0,Math.min(1,Math.abs(q.reduce((sum,v,j)=>sum+v*r[j],0)))));
      const n=side<0?b.leftPalmNormal:b.rightPalmNormal,m=side<0?a.leftPalmNormal:a.rightPalmNormal;
      const normalAngle=vectorAngle(n,m);
      assert.ok(rotation<=.08+12*Math.min(.06,dt),name+': actual hand quaternion is continuous at catch / hand commit');
      assert.ok(normalAngle<=.08+12*Math.min(.06,dt),name+': actual hand-local Y palm normal is continuous at catch / hand commit');
      catchOrientations.push({side,rotation,normalAngle,dt,commit:a.hand!==b.hand});
    }
  }
  assert.ok(catchOrientations.length>=4,name+': rendered catch orientation samples exist');
  if(move!=='hesitation')assert.ok(catchOrientations.some(s=>s.commit),name+': actual hand-commit orientation pair is captured');
  const relaxedSamples=move==='behind-back'?active.filter(s=>s.dribblePhase>=.32&&s.dribblePhase<=.65):[];
  const relaxedElbows=move==='behind-back'?Object.fromEntries(['left','right'].map(side=>[side,Math.min(...relaxedSamples.map(s=>s[side+'Shoulder'][1]-s[side+'Elbow'][1]))])):null;
  // This subset contains only released behind-back frames; ordinary down-press is
  // independently mandatory in every complete free-arms journey, never this subset.
  if(relaxedElbows){assert.ok(relaxedSamples.length>=3,name+': actual released-phase shoulders and elbows recorded');measureFreeArms(relaxedSamples,name+' / released arms follow real gait',{requirePalmPress:false});}
  const strideSamples=running&&move==='between-legs'?active.filter(s=>s.dribblePhase>=.32&&s.dribblePhase<=.58):[];
  const stride=running&&move==='between-legs'?Object.fromEntries(['leftFoot','rightFoot'].map(field=>{const values=strideSamples.map(s=>s[field][2]-s.rootPosition[2]);return[field,Math.max(...values)-Math.min(...values)];})):null;
  if(stride){assert.ok(strideSamples.length>=3,name+': moving between-legs records actual midpoint stride samples');assert.ok(Math.max(stride.leftFoot,stride.rightFoot)>.03,name+': actual ankle Z relative to athlete preserves more than 3cm stride through transfer midpoint');}
  const groundDrift=Object.fromEntries(['leftFoot','rightFoot'].map(field=>{const steps=[];for(let i=1;i<active.length;i++){const a=active[i-1],b=active[i],dt=b.renderTime-a.renderTime;if(dt<=.003||dt>.12||Math.max(a[field][1],b[field][1])>.14)continue;steps.push({step:distance(a[field],b[field]),dt});}return[field,{intervals:steps.length,maximumWorldStep:Math.max(0,...steps.map(v=>v.step)),maximumWorldSpeed:Math.max(0,...steps.map(v=>v.step/v.dt))}];}));
  const metrics={...measure(samples,name),clearance,relaxedElbows,relaxedSamples:relaxedSamples.length,stride,strideSamples:strideSamples.length,groundDrift,catchOrientation:{samples:catchOrientations.length,maximumAngle:Math.max(...catchOrientations.map(s=>s.rotation)),maximumNormalAngle:Math.max(...catchOrientations.map(s=>s.normalAngle)),maximumInterval:Math.max(...catchOrientations.map(s=>s.dt))}};
  check(name,{move,side,running,button,routeExtent,baselineFront,routeSeparation,catchSamples:catches.length,beforeHand:before.hand,afterHand:after.hand,middle,recovered,sprintBefore:running?before.speed:null,metrics});await flush();
}
try {
  context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1});
  await context.route('**/personal-media/manifest.json',r=>r.fulfill({json:{wallpapers:[],visuals:[],music:[],projects:[],research:[]}}));
  await context.route('**/personal-media/avatar.json',r=>r.fulfill({json:{profile:null}}));
  await context.addInitScript(()=>localStorage.setItem('memory-palace:v3',JSON.stringify({state:{quality:'medium',tutorialDone:true,roomSoundtracks:false},version:0})));
  // Explicit case screenshots and continuous bone samples carry the visual
  // evidence. Avoid a second, very large incidental canvas recording in trace.
  await context.tracing.start({screenshots:false,snapshots:true,sources:false});
  page=await context.newPage();page.setDefaultTimeout(45000);
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  page.on('request',r=>{if(r.method()==='POST')report.uploads.push(r.url());});
  const court=new CourtPage(page);
  await page.goto(`${base}/basketball?view=third`);await court.ready();await installReadOnlyRecorder(page);
  report.graphics=await page.evaluate(()=>{const gl=window.__PALACE_DEBUG__.renderer.getContext(),extension=gl.getExtension('WEBGL_debug_renderer_info');return{vendor:gl.getParameter(gl.VENDOR),renderer:gl.getParameter(gl.RENDERER),unmaskedVendor:extension?gl.getParameter(extension.UNMASKED_VENDOR_WEBGL):null,unmaskedRenderer:extension?gl.getParameter(extension.UNMASKED_RENDERER_WEBGL):null,version:gl.getParameter(gl.VERSION)};});
  await court.start([0,1.65,3],[0,1.75,-12.1],'refinement native initial position');
  assert.equal(await page.getByRole('button',{name:'Z · 胯下换手',exact:true}).count(),0,'creative actions absent while ball only held');
  await court.dribble();await page.getByRole('button',{name:'Z · 胯下换手',exact:true}).waitFor();
  await court.openWardrobe();await court.venue('practice-gym');await court.select('hands','natural');await court.closeWardrobe();
  if(refinementStage==='all'||refinementStage==='free-arms'){
    await court.openWardrobe();await court.venue('blacktop');await court.closeWardrobe();
    const modes=freeFocused?['stand','walk','run','strafe-side']:['stand','walk','run','strafe-left','strafe-right'];
    const waitRendered=async seconds=>{const start=(await court.read()).renderTime;await page.waitForFunction(({start,seconds})=>window.__PALACE_DEBUG__.scene.__r3f.root.getState().clock.elapsedTime-start>=seconds,{start,seconds});};
    const startMotion=async(mode,side)=>{const key=mode==='walk'||mode==='run'?'w':mode==='strafe-left'?'a':mode==='strafe-right'?'d':mode==='strafe-side'?(side<0?'a':'d'):null;if(mode==='run')await page.keyboard.down('Enter');if(key)await page.keyboard.down(key);await page.waitForFunction(mode=>{const speed=window.__PRESENCE_DEBUG__.presence.speed;return mode==='stand'?speed<.12:mode==='run'?speed>5:speed>1&&speed<3.5;},mode);return key;};
    const stopMotion=async key=>{if(key)await page.keyboard.up(key);await page.keyboard.up('Enter');};
    for(const style of (freeFocused?['balanced']:packIds.dribble))for(const side of [1,-1])for(const mode of modes){
      await court.openWardrobe();await court.select('dribble',style);await court.closeWardrobe();await court.start([0,1.65,7],[0,1.75,-12.1],style+'/'+side+'/'+mode+' native free arm');await court.hand(side);await page.waitForFunction(()=>{const p=window.__PRESENCE_DEBUG__.presence,r=window.__PALACE_DEBUG__.scene.getObjectByName('visitor-athlete');return p.dribbleBlend===1&&r.userData.basketballDribbleArmBlend===1;});
      const key=await startMotion(mode,side),name='free-'+style+'-'+(side>0?'right':'left')+'-'+mode;await court.record(name);await waitRendered(1.6);contactFrames.push({file:await court.capture(name),label:name+' / actual native blacktop full body'});await stopMotion(key);const samples=await court.finishRecord(name),metrics=measureFreeArms(samples,name,{requireMovement:mode!=='stand'});
      const duration=samples.at(-1).renderTime-samples[0].renderTime;assert.ok(duration>=1.5,name+': at least 1.5 seconds actual rendered gait');if(mode==='run')assert.ok(samples.filter(s=>s.speed>5).length>=12,name+': native run captured');if(mode!=='stand')assert.ok(distance(samples[0].body,samples.at(-1).body)>1,name+': actual native movement exceeds one metre');check(name,{style,side,mode,duration,metrics});await flush();
    }
    if(!freeFocused)for(const style of packIds.dribble)for(const side of [1,-1]){
      await court.openWardrobe();await court.select('dribble',style);await court.closeWardrobe();await court.start([0,1.65,7],[0,1.75,-12.1],style+'/'+side+' native X animated hand transfer');await court.hand(side);await page.waitForFunction(()=>window.__PALACE_DEBUG__.scene.getObjectByName('visitor-athlete').userData.basketballDribbleArmBlend===1);
      const name='free-X-'+style+'-'+(side>0?'right':'left');await court.record(name);await page.waitForFunction(freeSide=>window.__BASKETBALL_QA__.freeFrames(freeSide)>=14,-side);await page.keyboard.press('x');await page.waitForFunction(side=>{const p=window.__PRESENCE_DEBUG__.presence;return p.hand===-side&&p.crossover<.02;},side);await waitRendered(1.3);contactFrames.push({file:await court.capture(name),label:name+' / native X transfer complete'});const samples=await court.finishRecord(name);assert.ok(samples.some(s=>s.hand===side)&&samples.some(s=>s.hand===-side),name+': source and destination actual hand both sampled');const metrics=measureFreeArms(samples,name);assert.ok(metrics.perSide.left.samples>=12&&metrics.perSide.right.samples>=12,name+': both real arms inherit animation before or after hand transfer');check(name,{style,side,metrics});await flush();
      for(const [move,key]of [['between-legs','z'],['behind-back','c'],['hesitation','q']]){
        await court.start([0,1.65,7],[0,1.75,-12.1],style+'/'+side+'/'+move+' native free-arm recovery');await court.hand(side);await page.waitForFunction(()=>window.__PALACE_DEBUG__.scene.getObjectByName('visitor-athlete').userData.basketballDribbleArmBlend===1);const name='free-creative-'+style+'-'+(side>0?'right':'left')+'-'+move;await court.record(name);await page.keyboard.press(key);await page.waitForFunction(move=>{const p=window.__PRESENCE_DEBUG__.presence;return p.dribbleMove===move&&p.dribblePhase>.32&&p.dribblePhase<.65;},move);contactFrames.push({file:await court.capture(name),label:name+' / actual creative free phase'});await page.waitForFunction(()=>window.__PRESENCE_DEBUG__.presence.dribbleMove==='crossover');await waitRendered(1.3);const samples=await court.finishRecord(name),active=samples.filter(s=>s.dribbleMove===move);assert.ok(active.length>12,name+': native creative frames sampled');const metrics=measureFreeArms(samples,name);if(move!=='hesitation'){assert.ok(active.some(s=>s.leftInfluence===0&&s.rightInfluence===0),name+': both arms return to actual animation while ball is free');}check(name,{style,side,move,metrics});await flush();
      }
    }
  }
  if(refinementStage==="all"||refinementStage==="moves"){
  for(const style of packIds.dribble)for(const side of [1,-1])for(const move of ['between-legs','behind-back','hesitation']){
    if(refinementMoves.length&&!refinementMoves.includes('creative-'+style+'-'+(side<0?'left':'right')+'-'+move))continue;
    await court.openWardrobe();await court.select('dribble',style);await court.closeWardrobe();
    await court.start([0,1.65,4],[0,1.75,-12.1],`${style}/${side}/${move} native start`);
    await runMove(court,move,side,`creative-${style}-${side<0?'left':'right'}-${move}`,{button:style==='balanced'&&side===1&&move==='between-legs'});
  }
  await court.openWardrobe();await court.select('dribble','wide');await court.closeWardrobe();
  for(const side of [1,-1])for(const move of ['between-legs','behind-back','hesitation']){
    if(refinementMoves.length&&!refinementMoves.includes('sprint-'+(side<0?'left':'right')+'-'+move))continue;
    await court.start([0,1.65,5],[0,1.75,-12.1],`sprint ${move} native start`);
    await runMove(court,move,side,`sprint-${side<0?'left':'right'}-${move}`,{running:true});
  }
  if(!refinementMoves.length){
  for(const side of [1,-1])for(const [index,leadIn]of [.13,.29].entries()){
    await court.start([0,1.65,8],[0,1.75,-12.1],`sprint stride variation ${side}/${index} native start`);
    await runMove(court,'between-legs',side,`sprint-${side<0?'left':'right'}-between-legs-stride-${index}`,{running:true,leadIn});
  }
  await court.start([0,1.65,3],[0,1.75,-12.1],'creative native cancellation and pause');await court.dribble();
  await page.keyboard.press('c');await court.openWardrobe();const paused=await court.read();
  await page.keyboard.press('z');await page.keyboard.press('q');await page.keyboard.press('x');await page.waitForTimeout(400);const later=await court.read();
  assert.equal(paused.dribblePhase,later.dribblePhase,'wardrobe pauses creative/dribble clock');assert.equal(paused.hand,later.hand,'wardrobe blocks creative and hand inputs');
  assert.ok(distance(paused.ball,later.ball)<.0001,'wardrobe freezes physical ball');await court.closeWardrobe();
  await page.keyboard.press('r');await page.waitForFunction(()=>window.__PRESENCE_DEBUG__.activity.getState().mode==='ground');await page.keyboard.press('e');await page.waitForFunction(()=>window.__PRESENCE_DEBUG__.presence.held);await court.dribble();await page.waitForTimeout(1000);
  assert.equal((await court.read()).dribbleMove,'crossover','recall clears creative queue');check('native creative queue / wardrobe pauses / R clears queue');
  await court.start([0,1.65,3],[0,1.75,-12.1],'native creative queue / pointer charge / blur cancellation');await court.dribble();
  await page.waitForFunction(()=>{const p=window.__PRESENCE_DEBUG__.presence;return p.dribblePhase>.18&&p.dribblePhase<.52;});
  const beforeCancel=await court.read();await page.keyboard.press('c');
  const shoot=page.getByRole('button',{name:'Hold / release · Shoot',exact:true}),shootBox=await shoot.boundingBox();
  assert.ok(shootBox,'native shoot control has a hit box');
  await page.mouse.move(shootBox.x+shootBox.width/2,shootBox.y+shootBox.height/2);await page.mouse.down();
  await page.waitForFunction(()=>window.__PRESENCE_DEBUG__.presence.charge>.025);
  await page.keyboard.press('Tab');await page.waitForFunction(()=>{const p=window.__PRESENCE_DEBUG__.presence;return p.charge===0&&p.held&&p.shot===0;});await page.mouse.up();
  await page.locator('canvas').focus();await court.dribble();await court.record('input-creative-charge-blur-cancel');await page.waitForTimeout(1250);
  const canceledSamples=await court.finishRecord('input-creative-charge-blur-cancel');
  assert.ok(canceledSamples.every(s=>s.dribbleMove==='crossover'&&s.charge===0&&s.shotRemaining===0),'native pointer blur cancellation clears creative pending/current move and does not launch later');
  assert.equal((await court.read()).shots,beforeCancel.shots,'native pointer blur cancellation creates no physical shot');
  check('native C creative queue / pointer hold Shoot / trusted Tab blur cancel / E restart has no stale move',{samples:canceledSamples.length});
  for(const side of [1,-1])for(const automatic of [false,true]){
    await court.openWardrobe();await court.preferredHand(side);await court.closeWardrobe();
    await court.start([0,1.65,5],[0,1.75,-12.1],'native dribble entry orientation '+side+'/'+automatic);
    await page.waitForFunction(()=>window.__PRESENCE_DEBUG__.presence.holdBlend===1);
    const entryName='entry-'+(side<0?'left':'right')+'-'+(automatic?'sprint':'E');await court.record(entryName);
    if(automatic){await page.keyboard.down('Enter');await page.keyboard.down('w');}
    else await page.keyboard.press('e');
    await page.waitForFunction(()=>window.__PRESENCE_DEBUG__.presence.dribbling&&window.__PRESENCE_DEBUG__.presence.dribbleBlend===1);await page.waitForTimeout(380);
    if(automatic){await page.keyboard.up('w');await page.keyboard.up('Enter');}
    const entrySamples=await court.finishRecord(entryName);let validEntryIntervals=0,maximumEntryAngle=0,maximumEntryNormalAngle=0;
    assert.ok(entrySamples.some(s=>s.dribbling&&s.dribbleBlend>0&&s.dribbleBlend<1),'actual native entry transition sampled');
    for(let i=1;i<entrySamples.length;i++){
      const a=entrySamples[i-1],b=entrySamples[i],dt=b.renderTime-a.renderTime;if(dt<=.003||dt>.12)continue;validEntryIntervals++;
      for(const hand of [-1,1]){
        const q=hand<0?b.leftHandQuaternion:b.rightHandQuaternion,r=hand<0?a.leftHandQuaternion:a.rightHandQuaternion;
        const angle=quaternionAngle(q,r);
        const n=hand<0?b.leftPalmNormal:b.rightPalmNormal,m=hand<0?a.leftPalmNormal:a.rightPalmNormal;
        const normalAngle=vectorAngle(n,m);
        assert.ok(angle<=.08+12*Math.min(.06,dt),entryName+': actual entry world hand quaternion has no mode-switch snap');
        assert.ok(normalAngle<=.08+12*Math.min(.06,dt),entryName+': actual entry palm normal has no mode-switch snap');
        maximumEntryAngle=Math.max(maximumEntryAngle,angle);maximumEntryNormalAngle=Math.max(maximumEntryNormalAngle,normalAngle);
      }
    }
    assert.ok(validEntryIntervals>=3,'native dribble entry has valid continuous engine-clock samples');
    check(entryName,{side,automatic,validEntryIntervals,maximumEntryAngle,maximumEntryNormalAngle});
  }
  await court.start([0,1.65,3],[0,1.75,-12.1],'native outfit remount during active dribble');
  await court.dribble();await page.waitForFunction(()=>{const p=window.__PRESENCE_DEBUG__.presence;return p.dribbleBlend===1&&p.dribblePhase>.20&&p.dribblePhase<.60;});
  await court.record('native-active-dribble-outfit-remount');await court.openWardrobe();
  const remountBefore=await court.read(),remountOutfits=court.dialog.locator('fieldset.athlete-outfits').getByRole('button');
  let remountIndex=0;for(let i=0;i<await remountOutfits.count();i++)if(await remountOutfits.nth(i).getAttribute('aria-pressed')!=='true'){remountIndex=i;break;}
  await remountOutfits.nth(remountIndex).click();assert.equal(await remountOutfits.nth(remountIndex).getAttribute('aria-pressed'),'true');
  await page.waitForFunction(old=>{const bone=window.__PALACE_DEBUG__.scene.getObjectByName('visitor-athlete')?.getObjectByName('Bip01_L_Hand');return !!bone&&bone.uuid!==old;},remountBefore.leftHandBoneId);
  const remountPaused=await court.read();assert.equal(remountPaused.dribblePhase,remountBefore.dribblePhase,'native outfit change pauses the same active dribble phase');
  await court.closeWardrobe();const remountResume=await court.read();
  await page.waitForFunction(phase=>{const p=window.__PRESENCE_DEBUG__.presence;return p.dribbling&&p.dribbleBlend===1&&Math.abs(p.dribblePhase-phase)>.08;},remountResume.dribblePhase);await page.waitForTimeout(350);
  const remountSamples=await court.finishRecord('native-active-dribble-outfit-remount');
  const firstNewRig=remountSamples.findIndex(s=>s.leftHandBoneId!==remountBefore.leftHandBoneId);assert.ok(firstNewRig>0,'native outfit choice really replaces the live rig and records adjacent previous rig');
  const remountCriticalDt=remountSamples[firstNewRig].renderTime-remountSamples[firstNewRig-1].renderTime;
  assert.ok(Number.isFinite(remountCriticalDt)&&remountCriticalDt>=0,'new rig has a finite monotonic engine-clock replacement interval');
  const remountPrevious=remountSamples[firstNewRig-1],remountCurrent=remountSamples[firstNewRig];
  assert.equal(remountPrevious.dribblePhase,remountCurrent.dribblePhase,'native new-rig replacement occurs at the same naturally paused dribble phase');
  for(const hand of [-1,1]){const q=hand<0?remountCurrent.leftHandQuaternion:remountCurrent.rightHandQuaternion,r=hand<0?remountPrevious.leftHandQuaternion:remountPrevious.rightHandQuaternion,n=hand<0?remountCurrent.leftPalmNormal:remountCurrent.rightPalmNormal,m=hand<0?remountPrevious.leftPalmNormal:remountPrevious.rightPalmNormal;
    const angle=quaternionAngle(q,r),normal=vectorAngle(n,m);
    assert.ok(angle<=.08&&normal<=.08,'paused outfit replacement preserves actual hand quaternion and palm normal within strict static .08 rad regardless of compilation gap');
  }
  for(const side of ['left','right'])for(const joint of ['Wrist','Elbow'])assert.ok(distance(remountCurrent[side+joint],remountPrevious[side+joint])<=1e-5,'paused outfit replacement preserves actual '+side+' '+joint+' position');
  let validRemountAfterResume=0,maximumRemountAngle=0,maximumRemountNormalAngle=0;
  for(let i=1;i<remountSamples.length;i++){
    const a=remountSamples[i-1],b=remountSamples[i],dt=b.renderTime-a.renderTime;if(dt<=0||dt>.12)continue;
    if(a.renderTime>=remountResume.renderTime&&dt>.003)validRemountAfterResume++;
    for(const hand of [-1,1]){
      const q=hand<0?b.leftHandQuaternion:b.rightHandQuaternion,r=hand<0?a.leftHandQuaternion:a.rightHandQuaternion;
      const angle=quaternionAngle(q,r);
      const n=hand<0?b.leftPalmNormal:b.rightPalmNormal,m=hand<0?a.leftPalmNormal:a.rightPalmNormal;
      const normalAngle=vectorAngle(n,m);
      assert.ok(angle<=.08+12*Math.min(.06,dt),'native active-dribble outfit remount preserves actual world hand quaternion');
      assert.ok(normalAngle<=.08+12*Math.min(.06,dt),'native active-dribble outfit remount preserves actual palm normal');
      maximumRemountAngle=Math.max(maximumRemountAngle,angle);maximumRemountNormalAngle=Math.max(maximumRemountNormalAngle,normalAngle);
    }
  }
  assert.ok(validRemountAfterResume>=3,'native remount records at least three valid post-resume intervals');
  assert.ok(remountSamples.every(s=>s.dribbling&&s.held&&s.leftWristError<.035&&s.rightWristError<.035),'native remount retains active dribble and reachable real wrists');
  check('native active-dribble outfit replacement / paused phase / actual new-rig quaternion / valid resumed motion',{outfitIndex:remountIndex,oldHandBone:remountBefore.leftHandBoneId,newHandBone:remountPaused.leftHandBoneId,firstNewRig,remountCriticalDt,validRemountAfterResume,maximumRemountAngle,maximumRemountNormalAngle});await flush();
  }

  }
  if(refinementStage==="all"||refinementStage==="shots"){
  const nativeShotCases=packIds.shot.flatMap(id=>[1,-1].flatMap(side=>[.75,.46,.50,.55,.64].map(releaseCharge=>({id,side,releaseCharge}))));
  if(refinementSingle)nativeShotCases.splice(0,nativeShotCases.length,{id:"quick",side:-1,releaseCharge:.61});
  nativeShotCases.sort((a,b)=>Number(b.id==='high-release'&&b.side===-1&&b.releaseCharge===.46)-Number(a.id==='high-release'&&a.side===-1&&a.releaseCharge===.46));
  for(const {id,side,releaseCharge} of nativeShotCases){
    await court.openWardrobe();await court.select('shot',id);await court.preferredHand(side);await court.closeWardrobe();
    await court.start([0,1.65,-4.8],[0,3.05,-12.1],`${id}/${side} native shot-footwork`);
    await page.waitForFunction(side=>window.__PRESENCE_DEBUG__.presence.hand===side,side);
    await page.waitForFunction(()=>window.__PRESENCE_DEBUG__.presence.holdBlend===1);
    const before=await court.read(),name=`footwork-${id}-${side<0?'left':'right'}-${releaseCharge}`;
    await court.record(name);await page.keyboard.down('5');
    await page.waitForFunction(()=>{const c=window.__PRESENCE_DEBUG__.presence.charge;return c>.12&&c<.34;});
    const loadCapture=court.capture(name+'-load');
    await page.waitForFunction(target=>window.__PRESENCE_DEBUG__.presence.charge>=target,releaseCharge);
    await page.keyboard.up('5');const launch=await page.evaluate(()=>window.__BASKETBALL_QA__.lastRelease());
    assert.ok(launch?.nativeShotRelease,`${name}: trusted native physical shot launch`);
    assert.equal(launch.held,false,`${name}: trusted release immediately publishes physical possession`);
    assert.equal(launch.charge,0,`${name}: trusted release clears the published charge in the same input event`);
    assert.ok((side<0?launch.leftWristError:launch.rightWristError)<.035,`${name}: shooting wrist has real launch contact within 3.5cm`);
    contactFrames.push({file:await court.capture(name+'-release'),label:name+' / release, actual feet in air'});
    await page.waitForFunction(()=>window.__PRESENCE_DEBUG__.presence.shot===0);await page.waitForTimeout(180);
    contactFrames.push({file:await court.capture(name+'-land'),label:name+' / landing and recovery'});
    await page.waitForFunction(n=>window.__PRESENCE_DEBUG__.activity.getState().shots===n,before.shots+1);
    const samples=await court.finishRecord(name),metrics=measure(samples,name,{shot:true});
    assert.ok(samples.filter(s=>s.shotRemaining>0).every(s=>s.leftWristError<.035&&s.rightWristError<.035),`${name}: followthrough wrist targets remain reachable through landing`);
    if(releaseCharge===.64)assert.ok(metrics.footPhases.includes('air')&&metrics.footPhases.includes('land'),`${name}: actual airborne and landing foot phases observed`);
    const load=await loadCapture;if(releaseCharge===.64)contactFrames.push({file:load,label:name+' / native load, planted feet'});
    assert.ok(samples.filter(s=>s.held&&s.charge>0).every(s=>s.shotGatherDuration===.16),name+': held-shot quick gather timing is preserved');
    metrics.gatherContact=measureShotGatherContact(samples,name);
    check(name,{side,id,requestedReleaseCharge:releaseCharge,actualReleaseCharge:launch.releasedCharge,launch,metrics,shots:(await court.read()).shots-before.shots});await flush();
  }
  if(!refinementSingle)for(const side of [1,-1]){
    await court.openWardrobe();await court.select('shot','quick');await court.preferredHand(side);await court.closeWardrobe();
    await court.start([0,1.65,5],[0,3.05,-12.1],'native '+side+' behind-back into quick stop gather');await court.hand(side);
    const before=await court.read(),name='quick-transition-'+(side>0?'right':'left');await court.record(name);
    await page.keyboard.down('Enter');await page.keyboard.down('w');await page.waitForFunction(()=>window.__PRESENCE_DEBUG__.presence.speed>5.0);
    await page.keyboard.press('c');await page.waitForFunction(()=>{const p=window.__PRESENCE_DEBUG__.presence;return p.dribbleMove==='behind-back'&&p.dribblePhase>.32&&p.dribblePhase<.58;});
    const transfer=await court.read();assert.ok(transfer.held&&transfer.dribbling&&transfer.turboHeld,name+': native moving behind-back is active before stop gather');
    await page.keyboard.up('w');await page.keyboard.up('Enter');await page.keyboard.down('5');
    await page.waitForFunction(()=>{const p=window.__PRESENCE_DEBUG__.presence;return p.charge>.12&&p.charge<.34;});
    const loadCapture=court.capture(name+'-load');await page.waitForFunction(()=>window.__PRESENCE_DEBUG__.presence.charge>=.55);await page.keyboard.up('5');
    const launch=await page.evaluate(()=>window.__BASKETBALL_QA__.lastRelease());assert.ok(launch?.nativeShotRelease,name+': trusted physical launch');assert.equal(launch.hand,side,name+': gather preserves original source hand');
    assert.ok((side<0?launch.leftWristError:launch.rightWristError)<.035,name+': actual release wrist contact within 3.5cm');
    contactFrames.push({file:await court.capture(name+'-release'),label:name+' / native behind-back stop and actual quick release'});
    await page.waitForFunction(()=>window.__PRESENCE_DEBUG__.presence.shot===0);await page.waitForTimeout(180);await page.waitForFunction(n=>window.__PRESENCE_DEBUG__.activity.getState().shots===n,before.shots+1);
    const samples=await court.finishRecord(name),metrics={...measure(samples,name),shotHandOrientation:measureShotHandOrientation(samples,name),shotPalmAlignment:measureShotPalmAlignment(samples,name)};
    assert.ok(samples.some(s=>s.dribbleMove==='behind-back'&&s.dribbling)&&samples.some(s=>s.charge>0&&!s.dribbling),name+': native behind-back transitions directly into shooting gather');
    const gatherSamples=samples.filter(s=>s.held&&s.charge>0);
    assert.ok(gatherSamples.length>=12&&gatherSamples.every(s=>s.shotGatherDuration>=.16&&s.shotGatherDuration<=.34&&Math.abs(s.shotGather-Math.min(1,s.charge*1.05/s.shotGatherDuration))<1e-6),name+': real ball and two-arm gather share the same bounded duration and engine clock');
    metrics.gatherContact=measureShotGatherContact(samples,name);
    contactFrames.push({file:await loadCapture,label:name+' / actual native gather'});check(name,{side,id:'quick',transfer,actualReleaseCharge:launch.releasedCharge,launch,metrics,shots:(await court.read()).shots-before.shots});await flush();
  }
  const releaseTimings=report.checks.filter(c=>c.requestedReleaseCharge!==undefined);
  report.releaseTimingSummary={actualMinimum:Math.min(...releaseTimings.map(c=>c.actualReleaseCharge)),actualMaximum:Math.max(...releaseTimings.map(c=>c.actualReleaseCharge)),cases:releaseTimings.map(c=>({name:c.name,requested:c.requestedReleaseCharge,actual:c.actualReleaseCharge,classification:c.actualReleaseCharge<.575?'early':c.actualReleaseCharge>.705?'late':'clean'}))};
  for(const id of packIds.shot)for(const side of [-1,1]){if(refinementSingle&&(id!=="quick"||side!==-1))continue;const values=releaseTimings.filter(c=>c.id===id&&c.side===side).map(c=>c.actualReleaseCharge);assert.ok(values.every(Number.isFinite)&&values.some(v=>v>=.60&&v<=.69)&&(refinementSingle||values.some(v=>v<.575)&&values.some(v=>v>.705)),`${id}/${side}: native actual release charges cover ${refinementSingle?"targeted near-clean retry":"genuine early / clean / late timing"}`);}
  }
  if(refinementStage==='all'||refinementStage==='finishes'){
  for(const kind of ['layup','dunk'])for(const id of packIds[kind])for(const side of [1,-1]){
    await court.openWardrobe();await court.select(kind,id);await court.closeWardrobe();
    await court.start([-.35*side,1.65,kind==='dunk'?-7.6:-9.55],[0,3.05,-12.1],kind+'/'+id+'/'+side+' native near-rim start and physical score');
    await court.hand(side);
    const before=await court.read(),name=kind+'-'+id+'-'+(side>0?'right':'left');
    await court.record(name);await page.waitForTimeout(80);
    if(kind==='dunk'){await page.keyboard.down('Enter');await page.keyboard.down('w');await page.waitForFunction(()=>{const p=window.__PRESENCE_DEBUG__.presence;return p.speed>3.2&&p.camera.position.z<-9.6&&p.camera.position.z>-11.1;});}
    await page.keyboard.press('5');
    if(kind==='dunk'){await page.keyboard.up('w');await page.keyboard.up('Enter');}
    await page.waitForFunction(kind=>window.__PRESENCE_DEBUG__.presence.finish===kind,kind);
    const captures=[];
    for(let index=0;index<7;index++){captures.push(court.capture(name+'-'+index));await page.waitForTimeout(100);}
    await Promise.all(captures);
    const frames=report.frames.filter(frame=>frame.file.startsWith(name+'-')),rise=frames.filter(frame=>frame.before.finishPhase==='rise'||frame.after.finishPhase==='rise');
    assert.ok(rise.length>0,name+': actual rise screenshot exists');
    contactFrames.push({file:rise[Math.floor(rise.length/2)].file,label:name+' / actual native rise'});
    await page.waitForFunction(n=>window.__PRESENCE_DEBUG__.activity.getState().made===n,before.made+1);
    await page.waitForFunction(()=>window.__PRESENCE_DEBUG__.presence.finish==='idle');await page.waitForTimeout(180);
    const after=await court.read(),samples=await court.finishRecord(name);
    assert.equal(after.shots,before.shots+1,name+': exactly one original physics release');
    assert.equal(after.made,before.made+1,name+': original physical score');
    assert.ok(samples.some(s=>s.finishPackage===id),name+': selected package exercised');
    assert.ok(samples.some(s=>s.finishPhase==='rise')&&samples.some(s=>s.release),name+': actual authored rise and physical launch observed');
    const release=samples.find(s=>s.release);assert.ok(release,name+': actual launch frame observed');
    assert.equal(release.hand,side,name+': original native X source hand used');assert.equal(release.made,before.made,name+': score waits for descending rim crossing');
    assert.ok(samples.some(s=>s.time>=release.time&&s.time-release.time<250&&s.shots===before.shots+1),name+': original HUD publishes exactly one physical attempt');
    assert.ok((side<0?release.leftWristError:release.rightWristError)<.035,name+': actual shooting wrist release contact within 3.5cm');
    if(kind==='dunk'&&id==='two-hand'){
      const support=samples.filter(s=>(s.finishPhase==='rise'||s.release)&&s.twoHands>.95);
      assert.ok(release.twoHands>.95,name+': both hands support ball at actual release');assert.ok(release.leftWristError<.035&&release.rightWristError<.035,name+': both real release wrists contact within 3.5cm');
      assert.ok(support.length>2&&support.every(s=>s.leftWristError<.035&&s.rightWristError<.035),name+': both wrists reachable through true two-hand support');
    }
    const metrics={handOrientation:measureShotHandOrientation(samples,name,{finish:true})};
    check('native '+name+' / original release and downward-crossing score',{kind,id,side,before:{shots:before.shots,made:before.made},after:{shots:after.shots,made:after.made},release,metrics});await flush();
  }
  }
  await court.start([0,1.65,2],[0,1.8,-12.1],'neutral public character detail');await court.openWardrobe();
  const outfitButtons=court.dialog.locator('fieldset.athlete-outfits').getByRole('button');
  const outfitCount=await outfitButtons.count();assert.equal(outfitCount,6,'all existing outfit choices retained');
  for(let index=0;index<outfitCount;index++){await outfitButtons.nth(index).click();assert.equal(await outfitButtons.nth(index).getAttribute('aria-pressed'),'true');await page.waitForTimeout(230);contactFrames.push({file:await court.capture(`outfit-surface-${index}`),label:`Native public outfit ${index+1} / original authorized mesh and textures / surface shader`});}
  await outfitButtons.nth(0).click();await page.waitForTimeout(230);
  contactFrames.push({file:await court.capture('neutral-detail-front'),label:'Public neutral face / fabric / shoes / native initial wardrobe front view'});
  await page.screenshot({path:path.join(out,'neutral-detail-front-crop.png'),clip:{x:720,y:195,width:460,height:690}});
  const orbit=court.dialog.getByRole('button',{name:'转向 ↷',exact:true});
  for(const angle of ['angle-1','angle-2','angle-3','angle-4']){
    await orbit.click();await page.waitForTimeout(230);
    const file=await court.capture(`neutral-detail-${angle}`);contactFrames.push({file,label:`Public neutral character / native wardrobe orbit / ${angle}`});
    await page.screenshot({path:path.join(out,`neutral-detail-${angle}-crop.png`),clip:{x:720,y:195,width:460,height:690}});
  }
  await court.closeWardrobe();
  await court.start([.1,1.65,-11],[0,3.05,-12.1],'physical ball and regulation hoop detail');
  contactFrames.push({file:await court.capture('ball-hoop-detail'),label:'Actual physical ball / regulation hoop / public neutral character'});
  check('public character cloth / skin / shoes / physical ball and hoop shader render with native wardrobe orbit');
  assert.deepEqual(report.errors,[],'no browser runtime/shader/console errors');assert.deepEqual(report.uploads,[],'no private uploads');
  const cells=[];for(const {file,label} of contactFrames)cells.push(`<figure><figcaption>${escapeHtml(label)}</figcaption><img src="data:image/jpeg;base64,${(await readFile(path.join(out,file))).toString('base64')}"></figure>`);
  const html=`<!doctype html><meta charset="utf-8"><title>Basketball refinement native evidence</title><style>body{margin:0;background:#101b20;color:#dce7ed;font:16px Arial}header{padding:24px}main{display:grid;grid-template-columns:repeat(3,640px)}figure{margin:0}figcaption{height:42px;padding:8px 12px;font-size:13px}img{width:640px;height:360px;display:block}</style><header><h1>Basketball refinement / actual native inputs</h1><p>Neutral public avatar / original rigs and physical ball / camera initial positions only / Edge medium</p></header><main>${cells.join('')}</main>`;
  await writeFile(path.join(out,'contact-sheet.html'),html);const sheet=await context.newPage();await sheet.setViewportSize({width:1920,height:1080});await sheet.setContent(html);await sheet.screenshot({path:path.join(out,'contact-sheet.png'),fullPage:true});await sheet.close();
  report.sourceDrift=[];for(const file of sourceFiles)if(await sourceHash(file)!==sourceHashes[file])report.sourceDrift.push(file);assert.deepEqual(report.sourceDrift,[],'runtime source unchanged throughout verification');
  assert.deepEqual(report.hardFailures||[],[],"no hard native journey failures; diagnostic collection never constitutes acceptance");
  report.passed=true;report.contactSheet='contact-sheet.png';await publishReport();console.log(JSON.stringify({passed:true,checks:report.checks.length,frames:report.frames.length,journeys:report.journeys.length,out}));
}catch(error){
  report.failure=error.stack;report.endSourceHashes=Object.fromEntries(await Promise.all(sourceFiles.map(async file=>[file,await sourceHash(file)])));report.sourceDrift=sourceFiles.filter(file=>report.endSourceHashes[file]!==sourceHashes[file]);if(page&&!page.isClosed()){const samples=await page.evaluate(()=>window.__BASKETBALL_QA__?.stop()).catch(()=>null);if(samples?.length)await writeFile(path.join(out,'failure-samples.json'),JSON.stringify(samples,null,2));await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});}await publishReport();throw error;
}finally{if(context)await context.tracing.stop({path:path.join(out,'trace.zip')}).catch(()=>{});await context?.close().catch(()=>{});await browser.close().catch(()=>{});}
