#include "AI/WorkStation.h"
#include "AI/BaseCampManager.h"
#include "Core/PalRules.h"
#include "Components/BoxComponent.h"
#include "NavModifierComponent.h"
#include "NavAreas/NavArea_Null.h"
#include <cmath>
#include "Net/UnrealNetwork.h"
AWorkStation::AWorkStation() {
    bReplicates = true;
    PrimaryActorTick.bCanEverTick = false;
    Collision = CreateDefaultSubobject<UBoxComponent>(TEXT("Collision"));
    Collision->SetBoxExtent(FVector(100, 100, 100));
    Collision->SetCollisionProfileName(TEXT("BlockAll"));
    Collision->SetCollisionEnabled(ECollisionEnabled::QueryAndPhysics);
    RootComponent = Collision;
    NavModifier = CreateDefaultSubobject<UNavModifierComponent>(TEXT("NavModifier"));
    NavModifier->SetAreaClass(UNavArea_Null::StaticClass());
}
void AWorkStation::BeginPlay() {
    Super::BeginPlay();
    if (HasAuthority() && IsValid(Camp)) TaskId = Camp->RegisterStation(this);
}
void AWorkStation::EndPlay(const EEndPlayReason::Type Reason) {
    if (HasAuthority() && IsValid(Camp) && TaskId) Camp->UnregisterStation(TaskId);
    Super::EndPlay(Reason);
}
void AWorkStation::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& Out) const {
    Super::GetLifetimeReplicatedProps(Out);
    DOREPLIFETIME(AWorkStation, WorkProgress);
    DOREPLIFETIME(AWorkStation, ProducedResources);
}
void AWorkStation::AddWork(double Rate, double Seconds) {
    if (!HasAuthority() || !FMath::IsFinite(Rate) || !FMath::IsFinite(Seconds) ||
        !FMath::IsFinite(Efficiency) || Rate < 0 || Seconds <= 0 || Efficiency < 0 ||
        ProducedResources == MAX_int64) return;
    const double EffectiveRate = Rate * static_cast<double>(Efficiency);
    if (!FMath::IsFinite(EffectiveRate)) return;
    const double Total = PalRules::IntegrateProduction(WorkProgress, EffectiveRate, Seconds);
    if (!FMath::IsFinite(Total) || Total < 0) return;
    const double Remaining = static_cast<double>(MAX_int64 - ProducedResources);
    if (Total >= Remaining) { ProducedResources = MAX_int64; WorkProgress = 0.f; }
    else {
        const int64 Complete = static_cast<int64>(std::floor(Total));
        ProducedResources += Complete;
        WorkProgress = static_cast<float>(Total - Complete);
    }
    ForceNetUpdate();
}

bool AWorkStation::LoadProductionState(double Progress, int64 Resources) {
    if (!HasAuthority() || !FMath::IsFinite(Progress) || Progress < 0 || Progress >= 1 || Resources < 0) return false;
    WorkProgress = static_cast<float>(Progress);
    ProducedResources = Resources;
    ForceNetUpdate();
    return true;
}
