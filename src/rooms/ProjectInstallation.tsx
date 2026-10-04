import { useEffect, useRef, useState } from "react";
import type { Group } from "three";
import type { ContentItem } from "../content/types";
import { usePalaceStore } from "../systems/store";
import { Block, ContactShadow, Label, Picture } from "../world/primitives";
import { registerProximity } from "../world/proximity";

/** A full-size product document held in a thin architectural frame. */
export function ProjectInstallation({ item }: { item: ContentItem }) {
  const frame = useRef<Group>(null);
  const [hovered, setHovered] = useState(false);
  useEffect(
    () =>
      frame.current
        ? registerProximity(
            `installation:${item.id}`,
            frame.current,
            item.title,
            7,
          )
        : undefined,
    [item.id, item.title],
  );
  return (
    <group
      ref={frame}
      position={[0, 0, -4.8]}
      onClick={(event) => {
        if (event.delta > 5) return;
        event.stopPropagation();
        usePalaceStore.getState().focusItem(item);
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      <ContactShadow width={10.2} depth={4.5} opacity={0.32} />
      <Block
        position={[0, 0.11, 0]}
        scale={[9.2, 0.2, 1.65]}
        color="#a9b3ad"
        roughness={0.38}
        castShadow
      />
      <Block
        position={[0, 3.8, 0]}
        scale={[8.65, 5.55, 0.2]}
        color="#909e9c"
        metalness={0.45}
        roughness={0.46}
        castShadow
      />
      <Block
        position={[0, 3.8, 0.105]}
        scale={[8.48, 5.39, 0.02]}
        color="#e1e5df"
        roughness={0.85}
      />
      <Picture
        src={item.cover}
        width={8.35}
        height={5.22}
        position={[0, 3.8, 0.12]}
        museumPrint
      />
      {[-3.85, 3.85].map((x) => (
        <Block
          key={x}
          position={[x, 0.67, -0.06]}
          scale={[0.06, 1.23, 0.16]}
          color="#7b8987"
          metalness={0.65}
          roughness={0.45}
        />
      ))}
      <Label
        text={item.title.toUpperCase()}
        position={[0, 0.59, 0.135]}
        size={0.14}
        color="#405659"
      />
      <Label
        text={
          hovered ? "VIEW THE WORK  ↗" : "FEATURED WORK / A DOCUMENT IN SPACE"
        }
        position={[0, 0.32, 0.14]}
        size={0.08}
        color="#748580"
      />
    </group>
  );
}
