import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { usePalaceStore } from "../systems/store";
import { Door, Label } from "../world/primitives";
import { allContent, rooms } from "../content/catalog";
import { useLibraryStore } from "../systems/library";
import { VisualWall } from "./PersonalRooms";
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
  castShadow = false,
}: {
  parts: Part[];
  color: string;
  roughness?: number;
  opacity?: number;
  emission?: number;
  unfold?: boolean;
  fadeIn?: boolean;
  reducedMotion?: boolean;
  castShadow?: boolean;
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
      castShadow={castShadow}
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
  const visuals = useLibraryStore((state) => state.personal.visuals);
  const sites = useLibraryStore((state) => state.personal.projects);
  const collection = [...visuals, ...sites];
  const chunks = useMemo(
    () => Array.from({ length: 5 }, (_, i) => center + i - 2),
    [center],
  );
  const architecture = useMemo(() => {
    const walls: Part[] = [];
    const floor: Part[] = [];
    const light: Part[] = [];
    const trim: Part[] = [];
    const portals: Part[] = [];
    const ceiling: Part[] = [];
    for (const chunk of chunks) {
      const z = chunk * LENGTH;
      const stage = Math.min(5, Math.max(0, -chunk));
      const height = 9 + stage * 1.25;
      floor.push({ position: [0, -0.15, z], scale: [8.7, 0.3, LENGTH] });
      for (const side of [-1, 1]) {
        const x = side * 4.15;
        // Real openings in the structure, rather than screens attached to a wall.
        for (const end of [-1, 1]) {
          walls.push({
            position: [x, height / 2, z + end * 6.2],
            scale: [1, height, 9.6],
          });
          trim.push({
            position: [side * 3.635, 0.16, z + end * 6.2],
            scale: [0.035, 0.16, 9.6],
          });
        }
        walls.push({
          position: [x, (height + 4.5) / 2, z],
          scale: [1, height - 4.5, 2.8],
        });
        // Rhythmic pilasters bring scale and depth to the repeated architecture.
        for (const dz of [-10.8, -6.7, 6.7, 10.8]) {
          walls.push({
            position: [side * 3.61, height / 2, z + dz],
            scale: [0.22, height, 0.38],
          });
        }
        ceiling.push({
          position: [side * 2.4, height + 0.04, z],
          scale: [2.15, 0.22, LENGTH],
        });
        trim.push({
          position: [side * 1.28, height + 0.1, z],
          scale: [0.06, 0.12, LENGTH],
        });
      }
      for (const dz of [-8.5, -3.8, 3.8, 8.5]) {
        ceiling.push({
          position: [0, height + 0.03, z + dz],
          scale: [7.5, 0.22, 0.22],
          rotation: [0, 0, stage > 2 ? (stage - 2) * 0.065 : 0],
        });
      }
      // Long luminous roof cuts replace numerous costly dynamic lights.
      light.push({
        position: [stage > 1 ? 0.45 : 0, height + 0.35, z],
        scale: [stage > 1 ? 0.8 : 2.48, 0.045, 21.7],
      });
      trim.push({ position: [0, 0.011, z], scale: [0.018, 0.016, 21.9] });
      // The fixed path stays legible while the enclosing architecture ceases to agree.
      // Stage 1: wrong proportions. Stage 2: displaced light. Stage 3: rotated datum.
      // Stages 4–5: huge nested volumes occupy a passage that cannot contain them.
      if (stage > 0) {
        for (let i = 0; i < 4; i++) {
          const turn = stage < 3 ? 0 : (stage - 2) * 0.16 + i * 0.07;
          const radius = stage < 4 ? 3.35 : 4.8 + i * 0.5;
          const anchor = new THREE.Vector3(
            0,
            stage < 4 ? height / 2 : height * 0.62,
            z + 7.5 - i * 4.6,
          );
          for (const side of [-1, 1]) {
            const p = new THREE.Vector3(side * radius, 0, 0)
              .applyAxisAngle(new THREE.Vector3(0, 0, 1), turn)
              .add(anchor);
            portals.push({
              position: p.toArray() as Vector,
              scale: [0.1, stage < 4 ? height - 0.8 : 9.6 + i, 0.32],
              rotation: [0, 0, turn],
            });
            const q = new THREE.Vector3(
              0,
              side * (stage < 4 ? (height - 0.8) / 2 : (9.6 + i) / 2),
              0,
            )
              .applyAxisAngle(new THREE.Vector3(0, 0, 1), turn)
              .add(anchor);
            portals.push({
              position: q.toArray() as Vector,
              scale: [radius * 2, 0.1, 0.32],
              rotation: [0, 0, turn],
            });
          }
        }
      }
    }
    return { walls, floor, light, trim, portals, ceiling };
  }, [chunks]);

  useFrame(({ camera }) => {
    const next = Math.floor(camera.position.z / LENGTH);
    if (next !== center) setCenter(next);
  });

  return (
    <group>
      <Instances
        parts={architecture.walls}
        color="#203449"
        castShadow
        unfold
        reducedMotion={reducedMotion}
      />
      <Instances parts={architecture.floor} color="#172735" roughness={0.25} />
      <Instances
        parts={architecture.ceiling}
        color="#0c1b2b"
        unfold
        reducedMotion={reducedMotion}
        castShadow
      />
      <Instances parts={architecture.light} color="#82b9d9" emission={0.55} />
      <Instances
        parts={architecture.trim}
        color="#bd925f"
        roughness={0.35}
        emission={0.3}
      />
      <Instances
        parts={architecture.portals}
        color="#538396"
        roughness={0.46}
        unfold
        reducedMotion={reducedMotion}
        castShadow
      />
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
            {collection.length > 0 &&
              [-1, 1].map((side, index) => {
                const work =
                  collection[(address + index * 7) % collection.length];
                return (
                  <VisualWall
                    key={`${chunk}-${side}`}
                    item={work}
                    position={[side * 3.43, 4.2, z - 6.4]}
                    width={7.6}
                    height={4.8}
                    rotation={[0, (-side * Math.PI) / 2, 0]}
                  />
                );
              })}
            <pointLight
              position={[0, 4.5, z + 6.5]}
              color={chunk % 2 ? "#deb278" : "#7cb4d0"}
              intensity={18}
              distance={18}
            />
            <Door
              {...left}
              position={[-WING, 0, z]}
              rotation={[0, Math.PI / 2, 0]}
              dark
            />
            <Door
              id={secret ? "memory" : right.id}
              title={secret ? "A ROOM REMEMBERS" : right.title}
              number={secret ? "—" : right.number}
              position={[WING, 0, z]}
              rotation={[0, -Math.PI / 2, 0]}
              dark
            />
            <Label
              text={`${chunk < 0 ? "−" : "+"}${String(Math.abs(chunk)).padStart(3, "0")} / ∞`}
              position={[-2.5, 0.02, z + 4.5]}
              rotation={[-Math.PI / 2, 0, 0]}
              size={0.15}
              color="#86aabd"
            />
            {chunk === 0 && (
              <>
                <Label
                  text="INFINITE CORRIDOR"
                  position={[-3.46, 2.05, 7.4]}
                  rotation={[0, Math.PI / 2, 0]}
                  size={0.28}
                  color="#d0dfdf"
                  maxWidth={4.7}
                />
                <Label
                  text="This place continues to grow with me."
                  position={[3.46, 1.8, 6.4]}
                  rotation={[0, -Math.PI / 2, 0]}
                  size={0.15}
                  color="#c1a885"
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
