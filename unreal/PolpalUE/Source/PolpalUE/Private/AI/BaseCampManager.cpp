#include "AI/BaseCampManager.h"
#include "AI/WorkStation.h"
#include "AI/BaseServiceStation.h"
#include "Characters/PalCharacter.h"
#include "AI/PalAIController.h"
#include "Core/PalRules.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "GameFramework/PlayerController.h"
#include "TimerManager.h"
#include "Net/UnrealNetwork.h"
#include "NavigationSystem.h"
#include "NavigationPath.h"
#include <limits>
#include <vector>
ABaseCampManager::ABaseCampManager() { bReplicates = true; PrimaryActorTick.bCanEverTick = false; }
void ABaseCampManager::BeginPlay() {
    Super::BeginPlay();
    if (!HasAuthority() || !GetWorld()) return;
    LastProductionTime = GetWorld()->GetTimeSeconds();
    GetWorldTimerManager().SetTimer(ActivityTimer, this, &ABaseCampManager::UpdateActivityMode, 5.f, true);
    SetProductionTimer();
}
void ABaseCampManager::EndPlay(const EEndPlayReason::Type Reason) {
    GetWorldTimerManager().ClearTimer(ActivityTimer);
    GetWorldTimerManager().ClearTimer(ProductionTimer);
    Super::EndPlay(Reason);
}
void ABaseCampManager::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& Out) const {
    Super::GetLifetimeReplicatedProps(Out);
    DOREPLIFETIME(ABaseCampManager, bAbstractMode);
}
int32 ABaseCampManager::RegisterStation(AWorkStation* Station) {
    if (!HasAuthority() || !IsValid(Station) || Station->GetActorLocation().ContainsNaN() ||
        FVector::DistSquared(Station->GetActorLocation(), GetActorLocation()) > FMath::Square(ActiveRadius)) return 0;
    const int32 Id = NextTaskId++;
    FRegisteredTask Entry;
    Entry.Task.Id = Id;
    Entry.Task.Location = Station->GetWorkLocation();
    Entry.Task.RequiredWorkType = Station->WorkType;
    Entry.Task.RequiredLevel = FMath::Clamp(Station->RequiredLevel, 1, 4);
    Entry.Task.Priority = Station->Priority;
    Entry.Station = Station;
    Tasks.Add(Id, Entry);
    return Id;
}
void ABaseCampManager::UnregisterStation(int32 Id) { if (HasAuthority()) Tasks.Remove(Id); }
int32 ABaseCampManager::RegisterService(ABaseServiceStation* Station) {
    if (!HasAuthority() || !IsValid(Station) || Station->GetActorLocation().ContainsNaN() ||
        FVector::DistSquared(Station->GetActorLocation(), GetActorLocation()) > FMath::Square(ActiveRadius)) return 0;
    const int32 Id = NextServiceId++;
    Services.Add(Id, Station);
    return Id;
}
void ABaseCampManager::UnregisterService(int32 Id) { if (HasAuthority()) Services.Remove(Id); }
ABaseServiceStation* ABaseCampManager::ReserveService(APalCharacter* Worker, EBaseServiceType DesiredType) {
    if (!HasAuthority() || !IsRegisteredWorker(Worker)) return nullptr;
    return ReserveServiceForRecord(Worker->GetInstanceId(), Worker->GetActorLocation(), DesiredType, Worker);
}
ABaseServiceStation* ABaseCampManager::ReserveServiceForRecord(FGuid Id, const FVector& Location, EBaseServiceType DesiredType, AActor* PathContext) {
    if (!HasAuthority() || !Id.IsValid() || !ContainsLocation(Location)) return nullptr;
    ABaseServiceStation* Best = nullptr;
    double BestDistance = std::numeric_limits<double>::max();
    int32 BestId = MAX_int32;
    for (const auto& Pair : Services) {
        ABaseServiceStation* Station = Pair.Value.Get();
        if (!IsValid(Station) || !Station->CanReserve() ||
            (Station->ServiceType != DesiredType &&
             !(DesiredType == EBaseServiceType::Bed && Station->ServiceType == EBaseServiceType::HotSpring))) continue;
        if (IsValid(PathContext)) {
            UNavigationPath* Path = UNavigationSystemV1::FindPathToLocationSynchronously(GetWorld(), Location,
                Station->GetServiceLocation(), PathContext, nullptr);
            if (!IsValid(Path) || !Path->IsValid() || Path->IsPartial()) continue;
        }
        const double Distance = FVector::DistSquared(Location, Station->GetServiceLocation());
        if (Distance < BestDistance || (Distance == BestDistance && Pair.Key < BestId)) {
            Best = Station; BestDistance = Distance; BestId = Pair.Key;
        }
    }
    return Best && Best->Reserve(Id) ? Best : nullptr;
}
void ABaseCampManager::ReleaseService(APalCharacter* Worker, ABaseServiceStation* Service) {
    if (HasAuthority() && IsValid(Worker) && IsValid(Service)) Service->Release(Worker->GetInstanceId());
}

