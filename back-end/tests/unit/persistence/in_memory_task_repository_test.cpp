#include "virtual_planner/persistence/memory/in_memory_task_repository.hpp"

#include "support/expect.hpp"

#include <chrono>

using namespace virtual_planner;

namespace {

domain::Task make_task(const char* description,
                       domain::Category category,
                       domain::TimeSlot slot,
                       domain::Priority priority,
                       domain::TaskStatus status)
{
    // O id passado e irrelevante: InMemoryTaskRepository::save gera o seu.
    return domain::Task{
        0, description, category, domain::Date{15, 8, 2026}, slot, priority,
        status};
}

} // namespace

int main()
{
    constexpr std::uint64_t kAlice = 1;
    constexpr std::uint64_t kBob = 2;

    persistence::InMemoryTaskRepository repository;

    const domain::TimeSlot morning{
        std::chrono::hours{9}, std::chrono::hours{10}};
    const domain::TimeSlot afternoon{
        std::chrono::hours{14}, std::chrono::hours{15}};

    VP_EXPECT(repository.find_all(kAlice).empty(), "repository should start empty");
    VP_EXPECT(!repository.find_by_id(1, kAlice).has_value(),
              "find_by_id should return nullopt when empty");

    // --- save gera e devolve o id, ignorando o id da entidade --------------
    const auto first_id = repository.save(make_task(
        "Write the report", domain::Category::Work, morning,
        domain::Priority::High, domain::TaskStatus::Pending), kAlice);

    VP_EXPECT(first_id == 1, "the first generated id should be 1");
    VP_EXPECT(repository.find_all(kAlice).size() == 1,
              "repository should hold one task after save");

    const auto stored = repository.find_by_id(first_id, kAlice);

    VP_EXPECT(stored.has_value(),
              "saved task should be retrievable by its generated id");
    VP_EXPECT(stored->id() == first_id,
              "stored task should carry the generated id");
    VP_EXPECT(stored->description() == "Write the report",
              "description should round-trip");
    VP_EXPECT(stored->category() == domain::Category::Work,
              "category should round-trip");
    VP_EXPECT(stored->priority() == domain::Priority::High,
              "priority should round-trip");
    VP_EXPECT(stored->status() == domain::TaskStatus::Pending,
              "status should round-trip");
    VP_EXPECT(stored->time_slot().start() == std::chrono::hours{9},
              "time slot should round-trip");

    const auto second_id = repository.save(make_task(
        "Review the pull request", domain::Category::College, afternoon,
        domain::Priority::Medium, domain::TaskStatus::Pending), kAlice);

    VP_EXPECT(second_id == 2, "the second generated id should be 2");
    VP_EXPECT(repository.find_all(kAlice).size() == 2,
              "repository should hold two tasks");

    // --- update sobrescreve a task de mesmo id, sem inserir ---------------
    const domain::Task first_edited{
        first_id,
        "Write the final report",
        domain::Category::Work,
        domain::Date{15, 8, 2026},
        afternoon,
        domain::Priority::Low,
        domain::TaskStatus::Executed};

    repository.update(first_edited, kAlice);

    VP_EXPECT(repository.find_all(kAlice).size() == 2, "update must not append a row");

    const auto after_update = repository.find_by_id(first_id, kAlice);

    VP_EXPECT(after_update.has_value(), "updated task should still exist");
    VP_EXPECT(after_update->description() == "Write the final report",
              "update should replace the description");
    VP_EXPECT(after_update->priority() == domain::Priority::Low,
              "update should replace the priority");
    VP_EXPECT(after_update->status() == domain::TaskStatus::Executed,
              "update should replace the status");
    VP_EXPECT(
        repository.find_by_id(second_id, kAlice)->description() ==
            "Review the pull request",
        "update must not touch other tasks");

    // --- update de id inexistente e um no-op silencioso -----------------
    repository.update(domain::Task{
        999, "ghost", domain::Category::Work, domain::Date{1, 1, 2027}, morning,
        domain::Priority::Low, domain::TaskStatus::Pending}, kAlice);

    VP_EXPECT(repository.find_all(kAlice).size() == 2,
              "update of an unknown id must be a no-op");
    VP_EXPECT(!repository.find_by_id(999, kAlice).has_value(),
              "update must not create a row");

    // --- remove --------------------------------------------------------
    repository.remove(first_id, kAlice);

    VP_EXPECT(repository.find_all(kAlice).size() == 1,
              "remove should drop exactly one task");
    VP_EXPECT(!repository.find_by_id(first_id, kAlice).has_value(),
              "removed task should no longer be retrievable");
    VP_EXPECT(repository.find_by_id(second_id, kAlice).has_value(),
              "remove must not touch other tasks");

    repository.remove(4242, kAlice);

    VP_EXPECT(repository.find_all(kAlice).size() == 1,
              "remove of an unknown id must be a no-op");

    // --- o id continua avancando mesmo apos remocoes ------------------
    const auto third_id = repository.save(make_task(
        "Plan next sprint", domain::Category::Work, morning,
        domain::Priority::Medium, domain::TaskStatus::Pending), kAlice);

    VP_EXPECT(third_id == 3, "generated ids are monotonic across removals");

    // --- Isolamento entre donos ---------------------------------------------
    //
    // A garantia mora no repositorio, e nao no handler: quem chamar com o dono
    // errado nao le, nao altera e nao apaga.
    VP_EXPECT(repository.find_all(kBob).empty(),
              "another owner should see none of these tasks");
    VP_EXPECT(!repository.find_by_id(second_id, kBob).has_value(),
              "find_by_id with the wrong owner must not find the task");

    repository.remove(second_id, kBob);

    VP_EXPECT(repository.find_by_id(second_id, kAlice).has_value(),
              "a remove from the wrong owner must be a no-op");

    return 0;
}
