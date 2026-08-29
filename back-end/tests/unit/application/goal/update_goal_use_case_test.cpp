#include "virtual_planner/application/goal/update_goal_use_case.hpp"

#include "support/expect.hpp"
#include "virtual_planner/persistence/memory/in_memory_goal_repository.hpp"
#include "virtual_planner/shared/errors.hpp"

#include <cstdint>

using namespace virtual_planner;

int main()
{
    constexpr std::uint64_t kAlice = 1;
    constexpr std::uint64_t kBob = 2;

    persistence::InMemoryGoalRepository repository;

    const std::uint64_t alice_goal = repository.save(
        domain::Goal(
            0,
            "Old",
            domain::Category::Study,
            domain::GoalStatus::InProgress,
            domain::GoalPeriod::Weekly,
            domain::Date(10, 8, 2026)),
        kAlice);

    application::UpdateGoalUseCase update(repository);

    application::UpdateGoalRequest request{
        alice_goal,
        "New Description",
        domain::Category::Work,
        domain::GoalPeriod::Monthly,
        domain::Date(20, 8, 2026)
    };

    update.execute(request, kAlice);

    auto goal = repository.find_by_id(alice_goal, kAlice);

    VP_EXPECT(
        goal.has_value(),
        "goal must exist after update");

    VP_EXPECT(
        goal->description() == "New Description",
        "updated goal should have the new description");

    VP_EXPECT(
        goal->category() == domain::Category::Work,
        "updated goal should have the new category");

    VP_EXPECT(
        goal->period() == domain::GoalPeriod::Monthly,
        "updated goal should have the new period");

    VP_EXPECT(
        goal->reference_date() == domain::Date(20, 8, 2026),
        "updated goal should have the new reference date");

    const auto throws_not_found =
        [&update](const application::UpdateGoalRequest& attempt,
                  std::uint64_t user_id) {
            try
            {
                update.execute(attempt, user_id);
                return false;
            }
            catch (const shared::NotFoundError&)
            {
                return true;
            }
        };

    application::UpdateGoalRequest missing_request{
        999,
        "Missing",
        domain::Category::Study,
        domain::GoalPeriod::Weekly,
        domain::Date(20, 8, 2026)
    };

    VP_EXPECT(
        throws_not_found(missing_request, kAlice),
        "updating a missing goal should throw NotFoundError");

    // Mesmo id, dono errado: a atualizacao e recusada e o dado nao muda.
    application::UpdateGoalRequest hijack_request{
        alice_goal,
        "Hijacked",
        domain::Category::Health,
        domain::GoalPeriod::Yearly,
        domain::Date(1, 1, 2027)
    };

    VP_EXPECT(
        throws_not_found(hijack_request, kBob),
        "updating another user's goal should throw NotFoundError");

    auto untouched = repository.find_by_id(alice_goal, kAlice);

    VP_EXPECT(
        untouched.has_value() && untouched->description() == "New Description",
        "a refused update must not change the goal");

    return 0;
}