void ABaseCampManager::RegisterWorker(APalCharacter* Worker) {
    if (!HasAuthority() || !IsValid(Worker)) return;
    Workers.Add(Worker);
    if (Worker->GetInstanceId().IsValid()) WorkerRecords.Add(Worker->GetInstanceId(), Worker->MakeRecord());
    Worker->OnDestroyed.AddUniqueDynamic(this, &ABaseCampManager::OnWorkerDestroyed);
}
void ABaseCampManager::OnWorkerDestroyed(AActor* DestroyedActor) {
    APalCharacter* Worker = Cast<APalCharacter>(DestroyedActor);
    if (!bVirtualizingCallbacks && Worker && !Worker->IsOwnedInstance()) {
        const FPalRuntimeRecord Live = Worker->MakeRecord();
        const FString Path = Live.SourceActorPath;
        const bool bKnown = DeadWorkerTombstones.ContainsByPredicate([&Path](const FPalSaveRecord& Record) { return Record.SourceActorPath == Path; });
        if (!bKnown) {
            FPalSaveRecord Dead;
            Dead.InstanceId = Live.InstanceId;
            Dead.Species = Live.Species;
            Dead.Level = Live.Level;
            Dead.Health = 0.f;
            Dead.Hunger = Live.Hunger;
            Dead.SAN = Live.SAN;
            Dead.LearnedSkills = Live.LearnedSkills;
            Dead.Passives = Live.Passives;
            Dead.Transform = Live.Transform;
            Dead.SourceActorPath = Path;
            DeadWorkerTombstones.Add(MoveTemp(Dead));
        }
    }
    if (!bVirtualizingCallbacks) UnregisterWorker(Worker);
}
void ABaseCampManager::UnregisterWorker(APalCharacter* Worker) {
    if (!HasAuthority()) return;
    ReleaseAssignment(Worker);
    if (Worker && (!bAbstractMode || !Worker->IsOwnedInstance())) WorkerRecords.Remove(Worker->GetInstanceId());
    for (auto& Pair : Services) if (ABaseServiceStation* Service = Pair.Value.Get())
        if (Worker) Service->Release(Worker->GetInstanceId());
    Workers.Remove(TWeakObjectPtr<APalCharacter>(Worker));
    if (IsValid(Worker)) Worker->OnDestroyed.RemoveDynamic(this, &ABaseCampManager::OnWorkerDestroyed);
}
bool ABaseCampManager::HasAssignment(APalCharacter* Worker) const {
    for (const auto& Pair : Tasks) if (Pair.Value.Task.AssignedPal.Get() == Worker ||
        (IsValid(Worker) && Pair.Value.AssignedRecordId == Worker->GetInstanceId())) return true;
    return false;
}
bool ABaseCampManager::IsTaskAssignedTo(int32 Id, APalCharacter* Worker) const {
    const FRegisteredTask* Entry = Tasks.Find(Id);
    return Entry && IsRegisteredWorker(Worker) && (Entry->Task.AssignedPal.Get() == Worker ||
        Entry->AssignedRecordId == Worker->GetInstanceId());
}
void ABaseCampManager::ReleaseAssignment(APalCharacter* Worker) {
    if (!HasAuthority()) return;
    for (auto& Pair : Tasks) if (Worker && (Pair.Value.Task.AssignedPal.Get() == Worker || Pair.Value.AssignedRecordId == Worker->GetInstanceId())) {
        Pair.Value.Task.AssignedPal.Reset();
        Pair.Value.AssignedRecordId.Invalidate();
    }
}
bool ABaseCampManager::GetAssignmentForWorker(APalCharacter* Worker, FWorkTask& OutTask) const {
    if (!IsRegisteredWorker(Worker)) return false;
    for (const auto& Pair : Tasks) if ((Pair.Value.Task.AssignedPal.Get() == Worker || Pair.Value.AssignedRecordId == Worker->GetInstanceId()) && Pair.Value.Station.IsValid()) {
        OutTask = Pair.Value.Task;
        return true;
    }
    return false;
}
bool ABaseCampManager::FindAndAssign(APalCharacter* Worker, FWorkTask& OutTask) {
    if (!HasAuthority() || !IsRegisteredWorker(Worker) || !IsValid(Worker->GetSpecies()) || HasAssignment(Worker)) return false;
    std::vector<PalRules::TaskCandidate> Candidates;
    for (const auto& Pair : Tasks) {
        const auto& Entry = Pair.Value;
        if (!Entry.Station.IsValid()) continue;
        Candidates.push_back({static_cast<uint64_t>(Pair.Key), Entry.Task.Priority,
            Entry.Task.RequiredLevel, Worker->GetSpecies()->SuitabilityFor(Entry.Task.RequiredWorkType),
            static_cast<double>(FVector::DistSquared(Worker->GetActorLocation(), Entry.Task.Location)),
            (IsValid(Entry.Task.AssignedPal.Get()) || Entry.AssignedRecordId.IsValid())});
    }
    const int32 Id = static_cast<int32>(PalRules::SelectTask(Candidates));
    FRegisteredTask* Selected = Tasks.Find(Id);
    if (!Selected || IsValid(Selected->Task.AssignedPal.Get()) || Selected->AssignedRecordId.IsValid()) return false;
    Selected->Task.AssignedPal = Worker;
    Selected->AssignedRecordId = Worker->GetInstanceId();
    OutTask = Selected->Task;
    return true;
}
void ABaseCampManager::UpdateActivityMode() {
    if (!HasAuthority() || !GetWorld()) return;
    double NearestSquared = std::numeric_limits<double>::infinity();
    for (FConstPlayerControllerIterator It = GetWorld()->GetPlayerControllerIterator(); It; ++It) {
        const APlayerController* PC = It->Get();
        const APawn* Pawn = IsValid(PC) ? PC->GetPawn() : nullptr;
        if (IsValid(Pawn)) NearestSquared = FMath::Min(NearestSquared,
            static_cast<double>(FVector::DistSquared(Pawn->GetActorLocation(), GetActorLocation())));
    }
    const bool bNewAbstract = PalRules::ShouldAbstract(std::sqrt(NearestSquared), bAbstractMode, ActiveRadius, 500.0);
    if (bNewAbstract == bAbstractMode) return;
    AdvanceProduction();
    if (bNewAbstract) SnapshotWorkers();
    bAbstractMode = bNewAbstract;
    if (!bNewAbstract) RestoreWorkers();
    SetProductionTimer();
    ForceNetUpdate();
}
int32 ABaseCampManager::AssignedTaskFor(APalCharacter* Worker) const {
    for (const auto& Pair : Tasks) if (Pair.Value.Task.AssignedPal.Get() == Worker) return Pair.Key;
    return 0;
}
void ABaseCampManager::SnapshotWorkers() {
    WorkerRecords.Reset();
    TArray<TWeakObjectPtr<APalCharacter>> Active;
    for (const TWeakObjectPtr<APalCharacter>& Weak : Workers) Active.Add(Weak);
    for (const TWeakObjectPtr<APalCharacter>& Weak : Active) {
        APalCharacter* Worker = Weak.Get();
        if (!IsValid(Worker) || !Worker->GetInstanceId().IsValid()) continue;
        FPalRuntimeRecord Record = Worker->MakeRecord();
        Record.TaskId = AssignedTaskFor(Worker);
        WorkerRecords.Add(Record.InstanceId, Record);
        if (FRegisteredTask* Task = Tasks.Find(Record.TaskId)) Task->AssignedRecordId = Record.InstanceId;
        if (Worker->IsOwnedInstance()) {
            Worker->SetAbstractVisual(true);
            if (APalAIController* AI = Cast<APalAIController>(Worker->GetController())) AI->SetCampAbstractMode(true);
            continue;
        }
        Worker->OnDestroyed.RemoveDynamic(this, &ABaseCampManager::OnWorkerDestroyed);
        if (APalAIController* AI = Cast<APalAIController>(Worker->GetController())) {
            AI->SetCampAbstractMode(true);
            AI->Camp = nullptr;
        }
        Worker->Camp = nullptr;
        Workers.Remove(Weak);
        if (FRegisteredTask* Task = Tasks.Find(Record.TaskId)) Task->Task.AssignedPal.Reset();
        bVirtualizingCallbacks = true;
        Worker->Destroy();
        bVirtualizingCallbacks = false;
    }
    for (auto& Pair : Services) if (ABaseServiceStation* Station = Pair.Value.Get()) Station->ClearReservations();
}
void ABaseCampManager::RestoreWorkers() {
    TArray<FPalRuntimeRecord> ToRestore;
    WorkerRecords.GenerateValueArray(ToRestore);
    for (const FPalRuntimeRecord& Record : ToRestore) {
        if (!Record.InstanceId.IsValid() || !IsValid(Record.Species) || Record.Health <= 0.f) continue;
        APalCharacter* Worker = nullptr;
        if (Record.bOwnedInstance) {
            for (const TWeakObjectPtr<APalCharacter>& Weak : Workers)
                if (IsValid(Weak.Get()) && Weak->GetInstanceId() == Record.InstanceId) { Worker = Weak.Get(); break; }
            if (!IsValid(Worker)) continue; // Party actor was recalled while abstract.
            Worker->ApplyRecord(Record);
            Worker->SetAbstractVisual(false);
            if (APalAIController* AI = Cast<APalAIController>(Worker->GetController())) AI->SetCampAbstractMode(false);
        } else {
            Worker = GetWorld()->SpawnActorDeferred<APalCharacter>(APalCharacter::StaticClass(), Record.Transform,
                this, nullptr, ESpawnActorCollisionHandlingMethod::AlwaysSpawn);
            if (!IsValid(Worker)) continue;
            Worker->Camp = this;
            Worker->ApplyRecord(Record);
            Worker->FinishSpawning(Record.Transform);
            RegisterWorker(Worker);
            if (APalAIController* AI = Cast<APalAIController>(Worker->GetController())) AI->Camp = this;
        }
        if (FRegisteredTask* Task = Tasks.Find(Record.TaskId))
            if (Task->AssignedRecordId == Record.InstanceId) Task->Task.AssignedPal = Worker;
    }
}
void ABaseCampManager::AdvanceProduction() {
    if (!HasAuthority() || !GetWorld()) return;
    const double Now = GetWorld()->GetTimeSeconds();
    const double Delta = FMath::Max(0.0, Now - LastProductionTime);
    LastProductionTime = Now;
    TArray<TPair<TWeakObjectPtr<ABaseServiceStation>, FGuid>> HeldServices;
    if (bAbstractMode) {
        for (auto& RecordPair : WorkerRecords) {
            FPalRuntimeRecord* Record = &RecordPair.Value;
            if (!Record->InstanceId.IsValid() || !IsValid(Record->Species) || Record->Health <= 0.f) continue;
            const auto Before = PalRules::ChooseActivity(Record->Hunger / 100.0, Record->SAN / 100.0,
                bIsNight, false, !Tasks.IsEmpty());
            const auto Needs = PalRules::AdvanceNeeds({Record->Hunger, Record->SAN}, Delta, false, false);
            Record->Hunger = static_cast<float>(Needs.hunger);
            Record->SAN = static_cast<float>(Needs.san);
            const auto After = PalRules::ChooseActivity(Record->Hunger / 100.0, Record->SAN / 100.0,
                bIsNight, false, !Tasks.IsEmpty());
            const auto Desired = (Before == PalRules::Activity::Hunger || Before == PalRules::Activity::Rest) ? Before : After;
            if (Desired == PalRules::Activity::Hunger) {
                if (ABaseServiceStation* Service = ReserveServiceForRecord(Record->InstanceId, Record->Transform.GetLocation(), EBaseServiceType::Feed)) {
                    HeldServices.Emplace(Service, Record->InstanceId);
                    if (Service->ConsumeFood(Record->InstanceId))
                        Record->Hunger = FMath::Min(100.f, Record->Hunger + 25.f);
                }
            } else if (Desired == PalRules::Activity::Rest) {
                if (ABaseServiceStation* Service = ReserveServiceForRecord(Record->InstanceId, Record->Transform.GetLocation(), EBaseServiceType::Bed)) {
                    HeldServices.Emplace(Service, Record->InstanceId);
                    const auto Recovered = PalRules::AdvanceNeeds({Record->Hunger, Record->SAN}, Delta, false, true);
                    Record->SAN = static_cast<float>(Recovered.san);
                }
            } else if (Desired == PalRules::Activity::Work) {
                if (!Record->TaskId) AssignRecordTask(*Record);
                FRegisteredTask* Task = Tasks.Find(Record->TaskId);
                AWorkStation* Station = Task ? Task->Station.Get() : nullptr;
                if (IsValid(Station) && Task->AssignedRecordId == Record->InstanceId)
                    Station->AddWork(Record->Species->BaseStats.WorkSpeed, Delta);
                else Record->TaskId = 0;
            }
        }
    } else {
        for (auto& Pair : Tasks) {
            AWorkStation* Station = Pair.Value.Station.Get();
            APalCharacter* Worker = Cast<APalCharacter>(Pair.Value.Task.AssignedPal.Get());
            if (!IsValid(Station) || !IsRegisteredWorker(Worker) || !IsValid(Worker->GetSpecies())) {
                Pair.Value.Task.AssignedPal.Reset();
                continue;
            }
            const auto Desired = PalRules::ChooseActivity(Worker->GetHunger() / 100.0,
                Worker->GetSAN() / 100.0, bIsNight, IsValid(Worker->GetEnemyActor()), true);
            if (PalRules::CanProduce(Desired, false, Worker->GetActivity() == EPalActivity::Working))
                Station->AddWork(Worker->GetSpecies()->BaseStats.WorkSpeed, Delta);
        }
    }
    for (const auto& Held : HeldServices) if (ABaseServiceStation* Service = Held.Key.Get()) Service->Release(Held.Value);
}

