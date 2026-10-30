#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "PolpalPlayerCharacter.generated.h"
class USpringArmComponent;
class UCameraComponent;
class ACaptureSphere;
class UPalEffectsComponent;
class UPalSpeciesData;
class USkeletalMeshComponent;
UCLASS()
class POLPALUE_API APolpalPlayerCharacter : public ACharacter {
    GENERATED_BODY()
public:
    APolpalPlayerCharacter();
    UFUNCTION(BlueprintPure) float GetCurrentHealth() const { return CurrentHealth; }
    UPalEffectsComponent* GetEffects() const { return Effects; }
    virtual float TakeDamage(float DamageAmount, const FDamageEvent& DamageEvent,
        AController* EventInstigator, AActor* DamageCauser) override;
    UFUNCTION(BlueprintCallable) void ThrowCaptureSphere();
    UFUNCTION(BlueprintCallable) void Attack();
    UFUNCTION(BlueprintCallable) void SummonPal(FGuid InstanceId);
    UFUNCTION(BlueprintCallable) void RecallPal();
    UFUNCTION(BlueprintCallable) void SummonFirstPal();
protected:
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) TObjectPtr<USpringArmComponent> CameraBoom;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) TObjectPtr<UCameraComponent> FollowCamera;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) TObjectPtr<UPalEffectsComponent> Effects;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) TObjectPtr<USkeletalMeshComponent> OutlineMeshComponent;
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Appearance") TSoftObjectPtr<UPalSpeciesData> PlayerAppearanceAsset;
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly) TSubclassOf<ACaptureSphere> CaptureSphereClass;
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, meta=(ClampMin="0.1")) float SpherePower = 1.f;
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, meta=(ClampMin="0.1")) float ThrowCooldown = 0.5f;
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, meta=(ClampMin="0.1")) float PartyActionCooldown = 0.35f;
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Combat", meta=(ClampMin="0.1")) float AttackDamage = 15.f;
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Combat", meta=(ClampMin="0.1")) float AttackCooldown = 0.35f;
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Combat", meta=(ClampMin="1")) float AttackRange = 1200.f;
    UFUNCTION(Server, Reliable) void ServerThrowCaptureSphere(FVector_NetQuantizeNormal Aim);
    UFUNCTION(Server, Reliable) void ServerAttackCurrentAim(FVector_NetQuantizeNormal Aim);
    UFUNCTION(Server, Reliable) void ServerSummonPal(FGuid InstanceId);
    UFUNCTION(Server, Reliable) void ServerRecallPal();
    UPROPERTY(ReplicatedUsing=OnRep_CurrentHealth, BlueprintReadOnly) float CurrentHealth = 100.f;
    UFUNCTION() void OnRep_CurrentHealth();
    virtual void BeginPlay() override;
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
    virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;
private:
    double LastThrowTime = -1000.0;
    double LastAttackTime = -1000.0;
    double LastPartyActionTime = -1000.0;
    void MoveForward(float Value);
    void MoveRight(float Value);
};
