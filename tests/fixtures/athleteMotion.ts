import {readFileSync} from 'node:fs';
import {AnimationClip,AnimationMixer,Bone,Group,InterpolateDiscrete,Object3D,QuaternionKeyframeTrack,VectorKeyframeTrack} from 'three';

type GltfNode={name?:string;matrix?:number[];translation?:number[];rotation?:number[];scale?:number[];children?:number[]};
type GltfAnimation={name:string;samplers:{input:number;output:number;interpolation?:string}[];channels:{sampler:number;target:{node:number;path:string}}[]};
type AthleteGltf={nodes:GltfNode[];skins:{joints:number[]}[];scenes:{nodes:number[]}[];scene?:number;buffers:{uri:string}[];bufferViews:{buffer:number;byteOffset?:number;byteStride?:number}[];accessors:{bufferView:number;byteOffset?:number;count:number;type:string;componentType:number;sparse?:unknown}[];animations:GltfAnimation[]};

/** Decode the production skeleton and animation accessors without loading images. */
export function loadAthleteMotion(){
 const directory=new URL('../../public/media/presence/',import.meta.url);
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
 const clips=gltf.animations.map(animation=>new AnimationClip(animation.name,-1,animation.channels.map(channel=>{
  const sampler=animation.samplers[channel.sampler],property=({rotation:'quaternion',translation:'position',scale:'scale'} as Record<string,string>)[channel.target.path];
  if(!property||![undefined,'LINEAR','STEP'].includes(sampler.interpolation))throw Error('Unsupported athlete animation channel');
  const Track=property==='quaternion'?QuaternionKeyframeTrack:VectorKeyframeTrack;
  return new Track(nodes[channel.target.node].uuid+'.'+property,accessor(sampler.input),accessor(sampler.output),sampler.interpolation==='STEP'?InterpolateDiscrete:undefined);
 })));
 const mixer=new AnimationMixer(model),actions=clips.map(clip=>mixer.clipAction(clip).play().setEffectiveWeight(clip.name==='idle'?1:0));
 const bones=new Map(nodes.filter(node=>node instanceof Bone).map(bone=>[bone.name,bone]));
 return {root,model,mixer,actions,clips,bones,dispose(){mixer.stopAllAction();mixer.uncacheRoot(model);}};
}
