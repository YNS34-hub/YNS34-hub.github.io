import {useEffect,useLayoutEffect,useMemo,useRef,type ReactNode} from 'react';
import {BufferGeometry,Color,DoubleSide,Float32BufferAttribute,InstancedMesh,Object3D,Quaternion,Vector2,Vector3,type EulerTuple,type Vector3Tuple} from 'three';
import {Block} from './primitives';

export type BoxInstance={position:Vector3Tuple;scale:Vector3Tuple;rotation?:EulerTuple;color?:string};
export function BoxBatch({items,color='#343532',metalness=0,roughness=.65,name}:{items:BoxInstance[];color?:string;metalness?:number;roughness?:number;name?:string}){
 const ref=useRef<InstancedMesh>(null);
 useLayoutEffect(()=>{if(!ref.current)return;const o=new Object3D(),c=new Color();items.forEach((item,i)=>{o.position.set(...item.position);o.scale.set(...item.scale);o.rotation.set(...(item.rotation||[0,0,0]));o.updateMatrix();ref.current!.setMatrixAt(i,o.matrix);ref.current!.setColorAt(i,c.set(item.color||color));});ref.current.instanceMatrix.needsUpdate=true;if(ref.current.instanceColor)ref.current.instanceColor.needsUpdate=true;},[items,color]);
 return <instancedMesh ref={ref} args={[undefined,undefined,items.length]} name={name} castShadow receiveShadow><boxGeometry/><meshStandardMaterial color="white" roughness={roughness} metalness={metalness}/></instancedMesh>;
}
export function Rod({a,b,radius=.025,color='#383c38',metalness=.55}:{a:Vector3Tuple;b:Vector3Tuple;radius?:number;color?:string;metalness?:number}){
 const t=useMemo(()=>{const p=new Vector3(...a),q=new Vector3(...b),delta=q.clone().sub(p);return{mid:p.add(q).multiplyScalar(.5),q:new Quaternion().setFromUnitVectors(new Vector3(0,1,0),delta.clone().normalize()),length:delta.length()};},[...a,...b]);
 return <mesh position={t.mid} quaternion={t.q} castShadow><cylinderGeometry args={[radius,radius,t.length,10]}/><meshStandardMaterial color={color} metalness={metalness} roughness={.34}/></mesh>;
}
export function Planter({position=[0,0,0],scale=1}:{position?:Vector3Tuple;scale?:number}){
 const ref=useRef<InstancedMesh>(null);
 const geometry=useMemo(()=>{const g=new BufferGeometry(),vertices:number[]=[],indices:number[]=[];for(let i=0;i<=16;i++){const t=i/16,w=Math.pow(Math.sin(Math.PI*t),.72)*.095;for(const side of [-1,0,1])vertices.push(side*w,t*.95,.30*t*t+Math.abs(side)*.024);}for(let i=0;i<16;i++)for(let j=0;j<2;j++){const a=i*3+j;indices.push(a,a+3,a+1,a+1,a+3,a+4);}g.setAttribute('position',new Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();return g;},[]);
 const profile=useMemo(()=>[[.19,0],[.23,.015],[.26,.43],[.28,.49],[.28,.52],[.25,.52],[.245,.47]].map(([r,y])=>new Vector2(r,y)),[]);
 useEffect(()=>()=>geometry.dispose(),[geometry]);
 useLayoutEffect(()=>{if(!ref.current)return;const o=new Object3D(),c=new Color();for(let i=0;i<24;i++){const a=i*2.4;o.position.set(Math.cos(a)*.075,.49,Math.sin(a)*.075);o.rotation.set(.20+(i%6)*.10,a,Math.sin(a)*.08);o.scale.setScalar(.65+(i%5)*.10);o.updateMatrix();ref.current.setMatrixAt(i,o.matrix);ref.current.setColorAt(i,c.set(['#3c5530','#657843','#30492d','#536b37'][i%4]));}ref.current.instanceMatrix.needsUpdate=true;if(ref.current.instanceColor)ref.current.instanceColor.needsUpdate=true;},[]);
 return <group position={position} scale={scale}><mesh castShadow receiveShadow><latheGeometry args={[profile,32]}/><meshStandardMaterial color="#a8957a" roughness={.85}/></mesh><mesh position={[0,.495,0]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[.245,24]}/><meshStandardMaterial color="#332d22"/></mesh><instancedMesh ref={ref} args={[geometry,undefined,24]} castShadow><meshStandardMaterial color="white" roughness={.8} side={DoubleSide}/></instancedMesh></group>;
}
export function StudioPendant({position,color='#242723',children}:{position:Vector3Tuple;color?:string;children?:ReactNode}){
 return <group position={position}><Rod a={[0,0,0]} b={[0,.99,0]} radius={.012}/><mesh><coneGeometry args={[.31,.24,24,1,true]}/><meshStandardMaterial color={color} roughness={.55}/></mesh><mesh position={[0,-.12,0]} rotation={[Math.PI/2,0,0]}><circleGeometry args={[.285,24]}/><meshStandardMaterial color="#fce5bd" emissive="#ffdc9f" emissiveIntensity={1.4}/></mesh>{children}</group>;
}
export function PaddedBench({position,rotation=[0,0,0],width=2.4,color='#ab6a38'}:{position:Vector3Tuple;rotation?:EulerTuple;width?:number;color?:string}){
 return <group position={position} rotation={rotation}><Block position={[0,.24,0]} scale={[width,.45,.62]} color="#302920" castShadow/><Block position={[0,.51,0]} scale={[width,.15,.73]} color={color} roughness={.8} bevel={.08} castShadow/><Block position={[0,.95,-.31]} scale={[width,.8,.18]} color={color} roughness={.82} bevel={.07} castShadow/>{[-.5,-.22,.06,.34].map(y=><Block key={y} position={[0,.94+y*.55,-.205]} scale={[width-.06,.008,.012]} color="#683e25" bevel={0}/>)}</group>;
}
