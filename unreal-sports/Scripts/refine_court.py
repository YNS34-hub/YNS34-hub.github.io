"""只重建训练馆和专用表面；湖岸地图、个人网格及骑行数据不改写。"""
from pathlib import Path
import sys, json
import unreal as u

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from court_materials import configure_court_materials

tools = u.AssetToolsHelpers.get_asset_tools()
for name in ['CourtWoodNormal', 'BallNormal']:
    task = u.AssetImportTask()
    task.filename = str(root / 'InputAssets' / (name + '.png'))
    task.destination_path = '/Game/MemorySports/Textures'
    task.automated = task.replace_existing = task.save = True
    tools.import_asset_tasks([task])
    texture = u.load_asset('/Game/MemorySports/Textures/' + name)
    texture.set_editor_property('compression_settings', u.TextureCompressionSettings.TC_NORMALMAP)
    texture.set_editor_property('srgb', False)
    texture.set_editor_property('flip_green_channel', False)
    texture.set_editor_property('max_texture_size', 1024)
    u.EditorAssetLibrary.save_loaded_asset(texture)
materials = configure_court_materials()
subsystem = u.get_editor_subsystem(u.LevelEditorSubsystem)
assert subsystem.load_level('/Game/MemorySports/Maps/TrainingHall')
actors = u.get_editor_subsystem(u.EditorActorSubsystem)
for actor in actors.get_all_level_actors():
    if isinstance(actor, u.SportsWorld):
        assert not actor.get_editor_property('cycling')
        actor.build_scene()
    if actor.get_actor_label() == 'Atmospheric sky dome':
        actor.get_component_by_class(u.StaticMeshComponent).set_material(
            0, u.load_asset('/Game/MemorySports/Materials/M_CourtSky'))
    if isinstance(actor, u.RectLight):
        light = actor.get_component_by_class(u.RectLightComponent)
        light.set_editor_property('intensity', 20500.)
        light.set_editor_property('use_temperature', True)
        light.set_editor_property('temperature', 5100.)
        point = actor.get_actor_location()
        # 一个柔和主光承担近景自阴影，其余补光保持原来的轻量预算。
        light.set_editor_property('cast_shadows', point.x == -1200 and point.y == -600)
    if isinstance(actor, u.PostProcessVolume):
        settings = actor.get_editor_property('settings')
        settings.set_editor_property('override_ambient_occlusion_intensity', True)
        settings.set_editor_property('ambient_occlusion_intensity', 1.)
        settings.set_editor_property('override_ambient_occlusion_radius', True)
        settings.set_editor_property('ambient_occlusion_radius', 65.)
        settings.set_editor_property('override_bloom_intensity', True)
        settings.set_editor_property('bloom_intensity', .16)
        actor.set_editor_property('settings', settings)
world = u.get_editor_subsystem(u.UnrealEditorSubsystem).get_editor_world()
assert u.EditorLoadingAndSavingUtils.save_map(world, '/Game/MemorySports/Maps/TrainingHall')
report = {'map': '/Game/MemorySports/Maps/TrainingHall', 'materials': materials,
          'woodBoardWidthCm': 6.5, 'indoorSkyRadiance': 40, 'shadowedKeyLights': 1,
          'privateMeshChanged': False, 'lakeMapChanged': False}
(root / 'Reports/v03-court-refinement.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
u.log('SPORTS_COURT_REFINED ' + json.dumps(report))
