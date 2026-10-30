#include "Characters/PalCharacter.h"
#include "Components/SkeletalMeshComponent.h"
#include "Net/UnrealNetwork.h"
#include "AI/PalAIController.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "Components/SphereComponent.h"
#include "Components/CapsuleComponent.h"
#include "Animation/AnimInstance.h"
#include "Animation/AnimMontage.h"
#include "Characters/PolpalPlayerCharacter.h"
#include "Characters/PalSkillProjectile.h"
#include "Engine/World.h"
#include "TimerManager.h"
#include "FX/PalEffectsComponent.h"
#include <limits>

APalCharacter::APalCharacter() {
    bReplicates = true;
    SetReplicateMovement(true);
    AIControllerClass = APalAIController::StaticClass();
    SkillProjectileClass = APalSkillProjectile::StaticClass();
    AutoPossessAI = EAutoPossessAI::PlacedInWorldOrSpawned;
    GetMesh()->bEnableUpdateRateOptimizations = true;
    OutlineMeshComponent = CreateDefaultSubobject<USkeletalMeshComponent>(TEXT("OutlineMesh"));
    OutlineMeshComponent->SetupAttachment(GetMesh());
    OutlineMeshComponent->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    OutlineMeshComponent->SetCastShadow(false);
    OutlineMeshComponent->SetLeaderPoseComponent(GetMesh());
    Effects = CreateDefaultSubobject<UPalEffectsComponent>(TEXT("Effects"));
    ThreatSensor = CreateDefaultSubobject<USphereComponent>(TEXT("ThreatSensor"));
    ThreatSensor->SetupAttachment(GetCapsuleComponent());
    ThreatSensor->InitSphereRadius(1400.f);
    ThreatSensor->SetCollisionEnabled(ECollisionEnabled::QueryOnly);
    ThreatSensor->SetCollisionResponseToAllChannels(ECR_Ignore);
    ThreatSensor->SetCollisionResponseToChannel(ECC_Pawn, ECR_Overlap);
    ThreatSensor->SetGenerateOverlapEvents(true);
    ThreatSensor->OnComponentBeginOverlap.AddDynamic(this, &APalCharacter::OnThreatBegin);
    ThreatSensor->OnComponentEndOverlap.AddDynamic(this, &APalCharacter::OnThreatEnd);
}
void APalCharacter::BeginPlay() {
    Super::BeginPlay();
    if (HasAuthority() && !InstanceId.IsValid()) InstanceId = FGuid::NewGuid();
    if (HasAuthority() && SourceActorPath.IsEmpty()) SourceActorPath = GetName();
    if (HasAuthority() && !bInitializedFromRecord && IsValid(Species) && FMath::IsFinite(Species->BaseStats.MaxHealth) && Species->BaseStats.MaxHealth > 0.f)
        CurrentHealth = Species->BaseStats.MaxHealth;
    OnRep_Species();
}
void APalCharacter::EndPlay(const EEndPlayReason::Type Reason) {
    GetWorldTimerManager().ClearTimer(AttackFallbackTimer);
    Threats.Reset();
    Super::EndPlay(Reason);
}
void APalCharacter::OnRep_Species() {
    if (!IsValid(Species)) return;
    const float Height = FMath::Clamp(Species->MeshHeightCm, 80.f, 500.f);
    const float Radius = FMath::Clamp(Species->CapsuleRadiusCm, 15.f, FMath::Min(150.f, Height * .45f));
    GetCapsuleComponent()->SetCapsuleSize(Radius, Height * .5f);
    GetMesh()->SetRelativeLocation(FVector(0, 0, -Height * .5f));
    GetMesh()->SetSkeletalMesh(Species->SkeletalMesh.Get());
    if (Species->AnimBlueprintClass) GetMesh()->SetAnimInstanceClass(Species->AnimBlueprintClass);
    OutlineMeshComponent->SetSkeletalMesh(Species->OutlineMesh.Get());
    OutlineMeshComponent->SetLeaderPoseComponent(GetMesh());
    OnRep_CurrentActivity();
}
void APalCharacter::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& Out) const {
    Super::GetLifetimeReplicatedProps(Out);
    DOREPLIFETIME(APalCharacter, Species);
    DOREPLIFETIME(APalCharacter, CurrentActivity);
    DOREPLIFETIME(APalCharacter, CurrentHealth);
    DOREPLIFETIME(APalCharacter, InstanceId);
    DOREPLIFETIME(APalCharacter, Level);
    DOREPLIFETIME(APalCharacter, bAbstractVisual);
    DOREPLIFETIME(APalCharacter, EnemyActor);
    DOREPLIFETIME(APalCharacter, CurrentWorkType);
    DOREPLIFETIME(APalCharacter, bOwnedInstance);
    DOREPLIFETIME(APalCharacter, AttackSequence);
    DOREPLIFETIME(APalCharacter, Hunger);
    DOREPLIFETIME(APalCharacter, SAN);
}
void APalCharacter::InitializeFromInstance(UPalInstanceData* Entry) {
    if (!HasAuthority() || !IsValid(Entry) || !IsValid(Entry->Species)) return;
    Species = Entry->Species;
    InstanceId = Entry->InstanceId;
    Level = Entry->Level;
    LearnedSkills = Entry->LearnedSkills;
    Passives = Entry->Passives;
    bOwnedInstance = true;
    CurrentHealth = Entry->Health;
    Hunger = Entry->Hunger;
    SAN = Entry->SAN;
    OnRep_Species();
    ForceNetUpdate();
}
void APalCharacter::SetActivity(EPalActivity NewActivity) {
    if (!HasAuthority() || CurrentActivity == NewActivity) return;
    CurrentActivity = NewActivity;
    OnRep_CurrentActivity();
    ForceNetUpdate();
}
void APalCharacter::SetCurrentWorkType(EPalWorkType Type) {
    if (HasAuthority() && CurrentWorkType != Type) { CurrentWorkType = Type; OnRep_CurrentWorkType(); ForceNetUpdate(); }
}
void APalCharacter::OnRep_CurrentWorkType() { if (CurrentActivity == EPalActivity::Working) OnRep_CurrentActivity(); }
void APalCharacter::OnRep_CurrentActivity() {
    OnActivityChanged.Broadcast(CurrentActivity);
    if (!IsValid(Species)) return;
    UAnimInstance* Anim = GetMesh()->GetAnimInstance();
    if (!Anim) return;
    if (CurrentActivity == EPalActivity::Working) {
        if (const TObjectPtr<UAnimMontage>* Montage = Species->WorkMontages.Find(CurrentWorkType))
            if (IsValid(Montage->Get())) Anim->Montage_Play(Montage->Get());
    } else {
        for (const auto& Pair : Species->WorkMontages)
            if (IsValid(Pair.Value.Get())) Anim->Montage_Stop(.15f, Pair.Value.Get());
    }
}
bool APalCharacter::ReserveCapture(AActor* Sphere) {
    if (!HasAuthority() || !IsValid(Sphere) || !IsValid(Species) || bOwnedInstance || CurrentHealth <= 0.f || (CaptureReservation.IsValid() && CaptureReservation.Get() != Sphere)) return false;
    CaptureReservation = Sphere;
    return true;
}
void APalCharacter::ReleaseCapture(AActor* Sphere) {
    if (HasAuthority() && CaptureReservation.Get() == Sphere) CaptureReservation.Reset();
}

