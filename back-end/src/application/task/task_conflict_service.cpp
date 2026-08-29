#include "virtual_planner/application/task/task_conflict_service.hpp"

#include <cstddef>

#include "virtual_planner/domain/enums/task_status.hpp"

namespace virtual_planner::application {

namespace {

// Cancelled e Postponed nao disputam o horario, entao nao entram na deteccao.
bool occupies_slot(domain::TaskStatus status)
{
    switch (status)
    {
        case domain::TaskStatus::Pending:
        case domain::TaskStatus::Executed:
        case domain::TaskStatus::PartiallyExecuted:
            return true;

        case domain::TaskStatus::Cancelled:
        case domain::TaskStatus::Postponed:
            return false;
    }

    return false;
}

} // namespace

TaskConflictService::TaskConflictService(persistence::TaskRepository& repository)
    : repository_(repository)
{
}

std::vector<TaskConflict> TaskConflictService::conflicts_on(
    const domain::Date& date) const
{
    std::vector<domain::Task> on_date;

    for (const auto& task : repository_.find_all())
    {
        if (task.date() == date && occupies_slot(task.status()))
        {
            on_date.push_back(task);
        }
    }

    std::vector<TaskConflict> conflicts;

    for (std::size_t i = 0; i < on_date.size(); ++i)
    {
        for (std::size_t j = i + 1; j < on_date.size(); ++j)
        {
            if (on_date[i].time_slot().overlaps(on_date[j].time_slot()))
            {
                conflicts.push_back(TaskConflict{on_date[i], on_date[j]});
            }
        }
    }

    return conflicts;
}

} // namespace virtual_planner::application
