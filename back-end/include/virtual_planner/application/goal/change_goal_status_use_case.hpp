#pragma once

#include <cstdint>

#include "virtual_planner/domain/enums/goal_status.hpp"
#include "virtual_planner/persistence/goal_repository.hpp"

namespace virtual_planner::application {

struct ChangeGoalStatusRequest
{
    std::uint64_t id;

    domain::GoalStatus status;
};

class ChangeGoalStatusUseCase
{
public:
    explicit ChangeGoalStatusUseCase(
        persistence::GoalRepository& repository);

    void execute(const ChangeGoalStatusRequest& request,
                 std::uint64_t user_id);

private:
    persistence::GoalRepository& repository_;
};

} // namespace virtual_planner::application
