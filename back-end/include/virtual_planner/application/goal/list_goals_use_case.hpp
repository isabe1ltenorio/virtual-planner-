#pragma once

#include <vector>

#include "virtual_planner/domain/entities/goal.hpp"
#include "virtual_planner/domain/value_objects/date.hpp"
#include "virtual_planner/persistence/goal_repository.hpp"

namespace virtual_planner::application {

class ListGoalsUseCase
{
public:
    explicit ListGoalsUseCase(
        persistence::GoalRepository& repository);

    [[nodiscard]]
    std::vector<domain::Goal> execute(
        const domain::Date& start_date,
        const domain::Date& end_date,
        std::uint64_t user_id) const;

private:
    persistence::GoalRepository& repository_;
};

} // namespace virtual_planner::application
