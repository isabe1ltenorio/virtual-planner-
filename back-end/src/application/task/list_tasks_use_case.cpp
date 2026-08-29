#include "virtual_planner/application/task/list_tasks_use_case.hpp"

#include <stdexcept>

namespace virtual_planner::application {

namespace {

bool matches(const domain::Task& task, const ListTasksFilter& filter)
{
    if (filter.start_date.has_value() && task.date() < *filter.start_date)
    {
        return false;
    }

    if (filter.end_date.has_value() && task.date() > *filter.end_date)
    {
        return false;
    }

    if (filter.category.has_value() && task.category() != *filter.category)
    {
        return false;
    }

    if (filter.priority.has_value() && task.priority() != *filter.priority)
    {
        return false;
    }

    if (filter.status.has_value() && task.status() != *filter.status)
    {
        return false;
    }

    return true;
}

} // namespace

ListTasksUseCase::ListTasksUseCase(persistence::TaskRepository& repository)
    : repository_(repository)
{
}

std::vector<domain::Task> ListTasksUseCase::execute(
    const ListTasksFilter& filter,
    std::uint64_t user_id) const
{
    if (filter.start_date.has_value() && filter.end_date.has_value() &&
        *filter.start_date > *filter.end_date)
    {
        throw std::invalid_argument(
            "Task date range start must not be after end.");
    }

    std::vector<domain::Task> result;

    for (const auto& task : repository_.find_all(user_id))
    {
        if (matches(task, filter))
        {
            result.push_back(task);
        }
    }

    return result;
}

} // namespace virtual_planner::application
