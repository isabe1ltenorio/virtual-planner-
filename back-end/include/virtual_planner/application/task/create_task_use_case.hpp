#pragma once

#include <cstdint>
#include <string>

#include "virtual_planner/domain/enums/category.hpp"
#include "virtual_planner/domain/enums/priority.hpp"
#include "virtual_planner/domain/value_objects/date.hpp"
#include "virtual_planner/domain/value_objects/time_slot.hpp"
#include "virtual_planner/persistence/task_repository.hpp"

namespace virtual_planner::application {

struct CreateTaskRequest
{
    std::string description;
    domain::Category category;
    domain::Date date;
    domain::TimeSlot time_slot;
    domain::Priority priority;
    // true = agendada por turno; time_slot é a janela do turno.
    bool scheduled_by_shift{false};
};

// Cria uma Task nova, sempre com status Pending, e devolve o id gerado pelo
// repositorio (ADR-005). A validacao de descricao e de time slot fica com os
// construtores de Task e TimeSlot, que ja lancam shared::DomainError e
// std::invalid_argument.
class CreateTaskUseCase
{
public:
    explicit CreateTaskUseCase(persistence::TaskRepository& repository);

    [[nodiscard]] std::uint64_t execute(const CreateTaskRequest& request,
                                        std::uint64_t user_id);

private:
    persistence::TaskRepository& repository_;
};

} // namespace virtual_planner::application
