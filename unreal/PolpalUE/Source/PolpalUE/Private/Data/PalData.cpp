#include "Data/PalData.h"
void UPalInstanceData::Initialize(UPalSpeciesData* InSpecies, float InHealth) {
    InstanceId = FGuid::NewGuid();
    Species = InSpecies;
    Health = InSpecies ? FMath::Clamp(InHealth, 1.f, InSpecies->BaseStats.MaxHealth) : 0.f;
}
