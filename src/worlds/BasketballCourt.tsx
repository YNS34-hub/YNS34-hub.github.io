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
import { FinishMotion, type FinishKind } from "./court/finishing";
import { actorCamera, presence, usePerspective } from "./presence/state";
import SportAvatar from "./presence/Avatar";
export { preloadCourtAssets } from "./court/assets";

function PracticeBall() {
  const { camera: renderCamera, gl } = useThree(), camera = actorCamera(renderCamera, "basketball"), ball = useRef<Group>(null), shadow = useRef<Group>(null);
  const simulation = useMemo(() => new BallPhysics(), []);
  const finish = useMemo(() => new FinishMotion(), []);
  const sound = useSceneAudio("court");
  const quiet = useQuietMotion();
  const scratch = useRef({ aim: new Vector3(), hand: new Vector3(), forward: new Vector3(), up: new Vector3(0, 1, 0) });
  const state = useRef({ charging: false, charge: 0, dribble: false, dribbleTime: 0, dribblePeriod: .65, publish: 0, contact: 0, pickup: 0 });
  const texture = useWorldTexture("ball");
  const publish = () => useActivity.setState({ ...simulation.stats, mode: simulation.mode, dribbling: state.current.dribble, charge: state.current.charge, finishing: presence.finish, sprinting: presence.sprinting });
  const enabled = () => {
    const s = usePalaceStore.getState();
    return s.started && !s.overlay && !s.focus && !s.pendingDoor && s.mode !== "index" && !document.hidden && !useActivity.getState().warming;
  };
  const distance = () => Math.hypot(camera.position.x - simulation.position.x, camera.position.z - simulation.position.z);
  const pickup = () => {
    if (presence.finishLocked) return;
    sound.unlock();
    if (simulation.mode !== "held" && distance() < 3.3) {
      simulation.pickup(); state.current.dribble = false; state.current.pickup = .24; publish(); acknowledge("Ball in hand · hold Space, release to shoot");
    } else if (simulation.mode === "held") { state.current.dribble = !state.current.dribble; publish(); }
  };
  useInteractable(ball, { title: "THE PRACTICE BALL", hint: "Pick up / dribble", radius: 5, activate: pickup });
  useEffect(() => {
    useActivity.setState({ ...simulation.stats, mode: "ground", result: "", charge: 0, dribbling: false, finishing: "idle", sprinting: false });
    const attemptFinish = (kind: FinishKind) => {
      if (presence.finishLocked) return;
      camera.getWorldDirection(scratch.current.aim);
      const result = finish.start(kind, { position: camera.position, direction: scratch.current.aim, held: simulation.mode === "held", speed: presence.speed, hand: presence.hand });
      if (!result.allowed) { useActivity.setState({ result: result.reason }); acknowledge(result.reason); return; }
      sound.unlock(); state.current.charging = false; state.current.charge = 0; state.current.dribble = false;
      presence.finishLocked = true; presence.finish = kind; useActivity.setState({ result: kind === "dunk" ? "ATTACK THE RIM" : "LAYUP · SOFT TOUCH" }); publish();
    };
    const release = () => {
      if (!state.current.charging || simulation.mode !== "held" || presence.finishLocked) return;
      state.current.charging = false;
      camera.getWorldDirection(scratch.current.aim);
      const from = { x: simulation.position.x, y: usePerspective.getState().views.basketball === "third" ? Math.max(1.4, simulation.position.y) : Math.max(1.4, camera.position.y - .15), z: simulation.position.z };
      presence.releaseHand.set(simulation.position.x, simulation.position.y, simulation.position.z);presence.shot=.65;
      simulation.launch(from, shotVelocity(from, scratch.current.aim, state.current.charge, useActivity.getState().assist));
      const quality = Math.abs(state.current.charge - .64);
      useActivity.setState({ result: quality < .065 ? "CLEAN RELEASE" : state.current.charge < .64 ? "EARLY RELEASE" : "LATE RELEASE" });
      state.current.charge = 0; state.current.dribble = false; publish();
    };
    const command = (event: Event) => {
      if (!enabled()) return;
      const action = (event as CustomEvent<CourtCommand>).detail; sound.unlock();
      if (action === "pickup" || action === "dribble") pickup();
      if (action === "layup" || action === "dunk") attemptFinish(action);
      if (action === "charge" && simulation.mode === "held" && !presence.finishLocked) { state.current.charging = true; state.current.charge = 0; }
      if (action === "release") release();
      if (action === "cancel") { state.current.charging = false; state.current.charge = 0; publish(); }
      if (action === "recall") {
        finish.cancel(); presence.finishLocked = false; presence.finish = "idle"; presence.jump = 0;
        camera.getWorldDirection(scratch.current.forward); scratch.current.forward.y = 0; scratch.current.forward.normalize();
        simulation.recall({ x: camera.position.x + scratch.current.forward.x * 1.3, y: BALL_RADIUS, z: camera.position.z + scratch.current.forward.z * 1.3 });
        state.current.charging = false; state.current.charge = 0; state.current.dribble = false;
        publish(); acknowledge("Ball returned · score kept");
      }
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.repeat || event.defaultPrevented || !enabled() || (event.target instanceof HTMLElement && event.target.closest('input,textarea,select,[contenteditable="true"]'))) return;
      if (event.code === "KeyE") { event.preventDefault(); pickup(); }
      if (event.code === "KeyR") { event.preventDefault(); command(new CustomEvent("palace:court", { detail: "recall" })); }
      if (event.code === "KeyF" || event.code === "KeyG") { event.preventDefault(); attemptFinish(event.code === "KeyF" ? "layup" : "dunk"); }
      if (event.code === "Space") {
        if (!document.pointerLockElement && event.target instanceof HTMLElement && event.target.closest("button,a")) return;
        event.preventDefault(); command(new CustomEvent("palace:court", { detail: "charge" }));
      }
    };
    const keyup = (event: KeyboardEvent) => { if (event.code === "Space") { if (enabled()) release(); else state.current.charging = false; } };
    const pointerDown = (event: PointerEvent) => { if (event.button === 0 && document.pointerLockElement === gl.domElement) command(new CustomEvent("palace:court", { detail: "charge" })); };
    const pointerUp = () => { if (enabled()) release(); else state.current.charging = false; };
    const pause = () => { state.current.charging = false; state.current.charge = 0; publish(); };
    const unsubscribe = usePalaceStore.subscribe((s, p) => { if (s.overlay !== p.overlay || s.focus !== p.focus || s.pointerLocked !== p.pointerLocked) pause(); });
    const step = () => sound.sound("step");
    window.addEventListener("palace:court", command); document.addEventListener("keydown", keyboard); document.addEventListener("keyup", keyup);
    gl.domElement.addEventListener("pointerdown", pointerDown); window.addEventListener("pointerup", pointerUp); window.addEventListener("blur", pause);
    window.addEventListener("palace:footstep", step);
    return () => {
      finish.cancel(); presence.finishLocked = false; presence.finish = "idle"; presence.jump = 0; presence.held = false;
      unsubscribe(); sound.dispose();
      window.removeEventListener("palace:court", command); document.removeEventListener("keydown", keyboard); document.removeEventListener("keyup", keyup);
      gl.domElement.removeEventListener("pointerdown", pointerDown); window.removeEventListener("pointerup", pointerUp); window.removeEventListener("blur", pause); window.removeEventListener("palace:footstep", step);
    };
    // 输入只安装一次；当前相机、控制门控、分析器和辅助设置都从现有实例读取。
  }, [camera, gl, simulation, sound, finish]);
  useFrame((_, rawDelta) => {
    if (!ball.current || !enabled()) return;
    const dt = Math.min(rawDelta, .06), local = state.current;
    const movement = finish.advance(dt, false);
    if (movement) {
      camera.position.set(movement.position.x, movement.position.y, movement.position.z); presence.jump = movement.jump;
      if (simulation.mode === "held") Object.assign(simulation.position, movement.ball);
      if (movement.release) { simulation.launch(movement.release.origin, movement.release.velocity); presence.shot = .65; }
      presence.finish = movement.kind;
    } else if (presence.finishLocked) { presence.finishLocked = false; presence.finish = "idle"; presence.jump = 0; }
    presence.shot = Math.max(0, presence.shot - dt);
    if (local.charging) local.charge = Math.min(1, local.charge + dt / 1.4);
    const sprintDribble = presence.sprinting && presence.speed > 3.4 && simulation.mode === "held" && !presence.finishLocked;
    if (sprintDribble) local.dribble = true;
    const dribblePeriod = sprintDribble ? .43 : .65;
    if(local.dribblePeriod!==dribblePeriod){local.dribbleTime=local.dribbleTime/local.dribblePeriod*dribblePeriod;local.dribblePeriod=dribblePeriod;}
    if (simulation.mode === "held" && !movement) {
      const third = usePerspective.getState().views.basketball === "third";
      const hand = scratch.current.hand.set(third ? .31 : .38, third ? -.59+local.charge*.80 : -.56, third ? -.4-local.charge*.18 : -.87);
      if (third) {
        camera.getWorldDirection(scratch.current.forward); const yaw = Math.atan2(-scratch.current.forward.x, -scratch.current.forward.z);
        hand.applyAxisAngle(scratch.current.up, yaw).add(camera.position);
      } else hand.applyQuaternion(camera.quaternion).add(camera.position);
      if (local.dribble) {
        const old = local.dribbleTime; local.dribbleTime = (old + dt) % dribblePeriod;
        if (local.dribbleTime < old) sound.sound("bounce");
        const t = local.dribbleTime / dribblePeriod; hand.y = BALL_RADIUS + 4 * (sprintDribble ? 1.04 : 1.25) * t * (1 - t);
      }
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
    // 物理坐标始终权威；拾起的短暂跟随与接触压缩只作用于可见球壳。
    if (simulation.mode === "held" && local.pickup > 0 && !quiet && !movement) {
      ball.current.position.lerp(scratch.current.hand, 1 - Math.exp(-dt * 22));
      local.pickup = Math.max(0, local.pickup - dt);
    } else { ball.current.position.set(p.x, p.y, p.z); local.pickup = 0; }
    const shell = ball.current.children[0] as Mesh;
    const shape = local.dribble ? dribblePresentation(local.dribbleTime / dribblePeriod, quiet) : { y: 1 - (quiet ? 0 : local.contact * .035), xz: 1 + (quiet ? 0 : local.contact * .0175) };
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
