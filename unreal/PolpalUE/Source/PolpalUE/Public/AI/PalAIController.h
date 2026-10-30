#pragma once
#include "CoreMinimal.h"
#include "AIController.h"
#include "Data/PalData.h"
#include "PalAIController.generated.h"
class ABaseCampManager;
class ABaseServiceStation;
class UBehaviorTree;
class UBlackboardData;
class APalCharacter;
class UEnvQuery;
struct FEnvQueryResult;
UCLASS()
class POLPALUE_API APalAIController : public AAIController {
    GENERATED_BODY()
public:
    APalAIController();
    UPROPERTY(EditInstanceOnly, BlueprintReadOnly) TObjectPtr<ABaseCampManager> Camp;
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly) TObjectPtr<UBehaviorTree> BehaviorTree;
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly) TObjectPtr<UBlackboardData> BlackboardAsset;
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly) TSoftObjectPtr<UEnvQuery> ShootingPositionQuery;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) bool bIsNight = false;
    UFUNCTION(BlueprintPure) ABaseServiceStation* GetServiceActor() const { return CurrentService.Get(); }
    UFUNCTION(BlueprintPure) bool HasWorkTask() const { return CurrentTask.Id != 0; }
    UFUNCTION(BlueprintPure) FVector GetWorkLocation() const { return CurrentTask.Location; }
    UFUNCTION(BlueprintCallable) void RunDecision();
    void SetCampAbstractMode(bool bAbstract);
protected:
    virtual void OnPossess(APawn* InPawn) override;
    virtual void OnUnPossess() override;
private:
    FTimerHandle DecisionTimer;
    FWorkTask CurrentTask;
    TWeakObjectPtr<ABaseServiceStation> CurrentService;
    double LastDecisionTime = 0;
    bool bUsingBehaviorTree = false;
    bool bCampAbstract = false;
    double LastFoodTime = -1000;
    double NextServiceAttempt = 0;
    double NextWanderTime = 0;
    double NextDecisionTime = 0;
    double LastMoveTime = -1000;
    FVector LastMoveGoal = FVector::ZeroVector;
    TWeakObjectPtr<AActor> LastMoveActor;
    int32 ActiveShootingQueryId = INDEX_NONE;
    TWeakObjectPtr<AActor> ShootingQueryEnemy;
    double ShootingQueryStartedAt = 0;
    double NextShootingQueryTime = 0;
    double ShootingPositionExpiresAt = 0;
    FVector ShootingPosition = FVector::ZeroVector;
    void UpdateShootingQuery(AActor* Enemy, double Now);
    void OnShootingQueryFinished(TSharedPtr<FEnvQueryResult> Result);
    void RequestMoveLocation(const FVector& Goal, float AcceptanceRadius, double Now);
    void RequestMoveActor(AActor* Goal, float AcceptanceRadius, double Now);
    void EvaluateFallback();
    void ReleaseService();
    void Wander(APalCharacter* Pal, double Now);
};
