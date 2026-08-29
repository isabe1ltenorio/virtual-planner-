#include "virtual_planner/application/goal/list_goals_use_case.hpp"

#include <stdexcept>

namespace virtual_planner::application {

ListGoalsUseCase::ListGoalsUseCase(
    persistence::GoalRepository& repository)
    : repository_(repository)
{
}

std::vector<domain::Goal>
ListGoalsUseCase::execute(
    const domain::Date& start_date,
    const domain::Date& end_date,
    std::uint64_t user_id) const
{
    if (start_date > end_date)
    {
        throw std::invalid_argument(
            "Goal date range start must not be after end.");
    }

    return repository_.find_by_date_range(
        start_date,
        end_date,
        user_id);
}

} // namespace virtual_planner::application
