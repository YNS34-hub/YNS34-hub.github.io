import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Group, TubeGeometry, CatmullRomCurve3, Vector3 } from "three";
import { usePalaceStore } from "../systems/store";
import { useQuietMotion } from "../motion/useMotionCue";
import { acknowledge } from "../interaction/registry";
import CyclingLandscape from "./CyclingLandscape";
import { RidePhysics, cyclingView, route, routeLength, routePhase, shortestHeading, stopDistances, readRideDistance, saveRideDistance } from "./cyclingRoute";
import { useSceneAudio } from "./sceneAudio";
import { useActivity, type RideCommand } from "./activity";
import { Block, Label } from "../world/primitives";
import { lakeRadius } from "./cyclingGeometry";

function Bicycle() {
  const root = useRef<Group>(null), wheel = useRef<Group>(null);
  const geometry = useMemo(() => new TubeGeometry(new CatmullRomCurve3([
    new Vector3(-.42, 1.08, -.9), new Vector3(-.31, 1.04, -1.02), new Vector3(0, 1.06, -1.1), new Vector3(.31, 1.04, -1.02), new Vector3(.42, 1.08, -.9),
  ]), 20, .014, 8, false), []);
  const point = useRef(new Vector3());
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame((_, dt) => {
    if (!root.current) return;
    route.getPointAt(cyclingView.distance / routeLength, point.current);
    root.current.position.copy(point.current); root.current.rotation.y = cyclingView.yaw;
    if (wheel.current) wheel.current.rotation.x -= cyclingView.speed * Math.min(dt, .06) / .34;
  });
  return <group ref={root} name="first-person-bicycle">
    <mesh geometry={geometry}><meshStandardMaterial color="#59665e" metalness={.85} roughness={.27} /></mesh>
    {[-1, 1].map(side => <mesh key={side} position={[side * .38, 1.07, -.92]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[.022, .022, .14, 10]} /><meshStandardMaterial color="#27392f" roughness={.8} /></mesh>)}
    <Block position={[0, .86, -1.1]} rotation={[.17, 0, 0]} scale={[.025, .45, .035]} color="#656d61" metalness={.75} />
    <group ref={wheel} position={[0, .36, -1.24]}>
      <mesh rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[.34, .022, 8, 36]} /><meshStandardMaterial color="#29332c" roughness={.9} /></mesh>
    </group>
  </group>;
}
function Rider() {
  const { camera, gl, scene } = useThree(), quiet = useQuietMotion();
  const ride = useMemo(() => { const model = new RidePhysics(); model.distance = readRideDistance(); return model; }, []);
  const sound = useSceneAudio("cycling");
  const state = useRef({ keys: new Set<string>(), cruise: false, publish: 0, traveled: 0, birdAt: 0, phase: "", initialized: false });
  const vectors = useRef({ point: new Vector3(), tangent: new Vector3() });
  useEffect(() => {
    const publish = () => useActivity.setState({ speed: ride.speed, distance: ride.distance, riding: state.current.cruise, stopped: ride.speed < .1, scenic: routePhase(ride.distance / routeLength) });
    useActivity.setState({ photo: false });
    publish();
    const command = (event: Event) => {
      const s = usePalaceStore.getState();
      if (s.overlay || s.focus || s.mode === "index" || useActivity.getState().warming) return;
      const action = (event as CustomEvent<RideCommand>).detail;
      sound.unlock();
      if (action === "start") { ride.resume(); state.current.cruise = true; useActivity.setState({ photo: false }); acknowledge("Ride at your own pace"); }
      if (action === "brake") { state.current.cruise = false; state.current.keys.add("brake"); }
      if (action === "viewpoint") {
        ride.resume(); ride.stopAt = stopDistances.find(distance => distance > ride.distance + 3) ?? routeLength - .2;
        state.current.cruise = true; acknowledge("Coasting toward the next viewpoint");
      }
      if (action === "restart") { ride.distance = 0; ride.speed = 0; ride.stopAt = null; ride.atViewpoint = false; state.current.cruise = false; saveRideDistance(0); acknowledge("Back at the forest gate"); }
      if (action === "photo") { ride.speed = 0; state.current.cruise = false; state.current.keys.clear(); useActivity.setState({ photo: !useActivity.getState().photo }); saveRideDistance(ride.distance); }
      if (action === "save-photo") {
        // 显式点击才导出当前 3D 画面，文件只下载到本机，不经过服务器或馆藏上传。
        gl.render(scene, camera);
        gl.domElement.toBlob(blob => {
          if (!blob) return;
          const url = URL.createObjectURL(blob), link = document.createElement("a");
          link.href = url; link.download = "memory-palace-golden-forest.png"; link.click();
          setTimeout(() => URL.revokeObjectURL(url), 5000);
        });
      }
      publish();
    };
    const down = (event: KeyboardEvent) => {
      const s = usePalaceStore.getState();
      const ridingKey = ["KeyW", "KeyS", "ArrowUp", "ArrowDown"].includes(event.code);
      // 原 Player 先阻止方向键滚动，但骑行仍需读取相同真实输入；不改它的控制器或事件顺序。
      if (event.repeat || (event.defaultPrevented && !ridingKey) || s.overlay || s.focus || s.mode === "index" || useActivity.getState().warming ||
        (event.target instanceof HTMLElement && event.target.closest('input,textarea,select,[contenteditable="true"]'))) return;
      if (event.code === "KeyP") { event.preventDefault(); command(new CustomEvent("palace:ride", { detail: "photo" })); return; }
      if (useActivity.getState().photo) return;
      if (["KeyW", "KeyS", "Space", "ArrowUp", "ArrowDown"].includes(event.code)) {
        if (event.code === "Space" && !document.pointerLockElement && event.target instanceof HTMLElement && event.target.closest("button,a")) return;
        event.preventDefault(); state.current.keys.add(event.code); sound.unlock();
        if (event.code === "KeyW" || event.code === "ArrowUp") { ride.resume(); state.current.cruise = true; }
      }
    };
    const up = (event: KeyboardEvent) => state.current.keys.delete(event.code);
    const halt = () => { state.current.keys.clear(); state.current.cruise = false; ride.speed = 0; saveRideDistance(ride.distance); publish(); };
    const unsubscribe = usePalaceStore.subscribe((s, p) => { if ((s.overlay && !p.overlay) || (s.focus && !p.focus)) halt(); });
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && useActivity.getState().photo) {
        event.preventDefault(); event.stopImmediatePropagation(); useActivity.setState({ photo: false });
      }
    };
    window.addEventListener("palace:ride", command); document.addEventListener("keydown", down); document.addEventListener("keyup", up);
    window.addEventListener("keydown", escape, true); window.addEventListener("blur", halt); window.addEventListener("pagehide", halt);
    return () => {
      saveRideDistance(ride.distance); unsubscribe();
      window.removeEventListener("palace:ride", command); document.removeEventListener("keydown", down); document.removeEventListener("keyup", up);
      window.removeEventListener("keydown", escape, true); window.removeEventListener("blur", halt); window.removeEventListener("pagehide", halt);
      useActivity.setState({ riding: false, photo: false });
    };
  }, [ride, sound, camera, gl, scene]);
  useFrame((_, rawDelta) => {
    const s = usePalaceStore.getState(), local = state.current;
    if (!s.started || s.overlay || s.focus || s.mode === "index" || document.hidden || useActivity.getState().warming) return;
    const dt = Math.min(rawDelta, .06), before = ride.distance, wasAtViewpoint = ride.atViewpoint;
    const keys = local.keys;
    ride.step(dt, { pedal: keys.has("KeyW") || keys.has("ArrowUp"), slow: keys.has("KeyS") || keys.has("ArrowDown"), brake: keys.has("Space") || keys.has("brake"), cruise: local.cruise, blocked: useActivity.getState().photo });
    if (keys.has("brake") && ride.speed === 0) keys.delete("brake");
    if (ride.atViewpoint) { local.cruise = false; if (!wasAtViewpoint) acknowledge("A place to stop and look"); }
    const { point, tangent } = vectors.current, t = ride.distance / routeLength;
    cyclingView.distance = ride.distance; cyclingView.speed = ride.speed;
    route.getPointAt(t, point); route.getTangentAt(t, tangent);
    const targetYaw = Math.atan2(-tangent.x, -tangent.z);
    if (!local.initialized) { cyclingView.yaw = targetYaw; local.initialized = true; }
    else cyclingView.yaw += (shortestHeading(cyclingView.yaw, targetYaw) - cyclingView.yaw) * (1 - Math.exp(-dt * 7));
    local.traveled += Math.max(0, ride.distance - before);
    camera.position.set(point.x, point.y + 1.52 + (quiet ? 0 : Math.sin(local.traveled * 2.3) * .012 * Math.min(1, ride.speed / 5)), point.z);
    const phase = routePhase(t);
    if (phase !== local.phase) { local.phase = phase; useActivity.setState({ scenic: phase }); }
    sound.update(ride.speed, Math.max(0, 1 - (lakeRadius(point.x, point.z) - 1) / .8)); local.birdAt += dt;
    if (local.birdAt > 12 && ride.speed < 7) { local.birdAt = 0; sound.sound("bird"); }
    local.publish += dt;
    if (local.publish > .12) {
      local.publish = 0; useActivity.setState({ speed: ride.speed, distance: ride.distance, riding: local.cruise, stopped: ride.speed < .1 });
    }
  });
  return null;
}
export default function ScenicCycling() {
  return <group name="golden-forest-cycling-world">
    <CyclingLandscape /><Rider /><Bicycle />
    <group position={[-4.8, 0, 35]} onClick={event => { if (event.delta < 5) { event.stopPropagation(); usePalaceStore.getState().enterRoom("worlds"); } }}>
      <Block position={[0, 1.1, 0]} scale={[.12, 2.2, .12]} color="#5b6a57" />
      <Block position={[0, 2, .08]} scale={[1.8, .65, .07]} color="#354f44" />
      <Label text="THE PALACE ↗" position={[0, 2, .125]} size={.16} color="#ded5ba" />
    </group>
  </group>;
}
