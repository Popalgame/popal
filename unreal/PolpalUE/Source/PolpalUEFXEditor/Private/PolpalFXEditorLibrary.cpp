#include "PolpalFXEditorLibrary.h"
#include "Misc/PackageName.h"
#include "Modules/ModuleManager.h"
#include "FX/PalEffectsComponent.h"
#include "AssetRegistry/AssetRegistryModule.h"
#include "EditorAssetLibrary.h"
#include "MaterialEditingLibrary.h"
#include "Materials/Material.h"
#include "Materials/MaterialExpressionVectorParameter.h"
#include "Materials/MaterialExpressionTextureCoordinate.h"
#include "Materials/MaterialExpressionCustom.h"
#include "NiagaraCommon.h"
#include "NiagaraEmitter.h"
#include "NiagaraEmitterFactoryNew.h"
#include "NiagaraGraph.h"
#include "NiagaraNodeFunctionCall.h"
#include "NiagaraNodeOutput.h"
#include "NiagaraScript.h"
#include "NiagaraScriptSource.h"
#include "NiagaraSpriteRendererProperties.h"
#include "NiagaraSystem.h"
#include "NiagaraSystemFactoryNew.h"
#include "ViewModels/Stack/NiagaraStackGraphUtilities.h"

namespace {
constexpr TCHAR Generator[] = TEXT("polpal-fx-v1");

bool IsOwned(UObject* Asset) {
    return UEditorAssetLibrary::GetMetadataTag(Asset, TEXT("PolpalFXGenerator")) == Generator;
}
bool Save(UObject* Asset) {
    if (!Asset) return false;
    UEditorAssetLibrary::SetMetadataTag(Asset, TEXT("PolpalFXGenerator"), Generator);
    Asset->MarkPackageDirty();
    return UEditorAssetLibrary::SaveLoadedAsset(Asset, false);
}
template<typename T> T* CreateOrLoad(const FString& Path, bool bForce, bool& bNew, FString& Error) {
    bNew = false;
    if (UObject* Existing = UEditorAssetLibrary::LoadAsset(Path)) {
        T* Typed = Cast<T>(Existing);
        if (!Typed) Error = TEXT("Wrong asset type at ") + Path;
        else if (!IsOwned(Existing)) Error = TEXT("Refusing to change manually authored asset ") + Path;
        return Error.IsEmpty() ? Typed : nullptr;
    }
    const FString Name = FPackageName::GetLongPackageAssetName(Path);
    UPackage* Package = CreatePackage(*Path);
    T* Asset = NewObject<T>(Package, *Name, RF_Public | RF_Standalone | RF_Transactional);
    UEditorAssetLibrary::SetMetadataTag(Asset, TEXT("PolpalFXGenerator"), Generator);
    FAssetRegistryModule::AssetCreated(Asset);
    bNew = true;
    return Asset;
}

UMaterial* SpriteMaterial(const FString& Name, FLinearColor Color, bool bForce, FString& Error) {
    bool bNew = false;
    UMaterial* Material = CreateOrLoad<UMaterial>(TEXT("/Game/VFX/Materials/M_") + Name, bForce, bNew, Error);
    if (!Material || (!bNew && !bForce)) return Material;
    UMaterialEditingLibrary::DeleteAllMaterialExpressions(Material);
    Material->BlendMode = BLEND_Additive;
    Material->TwoSided = true;
    Material->SetShadingModel(MSM_Unlit);
    UMaterialEditingLibrary::SetBaseMaterialUsage(Material, MATUSAGE_NiagaraSprites, true);
    auto* Tint = Cast<UMaterialExpressionVectorParameter>(UMaterialEditingLibrary::CreateMaterialExpression(Material, UMaterialExpressionVectorParameter::StaticClass(), -400, 0));
    auto* UV = Cast<UMaterialExpressionTextureCoordinate>(UMaterialEditingLibrary::CreateMaterialExpression(Material, UMaterialExpressionTextureCoordinate::StaticClass(), -400, 220));
    auto* Mask = Cast<UMaterialExpressionCustom>(UMaterialEditingLibrary::CreateMaterialExpression(Material, UMaterialExpressionCustom::StaticClass(), -180, 220));
    if (!Tint || !UV || !Mask) { Error = TEXT("Sprite material graph creation failed"); return nullptr; }
    Tint->ParameterName = TEXT("Tint"); Tint->DefaultValue = Color;
    Mask->OutputType = CMOT_Float1;
    Mask->Code = TEXT("float2 d = UV * 2.0 - 1.0; return saturate(1.0 - dot(d,d));");
    Mask->Inputs.Reset();
    FCustomInput& Input = Mask->Inputs.AddDefaulted_GetRef();
    Input.InputName = TEXT("UV"); Input.Input.Connect(0, UV);
    if (!UMaterialEditingLibrary::ConnectMaterialProperty(Tint, TEXT("RGB"), MP_EmissiveColor) ||
        !UMaterialEditingLibrary::ConnectMaterialProperty(Mask, TEXT(""), MP_Opacity)) {
        Error = TEXT("Sprite material output connection failed"); return nullptr;
    }
    const TArray<FString> Errors = UMaterialEditingLibrary::RecompileMaterial(Material);
    if (!Errors.IsEmpty()) { Error = FString::Join(Errors, TEXT("; ")); return nullptr; }
    if (!Save(Material)) { Error = TEXT("Could not save sprite material"); return nullptr; }
    return Material;
}

UNiagaraScript* FindSpawnRate() {
    FAssetRegistryModule& Registry = FModuleManager::LoadModuleChecked<FAssetRegistryModule>(TEXT("AssetRegistry"));
    Registry.Get().ScanPathsSynchronous({TEXT("/Niagara")}, true);
    TArray<FAssetData> Assets;
    Registry.Get().GetAssetsByClass(UNiagaraScript::StaticClass()->GetClassPathName(), Assets, true);
    Assets.Sort([](const FAssetData& A, const FAssetData& B) { return A.GetObjectPathString() < B.GetObjectPathString(); });
    for (const FAssetData& Asset : Assets) {
        if (Asset.AssetName == TEXT("SpawnRate") && Asset.PackageName.ToString().StartsWith(TEXT("/Niagara/")))
            return Cast<UNiagaraScript>(Asset.GetAsset());
    }
    return nullptr;
}

UNiagaraSystem* System(const FString& Name, UMaterial* Material, UNiagaraScript* SpawnRate, bool bForce, FString& Error) {
    bool bNewEmitter = false, bNewSystem = false;
    UNiagaraEmitter* Emitter = CreateOrLoad<UNiagaraEmitter>(TEXT("/Game/VFX/Emitters/NE_") + Name, bForce, bNewEmitter, Error);
    if (!Emitter) return nullptr;
    // An existing emitter is preserved; force applies to the system and material.
    if (bNewEmitter) {
        UNiagaraEmitterFactoryNew::InitializeEmitter(Emitter, true);
        FVersionedNiagaraEmitterData* Data = Emitter->GetLatestEmitterData();
        if (!Data) { Error = TEXT("Emitter initialization produced no version data"); return nullptr; }
        Data->SimTarget = ENiagaraSimTarget::CPUSim;
        UNiagaraScriptSource* Source = Cast<UNiagaraScriptSource>(Data->GraphSource);
        TArray<UNiagaraNodeOutput*> Outputs;
        if (Source && Source->NodeGraph) Source->NodeGraph->FindOutputNodes(ENiagaraScriptUsage::EmitterUpdateScript, Outputs);
        if (Outputs.Num() != 1 || !SpawnRate) { Error = TEXT("Emitter update graph/spawn module unavailable"); return nullptr; }
        UNiagaraNodeFunctionCall* SpawnNode = FNiagaraStackGraphUtilities::AddScriptModuleToStack(SpawnRate, *Outputs[0], INDEX_NONE, TEXT("PolpalSpawnRate"), SpawnRate->GetExposedVersion().VersionGuid);
        if (!SpawnNode) { Error = TEXT("Could not add actual Niagara spawn module"); return nullptr; }
        bool bHasSprite = false;
        for (UNiagaraRendererProperties* Renderer : Data->GetRenderers()) {
            if (auto* Sprite = Cast<UNiagaraSpriteRendererProperties>(Renderer)) { Sprite->Material = Material; bHasSprite = true; }
        }
        if (!bHasSprite) { Error = TEXT("Emitter has no sprite renderer"); return nullptr; }
        if (!Save(Emitter)) { Error = TEXT("Could not save emitter"); return nullptr; }
    }
    UNiagaraSystem* Result = CreateOrLoad<UNiagaraSystem>(TEXT("/Game/VFX/NS_") + Name, bForce, bNewSystem, Error);
    if (!Result) return nullptr;
    if (bNewSystem) {
        UNiagaraSystemFactoryNew::InitializeSystem(Result, true);
        Result->AddEmitterHandle(*Emitter, TEXT("Particles"), Emitter->GetExposedVersion().VersionGuid);
    }
    if (Result->GetEmitterHandles().IsEmpty()) { Error = TEXT("Niagara system is empty"); return nullptr; }
    Result->RequestCompile(true, nullptr, nullptr);
    Result->WaitForCompilationComplete(true, false);
    if (!Result->IsReadyToRun() || !Result->IsValid()) { Error = TEXT("Niagara scripts did not compile to a runnable system"); return nullptr; }
    if (!Save(Result)) { Error = TEXT("Could not save Niagara system"); return nullptr; }
    return Result;
}
}

