#include "Characters/PolpalPlayerCharacter.h"
#include "Characters/CaptureSphere.h"
#include "Characters/PalCharacter.h"
#include "Core/PolpalPlayerState.h"
#include "Components/PartyComponent.h"
#include "Data/PalData.h"
#include "Camera/CameraComponent.h"
#include "GameFramework/SpringArmComponent.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "Components/InputComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Components/CapsuleComponent.h"
#include "Engine/World.h"
#include "Net/UnrealNetwork.h"
#include "FX/PalEffectsComponent.h"
#include "Kismet/GameplayStatics.h"

APolpalPlayerCharacter::APolpalPlayerCharacter() {
    bReplicates = true;
    CameraBoom = CreateDefaultSubobject<USpringArmComponent>(TEXT("CameraBoom"));
    CameraBoom->SetupAttachment(RootComponent);
    CameraBoom->TargetArmLength = 300.f;
    CameraBoom->bUsePawnControlRotation = true;
    Effects = CreateDefaultSubobject<UPalEffectsComponent>(TEXT("Effects"));
    OutlineMeshComponent = CreateDefaultSubobject<USkeletalMeshComponent>(TEXT("OutlineMesh"));
    OutlineMeshComponent->SetupAttachment(GetMesh());
    OutlineMeshComponent->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    OutlineMeshComponent->SetCastShadow(false);
    OutlineMeshComponent->SetLeaderPoseComponent(GetMesh());
    PlayerAppearanceAsset = TSoftObjectPtr<UPalSpeciesData>(FSoftObjectPath(
        TEXT("/Game/Characters/Pals/biped_standard/DA_Rig_Biped_Standard.DA_Rig_Biped_Standard")));
    FollowCamera = CreateDefaultSubobject<UCameraComponent>(TEXT("FollowCamera"));
    FollowCamera->SetupAttachment(CameraBoom, USpringArmComponent::SocketName);
    FollowCamera->bUsePawnControlRotation = false;
    bUseControllerRotationYaw = false;
    GetCharacterMovement()->bOrientRotationToMovement = true;
    CaptureSphereClass = ACaptureSphere::StaticClass();
}
void APolpalPlayerCharacter::BeginPlay() {
    Super::BeginPlay();
    UPalSpeciesData* Appearance = PlayerAppearanceAsset.LoadSynchronous();
    if (!IsValid(Appearance) || !IsValid(Appearance->SkeletalMesh.Get())) {
        UE_LOG(LogTemp, Warning, TEXT("Player %s: appearance asset or skeletal mesh is unavailable: %s"),
            *GetName(), *PlayerAppearanceAsset.ToSoftObjectPath().ToString());
        return;
    }
    const float Height = FMath::Clamp(FMath::IsFinite(Appearance->MeshHeightCm) ? Appearance->MeshHeightCm : 180.f, 80.f, 500.f);
    const float Radius = FMath::Clamp(FMath::IsFinite(Appearance->CapsuleRadiusCm) ? Appearance->CapsuleRadiusCm : 35.f,
        15.f, FMath::Min(150.f, Height * .45f));
    GetCapsuleComponent()->SetCapsuleSize(Radius, Height * .5f);
    GetMesh()->SetRelativeLocation(FVector(0, 0, -Height * .5f));
    GetMesh()->SetSkeletalMesh(Appearance->SkeletalMesh.Get());
    if (Appearance->AnimBlueprintClass) GetMesh()->SetAnimInstanceClass(Appearance->AnimBlueprintClass);
    OutlineMeshComponent->SetSkeletalMesh(Appearance->OutlineMesh.Get());
    OutlineMeshComponent->SetLeaderPoseComponent(GetMesh());
}
void APolpalPlayerCharacter::SetupPlayerInputComponent(UInputComponent* Input) {
    Super::SetupPlayerInputComponent(Input);
    Input->BindAxis(TEXT("MoveForward"), this, &APolpalPlayerCharacter::MoveForward);
    Input->BindAxis(TEXT("MoveRight"), this, &APolpalPlayerCharacter::MoveRight);
    Input->BindAxis(TEXT("Turn"), this, &APawn::AddControllerYawInput);
    Input->BindAxis(TEXT("LookUp"), this, &APawn::AddControllerPitchInput);
    Input->BindAction(TEXT("Jump"), IE_Pressed, this, &ACharacter::Jump);
    Input->BindAction(TEXT("Jump"), IE_Released, this, &ACharacter::StopJumping);
    Input->BindAction(TEXT("ThrowSphere"), IE_Pressed, this, &APolpalPlayerCharacter::ThrowCaptureSphere);
    Input->BindAction(TEXT("Attack"), IE_Pressed, this, &APolpalPlayerCharacter::Attack);
    Input->BindAction(TEXT("RecallPal"), IE_Pressed, this, &APolpalPlayerCharacter::RecallPal);
    Input->BindAction(TEXT("SummonPal"), IE_Pressed, this, &APolpalPlayerCharacter::SummonFirstPal);
}
void APolpalPlayerCharacter::MoveForward(float Value) {
    if (Controller && Value != 0.f) AddMovementInput(FRotationMatrix(FRotator(0, Controller->GetControlRotation().Yaw, 0)).GetUnitAxis(EAxis::X), Value);
}
void APolpalPlayerCharacter::MoveRight(float Value) {
    if (Controller && Value != 0.f) AddMovementInput(FRotationMatrix(FRotator(0, Controller->GetControlRotation().Yaw, 0)).GetUnitAxis(EAxis::Y), Value);
}
void APolpalPlayerCharacter::ThrowCaptureSphere() {
    if (CurrentHealth > 0.f && Controller) ServerThrowCaptureSphere(Controller->GetControlRotation().Vector());
}
void APolpalPlayerCharacter::Attack() {
    if (CurrentHealth > 0.f && Controller) ServerAttackCurrentAim(Controller->GetControlRotation().Vector());
}
void APolpalPlayerCharacter::ServerAttackCurrentAim_Implementation(FVector_NetQuantizeNormal Aim) {
    if (!HasAuthority() || CurrentHealth <= 0.f || !Controller || !GetWorld() ||
        !FMath::IsFinite(AttackDamage) || AttackDamage <= 0.f ||
        !FMath::IsFinite(AttackCooldown) || AttackCooldown <= 0.f ||
        !FMath::IsFinite(AttackRange) || AttackRange <= 0.f || AttackRange > 5000.f ||
        !FMath::IsFinite(Aim.X) || !FMath::IsFinite(Aim.Y) || !FMath::IsFinite(Aim.Z) ||
        Aim.SizeSquared() < .9f || Aim.SizeSquared() > 1.1f) return;
    const double Now = GetWorld()->GetTimeSeconds();
    if (Now - LastAttackTime < AttackCooldown) return;
    LastAttackTime = Now;
    FVector EyeLocation;
    FRotator EyeRotation;
    GetActorEyesViewPoint(EyeLocation, EyeRotation);
    if (EyeLocation.ContainsNaN() ||
        FVector::DotProduct(Aim, Controller->GetControlRotation().Vector()) < .8f ||
        FVector::DotProduct(Aim, EyeRotation.Vector()) < .8f) return;
    const FVector Direction = FVector(Aim).GetSafeNormal();
    FCollisionQueryParams Query(SCENE_QUERY_STAT(PlayerAttack), false, this);
    Query.AddIgnoredActor(this);
    FHitResult Hit;
    if (!GetWorld()->LineTraceSingleByChannel(Hit, EyeLocation, EyeLocation + Direction * AttackRange,
            ECC_Visibility, Query)) return;
    APalCharacter* Target = Cast<APalCharacter>(Hit.GetActor());
    if (!IsValid(Target) || Target->IsOwnedInstance() || Target->GetCurrentHealth() <= 0.f) return;
    const float Applied = UGameplayStatics::ApplyPointDamage(Target, AttackDamage, Direction, Hit,
        Controller, this, nullptr);
    if (Applied > 0.f && IsValid(Effects)) Effects->BroadcastElementEffect(EPalElement::Neutral, Hit.ImpactPoint);
}
void APolpalPlayerCharacter::ServerThrowCaptureSphere_Implementation(FVector_NetQuantizeNormal Aim) {
    if (!HasAuthority() || CurrentHealth <= 0.f || !Controller || !GetWorld() || !CaptureSphereClass) return;
    const double Now = GetWorld()->GetTimeSeconds();
    if (Now - LastThrowTime < ThrowCooldown || Aim.ContainsNaN() ||
        FVector::DotProduct(Aim, Controller->GetControlRotation().Vector()) < 0.8f) return;
    const FVector SpawnLocation = GetActorLocation() + FVector(0, 0, 60) + Aim * 100;
    FActorSpawnParameters Params;
    Params.Owner = this;
    Params.Instigator = this;
    Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
    if (ACaptureSphere* Sphere = GetWorld()->SpawnActor<ACaptureSphere>(CaptureSphereClass, SpawnLocation, Aim.Rotation(), Params)) {
        Sphere->Launch(Aim, SpherePower);
        LastThrowTime = Now;
    }
}
void APolpalPlayerCharacter::SummonPal(FGuid Id) { ServerSummonPal(Id); }
void APolpalPlayerCharacter::ServerSummonPal_Implementation(FGuid Id) {
    if (!HasAuthority() || CurrentHealth <= 0.f || !Id.IsValid() || !GetWorld()) return;
    const double Now = GetWorld()->GetTimeSeconds();
    if (Now - LastPartyActionTime < PartyActionCooldown) return;
    LastPartyActionTime = Now;
    if (const APolpalPlayerState* PS = GetPlayerState<APolpalPlayerState>())
        if (PS->Party) PS->Party->Summon(Id, GetActorLocation() + GetActorForwardVector() * 150.f);
}
void APolpalPlayerCharacter::RecallPal() { ServerRecallPal(); }
void APolpalPlayerCharacter::ServerRecallPal_Implementation() {
    if (!HasAuthority() || CurrentHealth <= 0.f || !GetWorld()) return;
    const double Now = GetWorld()->GetTimeSeconds();
    if (Now - LastPartyActionTime < PartyActionCooldown) return;
    LastPartyActionTime = Now;
    if (const APolpalPlayerState* PS = GetPlayerState<APolpalPlayerState>())
        if (PS->Party) PS->Party->Recall();
}

void APolpalPlayerCharacter::SummonFirstPal() {
    const APolpalPlayerState* PS = GetPlayerState<APolpalPlayerState>();
    if (PS && PS->Party && !PS->Party->GetPartySnapshot().IsEmpty()) SummonPal(PS->Party->GetPartySnapshot()[0].InstanceId);
}

void APolpalPlayerCharacter::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& Out) const {
    Super::GetLifetimeReplicatedProps(Out);
    DOREPLIFETIME(APolpalPlayerCharacter, CurrentHealth);
}
float APolpalPlayerCharacter::TakeDamage(float DamageAmount, const FDamageEvent&, AController*, AActor*) {
    if (!HasAuthority() || !FMath::IsFinite(DamageAmount) || DamageAmount <= 0.f || CurrentHealth <= 0.f) return 0.f;
    const float Applied = FMath::Min(CurrentHealth, DamageAmount);
    CurrentHealth = FMath::Max(0.f, CurrentHealth - Applied);
    OnRep_CurrentHealth();
    ForceNetUpdate();
    return Applied;
}
void APolpalPlayerCharacter::OnRep_CurrentHealth() {
    if (CurrentHealth <= 0.f) GetCharacterMovement()->DisableMovement();
}
