#include "virtual_planner/application/reminder/list_reminders_use_case.hpp"

#include <algorithm>
#include <chrono>
#include <stdexcept>

namespace virtual_planner::application {

namespace {

using Days = std::chrono::sys_days;

Days to_system_days(const domain::Date& date)
{
    return Days{
        std::chrono::year{static_cast<int>(date.year())} /
        std::chrono::month{date.month()} /
        std::chrono::day{date.day()}};
}

domain::Date to_date(const Days value)
{
    const std::chrono::year_month_day calendar_date{value};

    return domain::Date{
        static_cast<std::uint32_t>(static_cast<unsigned>(calendar_date.day())),
        static_cast<std::uint32_t>(static_cast<unsigned>(calendar_date.month())),
        static_cast<std::uint32_t>(static_cast<int>(calendar_date.year()))};
}

void add_if_within_window(
    std::vector<ReminderOccurrence>& occurrences,
    const domain::Reminder& reminder,
    const Days occurrence,
    const Days window_start,
    const Days window_end)
{
    if (occurrence >= window_start && occurrence <= window_end)
    {
        occurrences.push_back(ReminderOccurrence{reminder, to_date(occurrence)});
    }
}

void add_fixed_interval_occurrences(
    std::vector<ReminderOccurrence>& occurrences,
    const domain::Reminder& reminder,
    const Days window_start,
    const Days window_end,
    const std::chrono::days interval)
{
    const Days base_date = to_system_days(reminder.date());

    for (Days occurrence = base_date; occurrence <= window_end; occurrence += interval)
    {
        add_if_within_window(
            occurrences, reminder, occurrence, window_start, window_end);
    }
}

void add_monthly_occurrences(
    std::vector<ReminderOccurrence>& occurrences,
    const domain::Reminder& reminder,
    const Days window_start,
    const Days window_end)
{
    const auto base_date = std::chrono::year_month_day{to_system_days(reminder.date())};
    const unsigned anchor_day = static_cast<unsigned>(base_date.day());

    for (std::chrono::year_month month = base_date.year() / base_date.month();; month += std::chrono::months{1})
    {
        const auto requested_date = month / std::chrono::day{anchor_day};
        const auto valid_date = requested_date.ok()
            ? requested_date
            : std::chrono::year_month_day{month / std::chrono::last};
        const Days occurrence{valid_date};

        if (occurrence > window_end)
        {
            break;
        }

        add_if_within_window(
            occurrences, reminder, occurrence, window_start, window_end);
    }
}

bool matches_filters(
    const domain::Reminder& reminder,
    const ListRemindersRequest& request)
{
    return (!request.type.has_value() || reminder.type() == *request.type) &&
           (!request.recurrence.has_value() ||
            reminder.recurrence() == *request.recurrence);
}

} // namespace

ListRemindersUseCase::ListRemindersUseCase(
    persistence::ReminderRepository& repository)
    : repository_(repository)
{
}

std::vector<ReminderOccurrence> ListRemindersUseCase::execute(
    const ListRemindersRequest& request, std::uint64_t user_id) const
{
    if (request.start_date > request.end_date)
    {
        throw std::invalid_argument(
            "O início da janela de datas não pode ser posterior ao fim.");
    }

    const Days window_start = to_system_days(request.start_date);
    const Days window_end = to_system_days(request.end_date);
    std::vector<ReminderOccurrence> occurrences;

    for (const auto& reminder : repository_.find_all(user_id))
    {
        if (!matches_filters(reminder, request))
        {
            continue;
        }

        switch (reminder.recurrence())
        {
            case domain::ReminderRecurrence::Once:
                add_if_within_window(
                    occurrences,
                    reminder,
                    to_system_days(reminder.date()),
                    window_start,
                    window_end);
                break;

            case domain::ReminderRecurrence::Daily:
                add_fixed_interval_occurrences(
                    occurrences,
                    reminder,
                    window_start,
                    window_end,
                    std::chrono::days{1});
                break;

            case domain::ReminderRecurrence::Weekly:
                add_fixed_interval_occurrences(
                    occurrences,
                    reminder,
                    window_start,
                    window_end,
                    std::chrono::days{7});
                break;

            case domain::ReminderRecurrence::Monthly:
                add_monthly_occurrences(
                    occurrences, reminder, window_start, window_end);
                break;
        }
    }

    std::sort(
        occurrences.begin(),
        occurrences.end(),
        [](const ReminderOccurrence& left, const ReminderOccurrence& right)
        {
            if (left.occurrence_date != right.occurrence_date)
            {
                return left.occurrence_date < right.occurrence_date;
            }

            if (left.reminder.time_slot().start() !=
                right.reminder.time_slot().start())
            {
                return left.reminder.time_slot().start() <
                       right.reminder.time_slot().start();
            }

            return left.reminder.id() < right.reminder.id();
        });

    return occurrences;
}

} // namespace virtual_planner::application
