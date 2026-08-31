#pragma once

#include <algorithm>
#include <cstdint>
#include <optional>
#include <vector>

#include "virtual_planner/persistence/reminder_repository.hpp"

namespace virtual_planner::persistence {

// Repositorio de Reminder em memoria.
//
// save gera o id e insere; update substitui quem ja tem o mesmo id e dono.
// Espelha InMemoryGoalRepository (issue #90) — antes save fazia upsert e era
// possivel sobrescrever um lembrete existente sem querer.
//
// Cada lembrete e guardado com o user_id de quem o criou; toda leitura e
// escrita filtra por dono, igual a InMemoryGoalRepository.
//
// Nao e thread-safe: o vector interno nao tem lock nenhum. O chamador deve
// serializar o acesso concorrente.
class InMemoryReminderRepository final : public ReminderRepository
{
public:
    std::uint64_t save(const domain::Reminder& reminder,
                       std::uint64_t user_id = 1) override
    {
        const auto id = next_id_++;

        // Reconstroi campo a campo porque Reminder::id_ e privado sem setter
        // e o id gerado aqui precisa sobrescrever o que veio na entidade.
        // Mesma razao do InMemoryGoalRepository.
        reminders_.push_back(StoredReminder{
            user_id,
            domain::Reminder{
                id,
                reminder.description(),
                reminder.category(),
                reminder.date(),
                reminder.time_slot(),
                reminder.type(),
                reminder.recurrence()}});

        return id;
    }

    void update(const domain::Reminder& reminder,
                std::uint64_t user_id = 1) override
    {
        for (auto& current : reminders_)
        {
            if (current.user_id == user_id &&
                current.reminder.id() == reminder.id())
            {
                current.reminder = reminder;
                return;
            }
        }
    }

    std::optional<domain::Reminder> find_by_id(
        std::uint64_t id,
        std::uint64_t user_id = 1) override
    {
        for (const auto& stored : reminders_)
        {
            if (stored.user_id == user_id && stored.reminder.id() == id)
            {
                return stored.reminder;
            }
        }

        return std::nullopt;
    }

    std::vector<domain::Reminder> find_all(std::uint64_t user_id = 1) override
    {
        std::vector<domain::Reminder> result;

        for (const auto& stored : reminders_)
        {
            if (stored.user_id == user_id)
            {
                result.push_back(stored.reminder);
            }
        }

        return result;
    }

    void remove(std::uint64_t id, std::uint64_t user_id = 1) override
    {
        reminders_.erase(
            std::remove_if(
                reminders_.begin(),
                reminders_.end(),
                [id, user_id](const StoredReminder& stored)
                {
                    return stored.user_id == user_id &&
                           stored.reminder.id() == id;
                }),
            reminders_.end());
    }

private:
    struct StoredReminder
    {
        std::uint64_t user_id;
        domain::Reminder reminder;
    };

    std::vector<StoredReminder> reminders_;
    std::uint64_t next_id_{1};
};

} // namespace virtual_planner::persistence
