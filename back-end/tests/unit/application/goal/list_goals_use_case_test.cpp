#include "virtual_planner/application/goal/list_goals_use_case.hpp"
#include <cstdint>
#include <stdexcept>
#include "support/expect.hpp"
#include "virtual_planner/persistence/memory/in_memory_goal_repository.hpp"

using namespace virtual_planner;

int main()
{
    constexpr std::uint64_t kAlice = 1;
    constexpr std::uint64_t kBob = 2;

    persistence::InMemoryGoalRepository repository;

    repository.save(
        domain::Goal(
            1,
            "Study C++",
            domain::Category::Study,
            domain::GoalStatus::InProgress,
            domain::GoalPeriod::Weekly,
            domain::Date(5, 8, 2026)),
        kAlice);

    repository.save(
        domain::Goal(
            2,
            "Finish Planner",
            domain::Category::Work,
            domain::GoalStatus::InProgress,
            domain::GoalPeriod::Monthly,
            domain::Date(20, 8, 2026)),
        kAlice);

    application::ListGoalsUseCase use_case(repository);

    auto goals = use_case.execute(
        domain::Date(1, 8, 2026),
        domain::Date(10, 8, 2026),
        kAlice);

    VP_EXPECT(
        goals.size() == 1,
        "should return only goals inside the requested period");

    VP_EXPECT(
        goals.front().description() == "Study C++",
        "should return the goal inside the requested period");

    goals = use_case.execute(
        domain::Date(15, 8, 2026),
        domain::Date(25, 8, 2026),
        kAlice);

    VP_EXPECT(
        goals.size() == 1,
        "should return goals inside the second requested period");

    VP_EXPECT(
        goals.front().description() == "Finish Planner",
        "should return the goal inside the second requested period");

    goals = use_case.execute(
        domain::Date(5, 8, 2026),
        domain::Date(5, 8, 2026),
        kAlice);

    VP_EXPECT(
        goals.size() == 1,
        "should include goals on the exact date boundaries");

    VP_EXPECT(
        goals.front().description() == "Study C++",
        "should include a goal whose reference date equals the boundaries");

    goals = use_case.execute(
        domain::Date(1, 9, 2026),
        domain::Date(10, 9, 2026),
        kAlice);

    VP_EXPECT(
        goals.empty(),
        "should return an empty list when no goals are inside the period");

    // Arrange
    bool rejected_inverted_range = false;

    // Act
    try
    {
        const auto unexpected_goals = use_case.execute(
            domain::Date(11, 9, 2026),
            domain::Date(10, 9, 2026),
        kAlice);
        static_cast<void>(unexpected_goals);
    }
    catch (const std::invalid_argument&)
    {
        rejected_inverted_range = true;
    }

    // Assert
    VP_EXPECT(
        rejected_inverted_range,
        "should reject an inverted goal date range");

    // Isolamento: a mesma janela, pedida por outra pessoa, nao devolve nada.
    const auto bob_goals = use_case.execute(
        domain::Date(1, 8, 2026),
        domain::Date(31, 8, 2026),
        kBob);

    VP_EXPECT(
        bob_goals.empty(),
        "another user's goals must not appear in the listing");

    return 0;
}
