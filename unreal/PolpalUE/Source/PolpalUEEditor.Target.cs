using UnrealBuildTool;
using System.Collections.Generic;

public class PolpalUEEditorTarget : TargetRules
{
    public PolpalUEEditorTarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Editor;
        DefaultBuildSettings = BuildSettingsVersion.V5;
        IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
        ExtraModuleNames.Add("PolpalUE");
        ExtraModuleNames.Add("PolpalUEEditor");
        ExtraModuleNames.Add("PolpalUEFXEditor");
    }
}
