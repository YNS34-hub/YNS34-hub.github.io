using UnrealBuildTool;
using System.Collections.Generic;

public class MemorySportsTarget : TargetRules
{
    public MemorySportsTarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Game;
        DefaultBuildSettings = BuildSettingsVersion.Latest;
        IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
        ExtraModuleNames.Add("MemorySports");
    }
}
