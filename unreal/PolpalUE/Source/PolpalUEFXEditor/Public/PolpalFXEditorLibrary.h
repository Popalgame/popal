#pragma once
#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "PolpalFXEditorLibrary.generated.h"

USTRUCT(BlueprintType)
struct FPolpalFXBuildReport {
    GENERATED_BODY()
    UPROPERTY(BlueprintReadOnly) bool bOk = false;
    UPROPERTY(BlueprintReadOnly) TArray<FString> Created;
    UPROPERTY(BlueprintReadOnly) TArray<FString> Failed;
    UPROPERTY(BlueprintReadOnly) TArray<FString> Pending;
};

UCLASS()
class POLPALUEFXEDITOR_API UPolpalFXEditorLibrary : public UBlueprintFunctionLibrary {
    GENERATED_BODY()
public:
    // Creates CPU sprite emitters with an explicit spawn module; never empty systems.
    UFUNCTION(BlueprintCallable, Category="Polpal|Editor")
    static FPolpalFXBuildReport BuildEffects(bool bForce = false);
};
