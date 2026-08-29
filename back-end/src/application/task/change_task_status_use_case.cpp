#include "virtual_planner/application/task/change_task_status_use_case.hpp"

#include "virtual_planner/domain/entities/task.hpp"
#include "virtual_planner/shared/errors.hpp"

namespace virtual_planner::application {

ChangeTaskStatusUseCase::ChangeTaskStatusUseCase(
    persistence::TaskRepository& repository)
    : repository_(repository)
{
}

void ChangeTaskStatusUseCase::execute(const ChangeTaskStatusRequest& request)
{
    auto task = repository_.find_by_id(request.id);

    if (!task.has_value())
    {
        throw shared::NotFoundError("Task not found.");
    }

    switch (request.status)
    {
        case domain::TaskStatus::Pending:
            task->mark_as_pending();
            break;

        case domain::TaskStatus::Executed:
            task->mark_as_executed();
            break;

        case domain::TaskStatus::PartiallyExecuted:
            task->mark_as_partially_executed();
            break;

        case domain::TaskStatus::Cancelled:
            task->mark_as_cancelled();
            break;

        case domain::TaskStatus::Postponed:
            task->mark_as_postponed();
            break;
    }

    repository_.update(*task);
}

} // namespace virtual_planner::application
