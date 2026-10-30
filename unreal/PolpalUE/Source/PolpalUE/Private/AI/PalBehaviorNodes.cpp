#include "AI/PalBehaviorNodes.h"
#include "AI/PalAIController.h"
#include "AI/BaseServiceStation.h"
#include "AI/BaseCampManager.h"
#include "Characters/PalCharacter.h"
#include "BehaviorTree/BehaviorTreeComponent.h"
#include "BehaviorTree/BlackboardComponent.h"
#include "EnvironmentQuery/Items/EnvQueryItemType_Actor.h"
#include "EnvironmentQuery/EnvQueryTypes.h"

static APalAIController* PalController(UBehaviorTreeComponent& OwnerComp) {
    return Cast<APalAIController>(OwnerComp.GetAIOwner());
}
static EBTNodeResult::Type RunPalTask(UBehaviorTreeComponent& OwnerComp, EPalActivity First, EPalActivity Second) {
    APalAIController* AI = PalController(OwnerComp);
    APalCharacter* Pal = IsValid(AI) ? Cast<APalCharacter>(AI->GetPawn()) : nullptr;
    if (!IsValid(Pal)) return EBTNodeResult::Failed;
    AI->RunDecision();
    const EPalActivity State = Pal->GetActivity();
    return (State == First || State == Second) ? EBTNodeResult::Succeeded : EBTNodeResult::Failed;
}
UBTService_PalState::UBTService_PalState() {
    NodeName = TEXT("Update Pal State");
    Interval = .35f;
    RandomDeviation = 0.f;
    bNotifyTick = true;
}
void UBTService_PalState::TickNode(UBehaviorTreeComponent& OwnerComp, uint8*, float) {
    APalAIController* AI = PalController(OwnerComp);
    APalCharacter* Pal = IsValid(AI) ? Cast<APalCharacter>(AI->GetPawn()) : nullptr;
    UBlackboardComponent* BB = OwnerComp.GetBlackboardComponent();
    if (!IsValid(Pal) || !IsValid(BB)) return;
    AI->RunDecision();
    BB->SetValueAsEnum(TEXT("Activity"), static_cast<uint8>(Pal->GetActivity()));
    BB->SetValueAsObject(TEXT("EnemyActor"), Pal->GetEnemyActor());
    BB->SetValueAsVector(TEXT("WorkLocation"), AI->GetWorkLocation());
    BB->SetValueAsVector(TEXT("ServiceLocation"), IsValid(AI->GetServiceActor()) ? AI->GetServiceActor()->GetServiceLocation() : FVector::ZeroVector);
    BB->SetValueAsFloat(TEXT("Hunger"), Pal->GetHunger());
    BB->SetValueAsFloat(TEXT("SAN"), Pal->GetSAN());
    BB->SetValueAsBool(TEXT("IsNight"), IsValid(AI->Camp) ? AI->Camp->IsNight() : AI->bIsNight);
    BB->SetValueAsBool(TEXT("HasWork"), AI->HasWorkTask());
}
UBTTask_PalNeeds::UBTTask_PalNeeds() { NodeName = TEXT("Meet Critical Needs"); }
EBTNodeResult::Type UBTTask_PalNeeds::ExecuteTask(UBehaviorTreeComponent& OwnerComp, uint8*) {
    return RunPalTask(OwnerComp, EPalActivity::Hungry, EPalActivity::Resting);
}
UBTTask_PalWork::UBTTask_PalWork() { NodeName = TEXT("Move And Work"); }
EBTNodeResult::Type UBTTask_PalWork::ExecuteTask(UBehaviorTreeComponent& OwnerComp, uint8*) {
    return RunPalTask(OwnerComp, EPalActivity::MovingToWork, EPalActivity::Working);
}
UBTTask_PalAttack::UBTTask_PalAttack() { NodeName = TEXT("Attack Enemy"); }
EBTNodeResult::Type UBTTask_PalAttack::ExecuteTask(UBehaviorTreeComponent& OwnerComp, uint8*) {
    return RunPalTask(OwnerComp, EPalActivity::Fighting, EPalActivity::Fighting);
}
UBTTask_PalWander::UBTTask_PalWander() { NodeName = TEXT("Wander"); }
EBTNodeResult::Type UBTTask_PalWander::ExecuteTask(UBehaviorTreeComponent& OwnerComp, uint8*) {
    return RunPalTask(OwnerComp, EPalActivity::Idle, EPalActivity::Idle);
}
void UEnvQueryContext_PalEnemy::ProvideContext(FEnvQueryInstance& QueryInstance, FEnvQueryContextData& ContextData) const {
    AActor* QueryOwner = Cast<AActor>(QueryInstance.Owner.Get());
    APalAIController* AI = Cast<APalAIController>(QueryOwner);
    APalCharacter* Pal = AI ? Cast<APalCharacter>(AI->GetPawn()) : Cast<APalCharacter>(QueryOwner);
    if (IsValid(Pal) && IsValid(Pal->GetEnemyActor()))
        UEnvQueryItemType_Actor::SetContextHelper(ContextData, Pal->GetEnemyActor());
}
