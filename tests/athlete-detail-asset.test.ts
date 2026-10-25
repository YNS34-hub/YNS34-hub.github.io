import{describe,it,expect}from'vitest';import fs from'node:fs';import{createHash}from'node:crypto';
const directory='public/media/presence/',base=JSON.parse(fs.readFileSync(directory+'athlete.gltf','utf8')),detail=JSON.parse(fs.readFileSync(directory+'athlete-detail.gltf','utf8')),binary=fs.readFileSync(directory+'athlete-detail.bin');
function data(index:number){const a=detail.accessors[index],v=detail.bufferViews[a.bufferView],size=({SCALAR:1,VEC2:2,VEC3:3,VEC4:4}as Record<string,number>)[a.type],offset=(v.byteOffset||0)+(a.byteOffset||0),Type=a.componentType===5126?Float32Array:a.componentType===5125?Uint32Array:Uint16Array;return new Type(binary.buffer.slice(binary.byteOffset+offset,binary.byteOffset+offset+a.count*size*Type.BYTES_PER_ELEMENT));}
describe('generated skinned detail asset',()=>{
 it('retains exact original bones, bind matrices, animations and atlas references',()=>{expect(detail.nodes).toEqual(base.nodes);expect(detail.skins).toEqual(base.skins);expect(detail.animations).toEqual(base.animations);expect(detail.images).toEqual(base.images);const meta=JSON.parse(fs.readFileSync(directory+'athlete-detail.json','utf8'));for(const[file,expected]of Object.entries(meta.sourceHashes))expect(createHash('sha256').update(fs.readFileSync(directory+file)).digest('hex')).toBe(expected);expect(meta.privateMediaRead).toBe(false);});
 it('adds actual indexed surface and scalp geometry within a bounded139520 triangle budget',()=>{const primitives=detail.meshes[0].primitives;expect(primitives.length).toBe(8);expect(primitives.reduce((sum:number,p:{indices:number})=>sum+detail.accessors[p.indices].count/3,0)).toBe(139520);expect(binary.length).toBe(detail.buffers[0].byteLength);expect(binary.length).toBeLessThan(9_000_000);expect(detail.materials[primitives.at(-1).material].name).toBe('m026_hair');for(const p of primitives){const indices=data(p.indices),count=detail.accessors[p.attributes.POSITION].count;expect(Array.from(indices).every(v=>v<count)).toBe(true);expect(detail.accessors[p.attributes.POSITION].count).toBeLessThan(65536);}});
 it('keeps all detailed surface weights normalized and bound to the same skeleton',()=>{
  for(const p of detail.meshes[0].primitives){
   const weights=data(p.attributes.WEIGHTS_0),joints=data(p.attributes.JOINTS_0),position=data(p.attributes.POSITION);
   let maxSumError=0,minWeight=Infinity,maxJoint=0;
   expect(Array.from(position).every(Number.isFinite)).toBe(true);
   for(let i=0;i<weights.length;i+=4){
    maxSumError=Math.max(maxSumError,Math.abs(weights[i]+weights[i+1]+weights[i+2]+weights[i+3]-1));
    for(let c=0;c<4;c++){maxJoint=Math.max(maxJoint,joints[i+c]);minWeight=Math.min(minWeight,weights[i+c]);}
   }
   expect(maxSumError).toBeLessThan(.000005);
   expect(maxJoint).toBeLessThan(detail.skins[0].joints.length);
   expect(minWeight).toBeGreaterThanOrEqual(0);
  }
 });
});
