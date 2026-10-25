import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {MeshoptSimplifier} from 'meshoptimizer';
import {createHash} from 'node:crypto';

await MeshoptSimplifier.ready;MeshoptSimplifier.useExperimentalFeatures=true;
const input=process.argv[2]||'E:/Temp/palace-forest-source',output='public/media/road/forest';await mkdir(output,{recursive:true});
const compact=(indices,positions,normals,uv)=>{
 const remap=new Map(),p=[],n=[],t=[],idx=[];
 for(const old of indices){if(!remap.has(old)){remap.set(old,remap.size);p.push(...positions.subarray(old*3,old*3+3));n.push(...normals.subarray(old*3,old*3+3));t.push(...uv.subarray(old*2,old*2+2));}idx.push(remap.get(old));}
 return{position:p.map(v=>+v.toFixed(5)),normal:n.map(v=>+v.toFixed(5)),uv:t.map(v=>+v.toFixed(6)),index:idx};
};
function canopyClusters(source,height,name,level){
 // 针叶是大量互不连通的微小三角形，直接 Prune 会保留枝干却丢掉视觉覆盖；用完整来源模型点云确定枝簇。
 const cells=new Map(),step=name==='fir_tree_01'?.32:.055;
 for(let i=0;i<source.positions.length;i+=3){const x=source.positions[i],y=source.positions[i+1],z=source.positions[i+2],key=[x,y,z].map(v=>Math.floor(v/step)).join(':');
  const cell=cells.get(key)||{x:0,y:0,z:0,n:0};cell.x+=x;cell.y+=y;cell.z+=z;cell.n++;cells.set(key,cell);
 }
 const centers=[...cells.values()].map(c=>{const point=[c.x/c.n,c.y/c.n,c.z/c.n],hash=Math.sin(point[0]*127.1+point[1]*43.7+point[2]*311.7)*43758.5453;return{point,hash:hash-Math.floor(hash)};}).sort((a,b)=>a.hash-b.hash);
 const count=Math.min(centers.length,(name==='fir_tree_01'?[1800,600,120]:[420,140,35])[level]);
 const width=(name==='fir_tree_01'?.96*height/14:.25*height/1.6)*Math.sqrt(Math.min(centers.length,name==='fir_tree_01'?1800:420)/count);
 // 只用完整的冷杉针叶照片区，不取图集中的树皮 / 松果。远档加大代表枝簇，保持总覆盖而非只保留几根针。
 const patches=[[.185,.035,.47,.305],[.54,.02,.967,.41],[.335,.245,.608,.40],[.29,.415,.605,.805],[.60,.485,.93,.835]];
 const position=[],normal=[],uv=[],index=[];
 for(let i=0;i<count;i++){
  const {point,hash}=centers[i],radial=Math.atan2(point[0],point[2]),angle=radial+(hash-.5)*1.3;
  const tile=patches[i%patches.length],aspect=(tile[3]-tile[1])/(tile[2]-tile[0]);
  const roll=(hash-.5)*1.9,tilt=-.22+Math.sin(i*12.73)*.34;
  // 枝簇沿枝条伸展，不将全部照片竖直挂在树上；保持每个照片裁片本身的原比例。
  const tangent=[Math.cos(angle),0,-Math.sin(angle)],vertical=[Math.sin(angle)*Math.sin(tilt),Math.cos(tilt),Math.cos(angle)*Math.sin(tilt)];
  const right=tangent.map((v,j)=>v*Math.cos(roll)+vertical[j]*Math.sin(roll)),up=vertical.map((v,j)=>v*Math.cos(roll)-tangent[j]*Math.sin(roll));
  let w=width*(.83+(i%7)*.047),h=w*aspect;
  // 远档代表枝簇较大，但幼苗近地叶不能穿地；缩小整个照片保持比例，不抬起原植株根部。
  const extent=(Math.abs(right[1])*w+Math.abs(up[1])*h)*.5;
  const grounded=Math.min(1,Math.max(0,point[1]-.006)/Math.max(extent,.0001));w*=grounded;h*=grounded;
  let outward=[point[0],(point[1]-height*.67)*.17,point[2]],length=Math.hypot(...outward)||1;outward=outward.map(v=>v/length);
  const face=[right[1]*up[2]-right[2]*up[1],right[2]*up[0]-right[0]*up[2],right[0]*up[1]-right[1]*up[0]],sign=face.reduce((v,n,j)=>v+n*outward[j],0)<0?-1:1;
  // 正面三角形 winding 与法线保持一致，避免 DoubleSide 反转已翻向外的法线。
  let n=face.map((v,j)=>v*sign*.40+outward[j]*.60);length=Math.hypot(...n);n=n.map(v=>v/length);
  const base=position.length/3;
  for(const [x,y]of [[-1,-1],[1,-1],[1,1],[-1,1],[0,0]]){const bend=x===0?w*.045:0;position.push(...point.map((v,j)=>+(v+right[j]*x*w*.5+up[j]*y*h*.5+face[j]*bend).toFixed(5)));normal.push(...n);}
  uv.push(tile[0],1-tile[3],tile[2],1-tile[3],tile[2],1-tile[1],tile[0],1-tile[1],(tile[0]+tile[2])*.5,1-(tile[1]+tile[3])*.5);
  for(const triangle of [[base,base+1,base+4],[base+1,base+2,base+4],[base+2,base+3,base+4],[base+3,base,base+4]])index.push(...(sign<0?triangle.reverse():triangle));
 }
 return{position,normal,uv,index,leaf:true,clusters:count};
}
for(const [name,stems] of [['fir_tree_01',['fir_tree_01','fir_tree_01-b']],['pine_sapling_small',['pine_sapling_small']]]){
 const gltf=JSON.parse(await readFile(input+'/'+name+'.gltf','utf8')),variants=[],slices=[];
 for(const stem of stems){
 const slice=JSON.parse(await readFile(input+'/'+stem+'-slice.json','utf8')),buffer=await readFile(input+'/'+stem+'.bin');
 const data=n=>{const a=gltf.accessors[n],view=gltf.bufferViews[a.bufferView],offset=(view.byteOffset||0)+(a.byteOffset||0)-slice.offset,components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],Type={5123:Uint16Array,5125:Uint32Array,5126:Float32Array}[a.componentType];if(offset<0||offset+a.count*components*Type.BYTES_PER_ELEMENT>buffer.length)throw new Error('Source slice does not contain accessor '+n);return new Type(buffer.buffer,buffer.byteOffset+offset,a.count*components);};
 slices.push({sourceBinary:slice.sourceUrl,sliceOffset:slice.offset,sliceBytes:buffer.length,sliceSHA256:createHash('sha256').update(buffer).digest('hex'),meshIds:slice.meshIds});
 for(const meshId of slice.meshIds){
  const mesh=gltf.meshes[meshId],raw=[];let floor=Infinity,ceiling=-Infinity;
  for(const primitive of mesh.primitives){const positions=new Float32Array(data(primitive.attributes.POSITION)),normals=new Float32Array(data(primitive.attributes.NORMAL)),uv=primitive.attributes.TEXCOORD_0===undefined?new Float32Array(positions.length/3*2):new Float32Array(data(primitive.attributes.TEXCOORD_0)),indices=new Uint32Array(data(primitive.indices));
   // 冷杉 C 树干没有 UV；保留原始几何，用圆周 / 三米树皮长度生成坐标，不把缺失属性默认为 0。
   if(primitive.attributes.TEXCOORD_0===undefined)for(let i=0;i<positions.length/3;i++){uv[i*2]=Math.atan2(positions[i*3+2],positions[i*3])/(Math.PI*2)+.5;uv[i*2+1]=positions[i*3+1]/3;}
   for(let i=1;i<positions.length;i+=3){floor=Math.min(floor,positions[i]);ceiling=Math.max(ceiling,positions[i]);}
   raw.push({positions,normals,uv,indices,leaf:gltf.materials[primitive.material].name.includes('twig')});
  }
  // 原图颜色、法线和 UV 保持原来源；这里只降几何预算并把真实根部归零，不重造噪声树。
  raw.forEach(p=>{for(let i=1;i<p.positions.length;i+=3)p.positions[i]-=floor;});
  const merged=[];
  for(const leaf of [false,true]){
   const group=raw.filter(p=>p.leaf===leaf),positions=new Float32Array(group.reduce((n,p)=>n+p.positions.length,0)),normals=new Float32Array(positions.length),uv=new Float32Array(positions.length/3*2),indices=[];let vertex=0;
   for(const p of group){positions.set(p.positions,vertex*3);normals.set(p.normals,vertex*3);uv.set(p.uv,vertex*2);for(const i of p.indices)indices.push(i+vertex);vertex+=p.positions.length/3;}
   merged.push({positions,normals,uv,indices:new Uint32Array(indices),leaf});
  }
  const lods=[];
  for(const level of [0,1,2]){
   const parts=merged.map(p=>{
    if(p.leaf)return canopyClusters(p,ceiling-floor,name,level);
    const target=name==='fir_tree_01'?[3000,1000,200][level]:[250,130,60][level];
    const attributes=new Float32Array(p.positions.length/3*5);for(let i=0;i<p.positions.length/3;i++){attributes.set(p.normals.subarray(i*3,i*3+3),i*5);attributes.set(p.uv.subarray(i*2,i*2+2),i*5+3);}
    const [index,error]=MeshoptSimplifier.simplifyWithAttributes(p.indices,p.positions,3,attributes,5,[.015,.015,.015,.035,.035],null,Math.min(p.indices.length,target*3),.12,['Prune']);
    const geometry=compact(index,p.positions,p.normals,p.uv);console.log(name,meshId,level,p.leaf?'canopy':'wood',index.length/3,error);
    return{...geometry,leaf:p.leaf,error};
   });
   lods.push(parts);
  }
  variants.push({height:ceiling-floor,sourceMesh:meshId,lods});
 }
 }
 const source={id:name,license:'CC0',url:'https://polyhaven.com/a/'+name,slices,canopy:'Complete-source branch distribution with photographed fir twig proxies; original wood geometry, not simplified individual needles'};
 await writeFile(output+'/'+name+'.json',JSON.stringify({source,variants}));
}
