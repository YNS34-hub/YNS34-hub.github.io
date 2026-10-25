using UnrealBuildTool;

public class MemorySports : ModuleRules
{
    public MemorySports(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
        PublicDependencyModuleNames.AddRange(new string[] {
            "Core", "CoreUObject", "Engine", "InputCore", "ProceduralMeshComponent",
            "AnimGraphRuntime", "PhysicsCore", "Json", "JsonUtilities"
        });
        PrivateDependencyModuleNames.AddRange(new string[] { "RHI", "SlateCore" });
    }
}
