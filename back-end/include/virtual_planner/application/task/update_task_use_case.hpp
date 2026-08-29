#pragma once

#include <cstdint>
#include <string>

#include "virtual_planner/domain/enums/category.hpp"
#include "virtual_planner/domain/enums/priority.hpp"
#include "virtual_planner/domain/value_objects/date.hpp"
#include "virtual_planner/domain/value_objects/time_slot.hpp"
#include "virtual_planner/persistence/task_repository.hpp"

namespace virtual_planner::application {

// Substituicao total dos campos editaveis, como UpdateGoalRequest. O status
// nao entra aqui: quem muda status e ChangeTaskStatusUseCase.
struct UpdateTaskRequest
{
    std::uint64_t id;
    std::string description;
    domain::Category category;
    domain::Date date;
    domain::TimeSlot time_slot;
    domain::Priority priority;
};

class UpdateTaskUseCase
{
public:
    explicit UpdateTaskUseCase(persistence::TaskRepository& repository);

    // Lanca shared::NotFoundError quando nao existe Task com o id pedido.
    void execute(const UpdateTaskRequest& request);

private:
    persistence::TaskRepository& repository_;
};

} // namespace virtual_planner::application
