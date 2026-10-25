"""只读检查地图内材质绑定、纹理资源与图节点，避免仅凭截图猜测。"""
import unreal as u
import json,os
root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
lib=u.MaterialEditingLibrary
report={'materials':{},'meshes':[]}
for name in ['Rock','Meadow','Sky','Asphalt']:
    mat=u.load_asset('/Game/MemorySports/Materials/M_'+name)
    info={'path':mat.get_path_name(),'nodes':[],'baseColor':str(lib.get_material_property_input_node(mat,u.MaterialProperty.MP_BASE_COLOR))}
    for node in lib.get_material_expressions(mat):
        item={'class':node.get_class().get_name(),'inputs':list(lib.get_material_expression_input_names(node))}
        if isinstance(node,u.MaterialExpressionTextureSample):
            texture=node.get_editor_property('texture')
            item['texture']=texture.get_path_name() if texture else None
        info['nodes'].append(item)
    report['materials'][name]=info
u.get_editor_subsystem(u.LevelEditorSubsystem).load_level('/Game/MemorySports/Maps/LakesideRide')
for actor in u.get_editor_subsystem(u.EditorActorSubsystem).get_all_level_actors():
    if isinstance(actor,u.SportsWorld):
        for component in actor.get_components_by_class(u.ProceduralMeshComponent):
            material=component.get_material(0)
            report['meshes'].append({'component':component.get_name(),'material':material.get_path_name() if material else None})
with open(os.path.join(root,'Reports/scene-material-inspection.json'),'w',encoding='utf-8') as target:json.dump(report,target,indent=2)
u.log('Scene material inspection ready')
