import {BufferAttribute,BufferGeometry,Float32BufferAttribute,Uint16BufferAttribute,Vector3} from 'three';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';

const pointKey=(x,y,z)=>[x,y,z].map(v=>Math.round(v*1e5)).join(',');
/** Curved midpoint refinement in the source centimetre bind space. Bones and source geometry are untouched. */
export function refineAthleteGeometry(source,jointNames,levels=2){
 if(!Number.isInteger(levels)||levels<0||levels>2)throw Error('Athlete detail levels must be0..2');
 for(const name of['position','normal','uv','skinIndex','skinWeight'])if(!source.getAttribute(name))throw Error('Missing skinned attribute '+name);
 let geometry=mergeVertices(source,1e-5);
 for(let level=0;level<levels;level++){
  const p=geometry.getAttribute('position'),n=geometry.getAttribute('normal'),uv=geometry.getAttribute('uv'),j=geometry.getAttribute('skinIndex'),w=geometry.getAttribute('skinWeight');
  const positions=Array.from(p.array),normals=Array.from(n.array),uvs=Array.from(uv.array),joints=Array.from(j.array),weights=Array.from(w.array),indices=[],edges=new Map(),curves=new Map(),smoothNormals=new Map();
  const extras=Object.fromEntries(Object.entries(geometry.attributes).filter(([name])=>!['position','normal','uv','skinIndex','skinWeight'].includes(name)).map(([name,attribute])=>[name,{attribute,values:Array.from(attribute.array)}]));
  const keys=Array.from({length:p.count},(_,i)=>pointKey(p.getX(i),p.getY(i),p.getZ(i)));
  for(let i=0;i<p.count;i++){const key=keys[i],a=smoothNormals.get(key)||[0,0,0];a[0]+=n.getX(i);a[1]+=n.getY(i);a[2]+=n.getZ(i);smoothNormals.set(key,a);}
  for(const a of smoothNormals.values()){const l=Math.hypot(...a)||1;for(let c=0;c<3;c++)a[c]/=l;}
  const protectedVertex=i=>{if(p.getZ(i)<17)return true;for(let c=0;c<4;c++)if(w.array[i*4+c]>.15&&/Hand|Finger|Foot|Toe/.test(jointNames[j.array[i*4+c]]||''))return true;return false;};
  const midpoint=(a,b)=>{
   const edge=a<b?a+':'+b:b+':'+a;if(edges.has(edge))return edges.get(edge);
   const id=positions.length/3,key=keys[a]<keys[b]?keys[a]+'|'+keys[b]:keys[b]+'|'+keys[a];let position=curves.get(key);
   if(!position){
    position=[0,1,2].map(c=>(p.array[a*3+c]+p.array[b*3+c])*.5);
    if(!protectedVertex(a)&&!protectedVertex(b)){
     const na=smoothNormals.get(keys[a]),nb=smoothNormals.get(keys[b]),d=[0,1,2].map(c=>p.array[b*3+c]-p.array[a*3+c]),da=d.reduce((s,v,c)=>s+v*na[c],0),db=-d.reduce((s,v,c)=>s+v*nb[c],0),offset=na.map((v,c)=>-.125*(da*v+db*nb[c]));
     const length=Math.hypot(...offset),scale=length>0?Math.min(1,(.22/2**level)/length):0;position=position.map((v,c)=>v+offset[c]*scale);
    }
    curves.set(key,position);
   }
   positions.push(...position);const normal=[0,1,2].map(c=>n.array[a*3+c]+n.array[b*3+c]),length=Math.hypot(...normal)||1;normals.push(...normal.map(v=>v/length));uvs.push((uv.getX(a)+uv.getX(b))*.5,(uv.getY(a)+uv.getY(b))*.5);
   for(const {attribute,values}of Object.values(extras))for(let c=0;c<attribute.itemSize;c++)values.push((attribute.array[a*attribute.itemSize+c]+attribute.array[b*attribute.itemSize+c])*.5);
   const influence=new Map();for(const vertex of[a,b])for(let c=0;c<4;c++){const bone=j.array[vertex*4+c],weight=w.array[vertex*4+c]*.5;influence.set(bone,(influence.get(bone)||0)+weight);}
   const sorted=[...influence].filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]||a[0]-b[0]).slice(0,4),sum=sorted.reduce((s,[,v])=>s+v,0);if(!(sum>0))throw Error('Missing skin influence');while(sorted.length<4)sorted.push([0,0]);joints.push(...sorted.map(([bone])=>bone));weights.push(...sorted.map(([,v])=>v/sum));edges.set(edge,id);return id;
  };
  const old=geometry.index.array;for(let i=0;i<old.length;i+=3){const a=old[i],b=old[i+1],c=old[i+2],ab=midpoint(a,b),bc=midpoint(b,c),ca=midpoint(c,a);indices.push(a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca);}
  const next=new BufferGeometry();next.setAttribute('position',new Float32BufferAttribute(positions,3));next.setAttribute('normal',new Float32BufferAttribute(normals,3));next.setAttribute('uv',new Float32BufferAttribute(uvs,2));next.setAttribute('skinIndex',new Uint16BufferAttribute(joints,4));next.setAttribute('skinWeight',new Float32BufferAttribute(weights,4));for(const[name,{attribute,values}]of Object.entries(extras))next.setAttribute(name,new BufferAttribute(new attribute.array.constructor(values),attribute.itemSize,attribute.normalized));next.setIndex(indices);for(const group of geometry.groups)next.addGroup(group.start*4,group.count*4,group.materialIndex);geometry.dispose();geometry=next;
 }
 geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}

