#pragma once

#include "CoreMinimal.h"
#include "Animation/BlendSpace1D.h"
#include "PalLocomotionBlendSpace.generated.h"

/** Prototype locomotion axis matches UPalAnimInstance::BlendSpeed (0..100). */
UCLASS(BlueprintType)
class POLPALUE_API UPalLocomotionBlendSpace : public UBlendSpace1D
{
    GENERATED_BODY()
public:
#if WITH_EDITOR
    void ConfigurePrototypeAxis();
#endif
};
