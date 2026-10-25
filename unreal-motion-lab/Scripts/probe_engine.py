"""Read local editor capabilities without changing the web project or personal media."""
import json
from pathlib import Path
import unreal

root = Path(__file__).resolve().parent.parent
result = {
    "engineVersion": unreal.SystemLibrary.get_engine_version(),
    "nullRHI": True,
    "classes": {name: hasattr(unreal, name) for name in (
        "ControlRigBlueprint", "IKRigDefinition", "IKRigController", "IKRetargeter",
        "IKRetargeterController", "GLTFExporter", "GLTFExportOptions",
        "AssetImportTask", "InterchangeManager", "AnimSequence", "AnimSequenceExporterFBX",
    )},
    "sourceMediaRead": False,
    "webProjectModified": False,
}
result["passed"] = all(result["classes"][name] for name in (
    "ControlRigBlueprint", "IKRigController", "IKRetargeterController", "GLTFExporter", "AssetImportTask",
))
(root / "Reports").mkdir(exist_ok=True)
(root / "Reports" / "engine-capabilities.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
unreal.log("MEMORY_PALACE_ENGINE_PROBE " + json.dumps(result))
if not result["passed"]:
    raise RuntimeError("Required local animation tools are unavailable")
