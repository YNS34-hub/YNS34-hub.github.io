import { Block, Floor, Label } from "../world/primitives";
import { museum } from "../world/artDirection";
import type { ArtPlacement } from "../world/spatialLayout";

/** A load-bearing museum shell: recessed roof, deep reveals, and open sight lines. */
export function RoomShell({
  dark = false,
  warm = false,
  width = 28,
  depth = 34,
  height = 9,
  open = false,
  palette,
}: {
  dark?: boolean;
  warm?: boolean;
  width?: number;
  depth?: number;
  height?: number;
  open?: boolean;
  palette?: string;
}) {
  const colors: Record<string, [string, string, string]> = {
    projects: ["#34435b", "#172740", "#253246"],
    research: ["#202c39", "#131d2a", "#182a35"],
    music: ["#10203f", "#090f24", "#101b30"],
    wallpapers: ["#202c35", "#121b25", "#1c2730"],
    archive: ["#3a4944", "#222b29", "#303b37"],
    unfinished: ["#1b222b", "#10171f", "#222a32"],
    collection: ["#253e4d", "#142835", "#20313b"],
    liquid: ["#244447", "#101e28", "#193039"],
    editorial: ["#57452e", "#221e1c", "#39302b"],
  };
  const selected = palette ? colors[palette] : undefined;
  const concrete =
    selected?.[0] || (dark ? museum.charcoal : warm ? "#d8d3c7" : museum.wall);
  const ceiling = selected?.[1] || (dark ? "#1d211f" : museum.ceiling);
  const floor =
    selected?.[2] || (dark ? "#454e4d" : warm ? "#b7b2a8" : museum.floor);
  return (
    <group>
      {!open && <Floor width={width} depth={depth} color={floor} />}
      <Block
        position={[0, height / 2, -depth / 2]}
        scale={[width + 0.9, height, 0.7]}
        color={concrete}
      />
      <Block
        position={[-width / 2, height / 2, 0]}
        scale={[0.7, height, depth]}
        color={concrete}
      />
      <Block
        position={[width / 2, height / 2, 0]}
        scale={[0.7, height, depth]}
        color={concrete}
      />
      <Block
        position={[0, height, -depth * 0.27]}
        scale={[width, 0.4, depth * 0.46]}
        color={ceiling}
        castShadow
      />
      <Block
        position={[0, height, depth * 0.27]}
        scale={[width, 0.4, depth * 0.46]}
        color={ceiling}
        castShadow
      />
      <Block
        position={[0, height + 0.42, 0]}
        scale={[width - 1.6, 0.05, depth * 0.08]}
        color={dark && warm ? "#e5c9a3" : "#e2ecec"}
        emissive={dark && warm ? "#dcc7a3" : "#d0e2ec"}
        emissiveIntensity={dark ? 0.4 : 0.6}
      />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Block
            position={[side * (width / 2 - 0.36), 0.11, 0]}
            scale={[0.04, 0.09, depth]}
            color={dark ? "#131817" : museum.joint}
            roughness={0.5}
          />
          <Block
            position={[side * (width / 2 - 0.16), height - 0.6, 0]}
            scale={[0.4, 0.65, depth]}
            color={ceiling}
          />
          {[-depth * 0.32, 0, depth * 0.32].map((z) => (
            <Block
              key={z}
              position={[side * (width / 2 - 0.35), height / 2, z]}
              scale={[0.36, height - 0.12, 0.32]}
              color={dark ? "#353b36" : "#d6d5ce"}
              castShadow
            />
          ))}
        </group>
      ))}
      {Array.from(
        { length: Math.max(2, Math.floor(width / 6)) },
        (_, i) => -width / 2 + 3 + i * 6,
      ).map((x) => (
        <Block
          key={x}
          position={[x, height - 0.3, 0]}
          scale={[0.2, 0.72, depth]}
          color={ceiling}
          castShadow
        />
      ))}
      {!dark &&
        !open &&
        Array.from(
          { length: Math.floor(depth / 5) },
          (_, i) => -depth / 2 + (i + 1) * 5,
        ).map((z) => (
          <Block
            key={z}
            position={[0, 0.006, z]}
            scale={[width, 0.004, 0.007]}
            color="#b4bbb4"
          />
        ))}
      <Label
        text="THE MEMORY PALACE"
        position={[-width / 2 + 0.39, 1.5, depth / 2 - 3]}
        rotation={[0, Math.PI / 2, 0]}
        size={0.14}
        color={dark ? "#768786" : "#667c77"}
      />
      {/* A dark joint under the wall and a deep ceiling reveal give the shell a scale. */}
      <Block
        position={[0, 0.1, -depth / 2 + 0.36]}
        scale={[width, 0.08, 0.04]}
        color={museum.joint}
      />
      <Block
        position={[0, height - 0.22, -depth / 2 + 0.38]}
        scale={[width, 0.12, 0.08]}
        color={dark ? "#161a18" : museum.reveal}
      />
    </group>
  );
}

