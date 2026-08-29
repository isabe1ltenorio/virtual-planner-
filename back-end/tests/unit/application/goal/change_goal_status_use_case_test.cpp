#include "virtual_planner/application/goal/change_goal_status_use_case.hpp"
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
            "Finish Planner",
            domain::Category::Study,
            domain::GoalStatus::InProgress,
            domain::GoalPeriod::Weekly,
            domain::Date(10, 8, 2026)),
        kAlice);

    application::ChangeGoalStatusUseCase use_case(repository);

    application::ChangeGoalStatusRequest request{
        alice_goal,
        domain::GoalStatus::Completed
    };

    use_case.execute(request, kAlice);

    auto goal = repository.find_by_id(alice_goal, kAlice);

    VP_EXPECT(goal.has_value(), "goal must exist after status change");

    VP_EXPECT(goal->status() ==
                  domain::GoalStatus::Completed,
              "goal status should be updated to Completed");

    const auto throws_not_found =
        [&use_case](const application::ChangeGoalStatusRequest& attempt,
                    std::uint64_t user_id) {
            try
            {
                use_case.execute(attempt, user_id);
                return false;
            }
            catch (const shared::NotFoundError&)
            {
                return true;
            }
        };

    application::ChangeGoalStatusRequest missing_request{
        999,
        domain::GoalStatus::Completed
    };

    VP_EXPECT(
        throws_not_found(missing_request, kAlice),
        "changing status of a missing goal should throw NotFoundError");

    // Status e escrita como qualquer outra: o dono errado nao muda nada.
    application::ChangeGoalStatusRequest hijack_request{
        alice_goal,
        domain::GoalStatus::Failed
    };

    VP_EXPECT(
        throws_not_found(hijack_request, kBob),
        "changing another user's goal status should throw NotFoundError");

    auto untouched = repository.find_by_id(alice_goal, kAlice);

    VP_EXPECT(
        untouched.has_value() &&
            untouched->status() == domain::GoalStatus::Completed,
        "a refused status change must not alter the goal");

    return 0;
}
