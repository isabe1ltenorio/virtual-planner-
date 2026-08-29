#include "virtual_planner/application/task/update_task_use_case.hpp"

#include "virtual_planner/domain/entities/task.hpp"
#include "virtual_planner/shared/errors.hpp"

namespace virtual_planner::application {

UpdateTaskUseCase::UpdateTaskUseCase(persistence::TaskRepository& repository)
    : repository_(repository)
{
}

void UpdateTaskUseCase::execute(const UpdateTaskRequest& request)
{
    auto task = repository_.find_by_id(request.id);

    if (!task.has_value())
    {
        throw shared::NotFoundError("Task not found.");
    }

    task->update_description(request.description);
    task->change_category(request.category);
    task->change_date(request.date);
    task->change_time_slot(request.time_slot);
    task->change_priority(request.priority);

    repository_.update(*task);
}

} // namespace virtual_planner::application
