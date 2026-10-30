using UnrealBuildTool;

public class PolpalUEFXEditor : ModuleRules
{
    public PolpalUEFXEditor(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
        PublicDependencyModuleNames.AddRange(new[] { "Core", "CoreUObject", "Engine", "PolpalUE" });
        PrivateDependencyModuleNames.AddRange(new[] {
            "UnrealEd", "AssetTools", "AssetRegistry", "EditorScriptingUtilities",
            "Niagara", "NiagaraCore", "NiagaraEditor", "MaterialEditor"
        });
    }
}
