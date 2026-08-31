#include "virtual_planner/application/reminder/create_reminder_use_case.hpp"

#include "virtual_planner/domain/entities/reminder.hpp"

namespace virtual_planner::application {

CreateReminderUseCase::CreateReminderUseCase(
    persistence::ReminderRepository& repository)
    : repository_(repository)
{
}

std::uint64_t CreateReminderUseCase::execute(
    const CreateReminderRequest& request, std::uint64_t user_id) const
{
    // O id que o repositorio devolve e o unico id valido. Nao ha mais guarda
    // de id duplicado porque nao ha mais como duplicar: save so insere
    // (issue #90). O id passado a entidade aqui e descartado pelo
    // repositorio.
    const domain::Reminder reminder{
        0,
        request.description,
        request.category,
        request.date,
        request.time_slot,
        request.type,
        request.recurrence};

    return repository_.save(reminder, user_id);
}

} // namespace virtual_planner::application
