#include "virtual_planner/application/goal/delete_goal_use_case.hpp"
#include "virtual_planner/shared/errors.hpp"

#include <stdexcept>

namespace virtual_planner::application {

DeleteGoalUseCase::DeleteGoalUseCase(
    persistence::GoalRepository& repository)
    : repository_(repository)
{
}

void DeleteGoalUseCase::execute(std::uint64_t id,
                                std::uint64_t user_id)
{
    auto goal = repository_.find_by_id(id, user_id);

    if (!goal.has_value())
    {
        throw shared::NotFoundError(
            "Goal not found.");
    }

    repository_.remove(id, user_id);
}

}
