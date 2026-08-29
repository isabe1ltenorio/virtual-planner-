#include "virtual_planner/application/task/update_task_use_case.hpp"

#include <chrono>

#include "support/expect.hpp"

#include <cstdint>
#include "virtual_planner/persistence/memory/in_memory_task_repository.hpp"
#include "virtual_planner/shared/errors.hpp"

using namespace virtual_planner;

// Dono usado por todo o arquivo: o contrato do repositorio exige um, e
// nao ha valor que signifique "qualquer um".
constexpr std::uint64_t kOwner = 1;

namespace {

domain::Task seed_task()
{
    return domain::Task{
        1,
        "Study paradigms",
        domain::Category::Study,
        domain::Date{15, 8, 2026},
        domain::TimeSlot{std::chrono::hours{9}, std::chrono::hours{10}},
        domain::Priority::Medium,
        domain::TaskStatus::Pending};
}

} // namespace

int main()
{
    persistence::InMemoryTaskRepository repository;
    repository.save(seed_task(), kOwner);

    application::UpdateTaskUseCase update(repository);

    update.execute(application::UpdateTaskRequest{
        1,
        "Study distributed systems",
        domain::Category::Work,
        domain::Date{1, 1, 2027},
        domain::TimeSlot{std::chrono::hours{14}, std::chrono::hours{16}},
        domain::Priority::High}, kOwner);

    auto stored = repository.find_by_id(1, kOwner);

    VP_EXPECT(stored.has_value(), "task must still exist after update");
    VP_EXPECT(stored->description() == "Study distributed systems",
              "update should replace the description");
    VP_EXPECT(stored->category() == domain::Category::Work,
              "update should replace the category");
    VP_EXPECT(stored->date() == domain::Date(1, 1, 2027),
              "update should replace the date");
    VP_EXPECT(stored->time_slot().start() == std::chrono::hours{14},
              "update should replace the time slot start");
    VP_EXPECT(stored->time_slot().end() == std::chrono::hours{16},
              "update should replace the time slot end");
    VP_EXPECT(stored->priority() == domain::Priority::High,
              "update should replace the priority");
    VP_EXPECT(stored->status() == domain::TaskStatus::Pending,
              "update should not touch the status");
    VP_EXPECT(repository.find_all(kOwner).size() == 1,
              "update must not create a second row");

    bool not_found_thrown = false;

    try
    {
        update.execute(application::UpdateTaskRequest{
            999,
            "Ghost",
            domain::Category::Work,
            domain::Date{1, 1, 2027},
            domain::TimeSlot{std::chrono::hours{8}, std::chrono::hours{9}},
            domain::Priority::Low}, kOwner);
    }
    catch (const shared::NotFoundError&)
    {
        not_found_thrown = true;
    }

    VP_EXPECT(not_found_thrown,
              "updating a missing task should throw NotFoundError");

    return 0;
}
