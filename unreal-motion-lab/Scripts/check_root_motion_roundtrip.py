"""Import the project's neutral licensed athlete and verify an editor-to-glTF animation export.

All generated assets stay in this separate local lab. Nothing is copied into the
web project or uploaded, and the user's photo/avatar manifest is never read.
"""
import json
import os
import re
from datetime import datetime
import traceback
from pathlib import Path
import unreal

root = Path(__file__).resolve().parent.parent
label = os.environ.get("PALACE_ROOT_MOTION_LABEL", datetime.now().strftime("%Y%m%d_%H%M%S"))
if not re.fullmatch(r"[A-Za-z0-9_]+", label):
    raise RuntimeError("Use a plain alphanumeric label")
report_path = root / "Reports" / ("root-motion-roundtrip-" + label + ".json")
if report_path.exists():
    raise RuntimeError("Retain the previous report; choose a new label")
source = Path(os.environ.get("PALACE_ROOT_MOTION_SOURCE", str(root / "RootMotionSource"))) / "athlete.gltf"
destination = "/Game/MemoryPalace/RootMotionAthlete_" + label
report = {"engineVersion": unreal.SystemLibrary.get_engine_version(), "source": str(source),
          "privateMediaRead": False, "webProjectModified": False, "assets": [], "exports": [], "passed": False}
try:
    if unreal.EditorAssetLibrary.does_directory_exist(destination):
        raise RuntimeError("Retain the existing asset namespace; choose a new label")
    tools = unreal.AssetToolsHelpers.get_asset_tools()
    if not unreal.EditorAssetLibrary.does_directory_exist(destination):
        task = unreal.AssetImportTask()
        task.set_editor_property("filename", str(source))
        task.set_editor_property("destination_path", destination)
        task.set_editor_property("automated", True)
        task.set_editor_property("save", True)
        task.set_editor_property("replace_existing", False)
        tools.import_asset_tasks([task])
        report["importedPaths"] = list(task.get_editor_property("imported_object_paths"))
    objects = [unreal.load_asset(path) for path in unreal.EditorAssetLibrary.list_assets(destination, True, False)]
    objects = [obj for obj in objects if obj is not None]
    report["assets"] = [{"path": obj.get_path_name(), "class": obj.get_class().get_name()} for obj in objects]
    meshes = [obj for obj in objects if isinstance(obj, unreal.SkeletalMesh)]
    sequences = [obj for obj in objects if isinstance(obj, unreal.AnimSequence)]
    if not meshes or not sequences:
        raise RuntimeError("Round-trip requires an imported skeletal mesh and animation sequence")
    output = root / ("ExportsRootMotion-" + label)
    if output.exists():
        raise RuntimeError("Retain the existing export directory; choose a new label")
    output.mkdir(exist_ok=True)
    options = unreal.GLTFExportOptions()
    options.set_editor_property("export_animation_sequences", True)
    options.set_editor_property("export_vertex_skin_weights", True)
    options.set_editor_property("export_preview_mesh", True)
    options.set_editor_property("bake_material_inputs", unreal.GLTFMaterialBakeMode.DISABLED)
    options.set_editor_property("use_importer_material_mapping", True)
    for sequence in sequences:
        if hasattr(sequence, "set_preview_mesh"):
            sequence.set_preview_mesh(meshes[0])
        target = output / (sequence.get_name() + ".glb")
        result = unreal.GLTFExporter.export_to_gltf(sequence, str(target), options, set())
        ok = result[0] if isinstance(result, tuple) else result
        report["exports"].append({"animation": sequence.get_name(), "path": str(target),
                                  "bytes": target.stat().st_size if target.exists() else 0,
                                  "succeeded": bool(ok), "messages": str(result)})
    report["passed"] = len(report["exports"]) >= 3 and all(row["succeeded"] and row["bytes"] > 0 for row in report["exports"])
except Exception:
    report["failure"] = traceback.format_exc()
finally:
    (root / "Reports").mkdir(exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    unreal.log("MEMORY_PALACE_ROUNDTRIP " + json.dumps(report))
if not report["passed"]:
    raise RuntimeError(report.get("failure", "Animation round-trip did not pass"))
