import { Suspense, useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  Color,
  Group,
  Mesh,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
} from "three";
import { usePalaceStore } from "../systems/store";
import { Block, ContactShadow, Door, Floor, Label } from "../world/primitives";

function GlassGeometry() {
  const gltf = useGLTF(`${import.meta.env.BASE_URL}assets/nonlinear-glass.glb`);
  const geometry = useMemo(() => {
    let original: BufferGeometry | null = null;
    gltf.scene.traverse((object) => {
      if (object instanceof Mesh && !original) original = object.geometry;
    });
    const result = original
      ? (original as BufferGeometry).clone()
      : new BufferGeometry();
    result.computeBoundingSphere();
    result.center();
    const scale = 2.35 / (result.boundingSphere?.radius || 1);
    result.scale(scale, scale, scale);
    result.computeVertexNormals();
    return result;
  }, [gltf]);
  useEffect(
    () => () => {
      geometry.dispose();
      gltf.scene.traverse((object) => {
        if (object instanceof Mesh) object.geometry.dispose();
      });
      useGLTF.clear(`${import.meta.env.BASE_URL}assets/nonlinear-glass.glb`);
    },
    [geometry, gltf],
  );
  return (
    <mesh geometry={geometry}>
      <meshPhysicalMaterial
        color="#effcff"
        metalness={0}
        roughness={0.025}
        transmission={1}
        thickness={2.3}
        ior={1.46}
        attenuationColor="#93d3f5"
        attenuationDistance={8}
        clearcoat={0.3}
        clearcoatRoughness={0.035}
        envMapIntensity={1}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

function LightGlassGeometry() {
  const geometry = useMemo(() => {
    const sphere = new SphereGeometry(2.35, 32, 24);
    const positions = sphere.attributes.position;
    const point = new Vector3();
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i);
      const theta = Math.atan2(point.z, point.x),
        phi = Math.acos(Math.max(-1, Math.min(1, point.y / 2.35)));
      point.multiplyScalar(
        1 +
          0.042 * Math.sin(theta * 3) * Math.sin(phi * 2) +
          0.024 * Math.sin(theta * 5) * Math.sin(phi * 3),
      );
      positions.setXYZ(i, point.x, point.y, point.z);
    }
    sphere.computeVertexNormals();
    return sphere;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry}>
      <meshPhysicalMaterial
        color="#effcff"
        roughness={0.025}
        transmission={1}
        thickness={2.3}
        ior={1.46}
        attenuationColor="#93d3f5"
        attenuationDistance={8}
        clearcoat={0.3}
        envMapIntensity={1}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

function Core() {
  const sculpture = useRef<Group>(null);
  const light = useRef<import("three").PointLight>(null);
  const reducedMotion = usePalaceStore((s) => s.reducedMotion);
  const quality = usePalaceStore((s) => s.effectiveQuality);
  const direction = useMemo(() => new Vector3(), []);
  const towardsCore = useMemo(() => new Vector3(), []);
  const shadow = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const context = canvas.getContext("2d")!;
    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, "rgba(20,50,66,0.21)");
    gradient.addColorStop(0.5, "rgba(20,50,66,0.09)");
    gradient.addColorStop(1, "rgba(20,50,66,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
  }, []);
  useEffect(() => () => shadow.dispose(), [shadow]);
  const particles = useMemo(() => {
    const count = quality === "low" ? 20 : quality === "medium" ? 38 : 60;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const t = (i / count) * Math.PI * 2;
      positions[i * 3] = Math.cos(t) * (3.6 + Math.sin(i * 12.4) * 0.5);
      positions[i * 3 + 1] = Math.sin(t * 2) * 1.3;
      positions[i * 3 + 2] = Math.sin(t) * (3.6 + Math.sin(i * 12.4) * 0.5);
    }
    return positions;
  }, [quality]);
  useFrame(({ camera, clock }, delta) => {
    if (sculpture.current && !reducedMotion) {
      sculpture.current.position.y =
        3.62 + Math.sin(clock.elapsedTime * 0.4) * 0.1;
      sculpture.current.rotation.y += delta * 0.042;
    }
    if (light.current)
      light.current.intensity =
        8 + (reducedMotion ? 0 : Math.sin(clock.elapsedTime * 0.4) * 1.5);
    camera.getWorldDirection(direction);
    towardsCore.set(0, 3.3, 0).sub(camera.position).normalize();
    const near =
      camera.position.x ** 2 + camera.position.z ** 2 < 85 &&
      direction.dot(towardsCore) > 0.7;
    if (usePalaceStore.getState().coreNear !== near)
      usePalaceStore.getState().update({ coreNear: near });
  });
  return (
    <group>
      <mesh position={[0, 0.055, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[5.2, 72]} />
        <meshBasicMaterial map={shadow} transparent depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.125, 0]} receiveShadow>
        <cylinderGeometry args={[3.36, 3.4, 0.24, 80]} />
        <meshStandardMaterial
          color="#e3e7e3"
          roughness={0.27}
          metalness={0.1}
        />
      </mesh>
      <mesh position={[0, 0.248, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3.25, 3.28, 100]} />
        <meshBasicMaterial color="#abc9ce" transparent opacity={0.65} />
      </mesh>
      <group ref={sculpture} position={[0, 3.62, 0]}>
        {quality === "low" ? (
          <LightGlassGeometry />
        ) : (
          <Suspense fallback={<LightGlassGeometry />}>
            <GlassGeometry />
          </Suspense>
        )}
        <mesh rotation={[0.55, -0.2, 0.37]} renderOrder={3}>
          <torusGeometry args={[1.24, 0.028, 8, 90]} />
          <meshBasicMaterial
            color="#74b9d5"
            transparent
            opacity={0.34}
            depthWrite={false}
          />
        </mesh>
        <mesh rotation={[1.24, 0.35, -0.45]} renderOrder={3}>
          <torusGeometry args={[0.82, 0.014, 6, 70]} />
          <meshBasicMaterial
            color="#72c3e4"
            transparent
            opacity={0.42}
            depthWrite={false}
          />
        </mesh>
        <points>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[particles, 3]}
            />
          </bufferGeometry>
          <pointsMaterial
            color="#a5cee7"
            size={0.034}
            transparent
            opacity={0.52}
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </points>
      </group>
      <pointLight
        ref={light}
        position={[0, 3.2, 0]}
        color="#b9e4ff"
        intensity={8}
        distance={10}
        decay={2}
      />
      <Label
        text="01   /   A LIVING ARCHIVE"
        position={[0, 0.02, 6.1]}
        rotation={[-Math.PI / 2, 0, 0]}
        size={0.16}
        color="#647d81"
      />
    </group>
  );
}

