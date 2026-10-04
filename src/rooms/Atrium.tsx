import { Suspense, useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
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
import { projects } from "../content/catalog";
import { VisualWall } from "./PersonalRooms";
import { Picture } from "../world/primitives";
import { useLibraryStore } from "../systems/library";

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
    const scale = 2.6 / (result.boundingSphere?.radius || 1);
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
        color="#e2f4ff"
        metalness={0}
        roughness={0.035}
        transmission={1}
        thickness={3.4}
        ior={1.49}
        attenuationColor="#84c9f2"
        attenuationDistance={6.5}
        clearcoat={0.16}
        clearcoatRoughness={0.035}
        envMapIntensity={1.65}
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
        color="#e2f4ff"
        roughness={0.035}
        transmission={1}
        thickness={3.4}
        ior={1.49}
        attenuationColor="#84c9f2"
        attenuationDistance={6.5}
        clearcoat={0.16}
        envMapIntensity={1.65}
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
  useFrame(({ camera, clock }, delta) => {
    if (sculpture.current && !reducedMotion) {
      sculpture.current.position.y =
        3.62 + Math.sin(clock.elapsedTime * 0.4) * 0.1;
      sculpture.current.rotation.y += delta * 0.042;
    }
    if (light.current)
      light.current.intensity =
        4.5 + (reducedMotion ? 0 : Math.sin(clock.elapsedTime * 0.4) * 0.5);
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
          color="#d1d5ce"
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
      </group>
      <pointLight
        ref={light}
        position={[0, 3.2, 0]}
        color="#b9e4ff"
        intensity={4.5}
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
  const color = useMemo(() => new Color("#dedfd8"), []);
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
          color="#dedfd8"
        />
      </group>
      <Block position={[0, 11.1, 0]} scale={[7.2, 3.8, 1.1]} color="#dedfd8" />
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
  const images = useLibraryStore((s) => s.wallpapers);
  const hero = projects.find((p) => p.id === "void-echo");
  return (
    <group>
      {hero && (
        <group
          position={[-14, 5.2, -8]}
          rotation={[0, 0.3, 0]}
          onClick={(e) => {
            e.stopPropagation();
            usePalaceStore.getState().focusItem(hero);
          }}
        >
          <Block scale={[11.6, 6.9, 0.16]} color="#152841" />
          <Picture
            src={hero.cover}
            width={11.3}
            height={6.5}
            position={[0, 0, 0.12]}
          />
          <Label
            text="VOID//ECHO / A WORLD I BUILT"
            position={[0, -3.9, 0.13]}
            color="#57798b"
            size={0.18}
          />
        </group>
      )}
      {images[0] && (
        <VisualWall
          item={images[0]}
          position={[14.3, 5.1, -9]}
          width={11.5}
          height={7.3}
          rotation={[0, -0.3, 0]}
        />
      )}
      <pointLight
        position={[-19, 4, 1]}
        color="#ffae60"
        intensity={95}
        distance={16}
      />
      <Block
        position={[-21.1, 5.5, 1]}
        scale={[0.1, 7.4, 6.6]}
        color="#36241d"
        emissive="#b67a46"
        emissiveIntensity={0.3}
      />
      <Floor width={44} depth={54} color="#c4c7c1" />
      <Block position={[0, -0.23, 0]} scale={[48, 0.4, 58]} color="#c4c7c1" />
      {/* Deep structural volumes leave lit recesses, rather than a single cube. */}
      {[-1, 1].map((side) => (
        <group key={side}>
          <Block
            position={[side * 22, 6.5, 0]}
            scale={[1.1, 13, 54]}
            color="#e5e0d6"
          />
          <Block
            position={[side * 18.3, 12.65, 0]}
            scale={[6.5, 0.7, 54]}
            color="#cbcfc9"
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
                color="#dedbd3"
                castShadow
              />
            </group>
          ))}
          <Block
            position={[side * 11.5, 10.9, -11]}
            scale={[0.5, 3.5, 26]}
            color="#d5d6cf"
          />
        </group>
      ))}
      {/* A sequence of immense roof cuts, alternating daylight and mineral slabs. */}
      {[-19, -7, 5, 17].map((z) => (
        <group key={z}>
          <Block
            position={[0, 13.03, z]}
            scale={[31, 0.45, 4.4]}
            color="#cfd2cc"
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
        color="#e6e1d8"
      />
      <Block
        position={[16, 6.5, -26.1]}
        scale={[10, 13, 0.8]}
        color="#e6e1d8"
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
        text="JIE TIAN   /   MY PERSONAL WORLD"
        position={[-16.5, 2.65, -25.19]}
        size={0.16}
        color="#6a807a"
      />
      <Label
        text={"Things I made.\nWorlds I keep."}
        position={[14.3, 4.2, -25.2]}
        size={0.44}
        maxWidth={7}
        color="#59706b"
      />
      <Door
        id="imagined-worlds"
        title="Imagined Worlds"
        position={[16.2, 0, -24.8]}
        dark
      />
      <Door
        id="my-collection"
        title="My Collection"
        position={[-16.2, 0, -24.8]}
      />
      {[-18, -9, 0, 9, 18].map((x) => (
        <Block
          key={x}
          position={[x, 0.012, 0]}
          scale={[0.007, 0.005, 53]}
          color="#b7bfb8"
        />
      ))}
      {[-18, -9, 0, 9, 18].map((z) => (
        <Block
          key={z}
          position={[0, 0.013, z]}
          scale={[43, 0.005, 0.007]}
          color="#b7bfb8"
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
