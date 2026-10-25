import {readFile,writeFile} from "node:fs/promises";
import {BufferGeometry,Float32BufferAttribute} from "three";
// 离线降采样 CC0 松树枝干与树冠分布；绝不在浏览器下载 905 MB 的原模型。
// 参数为 Poly Haven pine_tree_01_1k.gltf 与其 bin 的前至少 40 MB。来源和处理方式见 SOURCES.md。
const [gltfFile,binFile]=process.argv.slice(2);
if(!gltfFile||!binFile)throw new Error("Usage: node scripts/prepare-road-tree.mjs source.gltf source-prefix.bin");
const gltf=JSON.parse(await readFile(gltfFile,"utf8")),buffer=await readFile(binFile);
const attribute=n=>{const a=gltf.accessors[n],v=gltf.bufferViews[a.bufferView],offset=(v.byteOffset||0)+(a.byteOffset||0),count=a.count*({VEC3:3,VEC2:2,SCALAR:1}[a.type]||1),C=a.componentType===5123?Uint16Array:a.componentType===5125?Uint32Array:Float32Array;return new C(buffer.buffer,buffer.byteOffset+offset,count);};
const pos=[],uv=[],idx=[],cells=new Map();
for(const [part,grid] of [[0,.16],[1,.10]]){
 const primitive=gltf.meshes[0].primitives[part],p=attribute(primitive.attributes.POSITION),t=attribute(primitive.attributes.TEXCOORD_0),indices=attribute(primitive.indices),remap=[];
 for(let i=0;i<p.length/3;i++){
  const key=part+":"+[p[i*3],p[i*3+1],p[i*3+2]].map(v=>Math.round(v/grid)).join(":");
  if(!cells.has(key)){cells.set(key,pos.length/3);pos.push(p[i*3],p[i*3+1],p[i*3+2]);uv.push(t[i*2],t[i*2+1]);}remap[i]=cells.get(key);
 }
 const faces=new Set();for(let i=0;i<indices.length;i+=3){const a=remap[indices[i]],b=remap[indices[i+1]],c=remap[indices[i+2]],key=[a,b,c].sort((x,y)=>x-y).join(":");if(a!==b&&b!==c&&a!==c&&!faces.has(key)){faces.add(key);idx.push(a,b,c);}}
}
const geometry=new BufferGeometry();geometry.setAttribute("position",new Float32BufferAttribute(pos,3));geometry.setIndex(idx);geometry.computeVertexNormals();
const v=gltf.bufferViews[gltf.accessors[gltf.meshes[0].primitives[2].attributes.POSITION].bufferView],available=Math.floor((Math.min(buffer.length,v.byteOffset+v.byteLength)-v.byteOffset)/12),foliage=new Map();
const points=new Float32Array(buffer.buffer,buffer.byteOffset+v.byteOffset,available*3);
for(let i=0;i<available;i+=143){const p=[points[i*3],points[i*3+1],points[i*3+2]],key=p.map(n=>Math.round(n/.32)).join(":");if(!foliage.has(key))foliage.set(key,p);}
let seed=801;const random=()=>{seed=Math.imul(seed,1664525)+1013904223|0;return(seed>>>0)/4294967296;};
const crown=[...foliage.values()].map(p=>({p,order:random()})).sort((a,b)=>a.order-b.order).slice(0,1700).map(v=>v.p.map(n=>+n.toFixed(3)));
const result={source:"Poly Haven / Pine Tree 01 / CC0",height:20.295,position:pos.map(n=>+n.toFixed(4)),normal:Array.from(geometry.getAttribute("normal").array).map(n=>+n.toFixed(4)),uv:uv.map(n=>+n.toFixed(4)),index:idx,crown};
await writeFile("public/media/road/pine-shape.json",JSON.stringify(result));console.log({woodTriangles:idx.length/3,crownCards:crown.length});geometry.dispose();
