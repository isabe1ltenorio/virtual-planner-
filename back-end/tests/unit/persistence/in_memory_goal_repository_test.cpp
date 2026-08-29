#include "virtual_planner/persistence/memory/in_memory_goal_repository.hpp"

#include "support/expect.hpp"

#include <cstdint>

using namespace virtual_planner;

int main()
{
    constexpr std::uint64_t kAlice = 1;
    constexpr std::uint64_t kBob = 2;

    persistence::InMemoryGoalRepository repository;

    VP_EXPECT(repository.find_all(kAlice).empty(), "repository should start empty");
    VP_EXPECT(!repository.find_by_id(1, kAlice).has_value(), "find_by_id should return nullopt when empty");

    const domain::Goal first{
        0,
        "Finish Paradigms project",
        domain::Category::Study,
        domain::GoalStatus::InProgress,
        domain::GoalPeriod::Weekly,
        domain::Date(10, 8, 2026)};

    const auto first_id = repository.save(first, kAlice);

    VP_EXPECT(first_id != 0, "save should assign a non-zero id");
    VP_EXPECT(repository.find_all(kAlice).size() == 1, "repository should hold one goal after save");

    const auto stored = repository.find_by_id(first_id, kAlice);

    VP_EXPECT(stored.has_value(), "saved goal should be retrievable by its assigned id");
    VP_EXPECT(stored->id() == first_id, "stored goal should carry the assigned id, not the input id");
    VP_EXPECT(stored->description() == "Finish Paradigms project", "description should round-trip");
    VP_EXPECT(stored->category() == domain::Category::Study, "category should round-trip");
    VP_EXPECT(stored->status() == domain::GoalStatus::InProgress, "status should round-trip");
    VP_EXPECT(stored->period() == domain::GoalPeriod::Weekly, "period should round-trip");
    VP_EXPECT(stored->reference_date() == domain::Date(10, 8, 2026), "reference date should round-trip");

    const domain::Goal second{
        0,
        "Run three times a week",
        domain::Category::Health,
        domain::GoalStatus::InProgress,
        domain::GoalPeriod::Weekly,
        domain::Date(15, 8, 2026)};

    const auto second_id = repository.save(second, kAlice);

    VP_EXPECT(second_id != first_id, "each save should assign a distinct id");
    VP_EXPECT(repository.find_all(kAlice).size() == 2, "repository should hold two goals");

    const domain::Goal edited{
        first_id,
        "Finish Paradigms project early",
        domain::Category::Study,
        domain::GoalStatus::Completed,
        domain::GoalPeriod::Monthly,
        domain::Date(20, 8, 2026)};

    repository.update(edited, kAlice);

    const auto after_update = repository.find_by_id(first_id, kAlice);

    VP_EXPECT(after_update.has_value(), "goal should still exist after update");
    VP_EXPECT(after_update->description() == "Finish Paradigms project early", "update should replace the description");
    VP_EXPECT(after_update->status() == domain::GoalStatus::Completed, "update should replace the status");
    VP_EXPECT(after_update->period() == domain::GoalPeriod::Monthly, "update should replace the period");
    VP_EXPECT(repository.find_all(kAlice).size() == 2, "update must not insert a new goal");
    VP_EXPECT(after_update->reference_date() == domain::Date(20, 8, 2026), "update should replace the reference date");

    const domain::Goal unknown{
        9999,
        "Ghost goal",
        domain::Category::Work,
        domain::GoalStatus::InProgress,
        domain::GoalPeriod::Yearly,
        domain::Date(25, 8, 2026)};

    repository.update(unknown, kAlice);

    VP_EXPECT(repository.find_all(kAlice).size() == 2, "update of an unknown id must be a no-op");
    VP_EXPECT(!repository.find_by_id(9999, kAlice).has_value(), "update must not create a goal that did not exist");

    repository.remove(first_id, kAlice);

    VP_EXPECT(repository.find_all(kAlice).size() == 1, "remove should drop exactly one goal");
    VP_EXPECT(!repository.find_by_id(first_id, kAlice).has_value(), "removed goal should no longer be retrievable");
    VP_EXPECT(repository.find_by_id(second_id, kAlice).has_value(), "remove must not touch other goals");

    repository.remove(4242, kAlice);

    VP_EXPECT(repository.find_all(kAlice).size() == 1, "remove of an unknown id must be a no-op");

    // --- Isolamento entre donos (issue #112) --------------------------------
    //
    // A garantia mora aqui, e nao no handler: quem chamar com o dono errado nao
    // le, nao altera e nao apaga. Uma rota nova nao consegue esquecer de
    // verificar, porque nem compila sem passar o dono.
    VP_EXPECT(repository.find_all(kBob).empty(),
              "another owner should see none of these goals");
    VP_EXPECT(!repository.find_by_id(second_id, kBob).has_value(),
              "find_by_id with the wrong owner must not find the goal");

    const domain::Goal hijack{
        second_id,
        "Hijacked",
        domain::Category::Work,
        domain::GoalStatus::Failed,
        domain::GoalPeriod::Yearly,
        domain::Date(1, 1, 2027)};

    repository.update(hijack, kBob);

    const auto after_hijack = repository.find_by_id(second_id, kAlice);
    VP_EXPECT(after_hijack.has_value(),
              "an update from the wrong owner must not remove the goal");
    VP_EXPECT(after_hijack->description() != "Hijacked",
              "an update from the wrong owner must not change the goal");

    repository.remove(second_id, kBob);

    VP_EXPECT(repository.find_by_id(second_id, kAlice).has_value(),
              "a remove from the wrong owner must be a no-op");

    // E o dono certo continua enxergando o seu.
    VP_EXPECT(repository.find_all(kAlice).size() == 1,
              "the real owner should still see their goal");

    return 0;
}
