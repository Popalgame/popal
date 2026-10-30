#include "Animation/PalAimOffsetBlendSpace.h"

#if WITH_EDITOR
void UPalAimOffsetBlendSpace::ConfigurePrototypeAxes()
{
    BlendParameters[0].DisplayName = TEXT("AimYaw");
    BlendParameters[0].Min = -60.f;
    BlendParameters[0].Max = 60.f;
    BlendParameters[0].GridNum = 2;
    BlendParameters[1].DisplayName = TEXT("AimPitch");
    BlendParameters[1].Min = -45.f;
    BlendParameters[1].Max = 45.f;
    BlendParameters[1].GridNum = 2;
}

bool UPalAimOffsetBlendSpace::UseSingleFrame(int32 SampleIndex, uint32 FrameIndex)
{
    if (!SampleData.IsValidIndex(SampleIndex)) return false;
    SampleData[SampleIndex].bUseSingleFrameForBlending = true;
    SampleData[SampleIndex].FrameIndexToSample = FrameIndex;
    ValidateSampleData();
    return SampleData[SampleIndex].bIsValid != 0;
}
#endif
