#include "AI/BaseServiceStation.h"
#include "AI/BaseCampManager.h"
#include "Core/PalRules.h"
#include "Components/BoxComponent.h"
#include "NavModifierComponent.h"
#include "NavAreas/NavArea_Null.h"
#include "Net/UnrealNetwork.h"
ABaseServiceStation::ABaseServiceStation() {
    bReplicates = true;
    PrimaryActorTick.bCanEverTick = false;
    Collision = CreateDefaultSubobject<UBoxComponent>(TEXT("Collision"));
    Collision->SetBoxExtent(FVector(75, 75, 100));
    Collision->SetCollisionProfileName(TEXT("BlockAll"));
    RootComponent = Collision;
    NavModifier = CreateDefaultSubobject<UNavModifierComponent>(TEXT("NavModifier"));
    NavModifier->SetAreaClass(UNavArea_Null::StaticClass());
}
void ABaseServiceStation::BeginPlay() {
    Super::BeginPlay();
    if (HasAuthority() && IsValid(Camp)) StationId = Camp->RegisterService(this);
}
void ABaseServiceStation::EndPlay(const EEndPlayReason::Type Reason) {
    if (HasAuthority() && IsValid(Camp) && StationId) Camp->UnregisterService(StationId);
    Reservations.Reset();
    Super::EndPlay(Reason);
}
void ABaseServiceStation::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& Out) const {
    Super::GetLifetimeReplicatedProps(Out);
    DOREPLIFETIME(ABaseServiceStation, FoodInventory);
}
bool ABaseServiceStation::CanReserve() const {
    return PalRules::CanReserveService(Capacity, Reservations.Num(), FoodInventory, ServiceType == EBaseServiceType::Feed);
}
bool ABaseServiceStation::Reserve(FGuid PalId) {
    if (!HasAuthority() || !PalId.IsValid()) return false;
    if (Reservations.Contains(PalId)) return true;
    if (!CanReserve()) return false;
    Reservations.Add(PalId);
    return true;
}
void ABaseServiceStation::Release(FGuid PalId) {
    if (HasAuthority()) Reservations.Remove(PalId);
}
void ABaseServiceStation::ClearReservations() { if (HasAuthority()) Reservations.Reset(); }
bool ABaseServiceStation::ConsumeFood(FGuid PalId) {
    if (!HasAuthority() || ServiceType != EBaseServiceType::Feed ||
        !Reservations.Contains(PalId) || FoodInventory <= 0) return false;
    --FoodInventory;
    ForceNetUpdate();
    return true;
}

bool ABaseServiceStation::LoadFoodInventory(int32 Food) {
    if (!HasAuthority() || Food < 0) return false;
    FoodInventory = Food;
    ForceNetUpdate();
    return true;
}
