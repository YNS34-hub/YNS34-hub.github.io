import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Group, Mesh, MeshBasicMaterial, Vector3 } from "three";
import { usePalaceStore } from "../systems/store";
import { useInteractable } from "../interaction/useInteractable";
import { acknowledge } from "../interaction/registry";
import { ContactShadow } from "../world/primitives";
import { BallPhysics, BALL_RADIUS, shotVelocity } from "./basketballPhysics";
import CourtArchitecture, { courtResponse } from "./CourtArchitecture";
import { useWorldTexture } from "./materials";
import { useSceneAudio } from "./sceneAudio";
import { useActivity, type CourtCommand } from "./activity";
import { WorldPortal } from "./WorldPortal";
import { useQuietMotion } from "../motion/useMotionCue";
import { dribblePresentation, impactStrength } from "../motion/choreography";
import { preloadCourtAssets } from "./court/assets";
import { FinishMotion, finishEligibility, type FinishKind } from "./court/finishing";
import { actorCamera, presence } from "./presence/state";
import SportAvatar from "./presence/Avatar";
import { isPrimaryShotKey, primaryCourtAction } from "./court/controls";
import { prepareShot, shotRecovery } from "./presence/shotPose";
import { DribbleMotion } from "./presence/dribbleMotion";
import {motionPacks,type MotionPackSelection} from "./court/motionPacks";
import {useCourtPackages} from "./court/packagePreferences";
export { preloadCourtAssets } from "./court/assets";

