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
    std::uint64_t save(const domain::Task& task,
                       std::uint64_t user_id) override
    {
        const auto id = next_id_++;

        // Reconstroi campo a campo em vez de copiar a entidade, porque
        // Task::id_ e privado sem setter e o id gerado aqui precisa
        // sobrescrever o que veio em task.
        tasks_.push_back(StoredTask{
            user_id,
            domain::Task{
                id,
                task.description(),
                task.category(),
                task.date(),
                task.time_slot(),
                task.priority(),
                task.status()}});

        return id;
    }

    void update(const domain::Task& task,
                std::uint64_t user_id) override
    {
        for (auto& current : tasks_)
        {
            if (current.user_id == user_id && current.task.id() == task.id())
            {
                current.task = task;
                return;
            }
        }
    }

    std::optional<domain::Task> find_by_id(std::uint64_t id,
                                           std::uint64_t user_id) override
    {
        for (const auto& task : tasks_)
        {
            if (task.user_id == user_id && task.task.id() == id)
            {
                return task.task;
            }
        }

        return std::nullopt;
    }

    std::vector<domain::Task> find_all(std::uint64_t user_id) override
    {
        std::vector<domain::Task> result;

        for (const auto& stored : tasks_)
        {
            if (stored.user_id == user_id)
            {
                result.push_back(stored.task);
            }
        }

        return result;
    }

    void remove(std::uint64_t id,
                std::uint64_t user_id) override
    {
        tasks_.erase(
            std::remove_if(
                tasks_.begin(),
                tasks_.end(),
                [id, user_id](const StoredTask& task)
                {
                    return task.user_id == user_id && task.task.id() == id;
                }),
            tasks_.end());
    }

private:
    struct StoredTask
    {
        std::uint64_t user_id;
        domain::Task task;
    };

    std::vector<StoredTask> tasks_;
    std::uint64_t next_id_ = 1;
};

} // namespace virtual_planner::persistence
