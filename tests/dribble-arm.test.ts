import {afterAll,describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {AnimationClip,AnimationMixer,Bone,Group,InterpolateDiscrete,Object3D,Quaternion,QuaternionKeyframeTrack,Vector3,VectorKeyframeTrack} from 'three';
import {blendDribbleArmTarget,blendDribbleArmRotation} from '../src/worlds/presence/dribbleArm';
import {advanceDribbleHandRotation} from '../src/worlds/presence/dribblePalm';

type GltfNode={name?:string;matrix?:number[];translation?:number[];rotation?:number[];scale?:number[];children?:number[]};
type GltfAnimation={name:string;samplers:{input:number;output:number;interpolation?:string}[];channels:{sampler:number;target:{node:number;path:string}}[]};
type AthleteGltf={nodes:GltfNode[];skins:{joints:number[]}[];scenes:{nodes:number[]}[];scene?:number;buffers:{uri:string}[];bufferViews:{buffer:number;byteOffset?:number;byteStride?:number}[];accessors:{bufferView:number;byteOffset?:number;count:number;type:string;componentType:number;sparse?:unknown}[];animations:GltfAnimation[]};

// The same real bone/accessor reconstruction as scripts/check-court-reach.mjs;
// materials and images are irrelevant to the actual locomotion hierarchy.
function loadRunningAthlete(){
 const directory=new URL('../public/media/presence/',import.meta.url);
 const gltf=JSON.parse(readFileSync(new URL('athlete.gltf',directory),'utf8')) as AthleteGltf;
 const joints=new Set(gltf.skins.flatMap(skin=>skin.joints));
 const nodes=gltf.nodes.map((source,index)=>{
  const node=joints.has(index)?new Bone():new Object3D();node.name=source.name??'';
  if(source.matrix){node.matrix.fromArray(source.matrix);node.matrix.decompose(node.position,node.quaternion,node.scale);}
  else{if(source.translation)node.position.fromArray(source.translation);if(source.rotation)node.quaternion.fromArray(source.rotation);if(source.scale)node.scale.fromArray(source.scale);}
  return node;
 });
 gltf.nodes.forEach((source,index)=>source.children?.forEach(child=>nodes[index].add(nodes[child])));
 const model=new Group(),root=new Group();gltf.scenes[gltf.scene??0].nodes.forEach(index=>model.add(nodes[index]));root.add(model);
 const buffers=gltf.buffers.map(buffer=>readFileSync(new URL(buffer.uri,directory)));
 const accessor=(index:number)=>{
  const source=gltf.accessors[index],view=gltf.bufferViews[source.bufferView],width=({SCALAR:1,VEC3:3,VEC4:4} as Record<string,number>)[source.type];
  if(!width||source.componentType!==5126||source.sparse)throw Error('Unsupported athlete animation accessor');
  const data=buffers[view.buffer],offset=(view.byteOffset??0)+(source.byteOffset??0),stride=view.byteStride??width*4,values=new Float32Array(source.count*width);
  for(let row=0;row<source.count;row++)for(let col=0;col<width;col++)values[row*width+col]=data.readFloatLE(offset+row*stride+col*4);
  return values;
 };
 const animation=gltf.animations.find(clip=>clip.name==='run');if(!animation)throw Error('Actual athlete run clip missing');
 const clip=new AnimationClip(animation.name,-1,animation.channels.map(channel=>{
  const sampler=animation.samplers[channel.sampler],property=({rotation:'quaternion',translation:'position',scale:'scale'} as Record<string,string>)[channel.target.path];
  if(!property||![undefined,'LINEAR','STEP'].includes(sampler.interpolation))throw Error('Unsupported athlete animation channel');
  const Track=property==='quaternion'?QuaternionKeyframeTrack:VectorKeyframeTrack;
  return new Track(nodes[channel.target.node].uuid+'.'+property,accessor(sampler.input),accessor(sampler.output),sampler.interpolation==='STEP'?InterpolateDiscrete:undefined);
 }));
 const mixer=new AnimationMixer(model);mixer.clipAction(clip).play();
 return {clip,dispose(){mixer.stopAllAction();mixer.uncacheRoot(model);},setTime(time:number,crouch=.28){mixer.setTime(time);model.position.set(0,0,0);model.rotation.y=Math.PI;root.position.set(2,-crouch,-3);root.rotation.set(0,.43,0);root.updateWorldMatrix(true,true);},bone(side:number,part:string){const bone=nodes.find(node=>node.name===`Bip01_${side<0?'L':'R'}_${part}`);if(!bone)throw Error('Actual athlete bone missing');return bone;}};
}
const rig=loadRunningAthlete();afterAll(()=>rig.dispose());

describe('a free dribble arm retains the actual current running pose',()=>{
 for(const side of [-1,1])for(const crouch of [.12,.36])it(`preserves hand, elbow and wrist direction at zero influence (${side}/${crouch})`,()=>{
  const contact=new Vector3(side*.34,1.02,-.29),contactQ=new Quaternion(),out=new Vector3(),rotation=new Quaternion(),samples:number[]=[];
  for(let step=0;step<=120;step++){
   rig.setTime(step*rig.clip.duration/120,crouch);
   const hand=rig.bone(side,'Hand'),wrist=hand.getWorldPosition(new Vector3()),q=hand.getWorldQuaternion(new Quaternion());
   const elbow=rig.bone(side,'Forearm').getWorldPosition(new Vector3()),before=[wrist.toArray(),q.toArray(),elbow.toArray()];
   expect(blendDribbleArmTarget(out,wrist,contact,0)).toBe(out);expect(out.toArray()).toEqual(wrist.toArray());
   blendDribbleArmTarget(out,elbow,contact,0);expect(out.toArray()).toEqual(elbow.toArray());
   expect(blendDribbleArmRotation(rotation,q,contactQ,0)).toBe(rotation);expect(rotation.toArray()).toEqual(q.toArray());
   expect(new Vector3(1,0,0).applyQuaternion(rotation).toArray()).toEqual(new Vector3(1,0,0).applyQuaternion(q).toArray());
   expect([wrist.toArray(),q.toArray(),elbow.toArray()]).toEqual(before);samples.push(wrist.z);
  }
  expect(Math.max(...samples)-Math.min(...samples)).toBeGreaterThan(.08);
 });
 for(const side of [-1,1])it(`preserves the exact authored contact at full influence (${side})`,()=>{
  rig.setTime(.173);const hand=rig.bone(side,'Hand'),animated=hand.getWorldPosition(new Vector3()),animatedQ=hand.getWorldQuaternion(new Quaternion());
  const contact=new Vector3(side*.4,.97,-.41),contactQ=new Quaternion().setFromAxisAngle(new Vector3(.2,.8,-.3).normalize(),side*.8),out=new Vector3(),rotation=new Quaternion();
  const before=[animated.toArray(),animatedQ.toArray(),contact.toArray(),contactQ.toArray()];
  blendDribbleArmTarget(out,animated,contact,1);blendDribbleArmRotation(rotation,animatedQ,contactQ,1);
  expect(out.toArray()).toEqual(contact.toArray());expect(rotation.toArray()).toEqual(contactQ.toArray());
  expect([animated.toArray(),animatedQ.toArray(),contact.toArray(),contactQ.toArray()]).toEqual(before);
 });
 it('uses the supplied influence directly rather than easing it a second time',()=>{
  const a=new Vector3(-1,2,3),b=new Vector3(3,4,-1),qa=new Quaternion(),qb=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),1.6),out=new Vector3(),rotation=new Quaternion();
  blendDribbleArmTarget(out,a,b,.25);expect(out.toArray()).toEqual([0,2.5,2]);
  blendDribbleArmRotation(rotation,qa,qb,.25);expect(rotation.angleTo(qa)).toBeCloseTo(.4,10);
 });
 it('has continuous left/right participation and run-cycle boundaries',()=>{
  const previous=[new Vector3(),new Vector3()],previousQ=[new Quaternion(),new Quaternion()],out=new Vector3(),rotation=new Quaternion();
  rig.setTime(.1);
  // Contact orientations retain the real mirrored hand-bone basis, rather than
  // assuming that an identity quaternion is a neutral Rocketbox wrist.
  const contactRotations=[-1,1].map(side=>rig.bone(side,'Hand').getWorldQuaternion(new Quaternion()));
  for(let step=0;step<=480;step++){
   const time=step*rig.clip.duration/240;rig.setTime(time);
   for(const [index,side] of [-1,1].entries()){
    const hand=rig.bone(side,'Hand'),animated=hand.getWorldPosition(new Vector3()),animatedQ=hand.getWorldQuaternion(new Quaternion());
    const influence=.5+.5*Math.sin(Math.PI*2*time/rig.clip.duration+(side<0?Math.PI:0));
    const contact=new Vector3(side*.34+2,.94,-3.4),contactQ=contactRotations[index];
    blendDribbleArmTarget(out,animated,contact,influence);blendDribbleArmRotation(rotation,animatedQ,contactQ,influence);
    if(step){expect(out.distanceTo(previous[index]),`position step=${step},side=${side}`).toBeLessThan(.04);expect(rotation.angleTo(previousQ[index]),`rotation step=${step},side=${side},time=${time},animated=${animatedQ.toArray()},contactAngle=${animatedQ.angleTo(contactQ)}`).toBeLessThan(.08);}
    previous[index].copy(out);previousQ[index].copy(rotation);
   }
  }
 });
 it('keeps the actual wrist continuous when a mixed target crosses the 180-degree interpolation branch',()=>{
  const side=1,contact=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),.4),target=new Quaternion(),actual=new Quaternion();
  const dt=rig.clip.duration/240,previousTarget=new Quaternion();let largestTargetStep=0;
  for(let step=0;step<=240;step++){
   const time=step*dt;rig.setTime(time);const animated=rig.bone(side,'Hand').getWorldQuaternion(new Quaternion()).normalize();
   const influence=.5+.5*Math.sin(Math.PI*2*time/rig.clip.duration);
   blendDribbleArmRotation(target,animated,contact,influence);
   if(!step)actual.copy(target);
   else{
    largestTargetStep=Math.max(largestTargetStep,target.angleTo(previousTarget));
    const previousActual=actual.clone();advanceDribbleHandRotation(actual,target,dt);
    // World matrix decomposition has minute unit-length roundoff; compare the
    // actual SO(3) angle rather than treating that scale error as a wrist turn.
    expect(actual.clone().normalize().angleTo(previousActual.normalize())).toBeLessThanOrEqual(10*dt+1e-7);
   }
   previousTarget.copy(target);
  }
  expect(largestTargetStep).toBeGreaterThan(.4);
 });
 it('treats opposite quaternion signs as the same contact rotation',()=>{
  const a=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),.7),b=new Quaternion(-a.x,-a.y,-a.z,-a.w),out=new Quaternion();
  for(const influence of [0,.1,.5,.9,1]){blendDribbleArmRotation(out,a,b,influence);expect(out.angleTo(a)).toBeLessThan(1e-7);}
 });
 it('clamps out-of-range influence and defaults invalid influence to the animation',()=>{
  const a=new Vector3(1,2,3),b=new Vector3(4,5,6),qa=new Quaternion(),qb=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),.6),out=new Vector3(),rotation=new Quaternion();
  for(const influence of [-1,Number.NaN,Number.POSITIVE_INFINITY]){blendDribbleArmTarget(out,a,b,influence);blendDribbleArmRotation(rotation,qa,qb,influence);expect(out.toArray()).toEqual(a.toArray());expect(rotation.toArray()).toEqual(qa.toArray());}
  blendDribbleArmTarget(out,a,b,2);blendDribbleArmRotation(rotation,qa,qb,2);expect(out.toArray()).toEqual(b.toArray());expect(rotation.toArray()).toEqual(qb.toArray());
 });
 it('keeps a finite previous output for malformed selected snapshots',()=>{
  const a=new Vector3(1,2,3),bad=new Vector3(Number.NaN,0,0),out=new Vector3(7,8,9),rotation=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),.3),before=rotation.toArray();
  for(const influence of [.5,1]){blendDribbleArmTarget(out,a,bad,influence);expect(out.toArray()).toEqual([7,8,9]);for(const q of [new Quaternion(Number.NaN,0,0,1),new Quaternion(0,0,0,0)]){blendDribbleArmRotation(rotation,new Quaternion(),q,influence);expect(rotation.toArray()).toEqual(before);}}
  blendDribbleArmTarget(out,a,bad,0);expect(out.toArray()).toEqual(a.toArray());
  blendDribbleArmRotation(rotation,new Quaternion(),new Quaternion(Number.NaN,0,0,1),0);expect(rotation.toArray()).toEqual([0,0,0,1]);
 });
});
