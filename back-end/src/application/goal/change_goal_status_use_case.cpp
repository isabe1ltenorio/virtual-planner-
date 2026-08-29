#include "virtual_planner/application/goal/change_goal_status_use_case.hpp"
#include "virtual_planner/shared/errors.hpp"

#include <stdexcept>

namespace virtual_planner::application {

ChangeGoalStatusUseCase::ChangeGoalStatusUseCase(
    persistence::GoalRepository& repository)
    : repository_(repository)
{
}

void ChangeGoalStatusUseCase::execute(
    const ChangeGoalStatusRequest& request,
    std::uint64_t user_id)
{
    auto goal = repository_.find_by_id(request.id, user_id);

    if (!goal.has_value())
    {
        throw shared::NotFoundError(
            "Goal not found.");
    }

    switch (request.status)
    {
        case domain::GoalStatus::InProgress:
            goal->mark_as_in_progress();
            break;

        case domain::GoalStatus::Completed:
            goal->mark_as_completed();
            break;

        case domain::GoalStatus::PartiallyCompleted:
            goal->mark_as_partially_completed();
            break;

        case domain::GoalStatus::Failed:
            goal->mark_as_failed();
            break;
    }

    repository_.update(*goal, user_id);
}

} // namespace virtual_planner::application
