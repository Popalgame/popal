#include "Animation/PalAnimNotifies.h"
#include "Animation/PalAnimationEventInterface.h"
#include "Components/SkeletalMeshComponent.h"
#include "Engine/World.h"

void UAN_SpawnProjectile::Notify(USkeletalMeshComponent* MeshComp, UAnimSequenceBase* Animation,
    const FAnimNotifyEventReference& EventReference)
{
    Super::Notify(MeshComp, Animation, EventReference);
    AActor* Owner = MeshComp ? MeshComp->GetOwner() : nullptr;
    if (Owner && Owner->HasAuthority() && Owner->GetClass()->ImplementsInterface(UPalAnimationEventInterface::StaticClass()))
    {
        IPalAnimationEventInterface::Execute_OnPalSpawnProjectile(Owner);
    }
}

void UAN_PlayWorkVFX::Notify(USkeletalMeshComponent* MeshComp, UAnimSequenceBase* Animation,
    const FAnimNotifyEventReference& EventReference)
{
    Super::Notify(MeshComp, Animation, EventReference);
    AActor* Owner = MeshComp ? MeshComp->GetOwner() : nullptr;
    if (Owner && Owner->GetNetMode() != NM_DedicatedServer
        && Owner->GetClass()->ImplementsInterface(UPalAnimationEventInterface::StaticClass()))
    {
        IPalAnimationEventInterface::Execute_OnPalPlayWorkVFX(Owner, Effect);
    }
}

void UAN_ToggleHitbox::Notify(USkeletalMeshComponent* MeshComp, UAnimSequenceBase* Animation,
    const FAnimNotifyEventReference& EventReference)
{
    Super::Notify(MeshComp, Animation, EventReference);
    AActor* Owner = MeshComp ? MeshComp->GetOwner() : nullptr;
    if (Owner && Owner->HasAuthority() && Owner->GetClass()->ImplementsInterface(UPalAnimationEventInterface::StaticClass()))
    {
        IPalAnimationEventInterface::Execute_OnPalToggleHitbox(Owner, bEnabled);
    }
}
