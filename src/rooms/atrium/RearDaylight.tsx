import { EntryBlock as Stone } from "./surfaces";

export default function RearDaylight() {
  return <group name="atrium-rear-daylight-facade">
    <Stone position={[0, 13.45, -25.5]} scale={[42, 2.3, .8]} color="#19314c" />
    <Stone position={[0, 1.8, -25.5]} scale={[8, 3.6, .8]} color="#19314c" />
    {[-1, 1].map(side => <group key={side}>
      <Stone position={[side * 12.3, .7, -25.5]} scale={[14, 1.4, .8]} color="#19314c" />
      <Stone position={[side * 20, 6.85, -25.5]} scale={[1.3, 10.9, .8]} color="#d0e4eb" />
      <mesh position={[side * 12.3, 6.85, -25.34]}>
        <planeGeometry args={[13.8, 10.9]} /><meshPhysicalMaterial color="#edf5fa" transparent opacity={.1} depthWrite={false} roughness={.04} metalness={0} ior={1.46} envMapIntensity={.7} />
      </mesh>
      <Stone position={[side * 12.3, 1.45, -25.05]} scale={[14.1, .08, .5]} color="#8797a2" roughness={.45} metalness={.5} />
      {[5.35, 12.3, 19.25].map(x => <Stone key={x} position={[side * x, 6.85, -25.1]} scale={[.075, 10.9, .18]} color="#a8cfe5" />)}
    </group>)}
    <mesh position={[0, 6.82, -25.34]}>
      <planeGeometry args={[8, 6.44]} /><meshPhysicalMaterial color="#edf5fa" transparent opacity={.08} depthWrite={false} roughness={.035} metalness={0} ior={1.46} envMapIntensity={.6} />
    </mesh>
  </group>;
}
