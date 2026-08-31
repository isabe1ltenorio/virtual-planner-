#include "virtual_planner/infrastructure/postgres/postgres_task_repository.hpp"

#if defined(VIRTUAL_PLANNER_WITH_POSTGRES)

#include <chrono>
#include <cstdint>
#include <pqxx/pqxx>
#include <string>

#include "virtual_planner/domain/enums/category.hpp"
#include "virtual_planner/domain/enums/priority.hpp"
#include "virtual_planner/domain/enums/task_status.hpp"

namespace virtual_planner::infrastructure::postgres {

namespace {


domain::Task task_from_row(const pqxx::row_ref& row)
{
    return domain::Task{
        row["id"].as<std::uint64_t>(),
        row["description"].as<std::string>(),
        domain::category_from_string(row["category"].as<std::string>()),
        domain::Date{
            row["date_day"].as<std::uint32_t>(),
            row["date_month"].as<std::uint32_t>(),
            row["date_year"].as<std::uint32_t>()},
        domain::TimeSlot{
            std::chrono::minutes{row["start_minutes"].as<std::int64_t>()},
            std::chrono::minutes{row["end_minutes"].as<std::int64_t>()}},
        domain::priority_from_string(row["priority"].as<std::string>()),
        domain::task_status_from_string(row["status"].as<std::string>()),
        row["scheduled_by_shift"].as<bool>()};
}

} // namespace

PostgresTaskRepository::PostgresTaskRepository(PostgresDatabase& database)
    : database_(database)
{
}

// O id vem da identity da tabela (migration 030), nao do chamador: save so
// insere e devolve o id gerado, como PostgresGoalRepository::save.
std::uint64_t PostgresTaskRepository::save(const domain::Task& task,
                                           std::uint64_t user_id)
{
    pqxx::work transaction(database_.connection());

    const auto result = transaction.exec(
        R"(
            INSERT INTO tasks
            (
                user_id,
                description,
                category,
                task_date,
                start_minutes,
                end_minutes,
                priority,
                status,
                scheduled_by_shift
            )
            VALUES ($1, $2, $3, make_date($4, $5, $6), $7, $8, $9, $10, $11)
            RETURNING id
        )",
        pqxx::params{
            transaction,
            user_id,
            task.description(),
            domain::to_string(task.category()),
            task.date().year(),
            task.date().month(),
            task.date().day(),
            task.time_slot().start().count(),
            task.time_slot().end().count(),
            domain::to_string(task.priority()),
            domain::to_string(task.status()),
            task.scheduled_by_shift()});

    const auto id = result.one_row()["id"].as<std::uint64_t>();

    transaction.commit();

    return id;
}

void PostgresTaskRepository::update(const domain::Task& task,
                                    std::uint64_t user_id)
{
    pqxx::work transaction(database_.connection());

    transaction.exec(
        R"(
            UPDATE tasks
            SET
                description = $1,
                category = $2,
                task_date = make_date($3, $4, $5),
                start_minutes = $6,
                end_minutes = $7,
                priority = $8,
                status = $9,
                scheduled_by_shift = $10,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $11 AND user_id = $12
        )",
        pqxx::params{
            transaction,
            task.description(),
            domain::to_string(task.category()),
            task.date().year(),
            task.date().month(),
            task.date().day(),
            task.time_slot().start().count(),
            task.time_slot().end().count(),
            domain::to_string(task.priority()),
            domain::to_string(task.status()),
            task.scheduled_by_shift(),
            task.id(),
            user_id}).no_rows();

    transaction.commit();
}

std::optional<domain::Task>
PostgresTaskRepository::find_by_id(std::uint64_t id, std::uint64_t user_id)
{
    pqxx::read_transaction transaction(database_.connection());

    const auto result = transaction.exec(
        R"(
            SELECT
                id,
                description,
                category,
                EXTRACT(DAY FROM task_date)::INTEGER AS date_day,
                EXTRACT(MONTH FROM task_date)::INTEGER AS date_month,
                EXTRACT(YEAR FROM task_date)::INTEGER AS date_year,
                start_minutes,
                end_minutes,
                priority,
                status,
                scheduled_by_shift
            FROM tasks
            WHERE id = $1 AND user_id = $2
        )",
        pqxx::params{transaction, id, user_id});

    if (result.empty())
    {
        return std::nullopt;
    }

    return task_from_row(result.front());
}

std::vector<domain::Task>
PostgresTaskRepository::find_all(std::uint64_t user_id)
{
    pqxx::read_transaction transaction(database_.connection());

    const auto result = transaction.exec(
        R"(
            SELECT
                id,
                description,
                category,
                EXTRACT(DAY FROM task_date)::INTEGER AS date_day,
                EXTRACT(MONTH FROM task_date)::INTEGER AS date_month,
                EXTRACT(YEAR FROM task_date)::INTEGER AS date_year,
                start_minutes,
                end_minutes,
                priority,
                status,
                scheduled_by_shift
            FROM tasks
            WHERE user_id = $1
            ORDER BY id
        )",
        pqxx::params{transaction, user_id});

    std::vector<domain::Task> tasks;
    tasks.reserve(result.size());

    for (const auto& row : result)
    {
        tasks.push_back(task_from_row(row));
    }

    return tasks;
}

void PostgresTaskRepository::remove(std::uint64_t id, std::uint64_t user_id)
{
    pqxx::work transaction(database_.connection());

    transaction.exec(
        "DELETE FROM tasks WHERE id = $1 AND user_id = $2",
        pqxx::params{transaction, id, user_id}).no_rows();

    transaction.commit();
}

} // namespace virtual_planner::infrastructure::postgres

#endif