void APalCharacter::SetNeeds(float NewHunger, float NewSAN) {
    if (!HasAuthority() || !FMath::IsFinite(NewHunger) || !FMath::IsFinite(NewSAN)) return;
    Hunger = FMath::Clamp(NewHunger, 0.f, 100.f);
    SAN = FMath::Clamp(NewSAN, 0.f, 100.f);
    ForceNetUpdate();
}

float APalCharacter::TakeDamage(float DamageAmount, const FDamageEvent&,
    AController*, AActor*) {
    if (!HasAuthority() || bAbstractVisual || !FMath::IsFinite(DamageAmount) || DamageAmount <= 0.f ||
        !FMath::IsFinite(CurrentHealth) || CurrentHealth <= 0.f) return 0.f;
    const float Defense = IsValid(Species) && FMath::IsFinite(Species->BaseStats.Defense)
        ? FMath::Max(0.f, Species->BaseStats.Defense) : 0.f;
    const float Applied = FMath::Min(CurrentHealth, FMath::Max(1.f, DamageAmount - Defense));
    if (!FMath::IsFinite(Applied)) return 0.f;
    CurrentHealth = FMath::Max(0.f, CurrentHealth - Applied);
    ForceNetUpdate();
    if (CurrentHealth == 0.f) Destroy();
    return Applied;
}

