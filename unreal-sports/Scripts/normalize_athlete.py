"""将公开角色的统一父级缩放烘焙到网格、骨骼、绑定矩阵与动画，供原生 IK 使用。"""
from pathlib import Path
import json, struct, shutil, hashlib
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT.parent/'unreal-motion-lab'/'SourcePNG'
OUT=ROOT/'InputAssets'/'Athlete'
OUT.mkdir(exist_ok=True)
doc=json.loads((SOURCE/'athlete.gltf').read_text(encoding='utf-8'))
buffers=[bytearray((SOURCE/item['uri']).read_bytes()) for item in doc['buffers']]
scale=doc['nodes'][0]['scale'][0]
assert all(abs(value-scale)<1e-8 for value in doc['nodes'][0]['scale'])
positions={primitive['attributes']['POSITION'] for mesh in doc['meshes'] for primitive in mesh['primitives']}
translation_accessors=set()
for anim in doc['animations']:
    for channel in anim['channels']:
        if channel['target']['path']=='translation':
            assert channel['target']['node']!=0
            translation_accessors.add(anim['samplers'][channel['sampler']]['output'])
def scale_accessor(index, components, fields):
    accessor=doc['accessors'][index];view=doc['bufferViews'][accessor['bufferView']]
    assert accessor['componentType']==5126 and 'sparse' not in accessor
    buffer=buffers[view['buffer']]
    stride=view.get('byteStride',components*4)
    offset=view.get('byteOffset',0)+accessor.get('byteOffset',0)
    for i in range(accessor['count']):
        values=list(struct.unpack_from('<'+'f'*components,buffer,offset+i*stride))
        for j in fields:values[j]*=scale
        struct.pack_into('<'+'f'*components,buffer,offset+i*stride,*values)
    for bound in ['min','max']:
        if bound in accessor:
            for j in fields:accessor[bound][j]*=scale
for index in positions|translation_accessors:scale_accessor(index,3,range(3))
for skin in doc['skins']:scale_accessor(skin['inverseBindMatrices'],16,[12,13,14])
for index,node in enumerate(doc['nodes']):
    if index and 'translation' in node:node['translation']=[v*scale for v in node['translation']]
doc['nodes'][0]['scale']=[1,1,1]
# 将网格节点的轴向变换直接烘焙到顶点，再重算世界空间逆绑定矩阵。
# 这避免 Interchange 将带额外轴向旋转的皮肤网格与骨骼分别转换后出现平躺和拉伸。
doc['nodes'][0]['translation']=[0,0,0]
def local_matrix(node):
    if 'matrix' in node:return np.array(node['matrix']).reshape((4,4),order='F')
    x,y,z,w=node.get('rotation',[0,0,0,1])
    result=np.eye(4)
    result[:3,:3]=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])@np.diag(node.get('scale',[1,1,1]))
    result[:3,3]=node.get('translation',[0,0,0]);return result
worlds={}
def visit(index,parent):
    worlds[index]=parent@local_matrix(doc['nodes'][index])
    for child in doc['nodes'][index].get('children',[]):visit(child,worlds[index])
for node in doc['scenes'][doc.get('scene',0)]['nodes']:visit(node,np.eye(4))
def accessor_values(index,components):
    a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']];offset=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',components*4)
    return a,v,offset,stride,np.array([struct.unpack_from('<'+'f'*components,buffers[v['buffer']],offset+i*stride) for i in range(a['count'])])
def write_values(index,components,values):
    a,v,offset,stride,_=accessor_values(index,components)
    for i,value in enumerate(values):struct.pack_into('<'+'f'*components,buffers[v['buffer']],offset+i*stride,*value)
    if 'min' in a:a['min']=values.min(axis=0).tolist()
    if 'max' in a:a['max']=values.max(axis=0).tolist()
for index,node in enumerate(doc['nodes']):
    if 'mesh' not in node:continue
    matrix=worlds[index]
    for primitive in doc['meshes'][node['mesh']]['primitives']:
        pos_index=primitive['attributes']['POSITION'];positions_array=accessor_values(pos_index,3)[-1]
        positions_array=(np.c_[positions_array,np.ones(len(positions_array))]@matrix.T)[:,:3]
        write_values(pos_index,3,positions_array)
        if 'NORMAL' in primitive['attributes']:
            normal_index=primitive['attributes']['NORMAL'];normals=accessor_values(normal_index,3)[-1]@np.linalg.inv(matrix[:3,:3])
            normals/=np.linalg.norm(normals,axis=1)[:,None];write_values(normal_index,3,normals)
    for field in ['matrix','rotation','translation','scale']:node.pop(field,None)
for skin in doc['skins']:
    matrices=np.array([np.linalg.inv(worlds[joint]).flatten(order='F') for joint in skin['joints']])
    write_values(skin['inverseBindMatrices'],16,matrices)
for item,buffer in zip(doc['buffers'],buffers):
    item['uri']=Path(item['uri']).name;(OUT/item['uri']).write_bytes(buffer)
for image in doc['images']:
    shutil.copy2(SOURCE/image['uri'],OUT/Path(image['uri']).name);image['uri']=Path(image['uri']).name
(OUT/'athlete.gltf').write_text(json.dumps(doc),encoding='utf-8')
report={'uniformParentScaleBaked':scale,'canonicalSkinBinding':True,'meshPositionAccessors':len(positions),'animationTranslationAccessors':len(translation_accessors),'originalSHA256':hashlib.sha256((SOURCE/'athlete.gltf').read_bytes()).hexdigest(),'sourceModified':False,'privateMediaRead':False}
(ROOT/'Reports'/'athlete-normalization.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report))
