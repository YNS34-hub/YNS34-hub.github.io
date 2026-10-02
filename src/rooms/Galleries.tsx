import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  projects,
  research,
  experiments,
  archive,
  allContent,
} from "../content/catalog";
import type { ContentItem, RoomRule } from "../content/types";
import { usePalaceStore } from "../systems/store";
import {
  Block,
  ContactShadow,
  Door,
  Exhibit,
  Label,
  Picture,
} from "../world/primitives";
import { setWalkTarget } from "../world/walkTarget";
import { RoomShell } from "./Architecture";
import { resolveRoomPlan, type RoomPlan } from "../world/roomPlan";

const ICE = "#b1d9ec";
const PAPER = "#f0f0e9";
const INK = "#343f46";

/** A physical diagram, deliberately slow enough to read as sculpture. */
function ThoughtSculpture({
  dark = false,
  nodes = false,
}: {
  dark?: boolean;
  nodes?: boolean;
}) {
  const object = useRef<THREE.Group>(null);
  const reduced = usePalaceStore((s) => s.reducedMotion);
  const quality = usePalaceStore((s) => s.effectiveQuality);
  const positions = useMemo(
    () =>
      Array.from({ length: quality === "low" ? 12 : 22 }, (_, i) => {
        const t = i * 2.39996;
        const y = 1 - (i / (quality === "low" ? 11 : 21)) * 2;
        const r = Math.sqrt(1 - y * y);
        return new THREE.Vector3(
          Math.cos(t) * r * 2.5,
          y * 2.7,
          Math.sin(t) * r * 2.5,
        );
      }),
    [quality],
  );
  useFrame((_, dt) => {
    if (object.current && !reduced)
      object.current.rotation.y += Math.min(dt, 0.05) * 0.045;
  });
  return (
    <group position={[0, 4.2, -3]} ref={object}>
      {nodes ? (
        <>
          {positions.map((p, i) => (
            <mesh key={`node-${i}`} position={p}>
              <sphereGeometry args={[i % 5 === 0 ? 0.17 : 0.09, 12, 8]} />
              <meshStandardMaterial
                color={i % 5 === 0 ? "#e7eee8" : ICE}
                emissive={ICE}
                emissiveIntensity={dark ? 0.4 : 0.09}
                roughness={0.3}
              />
            </mesh>
          ))}
          {positions.map((p, i) => {
            const q = positions[(i + 5) % positions.length];
            const delta = q.clone().sub(p);
            const quaternion = new THREE.Quaternion().setFromUnitVectors(
              new THREE.Vector3(0, 1, 0),
              delta.clone().normalize(),
            );
            return (
              <mesh
                key={`edge-${i}`}
                position={p.clone().add(q).multiplyScalar(0.5)}
                quaternion={quaternion}
              >
                <cylinderGeometry args={[0.012, 0.012, delta.length(), 4]} />
                <meshBasicMaterial color={ICE} transparent opacity={0.35} />
              </mesh>
            );
          })}
          <mesh>
            <sphereGeometry args={[0.72, 24, 16]} />
            <meshStandardMaterial
              color="#c4e8f4"
              wireframe
              transparent
              opacity={0.36}
            />
          </mesh>
        </>
      ) : (
        <>
          <mesh rotation={[Math.PI / 4, 0.4, 0.1]}>
            <torusKnotGeometry
              args={[1.75, 0.065, quality === "low" ? 120 : 220, 8, 2, 3]}
            />
            <meshStandardMaterial
              color={dark ? ICE : "#7091a3"}
              roughness={0.32}
              metalness={0.35}
              emissive={ICE}
              emissiveIntensity={0.045}
            />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[2.4, 0.016, 6, 80]} />
            <meshBasicMaterial
              color={dark ? ICE : "#a0b2ba"}
              transparent
              opacity={0.45}
            />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0.75, 0]}>
            <torusGeometry args={[2.7, 0.013, 6, 80]} />
            <meshBasicMaterial
              color={dark ? ICE : "#a0b2ba"}
              transparent
              opacity={0.3}
            />
          </mesh>
        </>
      )}
    </group>
  );
}

