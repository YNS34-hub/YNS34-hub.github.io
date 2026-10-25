"""只在本机导入私人角色，使用同名原生骨架和现有运动动画。"""
from pathlib import Path
import json
import unreal as u
root=Path(__file__).resolve().parents[1]
task=u.AssetImportTask()
task.filename=str(root/'InputAssets'/'PrivateAvatar'/'PersonalAthlete.gltf')
task.destination_path='/Game/PrivateAvatar'
task.automated=True;task.replace_existing=True;task.save=True
u.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
paths=u.EditorAssetLibrary.list_assets('/Game/PrivateAvatar',recursive=True)
mesh=next((u.load_asset(p) for p in paths if isinstance(u.load_asset(p),u.SkeletalMesh)),None)
assert mesh, 'Personal athlete skeletal mesh not imported'
skeleton=u.load_asset('/Game/Characters/Mannequins/Meshes/SK_Mannequin')
binding=u.SportsWorld.configure_personal_avatar()
print('SPORTS_AVATAR_BIND '+binding)
assert binding.startswith('OK:'),binding
lib=u.MaterialEditingLibrary
for path in paths:
    asset=u.load_asset(path)
    if isinstance(asset,u.Texture2D):
        is_normal='normal' in asset.get_name().lower()
        asset.set_editor_property('max_texture_size',2048 if 'head' in asset.get_name().lower() else 1024)
        if is_normal:
            asset.set_editor_property('srgb',False)
            asset.set_editor_property('compression_settings',u.TextureCompressionSettings.TC_NORMALMAP)
            asset.set_editor_property('flip_green_channel',True)
        u.EditorAssetLibrary.save_loaded_asset(asset)
    if isinstance(asset,u.Material):
        lib.set_material_usage(asset,u.MaterialUsage.MATUSAGE_SKELETAL_MESH)
        rough=lib.create_material_expression(asset,u.MaterialExpressionConstant)
        rough.set_editor_property('r',.72)
        lib.connect_material_property(rough,'',u.MaterialProperty.MP_ROUGHNESS)
        lib.recompile_material(asset);u.EditorAssetLibrary.save_loaded_asset(asset)
u.EditorAssetLibrary.save_loaded_asset(mesh)
report={'mesh':mesh.get_path_name(),'skeleton':skeleton.get_path_name(),
        'assetCount':len(paths),'localOnly':True,'binding':binding,
        'animationSource':'Unreal Manny locomotion plus original native sports poses'}
(root/'Reports'/'Private'/'avatar-import.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print('SPORTS_PERSONAL_AVATAR_IMPORTED '+mesh.get_path_name())
