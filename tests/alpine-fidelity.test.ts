import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {Vector3} from "three";
import {alpineLength,nearestAlpine,sampleAlpine,setAlpineHeightfield,setAlpineDetailfield,alpineGround,alpineElevation} from "../src/worlds/alpine/route";
import {atlasUV,type ImageAtlas} from "../src/worlds/alpine/projection";
import {buildAlpineTerrain} from "../src/worlds/alpine/terrainMesh";

const meta=JSON.parse(readFileSync("public/media/alpine/geography.json","utf8"));
describe("measured alpine detail",()=>{
  it("loads bounded, complete signed elevation grids with a continuous detail border",()=>{
    for(const name of["massif","detail"]){
      const file=readFileSync("public/media/alpine/"+name+"-dem.bin"),data=meta[name];
      expect(file.byteLength).toBe(data.width*data.height*2);
      const values=new Int16Array(file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength));
      expect(values.every(v=>Number.isFinite(v)&&v> -3000&&v<9000)).toBe(true);
      if(name==="massif")setAlpineHeightfield({...data,values});else setAlpineDetailfield({...data,values});
    }
    for(const z of[-500,0,1200])expect(Math.abs(alpineElevation(meta.detail.x0-.1,z)-alpineElevation(meta.detail.x0+.1,z))).toBeLessThan(1);
    const p=new Vector3(),t=new Vector3();for(let d=0;d<alpineLength;d+=37){sampleAlpine(d,p,t);expect(Math.abs(alpineGround(p.x,p.z)-(p.y-.16))).toBeLessThan(.15);}
  });
  it("matches exact Mercator atlas coordinates without subtracting large GPU pixel coordinates",()=>{
    for(const image of[meta.imagery,meta.nearImagery] as ImageAtlas[])for(const x of[-9600,-4200,0,9000])for(const z of[-7400,0,7600]){
      const [u,v]=atlasUV(image,x,z),scale=2**image.zoom*256,latitude=(image.latitude-z/111320)*Math.PI/180;
      const exactX=((image.longitude+x/image.eastMetresPerDegree+180)/360*scale-image.left)/image.width;
      const exactY=1-((1-Math.asinh(Math.tan(latitude))/Math.PI)/2*scale-image.top)/image.height;
      expect(Math.abs(u-exactX)*image.width).toBeLessThan(.001);expect(Math.abs(v-exactY)*image.height).toBeLessThan(.005);
    }
  });
  it("finds the same nearest road on remote bends as an exhaustive sample search",()=>{
    const samples:Vector3[]=[],p=new Vector3(),t=new Vector3();for(let d=0;d<=Math.ceil(alpineLength/4)*4;d+=4){sampleAlpine(d,p,t);samples.push(p.clone());}
    for(const d of[0,900,3300,6700,alpineLength-30])for(const offset of[1.7,22,200,650]){
      sampleAlpine(d,p,t);const x=p.x-t.z*offset,z=p.z+t.x*offset;
      const brute=Math.min(...samples.map(s=>Math.hypot(s.x-x,s.z-z))),near=nearestAlpine(x,z);
      expect(near.distance).toBeLessThanOrEqual(brute+.001);expect(near.distance).toBeGreaterThan(brute-4.01);
      expect(Number.isFinite(near.point.y)).toBe(true);expect(near.distanceAlong).toBeGreaterThanOrEqual(0);expect(near.distanceAlong).toBeLessThanOrEqual(alpineLength);
    }
  });
  it("stitches adaptive boundaries and gives culled tiles real local bounds and shared normals",()=>{
    const field={x0:-320,z0:-320,width:33,height:33,step:20};
    const tiles=buildAlpineTerrain(field,"medium",(x,z)=>Math.sin(x*.02)+Math.cos(z*.03),(x,z)=>Math.hypot(x,z),160);
    const positions=tiles[0].getAttribute("position"),normals=tiles[0].getAttribute("normal"),edges=new Map<string,number>();
    expect(tiles.length).toBe(16);
    for(const g of tiles){
      expect(g.getAttribute("position")).toBe(positions);expect(g.getAttribute("normal")).toBe(normals);
      expect(g.boundingBox!.max.x-g.boundingBox!.min.x).toBeLessThanOrEqual(160.001);
      expect(g.boundingBox!.max.z-g.boundingBox!.min.z).toBeLessThanOrEqual(160.001);
      const a=g.index!;for(let i=0;i<a.count;i+=3){
        const tri=[a.getX(i),a.getX(i+1),a.getX(i+2)];
        for(let k=0;k<3;k++){const n=tri[k],b=tri[(k+1)%3],key=Math.min(n,b)+":"+Math.max(n,b);edges.set(key,(edges.get(key)??0)+1);}
      }
    }
    for(const [key,count] of edges){
      expect(count).toBeLessThanOrEqual(2);
      if(count===1){const [a,b]=key.split(":").map(Number),xa=positions.getX(a),xb=positions.getX(b),za=positions.getZ(a),zb=positions.getZ(b);
        expect(xa===xb&&Math.abs(xa)===320||za===zb&&Math.abs(za)===320,"interior mesh edge must be shared: "+key).toBe(true);}
    }
    tiles.forEach(g=>g.dispose());
  });
});