function MuseumHeading({
  title,
  subtitle,
  dark = false,
}: {
  title: string;
  subtitle: string;
  dark?: boolean;
}) {
  return (
    <group>
      <Label
        text={title}
        position={[0, 6.85, -16.54]}
        size={0.56}
        color={dark ? "#dce7ea" : INK}
        maxWidth={22}
      />
      <Label
        text={subtitle}
        position={[0, 5.9, -16.52]}
        size={0.18}
        color={dark ? "#83979f" : "#849198"}
        maxWidth={20}
      />
      <Block
        position={[0, 5.35, -16.5]}
        scale={[3.3, 0.016, 0.025]}
        color={dark ? "#476b7b" : "#b9c8cd"}
      />
    </group>
  );
}

function Exit({ dark = false, z = 14.8 }: { dark?: boolean; z?: number }) {
  return (
    <Door
      id="atrium"
      title="THE ATRIUM"
      number="00"
      position={[9.3, 0, z]}
      rotation={[0, Math.PI, 0]}
      dark={dark}
    />
  );
}

function WingNavigation({
  collection,
  page,
  count,
}: {
  collection: string;
  page: number;
  count: number;
}) {
  const pages = Math.ceil(count / 6);
  if (pages < 2) return null;
  const address = (n: number) =>
    n === 0 ? collection : `${collection}-page-${n + 1}`;
  return (
    <group>
      {page > 0 && (
        <Door
          id={address(page - 1)}
          title="PREVIOUS WING"
          number={`${page} / ${pages}`}
          position={[-9.3, 0, -15.5]}
        />
      )}
      {page + 1 < pages && (
        <Door
          id={address(page + 1)}
          title="CONTINUE GALLERY"
          number={`${page + 2} / ${pages}`}
          position={[9.3, 0, -15.5]}
        />
      )}
    </group>
  );
}

function ProjectGallery({ page = 0 }: { page?: number }) {
  const items = projects.slice(page * 6, page * 6 + 6);
  return (
    <group>
      <RoomShell width={28} depth={34} height={10.5} />
      <MuseumHeading
        title="WORKS IN THE WORLD"
        subtitle="01 / PROJECT GALLERY        CODE, MADE SPATIAL."
      />
      <Block
        position={[0, 0.2, -3]}
        scale={[5.8, 0.4, 5.8]}
        color="#e1e5e4"
        roughness={0.48}
      />
      <ThoughtSculpture />
      <Label
        text="A collection of possibilities."
        position={[0, 0.68, 0.04]}
        size={0.17}
        color="#7d919a"
      />
      {items.map((item, i) => {
        const side = i % 2 === 0 ? -1 : 1;
        return (
          <group key={item.id}>
            <Block
              position={[side * 10.25, 2.7, 7.1 - Math.floor(i / 2) * 8.7]}
              scale={[0.17, 5.4, 6.1]}
              color="#e7e9e4"
            />
            <Exhibit
              item={item}
              position={[side * 10.05, 0, 7.1 - Math.floor(i / 2) * 8.7]}
              rotation={[0, side === -1 ? Math.PI / 2 : -Math.PI / 2, 0]}
              index={i}
              kind={item.roomType === "installation" ? "sculpture" : "screen"}
            />
          </group>
        );
      })}
      <Label
        text="EVERY WORK IS A DOOR."
        position={[0, 8.4, 16.68]}
        rotation={[0, Math.PI, 0]}
        color="#82919a"
        size={0.27}
      />
      <WingNavigation
        collection="projects"
        page={page}
        count={projects.length}
      />
      <Exit />
    </group>
  );
}

