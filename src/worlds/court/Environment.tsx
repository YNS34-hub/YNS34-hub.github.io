import { useEffect, useMemo, useRef } from "react";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { useGLTF, useProgress, useTexture } from "@react-three/drei";
import { Color, DirectionalLight, EquirectangularReflectionMapping, HemisphereLight, PMREMGenerator, SpotLight, SRGBColorSpace } from "three";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { usePalaceStore } from "../../systems/store";
import { useLibraryStore } from "../../systems/library";
import { textureStatus } from "../../world/textureCache";
import { useQuietMotion } from "../../motion/useMotionCue";
import { courtAtmosphere, useCourtTime } from "./state";

export default function CourtEnvironment({ onReady }: { onReady?: () => void }) {
  const { camera, scene, gl } = useThree(), hdr = useLoader(RGBELoader, "/media/alpine/clear-daylight-2k.hdr"), source = useTexture("/media/court/day-sky.webp");
  const sky = useMemo(() => { const t = source.clone(); t.colorSpace = SRGBColorSpace; t.mapping = EquirectangularReflectionMapping; return t; }, [source]);
  const sun = useRef<DirectionalLight>(null), hemisphere = useRef<HemisphereLight>(null), left = useRef<SpotLight>(null), right = useRef<SpotLight>(null);
  const sent = useRef(false), readyAt = useRef(performance.now()), { active } = useProgress(), time = useCourtTime(s => s.time), quiet = useQuietMotion(), quality = usePalaceStore(s => s.effectiveQuality);
  const colors = useMemo(() => ({ day: new Color("#bdc6c8"), night: new Color("#090f19"), sky: new Color("#c8d9eb"), ground: new Color("#716953"), nightSky: new Color("#53718a"), nightGround: new Color("#292829") }), []);
  useEffect(() => {
    const far = camera.far, exposure = gl.toneMappingExposure; camera.far = 650; camera.updateProjectionMatrix();
    hdr.mapping = EquirectangularReflectionMapping;
    const generator = new PMREMGenerator(gl), env = generator.fromEquirectangular(hdr); generator.dispose();
    scene.environment = env.texture; scene.background = sky; courtAtmosphere.night = useCourtTime.getState().time === "night" ? 1 : 0;
    useGLTF.preload("/assets/memory-glass.glb");
    return () => { env.dispose(); sky.dispose(); if (scene.environment === env.texture) scene.environment = null; if (scene.background === sky) scene.background = null; scene.backgroundIntensity = 1; camera.far = far; camera.updateProjectionMatrix(); gl.toneMappingExposure = exposure; };
  }, [camera, gl, hdr, scene, sky]);
  useEffect(() => {
    if (left.current) { left.current.target.position.set(-2, 0, -1); left.current.target.updateMatrixWorld(); }
    if (right.current) { right.current.target.position.set(2, 0, 1); right.current.target.updateMatrixWorld(); }
  }, []);
  useFrame((_, raw) => {
    const target = time === "night" ? 1 : 0, blend = quiet ? 1 : 1 - Math.exp(-Math.min(raw, .1) / .5);
    courtAtmosphere.night += (target - courtAtmosphere.night) * blend; const n = courtAtmosphere.night;
    scene.backgroundIntensity = .9 - n * .895; scene.environmentIntensity = .42 - n * .38; gl.toneMappingExposure = 1.08;
    if (scene.fog) scene.fog.color.copy(colors.day).lerp(colors.night, n);
    // 保持阴影着色器拓扑稳定，避免昼夜变化反复重建程序变体。
    // 不活动的阴影贴图冻结更新，仍然只为实际主光付出绘制成本。
    if (sun.current) { sun.current.intensity = 1.7 * (1 - n); sun.current.shadow.autoUpdate = n < .95; }
    if (hemisphere.current) { hemisphere.current.color.copy(colors.sky).lerp(colors.nightSky, n); hemisphere.current.groundColor.lerpColors(colors.ground, colors.nightGround, n); hemisphere.current.intensity = .55 - n * .39; }
    if (left.current) { left.current.intensity = 950 * n; left.current.shadow.autoUpdate = n > .05; }
    if (right.current) right.current.intensity = 800 * n;
    // 与原世界入口相同，等房间提交稳定且关键内容/着色器就绪，避免早到的 ready 被路由重置覆盖。
    if (!sent.current && performance.now() - readyAt.current > 650 && scene.getObjectByName("basketball-practice-world") && scene.getObjectByName("prepared-world:basketball")?.userData.prepared && useLibraryStore.getState().ready && !active && !textureStatus().pending) { sent.current = true; onReady?.(); }
  });
  return <>
    <fog attach="fog" args={["#bdc6c8", 65, 210]} />
    <hemisphereLight ref={hemisphere} args={["#c8d9eb", "#716953", .85]} />
    <directionalLight ref={sun} position={[-28, 34, 12]} intensity={2.15} color="#fff0d8" castShadow={quality !== "low"} shadow-mapSize={[2048, 2048]} shadow-camera-left={-28} shadow-camera-right={28} shadow-camera-top={28} shadow-camera-bottom={-28} shadow-camera-far={110} shadow-normalBias={.035} shadow-bias={-.00015} />
    <spotLight ref={left} position={[-10.2, 9.2, -8]} intensity={0} color="#ffecd3" angle={.92} penumbra={.55} distance={60} decay={2} castShadow={quality !== "low"} shadow-mapSize={[1024, 1024]} shadow-normalBias={.018} shadow-bias={-.00015} />
    <spotLight ref={right} position={[10.2, 9.2, 8]} intensity={0} color="#d4e6ee" angle={.92} penumbra={.55} distance={60} decay={2} />
  </>;
}