/** Short swept scalp ribbons, sampled only from the source hair atlas; never from a private face. */
export function createAthleteHair(source,isHair,count=3200){
 const p=source.getAttribute('position'),n=source.getAttribute('normal'),uv=source.getAttribute('uv'),j=source.getAttribute('skinIndex'),w=source.getAttribute('skinWeight'),index=source.index.array,triangles=[];let area=0;
 const a=new Vector3(),b=a.clone(),c=a.clone(),ab=a.clone(),ac=a.clone();
 for(let i=0;i<index.length;i+=3){const ids=[index[i],index[i+1],index[i+2]],u=ids.reduce((s,v)=>s+uv.getX(v),0)/3,v=ids.reduce((s,k)=>s+uv.getY(k),0)/3;if(!isHair(u,v))continue;a.fromBufferAttribute(p,ids[0]);b.fromBufferAttribute(p,ids[1]);c.fromBufferAttribute(p,ids[2]);if(Math.min(a.z,b.z,c.z)<166)continue;const size=ab.subVectors(b,a).cross(ac.subVectors(c,a)).length()*.5;if(size>0){area+=size;triangles.push({ids,end:area});}}
 if(!triangles.length)throw Error('No authored scalp surface');
 let seed=210426;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};const positions=[],normals=[],uvs=[],joints=[],weights=[],indices=[];
 let attempts=0;for(let strand=0;strand<count;strand++){
  if(++attempts>count*50)throw Error('Hair atlas sampling did not converge');
  const pick=random()*area,t=triangles.find(row=>row.end>=pick),r=Math.sqrt(random()),s=random(),mix=[1-r,r*(1-s),r*s],root=new Vector3(),normal=new Vector3();let u=0,v=0;const influence=new Map();
  for(let k=0;k<3;k++){const id=t.ids[k],weight=mix[k];root.addScaledVector(a.fromBufferAttribute(p,id),weight);normal.addScaledVector(a.fromBufferAttribute(n,id),weight);u+=uv.getX(id)*weight;v+=uv.getY(id)*weight;for(let component=0;component<4;component++){const bone=j.array[id*4+component];influence.set(bone,(influence.get(bone)||0)+w.array[id*4+component]*weight);}}
  if(!isHair(u,v)){strand--;continue;}normal.normalize();const flow=new Vector3(.14*(random()-.5),1,.12).addScaledVector(normal,-normal.y-.12*normal.z).normalize(),width=new Vector3().crossVectors(normal,flow).normalize(),length=.55+random()*.65,halfWidth=.035+random()*.025,first=positions.length/3;
  const skin=[...influence].sort((a,b)=>b[1]-a[1]).slice(0,4),sum=skin.reduce((s,[,v])=>s+v,0);while(skin.length<4)skin.push([0,0]);
  for(let segment=0;segment<4;segment++){const t=segment/3,centre=root.clone().addScaledVector(flow,length*t).addScaledVector(normal,.025+length*.24*Math.sin(Math.PI*t));for(const side of[-1,1]){a.copy(centre).addScaledVector(width,side*halfWidth*(1-.92*t));positions.push(a.x,a.y,a.z);normals.push(normal.x,normal.y,normal.z);uvs.push(t,(side+1)/2);joints.push(...skin.map(([bone])=>bone));weights.push(...skin.map(([,v])=>v/sum));}if(segment<3){const i=first+segment*2;indices.push(i,i+1,i+2,i+1,i+3,i+2);}}
 }
 const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new Float32BufferAttribute(uvs,2));geometry.setAttribute('skinIndex',new Uint16BufferAttribute(joints,4));geometry.setAttribute('skinWeight',new Float32BufferAttribute(weights,4));geometry.setIndex(indices);return geometry;
}
