"""只重导湖水法线和配置湖水材质，不重建地图、碰撞或人物资产。"""
from pathlib import Path
import sys,json
import unreal as u
root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(Path(__file__).resolve().parent))
from water_material import configure_water

task=u.AssetImportTask()
task.filename=str(root/'InputAssets/WaterNormal.png')
task.destination_path='/Game/MemorySports/Textures'
task.automated=True;task.replace_existing=True;task.save=True
u.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
texture=u.load_asset('/Game/MemorySports/Textures/WaterNormal')
assert isinstance(texture,u.Texture2D)
texture.set_editor_property('compression_settings',u.TextureCompressionSettings.TC_NORMALMAP)
texture.set_editor_property('srgb',False)
texture.set_editor_property('flip_green_channel',False)
texture.set_editor_property('max_texture_size',512)
u.EditorAssetLibrary.save_loaded_asset(texture)
mat=u.load_asset('/Game/MemorySports/Materials/M_Water')
assert isinstance(mat,u.Material)
configure_water(mat,texture)
report={'edited':['/Game/MemorySports/Textures/WaterNormal','/Game/MemorySports/Materials/M_Water'],
        'mapChanged':False,'collisionChanged':False,'characterChanged':False,'normalLayers':2,
        'roughness':.24,'metallic':0,'shoreDepthFadeCm':400}
(root/'Reports/water-refinement.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print('SPORTS_WATER_REFINED '+json.dumps(report))
