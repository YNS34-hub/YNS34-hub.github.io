type Point={x:number;y:number;z:number};
const clamp=(v:number)=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));

/** Low/rear dribbles need enough time to collect without changing quick held shots. */
export function chooseShotGatherDuration(dribbling:boolean,distance:number):number{
 return dribbling&&Number.isFinite(distance)?Math.max(.16,Math.min(.34,Math.max(0,distance)*1.5/6.5)):.16;
}

/** Blend a world-space shot goal from the real ball and body translation once. */
export function blendShotGather<T extends Point>(out:T,seed:Readonly<Point>,origin:Readonly<Point>,body:Readonly<Point>,elapsed:number,duration:number):T{
 const t=clamp(elapsed/(Number.isFinite(duration)&&duration>0?duration:.16)),s=t*t*(3-2*t);
 if(t===1)return out;
 const x=seed.x+body.x-origin.x,y=seed.y+body.y-origin.y,z=seed.z+body.z-origin.z;
 out.x=x+(out.x-x)*s;out.y=y+(out.y-y)*s;out.z=z+(out.z-z)*s;return out;
}
