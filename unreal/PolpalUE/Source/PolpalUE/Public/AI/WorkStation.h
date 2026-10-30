#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Data/PalData.h"
#include "WorkStation.generated.h"
class UBoxComponent;
class UNavModifierComponent;
class ABaseCampManager;
UCLASS()
class POLPALUE_API AWorkStation : public AActor {
    GENERATED_BODY()
public:
    AWorkStation();
    UPROPERTY(EditInstanceOnly, BlueprintReadOnly) TObjectPtr<ABaseCampManager> Camp;
    UPROPERTY(EditAnywhere, BlueprintReadOnly) EPalWorkType WorkType = EPalWorkType::Handiwork;
    UPROPERTY(EditAnywhere, BlueprintReadOnly, meta=(ClampMin="1", ClampMax="4")) int32 RequiredLevel = 1;
    UPROPERTY(EditAnywhere, BlueprintReadOnly) int32 Priority = 0;
    UPROPERTY(EditAnywhere, BlueprintReadOnly) FVector WorkPointOffset = FVector(300.f, 0.f, 0.f);
    UFUNCTION(BlueprintPure) FVector GetWorkLocation() const { return GetActorTransform().TransformPosition(WorkPointOffset); }
    UPROPERTY(EditAnywhere, BlueprintReadOnly, meta=(ClampMin="0.01")) float Efficiency = 1.f;
    UPROPERTY(Replicated, VisibleAnywhere, BlueprintReadOnly) float WorkProgress = 0.f;
    UPROPERTY(Replicated, VisibleAnywhere, BlueprintReadOnly) int64 ProducedResources = 0;
    void AddWork(double Rate, double Seconds);
    bool LoadProductionState(double Progress, int64 Resources);
    int32 GetTaskId() const { return TaskId; }
    void SetTaskId(int32 Id) { TaskId = Id; }
protected:
    UPROPERTY(VisibleAnywhere) TObjectPtr<UBoxComponent> Collision;
    UPROPERTY(VisibleAnywhere) TObjectPtr<UNavModifierComponent> NavModifier;
    virtual void BeginPlay() override;
    virtual void EndPlay(const EEndPlayReason::Type Reason) override;
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
private:
    int32 TaskId = 0;
};