FPolpalFXBuildReport UPolpalFXEditorLibrary::BuildEffects(bool bForce) {
    FPolpalFXBuildReport Report;
    UNiagaraScript* SpawnRate = FindSpawnRate();
    if (!SpawnRate) { Report.Failed.Add(TEXT("Engine Niagara SpawnRate module unavailable; no empty FX assets will be reported as complete")); return Report; }
    FString Error; bool bNewLibrary = false;
    UPalFXLibrary* Library = CreateOrLoad<UPalFXLibrary>(TEXT("/Game/VFX/DA_PalEffects"), bForce, bNewLibrary, Error);
    if (!Library) { Report.Failed.Add(Error); return Report; }
    if (!bNewLibrary && !IsOwned(Library)) { Report.Failed.Add(TEXT("Effect library is manually authored; preserved")); return Report; }
    struct FSpec { EPalEffectKind Kind; const TCHAR* Name; FLinearColor Color; float Duration; float Scale; };
    const FSpec Specs[] = {
        {EPalEffectKind::FireBurst, TEXT("FireBurst"), FLinearColor(1,.16f,.025f), .7f, 1.4f},
        {EPalEffectKind::WaterSplash, TEXT("WaterSplash"), FLinearColor(.025f,.5f,1), .8f, 1.1f},
        {EPalEffectKind::ElectricArc, TEXT("ElectricArc"), FLinearColor(.8f,.6f,1), .25f, 1.7f},
        {EPalEffectKind::HammerSparks, TEXT("HammerSparks"), FLinearColor(1,.75f,.14f), .35f, .65f},
        {EPalEffectKind::BuildSmoke, TEXT("BuildSmoke"), FLinearColor(.3f,.3f,.35f), 1.2f, 1.7f},
        {EPalEffectKind::FatigueSweat, TEXT("FatigueSweat"), FLinearColor(.4f,.8f,1), .6f, .3f},
        {EPalEffectKind::CapturePulse, TEXT("CapturePulse"), FLinearColor(.4f,1,.7f), .75f, 2.f},
        {EPalEffectKind::Hit, TEXT("Hit"), FLinearColor(1,1,1), .2f, .6f}
    };
    for (const auto& Spec : Specs) {
        Error.Reset();
        UMaterial* Material = SpriteMaterial(Spec.Name, Spec.Color, bForce, Error);
        UNiagaraSystem* Effect = Material ? System(Spec.Name, Material, SpawnRate, bForce, Error) : nullptr;
        if (!Effect) { Report.Failed.Add(FString(Spec.Name) + TEXT(": ") + Error); continue; }
        FPalEffectDefinition Definition; Definition.System = Effect; Definition.Duration = Spec.Duration; Definition.Scale = Spec.Scale;
        Library->Effects.Add(Spec.Kind, Definition);
        Report.Created.Add(Effect->GetPathName());
    }
    if (!Save(Library)) Report.Failed.Add(TEXT("Could not save FX library"));
    Report.Pending.Add(TEXT("Visual acceptance: CPU sprite prototypes require in-editor review; ElectricArc uses sprites, not a final ribbon/lightning shader."));
    Report.bOk = Report.Failed.IsEmpty() && Library->Effects.Num() == UE_ARRAY_COUNT(Specs);
    return Report;
}
