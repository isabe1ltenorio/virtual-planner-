#include "virtual_planner/application/goal/update_goal_use_case.hpp"
#include "virtual_planner/shared/errors.hpp"

#include <stdexcept>

namespace virtual_planner::application {

UpdateGoalUseCase::UpdateGoalUseCase(
    persistence::GoalRepository& repository)
    : repository_(repository)
{
}

void UpdateGoalUseCase::execute(
    const UpdateGoalRequest& request,
    std::uint64_t user_id)
{
    auto goal = repository_.find_by_id(request.id, user_id);

    if (!goal.has_value())
    {
        throw shared::NotFoundError(
            "Goal not found.");
    }

    goal->update_description(request.description);

    goal->change_category(request.category);

    goal->change_period(request.period);

    goal->change_reference_date(request.reference_date);

    repository_.update(*goal, user_id);
}

} // namespace virtual_planner::application
