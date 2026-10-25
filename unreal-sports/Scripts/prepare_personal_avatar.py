"""将已有本机人物外观重新蒙皮至 Manny 参考骨架；私人素材全程留在忽略目录。"""
from pathlib import Path
import copy
import hashlib
import json
import shutil
import numpy as np
from scipy.spatial import cKDTree

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / 'unreal-motion-lab' / 'SourcePNG'
PRIVATE = Path(r'C:\Users\86135\Documents\Codex\2026-10-04\the-memory-palace-stop-building-a\work\palace\personal-media\avatar')
OUT = ROOT / 'InputAssets' / 'PrivateAvatar'
OUT.mkdir(parents=True, exist_ok=True)
(ROOT / 'Reports' / 'Private').mkdir(parents=True, exist_ok=True)

def read_gltf(path):
    doc = json.loads(path.read_text(encoding='utf-8'))
    buffers = [(path.parent / b['uri']).read_bytes() for b in doc['buffers']]
    def accessor(index):
        a = doc['accessors'][index]
        v = doc['bufferViews'][a['bufferView']]
        dtype = {5121:'u1', 5123:'<u2', 5125:'<u4', 5126:'<f4'}[a['componentType']]
        size = {'SCALAR':1, 'VEC2':2, 'VEC3':3, 'VEC4':4, 'MAT4':16}[a['type']]
        return np.ndarray((a['count'], size), dtype=dtype, buffer=buffers[v['buffer']],
                          offset=v.get('byteOffset',0)+a.get('byteOffset',0),
                          strides=(v.get('byteStride',size*np.dtype(dtype).itemsize),np.dtype(dtype).itemsize)).copy()
    worlds = {}
    def visit(index, parent):
        n = doc['nodes'][index]
        if 'matrix' in n:
            local = np.array(n['matrix']).reshape(4,4,order='F')
        else:
            x,y,z,w = n.get('rotation',[0,0,0,1])
            local = np.eye(4)
            local[:3,:3] = np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],
                [2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],
                [2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]]) @ np.diag(n.get('scale',[1,1,1]))
            local[:3,3] = n.get('translation',[0,0,0])
        worlds[index] = parent @ local
        for child in n.get('children',[]):visit(child,worlds[index])
    for index in doc['scenes'][doc.get('scene',0)]['nodes']:visit(index,np.eye(4))
    return doc, accessor, worlds

source, read, source_world = read_gltf(SOURCE/'athlete.gltf')
target, target_read, target_world = read_gltf(ROOT/'InputAssets'/'MannyReference'/'Manny.gltf')
profile = json.loads((PRIVATE/'profile.json').read_text(encoding='utf-8'))
target_names = {n.get('name'):i for i,n in enumerate(target['nodes'])}
source_names = {n.get('name'):i for i,n in enumerate(source['nodes'])}
target_skin = target['skins'][0]
target_joint_index = {node:i for i,node in enumerate(target_skin['joints'])}
name_map = {'Pelvis':'pelvis','Spine':'spine_02','Spine1':'spine_04','Spine2':'spine_05',
            'Neck':'neck_01','Head':'head'}
for side,suffix in [('L','l'),('R','r')]:
    for old,new in [('Clavicle','clavicle'),('UpperArm','upperarm'),('Forearm','lowerarm'),('Hand','hand'),
                    ('Thigh','thigh'),('Calf','calf'),('Foot','foot'),('Toe0','ball')]:
        name_map[side+'_'+old] = new+'_'+suffix
    for finger,new in [(0,'thumb'),(1,'index'),(2,'middle'),(3,'ring'),(4,'pinky')]:
        for joint in range(3):
            old = side+'_Finger'+str(finger)+('' if joint==0 else str(joint))
            name_map[old] = f'{new}_{joint+1:02d}_{suffix}'

