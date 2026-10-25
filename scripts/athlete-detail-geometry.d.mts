import type {BufferGeometry} from 'three';
export function refineAthleteGeometry(source:BufferGeometry,jointNames:readonly string[],levels?:number):BufferGeometry;
export function createAthleteHair(source:BufferGeometry,isHair:(u:number,v:number)=>boolean,count?:number):BufferGeometry;
