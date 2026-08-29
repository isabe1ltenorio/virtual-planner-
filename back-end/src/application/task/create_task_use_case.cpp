#include "virtual_planner/application/task/create_task_use_case.hpp"

#include <algorithm>

#include "virtual_planner/domain/entities/task.hpp"
#include "virtual_planner/domain/enums/task_status.hpp"

namespace virtual_planner::application {

namespace {

std::uint64_t next_id(persistence::TaskRepository& repository)
{
    std::uint64_t highest = 0;

    for (const auto& task : repository.find_all())
    {
        highest = std::max(highest, task.id());
    }

    return highest + 1;
}

} // namespace

CreateTaskUseCase::CreateTaskUseCase(persistence::TaskRepository& repository)
    : repository_(repository)
{
}

std::uint64_t CreateTaskUseCase::execute(const CreateTaskRequest& request)
{
    const std::uint64_t id = next_id(repository_);

    const domain::Task task(
        id,
        request.description,
        request.category,
        request.date,
        request.time_slot,
        request.priority,
        domain::TaskStatus::Pending);

    repository_.save(task);

    return id;
}

} // namespace virtual_planner::application
