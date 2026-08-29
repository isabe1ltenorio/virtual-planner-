#include "virtual_planner/application/goal/create_goal_use_case.hpp"

#include <stdexcept>

#include "virtual_planner/domain/entities/goal.hpp"
#include "virtual_planner/domain/enums/goal_status.hpp"

namespace virtual_planner::application {

CreateGoalUseCase::CreateGoalUseCase(
    persistence::GoalRepository& repository)
    : repository_(repository)
{
}

std::uint64_t CreateGoalUseCase::execute(
    const CreateGoalRequest& request,
    std::uint64_t user_id)
{
    if (request.description.empty())
    {
        throw std::invalid_argument(
            "Goal description cannot be empty.");
    }

    domain::Goal goal(
        0,
        request.description,
        request.category,
        domain::GoalStatus::InProgress,
        request.period,
        request.reference_date);

    const auto id = repository_.save(goal, user_id);

    return id;
}
} // namespace virtual_planner::application     
