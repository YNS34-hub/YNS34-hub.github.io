using UnrealBuildTool;
using System.Collections.Generic;

public class MemorySportsEditorTarget : TargetRules
{
    public MemorySportsEditorTarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Editor;
        DefaultBuildSettings = BuildSettingsVersion.Latest;
        IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
        ExtraModuleNames.Add("MemorySports");
    }
}
