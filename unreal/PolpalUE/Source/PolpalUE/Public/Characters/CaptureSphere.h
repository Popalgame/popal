#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "CaptureSphere.generated.h"
class USphereComponent;
class UStaticMeshComponent;
class UProjectileMovementComponent;
UCLASS()
class POLPALUE_API ACaptureSphere : public AActor {
    GENERATED_BODY()
public:
    ACaptureSphere();
    void Launch(const FVector& Direction, float Power);
protected:
    UPROPERTY(VisibleAnywhere) TObjectPtr<USphereComponent> Collision;
    UPROPERTY(VisibleAnywhere) TObjectPtr<UStaticMeshComponent> Visual;
    UPROPERTY(VisibleAnywhere) TObjectPtr<UProjectileMovementComponent> Projectile;
    virtual void BeginPlay() override;
    UFUNCTION() void OnSphereHit(UPrimitiveComponent* HitComponent, AActor* OtherActor,
        UPrimitiveComponent* OtherComponent, FVector NormalImpulse, const FHitResult& Hit);
private:
    float CapturePower = 1.f;
    bool bResolved = false;
};
