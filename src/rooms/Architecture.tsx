import { Block, Floor, Label } from "../world/primitives";
import { museum } from "../world/artDirection";

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
