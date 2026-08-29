#pragma once

#include <cstdint>
#include <optional>
#include <vector>

#include "virtual_planner/domain/entities/task.hpp"

namespace virtual_planner::persistence {

// Contrato de persistencia de Task. Alinhado a GoalRepository e
// ReminderRepository (ver ADR-005 em docs/architecture.md): o id e gerado pelo
// repositorio, nao pelo chamador.
class TaskRepository
{
public:
    virtual ~TaskRepository() = default;

    // Insere uma Task nova e devolve o id gerado. O valor de task.id() e
    // ignorado.
    virtual std::uint64_t save(const domain::Task& task) = 0;

    // Sobrescreve a Task de mesmo id. Silenciosa se o id nao existir.
    virtual void update(const domain::Task& task) = 0;

    virtual std::optional<domain::Task> find_by_id(
        std::uint64_t id) = 0;

    virtual std::vector<domain::Task> find_all() = 0;

    virtual void remove(std::uint64_t id) = 0;
};

} // namespace virtual_planner::persistence
