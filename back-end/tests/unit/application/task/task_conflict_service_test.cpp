#include "virtual_planner/application/task/task_conflict_service.hpp"

#include <chrono>
#include <cstdint>
#include <string>

#include "support/expect.hpp"
#include "virtual_planner/persistence/memory/in_memory_task_repository.hpp"

using namespace virtual_planner;
using Minutes = domain::TimeSlot::Minutes;

namespace {

domain::Task task(std::uint64_t id,
                  domain::Date date,
                  Minutes start,
                  Minutes end,
                  domain::TaskStatus status = domain::TaskStatus::Pending)
{
    return domain::Task{
        id,
        "Task " + std::to_string(id),
        domain::Category::Work,
        date,
        domain::TimeSlot{start, end},
        domain::Priority::Medium,
        status};
}

} // namespace

int main()
{
    const domain::Date day{15, 8, 2026};
    const domain::Date other_day{16, 8, 2026};

    // --- Sobreposicao parcial: [9,11) x [10,12) -----------------------------
    {
        persistence::InMemoryTaskRepository repo;
        repo.save(task(1, day, std::chrono::hours{9}, std::chrono::hours{11}));
        repo.save(task(2, day, std::chrono::hours{10}, std::chrono::hours{12}));

        application::TaskConflictService service(repo);
        const auto conflicts = service.conflicts_on(day);

        VP_EXPECT(conflicts.size() == 1,
                  "partial overlap should produce exactly one conflict");
        VP_EXPECT(conflicts.front().first.id() == 1 &&
                      conflicts.front().second.id() == 2,
                  "the conflict should carry both tasks in repository order");
    }

    // --- Sobreposicao total: [9,12) contem [10,11) ------------------------
    {
        persistence::InMemoryTaskRepository repo;
        repo.save(task(1, day, std::chrono::hours{9}, std::chrono::hours{12}));
        repo.save(task(2, day, std::chrono::hours{10}, std::chrono::hours{11}));

        application::TaskConflictService service(repo);

        VP_EXPECT(service.conflicts_on(day).size() == 1,
                  "a slot fully containing another should conflict");
    }

    // --- Adjacente: [9,10) x [10,11) -> sem conflito ----------------------
    {
        persistence::InMemoryTaskRepository repo;
        repo.save(task(1, day, std::chrono::hours{9}, std::chrono::hours{10}));
        repo.save(task(2, day, std::chrono::hours{10}, std::chrono::hours{11}));

        application::TaskConflictService service(repo);

        VP_EXPECT(service.conflicts_on(day).empty(),
                  "adjacent slots must not be reported as a conflict");
    }

    // --- Ausente: [9,10) x [13,14) -> sem conflito ----------------------
    {
        persistence::InMemoryTaskRepository repo;
        repo.save(task(1, day, std::chrono::hours{9}, std::chrono::hours{10}));
        repo.save(task(2, day, std::chrono::hours{13}, std::chrono::hours{14}));

        application::TaskConflictService service(repo);

        VP_EXPECT(service.conflicts_on(day).empty(),
                  "disjoint slots must not be reported as a conflict");
    }

    // --- Datas diferentes nunca se comparam ------------------------------
    {
        persistence::InMemoryTaskRepository repo;
        repo.save(task(1, day, std::chrono::hours{9}, std::chrono::hours{11}));
        repo.save(
            task(2, other_day, std::chrono::hours{10}, std::chrono::hours{12}));

        application::TaskConflictService service(repo);

        VP_EXPECT(service.conflicts_on(day).empty(),
                  "tasks on different dates should never conflict");
    }

    // --- Cancelled e Postponed sao ignorados ----------------------------
    {
        persistence::InMemoryTaskRepository repo;
        repo.save(task(1, day, std::chrono::hours{9}, std::chrono::hours{11}));
        repo.save(task(2, day, std::chrono::hours{10}, std::chrono::hours{12},
                       domain::TaskStatus::Cancelled));
        repo.save(task(3, day, std::chrono::hours{10}, std::chrono::hours{12},
                       domain::TaskStatus::Postponed));

        application::TaskConflictService service(repo);

        VP_EXPECT(service.conflicts_on(day).empty(),
                  "cancelled and postponed tasks should not raise conflicts");
    }

    // --- Tres tarefas mutuamente sobrepostas -> tres pares ---------------
    {
        persistence::InMemoryTaskRepository repo;
        repo.save(task(1, day, std::chrono::hours{9}, std::chrono::hours{12}));
        repo.save(task(2, day, std::chrono::hours{10}, std::chrono::hours{13}));
        repo.save(task(3, day, std::chrono::hours{11}, std::chrono::hours{14}));

        application::TaskConflictService service(repo);

        VP_EXPECT(service.conflicts_on(day).size() == 3,
                  "three mutually overlapping tasks should yield three pairs");
    }

    return 0;
}
