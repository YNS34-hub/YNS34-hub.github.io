// One world-space colour field on both sides of the near/far terrain boundary.
import {earthSampling} from './earthSampling';
export const pastureSampling=earthSampling+`
 float pastureNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);vec4 h=fract(sin(vec4(dot(i,vec2(127.1,311.7)),dot(i+vec2(1.,0.),vec2(127.1,311.7)),dot(i+vec2(0.,1.),vec2(127.1,311.7)),dot(i+vec2(1.,1.),vec2(127.1,311.7))))*43758.5453);return mix(mix(h.x,h.y,f.x),mix(h.z,h.w,f.x),f.y);}
 vec3 worldPasture(sampler2D photo,vec2 world){vec3 c=earthPhoto(photo,world/3.5);float grey=dot(c,vec3(.2126,.7152,.0722));return mix(c,vec3(grey)*vec3(.78,1.02,.62),.50)*.72*(.70+.43*pastureNoise(world*.006));}
`;
