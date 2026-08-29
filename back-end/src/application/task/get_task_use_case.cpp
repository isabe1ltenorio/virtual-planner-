#include "virtual_planner/application/task/get_task_use_case.hpp"

#include "virtual_planner/shared/errors.hpp"

namespace virtual_planner::application {

GetTaskUseCase::GetTaskUseCase(persistence::TaskRepository& repository)
    : repository_(repository)
{
}

domain::Task GetTaskUseCase::execute(std::uint64_t id) const
{
    auto task = repository_.find_by_id(id);

    if (!task.has_value())
    {
        throw shared::NotFoundError("Task not found.");
    }

    return *task;
}

} // namespace virtual_planner::application