function PracticeBall() {
  const { camera: renderCamera, gl } = useThree(), camera = actorCamera(renderCamera, "basketball"), ball = useRef<Group>(null), shadow = useRef<Group>(null);
  const simulation = useMemo(() => new BallPhysics(), []);
  const finish = useMemo(() => new FinishMotion(), []);
  const sound = useSceneAudio("court");
  const quiet = useQuietMotion();
  const scratch = useRef({ aim: new Vector3(), hand: new Vector3(), forward: new Vector3(), up: new Vector3(0, 1, 0) });
  const state = useRef({ releasePending:false,release:null as (()=>void)|null, charging: false, charge: 0, dribble: false, dribbleTime: 0, dribblePeriod: .65, handSide:presence.hand, dribbleMotion:new DribbleMotion(useCourtPackages.getState().preferredHand,useCourtPackages.getState().packs.dribble),dribbleStop:false,dribbleElapsed:0,holdElapsed:.22,holdPack:useCourtPackages.getState().packs.hands,holdHand:presence.hand,holdSeed:new Vector3(),holdStart:new Vector3(),shotPack:useCourtPackages.getState().packs.shot as MotionPackSelection["shot"],shotSeed:new Vector3(),shotStart:new Vector3(),finishElapsed:0,finishJump:0,publish: 0, contact: 0, pickup: 0 });
  const texture = useWorldTexture("ball");
  const publish = () => {
    camera.getWorldDirection(scratch.current.aim);
    const input = { held: simulation.mode === "held", position:camera.position, direction:scratch.current.aim, speed:presence.speed, hand:presence.hand };
    const primaryAction = primaryCourtAction(input,presence.turboHeld);
    useActivity.setState({ ...simulation.stats, mode: simulation.mode, dribbling: state.current.dribble, charge: state.current.charge, finishing: presence.finish, sprinting: presence.sprinting, primaryAction, finishReady: primaryAction !== "shoot" && !presence.finishLocked && finishEligibility(primaryAction,input).allowed });
  };
  const enabled = () => {
    const s = usePalaceStore.getState();
    return s.started && !s.overlay && !s.focus && !s.pendingDoor && s.mode !== "index" && !document.hidden && !useActivity.getState().warming;
  };
  const distance = () => Math.hypot(camera.position.x - simulation.position.x, camera.position.z - simulation.position.z);
  const pickup = () => {
    if (presence.finishLocked || state.current.charging) return;
    sound.unlock();
    if (simulation.mode !== "held" && distance() < 3.3) {
      simulation.pickup(); state.current.dribble = false; state.current.pickup = .24; publish(); acknowledge("Ball in hand · hold 5, release to shoot · near rim: 5 layup, Enter + 5 dunk");
    } else if (simulation.mode === "held") { if(state.current.dribble){state.current.dribbleStop=true;}else{state.current.dribble=true;state.current.dribbleStop=false;state.current.dribbleElapsed=0;presence.dribbleStanceSeed=presence.courtStance;presence.dribbleBlend=0;presence.dribbleOrigin.copy(camera.position);presence.dribbleLeftSeed.copy(presence.leftWrist);presence.dribbleRightSeed.copy(presence.rightWrist);state.current.dribbleTime=0;state.current.handSide=presence.hand;state.current.dribbleMotion=new DribbleMotion(presence.hand,useCourtPackages.getState().packs.dribble);scratch.current.hand.set(simulation.position.x,simulation.position.y,simulation.position.z).sub(camera.position);scratch.current.hand.y+=1.65;camera.getWorldDirection(scratch.current.forward);scratch.current.hand.applyAxisAngle(scratch.current.up,-Math.atan2(-scratch.current.forward.x,-scratch.current.forward.z));state.current.dribbleMotion.seedPosition(scratch.current.hand,presence.courtStance);} publish(); }
  };
  useInteractable(ball, { title: "THE PRACTICE BALL", hint: "Pick up / dribble", radius: 5, activate: pickup });
  useEffect(() => {
    presence.hand=useCourtPackages.getState().preferredHand;
    useActivity.setState({ ...simulation.stats, mode: "ground", result: "", charge: 0, dribbling: false, finishing: "idle", sprinting: false, primaryAction:"shoot", finishReady:false });
    const attemptFinish = (kind: FinishKind) => {
      if (presence.finishLocked) return;
      camera.getWorldDirection(scratch.current.aim);
      const result = finish.start(kind, { packs:{...useCourtPackages.getState().packs},stance:presence.courtStance,position: camera.position, direction: scratch.current.aim, held: simulation.mode === "held", speed: presence.speed, hand: presence.hand, ball: simulation.position, feet:presence.leftFoot.y>0?{left:presence.leftFoot,right:presence.rightFoot}:undefined });
      if (!result.allowed) { useActivity.setState({ result: result.reason }); acknowledge(result.reason); return; }
      presence.finishLeftSeed.copy(presence.leftWrist);presence.finishRightSeed.copy(presence.rightWrist);presence.finishOrigin.copy(camera.position);
      sound.unlock(); state.current.releasePending=false;state.current.charging = false; state.current.charge = 0; state.current.dribble = false; state.current.dribbleStop = false;
      state.current.finishElapsed=0;state.current.finishJump=0;
      presence.finishLocked = true; presence.finish = kind; useActivity.setState({ result: kind === "dunk" ? "ATTACK THE RIM" : "LAYUP · SOFT TOUCH" }); publish();
    };
    const release = () => {
      if (!state.current.charging || simulation.mode !== "held" || presence.finishLocked) return;
      if(state.current.charge<.46||presence.shotGather<1){state.current.releasePending=true;return;}
      state.current.releasePending=false;state.current.charging = false;
      camera.getWorldDirection(scratch.current.aim);
      const from = { x: simulation.position.x, y: simulation.position.y, z: simulation.position.z };
      presence.releaseHand.set(simulation.position.x, simulation.position.y, simulation.position.z);presence.releaseBody.copy(camera.position);presence.shotReleasePitch=prepareShot(state.current.charge,motionPacks.shot[state.current.shotPack]).pitch;presence.shotReleaseStance=Math.max(presence.shotStance*(1-presence.shotGather),prepareShot(state.current.charge,motionPacks.shot[state.current.shotPack]).stance);presence.shot=.65;
      presence.shotJump = presence.jump;presence.shotPack=state.current.shotPack;presence.shotVerticalVelocity=prepareShot(state.current.charge,motionPacks.shot[state.current.shotPack]).verticalVelocity;
      simulation.launch(from, shotVelocity(from, scratch.current.aim, state.current.charge, useActivity.getState().assist));
      const quality = Math.abs(state.current.charge - .64);
      useActivity.setState({ result: quality < .065 ? "CLEAN RELEASE" : state.current.charge < .64 ? "EARLY RELEASE" : "LATE RELEASE" });
      state.current.charge = 0; state.current.dribble = false; publish();
    };
    state.current.release=release;
    const command = (event: Event) => {
      if (!enabled()) return;
      const action = (event as CustomEvent<CourtCommand>).detail; sound.unlock();
      if (action === "pickup" || action === "dribble") pickup();
      if (action === "layup" || action === "dunk") attemptFinish(action);
      if (action === "charge" && simulation.mode === "held" && !presence.finishLocked && !state.current.charging) { state.current.shotPack=useCourtPackages.getState().packs.shot;presence.shotPack=state.current.shotPack;state.current.shotSeed.copy(presence.ball);state.current.shotStart.copy(camera.position);presence.shotStance=presence.courtStance;presence.shotGather=0;presence.shotLeftSeed.copy(presence.leftWrist);presence.shotRightSeed.copy(presence.rightWrist);presence.shotOrigin.copy(camera.position);state.current.releasePending=false;state.current.charging = true; state.current.charge = 0; state.current.dribble = false; state.current.dribbleStop = false; }
      if (action === "release") release();
      if (action === "cancel") { state.current.releasePending=false;state.current.charging = false; state.current.charge = 0; publish(); }
      if (action === "recall") {
        finish.cancel(); presence.finishLocked = false; presence.finish = "idle"; presence.finishPose = null; presence.shot = 0; presence.jump = 0;
        camera.getWorldDirection(scratch.current.forward); scratch.current.forward.y = 0; scratch.current.forward.normalize();
        simulation.recall({ x: camera.position.x + scratch.current.forward.x * 1.3, y: BALL_RADIUS, z: camera.position.z + scratch.current.forward.z * 1.3 });
        state.current.releasePending=false;state.current.charging = false; state.current.charge = 0; state.current.dribble = false; state.current.dribbleStop = false;
        publish(); acknowledge("Ball returned · score kept");
      }
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.repeat || event.defaultPrevented || !enabled() || (event.target instanceof HTMLElement && event.target.closest('input,textarea,select,[contenteditable="true"]'))) return;
      if (event.code === "KeyE") { event.preventDefault(); pickup(); }
      if (event.code === "KeyR") { event.preventDefault(); command(new CustomEvent("palace:court", { detail: "recall" })); }
      if (event.code === "KeyX" && simulation.mode === "held" && state.current.dribble && !presence.finishLocked) { event.preventDefault(); useCourtPackages.getState().setHand(useCourtPackages.getState().preferredHand===1?-1:1); acknowledge(useCourtPackages.getState().preferredHand>0?"Right hand · catch to switch":"Left hand · catch to switch"); }
      if (isPrimaryShotKey(event.code)) {
        if (!document.pointerLockElement && event.target instanceof HTMLElement && event.target.closest("button,a")) return;
        event.preventDefault(); camera.getWorldDirection(scratch.current.aim);
        const action = primaryCourtAction({ held: simulation.mode === "held", position: camera.position, direction: scratch.current.aim, speed: presence.speed, hand: presence.hand }, presence.turboHeld);
        if (action === "shoot") command(new CustomEvent("palace:court", { detail: "charge" })); else attemptFinish(action);
      }
    };
    const keyup = (event: KeyboardEvent) => { if (isPrimaryShotKey(event.code)) { if (enabled()) release(); else state.current.charging = false; } };
    const pointerDown = (event: PointerEvent) => { if (event.button === 0 && document.pointerLockElement === gl.domElement) command(new CustomEvent("palace:court", { detail: "charge" })); };
    const pointerUp = () => { if (enabled()) release(); else state.current.charging = false; };
    const pause = () => { state.current.releasePending=false;state.current.charging = false; state.current.charge = 0; publish(); };
    const unsubscribe = usePalaceStore.subscribe((s, p) => { if (s.overlay !== p.overlay || s.focus !== p.focus || s.pointerLocked !== p.pointerLocked) pause(); });
    const step = () => sound.sound("step");
    window.addEventListener("palace:court", command); document.addEventListener("keydown", keyboard); document.addEventListener("keyup", keyup);
    gl.domElement.addEventListener("pointerdown", pointerDown); window.addEventListener("pointerup", pointerUp); window.addEventListener("blur", pause);
    window.addEventListener("palace:footstep", step);
    return () => {
      finish.cancel(); presence.finishLocked = false; presence.finish = "idle"; presence.finishPose = null; presence.jump = 0; presence.held = false; presence.shot = 0;
      state.current.release=null;state.current.releasePending=false;unsubscribe(); sound.dispose();
      window.removeEventListener("palace:court", command); document.removeEventListener("keydown", keyboard); document.removeEventListener("keyup", keyup);
      gl.domElement.removeEventListener("pointerdown", pointerDown); window.removeEventListener("pointerup", pointerUp); window.removeEventListener("blur", pause); window.removeEventListener("palace:footstep", step);
    };
    // 输入只安装一次；当前相机、控制门控、分析器和辅助设置都从现有实例读取。
  }, [camera, gl, simulation, sound, finish]);
  useFrame((_, rawDelta) => {
    if (!ball.current || !enabled()) return;
    const dt = Math.min(rawDelta, .06), local = state.current,packs=useCourtPackages.getState().packs;
    if(!local.dribble&&!presence.finishLocked&&!local.charging&&presence.shot===0)presence.hand=useCourtPackages.getState().preferredHand;
    const movement = finish.advance(dt, false);
    if (movement) {
      // 真正落脚 / 落地时补足既有程序音效，暂停不会重复发声，也不加入版权音频。
      if(local.finishElapsed<.27&&movement.elapsed>=.27)sound.sound("step",.68);
      if(local.finishElapsed<.40&&movement.elapsed>=.40)sound.sound("step",.85);
      if(movement.elapsed>.9&&local.finishJump>0&&movement.jump<=0)sound.sound("step",1);
      local.finishElapsed=movement.elapsed;local.finishJump=movement.jump;
      presence.finishPose = movement;
      camera.position.set(movement.position.x, movement.position.y, movement.position.z); presence.jump = movement.jump;
      if (simulation.mode === "held") Object.assign(simulation.position, movement.ball);
      if (movement.release) { simulation.launch(movement.release.origin, movement.release.velocity); presence.shot = .65; }
      presence.finish = movement.kind;
    } else if (presence.finishLocked) { presence.finishLocked = false; presence.finish = "idle"; presence.finishPose = null; presence.jump = 0; }
    presence.shot = Math.max(0, presence.shot - dt);
    if (local.charging) local.charge = Math.min(1, local.charge + dt / motionPacks.shot[local.shotPack].chargeDuration);
    if(local.charging||presence.shot>0)presence.shotGather=Math.min(1,presence.shotGather+dt/.16);
    if (!movement) presence.jump = local.charging ? prepareShot(local.charge,motionPacks.shot[local.shotPack]).jump : presence.shot > 0 ? shotRecovery(presence.shot,presence.shotJump,motionPacks.shot[presence.shotPack],presence.shotVerticalVelocity).jump : 0;
    const sprintDribble = presence.sprinting && presence.speed > 3.4 && simulation.mode === "held" && !presence.finishLocked && !local.charging;
    if(sprintDribble&&!local.dribble&&!local.dribbleStop){local.dribble=true;local.dribbleElapsed=0;presence.dribbleStanceSeed=presence.courtStance;presence.dribbleBlend=0;presence.dribbleOrigin.copy(camera.position);presence.dribbleLeftSeed.copy(presence.leftWrist);presence.dribbleRightSeed.copy(presence.rightWrist);local.dribbleMotion=new DribbleMotion(presence.hand,packs.dribble);scratch.current.hand.set(simulation.position.x,simulation.position.y,simulation.position.z).sub(camera.position);scratch.current.hand.y+=1.65;camera.getWorldDirection(scratch.current.forward);scratch.current.hand.applyAxisAngle(scratch.current.up,-Math.atan2(-scratch.current.forward.x,-scratch.current.forward.z));local.dribbleMotion.seedPosition(scratch.current.hand,presence.courtStance);}
    const dribblePeriod = sprintDribble ? motionPacks.dribble[packs.dribble].sprintPeriod : motionPacks.dribble[packs.dribble].period;
    if(local.dribblePeriod!==dribblePeriod){local.dribbleTime=local.dribbleTime/local.dribblePeriod*dribblePeriod;local.dribblePeriod=dribblePeriod;}
    if (simulation.mode === "held" && !movement) {
      if(!local.dribble&&!local.charging&&(local.holdPack!==packs.hands||local.holdHand!==presence.hand)){local.holdElapsed=0;local.holdSeed.copy(presence.ball);local.holdStart.copy(camera.position);local.holdPack=packs.hands;local.holdHand=presence.hand;presence.holdLeftSeed.copy(presence.leftWrist);presence.holdRightSeed.copy(presence.rightWrist);presence.holdOrigin.copy(camera.position);}
      const prep = prepareShot(local.charging ? local.charge : 0,motionPacks.shot[local.shotPack]),hold=motionPacks.hands[packs.hands];
      const hand = scratch.current.hand.set((local.charging ? prep.x : hold.holdX)*presence.hand, (local.charging ? prep.y : hold.holdY) - 1.65 + presence.jump, local.charging ? prep.z : hold.holdZ);
      camera.getWorldDirection(scratch.current.forward); const yaw = Math.atan2(-scratch.current.forward.x, -scratch.current.forward.z);
      hand.applyAxisAngle(scratch.current.up, yaw).add(camera.position);
      if(local.charging&&local.charge*motionPacks.shot[local.shotPack].chargeDuration<.16){const t=local.charge*motionPacks.shot[local.shotPack].chargeDuration/.16,s=t*t*(3-2*t);scratch.current.aim.copy(local.shotSeed).add(camera.position).sub(local.shotStart);hand.lerp(scratch.current.aim,1-s);}
      if (local.dribble) {
        local.dribbleElapsed+=dt;presence.dribbleBlend=Math.min(1,local.dribbleElapsed/.18);
        const before=presence.dribblePhase;local.dribbleMotion.requestHand(useCourtPackages.getState().preferredHand);
        const pose=local.dribbleMotion.advance(dt,presence.speed,packs.dribble,sprintDribble),t=pose.phase;
        presence.hand=pose.hand;local.dribbleTime=t*dribblePeriod;
        if(before<.44&&t>=.44)sound.sound("bounce");
        hand.set(pose.ball.x,pose.ball.y-1.65,pose.ball.z).applyAxisAngle(scratch.current.up,yaw).add(camera.position);
        presence.dribbleLeftPalm.set(pose.leftPalm.x,pose.leftPalm.y-1.65,pose.leftPalm.z).applyAxisAngle(scratch.current.up,yaw).add(camera.position);
        presence.dribbleRightPalm.set(pose.rightPalm.x,pose.rightPalm.y-1.65,pose.rightPalm.z).applyAxisAngle(scratch.current.up,yaw).add(camera.position);
        presence.dribblePalm.copy(presence.hand<0?presence.dribbleLeftPalm:presence.dribbleRightPalm);
        presence.dribblePhase=t;presence.crossover=pose.crossover;presence.dribbleTorso=pose.torso;presence.dribbleTwist=pose.twist;presence.dribbleCrouch=pose.crouch;
        if(local.dribbleStop&&t<before){local.dribble=false;local.dribbleStop=false;local.holdElapsed=0;local.holdSeed.copy(hand);local.holdStart.copy(camera.position);local.holdPack=packs.hands;local.holdHand=presence.hand;presence.holdLeftSeed.copy(presence.leftWrist);presence.holdRightSeed.copy(presence.rightWrist);presence.holdOrigin.copy(camera.position);}
      }
      if(!local.dribble&&!local.charging){local.holdElapsed=Math.min(.22,local.holdElapsed+dt);const h=local.holdElapsed/.22,s=h*h*(3-2*h);presence.holdBlend=s;if(s<1){scratch.current.aim.copy(local.holdSeed).add(camera.position).sub(local.holdStart);hand.lerp(scratch.current.aim,1-s);}}else presence.holdBlend=1;
      Object.assign(simulation.position, { x: hand.x, y: hand.y, z: hand.z });
    } else if (simulation.mode !== "held") {
      const impact = impactStrength(Math.hypot(simulation.velocity.x, simulation.velocity.y, simulation.velocity.z));
      for (const event of simulation.step(dt)) {
        if (event !== "missed") sound.sound(event, event === "made" ? 1 : .18 + impact * .82);
        if (event === "bounce") local.contact = impact;
        if (event === "rim" || event === "made" || event === "backboard") {
          courtResponse.hoop = simulation.position.z < 0 ? -1 : 1;
          if (event === "rim") courtResponse.rim = impact; else if (event === "backboard") courtResponse.board = impact; else courtResponse.net = 1;
        }
        if (event === "made" || event === "missed") {
          useActivity.setState({ ...simulation.stats, result: event === "made" ? "MADE · " + simulation.stats.streak + " IN A ROW" : "MISSED · TRY AGAIN" });
          acknowledge(event === "made" ? "Through the net" : "Ball is live · E to pick up, R to recall");
        }
      }
    }
    const p = simulation.position;
    presence.ball.set(p.x, p.y, p.z); presence.held = simulation.mode === "held"; presence.dribbling = local.dribble; presence.charge = local.charge;
    if(local.releasePending&&local.charging&&local.charge>=.46&&presence.shotGather===1){local.release?.();presence.held=simulation.mode==="held";presence.charge=local.charge;}
    // 物理坐标始终权威；拾起的短暂跟随与接触压缩只作用于可见球壳。
    if (simulation.mode === "held" && local.pickup > 0 && !quiet && !movement) {
      ball.current.position.lerp(scratch.current.hand, 1 - Math.exp(-dt * 22));
      local.pickup = Math.max(0, local.pickup - dt);
    } else { ball.current.position.set(p.x, p.y, p.z); local.pickup = 0; }
    const shell = ball.current.children[0] as Mesh;
    const shape = local.dribble ? dribblePresentation(local.dribbleTime / dribblePeriod-.44, quiet) : { y: 1 - (quiet ? 0 : local.contact * .035), xz: 1 + (quiet ? 0 : local.contact * .0175) };
    shell.scale.set(shape.xz, shape.y, shape.xz);
    local.contact *= Math.exp(-dt * 28);
    if (local.contact < .001) local.contact = 0;
    if (simulation.mode === "flight") {
      shell.rotation.x += dt * simulation.velocity.z * 1.8;
      shell.rotation.z -= dt * simulation.velocity.x * 1.8;
    }
    if (shadow.current) {
      shadow.current.position.set(p.x, 0, p.z);
      const mesh = shadow.current.children[0] as Mesh;
      (mesh.material as MeshBasicMaterial).opacity = Math.max(.03, .32 - p.y * .055);
      shadow.current.scale.setScalar(1 + p.y * .05);
    }
    sound.update(); local.publish += dt;
    if (local.publish >= .12) { local.publish = 0; publish(); }
  }, -3);
  return <>
    <group ref={ball} name="practice-ball" position={[1.5, BALL_RADIUS, 6]} onClick={event => { if (event.delta < 5) { event.stopPropagation(); if (!document.pointerLockElement) pickup(); } }}>
      <mesh castShadow><sphereGeometry args={[BALL_RADIUS, 32, 24]} /><meshStandardMaterial map={texture} roughness={.83} bumpMap={texture} bumpScale={.0025} /></mesh>
    </group>
    <group ref={shadow}><ContactShadow width={.58} depth={.58} opacity={.28} /></group>
  </>;
}
export default function BasketballCourt() {
  const [prepared, setPrepared] = useState(false);
  useEffect(() => { preloadCourtAssets(); setPrepared(true); }, []);
  if (!prepared) return null;
  return <group name="basketball-practice-world">
    <CourtArchitecture /><PracticeBall /><SportAvatar roomId="basketball" />
    <WorldPortal id="worlds" title="Back to the palace" position={[0, 2.4, 17.2]} rotation={[0, Math.PI, 0]} compact />
  </group>;
}
