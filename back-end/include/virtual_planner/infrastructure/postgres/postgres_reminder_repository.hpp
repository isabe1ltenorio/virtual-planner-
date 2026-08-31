#pragma once

#include <cstdint>

#include "virtual_planner/infrastructure/postgres/postgres_database.hpp"
#include "virtual_planner/persistence/reminder_repository.hpp"

#if defined(VIRTUAL_PLANNER_WITH_POSTGRES)

namespace virtual_planner::infrastructure::postgres {

class PostgresReminderRepository final
    : public persistence::ReminderRepository
{
public:
    explicit PostgresReminderRepository(
        PostgresDatabase& database);

    std::uint64_t save(const domain::Reminder& reminder,
                       std::uint64_t user_id = 1) override;

    void update(const domain::Reminder& reminder,
                std::uint64_t user_id = 1) override;

    std::optional<domain::Reminder> find_by_id(
        std::uint64_t id,
        std::uint64_t user_id = 1) override;

    std::vector<domain::Reminder> find_all(
        std::uint64_t user_id = 1) override;

    void remove(std::uint64_t id,
                std::uint64_t user_id = 1) override;

private:
    PostgresDatabase& database_;
};

} // namespace virtual_planner::infrastructure::postgres

#endif
