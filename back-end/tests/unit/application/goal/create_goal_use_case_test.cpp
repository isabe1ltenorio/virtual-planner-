#include "virtual_planner/application/goal/create_goal_use_case.hpp"
#include "support/expect.hpp"
#include "virtual_planner/persistence/memory/in_memory_goal_repository.hpp"

#include <cstdint>

using namespace virtual_planner;

int main()
{
    constexpr std::uint64_t kAlice = 1;
    constexpr std::uint64_t kBob = 2;

    persistence::InMemoryGoalRepository repository;

    application::CreateGoalUseCase create(repository);

    application::CreateGoalRequest request{
        "Finish Paradigms project",
        domain::Category::Study,
        domain::GoalPeriod::Weekly,
        domain::Date(10, 8, 2026)};

    const auto id = create.execute(request, kAlice);

    VP_EXPECT(id != 0, "created goal id should be non-zero");

    auto goals = repository.find_all(kAlice);

    VP_EXPECT(goals.size() == 1, "repository should contain exactly one goal after creation");

    VP_EXPECT(goals.front().description() ==
                  "Finish Paradigms project",
              "created goal should keep the requested description");

    VP_EXPECT(goals.front().reference_date() == domain::Date(10, 8, 2026),
              "created goal should keep the requested reference date");

    // A meta nasce com dono: quem criou a ve, e mais ninguem.
    VP_EXPECT(repository.find_all(kBob).empty(),
              "a goal created by one user must not appear for another");

    return 0;
}
