#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Data/PalData.h"
#include "BaseServiceStation.generated.h"
class ABaseCampManager;
class UBoxComponent;
class UNavModifierComponent;
UCLASS()
class POLPALUE_API ABaseServiceStation : public AActor {
    GENERATED_BODY()
public:
    ABaseServiceStation();
    UPROPERTY(EditInstanceOnly, BlueprintReadOnly) TObjectPtr<ABaseCampManager> Camp;
    UPROPERTY(EditAnywhere, BlueprintReadOnly) EBaseServiceType ServiceType = EBaseServiceType::Feed;
    UPROPERTY(EditAnywhere, BlueprintReadOnly, meta=(ClampMin="1")) int32 Capacity = 2;
    UPROPERTY(Replicated, EditAnywhere, BlueprintReadOnly, meta=(ClampMin="0")) int32 FoodInventory = 0;
    UPROPERTY(EditAnywhere, BlueprintReadOnly) FVector ServicePointOffset = FVector(260.f, 0.f, 0.f);
    UFUNCTION(BlueprintPure) FVector GetServiceLocation() const { return GetActorTransform().TransformPosition(ServicePointOffset); }
    bool CanReserve() const;
    bool Reserve(FGuid PalId);
    void Release(FGuid PalId);
    void ClearReservations();
    bool ConsumeFood(FGuid PalId);
    bool LoadFoodInventory(int32 Food);
    bool HasReservation(FGuid PalId) const { return Reservations.Contains(PalId); }
    int32 GetStationId() const { return StationId; }
    void SetStationId(int32 Id) { StationId = Id; }
protected:
    UPROPERTY(VisibleAnywhere) TObjectPtr<UBoxComponent> Collision;
    UPROPERTY(VisibleAnywhere) TObjectPtr<UNavModifierComponent> NavModifier;
    virtual void BeginPlay() override;
    virtual void EndPlay(const EEndPlayReason::Type Reason) override;
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
private:
    TSet<FGuid> Reservations;
    int32 StationId = 0;
};