function ResearchGallery({ page = 0 }: { page?: number }) {
  return (
    <group>
      <RoomShell width={28} depth={34} height={11} />
      <MuseumHeading
        title="THE SHAPE OF A QUESTION"
        subtitle="02 / RESEARCH HALL        MATHEMATICS AS AN EXHIBIT."
      />
      <mesh position={[0, 0.13, -3]}>
        <cylinderGeometry args={[3.15, 3.15, 0.26, 64]} />
        <meshStandardMaterial color="#e1e6e3" roughness={0.62} />
      </mesh>
      <ThoughtSculpture />
      <Label
        text="CONTINUITY / STRUCTURE / POSSIBILITY"
        position={[0, 0.8, 0.37]}
        color="#6f8692"
        size={0.14}
      />
      {research[page * 6]?.equation && (
        <Label
          text={research[page * 6].equation!}
          position={[0, 3.75, -16.65]}
          size={0.36}
          color="#7e969f"
          maxWidth={17}
        />
      )}
      {research.slice(page * 6, page * 6 + 6).map((item, i) => {
        const side = i % 2 === 0 ? -1 : 1;
        return (
          <Exhibit
            key={item.id}
            item={item}
            position={[side * 12.9, 0, 7.3 - Math.floor(i / 2) * 8.7]}
            rotation={[0, side === -1 ? Math.PI / 2 : -Math.PI / 2, 0]}
            index={i}
            kind="poster"
          />
        );
      })}
      {[5, -6].map((z) => (
        <Block
          key={z}
          position={[0, 0.25, z + 2]}
          scale={[3.8, 0.5, 0.7]}
          color="#b9bfc0"
          roughness={0.9}
        />
      ))}
      <WingNavigation
        collection="research"
        page={page}
        count={research.length}
      />
      <Exit />
    </group>
  );
}

function ExperimentGallery({ page = 0 }: { page?: number }) {
  return (
    <group>
      <RoomShell width={28} depth={34} height={10} dark />
      <MuseumHeading
        title="POSSIBLE INTELLIGENCES"
        subtitle="05 / AI PLAYGROUND        SMALL SYSTEMS, UNEXPECTED BEHAVIOURS."
        dark
      />
      <Block
        position={[0, 0.23, -3]}
        scale={[6.5, 0.46, 6.5]}
        color="#161e24"
        metalness={0.38}
      />
      <ThoughtSculpture dark nodes />
      <pointLight
        position={[0, 4, -3]}
        color="#b3daeb"
        intensity={15}
        distance={14}
        decay={2}
      />
      <Label
        text="A SYSTEM LEARNING TO BECOME."
        position={[0, 0.8, 0.7]}
        color="#8ca8b8"
        size={0.16}
      />
      {experiments.slice(page * 6, page * 6 + 6).map((item, i) => {
        const side = i % 2 === 0 ? -1 : 1;
        return (
          <group key={item.id}>
            <Block
              position={[side * 9.7, 2.7, 7 - Math.floor(i / 2) * 8.5]}
              scale={[0.12, 5.4, 5.8]}
              color="#182229"
              metalness={0.25}
            />
            <Exhibit
              item={item}
              position={[side * 9.5, 0, 7 - Math.floor(i / 2) * 8.5]}
              rotation={[0, side === -1 ? Math.PI / 2 : -Math.PI / 2, 0]}
              kind={i === 0 ? "sculpture" : "screen"}
              index={i}
            />
          </group>
        );
      })}
      {[-12, 12].map((x) => (
        <Block
          key={x}
          position={[x, 0.06, 0]}
          scale={[0.018, 0.02, 26]}
          color="#c8e8f4"
        />
      ))}
      <WingNavigation
        collection="experiments"
        page={page}
        count={experiments.length}
      />
      <Exit dark />
    </group>
  );
}

