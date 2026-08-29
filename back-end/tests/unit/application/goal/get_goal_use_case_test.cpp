#include "virtual_planner/application/goal/get_goal_use_case.hpp"

#include "support/expect.hpp"
#include "virtual_planner/persistence/memory/in_memory_goal_repository.hpp"
#include "virtual_planner/shared/errors.hpp"

using namespace virtual_planner;

namespace {

constexpr std::uint64_t kAlice = 1;
constexpr std::uint64_t kBob = 2;

domain::Goal make_goal(std::uint64_t id, std::string description)
{
    return domain::Goal(
        id,
        std::move(description),
        domain::Category::Study,
        domain::GoalStatus::InProgress,
        domain::GoalPeriod::Weekly,
        domain::Date(10, 8, 2026));
}

bool throws_not_found(const application::GetGoalUseCase& use_case,
                      std::uint64_t id,
                      std::uint64_t user_id)
{
    try
    {
        static_cast<void>(use_case.execute(id, user_id));
        return false;
    }
    catch (const shared::NotFoundError&)
    {
        return true;
    }
}

} // namespace

int main()
{
    persistence::InMemoryGoalRepository repository;

    const std::uint64_t alice_goal =
        repository.save(make_goal(0, "Study C++"), kAlice);

    application::GetGoalUseCase use_case(repository);

    const auto goal = use_case.execute(alice_goal, kAlice);

    VP_EXPECT(
        goal.id() == alice_goal,
        "should return the requested goal");

    VP_EXPECT(
        goal.description() == "Study C++",
        "should return the requested goal data");

    VP_EXPECT(
        throws_not_found(use_case, 999, kAlice),
        "getting a missing goal should throw NotFoundError");

    // O ponto da issue #112: o id existe, mas nao e de quem pede. A resposta
    // tem de ser indistinguivel de "nao existe" — um 404 diferente de um 403
    // ja confirmaria ao chamador que aquele id esta em uso por outra pessoa.
    VP_EXPECT(
        throws_not_found(use_case, alice_goal, kBob),
        "another user's goal should be indistinguishable from a missing one");

    return 0;
}
