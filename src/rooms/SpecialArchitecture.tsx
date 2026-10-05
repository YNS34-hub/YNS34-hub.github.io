import {
  Block,
  ContactShadow,
  Label,
  Picture,
  useImageTexture,
} from "../world/primitives";
import type { ContentItem } from "../content/types";

/** Tapered solid walls, rather than a perspective trick drawn with shrinking outlines. */
export function CompressionArchitecture() {
  return (
    <group>
      {Array.from({ length: 8 }, (_, i) => {
        const width = 20 - i * 1.825;
        const height = 9 - i * 0.59;
        const slope = Math.atan(0.9125 / 3);
        return (
          <group key={i} position={[0, 0, 8.5 - i * 3]}>
            {[-1, 1].map((side) => (
              <group key={side}>
                <Block
                  position={[side * (width / 2 - 0.456), height / 2 - 0.148, 0]}
                  rotation={[0, side * slope, 0]}
                  scale={[0.32, height - 0.295, 3.15]}
                  color="#d7d8d0"
                  castShadow
                />
                <Block
                  position={[side * (width / 2 - 0.6), 0.1, 0]}
                  rotation={[0, side * slope, 0]}
                  scale={[0.035, 0.08, 3.15]}
                  color="#8e9a95"
                />
              </group>
            ))}
            <Block
              position={[0, height - 0.295, 0]}
              rotation={[-Math.atan(0.59 / 3), 0, 0]}
              scale={[width - 0.9, 0.2, 3.06]}
              color="#b6c0bb"
              castShadow
            />
            <Block
              position={[0, height - 0.43, -1.35]}
              scale={[width - 1.1, 0.035, 0.1]}
              color="#e4ece6"
              emissive="#daeaf1"
              emissiveIntensity={0.35}
            />
          </group>
        );
      })}
    </group>
  );
}

/** Paired, repeated architecture substitutes for recursively rendered mirrors. */
export function MirrorArchitecture({
  item,
  low,
}: {
  item?: ContentItem;
  low: boolean;
}) {
  const print = useImageTexture(item?.cover);
  return (
    <group>
      {Array.from({ length: low ? 4 : 6 }, (_, i) => (
        <group key={i} position={[0, 0, 7.4 - i * 4.1]}>
          {[-1, 1].map((side) => (
            <group key={side}>
              <Block
                position={[side * 8.5, 4.25, 0]}
                scale={[0.16, 8.5, 0.28]}
                color="#a1b5b7"
                metalness={0.55}
                roughness={0.28}
              />
              <Block
                position={[side * 10.55, 3.5, -0.05]}
                scale={[3.7, 7, 0.09]}
                color="#56706c"
                metalness={0.88}
                roughness={0.2}
                opacity={0.8}
              />
              {item?.cover && (
                <Picture
                  texture={print}
                  width={2.9}
                  height={2.2}
                  position={[side * 10.55, 3.5, 0.011]}
                  museumPrint
                />
              )}
              <Label
                text={i % 2 ? "REFLECTION / 02" : "REFLECTION / 01"}
                position={[side * 10.55, 1.9, 0.03]}
                size={0.095}
                color="#bdd0c8"
              />
            </group>
          ))}
          <Block
            position={[0, 8.5, 0]}
            scale={[17, 0.15, 0.28]}
            color="#a1b5b7"
            metalness={0.55}
            roughness={0.28}
          />
          <Block
            position={[0, 0.015, 0]}
            scale={[17, 0.015, 0.11]}
            color="#859996"
          />
          <ContactShadow
            position={[0, 0.02, 0]}
            width={16}
            depth={3}
            opacity={0.16}
          />
        </group>
      ))}
      <pointLight
        position={[0, 6, -4]}
        color="#d9ede7"
        intensity={120}
        distance={26}
        decay={2}
      />
    </group>
  );
}

export function ImpossibleArchitecture() {
  return (
    <group>
      {/* A domestic-sized threshold opens onto a monumental, offset series of inner courts. */}
      {[-1, 1].map((side) => (
        <group key={side}>
          <Block
            position={[side * 2.05, 2.38, 10.58]}
            scale={[0.16, 4.76, 1.25]}
            color="#969f99"
            metalness={0.12}
            roughness={0.46}
            castShadow
          />
          <Block
            position={[side * 13, 7.2, -10]}
            scale={[0.75, 14.4, 0.75]}
            color="#d6d8d0"
            castShadow
          />
          <Block
            position={[side * 20, 11.5, -19.4]}
            scale={[0.5, 23, 0.7]}
            color="#bac5c0"
            castShadow
          />
        </group>
      ))}
      <Block
        position={[0, 4.76, 10.58]}
        scale={[4.26, 0.16, 1.25]}
        color="#969f99"
        metalness={0.12}
        roughness={0.46}
        castShadow
      />
      <Label
        text="05 / INTERIOR VOLUME"
        position={[0, 5.88, 11.41]}
        size={0.115}
        color="#53665e"
      />
      {Array.from({ length: 4 }, (_, i) => (
        <group
          key={i}
          position={[i * 1.3 - 1.95, 0, -4 - i * 5.4]}
          rotation={[0, 0, i * 0.045]}
        >
          {[-1, 1].map((side) => (
            <Block
              key={side}
              position={[side * (12 - i), 8.9, 0]}
              scale={[0.23, 17.8, 0.52]}
              color="#bdcac6"
              castShadow
            />
          ))}
          <Block
            position={[0, 17.8, 0]}
            scale={[24 - i * 2, 0.23, 0.52]}
            color="#bdcac6"
            castShadow
          />
          <Block
            position={[0, 11.9, -0.13]}
            scale={[24 - i * 2, 0.035, 0.12]}
            color="#e4f0ef"
            emissive="#e0ecf5"
            emissiveIntensity={0.4}
          />
        </group>
      ))}
    </group>
  );
}
