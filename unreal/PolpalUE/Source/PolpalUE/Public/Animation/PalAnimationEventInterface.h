#pragma once

#include "CoreMinimal.h"
#include "UObject/Interface.h"
#include "PalAnimationEventInterface.generated.h"

UINTERFACE(BlueprintType)
class POLPALUE_API UPalAnimationEventInterface : public UInterface
{
    GENERATED_BODY()
};

/** Implement on actors that consume animation events. Damage/projectiles stay server-owned. */
class POLPALUE_API IPalAnimationEventInterface
{
    GENERATED_BODY()
public:
    UFUNCTION(BlueprintNativeEvent, BlueprintCallable, Category="Pal|Animation") void OnPalSpawnProjectile();
    UFUNCTION(BlueprintNativeEvent, BlueprintCallable, Category="Pal|Animation") void OnPalPlayWorkVFX(FName Effect);
    UFUNCTION(BlueprintNativeEvent, BlueprintCallable, Category="Pal|Animation") void OnPalToggleHitbox(bool bEnabled);
};
