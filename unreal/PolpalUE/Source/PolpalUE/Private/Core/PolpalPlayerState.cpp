#include "Core/PolpalPlayerState.h"
#include "Components/PartyComponent.h"
APolpalPlayerState::APolpalPlayerState() { Party = CreateDefaultSubobject<UPartyComponent>(TEXT("Party")); }

FString APolpalPlayerState::GetSaveKey() const {
    if (GetUniqueId().IsValid()) return GetUniqueId().ToString();
    return FString::Printf(TEXT("local_%d"), GetPlayerId());
}
