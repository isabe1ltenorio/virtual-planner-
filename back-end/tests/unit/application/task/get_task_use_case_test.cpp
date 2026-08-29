#include "virtual_planner/application/task/get_task_use_case.hpp"

#include <chrono>

#include "support/expect.hpp"
#include "virtual_planner/persistence/memory/in_memory_task_repository.hpp"
#include "virtual_planner/shared/errors.hpp"

using namespace virtual_planner;

int main()
{
    persistence::InMemoryTaskRepository repository;

    const auto id = repository.save(domain::Task{
        0,
        "Study paradigms",
        domain::Category::Study,
        domain::Date{15, 8, 2026},
        domain::TimeSlot{std::chrono::hours{9}, std::chrono::hours{10}},
        domain::Priority::Medium,
        domain::TaskStatus::Pending});

    application::GetTaskUseCase get(repository);

    const domain::Task task = get.execute(id);

    VP_EXPECT(task.id() == id, "get should return the task with the requested id");
    VP_EXPECT(task.description() == "Study paradigms",
              "get should return the stored description");

    bool not_found_thrown = false;

    try
    {
        static_cast<void>(get.execute(999));
    }
    catch (const shared::NotFoundError&)
    {
        not_found_thrown = true;
    }

    VP_EXPECT(not_found_thrown,
              "getting a missing task should throw NotFoundError");

    return 0;
}
