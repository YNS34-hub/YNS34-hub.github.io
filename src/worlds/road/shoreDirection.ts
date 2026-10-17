type Height=(x:number,z:number)=>number;
/** The clipped contour can differ greatly from the original lake ellipse. */
export function shoreUphill(x:number,z:number,ground:Height,fallbackX:number,fallbackZ:number):[number,number]{
 const dx=ground(x+2,z)-ground(x-2,z),dz=ground(x,z+2)-ground(x,z-2),length=Math.hypot(dx,dz);
 if(Number.isFinite(length)&&length>1e-5)return[dx/length,dz/length];
 let best=-Infinity,direction:[number,number]=[fallbackX,fallbackZ];
 for(let i=0;i<8;i++){const angle=i*Math.PI/4,a=Math.cos(angle),b=Math.sin(angle),height=ground(x+a*3,z+b*3);if(Number.isFinite(height)&&height>best){best=height;direction=[a,b];}}
 const size=Math.hypot(...direction)||1;return[direction[0]/size,direction[1]/size];
}
