import {lake} from "./route";

// 湖床、远地表与近路堤共用矿物色，湿润范围按真实水位计算；不增加贴花或透明覆盖层。
export const lakeBankShader=`
  float lakeBankNoise(vec2 p){
    vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    vec4 h=fract(sin(vec4(dot(i,vec2(127.1,311.7)),dot(i+vec2(1.,0.),vec2(127.1,311.7)),dot(i+vec2(0.,1.),vec2(127.1,311.7)),dot(i+vec2(1.,1.),vec2(127.1,311.7))))*43758.5453);
    return mix(mix(h.x,h.y,f.x),mix(h.z,h.w,f.x),f.y);
  }
  vec3 lakeMineral(vec3 surface){
    float luminance=dot(surface,vec3(.2126,.7152,.0722));
    return mix(surface,vec3(luminance)*vec3(1.16,1.08,.88),.82);
  }
  vec2 lakeBankZones(vec3 world){
    float radius=length((world.xz-vec2(${lake.x.toFixed(1)},${lake.z.toFixed(1)}))/vec2(${lake.rx.toFixed(1)},${lake.rz.toFixed(1)}));
    float height=world.y-${lake.y};
    if(radius>1.5||height>2.6||height<-.8)return vec2(0.);
    float grain=lakeBankNoise(world.xz*.15),edge=lakeBankNoise(world.xz*.73);
    float contact=height+(grain-.5)*.18+(edge-.5)*.05;
    float extent=1.-smoothstep(1.28,1.5,radius);
    float wet=(1.-smoothstep(.05,.42,contact))*extent;
    float sediment=(1.-smoothstep(.3,1.35+grain*.65,height))*extent;
    return vec2(wet,sediment);
  }
  vec3 lakeBankColor(vec3 surface,vec2 zones){
    return mix(surface,lakeMineral(surface),zones.y*.88)*mix(1.,.64,zones.x);
  }
`;
