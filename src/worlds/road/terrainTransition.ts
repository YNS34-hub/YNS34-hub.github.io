const smooth=(v:number)=>{const t=Math.max(0,Math.min(1,v));return t*t*(3-2*t);};
/** Only the outer scenery skirt moves; the road and walkable 65 m stay intact. */
export function terrainSkirtWeight(offset:number){return smooth((Math.abs(offset)-65)/20);}
export function terrainSkirtHeight(near:number,far:number,offset:number){return near+(far-near)*terrainSkirtWeight(offset);}
