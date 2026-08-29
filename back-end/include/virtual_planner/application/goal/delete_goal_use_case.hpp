#pragma once

#include <cstdint>

#include "virtual_planner/persistence/goal_repository.hpp"

namespace virtual_planner::application {

class DeleteGoalUseCase
{
public:

    explicit DeleteGoalUseCase(
        persistence::GoalRepository& repository);

    void execute(std::uint64_t id,
                 std::uint64_t user_id);

private:

    persistence::GoalRepository& repository_;
};

}