function UnfinishedGallery({ page = 0 }: { page?: number }) {
  return (
    <group>
      <RoomShell width={28} depth={34} height={9.5} />
      <MuseumHeading
        title="UNFINISHED FUTURES"
        subtitle="06 / THE ARCHIVE        NOTHING HERE HAS STOPPED BECOMING."
      />
      {[-10, 10].map((x) => (
        <group key={x}>
          {[-10, -2, 6].map((z) => (
            <group key={z}>
              <Block
                position={[x, 3.6, z]}
                scale={[0.09, 7.2, 0.09]}
                color="#8e9da4"
                metalness={0.6}
              />
              <Block
                position={[x, 6.9, z + 3.7]}
                scale={[0.09, 0.09, 7.4]}
                color="#8e9da4"
                metalness={0.6}
              />
              <Block
                position={[x, 4.7, z + 3.7]}
                scale={[0.055, 0.055, 7.4]}
                color="#acb7bb"
              />
            </group>
          ))}
        </group>
      ))}
      <Block
        position={[0, 0.035, -1]}
        scale={[0.016, 0.04, 25]}
        color="#b6cbd4"
      />
      {archive.slice(page * 6, page * 6 + 6).map((item, i) => {
        const side = i % 2 === 0 ? -1 : 1;
        return (
          <group key={item.id}>
            <Block
              position={[side * 8, 0.16, 6.7 - Math.floor(i / 2) * 8.3]}
              scale={[4.8, 0.32, 3.3]}
              color="#d5dbda"
              opacity={0.68}
            />
            <Exhibit
              item={item}
              position={[side * 8, 0.32, 6.7 - Math.floor(i / 2) * 8.3]}
              kind="wireframe"
              index={i}
            />
          </group>
        );
      })}
      <Label
        text="TO BE CONTINUED."
        position={[0, 2.4, -16.54]}
        color="#8b9a9f"
        size={0.34}
      />
      <WingNavigation collection="archive" page={page} count={archive.length} />
      <Exit />
    </group>
  );
}

function MemoryChamber({
  roomId = "memory",
  item,
}: {
  roomId?: string;
  item?: ContentItem;
}) {
  const visits = usePalaceStore((s) => s.visits[roomId] || 1);
  const viewed = usePalaceStore((s) => s.viewed.length);
  const motion = usePalaceStore((s) => !s.reducedMotion);
  const light = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (light.current)
      light.current.intensity =
        9 + (motion ? Math.sin(clock.elapsedTime * 0.55) * 1.2 : 0);
  });
  return (
    <group>
      <RoomShell width={28} depth={34} height={12} dark />
      <MuseumHeading
        title="A PLACE THAT REMEMBERS"
        subtitle="PRIVATE COLLECTION / A ROOM ALTERED BY YOUR PRESENCE."
        dark
      />
      <mesh position={[0, 0.08, -1]}>
        <cylinderGeometry args={[7.2, 7.2, 0.16, 80]} />
        <meshStandardMaterial color="#15232c" roughness={0.3} metalness={0.3} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <group key={i} position={[(i - 1) * 4, 0, -6]}>
          <Block
            position={[0, 2.7 + i * 0.4, 0]}
            scale={[0.45, 5.4 + i * 0.8, 0.45]}
            color={visits > i ? "#d3ecf5" : "#2c3f4a"}
            roughness={0.35}
          />
          {visits > i && (
            <pointLight
              position={[0, 4, 0]}
              color={ICE}
              intensity={4}
              distance={8}
            />
          )}
        </group>
      ))}
      <pointLight ref={light} position={[0, 5, -1]} color={ICE} distance={18} />
      <mesh position={[0, 3.2, -1]}>
        <sphereGeometry args={[1.18, 36, 24]} />
        <meshPhysicalMaterial
          color="#c5e7f4"
          transparent
          opacity={0.45}
          transmission={0.75}
          roughness={0.07}
          thickness={1.2}
          ior={1.46}
        />
      </mesh>
      <Label
        text={
          visits < 2
            ? "YOU HAVE BEEN HERE ONCE."
            : visits < 3
              ? "THE SECOND LIGHT IS FOR YOUR RETURN."
              : "THIS PLACE CONTINUES TO GROW WITH YOU."
        }
        position={[0, 2.2, -16.54]}
        color="#a6c5d5"
        size={0.3}
        maxWidth={22}
      />
      <Label
        text={`${String(viewed).padStart(2, "0")} WORKS REMEMBERED / ${String(visits).padStart(2, "0")} RETURNS`}
        position={[0, 1.4, -16.54]}
        color="#6d92a5"
        size={0.15}
      />
      {item && (
        <Exhibit
          item={item}
          position={[-9.6, 0, 2]}
          rotation={[0, Math.PI / 2, 0]}
          kind="screen"
        />
      )}
      <Exit dark />
    </group>
  );
}