def swing(a,b):
    a=a/np.linalg.norm(a);b=b/np.linalg.norm(b)
    v=np.cross(a,b);c=np.dot(a,b)
    skew=np.array([[0,-v[2],v[1]],[v[2],0,-v[0]],[-v[1],v[0],0]])
    return np.eye(3)+skew+skew@skew/(1+c) if c>-.9999 else np.diag([-1,-1,1])

# 只对解剖方向作最小旋转，不把两种骨架不同的局部坐标轴当成相同轴。
destinations=[]; transforms=[]
for node_id in source['skins'][0]['joints']:
    short=source['nodes'][node_id]['name'].removeprefix('Bip01_')
    mapped=name_map.get(short,'head')
    target_id=target_names[mapped]
    rotation=np.eye(3)
    children=source['nodes'][node_id].get('children',[])
    if short.endswith(('UpperArm','Forearm','Thigh','Calf')) or 'Finger' in short:
        child=next((c for c in children if source['nodes'][c].get('name','').removeprefix('Bip01_') in name_map),None)
        if child is not None:
            target_child=target_names[name_map[source['nodes'][child]['name'].removeprefix('Bip01_')]]
            rotation=swing(source_world[child][:3,3]-source_world[node_id][:3,3],
                           target_world[target_child][:3,3]-target_world[target_id][:3,3])
    # 面部辅助骨合并到 head 时必须共用头骨枢轴，不能把每个五官重定位到头骨中心。
    pivot_id=node_id if short in name_map else source_names['Bip01_Head']
    matrix=np.eye(4);matrix[:3,:3]=rotation
    matrix[:3,3]=target_world[target_id][:3,3]-matrix[:3,:3]@source_world[pivot_id][:3,3]
    transforms.append(matrix);destinations.append(target_joint_index[target_id])

primitive=source['meshes'][0]['primitives'][0]
attrs=primitive['attributes']
mesh_node=next(i for i,n in enumerate(source['nodes']) if 'mesh' in n)
def reshape(points):
    # 与原博物馆 appearanceRig 的本人参数保持一致；绑定坐标为厘米、Z 向上。
    x,y,z=points.T.copy();h=z/100;torso=(np.abs(x)<29).astype(float)
    def bell(v,m,s):return np.exp(-((v-m)/s)**2)
    x*=1+torso*((profile['chest']-1)*bell(h,1.34,.15)+(profile['waist']-1)*bell(h,1.05,.12)+(profile['shoulders']-1)*bell(h,1.47,.10))
    body=(torso>0)&(h>.94)&(h<1.53)
    front=np.clip((-y-1)/5,0,1)
    y[body]*=(1+(profile['waist']-1)*bell(h,1.05,.12))[body]
    y[body]-=(front*(profile['chest']-1)*(25*bell(h,1.36,.075)*bell(np.abs(x),10.5,9)+
                  8*(bell(h,1.23,.035)+bell(h,1.155,.035)+bell(h,1.09,.035))*bell(np.abs(x),4,4)))[body]
    arm=(np.abs(x)>24)&(np.abs(x)<56)&(h>1.28)&(h<1.58)
    growth=1+(profile['arms']-1)*bell(h,1.445,.10)
    y[arm]=-3+(y[arm]+3)*growth[arm];z[arm]=144.5+(z[arm]-144.5)*growth[arm]
    head=(h>1.56)&(np.abs(x)<13)
    x[head]*=(1+(profile['jaw']-1)*(bell(h,1.63,.08)+.6*bell(h,1.69,.055)))[head]
    nose=head&(y<-10)&(np.abs(x)<3.6)
    y[nose]=-10+(y[nose]+10)*(1+(profile['nose']-1)*bell(h[nose],1.688,.032))
    eye=head&(y<-6)&(np.abs(x)>2)&(np.abs(x)<6.3)
    z[eye]+=(profile['eyeHeight']-1)*(z[eye]-169.2)*bell(h[eye],1.692,.015)
    hair=head&(z>173.8);z[hair]=173.8+(z[hair]-173.8)*profile['hairCrop']
    return np.c_[x,y,z]
