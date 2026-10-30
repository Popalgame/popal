#include "FX/PalEffectsComponent.h"
#include "NiagaraComponent.h"
#include "NiagaraFunctionLibrary.h"
#include "NiagaraSystem.h"
#include "Engine/World.h"
#include "GameFramework/PlayerController.h"
#include "TimerManager.h"

UPalEffectsComponent::UPalEffectsComponent() {
    PrimaryComponentTick.bCanEverTick = false;
    SetIsReplicatedByDefault(true);
    LibraryAsset = TSoftObjectPtr<UPalFXLibrary>(FSoftObjectPath(TEXT("/Game/VFX/DA_PalEffects.DA_PalEffects")));
}
void UPalEffectsComponent::BeginPlay() {
    Super::BeginPlay();
    if (GetWorld() && GetWorld()->GetNetMode() != NM_DedicatedServer) Library = LibraryAsset.LoadSynchronous();
}
void UPalEffectsComponent::EndPlay(const EEndPlayReason::Type Reason) {
    for (auto& Effect : ActiveEffects) if (Effect.IsValid()) Effect->DestroyComponent();
    ActiveEffects.Reset();
    Super::EndPlay(Reason);
}
void UPalEffectsComponent::PlayWorkEffect(EPalWorkType Work) {
    if (!GetOwner()) return;
    EPalEffectKind Kind = EPalEffectKind::BuildSmoke;
    if (Work == EPalWorkType::Watering) Kind = EPalEffectKind::WaterSplash;
    else if (Work == EPalWorkType::Kindling) Kind = EPalEffectKind::FireBurst;
    else if (Work == EPalWorkType::Mining || Work == EPalWorkType::Handiwork) Kind = EPalEffectKind::HammerSparks;
    PlayLocal(Kind, GetOwner()->GetActorLocation() + FVector(0, 0, 70));
}
void UPalEffectsComponent::BroadcastElementEffect(EPalElement Element, FVector Location) {
    if (!GetOwner() || !GetOwner()->HasAuthority() || Location.ContainsNaN()) return;
    EPalEffectKind Kind = EPalEffectKind::Hit;
    if (Element == EPalElement::Fire) Kind = EPalEffectKind::FireBurst;
    else if (Element == EPalElement::Water || Element == EPalElement::Ice) Kind = EPalEffectKind::WaterSplash;
    else if (Element == EPalElement::Electric) Kind = EPalEffectKind::ElectricArc;
    MulticastPlay(Kind, Location);
}
void UPalEffectsComponent::BroadcastCaptureEffect(FVector Location) {
    if (GetOwner() && GetOwner()->HasAuthority() && !Location.ContainsNaN()) MulticastPlay(EPalEffectKind::CapturePulse, Location);
}
void UPalEffectsComponent::MulticastPlay_Implementation(EPalEffectKind Kind, FVector_NetQuantize Location) {
    PlayLocal(Kind, Location);
}
void UPalEffectsComponent::PlayLocal(EPalEffectKind Kind, const FVector& Location) {
    UWorld* World = GetWorld();
    if (!World || World->GetNetMode() == NM_DedicatedServer || Location.ContainsNaN() || !IsValid(Library)) return;
    const FPalEffectDefinition* Definition = Library->Effects.Find(Kind);
    if (!Definition || !IsValid(Definition->System) || !FMath::IsFinite(Definition->Duration) ||
        !FMath::IsFinite(Definition->Scale) || Definition->Duration <= 0.f || Definition->Scale <= 0.f) return;
    const double Now = World->GetTimeSeconds();
    if (const double* Previous = LastPlayed.Find(Kind); Previous && Now - *Previous < .08) return;
    if (const APlayerController* Viewer = World->GetFirstPlayerController()) {
        FVector Eye; FRotator Rotation;
        Viewer->GetPlayerViewPoint(Eye, Rotation);
        if (FVector::DistSquared(Eye, Location) > FMath::Square(15000.f)) return;
    }
    ActiveEffects.RemoveAll([](const auto& Item) { return !Item.IsValid(); });
    if (ActiveEffects.Num() >= 24) return;
    UNiagaraComponent* Effect = UNiagaraFunctionLibrary::SpawnSystemAtLocation(
        World, Definition->System, Location, FRotator::ZeroRotator,
        FVector(FMath::Clamp(Definition->Scale, .01f, 20.f)), true, false, ENCPoolMethod::None, true);
    if (!Effect) return;
    Effect->Activate(true);
    LastPlayed.Add(Kind, Now);
    ActiveEffects.Add(Effect);
    const TWeakObjectPtr<UNiagaraComponent> WeakEffect(Effect);
    FTimerHandle Cleanup;
    World->GetTimerManager().SetTimer(Cleanup, [WeakEffect]() {
        if (WeakEffect.IsValid()) WeakEffect->DestroyComponent();
    }, FMath::Clamp(Definition->Duration, .05f, 10.f), false);
}
