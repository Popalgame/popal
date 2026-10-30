#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Data/PalData.h"
#include "Data/PolpalSaveGame.h"
#include "BaseCampManager.generated.h"
class AWorkStation;
class APalCharacter;
class ABaseServiceStation;
UCLASS()
class POLPALUE_API ABaseCampManager : public AActor {
    GENERATED_BODY()
public:
    ABaseCampManager();
    int32 RegisterStation(AWorkStation* Station);
    int32 RegisterService(ABaseServiceStation* Station);
    void UnregisterService(int32 Id);
    ABaseServiceStation* ReserveService(APalCharacter* Worker, EBaseServiceType DesiredType);
    ABaseServiceStation* ReserveServiceForRecord(FGuid Id, const FVector& Location, EBaseServiceType DesiredType, AActor* PathContext = nullptr);
    void ReleaseService(APalCharacter* Worker, ABaseServiceStation* Service);
    void UnregisterStation(int32 Id);
    void RegisterWorker(APalCharacter* Worker);
    void UnregisterWorker(APalCharacter* Worker);
    bool FindAndAssign(APalCharacter* Worker, FWorkTask& OutTask);
    bool GetAssignmentForWorker(APalCharacter* Worker, FWorkTask& OutTask) const;
    void ReleaseAssignment(APalCharacter* Worker);
    bool HasAssignment(APalCharacter* Worker) const;
    bool IsTaskAssignedTo(int32 Id, APalCharacter* Worker) const;
    bool ContainsLocation(const FVector& Location) const;
    UFUNCTION(BlueprintPure) bool IsNight() const { return bIsNight; }
    UFUNCTION(BlueprintPure) bool IsAbstractMode() const { return bAbstractMode; }
    bool GetAuthoritativeWorkerRecord(FGuid Id, FPalRuntimeRecord& OutRecord) const;
    FCampSaveRecord ExportSaveRecord() const;
    bool ImportSaveRecord(const FCampSaveRecord& Save);
protected:
    UPROPERTY(Replicated, VisibleAnywhere, BlueprintReadOnly) bool bAbstractMode = false;
    UPROPERTY(EditAnywhere, BlueprintReadOnly) float ActiveRadius = 20000.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) bool bIsNight = false;
    virtual void BeginPlay() override;
    virtual void EndPlay(const EEndPlayReason::Type Reason) override;
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
private:
    struct FRegisteredTask { FWorkTask Task; TWeakObjectPtr<AWorkStation> Station; FGuid AssignedRecordId; };
    TMap<int32, FRegisteredTask> Tasks;
    UPROPERTY(Transient) TMap<FGuid, FPalRuntimeRecord> WorkerRecords;
    UPROPERTY(Transient) TArray<FPalSaveRecord> DeadWorkerTombstones;
    TMap<int32, TWeakObjectPtr<ABaseServiceStation>> Services;
    int32 NextServiceId = 1;
    TSet<TWeakObjectPtr<APalCharacter>> Workers;
    int32 NextTaskId = 1;
    double LastProductionTime = 0;
    FTimerHandle ActivityTimer;
    FTimerHandle ProductionTimer;
    UFUNCTION() void OnWorkerDestroyed(AActor* DestroyedActor);
    void UpdateActivityMode();
    void AdvanceProduction();
    void SetProductionTimer();
    bool IsRegisteredWorker(APalCharacter* Worker) const;
    int32 AssignedTaskFor(APalCharacter* Worker) const;
    bool AssignRecordTask(FPalRuntimeRecord& Record);
    bool bVirtualizingCallbacks = false;
    void SnapshotWorkers();
    void RestoreWorkers();
};
