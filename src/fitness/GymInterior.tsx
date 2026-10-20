import {useEffect,useLayoutEffect,useMemo,useRef} from 'react';
import {Color,InstancedMesh,Object3D} from 'three';
import {Block,ContactShadow,Label} from '../world/primitives';
import {usePalaceStore} from '../systems/store';
import {createGymSurfaces} from './surfaces';

function ArchiveSlats(){
 const mesh=useRef<InstancedMesh>(null);
 useLayoutEffect(()=>{
  if(!mesh.current)return;const object=new Object3D(),color=new Color();
  for(let i=0;i<72;i++){
   const side=i<36?-1:1,index=i%36;object.position.set(side*(7.02+index*.15),3.65,-14.73);object.updateMatrix();mesh.current.setMatrixAt(i,object.matrix);
   color.set('#92714c').multiplyScalar(.92+(index%5)*.035);mesh.current.setColorAt(i,color);
  }
  mesh.current.instanceMatrix.needsUpdate=true;if(mesh.current.instanceColor)mesh.current.instanceColor.needsUpdate=true;
 },[]);
 return <instancedMesh ref={mesh} args={[undefined,undefined,72]} name="gym-archive-oak-slats" receiveShadow>
  <boxGeometry args={[.075,6.65,.09]}/><meshStandardMaterial color="#ffffff" roughness={.8}/>
 </instancedMesh>;
}

/** A private training studio: oak circulation, rubber work zone and a real local-media wall. */
export default function GymInterior(){
 const surfaces=useMemo(createGymSurfaces,[]),target=useMemo(()=>{const object=new Object3D();object.position.set(0,.75,-4);return object;},[]),tier=usePalaceStore(s=>s.effectiveQuality);
 useEffect(()=>{surfaces.activate();return()=>surfaces.dispose();},[surfaces]);
 return <group name="private-gym-interior">
  <mesh position={[0,-.006,0]} rotation={[-Math.PI/2,0,0]} receiveShadow><planeGeometry args={[25,31]}/><meshStandardMaterial {...surfaces.oak} color="#ffffff" roughness={1} normalScale={[.42,.42]}/></mesh>
  <Block position={[0,3.6,-15.1]} scale={[25,7.2,.3]} color="#c8bda6" roughness={.96}/>
  <Block position={[-12.6,3.6,0]} scale={[.3,7.2,31]} color="#d0c8b5" roughness={.96}/>
  <Block position={[12.6,3.6,0]} scale={[.3,7.2,31]} color="#a9b2a3" roughness={.96}/>
  <Block position={[0,7.25,0]} scale={[25,.2,31]} color="#d0c9b8" roughness={.96}/>
  <Block position={[0,3.65,-14.91]} scale={[13.8,6.65,.10]} color="#3f5048" roughness={.92}/>
  <Block position={[0,.23,-14.80]} scale={[25,.44,.12]} color="#75654d" roughness={.88}/>
  <ArchiveSlats/>
  <Block position={[0,6.97,-14.69]} scale={[13.8,.035,.06]} color="#dbc7a0" emissive="#ffe0ac" emissiveIntensity={1.3}/>
  <rectAreaLight position={[0,6.5,-13.5]} width={11.5} height={.6} intensity={3} color="#ffe0ae"/>
  <mesh position={[0,.021,-4]} rotation={[-Math.PI/2,0,0]} receiveShadow><planeGeometry args={[6.4,7.2]}/><meshStandardMaterial {...surfaces.rubber} color="#ffffff" roughness={1} normalScale={[.18,.18]}/></mesh>
  <Block position={[0,.026,-4]} scale={[3,.018,3.1]} color="#566553" roughness={.97}/>
  {[-1,1].map(side=><group key={side}>
   <Block position={[side*3.22,.014,-4]} scale={[.045,.035,7.26]} color="#7d8069" roughness={.9}/>
   <Block position={[0,.014,-4+side*3.62]} scale={[6.4,.035,.045]} color="#7d8069" roughness={.9}/>
   <Block position={[side*12.38,.18,0]} scale={[.10,.35,30]} color="#6c6b58" roughness={.9}/>
  </group>)}
  <ContactShadow position={[0,.038,-4.05]} width={1.4} depth={1.8} opacity={.23}/>
  <ContactShadow position={[-9,.012,-6]} width={2.1} depth={6.3} opacity={.27}/>
  <ContactShadow position={[-9,.012,5]} width={4.3} depth={1.6} opacity={.20}/>
  {[-4.2,4.2].map(x=><group key={x}>
   <Block position={[x,6.94,-5]} scale={[1.3,.13,13]} color="#4b5249" roughness={.8}/>
   <Block position={[x,6.86,-5]} scale={[1.04,.025,12.7]} color="#ebe0c9" emissive="#fff0d5" emissiveIntensity={.75}/>
   <rectAreaLight position={[x,6.80,-5]} rotation={[-Math.PI/2,0,0]} width={1.04} height={12.7} intensity={2.2} color="#ffe9c9"/>
  </group>)}
  {[-11,-2,7].map(z=><Block key={z} position={[0,7.02,z]} scale={[25,.29,.18]} color="#83745e" roughness={.85}/>)}
  <Block position={[-12.42,4,0]} scale={[.035,3.8,8.5]} color="#cad7cf" emissive="#e7efe1" emissiveIntensity={.5}/>
  {[-4.25,-2.1,0,2.1,4.25].map(z=><Block key={z} position={[-12.33,4,z]} scale={[.13,4.02,.075]} color="#5c6b61" metalness={.35} roughness={.45}/>)}
  {[2.1,4.0,5.9].map(y=><Block key={y} position={[-12.31,y,0]} scale={[.13,.075,8.5]} color="#5c6b61" metalness={.35} roughness={.45}/>)}
  <rectAreaLight position={[-12.20,4,0]} rotation={[0,Math.PI/2,0]} width={8} height={3.8} intensity={4} color="#e6efdf"/>
  <primitive object={target}/>
  <spotLight name="gym-training-key" position={[-2,6.2,-.6]} target={target} intensity={58} distance={17} angle={.64} penumbra={.65} decay={2} color="#fff0d8" castShadow={tier!=='low'} shadow-mapSize={tier==='high'?[1024,1024]:[512,512]} shadow-bias={-.0001} shadow-normalBias={.006} shadow-camera-near={.5} shadow-camera-far={18}/>
  <Block position={[12.40,3.15,-3]} scale={[.08,5.25,7.0]} color="#42524a" roughness={.92}/>
  <Label text="私人训练室" position={[-12.30,3.35,7.2]} rotation={[0,Math.PI/2,0]} size={.32} color="#4f5d50" maxWidth={4}/>
  <Label text="动作练习 · 训练影像" position={[-12.29,2.83,7.2]} rotation={[0,Math.PI/2,0]} size={.13} color="#6b7466" maxWidth={4}/>
 </group>;
}
