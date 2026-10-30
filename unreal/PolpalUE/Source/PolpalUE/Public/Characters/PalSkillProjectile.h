#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Data/PalData.h"
#include "PalSkillProjectile.generated.h"
class USphereComponent;
class UStaticMeshComponent;
class UProjectileMovementComponent;
class APalCharacter;
UCLASS()
class POLPALUE_API APalSkillProjectile : public AActor {
    GENERATED_BODY()
public:
    APalSkillProjectile();
    void Launch(APalCharacter* Source, AActor* Target, float Damage, EPalElement Element);
protected:
    UPROPERTY(VisibleAnywhere) TObjectPtr<USphereComponent> Collision;
    UPROPERTY(VisibleAnywhere) TObjectPtr<UStaticMeshComponent> Visual;
    UPROPERTY(VisibleAnywhere) TObjectPtr<UProjectileMovementComponent> Projectile;
    UPROPERTY(ReplicatedUsing=OnRep_AttackElement) EPalElement AttackElement = EPalElement::Neutral;
    UFUNCTION() void OnRep_AttackElement();
    virtual void BeginPlay() override;
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
    UFUNCTION() void OnProjectileHit(UPrimitiveComponent* HitComponent, AActor* OtherActor,
        UPrimitiveComponent* OtherComponent, FVector NormalImpulse, const FHitResult& Hit);
private:
    TWeakObjectPtr<APalCharacter> SourcePal;
    TWeakObjectPtr<AActor> IntendedTarget;
    float AttackDamage = 0.f;
    bool bResolved = false;
};
