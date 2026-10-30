#pragma once
#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Engine/DataAsset.h"
#include "Engine/NetSerialization.h"
#include "Data/PalData.h"
#include "PalEffectsComponent.generated.h"

class UNiagaraSystem;
class UNiagaraComponent;

UENUM(BlueprintType)
enum class EPalEffectKind : uint8 {
    FireBurst, WaterSplash, ElectricArc, HammerSparks, BuildSmoke,
    FatigueSweat, CapturePulse, Hit
};

USTRUCT(BlueprintType)
struct FPalEffectDefinition {
    GENERATED_BODY()
    UPROPERTY(EditAnywhere, BlueprintReadOnly) TObjectPtr<UNiagaraSystem> System;
    UPROPERTY(EditAnywhere, BlueprintReadOnly, meta=(ClampMin="0.05", ClampMax="10")) float Duration = .65f;
    UPROPERTY(EditAnywhere, BlueprintReadOnly, meta=(ClampMin="0.01", ClampMax="20")) float Scale = 1.f;
};

UCLASS(BlueprintType)
class POLPALUE_API UPalFXLibrary : public UDataAsset {
    GENERATED_BODY()
public:
    UPROPERTY(EditAnywhere, BlueprintReadOnly) TMap<EPalEffectKind, FPalEffectDefinition> Effects;
};

UCLASS(ClassGroup=(Polpal), meta=(BlueprintSpawnableComponent))
class POLPALUE_API UPalEffectsComponent : public UActorComponent {
    GENERATED_BODY()
public:
    UPalEffectsComponent();
    // Animation notifies run locally on each renderer; do not multicast these.
    UFUNCTION(BlueprintCallable, Category="Polpal|FX") void PlayWorkEffect(EPalWorkType Work);
    UFUNCTION(BlueprintCallable, BlueprintAuthorityOnly, Category="Polpal|FX") void BroadcastElementEffect(EPalElement Element, FVector Location);
    UFUNCTION(BlueprintCallable, BlueprintAuthorityOnly, Category="Polpal|FX") void BroadcastCaptureEffect(FVector Location);
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Polpal|FX") TSoftObjectPtr<UPalFXLibrary> LibraryAsset;
protected:
    virtual void BeginPlay() override;
    virtual void EndPlay(const EEndPlayReason::Type Reason) override;
    UFUNCTION(NetMulticast, Unreliable) void MulticastPlay(EPalEffectKind Kind, FVector_NetQuantize Location);
private:
    UPROPERTY(Transient) TObjectPtr<UPalFXLibrary> Library;
    TArray<TWeakObjectPtr<UNiagaraComponent>> ActiveEffects;
    TMap<EPalEffectKind, double> LastPlayed;
    void PlayLocal(EPalEffectKind Kind, const FVector& Location);
};
