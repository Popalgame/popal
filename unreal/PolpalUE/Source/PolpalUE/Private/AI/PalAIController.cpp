#include "AI/PalAIController.h"
#include "AI/BaseCampManager.h"
#include "AI/BaseServiceStation.h"
#include "Characters/PalCharacter.h"
#include "Core/PalRules.h"
#include "BehaviorTree/BehaviorTree.h"
#include "BehaviorTree/BlackboardData.h"
#include "BrainComponent.h"
#include "EnvironmentQuery/EnvQuery.h"
#include "EnvironmentQuery/EnvQueryManager.h"
#include "EnvironmentQuery/EnvQueryTypes.h"
#include "Engine/World.h"
#include "NavigationSystem.h"
#include "TimerManager.h"
APalAIController::APalAIController() {
    PrimaryActorTick.bCanEverTick = false;
    ShootingPositionQuery = TSoftObjectPtr<UEnvQuery>(FSoftObjectPath(TEXT("/Game/Core/AI/EQS_ShootingPositions.EQS_ShootingPositions")));
}
void APalAIController::OnPossess(APawn* InPawn) {
    Super::OnPossess(InPawn);
    APalCharacter* Pal = Cast<APalCharacter>(InPawn);
    if (!HasAuthority() || !IsValid(Pal) || !GetWorld()) return;
    if (!IsValid(Camp)) Camp = Pal->Camp;
    if (IsValid(Camp)) Camp->RegisterWorker(Pal);
    LastDecisionTime = GetWorld()->GetTimeSeconds();
    bUsingBehaviorTree = IsValid(BehaviorTree) && RunBehaviorTree(BehaviorTree);
    if (!bUsingBehaviorTree)
        GetWorldTimerManager().SetTimer(DecisionTimer, this, &APalAIController::EvaluateFallback, .35f, true);
    if (IsValid(Camp) && Camp->IsAbstractMode()) SetCampAbstractMode(true);
}
void APalAIController::OnUnPossess() {
    GetWorldTimerManager().ClearTimer(DecisionTimer);
    ReleaseService();
    if (IsValid(Camp)) Camp->UnregisterWorker(Cast<APalCharacter>(GetPawn()));
    CurrentTask.Id = 0;
    ActiveShootingQueryId = INDEX_NONE;
    ShootingQueryEnemy.Reset();
    Super::OnUnPossess();
}
void APalAIController::ReleaseService() {
    APalCharacter* Pal = Cast<APalCharacter>(GetPawn());
    if (IsValid(Camp) && IsValid(Pal) && CurrentService.IsValid()) Camp->ReleaseService(Pal, CurrentService.Get());
    CurrentService.Reset();
}
void APalAIController::Wander(APalCharacter* Pal, double Now) {
    if (Now < NextWanderTime || !IsValid(Pal)) return;
    NextWanderTime = Now + 5.0;
    UNavigationSystemV1* Nav = FNavigationSystem::GetCurrent<UNavigationSystemV1>(GetWorld());
    FNavLocation Point;
    if (Nav && Nav->GetRandomReachablePointInRadius(Pal->GetActorLocation(), 400.f, Point))
        MoveToLocation(Point.Location, 80.f);
}
void APalAIController::SetCampAbstractMode(bool bAbstract) {
    if (!HasAuthority() || bCampAbstract == bAbstract) return;
    bCampAbstract = bAbstract;
    if (bAbstract) {
        ReleaseService();
        GetWorldTimerManager().ClearTimer(DecisionTimer);
        if (bUsingBehaviorTree && GetBrainComponent()) GetBrainComponent()->StopLogic(TEXT("Camp abstract mode"));
        StopMovement();
        ActiveShootingQueryId = INDEX_NONE;
        ShootingQueryEnemy.Reset();
    } else {
        if (GetWorld()) LastDecisionTime = GetWorld()->GetTimeSeconds();
        if (bUsingBehaviorTree && GetBrainComponent()) GetBrainComponent()->RestartLogic();
        else GetWorldTimerManager().SetTimer(DecisionTimer, this, &APalAIController::EvaluateFallback, .35f, true);
    }
}
void APalAIController::RunDecision() {
    if (bCampAbstract || !GetWorld()) return;
    const double Now = GetWorld()->GetTimeSeconds();
    if (Now < NextDecisionTime) return;
    NextDecisionTime = Now + .3;
    EvaluateFallback();
}
void APalAIController::EvaluateFallback() {
    APalCharacter* Pal = Cast<APalCharacter>(GetPawn());
    if (!HasAuthority() || bCampAbstract || !IsValid(Pal) || !GetWorld()) return;
    const double Now = GetWorld()->GetTimeSeconds();
    const double Delta = FMath::Clamp(Now - LastDecisionTime, 0.0, 10.0);
    LastDecisionTime = Now;
    if (IsValid(Camp) && Camp->IsAbstractMode()) {
        ReleaseService();
        StopMovement();
        Pal->SetEnemyActor(nullptr);
        return;
    }
    const auto Needs = PalRules::AdvanceNeeds({Pal->GetHunger(), Pal->GetSAN()}, Delta, false, false);
    Pal->SetNeeds(static_cast<float>(Needs.hunger), static_cast<float>(Needs.san));
    AActor* Enemy = Pal->FindClosestThreat();
    Pal->SetEnemyActor(Enemy);
    if (CurrentTask.Id && (!IsValid(Camp) || !Camp->IsTaskAssignedTo(CurrentTask.Id, Pal))) CurrentTask.Id = 0;
    const auto Desired = PalRules::ChooseActivity(Pal->GetHunger() / 100.0, Pal->GetSAN() / 100.0,
        IsValid(Camp) ? Camp->IsNight() : bIsNight, IsValid(Enemy), IsValid(Camp));
    if (Desired == PalRules::Activity::Hunger || Desired == PalRules::Activity::Rest) {
        if (CurrentTask.Id && IsValid(Camp)) Camp->ReleaseAssignment(Pal);
        CurrentTask.Id = 0;
        const EBaseServiceType ServiceType = Desired == PalRules::Activity::Hunger ? EBaseServiceType::Feed : EBaseServiceType::Bed;
        if (CurrentService.IsValid() &&
            (!CurrentService->HasReservation(Pal->GetInstanceId()) ||
             (CurrentService->ServiceType != ServiceType &&
              !(ServiceType == EBaseServiceType::Bed && CurrentService->ServiceType == EBaseServiceType::HotSpring))))
            ReleaseService();
        if (!CurrentService.IsValid() && IsValid(Camp) && Now >= NextServiceAttempt) {
            CurrentService = Camp->ReserveService(Pal, ServiceType);
            if (!CurrentService.IsValid()) NextServiceAttempt = Now + 5.0;
        }
        if (!CurrentService.IsValid()) {
            Pal->SetActivity(Desired == PalRules::Activity::Hunger ? EPalActivity::Hungry : EPalActivity::Resting);
            Wander(Pal, Now);
            return;
        }
        const FVector Target = CurrentService->GetServiceLocation();
        if (FVector::DistSquared(Pal->GetActorLocation(), Target) > FMath::Square(140.f)) {
            RequestMoveLocation(Target, 120.f, Now);
        } else {
            StopMovement();
            if (Desired == PalRules::Activity::Hunger && Now - LastFoodTime >= 1.0) {
                if (CurrentService->ConsumeFood(Pal->GetInstanceId())) {
                    LastFoodTime = Now;
                    Pal->SetNeeds(FMath::Min(100.f, Pal->GetHunger() + 25.f), Pal->GetSAN());
                } else { ReleaseService(); NextServiceAttempt = Now + 5.0; }
            }
            if (Desired == PalRules::Activity::Rest) {
                const auto Recovered = PalRules::AdvanceNeeds({Pal->GetHunger(), Pal->GetSAN()}, Delta, false, true);
                Pal->SetNeeds(Pal->GetHunger(), static_cast<float>(Recovered.san));
            }
        }
        Pal->SetActivity(Desired == PalRules::Activity::Hunger ? EPalActivity::Hungry : EPalActivity::Resting);
        return;
    }
    ReleaseService();
    if (Desired == PalRules::Activity::Combat && IsValid(Enemy)) {
        if (CurrentTask.Id && IsValid(Camp)) Camp->ReleaseAssignment(Pal);
        CurrentTask.Id = 0;
        Pal->SetActivity(EPalActivity::Fighting);
        UpdateShootingQuery(Enemy, Now);
        const bool bFreshPosition = ShootingQueryEnemy.Get() == Enemy && Now < ShootingPositionExpiresAt &&
            !ShootingPosition.ContainsNaN() &&
            FVector::DistSquared(ShootingPosition, Enemy->GetActorLocation()) <= FMath::Square(1300.f);
        if (bFreshPosition && FVector::DistSquared(Pal->GetActorLocation(), ShootingPosition) > FMath::Square(150.f))
            RequestMoveLocation(ShootingPosition, 130.f, Now);
        else if (FVector::DistSquared(Pal->GetActorLocation(), Enemy->GetActorLocation()) > FMath::Square(1200.f))
            RequestMoveActor(Enemy, 1100.f, Now);
        else { StopMovement(); Pal->BeginAttack(Enemy); }
        return;
    }
    if (Desired == PalRules::Activity::Work && IsValid(Camp)) {
        if (!CurrentTask.Id && !Camp->GetAssignmentForWorker(Pal, CurrentTask) &&
            !Camp->FindAndAssign(Pal, CurrentTask)) { Pal->SetActivity(EPalActivity::Idle); Wander(Pal, Now); return; }
        Pal->SetCurrentWorkType(CurrentTask.RequiredWorkType);
        if (FVector::DistSquared(Pal->GetActorLocation(), CurrentTask.Location) <= FMath::Square(150.f)) {
            StopMovement();
            Pal->SetActivity(EPalActivity::Working);
        } else {
            Pal->SetActivity(EPalActivity::MovingToWork);
            RequestMoveLocation(CurrentTask.Location, 130.f, Now);
        }
        return;
    }
    Pal->SetActivity(EPalActivity::Idle);
    Wander(Pal, Now);
}

