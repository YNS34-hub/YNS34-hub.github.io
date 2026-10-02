import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { usePalaceStore } from "../systems/store";
import { Door, Label } from "../world/primitives";
import { allContent, rooms } from "../content/catalog";
import {
  corridorSeed as seed,
  CORRIDOR_SEGMENT_LENGTH as LENGTH,
} from "../world/roomPlan";

type Vector = [number, number, number];
interface Part {
  position: Vector;
  scale: Vector;
  rotation?: Vector;
}

const WING = 3.65;
const DOORS = rooms.filter(
  (room) => !room.hidden && !["atrium", "corridor", "cinema"].includes(room.id),
);
const WORK_DOORS = allContent.map((item, i) => ({
  id: `exhibit-${item.id}`,
  title: item.title.toUpperCase(),
  number: String(i + 1).padStart(2, "0"),
}));
const ANOMALIES = [
  { id: "anomaly-mirror", title: "MIRROR STUDY", number: "—" },
  { id: "anomaly-gravity", title: "ANOTHER ORIENTATION", number: "—" },
  { id: "anomaly-floating", title: "FLOATING COLLECTION", number: "—" },
  { id: "anomaly-compressing", title: "SINGLE THOUGHT", number: "—" },
  { id: "anomaly-impossible", title: "ROOM WITHIN A ROOM", number: "—" },
  { id: "anomaly-loop", title: "AGAIN, WITH A DIFFERENCE", number: "—" },
];

const UNFOLD_DURATION = 4.8;
function ease(value: number) {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function writeInstances(
  mesh: THREE.InstancedMesh,
  parts: Part[],
  object: THREE.Object3D,
  elapsed: number,
) {
  parts.forEach((part, index) => {
    const delay = THREE.MathUtils.clamp((14 - part.position[2]) / 25, 0, 3);
    const unfolded = ease((elapsed - delay) / 1.75);
    const height = 0.05 + unfolded * 0.95;
    object.position.set(...part.position);
    object.scale.set(part.scale[0], part.scale[1] * height, part.scale[2]);
    if (part.scale[1] >= 1) {
      // Vertical architecture rises from its footing; the walking plane never moves.
      object.position.y = part.position[1] - (part.scale[1] * (1 - height)) / 2;
    } else {
      // Thin roof ribs quietly lift in the same ordered wave, opening the light well.
      object.position.y = part.position[1] - (1 - unfolded) * 1.55;
    }
    object.rotation.set(...(part.rotation ?? [0, 0, 0]));
    object.updateMatrix();
    mesh.setMatrixAt(index, object.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
}

function Instances({
  parts,
  color,
  roughness = 0.86,
  opacity = 1,
  emission = 0,
  unfold = false,
  fadeIn = false,
  reducedMotion = false,
}: {
  parts: Part[];
  color: string;
  roughness?: number;
  opacity?: number;
  emission?: number;
  unfold?: boolean;
  fadeIn?: boolean;
  reducedMotion?: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const elapsed = useRef(0);
  const object = useMemo(() => new THREE.Object3D(), []);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    if (reducedMotion) elapsed.current = UNFOLD_DURATION;
    writeInstances(mesh, parts, object, unfold ? elapsed.current : Infinity);
    if (fadeIn && mesh.material instanceof THREE.MeshStandardMaterial) {
      mesh.material.opacity =
        opacity * (0.14 + 0.86 * ease(elapsed.current / 3.8));
    }
  }, [parts, object, unfold, fadeIn, opacity, reducedMotion]);
  useFrame((_state, delta) => {
    const mesh = ref.current;
    if (!mesh || (!unfold && !fadeIn) || elapsed.current >= UNFOLD_DURATION)
      return;
    elapsed.current = Math.min(UNFOLD_DURATION, elapsed.current + delta);
    if (unfold) writeInstances(mesh, parts, object, elapsed.current);
    if (fadeIn && mesh.material instanceof THREE.MeshStandardMaterial) {
      mesh.material.opacity =
        opacity * (0.14 + 0.86 * ease(elapsed.current / 3.8));
    }
  });
  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, parts.length]}
      receiveShadow
    >
      <boxGeometry />
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        metalness={0}
        transparent={opacity < 1}
        opacity={opacity}
        emissive={color}
        emissiveIntensity={emission}
        depthWrite={opacity >= 1}
      />
    </instancedMesh>
  );
}

