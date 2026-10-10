import {readFile,writeFile} from "node:fs/promises";
import {MeshoptSimplifier} from "meshoptimizer";
// 离线简化保留 UV 与法线误差，不把运行时间花在模型处理或载入整套高精扫描上。
await MeshoptSimplifier.ready;MeshoptSimplifier.useExperimentalFeatures=true;
for(const [name,ratio,error] of [["rock_09",.14,.018],["rock_face_01",.20,.018]]){
  const root=new URL("../public/media/alpine/"+name+"/",import.meta.url),gltf=JSON.parse(await readFile(new URL("scene.gltf",root),"utf8"));
  const original=await readFile(new URL(gltf.buffers[0].uri,root)),bytes=original.buffer.slice(original.byteOffset,original.byteOffset+original.byteLength);
  const read=i=>{const a=gltf.accessors[i],v=gltf.bufferViews[a.bufferView],offset=(v.byteOffset||0)+(a.byteOffset||0);return a.componentType===5123?new Uint16Array(bytes,offset,a.count):new Float32Array(bytes,offset,a.count*(a.type==="VEC3"?3:2));};
  const positions=read(0),normals=read(1),uv=read(2),indices=new Uint32Array(read(3)),attributes=new Float32Array(normals.length+uv.length);
  for(let i=0;i<positions.length/3;i++){attributes.set(normals.subarray(i*3,i*3+3),i*5);attributes.set(uv.subarray(i*2,i*2+2),i*5+3);}
  const [simplified,actualError]=MeshoptSimplifier.simplifyWithAttributes(indices,positions,3,attributes,5,[.03,.03,.03,.25,.25],null,Math.floor(indices.length*ratio/3)*3,error);
  const indexOffset=(original.byteLength+3)&~3,combined=Buffer.alloc(indexOffset+simplified.byteLength);original.copy(combined);Buffer.from(simplified.buffer).copy(combined,indexOffset);
  gltf.bufferViews[3]={buffer:0,byteOffset:indexOffset,byteLength:simplified.byteLength,target:34963};gltf.accessors[3]={bufferView:3,componentType:5125,count:simplified.length,type:"SCALAR"};
  gltf.buffers[0]={byteLength:combined.byteLength,uri:"lod.bin"};gltf.images.forEach(image=>{image.mimeType="image/webp";});
  await writeFile(new URL("lod.bin",root),combined);await writeFile(new URL("lod.gltf",root),JSON.stringify(gltf));
  console.log(name+": "+indices.length/3+" -> "+simplified.length/3+" triangles / relative error "+actualError.toFixed(4));
}