function CorridorThreshold() {
  const panel = useRef<Group>(null);
  const reducedMotion = usePalaceStore((s) => s.reducedMotion);
  const color = useMemo(() => new Color("#e8eeeb"), []);
  useFrame(({ camera }, delta) => {
    if (!panel.current || reducedMotion) return;
    const reveal = Math.max(0, Math.min(1, (-camera.position.z - 7) / 10));
    panel.current.position.x +=
      (reveal * 3.3 - panel.current.position.x) * Math.min(delta * 1.5, 1);
  });
  return (
    <group position={[0, 0, -25.85]}>
      <Block
        position={[-6.4, 6.5, 0]}
        scale={[5.6, 13, 1.1]}
        color={color.getStyle()}
      />
      <group ref={panel}>
        <Block
          position={[6.4, 6.5, 0]}
          scale={[5.6, 13, 1.1]}
          color="#e8eeeb"
        />
      </group>
      <Block position={[0, 11.1, 0]} scale={[7.2, 3.8, 1.1]} color="#e8eeeb" />
      <Block
        position={[0, 4.7, -0.6]}
        scale={[7.1, 9.4, 0.05]}
        color="#c7d6d6"
        emissive="#aabfc2"
        emissiveIntensity={0.22}
        onClick={(event) => {
          if (event.delta < 5) {
            event.stopPropagation();
            usePalaceStore.getState().enterRoom("corridor");
          }
        }}
      />
      {Array.from({ length: 7 }, (_, i) => (
        <group key={i} position={[0, 0, -1.4 - i * 2.3]}>
          <Block
            position={[-3.1, 4.65, 0]}
            scale={[0.16, 9.3, 0.22]}
            color="#b6c6c7"
          />
          <Block
            position={[3.1, 4.65, 0]}
            scale={[0.16, 9.3, 0.22]}
            color="#b6c6c7"
          />
          <Block
            position={[0, 9.3, 0]}
            scale={[6.2, 0.13, 0.22]}
            color="#b6c6c7"
          />
        </group>
      ))}
      <Label
        text="08     INFINITE CORRIDOR"
        position={[0, 9.85, 0.57]}
        size={0.24}
        color="#385154"
      />
      <Label
        text="THE ARCHIVE CONTINUES  →"
        position={[0, 2.1, -0.56]}
        size={0.18}
        color="#5a767b"
      />
    </group>
  );
}

