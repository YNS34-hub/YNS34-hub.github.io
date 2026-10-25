import {useEffect,useMemo,useRef,type RefObject} from 'react';
import {useFrame} from '@react-three/fiber';
import {CanvasTexture,Group,Mesh,Object3D,Quaternion,SRGBColorSpace,Vector3} from 'three';

function contactMap(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const context=canvas.getContext('2d')!,gradient=context.createRadialGradient(32,32,0,32,32,32);
 gradient.addColorStop(0,'#17232dcc');gradient.addColorStop(.35,'#17232d77');gradient.addColorStop(.72,'#17232d20');gradient.addColorStop(1,'#17232d00');context.fillStyle=gradient;context.fillRect(0,0,64,64);const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;return texture;
}

/** A small contact layer under the real rendered feet; never moves the rig or the ball. */
export default function CourtFootContact({actor,bones}:{actor:RefObject<Group|null>;bones:ReadonlyMap<string,Object3D>}){
 const group=useRef<Group>(null),planes=useRef<(Mesh|null)[]>([null,null]),map=useMemo(contactMap,[]),scratch=useMemo(()=>({foot:new Vector3(),toe:new Vector3(),center:new Vector3(),axis:new Vector3(0,1,0),rotation:new Quaternion()}),[]);
 useEffect(()=>{map.needsUpdate=true;return()=>map.dispose();},[map]);
 useFrame(()=>{
  if(!group.current)return;group.current.visible=!!actor.current?.visible;
  if(!group.current.visible){for(const plane of planes.current)if(plane)plane.visible=false;return;}
  group.current.updateWorldMatrix(true,false);
  for(let index=0;index<2;index++){
   const side=index===0?'L':'R',foot=bones.get('Bip01_'+side+'_Foot'),toe=bones.get('Bip01_'+side+'_Toe0'),plane=planes.current[index];if(!foot||!plane)continue;
   foot.getWorldPosition(scratch.foot);if(toe)toe.getWorldPosition(scratch.toe);else scratch.toe.copy(scratch.foot);
   const height=Math.max(0,scratch.foot.y-.112),fade=Math.max(0,1-height/.35);plane.visible=fade>.001;
   scratch.center.copy(scratch.foot).lerp(scratch.toe,.4);scratch.center.y=.010;group.current.worldToLocal(scratch.center);plane.position.copy(scratch.center);
   const angle=Math.atan2(scratch.toe.x-scratch.foot.x,scratch.toe.z-scratch.foot.z);plane.rotation.set(-Math.PI/2,0,0);plane.quaternion.premultiply(scratch.rotation.setFromAxisAngle(scratch.axis,angle));
   plane.scale.set(.25*(1+height*.8),.39*(1+height*.8),1);const material=plane.material;if(!Array.isArray(material))material.opacity=.22*fade*fade;
  }
 },-1.5);
 return <group ref={group} name="court-foot-contact" visible={false}>{['L','R'].map((side,index)=><mesh key={side} ref={value=>{planes.current[index]=value;}} name={'court-foot-contact-'+side} raycast={()=>{}} renderOrder={1}>
  <planeGeometry args={[1,1]}/><meshBasicMaterial map={map} transparent opacity={0} depthWrite={false} toneMapped={false}/>
 </mesh>)}</group>;
}
