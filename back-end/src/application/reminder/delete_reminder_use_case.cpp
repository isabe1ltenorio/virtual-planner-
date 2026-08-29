#include "virtual_planner/application/reminder/delete_reminder_use_case.hpp"
#include "virtual_planner/shared/errors.hpp"

#include <stdexcept>

namespace virtual_planner::application {

DeleteReminderUseCase::DeleteReminderUseCase(
    persistence::ReminderRepository& repository)
    : repository_(repository)
{
}

void DeleteReminderUseCase::execute(std::uint64_t id) const
{
    if (!repository_.find_by_id(id).has_value())
    {
        throw shared::NotFoundError("Lembrete não encontrado.");
    }

    repository_.remove(id);
}

} // namespace virtual_planner::application
