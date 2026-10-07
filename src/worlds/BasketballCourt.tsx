import { useEffect, useMemo, useRef } from "react";
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

function PracticeBall() {
  const { camera, gl } = useThree(), ball = useRef<Group>(null), shadow = useRef<Group>(null);
  const simulation = useMemo(() => new BallPhysics(), []);
  const sound = useSceneAudio("court");
  const scratch = useRef({ aim: new Vector3(), hand: new Vector3(), forward: new Vector3() });
  const state = useRef({ charging: false, charge: 0, dribble: false, dribbleTime: 0, publish: 0 });
  const texture = useWorldTexture("ball");
  const publish = () => useActivity.setState({ ...simulation.stats, mode: simulation.mode, dribbling: state.current.dribble, charge: state.current.charge });
  const enabled = () => {
    const s = usePalaceStore.getState();
    return s.started && !s.overlay && !s.focus && s.mode !== "index" && !document.hidden;
  };
  const distance = () => Math.hypot(camera.position.x - simulation.position.x, camera.position.z - simulation.position.z);
  const pickup = () => {
    sound.unlock();
    if (simulation.mode !== "held" && distance() < 3.3) {
      simulation.pickup(); state.current.dribble = false; publish(); acknowledge("Ball in hand · hold Space, release to shoot");
    } else if (simulation.mode === "held") { state.current.dribble = !state.current.dribble; publish(); }
  };
  useInteractable(ball, { title: "THE PRACTICE BALL", hint: "Pick up / dribble", radius: 5, activate: pickup });
  useEffect(() => {
    useActivity.setState({ ...simulation.stats, mode: "ground", result: "", charge: 0, dribbling: false });
    const release = () => {
      if (!state.current.charging || simulation.mode !== "held") return;
      state.current.charging = false;
      camera.getWorldDirection(scratch.current.aim);
      const from = { x: simulation.position.x, y: Math.max(1.4, camera.position.y - .15), z: simulation.position.z };
      simulation.launch(from, shotVelocity(from, scratch.current.aim, state.current.charge, useActivity.getState().assist));
      const quality = Math.abs(state.current.charge - .64);
      useActivity.setState({ result: quality < .065 ? "CLEAN RELEASE" : state.current.charge < .64 ? "EARLY RELEASE" : "LATE RELEASE" });
      state.current.charge = 0; state.current.dribble = false; publish();
    };
    const command = (event: Event) => {
      if (!enabled()) return;
      const action = (event as CustomEvent<CourtCommand>).detail; sound.unlock();
      if (action === "pickup" || action === "dribble") pickup();
      if (action === "charge" && simulation.mode === "held") { state.current.charging = true; state.current.charge = 0; }
      if (action === "release") release();
      if (action === "recall") {
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
      unsubscribe(); sound.dispose();
      window.removeEventListener("palace:court", command); document.removeEventListener("keydown", keyboard); document.removeEventListener("keyup", keyup);
      gl.domElement.removeEventListener("pointerdown", pointerDown); window.removeEventListener("pointerup", pointerUp); window.removeEventListener("blur", pause); window.removeEventListener("palace:footstep", step);
    };
    // 输入只安装一次；当前相机、控制门控、分析器和辅助设置都从现有实例读取。
  }, [camera, gl, simulation, sound]);
  useFrame((_, rawDelta) => {
    if (!ball.current || !enabled()) return;
    const dt = Math.min(rawDelta, .06), local = state.current;
    if (local.charging) local.charge = Math.min(1, local.charge + dt / 1.4);
    if (simulation.mode === "held") {
      const hand = scratch.current.hand.set(.38, -.56, -.87).applyQuaternion(camera.quaternion).add(camera.position);
      if (local.dribble) {
        const old = local.dribbleTime; local.dribbleTime = (old + dt) % .65;
        if (local.dribbleTime < old) sound.sound("bounce");
        const t = local.dribbleTime / .65; hand.y = BALL_RADIUS + 4 * 1.25 * t * (1 - t);
      }
      Object.assign(simulation.position, { x: hand.x, y: hand.y, z: hand.z });
    } else {
      for (const event of simulation.step(dt)) {
        if (event !== "missed") sound.sound(event);
        if (event === "rim" || event === "made" || event === "backboard") {
          courtResponse.hoop = simulation.position.z < 0 ? -1 : 1;
          if (event === "rim") courtResponse.rim = 1; else if (event === "backboard") courtResponse.board = 1; else courtResponse.net = 1;
        }
        if (event === "made" || event === "missed") {
          useActivity.setState({ ...simulation.stats, result: event === "made" ? "MADE · " + simulation.stats.streak + " IN A ROW" : "MISSED · TRY AGAIN" });
          acknowledge(event === "made" ? "Through the net" : "Ball is live · E to pick up, R to recall");
        }
      }
    }
    const p = simulation.position;
    ball.current.position.set(p.x, p.y, p.z);
    if (simulation.mode === "flight") ball.current.rotation.x += dt * simulation.velocity.z * 1.8;
    if (shadow.current) {
      shadow.current.position.set(p.x, 0, p.z);
      const mesh = shadow.current.children[0] as Mesh;
      (mesh.material as MeshBasicMaterial).opacity = Math.max(.03, .32 - p.y * .055);
      shadow.current.scale.setScalar(1 + p.y * .05);
    }
    sound.update(); local.publish += dt;
    if (local.publish >= .12) { local.publish = 0; publish(); }
  });
  return <>
    <group ref={ball} name="practice-ball" position={[1.5, BALL_RADIUS, 6]} onClick={event => { if (event.delta < 5) { event.stopPropagation(); if (!document.pointerLockElement) pickup(); } }}>
      <mesh castShadow><sphereGeometry args={[BALL_RADIUS, 32, 24]} /><meshStandardMaterial map={texture} roughness={.83} bumpMap={texture} bumpScale={.0025} /></mesh>
    </group>
    <group ref={shadow}><ContactShadow width={.58} depth={.58} opacity={.28} /></group>
  </>;
}
export default function BasketballCourt() {
  return <group name="basketball-practice-world">
    <CourtArchitecture /><PracticeBall />
    <WorldPortal id="worlds" title="Back to the palace" position={[0, 2.4, 17.2]} rotation={[0, Math.PI, 0]} compact />
  </group>;
}
