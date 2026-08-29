#include "virtual_planner/application/task/create_task_use_case.hpp"

#include "virtual_planner/domain/entities/task.hpp"
#include "virtual_planner/domain/enums/task_status.hpp"

namespace virtual_planner::application {

CreateTaskUseCase::CreateTaskUseCase(persistence::TaskRepository& repository)
    : repository_(repository)
{
}

std::uint64_t CreateTaskUseCase::execute(const CreateTaskRequest& request,
                                         std::uint64_t user_id)
{
    // id 0: o repositorio gera o id real e o devolve. Descricao e time slot
    // sao validados pelos construtores de Task e TimeSlot.
    const domain::Task task(
        0,
        request.description,
        request.category,
        request.date,
        request.time_slot,
        request.priority,
        domain::TaskStatus::Pending);

    return repository_.save(task, user_id);
}

} // namespace virtual_planner::application
