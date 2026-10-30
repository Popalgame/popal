#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "Data/PalData.h"
#include "Animation/PalAnimationEventInterface.h"
#include "PalCharacter.generated.h"
class UPalInstanceData;
class ABaseCampManager;
class USphereComponent;
class USkeletalMeshComponent;
class UPalEffectsComponent;
class APalSkillProjectile;
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FPalActivityChanged, EPalActivity, NewActivity);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FPalAttackStarted);

UCLASS()
class POLPALUE_API APalCharacter : public ACharacter, public IPalAnimationEventInterface {
    GENERATED_BODY()
public:
    APalCharacter();
    UPROPERTY(BlueprintAssignable) FPalActivityChanged OnActivityChanged;
    UPROPERTY(BlueprintAssignable) FPalAttackStarted OnAttack;
    UPROPERTY(EditInstanceOnly, BlueprintReadOnly) TObjectPtr<ABaseCampManager> Camp;
    UFUNCTION(BlueprintPure) UPalSpeciesData* GetSpecies() const { return Species; }
    UFUNCTION(BlueprintPure) EPalActivity GetActivity() const { return CurrentActivity; }
    UFUNCTION(BlueprintPure) float GetCurrentHealth() const { return CurrentHealth; }
    UFUNCTION(BlueprintPure) FGuid GetInstanceId() const { return InstanceId; }
    UFUNCTION(BlueprintPure) int32 GetLevel() const { return Level; }
    UFUNCTION(BlueprintPure) AActor* GetEnemyActor() const { return IsValid(EnemyActor) ? EnemyActor : nullptr; }
    AActor* FindClosestThreat() const;
    void SetEnemyActor(AActor* Enemy);
    bool BeginAttack(AActor* Enemy);
    bool CanAttack(AActor* Enemy) const;
    UPalEffectsComponent* GetEffects() const { return Effects; }
    UFUNCTION(BlueprintPure) bool IsOwnedInstance() const { return bOwnedInstance; }
    FPalRuntimeRecord MakeRecord() const;
    void ApplyRecord(const FPalRuntimeRecord& Record);
    void SetAbstractVisual(bool bAbstract);
    UFUNCTION(BlueprintPure) bool IsAbstractVisual() const { return bAbstractVisual; }
    void InitializeFromInstance(UPalInstanceData* Entry);
    UFUNCTION(BlueprintPure) float GetHunger() const { return Hunger; }
    UFUNCTION(BlueprintPure) float GetSAN() const { return SAN; }
    UFUNCTION(BlueprintCallable) void SetNeeds(float NewHunger, float NewSAN);
    virtual float TakeDamage(float DamageAmount, const FDamageEvent& DamageEvent,
        AController* EventInstigator, AActor* DamageCauser) override;
    void SetActivity(EPalActivity NewActivity);
    void SetCurrentWorkType(EPalWorkType Type);
    UFUNCTION(BlueprintPure) EPalWorkType GetCurrentWorkType() const { return CurrentWorkType; }
    virtual void OnPalSpawnProjectile_Implementation() override;
    virtual void OnPalToggleHitbox_Implementation(bool bEnabled) override;
    virtual void OnPalPlayWorkVFX_Implementation(FName Effect) override;
    bool ReserveCapture(AActor* Sphere);
    void ReleaseCapture(AActor* Sphere);
    bool IsCaptureReservedBy(AActor* Sphere) const { return CaptureReservation.Get() == Sphere; }
protected:
    UPROPERTY(EditAnywhere, ReplicatedUsing=OnRep_Species, BlueprintReadOnly) TObjectPtr<UPalSpeciesData> Species;
    UPROPERTY(ReplicatedUsing=OnRep_CurrentActivity, BlueprintReadOnly) EPalActivity CurrentActivity = EPalActivity::Idle;
    UPROPERTY(Replicated, BlueprintReadOnly) float CurrentHealth = 100.f;
    UPROPERTY(Replicated, BlueprintReadOnly) FGuid InstanceId;
    UPROPERTY(Replicated, BlueprintReadOnly) int32 Level = 1;
    UPROPERTY(Transient) TArray<FName> LearnedSkills;
    UPROPERTY(Transient) TArray<FName> Passives;
    UPROPERTY(Transient) FString SourceActorPath;
    bool bInitializedFromRecord = false;
    UPROPERTY(ReplicatedUsing=OnRep_AbstractVisual) bool bAbstractVisual = false;
    UPROPERTY(Replicated, BlueprintReadOnly) float Hunger = 100.f;
    UPROPERTY(Replicated, BlueprintReadOnly) float SAN = 100.f;
    UPROPERTY(Transient) TWeakObjectPtr<AActor> CaptureReservation;
    UPROPERTY(VisibleAnywhere) TObjectPtr<USphereComponent> ThreatSensor;
    UPROPERTY(VisibleAnywhere) TObjectPtr<USkeletalMeshComponent> OutlineMeshComponent;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) TObjectPtr<UPalEffectsComponent> Effects;
    UPROPERTY(ReplicatedUsing=OnRep_CurrentWorkType) EPalWorkType CurrentWorkType = EPalWorkType::Handiwork;
    UFUNCTION() void OnRep_CurrentWorkType();
    UPROPERTY(ReplicatedUsing=OnRep_AttackSequence) uint16 AttackSequence = 0;
    UFUNCTION() void OnRep_AttackSequence();
    UPROPERTY(Replicated) TObjectPtr<AActor> EnemyActor;
    UPROPERTY(EditDefaultsOnly, meta=(ClampMin="0.1")) float AttackCooldown = 1.5f;
    UPROPERTY(EditDefaultsOnly, meta=(ClampMin="50")) float AttackRange = 1300.f;
    UPROPERTY(EditDefaultsOnly) TSubclassOf<APalSkillProjectile> SkillProjectileClass;
    UPROPERTY(Transient) TWeakObjectPtr<AActor> PendingAttackTarget;
    bool bAttackResolved = true;
    double LastAttackTime = -1000.0;
    FTimerHandle AttackFallbackTimer;
    TSet<TWeakObjectPtr<AActor>> Threats;
    UFUNCTION() void OnThreatBegin(UPrimitiveComponent* Overlapped, AActor* Other, UPrimitiveComponent* OtherComp, int32 BodyIndex, bool bFromSweep, const FHitResult& Sweep);
    UFUNCTION() void OnThreatEnd(UPrimitiveComponent* Overlapped, AActor* Other, UPrimitiveComponent* OtherComp, int32 BodyIndex);
    bool IsHostile(AActor* Other) const;
    void ResolvePendingAttack();
    UPROPERTY(Replicated, BlueprintReadOnly) bool bOwnedInstance = false;
    UFUNCTION() void OnRep_CurrentActivity();
    UFUNCTION() void OnRep_Species();
    UFUNCTION() void OnRep_AbstractVisual();
    virtual void BeginPlay() override;
    virtual void EndPlay(const EEndPlayReason::Type Reason) override;
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
};
