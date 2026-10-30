#include "Core/PolpalGameMode.h"
#include "Core/PolpalPlayerState.h"
#include "Characters/PolpalPlayerCharacter.h"
#include "Components/PartyComponent.h"
#include "AI/BaseCampManager.h"
#include "Data/PolpalSaveGame.h"
#include "GameFramework/GameStateBase.h"
#include "Kismet/GameplayStatics.h"
#include "EngineUtils.h"
APolpalGameMode::APolpalGameMode() {
    PlayerStateClass = APolpalPlayerState::StaticClass();
    DefaultPawnClass = APolpalPlayerCharacter::StaticClass();
}

bool APolpalGameMode::SaveWorldToSlot(const FString& SlotName) {
    if (!HasAuthority() || SlotName.IsEmpty() || !GetWorld()) return false;
    UPolpalSaveGame* Save = Cast<UPolpalSaveGame>(UGameplayStatics::CreateSaveGameObject(UPolpalSaveGame::StaticClass()));
    if (!Save) return false;
    if (GameState) for (APlayerState* Base : GameState->PlayerArray) {
        APolpalPlayerState* PS = Cast<APolpalPlayerState>(Base);
        if (!IsValid(PS) || !IsValid(PS->Party)) continue;
        FPartySaveRecord Party;
        Party.PlayerKey = PS->GetSaveKey();
        Party.Pals = PS->Party->ExportSaveRecords();
        Save->Parties.Add(MoveTemp(Party));
    }
    for (TActorIterator<ABaseCampManager> It(GetWorld()); It; ++It)
        Save->Camps.Add(It->ExportSaveRecord());
    return UGameplayStatics::SaveGameToSlot(Save, SlotName, 0);
}
bool APolpalGameMode::LoadWorldFromSlot(const FString& SlotName) {
    if (!HasAuthority() || SlotName.IsEmpty() || !GetWorld()) return false;
    UPolpalSaveGame* Save = Cast<UPolpalSaveGame>(UGameplayStatics::LoadGameFromSlot(SlotName, 0));
    if (!Save || Save->FormatVersion != 2) return false;
    bool bAllLoaded = true;
    for (TActorIterator<ABaseCampManager> It(GetWorld()); It; ++It) {
        for (const FCampSaveRecord& Camp : Save->Camps) if (Camp.ActorPath == It->GetName())
            bAllLoaded &= It->ImportSaveRecord(Camp);
    }
    if (GameState) for (APlayerState* Base : GameState->PlayerArray) {
        APolpalPlayerState* PS = Cast<APolpalPlayerState>(Base);
        if (!IsValid(PS) || !IsValid(PS->Party)) continue;
        for (const FPartySaveRecord& Party : Save->Parties) if (Party.PlayerKey == PS->GetSaveKey())
            bAllLoaded &= PS->Party->ImportSaveRecords(Party.Pals);
    }
    return bAllLoaded;
}
