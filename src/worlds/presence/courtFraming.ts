import {create} from 'zustand';
export type CourtFraming='court'|'detail';
export const normalizeCourtFraming=(value:unknown):CourtFraming=>value==='detail'?'detail':'court';
const KEY='memory-palace:court-framing:v1';
function read():CourtFraming{try{return normalizeCourtFraming(localStorage.getItem(KEY));}catch{return'court';}}
export const useCourtFraming=create<{framing:CourtFraming;setFraming:(value:CourtFraming)=>void}>(set=>({
 framing:read(),setFraming:value=>{if(value!=='court'&&value!=='detail')return;try{localStorage.setItem(KEY,value);}catch{/* 当前会话仍可调整镜头。 */}set({framing:value});},
}));
