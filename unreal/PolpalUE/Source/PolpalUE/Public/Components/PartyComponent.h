#pragma once
#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Data/PalData.h"
#include "Data/PolpalSaveGame.h"
#include "PartyComponent.generated.h"
class APalCharacter;

UCLASS(ClassGroup=(Polpal), meta=(BlueprintSpawnableComponent))
class POLPALUE_API UPartyComponent : public UActorComponent {
    GENERATED_BODY()
public:
    UPartyComponent();
    UFUNCTION(BlueprintPure) int32 GetPartyCount() const { return PartySnapshot.Num(); }
    UFUNCTION(BlueprintPure) TArray<FPalPartySnapshot> GetPartySnapshot() const { return PartySnapshot; }
    UPalInstanceData* GetInstance(FGuid Id) const;
    bool AddCapturedPal(UPalSpeciesData* Species, float Health);
    bool AddCapturedPal(APalCharacter* Target);
    bool RemovePal(FGuid Id);
    bool Summon(FGuid Id, const FVector& Location);
    bool Recall();
    TArray<FPalSaveRecord> ExportSaveRecords() const;
    bool ImportSaveRecords(const TArray<FPalSaveRecord>& Records);
protected:
    UPROPERTY(Replicated) TArray<FPalPartySnapshot> PartySnapshot;
    UPROPERTY(Transient) TArray<TObjectPtr<UPalInstanceData>> Party;
    UPROPERTY(Transient) TObjectPtr<APalCharacter> SummonedPal;
    UPROPERTY(Transient) FGuid SummonedId;
    UFUNCTION() void OnSummonedDestroyed(AActor* DestroyedActor);
    virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
private:
    void RefreshSnapshot();
    FPalRuntimeRecord ReadSummonedRecord() const;
    void PersistSummonedRecord();
};
