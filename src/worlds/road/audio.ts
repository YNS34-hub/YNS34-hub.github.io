import { useEffect,useMemo,useRef } from "react";
import { unlockAudioContext,useAudioStore } from "../../audio/player";
import { usePalaceStore } from "../../systems/store";

export interface RoadSoundInput {speed:number;cadence:number;pedaling:boolean;brake:number;nearWater:number;forest:number;stopped:boolean}
// 环境声是原 AudioContext 的旁路节点，不拥有曲目、双槽播放器、FFT 或用户曲库。
export function createRoadAudio(){
  let context:AudioContext|undefined,bus:GainNode|undefined,source:AudioBufferSourceNode|undefined,hub:AudioBufferSourceNode|undefined;
  const nodes:AudioNode[]=[],voices=new Set<AudioScheduledSourceNode>(),layers:Record<string,GainNode>={};let disposed=false,lastUpdate=-1,birdAt=0;
  const debug={freehub:false,wind:0,tire:0,chain:0,water:0,activeVoices:0,unlocked:false};
  const unlock=()=>{
    if(disposed)return;context=unlockAudioContext();if(!context||bus)return;
    const ctx=context;bus=ctx.createGain();bus.gain.value=0;bus.connect(ctx.destination);nodes.push(bus);
    const noise=ctx.createBuffer(1,ctx.sampleRate*4,ctx.sampleRate),data=noise.getChannelData(0);
    let seed=721;const random=()=>{seed=Math.imul(seed,1664525)+1013904223|0;return(seed>>>0)/4294967296*2-1;};
    for(let i=0;i<data.length;i++)data[i]=random();
    source=ctx.createBufferSource();source.buffer=noise;source.loop=true;nodes.push(source);
    const layer=(name:string,type:BiquadFilterType,frequency:number,q:number)=>{
      const filter=ctx.createBiquadFilter(),gain=ctx.createGain();filter.type=type;filter.frequency.value=frequency;filter.Q.value=q;gain.gain.value=0;
      source!.connect(filter);filter.connect(gain);gain.connect(bus!);layers[name]=gain;nodes.push(filter,gain);
    };
    layer("wind","lowpass",550,.2);layer("tire","bandpass",2700,.55);layer("chain","highpass",4400,.5);layer("water","bandpass",950,.3);layer("leaves","bandpass",1700,.2);
    const ratchet=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate),clicks=ratchet.getChannelData(0);
    for(let tooth=0;tooth<48;tooth++)for(let i=0;i<ctx.sampleRate*.0018;i++){
      const index=Math.floor(tooth/48*ctx.sampleRate)+i;
      clicks[index]=Math.exp(-i/(ctx.sampleRate*.00045))*(random()*.5+Math.sin(i/ctx.sampleRate*Math.PI*2*3700)*.5);
    }
    hub=ctx.createBufferSource();hub.buffer=ratchet;hub.loop=true;const gain=ctx.createGain();gain.gain.value=0;hub.connect(gain);gain.connect(bus);layers.hub=gain;nodes.push(hub,gain);
    source.start();hub.start();debug.unlocked=true;
  };
  const shift=()=>{
    if(!context||!bus||disposed||voices.size>=4||usePalaceStore.getState().mute)return;
    const ctx=context,now=ctx.currentTime,voice=ctx.createOscillator(),gain=ctx.createGain();voice.type="triangle";voice.frequency.setValueAtTime(1350,now);voice.frequency.exponentialRampToValueAtTime(520,now+.045);
    gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.13,now+.003);gain.gain.exponentialRampToValueAtTime(.0001,now+.07);
    voice.connect(gain);gain.connect(bus);voice.start();voice.stop(now+.08);voices.add(voice);
    voice.onended=()=>{voice.disconnect();gain.disconnect();voices.delete(voice);};
  };
  const update=(input:RoadSoundInput)=>{
    if(!context||!bus||disposed||context.currentTime-lastUpdate<.08)return;
    const ctx=context,now=ctx.currentTime,dt=lastUpdate<0?0:now-lastUpdate;lastUpdate=now;
    const state=usePalaceStore.getState(),duck=useAudioStore.getState().playing?.35:1,level=state.mute?0:state.ambientVolume;
    bus.gain.setTargetAtTime(level,now,.10);
    const v=Math.min(1,input.speed/15.28),rolling=input.speed>.08;
    debug.freehub=rolling&&!input.pedaling;debug.wind=Math.pow(v,1.65)*.42*duck;debug.tire=Math.pow(v,.8)*.095*duck;
    debug.chain=input.pedaling?Math.min(1,input.cadence/100)*.035*duck:0;debug.water=input.nearWater*(input.stopped?.075:.03)*duck;
    layers.wind.gain.setTargetAtTime(debug.wind,now,.35);layers.tire.gain.setTargetAtTime(debug.tire,now,.22);layers.chain.gain.setTargetAtTime(debug.chain,now,.12);
    layers.hub.gain.setTargetAtTime(debug.freehub?.29*duck:0,now,.065);hub!.playbackRate.setTargetAtTime(Math.max(.05,input.speed/2.14),now,.1);
    layers.water.gain.setTargetAtTime(debug.water,now,.7);layers.leaves.gain.setTargetAtTime(input.forest*(input.stopped?.018:.009)*duck,now,.8);
    birdAt+=dt;
    if(birdAt>14&&input.forest>.4&&voices.size<4&&!state.mute){
      birdAt=0;const bird=ctx.createOscillator(),gain=ctx.createGain();bird.type="sine";bird.frequency.setValueAtTime(2600,now);bird.frequency.exponentialRampToValueAtTime(3550,now+.08);bird.frequency.exponentialRampToValueAtTime(2700,now+.20);
      gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(input.stopped?.10:.038,now+.06);gain.gain.exponentialRampToValueAtTime(.0001,now+.25);
      bird.connect(gain);gain.connect(bus);bird.start();bird.stop(now+.26);voices.add(bird);bird.onended=()=>{bird.disconnect();gain.disconnect();voices.delete(bird);};
    }
    debug.activeVoices=voices.size;
  };
  return{unlock,shift,update,debug,monitor:()=>import.meta.env.DEV?bus:undefined,dispose:()=>{
    if(disposed)return;disposed=true;source?.stop();hub?.stop();for(const voice of voices){try{voice.stop();}catch{/* 已结束的短音效无需重复停止。 */}}voices.clear();nodes.forEach(node=>node.disconnect());
  }};
}
export function useRoadAudio(){
  const audio=useRef<ReturnType<typeof createRoadAudio>|null>(null);
  useEffect(()=>{const instance=createRoadAudio();audio.current=instance;return()=>{instance.dispose();if(audio.current===instance)audio.current=null;};},[]);
  return useMemo(()=>({unlock:()=>audio.current?.unlock(),shift:()=>audio.current?.shift(),update:(input:RoadSoundInput)=>audio.current?.update(input),debug:()=>audio.current?.debug,monitor:()=>audio.current?.monitor()}),[]);
}
