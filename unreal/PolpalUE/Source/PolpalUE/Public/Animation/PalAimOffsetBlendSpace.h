#pragma once

#include "CoreMinimal.h"
#include "Animation/AimOffsetBlendSpace.h"
#include "PalAimOffsetBlendSpace.generated.h"

/** Aim Offset with explicit yaw/pitch axes and a selected pose frame per sample. */
UCLASS(BlueprintType)
class POLPALUE_API UPalAimOffsetBlendSpace : public UAimOffsetBlendSpace
{
    GENERATED_BODY()
public:
#if WITH_EDITOR
    void ConfigurePrototypeAxes();
    bool UseSingleFrame(int32 SampleIndex, uint32 FrameIndex);
#endif
};
