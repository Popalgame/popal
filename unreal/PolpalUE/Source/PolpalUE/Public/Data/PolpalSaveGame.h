#pragma once
#include "CoreMinimal.h"
#include "GameFramework/SaveGame.h"
#include "Data/PalData.h"
#include "PolpalSaveGame.generated.h"

USTRUCT(BlueprintType)
struct FPalSaveRecord {
    GENERATED_BODY()
    UPROPERTY(SaveGame) FGuid InstanceId;
    UPROPERTY(SaveGame) TSoftObjectPtr<UPalSpeciesData> Species;
    UPROPERTY(SaveGame) int32 Level = 1;
    UPROPERTY(SaveGame) float Health = 100.f;
    UPROPERTY(SaveGame) float Hunger = 100.f;
    UPROPERTY(SaveGame) float SAN = 100.f;
    UPROPERTY(SaveGame) TArray<FName> LearnedSkills;
    UPROPERTY(SaveGame) TArray<FName> Passives;
    UPROPERTY(SaveGame) FTransform Transform;
    UPROPERTY(SaveGame) FString SourceActorPath;
    UPROPERTY(SaveGame) FString WorkStationPath;
    UPROPERTY(SaveGame) bool bOwnedInstance = false;
};
USTRUCT(BlueprintType)
struct FPartySaveRecord {
    GENERATED_BODY()
    UPROPERTY(SaveGame) FString PlayerKey;
    UPROPERTY(SaveGame) TArray<FPalSaveRecord> Pals;
};
USTRUCT(BlueprintType)
struct FBuildingSaveRecord {
    GENERATED_BODY()
    UPROPERTY(SaveGame) FString ActorPath;
    UPROPERTY(SaveGame) double WorkProgress = 0;
    UPROPERTY(SaveGame) int64 ProducedResources = 0;
    UPROPERTY(SaveGame) int32 FoodInventory = 0;
};
USTRUCT(BlueprintType)
struct FCampSaveRecord {
    GENERATED_BODY()
    UPROPERTY(SaveGame) FString ActorPath;
    UPROPERTY(SaveGame) TArray<FPalSaveRecord> Workers;
    UPROPERTY(SaveGame) TArray<FBuildingSaveRecord> Buildings;
};
UCLASS()
class POLPALUE_API UPolpalSaveGame : public USaveGame {
    GENERATED_BODY()
public:
    UPROPERTY(SaveGame) int32 FormatVersion = 2;
    UPROPERTY(SaveGame) TArray<FPartySaveRecord> Parties;
    UPROPERTY(SaveGame) TArray<FCampSaveRecord> Camps;
};
