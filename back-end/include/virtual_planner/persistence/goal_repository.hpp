#pragma once

#include <cstdint>
#include <memory>
#include <optional>
#include <vector>

#include "virtual_planner/domain/entities/goal.hpp"

namespace virtual_planner::persistence {

class GoalRepository
{
public:
    virtual ~GoalRepository() = default;

    virtual std::uint64_t save(const domain::Goal& goal,
                               std::uint64_t user_id) = 0;

    virtual void update(const domain::Goal& goal,
                        std::uint64_t user_id) = 0;

    virtual std::optional<domain::Goal> find_by_id(
        std::uint64_t id,
        std::uint64_t user_id) = 0;

    virtual std::vector<domain::Goal> find_all(
        std::uint64_t user_id) = 0;

    virtual std::vector<domain::Goal> find_by_date_range(
        const domain::Date& start,
        const domain::Date& end,
        std::uint64_t user_id) = 0;

    virtual void remove(std::uint64_t id,
                        std::uint64_t user_id) = 0;
};

} // namespace virtual_planner::persistence
