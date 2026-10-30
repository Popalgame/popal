#pragma once

#include "CoreMinimal.h"
#include "Animation/AnimInstance.h"
#include "Data/PalData.h"
#include "PalAnimInstance.generated.h"

/** Read-only presentation state. Gameplay state stays authoritative on actors. */
UCLASS(Blueprintable)
class POLPALUE_API UPalAnimInstance : public UAnimInstance
{
    GENERATED_BODY()
public:
    UPROPERTY(BlueprintReadOnly, Category="Pal|Animation") float Speed = 0.f;
    /** 0..100 input for the generated prototype BlendSpace1D. */
    UPROPERTY(BlueprintReadOnly, Category="Pal|Animation") float BlendSpeed = 0.f;
    UPROPERTY(BlueprintReadOnly, Category="Pal|Animation") float Direction = 0.f;
    UPROPERTY(BlueprintReadOnly, Category="Pal|Animation") bool bInAir = false;
    /** 0 ground, 1 jump start, 2 falling, 3 landing. */
    UPROPERTY(BlueprintReadOnly, Category="Pal|Animation") int32 LocomotionPhase = 0;
    UPROPERTY(BlueprintReadOnly, Category="Pal|Animation") float AimYaw = 0.f;
    UPROPERTY(BlueprintReadOnly, Category="Pal|Animation") float AimPitch = 0.f;
    UPROPERTY(BlueprintReadOnly, Category="Pal|Animation") EPalActivity Activity = EPalActivity::Idle;
    UPROPERTY(BlueprintReadOnly, Category="Pal|Animation") bool bFootIKEnabled = false;
    UPROPERTY(BlueprintReadOnly, Category="Pal|Animation|IK") float FootIKAlpha = 0.f;
    UPROPERTY(BlueprintReadOnly, Category="Pal|Animation|IK") FVector FootLeftTarget = FVector::ZeroVector;
    UPROPERTY(BlueprintReadOnly, Category="Pal|Animation|IK") FVector FootRightTarget = FVector::ZeroVector;
    UPROPERTY(BlueprintReadOnly, Category="Pal|Animation|IK") FVector KneeLeftTarget = FVector::ZeroVector;
    UPROPERTY(BlueprintReadOnly, Category="Pal|Animation|IK") FVector KneeRightTarget = FVector::ZeroVector;
    UPROPERTY(BlueprintReadOnly, Category="Pal|Animation|IK") FVector ForeLeftTarget = FVector::ZeroVector;
    UPROPERTY(BlueprintReadOnly, Category="Pal|Animation|IK") FVector ForeRightTarget = FVector::ZeroVector;
    UPROPERTY(BlueprintReadOnly, Category="Pal|Animation|IK") FVector ForeKneeLeftTarget = FVector::ZeroVector;
    UPROPERTY(BlueprintReadOnly, Category="Pal|Animation|IK") FVector ForeKneeRightTarget = FVector::ZeroVector;
    UPROPERTY(BlueprintReadOnly, Category="Pal|Animation|IK") FVector PelvisIKOffset = FVector::ZeroVector;
    UPROPERTY(BlueprintReadOnly, Category="Pal|Animation|IK") float HandIKAlpha = 0.f;
    UPROPERTY(BlueprintReadOnly, Category="Pal|Animation|IK") FVector HandGripTarget = FVector::ZeroVector;
    UPROPERTY(BlueprintReadOnly, Category="Pal|Animation|IK") FVector ElbowLeftTarget = FVector::ZeroVector;

    virtual void NativeUpdateAnimation(float DeltaSeconds) override;
private:
    float PhaseElapsed = 0.f;
};
