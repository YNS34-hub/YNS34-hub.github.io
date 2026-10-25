import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import ts from "typescript";
import { AnimationClip, AnimationMixer, Bone, Group, InterpolateDiscrete, Object3D, Quaternion, QuaternionKeyframeTrack, Vector3, VectorKeyframeTrack } from "three";

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reportPath = path.join(project, "qa-artifacts/basketball-packages/reach.json");
const tolerance = .035, interval = 1 / 120;
const modules = new Map();
const sourcePaths = ["public/media/presence/athlete.gltf", "src/worlds/BasketballCourt.tsx", "src/worlds/presence/Avatar.tsx", "src/worlds/presence/dribbleMotion.ts", "src/worlds/presence/dribblePose.ts", "src/worlds/presence/shotPose.ts", "src/worlds/presence/ik.ts", "src/worlds/court/motionPacks.ts", "src/worlds/court/finishing.ts"];
const sources = new Map();
function readSource(filename) {
  if (!sources.has(filename)) {
    const content = fs.readFileSync(filename);
    sources.set(filename, { content, hash: createHash("sha256").update(content).digest("hex") });
  }
  return sources.get(filename).content;
}
sourcePaths.forEach(source => readSource(path.join(project, source)));

// Load the real TypeScript motion/IK modules without building or modifying the app.
function loadSource(relativePath) {
  const filename = path.resolve(project, relativePath);
  if (modules.has(filename)) return modules.get(filename).exports;
  const module = { exports: {} }; modules.set(filename, module);
  const nativeRequire = createRequire(filename);
  const requireSource = specifier => {
    if (!specifier.startsWith(".")) return nativeRequire(specifier);
    const target = path.resolve(path.dirname(filename), specifier);
    for (const candidate of [target, target + ".ts", target + ".js", target + ".mjs"]) {
      if (fs.existsSync(candidate) && candidate.endsWith(".ts")) return loadSource(path.relative(project, candidate));
    }
    return nativeRequire(specifier);
  };
  const compiled = ts.transpileModule(readSource(filename).toString("utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  });
  new Function("require", "module", "exports", compiled.outputText)(requireSource, module, module.exports);
  return module.exports;
}

const { motionPacks, defaultPacks } = loadSource("src/worlds/court/motionPacks.ts");
const { FinishMotion } = loadSource("src/worlds/court/finishing.ts");
const { DribbleMotion } = loadSource("src/worlds/presence/dribbleMotion.ts");
const { LimbIK } = loadSource("src/worlds/presence/ik.ts");
const { HOOPS } = loadSource("src/worlds/basketballPhysics.ts");
const { prepareShot, shotRecovery, shotFollowThroughTarget } = loadSource("src/worlds/presence/shotPose.ts");

function loadAthlete() {
  const directory = path.join(project, "public/media/presence");
  const gltf = JSON.parse(readSource(path.join(directory, "athlete.gltf")).toString("utf8"));
  const joints = new Set(gltf.skins.flatMap(skin => skin.joints));
  const nodes = gltf.nodes.map((source, index) => {
    const node = joints.has(index) ? new Bone() : new Object3D(); node.name = source.name ?? "";
    if (source.matrix) { node.matrix.fromArray(source.matrix); node.matrix.decompose(node.position, node.quaternion, node.scale); }
    else {
      if (source.translation) node.position.fromArray(source.translation);
      if (source.rotation) node.quaternion.fromArray(source.rotation);
      if (source.scale) node.scale.fromArray(source.scale);
    }
    return node;
  });
  gltf.nodes.forEach((node, index) => (node.children ?? []).forEach(child => nodes[index].add(nodes[child])));
  const model = new Group(), root = new Group();
  gltf.scenes[gltf.scene ?? 0].nodes.forEach(index => model.add(nodes[index])); root.add(model);
  const buffers = gltf.buffers.map(buffer => readSource(path.join(directory, buffer.uri)));
  function accessor(index) {
    const source = gltf.accessors[index], view = gltf.bufferViews[source.bufferView];
    const width = { SCALAR: 1, VEC3: 3, VEC4: 4 }[source.type];
    if (!width || source.componentType !== 5126 || source.sparse) throw Error("Unsupported athlete animation accessor");
    const data = buffers[view.buffer], offset = (view.byteOffset ?? 0) + (source.byteOffset ?? 0), stride = view.byteStride ?? width * 4;
    const values = new Float32Array(source.count * width);
    for (let row = 0; row < source.count; row++) for (let column = 0; column < width; column++) values[row * width + column] = data.readFloatLE(offset + row * stride + column * 4);
    return values;
  }
  const bindPose = nodes.map(node => ({ position: node.position.clone(), quaternion: node.quaternion.clone(), scale: node.scale.clone() }));
  const clips = new Map(gltf.animations.map(animation => {
    const tracks = animation.channels.map(channel => {
      const sampler = animation.samplers[channel.sampler], node = nodes[channel.target.node];
      if (!new Set([undefined, "LINEAR", "STEP"]).has(sampler.interpolation)) throw Error("Unsupported athlete animation interpolation");
      const property = { rotation: "quaternion", translation: "position", scale: "scale" }[channel.target.path];
      if (!property) throw Error("Unsupported athlete animation target");
      const Track = property === "quaternion" ? QuaternionKeyframeTrack : VectorKeyframeTrack;
      return new Track(node.uuid + "." + property, accessor(sampler.input), accessor(sampler.output), sampler.interpolation === "STEP" ? InterpolateDiscrete : undefined);
    });
    return [animation.name, new AnimationClip(animation.name, -1, tracks)];
  }));
  if (!clips.has("idle")) throw Error("Actual athlete idle clip is missing");
  const mixer = new AnimationMixer(model); mixer.clipAction(clips.get("idle")).play(); mixer.setTime(.1);
  model.position.set(0, 0, 0); model.rotation.y = Math.PI; root.updateWorldMatrix(true, true);
  const bones = new Map(nodes.filter(node => node instanceof Bone).map(node => [node.name, node]));
  const baseline = nodes.map(node => ({ position: node.position.clone(), quaternion: node.quaternion.clone(), scale: node.scale.clone() }));
  return {
    root, model, bones, ik: new LimbIK(),
    setClipTime(time, clipName = "idle") {
      if (!clips.has(clipName)) throw Error("Actual athlete clip is missing: " + clipName);
      mixer.stopAllAction();
      nodes.forEach((node, index) => { node.position.copy(bindPose[index].position); node.quaternion.copy(bindPose[index].quaternion); node.scale.copy(bindPose[index].scale); });
      mixer.clipAction(clips.get(clipName)).reset().play(); mixer.setTime(time); model.position.set(0, 0, 0); model.rotation.y = Math.PI;
      nodes.forEach((node, index) => { baseline[index].position.copy(node.position); baseline[index].quaternion.copy(node.quaternion); baseline[index].scale.copy(node.scale); });
      root.updateWorldMatrix(true, true);
    },
    reset(position, yaw, jump = 0, crouch = 0) {
      nodes.forEach((node, index) => { node.position.copy(baseline[index].position); node.quaternion.copy(baseline[index].quaternion); node.scale.copy(baseline[index].scale); });
      root.position.set(position.x, position.y - 1.65 + jump - crouch, position.z); root.rotation.set(0, yaw, 0);
      model.position.set(0, 0, 0); model.rotation.y = Math.PI; root.updateWorldMatrix(true, true);
    },
    dispose() { mixer.stopAllAction(); mixer.uncacheRoot(model); },
  };
}

const rig = loadAthlete();
function rotateBody(name, angle, x, y, z) {
  const bone = rig.bones.get(name), axis = new Vector3(x, y, z).transformDirection(rig.root.matrixWorld);
  const world = bone.getWorldQuaternion(new Quaternion()).premultiply(new Quaternion().setFromAxisAngle(axis, angle));
  bone.quaternion.copy(bone.parent.getWorldQuaternion(new Quaternion()).invert().multiply(world)); bone.updateWorldMatrix(true, true);
}
function measureHand(side, target, pole) {
  const prefix = "Bip01_" + (side === 1 ? "R" : "L") + "_";
  const upper = rig.bones.get(prefix + "UpperArm"), forearm = rig.bones.get(prefix + "Forearm"), hand = rig.bones.get(prefix + "Hand");
  const shoulder = upper.getWorldPosition(new Vector3()), elbow = forearm.getWorldPosition(new Vector3()), wrist = hand.getWorldPosition(new Vector3());
  const reach = shoulder.distanceTo(elbow) + elbow.distanceTo(wrist), distance = shoulder.distanceTo(target);
  rig.ik.solve(upper, forearm, hand, target, pole); hand.getWorldPosition(wrist);
  return { reach, targetDistance: distance, unreachable: Math.max(0, distance - reach), wristError: wrist.distanceTo(target), shoulder: shoulder.toArray(), target: target.toArray(), wrist: wrist.toArray() };
}
function finishTarget(pose, side, dominantHand, hands, guideOffset = .03) {
  const dominant = side === dominantHand, guide = pose.guide, twoHands = pose.twoHands, axis = new Vector3(1, 0, 0).transformDirection(rig.root.matrixWorld);
  const target = new Vector3(pose.ball.x, pose.ball.y, pose.ball.z); target.y -= dominant ? .115 : guideOffset;
  target.addScaledVector(axis, dominant ? -dominantHand * .025 : -dominantHand * .14 * guide);
  if (twoHands > 0) {
    const supported = new Vector3(pose.ball.x, pose.ball.y - .045, pose.ball.z);
    supported.addScaledVector(axis, side * (pose.handSpread ?? hands.spread)); target.lerp(supported, twoHands);
  }
  const rest = new Vector3(side * .38, 1.11, -.23); rig.root.localToWorld(rest); target.lerp(rest, dominant ? 0 : 1 - guide);
  return target;
}
function recordMaximum(record, value, context) {
  if (!record.max || value.wristError > record.max.wristError) record.max = { ...context, ...value };
  record.samples++;
}
function heldWristSeeds(handPackage, hand) {
  const hands = motionPacks.hands[handPackage], seeds = new Map();
  rig.reset({ x: 0, y: 1.65, z: 0 }, 0, 0, .08);
  for (const side of [-1, 1]) {
    const target = new Vector3(hand * hands.holdX + side * hands.spread, hands.holdY - .045, hands.holdZ);
    const pole = new Vector3(side * .50, 1.02, -.32); rig.root.localToWorld(pole);
    seeds.set(side, measureHand(side, target, pole));
  }
  return seeds;
}
function verifyHeldHands() {
  const reports = [];
  for (const id of Object.keys(motionPacks.hands)) for (const hand of [-1, 1]) {
    const report = { kind: "held", package: id, hand, samples: 0, max: null };
    for (const [side, value] of heldWristSeeds(id, hand)) recordMaximum(report, value, { side });
    report.passed = report.max.wristError <= tolerance; reports.push(report);
  }
  return reports;
}
function verifyShotProfiles() {
  const reports = [];
  for (const id of Object.keys(motionPacks.shot)) for (const hand of [-1, 1]) {
    const profile = motionPacks.shot[id], hands = motionPacks.hands.natural, seeds = heldWristSeeds("natural", hand);
    const report = { kind: "shot", package: id, hand, samples: 0, max: null, releases: {} };
    const charges = new Set([0, .64, .65, 1]);
    for (let elapsed = interval; elapsed < profile.chargeDuration; elapsed += interval) charges.add(elapsed / profile.chargeDuration);
    for (const charge of [...charges].sort((a, b) => a - b)) {
      const pose = prepareShot(charge, profile), elapsed = charge * profile.chargeDuration, gather = Math.min(1, elapsed / .16);
      rig.reset({ x: 0, y: 1.65, z: 0 }, 0, pose.jump, Math.max(.08 * (1 - gather), pose.stance));
      if (charge > 0) rotateBody("Bip01_Spine", pose.pitch, 1, 0, 0);
      const ball = new Vector3(hand * pose.x, pose.y + pose.jump, pose.z);
      if (gather < 1) {
        const seedBall = new Vector3(hand * hands.holdX, hands.holdY, hands.holdZ), blend = gather * gather * (3 - 2 * gather);
        ball.lerp(seedBall, 1 - blend);
      }
      for (const side of [-1, 1]) {
        const synthetic = { ball, guide: pose.guide, twoHands: charge === 0 ? 1 : 0, handSpread: hands.spread };
        const target = finishTarget(synthetic, side, hand, hands, .13);
        if (gather < 1) target.lerp(new Vector3().fromArray(seeds.get(side).wrist), 1 - gather);
        const pole = new Vector3(side * .36, 1.02, -.32); rig.root.localToWorld(pole);
        const value = measureHand(side, target, pole), context = { side, charge, elapsed, jump: pose.jump, guide: pose.guide };
        if (side === hand || pose.guide >= .95) {
          recordMaximum(report, value, context);
          if (charge === .64 || charge === .65) { report.releases[charge] ??= { samples: 0, max: null }; recordMaximum(report.releases[charge], value, context); }
        }
      }
    }
    report.passed = report.max.wristError <= tolerance; reports.push(report);
  }
  return reports;
}
function verifyShotRecoveries() {
  const reports = [];
  for (const clipTime of [0, .1, .4, .8]) {
    rig.setClipTime(clipTime);
    for (const id of Object.keys(motionPacks.shot)) for (const hand of [-1, 1]) for (const charge of [.10, .64, .65]) {
      const profile = motionPacks.shot[id], hands = motionPacks.hands.natural, seeds = heldWristSeeds("natural", hand);
      const released = prepareShot(charge, profile), elapsed = charge * profile.chargeDuration, gatherAtRelease = Math.min(1, elapsed / .16);
      const releaseStance = Math.max(.08 * (1 - gatherAtRelease), released.stance), body = { x: 0, y: 1.65, z: 0 };
      const releaseHand = new Vector3(hand * released.x, released.y + released.jump, released.z);
      if (gatherAtRelease < 1) releaseHand.lerp(new Vector3(hand * hands.holdX, hands.holdY, hands.holdZ), 1 - gatherAtRelease * gatherAtRelease * (3 - 2 * gatherAtRelease));
      const report = { kind: "shot-recovery", package: id, hand, charge, clipTime, samples: 0, max: null };
      for (let time = 0; time < .65 - 1e-8; time += interval) {
        const recovery = shotRecovery(Math.max(0, .65 - time), released.jump, profile, released.verticalVelocity), stance = releaseStance * recovery.reach;
        const gather = Math.min(1, (elapsed + time) / .16);
        const pitchProgress = Math.min(1, time / .16), pitchBlend = pitchProgress * pitchProgress * (3 - 2 * pitchProgress);
        rig.reset(body, 0, recovery.jump, stance); rotateBody("Bip01_Spine", released.pitch * (1 - pitchBlend) + .03 * recovery.reach * pitchBlend, 1, 0, 0);
        const base = shotFollowThroughTarget(new Vector3(), releaseHand, body, body, released.jump, recovery.jump, releaseStance, stance);
        for (const side of [-1, 1]) {
          const target = finishTarget({ ball: base, guide: recovery.guide, twoHands: 0 }, side, hand, hands, .13);
          if (side === hand) { const rest = new Vector3(side * .38, 1.11, -.23); rig.root.localToWorld(rest); target.lerp(rest, 1 - recovery.reach); }
          if (gather < 1) target.lerp(new Vector3().fromArray(seeds.get(side).wrist), 1 - gather);
          const pole = new Vector3(side * .36, 1.02, -.32); rig.root.localToWorld(pole);
          recordMaximum(report, measureHand(side, target, pole), { side, time, jump: recovery.jump, stance, follow: side === hand ? recovery.reach : recovery.guide });
        }
      }
      report.passed = report.max.wristError <= tolerance; reports.push(report);
    }
  }
  rig.setClipTime(.1);
  return reports;
}
function verifyFinishes() {
  const reports = [];
  for (const kind of ["layup", "dunk"]) for (const id of Object.keys(motionPacks[kind])) for (const handPackage of Object.keys(motionPacks.hands)) for (const hand of [-1, 1]) for (const hoop of HOOPS) {
    const front = hoop.z < 0 ? 1 : -1, direction = new Vector3(0, 0, -front), right = new Vector3(front, 0, 0), hands = motionPacks.hands[handPackage];
    const position = { x: -.3 * hand, y: 1.65, z: hoop.z + front * 2.1 };
    const ball = { x: position.x + right.x * hand * hands.holdX, y: hands.holdY, z: position.z + direction.z * -hands.holdZ };
    const motion = new FinishMotion(), start = motion.start(kind, { held: true, position, direction, speed: 5, hand, ball, packs: { ...defaultPacks, hands: handPackage, [kind]: id } });
    if (!start.allowed) throw Error("Valid reach fixture was rejected: " + start.reason);
    const report = { kind, package: id, handPackage, hand, hoopZ: hoop.z, samples: 0, max: null, phases: {} };
    let pose = motion.advance(0, true);
    while (pose) {
      rig.reset(pose.position, Math.atan2(-direction.x, -direction.z), pose.jump, pose.stance);
      rotateBody("Bip01_Spine", pose.torsoPitch, 1, 0, 0); rotateBody("Bip01_Spine1", pose.torsoTwist, 0, 1, 0);
      for (const side of [-1, 1]) {
        const target = finishTarget(pose, side, hand, hands), pole = new Vector3(side * .36, 1.02, -.32); rig.root.localToWorld(pole);
        const value = measureHand(side, target, pole), context = { phase: pose.phase, elapsed: pose.elapsed, side, guide: pose.guide, twoHands: pose.twoHands };
        // The guiding hand is required to contact only before it intentionally peels away.
        if (side === hand || pose.guide >= .95) {
          recordMaximum(report, value, context);
          report.phases[pose.phase] ??= { samples: 0, max: null }; recordMaximum(report.phases[pose.phase], value, context);
        }
      }
      if (pose.release) { report.releaseElapsed = pose.elapsed; break; }
      pose = motion.advance(interval);
    }
    report.passed = report.max.wristError <= tolerance; reports.push(report);
  }
  return reports;
}
function verifyDribbleCatches() {
  const reports = [];
  for (const id of Object.keys(motionPacks.dribble)) for (const hand of [-1, 1]) for (const speed of [0, 2.7, 6.2]) {
    const motion = new DribbleMotion(hand, id), report = { kind: "dribble", package: id, hand, speed, samples: 0, max: null };
    const period = motionPacks.dribble[id].period;
    for (let time = 0; time < period * 2; time += interval) {
      const pose = motion.advance(time === 0 ? 0 : interval, speed, id, speed === 6.2);
      if (pose.phase > .015 && pose.phase < .985) continue;
      rig.reset({ x: 0, y: 1.65, z: 0 }, 0, 0, pose.crouch ?? 0);
      rotateBody("Bip01_Spine", pose.torso, 1, 0, 0); rotateBody("Bip01_Spine1", pose.twist, 0, 1, 0);
      const palm = hand < 0 ? pose.leftPalm : pose.rightPalm, target = new Vector3(palm.x, palm.y, palm.z), pole = new Vector3(hand * .48, 1.04, -.28); rig.root.localToWorld(pole);
      recordMaximum(report, measureHand(hand, target, pole), { phase: pose.phase, crouch: pose.crouch ?? 0 });
    }
    report.passed = report.max.wristError <= tolerance; reports.push(report);
  }
  return reports;
}
function verifyDribbleGoals() {
  const reports = [], clipTimes = [0, .1, .4, .8];
  for (const clipTime of clipTimes) {
    rig.setClipTime(clipTime);
    for (const id of Object.keys(motionPacks.dribble)) for (const hand of [-1, 1]) for (const speed of [0, 2.7, 6.2]) {
      const motion = new DribbleMotion(hand, id), report = { kind: "dribble-goal", package: id, hand, speed, clipTime, samples: 0, max: null };
      const period = motionPacks.dribble[id].period;
      for (let time = 0; time < period * 2; time += interval) {
        const pose = motion.advance(time === 0 ? 0 : interval, speed, id, speed === 6.2);
        rig.reset({ x: 0, y: 1.65, z: 0 }, 0, 0, pose.crouch ?? 0);
        rotateBody("Bip01_Spine", pose.torso, 1, 0, 0); rotateBody("Bip01_Spine1", pose.twist, 0, 1, 0);
        for (const side of [-1, 1]) {
          const palm = side < 0 ? pose.leftPalm : pose.rightPalm, target = new Vector3(palm.x, palm.y, palm.z), pole = new Vector3(side * .48, 1.04, -.28); rig.root.localToWorld(pole);
          recordMaximum(report, measureHand(side, target, pole), { phase: pose.phase, side, guarding: side !== hand, ballHeight: pose.ball.y, palmHeight: palm.y, crouch: pose.crouch ?? 0 });
        }
      }
      report.passed = report.max.wristError <= tolerance; reports.push(report);
    }
  }
  rig.setClipTime(.1);
  return reports;
}
function verifyDribbleLocomotion() {
  const reports = [];
  for (const clipTime of [0, .1, .4, .8]) for (const yaw of [-.65, 0, .65]) for (const speed of [2.7, 6.2]) {
    const clipName = speed < 3.5 ? "walk" : "run"; rig.setClipTime(clipTime, clipName);
    for (const id of Object.keys(motionPacks.dribble)) for (const hand of [-1, 1]) {
      const motion = new DribbleMotion(hand, id), report = { kind: "dribble-locomotion", package: id, hand, speed, clipName, clipTime, yaw, samples: 0, max: null };
      const period = motionPacks.dribble[id].period;
      for (let time = 0; time < period * 2; time += interval) {
        const pose = motion.advance(time === 0 ? 0 : interval, speed, id, speed === 6.2);
        rig.reset({ x: 0, y: 1.65, z: 0 }, yaw, 0, pose.crouch ?? 0);
        rotateBody("Bip01_Spine", pose.torso, 1, 0, 0); rotateBody("Bip01_Spine1", pose.twist - yaw, 0, 1, 0);
        // The ball/palms use camera-facing space; the body can face lateral travel.
        for (const side of [-1, 1]) {
          const palm = side < 0 ? pose.leftPalm : pose.rightPalm, target = new Vector3(palm.x, palm.y, palm.z), pole = new Vector3(side * .48, 1.04, -.28); rig.root.localToWorld(pole);
          recordMaximum(report, measureHand(side, target, pole), { phase: pose.phase, side, guarding: side !== hand, ballHeight: pose.ball.y, palmHeight: palm.y, crouch: pose.crouch ?? 0 });
        }
      }
      report.passed = report.max.wristError <= tolerance; reports.push(report);
    }
  }
  rig.setClipTime(.1);
  return reports;
}

try {
  const finishes = verifyFinishes(), dribbleCatches = verifyDribbleCatches(), heldHands = verifyHeldHands(), shots = verifyShotProfiles(), dribbleGoals = verifyDribbleGoals(), shotRecoveries = verifyShotRecoveries(), dribbleLocomotion = verifyDribbleLocomotion();
  const failures = [...finishes, ...dribbleCatches, ...heldHands, ...shots, ...dribbleGoals, ...shotRecoveries, ...dribbleLocomotion].filter(result => !result.passed);
  const sourceHashes = Object.fromEntries([...sources].map(([filename, source]) => [path.relative(project, filename).replaceAll("\\", "/"), source.hash]));
  const sourceDrift = [...sources].filter(([filename, source]) => createHash("sha256").update(fs.readFileSync(filename)).digest("hex") !== source.hash).map(([filename]) => path.relative(project, filename));
  const report = { generatedAt: new Date().toISOString(), sourceHashes, sourceDrift, model: "/media/presence/athlete.gltf", skeletalClip: "idle", clipTime: .1, dribbleGoalClipTimes: [0, .1, .4, .8], recoveryClipTimes: [0, .1, .4, .8], locomotionClips: ["walk", "run"], locomotionYaws: [-.65, 0, .65], interval, toleranceMetres: tolerance, limitations: "Skeletal reach fixture only; does not certify rendered gameplay, foot placement, ball collisions, blended locomotion transitions, or texture/lighting quality.", passed: failures.length === 0 && sourceDrift.length === 0, finishes, dribbleCatches, heldHands, shots, dribbleGoals, shotRecoveries, dribbleLocomotion };
  fs.mkdirSync(path.dirname(reportPath), { recursive: true }); fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
  console.log(`Court reach: ${finishes.length} finish paths, ${dribbleCatches.length} dribble catch paths, ${heldHands.length} held-hand paths, ${shots.length} shot paths, ${dribbleGoals.length} all-phase dribble paths, ${shotRecoveries.length} shot recovery paths, ${dribbleLocomotion.length} walk/run paths; ${failures.length} failed. Report: ${path.relative(project, reportPath)}`);
  for (const result of failures) console.log(JSON.stringify({ kind: result.kind, package: result.package, handPackage: result.handPackage, hand: result.hand, hoopZ: result.hoopZ, speed: result.speed, clipName: result.clipName, clipTime: result.clipTime, yaw: result.yaw, phase: result.max.phase, charge: result.max.charge ?? result.charge, side: result.max.side, elapsed: result.max.elapsed ?? result.max.time, wristErrorMetres: result.max.wristError, targetDistanceMetres: result.max.targetDistance, reachMetres: result.max.reach }));
  if (sourceDrift.length) console.error("Source changed during the fixture; rerun: " + sourceDrift.join(", "));
  if (!report.passed) process.exitCode = 1;
} finally { rig.dispose(); }