FPalRuntimeRecord APalCharacter::MakeRecord() const {
    FPalRuntimeRecord Record;
    Record.InstanceId = InstanceId;
    Record.Species = Species;
    Record.Level = Level;
    Record.Health = CurrentHealth;
    Record.Hunger = Hunger;
    Record.SAN = SAN;
    Record.LearnedSkills = LearnedSkills;
    Record.Passives = Passives;
    Record.Transform = GetActorTransform();
    Record.SourceActorPath = SourceActorPath.IsEmpty() ? GetName() : SourceActorPath;
    Record.bOwnedInstance = bOwnedInstance;
    return Record;
}
void APalCharacter::ApplyRecord(const FPalRuntimeRecord& Record) {
    if (!HasAuthority() || !Record.InstanceId.IsValid() || !IsValid(Record.Species) ||
        !FMath::IsFinite(Record.Health) || Record.Health <= 0.f ||
        !FMath::IsFinite(Record.Hunger) || !FMath::IsFinite(Record.SAN)) return;
    InstanceId = Record.InstanceId;
    Species = Record.Species;
    SourceActorPath = Record.SourceActorPath;
    bOwnedInstance = Record.bOwnedInstance;
    bInitializedFromRecord = true;
    Level = FMath::Max(1, Record.Level);
    CurrentHealth = FMath::Clamp(Record.Health, 0.f, FMath::Max(1.f, Species->BaseStats.MaxHealth));
    Hunger = FMath::Clamp(Record.Hunger, 0.f, 100.f);
    SAN = FMath::Clamp(Record.SAN, 0.f, 100.f);
    LearnedSkills = Record.LearnedSkills;
    Passives = Record.Passives;
    SetActorTransform(Record.Transform);
    OnRep_Species();
    ForceNetUpdate();
}
void APalCharacter::SetAbstractVisual(bool bAbstract) {
    if (!HasAuthority() || bAbstractVisual == bAbstract) return;
    bAbstractVisual = bAbstract;
    if (bAbstract) { Threats.Reset(); SetEnemyActor(nullptr); }
    OnRep_AbstractVisual();
    ForceNetUpdate();
}
void APalCharacter::OnRep_AbstractVisual() {
    SetActorHiddenInGame(bAbstractVisual);
    SetActorEnableCollision(!bAbstractVisual);
    GetMesh()->SetComponentTickEnabled(!bAbstractVisual);
    if (bAbstractVisual) GetCharacterMovement()->StopMovementImmediately();
    GetCharacterMovement()->SetComponentTickEnabled(!bAbstractVisual);
}

