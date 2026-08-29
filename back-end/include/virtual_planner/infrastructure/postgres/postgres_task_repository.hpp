#pragma once
#include <cstdint>

#include "virtual_planner/infrastructure/postgres/postgres_database.hpp"
#include "virtual_planner/persistence/task_repository.hpp"

#if defined(VIRTUAL_PLANNER_WITH_POSTGRES)

namespace virtual_planner::infrastructure::postgres
{

class PostgresTaskRepository final
    : public persistence::TaskRepository
{
public:
    explicit PostgresTaskRepository(PostgresDatabase& database);

    std::uint64_t save(const domain::Task& task,
                       std::uint64_t user_id) override;

    void update(const domain::Task& task, std::uint64_t user_id) override;

    std::optional<domain::Task> find_by_id(std::uint64_t id,
                                           std::uint64_t user_id) override;

    std::vector<domain::Task> find_all(std::uint64_t user_id) override;

    void remove(std::uint64_t id, std::uint64_t user_id) override;

private:
    PostgresDatabase& database_;
};

} // namespace virtual_planner::infrastructure::postgres

#endif
