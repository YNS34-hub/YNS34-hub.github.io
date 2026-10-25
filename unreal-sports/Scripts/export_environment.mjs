import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const web=path.resolve(root,'../lake-work');
const require=createRequire(path.join(web,'package.json')),ts=require('typescript');
const three=pathToFileURL(path.join(web,'node_modules/three/build/three.module.js')).href;
let source=await readFile(path.join(web,'src/worlds/road/route.ts'),'utf8');
source=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replaceAll('from "three"',`from "${three}"`);
const route=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const {Vector3}=await import(three),point=new Vector3(),tangent=new Vector3();
const convert=(x,y,z)=>[x*100,-z*100,y*100];
const data={source:'Original Memory Palace authored lake route; metre-to-centimetre conversion, no personal media.',length:route.roadLength,lake:{center:convert(route.lake.x,route.lake.y,route.lake.z),radius:[route.lake.rx*100,route.lake.rz*100]},route:[],meshes:[]};
for(let i=0;i<=1600;i++){
  route.roadSample(route.roadLength*i/1600,point,tangent);data.route.push({p:convert(point.x,point.y,point.z),t:[tangent.x,-tangent.z,tangent.y]});
}
function meshFromGeometry(name,g,material){
 const pos=g.getAttribute('position'),uv=g.getAttribute('uv'),vertices=[];
 for(let i=0;i<pos.count;i++)vertices.push(...convert(pos.getX(i),pos.getY(i),pos.getZ(i)));
 data.meshes.push({name,vertices,indices:Array.from(g.index.array),uv:uv?Array.from(uv.array):[],material});g.dispose();
}
// 原始路线决定道路、停车与运动数据；转换不写回网页源码或存档。
meshFromGeometry('Asphalt',route.roadRibbon(0,route.roadLength,6.4,0,.035),'Asphalt');
for(const side of [-1,1])meshFromGeometry('RoadPaint'+side,route.roadRibbon(0,route.roadLength,.10,side*2.95,.07),'White');
const n=220,x0=-900,z0=-1800,width=2600,depth=2500,vertices=[],indices=[],uv=[];
for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){
 const x=x0+width*i/n,z=z0+depth*j/n;vertices.push(...convert(x,route.terrainHeight(x,z)-.15,z));uv.push(x/5,z/5);
 if(i<n&&j<n){const a=j*(n+1)+i;indices.push(a,a+n+1,a+1,a+1,a+n+1,a+n+2);}
}
data.meshes.push({name:'ValleyFloor',vertices,indices,uv,material:'Meadow'});
const samples=JSON.parse(await readFile(path.join(web,'public/media/road/ridge-samples.json'),'utf8'));
const chains=[[550,-1400,Math.PI,3700,1100,540],[-650,-650,-Math.PI/2,3300,900,450],[1450,-720,Math.PI/2,3600,1200,610],[450,600,0,3400,1000,360],[620,-2530,Math.PI,5000,1800,920]];
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
for(let layer=0;layer<5;layer++){
 const [cx,cz,angle,span,deep,height]=chains[layer],s=samples.layers[layer],v=[],tri=[],uvs=[];
 for(let j=0;j<=s.rows;j++)for(let i=0;i<=s.cols;i++){
  const u=i/s.cols,w=j/s.rows,lx=(u-.5)*span,lz=w*deep,h=-24+height*smooth(0,.065,u)*smooth(0,.065,1-u)*smooth(0,.13,w)*smooth(0,.13,1-w)*(.05+.95*s.levels[j*(s.cols+1)+i]/65535);
  v.push(...convert(cx+lx*Math.cos(angle)+lz*Math.sin(angle),h,cz-lx*Math.sin(angle)+lz*Math.cos(angle)));uvs.push(lx/7,lz/7);
  if(i<s.cols&&j<s.rows){const a=j*(s.cols+1)+i;tri.push(a,a+s.cols+1,a+1,a+1,a+s.cols+1,a+s.cols+2);}
 }
 data.meshes.push({name:'Ridge'+layer,vertices:v,indices:tri,uv:uvs,material:'Rock'});
}
// 既有合法树冠导出中档几何；原生场景采用实例化与距离裁剪。
data.trees=[];
for(const id of ['fir_tree_01','pine_sapling_small']){
 const shape=JSON.parse(await readFile(path.join(web,'public/media/road/forest',id+'.json'),'utf8'));
 data.trees.push({id,height:shape.variants[0].height,parts:shape.variants[0].lods[1].map(part=>({...part,vertices:part.position.flatMap((_,i)=>i%3?[]:convert(part.position[i],part.position[i+1],part.position[i+2]))}))});
}
await mkdir(path.join(root,'Content/Data'),{recursive:true});await writeFile(path.join(root,'Content/Data/environment.json'),JSON.stringify(data));
const hashes={};
for(const rel of ['public/media/road/forest/SOURCES.md','public/media/road/SOURCES.md','public/media/presence/ROCKETBOX-LICENSE.md','public/media/presence/SOURCES.md']){
 const buf=await readFile(path.join(web,rel));hashes[rel]=createHash('sha256').update(buf).digest('hex');await copyFile(path.join(web,rel),path.join(root,'Docs',rel.includes('/forest/')?'Forest-SOURCES.md':rel.includes('/presence/')?path.basename(rel):'Road-SOURCES.md'));
}
await writeFile(path.join(root,'Reports/environment-source.json'),JSON.stringify({at:new Date().toISOString(),routeLength:data.length,meshTriangles:data.meshes.reduce((n,m)=>n+m.indices.length/3,0),publicSourceHashes:hashes,privateMediaRead:false,sourceModified:false},null,2));
console.log(`Exported ${data.route.length} route samples and ${data.meshes.length} meshes; source unchanged.`);
