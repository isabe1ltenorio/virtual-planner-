#include "virtual_planner/application/task/delete_task_use_case.hpp"

#include "virtual_planner/domain/entities/task.hpp"
#include "virtual_planner/shared/errors.hpp"

namespace virtual_planner::application {

DeleteTaskUseCase::DeleteTaskUseCase(persistence::TaskRepository& repository)
    : repository_(repository)
{
}

void DeleteTaskUseCase::execute(std::uint64_t id, std::uint64_t user_id)
{
    auto task = repository_.find_by_id(id, user_id);

    if (!task.has_value())
    {
        throw shared::NotFoundError("Task not found.");
    }

    repository_.remove(id, user_id);
}

} // namespace virtual_planner::application
