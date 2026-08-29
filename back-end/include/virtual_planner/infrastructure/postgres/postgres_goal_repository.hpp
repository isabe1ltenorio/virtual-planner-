#pragma once
#include <cstdint>

#include "virtual_planner/infrastructure/postgres/postgres_database.hpp"
#include "virtual_planner/persistence/goal_repository.hpp"

#if defined(VIRTUAL_PLANNER_WITH_POSTGRES)

namespace virtual_planner::infrastructure::postgres
{

class PostgresGoalRepository final
    : public persistence::GoalRepository
{
public:
    explicit PostgresGoalRepository(
        PostgresDatabase& database);

    std::uint64_t save(const domain::Goal& goal,
                       std::uint64_t user_id) override;

    void update(const domain::Goal& goal,
                std::uint64_t user_id) override;

    std::optional<domain::Goal> find_by_id(
        std::uint64_t id,
        std::uint64_t user_id) override;

    std::vector<domain::Goal> find_all(
        std::uint64_t user_id) override;

    std::vector<domain::Goal> find_by_date_range(
        const domain::Date& start_date,
        const domain::Date& end_date,
        std::uint64_t user_id) override;

    void remove(std::uint64_t id,
                std::uint64_t user_id) override;

private:
    PostgresDatabase& database_;
};

} // namespace virtual_planner::infrastructure::postgres

#endif
