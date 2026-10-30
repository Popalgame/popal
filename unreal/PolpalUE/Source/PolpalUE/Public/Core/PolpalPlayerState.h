#pragma once
#include "CoreMinimal.h"
#include "GameFramework/PlayerState.h"
#include "PolpalPlayerState.generated.h"
class UPartyComponent;
UCLASS()
class POLPALUE_API APolpalPlayerState : public APlayerState {
    GENERATED_BODY()
public:
    APolpalPlayerState();
    FString GetSaveKey() const;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) TObjectPtr<UPartyComponent> Party;
};