export default function Atrium() {
  return (
    <group>
      <Floor width={44} depth={54} color="#d9dedb" />
      <Block position={[0, -0.23, 0]} scale={[48, 0.4, 58]} color="#d9dedb" />
      {/* Deep structural volumes leave lit recesses, rather than a single cube. */}
      {[-1, 1].map((side) => (
        <group key={side}>
          <Block
            position={[side * 22, 6.5, 0]}
            scale={[1.1, 13, 54]}
            color="#e5e8e4"
          />
          <Block
            position={[side * 18.3, 12.65, 0]}
            scale={[6.5, 0.7, 54]}
            color="#e4e7e3"
            castShadow
          />
          <Block
            position={[side * 21.38, 0.2, 0]}
            scale={[0.07, 0.15, 53]}
            color="#a5b4b1"
          />
          {[-20, -10, 0, 10, 20].map((z) => (
            <group key={z}>
              <ContactShadow
                position={[side * 20.7, 0.017, z]}
                width={5.5}
                depth={4.8}
                opacity={0.23}
              />
              <Block
                position={[side * 20.9, 6.35, z]}
                scale={[1.2, 12.7, 0.42]}
                color="#e0e5df"
                castShadow
              />
            </group>
          ))}
          <Block
            position={[side * 11.5, 10.9, -11]}
            scale={[0.5, 3.5, 26]}
            color="#e5e9e3"
          />
        </group>
      ))}
      {/* A sequence of immense roof cuts, alternating daylight and mineral slabs. */}
      {[-19, -7, 5, 17].map((z) => (
        <group key={z}>
          <Block
            position={[0, 13.03, z]}
            scale={[31, 0.45, 4.4]}
            color="#edf0e9"
            castShadow
          />
          <Block
            position={[0, 13.65, z + 4.55]}
            scale={[30, 0.035, 4.4]}
            color="#f4fbff"
            emissive="#e7f4fb"
            emissiveIntensity={0.6}
          />
          <Block
            position={[0, 12.76, z - 2.1]}
            scale={[31, 0.4, 0.12]}
            color="#cad4cf"
          />
        </group>
      ))}
      {/* Monumental entry wall, pierced by the long central passage. */}
      <Block
        position={[-16, 6.5, -26.1]}
        scale={[10, 13, 0.8]}
        color="#e7eae5"
      />
      <Block
        position={[16, 6.5, -26.1]}
        scale={[10, 13, 0.8]}
        color="#e7eae5"
      />
      <Core />
      <CorridorThreshold />
      <Door
        id="projects"
        title="Project Gallery"
        number="02"
        position={[-21.34, 0, -13]}
        rotation={[0, Math.PI / 2, 0]}
      />
      <Door
        id="research"
        title="Research Hall"
        number="03"
        position={[21.34, 0, -13]}
        rotation={[0, -Math.PI / 2, 0]}
      />
      <Door
        id="music"
        title="Listening Room"
        number="04"
        position={[-21.34, 0, 1]}
        rotation={[0, Math.PI / 2, 0]}
      />
      <Door
        id="wallpapers"
        title="Wallpaper Archive"
        number="05"
        position={[21.34, 0, 1]}
        rotation={[0, -Math.PI / 2, 0]}
      />
      <Door
        id="experiments"
        title="AI Playground"
        number="06"
        position={[-21.34, 0, 15]}
        rotation={[0, Math.PI / 2, 0]}
      />
      <Door
        id="archive"
        title="Unfinished Futures"
        number="07"
        position={[21.34, 0, 15]}
        rotation={[0, -Math.PI / 2, 0]}
      />
      <Label
        text={"THE MEMORY\nPALACE"}
        position={[-16.5, 5.2, -25.22]}
        size={0.94}
        maxWidth={8}
        color="#405652"
      />
      <Label
        text="PROJECTS   /   RESEARCH   /   MUSIC"
        position={[-16.5, 2.65, -25.19]}
        size={0.16}
        color="#6a807a"
      />
      <Label
        text={"A place for things\nthat are still becoming."}
        position={[14.3, 4.2, -25.2]}
        size={0.44}
        maxWidth={7}
        color="#59706b"
      />
      {[-18, -12, -6, 0, 6, 12, 18].map((x) => (
        <Block
          key={x}
          position={[x, 0.012, 0]}
          scale={[0.012, 0.015, 53]}
          color="#bcc7c1"
        />
      ))}
      {[-21, -14, -7, 0, 7, 14, 21].map((z) => (
        <Block
          key={z}
          position={[0, 0.013, z]}
          scale={[43, 0.015, 0.012]}
          color="#bcc7c1"
        />
      ))}
      <spotLight
        position={[0, 11, 4]}
        target-position={[0, 0, 0]}
        intensity={100}
        angle={0.52}
        penumbra={1}
        distance={28}
        color="#e4f6ff"
      />
    </group>
  );
}
