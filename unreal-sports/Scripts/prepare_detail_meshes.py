"""生成原创草簇和石块低面数实例网格，不访问外部素材或私人目录。"""
from pathlib import Path
import json, math, random, struct
root=Path(__file__).resolve().parents[1]/'InputAssets'
rng=random.Random(17823)
def save(name,positions,normals,indices):
    blob=bytearray();views=[];accessors=[]
    for values,kind,fmt in [(positions,'VEC3','fff'),(normals,'VEC3','fff'),([[i] for i in indices],'SCALAR','I')]:
        offset=len(blob)
        for value in values:blob.extend(struct.pack('<'+fmt,*value))
        views.append({'buffer':0,'byteOffset':offset,'byteLength':len(blob)-offset})
        accessors.append({'bufferView':len(views)-1,'componentType':5125 if kind=='SCALAR' else 5126,
            'count':len(values),'type':kind})
    accessors[0]['min']=[min(p[k] for p in positions) for k in range(3)]
    accessors[0]['max']=[max(p[k] for p in positions) for k in range(3)]
    (root/(name+'.bin')).write_bytes(blob)
    doc={'asset':{'version':'2.0'},'scene':0,'scenes':[{'nodes':[0]}], 'nodes':[{'mesh':0}],
         'meshes':[{'name':name,'primitives':[{'attributes':{'POSITION':0,'NORMAL':1},'indices':2}]}],
         'accessors':accessors,'bufferViews':views,'buffers':[{'uri':name+'.bin','byteLength':len(blob)}]}
    (root/(name+'.gltf')).write_text(json.dumps(doc),encoding='utf-8')

positions=[];normals=[];indices=[]
for blade in range(22):
    angle=rng.uniform(0,math.tau);radius=rng.uniform(0,.34)
    x,z=math.cos(angle)*radius,math.sin(angle)*radius
    height=rng.uniform(.19,.57);width=rng.uniform(.012,.026);bend=rng.uniform(.035,.15)
    dx,dz=math.cos(angle+1.1),math.sin(angle+1.1)
    offset=len(positions)
    for y,w,shift in [(0,width,0),(height*.55,width*.65,bend*.3),(height,0,bend)]:
        for sign in [-1,1]:
            positions.append([x+dx*shift-dz*w*sign,y,z+dz*shift+dx*w*sign]);normals.append([0,.65,.76])
    indices.extend(offset+i for i in [0,2,1,1,2,3,2,4,3,3,4,5])
save('GrassClump',positions,normals,indices)
positions=[];normals=[];indices=[]
# 每个三角面保留独立法线，石块具备自然断面，不使用光滑圆球代替。
ring=[[math.cos(i*math.tau/7)*rng.uniform(.7,1.1),rng.uniform(.15,.35),math.sin(i*math.tau/7)*rng.uniform(.65,1.)] for i in range(7)]
for i in range(7):
    for tri in [[ring[i],ring[(i+1)%7],[.08,.8,-.08]],[[ring[i][0],0,ring[i][2]],ring[(i+1)%7],ring[i]]]:
        import numpy as np
        a,b,c=map(np.array,tri);n=np.cross(b-a,c-a);n/=np.linalg.norm(n)
        start=len(positions);positions.extend(tri);normals.extend([n.tolist()]*3);indices.extend([start,start+1,start+2])
save('ShoreStone',positions,normals,indices)
print('GrassClump 88 triangles; ShoreStone 14 triangles; original deterministic meshes')
