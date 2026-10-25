import {BufferGeometry,Float32BufferAttribute} from "three";
import {habitat} from "./ecology";
import {atlasUV,type ImageAtlas} from '../alpine/projection';

// 森林地图本来就是原创湖谷。这里只改道路外围的地貌剪影，不声称是实测山体，
// 不接管 terrainHeight、道路坐标、停靠位置或骑行碰撞。
const chains=[
  {name:"north-ridge",x:550,z:-1400,angle:Math.PI,span:3700,depth:1100,height:540},
  {name:"west-spur",x:-650,z:-650,angle:-Math.PI/2,span:3300,depth:900,height:450},
  {name:"east-massif",x:1450,z:-720,angle:Math.PI/2,span:3600,depth:1200,height:610},
  {name:"south-foothills",x:450,z:600,angle:0,span:3400,depth:1000,height:360},
  {name:"distant-divide",x:620,z:-2530,angle:Math.PI,span:5000,depth:1800,height:920},
] as const;
export interface RidgeSamples {layers:{cols:number;rows:number;levels:number[];sourceWindow?:[number,number,number,number]}[]}
const smooth=(a:number,b:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export function createValleyRidges(samples:RidgeSamples,imagery?:ImageAtlas){
  if(samples.layers.length!==chains.length)throw new Error("Missing ridge samples");
  return chains.map((chain,layer)=>{
    const {cols,rows,levels,sourceWindow}=samples.layers[layer],p:number[]=[],uv:number[]=[],imageUV:number[]=[],indices:number[]=[];
    if(imagery&&!sourceWindow)throw new Error('Missing source coordinates for geological imagery');
    if(levels.length!==(cols+1)*(rows+1))throw new Error("Incomplete ridge height grid");
    const cs=Math.cos(chain.angle),sn=Math.sin(chain.angle);
    for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
      const u=i/cols,v=j/rows,lx=(u-.5)*chain.span,lz=v*chain.depth;
      // 地质褶皱来自不同的现有实测 DEM 窗口。仅远景重新布置和缩放；边缘沉入地表，避免裸露切面。
      const edge=smooth(0,.065,u)*smooth(0,.065,1-u),cross=smooth(0,.13,v)*smooth(0,.13,1-v);
      const measured=levels[j*(cols+1)+i]/65535;
      // 边界埋入原地表，内部主要保留 DEM 的实际峰谷；不让整段正弦圆包络盖过地貌差异。
      const h=-24+chain.height*cross*edge*(.05+.95*measured);
      p.push(chain.x+lx*cs+lz*sn,h,chain.z-lx*sn+lz*cs);uv.push(lx/3.2,lz/3.2);
      if(imagery&&sourceWindow)imageUV.push(...atlasUV(imagery,sourceWindow[0]+u*sourceWindow[2],sourceWindow[1]+v*sourceWindow[3]));
      if(i<cols&&j<rows){const a=j*(cols+1)+i;indices.push(a,a+cols+1,a+1,a+1,a+cols+1,a+cols+2);}
    }
    const g=new BufferGeometry();g.name=chain.name;g.setAttribute("position",new Float32BufferAttribute(p,3));g.setAttribute("uv",new Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
    const normals=g.getAttribute("normal"),colors:number[]=[];
    for(let i=0;i<p.length/3;i++){
      const soil=1-smooth(35,100,p[i*3+1]),flat=Math.max(0,normals.getY(i)),weather=.76+.18*habitat(p[i*3]*.32,p[i*3+2]*.32);
      colors.push(weather*(1-soil*.24*flat),weather*(1-soil*.10*flat),weather*(1-soil*.33*flat));
    }
    g.setAttribute("color",new Float32BufferAttribute(colors,3));if(imagery)g.setAttribute('ridgeImageUV',new Float32BufferAttribute(imageUV,2));g.computeBoundingSphere();return g;
  });
}
