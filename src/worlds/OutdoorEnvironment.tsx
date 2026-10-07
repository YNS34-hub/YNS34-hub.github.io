import { useEffect, useRef, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { BackSide, PMREMGenerator, Scene, Mesh, SphereGeometry, ShaderMaterial, DirectionalLight } from "three";
import { usePalaceStore } from "../systems/store";
import { isWorldScene } from "./worldConfig";
import { useProgress } from "@react-three/drei";
import { textureStatus } from "../world/textureCache";
import { useLibraryStore } from "../systems/library";

const vertex = "varying vec3 direction; void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}";
const fragment = `
varying vec3 direction;
void main(){
  vec3 d=normalize(direction);
  float h=clamp(d.y*.85+.12,0.,1.);
  vec3 sky=mix(vec3(.90,.46,.25),vec3(.16,.30,.43),smoothstep(0.,.65,h));
  sky=mix(sky,vec3(.08,.19,.30),smoothstep(.4,1.,h)*.7);
  vec3 sun=normalize(vec3(-.8,.24,-.4));
  float a=dot(d,sun);
  sky+=vec3(.32,.20,.10)*pow(max(0.,a),35.);
  sky=mix(sky,vec3(1.,.86,.60),smoothstep(.9991,.9996,a));
  float clouds=sin(d.x*21.+d.z*12.)*sin(d.z*38.-d.x*8.);
  sky=mix(sky,vec3(.76,.72,.67),smoothstep(.5,.85,clouds)*smoothstep(.10,.3,d.y)*(1.-smoothstep(.32,.55,d.y))*.18);
  gl_FragColor=vec4(sky,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function Outdoor({ roomId, onReady }: { roomId: string; onReady?: () => void }) {
  const { gl, scene, camera } = useThree(), sent = useRef(false), sunlight = useRef<DirectionalLight>(null);
  const quality = usePalaceStore(s => s.effectiveQuality);
  const { active } = useProgress(), readyAt = useRef(performance.now());
  useEffect(() => {
    const far = camera.far; camera.far = roomId === "cycling" ? 650 : 200; camera.updateProjectionMatrix();
    return () => { camera.far = far; camera.updateProjectionMatrix(); };
  }, [camera, roomId]);
  useEffect(() => {
    const envScene = new Scene();
    const geo = new SphereGeometry(10, 32, 16), mat = new ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, side: BackSide });
    envScene.add(new Mesh(geo, mat));
    const generator = new PMREMGenerator(gl), target = generator.fromScene(envScene, .04);
    scene.environment = target.texture; scene.environmentIntensity = .55;
    generator.dispose(); geo.dispose(); mat.dispose();
    return () => { target.dispose(); scene.environment = null; };
  }, [gl, scene, roomId]);
  useFrame(() => {
    if (roomId === "cycling" && sunlight.current) {
      sunlight.current.position.set(camera.position.x - 30, camera.position.y + 18, camera.position.z - 18);
      sunlight.current.target.position.copy(camera.position); sunlight.current.target.updateMatrixWorld();
    }
    const name = roomId === "basketball" ? "basketball-practice-world" : roomId === "cycling" ? "golden-forest-cycling-world" : "worlds-threshold-wing";
    if (!sent.current && scene.getObjectByName(name) && useLibraryStore.getState().ready && !active && !textureStatus().pending && performance.now() - readyAt.current > 650) { sent.current = true; onReady?.(); }
  });
  return <>
    <color attach="background" args={["#b7a38e"]} />
    <fog attach="fog" args={["#b7a38e", roomId === "cycling" ? 140 : 65, roomId === "cycling" ? 460 : 190]} />
    <mesh name="original-golden-sky" raycast={() => {}}><sphereGeometry args={[roomId === "cycling" ? 550 : 180, 32, 16]} /><shaderMaterial vertexShader={vertex} fragmentShader={fragment} side={BackSide} depthWrite={false} /></mesh>
    <hemisphereLight args={["#adc6d4", "#534435", .7]} />
    <directionalLight ref={sunlight} position={[-30, 18, -18]} color="#ffd394" intensity={2.1} castShadow={quality !== "low"}
      shadow-mapSize={quality === "high" ? [2048, 2048] : [1024, 1024]} shadow-camera-left={-30} shadow-camera-right={30} shadow-camera-top={30} shadow-camera-bottom={-30} shadow-camera-far={100} shadow-normalBias={.06} shadow-bias={-.0002} />
  </>;
}
export default function WorldsEnvironment({ roomId, onReady, children }: { roomId: string; onReady?: () => void; children: ReactNode }) {
  return isWorldScene(roomId) ? <Outdoor key={roomId} roomId={roomId} onReady={onReady} /> : children;
}
