#include "virtual_planner/application/goal/delete_goal_use_case.hpp"

#include "support/expect.hpp"
#include "virtual_planner/persistence/memory/in_memory_goal_repository.hpp"
#include "virtual_planner/shared/errors.hpp"

#include <cstdint>
#include <string>
#include <utility>

using namespace virtual_planner;

int main()
{
    constexpr std::uint64_t kAlice = 1;
    constexpr std::uint64_t kBob = 2;

    persistence::InMemoryGoalRepository repository;

    const auto make_goal = [](std::string description) {
        return domain::Goal(
            0,
            std::move(description),
            domain::Category::Study,
            domain::GoalStatus::InProgress,
            domain::GoalPeriod::Weekly,
            domain::Date(10, 8, 2026));
    };

    const std::uint64_t alice_goal =
        repository.save(make_goal("Study C++"), kAlice);

    application::DeleteGoalUseCase remove(repository);

    const auto throws_not_found = [&remove](std::uint64_t id,
                                            std::uint64_t user_id) {
        try
        {
            remove.execute(id, user_id);
            return false;
        }
        catch (const shared::NotFoundError&)
        {
            return true;
        }
    };

    // O dono errado nao apaga, e nem descobre que o objeto existe.
    VP_EXPECT(
        throws_not_found(alice_goal, kBob),
        "deleting another user's goal should throw NotFoundError");

    VP_EXPECT(
        repository.find_all(kAlice).size() == 1,
        "a refused delete must leave the goal untouched");

    remove.execute(alice_goal, kAlice);

    VP_EXPECT(repository.find_all(kAlice).empty(),
              "repository should be empty after deleting the only goal");

    VP_EXPECT(
        throws_not_found(999, kAlice),
        "deleting a missing goal should throw NotFoundError");

    return 0;
}
