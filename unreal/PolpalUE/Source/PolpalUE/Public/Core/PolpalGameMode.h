#pragma once
#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "PolpalGameMode.generated.h"
UCLASS()
class POLPALUE_API APolpalGameMode : public AGameModeBase {
    GENERATED_BODY()
public:
    APolpalGameMode();
    UFUNCTION(BlueprintCallable) bool SaveWorldToSlot(const FString& SlotName);
    UFUNCTION(BlueprintCallable) bool LoadWorldFromSlot(const FString& SlotName);
};
