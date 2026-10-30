#include "../Source/PolpalUE/Public/Core/PalRules.h"
#include <cassert>
#include <cmath>
#include <limits>
#include <vector>

int main() {
    using namespace PalRules;
    assert(CaptureChance(1, 0, 100, 1, 1) == 1);
    assert(CaptureChance(1, 100, 100, 1, 1) == 0.01);
    assert(CaptureChance(1, 50, 100, 1, 1) == 0.5);
    assert(CaptureChance(0, 50, 100, 1, 1) == 0.01);
    assert(CaptureChance(1, 50, 100, 0, 1) == 0.01);
    assert(CaptureChance(1, 50, 0, 1, 1) == 0);
    assert(CaptureChance(1, 50, 100, 1, 0) == 0);
    assert(CaptureChance(NAN, 50, 100, 1, 1) == 0);
    assert(CaptureChance(INFINITY, 50, 100, 1, 1) == 0);
    assert(CaptureChance(1, 50, 100, INFINITY, 1) == 0);
    assert(CaptureChance(1, -10, 100, 1, 1) == 1);
    assert(CaptureChance(1, 200, 100, 1, 1) == 0.01);
    assert(HasPartySpace(4) && !HasPartySpace(5) && !HasPartySpace(6));
    assert(CanReserveService(2, 1, 1, true));
    assert(!CanReserveService(2, 2, 1, true));
    assert(!CanReserveService(2, 1, 0, true));
    assert(CanReserveService(2, 1, 0, false));
    const Needs decayed = AdvanceNeeds({50, 50}, 10, false, false);
    assert(std::abs(decayed.hunger - 49.8) < 1e-9);
    assert(std::abs(decayed.san - 49.9) < 1e-9);
    const Needs fed = AdvanceNeeds({10, 20}, 1, true, false);
    assert(fed.hunger == 35);
    const Needs rested = AdvanceNeeds({10, 10}, 5, false, true);
    assert(rested.san == 30);
    assert(ShouldAbstract(INFINITY, false));
    assert(!ShouldAbstract(20000, false));
    assert(!ShouldAbstract(20400, false));
    assert(ShouldAbstract(20600, false));
    assert(ShouldAbstract(20100, true));
    assert(!ShouldAbstract(20000, true));
    assert(ChooseActivity(.19, .01, true, true, true) == Activity::Hunger);
    assert(ChooseActivity(.20, .14, false, true, true) == Activity::Rest);
    assert(ChooseActivity(.20, .15, true, true, true) == Activity::Rest);
    assert(ChooseActivity(.20, .15, false, true, true) == Activity::Combat);
    assert(ChooseActivity(.20, .15, false, false, true) == Activity::Work);
    assert(ChooseActivity(.20, .15, false, false, false) == Activity::Idle);
    std::vector<TaskCandidate> tasks{{8, 1, 2, 2, 4, false}, {3, 2, 3, 2, 1, false},
        {5, 2, 2, 2, 9, false}, {4, 2, 2, 2, 9, false}};
    assert(SelectTask(tasks) == 4);
    tasks[3].assigned = true;
    assert(SelectTask(tasks) == 5);
    tasks[2].assigned = true;
    assert(SelectTask(tasks) == 8);
    tasks[0].assigned = true;
    assert(SelectTask(tasks) == 0);
    tasks.push_back({9, 9, 1, 4, NAN, false});
    assert(SelectTask(tasks) == 0);
    const double once = IntegrateProduction(0, 2.5, 10);
    const double partitioned = IntegrateProduction(IntegrateProduction(0, 2.5, 3), 2.5, 7);
    assert(once == partitioned && once == 25);
    assert(IntegrateProduction(10, 2, -1) == 10);
    assert(IntegrateProduction(10, std::numeric_limits<double>::max(), 2) == 10);
    assert(ProductionIntervalSeconds(false) == .5);
    assert(ProductionIntervalSeconds(true) == 5.0);
    assert(CanProduce(Activity::Work, false, true));
    assert(!CanProduce(Activity::Work, false, false));
    assert(CanProduce(Activity::Work, true, false));
    assert(!CanProduce(Activity::Hunger, true, true));
    assert(!CanProduce(Activity::Rest, true, true));
    assert(!CanProduce(Activity::Combat, true, true));
    const double online = IntegrateProduction(0, 2.5, ProductionIntervalSeconds(false));
    const double offline = IntegrateProduction(online, 2.5, ProductionIntervalSeconds(true));
    assert(offline == IntegrateProduction(0, 2.5, 5.5));
    double switched = 0;
    switched = IntegrateProduction(switched, 2.5, .5); // flush active interval
    switched = IntegrateProduction(switched, 2.5, 5.0); // one abstract interval
    switched = IntegrateProduction(switched, 2.5, .5); // return to active
    assert(switched == IntegrateProduction(0, 2.5, 6.0));
}
