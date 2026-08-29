#pragma once

#include <cstdint>
#include <string>

#include "virtual_planner/domain/enums/category.hpp"
#include "virtual_planner/domain/enums/goal_period.hpp"
#include "virtual_planner/persistence/goal_repository.hpp"
#include "virtual_planner/domain/value_objects/date.hpp"

namespace virtual_planner::application {

struct CreateGoalRequest
{
    std::string description;
    domain::Category category;
    domain::GoalPeriod period;
    domain::Date reference_date;
};

class CreateGoalUseCase
{
public:
    explicit CreateGoalUseCase(
        persistence::GoalRepository& repository);

    [[nodiscard]] std::uint64_t execute(
        const CreateGoalRequest& request,
        std::uint64_t user_id);

private:
    persistence::GoalRepository& repository_;
};

} // namespace virtual_planner::application
