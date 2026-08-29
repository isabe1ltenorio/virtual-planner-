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
};

// Cria uma Task nova, sempre com status Pending.
//
// Diferente de Goal, TaskRepository::save nao gera id: e um upsert por id. Por
// isso o id novo e calculado aqui, a partir do maior id ja existente (1 quando
// o repositorio esta vazio). A validacao de descricao e de time slot fica com
// os construtores de Task e TimeSlot, que ja lancam shared::DomainError e
// std::invalid_argument.
class CreateTaskUseCase
{
public:
    explicit CreateTaskUseCase(persistence::TaskRepository& repository);

    [[nodiscard]] std::uint64_t execute(const CreateTaskRequest& request);

private:
    persistence::TaskRepository& repository_;
};

} // namespace virtual_planner::application