void ABaseCampManager::SetProductionTimer() {
    GetWorldTimerManager().ClearTimer(ProductionTimer);
    const float Interval = static_cast<float>(PalRules::ProductionIntervalSeconds(bAbstractMode));
    GetWorldTimerManager().SetTimer(ProductionTimer, this, &ABaseCampManager::AdvanceProduction, Interval, true);
}
bool ABaseCampManager::ContainsLocation(const FVector& Location) const {
    return !Location.ContainsNaN() && FVector::DistSquared(Location, GetActorLocation()) <= FMath::Square(ActiveRadius);
}
bool ABaseCampManager::IsRegisteredWorker(APalCharacter* Worker) const {
    return IsValid(Worker) && Workers.Contains(TWeakObjectPtr<APalCharacter>(Worker)) &&
        ContainsLocation(Worker->GetActorLocation());
}

FCampSaveRecord ABaseCampManager::ExportSaveRecord() const {
    FCampSaveRecord Save;
    if (!HasAuthority()) return Save;
    Save.ActorPath = GetName();
    auto AppendWorker = [this, &Save](const FPalRuntimeRecord& Record) {
        if (!Record.InstanceId.IsValid() || !IsValid(Record.Species)) return;
        FPalSaveRecord Out;
        Out.InstanceId = Record.InstanceId;
        Out.Species = Record.Species;
        Out.Level = Record.Level;
        Out.Health = Record.Health;
        Out.Hunger = Record.Hunger;
        Out.SAN = Record.SAN;
        Out.LearnedSkills = Record.LearnedSkills;
        Out.Passives = Record.Passives;
        Out.Transform = Record.Transform;
        Out.SourceActorPath = Record.SourceActorPath;
        Out.bOwnedInstance = Record.bOwnedInstance;
        if (const FRegisteredTask* Task = Tasks.Find(Record.TaskId))
            if (AWorkStation* Station = Task->Station.Get()) Out.WorkStationPath = Station->GetName();
        Save.Workers.Add(MoveTemp(Out));
    };
    if (bAbstractMode) {
        for (const auto& Pair : WorkerRecords) AppendWorker(Pair.Value);
    } else {
        for (const TWeakObjectPtr<APalCharacter>& Weak : Workers) {
            APalCharacter* Worker = Weak.Get();
            if (!IsValid(Worker)) continue;
            FPalRuntimeRecord Record = Worker->MakeRecord();
            Record.TaskId = AssignedTaskFor(Worker);
            AppendWorker(Record);
        }
    }
    Save.Workers.Append(DeadWorkerTombstones);
    for (const auto& Pair : Tasks) if (AWorkStation* Station = Pair.Value.Station.Get()) {
        FBuildingSaveRecord Out;
        Out.ActorPath = Station->GetName();
        Out.WorkProgress = Station->WorkProgress;
        Out.ProducedResources = Station->ProducedResources;
        Save.Buildings.Add(MoveTemp(Out));
    }
    for (const auto& Pair : Services) if (ABaseServiceStation* Service = Pair.Value.Get()) {
        FBuildingSaveRecord Out;
        Out.ActorPath = Service->GetName();
        Out.FoodInventory = Service->FoodInventory;
        Save.Buildings.Add(MoveTemp(Out));
    }
    return Save;
}
bool ABaseCampManager::ImportSaveRecord(const FCampSaveRecord& Save) {
    if (!HasAuthority() || Save.ActorPath != GetName() || !GetWorld()) return false;
    if (bAbstractMode) { AdvanceProduction(); bAbstractMode = false; RestoreWorkers(); SetProductionTimer(); }
    for (const FBuildingSaveRecord& Building : Save.Buildings) {
        for (const auto& Pair : Tasks) if (AWorkStation* Station = Pair.Value.Station.Get())
            if (Station->GetName() == Building.ActorPath) Station->LoadProductionState(Building.WorkProgress, Building.ProducedResources);
        for (const auto& Pair : Services) if (ABaseServiceStation* Service = Pair.Value.Get())
            if (Service->GetName() == Building.ActorPath) Service->LoadFoodInventory(Building.FoodInventory);
    }
    bool bAllLoaded = true;
    WorkerRecords.Reset();
    DeadWorkerTombstones.Reset();
    for (auto& Pair : Tasks) {
        Pair.Value.Task.AssignedPal.Reset();
        Pair.Value.AssignedRecordId.Invalidate();
    }
    TSet<FGuid> LoadedIds;
    TSet<FString> LoadedSourcePaths;
    for (const FPalSaveRecord& Saved : Save.Workers) {
        if (Saved.bOwnedInstance) continue; // Party save owns these Pals.
        if (!Saved.InstanceId.IsValid() || Saved.SourceActorPath.IsEmpty() ||
            LoadedIds.Contains(Saved.InstanceId) || LoadedSourcePaths.Contains(Saved.SourceActorPath)) {
            bAllLoaded = false;
            continue;
        }
        LoadedIds.Add(Saved.InstanceId);
        LoadedSourcePaths.Add(Saved.SourceActorPath);
        if (Saved.Health <= 0.f && Saved.InstanceId.IsValid()) {
            DeadWorkerTombstones.Add(Saved);
            for (TActorIterator<APalCharacter> It(GetWorld()); It; ++It)
                if (!It->IsOwnedInstance() && It->Camp == this &&
                    (It->GetInstanceId() == Saved.InstanceId || It->MakeRecord().SourceActorPath == Saved.SourceActorPath)) {
                    It->Destroy(); break;
                }
            continue;
        }
        UPalSpeciesData* Species = Saved.Species.LoadSynchronous();
        if (!Saved.InstanceId.IsValid() || !IsValid(Species) || !FMath::IsFinite(Saved.Health) || Saved.Health <= 0.f ||
            !FMath::IsFinite(Saved.Hunger) || !FMath::IsFinite(Saved.SAN) || Saved.Transform.ContainsNaN()) {
            bAllLoaded = false; continue;
        }
        APalCharacter* Worker = nullptr;
        for (TActorIterator<APalCharacter> It(GetWorld()); It; ++It) {
            if (It->Camp == this && !It->IsOwnedInstance() &&
                (It->GetInstanceId() == Saved.InstanceId || It->MakeRecord().SourceActorPath == Saved.SourceActorPath)) {
                Worker = *It; break;
            }
        }
        const bool bSpawnNew = !Worker;
        if (bSpawnNew) Worker = GetWorld()->SpawnActorDeferred<APalCharacter>(APalCharacter::StaticClass(),
            Saved.Transform, this, nullptr, ESpawnActorCollisionHandlingMethod::AlwaysSpawn);
        if (!IsValid(Worker)) { bAllLoaded = false; continue; }
        Worker->Camp = this;
        FPalRuntimeRecord Record;
        Record.InstanceId = Saved.InstanceId;
        Record.Species = Species;
        Record.Level = Saved.Level;
        Record.Health = Saved.Health;
        Record.Hunger = Saved.Hunger;
        Record.SAN = Saved.SAN;
        Record.LearnedSkills = Saved.LearnedSkills;
        Record.Passives = Saved.Passives;
        Record.Transform = Saved.Transform;
        Record.SourceActorPath = Saved.SourceActorPath;
        Record.bOwnedInstance = false;
        Worker->ApplyRecord(Record);
        if (bSpawnNew) Worker->FinishSpawning(Saved.Transform);
        RegisterWorker(Worker);
        if (APalAIController* AI = Cast<APalAIController>(Worker->GetController())) AI->Camp = this;
        for (auto& Pair : Tasks) if (AWorkStation* Station = Pair.Value.Station.Get())
            if (Station->GetName() == Saved.WorkStationPath && !Pair.Value.Task.AssignedPal.IsValid() &&
                Species->SuitabilityFor(Pair.Value.Task.RequiredWorkType) >= Pair.Value.Task.RequiredLevel) {
                Pair.Value.Task.AssignedPal = Worker;
                Pair.Value.AssignedRecordId = Record.InstanceId;
                Record.TaskId = Pair.Key;
                break;
            }
        WorkerRecords.Add(Record.InstanceId, Record);
    }
    return bAllLoaded;
}

