#if WITH_DEV_AUTOMATION_TESTS
#include "Misc/AutomationTest.h"
#include "Core/PalRules.h"
IMPLEMENT_SIMPLE_AUTOMATION_TEST(FPalCoreRulesTest, "Polpal.Core.Rules", EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FPalCoreRulesTest::RunTest(const FString&) {
    TestEqual(TEXT("half health capture"), PalRules::CaptureChance(1, 50, 100, 1, 1), 0.5);
    TestFalse(TEXT("party full"), PalRules::HasPartySpace(5));
    TestEqual(TEXT("hunger precedes work"), static_cast<int>(PalRules::ChooseActivity(.1, 1, false, false, true)), static_cast<int>(PalRules::Activity::Hunger));
    TestFalse(TEXT("hungry worker cannot produce offline"), PalRules::CanProduce(PalRules::Activity::Hunger, true, false));
    TestEqual(TEXT("offline production cadence"), PalRules::ProductionIntervalSeconds(true), 5.0);
    TestTrue(TEXT("feed service capacity"), PalRules::CanReserveService(2, 1, 1, true));
    TestFalse(TEXT("feed service needs inventory"), PalRules::CanReserveService(2, 1, 0, true));
    TestFalse(TEXT("hysteresis keeps active mode"), PalRules::ShouldAbstract(20400, false));
    TestTrue(TEXT("hysteresis enters abstract mode"), PalRules::ShouldAbstract(20600, false));
    return true;
}
#endif
