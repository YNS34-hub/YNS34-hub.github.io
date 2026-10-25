import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),rows=[];
const original=JSON.parse(fs.readFileSync(path.join(root,'../basketball-work/public/media/presence/athlete.gltf'),'utf8'));
const originalBoneNames=new Set((original.skins??[]).flatMap(s=>s.joints.map(i=>original.nodes[i].name)));
for(const name of fs.readdirSync(path.join(root,'Exports')).filter(n=>n.endsWith('.glb'))){
 const bytes=fs.readFileSync(path.join(root,'Exports',name));assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
 const jsonLength=bytes.readUInt32LE(12),doc=JSON.parse(bytes.toString('utf8',20,20+jsonLength));
 assert.equal(doc.asset.version,'2.0');assert.ok(doc.animations?.length>0);
 const targeted=new Set(doc.animations.flatMap(a=>a.channels.map(c=>doc.nodes[c.target.node].name)));
 const missingBones=[...originalBoneNames].filter(n=>!doc.nodes.some(node=>node.name===n));
 for(const key of ['Bip01_L_Hand','Bip01_R_Hand','Bip01_L_Forearm','Bip01_R_Forearm','Bip01_L_Foot','Bip01_R_Foot'])assert.ok(targeted.has(key),name+' animated '+key);
 assert.equal(missingBones.length,0,name+' original named bones');
 for(const animation of doc.animations)for(const sampler of animation.samplers){
  const times=doc.accessors[sampler.input];assert.ok(times.count>=2);assert.ok(times.max[0]>0);assert.ok(doc.accessors[sampler.output].count>=times.count);
 }
 rows.push({name,bytes:bytes.length,nodes:doc.nodes.length,skins:doc.skins?.length??0,images:doc.images?.length??0,animations:doc.animations.map(a=>({name:a.name,channels:a.channels.length,duration:Math.max(...a.samplers.map(s=>doc.accessors[s.input].max[0]))})),originalBoneNames:originalBoneNames.size,missingBones});
}
assert.equal(rows.length,3);
const report={passed:true,scope:'GLB structure, named bones and keyed animation channels only; real playback/coordinate and material validation still required before production use.',exports:rows};
fs.writeFileSync(path.join(root,'Reports','export-structure.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
