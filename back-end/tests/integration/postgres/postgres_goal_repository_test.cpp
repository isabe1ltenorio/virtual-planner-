#include <algorithm>
#include <cstdlib>
#include <iostream>
#include <string>

#include "virtual_planner/infrastructure/postgres/postgres_config.hpp"
#include "virtual_planner/infrastructure/postgres/postgres_database.hpp"
#include "virtual_planner/infrastructure/postgres/postgres_goal_repository.hpp"

#include "support/expect.hpp"

#include <cstdint>

using namespace virtual_planner;

namespace
{

bool has_postgres_environment()
{
    return std::getenv("POSTGRES_DB") != nullptr &&
           std::getenv("POSTGRES_USER") != nullptr &&
           std::getenv("POSTGRES_PASSWORD") != nullptr;
}

} // namespace

int main()
{
    using infrastructure::postgres::PostgresConfig;
    using infrastructure::postgres::PostgresDatabase;
    using infrastructure::postgres::PostgresGoalRepository;

    if (!has_postgres_environment())
    {
        std::cout
            << "Skipping PostgreSQL goal repository test: "
            << "POSTGRES_DB, POSTGRES_USER and POSTGRES_PASSWORD "
            << "are required.\n";

        return 0;
    }

    try
    {
        // Arrange
        PostgresDatabase database(
            PostgresConfig::from_environment());

        database.initialize();
        database.connect();

        PostgresGoalRepository repository(database);

        // O usuario semeado pela migration 001. Toda query do adapter e
        // escopada por dono desde a 023.
        constexpr std::uint64_t kOwner = 1;

        domain::Goal goal(
            0,
            "Finish C++ Planner",
            domain::Category::Study,
            domain::GoalStatus::InProgress,
            domain::GoalPeriod::Weekly,
            domain::Date(10, 8, 2026));

        // Act: save()
        const auto id = repository.save(goal, kOwner);

        // Assert save()
        VP_EXPECT(
            id != 0,
            "save() must return a non-zero id");

        auto saved_goal = repository.find_by_id(id, kOwner);

        VP_EXPECT(
            saved_goal.has_value(),
            "find_by_id() must return the saved goal");

        VP_EXPECT(
            saved_goal->id() == id,
            "saved goal id must match");

        VP_EXPECT(
            saved_goal->description() == "Finish C++ Planner",
            "saved goal description must match");

        VP_EXPECT(
            saved_goal->category() == domain::Category::Study,
            "saved goal category must match");

        VP_EXPECT(
            saved_goal->status() == domain::GoalStatus::InProgress,
            "saved goal status must match");

        VP_EXPECT(
            saved_goal->period() == domain::GoalPeriod::Weekly,
            "saved goal period must match");

        VP_EXPECT(
            saved_goal->reference_date() ==
                domain::Date(10, 8, 2026),
            "saved goal reference date must match");

        // Assert find_all()
        const auto goals = repository.find_all(kOwner);

        const auto found = std::any_of(
            goals.begin(),
            goals.end(),
            [id](const domain::Goal& current)
            {
                return current.id() == id;
            });

        VP_EXPECT(
            found,
            "find_all() must include the saved goal");

        // Act: update() — this is the path that used to fail because the
        // 001 schema had no updated_at column while the repository set it
        // unconditionally (see migrations/021_add_goals_timestamps_and_checks.sql).
        domain::Goal updated_goal(
            id,
            "Finish C++ Planner (revised)",
            domain::Category::PersonalProjects,
            domain::GoalStatus::Completed,
            domain::GoalPeriod::Monthly,
            domain::Date(20, 8, 2026));

        repository.update(updated_goal, kOwner);

        // Assert update()
        auto reloaded_goal = repository.find_by_id(id, kOwner);

        VP_EXPECT(
            reloaded_goal.has_value(),
            "find_by_id() must return the updated goal");

        VP_EXPECT(
            reloaded_goal->id() == id,
            "updated goal id must be unchanged");

        VP_EXPECT(
            reloaded_goal->description() ==
                "Finish C++ Planner (revised)",
            "update() must persist the new description");

        VP_EXPECT(
            reloaded_goal->category() ==
                domain::Category::PersonalProjects,
            "update() must persist the new category");

        VP_EXPECT(
            reloaded_goal->status() ==
                domain::GoalStatus::Completed,
            "update() must persist the new status");

        VP_EXPECT(
            reloaded_goal->period() ==
                domain::GoalPeriod::Monthly,
            "update() must persist the new period");

        VP_EXPECT(
            reloaded_goal->reference_date() ==
                domain::Date(20, 8, 2026),
            "update() must persist the new reference date");

        // Assert find_by_date_range()
        //
        // The updated goal now has reference_date = 20/08/2026,
        // so it must belong to this interval.
        const auto goals_in_range =
            repository.find_by_date_range(
                domain::Date(15, 8, 2026),
                domain::Date(25, 8, 2026),
                kOwner);

        const auto found_in_range = std::any_of(
            goals_in_range.begin(),
            goals_in_range.end(),
            [id](const domain::Goal& current)
            {
                return current.id() == id;
            });

        VP_EXPECT(
            found_in_range,
            "find_by_date_range() must include the updated goal");

        // Act: query with the goal exactly on the lower boundary.
        const auto goals_on_start_boundary =
            repository.find_by_date_range(
                domain::Date(20, 8, 2026),
                domain::Date(25, 8, 2026),
                kOwner);

        // Assert: the lower boundary is inclusive.
        const auto found_on_start_boundary = std::any_of(
            goals_on_start_boundary.begin(),
            goals_on_start_boundary.end(),
            [id](const domain::Goal& current)
            {
                return current.id() == id;
            });

        VP_EXPECT(
            found_on_start_boundary,
            "find_by_date_range() must include the start boundary");

        // Act: query with the goal exactly on the upper boundary.
        const auto goals_on_end_boundary =
            repository.find_by_date_range(
                domain::Date(15, 8, 2026),
                domain::Date(20, 8, 2026),
                kOwner);

        // Assert: the upper boundary is inclusive.
        const auto found_on_end_boundary = std::any_of(
            goals_on_end_boundary.begin(),
            goals_on_end_boundary.end(),
            [id](const domain::Goal& current)
            {
                return current.id() == id;
            });

        VP_EXPECT(
            found_on_end_boundary,
            "find_by_date_range() must include the end boundary");

        // Assert that the same goal is outside another range.
        const auto goals_outside_range =
            repository.find_by_date_range(
                domain::Date(1, 8, 2026),
                domain::Date(15, 8, 2026),
                kOwner);

        const auto found_outside_range = std::any_of(
            goals_outside_range.begin(),
            goals_outside_range.end(),
            [id](const domain::Goal& current)
            {
                return current.id() == id;
            });

        VP_EXPECT(
            !found_outside_range,
            "find_by_date_range() must exclude goals outside the range");

        // Cleanup
        repository.remove(id, kOwner);

        const auto removed_goal =
            repository.find_by_id(id, kOwner);

        VP_EXPECT(
            !removed_goal.has_value(),
            "remove() must delete the goal");

        database.shutdown();

        VP_EXPECT(
            !database.is_connected(),
            "database must be disconnected after shutdown");

        return 0;
    }
    catch (const std::exception& error)
    {
        std::cerr << error.what() << '\n';
        return 1;
    }
}