const RULE_TITLES: Record<RoomRule, [string, string]> = {
  mirror: [
    "THE ECHO CHAMBER",
    "01 / MIRROR RULE        A REFLECTION IS ANOTHER WAY OF REMEMBERING.",
  ],
  gravity: [
    "ANOTHER ORIENTATION",
    "02 / GRAVITY RULE        MOVE SLOWLY. THE ARCHITECTURE WILL FOLLOW.",
  ],
  floating: [
    "BETWEEN TWO PLACES",
    "03 / FLOATING RULE        A PATH WITHOUT A GROUND.",
  ],
  compressing: [
    "THE DISTANCE WITHIN",
    "04 / COMPRESSION RULE        THE WORLD NARROWS AROUND A SINGLE THOUGHT.",
  ],
  impossible: [
    "MORE ROOM ON THE INSIDE",
    "05 / IMPOSSIBLE RULE        A SMALL DOOR. AN UNREASONABLE VOLUME.",
  ],
  loop: [
    "ALMOST THE SAME PLACE",
    "06 / LOOP RULE        RETURN, AND LOOK AGAIN.",
  ],
  memory: [
    "A PLACE THAT REMEMBERS",
    "07 / MEMORY RULE        YOUR PRESENCE IS PART OF THE COLLECTION.",
  ],
};

function GravityArchitecture() {
  const frame = useRef<THREE.Group>(null);
  const reduced = usePalaceStore((s) => s.reducedMotion);
  useFrame(({ camera }, dt) => {
    if (!frame.current) return;
    const progress = THREE.MathUtils.clamp((11 - camera.position.z) / 22, 0, 1);
    const target = reduced ? 0 : (-progress * Math.PI) / 2;
    frame.current.rotation.z = THREE.MathUtils.damp(
      frame.current.rotation.z,
      target,
      1.25,
      Math.min(dt, 0.05),
    );
  });
  return (
    <group ref={frame} position={[0, 4.5, 0]}>
      <Block position={[-9.2, 0, 0]} scale={[0.18, 9.2, 32]} color="#e7ece9" />
      <Block position={[9.2, 0, 0]} scale={[0.18, 9.2, 32]} color="#e7ece9" />
      <Block position={[0, 4.6, 0]} scale={[18.4, 0.18, 32]} color="#e7ece9" />
      <Block
        position={[0, -4.6, 0]}
        scale={[18.4, 0.18, 32]}
        color="#d5dedf"
        roughness={0.35}
      />
      {Array.from({ length: 8 }, (_, i) => (
        <group key={i} position={[0, 0, 10 - i * 3.5]}>
          <Block
            position={[-9, 0, 0]}
            scale={[0.16, 8.7, 0.18]}
            color="#bac8ce"
          />
          <Block
            position={[9, 0, 0]}
            scale={[0.16, 8.7, 0.18]}
            color="#bac8ce"
          />
          <Block
            position={[0, 4.35, 0]}
            scale={[18, 0.16, 0.18]}
            color="#bac8ce"
          />
          <Block
            position={[0, -4.35, 0]}
            scale={[18, 0.16, 0.18]}
            color="#bac8ce"
          />
        </group>
      ))}
    </group>
  );
}

