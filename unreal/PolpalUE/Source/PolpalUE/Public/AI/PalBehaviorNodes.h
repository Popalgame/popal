#pragma once
#include "CoreMinimal.h"
#include "BehaviorTree/BTService.h"
#include "BehaviorTree/BTTaskNode.h"
#include "EnvironmentQuery/EnvQueryContext.h"
#include "PalBehaviorNodes.generated.h"

UCLASS()
class POLPALUE_API UBTService_PalState : public UBTService {
    GENERATED_BODY()
public:
    UBTService_PalState();
protected:
    virtual void TickNode(UBehaviorTreeComponent& OwnerComp, uint8* NodeMemory, float DeltaSeconds) override;
};
UCLASS()
class POLPALUE_API UBTTask_PalNeeds : public UBTTaskNode {
    GENERATED_BODY()
public:
    UBTTask_PalNeeds();
    virtual EBTNodeResult::Type ExecuteTask(UBehaviorTreeComponent& OwnerComp, uint8* NodeMemory) override;
};
UCLASS()
class POLPALUE_API UBTTask_PalWork : public UBTTaskNode {
    GENERATED_BODY()
public:
    UBTTask_PalWork();
    virtual EBTNodeResult::Type ExecuteTask(UBehaviorTreeComponent& OwnerComp, uint8* NodeMemory) override;
};
UCLASS()
class POLPALUE_API UBTTask_PalAttack : public UBTTaskNode {
    GENERATED_BODY()
public:
    UBTTask_PalAttack();
    virtual EBTNodeResult::Type ExecuteTask(UBehaviorTreeComponent& OwnerComp, uint8* NodeMemory) override;
};
UCLASS()
class POLPALUE_API UBTTask_PalWander : public UBTTaskNode {
    GENERATED_BODY()
public:
    UBTTask_PalWander();
    virtual EBTNodeResult::Type ExecuteTask(UBehaviorTreeComponent& OwnerComp, uint8* NodeMemory) override;
};
UCLASS()
class POLPALUE_API UEnvQueryContext_PalEnemy : public UEnvQueryContext {
    GENERATED_BODY()
public:
    virtual void ProvideContext(FEnvQueryInstance& QueryInstance, FEnvQueryContextData& ContextData) const override;
};
