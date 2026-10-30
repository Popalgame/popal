#include "Animation/PalAnimInstance.h"
#include "Characters/PalCharacter.h"
#include "GameFramework/Character.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Kismet/GameplayStatics.h"
#include "Camera/PlayerCameraManager.h"
#include "Engine/World.h"

void UPalAnimInstance::NativeUpdateAnimation(float DeltaSeconds)
{
    Super::NativeUpdateAnimation(DeltaSeconds);
    const ACharacter* Character = Cast<ACharacter>(TryGetPawnOwner());
    if (!Character)
    {
        Speed = BlendSpeed = Direction = AimYaw = AimPitch = 0.f;
        bInAir = bFootIKEnabled = false;
        FootIKAlpha = HandIKAlpha = 0.f;
        LocomotionPhase = 0;
        PhaseElapsed = 0.f;
        Activity = EPalActivity::Idle;
        return;
    }

    const FVector Velocity = Character->GetVelocity();
    Speed = Velocity.Size2D();
    BlendSpeed = FMath::Clamp(Speed / 5.f, 0.f, 100.f);
    const FRotator ActorRotation = Character->GetActorRotation();
    Direction = Speed > 1.f
        ? FMath::FindDeltaAngleDegrees(ActorRotation.Yaw, Velocity.Rotation().Yaw) : 0.f;
    const bool bPreviouslyAirborne = bInAir;
    bInAir = Character->GetCharacterMovement() && Character->GetCharacterMovement()->IsFalling();
    PhaseElapsed += FMath::Max(0.f, DeltaSeconds);
    if (bInAir && !bPreviouslyAirborne)
    {
        LocomotionPhase = 1;
        PhaseElapsed = 0.f;
    }
    else if (LocomotionPhase == 1 && PhaseElapsed >= .20f)
    {
        LocomotionPhase = bInAir ? 2 : 3;
        PhaseElapsed = 0.f;
    }
    else if (!bInAir && bPreviouslyAirborne)
    {
        LocomotionPhase = 3;
        PhaseElapsed = 0.f;
    }
    else if (LocomotionPhase == 3 && PhaseElapsed >= .25f)
    {
        LocomotionPhase = 0;
        PhaseElapsed = 0.f;
    }
    const FRotator Aim = Character->GetBaseAimRotation();
    AimYaw = FMath::FindDeltaAngleDegrees(ActorRotation.Yaw, Aim.Yaw);
    AimPitch = FRotator::NormalizeAxis(Aim.Pitch);
    Activity = Cast<APalCharacter>(Character)
        ? CastChecked<APalCharacter>(Character)->GetActivity() : EPalActivity::Idle;

    const USkeletalMeshComponent* Mesh = GetSkelMeshComponent();
    const APlayerCameraManager* Camera = UGameplayStatics::GetPlayerCameraManager(Character, 0);
    const bool bClose = Camera && FVector::DistSquared(Camera->GetCameraLocation(), Character->GetActorLocation())
        <= FMath::Square(3000.f);
    bFootIKEnabled = Mesh && Mesh->GetPredictedLODLevel() <= 1 && bClose && !bInAir;
    FootIKAlpha = 0.f;
    HandIKAlpha = 0.f;
    PelvisIKOffset = FVector::ZeroVector;
    if (!Mesh) return;

    const bool bBipedFeet = Mesh->GetBoneIndex(TEXT("foot_l")) != INDEX_NONE &&
        Mesh->GetBoneIndex(TEXT("foot_r")) != INDEX_NONE &&
        Mesh->GetBoneIndex(TEXT("calf_l")) != INDEX_NONE &&
        Mesh->GetBoneIndex(TEXT("calf_r")) != INDEX_NONE;
    const bool bQuadFeet = Mesh->GetBoneIndex(TEXT("foreleg_lower_l")) != INDEX_NONE &&
        Mesh->GetBoneIndex(TEXT("foreleg_lower_r")) != INDEX_NONE &&
        Mesh->GetBoneIndex(TEXT("hindleg_lower_l")) != INDEX_NONE &&
        Mesh->GetBoneIndex(TEXT("hindleg_lower_r")) != INDEX_NONE &&
        Mesh->GetBoneIndex(TEXT("hand_l")) != INDEX_NONE &&
        Mesh->GetBoneIndex(TEXT("hand_r")) != INDEX_NONE &&
        Mesh->GetBoneIndex(TEXT("foot_l")) != INDEX_NONE &&
        Mesh->GetBoneIndex(TEXT("foot_r")) != INDEX_NONE;
    if (bFootIKEnabled && (bBipedFeet || bQuadFeet) && Character->GetWorld())
    {
        FCollisionQueryParams Params(SCENE_QUERY_STAT(PalFootIK), false, Character);
        float LowestDifference = 0.f;
        auto TraceFoot = [&](FName FootBone, FName KneeBone, FVector& FootTarget, FVector& KneeTarget)
        {
            const FVector Foot = Mesh->GetSocketLocation(FootBone);
            const FVector Knee = Mesh->GetSocketLocation(KneeBone);
            FHitResult Hit;
            const bool bHit = Character->GetWorld()->LineTraceSingleByChannel(Hit,
                Foot + FVector(0, 0, 45), Foot - FVector(0, 0, 95), ECC_Visibility, Params);
            FootTarget = bHit ? FVector(Foot.X, Foot.Y, Hit.ImpactPoint.Z + 2.f) : Foot;
            KneeTarget = Knee + Character->GetActorForwardVector() * 40.f;
            if (bHit) LowestDifference = FMath::Min(LowestDifference, FootTarget.Z - Foot.Z);
        };
        TraceFoot(TEXT("foot_l"), bQuadFeet ? TEXT("hindleg_lower_l") : TEXT("calf_l"),
            FootLeftTarget, KneeLeftTarget);
        TraceFoot(TEXT("foot_r"), bQuadFeet ? TEXT("hindleg_lower_r") : TEXT("calf_r"),
            FootRightTarget, KneeRightTarget);
        if (bQuadFeet)
        {
            TraceFoot(TEXT("hand_l"), TEXT("foreleg_lower_l"), ForeLeftTarget, ForeKneeLeftTarget);
            TraceFoot(TEXT("hand_r"), TEXT("foreleg_lower_r"), ForeRightTarget, ForeKneeRightTarget);
        }
        PelvisIKOffset.Z = FMath::Clamp(LowestDifference * .5f, -25.f, 0.f);
        FootIKAlpha = 1.f;
    }

    // A weapon socket can be supplied by the imported rig. With no grip socket the arm IK stays off.
    if (Mesh->GetBoneIndex(TEXT("hand_l")) != INDEX_NONE &&
        Mesh->GetBoneIndex(TEXT("lowerarm_l")) != INDEX_NONE &&
        Mesh->DoesSocketExist(TEXT("weapon_grip")) && Mesh->GetPredictedLODLevel() <= 1)
    {
        HandGripTarget = Mesh->GetSocketLocation(TEXT("weapon_grip"));
        ElbowLeftTarget = Mesh->GetSocketLocation(TEXT("lowerarm_l")) - Character->GetActorRightVector() * 35.f;
        HandIKAlpha = 1.f;
    }
}
