import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {Quaternion,Vector3} from 'three';

type Node={name:string;translation?:number[];rotation?:number[]};
const asset=JSON.parse(readFileSync('public/media/presence/athlete.gltf','utf8')) as {nodes:Node[]};
const node=(name:string)=>{const n=asset.nodes.find(n=>n.name===name);if(!n)throw Error(name);return n;};
const rotation=(n:Node)=>new Quaternion().fromArray(n.rotation??[0,0,0,1]);

describe('physical palm axes come from the actual athlete finger hierarchy',()=>{
 for(const side of ['L','R'])for(const index of [1,2,3,4])it(`${side} finger ${index} extends along +X and curls into +Y of the hand`,()=>{
  const finger=node(`Bip01_${side}_Finger${index}`),joint=node(`Bip01_${side}_Finger${index}1`);
  const jointOffset=new Vector3().fromArray(joint.translation??[0,0,0]);
  expect(jointOffset.x).toBeGreaterThan(0);expect(Math.abs(jointOffset.y)+Math.abs(jointOffset.z)).toBeLessThan(.001);
  const direction=new Vector3(1,0,0).applyQuaternion(rotation(finger).multiply(rotation(joint)));
  const curl=direction.clone().addScaledVector(new Vector3(1,0,0),-direction.x).normalize();
  expect(curl.y).toBeGreaterThan(.99);
 });
 it('mirrors the thumb-side geometry in Z without reversing the physical +Y palm surface',()=>{
  const left=node('Bip01_L_Finger1'),right=node('Bip01_R_Finger1');
  expect(left.translation![2]).toBeLessThan(0);expect(right.translation![2]).toBeGreaterThan(0);
  expect(rotation(left).z).toBeGreaterThan(0);expect(rotation(right).z).toBeGreaterThan(0);
 });
});