function InvisibleWalkSurface() {
  return (
    <mesh
      position={[0, -0.035, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      onClick={(event) => {
        if (event.delta < 5 && usePalaceStore.getState().mode === "tour") {
          event.stopPropagation();
          setWalkTarget(event.point);
        }
      }}
    >
      <planeGeometry args={[18, 34]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

function AnomalyRoom({ rule, plan }: { rule: RoomRule; plan?: RoomPlan }) {
  const quality = usePalaceStore((s) => s.effectiveQuality);
  const visits = usePalaceStore(
    (s) => s.visits[plan?.id || `anomaly-${rule}`] || 1,
  );
  const item: ContentItem | undefined =
    plan?.item ||
    allContent.find((x) => x.roomRule === rule) ||
    experiments[0] ||
    projects[0];
  const [ruleTitle, ruleSubtitle] = RULE_TITLES[rule];
  const title =
    plan?.item || plan?.definition ? plan.title.toUpperCase() : ruleTitle;
  const subtitle =
    plan?.item || plan?.definition
      ? `${rule.toUpperCase()} STUDY / ${plan.subtitle}`
      : ruleSubtitle;
  if (rule === "memory")
    return <MemoryChamber roomId={plan?.id} item={plan?.item} />;
  return (
    <group>
      {rule === "floating" ? (
        <>
          <Block
            position={[0, -0.18, 0]}
            scale={[3.2, 0.16, 33]}
            color="#c6dfec"
            opacity={0.18}
            roughness={0.1}
          />
          {[-1.7, 1.7].map((x) => (
            <Block
              key={x}
              position={[x, 0.015, 0]}
              scale={[0.016, 0.022, 33]}
              color={ICE}
            />
          ))}
          <Block position={[0, 5, -17]} scale={[28, 10, 0.3]} color="#111d26" />
          <ambientLight intensity={0.65} color="#bed6e3" />
          {Array.from({ length: quality === "low" ? 6 : 12 }, (_, i) => (
            <mesh
              key={i}
              position={[
                Math.sin(i * 2.4) * (6 + (i % 3)),
                2 + (i % 4) * 1.6,
                8 - i * 2.4,
              ]}
              rotation={[i * 0.2, i * 0.4, 0.2]}
            >
              <boxGeometry args={[1 + (i % 2), 1 + (i % 2), 0.08]} />
              <meshStandardMaterial
                color="#c5d8e2"
                wireframe
                transparent
                opacity={0.3}
              />
            </mesh>
          ))}
        </>
      ) : (
        rule !== "gravity" && (
          <RoomShell
            width={rule === "impossible" ? 54 : 28}
            depth={rule === "impossible" ? 52 : 34}
            height={rule === "impossible" ? 17 : 10}
            dark={rule === "mirror"}
          />
        )
      )}
      <MuseumHeading
        title={title}
        subtitle={subtitle}
        dark={rule === "mirror" || rule === "floating"}
      />
      {(rule === "floating" || rule === "gravity") && <InvisibleWalkSurface />}
      {rule === "mirror" && (
        <>
          {Array.from({ length: quality === "low" ? 5 : 9 }, (_, i) => (
            <group key={i} position={[0, 0, 7 - i * 2.8]}>
              <Block
                position={[-8.5, 4, 0]}
                scale={[0.08, 8, 0.08]}
                color="#91b6c7"
              />
              <Block
                position={[8.5, 4, 0]}
                scale={[0.08, 8, 0.08]}
                color="#91b6c7"
              />
              <Block
                position={[0, 8, 0]}
                scale={[17, 0.08, 0.08]}
                color="#91b6c7"
              />
              {[-1, 1].map((side) => (
                <mesh key={side} position={[side * 7.9, 3.3, 0]}>
                  <torusKnotGeometry args={[0.72, 0.045, 64, 6]} />
                  <meshStandardMaterial
                    color={ICE}
                    transparent
                    opacity={Math.max(0.08, 0.64 - i * 0.055)}
                    roughness={0.25}
                  />
                </mesh>
              ))}
            </group>
          ))}
          <pointLight
            position={[0, 6, -8]}
            color={ICE}
            intensity={14}
            distance={25}
          />
        </>
      )}
      {rule === "gravity" && <GravityArchitecture />}
      {rule === "compressing" &&
        Array.from({ length: 9 }, (_, i) => {
          const width = 20 - i * 1.65;
          const height = 9 - i * 0.48;
          return (
            <group key={i} position={[0, 0, 10 - i * 3]}>
              <Block
                position={[-width / 2, height / 2, 0]}
                scale={[0.2, height, 0.32]}
                color="#d3dddf"
              />
              <Block
                position={[width / 2, height / 2, 0]}
                scale={[0.2, height, 0.32]}
                color="#d3dddf"
              />
              <Block
                position={[0, height, 0]}
                scale={[width, 0.2, 0.32]}
                color="#d3dddf"
              />
            </group>
          );
        })}
      {rule === "impossible" && (
        <>
          <Block position={[-9.5, 3, 11]} scale={[15, 6, 0.75]} color={PAPER} />
          <Block position={[9.5, 3, 11]} scale={[15, 6, 0.75]} color={PAPER} />
          <Block position={[0, 5.5, 11]} scale={[4, 1, 0.75]} color={PAPER} />
          {[-22, -11, 11, 22].map((x) => (
            <Block
              key={x}
              position={[x, 8, -13]}
              scale={[0.7, 16, 0.7]}
              color="#dde2df"
            />
          ))}
          <Label
            text="A room larger than its entrance."
            position={[0, 9.6, -25.6]}
            size={0.7}
            color="#a9b9c0"
            maxWidth={36}
          />
        </>
      )}
      {rule === "loop" && (
        <>
          <Label
            text={
              visits % 3 === 1
                ? "YOU MAY HAVE BEEN HERE BEFORE."
                : visits % 3 === 2
                  ? "THE OBJECT WAS CLOSER LAST TIME."
                  : "THE EXIT HAS ALWAYS BEEN HERE."
            }
            position={[0, 6.9, -7]}
            color="#8ca3af"
            size={0.23}
            maxWidth={17}
          />
          <mesh
            position={[visits % 3 === 2 ? 2.1 : -0.8, 2.6, -4]}
            rotation={[0, visits * 0.19, 0]}
          >
            <boxGeometry args={[1.5, 1.5, 1.5]} />
            <meshStandardMaterial
              color={visits % 3 === 0 ? "#b8d6e5" : "#d5dcd9"}
              roughness={0.5}
            />
          </mesh>
          <Block
            position={[visits % 3 === 2 ? 2.1 : -0.8, 0.8, -4]}
            scale={[2.3, 1.6, 2.3]}
            color="#e1e5e1"
          />
          <Door
            id={plan?.id || "anomaly-loop"}
            title="AGAIN"
            number={String(visits).padStart(2, "0")}
            position={[-9.3, 0, -15.6]}
          />
        </>
      )}
      {item && rule !== "loop" && (
        <Exhibit
          item={item}
          position={[
            0,
            rule === "floating" ? 0.8 : 0,
            rule === "impossible" ? -20 : -13,
          ]}
          kind={rule === "floating" ? "sculpture" : "poster"}
        />
      )}
      <Exit dark={rule === "mirror" || rule === "floating"} />
    </group>
  );
}

/** Configured rooms and single-work rooms use the same templates, without component edits. */
function ConfiguredGallery({ plan }: { plan: RoomPlan }) {
  const items = plan.item
    ? [plan.item]
    : allContent.filter((item) => item.roomType === plan.type).slice(0, 6);
  const central = plan.type === "installation";
  const archiveStyle = plan.type === "archive";
  return (
    <group>
      <RoomShell width={28} depth={34} height={11} dark={plan.dark} />
      <MuseumHeading
        title={plan.title.toUpperCase()}
        subtitle={plan.subtitle.toUpperCase()}
        dark={plan.dark}
      />
      {central && (
        <>
          <ContactShadow
            position={[0, 0.012, -3]}
            width={8}
            depth={8}
            opacity={0.24}
          />
          <Block
            position={[0, 0.2, -3]}
            scale={[5.8, 0.4, 5.8]}
            color="#e1e5e4"
          />
          <ThoughtSculpture nodes={plan.item?.category === "experiment"} />
          {plan.item?.cover && (
            <Picture
              src={plan.item.cover}
              width={8.5}
              height={4.4}
              position={[0, 2.8, -16.48]}
            />
          )}
        </>
      )}
      {archiveStyle &&
        [-8.8, 8.8].map((x) => (
          <group key={x}>
            {[0, 4.5, 9].map((z) => (
              <Block
                key={z}
                position={[x, 3.5, z - 9]}
                scale={[0.07, 7, 0.07]}
                color="#8e9da4"
                metalness={0.5}
              />
            ))}
            <Block
              position={[x, 7, -4.5]}
              scale={[0.07, 0.07, 9]}
              color="#8e9da4"
            />
          </group>
        ))}
      {items.map((item, i) => {
        const single = items.length === 1;
        const side = i % 2 === 0 ? -1 : 1;
        return (
          <group
            key={item.id}
            position={
              single
                ? [0, 0, central ? -10.5 : -9]
                : [side * 10.4, 0, 7 - Math.floor(i / 2) * 8.6]
            }
            rotation={
              single
                ? [0, 0, 0]
                : [0, side === -1 ? Math.PI / 2 : -Math.PI / 2, 0]
            }
            scale={single && !central ? [1.8, 1.05, 1] : [1, 1, 1]}
          >
            <Exhibit
              item={item}
              index={i}
              kind={
                archiveStyle
                  ? "wireframe"
                  : item.category === "research"
                    ? "poster"
                    : "screen"
              }
            />
          </group>
        );
      })}
      {plan.dark && (
        <pointLight
          position={[0, 5, -6]}
          color={ICE}
          intensity={20}
          distance={20}
          decay={2}
        />
      )}
      <Exit dark={plan.dark} />
    </group>
  );
}

export function GalleryRoom({ roomId }: { roomId: string }) {
  const plan = resolveRoomPlan(roomId);
  if (
    plan.rule &&
    (roomId.startsWith("anomaly-") ||
      plan.item ||
      plan.definition?.type === "anomaly")
  ) {
    return (
      <AnomalyRoom
        rule={RULE_TITLES[plan.rule] ? plan.rule : "mirror"}
        plan={plan}
      />
    );
  }
  const wing = /^(projects|research|experiments|archive)(?:-page-(\d+))?$/.exec(
    roomId,
  );
  const page = Math.max(0, (Number(wing?.[2]) || 1) - 1);
  if (wing?.[1] === "research")
    return (
      <ResearchGallery
        page={Math.min(page, Math.max(0, Math.ceil(research.length / 6) - 1))}
      />
    );
  if (wing?.[1] === "experiments")
    return (
      <ExperimentGallery
        page={Math.min(
          page,
          Math.max(0, Math.ceil(experiments.length / 6) - 1),
        )}
      />
    );
  if (wing?.[1] === "archive")
    return (
      <UnfinishedGallery
        page={Math.min(page, Math.max(0, Math.ceil(archive.length / 6) - 1))}
      />
    );
  if (roomId === "memory") return <MemoryChamber />;
  if (
    plan.item ||
    (plan.definition &&
      !["projects", "research", "experiments", "archive"].includes(roomId))
  )
    return <ConfiguredGallery plan={plan} />;
  return (
    <ProjectGallery
      page={Math.min(page, Math.max(0, Math.ceil(projects.length / 6) - 1))}
    />
  );
}

export default GalleryRoom;
