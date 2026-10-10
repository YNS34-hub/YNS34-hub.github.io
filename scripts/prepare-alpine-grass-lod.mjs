import {readFile,writeFile} from "node:fs/promises";
import {MeshoptSimplifier} from "meshoptimizer";

// 简化真实叶片的曲面，保留 UV；不是把几根放大的干草误当成完整草簇。
await MeshoptSimplifier.ready;MeshoptSimplifier.useExperimentalFeatures=true;
const root=new URL("../public/media/alpine/grass_medium_01/",import.meta.url),gltf=JSON.parse(await readFile(new URL("source.gltf",root),"utf8"));
const raw=await readFile(new URL("source.bin",root)),bytes=raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength);
const packed=[],views=[],accessors=[];let offset=0;
function append(data,type,componentType,target,bounds){
  const a=new Uint8Array(data.buffer,data.byteOffset,data.byteLength);views.push({buffer:0,byteOffset:offset,byteLength:a.length,target});
  const count=data.length/(type==="VEC3"?3:type==="VEC2"?2:1);accessors.push({bufferView:views.length-1,componentType,count,type,...bounds});
  packed.push(a);offset+=a.length;return accessors.length-1;
}
for(const [i,mesh]of gltf.meshes.entries()){
  const p=mesh.primitives[0],read=n=>{const a=gltf.accessors[n],v=gltf.bufferViews[a.bufferView],o=(v.byteOffset||0)+(a.byteOffset||0);return a.componentType===5123?new Uint16Array(bytes,o,a.count):new Float32Array(bytes,o,a.count*(a.type==="VEC3"?3:2));};
  const positions=read(p.attributes.POSITION),normals=read(p.attributes.NORMAL),uv=read(p.attributes.TEXCOORD_0),indices=new Uint32Array(read(p.indices)),attributes=new Float32Array(positions.length/3*5);
  for(let k=0;k<positions.length/3;k++){attributes.set(normals.subarray(k*3,k*3+3),k*5);attributes.set(uv.subarray(k*2,k*2+2),k*5+3);}
  const [simplified,error]=MeshoptSimplifier.simplifyWithAttributes(indices,positions,3,attributes,5,[.02,.02,.02,.5,.5],null,[180,160,240][i]*3,.035);
  // 离线压紧用到的顶点，运行时不再载入被删去的叶片。
  const used=[...new Set(simplified)],remap=new Map(used.map((n,k)=>[n,k])),copy=(a,n)=>new Float32Array(used.flatMap(k=>Array.from(a.subarray(k*n,k*n+n))));
  const original=gltf.accessors[p.attributes.POSITION];
  p.attributes={POSITION:append(copy(positions,3),"VEC3",5126,34962,{min:original.min,max:original.max}),NORMAL:append(copy(normals,3),"VEC3",5126,34962),TEXCOORD_0:append(copy(uv,2),"VEC2",5126,34962)};
  p.indices=append(new Uint32Array(Array.from(simplified,n=>remap.get(n))),"SCALAR",5125,34963);
  console.log("grass "+i+": "+indices.length/3+" -> "+simplified.length/3+" triangles / error "+error.toFixed(4));
}
const binary=Buffer.concat(packed.map(a=>Buffer.from(a)));
gltf.accessors=accessors;gltf.bufferViews=views;gltf.buffers=[{byteLength:binary.length,uri:"lod.bin"}];
await writeFile(new URL("lod.bin",root),binary);await writeFile(new URL("scene.gltf",root),JSON.stringify(gltf));
