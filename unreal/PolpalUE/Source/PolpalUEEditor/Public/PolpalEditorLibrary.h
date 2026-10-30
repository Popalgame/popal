#pragma once

#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "PolpalEditorLibrary.generated.h"

USTRUCT(BlueprintType)
struct FPolpalEditorBuildReport
{
    GENERATED_BODY()
    UPROPERTY(BlueprintReadOnly) bool bOk = false;
    UPROPERTY(BlueprintReadOnly) FString Status = TEXT("failed");
    UPROPERTY(BlueprintReadOnly) TArray<FString> Created;
    UPROPERTY(BlueprintReadOnly) TArray<FString> Skipped;
    UPROPERTY(BlueprintReadOnly) TArray<FString> Pending;
    UPROPERTY(BlueprintReadOnly) TArray<FString> Failed;
};

/** Idempotent asset builders for the prototype. Existing assets are preserved. */
UCLASS()
class POLPALUEEDITOR_API UPolpalEditorLibrary : public UBlueprintFunctionLibrary
{
    GENERATED_BODY()
public:
    UFUNCTION(BlueprintCallable, Category="Polpal|Editor")
    static FPolpalEditorBuildReport BuildAnimationAssets(const FString& ManifestPath);
    UFUNCTION(BlueprintCallable, Category="Polpal|Editor")
    static FPolpalEditorBuildReport BuildAIAssets();
    UFUNCTION(BlueprintCallable, Category="Polpal|Editor")
    static FPolpalEditorBuildReport BuildPrototypeMap();
};
