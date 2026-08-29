#include "virtual_planner/application/task/create_task_use_case.hpp"

#include <chrono>

#include "support/expect.hpp"
#include "virtual_planner/persistence/memory/in_memory_task_repository.hpp"

using namespace virtual_planner;

namespace {

application::CreateTaskRequest make_request()
{
    return application::CreateTaskRequest{
        "Study paradigms",
        domain::Category::Study,
        domain::Date{15, 8, 2026},
        domain::TimeSlot{std::chrono::hours{9}, std::chrono::hours{10}},
        domain::Priority::Medium};
}

} // namespace

int main()
{
    persistence::InMemoryTaskRepository repository;
    application::CreateTaskUseCase create(repository);

    const auto id = create.execute(make_request());

    VP_EXPECT(id == 1, "first created task should get id 1");

    auto tasks = repository.find_all();

    VP_EXPECT(tasks.size() == 1,
              "repository should contain exactly one task after creation");
    VP_EXPECT(tasks.front().id() == 1, "stored task should keep the returned id");
    VP_EXPECT(tasks.front().description() == "Study paradigms",
              "created task should keep the requested description");
    VP_EXPECT(tasks.front().category() == domain::Category::Study,
              "created task should keep the requested category");
    VP_EXPECT(tasks.front().date() == domain::Date(15, 8, 2026),
              "created task should keep the requested date");
    VP_EXPECT(tasks.front().time_slot().start() == std::chrono::hours{9},
              "created task should keep the requested time slot start");
    VP_EXPECT(tasks.front().priority() == domain::Priority::Medium,
              "created task should keep the requested priority");
    VP_EXPECT(tasks.front().status() == domain::TaskStatus::Pending,
              "a newly created task should start as Pending");

    const auto second_id = create.execute(make_request());

    VP_EXPECT(second_id == 2, "second created task should get id 2");
    VP_EXPECT(repository.find_all().size() == 2,
              "repository should contain two tasks after a second creation");

    // O id vem de uma sequencia monotonica do repositorio (ADR-005): remover o
    // maior id nao o libera para reuso.
    repository.remove(2);
    const auto third_id = create.execute(make_request());

    VP_EXPECT(third_id == 3,
              "ids come from a monotonic sequence, not reused after removal");

    return 0;
}
