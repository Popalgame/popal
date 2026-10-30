using UnrealBuildTool;

public class PolpalUEEditor : ModuleRules
{
    public PolpalUEEditor(ReadOnlyTargetRules Target) : base(Target)
    {
        CppStandard = CppStandardVersion.Cpp20;
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
        PrivateDependencyModuleNames.AddRange(new[] {
            "Core", "CoreUObject", "Engine", "PolpalUE", "UnrealEd", "AssetTools",
            "EditorScriptingUtilities", "AnimationBlueprintLibrary", "AIModule",
            "NavigationSystem", "BehaviorTreeEditor", "AnimGraph", "AnimGraphRuntime",
            "BlueprintGraph", "KismetCompiler", "Json", "JsonUtilities", "AssetRegistry",
            "Landscape", "LandscapeEditor"
        });
    }
}