/** Five 22 m segments stay resident, independent of total walking distance. */
export default function Corridor() {
  const [center, setCenter] = useState(0);
  const viewed = usePalaceStore((state) => state.viewed.length);
  const reducedMotion = usePalaceStore((state) => state.reducedMotion);
  const fragmentsRef = useRef<THREE.Group>(null);
  const chunks = useMemo(
    () => Array.from({ length: 5 }, (_, i) => center + i - 2),
    [center],
  );
  const architecture = useMemo(() => {
    const walls: Part[] = [];
    const floor: Part[] = [];
    const light: Part[] = [];
    const trim: Part[] = [];
    const fragments: Part[] = [];
    for (const chunk of chunks) {
      const z = chunk * LENGTH;
      floor.push({ position: [0, -0.15, z], scale: [8.7, 0.3, LENGTH] });
      for (const side of [-1, 1]) {
        const x = side * 4.15;
        // Real openings in the structure, rather than screens attached to a wall.
        for (const end of [-1, 1]) {
          walls.push({ position: [x, 4.5, z + end * 6.2], scale: [1, 9, 9.6] });
          trim.push({
            position: [side * 3.635, 0.16, z + end * 6.2],
            scale: [0.035, 0.16, 9.6],
          });
        }
        walls.push({ position: [x, 6.75, z], scale: [1, 4.5, 2.8] });
        // Rhythmic pilasters bring scale and depth to the repeated architecture.
        for (const dz of [-10.8, -6.7, 6.7, 10.8]) {
          walls.push({
            position: [side * 3.61, 4.5, z + dz],
            scale: [0.2, 9, 0.32],
          });
        }
        walls.push({
          position: [side * 2.4, 9.04, z],
          scale: [2.15, 0.22, LENGTH],
        });
        trim.push({
          position: [side * 1.28, 9.1, z],
          scale: [0.06, 0.12, LENGTH],
        });
      }
      for (const dz of [-8.5, -3.8, 3.8, 8.5]) {
        walls.push({ position: [0, 9.03, z + dz], scale: [7.5, 0.2, 0.18] });
      }
      // Long luminous roof cuts replace numerous costly dynamic lights.
      light.push({ position: [0, 9.35, z], scale: [2.48, 0.045, 21.7] });
      trim.push({ position: [0, 0.011, z], scale: [0.018, 0.016, 21.9] });
      // A broken ribbon of blue glass becomes a trail into the vanishing point.
      const phase = (seed(chunk) % 31) / 31;
      for (let i = 0; i < 22; i++) {
        const t = i / 21;
        const theta = t * Math.PI * 2 + phase * 0.3;
        fragments.push({
          position: [
            Math.sin(theta) * 2.38,
            6.55 + Math.cos(theta) * 0.42,
            z + t * 19.8 - 9.9,
          ],
          scale: [0.048 + (i % 3) * 0.012, 0.34 + (i % 4) * 0.06, 0.085],
          rotation: [0.19, theta * 0.7, Math.sin(theta) * 0.53],
        });
      }
    }
    return { walls, floor, light, trim, fragments };
  }, [chunks]);

  useFrame(({ camera, clock }) => {
    const next = Math.floor(camera.position.z / LENGTH);
    if (next !== center) setCenter(next);
    if (fragmentsRef.current) {
      fragmentsRef.current.position.y = reducedMotion
        ? 0
        : Math.sin(clock.elapsedTime * 0.26) * 0.045;
    }
  });

  return (
    <group>
      <Instances
        parts={architecture.walls}
        color="#e9eceb"
        unfold
        reducedMotion={reducedMotion}
      />
      <Instances parts={architecture.floor} color="#d8dfdf" roughness={0.32} />
      <Instances parts={architecture.light} color="#e9f5ff" emission={0.68} />
      <Instances parts={architecture.trim} color="#b5c8cd" roughness={0.5} />
      <group ref={fragmentsRef}>
        <Instances
          parts={architecture.fragments}
          color="#b2deef"
          roughness={0.09}
          opacity={0.56}
          emission={0.18}
          fadeIn
          reducedMotion={reducedMotion}
        />
      </group>
      {chunks.map((chunk) => {
        const z = chunk * LENGTH;
        const address = seed(chunk);
        const left = DOORS[address % DOORS.length];
        const right =
          chunk <= -3 && chunk >= -8
            ? ANOMALIES[-chunk - 3]
            : WORK_DOORS.length
              ? WORK_DOORS[(address + 3) % WORK_DOORS.length]
              : DOORS[(address + 3) % DOORS.length];
        const secret = chunk === -2 && viewed >= 3;
        return (
          <group key={chunk}>
            <Door
              {...left}
              position={[-WING, 0, z]}
              rotation={[0, Math.PI / 2, 0]}
            />
            <Door
              id={secret ? "memory" : right.id}
              title={secret ? "A ROOM REMEMBERS" : right.title}
              number={secret ? "—" : right.number}
              position={[WING, 0, z]}
              rotation={[0, -Math.PI / 2, 0]}
              dark={secret}
            />
            <Label
              text={`${chunk < 0 ? "−" : "+"}${String(Math.abs(chunk)).padStart(3, "0")} / ∞`}
              position={[-2.5, 0.02, z + 4.5]}
              rotation={[-Math.PI / 2, 0, 0]}
              size={0.15}
              color="#72868c"
            />
            {chunk === 0 && (
              <>
                <Label
                  text="INFINITE CORRIDOR"
                  position={[-3.46, 2.05, 7.4]}
                  rotation={[0, Math.PI / 2, 0]}
                  size={0.28}
                  color="#485c62"
                  maxWidth={4.7}
                />
                <Label
                  text="This place continues to grow with me."
                  position={[3.46, 1.8, 6.4]}
                  rotation={[0, -Math.PI / 2, 0]}
                  size={0.15}
                  color="#687d83"
                  maxWidth={4.7}
                />
              </>
            )}
          </group>
        );
      })}
    </group>
  );
}
