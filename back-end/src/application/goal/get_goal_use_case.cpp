#include "virtual_planner/application/goal/get_goal_use_case.hpp"

#include "virtual_planner/shared/errors.hpp"

namespace virtual_planner::application {

GetGoalUseCase::GetGoalUseCase(
    persistence::GoalRepository& repository)
    : repository_(repository)
{
}

domain::Goal
GetGoalUseCase::execute(std::uint64_t id,
                        std::uint64_t user_id) const
{
    auto goal = repository_.find_by_id(id, user_id);

    if (!goal.has_value())
    {
        throw shared::NotFoundError(
            "Goal not found.");
    }

    return *goal;
}

} // namespace virtual_planner::application
