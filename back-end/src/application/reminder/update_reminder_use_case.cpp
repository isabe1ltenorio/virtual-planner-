#include "virtual_planner/application/reminder/update_reminder_use_case.hpp"
#include "virtual_planner/shared/errors.hpp"

#include <stdexcept>

namespace virtual_planner::application {

UpdateReminderUseCase::UpdateReminderUseCase(
    persistence::ReminderRepository& repository)
    : repository_(repository)
{
}

void UpdateReminderUseCase::execute(
    const UpdateReminderRequest& request) const
{
    const auto existing = repository_.find_by_id(request.id);

    if (!existing.has_value())
    {
        throw shared::NotFoundError("Lembrete não encontrado.");
    }

    const domain::Reminder updated{
        existing->id(),
        request.description,
        request.category,
        request.date,
        request.time_slot,
        request.type,
        request.recurrence};

    repository_.update(updated);
}

} // namespace virtual_planner::application
