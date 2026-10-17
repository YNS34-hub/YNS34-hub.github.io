// 世界坐标不随分区或相机变化。三角晶格随机偏移原照片，不旋转法线，
// 显式像素足迹过滤避免高各向异性把地平线附近的平铺纹理还原成条纹。
export const earthSampling=`
  vec2 earthHash(vec2 p){vec3 h=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));h+=dot(h,h.yxz+33.33);return fract((h.xx+h.yz)*h.zy);}
  vec3 earthPhoto(sampler2D tex,vec2 uv){
    vec2 footprint=max(abs(dFdx(uv)),abs(dFdy(uv)))*vec2(textureSize(tex,0));
    float lod=max(0.,log2(max(length(footprint),1.))+.6);
    vec2 grid=mat2(1.,0.,-.577350269,1.154700538)*uv;
    vec2 cell=floor(grid),f=fract(grid),a=cell,b,c;vec3 w;
    if(f.x+f.y<1.){b=cell+vec2(1.,0.);c=cell+vec2(0.,1.);w=vec3(1.-f.x-f.y,f.x,f.y);}
    else{a=cell+vec2(1.);b=cell+vec2(0.,1.);c=cell+vec2(1.,0.);w=vec3(f.x+f.y-1.,1.-f.x,1.-f.y);}
    w=w*w*w;w/=w.x+w.y+w.z;
    return textureLod(tex,uv+earthHash(a),lod).rgb*w.x+
      textureLod(tex,uv+earthHash(b),lod).rgb*w.y+textureLod(tex,uv+earthHash(c),lod).rgb*w.z;
  }
`;
