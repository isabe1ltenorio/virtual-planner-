#pragma once

#include <cstdint>
#include <optional>
#include <vector>

#include "virtual_planner/domain/entities/reminder.hpp"
#include "virtual_planner/domain/enums/reminder_recurrence.hpp"
#include "virtual_planner/domain/enums/reminder_type.hpp"
#include "virtual_planner/domain/value_objects/date.hpp"
#include "virtual_planner/persistence/reminder_repository.hpp"

namespace virtual_planner::application {

struct ReminderOccurrence
{
    domain::Reminder reminder;
    domain::Date occurrence_date;
};

struct ListRemindersRequest
{
    domain::Date start_date;
    domain::Date end_date;
    std::optional<domain::ReminderType> type;
    std::optional<domain::ReminderRecurrence> recurrence;
};

class ListRemindersUseCase
{
public:
    explicit ListRemindersUseCase(
        persistence::ReminderRepository& repository);

    [[nodiscard]] std::vector<ReminderOccurrence> execute(
        const ListRemindersRequest& request,
        std::uint64_t user_id = 1) const;

private:
    persistence::ReminderRepository& repository_;
};

} // namespace virtual_planner::application
