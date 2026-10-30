#pragma once

#include <algorithm>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <span>
#include <limits>

namespace PalRules {
inline constexpr std::size_t PartyCapacity = 5;

inline double CaptureChance(double spherePower, double currentHP, double maxHP,
                            double statusBonus, double rarityFactor) noexcept {
    if (!std::isfinite(spherePower) || !std::isfinite(currentHP) ||
        !std::isfinite(maxHP) || !std::isfinite(statusBonus) ||
        !std::isfinite(rarityFactor) || maxHP <= 0 || rarityFactor <= 0) return 0;
    const double hpFraction = std::clamp(currentHP / maxHP, 0.0, 1.0);
    const double raw = (spherePower * (1.0 - hpFraction) * statusBonus) / rarityFactor;
    if (std::isnan(raw)) return 0;
    return std::clamp(raw, 0.01, 1.0);
}

inline bool HasPartySpace(std::size_t count) noexcept { return count < PartyCapacity; }

struct Needs { double hunger; double san; };
inline Needs AdvanceNeeds(Needs current, double seconds, bool feeding, bool resting) noexcept {
    if (!std::isfinite(current.hunger) || !std::isfinite(current.san) ||
        !std::isfinite(seconds) || seconds < 0) return current;
    const double hungerRate = feeding ? 25.0 : -0.02;
    const double sanRate = resting ? 4.0 : -0.01;
    return {std::clamp(current.hunger + hungerRate * seconds, 0.0, 100.0),
            std::clamp(current.san + sanRate * seconds, 0.0, 100.0)};
}
inline bool CanReserveService(int capacity, int reserved, int food, bool needsFood) noexcept {
    return capacity > 0 && reserved >= 0 && reserved < capacity && (!needsFood || food > 0);
}
inline bool ShouldAbstract(double nearestPlayerDistanceCm, bool currentlyAbstract,
                           double radiusCm = 20000.0, double hysteresisCm = 500.0) noexcept {
    if (std::isnan(nearestPlayerDistanceCm) || !std::isfinite(radiusCm) ||
        !std::isfinite(hysteresisCm) || radiusCm <= 0 || hysteresisCm < 0)
        return currentlyAbstract;
    return nearestPlayerDistanceCm > radiusCm + (currentlyAbstract ? 0.0 : hysteresisCm);
}

enum class Activity : std::uint8_t { Hunger, Rest, Combat, Work, Idle };
inline Activity ChooseActivity(double hungerFraction, double sanFraction, bool night,
                               bool enemyPresent, bool taskPresent) noexcept {
    if (std::isfinite(hungerFraction) && hungerFraction < 0.20) return Activity::Hunger;
    if (night || (std::isfinite(sanFraction) && sanFraction < 0.15)) return Activity::Rest;
    if (enemyPresent) return Activity::Combat;
    return taskPresent ? Activity::Work : Activity::Idle;
}

struct TaskCandidate {
    std::uint64_t id;
    int priority;
    int requiredLevel;
    int suitabilityLevel;
    double distanceSquared;
    bool assigned;
};
inline std::uint64_t SelectTask(std::span<const TaskCandidate> tasks) noexcept {
    const TaskCandidate* best = nullptr;
    for (const auto& task : tasks) {
        if (task.id == 0 || task.assigned || task.requiredLevel < 1 ||
            task.requiredLevel > 4 || task.suitabilityLevel < task.requiredLevel ||
            task.suitabilityLevel > 4 || !std::isfinite(task.distanceSquared) ||
            task.distanceSquared < 0) continue;
        if (!best || task.priority > best->priority ||
            (task.priority == best->priority && task.distanceSquared < best->distanceSquared) ||
            (task.priority == best->priority && task.distanceSquared == best->distanceSquared && task.id < best->id))
            best = &task;
    }
    return best ? best->id : 0;
}

inline bool CanProduce(Activity desired, bool abstractMode, bool atStation) noexcept {
    return desired == Activity::Work && (abstractMode || atStation);
}
inline double ProductionIntervalSeconds(bool abstractMode) noexcept { return abstractMode ? 5.0 : 0.5; }

inline double IntegrateProduction(double accumulated, double ratePerSecond,
                                  double elapsedSeconds) noexcept {
    if (!std::isfinite(accumulated) || !std::isfinite(ratePerSecond) ||
        !std::isfinite(elapsedSeconds) || ratePerSecond < 0 || elapsedSeconds < 0)
        return accumulated;
    const double result = accumulated + ratePerSecond * elapsedSeconds;
    return std::isfinite(result) ? result : accumulated;
}
}
