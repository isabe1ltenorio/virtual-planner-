#pragma once

#include <algorithm>
#include <cstdint>
#include <optional>
#include <vector>

#include "virtual_planner/domain/entities/goal.hpp"
#include "virtual_planner/persistence/goal_repository.hpp"

namespace virtual_planner::persistence {

// Repositorio de Goal em memoria.
//
// Diferente dos demais, GoalRepository::save gera o id: o valor de
// goal.id() recebido e ignorado e o id atribuido e devolvido ao chamador.
// Serve tanto aos testes quanto a um modo de execucao sem banco.
//
// Nao e thread-safe: o vector interno nao tem lock nenhum. O chamador deve
// serializar o acesso concorrente.
class InMemoryGoalRepository final : public GoalRepository
{
public:
    std::uint64_t save(const domain::Goal& goal,
                       std::uint64_t user_id) override
    {
        const auto id = next_id_++;

        // Reconstroi campo a campo em vez de copiar a entidade, porque
        // Goal::id_ e privado sem setter e o id gerado aqui precisa
        // sobrescrever o que veio em goal. Os outros tres repositorios
        // fazem push_back da entidade inteira porque preservam o id.
        // ADR-002 planeja adicionar user_id a Goal na Onda 3: quando isso
        // acontecer, este e o repositorio que precisa ser revisitado. Uma
        // mudanca de aridade no construtor de Goal quebra esta chamada em
        // tempo de compilacao, entao o risco de esquecer o campo aqui e
        // baixo.
        goals_.push_back(StoredGoal{
            user_id,
            domain::Goal{
                id,
                goal.description(),
                goal.category(),
                goal.status(),
                goal.period(),
                goal.reference_date()}});

        return id;
    }

    void update(const domain::Goal& goal,
                std::uint64_t user_id) override
    {
        for (auto& current : goals_)
        {
            if (current.user_id == user_id && current.goal.id() == goal.id())
            {
                current.goal = goal;
                return;
            }
        }
    }

    std::optional<domain::Goal> find_by_id(std::uint64_t id,
                                           std::uint64_t user_id) override
    {
        for (const auto& goal : goals_)
        {
            if (goal.user_id == user_id && goal.goal.id() == id)
            {
                return goal.goal;
            }
        }

        return std::nullopt;
    }

    std::vector<domain::Goal> find_all(std::uint64_t user_id) override
    {
        std::vector<domain::Goal> result;

        for (const auto& stored : goals_)
        {
            if (stored.user_id == user_id)
            {
                result.push_back(stored.goal);
            }
        }

        return result;
    }

    std::vector<domain::Goal> find_by_date_range(
        const domain::Date& start,
        const domain::Date& end,
        std::uint64_t user_id) override
    {
        std::vector<domain::Goal> result;

        for (const auto& stored : goals_)
        {
            if (stored.user_id == user_id &&
                stored.goal.reference_date() >= start &&
                stored.goal.reference_date() <= end)
            {
                result.push_back(stored.goal);
            }
        }

        return result;
    }

    void remove(std::uint64_t id,
                std::uint64_t user_id) override
    {
        goals_.erase(
            std::remove_if(
                goals_.begin(),
                goals_.end(),
                [id, user_id](const StoredGoal& goal)
                {
                    return goal.user_id == user_id && goal.goal.id() == id;
                }),
            goals_.end());
    }

private:
    struct StoredGoal
    {
        std::uint64_t user_id;
        domain::Goal goal;
    };

    std::vector<StoredGoal> goals_;
    std::uint64_t next_id_ = 1;
};

} // namespace virtual_planner::persistence
