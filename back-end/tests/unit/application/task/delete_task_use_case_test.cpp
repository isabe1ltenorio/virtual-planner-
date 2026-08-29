#include "virtual_planner/application/task/delete_task_use_case.hpp"

#include <chrono>

#include "support/expect.hpp"

#include <cstdint>
#include "virtual_planner/persistence/memory/in_memory_task_repository.hpp"
#include "virtual_planner/shared/errors.hpp"

using namespace virtual_planner;

// Dono usado por todo o arquivo: o contrato do repositorio exige um, e
// nao ha valor que signifique "qualquer um".
constexpr std::uint64_t kOwner = 1;

int main()
{
    persistence::InMemoryTaskRepository repository;

    repository.save(domain::Task{
        1,
        "Study paradigms",
        domain::Category::Study,
        domain::Date{15, 8, 2026},
        domain::TimeSlot{std::chrono::hours{9}, std::chrono::hours{10}},
        domain::Priority::Medium,
        domain::TaskStatus::Pending}, kOwner);

    application::DeleteTaskUseCase remove(repository);

    remove.execute(1, kOwner);

    VP_EXPECT(repository.find_all(kOwner).empty(),
              "repository should be empty after deleting the only task");

    bool not_found_thrown = false;

    try
    {
        remove.execute(999, kOwner);
    }
    catch (const shared::NotFoundError&)
    {
        not_found_thrown = true;
    }

    VP_EXPECT(not_found_thrown,
              "deleting a missing task should throw NotFoundError");

    return 0;
}