bool APalCharacter::IsHostile(AActor* Other) const {
    if (!IsValid(Other) || Other == this || bAbstractVisual) return false;
    if (const APolpalPlayerCharacter* Player = Cast<APolpalPlayerCharacter>(Other))
        return !bOwnedInstance && Player->GetCurrentHealth() > 0.f;
    const APalCharacter* Pal = Cast<APalCharacter>(Other);
    return Pal && Pal->bOwnedInstance != bOwnedInstance && Pal->GetCurrentHealth() > 0.f;
}
void APalCharacter::OnThreatBegin(UPrimitiveComponent*, AActor* Other, UPrimitiveComponent*, int32, bool, const FHitResult&) {
    if (HasAuthority() && IsHostile(Other)) Threats.Add(Other);
}
void APalCharacter::OnThreatEnd(UPrimitiveComponent*, AActor* Other, UPrimitiveComponent*, int32) {
    if (HasAuthority()) Threats.Remove(TWeakObjectPtr<AActor>(Other));
    if (EnemyActor == Other) SetEnemyActor(nullptr);
}
AActor* APalCharacter::FindClosestThreat() const {
    if (!HasAuthority() || !GetWorld()) return nullptr;
    AActor* Best = nullptr;
    double BestDistance = std::numeric_limits<double>::max();
    for (const TWeakObjectPtr<AActor>& Weak : Threats) {
        AActor* Candidate = Weak.Get();
        if (!IsHostile(Candidate)) continue;
        const double Distance = FVector::DistSquared(GetActorLocation(), Candidate->GetActorLocation());
        FHitResult SightHit;
        FCollisionQueryParams SightParams(SCENE_QUERY_STAT(PalSight), false, this);
        SightParams.AddIgnoredActor(this);
        const bool bBlocked = GetWorld()->LineTraceSingleByChannel(SightHit,
            GetActorLocation() + FVector(0, 0, 50), Candidate->GetActorLocation() + FVector(0, 0, 50),
            ECC_Visibility, SightParams);
        if (bBlocked && SightHit.GetActor() != Candidate) continue;
        if (Distance < BestDistance || (Distance == BestDistance && Candidate->GetUniqueID() < Best->GetUniqueID())) {
            Best = Candidate;
            BestDistance = Distance;
        }
    }
    return Best;
}
void APalCharacter::SetEnemyActor(AActor* Enemy) {
    if (!HasAuthority()) return;
    AActor* ValidEnemy = IsHostile(Enemy) ? Enemy : nullptr;
    if (EnemyActor == ValidEnemy) return;
    EnemyActor = ValidEnemy;
    ForceNetUpdate();
}
bool APalCharacter::CanAttack(AActor* Enemy) const { return HasAuthority() && IsHostile(Enemy); }
bool APalCharacter::BeginAttack(AActor* Enemy) {
    if (!HasAuthority() || !GetWorld() || !IsHostile(Enemy)) return false;
    const double Now = GetWorld()->GetTimeSeconds();
    if (!FMath::IsFinite(AttackCooldown) || AttackCooldown <= 0.f ||
        !FMath::IsFinite(AttackRange) || AttackRange <= 0.f ||
        Now - LastAttackTime < AttackCooldown ||
        FVector::DistSquared(GetActorLocation(), Enemy->GetActorLocation()) > FMath::Square(AttackRange)) return false;
    LastAttackTime = Now;
    PendingAttackTarget = Enemy;
    bAttackResolved = false;
    SetActivity(EPalActivity::Fighting);
    ++AttackSequence;
    OnRep_AttackSequence();
    ForceNetUpdate();
    GetWorldTimerManager().ClearTimer(AttackFallbackTimer);
    GetWorldTimerManager().SetTimer(AttackFallbackTimer, this, &APalCharacter::ResolvePendingAttack,
        IsValid(Species) && IsValid(Species->AttackMontage) ? .6f : .15f, false);
    return true;
}
void APalCharacter::ResolvePendingAttack() {
    if (!HasAuthority() || bAttackResolved || !GetWorld()) return;
    bAttackResolved = true;
    AActor* Target = PendingAttackTarget.Get();
    PendingAttackTarget.Reset();
    if (!IsHostile(Target) || !IsValid(Species) || !FMath::IsFinite(Species->BaseStats.Attack) ||
        Species->BaseStats.Attack <= 0.f ||
        FVector::DistSquared(GetActorLocation(), Target->GetActorLocation()) > FMath::Square(AttackRange)) return;
    FHitResult Hit;
    FCollisionQueryParams Params(SCENE_QUERY_STAT(PalAttack), false, this);
    Params.AddIgnoredActor(this);
    const FVector Start = GetActorLocation() + FVector(0, 0, 50);
    const FVector End = Target->GetActorLocation() + FVector(0, 0, 50);
    const bool bBlocked = GetWorld()->LineTraceSingleByChannel(Hit, Start, End, ECC_Visibility, Params);
    if (bBlocked && Hit.GetActor() != Target) return;
    if (!SkillProjectileClass) return;
    const FVector StartLocation = GetActorLocation() + FVector(0, 0, 60) +
        (Target->GetActorLocation() - GetActorLocation()).GetSafeNormal() * 100.f;
    FActorSpawnParameters SpawnParams;
    SpawnParams.Owner = this;
    SpawnParams.Instigator = this;
    SpawnParams.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
    APalSkillProjectile* Shot = GetWorld()->SpawnActor<APalSkillProjectile>(SkillProjectileClass,
        StartLocation, (Target->GetActorLocation() - StartLocation).Rotation(), SpawnParams);
    if (IsValid(Shot)) Shot->Launch(this, Target, Species->BaseStats.Attack, Species->ElementType);
}
void APalCharacter::OnRep_AttackSequence() {
    OnAttack.Broadcast();
    if (IsValid(Species) && IsValid(Species->AttackMontage))
        if (UAnimInstance* Anim = GetMesh()->GetAnimInstance()) Anim->Montage_Play(Species->AttackMontage);
}
void APalCharacter::OnPalSpawnProjectile_Implementation() { ResolvePendingAttack(); }
void APalCharacter::OnPalToggleHitbox_Implementation(bool bEnabled) { if (bEnabled) ResolvePendingAttack(); }
void APalCharacter::OnPalPlayWorkVFX_Implementation(FName) {
    if (IsValid(Effects) && CurrentActivity == EPalActivity::Working) Effects->PlayWorkEffect(CurrentWorkType);
}

void APalCharacter::SetLevel(int32 NewLevel) {
    if (!HasAuthority()) return;
    Level = FMath::Clamp(NewLevel, 1, 100);
    ForceNetUpdate();
}
void APalCharacter::LearnSkill(FName Skill) {
    if (HasAuthority() && !Skill.IsNone()) LearnedSkills.AddUnique(Skill);
}
void APalCharacter::AddPassive(FName Passive) {
    if (HasAuthority() && !Passive.IsNone()) Passives.AddUnique(Passive);
}
