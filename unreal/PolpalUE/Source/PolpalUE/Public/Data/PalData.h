#pragma once
#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
class UAnimInstance;
class USkeletalMesh;
class UAnimMontage;
class APawn;
#include "PalData.generated.h"

UENUM(BlueprintType)
enum class EPalElement : uint8 { Neutral, Fire, Water, Grass, Electric, Ice, Ground, Air, Dark, Dragon };
UENUM(BlueprintType)
enum class EPalWorkType : uint8 { Kindling, Watering, Planting, Mining, Handiwork, Gathering, Transporting };
UENUM(BlueprintType)
enum class EPalActivity : uint8 { Idle, Hungry, Resting, Fighting, MovingToWork, Working };
UENUM(BlueprintType)
enum class EBaseServiceType : uint8 { Feed, Bed, HotSpring };

USTRUCT(BlueprintType)
struct FPalStats {
    GENERATED_BODY()
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly) float MaxHealth = 100.f;
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly) float Attack = 10.f;
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly) float Defense = 10.f;
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly) float WorkSpeed = 1.f;
};

UCLASS(BlueprintType)
class POLPALUE_API UPalSpeciesData : public UPrimaryDataAsset {
    GENERATED_BODY()
public:
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly) FText PalName;
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly) EPalElement ElementType = EPalElement::Neutral;
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly) FPalStats BaseStats;
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly) TMap<EPalWorkType, int32> WorkSuitability;
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly) TObjectPtr<USkeletalMesh> SkeletalMesh;
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly) TObjectPtr<USkeletalMesh> OutlineMesh;
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, meta=(ClampMin="80", ClampMax="500")) float MeshHeightCm = 180.f;
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, meta=(ClampMin="15", ClampMax="150")) float CapsuleRadiusCm = 35.f;
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly) TObjectPtr<UAnimMontage> AttackMontage;
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly) TMap<EPalWorkType, TObjectPtr<UAnimMontage>> WorkMontages;
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly) TSubclassOf<UAnimInstance> AnimBlueprintClass;
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, meta=(ClampMin="0.01")) float RarityFactor = 1.f;
    int32 SuitabilityFor(EPalWorkType Type) const { return FMath::Clamp(WorkSuitability.FindRef(Type), 0, 4); }
};

UCLASS(BlueprintType)
class POLPALUE_API UPalInstanceData : public UObject {
    GENERATED_BODY()
public:
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) FGuid InstanceId;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) TObjectPtr<UPalSpeciesData> Species;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) int32 Level = 1;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) float Hunger = 100.f;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) float SAN = 100.f;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) float Health = 100.f;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) TArray<FName> LearnedSkills;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) TArray<FName> Passives;
    void Initialize(UPalSpeciesData* InSpecies, float InHealth);
};

USTRUCT(BlueprintType)
struct FPalPartySnapshot {
    GENERATED_BODY()
    UPROPERTY(BlueprintReadOnly) FGuid InstanceId;
    UPROPERTY(BlueprintReadOnly) TObjectPtr<UPalSpeciesData> Species;
    UPROPERTY(BlueprintReadOnly) int32 Level = 1;
    UPROPERTY(BlueprintReadOnly) float Health = 100.f;
    UPROPERTY(BlueprintReadOnly) float Hunger = 100.f;
    UPROPERTY(BlueprintReadOnly) float SAN = 100.f;
    UPROPERTY(BlueprintReadOnly) TArray<FName> LearnedSkills;
    UPROPERTY(BlueprintReadOnly) TArray<FName> Passives;
};

USTRUCT(BlueprintType)
struct FWorkTask {
    GENERATED_BODY()
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) int32 Id = 0;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) FVector Location = FVector::ZeroVector;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) EPalWorkType RequiredWorkType = EPalWorkType::Handiwork;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, meta=(ClampMin="1", ClampMax="4")) int32 RequiredLevel = 1;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) int32 Priority = 0;
    UPROPERTY(Transient) TWeakObjectPtr<APawn> AssignedPal;
};

USTRUCT(BlueprintType)
struct FPalRuntimeRecord {
    GENERATED_BODY()
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) FGuid InstanceId;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) TObjectPtr<UPalSpeciesData> Species;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) int32 Level = 1;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) float Health = 100.f;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) float Hunger = 100.f;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) float SAN = 100.f;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) TArray<FName> LearnedSkills;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) TArray<FName> Passives;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) FTransform Transform;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) int32 TaskId = 0;
    // Stable name of the original level actor, retained after runtime actor replacement.
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) FString SourceActorPath;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) bool bOwnedInstance = false;
};
