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

    // Segundo create: o id precisa avancar, nao colidir com o primeiro. Sem
    // isso o upsert de InMemoryTaskRepository sobrescreveria a task 1.
    const auto second_id = create.execute(make_request());

    VP_EXPECT(second_id == 2, "second created task should get id 2");
    VP_EXPECT(repository.find_all().size() == 2,
              "repository should contain two tasks after a second creation");

    // Apos remover o maior id, o proximo create reaproveita esse numero: o id
    // vem sempre de max(ids)+1 sobre o estado atual do repositorio.
    repository.remove(2);
    const auto third_id = create.execute(make_request());

    VP_EXPECT(third_id == 2,
              "next id is max(existing ids)+1, so it reuses a freed top id");

    return 0;
}
