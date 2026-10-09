import {beforeEach,describe,expect,it,vi} from "vitest";
const fixture=vi.hoisted(()=>{
  const parameter=()=>({value:0,setTargetAtTime:vi.fn(),setValueAtTime:vi.fn(),exponentialRampToValueAtTime:vi.fn()});
  const makeNode=()=>({connect:vi.fn(),disconnect:vi.fn(),start:vi.fn(),stop:vi.fn(),gain:parameter(),frequency:parameter(),playbackRate:parameter(),Q:{value:0},onended:null});
  const nodes:ReturnType<typeof makeNode>[]=[],node=()=>{const n=makeNode();nodes.push(n);return n;};
  const context={currentTime:0,state:"running",sampleRate:8000,destination:{},close:vi.fn(),createGain:node,createBufferSource:node,createOscillator:node,createBiquadFilter:node,createBuffer:(_channels:number,length:number)=>({getChannelData:()=>new Float32Array(length)})};
  return{context,nodes,settings:{mute:false,ambientVolume:.3},player:{playing:false},unlock:vi.fn(()=>context)};
});
vi.mock("../src/audio/player",()=>({unlockAudioContext:fixture.unlock,useAudioStore:{getState:()=>fixture.player}}));
vi.mock("../src/systems/store",()=>({usePalaceStore:{getState:()=>fixture.settings}}));
import {createRoadAudio} from "../src/worlds/road/audio";
beforeEach(()=>{fixture.nodes.length=0;fixture.context.currentTime=0;fixture.settings.mute=false;fixture.player.playing=false;vi.clearAllMocks();});
const moving={speed:9,cadence:90,pedaling:true,brake:0,nearWater:0,forest:.8,stopped:false};
describe("road audio reads the existing player and actual motion",()=>{
 it("switches freehub off on pedal and on while coasting with wheel-speed ratchet",()=>{
  const audio=createRoadAudio();audio.unlock();const count=fixture.nodes.length;audio.unlock();expect(fixture.nodes).toHaveLength(count);
  audio.update(moving);expect(audio.debug.freehub).toBe(false);expect(audio.debug.chain).toBeGreaterThan(0);
  fixture.context.currentTime=.2;audio.update({...moving,pedaling:false,cadence:0});expect(audio.debug.freehub).toBe(true);expect(audio.debug.chain).toBe(0);
  const hub=fixture.nodes.find(n=>n.playbackRate.setTargetAtTime.mock.calls.length)!;expect(hub.playbackRate.setTargetAtTime.mock.lastCall?.[0]).toBeCloseTo(9/2.14);
  fixture.context.currentTime=.4;audio.update(moving);expect(audio.debug.freehub).toBe(false);
  fixture.context.currentTime=.6;audio.update({...moving,speed:0,pedaling:false,stopped:true});expect(audio.debug.freehub).toBe(false);expect(audio.debug.tire).toBe(0);
  audio.dispose();expect(fixture.context.close).not.toHaveBeenCalled();
 });
 it("throttles automation, respects sound-off, ducks beside real music and bounds shift voices",()=>{
  const audio=createRoadAudio();audio.unlock();for(let i=0;i<90;i++)audio.update(moving);
  expect(fixture.nodes[0].gain.setTargetAtTime).toHaveBeenCalledTimes(1);const wind=audio.debug.wind;
  fixture.context.currentTime=.2;fixture.settings.mute=true;fixture.player.playing=true;audio.update(moving);
  expect(fixture.nodes[0].gain.setTargetAtTime.mock.lastCall?.[0]).toBe(0);expect(audio.debug.wind).toBeCloseTo(wind*.35);
  audio.shift();expect(fixture.nodes.filter(n=>n.start.mock.calls.length)).toHaveLength(2);
  fixture.settings.mute=false;for(let i=0;i<20;i++)audio.shift();expect(fixture.nodes.filter(n=>n.start.mock.calls.length)).toHaveLength(6);
  audio.dispose();audio.dispose();expect(fixture.nodes[0].disconnect).toHaveBeenCalledTimes(1);expect(fixture.context.close).not.toHaveBeenCalled();
  const count=fixture.nodes.length;audio.unlock();audio.shift();audio.update(moving);expect(fixture.nodes).toHaveLength(count);
 });
});