bool ABaseCampManager::GetAuthoritativeWorkerRecord(FGuid Id, FPalRuntimeRecord& OutRecord) const {
    if (!HasAuthority() || !Id.IsValid()) return false;
    if (bAbstractMode) {
        if (const FPalRuntimeRecord* Stored = WorkerRecords.Find(Id)) { OutRecord = *Stored; return true; }
    }
    for (const TWeakObjectPtr<APalCharacter>& Weak : Workers) {
        APalCharacter* Worker = Weak.Get();
        if (IsValid(Worker) && Worker->GetInstanceId() == Id) { OutRecord = Worker->MakeRecord(); return true; }
    }
    return false;
}
bool ABaseCampManager::AssignRecordTask(FPalRuntimeRecord& Record) {
    if (!HasAuthority() || !Record.InstanceId.IsValid() || !IsValid(Record.Species)) return false;
    for (const auto& Pair : Tasks) if (Pair.Value.AssignedRecordId == Record.InstanceId && Pair.Value.Station.IsValid()) {
        Record.TaskId = Pair.Key;
        return true;
    }
    std::vector<PalRules::TaskCandidate> Candidates;
    for (const auto& Pair : Tasks) {
        const FRegisteredTask& Entry = Pair.Value;
        if (!Entry.Station.IsValid()) continue;
        Candidates.push_back({static_cast<uint64_t>(Pair.Key), Entry.Task.Priority, Entry.Task.RequiredLevel,
            Record.Species->SuitabilityFor(Entry.Task.RequiredWorkType),
            static_cast<double>(FVector::DistSquared(Record.Transform.GetLocation(), Entry.Task.Location)),
            Entry.Task.AssignedPal.IsValid() || Entry.AssignedRecordId.IsValid()});
    }
    const int32 Id = static_cast<int32>(PalRules::SelectTask(Candidates));
    FRegisteredTask* Chosen = Tasks.Find(Id);
    if (!Chosen || Chosen->Task.AssignedPal.IsValid() || Chosen->AssignedRecordId.IsValid()) return false;
    Chosen->AssignedRecordId = Record.InstanceId;
    Record.TaskId = Id;
    return true;
}
