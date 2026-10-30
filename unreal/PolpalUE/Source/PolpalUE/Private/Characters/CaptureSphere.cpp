#include "Characters/CaptureSphere.h"
#include "Characters/PalCharacter.h"
#include "Characters/PolpalPlayerCharacter.h"
#include "FX/PalEffectsComponent.h"
#include "Core/PolpalPlayerState.h"
#include "Components/PartyComponent.h"
#include "Core/PalRules.h"
#include "Components/SphereComponent.h"
#include "Components/StaticMeshComponent.h"
#include "GameFramework/ProjectileMovementComponent.h"
#include "GameFramework/Pawn.h"
#include "GameFramework/Controller.h"
#include "Engine/World.h"
#include "Engine/StaticMesh.h"
#include "UObject/ConstructorHelpers.h"
#include "Materials/MaterialInterface.h"

ACaptureSphere::ACaptureSphere() {
    bReplicates = true;
    SetReplicateMovement(true);
    Collision = CreateDefaultSubobject<USphereComponent>(TEXT("Collision"));
    Collision->InitSphereRadius(16.f);
    Collision->SetCollisionProfileName(TEXT("BlockAllDynamic"));
    Collision->OnComponentHit.AddDynamic(this, &ACaptureSphere::OnSphereHit);
    RootComponent = Collision;
    Visual = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Visual"));
    Visual->SetupAttachment(Collision);
    Visual->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    Visual->SetCastShadow(false);
    Visual->SetRelativeScale3D(FVector(.32f)); // Engine sphere has a 50 cm radius.
    static ConstructorHelpers::FObjectFinder<UStaticMesh> SphereMesh(TEXT("/Engine/BasicShapes/Sphere.Sphere"));
    if (SphereMesh.Succeeded()) Visual->SetStaticMesh(SphereMesh.Object);
    Projectile = CreateDefaultSubobject<UProjectileMovementComponent>(TEXT("Projectile"));
    Projectile->InitialSpeed = 1800.f;
    Projectile->MaxSpeed = 1800.f;
    Projectile->bRotationFollowsVelocity = true;
    InitialLifeSpan = 8.f;
}
void ACaptureSphere::BeginPlay() {
    Super::BeginPlay();
    UMaterialInterface* Material = LoadObject<UMaterialInterface>(nullptr,
        TEXT("/Game/VFX/Materials/M_CapturePulse.M_CapturePulse"));
    if (!IsValid(Material)) Material = LoadObject<UMaterialInterface>(nullptr,
        TEXT("/Engine/EngineMaterials/DefaultMaterial.DefaultMaterial"));
    if (IsValid(Material)) Visual->SetMaterial(0, Material);
}
void ACaptureSphere::Launch(const FVector& Direction, float Power) {
    if (!HasAuthority() || Direction.ContainsNaN() || !FMath::IsFinite(Power) || Power <= 0.f) return;
    CapturePower = Power;
    if (GetInstigator()) Collision->IgnoreActorWhenMoving(GetInstigator(), true);
    Projectile->Velocity = Direction.GetSafeNormal() * Projectile->InitialSpeed;
}
void ACaptureSphere::OnSphereHit(UPrimitiveComponent*, AActor* OtherActor, UPrimitiveComponent*, FVector, const FHitResult&) {
    if (!HasAuthority() || bResolved) return;
    bResolved = true;
    APalCharacter* Target = Cast<APalCharacter>(OtherActor);
    APawn* Thrower = GetInstigator();
    AController* Controller = IsValid(Thrower) ? Thrower->GetController() : nullptr;
    APolpalPlayerState* PS = IsValid(Controller) ? Controller->GetPlayerState<APolpalPlayerState>() : nullptr;
    UPartyComponent* Party = IsValid(PS) ? PS->Party : nullptr;
    if (!IsValid(Target) || !IsValid(Party) || !IsValid(Target->GetSpecies()) ||
        !Target->ReserveCapture(this)) { Destroy(); return; }
    if (APolpalPlayerCharacter* Player = Cast<APolpalPlayerCharacter>(Thrower))
        if (UPalEffectsComponent* FX = Player->GetEffects()) FX->BroadcastCaptureEffect(Target->GetActorLocation());
    const double Chance = PalRules::CaptureChance(CapturePower, Target->GetCurrentHealth(),
        Target->GetSpecies()->BaseStats.MaxHealth, 1.0, Target->GetSpecies()->RarityFactor);
    const bool bSuccess = FMath::FRand() < Chance &&
        Party->AddCapturedPal(Target);
    Target->ReleaseCapture(this);
    if (bSuccess && IsValid(Target)) Target->Destroy();
    Destroy();
}
