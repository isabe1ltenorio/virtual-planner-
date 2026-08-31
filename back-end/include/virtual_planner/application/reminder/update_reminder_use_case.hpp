#pragma once

#include <cstdint>
#include <string>

#include "virtual_planner/domain/enums/category.hpp"
#include "virtual_planner/domain/enums/reminder_recurrence.hpp"
#include "virtual_planner/domain/enums/reminder_type.hpp"
#include "virtual_planner/domain/value_objects/date.hpp"
#include "virtual_planner/domain/value_objects/time_slot.hpp"
#include "virtual_planner/persistence/reminder_repository.hpp"

namespace virtual_planner::application {

struct UpdateReminderRequest
{
    std::uint64_t id;
    std::string description;
    domain::Category category;
    domain::Date date;
    domain::TimeSlot time_slot;
    domain::ReminderType type;
    domain::ReminderRecurrence recurrence;
};

class UpdateReminderUseCase
{
public:
    explicit UpdateReminderUseCase(
        persistence::ReminderRepository& repository);

    void execute(const UpdateReminderRequest& request,
                 std::uint64_t user_id = 1) const;

private:
    persistence::ReminderRepository& repository_;
};

} // namespace virtual_planner::application
