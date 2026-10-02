import { Block, Floor, Label } from "../world/primitives";

/** A load-bearing museum shell: recessed roof, deep reveals, and open sight lines. */
export function RoomShell({
  dark = false,
  warm = false,
  width = 28,
  depth = 34,
  height = 9,
  open = false,
}: {
  dark?: boolean;
  warm?: boolean;
  width?: number;
  depth?: number;
  height?: number;
  open?: boolean;
}) {
  const concrete = dark ? "#1f2526" : warm ? "#d5d0c5" : "#e3e6e2";
  const floor = dark ? "#151b1e" : warm ? "#91877a" : "#d1d8d5";
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
        color={concrete}
        castShadow
      />
      <Block
        position={[0, height, depth * 0.27]}
        scale={[width, 0.4, depth * 0.46]}
        color={concrete}
        castShadow
      />
      <Block
        position={[0, height + 0.42, 0]}
        scale={[width - 1.6, 0.05, depth * 0.08]}
        color={dark ? "#e5c9a3" : "#f2f7f3"}
        emissive={dark ? "#dcc7a3" : "#e3f3fb"}
        emissiveIntensity={dark ? 0.4 : 0.6}
      />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Block
            position={[side * (width / 2 - 0.28), 0.2, 0]}
            scale={[0.06, 0.12, depth]}
            color={dark ? "#363d3c" : "#abb9b6"}
          />
          <Block
            position={[side * (width / 2 - 0.16), height - 0.6, 0]}
            scale={[0.4, 0.65, depth]}
            color={concrete}
          />
          {[-depth * 0.32, 0, depth * 0.32].map((z) => (
            <Block
              key={z}
              position={[side * (width / 2 - 0.35), height / 2, z]}
              scale={[0.3, height, 0.23]}
              color={dark ? "#282d2d" : "#dadfda"}
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
          scale={[0.16, 0.62, depth]}
          color={concrete}
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
            scale={[width, 0.012, 0.012]}
            color="#abb8b6"
          />
        ))}
      <Label
        text="THE MEMORY PALACE"
        position={[-width / 2 + 0.39, 1.5, depth / 2 - 3]}
        rotation={[0, Math.PI / 2, 0]}
        size={0.14}
        color={dark ? "#768786" : "#667c77"}
      />
    </group>
  );
}
