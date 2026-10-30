#include "Characters/PalSkillProjectile.h"
#include "Characters/PalCharacter.h"
#include "FX/PalEffectsComponent.h"
#include "Components/SphereComponent.h"
#include "Components/StaticMeshComponent.h"
#include "GameFramework/ProjectileMovementComponent.h"
#include "Kismet/GameplayStatics.h"
#include "Engine/StaticMesh.h"
#include "Materials/MaterialInterface.h"
#include "Net/UnrealNetwork.h"
#include "UObject/ConstructorHelpers.h"
APalSkillProjectile::APalSkillProjectile() {
    bReplicates = true;
    SetReplicateMovement(true);
    Collision = CreateDefaultSubobject<USphereComponent>(TEXT("Collision"));
    Collision->InitSphereRadius(12.f);
    Collision->SetCollisionProfileName(TEXT("BlockAllDynamic"));
    Collision->OnComponentHit.AddDynamic(this, &APalSkillProjectile::OnProjectileHit);
    RootComponent = Collision;
    Visual = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Visual"));
    Visual->SetupAttachment(Collision);
    Visual->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    Visual->SetCastShadow(false);
    Visual->SetRelativeScale3D(FVector(.24f)); // Engine sphere has a 50 cm radius.
    static ConstructorHelpers::FObjectFinder<UStaticMesh> SphereMesh(TEXT("/Engine/BasicShapes/Sphere.Sphere"));
    if (SphereMesh.Succeeded()) Visual->SetStaticMesh(SphereMesh.Object);
    Projectile = CreateDefaultSubobject<UProjectileMovementComponent>(TEXT("Projectile"));
    Projectile->InitialSpeed = 2200.f;
    Projectile->MaxSpeed = 2200.f;
    Projectile->ProjectileGravityScale = 0.f;
    Projectile->bRotationFollowsVelocity = true;
    InitialLifeSpan = 3.f;
}
void APalSkillProjectile::BeginPlay() {
    Super::BeginPlay();
    OnRep_AttackElement();
}
void APalSkillProjectile::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const {
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);
    DOREPLIFETIME(APalSkillProjectile, AttackElement);
}
void APalSkillProjectile::OnRep_AttackElement() {
    const TCHAR* MaterialPath = TEXT("/Game/VFX/Materials/M_Hit.M_Hit");
    switch (AttackElement) {
        case EPalElement::Fire: MaterialPath = TEXT("/Game/VFX/Materials/M_FireBurst.M_FireBurst"); break;
        case EPalElement::Water: MaterialPath = TEXT("/Game/VFX/Materials/M_WaterSplash.M_WaterSplash"); break;
        case EPalElement::Electric: MaterialPath = TEXT("/Game/VFX/Materials/M_ElectricArc.M_ElectricArc"); break;
        default: break;
    }
    UMaterialInterface* Material = LoadObject<UMaterialInterface>(nullptr, MaterialPath);
    if (!IsValid(Material)) Material = LoadObject<UMaterialInterface>(nullptr,
        TEXT("/Engine/EngineMaterials/DefaultMaterial.DefaultMaterial"));
    if (IsValid(Material)) Visual->SetMaterial(0, Material);
}
void APalSkillProjectile::Launch(APalCharacter* Source, AActor* Target, float Damage, EPalElement Element) {
    if (!HasAuthority() || !IsValid(Source) || !IsValid(Target) || !Source->CanAttack(Target) ||
        !FMath::IsFinite(Damage) || Damage <= 0.f) { Destroy(); return; }
    SourcePal = Source;
    IntendedTarget = Target;
    AttackDamage = Damage;
    AttackElement = Element;
    OnRep_AttackElement();
    ForceNetUpdate();
    Collision->IgnoreActorWhenMoving(Source, true);
    const FVector Direction = (Target->GetActorLocation() + FVector(0, 0, 50) - GetActorLocation()).GetSafeNormal();
    Projectile->Velocity = Direction * Projectile->InitialSpeed;
}
void APalSkillProjectile::OnProjectileHit(UPrimitiveComponent*, AActor* OtherActor, UPrimitiveComponent*, FVector, const FHitResult&) {
    if (!HasAuthority() || bResolved) return;
    bResolved = true;
    APalCharacter* Source = SourcePal.Get();
    AActor* Target = IntendedTarget.Get();
    if (IsValid(Source) && IsValid(Target) && OtherActor == Target && Source->CanAttack(Target)) {
        const FVector Impact = Target->GetActorLocation();
        const float Applied = UGameplayStatics::ApplyDamage(Target, AttackDamage, Source->GetController(), Source, nullptr);
        if (Applied > 0.f && IsValid(Source->GetEffects()))
            Source->GetEffects()->BroadcastElementEffect(AttackElement, Impact);
    }
    Destroy();
}
