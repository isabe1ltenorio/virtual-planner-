#pragma once

#include <algorithm>
#include <cstdint>
#include <optional>
#include <vector>

#include "virtual_planner/persistence/task_repository.hpp"

namespace virtual_planner::persistence {

// Repositorio de Task em memoria.
//
// Como InMemoryGoalRepository, save gera o id: o valor de task.id() recebido e
// ignorado e o id atribuido e devolvido ao chamador. update sobrescreve a Task
// de mesmo id. Ver ADR-005 em docs/architecture.md.
//
// Nao e thread-safe: o vector interno nao tem lock nenhum. O chamador deve
// serializar o acesso concorrente.
class InMemoryTaskRepository final : public TaskRepository
{
public:
    std::uint64_t save(const domain::Task& task) override
    {
        const auto id = next_id_++;

        // Reconstroi campo a campo em vez de copiar a entidade, porque
        // Task::id_ e privado sem setter e o id gerado aqui precisa
        // sobrescrever o que veio em task.
        tasks_.emplace_back(
            id,
            task.description(),
            task.category(),
            task.date(),
            task.time_slot(),
            task.priority(),
            task.status());

        return id;
    }

    void update(const domain::Task& task) override
    {
        for (auto& current : tasks_)
        {
            if (current.id() == task.id())
            {
                current = task;
                return;
            }
        }
    }

    std::optional<domain::Task> find_by_id(std::uint64_t id) override
    {
        for (const auto& task : tasks_)
        {
            if (task.id() == id)
            {
                return task;
            }
        }

        return std::nullopt;
    }

    std::vector<domain::Task> find_all() override
    {
        return tasks_;
    }

    void remove(std::uint64_t id) override
    {
        tasks_.erase(
            std::remove_if(
                tasks_.begin(),
                tasks_.end(),
                [id](const domain::Task& task)
                {
                    return task.id() == id;
                }),
            tasks_.end());
    }

private:
    std::vector<domain::Task> tasks_;
    std::uint64_t next_id_ = 1;
};

} // namespace virtual_planner::persistence
