#include "virtual_planner/infrastructure/postgres/postgres_goal_repository.hpp"

#if defined(VIRTUAL_PLANNER_WITH_POSTGRES)

#include <cstdint>
#include <iomanip>
#include <pqxx/pqxx>
#include <sstream>
#include <string>

namespace virtual_planner::infrastructure::postgres {

namespace
{

std::string date_to_postgres(const domain::Date& date)
{
    std::ostringstream stream;

    stream << date.year()
           << '-'
           << std::setfill('0') << std::setw(2) << date.month()
           << '-'
           << std::setw(2) << date.day();

    return stream.str();
}

domain::Date date_from_postgres(const pqxx::row_ref& row)
{
    return domain::Date(
        row["reference_date_day"].as<std::uint32_t>(),
        row["reference_date_month"].as<std::uint32_t>(),
        row["reference_date_year"].as<std::uint32_t>());
}

} // namespace

PostgresGoalRepository::PostgresGoalRepository(
    PostgresDatabase& database)
    : database_(database)
{
}

std::uint64_t PostgresGoalRepository::save(
    const domain::Goal& goal,
    std::uint64_t user_id)
{
    pqxx::work transaction(database_.connection());

    auto result = transaction.exec(
        R"(
            INSERT INTO goals
            (
                user_id,
                description,
                category,
                status,
                period,
                reference_date
            )
            VALUES ($1,$2,$3,$4,$5,$6)
            RETURNING id
        )",
        pqxx::params{
            transaction,
            user_id,
            goal.description(),
            to_string(goal.category()),
            to_string(goal.status()),
            to_string(goal.period()),
            date_to_postgres(goal.reference_date())
        });

    const auto id =
        result.one_row()["id"].as<std::uint64_t>();

    transaction.commit();

    return id;
}

void PostgresGoalRepository::update(
    const domain::Goal& goal,
    std::uint64_t user_id)
{
    pqxx::work transaction(database_.connection());

    transaction.exec(
        R"(
            UPDATE goals
            SET
                description=$1,
                category=$2,
                status=$3,
                period=$4,
                reference_date=$5,
                updated_at=CURRENT_TIMESTAMP
            WHERE id=$6 AND user_id=$7
        )",
        pqxx::params{
            transaction,
            goal.description(),
            to_string(goal.category()),
            to_string(goal.status()),
            to_string(goal.period()),
            date_to_postgres(goal.reference_date()),
            goal.id(),
            user_id
        }).no_rows();

    transaction.commit();
}

std::optional<domain::Goal>
PostgresGoalRepository::find_by_id(std::uint64_t id,
                                   std::uint64_t user_id)
{
    pqxx::read_transaction transaction(
        database_.connection());

    auto result = transaction.exec(
        R"(
            SELECT
                id,
                description,
                category,
                status,
                period,
                EXTRACT(DAY FROM reference_date)::INTEGER
                    AS reference_date_day,
                EXTRACT(MONTH FROM reference_date)::INTEGER
                    AS reference_date_month,
                EXTRACT(YEAR FROM reference_date)::INTEGER
                    AS reference_date_year
            FROM goals
            WHERE id = $1 AND user_id = $2
        )",
        pqxx::params{transaction, id, user_id}
    );

    if (result.empty())
    {
        return std::nullopt;
    }

    const auto& row = result.front();

    return domain::Goal(
        row["id"].as<std::uint64_t>(),
        row["description"].as<std::string>(),
        domain::category_from_string(
            row["category"].as<std::string>()),
        domain::goal_status_from_string(
            row["status"].as<std::string>()),
        domain::goal_period_from_string(
            row["period"].as<std::string>()),
        date_from_postgres(row)
    );
}

std::vector<domain::Goal>
PostgresGoalRepository::find_all(std::uint64_t user_id)
{
    pqxx::read_transaction transaction(
        database_.connection());

    auto result = transaction.exec(
        R"(
            SELECT
                id,
                description,
                category,
                status,
                period,
                EXTRACT(DAY FROM reference_date)::INTEGER
                    AS reference_date_day,
                EXTRACT(MONTH FROM reference_date)::INTEGER
                    AS reference_date_month,
                EXTRACT(YEAR FROM reference_date)::INTEGER
                    AS reference_date_year
            FROM goals
            WHERE user_id = $1
            ORDER BY id
        )",
        pqxx::params{transaction, user_id}
    );

    std::vector<domain::Goal> goals;

    goals.reserve(result.size());

    for (const auto& row : result)
    {
        goals.emplace_back(
            row["id"].as<std::uint64_t>(),
            row["description"].as<std::string>(),
            domain::category_from_string(
                row["category"].as<std::string>()),
            domain::goal_status_from_string(
                row["status"].as<std::string>()),
            domain::goal_period_from_string(
                row["period"].as<std::string>()),
            date_from_postgres(row)
        );
    }

    return goals;
}

std::vector<domain::Goal>
PostgresGoalRepository::find_by_date_range(
    const domain::Date& start,
    const domain::Date& end,
    std::uint64_t user_id)
{
    pqxx::read_transaction transaction(
        database_.connection());

    auto result = transaction.exec(
        R"(
            SELECT
                id,
                description,
                category,
                status,
                period,
                EXTRACT(DAY FROM reference_date)::INTEGER
                    AS reference_date_day,
                EXTRACT(MONTH FROM reference_date)::INTEGER
                    AS reference_date_month,
                EXTRACT(YEAR FROM reference_date)::INTEGER
                    AS reference_date_year
            FROM goals
            WHERE user_id = $1
              AND reference_date >= $2
              AND reference_date <= $3
            ORDER BY reference_date, id
        )",
        pqxx::params{
            transaction,
            user_id,
            date_to_postgres(start),
            date_to_postgres(end)
        }
    );

    std::vector<domain::Goal> goals;

    goals.reserve(result.size());

    for (const auto& row : result)
    {
        goals.emplace_back(
            row["id"].as<std::uint64_t>(),
            row["description"].as<std::string>(),
            domain::category_from_string(
                row["category"].as<std::string>()),
            domain::goal_status_from_string(
                row["status"].as<std::string>()),
            domain::goal_period_from_string(
                row["period"].as<std::string>()),
            date_from_postgres(row)
        );
    }

    return goals;
}

void PostgresGoalRepository::remove(
    std::uint64_t id,
    std::uint64_t user_id)
{
    pqxx::work transaction(database_.connection());

    transaction.exec(
        "DELETE FROM goals WHERE id=$1 AND user_id=$2",
        pqxx::params{transaction, id, user_id}).no_rows();

    transaction.commit();
}

} // namespace virtual_planner::infrastructure::postgres

#endif