/** An asymmetric long wall and two shifted roof fields frame one dominant screen. */
export function ProjectArchitecture() {
  return (
    <group>
      <Floor width={28} depth={34} color="#23364d" />
      <Block
        position={[-13.8, 5.4, 0]}
        scale={[0.7, 10.8, 34]}
        color="#536879"
      />
      <Block
        position={[13.8, 6.6, -4]}
        scale={[0.7, 13.2, 26]}
        color="#1c3049"
      />
      <Block
        position={[0, 5.7, -16.8]}
        scale={[28, 11.4, 0.8]}
        color="#334b60"
      />
      <Block
        position={[-5, 10.9, -4]}
        scale={[18, 0.65, 27]}
        color="#142e48"
        castShadow
      />
      <Block
        position={[9, 13.3, -4]}
        scale={[9, 0.7, 27]}
        color="#314d65"
        castShadow
      />
      <Block
        position={[4.2, 12.2, -4]}
        scale={[0.06, 0.1, 28]}
        color="#d2ebf4"
        emissive="#bfdfed"
        emissiveIntensity={0.6}
      />
      <Block
        position={[6.8, 4.2, -10]}
        scale={[0.45, 8.4, 8.5]}
        color="#48607a"
      />
      <Block position={[-8, 0.12, 2]} scale={[4, 0.24, 9]} color="#263e50" />
      <Block
        position={[-13.38, 0.16, 0]}
        scale={[0.06, 0.12, 33]}
        color="#0f2236"
      />
    </group>
  );
}

/** Individual image walls are sized from the selected works, rather than a fixed five-slot cube. */
export function ImageArchitecture({
  placements,
  intimate = false,
  editorial = false,
}: {
  placements: ArtPlacement[];
  intimate?: boolean;
  editorial?: boolean;
}) {
  return (
    <group>
      <Floor width={28} depth={34} color={intimate ? "#564637" : "#223748"} />
      <Block
        position={[0, intimate ? 4.4 : 6.1, -16.8]}
        scale={[28, intimate ? 8.8 : 12.2, 0.8]}
        color={intimate ? "#746454" : "#374b5a"}
      />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Block
            position={[side * 13.8, 4.6, 0]}
            scale={[0.7, 9.2, 34]}
            color={intimate ? "#584b3d" : "#172c40"}
          />
          <Block
            position={[side * 8.2, 9.1, -2]}
            scale={[11, 0.48, 30]}
            color={intimate ? "#433b33" : "#1b3247"}
            castShadow
          />
        </group>
      ))}
      <Block
        position={[0, 10.3, -4]}
        scale={[5.8, 0.035, 27]}
        color={intimate ? "#eddbbf" : "#c5e5f5"}
        emissive={intimate ? "#d6bc95" : "#bddeed"}
        emissiveIntensity={0.4}
      />
      {editorial && (
        <>
          <Block
            position={[-10, 3.1, 7]}
            scale={[5, 6.2, 0.6]}
            color="#675039"
            castShadow
          />
          <Block
            position={[-3.7, 6.45, 7]}
            scale={[18, 0.55, 1]}
            color="#997b57"
            castShadow
          />
          <Block
            position={[0, 6.14, 7]}
            scale={[11, 0.035, 0.12]}
            color="#e9d0a8"
            emissive="#e5c392"
            emissiveIntensity={0.28}
          />
        </>
      )}
      {placements.map((p, i) => (
        <group
          key={p.id}
          position={[p.position[0], 0, p.position[2] - 0.3]}
          rotation={p.rotation}
        >
          <Block
            position={[0, (p.height + 1.9) / 2, 0]}
            scale={[p.width + 0.65, p.height + 1.9, 0.42]}
            color={intimate ? (i % 2 ? "#645547" : "#a7937c") : "#344b60"}
            castShadow
          />
          <Block
            position={[0, 0.09, 0]}
            scale={[p.width + 0.7, 0.18, 0.86]}
            color={intimate ? "#493b30" : "#243e51"}
          />
          <Block
            position={[0, p.height + 1.72, 0.1]}
            scale={[p.width + 0.5, 0.04, 0.15]}
            color={intimate ? "#e7c99e" : "#b7d7e9"}
            emissive={intimate ? "#d7bb91" : "#b7d7e9"}
            emissiveIntensity={0.2}
          />
        </group>
      ))}
    </group>
  );
}

