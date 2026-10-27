type Point={x:number;y:number;z:number};
const projected={x:0,y:0,z:0};
const boundedCarry=(value:number)=>Math.max(-.08,Math.min(.08,value));

export function heldCarryReference<T extends Point>(out:T,rest:Readonly<Point>,yaw:number):T{
 const {x,y,z}=rest,c=Math.cos(yaw),s=Math.sin(yaw);
 out.x=x*c+z*s;out.y=y;out.z=-x*s+z*c;return out;
}

/** Follow the unsolved chest, never the wrists that have already reached the ball. */
export function advanceHeldCarryOffset<T extends Point>(out:T,chest:Readonly<Point>|null,rest:Readonly<Point>,dt:number):T{
 if(!Number.isFinite(dt)||dt<=0)return out;
 const alpha=-Math.expm1(-18*Math.min(.06,dt));
 out.x+=((chest?boundedCarry(chest.x-rest.x):0)-out.x)*alpha;
 out.y+=((chest?boundedCarry(chest.y-rest.y):0)-out.y)*alpha;
 out.z+=((chest?boundedCarry(chest.z-rest.z):0)-out.z)*alpha;
 return out;
}

/** Choose a low point on the real elbow circle in the measured shoulder frame. */
export function heldElbowPole<T extends Point>(out:T,shoulder:Readonly<Point>,wrist:Readonly<Point>,right:Readonly<Point>,side:number,upper:number,lower:number):T{
 const sx=shoulder.x,sy=shoulder.y,sz=shoulder.z;
 const dx=wrist.x-sx,dy=wrist.y-sy,dz=wrist.z-sz,d=Math.hypot(dx,dy,dz);
 const ux=dx/Math.max(d,1e-8),uy=dy/Math.max(d,1e-8),uz=dz/Math.max(d,1e-8);
 const rx=right.x,ry=right.y,rz=right.z,wx=dx*rx+dy*ry+dz*rz;
 const ex=dx-rx*wx,ey=dy-ry*wx,ez=dz-rz*wx,plane=Math.hypot(ex,ey,ez);
 if(plane<1e-6||!Number.isFinite(d+upper+lower)||upper<=0||lower<=0){out.x=sx+side*.1;out.y=sy-.3;out.z=sz;return out;}
 const vx=ex/plane,vy=ey/plane,vz=ez/plane;
 let nx=ry*vz-rz*vy,ny=rz*vx-rx*vz,nz=rx*vy-ry*vx;
 if(ny>0){nx=-nx;ny=-ny;nz=-nz;}
 const along=(upper*upper-lower*lower+d*d)/(2*Math.max(d,1e-8)),radius=Math.sqrt(Math.max(0,upper*upper-along*along));
 const axisDot=ux*rx+uy*ry+uz*rz,centre=along*axisDot,range=radius*Math.sqrt(Math.max(0,1-axisDot*axisDot));
 const inset=Math.min(1e-4,range*.1),minimum=centre-range+inset,maximum=centre+range-inset;
 let x=Math.max(minimum,Math.min(maximum,side*.1198));
 const sample=(lateral:number,target:Point)=>{const r0=Math.max(0,upper*upper-lateral*lateral),r1=lower*lower-(wx-lateral)**2,a=(r0-r1+plane*plane)/(2*plane),h=Math.sqrt(Math.max(0,r0-a*a));target.x=rx*lateral+vx*a+nx*h;target.y=ry*lateral+vy*a+ny*h;target.z=rz*lateral+vz*a+nz*h;};
 sample(x,projected);
 if(projected.y>-.205&&radius>0){
  const downLength=Math.sqrt(Math.max(0,1-uy*uy));
  const downX=downLength>1e-7?uy*ux/downLength:0,downY=-downLength,downZ=downLength>1e-7?uy*uz/downLength:0;
  const lowest=(along*ux+radius*downX)*rx+(along*uy+radius*downY)*ry+(along*uz+radius*downZ)*rz;
  let low=Math.max(minimum,Math.min(maximum,lowest)),high=x;sample(low,projected);
  if(projected.y<=-.205&&side*low<.12){for(let i=0;i<12;i++){const mid=(low+high)*.5;sample(mid,projected);if(projected.y<=-.205)low=mid;else high=mid;}x=low;}
 }
 sample(x,out);out.x+=sx;out.y+=sy;out.z+=sz;return out;
}