raw=read(attrs['POSITION']).astype(float);shaped=reshape(raw)
# 保留 UV 拆分处的平滑法线，通过形变雅可比转换。
jacobian=np.stack([(reshape(raw+np.eye(3)[i]*.025)-shaped)/.025 for i in range(3)],axis=2)
raw_normals=np.einsum('ni,nij->nj',read(attrs['NORMAL']),np.linalg.inv(jacobian))
positions=(np.c_[shaped,np.ones(len(shaped))]@source_world[mesh_node].T)[:,:3]
normals=raw_normals@np.linalg.inv(source_world[mesh_node][:3,:3])
normals/=np.linalg.norm(normals,axis=1)[:,None]
weights=read(attrs['WEIGHTS_0']);joints=read(attrs['JOINTS_0'])
converted=np.zeros_like(positions);converted_normal=np.zeros_like(normals)
target_joints=np.zeros_like(joints,dtype=np.uint16)
for slot in range(4):
    for old in np.unique(joints[:,slot]):
        mask=joints[:,slot]==old;matrix=transforms[int(old)];w=weights[mask,slot:slot+1]
        converted[mask]+=(positions[mask]@matrix[:3,:3].T+matrix[:3,3])*w
        converted_normal[mask]+=(normals[mask]@np.linalg.inv(matrix[:3,:3]))*w
        target_joints[mask,slot]=destinations[int(old)]
converted_normal/=np.linalg.norm(converted_normal,axis=1)[:,None]
# 原骨架没有 Manny 的前臂/上臂扭转骨。只改肘部极点不能解决抬臂时的糖纸式折叠；
# 在已对齐的参考姿态上，从原生网格邻近表面转移八权重，保留本人的几何、UV 与脸部权重。
reference_positions=[];reference_weights=[]
for primitive in target['meshes'][0]['primitives']:
    a=primitive['attributes'];p=target_read(a['POSITION'])
    dense=np.zeros((len(p),len(target_skin['joints'])))
    for channel in [0,1]:
        j=target_read(a[f'JOINTS_{channel}']).astype(int);w=target_read(a[f'WEIGHTS_{channel}'])
        for slot in range(4):np.add.at(dense,(np.arange(len(p)),j[:,slot]),w[:,slot])
    reference_positions.append(p);reference_weights.append(dense)
reference_positions=np.concatenate(reference_positions);reference_weights=np.concatenate(reference_weights)
distance,near=cKDTree(reference_positions).query(converted,k=4)
blend=1/np.maximum(distance,.004)**2;blend/=blend.sum(axis=1,keepdims=True)
native_weights=np.sum(reference_weights[near]*blend[:,:,None],axis=1)
original_weights=np.zeros_like(native_weights)
for slot in range(4):np.add.at(original_weights,(np.arange(len(converted)),target_joints[:,slot]),weights[:,slot])
arm_ids=[i for i,n in enumerate(source['skins'][0]['joints']) if any(s in source['nodes'][n]['name'] for s in
         ['UpperArm','Forearm','Hand','Finger','Clavicle'])]
arm_weight=np.sum(np.where(np.isin(joints,arm_ids),weights,0),axis=1)
arm_blend=np.clip((arm_weight-.05)/.6,0,1)
combined=original_weights*(1-arm_blend[:,None])+native_weights*arm_blend[:,None]
new_joints=np.argsort(combined,axis=1)[:,-8:][:,::-1].astype(np.uint16)
new_weights=np.take_along_axis(combined,new_joints,axis=1);new_weights/=new_weights.sum(axis=1,keepdims=True)
assert np.isfinite(new_weights).all() and np.allclose(new_weights.sum(axis=1),1)
assert np.percentile(distance[arm_blend>.5,0],95)<.07, 'Native arm surface fit exceeds 7cm'
assert np.isfinite(converted).all() and 1.6 < np.ptp(converted[:,1]) < 2.1
assert np.max(np.abs(converted[:,0]))<1.1
doc={'asset':{'version':'2.0','generator':'MemorySports local anatomical skin transfer'},
     'scene':0,'scenes':[{'nodes':[0]}],'nodes':copy.deepcopy(target['nodes']),
     'skins':copy.deepcopy(target['skins']),'meshes':[], 'bufferViews':[],'accessors':[],
     'materials':copy.deepcopy(source['materials']), 'textures':copy.deepcopy(source['textures']),
     'samplers':copy.deepcopy(source.get('samplers',[])), 'images':copy.deepcopy(source['images'])}