void APalAIController::RequestMoveLocation(const FVector& Goal, float AcceptanceRadius, double Now) {
    if (Now - LastMoveTime < 1.0 && !LastMoveActor.IsValid() && FVector::DistSquared(LastMoveGoal, Goal) < FMath::Square(100.f)) return;
    LastMoveTime = Now;
    LastMoveActor.Reset();
    LastMoveGoal = Goal;
    MoveToLocation(Goal, AcceptanceRadius);
}
void APalAIController::RequestMoveActor(AActor* Goal, float AcceptanceRadius, double Now) {
    if (!IsValid(Goal)) return;
    if (Now - LastMoveTime < 1.0 && LastMoveActor.Get() == Goal) return;
    LastMoveTime = Now;
    LastMoveActor = Goal;
    MoveToActor(Goal, AcceptanceRadius);
}
void APalAIController::UpdateShootingQuery(AActor* Enemy, double Now) {
    if (!IsValid(Enemy) || !GetWorld()) return;
    if (ShootingQueryEnemy.Get() != Enemy) {
        ShootingQueryEnemy = Enemy;
        ActiveShootingQueryId = INDEX_NONE;
        ShootingPositionExpiresAt = 0;
        NextShootingQueryTime = Now;
    }
    if (ActiveShootingQueryId != INDEX_NONE && Now - ShootingQueryStartedAt < 2.0) return;
    if (Now < NextShootingQueryTime || Now < ShootingPositionExpiresAt) return;
    UEnvQuery* Query = ShootingPositionQuery.LoadSynchronous();
    if (!IsValid(Query)) { NextShootingQueryTime = Now + 3.0; return; }
    FEnvQueryRequest Request(Query, this);
    ActiveShootingQueryId = Request.Execute(EEnvQueryRunMode::SingleResult, this, &APalAIController::OnShootingQueryFinished);
    ShootingQueryStartedAt = Now;
    NextShootingQueryTime = Now + 1.0;
}
void APalAIController::OnShootingQueryFinished(TSharedPtr<FEnvQueryResult> Result) {
    if (!Result.IsValid() || Result->QueryID != ActiveShootingQueryId) return;
    ActiveShootingQueryId = INDEX_NONE;
    APalCharacter* Pal = Cast<APalCharacter>(GetPawn());
    AActor* Enemy = ShootingQueryEnemy.Get();
    if (!HasAuthority() || !IsValid(Pal) || !IsValid(Enemy) || Pal->GetEnemyActor() != Enemy ||
        !Result->IsSuccessful() || Result->Items.IsEmpty() || !GetWorld()) return;
    const FVector Found = Result->GetItemAsLocation(0);
    if (Found.ContainsNaN() || FVector::DistSquared(Found, Enemy->GetActorLocation()) > FMath::Square(1300.f)) return;
    ShootingPosition = Found;
    ShootingPositionExpiresAt = GetWorld()->GetTimeSeconds() + 2.0;
}