export function ObservatoryArchitecture() {
  return (
    <group>
      <Floor width={28} depth={34} color="#152841" />
      <Block position={[0, -0.55, 0]} scale={[28, 1, 34]} color="#283b55" />
      <Block position={[0, -0.44, -21.5]} scale={[8, 0.8, 9]} color="#30485d" />
      <group position={[0, 0, -21.5]}>
        <Floor width={8} depth={9} color="#21394d" />
      </group>
      {/* Massive, remote volumes establish a scale drop below the suspended deck. */}
      {[-1, 1].map((side) => (
        <group key={side}>
          <Block
            position={[side * 27, -9, -32]}
            scale={[15, 15, 50]}
            color="#203b56"
          />
          <Block
            position={[side * 13.7, 0.6, -1]}
            scale={[0.12, 1.2, 28]}
            color="#5d86a0"
            opacity={0.36}
            metalness={0.15}
          />
          <Block
            position={[side * 13.7, 1.23, -1]}
            scale={[0.13, 0.06, 28]}
            color="#a6cadc"
            roughness={0.3}
            metalness={0.7}
          />
          <Block
            position={[side * 6.7, 4.15, 1]}
            scale={[0.65, 8.3, 1.1]}
            color="#46647e"
            castShadow
          />
          <Block
            position={[side * 6.7, 0.16, 1]}
            scale={[1.1, 0.32, 1.6]}
            color="#253e54"
          />
          <Block
            position={[side * 4.16, 0.62, -21.5]}
            scale={[0.075, 1.24, 9]}
            color="#31495f"
          />
          <Block
            position={[side * 4.16, 1.25, -21.5]}
            scale={[0.1, 0.06, 9]}
            color="#91b6ca"
            metalness={0.6}
          />
          <Block
            position={[side * 8.9, 0.61, -16.85]}
            scale={[9.3, 1.22, 0.08]}
            color="#31495f"
          />
          <Block
            position={[side * 8.9, 1.24, -16.85]}
            scale={[9.3, 0.05, 0.1]}
            color="#91b6ca"
            metalness={0.6}
          />
        </group>
      ))}
      <Block
        position={[0, 8.3, 1]}
        scale={[14, 0.48, 1.1]}
        color="#446581"
        castShadow
      />
      <Block
        position={[0, 8.03, 0.6]}
        scale={[12.8, 0.025, 0.035]}
        color="#ddc29a"
        emissive="#bc9670"
        emissiveIntensity={0.3}
      />
      <Block
        position={[-10.5, 6.8, 7]}
        scale={[1.2, 13.6, 1.2]}
        color="#2f4b66"
        castShadow
      />
      <Block
        position={[11, 6.8, 7]}
        scale={[1.2, 13.6, 1.2]}
        color="#2f4b66"
        castShadow
      />
      <Block position={[0, 13.6, 7]} scale={[23, 0.7, 1.2]} color="#406583" />
      <Block
        position={[0, 0.014, -14.8]}
        scale={[27, 0.025, 0.055]}
        color="#a6cadc"
        emissive="#7095b4"
        emissiveIntensity={0.25}
      />
    </group>
  );
}

export function ResearchArchitecture() {
  return (
    <group>
      <Floor width={28} depth={34} color="#26343d" />
      {[-1, 1].map((side) => (
        <Block
          key={side}
          position={[side * 13.8, 4.5, 0]}
          scale={[0.7, 9, 34]}
          color="#374753"
        />
      ))}
      <Block position={[0, 4.5, -16.8]} scale={[28, 9, 0.7]} color="#253b4b" />
      {[-8, 0, 8].map((x) => (
        <group key={x}>
          <Block
            position={[x, 9.2, 0]}
            scale={[7.4, 0.6, 34]}
            color="#132733"
            castShadow
          />
          <Block
            position={[x + 3.85, 9.65, 0]}
            scale={[0.2, 0.04, 33]}
            color="#cfe7ef"
            emissive="#ccdde2"
            emissiveIntensity={0.5}
          />
        </group>
      ))}
      <Block
        position={[0, 0.012, 0]}
        scale={[0.008, 0.006, 31]}
        color="#7f9eaf"
      />
    </group>
  );
}

export function ArchiveArchitecture({
  unfinished = false,
}: {
  unfinished?: boolean;
}) {
  return (
    <group>
      <Floor
        width={28}
        depth={unfinished ? 25 : 32}
        color={unfinished ? "#253543" : "#3e4943"}
      />
      <Block
        position={[0, 4.5, unfinished ? -12 : -16]}
        scale={[28, 9, 0.55]}
        color={unfinished ? "#203343" : "#47574b"}
      />
      {[-1, 1].map((side) => (
        <Block
          key={side}
          position={[side * 13.8, 4.5, -1]}
          scale={[0.6, 9, unfinished ? 24 : 32]}
          color={unfinished ? "#344655" : "#38473f"}
        />
      ))}
      {Array.from({ length: unfinished ? 4 : 6 }, (_, i) => (
        <group key={i} position={[0, 0, 9 - i * (unfinished ? 5 : 5.2)]}>
          <Block
            position={[-11, 4.7, 0]}
            scale={[0.42, 9.4, 0.7]}
            color={unfinished ? "#658299" : "#667162"}
          />
          <Block
            position={[11, 4.7, 0]}
            scale={[0.42, 9.4, 0.7]}
            color={unfinished ? "#658299" : "#667162"}
          />
          <Block
            position={[0, 9.4, 0]}
            scale={[22.5, 0.5, 0.7]}
            color={unfinished ? "#476179" : "#414f43"}
            castShadow
          />
        </group>
      ))}
      {!unfinished && (
        <Block
          position={[0, 10.1, -3]}
          scale={[5, 0.03, 28]}
          color="#dbd5ba"
          emissive="#c5bd9b"
          emissiveIntensity={0.25}
        />
      )}
    </group>
  );
}