blob=bytearray()
def add(array,kind,component=5126):
    array=np.ascontiguousarray(array,dtype={5126:'<f4',5123:'<u2',5125:'<u4'}[component])
    while len(blob)%4:blob.append(0)
    offset=len(blob);blob.extend(array.tobytes());view=len(doc['bufferViews'])
    doc['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':array.nbytes})
    a={'bufferView':view,'componentType':component,'count':len(array),'type':kind}
    if kind=='VEC3':a.update(min=array.min(axis=0).tolist(),max=array.max(axis=0).tolist())
    doc['accessors'].append(a);return len(doc['accessors'])-1
doc['skins'][0]['inverseBindMatrices']=add(target_read(target_skin['inverseBindMatrices']),'MAT4')
new_attrs={'POSITION':add(converted,'VEC3'),'NORMAL':add(converted_normal,'VEC3'),
           'TEXCOORD_0':add(read(attrs['TEXCOORD_0']),'VEC2'),
           'JOINTS_0':add(new_joints[:,:4],'VEC4',5123),'WEIGHTS_0':add(new_weights[:,:4],'VEC4'),
           'JOINTS_1':add(new_joints[:,4:],'VEC4',5123),'WEIGHTS_1':add(new_weights[:,4:],'VEC4')}
primitives=[]
for p in source['meshes'][0]['primitives']:
    primitives.append({'attributes':new_attrs,'indices':add(read(p['indices']),'SCALAR',5125),'material':p['material']})
doc['meshes']=[{'name':'PersonalAthlete','primitives':primitives}]
for img in doc['images']:
    filename=Path(img['uri']).name
    shutil.copy2(PRIVATE/filename if filename=='head-color.png' else SOURCE/filename,OUT/filename)
    img['uri']=filename
doc['buffers']=[{'uri':'PersonalAthlete.bin','byteLength':len(blob)}]
(OUT/'PersonalAthlete.bin').write_bytes(blob)
(OUT/'PersonalAthlete.gltf').write_text(json.dumps(doc),encoding='utf-8')
shutil.copy2(PRIVATE/'profile.json',OUT/'profile.json')
report={'sourceGeometry':'Microsoft Rocketbox Sports_Male_04; MIT; see Docs/ROCKETBOX-LICENSE.md',
        'appearance':'Existing local avatar/head-color.png and profile.json; local use only',
        'sourceFaceSHA256':hashlib.sha256((PRIVATE/'head-color.png').read_bytes()).hexdigest(),
        'sourceMeshSHA256':hashlib.sha256((SOURCE/'athlete.gltf').read_bytes()).hexdigest(),
        'vertices':len(converted),
        'targetBones':len(target_skin['joints']),'heightMeters':float(np.ptp(converted[:,1])),
        'sourceModified':False,'externalUpload':False,'method':'Anatomical rest pose plus native eight-weight twist skin transfer',
        'armSkinTransferVertices':int(np.sum(arm_blend>0)),
        'armNearestSurfaceP95Cm':float(np.percentile(distance[arm_blend>.5,0],95)*100)}
# indices 已改写为新缓冲，三角形数量应从原始网格统计。
report['triangles']=sum(len(read(p['indices']))//3 for p in source['meshes'][0]['primitives'])
(ROOT/'Reports'/'Private'/'avatar-provenance.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if 'SHA' not in k}))
