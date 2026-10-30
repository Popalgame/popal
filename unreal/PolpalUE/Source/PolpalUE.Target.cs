using UnrealBuildTool;
using System.Collections.Generic;

public class PolpalUETarget : TargetRules
{
    public PolpalUETarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Game;
        DefaultBuildSettings = BuildSettingsVersion.V5;
        IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
        ExtraModuleNames.Add("PolpalUE");
    }
}
