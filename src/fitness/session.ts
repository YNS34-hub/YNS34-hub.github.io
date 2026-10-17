import {create} from 'zustand';
import {exercises,type Exercise} from './exercises';
export type FitnessClock={exercise:Exercise;running:boolean;speed:number;elapsed:number;phase:number;reps:number;transition:number;revision:number};
export const newFitnessClock=():FitnessClock=>({exercise:'squat',running:false,speed:1,elapsed:0,phase:0,reps:0,transition:1,revision:0});
/** One clock owns pose, repetition and plank duration. Visibility never catches up. */
export function advanceFitness(state:FitnessClock,raw:number,blocked:boolean):FitnessClock{
 if(blocked||!state.running||!Number.isFinite(raw)||raw<=0)return state;
 const dt=Math.min(.06,raw);state.transition=Math.min(1,state.transition+dt/1.2);
 if(!state.running||state.transition<1)return state;
 const elapsed=dt*state.speed,previous=state.elapsed;state.elapsed+=elapsed;
 const period=exercises[state.exercise].period,cycles=Math.floor((state.elapsed+1e-9)/period);state.phase=Math.max(0,(state.elapsed-cycles*period)/period);
 if(state.exercise!=='plank')state.reps+=cycles-Math.floor((previous+1e-9)/period);
 return state;
}
export const fitnessClock=newFitnessClock();
type Controls={exercise:Exercise;running:boolean;speed:number;mediaOpen:boolean;select:(id:Exercise)=>void;toggle:()=>void;reset:()=>void;setSpeed:(n:number)=>void;setMediaOpen:(open:boolean)=>void};
export const useFitness=create<Controls>((set)=>({exercise:fitnessClock.exercise,running:false,speed:1,mediaOpen:false,
 select:id=>{fitnessClock.exercise=id;fitnessClock.phase=fitnessClock.elapsed=fitnessClock.reps=0;fitnessClock.transition=0;fitnessClock.revision++;set({exercise:id});},
 toggle:()=>{fitnessClock.running=!fitnessClock.running;set({running:fitnessClock.running});},
 reset:()=>{fitnessClock.phase=fitnessClock.elapsed=fitnessClock.reps=0;fitnessClock.transition=0;fitnessClock.revision++;fitnessClock.running=false;set({running:false});},
 setSpeed:n=>{if(!Number.isFinite(n))return;fitnessClock.speed=Math.max(.5,Math.min(1.5,n));set({speed:fitnessClock.speed});},
 setMediaOpen:mediaOpen=>set({mediaOpen}),
}));
