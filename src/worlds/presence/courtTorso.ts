export type CourtTorso={pitch:number;turn:number;roll:number};
export const createCourtTorso=():CourtTorso=>({pitch:0,turn:0,roll:0});

/** One persistent additive layer above the real mixer, including action entry/exit and pause. */
export function advanceCourtTorso(out:CourtTorso,target:Readonly<CourtTorso>,delta:number):CourtTorso{
 if(!Number.isFinite(delta)||delta<=0)return out;
 const dt=Math.min(.06,delta),alpha=-Math.expm1(-28*dt),maximum=4.5*dt;
 for(const key of ['pitch','turn','roll']as const){
  if(!Number.isFinite(target[key]))continue;
  const difference=(target[key]-out[key])*alpha;
  out[key]+=Math.max(-maximum,Math.min(maximum,difference));
 }
 return out;
}
