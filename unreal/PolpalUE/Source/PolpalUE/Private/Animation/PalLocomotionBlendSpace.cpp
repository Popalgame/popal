#include "Animation/PalLocomotionBlendSpace.h"

#if WITH_EDITOR
void UPalLocomotionBlendSpace::ConfigurePrototypeAxis()
{
    BlendParameters[0].DisplayName = TEXT("BlendSpeed");
    BlendParameters[0].Min = 0.f;
    BlendParameters[0].Max = 100.f;
    BlendParameters[0].GridNum = 10;
}
#endif
