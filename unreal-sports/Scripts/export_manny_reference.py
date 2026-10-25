"""导出引擎原生骨骼参考；不读取任何私人图片。"""
from pathlib import Path
import unreal as u

root = Path(u.Paths.project_dir())
out = root / 'InputAssets' / 'MannyReference'
out.mkdir(parents=True, exist_ok=True)
options = u.GLTFExportOptions()
options.set_editor_property('bake_material_inputs', u.GLTFMaterialBakeMode.DISABLED)
options.set_editor_property('export_animation_sequences', False)
task = u.AssetExportTask()
task.object = u.load_asset('/Game/Characters/Mannequins/Meshes/SKM_Manny_Simple')
task.filename = str(out / 'Manny.gltf')
task.exporter = u.GLTFSkeletalMeshExporter()
task.options = options
task.automated = True
task.prompt = False
task.replace_identical = True
assert u.Exporter.run_asset_export_task(task), 'Manny reference export failed'
print('SPORTS_MANNY_REFERENCE_EXPORTED')
