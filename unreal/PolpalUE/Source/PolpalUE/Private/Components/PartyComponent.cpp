#include "Components/PartyComponent.h"
#include "Characters/PalCharacter.h"
#include "Core/PalRules.h"
#include "GameFramework/PlayerState.h"
#include "Net/UnrealNetwork.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "AI/BaseCampManager.h"
#include "AI/PalAIController.h"
#include <limits>

UPartyComponent::UPartyComponent() { SetIsReplicatedByDefault(true); }
void UPartyComponent::EndPlay(const EEndPlayReason::Type Reason) {
    if (GetOwner() && GetOwner()->HasAuthority() && IsValid(SummonedPal)) {
        SummonedPal->OnDestroyed.RemoveDynamic(this, &UPartyComponent::OnSummonedDestroyed);
        SummonedPal->Destroy();
        SummonedPal = nullptr;
        SummonedId.Invalidate();
    }
    Super::EndPlay(Reason);
}
void UPartyComponent::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& Out) const {
    Super::GetLifetimeReplicatedProps(Out);
    DOREPLIFETIME_CONDITION(UPartyComponent, PartySnapshot, COND_OwnerOnly);
}
UPalInstanceData* UPartyComponent::GetInstance(FGuid Id) const {
    if (!GetOwner() || !GetOwner()->HasAuthority()) return nullptr;
    for (UPalInstanceData* Entry : Party) if (IsValid(Entry) && Entry->InstanceId == Id) return Entry;
    return nullptr;
}
void UPartyComponent::RefreshSnapshot() {
    PartySnapshot.Reset();
    for (UPalInstanceData* Entry : Party) if (IsValid(Entry)) {
        FPalPartySnapshot Snapshot;
        Snapshot.InstanceId = Entry->InstanceId;
        Snapshot.Species = Entry->Species;
        Snapshot.Level = Entry->Level;
        Snapshot.Health = Entry->Health;
        Snapshot.Hunger = Entry->Hunger;
        Snapshot.SAN = Entry->SAN;
        Snapshot.LearnedSkills = Entry->LearnedSkills;
        Snapshot.Passives = Entry->Passives;
        PartySnapshot.Add(Snapshot);
    }
    GetOwner()->ForceNetUpdate();
}
bool UPartyComponent::AddCapturedPal(UPalSpeciesData* Species, float Health) {
    if (!GetOwner() || !GetOwner()->HasAuthority() || !IsValid(Species) ||
        !PalRules::HasPartySpace(Party.Num()) || !FMath::IsFinite(Health) || Health <= 0.f ||
        !FMath::IsFinite(Species->BaseStats.MaxHealth) || Species->BaseStats.MaxHealth <= 0.f) return false;
    UPalInstanceData* Entry = NewObject<UPalInstanceData>(this);
    Entry->Initialize(Species, Health);
    Party.Add(Entry);
    RefreshSnapshot();
    return true;
}
bool UPartyComponent::AddCapturedPal(APalCharacter* Target) {
    if (!GetOwner() || !GetOwner()->HasAuthority() || !IsValid(Target) ||
        !PalRules::HasPartySpace(Party.Num()) || Target->IsOwnedInstance()) return false;
    const FPalRuntimeRecord Record = Target->MakeRecord();
    if (!Record.InstanceId.IsValid() || GetInstance(Record.InstanceId) || !IsValid(Record.Species) ||
        !FMath::IsFinite(Record.Health) || Record.Health <= 0.f ||
        !FMath::IsFinite(Record.Species->BaseStats.MaxHealth) ||
        Record.Species->BaseStats.MaxHealth <= 0.f) return false;
    UPalInstanceData* Entry = NewObject<UPalInstanceData>(this);
    Entry->Initialize(Record.Species, Record.Health);
    Entry->InstanceId = Record.InstanceId;
    Entry->Level = Record.Level;
    Entry->Hunger = Record.Hunger;
    Entry->SAN = Record.SAN;
    Entry->LearnedSkills = Record.LearnedSkills;
    Entry->Passives = Record.Passives;
    Party.Add(Entry);
    RefreshSnapshot();
    return true;
}
bool UPartyComponent::RemovePal(FGuid Id) {
    if (!GetOwner() || !GetOwner()->HasAuthority() || Id == SummonedId) return false;
    const int32 Count = Party.RemoveAll([Id](const TObjectPtr<UPalInstanceData>& Entry) { return IsValid(Entry.Get()) && Entry->InstanceId == Id; });
    if (Count) RefreshSnapshot();
    return Count > 0;
}
bool UPartyComponent::Summon(FGuid Id, const FVector& Location) {
    if (!GetOwner() || !GetOwner()->HasAuthority() || IsValid(SummonedPal) || Location.ContainsNaN()) return false;
    UPalInstanceData* Entry = GetInstance(Id);
    if (!Entry || !IsValid(Entry->Species) || !FMath::IsFinite(Entry->Health) || Entry->Health <= 0.f || !GetWorld()) return false;
    FActorSpawnParameters Params;
    Params.Owner = GetOwner();
    Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButDontSpawnIfColliding;
    APalCharacter* Spawned = GetWorld()->SpawnActor<APalCharacter>(APalCharacter::StaticClass(), Location, FRotator::ZeroRotator, Params);
    if (!IsValid(Spawned)) return false;
    Spawned->InitializeFromInstance(Entry);
    ABaseCampManager* NearestCamp = nullptr;
    double NearestDistance = std::numeric_limits<double>::max();
    for (TActorIterator<ABaseCampManager> It(GetWorld()); It; ++It) {
        if (!It->ContainsLocation(Location)) continue;
        const double Distance = FVector::DistSquared(It->GetActorLocation(), Location);
        if (Distance < NearestDistance) { NearestCamp = *It; NearestDistance = Distance; }
    }
    if (IsValid(NearestCamp)) {
        Spawned->Camp = NearestCamp;
        NearestCamp->RegisterWorker(Spawned);
        if (APalAIController* AI = Cast<APalAIController>(Spawned->GetController())) AI->Camp = NearestCamp;
    }
    SummonedPal = Spawned;
    SummonedId = Id;
    Spawned->OnDestroyed.AddUniqueDynamic(this, &UPartyComponent::OnSummonedDestroyed);
    return true;
}
FPalRuntimeRecord UPartyComponent::ReadSummonedRecord() const {
    if (!SummonedPal) return FPalRuntimeRecord();
    FPalRuntimeRecord Record;
    if (IsValid(SummonedPal->Camp) && SummonedPal->Camp->IsAbstractMode() &&
        SummonedPal->Camp->GetAuthoritativeWorkerRecord(SummonedId, Record)) return Record;
    return SummonedPal->MakeRecord();
}
void UPartyComponent::PersistSummonedRecord() {
    if (!GetOwner() || !GetOwner()->HasAuthority() || !SummonedPal) return;
    const FPalRuntimeRecord Record = ReadSummonedRecord();
    if (UPalInstanceData* Entry = GetInstance(SummonedId)) {
        Entry->Health = Record.Health;
        Entry->Hunger = Record.Hunger;
        Entry->SAN = Record.SAN;
        Entry->Level = Record.Level;
        Entry->LearnedSkills = Record.LearnedSkills;
        Entry->Passives = Record.Passives;
    }
}
void UPartyComponent::OnSummonedDestroyed(AActor* DestroyedActor) {
    if (SummonedPal == DestroyedActor && GetOwner() && GetOwner()->HasAuthority()) {
        PersistSummonedRecord();
        SummonedPal = nullptr;
        SummonedId.Invalidate();
        RefreshSnapshot();
    }
}
bool UPartyComponent::Recall() {
    if (!GetOwner() || !GetOwner()->HasAuthority() || !IsValid(SummonedPal)) return false;
    PersistSummonedRecord();
    SummonedPal->OnDestroyed.RemoveDynamic(this, &UPartyComponent::OnSummonedDestroyed);
    SummonedPal->Destroy();
    SummonedPal = nullptr;
    SummonedId.Invalidate();
    RefreshSnapshot();
    return true;
}
TArray<FPalSaveRecord> UPartyComponent::ExportSaveRecords() const {
    TArray<FPalSaveRecord> Result;
    if (!GetOwner() || !GetOwner()->HasAuthority()) return Result;
    for (UPalInstanceData* Entry : Party) if (IsValid(Entry) && IsValid(Entry->Species)) {
        FPalSaveRecord Record;
        Record.InstanceId = Entry->InstanceId;
        Record.Species = Entry->Species;
        Record.Level = Entry->Level;
        const FPalRuntimeRecord Live = IsValid(SummonedPal) && SummonedId == Entry->InstanceId
            ? ReadSummonedRecord() : FPalRuntimeRecord();
        const bool bLive = IsValid(SummonedPal) && SummonedId == Entry->InstanceId;
        Record.Health = bLive ? Live.Health : Entry->Health;
        Record.Hunger = bLive ? Live.Hunger : Entry->Hunger;
        Record.SAN = bLive ? Live.SAN : Entry->SAN;
        Record.Level = bLive ? Live.Level : Entry->Level;
        Record.LearnedSkills = bLive ? Live.LearnedSkills : Entry->LearnedSkills;
        Record.Passives = bLive ? Live.Passives : Entry->Passives;
        Record.bOwnedInstance = true;
        Result.Add(MoveTemp(Record));
    }
    return Result;
}
bool UPartyComponent::ImportSaveRecords(const TArray<FPalSaveRecord>& Records) {
    if (!GetOwner() || !GetOwner()->HasAuthority() || Records.Num() > static_cast<int32>(PalRules::PartyCapacity)) return false;
    TArray<TObjectPtr<UPalInstanceData>> Loaded;
    TSet<FGuid> Seen;
    for (const FPalSaveRecord& Record : Records) {
        UPalSpeciesData* LoadedSpecies = Record.Species.LoadSynchronous();
        if (!Record.InstanceId.IsValid() || Seen.Contains(Record.InstanceId) || !IsValid(LoadedSpecies) ||
            !FMath::IsFinite(LoadedSpecies->BaseStats.MaxHealth) || LoadedSpecies->BaseStats.MaxHealth <= 0.f ||
            !FMath::IsFinite(Record.Health) || Record.Health < 0.f ||
            !FMath::IsFinite(Record.Hunger) || !FMath::IsFinite(Record.SAN)) return false;
        Seen.Add(Record.InstanceId);
        UPalInstanceData* Entry = NewObject<UPalInstanceData>(this);
        Entry->Initialize(LoadedSpecies, FMath::Max(1.f, Record.Health));
        Entry->InstanceId = Record.InstanceId;
        Entry->Level = FMath::Max(1, Record.Level);
        Entry->Health = FMath::Clamp(Record.Health, 0.f, LoadedSpecies->BaseStats.MaxHealth);
        Entry->Hunger = FMath::Clamp(Record.Hunger, 0.f, 100.f);
        Entry->SAN = FMath::Clamp(Record.SAN, 0.f, 100.f);
        Entry->LearnedSkills = Record.LearnedSkills;
        Entry->Passives = Record.Passives;
        Loaded.Add(Entry);
    }
    if (IsValid(SummonedPal)) Recall();
    Party = MoveTemp(Loaded);
    RefreshSnapshot();
    return true;
}
